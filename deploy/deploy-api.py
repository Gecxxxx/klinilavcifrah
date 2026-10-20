#!/usr/bin/env python3
"""Unprivileged API release switch. Root-owned systemd watcher restarts only this service."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import tarfile
import tempfile
import time
import urllib.request
import os
import fcntl

FILES = {'backend/__init__.py', 'backend/app.py', 'backend/store.py', 'backend/notify.py', 'backend/cli.py', 'backend/revision.txt', 'api-manifest.json'}


def unpack(archive, destination, digest, revision):
    if archive.stat().st_size > 512 * 1024 or hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
        raise ValueError('Invalid API archive checksum/size')
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        if len(members) != len(FILES) or {m.name for m in members} != FILES:
            raise ValueError('Unexpected API files')
        for member in members:
            if not member.isfile() or member.size > 256 * 1024:
                raise ValueError('Unsafe API archive member')
            if str(PurePosixPath(member.name)) != member.name:
                raise ValueError('Non-canonical archive path')
            target = destination / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open('xb') as out, tar.extractfile(member) as source:
                shutil.copyfileobj(source, out)
            target.chmod(0o644)
    for directory in [destination, destination / 'backend']:
        directory.chmod(0o755)
    manifest = json.loads((destination / 'api-manifest.json').read_text())
    if manifest.get('revision') != revision or set(manifest.get('files', {})) != FILES - {'api-manifest.json'}:
        raise ValueError('API revision/manifest mismatch')
    for name, expected in manifest['files'].items():
        if hashlib.sha256((destination / name).read_bytes()).hexdigest() != expected:
            raise ValueError('API file checksum mismatch')
    if (destination / 'backend/revision.txt').read_text().strip() != revision:
        raise ValueError('API runtime revision mismatch')


def health(revision):
    request = urllib.request.Request('http://127.0.0.1:3090/health', headers={'User-Agent': 'kvc-deploy-health/1.0'})
    with urllib.request.urlopen(request, timeout=2) as response:
        result = json.load(response)
    if result.get('ok') is not True or result.get('revision') != revision:
        return False
    request = urllib.request.Request('https://klinikavcifrah.ru/api/leads', method='OPTIONS',
                                    headers={'User-Agent': 'kvc-deploy-health/1.0', 'Origin': 'https://klinikavcifrah.ru'})
    with urllib.request.urlopen(request, timeout=5) as response:
        return response.status == 204 and response.headers.get('X-KVC-API-Revision') == revision


def switch(root, target):
    temporary = root / f'.current-{os.getpid()}'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, root / 'current')
    (root / 'reload.trigger').write_text(str(target) + '\n')


def deploy(archive, digest, revision, run_id, root, probe=health, pause=time.sleep):
    if not (root.parent / 'enabled').is_file():
        print('API bootstrap is not installed; API publication skipped')
        return
    # Validate before using revision/run_id as filesystem names.
    if not re.fullmatch(r'[0-9a-f]{40}', revision) or not re.fullmatch(r'[0-9]+-[0-9]+', run_id):
        raise ValueError('Invalid API release identifier')
    with (root / '.deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        current = root / 'current'
        if not current.is_symlink():
            raise ValueError('Current API must be a symlink')
        previous = current.resolve(strict=True)
        if previous.parent != (root / 'releases').resolve():
            raise ValueError('Unexpected previous API path')
        if shutil.disk_usage(root).free < 50 * 1024 * 1024:
            raise ValueError('Insufficient API release disk space')
        destination = root / 'releases' / f'{revision}-{run_id}'
        staging = Path(tempfile.mkdtemp(prefix='.incoming-', dir=root / 'releases'))
        activated = False
        try:
            unpack(archive, staging, digest, revision)
            staging.rename(destination)
            activated = True
            switch(root, destination)
            for _ in range(20):
                try:
                    if probe(revision):
                        break
                except Exception:
                    pass
                pause(1)
            else:
                raise RuntimeError('New API health/revision was not confirmed')
        except BaseException:
            if activated:
                switch(root, previous)
                print(f'API ROLLED BACK to {previous.name}')
            shutil.rmtree(staging, ignore_errors=True)
            # Keep an activated failed release for diagnosis; never touch the DB.
            raise
        print(f'API DEPLOYED {revision}')
        releases = sorted((p for p in (root / 'releases').iterdir() if p.is_dir() and re.fullmatch(r'[0-9a-f]{40}-[0-9]+-[0-9]+', p.name)), key=lambda p: p.stat().st_mtime, reverse=True)
        for old in releases[5:]:
            if old not in (previous, destination):
                shutil.rmtree(old)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('archive', type=Path); parser.add_argument('digest'); parser.add_argument('revision'); parser.add_argument('run_id')
    parser.add_argument('--root', type=Path, default=Path('/opt/kvc-leads/app'))
    args = parser.parse_args()
    def interrupted(signum, frame):
        raise InterruptedError('API deployment interrupted')
    signal.signal(signal.SIGHUP, interrupted); signal.signal(signal.SIGTERM, interrupted)
    deploy(args.archive, args.digest, args.revision, args.run_id, args.root)
