#!/usr/bin/env python3
"""Create a separate private API artifact; never copy it into out/."""
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import sys
import tarfile

FILES = ['backend/__init__.py', 'backend/app.py', 'backend/store.py', 'backend/notify.py', 'backend/cli.py']


def package(revision, destination):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Expected full revision')
    files = {name: Path(name).read_bytes() for name in FILES}
    files['backend/revision.txt'] = (revision + '\n').encode()
    files['api-manifest.json'] = json.dumps({'revision': revision, 'files': {name: hashlib.sha256(body).hexdigest() for name, body in files.items()}}, sort_keys=True).encode()
    destination.mkdir(parents=True, exist_ok=True)
    archive = destination / 'api.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        for name, body in files.items():
            info = tarfile.TarInfo(name); info.size = len(body); info.mode = 0o644
            tar.addfile(info, io.BytesIO(body))
    (destination / 'api.sha256').write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + '  api.tar.gz\n')
    shutil.copyfile('deploy/deploy-api.py', destination / 'deploy-api.py')


if __name__ == '__main__':
    package(sys.argv[1], Path('release-artifacts/vps'))
