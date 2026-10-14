"""The device profile table is the pipeline's single source of truth.

These test the *contract* other tools depend on: profile ids, panel geometry,
artwork locations. Not the implementation.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import device_profile as profile  # noqa: E402


def test_default_profile_is_acep565():
    """The deployed 5.65" frame must keep working with no profile named."""
    assert profile.default_name() == "acep565"
    name, _ = profile.resolve(None)
    assert name == "acep565"


def test_both_panels_are_known():
    assert set(profile.load()["profiles"]) == {"acep565", "spectra6-133"}


def test_acep565_geometry_and_artwork():
    _, prof = profile.resolve("acep565")
    assert (prof["width"], prof["height"]) == (600, 448)
    assert prof["colours"] == 7
    assert prof["palette"] == "palette-acep7.png"
    assert prof["ha_dir"] == "local/epaper"


def test_spectra6_geometry_is_landscape_and_artwork_is_separate():
    """The EE02 panel is 1200x1600 native but mounted landscape (rotation 90)."""
    _, prof = profile.resolve("spectra6-133")
    assert (prof["width"], prof["height"]) == (1600, 1200)
    assert prof["colours"] == 6
    assert prof["palette"] == "palette-spectra6.png"
    assert prof["ha_dir"] == "local/epaper13"


def test_artwork_dirs_are_absolute_and_distinct():
    _, acep = profile.resolve("acep565")
    _, spect = profile.resolve("spectra6-133")
    acep_dir, spect_dir = profile.artwork_dir(acep), profile.artwork_dir(spect)
    assert acep_dir.is_absolute() and spect_dir.is_absolute()
    assert acep_dir != spect_dir


def test_every_profile_palette_file_exists():
    for name in profile.load()["profiles"]:
        _, prof = profile.resolve(name)
        assert profile.palette_path(prof).is_file(), f"{name} palette missing"


def test_unknown_profile_fails_loudly():
    with pytest.raises(SystemExit):
        profile.resolve("no-such-panel")


def test_cli_prints_the_default_and_a_field():
    assert profile.main(["--default"]) == 0
    assert profile.main(["spectra6-133", "width"]) == 0
