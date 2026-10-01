# Spec: iCloud Favorites Sync

Status: **draft — awaiting review** · Revision 1 (2026-10-01)
Slug: `icloud-favorites-sync`

> This capability replaces the *manual* front half of the existing image pipeline with an
> automatic source: the 50 most recent iCloud Favorites. It consumes the contract already
> established by [`../epaper-art-frame/SPEC.md`](../epaper-art-frame/SPEC.md) Module 3 — the
> artwork folder, `manifest.json`, and `push_to_ha.sh` — and leaves the device firmware
> untouched. It is a separate spec because it is independently testable and has its own
> consumer (the Mac), not because it is part of the device.
>
> **Source of intent:** a confirmed interview, 2026-10-01. The friction being removed is the
> manual per-photo prepare/import step, not the server or the device.

---

## Objective

Favoriting a photo on an iPhone/iPad should eventually make it appear on the frame, with **zero
manual steps** on any machine. The sync mirrors the **50 most recent favorites** (by capture
date) from the Mac's local Photos library into the frame's artwork folder, prepares each to
600×448 dithered PNG, and deploys them to the Home Assistant host — where the existing device
picks them up on its next daily wake, round-robin.

### The system

| Property | Value |
|---|---|
| Source | iCloud **Favorites**, read from the Mac's local Photos library |
| Extraction | [`osxphotos`](https://rhettbull.github.io/osxphotos/) Python API (`PhotoInfo.favorite`) |
| Selection | 50 most recent favorites, sorted by capture date (descending) |
| Sync semantics | Mirror — an unfavorited photo drops out of the rotation |
| Preparation | Existing `tools/epaper/prepare_image.sh` (600×448, 7-colour ACeP dither) |
| Artwork folder | `www/epaper/` (the sync is its sole writer) |
| Deploy | Existing `tools/epaper/push_to_ha.sh` → HA `config/www/epaper/`, served at `/local/epaper/` |
| Scheduling | macOS `launchd` LaunchAgent on the Mac — every 6 h + at load (no cron, no manual runs) |
| Device | **Unchanged** — see `epaper-art-frame` SPEC Modules 1–2 |

---

## Confirmed decisions (from interview)

- **Source is iCloud Favorites specifically**, not a curated album. Curation happens by tapping
  the heart in Photos; no separate album to maintain.
- **iCloud is a hard requirement**; the user wants to stay in the Apple ecosystem.
- **Read the local Photos library, not `icloudpd`.** `icloudpd` requires *Advanced Data
  Protection off* and *"Access iCloud Data on the Web" on*, and forces periodic 2FA re-logins —
  which is itself a manual step. The Mac is frequently awake and already syncs the library, so
  favorites are already on local disk.
- **No manual steps anywhere** — favoriting on the phone is the only human action.
- **Most recent 50, by capture date descending** (newest first in the rotation). Not
  favorite-time: hearting an old photo must not reshuffle the rotation.
- **Scheduled every 6 h and at load** via launchd — frequent enough to feel immediate, cheap
  enough to ignore.
- **The prep step stays, automated.** The device bands badly on raw RGB, so pre-dither is
  required; only the *manual* invocation is removed.
- **The device and `push_to_ha.sh` are reused unchanged.**
- **This is its own spec** (`icloud-favorites-sync`), not a module of `epaper-art-frame`.

---

## Module 1 — Favorites extraction (osxphotos)

- **Tool:** `osxphotos` (Python API). Install via `uv tool install osxphotos` (or `pipx`/`pip`);
  pin a known-good version.
- **Selection algorithm:**
  1. Open the system Photos library (`osxphotos.PhotosDB()`; optional `--library PATH` override).
  2. Keep photos where `photo.favorite is True` and the asset is not a video/Live-Photo movie.
  3. Sort by `photo.date` **descending** (capture date).
  4. Take the first **50**.
- **Metadata is the only thing read from the DB** — image bytes are exported via the API
  (`PhotoInfo.export`), not copied from the database internals.
- **Permissions:** the runner (the launchd job's Python) needs **Full Disk Access** to read the
  Photos library. One-time grant, documented in the tool README.
- **`--dry-run`:** print the selected 50 (uuid, date, original filename) without exporting.

**Exit criteria:** running the extraction prints exactly the 50 most recent favorites, in
descending capture-date order, with stable uuids; it makes no writes.

---

## Module 2 — Prepare + mirror the artwork folder

- **Stable filenames.** Each selected favorite maps to a deterministic PNG name derived from its
  PhotoKit **uuid** (e.g. `<uuid>.png`), so re-runs are idempotent and files never churn names.
  Names must stay free of commas, quotes and `]` (the device parses the manifest with a naive
  quoted-string scan — see `tools/epaper/README.md`); uuids satisfy this.
- **Prepare.** For each selected favorite: export the original to a temp staging dir, then run
  `prepare_image.sh <staged> --out-dir <artwork> <uuid>.png` → 600×448, 7-colour dithered.
- **Mirror (delete).** After preparing, delete any `*.png` in the artwork folder that is **not**
  in the current top-50. The sync is the folder's sole writer; the existing hand-curated files
  (`family.png`, `IMG_*.png`) are removed on first run.
- **Regenerate the manifest** with `generate_manifest.py` (its only writer), yielding a sorted
  list of the ≤50 PNGs.
- **Idempotence:** a no-op run (no favorites added/removed) rewrites nothing but the manifest
  (which will be byte-identical) and copies nothing new.

**Exit criteria:** after a run the artwork folder contains exactly one PNG per selected favorite
and a manifest listing them; adding/removing a favorite on the phone changes the folder on the
next run to match.

---

## Module 3 — Deploy + schedule

- **Deploy:** reuse `tools/epaper/push_to_ha.sh` (which itself regenerates the manifest) with the
  destination from `EPAPER_DEST` / argument. No new deployment code.
- **Schedule:** a macOS **LaunchAgent** (`tools/icloud/<label>.plist`) with `RunAtLoad` and a
  `StartInterval` (e.g. every few hours). launchd runs missed jobs on next wake, so a sleeping
  Mac self-heals — no cron, no manual invocation.
- **Observability:** the job writes a timestamped log (stdout/stderr redirected). On non-zero
  exit it logs the failure; a macOS notification is optional.
- **Config:** destination host/path, Photos library path, and N=50 come from a small config file
  or environment (not hard-coded), so the Mac and HA host can change without editing code.

**Exit criteria:** with the LaunchAgent loaded, favoriting a photo on the phone results in a
prepared, deployed image on the HA host within one sync interval, with no human command run.

---

## Module 4 — Device (unchanged)

The device continues to fetch `manifest.json` and rotate round-robin via its persisted index.
No firmware, pin, or config changes are part of this spec.

---

## Commands

```
# One-time: install the extractor
uv tool install osxphotos            # or: pipx install osxphotos / pip3 install --user osxphotos

# Preview the selection (no writes)
python3 tools/icloud/sync_favorites.py --dry-run

# Run the full sync manually (normally launchd does this)
python3 tools/icloud/sync_favorites.py

# Underlying pipeline steps the sync calls (unchanged):
tools/epaper/prepare_image.sh <input> --out-dir www/epaper <uuid>.png
python3 tools/epaper/generate_manifest.py --check
tools/epaper/push_to_ha.sh "$EPAPER_DEST"

# Load / reload the schedule
launchctl load -w ~/Library/LaunchAgents/<label>.plist
launchctl list | grep <label>

# Tests
python3 -m pytest tools/icloud/tests
shellcheck tools/epaper/*.sh tools/icloud/*.sh   # if a shell wrapper is added
```

---

## Project Structure

```
tools/icloud/                    → New: the favorites sync (this spec)
  sync_favorites.py              →   selection + prepare + mirror + deploy orchestration
  tests/                         →   unit tests (fake PhotosDB)
  <label>.plist                  →   launchd LaunchAgent
  README.md                      →   install, Full Disk Access, config, troubleshooting
tools/epaper/                    → Existing: prepare_image.sh, generate_manifest.py, push_to_ha.sh
www/epaper/                      → Artwork folder (git-ignored images + generated manifest.json)
specs/icloud-favorites-sync/     → This spec
  SPEC.md
  tasks/plan.md                  → created at the PLAN phase
  tasks/todo.md                  → created at the TASKS phase
```

---

## Code Style

Match the existing `tools/epaper` tooling: Python with `from __future__ import annotations`,
`pathlib.Path`, `argparse`, and small single-purpose functions; POSIX `sh` for wrappers.

```python
from __future__ import annotations

import osxphotos

TOP_N = 50

def select_favorites(db: osxphotos.PhotosDB, top_n: int = TOP_N) -> list[osxphotos.PhotoInfo]:
    """The most recent favorites by capture date, newest first."""
    favorites = [
        p for p in db.photos()
        if p.favorite and not p.ismovie
    ]
    favorites.sort(key=lambda p: p.date, reverse=True)
    return favorites[:top_n]
```

---

## Testing Strategy

- **Unit (pytest, `tools/icloud/tests/`):** the pure logic against a **fake PhotosDB** — selection
  filters non-favorites and movies, sorts by capture date descending, caps at 50; the mirror step
  computes the correct delete set; filename derivation is stable and device-safe. No real Photos
  library, no macOS required.
- **Dry-run integration:** `sync_favorites.py --dry-run` against the real library, asserting 50
  selections and the expected newest-first order.
- **Manual end-to-end (macOS):** favorite a photo on the phone → run the job → confirm the PNG is
  in `www/epaper/`, the manifest lists it, HA serves it, and the device renders it on next wake.
- **Failure-path tests:** Photos library unavailable, zero favorites, fewer than 50 favorites,
  `magick` missing, HA unreachable — each must log clearly and exit non-zero **without** leaving
  the artwork folder or manifest in a half-written state.

---

## Boundaries

- **Always:** keep the artwork folder consistent with the selected set (prepare fully, then
  mirror); regenerate the manifest via `generate_manifest.py`; log every run; make `--dry-run`
  truly read-only.
- **Ask first:** changing the device firmware or `push_to_ha.sh`; changing N (50) or the sort
  order; adding a new runtime dependency; touching the HA `configuration.yaml`.
- **Never:** write to or modify the Photos library; commit `secrets.yaml`, the artwork images, or
  the generated manifest; require disabling Advanced Data Protection; introduce a manual step.

---

## Success Criteria

1. With the LaunchAgent loaded, **favoriting a photo on the phone** results in it being prepared
   and deployed to the HA host within one sync interval, with **no human command run**.
2. The rotation contains exactly the **50 most recent favorites by capture date**; unfavoriting a
   photo removes it on the next sync.
3. A no-op sync makes no spurious changes (idempotent; manifest byte-identical).
4. The artwork folder contains only sync-managed files (hand-curated files removed on first run).
5. Failure paths (library missing, `magick` missing, HA unreachable, <50 favorites, 0 favorites)
   log clearly, exit non-zero, and never leave the folder/manifest inconsistent.
6. The device firmware is unchanged and continues to render the deployed images.

---

## Open Questions

| # | Question | Default if unresolved | Resolved by |
|---|---|---|---|
| Q1 | New spec vs. a module in `epaper-art-frame`? | **Resolved** — own spec (this file) | User review 2026-10-01 |
| Q2 | Sync interval | **Resolved** — every 6 h + at load | User review 2026-10-01 |
| Q3 | Config mechanism (env file vs. TOML vs. plist args) | `.env`-style file read by the script | PLAN |
| Q4 | `EPAPER_DEST` host/path and Photos library path | Provided by user at setup | Setup |
| Q5 | "Optimize Mac Storage" — are favorite originals local? | Assume yes; use `PhotoInfo.export` (can trigger download) | Verification |
| Q6 | Manifest/rotation order | **Resolved** — capture-date descending (newest first) | User review 2026-10-01 |

---

## Non-goals

- `icloudpd` and any workflow requiring Advanced Data Protection to be disabled.
- iCloud **Shared Albums** (osxphotos cannot read them on macOS 26.x; also not what "Favorites" means).
- Any cloud host beyond the existing Home Assistant box.
- Live "show this now" control of the device (impossible while it deep-sleeps).
- Device firmware, pin, or hardware changes (owned by `epaper-art-frame` / `wooden-frame`).
- Non-favorite albums, people/keyword filters, or multi-source blending.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Full Disk Access not granted → library unreadable | **High** — sync never runs | Document the one-time grant; fail loudly with a clear message |
| "Optimize Mac Storage" leaves originals off-disk | Medium — export fails for those photos | `PhotoInfo.export` triggers download; surface missing assets in the log; consider `--use-photokit` |
| macOS Photos DB schema changes on OS upgrade | Medium — osxphotos breaks until updated | Pin osxphotos; upgrade deliberately; log version |
| Mac asleep at the scheduled time | Low — freshness delayed | launchd runs missed jobs on wake (`RunAtLoad` + `StartInterval`) |
| Photos not yet synced when the job runs | Low — a new favorite lags a cycle | Tolerated; the next interval picks it up |
| Deleting the wrong files in the mirror step | **High** — data loss beyond the frame | Sync only ever deletes `*.png` it can attribute to its own managed set; never touches non-artwork paths; `--dry-run` shows the delete set |
| Artwork folder left half-written on failure | Medium — device fetches a partial set | Prepare to a staging dir, swap atomically, regenerate the manifest last |