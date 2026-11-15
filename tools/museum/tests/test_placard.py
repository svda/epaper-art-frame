from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from placard import compose, letter, render, sanitise, truncate

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
PALETTE = REPO / "tools" / "epaper" / "palette-spectra6.png"
FONT = Path("/System/Library/Fonts/Supplemental/Georgia.ttf")

pytestmark = pytest.mark.skipif(
    not FONT.is_file() or not PALETTE.is_file() or shutil.which("magick") is None,
    reason="needs ImageMagick, the palette, and the Georgia font",
)


def magick(*args: str) -> None:
    subprocess.run(["magick", *args], check=True, capture_output=True)


def size(path: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["magick", "identify", "-format", "%w %h", str(path)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    width, height = out.split()
    return int(width), int(height)


def unique_colours(path: Path) -> set[str]:
    out = subprocess.run(
        ["magick", str(path), "-unique-colors", "txt:-"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    colours: set[str] = set()
    for line in out.splitlines()[1:]:
        for token in line.split():
            if token.startswith("#") and len(token) == 7:
                colours.add(token.upper())
    return colours


def trim_size(path: Path) -> tuple[int, int]:
    out = subprocess.run(
        ["magick", str(path), "-trim", "-format", "%w %h", "info:"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    width, height = out.split()
    return int(width), int(height)


def test_sanitise_keeps_safe_characters():
    assert sanitise("RP-P-1956-733") == "RP-P-1956-733"
    assert sanitise("a/b c") == "a_b_c"


def test_truncate_adds_an_ellipsis():
    result = truncate("A" * 200, FONT, 40, 1520)
    assert result.endswith("…")
    assert len(result) < 200


def test_compose_fits_a_tall_source_without_cropping(tmp_path):
    source = tmp_path / "tall.png"
    magick("-size", "400x800", "xc:black", str(source))
    out = tmp_path / "composed.png"

    compose(source, out)

    assert size(out) == (1600, 1200)
    assert trim_size(out) == (508, 1016)


def test_compose_fits_a_wide_source_without_cropping(tmp_path):
    source = tmp_path / "wide.png"
    magick("-size", "800x400", "xc:black", str(source))
    out = tmp_path / "composed.png"

    compose(source, out)

    assert size(out) == (1600, 1200)
    assert trim_size(out) == (1520, 760)


def test_letter_strip_is_only_black_and_white(tmp_path):
    base = tmp_path / "base.png"
    magick("-size", "1600x1200", "xc:white", str(base))
    out = tmp_path / "lettered.png"

    letter(base, "Title", "Artist", "1890", font=FONT, out=out)

    strip = tmp_path / "strip.png"
    magick(str(out), "-crop", "1600x144+0+1056", "+repage", str(strip))
    assert unique_colours(strip) <= {"#000000", "#FFFFFF"}


def test_render_uses_only_palette_colours(tmp_path):
    source = tmp_path / "source.png"
    magick("-size", "800x600", "xc:red", str(source))
    out = tmp_path / "out.png"

    render(source, "Title", "Artist", "1890", out, font=FONT)

    assert size(out) == (1600, 1200)
    assert unique_colours(out) <= unique_colours(PALETTE)
