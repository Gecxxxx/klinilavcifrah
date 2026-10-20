"""Local operator commands; there is intentionally no public registry endpoint."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import shutil
import re
from backend.app import Config
from backend.notify import drain
from backend.store import Store


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=os.environ.get("KVC_DB", "/var/lib/kvc-leads/leads.sqlite3"))
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    sub.add_parser("stats")
    sub.add_parser("list")
    sub.add_parser("drain").add_argument("--limit", type=int, default=2)
    retry = sub.add_parser("retry"); retry.add_argument("id")
    export = sub.add_parser("export"); export.add_argument("output", type=Path)
    backup = sub.add_parser("backup"); backup.add_argument("directory", type=Path)
    update = sub.add_parser("update")
    update.add_argument("id")
    update.add_argument("--status", choices=["new", "contacted", "qualified", "negotiation", "contract", "paid", "closed"], required=True)
    update.add_argument("--responsible", default="")
    update.add_argument("--next-action", default="")
    update.add_argument("--next-date", default="")
    args = parser.parse_args()
    store = Store(args.db)
    if args.command == "init":
        store.initialize()
    elif args.command == "stats":
        print(json.dumps(store.stats()))
    elif args.command == "list":
        with store.connection() as con:
            for row in con.execute("SELECT l.id,l.created_at,l.status,l.responsible,l.next_action,l.next_action_at,o.status AS notification FROM leads l JOIN outbox o ON o.lead_id=l.id ORDER BY l.created_at DESC LIMIT 100"):
                print(json.dumps(dict(row), ensure_ascii=False))
    elif args.command == "drain":
        drain(Config.environment(), limit=max(1, min(args.limit, 5)))
        stats = store.stats()
        if stats["notifications"].get("attention", 0):
            print("Notification attention required; run kvc-leads stats/list (no personal data logged)")
            raise SystemExit(1)
    elif args.command == "retry":
        store.retry(args.id)
    elif args.command == "update":
        if any(len(x) > 300 for x in (args.responsible, args.next_action, args.next_date)):
            parser.error("Value too long")
        if args.next_date:
            datetime.fromisoformat(args.next_date)
        with store.connection(write=True) as con:
            if not con.execute("UPDATE leads SET status=?,responsible=?,next_action=?,next_action_at=? WHERE id=?",
                               (args.status, args.responsible, args.next_action, args.next_date, args.id)).rowcount:
                parser.error("Unknown lead")
    elif args.command == "export":
        with open(args.output, "x", encoding="utf-8", opener=lambda path, flags: os.open(path, flags, 0o600)) as out:
            with store.connection() as con:
                for row in con.execute("SELECT * FROM leads ORDER BY created_at"):
                    item = dict(row); item["payload"] = json.loads(item["payload"])
                    out.write(json.dumps(item, ensure_ascii=False) + "\n")
        print("Private JSONL export written")
    elif args.command == "backup":
        args.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        with store.connection() as con:
            size = con.execute("PRAGMA page_count").fetchone()[0] * con.execute("PRAGMA page_size").fetchone()[0]
        if shutil.disk_usage(args.directory).free < size + 20 * 1024 * 1024:
            raise RuntimeError("Insufficient disk space for a safe backup")
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        destination = args.directory / f"leads-{stamp}.sqlite3"
        store.backup(destination)
        # Confirm restoration on a separate in-memory database; never replace production.
        with sqlite3.connect(destination) as source, sqlite3.connect(":memory:") as restored:
            source.backup(restored)
            if restored.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("Restore verification failed")
        total = 0
        for index, old in enumerate(sorted((p for p in args.directory.glob("leads-*.sqlite3") if re.fullmatch(r"leads-[0-9]{8}T[0-9]{12}Z\.sqlite3", p.name)), reverse=True)):
            total += old.stat().st_size
            if index and (index >= 7 or total > 64 * 1024 * 1024):
                old.unlink()
        print(f"Backup and isolated restore verified: {destination}")


if __name__ == "__main__":
    main()
