# Spec: Print Wall

Status: **approved** (2026-11-15) · Revision 7 (2026-11-15: no type allowlist — the hand-picked list is the scope)
Slug: `print-wall`

> **What this adds.** An **art mode** for the 13.3" Spectra 6 frame: a curated set of
> public-domain objects from the Rijksmuseum, each rendered with a gallery placard (title,
> artist, date), switchable against the existing photo rotation with one command. It is a
> new *source*, in the same shape as [`icloud-album-sync`](../icloud-album-sync/SPEC.md).
> It does not change the device. The 13" frame is specified in
> [`ee02-13in-spectra6`](../ee02-13in-spectra6/SPEC.md).
>
> **Source of intent:** the idea one-pager `docs/ideas/print-wall.md` (2026-11-14), which
> includes a dithering spike on six print techniques, plus a confirmed interview on
> 2026-11-15.

---

## Objective

Let the household's 13" frame hang **curated art** as well as photos. One manual command
fetches a hand-curated list of Rijksmuseum objects, renders each for the panel with a
placard below it, and, when art mode is active, deploys them to Home Assistant. The device
picks them up on its next daily wake. A second command switches the frame between **art**
and **photos**.

**The list is the scope.** Whatever object numbers are in `prints.toml` is what gets
fetched. There is no type allowlist: the hand-picked list is the filter, so prints,
paintings, drawings and photographs are all eligible. The name "Print Wall" is historical.

**Landscape only.** The panel is 1600×1200 landscape, so only images that are landscape or
square (`width ≥ height`) are used. Portrait images are skipped with a logged reason rather
than letterboxed into a narrow strip.

**The user** is the same household that runs the existing frames. They curate by copying
object numbers from rijksmuseum.nl into a text file.

**Success:** after editing the list and running one command, the frame shows those objects
with readable placards. Switching modes is one command. Nothing on the device changes, and
nothing about the 5.65" frame changes.

### The system

| Property | Value |
|---|---|
| Source | Rijksmuseum Linked Art Search API, `https://data.rijksmuseum.nl/search/collection`, no API key |
| Curation | Hand-picked **object numbers** (e.g. `RP-P-OB-12.345`) in `tools/museum/prints.toml` |
| Scope | **No type filter.** The hand-picked list is the scope; any object type the Rijksmuseum serves |
| Orientation | **Landscape or square only** (`width ≥ height`). Portrait images are skipped |
| Rights | Only objects whose own VisualItem rights are **Public Domain Mark** or **CC0** |
| Image | IIIF via `iiif.micr.io`, requested as `/full/!1600,1600/0/default.jpg` |
| Panel profile | New row `spectra6-133-art`: same panel, size and palette as `spectra6-133`, own `pre_filter` |
| Placard | White strip below a fitted (never cropped) print; title / artist / date; no credit line |
| Art folder | `www/epaper13-modes/art/` (the art sync is its only writer) |
| Photos folder | `www/epaper13-modes/photos/` (the album sync, via its existing `EPAPER_IMAGES` override) |
| Live folder | `www/epaper13/`; only `set_mode.sh` writes here; served at `/local/epaper13/` |
| Deploy | Existing `tools/epaper/push_to_ha.sh --profile spectra6-133`, unchanged |
| Trigger | Manual. No scheduling in this spec |
| Device | **Unchanged.** Index wraps modulo the manifest length, so a mode swap is safe |

---

## Confirmed decisions (from the interview)

- **One spec, four internal modules**, following the repo's existing specs. Capability map
  approved 2026-11-15 (below).
- **Done means a manual sync.** One command, then the frame shows art on its next wake.
  Scheduling is a later spec.
- **Curation by object number**, resolved through the API's `objectNumber` parameter.
- **No type allowlist** (2026-11-15). The hand-picked list is the scope. Prints, paintings,
  drawings and photographs are all eligible; the user curates out physical items and
  anything else they do not want. This supersedes the Revision 5 allowlist.
- **Landscape and square only** (2026-11-15). Portrait images are skipped, not letterboxed.
  Orientation comes from the IIIF `info.json`, so a portrait object costs one small request
  and no image download.
- **Placard as a strip below a fitted print**, like a museum mat. No overlay, no crop.
- **Art gets its own profile row** (`spectra6-133-art`). Its `pre_filter` is chosen by a
  before/after render during the build. The photo profile is not touched, and no script
  gets an `if`.
- **Mode switching publishes and deploys in one command** (`set_mode.sh art|photos`).
- **The art sync deploys only when art is the active mode.** Otherwise it stages the
  art and says so. It never switches the mode itself.
- **No new runtime dependencies.** Python stdlib (`urllib`, `json`, `tomllib`) plus
  ImageMagick, which the pipeline already requires.
- **No Rijksmuseum credit line** on the placard. PD/CC0 does not require one, and the strip
  stays cleaner.

---

## Assumptions

Each has a default. Correct any at review.

1. Python ≥ 3.11 (for `tomllib`), matching `tools/epaper`.
2. Placard font: macOS **Georgia** at `/System/Library/Fonts/Supplemental/Georgia.ttf`,
   overridable by config. The font is not bundled.
3. Placard text is **English where the record has it**, falling back to the record's
   `_label` (usually Dutch).
4. When no mode has been recorded yet, the active mode is **`photos`**, which is what the
   frame shows today.
5. The HA destination for the 13" frame comes from `EPAPER13_DEST`
   (`server:/srv/home-assistant/config/www/epaper13/`). It is separate from the 5.65"
   `EPAPER_DEST`.

---

## Dithering evidence (spikes, 2026-11-14 and 2026-11-15)

Two spikes, both rendered through `prepare_image.sh --profile spectra6-133 --fit`.

**Prints (2026-11-14):** six techniques, from colour lithograph to aquatint. Flat-colour
prints and woodcuts look good; tonal aquatint flattens. Prints are back in scope under
Revision 7.

**Paintings, drawings, photographs (2026-11-15):** six landscape, public-domain samples.

| Type | Result |
|---|---|
| Drawing (line) | **Good.** Line work and hatching survive; reads like a print. |
| Painting (colour field / pointillist) | **Good.** The dither texture is on-brand; colour survives. |
| Painting (tonal) | **Fair.** Form holds; subtle modelling flattens. |
| Photograph | **Weakest.** Coarse halftone; faces and fine detail muddy at 1:1, acceptable at wall distance. |

**Verdict:** the panel is kindest to line and flat-colour work (prints, drawings,
colour-field paintings) and harshest to tonal work (photographs, tonal paintings). The
hand-picked list is the filter, so curate accordingly.

---

## Curation workflow

The loop is manual by design. There is no search helper; query-driven discovery is a
non-goal.

1. **Find the object number** on rijksmuseum.nl — the last segment of the collection URL
   (e.g. `.../collection/SK-A-3089`), also printed on the object page.
2. **Add it** to `tools/museum/prints.toml`.
3. **Validate:** `sync_prints.py --dry-run` prints one line per entry with type, rights,
   orientation, and any skip reason. Read-only outside `.cache/`.
4. **Sync:** `sync_prints.py` fetches, renders, mirrors, and deploys if art is active.
5. **Show:** `set_mode.sh art` if the frame is not already in art mode.

The object-number lookup accepts the real formats, including dots and hyphens
(`SK-A-3089`, `RP-P-OB-205.689`, `RP-F-00-630`).

---

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `museum-source` | Read the curated list; resolve object number → object → VisualItem → DigitalObject; check rights; download the IIIF image; cache | — |
| `placard` | Turn a source image plus metadata into a palette-only 1600×1200 PNG with a placard strip | — (takes metadata as plain values) |
| `art-sync` | Orchestrate source → placard → staging → `www/epaper13-modes/art/` → manifest; deploy if art is active | `museum-source`, `placard`, `mode-switch` (only its publish entry point) |
| `mode-switch` | `set_mode.sh art\|photos\|--refresh`: publish a mode folder into `www/epaper13/`, record the mode, deploy; one-time migration of today's 13" photos | — |

Build order: `museum-source`, `placard`, `mode-switch` (independent) → `art-sync`.

The map approved at interview listed `mode-switch` last. `art-sync` calls
`set_mode.sh art` when art is active, so in practice `mode-switch` has to exist before
`art-sync` can finish. The arrows are unchanged and there is no cycle. Only the order
moved.

---

## Module 1 — `museum-source`

**Input:** `tools/museum/prints.toml`

```toml
# Objects for the 13" frame's art mode. Copy object numbers from rijksmuseum.nl.
# Order here is rotation order.
prints = [
  "RP-P-OB-12.345",
  "RP-P-1904-1234",
]
```

**Resolution, for each object number:**

1. `GET /search/collection?objectNumber=<n>` → exactly one `orderedItems[].id`. Zero or
   several matches is an error for that entry. Log it and skip the entry.
2. `GET <object id>` (with `Accept: application/json`) → title, creator, date,
   `classified_as`, and the `shows[0]` VisualItem.
3. `GET <VisualItem>` → rights from `subject_to[].classified_as[].id`, and
   `digitally_shown_by[0]`.
4. `GET <DigitalObject>` → `access_point[0].id`. Keep the base (everything before
   `/full/`).
5. `GET <base>/info.json` → `width`, `height`. If `height > width`, skip the entry with
   reason `portrait`. Otherwise build the image URL as
   `<base>/full/!1600,1600/0/default.jpg`.

**Rights rule.** Accept only `creativecommons.org/publicdomain/mark/` or
`creativecommons.org/publicdomain/zero/`. Anything else (CC BY, unknown, missing) means the
entry is skipped, with a logged reason. Search results never decide rights.

The IIIF endpoint also serves **In Copyright** (`InC/1.0`) images at full resolution, so
this rule is a deliberate policy choice, not an API constraint. The DigitalObject's
`referred_to_by` notes (`downloadbaar` / `niet downloadbaar`) are the museum's own flags;
the rights statement is authoritative.

**Orientation rule.** Accept only landscape or square images (`width ≥ height`). The check
uses the IIIF `info.json`, which is small and cached, so a portrait object costs one extra
request and no image download. Square is included: it fills the art area with small side
margins.

**Metadata returned** (a small dataclass):

| Field | Source | Fallback |
|---|---|---|
| `object_number` | the curated entry | — |
| `title` | English `identified_by` Name | `_label`, then `"Untitled"` |
| `artist` | `produced_by` → `carried_out_by[]._label`, joined with `", "` (including `part[]`) | `"Anonymous"` |
| `date` | `produced_by.timespan.identified_by[0].content` (display date) | year of `begin_of_the_begin`, then `""` |
| `rights` | `"PD"` or `"CC0"` | — (skipped) |
| `type` | `classified_as` | — (informational; not a filter) |
| `width`, `height` | IIIF `info.json` | — (skipped if portrait) |
| `image_path` | cached JPEG | — |

**Cache.** `tools/museum/.cache/` (git-ignored). The three JSON hops and the IIIF
`info.json` are stored by object number. Images are stored by IIIF id. A cached entry is
reused without any network call. `--refresh` bypasses the cache.

**Politeness.** Requests are sequential, at least 0.25 s apart, with a
`User-Agent: epaper-art-frame/print-wall`. HTTP 429 and 5xx are retried up to 3 times with
exponential backoff. Pagination is not needed, because each `objectNumber` lookup returns
a single page.

**Exit criteria:** `sync_prints.py --dry-run` prints one line per curated entry: object
number, title, artist, date, type, rights, orientation, and *ok* or a *skip reason*. It
writes nothing outside `.cache/`. A non-PD entry, an unknown object number, and a portrait
image each show up as a skip with a reason.

---

## Module 2 — `placard`

Turns `(image_path, title, artist, date)` into a 1600×1200 PNG that contains **only
palette colours**.

**Layout (1600×1200):**

```
┌──────────────────────────────────────────────┐
│                                              │
│      print, fitted (never cropped),          │  art area 1600 × 1056
│      centred on white                        │  (inset by a 40 px margin)
│                                              │
├──────────────────────────────────────────────┤
│  Title of the Print                          │  placard strip 1600 × 144
│  Artist Name, 1890                           │  white, 2 lines, left-aligned
└──────────────────────────────────────────────┘
```

**Pipeline**, which reuses `prepare_image.sh` unchanged:

1. **Compose** with `magick`: a 1600×1200 white canvas, with the source fitted into the art
   area (40 px margin) and the strip left blank white.
2. **Dither** with `prepare_image.sh --profile spectra6-133-art <composed> <out>`. The
   input is already 1600×1200, so the default cover mode is a no-op, and the white strip
   maps to palette white.
3. **Letter** with `magick`: render the two text lines in the configured font as
   **1-bit black on white** (`-monochrome` or a threshold, so there is no anti-alias grey
   to dither into speckle). Composite them onto the strip.
4. Line 1 is the title at about 40 px. Line 2 is `"<artist>, <date>"` (or just the artist
   when there is no date) at about 30 px. A line that overflows 1520 px is truncated with
   `…`.

**Profile row** added to `tools/epaper/profiles.json`:

```json
"spectra6-133-art": {
  "description": "Spectra 6 13.3\" (1600x1200) — prints / art mode",
  "width": 1600, "height": 1200, "colours": 6,
  "palette": "palette-spectra6.png",
  "artwork": "www/epaper13-modes/art",
  "ha_dir": "local/epaper13",
  "backend": "magick",
  "pre_filter": "<chosen by T-render; default empty>",
  "dither": "FloydSteinberg"
}
```

The art folder's name (`art`) does not match the HA folder's name (`epaper13`), so
`push_to_ha.sh`'s mismatch guard **refuses to deploy the art folder directly**. That is
deliberate. Only `set_mode.sh` deploys, and it does so from `www/epaper13/`.

Adding the row also updates `tools/epaper/tests/test_profile.py`, whose known-profile set
currently asserts exactly two profiles.

**Choosing `pre_filter`.** Render eight samples (2 prints, 2 paintings, 2 drawings, 2
photographs; PD and landscape) with (a) empty, (b) the photo filter `-modulate 95,160
-sigmoidal-contrast 4,50%`, and (c) one milder candidate. The user picks one. The choice
is recorded in the profile row's description and in this spec's Open Questions.

**Exit criteria:** for any input, the output is 1600×1200. Its unique colours are a subset
of `palette-spectra6.png`. Strip pixels are only black or white. The print is never
cropped. Title, artist and date read correctly on the panel from 1 m away.

---

## Module 3 — `mode-switch`

**`tools/museum/set_mode.sh art|photos`** (POSIX `sh`, matching `tools/epaper/*.sh`):

1. Validate the argument, and check that `www/epaper13-modes/<mode>/` exists and contains
   at least one PNG. If not, exit non-zero and leave the live folder untouched.
2. **Publish:** make `www/epaper13/` hold exactly that mode's PNGs (`rsync -a --delete
   --include='*.png' --exclude='*'`). The folder's `.gitignore` is preserved. No
   `.managed.json` lives in the live folder.
3. Regenerate the manifest last:
   `generate_manifest.py --profile spectra6-133 --dir www/epaper13`.
4. Record the mode: write `art` or `photos` to `www/epaper13-modes/ACTIVE`.
5. **Deploy:** `push_to_ha.sh --profile spectra6-133 "$EPAPER13_DEST"`. The existing
   script also deletes remote PNGs that are not in the manifest, so the HA host ends up
   holding only the active mode.

Options: `-n/--dry-run` prints the publish delta and the deploy plan and changes nothing.
`--no-deploy` publishes and records the mode but skips the push. `--refresh` republishes
and deploys whichever mode `ACTIVE` names, without changing the mode; it refuses if
`ACTIVE` is missing or names an empty mode.

**`set_mode.sh --status`** prints the active mode and the PNG count of each mode folder.

**One-time migration** (`set_mode.sh --migrate`): if `www/epaper13-modes/photos/` does not
exist, move today's `www/epaper13/*.png` and its `.managed.json` there, write
`ACTIVE=photos`, and publish without deploying. This must be idempotent: a second run is
a no-op. From then on, refreshing 13" photos means
`EPAPER_IMAGES=www/epaper13-modes/photos sync_album.py --profile spectra6-133 --dest
"$EPAPER13_DEST"`, then `set_mode.sh --refresh`. The `--dest` is required because
`tools/icloud/.env` points `EPAPER_DEST` at the 5.65" folder, and the deploy script's
folder-name check would reject it. The album sync's own push re-sends the live folder,
which is harmless; `--refresh` then republishes the photos folder. The album sync's code
does not change. Its README gets a note.

**Rotation position across a switch (accepted, 2026-11-15).** The device keeps **one**
persisted counter (`art_index` in `common/art-frame.yaml`) for every manifest and shows
image `art_index mod count`. A switch swaps the manifest, not the counter. So after a switch
the rotation starts wherever the shared counter lands and then continues normally. It does
**not** reset to the first image, and it does **not** resume the position the mode had
before. Example: on photo 12 of 37, switch to art. After some days the counter reaches 19.
Switching back to photos then shows photo 19, not 12. The mod keeps it in range, so it never
breaks, and the prev/next buttons work from wherever it lands. The device is asleep when
`set_mode.sh` runs, so the Mac cannot set the counter. Per-mode resume was considered and
rejected for this spec (Q8). `set_mode.sh` prints a one-line note about this after a switch,
and `tools/museum/README.md` documents it.

**Exit criteria:** `set_mode.sh art` and then `set_mode.sh photos` each leave
`www/epaper13/` and the HA folder holding exactly that mode's images, with a matching
manifest. The 5.65" `www/epaper/` is byte-identical before and after. The device shows the
new mode on its next wake, and the prev/next buttons work within it.

---

## Module 4 — `art-sync`

**`tools/museum/sync_prints.py`**, the one command:

1. Load `prints.toml`. Resolve every entry through `museum-source`. Skips are logged and
   are not fatal.
2. Render each resolved print through `placard` into a **staging dir**.
3. **Mirror** into `www/epaper13-modes/art/` using the album sync's semantics: a
   `.managed.json` of owned names, delete only files that were previously managed, and
   adopt the folder on the first run. Copy staged files in, then delete the stale ones.
4. Regenerate that folder's manifest last
   (`generate_manifest.py --profile spectra6-133-art`).
5. If `www/epaper13-modes/ACTIVE` reads `art`, call `set_mode.sh --refresh`, which
   republishes and deploys the active mode. Otherwise print `art staged (N objects); active
   mode is photos — run set_mode.sh art to show them` and exit 0.

**Filenames:** `<object number>.png`, sanitised to `[A-Za-z0-9._-]` (other characters
become `_`). Object numbers are stable, so re-runs are idempotent, and the names contain
no commas, quotes or `]` (the device's manifest parser needs that).

**Rotation order:** the order of `prints.toml`. *Known limit:* `generate_manifest.py`
writes a **sorted** list, so the device rotates by object number, not by list order. This
spec accepts that rather than changing the manifest writer. See Q4.

**Options:** `--dry-run` (resolve and report only), `--refresh` (bypass the cache),
`--no-deploy` (stage even when art is active), `--list PATH` (another curation file).

**Idempotence:** a run with no changes renders nothing new, leaves the art folder and its
manifest byte-identical, and makes no network calls when everything is cached.

**Exit criteria:** with `ACTIVE=art`, editing `prints.toml` and running `sync_prints.py`
puts exactly the PD/CC0 objects from the list, with placards, on the HA host. The frame
shows them on its next wake. With `ACTIVE=photos`, the same run changes only
`www/epaper13-modes/art/`.

---

## Commands

```
# Preview: resolve every curated print and show rights and skips. No writes outside .cache/
uv run --directory tools/museum python sync_prints.py --dry-run

# The one command: fetch, render, mirror; deploy if art mode is active
uv run --directory tools/museum python sync_prints.py

# Switch the 13" frame (publish + deploy); preview; status; republish the active mode
EPAPER13_DEST=server:/srv/home-assistant/config/www/epaper13/ tools/museum/set_mode.sh art
tools/museum/set_mode.sh photos
tools/museum/set_mode.sh --dry-run art
tools/museum/set_mode.sh --status
tools/museum/set_mode.sh --refresh

# One-time: move today's 13" photos into their mode folder
tools/museum/set_mode.sh --migrate

# Refresh 13" photos after the migration (existing tool, existing override)
EPAPER_IMAGES=www/epaper13-modes/photos \
  tools/icloud/.venv/bin/python tools/icloud/sync_album.py --profile spectra6-133 \
  --dest "$EPAPER13_DEST"
tools/museum/set_mode.sh --refresh

# Render one placard by hand (debugging)
uv run --directory tools/museum python -m placard <image.jpg> "<title>" "<artist>" "<date>" out.png

# Tests and lint
uv run --directory tools/museum pytest
uv run --directory tools/epaper pytest        # the profile row must not break existing tests
shellcheck tools/museum/*.sh
```

---

## Project structure

```
tools/museum/                     → New: this spec
  pyproject.toml                  →   python ≥3.11, no runtime deps; pytest (dev)
  prints.toml                     →   the curated object numbers (tracked)
  rijks.py                        →   museum-source: resolve, rights, IIIF, cache
  placard.py                      →   placard: compose → prepare_image.sh → letter
  sync_prints.py                  →   art-sync: orchestration + mirror + deploy-if-active
  set_mode.sh                     →   mode-switch: publish, record, deploy, refresh, migrate, status
  tests/                          →   pytest; fixtures/ holds recorded Linked Art JSON
  README.md                       →   curation, commands, modes, troubleshooting
  .cache/                         →   git-ignored API + image cache
tools/epaper/profiles.json        → +1 row: spectra6-133-art
tools/icloud/README.md            → +note: 13" photos go to www/epaper13-modes/photos
www/epaper13-modes/               → New, git-ignored content
  art/      (.gitignore)          →   art-sync output + .managed.json + manifest.json
  photos/   (.gitignore)          →   album-sync output for the 13" frame
  ACTIVE                          →   "art" | "photos" (git-ignored)
www/epaper13/                     → Live folder; only set_mode.sh writes here
specs/print-wall/SPEC.md          → This spec
```

---

## Code style

Match `tools/icloud` and `tools/epaper`: `from __future__ import annotations`, `pathlib`,
`argparse`, small single-purpose functions, I/O injected so the logic can be tested
without a network. Shell is POSIX `sh` with `set -eu` and must be shellcheck-clean.

```python
from __future__ import annotations

from dataclasses import dataclass

ACCEPTED_RIGHTS = {
    "creativecommons.org/publicdomain/mark/": "PD",
    "creativecommons.org/publicdomain/zero/": "CC0",
}


@dataclass(frozen=True)
class Print:
    object_number: str
    title: str
    artist: str
    date: str
    rights: str
    image_url: str


def rights_of(visual_item: dict) -> str | None:
    """'PD' or 'CC0' from the VisualItem's own rights block; None means skip it."""
    for subject in visual_item.get("subject_to") or []:
        for cls in subject.get("classified_as") or []:
            for prefix, label in ACCEPTED_RIGHTS.items():
                if prefix in cls.get("id", ""):
                    return label
    return None
```

---

## Testing strategy

- **Unit tests (pytest, `tools/museum/tests/`, no network):**
  - `museum-source`: the resolver against **recorded Linked Art JSON fixtures** (one PD,
    one CC0, one CC BY, one with rights missing, an object number with zero matches, one
    with two matches, one with no English title, one anonymous, one undated). The fetcher
    is injected, so the cache hit path makes **zero** fetch calls. Covers the IIIF URL
    rewrite and retry/backoff on 429 (fake clock).
  - `museum-source` type: the type is reported for the dry-run but is **not** a filter;
    a print fixture resolves like any other.
  - `museum-source` orientation: landscape, square, and portrait `info.json` fixtures. The
    first two resolve; portrait is skipped with reason `portrait` and **no image download**.
    A missing or malformed `info.json` is skipped with a reason, not a crash.
  - `placard`: output size is 1600×1200. `magick identify -format %k` and the unique
    colours are a subset of the palette. Strip pixels are only black or white. A tall and
    a wide input are both fitted with no crop. Long titles are truncated with `…`.
    Filenames are sanitised.
  - `art-sync`: the mirror's delete set (reusing the album sync's `plan_deletions`
    semantics), the first-run adopt rule, a byte-identical no-op re-run, and the
    deploy-only-if-`ACTIVE=art` branch, with `set_mode.sh` invocation injected.
- **Shell (`set_mode.sh`):** a pytest harness runs it against temp copies of the mode
  folders, with `push_to_ha.sh` stubbed on `PATH`. Covers an empty mode (refuses, live
  folder untouched), publish exactness, `ACTIVE` written, `--dry-run` writing nothing,
  `--migrate` being idempotent, and `www/epaper/` untouched.
- **Profile regression:** the existing `tools/epaper` tests still pass with the new row,
  and `device_profile.py spectra6-133-art` resolves.
- **Render review (manual, gating):** the six spike samples rendered with each
  `pre_filter` candidate. The user chooses.
- **End-to-end (manual, on hardware):** curate about 5 objects, then
  `set_mode.sh --migrate`, `sync_prints.py`, `set_mode.sh art`. Press the next button:
  art appears with readable placards. Then `set_mode.sh photos` and press next: photos
  return. The 5.65" frame keeps working the whole time.

---

## Boundaries

- **Always:**
  - Check PD/CC0 on **each object's own VisualItem**. Skip anything else and log the
    reason.
  - Prepare into staging, then swap into the mode folder, and write the manifest last.
  - Each sync writes **only its own mode folder**. Only `set_mode.sh` writes
    `www/epaper13/` or deploys the 13" frame.
  - Throttle, retry politely, and cache API calls. Follow `next.id` and never build a
    `pageToken` by hand.
  - Keep `--dry-run` read-only (outside `.cache/`).
  - Log every run: resolved, skipped with reasons, rendered, deleted, deployed or staged.
- **Ask first:**
  - Changes to firmware, `push_to_ha.sh`, `prepare_image.sh` or `generate_manifest.py`.
  - Changes to the `spectra6-133` (photo) or `acep565` profile rows.
  - Adding any runtime dependency.
  - Changing the mode as a side effect of anything except `set_mode.sh` (and
    `sync_prints.py` deploying while art is *already* active).
  - Changes to the 5.65" frame, its folder, or its launchd job.
  - Adding scheduling.
- **Never:**
  - Deploy an image whose rights are not PD or CC0.
  - Write to `www/epaper/`.
  - Delete files outside a mode folder's managed set (or outside the live folder's PNGs,
    for `set_mode.sh`).
  - Commit `.cache/`, prepared PNGs, `ACTIVE`, or generated manifests.
  - Put a credit line or any other text on the placard beyond title, artist and date.

---

## Success criteria

1. With `ACTIVE=art`, a single `sync_prints.py` run takes `prints.toml` to the HA host's
   `/local/epaper13/`, and the frame shows those objects with placards on its next wake.
   No other command is needed.
2. Every deployed image is PD or CC0 and is landscape or square (`width ≥ height`).
   Non-PD, unresolvable, and portrait entries are skipped with a logged reason, and the
   run still succeeds.
3. Every art PNG is 1600×1200, uses only palette colours, has a black-on-white placard
   (title, then "artist, date") readable at 1 m, and shows the whole print uncropped.
4. `set_mode.sh art` and `set_mode.sh photos` each leave the live folder, the manifest and
   the HA folder holding exactly that mode's images. The device needs no change, and the
   prev/next buttons keep working. The rotation continues from the shared counter (it is
   not reset and not resumed per mode), as documented in Module 3.
5. A no-op `sync_prints.py` re-run is byte-identical and, when fully cached, makes no
   network calls.
6. `www/epaper/` (5.65") and its launchd job are unaffected.
7. `uv run --directory tools/museum pytest`, the `tools/epaper` tests, and
   `shellcheck tools/museum/*.sh` all pass.

---

## Open questions

| # | Question | Default if unresolved | Resolved by |
|---|---|---|---|
| Q1 | `pre_filter` for `spectra6-133-art` | Empty (no boost) | Render review during the build |
| Q2 | Placard font | Georgia (macOS system font), configurable | Render review |
| Q3 | Strip height and type sizes (144 px, ~40/30 px) | As specified | Render review on the panel |
| Q4 | Rotation follows `prints.toml` order? The manifest writer sorts, so today it is object-number order | Accept sorted order | User. Changing it means touching `generate_manifest.py` (ask first) |
| Q5 | Should `ACTIVE` be visible in Home Assistant (e.g. a sensor)? | No. `--status` only | Later spec |
| Q6 | Scheduled art sync (launchd) | Not in this spec | Later spec |
| Q7 | A second museum (the Met) | Not in this spec | Later spec |
| Q8 | Should each mode resume its own rotation position after a switch? | **Resolved: no.** The shared counter continues; documented in Module 3. Options for later: Mac-side resume via HA's "Last image" sensor plus a non-sorted manifest, or a per-mode counter in firmware | User, 2026-11-15 |
| Q9 | Should subject metadata (Iconclass) also exclude photos of physical objects? | **Resolved: no allowlist.** The hand-picked list is the scope; curation handles it | User, 2026-11-15 |

---

## Non-goals

- Scheduling or launchd for the art sync.
- Query-driven discovery, random picks, or "print of the day". Curation is the list.
- Physical items (sculpture, furniture, ceramics) — excluded by curation, not by a filter.
- Portrait images (skipped by design; the panel is landscape).
- Firmware, pin, or driver changes, and any change to the 5.65" frame.
- Captions in the manifest, or text rendered on the device.
- Mixing art and photos in one rotation.
- Showing mode state in Home Assistant.
- Resuming each mode's rotation position after a switch (Q8).

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Rijksmuseum changes the Linked Art shape again (the old API is already gone) | **High.** The sync resolves nothing | Fixtures pin the expected shape. Fail loudly per entry. The cache keeps the last good set deployable |
| A curated object is portrait | Low. It is missing from the wall | Skipped with reason `portrait`; `--dry-run` shows it before anything renders |
| A curated object is a tonal painting or photograph | Low. It stylizes heavily on 6 colours | The spikes cover prints, drawings, paintings and photographs; tonal works stylize more. The user curates, so this is a choice, not a surprise |
| A curated object is not PD/CC0 | Medium. It is missing from the wall | Skipped with a reason; `--dry-run` shows it before anything renders |
| `push_to_ha.sh` mirrors the remote, so the last deploy owns the frame | **High.** One mode could wipe the other on HA | Only `set_mode.sh` deploys the 13" frame. The art profile's folder fails the destination guard on purpose |
| The migration moves the live 13" photos | Medium. A mistake would empty the frame | `--migrate` is idempotent and has `--dry-run`. It moves files, never deletes them. It publishes without deploying until verified |
| Anti-aliased placard text dithers into speckle | Low. Ugly text | Text is rendered 1-bit; the test asserts strip pixels are only black or white |
| Aquatint/mezzotint tones flatten (from the spike) | Low. A stylised look | Accepted; tonal works stylize more, and the user curates around it |
| The sorted manifest ignores list order | Low. Unexpected order | Recorded as Q4 |
| Running the album sync for the 13" without the override writes the live folder | Medium. Bypasses modes | Documented in `tools/icloud/README.md`. `set_mode.sh --status` shows the drift. Revisit if it happens |
