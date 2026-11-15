from __future__ import annotations

import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import rijks
from sync_prints import apply_artwork, plan_deletions, run, sync

FIXTURES = Path(__file__).parent / "fixtures"


def make_print(number: str = "A") -> rijks.Print:
    return rijks.Print(
        object_number=number,
        title="Title",
        artist="Artist",
        date="1890",
        rights="PD",
        type="print",
        width=10,
        height=10,
        image_url="https://example.test/img",
    )


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


def test_plan_deletions_adopts_on_the_first_run():
    assert plan_deletions({"a.png", "b.png"}, set(), {"a.png"}, first_run=True) == {
        "b.png"
    }


def test_plan_deletions_only_deletes_managed_files():
    assert plan_deletions({"a.png", "b.png"}, {"a.png"}, {"a.png"}, first_run=False) == set()
    assert plan_deletions({"a.png", "b.png"}, {"a.png"}, {"c.png"}, first_run=False) == {
        "a.png"
    }


def test_apply_artwork_mirrors_and_writes_managed(tmp_path):
    art = tmp_path / "art"
    art.mkdir()
    (art / "stale.png").write_bytes(b"stale")
    manifests: list[Path] = []

    def render(print, dest):
        dest.write_bytes(b"new")

    result = apply_artwork([make_print("A")], art, render, manifests.append)

    assert (art / "A.png").read_bytes() == b"new"
    assert not (art / "stale.png").exists()
    assert json.loads((art / ".managed.json").read_text()) == ["A.png"]
    assert manifests == [art]
    assert result.rendered == 1
    assert result.deleted == ["stale.png"]


def test_apply_artwork_keeps_unmanaged_files(tmp_path):
    art = tmp_path / "art"
    art.mkdir()
    (art / ".managed.json").write_text('["old.png"]\n')
    (art / "old.png").write_bytes(b"old")
    (art / "keep.png").write_bytes(b"keep")

    apply_artwork([make_print("A")], art, lambda p, d: d.write_bytes(b"x"), lambda d: None)

    assert (art / "keep.png").exists()
    assert not (art / "old.png").exists()


def test_apply_artwork_render_failure_leaves_the_folder_unchanged(tmp_path):
    art = tmp_path / "art"
    art.mkdir()
    (art / "old.png").write_bytes(b"old")
    (art / ".managed.json").write_text('["old.png"]\n')
    manifests: list[Path] = []

    def render(print, dest):
        raise RuntimeError("boom")

    result = apply_artwork([make_print("A")], art, render, manifests.append)

    assert (art / "old.png").exists()
    assert result.rendered == 0
    assert result.failures
    assert manifests == [art]


def test_apply_artwork_noop_rerun_is_byte_identical(tmp_path):
    art = tmp_path / "art"
    manifests: list[Path] = []

    def render(print, dest):
        dest.write_bytes(b"same")

    apply_artwork([make_print("A")], art, render, manifests.append)
    before = {p.name: p.read_bytes() for p in art.iterdir()}
    apply_artwork([make_print("A")], art, render, manifests.append)
    after = {p.name: p.read_bytes() for p in art.iterdir()}

    assert before == after


def test_sync_deploys_when_art_is_active(tmp_path):
    list_path = tmp_path / "prints.toml"
    list_path.write_text('prints = ["RP-P-1956-733"]\n')
    calls: list[str] = []
    lines: list[str] = []

    sync(
        list_path,
        all_fixtures_fetch(),
        tmp_path / "art",
        lambda p, d: d.write_bytes(b"x"),
        lambda d: None,
        "art",
        True,
        deploy_fn=lambda: calls.append("refresh"),
        out=lines.append,
    )

    assert calls == ["refresh"]
    assert any("deploy" in line for line in lines)


def test_sync_stages_when_photos_is_active(tmp_path):
    list_path = tmp_path / "prints.toml"
    list_path.write_text('prints = ["RP-P-1956-733"]\n')
    calls: list[str] = []
    lines: list[str] = []

    sync(
        list_path,
        all_fixtures_fetch(),
        tmp_path / "art",
        lambda p, d: d.write_bytes(b"x"),
        lambda d: None,
        "photos",
        True,
        deploy_fn=lambda: calls.append("refresh"),
        out=lines.append,
    )

    assert calls == []
    assert any("staged" in line for line in lines)


def test_sync_does_not_deploy_with_no_deploy(tmp_path):
    list_path = tmp_path / "prints.toml"
    list_path.write_text('prints = ["RP-P-1956-733"]\n')
    calls: list[str] = []
    lines: list[str] = []

    sync(
        list_path,
        all_fixtures_fetch(),
        tmp_path / "art",
        lambda p, d: d.write_bytes(b"x"),
        lambda d: None,
        "art",
        False,
        deploy_fn=lambda: calls.append("refresh"),
        out=lines.append,
    )

    assert calls == []
    assert any("staged" in line for line in lines)


def test_sync_returns_nonzero_when_a_render_fails(tmp_path):
    list_path = tmp_path / "prints.toml"
    list_path.write_text('prints = ["RP-P-1956-733"]\n')

    def render(print, dest):
        raise RuntimeError("boom")

    code = sync(
        list_path,
        all_fixtures_fetch(),
        tmp_path / "art",
        render,
        lambda d: None,
        "photos",
        True,
        deploy_fn=lambda: None,
        out=lambda line: None,
    )

    assert code != 0
