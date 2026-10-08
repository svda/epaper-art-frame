from dataclasses import dataclass, field
from datetime import datetime, timezone

from sync_album import select_album

ALBUM = "epaper art frame"


@dataclass
class FakePhoto:
    uuid: str
    date: datetime | None
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


def test_selects_all_photos_in_the_album():
    db = FakeDB([FakePhoto("a", dt(1)), FakePhoto("b", dt(2))])
    assert [p.uuid for p in select_album(db, ALBUM)] == ["b", "a"]


def test_excludes_photos_not_in_the_album():
    db = FakeDB([FakePhoto("in", dt(1)), FakePhoto("out", dt(2), albums=["other"])])
    assert [p.uuid for p in select_album(db, ALBUM)] == ["in"]


def test_excludes_movies():
    db = FakeDB([FakePhoto("a", dt(1)), FakePhoto("m", dt(3), ismovie=True)])
    assert [p.uuid for p in select_album(db, ALBUM)] == ["a"]


def test_orders_by_capture_date_newest_first():
    db = FakeDB([FakePhoto("old", dt(1)), FakePhoto("new", dt(9)), FakePhoto("mid", dt(5))])
    assert [p.uuid for p in select_album(db, ALBUM)] == ["new", "mid", "old"]


def test_returns_all_photos_no_cap():
    db = FakeDB([FakePhoto(f"p{i}", dt(i)) for i in range(1, 11)])
    assert len(select_album(db, ALBUM)) == 10


def test_empty_album_returns_empty():
    assert select_album(FakeDB([]), ALBUM) == []


def test_ties_on_date_broken_deterministically_by_uuid_ascending():
    db = FakeDB([FakePhoto("b", dt(5)), FakePhoto("a", dt(5)), FakePhoto("c", dt(5))])
    assert [p.uuid for p in select_album(db, ALBUM)] == ["a", "b", "c"]


def test_undated_photos_sort_last():
    db = FakeDB([FakePhoto("none", None), FakePhoto("dated", dt(1))])
    assert [p.uuid for p in select_album(db, ALBUM)] == ["dated", "none"]
