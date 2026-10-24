import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('compression',Path(__file__).with_name('configure-compression.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class CompressionTest(unittest.TestCase):
    original='''server {
    server_name klinikavcifrah.ru www.klinikavcifrah.ru;
    root /var/www/klinikavcifrah/current;
    location = /api/leads { proxy_pass http://127.0.0.1:3090; }
    listen 443 ssl;
}
server {
    listen 80;
    return 308 https://klinikavcifrah.ru$request_uri;
}
'''
    def test_only_compression_is_added_and_repeat_is_idempotent(self):
        changed=module.patch(self.original)
        self.assertEqual(changed.replace('\n'+module.SNIPPET,''),self.original)
        self.assertEqual(module.patch(changed),changed)
    def test_unexpected_existing_directives_or_vhost_are_not_replaced(self):
        for text in [self.original.replace(module.ROOT_LINE,'    root /other;'),self.original.replace('    listen 443 ssl;','    gzip off;\n    listen 443 ssl;')]:
            with self.assertRaises(ValueError):module.patch(text)

if __name__=='__main__':unittest.main()
