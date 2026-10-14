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

# `device_profile.py` sits beside this script; imported after HERE so it can be
# found when this file is run directly. Deliberately NOT named profile.py, which
# would shadow the stdlib `profile` module.
sys.path.insert(0, str(HERE))
import device_profile as profiles  # noqa: E402


def default_images_dir(profile_name: str | None = None) -> Path:
    """The artwork folder for *profile_name* (the default profile when None)."""
    _, prof = profiles.resolve(profile_name)
    return profiles.artwork_dir(prof)


def images_dir(arg: str | None, profile_name: str | None = None) -> Path:
    if arg:
        return Path(arg).expanduser().resolve()
    if env := os.environ.get("EPAPER_IMAGES"):
        return Path(env).expanduser().resolve()
    return default_images_dir(profile_name)


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


def prepare_heics(folder: Path, profile_name: str | None = None) -> None:
    """Convert any .heic/.HEIC in *folder* to dithered PNGs via prepare_image.sh.

    The profile is passed through so the output matches this panel's dimensions
    and palette, not the default profile's.
    """
    script = HERE / "prepare_image.sh"
    if not script.exists():
        raise SystemExit(f"{script} not found; cannot --prepare")
    profile_name = profile_name or profiles.default_name()
    for p in sorted(folder.iterdir()):
        if p.is_file() and p.suffix.lower() == ".heic":
            subprocess.run([str(script), "--profile", profile_name, str(p)], check=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dir", help="artwork folder (overrides --profile)")
    parser.add_argument(
        "--profile",
        default=None,
        help="device profile: which panel this artwork is for (default: the "
        "configured default profile)",
    )
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
    args = parser.parse_args(argv)

    # Validate the profile even when --dir overrides the folder, so a typo fails
    # loudly instead of silently preparing artwork for the wrong panel.
    profiles.resolve(args.profile)
    if args.profile is None:
        args.profile = profiles.default_name()

    folder = images_dir(args.dir, args.profile)
    if not folder.is_dir():
        raise SystemExit(f"artwork folder not found: {folder}")
    if args.prepare:
        prepare_heics(folder, args.profile)

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
