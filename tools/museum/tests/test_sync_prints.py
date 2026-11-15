from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from sync_prints import run

FIXTURES = Path(__file__).parent / "fixtures"


def all_fixtures_fetch():
    """A fake fetch that dispatches across every recorded fixture."""
    by_search: dict[str, dict] = {}
    by_id: dict[str, dict] = {}
    by_info: dict[str, dict] = {}
    for path in FIXTURES.glob("*.json"):
        data = json.loads(path.read_text())
        by_search[data["object_number"]] = data["search"]
        for key in ("object", "visual", "digital"):
            if key in data:
                by_id[data[key]["id"]] = data[key]
        if "info" in data and "digital" in data:
            access = data["digital"]["access_point"][0]["id"]
            base = access.split("/full/")[0]
            by_info[base + "/info.json"] = data["info"]

    def fetch(url: str) -> dict:
        if "/search/collection?" in url:
            number = parse_qs(urlparse(url).query)["objectNumber"][0]
            return by_search[number]
        if url in by_id:
            return by_id[url]
        if url in by_info:
            return by_info[url]
        raise AssertionError(f"unexpected url: {url}")

    return fetch


def test_dry_run_reports_ok_and_skips(tmp_path):
    list_path = tmp_path / "prints.toml"
    list_path.write_text(
        'prints = ["RP-P-1956-733", "RP-P-RMA1442", "XX-000-000"]\n'
    )
    lines: list[str] = []

    results = run(list_path, all_fixtures_fetch(), out=lines.append)

    assert len(results) == 3
    assert "RP-P-1956-733" in lines[0]
    assert "print" in lines[0]
    assert "PD" in lines[0]
    assert "ok" in lines[0]
    assert "skip: portrait" in lines[1]
    assert "skip: not-found" in lines[2]


def test_dry_run_keeps_going_after_a_skip(tmp_path):
    list_path = tmp_path / "prints.toml"
    list_path.write_text('prints = ["XX-000-000", "SK-A-3089"]\n')
    lines: list[str] = []

    results = run(list_path, all_fixtures_fetch(), out=lines.append)

    assert len(results) == 2
    assert "skip: not-found" in lines[0]
    assert "ok" in lines[1]
