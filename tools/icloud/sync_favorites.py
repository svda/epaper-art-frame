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
import json
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
DEFAULT_ARTWORK = REPO / "www" / "epaper"
DEFAULT_ENV_FILE = HERE / ".env"
DEFAULT_TOP_N = 50
DEFAULT_INTERVAL_H = 6
MANAGED_NAME = ".managed.json"
PREPARE_SCRIPT = REPO / "tools" / "epaper" / "prepare_image.sh"


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


@dataclass(frozen=True)
class SyncResult:
    prepared: int
    kept: list[str]
    deleted: list[str]
    dry_run: bool
    failures: list[tuple[str, str]] = field(default_factory=list)


def read_managed(artwork_dir: Path) -> set[str]:
    state = Path(artwork_dir) / MANAGED_NAME
    if not state.is_file():
        return set()
    return set(json.loads(state.read_text(encoding="utf-8")))


def write_managed(artwork_dir: Path, names: set[str]) -> None:
    state = Path(artwork_dir) / MANAGED_NAME
    state.parent.mkdir(parents=True, exist_ok=True)
    state.write_text(json.dumps(sorted(names)) + "\n", encoding="utf-8")


def plan_deletions(
    existing: set[str], managed: set[str], current: set[str], first_run: bool
) -> set[str]:
    """Files to delete: everything we own that is no longer selected.

    On the first run (no managed state) the sync adopts the folder and owns every
    PNG in it; afterwards it only ever deletes files it previously managed.
    """
    owned = set(existing) if first_run else (set(managed) & set(existing))
    return owned - set(current)


def apply_artwork(
    photos,
    artwork_dir: Path,
    prepare_one,
    regenerate_manifest,
    dry_run: bool = False,
) -> SyncResult:
    """Prepare the selected favorites into the artwork folder and mirror it.

    Preparation happens in a staging dir first, so a failure leaves the artwork
    folder untouched. A photo that cannot be prepared is recorded in `failures`
    and skipped; the rest proceed. The manifest is regenerated last, by its own
    writer.
    """
    artwork_dir = Path(artwork_dir)
    managed = read_managed(artwork_dir)
    first_run = not (artwork_dir / MANAGED_NAME).exists()
    photos = list(photos)
    existing = (
        {p.name for p in artwork_dir.iterdir() if p.is_file() and p.suffix == ".png"}
        if artwork_dir.is_dir()
        else set()
    )

    if dry_run:
        current = {f"{p.uuid}.png" for p in photos}
        deletions = plan_deletions(existing, managed, current, first_run)
        return SyncResult(
            prepared=0,
            kept=sorted(current & existing),
            deleted=sorted(deletions),
            dry_run=True,
        )

    artwork_dir.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="epaper_stage_"))
    failures: list[tuple[str, str]] = []
    prepared_uuids: list[str] = []
    try:
        for photo in photos:
            try:
                prepare_one(photo, stage / f"{photo.uuid}.png")
                prepared_uuids.append(photo.uuid)
            except Exception as exc:  # noqa: BLE001 - report, skip, keep going
                failures.append((photo.uuid, str(exc)))

        current = {f"{uuid}.png" for uuid in prepared_uuids}
        deletions = plan_deletions(existing, managed, current, first_run)

        for uuid in prepared_uuids:
            staged = stage / f"{uuid}.png"
            shutil.copy2(staged, artwork_dir / staged.name)
        for name in deletions:
            (artwork_dir / name).unlink(missing_ok=True)
        write_managed(artwork_dir, current)
        regenerate_manifest(artwork_dir)
    finally:
        shutil.rmtree(stage, ignore_errors=True)

    return SyncResult(
        prepared=len(current),
        kept=sorted(current),
        deleted=sorted(deletions),
        dry_run=False,
        failures=failures,
    )


def export_photo(photo, export_dir: Path):
    """Export a photo's original bytes via Photos.app (downloads if off-disk)."""
    return photo.export(str(export_dir), use_photos_export=True, overwrite=True)


def _run(argv: list[str]) -> None:
    subprocess.run(argv, check=True, capture_output=True, text=True)


def prepare_one(
    photo,
    dest: Path,
    *,
    export_fn=export_photo,
    run_fn=_run,
    prepare_script: Path = PREPARE_SCRIPT,
) -> None:
    """Export one favorite and prepare it to *dest* as a panel-ready PNG.

    Options precede the positional input/output for prepare_image.sh (its arg
    loop breaks at the first non-option).
    """
    dest = Path(dest)
    export_dir = Path(tempfile.mkdtemp(prefix="epaper_export_"))
    try:
        paths = export_fn(photo, export_dir)
        if not paths:
            raise RuntimeError(f"export produced no file for {photo.uuid}")
        src = Path(paths[0])
        run_fn([str(prepare_script), "--out-dir", str(dest.parent), str(src), str(dest)])
    finally:
        shutil.rmtree(export_dir, ignore_errors=True)


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