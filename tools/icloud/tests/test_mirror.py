import json
from dataclasses import dataclass
from pathlib import Path

from sync_favorites import (
    MANAGED_NAME,
    apply_artwork,
    plan_deletions,
    read_managed,
    write_managed,
)


@dataclass
class FakePhoto:
    uuid: str


def pngs(folder: Path) -> set[str]:
    return {p.name for p in folder.iterdir() if p.suffix == ".png"}


def make_prepare(log):
    def prepare_one(photo, dest: Path):
        dest.write_bytes(b"png:" + photo.uuid.encode())
        log.append((photo.uuid, dest.name))

    return prepare_one


def make_manifest(log):
    def regenerate(folder: Path):
        log.append(("manifest", folder))
        (folder / "manifest.json").write_text(json.dumps(sorted(pngs(folder))) + "\n")

    return regenerate


# --- plan_deletions ---------------------------------------------------------


def test_first_run_deletes_unmanaged_pngs_not_selected():
    deletions = plan_deletions(
        existing={"a.png", "b.png", "family.png"},
        managed=set(),
        current={"a.png"},
        first_run=True,
    )
    assert deletions == {"b.png", "family.png"}


def test_subsequent_run_deletes_only_managed_stale_files():
    deletions = plan_deletions(
        existing={"a.png", "b.png", "family.png"},
        managed={"a.png", "b.png"},
        current={"a.png"},
        first_run=False,
    )
    assert deletions == {"b.png"}


def test_subsequent_run_leaves_unmanaged_files_alone():
    deletions = plan_deletions(
        existing={"a.png", "family.png"},
        managed={"a.png"},
        current={"a.png"},
        first_run=False,
    )
    assert deletions == set()


def test_noop_when_managed_equals_current():
    assert plan_deletions({"a.png"}, {"a.png"}, {"a.png"}, first_run=False) == set()


# --- managed state ----------------------------------------------------------


def test_managed_state_round_trips(tmp_path):
    write_managed(tmp_path, {"b.png", "a.png"})
    assert (tmp_path / MANAGED_NAME).read_text() == json.dumps(["a.png", "b.png"]) + "\n"
    assert read_managed(tmp_path) == {"a.png", "b.png"}


def test_read_managed_absent_is_empty(tmp_path):
    assert read_managed(tmp_path) == set()


# --- apply_artwork ----------------------------------------------------------


def test_first_run_adopts_folder_and_writes_manifest(tmp_path):
    (tmp_path / "family.png").write_bytes(b"old")
    (tmp_path / "old.png").write_bytes(b"old")
    log = []
    result = apply_artwork(
        photos=[FakePhoto("uuid-a")],
        artwork_dir=tmp_path,
        prepare_one=make_prepare(log),
        regenerate_manifest=make_manifest(log),
    )
    assert pngs(tmp_path) == {"uuid-a.png"}
    assert result.deleted == ["family.png", "old.png"]
    assert read_managed(tmp_path) == {"uuid-a.png"}
    assert log[-1][0] == "manifest"


def test_subsequent_run_keeps_unmanaged_and_deletes_managed_stale(tmp_path):
    write_managed(tmp_path, {"uuid-a.png", "uuid-b.png"})
    for name in ("uuid-a.png", "uuid-b.png", "family.png"):
        (tmp_path / name).write_bytes(b"x")
    log = []
    result = apply_artwork(
        photos=[FakePhoto("uuid-a")],
        artwork_dir=tmp_path,
        prepare_one=make_prepare(log),
        regenerate_manifest=make_manifest(log),
    )
    assert pngs(tmp_path) == {"uuid-a.png", "family.png"}
    assert result.deleted == ["uuid-b.png"]
    assert read_managed(tmp_path) == {"uuid-a.png"}


def test_prepare_writes_uuid_named_files(tmp_path):
    log = []
    apply_artwork(
        photos=[FakePhoto("uuid-a"), FakePhoto("uuid-b")],
        artwork_dir=tmp_path,
        prepare_one=make_prepare(log),
        regenerate_manifest=make_manifest([]),
    )
    assert sorted(name for _, name in log) == ["uuid-a.png", "uuid-b.png"]
    assert (tmp_path / "uuid-a.png").read_bytes() == b"png:uuid-a"


def test_dry_run_writes_nothing_and_plans_deletions(tmp_path):
    (tmp_path / "family.png").write_bytes(b"old")
    log = []
    result = apply_artwork(
        photos=[FakePhoto("uuid-a")],
        artwork_dir=tmp_path,
        prepare_one=make_prepare(log),
        regenerate_manifest=make_manifest(log),
        dry_run=True,
    )
    assert pngs(tmp_path) == {"family.png"}
    assert not (tmp_path / MANAGED_NAME).exists()
    assert not (tmp_path / "manifest.json").exists()
    assert log == []
    assert result.deleted == ["family.png"]
    assert result.dry_run is True


def test_empty_selection_mirrors_to_empty(tmp_path):
    write_managed(tmp_path, {"uuid-a.png"})
    (tmp_path / "uuid-a.png").write_bytes(b"x")
    log = []
    result = apply_artwork(
        photos=[],
        artwork_dir=tmp_path,
        prepare_one=make_prepare(log),
        regenerate_manifest=make_manifest(log),
    )
    assert pngs(tmp_path) == set()
    assert result.deleted == ["uuid-a.png"]
    assert read_managed(tmp_path) == set()