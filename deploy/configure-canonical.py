#!/usr/bin/env python3
"""One-time root operation for the known KVC Nginx vhost, never part of deploy."""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


REDIRECT = """    # KVC canonical host
    if ($host = www.klinikavcifrah.ru) {
        return 308 https://klinikavcifrah.ru$request_uri;
    }

"""


def patch_config(text):
    # Deliberately accept only the known layout; do not guess at other vhosts.
    first = text.split("\nserver {", 1)[0]
    anchor = "    server_name klinikavcifrah.ru www.klinikavcifrah.ru;"
    if (not re.match(r"server\s*\{\s*", first)
            or first.count(anchor) != 1
            or "root /var/www/klinikavcifrah/current;" not in first
            or not re.search(r"listen\s+443\s+ssl\b", first)
            or re.search(r"listen\s+(?:\[::\]:)?80\b", first)):
        raise ValueError("Unexpected HTTPS vhost layout; no files changed")
    if REDIRECT in first:
        return text
    prefix = first[:first.index(anchor)]
    if not re.fullmatch(r"server\s*\{\s*", prefix):
        raise ValueError("Unexpected directives before server_name; no files changed")
    if "www.klinikavcifrah.ru)" in first:
        raise ValueError("Existing www rule needs manual review; no files changed")
    return text.replace(anchor, REDIRECT + anchor, 1)


def atomic_copy(source, target):
    descriptor, name = tempfile.mkstemp(prefix=".kvc-nginx-", dir=target.parent)
    os.close(descriptor)
    temporary = Path(name)
    try:
        shutil.copy2(source, temporary)
        stat = source.stat()
        os.chown(temporary, stat.st_uid, stat.st_gid)
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


def command(args):
    subprocess.run(args, check=True, timeout=30)


def install(config, backup_root, run=command):
    target = config.resolve(strict=True)  # Preserve sites-enabled symlink.
    original = target.read_bytes()
    changed = patch_config(original.decode("utf-8")).encode("utf-8")
    run(["nginx", "-t"])
    if changed == original:
        print("Canonical redirect already installed; no files changed")
        return
    backup_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    backup = Path(tempfile.mkdtemp(prefix="kvc-nginx-", dir=backup_root))
    saved = backup / "nginx.conf"
    shutil.copy2(target, saved)
    (backup / "target.txt").write_text(str(target) + "\n")
    candidate = backup / "candidate.conf"
    shutil.copy2(saved, candidate)
    candidate.write_bytes(changed)
    if target.read_bytes() != original:
        raise RuntimeError("Config changed concurrently; no files changed")
    print(f"Backup: {saved}", flush=True)
    try:
        atomic_copy(candidate, target)
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
    except BaseException:
        atomic_copy(saved, target)
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        print("Previous Nginx configuration restored", flush=True)
        raise
    print("Installed www -> https://klinikavcifrah.ru (308, path/query preserved)")


if __name__ == "__main__":
    if os.geteuid() != 0:
        raise SystemExit("Run as root through your personal SSH account")
    install(Path("/etc/nginx/sites-enabled/klinikavcifrah.ru"), Path("/root/backups"))
