import hashlib
import importlib.util
import io
import json
import tarfile
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("deployer", Path(__file__).with_name("deploy-release.py"))
deployer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployer)
COMMIT = "a" * 40


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "site"
        self.previous = self.root / "releases/5ab31de"
        self.previous.mkdir(parents=True)
        (self.previous / "index.html").write_text("working baseline")
        (self.previous / "_next/static").mkdir(parents=True)
        (self.previous / "_next/static/old.js").write_text("previous chunk")
        (self.root / "current").symlink_to(self.previous)
        self.archive = Path(self.temp.name) / "site.tar.gz"
        self.payload = {name: b"new page" for name in ["index.html", "kontakty.html", "404.html", "robots.txt", "sitemap.xml"]}
        self.payload["_next/static/new.js"] = b"current chunk"
        self.payload["__release.json"] = json.dumps({"commit": COMMIT, "files": {
            name: hashlib.sha256(value).hexdigest() for name, value in self.payload.items()
        }}).encode()
        self.write_archive()

    def write_archive(self):
        with tarfile.open(self.archive, "w:gz") as tar:
            for name, data in self.payload.items():
                member = tarfile.TarInfo(name)
                member.size = len(data)
                tar.addfile(member, io.BytesIO(data))
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def run_deploy(self, digest=None, commit=COMMIT):
        deployer.deploy(self.archive, digest or self.digest, commit, "123-1", self.root, "https://klinikavcifrah.ru")

    def assert_baseline(self):
        self.assertEqual((self.root / "current").resolve(), self.previous)
        self.assertEqual((self.previous / "index.html").read_text(), "working baseline")
        self.assertEqual(list((self.root / "releases").iterdir()), [self.previous])

    def test_verified_release_activated_and_previous_chunks_retained(self):
        with patch.object(deployer, "health") as check:
            self.run_deploy()
        current = (self.root / "current").resolve()
        self.assertEqual(current.name, COMMIT + "-123-1")
        self.assertEqual((current / "index.html").read_bytes(), b"new page")
        self.assertTrue((current / "_next/static/old.js").is_file())
        self.assertEqual((self.root / "previous-release.txt").read_text().strip(), str(self.previous))
        check.assert_called_once_with("https://klinikavcifrah.ru", COMMIT)

    def test_failed_health_restores_original_site(self):
        with patch.object(deployer, "health", side_effect=RuntimeError("broken HTTP")):
            with self.assertRaisesRegex(RuntimeError, "broken HTTP"):
                self.run_deploy()
        self.assert_baseline()

    def test_interrupted_health_restores_original_site(self):
        with patch.object(deployer, "health", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                self.run_deploy()
        self.assert_baseline()

    def test_corrupt_upload_never_replaces_live_site(self):
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            self.run_deploy(digest="0" * 64)
        self.assert_baseline()

    def test_wrong_commit_never_replaces_live_site(self):
        with self.assertRaisesRegex(ValueError, "commit mismatch"):
            self.run_deploy(commit="b" * 40)
        self.assert_baseline()

    def test_traversal_never_writes_outside_release(self):
        self.payload["../escape"] = b"unsafe"
        self.write_archive()
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            self.run_deploy()
        self.assertFalse((self.root / "releases/escape").exists())
        self.assert_baseline()

    def test_file_tampering_never_replaces_live_site(self):
        self.payload["index.html"] = b"modified after manifest creation"
        self.write_archive()
        with self.assertRaisesRegex(ValueError, "file hash mismatch"):
            self.run_deploy()
        self.assert_baseline()

    def test_previous_chunks_do_not_accumulate_across_builds(self):
        manifest = {"commit": "b" * 40, "files": {"_next/static/old.js": "not used here"}}
        (self.previous / "__release.json").write_text(json.dumps(manifest))
        (self.previous / "_next/static/older.js").write_text("obsolete retained chunk")
        with patch.object(deployer, "health"):
            self.run_deploy()
        self.assertFalse((self.root / "current/_next/static/older.js").exists())

    def test_cleanup_preserves_imported_baseline_and_unrelated_directories(self):
        unrelated = self.root / "releases/manual-backup"
        unrelated.mkdir()
        for index in range(7):
            old = self.root / "releases" / ("b" * 40 + f"-{index}-1")
            old.mkdir()
        with patch.object(deployer, "health"):
            self.run_deploy()
        generated = [p for p in (self.root / "releases").iterdir() if len(p.name) > 40]
        self.assertEqual(len(generated), 5)
        self.assertTrue(self.previous.is_dir())
        self.assertTrue(unrelated.is_dir())


class HealthTests(unittest.TestCase):
    def test_http_smoke_checks_existing_api_without_posting_leads(self):
        requests = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_GET(self):
                requests.append(("GET", self.path))
                if self.path.startswith("/__release.json"):
                    status, data = 200, json.dumps({"commit": COMMIT}).encode()
                elif self.path.startswith("/__kvc_nonexistent_"):
                    status, data = 404, b"not found"
                else:
                    status, data = 200, b"ok"
                self.send_response(status)
                self.end_headers()
                self.wfile.write(data)
            def do_OPTIONS(self):
                requests.append(("OPTIONS", self.path))
                # Regression: Cloudflare rejects the default Python-urllib UA.
                self.send_response(204 if self.headers.get("User-Agent") == "kvc-deploy-health/1.0" else 403)
                self.end_headers()
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            deployer.health(f"http://127.0.0.1:{server.server_port}", COMMIT, attempts=1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()
        self.assertIn(("OPTIONS", "/api/leads"), requests)
        self.assertFalse(any(method == "POST" for method, path in requests))


if __name__ == "__main__":
    unittest.main()
