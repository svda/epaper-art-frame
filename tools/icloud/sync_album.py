#!/usr/bin/env python3
"""Mirror a Photos album into the frame's artwork folder.

Selects every photo in the configured album (e.g. the shared album
"epaper art frame"), newest-first by capture date, from the Mac's local Photos
library via osxphotos. The sync prepares each to a 600x448 7-colour dithered
PNG, mirrors the artwork folder, and deploys to the Home Assistant host.

See specs/icloud-album-sync/SPEC.md.
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
DEFAULT_INTERVAL_H = 6
MANAGED_NAME = ".managed.json"
PREPARE_SCRIPT = REPO / "tools" / "epaper" / "prepare_image.sh"
MANIFEST_SCRIPT = REPO / "tools" / "epaper" / "generate_manifest.py"
PUSH_SCRIPT = REPO / "tools" / "epaper" / "push_to_ha.sh"
PLIST_TEMPLATE = HERE / "com.sander.epaper-album.plist.template"


@dataclass(frozen=True)
class Config:
    artwork_dir: Path
    dest: str | None
    library: Path | None
    album: str | None
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
    interval_h = _as_int(
        _pick(args.interval_h, env, env_file, "SYNC_INTERVAL_H", DEFAULT_INTERVAL_H),
        "SYNC_INTERVAL_H",
    )
    artwork_dir = Path(
        _pick(args.artwork_dir, env, env_file, "EPAPER_IMAGES", default_artwork)
    ).expanduser()
    library = _pick(args.library, env, env_file, "PHOTOS_LIBRARY", None)
    dest = _pick(args.dest, env, env_file, "EPAPER_DEST", None)
    album = _pick(args.album, env, env_file, "ALBUM", None)
    return Config(
        artwork_dir=artwork_dir,
        dest=dest,
        library=Path(library).expanduser() if library else None,
        album=album,
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


def select_album(db, album: str) -> list:
    """Every photo in *album*, newest-first by capture date.

    Videos/Live-Photo movies are excluded; undated photos sort last. Ties on
    capture date are broken deterministically by uuid (ascending).
    """
    photos = [p for p in db.photos(albums=[album]) if not p.ismovie]
    dated = [p for p in photos if p.date is not None]
    undated = [p for p in photos if p.date is None]
    dated.sort(key=lambda p: p.uuid)
    dated.sort(key=lambda p: p.date, reverse=True)
    undated.sort(key=lambda p: p.uuid)
    return dated + undated


@dataclass(frozen=True)
class SyncResult:
    prepared: int
    kept: list[str]
    deleted: list[str]
    dry_run: bool
    failures: list[tuple[str, str]] = field(default_factory=list)
    copied: int = 0


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
    """Prepare the selected photos into the artwork folder and mirror it.

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

        if photos and not prepared_uuids:
            # Every selected photo failed to prepare. Do NOT mirror: deleting the
            # whole folder on a transient export failure would wipe the rotation.
            # Leave the folder intact and regenerate the manifest to match it.
            regenerate_manifest(artwork_dir)
            return SyncResult(
                prepared=0,
                kept=sorted(existing),
                deleted=[],
                dry_run=False,
                failures=failures,
                copied=0,
            )

        deletions = plan_deletions(existing, managed, current, first_run)

        copied = 0
        for uuid in prepared_uuids:
            staged = stage / f"{uuid}.png"
            dest = artwork_dir / staged.name
            if not (dest.is_file() and dest.read_bytes() == staged.read_bytes()):
                shutil.copy2(staged, dest)
                copied += 1
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
        copied=copied,
    )


def export_photo(photo, export_dir: Path):
    """Path to the photo's image, downloading it from iCloud if off-disk.

    Prefer the library original when it is already on disk. Otherwise export via
    Photos (``use_photos_export=True``), which downloads iCloud and Shared-Album
    assets. ``edited=True`` exports the rendered image — without it, a photo that
    has adjustments exports only an adjustment-data plist (not an image), which
    ImageMagick cannot read. The exported file paths are returned directly,
    because ``photo.path`` stays ``None`` for shared-album assets even after a
    successful export.
    """
    if photo.path and Path(photo.path).is_file():
        return [str(photo.path)]
    # Rendered export: `edited=True` is required for photos with adjustments
    # (otherwise the original exports only an adjustment-data plist, which
    # ImageMagick cannot read), but Photos refuses it for un-adjusted photos.
    kwargs = {"use_photos_export": True, "overwrite": True}
    if getattr(photo, "hasadjustments", False):
        kwargs["edited"] = True
    exported = photo.export(str(export_dir), **kwargs)
    if exported:
        return list(exported)
    if photo.path and Path(photo.path).is_file():
        return [str(photo.path)]
    raise RuntimeError("original not available (still in iCloud?)")


def _run(argv: list[str]) -> None:
    result = subprocess.run(argv, capture_output=True, text=True)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"{Path(argv[0]).name} failed ({result.returncode}): {detail}")


def prepare_one(
    photo,
    dest: Path,
    *,
    export_fn=export_photo,
    run_fn=_run,
    prepare_script: Path = PREPARE_SCRIPT,
) -> None:
    """Export one photo and prepare it to *dest* as a panel-ready PNG.

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


def manifest_writer(script: Path = MANIFEST_SCRIPT, run_fn=_run):
    """A manifest regenerator that calls generate_manifest.py (its only writer)."""

    def regenerate(artwork_dir: Path) -> None:
        run_fn([sys.executable, str(script), "--dir", str(artwork_dir)])

    return regenerate


def open_library(cfg: Config):
    import osxphotos

    if cfg.library:
        return osxphotos.PhotosDB(library_path=str(cfg.library))
    return osxphotos.PhotosDB()


def sync(cfg: Config, db, prepare_one, regenerate_manifest) -> SyncResult:
    """Select the album's photos and mirror them into the artwork folder."""
    if not cfg.album:
        raise RuntimeError("no album configured (set ALBUM or --album)")
    photos = select_album(db, cfg.album)
    return apply_artwork(
        photos,
        cfg.artwork_dir,
        prepare_one,
        regenerate_manifest,
        dry_run=cfg.dry_run,
    )


def summarize(result: SyncResult) -> str:
    parts = [
        f"prepared={result.prepared}",
        f"kept={len(result.kept)}",
        f"deleted={len(result.deleted)}",
    ]
    if result.dry_run:
        parts.append("dry-run")
    if result.failures:
        parts.append(f"failures={len(result.failures)}")
    return "sync: " + " ".join(parts)


def exit_code(result: SyncResult) -> int:
    return 1 if result.failures else 0


def deploy(dest: str | None, changed: bool, run_fn=_run) -> None:
    """Push to the HA host when something changed; skip otherwise."""
    if not changed:
        return
    if not dest:
        raise RuntimeError("no deploy destination configured (set EPAPER_DEST or --dest)")
    run_fn([str(PUSH_SCRIPT), dest])


def render_plist(
    template: str,
    *,
    python: str,
    script: str,
    workdir: str,
    stdout: str,
    stderr: str,
    interval_h: int,
) -> str:
    """Fill the launchd template for this machine (absolute paths required)."""
    return (
        template.replace("__PYTHON__", python)
        .replace("__SCRIPT__", script)
        .replace("__WORKDIR__", workdir)
        .replace("__STDOUT__", stdout)
        .replace("__STDERR__", stderr)
        .replace("__INTERVAL__", str(interval_h * 3600))
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sync_album.py",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--artwork-dir", help="artwork folder (default: <repo>/www/epaper)")
    parser.add_argument("--dest", help="deploy destination [user@]host:/path (default: $EPAPER_DEST)")
    parser.add_argument("--library", help="Photos library path (default: system library)")
    parser.add_argument("--album", help="Photos album name to mirror (default: $ALBUM)")
    parser.add_argument("--interval-h", type=int, help=f"launchd interval hours (default: {DEFAULT_INTERVAL_H})")
    parser.add_argument("--config", help=f"env file (default: {DEFAULT_ENV_FILE})")
    parser.add_argument(
        "--print-plist",
        action="store_true",
        help="print a launchd plist for this machine and exit (do not run the sync)",
    )
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

    if args.print_plist:
        print(
            render_plist(
                PLIST_TEMPLATE.read_text(encoding="utf-8"),
                python=sys.executable,
                script=str(HERE / "sync_album.py"),
                workdir=str(HERE),
                stdout=str(HERE / "sync.log"),
                stderr=str(HERE / "sync.err.log"),
                interval_h=cfg.interval_h,
            ),
            end="",
        )
        return 0

    missing = preflight()
    if missing:
        print("error: missing required tools: " + ", ".join(missing), file=sys.stderr)
        return 1

    db = open_library(cfg)
    result = sync(cfg, db, prepare_one, manifest_writer())
    print(summarize(result))
    for uuid, error in result.failures:
        print(f"  failed {uuid}: {error}", file=sys.stderr)

    if not cfg.dry_run:
        changed = bool(result.deleted) or result.copied > 0
        try:
            deploy(cfg.dest, changed)
        except Exception as exc:  # noqa: BLE001 - report and exit non-zero
            print(f"error: deploy failed: {exc}", file=sys.stderr)
            return 1
        print(f"deploy: {'pushed to ' + cfg.dest if changed else 'no changes'}")

    return exit_code(result)


if __name__ == "__main__":
    raise SystemExit(main())