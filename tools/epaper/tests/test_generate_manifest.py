"""Manifest generation, and how it picks the artwork folder.

`manifest.json` is the device's only view of the rotation, so these test the
contract: the folder it writes to, and the array it writes.
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parent
sys.path.insert(0, str(TOOLS))

import device_profile as profile  # noqa: E402


def load_generate_manifest():
    """Import generate_manifest.py by path (it is a script, not a module)."""
    spec = importlib.util.spec_from_file_location(
        "generate_manifest", TOOLS / "generate_manifest.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# --- the profile seam -------------------------------------------------------


def test_default_artwork_dir_is_the_acep565_folder():
    gm = load_generate_manifest()
    _, acep = profile.resolve("acep565")
    assert gm.default_images_dir() == profile.artwork_dir(acep)


def test_spectra6_profile_selects_the_13in_artwork_folder():
    gm = load_generate_manifest()
    _, spect = profile.resolve("spectra6-133")
    assert gm.default_images_dir("spectra6-133") == profile.artwork_dir(spect)


# --- manifest contents ------------------------------------------------------


def make_images(folder: Path, names: list[str]) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    for name in names:
        (folder / name).write_bytes(b"not-a-real-png")


def run_manifest(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(TOOLS / "generate_manifest.py"), *args],
        capture_output=True,
        text=True,
    )


def test_manifest_lists_folder_images_sorted_and_excludes_the_manifest(tmp_path):
    make_images(tmp_path, ["b.png", "a.png", "manifest.json", ".hidden.png"])
    assert run_manifest("--dir", str(tmp_path)).returncode == 0
    assert json.loads((tmp_path / "manifest.json").read_text()) == ["a.png", "b.png"]


def test_check_reports_stale_then_fresh(tmp_path):
    make_images(tmp_path, ["a.png"])
    assert run_manifest("--dir", str(tmp_path), "--check").returncode == 1  # no manifest yet
    assert run_manifest("--dir", str(tmp_path)).returncode == 0
    assert run_manifest("--dir", str(tmp_path), "--check").returncode == 0  # now fresh
    (tmp_path / "b.png").write_bytes(b"x")
    assert run_manifest("--dir", str(tmp_path), "--check").returncode == 1  # stale again


def test_profile_flag_is_accepted():
    """--profile must not be rejected even when --dir overrides the folder."""
    with pytest.raises(SystemExit) as exc:
        load_generate_manifest().main(["--profile", "nope", "--dir", "."])
    assert exc.value.code != 0
