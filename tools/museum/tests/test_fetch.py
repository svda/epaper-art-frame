from __future__ import annotations

import urllib.error

import pytest

from rijks import Fetcher


class FakeResponse:
    def __init__(self, body: bytes, status: int = 200):
        self._body = body
        self.status = status

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def make_fetcher(tmp_path, opener, *, refresh=False):
    sleeps: list[float] = []
    now = [0.0]

    def clock() -> float:
        return now[0]

    def sleep(seconds: float) -> None:
        sleeps.append(seconds)
        now[0] += seconds

    fetcher = Fetcher(
        tmp_path, refresh=refresh, opener=opener, sleep=sleep, clock=clock
    )
    return fetcher, sleeps


def test_cache_hit_makes_no_request(tmp_path):
    calls: list[str] = []

    def opener(request):
        calls.append(request.full_url)
        return FakeResponse(b'{"ok": true}')

    fetcher, _ = make_fetcher(tmp_path, opener)
    assert fetcher.get_json("https://example.test/x") == {"ok": True}
    assert fetcher.get_json("https://example.test/x") == {"ok": True}
    assert len(calls) == 1


def test_text_is_always_fetched_live(tmp_path):
    calls: list[str] = []

    def opener(request):
        calls.append(request.full_url)
        return FakeResponse(b"<html></html>")

    fetcher, _ = make_fetcher(tmp_path, opener)
    fetcher.get_text("https://example.test/set")
    fetcher.get_text("https://example.test/set")
    assert len(calls) == 2


def test_refresh_bypasses_cache(tmp_path):
    calls: list[str] = []

    def opener(request):
        calls.append(request.full_url)
        return FakeResponse(b'{"ok": true}')

    fetcher, _ = make_fetcher(tmp_path, opener, refresh=True)
    fetcher.get_json("https://example.test/x")
    fetcher.get_json("https://example.test/x")
    assert len(calls) == 2


def test_retries_on_429_then_succeeds(tmp_path):
    calls: list[str] = []

    def opener(request):
        calls.append(request.full_url)
        if len(calls) < 3:
            raise urllib.error.HTTPError(
                request.full_url, 429, "Too Many Requests", {}, None
            )
        return FakeResponse(b'{"ok": true}')

    fetcher, sleeps = make_fetcher(tmp_path, opener)
    assert fetcher.get_json("https://example.test/x") == {"ok": True}
    assert len(calls) == 3
    assert len(sleeps) >= 2


def test_404_is_not_retried(tmp_path):
    calls: list[str] = []

    def opener(request):
        calls.append(request.full_url)
        raise urllib.error.HTTPError(request.full_url, 404, "Not Found", {}, None)

    fetcher, _ = make_fetcher(tmp_path, opener)
    with pytest.raises(urllib.error.HTTPError):
        fetcher.get_json("https://example.test/x")
    assert len(calls) == 1


def test_requests_are_spaced(tmp_path):
    def opener(request):
        return FakeResponse(b"{}")

    fetcher, sleeps = make_fetcher(tmp_path, opener)
    fetcher.get_json("https://example.test/a")
    fetcher.get_json("https://example.test/b")
    assert sleeps and sleeps[-1] >= 0.25


def test_download_caches_the_body(tmp_path):
    calls: list[str] = []

    def opener(request):
        calls.append(request.full_url)
        return FakeResponse(b"image-bytes")

    fetcher, _ = make_fetcher(tmp_path, opener)
    first = tmp_path / "a.jpg"
    second = tmp_path / "b.jpg"
    fetcher.download("https://example.test/img", first)
    fetcher.download("https://example.test/img", second)
    assert first.read_bytes() == b"image-bytes"
    assert second.read_bytes() == b"image-bytes"
    assert len(calls) == 1
