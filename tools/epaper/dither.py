#!/usr/bin/env python3
"""Dither an image to a panel profile's palette using OpenDisplay/epaper-dithering.

Used by `prepare_image.sh` for profiles whose `backend` is `epaper-dithering`.

That library replaces ImageMagick's `-remap` for one specific reason: it matches
colours perceptually (weighted OKLab) and compresses tone and gamut before
dithering. ImageMagick remaps by plain sRGB distance, which shifts hue and washes
muted colours toward grey and black -- the "dark green hardly visible" report.

**The component must agree on the palette or it re-quantises this output.** Its
reference table holds the measured Spectra 6 palette (SPEC.md Q8); the scheme
below is the same palette, from the same library. Keep them in sync.
"""

from __future__ import annotations

import argparse

from PIL import Image

import epaper_dithering as ed

# Library scheme per profile. MUST match the component's reference table.
SCHEMES = {
    "spectra6-133": ed.SPECTRA_7_3_6COLOR_V2,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", help="device profile id")
    parser.add_argument("src", help="input image (any format Pillow can read)")
    parser.add_argument("dest", help="output PNG")
    parser.add_argument(
        "--dbs",
        action="store_true",
        help="Direct Binary Search refinement: optimises for perceived result (slower)",
    )
    parser.add_argument(
        "--no-tone",
        action="store_true",
        help="disable the library's automatic tone + gamut compression",
    )
    args = parser.parse_args(argv)

    try:
        scheme = SCHEMES[args.profile]
    except KeyError:
        known = ", ".join(sorted(SCHEMES))
        raise SystemExit(
            f"profile '{args.profile}' has no epaper-dithering scheme (known: {known})"
        )

    kwargs: dict = {} if args.no_tone else {"tone": "auto", "gamut": "auto"}
    if args.dbs:
        kwargs["dbs"] = True

    image = Image.open(args.src).convert("RGB")
    ed.dither_image(image, scheme, **kwargs).convert("RGB").save(args.dest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
