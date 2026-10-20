import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
from unittest.mock import MagicMock
import urllib.error


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
        self.assertEqual(changed.replace(setup.LOCATION + '\n\n' + setup.BOT_LOCATION, old[old.index('    location = /api/leads {'):old.index('    location / {')].rstrip()), old)
        self.assertIn('X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token', changed)
        with self.assertRaises(ValueError): setup.patch_nginx(changed.replace('client_max_body_size 32k;', 'client_max_body_size 64k;'))
        with self.assertRaises(ValueError): setup.patch_nginx(old.replace('proxy_pass https://klinilavcifrah-api.eggetsevich.workers.dev/api/leads;', 'proxy_pass http://unexpected;'))

    def test_bootstrap_needs_only_token_and_generates_private_webhook_secret(self):
        env = Path(self.temp.name) / 'private-env'
        token = '123456:' + 't' * 32
        with patch.object(setup, 'ENV', env), patch.object(setup.getpass, 'getpass', return_value=token), patch('builtins.input', side_effect=AssertionError('Do not ask for chat ID')), patch.object(setup, 'bot_api', return_value={'id': 123456}) as api_call:
            setup.credentials()
        api_call.assert_called_once_with(token, 'getMe')
        values = dict(line.split('=', 1) for line in env.read_text().splitlines())
        self.assertEqual(values['TELEGRAM_RECIPIENT_MODE'], 'subscribers')
        self.assertNotIn('TELEGRAM_CHAT_IDS', values)
        self.assertGreaterEqual(len(values['TELEGRAM_WEBHOOK_SECRET']), 32)
        self.assertEqual(env.stat().st_mode & 0o777, 0o600)

    def test_existing_config_keeps_token_webhook_secret_and_other_private_settings(self):
        env = Path(self.temp.name) / 'private-env'; env.touch()
        original = {'TELEGRAM_BOT_TOKEN': '123456:' + 't' * 32, 'TELEGRAM_WEBHOOK_SECRET': 's' * 64,
                    'KVC_IP_HASH_KEY': 'k' * 64, 'TURNSTILE_SECRET_KEY': 'preserved', 'TELEGRAM_RECIPIENT_MODE': 'fixed'}
        with patch.object(setup, 'ENV', env), patch.object(setup, 'private_environment', return_value=dict(original)), patch.object(setup.getpass, 'getpass', side_effect=AssertionError('Retain existing token')), patch.object(setup, 'bot_api', return_value={}):
            setup.credentials()
        values = dict(line.split('=', 1) for line in env.read_text().splitlines())
        for key in original:
            self.assertEqual(values[key], 'subscribers' if key == 'TELEGRAM_RECIPIENT_MODE' else original[key])

    def test_webhook_registration_is_automatic_and_keeps_pending_updates(self):
        url = 'https://klinikavcifrah.ru/api/telegram/webhook'
        denied = urllib.error.HTTPError(url, 403, 'Forbidden', {'X-KVC-API-Revision': self.revision}, None)
        values = {'TELEGRAM_BOT_TOKEN': 'fake-token', 'TELEGRAM_WEBHOOK_SECRET': 's' * 64}
        with patch.object(setup.urllib.request, 'urlopen', side_effect=denied), patch.object(setup, 'private_environment', return_value=values), patch.object(setup, 'bot_api', side_effect=[True, {'url': url}]) as api_call:
            setup.connect_bot(self.revision)
        self.assertEqual(api_call.call_args_list[0].args[:2], ('fake-token', 'setWebhook'))
        payload = api_call.call_args_list[0].args[2]
        self.assertEqual(payload['url'], url); self.assertFalse(payload['drop_pending_updates'])
        self.assertEqual(payload['secret_token'], values['TELEGRAM_WEBHOOK_SECRET'])
        self.assertEqual(payload['allowed_updates'], ['message'])

    def test_no_registration_if_public_webhook_is_not_verified(self):
        denied = urllib.error.HTTPError('https://example.test', 403, 'Forbidden', {}, None)
        with patch.object(setup.urllib.request, 'urlopen', side_effect=denied), patch.object(setup, 'bot_api') as api_call:
            with self.assertRaises(RuntimeError): setup.connect_bot(self.revision)
        api_call.assert_not_called()

    def test_public_api_waits_for_old_nginx_worker_to_switch(self):
        old, current = MagicMock(), MagicMock()
        old.__enter__.return_value.status = 204
        old.__enter__.return_value.headers = {}
        current.__enter__.return_value.status = 204
        current.__enter__.return_value.headers = {'X-KVC-API-Revision': self.revision}
        with patch.object(setup.urllib.request, 'urlopen', side_effect=[old, current]):
            setup.public_api_health(self.revision, pause=lambda _: None)

    def test_failed_public_probe_reports_only_safe_operational_details(self):
        old = MagicMock(); old.__enter__.return_value.status = 204
        old.__enter__.return_value.headers = {'X-KVC-API-Revision': 'unsafe provider detail'}
        with patch.object(setup.urllib.request, 'urlopen', return_value=old):
            with self.assertRaisesRegex(RuntimeError, 'HTTP 204, API revision missing/invalid') as failure:
                setup.public_api_health(self.revision, attempts=2, pause=lambda _: None)
        self.assertNotIn('unsafe provider detail', str(failure.exception))
        error = urllib.error.HTTPError('https://api.telegram.org/botSECRET/token', 403, 'SECRET', {}, None)
        self.assertNotIn('SECRET', setup.failure_description(error))
        self.assertNotIn('SECRET', setup.failure_description(RuntimeError('SECRET')))


if __name__ == '__main__': unittest.main()
