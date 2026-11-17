from __future__ import annotations

import json
from pathlib import Path

import pytest

from rijks import Print, Skip, resolve, rights_of, set_members

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


def test_rights_label_reports_the_objects_own_term():
    data = json.loads((FIXTURES / "RP-F-F02993.json").read_text())

    assert rights_of(data["visual"]) == "Copyright"


def test_ambiguous_object_number_is_skipped():
    fetch, calls = fixture_fetch("RP-F-2019-299-6-6")
    result = resolve("RP-F-2019-299-6-6", fetch)

    assert isinstance(result, Skip)
    assert result.reason == "ambiguous"
    # 166 hits share the prefix: no candidate is fetched at all.
    assert len(calls) == 1


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
    html = (
        '"UserSetObjectApiModel","id","node","De Yodo rivier in maanlicht",'
        '"RP-P-1912-609","SK-A-3089"'
    )

    assert set_members("epaper--abc", "nl", lambda url: html) == [
        "RP-P-1912-609",
        "SK-A-3089",
    ]


def test_set_members_empty_set_is_fatal():
    with pytest.raises(ValueError):
        set_members("epaper--abc", "nl", lambda url: "<html></html>")


def test_resolve_disambiguates_by_object_number():
    def fetch(url: str) -> dict:
        if "/search/collection?" in url:
            return {"orderedItems": [{"id": "obj1"}, {"id": "obj2"}]}
        if url == "obj1":
            return {
                "id": "obj1",
                "identified_by": [
                    {"type": "Identifier", "content": "SK-A-400"},
                    {"type": "Name", "content": "Wrong"},
                ],
                "shows": [{"id": "vis1"}],
            }
        if url == "obj2":
            return {
                "id": "obj2",
                "identified_by": [
                    {"type": "Identifier", "content": "SK-A-4"},
                    {"type": "Name", "content": "Right"},
                ],
                "shows": [{"id": "vis2"}],
            }
        if url == "vis2":
            return {
                "subject_to": [
                    {
                        "classified_as": [
                            {
                                "id": "https://creativecommons.org/publicdomain/mark/1.0/"
                            }
                        ]
                    }
                ],
                "digitally_shown_by": [{"id": "dig2"}],
            }
        if url == "dig2":
            return {
                "access_point": [
                    {"id": "https://iiif.micr.io/x/full/max/0/default.jpg"}
                ]
            }
        if url.endswith("/info.json"):
            return {"width": 100, "height": 50}
        raise AssertionError(f"unexpected url: {url}")

    result = resolve("SK-A-4", fetch)

    assert isinstance(result, Print)
    assert result.title == "Right"
