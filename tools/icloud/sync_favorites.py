#!/usr/bin/env python3
"""Mirror the 50 most recent iCloud Favorites into the frame's artwork folder.

Selection is by capture date (newest first) from the Mac's local Photos library,
via osxphotos. The sync prepares each favorite to a 600x448 7-colour dithered
PNG, mirrors the artwork folder, and deploys to the Home Assistant host.

See specs/icloud-favorites-sync/SPEC.md.
"""

from __future__ import annotations

import argparse
import importlib.util
import os
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
DEFAULT_ARTWORK = REPO / "www" / "epaper"
DEFAULT_ENV_FILE = HERE / ".env"
DEFAULT_TOP_N = 50
DEFAULT_INTERVAL_H = 6


@dataclass(frozen=True)
class Config:
    artwork_dir: Path
    dest: str | None
    library: Path | None
    top_n: int
    interval_h: int
    dry_run: bool


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse a simple KEY=VALUE file; blanks and '#' comments are ignored."""
    if not path.is_file():
        return {}
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def _pick(cli, env: Mapping[str, str], env_file: Mapping[str, str], key: str, default):
    if cli is not None:
        return cli
    if key in env:
        return env[key]
    if key in env_file:
        return env_file[key]
    return default


def _as_int(value, key: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"invalid {key}: {value!r} (expected an integer)") from None


def resolve_config(
    args: argparse.Namespace,
    env: Mapping[str, str],
    env_file: Mapping[str, str],
    default_artwork: Path = DEFAULT_ARTWORK,
) -> Config:
    """Resolve config with precedence: CLI > environment > .env file > default."""
    top_n = _as_int(_pick(args.top_n, env, env_file, "TOP_N", DEFAULT_TOP_N), "TOP_N")
    interval_h = _as_int(
        _pick(args.interval_h, env, env_file, "SYNC_INTERVAL_H", DEFAULT_INTERVAL_H),
        "SYNC_INTERVAL_H",
    )
    artwork_dir = Path(
        _pick(args.artwork_dir, env, env_file, "EPAPER_IMAGES", default_artwork)
    ).expanduser()
    library = _pick(args.library, env, env_file, "PHOTOS_LIBRARY", None)
    dest = _pick(args.dest, env, env_file, "EPAPER_DEST", None)
    return Config(
        artwork_dir=artwork_dir,
        dest=dest,
        library=Path(library).expanduser() if library else None,
        top_n=top_n,
        interval_h=interval_h,
        dry_run=bool(args.dry_run),
    )


def preflight() -> list[str]:
    """Return the names of required tools that are missing."""
    missing = []
    if importlib.util.find_spec("osxphotos") is None:
        missing.append("osxphotos (uv sync)")
    if shutil.which("magick") is None:
        missing.append("magick (ImageMagick 7)")
    if shutil.which("scp") is None:
        missing.append("scp")
    return missing


def select_favorites(db, top_n: int) -> list:
    """The most recent favorites by capture date, newest first.

    Videos/Live-Photo movies are excluded; undated photos sort last. Ties on
    capture date are broken deterministically by uuid (ascending).
    """
    favorites = [p for p in db.photos() if p.favorite and not p.ismovie]
    dated = [p for p in favorites if p.date is not None]
    undated = [p for p in favorites if p.date is None]
    dated.sort(key=lambda p: p.uuid)
    dated.sort(key=lambda p: p.date, reverse=True)
    undated.sort(key=lambda p: p.uuid)
    return (dated + undated)[:top_n]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sync_favorites.py",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--artwork-dir", help="artwork folder (default: <repo>/www/epaper)")
    parser.add_argument("--dest", help="deploy destination [user@]host:/path (default: $EPAPER_DEST)")
    parser.add_argument("--library", help="Photos library path (default: system library)")
    parser.add_argument("--top-n", type=int, help=f"favorites to keep (default: {DEFAULT_TOP_N})")
    parser.add_argument("--interval-h", type=int, help=f"launchd interval hours (default: {DEFAULT_INTERVAL_H})")
    parser.add_argument("--config", help=f"env file (default: {DEFAULT_ENV_FILE})")
    parser.add_argument("-n", "--dry-run", action="store_true", help="show what would happen; write nothing")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    env_file = parse_env_file(Path(args.config).expanduser() if args.config else DEFAULT_ENV_FILE)
    try:
        cfg = resolve_config(args, env=os.environ, env_file=env_file)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    missing = preflight()
    if missing:
        print("error: missing required tools: " + ", ".join(missing), file=sys.stderr)
        return 1

    print(
        f"config: artwork_dir={cfg.artwork_dir} dest={cfg.dest} library={cfg.library} "
        f"top_n={cfg.top_n} interval_h={cfg.interval_h} dry_run={cfg.dry_run}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())