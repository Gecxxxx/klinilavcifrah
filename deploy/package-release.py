#!/usr/bin/env python3
"""Package only a clean static export; never include checkout files or secrets."""
import hashlib
import json
import re
import shutil
import sys
import tarfile
from pathlib import Path

commit = sys.argv[1]
if not re.fullmatch(r"[0-9a-f]{40}", commit):
    raise SystemExit("Expected a full source commit SHA")
root = Path("out")
required = ["index.html", "kontakty.html", "404.html", "sitemap.xml", "robots.txt"]
if not all((root / name).is_file() for name in required):
    raise SystemExit("Static export is incomplete")
chunks = list((root / "_next/static").rglob("*.js"))
if not any('fetch("/api/leads"' in p.read_text() for p in chunks):
    raise SystemExit("Form does not use the same-origin /api/leads endpoint")
if any("https://klinilavcifrah-api.eggetsevich.workers.dev/api/leads" in p.read_text() for p in chunks):
    raise SystemExit("Export contains a direct Worker endpoint; rebuild from a clean out directory")
files = {}
for p in sorted(root.rglob("*")):
    if p.is_symlink():
        raise SystemExit("Symlinks are not allowed in the export")
    if p.is_file() and p.name != "__release.json":
        if any(part.startswith(".") for part in p.relative_to(root).parts):
            raise SystemExit("Hidden files are not allowed in the export")
        files[p.relative_to(root).as_posix()] = hashlib.sha256(p.read_bytes()).hexdigest()
(root / "__release.json").write_text(json.dumps({"commit": commit, "files": files}, indent=2) + "\n")
destination = Path("release-artifacts/vps")
destination.mkdir(parents=True, exist_ok=True)
archive = destination / "site.tar.gz"
with tarfile.open(archive, "w:gz") as tar:
    for name in [*files, "__release.json"]:
        tar.add(root / name, arcname=name, recursive=False)
(destination / "site.sha256").write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + "  site.tar.gz\n")
shutil.copyfile("deploy/deploy-release.py", destination / "deploy-release.py")
print(f"Packaged {len(files)} files from {commit}: {archive.stat().st_size} bytes")
