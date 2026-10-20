#!/usr/bin/env python3
"""Root bootstrap only: private API/SQLite/systemd and the exact KVC Nginx location."""
import argparse
import getpass
import grp
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
import io

BASE = Path('/opt/kvc-leads')
DATA = Path('/var/lib/kvc-leads')
ENV = Path('/etc/kvc-leads.env')
NGINX = Path('/etc/nginx/sites-enabled/klinikavcifrah.ru')
FILES = ['__init__.py', 'app.py', 'store.py', 'notify.py', 'cli.py']
WHEEL = 'https://files.pythonhosted.org/packages/fe/85/7522a52e5e2f42faf1a129113ab63e548c42e103e9af395b7bfe65e403e2/gunicorn-26.2.0-py3-none-any.whl'
WHEEL_SHA = 'bd249d0b3f7972f7432f0a6b6ff3b3ee2d129f70cd1ff6c09a9dd9e29a2b88e3'
LOCATION = '''    location = /api/leads {
        client_max_body_size 16k;
        client_body_buffer_size 16k;
        proxy_pass http://127.0.0.1:3090;
        proxy_set_header Host $host;
        proxy_set_header Origin $http_origin;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For "";
        proxy_set_header CF-Connecting-IP "";
        proxy_set_header Cookie "";
        proxy_set_header Authorization "";
        proxy_connect_timeout 3s;
        proxy_read_timeout 15s;
        access_log off;
    }'''
COMMON = '''User=kvc-leads
Group=kvc-leads
WorkingDirectory=/opt/kvc-leads/app/current
Environment=PYTHONPATH=/opt/kvc-leads/vendor:/opt/kvc-leads/app/current
Environment=PYTHONDONTWRITEBYTECODE=1
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/kvc-leads
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
MemoryMax=128M
'''
UNITS = {
'kvc-leads-api.service': '''[Unit]
Description=KVC private durable lead API
After=network.target
[Service]
Type=simple
''' + COMMON + '''EnvironmentFile=/etc/kvc-leads.env
ExecStart=/usr/bin/python3 -m gunicorn --bind 127.0.0.1:3090 --workers 1 --threads 2 --worker-class gthread --timeout 30 --no-control-socket --max-requests 1000 --max-requests-jitter 100 backend.app:create_app()
Restart=on-failure
RestartSec=3
[Install]
WantedBy=multi-user.target
''',
'kvc-leads-notify.service': '''[Unit]
Description=KVC notification outbox drain
After=network.target
[Service]
Type=oneshot
''' + COMMON + '''EnvironmentFile=/etc/kvc-leads.env
ExecStart=/usr/bin/python3 -m backend.cli drain --limit 2
TimeoutStartSec=90
''',
'kvc-leads-notify.timer': '''[Unit]
Description=Retry KVC notifications every minute
[Timer]
OnBootSec=60
OnUnitActiveSec=60
Unit=kvc-leads-notify.service
[Install]
WantedBy=timers.target
''',
'kvc-leads-backup.service': '''[Unit]
Description=KVC private SQLite backup with isolated restoration check
[Service]
Type=oneshot
''' + COMMON + '''ReadWritePaths=/var/backups/kvc-leads
ExecStart=/usr/bin/python3 -m backend.cli backup /var/backups/kvc-leads
TimeoutStartSec=120
''',
'kvc-leads-backup.timer': '''[Unit]
Description=Daily KVC registry backup
[Timer]
OnCalendar=daily
Persistent=true
Unit=kvc-leads-backup.service
[Install]
WantedBy=timers.target
''',
'kvc-leads-reload.path': '''[Unit]
Description=Watch unprivileged KVC API deployment signal
[Path]
PathChanged=/opt/kvc-leads/app/reload.trigger
Unit=kvc-leads-reload.service
[Install]
WantedBy=multi-user.target
''',
'kvc-leads-reload.service': '''[Unit]
Description=Restart only the KVC API after a code release
[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl restart kvc-leads-api.service
''',
}


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def download(url, maximum):
    request = urllib.request.Request(url, headers={'User-Agent': 'kvc-bootstrap/1.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read(maximum + 1)
    if len(body) > maximum:
        raise RuntimeError('Download exceeds allowed size')
    return body


def patch_nginx(text):
    if 'root /var/www/klinikavcifrah/current;' not in text or 'server_name klinikavcifrah.ru www.klinikavcifrah.ru;' not in text:
        raise ValueError('Unexpected KVC vhost; no Nginx change')
    matches = list(re.finditer(r'    location = /api/leads \{\n.*?\n    \}', text, re.S))
    if len(matches) != 1:
        raise ValueError('Expected exactly one leads location')
    block = matches[0]
    if block.group() == LOCATION:
        return text
    if 'proxy_pass https://klinilavcifrah-api.eggetsevich.workers.dev/api/leads;' not in block.group():
        raise ValueError('Unexpected old handler; no Nginx change')
    if '{' in block.group().split('{', 1)[1]:
        raise ValueError('Nested API directives require manual review')
    return text[:block.start()] + LOCATION + text[block.end():]


def atomic_bytes(target, body, mode=0o644):
    descriptor, name = tempfile.mkstemp(prefix='.kvc-', dir=target.parent)
    try:
        with os.fdopen(descriptor, 'wb') as out:
            out.write(body); out.flush(); os.fsync(out.fileno())
        os.chmod(name, mode)
        if target.exists():
            stat = target.stat(); os.chown(name, stat.st_uid, stat.st_gid)
        os.replace(name, target)
    finally:
        Path(name).unlink(missing_ok=True)


def health(revision):
    for _ in range(20):
        try:
            with urllib.request.urlopen('http://127.0.0.1:3090/health', timeout=2) as response:
                result = json.load(response)
            if result.get('ok') is True and result.get('service') == 'kvc-leads' and result.get('revision') == revision:
                return
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('API did not become ready')


def credentials():
    if ENV.exists():
        if ENV.is_symlink() or ENV.stat().st_uid != 0:
            raise RuntimeError('Unexpected private environment ownership')
        ENV.chmod(0o600)
        print('Existing private environment retained')
        return
    token = getpass.getpass('Telegram bot token (hidden): ').strip()
    ids = input('Trusted Telegram chat IDs, comma-separated: ').strip().split(',')
    ids = list(dict.fromkeys(x.strip() for x in ids))
    if not re.fullmatch(r'[0-9]{5,20}:[A-Za-z0-9_-]{20,100}', token) or not 1 <= len(ids) <= 5 or any(not re.fullmatch(r'-?[0-9]{1,20}', x) for x in ids):
        raise RuntimeError('Invalid token or recipient format; no credentials saved')
    # Read-only verification. Never send a test message during bootstrap.
    try:
        for suffix in ['getMe'] + ['getChat?chat_id=' + chat for chat in ids]:
            result = json.loads(download('https://api.telegram.org/bot' + token + '/' + suffix, 65536))
            if result.get('ok') is not True:
                raise ValueError()
    except Exception:
        raise RuntimeError('Telegram read-only verification failed; token was not logged or saved') from None
    body = f'TELEGRAM_BOT_TOKEN={token}\nTELEGRAM_CHAT_IDS={",".join(ids)}\nKVC_IP_HASH_KEY={secrets.token_hex(32)}\nKVC_DB=/var/lib/kvc-leads/leads.sqlite3\n'
    atomic_bytes(ENV, body.encode(), 0o600)
    print('Telegram credentials and recipients verified (read-only)')


def setup(revision):
    if os.geteuid() or sys.version_info < (3, 10):
        raise RuntimeError('Requires root and Python 3.10+')
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Expected full reviewed Git commit')
    deploy_user = pwd.getpwnam('kvc-deploy')
    if deploy_user.pw_uid == 0:
        raise ValueError('Invalid deployment account')
    target = NGINX.resolve(strict=True)
    if target.parent not in [Path('/etc/nginx/sites-available'), Path('/etc/nginx/sites-enabled')]:
        raise ValueError('Unexpected Nginx target')
    original = target.read_bytes()
    changed = patch_nginx(original.decode()).encode()
    run(['nginx', '-t'])
    if shutil.disk_usage('/opt').free < 100 * 1024 * 1024:
        raise RuntimeError('Less than 100 MiB free; installation stopped')
    try:
        with socket.create_connection(('127.0.0.1', 3090), timeout=1):
            with urllib.request.urlopen('http://127.0.0.1:3090/health', timeout=2) as response:
                if json.load(response).get('service') != 'kvc-leads':
                    raise RuntimeError('Port 3090 belongs to another service')
    except ConnectionRefusedError:
        pass
    for name in UNITS:
        existing = Path('/etc/systemd/system') / name
        if existing.exists() and 'KVC' not in existing.read_text():
            raise RuntimeError('Refusing to replace an unmanaged unit')
    backup_root = Path('/root/backups'); backup_root.mkdir(mode=0o700, exist_ok=True)
    backup = Path(tempfile.mkdtemp(prefix='kvc-leads-bootstrap-', dir=backup_root))
    shutil.copy2(target, backup / 'nginx.conf')
    (backup / 'nginx-target.txt').write_text(str(target) + '\n')
    print(f'Bootstrap backup: {backup}', flush=True)
    credentials()
    try:
        account = pwd.getpwnam('kvc-leads')
        if account.pw_uid == 0 or account.pw_dir != str(DATA):
            raise ValueError('Unexpected API account')
    except KeyError:
        run(['useradd', '--system', '--user-group', '--home-dir', str(DATA), '--shell', '/usr/sbin/nologin', 'kvc-leads'])
        account = pwd.getpwnam('kvc-leads')
    for directory in [BASE, BASE / 'vendor', BASE / 'app', BASE / 'app/releases', DATA, Path('/var/backups/kvc-leads')]:
        directory.mkdir(parents=True, exist_ok=True)
        private = directory in [DATA, Path('/var/backups/kvc-leads')]
        directory.chmod(0o700 if private else 0o755)
        if private:
            os.chown(directory, account.pw_uid, account.pw_gid)
        elif directory in [BASE / 'app', BASE / 'app/releases']:
            os.chown(directory, deploy_user.pw_uid, deploy_user.pw_gid)
    wheel = download(WHEEL, 1024 * 1024)
    if hashlib.sha256(wheel).hexdigest() != WHEEL_SHA:
        raise RuntimeError('Gunicorn distribution checksum mismatch')
    with zipfile.ZipFile(io.BytesIO(wheel)) as package:
        for name in package.namelist():
            if name.startswith('/') or '..' in Path(name).parts:
                raise RuntimeError('Unsafe dependency archive')
        package.extractall(BASE / 'vendor')
    root = BASE / 'app'
    previous = (root / 'current').resolve() if (root / 'current').is_symlink() else None
    release = root / 'releases' / f'{revision}-bootstrap'
    if release.exists():
        # Never overwrite files a running process may be importing.
        release = Path(tempfile.mkdtemp(prefix=revision + '-bootstrap-', dir=root / 'releases'))
    (release / 'backend').mkdir(parents=True, exist_ok=True)
    for name in FILES:
        body = download(f'https://raw.githubusercontent.com/Gecxxxx/klinilavcifrah/{revision}/backend/{name}', 256 * 1024)
        (release / 'backend' / name).write_bytes(body)
    (release / 'backend/revision.txt').write_text(revision + '\n')
    for path in [release, release / 'backend']:
        path.chmod(0o755)
    for path in (release / 'backend').iterdir():
        path.chmod(0o644)
    (backup / 'previous-api.txt').write_text(str(previous or '') + '\n')
    for name, text in UNITS.items():
        path = Path('/etc/systemd/system') / name
        if path.exists(): shutil.copy2(path, backup / name)
        atomic_bytes(path, ('# Managed KVC lead service\n' + text).encode())
    wrapper = '''#!/usr/bin/python3
import os, pathlib, subprocess, sys
if os.geteuid(): raise SystemExit("Run through personal root SSH")
env = dict(os.environ)
for line in pathlib.Path('/etc/kvc-leads.env').read_text().splitlines():
    if line and not line.startswith('#'):
        key, value = line.split('=', 1); env[key] = value
env['PYTHONPATH'] = '/opt/kvc-leads/vendor:/opt/kvc-leads/app/current'
env['PYTHONDONTWRITEBYTECODE'] = '1'
raise SystemExit(subprocess.call(['/usr/sbin/runuser', '-u', 'kvc-leads', '--', '/usr/bin/python3', '-m', 'backend.cli', *sys.argv[1:]], env=env, cwd='/opt/kvc-leads/app/current'))
'''
    atomic_bytes(Path('/usr/local/sbin/kvc-leads'), wrapper.encode(), 0o755)
    trigger = root / 'reload.trigger'
    if not trigger.exists(): trigger.write_text('bootstrap\n')
    os.chown(trigger, deploy_user.pw_uid, deploy_user.pw_gid); trigger.chmod(0o644)
    link = root / '.bootstrap-current'; link.unlink(missing_ok=True); link.symlink_to(release)
    os.replace(link, root / 'current')
    nginx_applied = False
    try:
        run(['/usr/local/sbin/kvc-leads', 'init'])
        run(['systemctl', 'daemon-reload'])
        run(['systemctl', 'enable', 'kvc-leads-api.service'])
        run(['systemctl', 'restart', 'kvc-leads-api.service'])
        health(revision)
        run(['systemctl', 'start', 'kvc-leads-backup.service'])
        if target.read_bytes() != original:
            raise RuntimeError('Nginx changed concurrently')
        atomic_bytes(target, changed, target.stat().st_mode & 0o777)
        nginx_applied = True
        run(['nginx', '-t']); run(['systemctl', 'reload', 'nginx'])
        request = urllib.request.Request('https://klinikavcifrah.ru/api/leads', method='OPTIONS', headers={'Origin': 'https://klinikavcifrah.ru', 'User-Agent': 'kvc-bootstrap/1.0'})
        with urllib.request.urlopen(request, timeout=15) as response:
            if response.status != 204 or response.headers.get('X-KVC-API-Revision') != revision:
                raise RuntimeError('Public API proxy was not confirmed')
        run(['systemctl', 'enable', '--now', 'kvc-leads-reload.path', 'kvc-leads-notify.timer', 'kvc-leads-backup.timer'])
        (BASE / 'enabled').write_text('Managed KVC API publication enabled\n')
        (BASE / 'enabled').chmod(0o644)  # Root-owned; the deploy user cannot edit its content.
    except BaseException:
        if nginx_applied:
            atomic_bytes(target, original, target.stat().st_mode & 0o777)
            run(['nginx', '-t']); run(['systemctl', 'reload', 'nginx'])
        if previous:
            link = root / '.bootstrap-current'; link.unlink(missing_ok=True); link.symlink_to(previous)
            os.replace(link, root / 'current')
            run(['systemctl', 'restart', 'kvc-leads-api.service'])
        else:
            run(['systemctl', 'stop', 'kvc-leads-api.service'])
        print('Previous handler restored; registry data and backups were preserved', flush=True)
        raise
    print('DURABLE API READY. No test lead or Telegram message was sent.')
    run(['/usr/local/sbin/kvc-leads', 'stats'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('revision'); args = parser.parse_args()
    try:
        setup(args.revision)
    except Exception as error:
        # In particular, do not print raw urllib exceptions containing the bot token.
        print(f'Installation stopped: {type(error).__name__}. Check the last successful step; secrets were not printed.', file=sys.stderr)
        raise SystemExit(1) from None
