# Museum art tooling

Resolves a **Rijksstudio set**, renders each object as a 1600×1200 palette-only PNG with a
gallery placard, and mirrors the result into the 13.3" frame's art mode folder.
`set_mode.sh` publishes either the art or the photo set into the live folder and deploys
it. The device is unchanged.

See [`../../specs/print-wall/SPEC.md`](../../specs/print-wall/SPEC.md).

## Curation

The set is the scope. Add or remove objects in your Rijksstudio set on rijksmuseum.nl; the
tool fetches whatever is in the set, in the set's order.

1. Copy the last segment of the set URL into `prints.toml`:

   ```toml
   # https://www.rijksmuseum.nl/nl/collectie/verzameling/epaper--aa3048ce-... -> epaper--aa3048ce-...
   set_id = "epaper--aa3048ce-24d5-437f-b1ae-08df3f4239e6"
   culture = "nl"
   ```

2. Validate: `uv run --directory tools/museum python sync_prints.py --dry-run`
3. Sync: `EPAPER13_DEST=server:/srv/home-assistant/config/www/epaper13/ uv run --directory tools/museum python sync_prints.py`
4. Show: `tools/museum/set_mode.sh art` if the frame is not already in art mode.

The set page itself is fetched live on every run, so a newly added object appears on the
next sync. Object metadata and images stay cached (they are immutable by URL);
`--refresh` forces those too.

The set's order is preserved: filenames are prefixed with the set index (`001-...`,
`002-...`), so the sorted manifest follows the folder.

## Commands

```
# Preview: resolve the set and show rights, type and skips
uv run --directory tools/museum python sync_prints.py --dry-run

# Override the configured set
uv run --directory tools/museum python sync_prints.py --set epaper--aa3048ce-24d5-437f-b1ae-08df3f4239e6

# The one command: fetch, render, mirror; deploy if art mode is active.
# The deploy needs EPAPER13_DEST, exactly as set_mode.sh does.
EPAPER13_DEST=server:/srv/home-assistant/config/www/epaper13/ \
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
uv run --directory tools/epaper pytest
shellcheck tools/museum/*.sh
```

## Modes

Each mode is a folder under `www/epaper13-modes/`:

```
www/epaper13-modes/art/      ← the museum sync writes here (.managed.json)
www/epaper13-modes/photos/   ← the album sync writes here
www/epaper13-modes/ACTIVE    ← "art" or "photos"
www/epaper13/                ← live folder; only set_mode.sh writes here
```

`set_mode.sh art|photos` copies that mode's PNGs into the live folder, regenerates the
manifest, records `ACTIVE`, and deploys. `--refresh` republishes whichever mode is active
without changing it. `--no-deploy` publishes and records but skips the push.

**Rotation position across a switch.** The device keeps one persisted counter for every
manifest and shows image `counter mod count`. A switch swaps the manifest, not the counter,
so the rotation continues from wherever it is. It does not reset to the first image, and it
does not resume the position the mode had before.

## Skip reasons

`--dry-run` prints one line per entry. A skipped entry says why:

| Reason | Meaning |
|---|---|
| `not-found` | The object number matched nothing |
| `ambiguous` | The object number matched more than one object (often a prefix collision) |
| `no-image` | No IIIF image, or a missing/malformed `info.json` |

Rights and orientation are **not** skip reasons. Every object the museum serves is shown,
whatever its rights statement, and a portrait work is fitted into the landscape art area
with white margins (never cropped) — the dry-run prints the rights label (`PD`, `CC0`,
`Copyright`, …) so the status stays visible. This is a private, non-commercial display; if
you publish or resell the images, revisit the rights question.

## Rotation order

`sync_prints.py` prefixes each file with its position in the set (`001-…`, `002-…`) and
`manifest.ts` writes a sorted list, so the device rotates in the set's order.
The prefix is three digits, so a set with more than 999 objects would sort wrongly after
`999-`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `EPAPER13_DEST is not set` | Export it, or pass it inline: `EPAPER13_DEST=host:/path tools/museum/set_mode.sh art` |
| `Rijksstudio set '...' is empty or not found` | Check the set ID and that the set has items |
| `mode 'art' has no PNGs` | Run `sync_prints.py` first; the art folder is empty |
| `no ACTIVE mode recorded` | Run `set_mode.sh art` or `set_mode.sh photos` once |
| A stale object stays on the wall | Remove it from `prints.toml` and re-run `sync_prints.py`; the mirror deletes it |
| The API rate-limits | The fetcher retries 429/5xx with backoff and caches every response under `.cache/` |
| `--refresh` shows the wrong set | Check `set_mode.sh --status`; `ACTIVE` names the mode being republished |
| The placard strip looks off-white | The image is pure `#FFFFFF`; the Spectra 6 white ink is slightly warm/grey. This is the panel, not the image |

## Files

- `pyproject.toml` / `uv.lock` — environment (no runtime dependencies)
- `prints.toml` — the Rijksstudio set id and culture
- `rijks.py` — resolve, rights, orientation, metadata, HTTP fetcher and cache
- `placard.py` — compose, dither through `prepare.ts`, letter the placard
- `sync_prints.py` — resolve → render → mirror → manifest → deploy-if-active
- `set_mode.sh` — publish, record, deploy, refresh, migrate, status
- `tests/` — pytest suite; `tests/fixtures/` holds recorded Linked Art JSON
- `.cache/` — git-ignored API and image cache
