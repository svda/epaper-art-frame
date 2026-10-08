import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from sync_album import Config, SyncResult, exit_code, manifest_writer, summarize, sync

ALBUM = "epaper art frame"


@dataclass
class FakePhoto:
    uuid: str
    date: datetime
    albums: list[str] = field(default_factory=lambda: [ALBUM])
    ismovie: bool = False


class FakeDB:
    def __init__(self, photos):
        self._photos = list(photos)

    def photos(self, albums=None):
        if albums is None:
            return list(self._photos)
        wanted = set(albums)
        return [p for p in self._photos if wanted & set(p.albums)]


def dt(day: int) -> datetime:
    return datetime(2026, 1, day, tzinfo=timezone.utc)


def cfg(tmp_path, album=ALBUM, dry_run=False) -> Config:
    return Config(
        artwork_dir=tmp_path,
        dest=None,
        library=None,
        album=album,
        interval_h=6,
        dry_run=dry_run,
    )


def test_sync_prepares_all_album_photos(tmp_path):
    db = FakeDB([FakePhoto(f"u{i}", dt(i)) for i in range(1, 6)])

    def prepare_one(photo, dest):
        Path(dest).write_bytes(b"png")

    result = sync(cfg(tmp_path), db, prepare_one, regenerate_manifest=lambda folder: None)

    assert result.prepared == 5
    assert {p.name for p in tmp_path.iterdir() if p.suffix == ".png"} == {
        f"u{i}.png" for i in range(1, 6)
    }


def test_sync_requires_an_album(tmp_path):
    db = FakeDB([FakePhoto("u1", dt(1))])
    try:
        sync(cfg(tmp_path, album=None), db, lambda p, d: None, lambda folder: None)
    except RuntimeError as exc:
        assert "album" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected RuntimeError for a missing album")


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
