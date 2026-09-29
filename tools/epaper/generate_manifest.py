#!/usr/bin/env python3
"""Regenerate manifest.json from the images in the artwork folder.

Scans the artwork folder for *.png / *.jpg / *.jpeg (case-insensitive), sorted
deterministically, and rewrites manifest.json there as a JSON array of
filenames. This script is the only writer of manifest.json.

The artwork folder defaults to <repo>/www/epaper and can be overridden with
--dir or the EPAPER_IMAGES environment variable. On the Home Assistant host it
is served as /local/epaper/.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

IMAGE_EXTS = {".png", ".jpg", ".jpeg"}
MANIFEST_NAME = "manifest.json"
HERE = Path(__file__).resolve().parent
DEFAULT_IMAGES = HERE.parent.parent / "www" / "epaper"


def images_dir(arg: str | None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    if env := os.environ.get("EPAPER_IMAGES"):
        return Path(env).expanduser().resolve()
    return DEFAULT_IMAGES


def find_images(folder: Path) -> list[str]:
    """Filenames of the images in *folder*, sorted deterministically."""
    return sorted(
        p.name
        for p in folder.iterdir()
        if p.is_file()
        and not p.name.startswith(".")
        and p.name != MANIFEST_NAME
        and p.suffix.lower() in IMAGE_EXTS
    )


def render(images: list[str]) -> str:
    return json.dumps(images) + "\n"


def prepare_heics(folder: Path) -> None:
    """Convert any .heic/.HEIC in *folder* to dithered PNGs via prepare_image.sh."""
    script = HERE / "prepare_image.sh"
    if not script.exists():
        raise SystemExit(f"{script} not found; cannot --prepare")
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() == ".heic":
            subprocess.run([str(script), str(p)], check=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", help="artwork folder (default: <repo>/www/epaper)")
    parser.add_argument(
        "--check",
        action="store_true",
        help="do not write; exit non-zero if manifest.json is out of date",
    )
    parser.add_argument(
        "--prepare",
        action="store_true",
        help="convert any .heic/.HEIC to dithered PNGs (via prepare_image.sh) first",
    )
    args = parser.parse_args()

    folder = images_dir(args.dir)
    if not folder.is_dir():
        raise SystemExit(f"artwork folder not found: {folder}")
    if args.prepare:
        prepare_heics(folder)

    images = find_images(folder)
    desired = render(images)
    manifest = folder / MANIFEST_NAME
    current = manifest.read_text(encoding="utf-8") if manifest.exists() else None

    if args.check:
        if current != desired:
            print(f"{manifest} is out of date (run generate_manifest.py)", file=sys.stderr)
            return 1
        print(f"{manifest} is up to date ({len(images)} image(s))")
        return 0

    manifest.write_text(desired, encoding="utf-8")
    listing = ", ".join(images) if images else "(none)"
    print(f"wrote {manifest}: {len(images)} image(s): {listing}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
