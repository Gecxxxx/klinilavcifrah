import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    loaded = importlib.util.module_from_spec(spec); spec.loader.exec_module(loaded)
    return loaded


api = module('api_deploy', 'deploy-api.py')
packager = module('api_package', 'package-api.py')
setup = module('api_setup', 'setup-leads.py')


class ApiOpsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'app'; self.root.mkdir()
        self.previous = self.root / 'releases' / 'baseline'; self.previous.mkdir(parents=True)
        (self.root / 'current').symlink_to(self.previous)
        (self.root.parent / 'enabled').touch()
        self.revision = 'b' * 40
        self.output = Path(self.temp.name) / 'output'
        packager.package(self.revision, self.output)
        self.archive = self.output / 'api.tar.gz'
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.db = Path(self.temp.name) / 'private.sqlite3'
        self.db.write_bytes(b'new records must survive code rollback')

    def publish(self, probe):
        api.deploy(self.archive, self.digest, self.revision, '123-1', self.root, probe=probe, pause=lambda _: None)

    def test_success_has_no_static_files_secrets_or_database(self):
        self.publish(lambda _: True)
        current = (self.root / 'current').resolve()
        self.assertEqual((current / 'backend/revision.txt').read_text().strip(), self.revision)
        self.assertEqual((self.root / 'reload.trigger').read_text().strip(), str(current))
        self.assertEqual({str(p.relative_to(current)) for p in current.rglob('*') if p.is_file()}, api.FILES)
        self.assertEqual(self.db.read_bytes(), b'new records must survive code rollback')

    def test_failed_or_interrupted_api_health_restores_only_code(self):
        for interrupt in [False, True]:
            if interrupt:
                def probe(_): raise KeyboardInterrupt()
            else:
                probe = lambda _: False
            with self.assertRaises((RuntimeError, KeyboardInterrupt)):
                self.publish(probe)
            self.assertEqual((self.root / 'current').resolve(), self.previous)
            self.assertEqual(self.db.read_bytes(), b'new records must survive code rollback')
            # remove the failed code directory to repeat the same run-id scenario
            import shutil
            shutil.rmtree(self.root / 'releases' / (self.revision + '-123-1'))

    def test_corrupt_or_symlink_archive_is_never_activated(self):
        self.digest = '0' * 64
        with self.assertRaises(ValueError): self.publish(lambda _: True)
        self.assertEqual((self.root / 'current').resolve(), self.previous)
        with tarfile.open(self.archive) as tar:
            members = [(m, tar.extractfile(m).read()) for m in tar.getmembers()]
        with tarfile.open(self.archive, 'w:gz') as tar:
            for member, body in members:
                if member.name == 'backend/app.py':
                    member.type = tarfile.SYMTYPE; member.linkname = '/etc/passwd'; member.size = 0
                    tar.addfile(member)
                else:
                    tar.addfile(member, io.BytesIO(body))
        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        with self.assertRaises(ValueError): self.publish(lambda _: True)
        self.assertEqual((self.root / 'current').resolve(), self.previous)

    def test_bootstrap_gate_does_not_activate_a_missing_service(self):
        (self.root.parent / 'enabled').unlink()
        self.publish(lambda _: self.fail('Should not probe'))
        self.assertEqual((self.root / 'current').resolve(), self.previous)

    def test_nginx_patch_keeps_tls_canonical_and_other_locations(self):
        old = '''server {
    if ($host = www.klinikavcifrah.ru) { return 308 https://klinikavcifrah.ru$request_uri; }
    server_name klinikavcifrah.ru www.klinikavcifrah.ru;
    root /var/www/klinikavcifrah/current;
    location = /api/leads {
        proxy_pass https://klinilavcifrah-api.eggetsevich.workers.dev/api/leads;
        proxy_ssl_server_name on;
    }
    location / { try_files $uri.html $uri =404; }
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/klinikavcifrah.ru/fullchain.pem;
}
'''
        changed = setup.patch_nginx(old)
        self.assertEqual(setup.patch_nginx(changed), changed)
        self.assertEqual(changed.replace(setup.LOCATION, old[old.index('    location = /api/leads {'):old.index('    location / {')].rstrip()), old)
        with self.assertRaises(ValueError): setup.patch_nginx(old.replace('proxy_pass https://klinilavcifrah-api.eggetsevich.workers.dev/api/leads;', 'proxy_pass http://unexpected;'))


if __name__ == '__main__': unittest.main()
