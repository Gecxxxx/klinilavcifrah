import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("canonical", Path(__file__).with_name("configure-canonical.py"))
canonical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(canonical)

CONFIG = """server {

    server_name klinikavcifrah.ru www.klinikavcifrah.ru;
    root /var/www/klinikavcifrah/current;
    location = /api/leads { proxy_pass https://example.workers.dev/api/leads; }
    listen 443 ssl;
}
server {
    if ($host = www.klinikavcifrah.ru) { return 301 https://$host$request_uri; }
    listen 80;
}
"""


class CanonicalTest(unittest.TestCase):
    def test_only_insert_and_idempotent(self):
        changed = canonical.patch_config(CONFIG)
        self.assertEqual(changed.replace(canonical.REDIRECT, "", 1), CONFIG)
        self.assertEqual(canonical.patch_config(changed), changed)

    def test_unknown_layout_rejected(self):
        for text in (CONFIG.replace("listen 443 ssl;", "listen 80;"),
                     CONFIG.replace("server {", "# unfamiliar\nserver {", 1),
                     CONFIG.replace("/current;", "/other;")):
            with self.assertRaises(ValueError):
                canonical.patch_config(text)

    def test_success_and_failure_restore_preserve_symlink(self):
        for fail_at in (None, 2, 3):
            with self.subTest(fail_at=fail_at), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                target = root / "available.conf"
                target.write_text(CONFIG)
                target.chmod(0o640)
                link = root / "enabled.conf"
                link.symlink_to(target)
                calls = []

                def run(args):
                    calls.append(args)
                    if len(calls) == fail_at:
                        raise subprocess.CalledProcessError(1, args)

                if fail_at:
                    with self.assertRaises(subprocess.CalledProcessError):
                        canonical.install(link, root / "backups", run)
                    self.assertEqual(target.read_text(), CONFIG)
                    self.assertEqual(calls[-2:], [["nginx", "-t"], ["systemctl", "reload", "nginx"]])
                else:
                    canonical.install(link, root / "backups", run)
                    self.assertEqual(target.read_text(), canonical.patch_config(CONFIG))
                self.assertTrue(link.is_symlink())
                self.assertEqual(target.stat().st_mode & 0o777, 0o640)
                self.assertEqual(next((root / "backups").glob("*/nginx.conf")).read_text(), CONFIG)


if __name__ == "__main__":
    unittest.main()
