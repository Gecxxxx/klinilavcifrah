from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import io
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch
import uuid

from backend.app import Application, Config, validated
from backend.notify import DeliveryError, drain, notification_text
from backend.store import Rejected, Store


def fixture(**extra):
    return {"name": "Тестовый контакт", "company": "Синтетическая клиника", "phone": "+79990000000",
            "message": "Тестовые данные без пациентов", "website": "example.test", "consent": True,
            "website_check": "", "page": "/kontakty", "referrer": "https://example.test/", "utm": {"utm_source": "test"},
            **extra}


class RegistryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config = Config(Path(self.temp.name) / "leads.sqlite3", "x" * 64, "fake-token", ("101", "202"))
        self.app = Application(self.config)
        self.store = self.app.store

    def call(self, value=None, method="POST", path="/api/leads", origin="https://klinikavcifrah.ru", content_type="application/json", raw=None):
        data = json.dumps(fixture() if value is None else value, ensure_ascii=False).encode() if raw is None else raw
        environ = {"REQUEST_METHOD": method, "PATH_INFO": path, "HTTP_ORIGIN": origin, "CONTENT_TYPE": content_type,
                   "CONTENT_LENGTH": str(len(data)), "HTTP_X_REAL_IP": "192.0.2.1", "wsgi.input": io.BytesIO(data)}
        result = {}
        body = b"".join(self.app(environ, lambda status, headers: result.update(status=int(status.split()[0]), headers=dict(headers))))
        return result["status"], json.loads(body) if body else None

    def save(self, **extra):
        lead, request_id, _ = validated(fixture(requestId=str(uuid.uuid4()), **extra))
        return self.store.save(lead, request_id, "hashed-test-ip", "test-policy")[0]

    def test_persists_all_five_pages_and_consent_before_notifications(self):
        for page in ["/", "/kontakty", "/kak-rabotaem", "/kejsy-i-razbory", "/dlya-klinik"]:
            status, result = self.call(fixture(page=page, requestId=str(uuid.uuid4())))
            self.assertEqual(status, 200); self.assertTrue(result["saved"])
        with self.store.connection() as con:
            self.assertEqual(con.execute("SELECT count(*) FROM leads").fetchone()[0], 5)
            self.assertEqual(con.execute("SELECT count(*) FROM outbox WHERE status='pending'").fetchone()[0], 5)
            row = con.execute("SELECT * FROM leads LIMIT 1").fetchone()
            self.assertTrue(row["consent_at"]); self.assertEqual(row["policy_version"], self.config.policy_version)
            self.assertEqual(json.loads(row["payload"])["utm"]["utm_source"], "test")
        result = subprocess.check_output(["python3", "-m", "backend.cli", "--db", str(self.config.db), "stats"])
        self.assertEqual(json.loads(result)["leads"], 5)

    def test_concurrent_same_id_is_one_committed_lead_and_outbox(self):
        lead, request_id, _ = validated(fixture(requestId=str(uuid.uuid4())))
        def send(_):
            return self.store.save(lead, request_id, "same-ip", "test-policy")[0]
        with ThreadPoolExecutor(8) as pool:
            ids = list(pool.map(send, range(16)))
        self.assertEqual(len(set(ids)), 1)
        self.assertEqual(self.store.stats(), {"leads": 1, "notifications": {"pending": 1}})

    def test_lost_http_response_and_restart_recovers_same_id_without_new_captcha(self):
        values = fixture(requestId=str(uuid.uuid4()))
        _, first = self.call(values)  # pretend the browser never receives this response
        self.app = Application(replace(self.config, turnstile_secret="configured"),
                               verifier=lambda *_: self.fail("Consumed CAPTCHA must not be rechecked"))
        _, second = self.call(values)
        self.assertEqual(first["id"], second["id"]); self.assertTrue(second["duplicate"])
        status, _ = self.call({**values, "message": "changed"})
        self.assertEqual(status, 409)
        self.assertEqual(self.store.stats()["leads"], 1)

    def test_old_open_forms_get_heuristic_retry_deduplication(self):
        _, first = self.call(fixture())
        _, second = self.call(fixture())
        self.assertEqual(first["id"], second["id"])
        self.assertTrue(second["saved"])

    def test_real_transaction_failure_never_acknowledges_or_leaves_partial_lead(self):
        with self.store.connection() as con:
            con.execute("DROP TABLE outbox")
        status, result = self.call(fixture(requestId=str(uuid.uuid4())))
        self.assertEqual(status, 503); self.assertFalse(result["saved"])
        with self.store.connection() as con:
            self.assertEqual(con.execute("SELECT count(*) FROM leads").fetchone()[0], 0)

    def test_validation_origin_body_and_honeypot(self):
        bad = [{"consent": False}, {"name": "a"}, {"company": "a"}, {"phone": "abcdef"},
               {"phone": []}, {"message": "x" * 1001}, {"website_check": "bot"},
               {"requestId": "bad"}, {"utm": {"utm_source": "x" * 201}}]
        for change in bad:
            with self.subTest(change=change):
                self.assertEqual(self.call(fixture(**change))[0], 400)
        self.assertEqual(self.call(fixture(), origin="https://evil.test")[0], 403)
        self.assertEqual(self.call(fixture(), content_type="text/plain")[0], 415)
        self.assertEqual(self.call(raw=b"[bad json]")[0], 400)
        self.assertEqual(self.call(raw=b"x" * 16385)[0], 413)
        self.assertEqual(self.store.stats()["leads"], 0)

    def test_explicit_turnstile_failure_and_unavailability(self):
        self.app = Application(replace(self.config, turnstile_secret="configured"), verifier=lambda *_: False)
        self.assertEqual(self.call(fixture())[0], 400)
        def timeout(*_): raise TimeoutError()
        self.app.verify = timeout
        self.assertEqual(self.call(fixture())[0], 503)
        self.assertEqual(self.store.stats()["leads"], 0)

    def test_rate_limit_is_persistent_but_does_not_block_committed_replay(self):
        first = fixture(requestId=str(uuid.uuid4()))
        for index in range(10):
            status, _ = self.call(first if index == 0 else fixture(requestId=str(uuid.uuid4())))
            self.assertEqual(status, 200)
        self.app = Application(self.config)
        self.assertEqual(self.call(fixture(requestId=str(uuid.uuid4())))[0], 429)
        self.assertEqual(self.call(first)[0], 200)
        self.assertEqual(self.store.stats()["leads"], 10)

    def test_no_public_registry_and_no_personal_data_in_health(self):
        self.save()
        for path in ["/api/leads", "/leads", "/export", "/stats"]:
            self.assertEqual(self.call(method="GET", path=path)[0], 404)
        status, health = self.call(method="GET", path="/health")
        self.assertEqual(status, 200); self.assertNotIn("leads", health)
        self.assertEqual(self.call(method="OPTIONS")[0], 204)

    def test_telegram_outage_preserves_lead_and_retry_recovers(self):
        lead_id = self.save()
        now = int(time.time())
        def failed(*_): raise DeliveryError("telegram_http_503")
        drain(self.config, send=failed, now=now)
        self.assertEqual(self.store.stats(), {"leads": 1, "notifications": {"retry": 1}})
        calls = []
        def success(config, chat, text):
            calls.append(chat); self.assertIn(lead_id, text); return 42
        drain(self.config, send=success, now=now + 31)
        self.assertEqual(calls, ["101", "202"])
        self.assertEqual(self.store.stats()["notifications"], {"delivered": 1})
        drain(self.config, send=lambda *_: self.fail("Already delivered"), now=now + 100)

    def test_partial_delivery_does_not_resend_to_successful_recipient(self):
        self.save(); now = int(time.time())
        def partial(config, chat, text):
            if chat == "202": raise DeliveryError("transport_error")
            return 42
        drain(self.config, send=partial, now=now)
        calls = []
        drain(self.config, send=lambda config, chat, text: calls.append(chat) or 43, now=now + 31)
        self.assertEqual(calls, ["202"])
        with self.store.connection() as con:
            self.assertEqual(con.execute("SELECT count(*) FROM notification_attempts").fetchone()[0], 3)

    def test_retry_after_and_attention_manual_retry(self):
        lead_id = self.save(); now = int(time.time())
        def limited(*_): raise DeliveryError("telegram_http_429", 300)
        drain(self.config, send=limited, now=now)
        self.assertIsNone(self.store.claim(now + 31))
        for index in range(11):
            now += 4000
            drain(self.config, send=limited, now=now)
        self.assertEqual(self.store.stats()["notifications"], {"attention": 1})
        self.assertIsNone(self.store.claim(now + 10000))
        self.store.retry(lead_id)
        drain(self.config, send=lambda *_: 44, now=now + 10000)
        self.assertEqual(self.store.stats()["notifications"], {"delivered": 1})

    def test_crashed_sender_lease_expires_and_old_sender_cannot_mark_success(self):
        self.save(); now = int(time.time())
        first = self.store.claim(now)
        self.assertIsNone(self.store.claim(now + 119))
        second = self.store.claim(now + 121)
        self.assertEqual(first["lead_id"], second["lead_id"])
        with self.assertRaises(RuntimeError):
            self.store.record_delivery(first, "101", "delivered", message_id=42)

    def test_missing_notification_config_does_not_affect_capture(self):
        self.app = Application(replace(self.config, token="", chat_ids=()))
        status, result = self.call(fixture(requestId=str(uuid.uuid4())))
        self.assertEqual(status, 200); self.assertTrue(result["saved"])
        drain(self.app.config, now=int(time.time()))
        self.assertEqual(self.store.stats(), {"leads": 1, "notifications": {"retry": 1}})

    def test_backup_restores_separately_and_does_not_replace_new_leads(self):
        self.save()
        backup = Path(self.temp.name) / "backup.sqlite3"
        self.store.backup(backup)
        self.save()
        restored = Store(backup)
        self.assertTrue(restored.ready())
        self.assertEqual(restored.stats()["leads"], 1)
        self.assertEqual(self.store.stats()["leads"], 2)
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
        with self.assertRaises(ValueError): self.store.backup(backup)

    def test_private_export_and_notification_size(self):
        self.save(message="🧪" * 1000)
        output = Path(self.temp.name) / "leads.jsonl"
        subprocess.check_call(["python3", "-m", "backend.cli", "--db", str(self.config.db), "export", str(output)], stdout=subprocess.DEVNULL)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        self.assertEqual(json.loads(output.read_text())["payload"]["company"], "Синтетическая клиника")
        job = self.store.claim()
        self.assertLessEqual(len(notification_text(job).encode("utf-16-le")), 7000)


if __name__ == "__main__":
    unittest.main()
