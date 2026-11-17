"""Resolve a Rijksmuseum object number into a renderable print, or a skip reason.

The pure layer: every function takes already-fetched JSON, so the tests run against
recorded fixtures with no network. The HTTP fetcher lives in ``sync_prints.py``.
"""
from __future__ import annotations

import hashlib
import json
import re
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

# How many objects may share a number prefix before the ambiguity is given up
# on instead of paged through one object at a time. Real collisions in the
# curated sets reach 59 (NG-1986-5-5); a prefix shared by hundreds
# (RP-F-2019-299-6-6 matches 166) is still not worth 166 requests. The measure
# is the search's totalItems, not the size of the returned page.
MAX_AMBIGUOUS_CANDIDATES = 100


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


def rights_of(visual_item: dict) -> str:
    """The object's rights label: 'PD'/'CC0' when public domain, else its own term.

    Nothing is skipped on rights: the Rijksmuseum's IIIF service serves every
    object, and this frame is a private, non-commercial display. The label is
    surfaced in the dry-run so the status stays visible.
    """
    labels: list[str] = []
    for subject in _as_list(visual_item.get("subject_to")):
        for cls in _as_list(subject.get("classified_as")):
            cid = cls.get("id", "")
            for prefix, label in ACCEPTED_RIGHTS.items():
                if prefix in cid:
                    return label
            labels.append(cls.get("_label") or cid.rsplit("/", 1)[-1])
    return labels[0] if labels and labels[0] else "unknown"


def _resolve_object(object_number: str, obj: dict, fetch: Fetch) -> Print | Skip:
    shows = _as_list(obj.get("shows"))
    if not shows:
        return Skip(object_number, "no-image")
    visual = fetch(shows[0]["id"])

    rights = rights_of(visual)

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


def _identifiers(obj: dict) -> list[str]:
    """Every identifier the record carries (its object number among them)."""
    return [
        item["content"]
        for item in _as_list(obj.get("identified_by"))
        if item.get("type") == "Identifier" and item.get("content")
    ]


def _total_items(search: dict) -> int:
    """How many objects the search matched, pages included."""
    total = (search.get("partOf") or {}).get("totalItems")
    if isinstance(total, int):
        return total
    return len(_as_list(search.get("orderedItems")))


def resolve(object_number: str, fetch: Fetch) -> Print | Skip:
    query = urllib.parse.urlencode({"objectNumber": object_number})
    search = fetch(f"{SEARCH_URL}?{query}")
    ids = [item["id"] for item in _as_list(search.get("orderedItems"))]
    if not ids:
        return Skip(object_number, "not-found")
    if len(ids) == 1:
        return _resolve_object(object_number, fetch(ids[0]), fetch)
    # The search matches prefixes as well as exact numbers (SK-A-4 also finds
    # SK-A-400...), so with a few hits only the record whose own identifier
    # equals the set member is the right one. A prefix shared by many objects
    # is not worth paging through: it stays skipped rather than costing a
    # request per candidate.
    if _total_items(search) > MAX_AMBIGUOUS_CANDIDATES:
        return Skip(object_number, "ambiguous")
    for object_id in ids:
        obj = fetch(object_id)
        if object_number in _identifiers(obj):
            return _resolve_object(object_number, obj, fetch)
    return Skip(object_number, "ambiguous")


SET_PAGE = "https://www.rijksmuseum.nl/{culture}/collectie/verzameling/{set_id}"
OBJECT_NUMBER = re.compile(r'"((?:SK|RP|BK|AK|NG|KOG)-[A-Z0-9.-]+)"')


def set_members(set_id: str, culture: str, fetch_text) -> list[str]:
    """Object numbers in a Rijksstudio set, in the set's order.

    The set page is public; its Nuxt payload embeds the items. No API key is
    needed. Only numbers are taken: the payload is a flat string table shared by
    every item, so a positional "title" belongs to whichever item happens to own
    it, not to the member. `resolve` disambiguates by identifier instead.
    """
    url = SET_PAGE.format(culture=culture, set_id=set_id)
    html = fetch_text(url)
    members: list[str] = []
    seen: set[str] = set()
    for match in OBJECT_NUMBER.finditer(html):
        number = match.group(1)
        if number not in seen:
            seen.add(number)
            members.append(number)
    if not members:
        raise ValueError(f"Rijksstudio set '{set_id}' is empty or not found")
    return members


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

    def get_text(self, url: str) -> str:
        # Always live. The only text fetch is a Rijksstudio set page, and the
        # point of running the sync is to pick up changes to the set — a cached
        # page turns "add objects, run the sync" into a silent no-op. The body
        # is still written to the cache for inspection.
        body = self._request(url).decode("utf-8", errors="replace")
        path = self._cache_path(url, "text", "html")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(body)
        return body

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
