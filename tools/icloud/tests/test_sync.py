import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from sync_favorites import Config, SyncResult, exit_code, manifest_writer, summarize, sync


@dataclass
class FakePhoto:
    uuid: str
    date: datetime
    favorite: bool = True
    ismovie: bool = False


class FakeDB:
    def __init__(self, photos):
        self._photos = list(photos)

    def photos(self):
        return list(self._photos)


def dt(day: int) -> datetime:
    return datetime(2026, 1, day, tzinfo=timezone.utc)


def cfg(tmp_path, top_n=50, dry_run=False) -> Config:
    return Config(
        artwork_dir=tmp_path,
        dest=None,
        library=None,
        top_n=top_n,
        interval_h=6,
        dry_run=dry_run,
    )


def test_sync_selects_top_n_and_prepares_them(tmp_path):
    db = FakeDB([FakePhoto(f"u{i}", dt(i)) for i in range(1, 6)])

    def prepare_one(photo, dest):
        Path(dest).write_bytes(b"png")

    result = sync(cfg(tmp_path, top_n=2), db, prepare_one, regenerate_manifest=lambda folder: None)

    assert result.prepared == 2
    assert {p.name for p in tmp_path.iterdir() if p.suffix == ".png"} == {"u5.png", "u4.png"}


def test_exit_code_nonzero_when_any_photo_failed():
    ok = SyncResult(prepared=3, kept=[], deleted=[], dry_run=False)
    bad = SyncResult(prepared=2, kept=[], deleted=[], dry_run=False, failures=[("x", "boom")])
    assert exit_code(ok) == 0
    assert exit_code(bad) == 1


def test_summarize_reports_counts_and_failures():
    result = SyncResult(
        prepared=2, kept=["a.png", "b.png"], deleted=["c.png"], dry_run=False, failures=[("x", "boom")]
    )
    text = summarize(result)
    assert "prepared=2" in text
    assert "deleted=1" in text
    assert "failures=1" in text


def test_summarize_marks_dry_run():
    result = SyncResult(prepared=0, kept=[], deleted=["c.png"], dry_run=True)
    assert "dry-run" in summarize(result)


def test_manifest_writer_calls_generate_manifest_with_dir(tmp_path):
    calls = []
    regenerate = manifest_writer(
        script=Path("/repo/tools/epaper/generate_manifest.py"),
        run_fn=calls.append,
    )
    regenerate(Path("/art"))

    assert calls[0][0] == sys.executable
    assert calls[0][1] == "/repo/tools/epaper/generate_manifest.py"
    assert calls[0][2:] == ["--dir", "/art"]