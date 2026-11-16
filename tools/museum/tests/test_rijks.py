from __future__ import annotations

import json
from pathlib import Path

import pytest

from rijks import Print, Skip, resolve, set_members

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_fetch(object_number: str):
    """A fake fetch backed by a recorded fixture; records every URL it is asked for."""
    data = json.loads((FIXTURES / f"{object_number}.json").read_text())
    calls: list[str] = []

    def fetch(url: str) -> dict:
        calls.append(url)
        if "/search/collection?" in url:
            return data["search"]
        if url == data["object"]["id"]:
            return data["object"]
        if url == data["visual"]["id"]:
            return data["visual"]
        if url == data["digital"]["id"]:
            return data["digital"]
        if url.endswith("/info.json"):
            return data["info"]
        raise AssertionError(f"unexpected url: {url}")

    return fetch, calls


def test_print_resolves_with_metadata():
    fetch, _ = fixture_fetch("RP-P-1956-733")
    result = resolve("RP-P-1956-733", fetch)

    assert isinstance(result, Print)
    assert result.object_number == "RP-P-1956-733"
    assert result.title == "Under the Wave off Kanagawa"
    assert result.artist == "Katsushika Hokusai"
    assert result.date == "1829 - 1833"
    assert result.rights == "PD"
    assert result.type == "print"
    assert (result.width, result.height) == (5706, 3896)
    assert result.image_url.startswith("https://iiif.micr.io/")
    assert result.image_url.endswith("/full/!1600,1600/0/default.jpg")


def test_painting_resolves():
    fetch, _ = fixture_fetch("SK-A-3089")
    result = resolve("SK-A-3089", fetch)

    assert isinstance(result, Print)
    assert result.title == "Cat at Play"
    assert result.artist == "Henriëtte Ronner"
    assert result.type == "painting"
    assert result.rights == "PD"


def test_photograph_resolves():
    fetch, _ = fixture_fetch("RP-F-00-630")
    result = resolve("RP-F-00-630", fetch)

    assert isinstance(result, Print)
    assert result.artist == "George Hendrik Breitner"
    assert result.type == "photograph"
    assert result.rights == "PD"


def test_drawing_resolves():
    fetch, _ = fixture_fetch("RP-T-1921-120")
    result = resolve("RP-T-1921-120", fetch)

    assert isinstance(result, Print)
    assert result.title == "Het Armenhuis te Rotterdam"
    assert result.type == "drawing"
    assert result.rights == "PD"


def test_portrait_is_skipped_and_never_fetches_the_image():
    fetch, calls = fixture_fetch("RP-P-RMA1442")
    result = resolve("RP-P-RMA1442", fetch)

    assert isinstance(result, Skip)
    assert result.reason == "portrait"
    assert not any("/full/" in url for url in calls)


def test_in_copyright_is_skipped():
    fetch, _ = fixture_fetch("RP-F-F02993")
    result = resolve("RP-F-F02993", fetch)

    assert isinstance(result, Skip)
    assert result.reason == "rights"


def test_ambiguous_object_number_is_skipped():
    fetch, _ = fixture_fetch("RP-F-2019-299-6-6")
    result = resolve("RP-F-2019-299-6-6", fetch)

    assert isinstance(result, Skip)
    assert result.reason == "ambiguous"


def test_unknown_object_number_is_skipped():
    fetch, _ = fixture_fetch("XX-000-000")
    result = resolve("XX-000-000", fetch)

    assert isinstance(result, Skip)
    assert result.reason == "not-found"


def test_missing_info_json_is_skipped_not_crashed():
    fetch, _ = fixture_fetch("RP-P-1956-733")

    def broken(url: str) -> dict:
        if url.endswith("/info.json"):
            return {}
        return fetch(url)

    result = resolve("RP-P-1956-733", broken)

    assert isinstance(result, Skip)
    assert result.reason == "no-image"


def test_metadata_falls_back_when_fields_are_missing():
    fetch, _ = fixture_fetch("RP-P-1956-733")
    data = json.loads((FIXTURES / "RP-P-1956-733.json").read_text())
    bare = {
        "id": data["object"]["id"],
        "type": "HumanMadeObject",
        "classified_as": [],
        "shows": data["object"]["shows"],
    }

    def fetch_bare(url: str) -> dict:
        if url == data["object"]["id"]:
            return bare
        return fetch(url)

    result = resolve("RP-P-1956-733", fetch_bare)

    assert isinstance(result, Print)
    assert result.title == "Untitled"
    assert result.artist == "Anonymous"
    assert result.date == ""
    assert result.type == "unknown"


def test_set_members_returns_object_numbers_in_order():
    def fetch(url: str) -> dict:
        assert "/usersets/" in url
        return {
            "userSet": {
                "setItems": [
                    {"objectNumber": "RP-P-1912-609"},
                    {"objectNumber": "SK-A-3089"},
                ]
            }
        }

    assert set_members("epaper--abc", "en", "key", fetch) == [
        "RP-P-1912-609",
        "SK-A-3089",
    ]


def test_set_members_requires_a_key():
    with pytest.raises(ValueError):
        set_members("epaper--abc", "en", "", lambda url: {})


def test_set_members_empty_set_is_fatal():
    with pytest.raises(ValueError):
        set_members(
            "epaper--abc", "en", "key", lambda url: {"userSet": {"setItems": []}}
        )
