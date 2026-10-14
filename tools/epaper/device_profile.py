#!/usr/bin/env python3
"""Device profiles for the e-paper image pipeline.

A profile is everything a panel needs from the tooling: its pixel dimensions, its
colour palette, and where its artwork lives. `profiles.json` is the single source
of truth; `prepare_image.sh`, `generate_manifest.py` and `push_to_ha.sh` all read
it from here, so adding a device is a row in the JSON, never an `if` in a script.

CLI (used by the shell scripts):
device_profile.py --default             print the default profile id
device_profile.py --list                print every profile id, one per line
device_profile.py <id>                  print the id (validates it exists)
device_profile.py <id> <field>          print one field
device_profile.py <id> --artwork        print the absolute artwork directory
device_profile.py <id> --palette        print the absolute palette path
device_profile.py <id> --json           print the whole profile as JSON

`<id>` may be omitted to use the configured default.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
PROFILES_FILE = HERE / "profiles.json"
FIELDS = ("description", "width", "height", "colours", "palette", "artwork", "ha_dir", "backend", "pre_filter", "dither")


def load() -> dict:
    """The parsed profiles.json."""
    return json.loads(PROFILES_FILE.read_text(encoding="utf-8"))


def default_name() -> str:
    """The id of the profile used when none is given."""
    return load()["default"]


def resolve(name: str | None = None) -> tuple[str, dict]:
    """Return ``(id, profile)``. ``None`` means the configured default."""
    data = load()
    name = name or data["default"]
    try:
        return name, data["profiles"][name]
    except KeyError:
        known = ", ".join(sorted(data["profiles"]))
        raise SystemExit(f"unknown profile '{name}' (known: {known})")


def artwork_dir(profile: dict) -> Path:
    """Absolute artwork folder for *profile* (may not exist yet)."""
    return (REPO / profile["artwork"]).resolve()


def palette_path(profile: dict) -> Path:
    """Absolute path to the profile's palette golden file."""
    return HERE / profile["palette"]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("profile", nargs="?", help="profile id (default: the configured default)")
    parser.add_argument("field", nargs="?", choices=FIELDS, help="field to print")
    parser.add_argument("--default", action="store_true", help="print the default profile id")
    parser.add_argument("--list", action="store_true", help="print every profile id")
    parser.add_argument("--artwork", action="store_true", help="print the absolute artwork dir")
    parser.add_argument("--palette", action="store_true", help="print the absolute palette path")
    parser.add_argument("--json", action="store_true", help="print the whole profile as JSON")
    args = parser.parse_args(argv)

    if args.default:
        print(default_name())
        return 0
    if args.list:
        for name in sorted(load()["profiles"]):
            print(name)
        return 0

    name, profile = resolve(args.profile)
    if args.json:
        print(json.dumps({"id": name, **profile}, indent=2, sort_keys=True))
    elif args.artwork:
        print(artwork_dir(profile))
    elif args.palette:
        print(palette_path(profile))
    elif args.field:
        print(profile[args.field])
    else:
        print(name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
