"""SQLite transactions for leads and notification outbox (Python 3.10+)."""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import shutil
import sqlite3
import time
import uuid


SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE,
    fingerprint TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    consent_at INTEGER NOT NULL,
    policy_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    responsible TEXT NOT NULL DEFAULT '',
    next_action TEXT NOT NULL DEFAULT '',
    next_action_at TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS leads_fingerprint ON leads(fingerprint, created_at);
CREATE TABLE IF NOT EXISTS outbox (
    lead_id TEXT PRIMARY KEY REFERENCES leads(id),
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    next_at INTEGER NOT NULL,
    lease_token TEXT,
    lease_until INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS deliveries (
    lead_id TEXT NOT NULL REFERENCES leads(id),
    chat_id TEXT NOT NULL,
    delivered_at INTEGER,
    message_id TEXT,
    PRIMARY KEY(lead_id, chat_id)
);
CREATE TABLE IF NOT EXISTS notification_attempts (
    id INTEGER PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id),
    chat_id TEXT NOT NULL,
    attempted_at INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    error_code TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    bucket INTEGER NOT NULL,
    count INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS telegram_subscribers (
    chat_id TEXT PRIMARY KEY,
    active INTEGER NOT NULL,
    generation INTEGER NOT NULL,
    command_date INTEGER NOT NULL,
    command_message_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_recipients (
    lead_id TEXT NOT NULL REFERENCES leads(id),
    chat_id TEXT NOT NULL REFERENCES telegram_subscribers(chat_id),
    generation INTEGER NOT NULL,
    PRIMARY KEY (lead_id, chat_id)
);
PRAGMA user_version = 1;
"""


class Rejected(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(message)


class Store:
    def __init__(self, path):
        self.path = Path(path)

    @contextmanager
    def connection(self, write=False):
        con = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        con.row_factory = sqlite3.Row
        con.execute("PRAGMA foreign_keys=ON")
        con.execute("PRAGMA synchronous=FULL")
        page_size = con.execute("PRAGMA page_size").fetchone()[0]
        con.execute(f"PRAGMA max_page_count={128 * 1024 * 1024 // page_size}")
        try:
            if write:
                con.execute("BEGIN IMMEDIATE")
            yield con
            if write:
                con.commit()
        except BaseException:
            if write:
                con.rollback()
            raise
        finally:
            con.close()

    def initialize(self):
        self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        with self.connection() as con:
            version = con.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise RuntimeError("Unsupported registry schema")
            con.execute("PRAGMA journal_mode=WAL")
            page_size = con.execute("PRAGMA page_size").fetchone()[0]
            con.execute(f"PRAGMA max_page_count={128 * 1024 * 1024 // page_size}")
            con.executescript(SCHEMA)
        self.path.chmod(0o600)

    def ready(self):
        with self.connection() as con:
            con.execute("SELECT id FROM leads LIMIT 1").fetchone()
            return (con.execute("PRAGMA user_version").fetchone()[0] == 1
                    and con.execute("PRAGMA page_count").fetchone()[0] < 128 * 1024 * 1024 // con.execute("PRAGMA page_size").fetchone()[0]
                    and shutil.disk_usage(self.path.parent).free >= 20 * 1024 * 1024)

    def save(self, lead, request_id, ip_key, policy_version, now=None):
        now = int(time.time()) if now is None else now
        payload = json.dumps(lead, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
        # New optional attribution must not change the identity understood by
        # the previous API release. Keep retries valid even during a code rollback;
        # the originally committed metadata stays attached to the existing lead.
        identity = {key: value for key, value in lead.items() if key not in {"product", "direction", "ctaPage", "ctaLocation", "interest", "consentVersion"}}
        fingerprint = hashlib.sha256(json.dumps(identity, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
        if shutil.disk_usage(self.path.parent).free < 20 * 1024 * 1024:
            raise Rejected(503, "Сервис временно недоступен. Попробуйте позже.")
        with self.connection(write=True) as con:
            if request_id:
                existing = con.execute("SELECT id, fingerprint FROM leads WHERE request_id=?", (request_id,)).fetchone()
                if existing:
                    if existing["fingerprint"] != fingerprint:
                        raise Rejected(409, "Данные изменились. Отправьте их как новую заявку.")
                    return existing["id"], True
            else:
                # Compatibility for already-open forms without a request ID.
                existing = con.execute(
                    "SELECT id FROM leads WHERE fingerprint=? AND created_at>=? ORDER BY created_at DESC LIMIT 1",
                    (fingerprint, now - 600),
                ).fetchone()
                if existing:
                    return existing["id"], True
            bucket = now // 60
            for key, limit in ((ip_key, 10), ("global", 60)):
                row = con.execute("SELECT count, bucket FROM rate_limits WHERE key=?", (key,)).fetchone()
                if row and row["bucket"] == bucket and row["count"] >= limit:
                    raise Rejected(429, "Слишком много попыток. Попробуйте через минуту.")
                con.execute("""INSERT INTO rate_limits(key,bucket,count) VALUES (?,?,1)
                    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN bucket=excluded.bucket THEN count+1 ELSE 1 END,
                    bucket=excluded.bucket""", (key, bucket))
            con.execute("DELETE FROM rate_limits WHERE bucket<?", (bucket - 2,))
            lead_id = str(uuid.uuid4())
            con.execute("""INSERT INTO leads(id,request_id,fingerprint,payload,created_at,consent_at,policy_version)
                VALUES (?,?,?,?,?,?,?)""", (lead_id, request_id, fingerprint, payload, now, now, policy_version))
            con.execute("INSERT INTO outbox(lead_id,next_at) VALUES (?,?)", (lead_id, now))
        return lead_id, False  # Only after COMMIT succeeds.

    def claim(self, now=None):
        now = int(time.time()) if now is None else now
        with self.connection(write=True) as con:
            row = con.execute("""SELECT o.*, l.payload, l.created_at FROM outbox o JOIN leads l ON l.id=o.lead_id
                WHERE o.status IN ('pending','retry','sending') AND o.next_at<=? AND o.lease_until<=?
                ORDER BY o.next_at LIMIT 1""", (now, now)).fetchone()
            if not row:
                return None
            token = str(uuid.uuid4())
            con.execute("UPDATE outbox SET status='sending', lease_token=?, lease_until=?, attempts=attempts+1 WHERE lead_id=?",
                        (token, now + 120, row["lead_id"]))
            return {**dict(row), "lease_token": token, "attempts": row["attempts"] + 1}

    def delivered(self, lead_id, chat_id):
        with self.connection() as con:
            return bool(con.execute("SELECT delivered_at FROM deliveries WHERE lead_id=? AND chat_id=? AND delivered_at IS NOT NULL",
                                    (lead_id, chat_id)).fetchone())

    def bot_command(self, chat_id, command, stamp, message_id):
        with self.connection(write=True) as con:
            row = con.execute("SELECT * FROM telegram_subscribers WHERE chat_id=?", (chat_id,)).fetchone()
            if command != "status" and (not row or (stamp, message_id) > (row["command_date"], row["command_message_id"])):
                active = int(command == "start")
                generation = (row["generation"] if row else 0) + int(active and (not row or not row["active"]))
                con.execute("""INSERT INTO telegram_subscribers VALUES (?,?,?,?,?) ON CONFLICT(chat_id) DO UPDATE SET
                    active=excluded.active,generation=excluded.generation,command_date=excluded.command_date,
                    command_message_id=excluded.command_message_id""", (chat_id, active, generation, stamp, message_id))
                if active:
                    con.execute("UPDATE outbox SET next_at=0 WHERE last_error='waiting_subscribers' AND lease_until=0")
                return bool(active)
            return bool(row and row["active"])

    def subscriber_targets(self, job):
        """Freeze recipients on first send; later subscribers do not receive retries of old leads."""
        with self.connection(write=True) as con:
            if not con.execute("SELECT 1 FROM outbox WHERE lead_id=? AND lease_token=?", (job["lead_id"], job["lease_token"])).fetchone():
                raise RuntimeError("Notification lease was replaced")
            if not con.execute("SELECT 1 FROM notification_recipients WHERE lead_id=?", (job["lead_id"],)).fetchone():
                con.execute("""INSERT INTO notification_recipients SELECT ?,chat_id,generation
                    FROM telegram_subscribers WHERE active=1""", (job["lead_id"],))
                if not con.execute("SELECT 1 FROM notification_recipients WHERE lead_id=?", (job["lead_id"],)).fetchone():
                    return None
            return con.execute("""SELECT r.chat_id,r.generation FROM notification_recipients r
                JOIN telegram_subscribers s ON s.chat_id=r.chat_id AND s.active=1 AND s.generation=r.generation
                LEFT JOIN deliveries d ON d.lead_id=r.lead_id AND d.chat_id=r.chat_id
                WHERE r.lead_id=? AND d.delivered_at IS NULL ORDER BY r.chat_id LIMIT 5""", (job["lead_id"],)).fetchall()

    def subscriber_active(self, chat_id, generation):
        with self.connection() as con:
            return bool(con.execute("SELECT 1 FROM telegram_subscribers WHERE chat_id=? AND generation=? AND active=1", (chat_id, generation)).fetchone())

    def defer(self, job, code, now=None):
        now = int(time.time()) if now is None else now
        with self.connection(write=True) as con:
            con.execute("""UPDATE outbox SET status='retry',next_at=?,lease_until=0,lease_token=NULL,
                attempts=MAX(0,attempts-1),last_error=? WHERE lead_id=? AND lease_token=?""",
                (now + 60, code, job["lead_id"], job["lease_token"]))

    def record_delivery(self, job, chat_id, outcome, code="", message_id=None, now=None):
        now = int(time.time()) if now is None else now
        with self.connection(write=True) as con:
            if not con.execute("SELECT 1 FROM outbox WHERE lead_id=? AND lease_token=?", (job["lead_id"], job["lease_token"])).fetchone():
                raise RuntimeError("Notification lease was replaced")
            con.execute("INSERT INTO notification_attempts(lead_id,chat_id,attempted_at,outcome,error_code) VALUES (?,?,?,?,?)",
                        (job["lead_id"], chat_id, now, outcome, code))
            if outcome == "delivered":
                con.execute("INSERT OR REPLACE INTO deliveries(lead_id,chat_id,delivered_at,message_id) VALUES (?,?,?,?)",
                            (job["lead_id"], chat_id, now, str(message_id)))

    def finish(self, job, success, code="", retry_after=0, now=None):
        now = int(time.time()) if now is None else now
        status = "delivered" if success else ("attention" if job["attempts"] >= 12 else "retry")
        delay = max(min(retry_after, 3600), min(3600, 30 * 2 ** min(job["attempts"] - 1, 7)))
        with self.connection(write=True) as con:
            con.execute("""UPDATE outbox SET status=?,next_at=?,lease_until=0,lease_token=NULL,last_error=?
                WHERE lead_id=? AND lease_token=?""", (status, now + delay, code, job["lead_id"], job["lease_token"]))

    def retry(self, lead_id):
        with self.connection(write=True) as con:
            row = con.execute("SELECT status,lease_until FROM outbox WHERE lead_id=?", (lead_id,)).fetchone()
            if not row or row["status"] == "delivered" or row["lease_until"] > time.time():
                raise ValueError("Lead absent, already delivered, or currently sending")
            con.execute("UPDATE outbox SET status='retry',next_at=0,attempts=0,lease_until=0,lease_token=NULL WHERE lead_id=?", (lead_id,))

    def stats(self):
        with self.connection() as con:
            return {"leads": con.execute("SELECT count(*) FROM leads").fetchone()[0],
                    "notifications": dict(con.execute("SELECT status,count(*) FROM outbox GROUP BY status").fetchall())}

    def backup(self, destination):
        destination = Path(destination)
        if destination.exists():
            raise ValueError("Backup target already exists")
        # reserve the file with private permissions before SQLite opens it
        import os
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        os.close(descriptor)
        try:
            with self.connection() as source:
                target = sqlite3.connect(destination)
                try:
                    source.backup(target)
                    if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                        raise RuntimeError("Backup integrity check failed")
                finally:
                    target.close()
        except BaseException:
            destination.unlink(missing_ok=True)
            raise
