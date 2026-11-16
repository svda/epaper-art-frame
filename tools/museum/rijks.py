"""Resolve a Rijksmuseum object number into a renderable print, or a skip reason.

The pure layer: every function takes already-fetched JSON, so the tests run against
recorded fixtures with no network. The HTTP fetcher lives in ``sync_prints.py``.
"""
from __future__ import annotations

import hashlib
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

SEARCH_URL = "https://data.rijksmuseum.nl/search/collection"
ENGLISH = "http://vocab.getty.edu/aat/300388277"
NAME_TYPE = "http://vocab.getty.edu/aat/300435417"
ACCEPTED_RIGHTS = {
    "creativecommons.org/publicdomain/mark/": "PD",
    "creativecommons.org/publicdomain/zero/": "CC0",
}
TYPE_LABELS = {
    "https://id.rijksmuseum.nl/2208": "painting",
    "https://id.rijksmuseum.nl/220363": "drawing",
    "https://id.rijksmuseum.nl/220951": "photograph",
    "https://id.rijksmuseum.nl/22040": "print",
    "https://id.rijksmuseum.nl/2203113": "poster",
}

Fetch = Callable[[str], dict]


@dataclass(frozen=True)
class Print:
    object_number: str
    title: str
    artist: str
    date: str
    rights: str
    type: str
    width: int
    height: int
    image_url: str


@dataclass(frozen=True)
class Skip:
    object_number: str
    reason: str


def _as_list(value) -> list:
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _names(obj: dict) -> list[dict]:
    return [
        n
        for n in _as_list(obj.get("identified_by"))
        if n.get("type") == "Name" and n.get("content")
    ]


def title_of(obj: dict) -> str:
    """The English title when the record has one, else the first title, else Untitled."""
    names = _names(obj)
    for name in names:
        langs = [lang.get("id") for lang in _as_list(name.get("language"))]
        if ENGLISH in langs:
            return name["content"]
    if names:
        return names[0]["content"]
    return obj.get("_label") or "Untitled"


def _strip_qualifier(name: str) -> str:
    for suffix in (" (mentioned on object)", " (vermeld op object)"):
        name = name.replace(suffix, "")
    return name.strip()


def artists_of(obj: dict) -> list[str]:
    """Creator names, preferring the record's name field over the production roles.

    The Rijksmuseum puts the artist in ``referred_to_by`` (AAT 300435417) and the
    publisher/printer in ``carried_out_by``. Preferring the name field keeps the
    publisher off the placard.
    """
    prod = obj.get("produced_by") or {}
    parts = _as_list(prod.get("part"))
    names: list[str] = []
    for part in [prod] + parts:
        for ref in _as_list(part.get("referred_to_by")):
            classes = [c.get("id") for c in _as_list(ref.get("classified_as"))]
            if NAME_TYPE in classes and ref.get("content"):
                names.append(_strip_qualifier(ref["content"]))
    if not names:
        for part in [prod] + parts:
            for creator in _as_list(part.get("carried_out_by")):
                label = creator.get("_label")
                if not label:
                    label = next(
                        (
                            n.get("@value")
                            for n in _as_list(creator.get("notation"))
                            if n.get("@value")
                        ),
                        None,
                    )
                if label:
                    names.append(label)
    seen: set[str] = set()
    out: list[str] = []
    for name in names:
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def date_of(obj: dict) -> str:
    prod = obj.get("produced_by") or {}
    timespans = _as_list(prod.get("timespan"))
    timespan = timespans[0] if timespans else {}
    for name in _as_list(timespan.get("identified_by")):
        if name.get("content"):
            return name["content"]
    return timespan.get("begin_of_the_begin") or ""


def type_of(obj: dict) -> str:
    for cls in _as_list(obj.get("classified_as")):
        cid = cls.get("id", "")
        if cid in TYPE_LABELS:
            return TYPE_LABELS[cid]
        if cid:
            return cid.rsplit("/", 1)[-1]
    return "unknown"


def rights_of(visual_item: dict) -> str | None:
    """'PD' or 'CC0' from the VisualItem's own rights block; None means skip it."""
    for subject in _as_list(visual_item.get("subject_to")):
        for cls in _as_list(subject.get("classified_as")):
            cid = cls.get("id", "")
            for prefix, label in ACCEPTED_RIGHTS.items():
                if prefix in cid:
                    return label
    return None


def resolve(object_number: str, fetch: Fetch) -> Print | Skip:
    query = urllib.parse.urlencode({"objectNumber": object_number})
    search = fetch(f"{SEARCH_URL}?{query}")
    ids = [item["id"] for item in _as_list(search.get("orderedItems"))]
    if not ids:
        return Skip(object_number, "not-found")
    if len(ids) > 1:
        return Skip(object_number, "ambiguous")

    obj = fetch(ids[0])
    shows = _as_list(obj.get("shows"))
    if not shows:
        return Skip(object_number, "no-image")
    visual = fetch(shows[0]["id"])

    rights = rights_of(visual)
    if rights is None:
        return Skip(object_number, "rights")

    digital_ids = _as_list(visual.get("digitally_shown_by"))
    if not digital_ids:
        return Skip(object_number, "no-image")
    digital = fetch(digital_ids[0]["id"])
    access = _as_list(digital.get("access_point"))
    if not access:
        return Skip(object_number, "no-image")
    base = access[0]["id"].split("/full/")[0]

    info = fetch(base + "/info.json")
    width, height = info.get("width"), info.get("height")
    if not width or not height:
        return Skip(object_number, "no-image")
    if height > width:
        return Skip(object_number, "portrait")

    return Print(
        object_number=object_number,
        title=title_of(obj),
        artist=", ".join(artists_of(obj)) or "Anonymous",
        date=date_of(obj),
        rights=rights,
        type=type_of(obj),
        width=width,
        height=height,
        image_url=f"{base}/full/!1600,1600/0/default.jpg",
    )


SET_URL = "https://www.rijksmuseum.nl/api/{culture}/usersets/{set_id}"


def set_members(set_id: str, culture: str, key: str, fetch: Fetch) -> list[str]:
    """Object numbers in a Rijksstudio set, in the set's order."""
    if not key:
        raise ValueError("RIJKSMUSEUM_API_KEY is not set")
    url = SET_URL.format(culture=culture, set_id=set_id)
    query = urllib.parse.urlencode({"key": key, "format": "json"})
    data = fetch(f"{url}?{query}")
    user_set = data.get("userSet") or {}
    items = user_set.get("setItems") or []
    numbers = [item["objectNumber"] for item in items if item.get("objectNumber")]
    if not numbers:
        raise ValueError(f"Rijksstudio set '{set_id}' is empty or not found")
    return numbers


HEADERS = {
    "User-Agent": "epaper-art-frame/print-wall",
    "Accept": "application/json",
}


class Fetcher:
    """HTTP with a disk cache, polite spacing, and retry on 429/5xx."""

    def __init__(
        self,
        cache_dir: Path,
        *,
        refresh: bool = False,
        opener=urllib.request.urlopen,
        sleep=time.sleep,
        clock=time.monotonic,
        min_interval: float = 0.25,
        retries: int = 3,
    ) -> None:
        self.cache_dir = Path(cache_dir)
        self.refresh = refresh
        self.opener = opener
        self.sleep = sleep
        self.clock = clock
        self.min_interval = min_interval
        self.retries = retries
        self._last: float | None = None

    def _cache_path(self, url: str, kind: str, suffix: str) -> Path:
        digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
        return self.cache_dir / kind / f"{digest}.{suffix}"

    def _throttle(self) -> None:
        if self._last is not None:
            wait = self.min_interval - (self.clock() - self._last)
            if wait > 0:
                self.sleep(wait)
        self._last = self.clock()

    def _request(self, url: str) -> bytes:
        request = urllib.request.Request(url, headers=HEADERS)
        for attempt in range(self.retries + 1):
            self._throttle()
            try:
                with self.opener(request) as response:
                    return response.read()
            except urllib.error.HTTPError as exc:
                retryable = exc.code == 429 or 500 <= exc.code < 600
                if not retryable or attempt >= self.retries:
                    raise
                self.sleep(0.5 * (2**attempt))
        raise RuntimeError("unreachable")

    def get_json(self, url: str) -> dict:
        path = self._cache_path(url, "json", "json")
        if path.exists() and not self.refresh:
            return json.loads(path.read_text())
        data = json.loads(self._request(url))
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data))
        return data

    def download(self, url: str, dest: Path) -> Path:
        path = self._cache_path(url, "images", "bin")
        if path.exists() and not self.refresh:
            body = path.read_bytes()
        else:
            body = self._request(url)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        return dest
