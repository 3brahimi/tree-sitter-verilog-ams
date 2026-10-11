"""Download the test models that are not committed to this repository.

Usage:
    python scripts/fetch_models.py [--dest test/models/.fetched]

Reads test/models/manifest.json and fetches every entry with
"committed": false from raw.githubusercontent.com at the pinned commit. These
files carry licenses that allow redistribution but are not plain MIT,
MIT-0 or Apache-2.0 (ECL-2.0, the BSIM/CMC-style licenses and the Mextram
license), so they are kept out of the repository. Files that already exist
are skipped.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "test" / "models" / "manifest.json"
RAW_URL = "https://raw.githubusercontent.com/{repo}/{commit}/{path}"
TIMEOUT_SECONDS = 60


def fetch(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=TIMEOUT_SECONDS) as response:
        return response.read()


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dest", default=str(ROOT / "test" / "models" / ".fetched"))
    args = ap.parse_args(argv)

    try:
        entries = json.loads(MANIFEST.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: cannot read {MANIFEST}: {exc}", file=sys.stderr)
        return 2

    dest = Path(args.dest)
    failures = 0
    fetched = 0
    for entry in entries:
        if entry["committed"]:
            continue
        target = dest / entry["path"]
        if target.exists():
            continue
        url = RAW_URL.format(repo=entry["source_repo"], commit=entry["commit"], path=entry["upstream_path"])
        try:
            data = fetch(url)
        except (urllib.error.URLError, TimeoutError) as exc:
            print(f"failed: {url}: {exc}", file=sys.stderr)
            failures += 1
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        fetched += 1
    print(f"fetched {fetched} files into {dest}, {failures} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
