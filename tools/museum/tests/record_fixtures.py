#!/usr/bin/env python3
"""Record Linked Art fixtures for the resolver tests.

Run from the repo root:

    python3 tools/museum/tests/record_fixtures.py

Writes one JSON file per object number under ``test/fixtures/``. The tests never
touch the network; re-run this only when the API shape changes.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

FIXTURES = Path(__file__).parent.parent / "test" / "fixtures"
UA = {"User-Agent": "epaper-art-frame/print-wall", "Accept": "application/json"}

OBJECT_NUMBERS = [
    "RP-P-1956-733",      # print, PD, landscape
    "SK-A-3089",          # painting, PD, landscape
    "RP-F-00-630",        # photograph, PD, landscape
    "RP-T-1921-120",      # drawing, PD, landscape
    "RP-P-RMA1442",       # poster, PD, portrait
    "RP-F-F02993",        # photograph, In Copyright, unique number
    "RP-F-2019-299-6-6",  # ambiguous: 166 objects share this prefix
    "XX-000-000",         # unknown
]


def get(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def record(object_number: str) -> dict:
    search = get(
        "https://data.rijksmuseum.nl/search/collection?"
        + urllib.parse.urlencode({"objectNumber": object_number})
    )
    out: dict = {"object_number": object_number, "search": search}
    ids = [x["id"] for x in search.get("orderedItems", [])]
    if not ids:
        return out
    obj = get(ids[0])
    out["object"] = obj
    shows = (obj.get("shows") or [{}])[0].get("id")
    if not shows:
        return out
    visual = get(shows)
    out["visual"] = visual
    digital_id = (visual.get("digitally_shown_by") or [{}])[0].get("id")
    if not digital_id:
        return out
    digital = get(digital_id)
    out["digital"] = digital
    access = (digital.get("access_point") or [{}])[0].get("id")
    if access:
        base = access.split("/full/")[0]
        out["info"] = get(base + "/info.json")
    return out


def main() -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    for number in OBJECT_NUMBERS:
        data = record(number)
        name = number.replace("/", "_") + ".json"
        (FIXTURES / name).write_text(json.dumps(data, indent=2) + "\n")
        print(f"wrote {name}")
        time.sleep(0.4)


if __name__ == "__main__":
    main()
