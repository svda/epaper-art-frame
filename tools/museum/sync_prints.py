"""Resolve a Rijksstudio set, render it, mirror the art folder, and deploy if active."""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

import placard
import rijks

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DEFAULT_CONFIG = HERE / "prints.toml"
DEFAULT_CACHE = HERE / ".cache"
ART_DIR = REPO / "www" / "epaper13-modes" / "art"
MODES_DIR = REPO / "www" / "epaper13-modes"
GENERATE = REPO / "tools" / "epaper" / "generate_manifest.py"
SET_MODE = REPO / "tools" / "museum" / "set_mode.sh"
PROFILE = "spectra6-133-art"
MANAGED_NAME = ".managed.json"


@dataclass
class SyncResult:
    rendered: int
    deleted: list[str]
    failures: list[tuple[str, str]] = field(default_factory=list)


def load_config(path: Path) -> tuple[str, str]:
    data = tomllib.loads(Path(path).read_text())
    set_id = data.get("set_id", "")
    culture = data.get("culture", "nl")
    if not set_id:
        raise ValueError(f"no set_id in {path}")
    return set_id, culture


def run(
    config_path: Path,
    fetch_json,
    fetch_text,
    out=print,
    set_id: str | None = None,
) -> list[tuple[int, rijks.Print | rijks.Skip]]:
    configured, culture = load_config(config_path)
    set_id = set_id or configured
    numbers = rijks.set_members(set_id, culture, fetch_text)
    results: list[tuple[int, rijks.Print | rijks.Skip]] = []
    for index, (number, title) in enumerate(numbers, start=1):
        result = rijks.resolve(number, fetch_json, expected_title=title)
        results.append((index, result))
        if isinstance(result, rijks.Skip):
            out(f"{index:03d}  {number}  skip: {result.reason}")
        else:
            out(
                f"{index:03d}  {number}  {result.type}  {result.rights}  "
                f"{result.width}x{result.height}  ok"
            )
    return results


def read_managed(art_dir: Path) -> set[str]:
    state = Path(art_dir) / MANAGED_NAME
    if not state.is_file():
        return set()
    return set(json.loads(state.read_text(encoding="utf-8")))


def write_managed(art_dir: Path, names: set[str]) -> None:
    state = Path(art_dir) / MANAGED_NAME
    state.parent.mkdir(parents=True, exist_ok=True)
    state.write_text(json.dumps(sorted(names)) + "\n", encoding="utf-8")


def plan_deletions(
    existing: set[str], managed: set[str], current: set[str], first_run: bool
) -> set[str]:
    """Files to delete: everything we own that is no longer selected."""
    owned = set(existing) if first_run else (set(managed) & set(existing))
    return owned - set(current)


def apply_artwork(prints, art_dir: Path, render, regenerate_manifest) -> SyncResult:
    """Render into a staging dir, then mirror the art folder and write the manifest."""
    art_dir = Path(art_dir)
    managed = read_managed(art_dir)
    first_run = not (art_dir / MANAGED_NAME).exists()
    existing = (
        {p.name for p in art_dir.iterdir() if p.is_file() and p.suffix == ".png"}
        if art_dir.is_dir()
        else set()
    )
    art_dir.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix="print_wall_stage_"))
    failures: list[tuple[str, str]] = []
    rendered: list[str] = []
    try:
        for index, item in prints:
            name = f"{index:03d}-{placard.sanitise(item.object_number)}.png"
            try:
                render(item, stage / name)
                rendered.append(name)
            except Exception as exc:  # noqa: BLE001 - report, skip, keep going
                failures.append((item.object_number, str(exc)))

        current = set(rendered)
        if prints and not rendered:
            # Every render failed. Do not mirror: deleting the folder on a transient
            # failure would wipe the rotation. Regenerate the manifest to match it.
            regenerate_manifest(art_dir)
            return SyncResult(0, [], failures)

        deletions = plan_deletions(existing, managed, current, first_run)
        for name in rendered:
            staged = stage / name
            dest = art_dir / name
            if not (dest.is_file() and dest.read_bytes() == staged.read_bytes()):
                shutil.copy2(staged, dest)
        for name in deletions:
            (art_dir / name).unlink(missing_ok=True)
        write_managed(art_dir, current)
        regenerate_manifest(art_dir)
    finally:
        shutil.rmtree(stage, ignore_errors=True)
    return SyncResult(len(rendered), sorted(deletions), failures)


def active_mode(modes_dir: Path) -> str | None:
    path = Path(modes_dir) / "ACTIVE"
    if not path.is_file():
        return None
    return path.read_text().strip() or None


def regenerate_manifest(art_dir: Path) -> None:
    subprocess.run(
        [sys.executable, str(GENERATE), "--profile", PROFILE, "--dir", str(art_dir)],
        check=True,
        capture_output=True,
    )


def _refresh() -> None:
    subprocess.run([str(SET_MODE), "--refresh"], check=True)


def sync(
    config_path: Path,
    fetch_json,
    fetch_text,
    art_dir: Path,
    render,
    regenerate_manifest,
    active: str | None,
    deploy: bool,
    set_id: str | None = None,
    deploy_fn=None,
    out=print,
) -> int:
    results = run(config_path, fetch_json, fetch_text, out=out, set_id=set_id)
    prints = [(index, r) for index, r in results if isinstance(r, rijks.Print)]
    skipped = len(results) - len(prints)
    if not prints:
        out("sync: no renderable objects; nothing changed")
        return 0
    result = apply_artwork(prints, art_dir, render, regenerate_manifest)
    out(
        f"sync: resolved={len(prints)} skipped={skipped} "
        f"rendered={result.rendered} deleted={len(result.deleted)}"
    )
    for number, error in result.failures:
        out(f"  failed {number}: {error}")
    if active == "art" and deploy:
        (deploy_fn or _refresh)()
        out("deploy: refreshed art mode")
    else:
        out(
            f"art staged ({len(prints)} objects); active mode is {active or 'none'} "
            "— run set_mode.sh art to show them"
        )
    return 1 if result.failures else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--set", dest="set_id", help="override the configured set id")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--no-deploy", action="store_true")
    args = parser.parse_args(argv)

    fetcher = rijks.Fetcher(DEFAULT_CACHE, refresh=args.refresh)
    try:
        if args.dry_run:
            run(
                args.config,
                fetcher.get_json,
                fetcher.get_text,
                set_id=args.set_id,
            )
            return 0

        def render(item, dest):
            with tempfile.TemporaryDirectory() as tmp:
                src = Path(tmp) / "source.jpg"
                fetcher.download(item.image_url, src)
                placard.render(src, item.title, item.artist, item.date, dest)

        return sync(
            args.config,
            fetcher.get_json,
            fetcher.get_text,
            ART_DIR,
            render,
            regenerate_manifest,
            active_mode(MODES_DIR),
            not args.no_deploy,
            set_id=args.set_id,
        )
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
