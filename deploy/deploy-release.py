#!/usr/bin/env python3
"""Atomic static-site deployment. Runs without root on Ubuntu Python 3.10+."""
import argparse
import fcntl
import hashlib
import json
import os
import re
import signal
import shutil
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path, PurePosixPath


def unpack(archive, destination, expected_hash, commit):
    if archive.stat().st_size > 20 * 1024 * 1024:
        raise ValueError("Archive is too large")
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected_hash:
        raise ValueError("Archive SHA-256 mismatch")
    with tarfile.open(archive) as tar:
        members = tar.getmembers()
        if len(members) > 3000 or sum(m.size for m in members) > 60 * 1024 * 1024:
            raise ValueError("Unpacked release is too large")
        seen = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (not member.isfile() or path.is_absolute() or not path.parts
                    or any(p in ("..", ".") or p.startswith(".") for p in path.parts)
                    or str(path) in seen or "\\" in member.name):
                raise ValueError("Unsafe or duplicate archive member")
            seen.add(str(path))
        for member in members:
            target = destination / member.name
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as output, tar.extractfile(member) as source:
                shutil.copyfileobj(source, output)
            target.chmod(0o644)
    manifest = json.loads((destination / "__release.json").read_text())
    if manifest["commit"] != commit:
        raise ValueError("Source commit mismatch")
    files = manifest["files"]
    if set(files) != seen - {"__release.json"}:
        raise ValueError("Manifest does not describe the complete release")
    for name, digest in files.items():
        if hashlib.sha256((destination / name).read_bytes()).hexdigest() != digest:
            raise ValueError("Release file hash mismatch")
    for name in ("index.html", "kontakty.html", "404.html", "robots.txt", "sitemap.xml"):
        if name not in files:
            raise ValueError("Required page is missing")
    for directory in destination.rglob("*"):
        if directory.is_dir():
            directory.chmod(0o755)
    destination.chmod(0o755)


def switch(root, target):
    temporary = root / (".current-" + str(os.getpid()))
    try:
        temporary.symlink_to(target)
        os.replace(temporary, root / "current")
    finally:
        temporary.unlink(missing_ok=True)


def response(url, method="GET", origin=None):
    headers = {"Cache-Control": "no-cache"}
    if origin:
        headers["Origin"] = origin
        headers["Access-Control-Request-Method"] = "POST"
    request = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as result:
            return result.status, result.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def health(origin, commit, attempts=3):
    for attempt in range(attempts):
        try:
            status, body = response(origin + "/__release.json?verify=" + commit)
            if status != 200 or json.loads(body)["commit"] != commit:
                raise ValueError("Live release marker is incorrect")
            for path in ("/", "/kontakty", "/sitemap.xml", "/robots.txt", "/opengraph-image"):
                if response(origin + path)[0] != 200:
                    raise ValueError("HTTP check failed: " + path)
            if response(origin + "/__kvc_nonexistent_" + commit)[0] != 404:
                raise ValueError("Unknown page does not return 404")
            if response(origin + "/api/leads", "OPTIONS", origin)[0] != 204:
                raise ValueError("Existing API proxy OPTIONS check failed")
            return
        except Exception:
            if attempt + 1 == attempts:
                raise
            time.sleep(2)


def retain_previous_assets(previous, destination):
    """Keep previous-build chunks for open tabs, without accumulating old copies."""
    manifest_path = previous / "__release.json"
    if manifest_path.exists():
        names = [name for name in json.loads(manifest_path.read_text())["files"]
                 if name.startswith("_next/static/")]
    else:
        names = [p.relative_to(previous).as_posix() for p in (previous / "_next/static").rglob("*") if p.is_file()]
    for name in names:
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
            raise ValueError("Unsafe previous static asset path")
        source, target = previous / name, destination / name
        if target.exists():
            if source.read_bytes() != target.read_bytes():
                raise ValueError("Different assets share the same filename")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target)
            target.chmod(0o644)
    for directory in destination.rglob("*"):
        if directory.is_dir():
            directory.chmod(0o755)


def deploy(archive, expected_hash, commit, deployment_id, root, origin):
    if not re.fullmatch(r"[0-9a-f]{40}", commit) or not re.fullmatch(r"[0-9]+-[0-9]+", deployment_id):
        raise ValueError("Invalid commit or deployment ID")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_hash):
        raise ValueError("Invalid archive digest")
    root = root.resolve(strict=True)
    current = root / "current"
    if not current.is_symlink():
        raise ValueError("current must already be a symlink")
    with (root / ".deploy.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        previous = current.resolve(strict=True)
        releases = (root / "releases").resolve(strict=True)
        previous.relative_to(releases)
        if shutil.disk_usage(root).free < 100 * 1024 * 1024:
            raise ValueError("Less than 100 MiB free; deployment stopped")
        release = releases / (commit + "-" + deployment_id)
        if release.exists():
            raise ValueError("Release directory already exists")
        temporary = Path(tempfile.mkdtemp(prefix=".incoming-", dir=releases))
        activated = False
        try:
            unpack(archive, temporary, expected_hash, commit)
            retain_previous_assets(previous, temporary)
            os.rename(temporary, release)
            switch(root, release)
            activated = True
            health(origin.rstrip("/"), commit)
        except BaseException:
            if activated or (current.is_symlink() and current.resolve() == release):
                switch(root, previous)
                print("ROLLED BACK to " + str(previous), flush=True)
            if temporary.exists():
                shutil.rmtree(temporary)
            if release.exists():
                shutil.rmtree(release)
            raise
        (root / "previous-release.txt").write_text(str(previous) + "\n")
        print("DEPLOYED " + str(release), flush=True)
        # Only generated releases from this deployer. Preserve the imported baseline.
        generated = sorted((p for p in releases.iterdir() if p.is_dir() and not p.is_symlink()
                            and re.fullmatch(r"[0-9a-f]{40}-[0-9]+-[0-9]+", p.name)),
                           key=lambda p: p.stat().st_mtime, reverse=True)
        for old in generated[5:]:
            if old not in (release, previous):
                try:
                    shutil.rmtree(old)
                except OSError as error:
                    print("Old release retained: " + str(error), flush=True)


if __name__ == "__main__":
    def interrupted(signum, frame):
        raise KeyboardInterrupt("Deployment interrupted by signal " + str(signum))
    for sig in (signal.SIGHUP, signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("sha256")
    parser.add_argument("commit")
    parser.add_argument("deployment_id")
    parser.add_argument("--root", type=Path, default=Path("/var/www/klinikavcifrah"))
    parser.add_argument("--origin", default="https://klinikavcifrah.ru")
    args = parser.parse_args()
    deploy(args.archive, args.sha256, args.commit, args.deployment_id, args.root, args.origin)
