"""Compose a print and a gallery placard into a palette-only 1600x1200 PNG."""
from __future__ import annotations

import argparse
import os
import re
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PREPARE = REPO / "tools" / "epaper" / "src" / "prepare.ts"
PROFILE = "spectra6-133-art"

WIDTH, HEIGHT = 1600, 1200
MARGIN = 24
STRIP = 120
ART_W, ART_H = WIDTH - 2 * MARGIN, HEIGHT - STRIP - MARGIN
DEFAULT_FONT = Path("/System/Library/Fonts/Supplemental/Georgia.ttf")
TITLE_SIZE = 40
SUB_SIZE = 30
TEXT_MAX = WIDTH - 2 * MARGIN


def sanitise(object_number: str) -> str:
    """A device-safe filename stem: no commas, quotes, brackets or slashes."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", object_number)


def _magick(*args: str) -> None:
    subprocess.run(["magick", *args], check=True, capture_output=True)


def _text_width(text: str, font: Path, pointsize: int) -> int:
    out = subprocess.run(
        [
            "magick",
            "-font",
            str(font),
            "-pointsize",
            str(pointsize),
            f"label:{text}",
            "-format",
            "%w",
            "info:",
        ],
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return int(out)


def truncate(text: str, font: Path, pointsize: int, max_width: int) -> str:
    """Shorten *text* with an ellipsis until it fits *max_width* pixels."""
    if _text_width(text, font, pointsize) <= max_width:
        return text
    ellipsis = "…"
    low, high = 0, len(text)
    while low < high:
        mid = (low + high + 1) // 2
        if _text_width(text[:mid] + ellipsis, font, pointsize) <= max_width:
            low = mid
        else:
            high = mid - 1
    return text[:low] + ellipsis


def compose(source: Path, out: Path) -> Path:
    """Fit *source* into the art area, centred on white, never cropped."""
    art = out.with_suffix(".art.png")
    _magick(
        str(source),
        "-auto-orient",
        "-colorspace",
        "sRGB",
        "-resize",
        f"{ART_W}x{ART_H}",
        "-background",
        "white",
        "-gravity",
        "center",
        "-extent",
        f"{ART_W}x{ART_H}",
        str(art),
    )
    _magick(
        "-size",
        f"{WIDTH}x{HEIGHT}",
        "xc:white",
        str(art),
        "-geometry",
        f"+{MARGIN}+{MARGIN}",
        "-composite",
        str(out),
    )
    art.unlink(missing_ok=True)
    return out


def letter(
    image: Path, title: str, artist: str, date: str, *, font: Path, out: Path
) -> Path:
    """Draw the two placard lines as 1-bit black on white, then composite them."""
    title = truncate(title, font, TITLE_SIZE, TEXT_MAX)
    subtitle = f"{artist}, {date}" if date else artist
    subtitle = truncate(subtitle, font, SUB_SIZE, TEXT_MAX)
    text = out.with_suffix(".text.png")
    _magick(
        "-size",
        f"{WIDTH}x{STRIP}",
        "xc:white",
        "-font",
        str(font),
        "-fill",
        "black",
        "-gravity",
        "north",
        "-pointsize",
        str(TITLE_SIZE),
        "-annotate",
        "+0+20",
        title,
        "-pointsize",
        str(SUB_SIZE),
        "-annotate",
        "+0+70",
        subtitle,
        "-threshold",
        "50%",
        "-alpha",
        "off",
        str(text),
    )
    _magick(
        str(image),
        str(text),
        "-gravity",
        "northwest",
        "-geometry",
        f"+0+{HEIGHT - STRIP}",
        "-composite",
        str(out),
    )
    text.unlink(missing_ok=True)
    return out


def _prepare(composed: Path, out: Path) -> None:
    subprocess.run(
        ["bun", str(PREPARE), "--profile", PROFILE, str(composed), str(out)],
        check=True,
        capture_output=True,
    )


def render(
    source: Path,
    title: str,
    artist: str,
    date: str,
    out: Path,
    *,
    font: Path | None = None,
    prepare=_prepare,
) -> Path:
    """Compose, dither through the art profile, then letter the placard."""
    font = font or Path(os.environ.get("PLACARD_FONT", DEFAULT_FONT))
    composed = out.with_suffix(".composed.png")
    compose(source, composed)
    prepare(composed, out)
    letter(out, title, artist, date, font=font, out=out)
    composed.unlink(missing_ok=True)
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path)
    parser.add_argument("title")
    parser.add_argument("artist")
    parser.add_argument("date")
    parser.add_argument("out", type=Path)
    args = parser.parse_args(argv)
    render(args.image, args.title, args.artist, args.date, args.out)
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
