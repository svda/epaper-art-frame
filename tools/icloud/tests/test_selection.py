from dataclasses import dataclass
from datetime import datetime, timezone

from sync_favorites import select_favorites


@dataclass
class FakePhoto:
    uuid: str
    date: datetime | None
    favorite: bool = True
    ismovie: bool = False


class FakeDB:
    def __init__(self, photos):
        self._photos = list(photos)

    def photos(self):
        return list(self._photos)


def dt(day: int) -> datetime:
    return datetime(2026, 1, day, tzinfo=timezone.utc)


def test_excludes_non_favorites():
    db = FakeDB([FakePhoto("a", dt(1), favorite=True), FakePhoto("b", dt(2), favorite=False)])
    assert [p.uuid for p in select_favorites(db, 50)] == ["a"]


def test_excludes_movies_even_when_favorited():
    db = FakeDB([FakePhoto("a", dt(1)), FakePhoto("m", dt(3), ismovie=True)])
    assert [p.uuid for p in select_favorites(db, 50)] == ["a"]


def test_orders_by_capture_date_newest_first():
    db = FakeDB([FakePhoto("old", dt(1)), FakePhoto("new", dt(9)), FakePhoto("mid", dt(5))])
    assert [p.uuid for p in select_favorites(db, 50)] == ["new", "mid", "old"]


def test_caps_at_top_n():
    db = FakeDB([FakePhoto(f"p{i}", dt(i)) for i in range(1, 11)])
    picked = select_favorites(db, 3)
    assert [p.uuid for p in picked] == ["p10", "p9", "p8"]


def test_returns_all_when_fewer_than_top_n():
    db = FakeDB([FakePhoto("a", dt(1)), FakePhoto("b", dt(2))])
    assert len(select_favorites(db, 50)) == 2


def test_empty_library_returns_empty():
    assert select_favorites(FakeDB([]), 50) == []


def test_ties_on_date_are_broken_deterministically_by_uuid_ascending():
    db = FakeDB([FakePhoto("b", dt(5)), FakePhoto("a", dt(5)), FakePhoto("c", dt(5))])
    assert [p.uuid for p in select_favorites(db, 50)] == ["a", "b", "c"]


def test_undated_photos_sort_last():
    db = FakeDB([FakePhoto("none", None), FakePhoto("dated", dt(1))])
    assert [p.uuid for p in select_favorites(db, 50)] == ["dated", "none"]