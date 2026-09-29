#!/usr/bin/env python3
"""Regenerate manifest.json from the images in this folder.

Scans this directory for *.png / *.jpg / *.jpeg (case-insensitive), sorted
deterministically, and rewrites manifest.json as a JSON array of filenames.

This script is the only writer of manifest.json — do not edit that file by hand.
On the Home Assistant host this folder is served as /local/epaper/.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
MANIFEST_NAME = "manifest.json"


def find_images(folder: Path) -> list[str]:
    """Filenames of the images in *folder*, sorted deterministically."""
    return sorted(
        p.name
        for p in folder.iterdir()
        if p.is_file() and not p.name.startswith(".") and p.suffix.lower() in IMAGE_EXTS
    )


def render(images: list[str]) -> str:
    return json.dumps(images) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="do not write; exit non-zero if manifest.json is out of date",
    )
    args = parser.parse_args()

    folder = Path(__file__).resolve().parent
    images = find_images(folder)
    desired = render(images)
    manifest = folder / MANIFEST_NAME
    current = manifest.read_text(encoding="utf-8") if manifest.exists() else None

    if args.check:
        if current != desired:
            print(f"{MANIFEST_NAME} is out of date (run generate_manifest.py)", file=sys.stderr)
            return 1
        print(f"{MANIFEST_NAME} is up to date ({len(images)} image(s))")
        return 0

    manifest.write_text(desired, encoding="utf-8")
    listing = ", ".join(images) if images else "(none)"
    print(f"wrote {MANIFEST_NAME}: {len(images)} image(s): {listing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
