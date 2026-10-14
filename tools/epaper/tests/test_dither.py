"""The dithering backend registry.

Any profile naming a library backend must have a scheme registered for it, or it
fails only at run time -- in a launchd sync, hours later. That is the contract
these check.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS))

import device_profile as profile  # noqa: E402
import dither  # noqa: E402


def test_every_library_backend_profile_has_a_scheme():
    for name in profile.load()["profiles"]:
        _, prof = profile.resolve(name)
        if prof["backend"] != "magick":
            assert name in dither.SCHEMES, (
                f"profile '{name}' uses backend '{prof['backend']}' but has no scheme "
                f"registered in dither.py"
            )


def test_backends_are_one_of_the_known_values():
    for name in profile.load()["profiles"]:
        _, prof = profile.resolve(name)
        assert prof["backend"] in ("magick", "epaper-dithering")


def test_library_backends_leave_pre_filter_empty():
    """The library's tone/gamut compression replaces the magick pre-filter.

    Both doing it would double-compensate: the image would be saturated and
    contrast-stretched twice.
    """
    for name in profile.load()["profiles"]:
        _, prof = profile.resolve(name)
        if prof["backend"] != "magick":
            assert prof["pre_filter"] == "", f"{name} has both a library backend and a pre_filter"


def test_unknown_profile_fails_loudly_without_touching_files():
    with pytest.raises(SystemExit):
        dither.main(["no-such-panel", "does-not-exist.png", "never-written.png"])
