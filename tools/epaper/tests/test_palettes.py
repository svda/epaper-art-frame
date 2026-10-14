"""The palette golden files must hold exactly the panel's colours.

`prepare_image.sh` remaps artwork onto these, so a wrong or extra colour here
shows up as a wrong pixel on the glass.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import device_profile as profile  # noqa: E402

pytestmark = pytest.mark.skipif(shutil.which("magick") is None, reason="needs ImageMagick 7")

# The 6 Spectra 6 colours, and the 7th (orange) that only ACeP has.
SIX = {"#000000", "#0000FF", "#00FF00", "#FF0000", "#FFFF00", "#FFFFFF"}
ORANGE = "#FF8000"


def colours_of(path: Path) -> set[str]:
    out = subprocess.run(
        ["magick", str(path), "-format", "%c", "histogram:info:"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return {
        "#" + token.lstrip("#").upper()
        for token in (line.rsplit("#", 1)[-1].split()[0] for line in out.splitlines() if "#" in line)
    }


def test_spectra6_palette_has_exactly_the_six_spectra6_colours():
    _, prof = profile.resolve("spectra6-133")
    assert colours_of(profile.palette_path(prof)) == SIX


def test_acep7_palette_is_the_six_plus_orange():
    _, prof = profile.resolve("acep565")
    assert colours_of(profile.palette_path(prof)) == SIX | {ORANGE}


def test_palettes_are_tiny_strips_of_exactly_one_pixel_per_colour():
    """They are remap tables, not artwork."""
    for name in profile.load()["profiles"]:
        _, prof = profile.resolve(name)
        out = subprocess.run(
            ["magick", "identify", "-format", "%wx%h", str(profile.palette_path(prof))],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
        assert out == f"{prof['colours']}x1"
