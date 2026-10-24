#!/usr/bin/env python3
"""One-time root change limited to the KVC vhost; no database/secrets touched."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request

CONFIG = Path('/etc/nginx/sites-enabled/klinikavcifrah.ru')
ROOT_LINE = '    root /var/www/klinikavcifrah/current;'
SNIPPET = '''
    # Managed KVC static compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_min_length 1024;
    gzip_comp_level 5;
    gzip_types text/css application/javascript application/json application/xml text/plain image/svg+xml;
'''


def patch(text):
    if text.count(ROOT_LINE) != 1 or 'server_name klinikavcifrah.ru www.klinikavcifrah.ru;' not in text:
        raise ValueError('Unexpected KVC vhost; no change')
    position = text.index(ROOT_LINE)
    starts = list(re.finditer(r'(?m)^server\s*\{', text))
    before = [m.start() for m in starts if m.start() < position]
    after = [m.start() for m in starts if m.start() > position]
    if not before: raise ValueError('Expected a top-level server block')
    block = text[max(before):min(after) if after else len(text)]
    if SNIPPET in block: return text
    if re.search(r'(?m)^\s*gzip(?:_|\s)', block):
        raise ValueError('Existing vhost compression requires review; no change')
    return text.replace(ROOT_LINE, ROOT_LINE + '\n' + SNIPPET, 1)


def write(target, content):
    descriptor, name = tempfile.mkstemp(prefix='.kvc-gzip-', dir=target.parent)
    try:
        with os.fdopen(descriptor, 'w') as out:
            out.write(content); out.flush(); os.fsync(out.fileno())
        stat = target.stat(); os.chown(name, stat.st_uid, stat.st_gid); os.chmod(name, stat.st_mode & 0o777)
        os.replace(name, target)
    finally: Path(name).unlink(missing_ok=True)


def verify():
    root = Path('/var/www/klinikavcifrah/current')
    html = (root/'index.html').read_text()
    paths = re.findall(r'<script\b[^>]*src="(/_next/static/[A-Za-z0-9_./-]+\.js)"', html)
    path = next((p for p in paths if (root/p.lstrip('/')).stat().st_size > 1024), None)
    if not path: raise RuntimeError('No suitable current JavaScript resource')
    for _ in range(8):
        request = urllib.request.Request('https://klinikavcifrah.ru'+path+'?gzip_verify='+str(time.time_ns()),
            headers={'User-Agent':'kvc-deploy-health/1.0','Accept-Encoding':'gzip','Cache-Control':'no-cache'})
        with urllib.request.urlopen(request, timeout=5) as response:
            compressed = response.headers.get('Content-Encoding','').lower() == 'gzip'
            if response.status == 200 and compressed:
                response.read(); return
        time.sleep(1)
    raise RuntimeError('Public JavaScript gzip was not confirmed')


def main():
    if os.geteuid(): raise SystemExit('Run from personal root SSH')
    target = CONFIG.resolve(strict=True)
    if target.parent not in [Path('/etc/nginx/sites-enabled'), Path('/etc/nginx/sites-available')]:
        raise ValueError('Unexpected vhost path')
    old = target.read_text(); new = patch(old)
    subprocess.run(['nginx','-t'],check=True)
    backup_root = Path('/root/backups'); backup_root.mkdir(mode=0o700,exist_ok=True)
    backup = Path(tempfile.mkdtemp(prefix='kvc-compression-',dir=backup_root))
    shutil.copy2(target,backup/'nginx.conf'); print('Backup:',backup,flush=True)
    try:
        write(target,new)
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
        verify()
    except BaseException:
        write(target,old)
        subprocess.run(['nginx','-t'],check=True)
        subprocess.run(['systemctl','reload','nginx'],check=True)
        print('Previous KVC vhost restored; no database changes',flush=True)
        raise
    print('COMPRESSION READY. Public JavaScript is served with gzip. Other vhosts were not changed.')


if __name__=='__main__':main()
