from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SCRIPT = REPO / "tools" / "museum" / "set_mode.sh"
EPAPER = REPO / "tools" / "epaper"

pytestmark = pytest.mark.skipif(
    shutil.which("magick") is None or shutil.which("rsync") is None,
    reason="needs ImageMagick and rsync",
)


def make_png(path: Path) -> None:
    subprocess.run(["magick", "-size", "8x8", "xc:red", str(path)], check=True)


def make_tree(tmp_path: Path) -> Path:
    (tmp_path / "tools" / "museum").mkdir(parents=True)
    (tmp_path / "tools" / "epaper").mkdir(parents=True)
    shutil.copy(SCRIPT, tmp_path / "tools" / "museum" / "set_mode.sh")
    for name in (
        "generate_manifest.py",
        "device_profile.py",
        "profiles.json",
        "palette-spectra6.png",
    ):
        shutil.copy(EPAPER / name, tmp_path / "tools" / "epaper" / name)
    stub = tmp_path / "tools" / "epaper" / "push_to_ha.sh"
    stub.write_text("#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$PUSH_LOG\"\n")
    stub.chmod(0o755)
    for mode in ("art", "photos"):
        folder = tmp_path / "www" / "epaper13-modes" / mode
        folder.mkdir(parents=True)
        make_png(folder / f"{mode}.png")
    live = tmp_path / "www" / "epaper13"
    live.mkdir(parents=True)
    (live / ".gitignore").write_text("*.png\n")
    other = tmp_path / "www" / "epaper"
    other.mkdir(parents=True)
    (other / "keep.png").write_bytes(b"keep")
    return tmp_path


def run_script(tree: Path, *args: str) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["EPAPER13_DEST"] = "stub:/srv/ha/config/www/epaper13/"
    env["PUSH_LOG"] = str(tree / "push.log")
    return subprocess.run(
        ["sh", str(tree / "tools" / "museum" / "set_mode.sh"), *args],
        cwd=tree,
        env=env,
        capture_output=True,
        text=True,
    )


def live_names(tree: Path) -> list[str]:
    return sorted(p.name for p in (tree / "www" / "epaper13").iterdir())


def test_switch_to_art_publishes_and_deploys(tmp_path):
    tree = make_tree(tmp_path)
    result = run_script(tree, "art")
    assert result.returncode == 0, result.stderr
    assert live_names(tree) == [".gitignore", "art.png", "manifest.json"]
    assert (tree / "www" / "epaper13-modes" / "ACTIVE").read_text().strip() == "art"
    manifest = json.loads((tree / "www" / "epaper13" / "manifest.json").read_text())
    assert manifest == ["art.png"]
    log = (tree / "push.log").read_text()
    assert "--profile" in log
    assert "spectra6-133" in log
    assert "stub:/srv/ha/config/www/epaper13/" in log


def test_switch_to_photos_replaces_the_art(tmp_path):
    tree = make_tree(tmp_path)
    assert run_script(tree, "art").returncode == 0
    result = run_script(tree, "photos")
    assert result.returncode == 0, result.stderr
    assert live_names(tree) == [".gitignore", "manifest.json", "photos.png"]
    assert (tree / "www" / "epaper13-modes" / "ACTIVE").read_text().strip() == "photos"


def test_empty_mode_refuses_and_leaves_the_live_folder_untouched(tmp_path):
    tree = make_tree(tmp_path)
    assert run_script(tree, "art").returncode == 0
    before = live_names(tree)
    for png in (tree / "www" / "epaper13-modes" / "photos").glob("*.png"):
        png.unlink()
    result = run_script(tree, "photos")
    assert result.returncode != 0
    assert live_names(tree) == before


def test_dry_run_changes_nothing(tmp_path):
    tree = make_tree(tmp_path)
    before = live_names(tree)
    result = run_script(tree, "--dry-run", "art")
    assert result.returncode == 0, result.stderr
    assert live_names(tree) == before
    assert not (tree / "www" / "epaper13-modes" / "ACTIVE").exists()
    assert not (tree / "push.log").exists()


def test_refresh_without_active_refuses(tmp_path):
    tree = make_tree(tmp_path)
    result = run_script(tree, "--refresh")
    assert result.returncode != 0


def test_refresh_republishes_the_active_mode(tmp_path):
    tree = make_tree(tmp_path)
    assert run_script(tree, "art").returncode == 0
    make_png(tree / "www" / "epaper13-modes" / "art" / "new.png")
    result = run_script(tree, "--refresh")
    assert result.returncode == 0, result.stderr
    assert (tree / "www" / "epaper13" / "new.png").is_file()


def test_status_reports_the_active_mode_and_counts(tmp_path):
    tree = make_tree(tmp_path)
    assert run_script(tree, "art").returncode == 0
    result = run_script(tree, "--status")
    assert result.returncode == 0
    assert "active: art" in result.stdout
    assert "art: 1 PNG(s)" in result.stdout
    assert "photos: 1 PNG(s)" in result.stdout


def test_no_deploy_publishes_without_pushing(tmp_path):
    tree = make_tree(tmp_path)
    result = run_script(tree, "--no-deploy", "art")
    assert result.returncode == 0, result.stderr
    assert (tree / "www" / "epaper13" / "art.png").is_file()
    assert (tree / "www" / "epaper13-modes" / "ACTIVE").read_text().strip() == "art"
    assert not (tree / "push.log").exists()


def test_the_5_65_frame_is_untouched(tmp_path):
    tree = make_tree(tmp_path)
    before = (tree / "www" / "epaper" / "keep.png").read_bytes()
    assert run_script(tree, "art").returncode == 0
    assert (tree / "www" / "epaper" / "keep.png").read_bytes() == before
