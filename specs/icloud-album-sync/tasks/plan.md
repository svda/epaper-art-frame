# Implementation Plan: iCloud Favorites Sync

Spec: [`../SPEC.md`](../SPEC.md) · Plan created 2026-10-01
Task list: [`todo.md`](./todo.md)

---

## Overview

Automate the front half of the frame's image pipeline: a launchd job on the Mac reads the 50
most recent iCloud Favorites (by capture date) from the local Photos library via **osxphotos**,
prepares each to a 600×448 7-colour dithered PNG with the existing `tools/epaper` tooling, mirrors
the artwork folder, and deploys to the Home Assistant host. The device and its firmware are
untouched. The only human action left is tapping the heart in Photos.

---

## Architecture decisions

- **osxphotos Python API, not CLI parsing.** `PhotoInfo.favorite` / `.date` / `.export()` are typed
  and stable; shelling out and parsing text is brittle. osxphotos is treated as an external
  dependency, like `magick`.
- **Selection is a pure function.** `select_favorites(db, top_n)` takes a PhotosDB-like object and
  returns a list. Tests inject a fake, so the core logic is verified without macOS or a real
  library.
- **Stable `<uuid>.png` filenames.** The PhotoKit uuid is deterministic, collision-free, and
  already device-safe (no commas/quotes/`]`). Re-runs are idempotent; the frame's rotation is
  stable across syncs.
- **Prepare to staging, then swap.** Export + `prepare_image.sh` run against a temp dir; only a
  fully-prepared set is moved into `www/epaper/`. A mid-run failure never leaves the device with a
  half-written folder.
- **Mirror via a managed-set state file.** The sync records the filenames it manages in
  `www/epaper/.managed.json`. It deletes only files it previously managed and that are no longer
  selected. **First run** (no state file) adopts the folder: it deletes existing `*.png` not in the
  current set — the one-time removal of the hand-curated `family.png` / `IMG_*.png`. `--dry-run`
  prints the delete set and changes nothing.
- **Manifest is regenerated last, by its existing writer.** `generate_manifest.py` stays the sole
  writer of `manifest.json`; the sync never hand-edits it.
- **Config in a git-ignored `.env`** (`tools/icloud/.env`) read by the script, with real
  environment variables overriding. Keys: `EPAPER_DEST`, `PHOTOS_LIBRARY` (optional),
  `TOP_N` (default 50), `SYNC_INTERVAL_H` (default 6).
- **Deploy and schedule are thin.** Deploy calls the existing `push_to_ha.sh`; schedule is a
  LaunchAgent with `RunAtLoad` + `StartInterval`. No new deployment or scheduling code.

---

## Dependency graph

```
T-01 osxphotos spike (fail fast: library access, favorites, local originals)
  │
  ├── T-02 scaffold + config + CLI (--dry-run)
  │      │
  │      └── T-03 selection logic + unit tests (fake DB)
  │             │
  │             └── T-04 prepare + mirror + tests (temp dirs)
  │                    │
  │                    └── T-05 real export (PhotoInfo.export, missing/optimized assets)
  │                           │
  │                           └── T-06 orchestrate the full run
  │                                  │
  │                                  └── T-07 deploy via push_to_ha.sh
  │                                         │
  │                                         └── T-08 launchd schedule + logging
  │                                                │
  │                                                └── T-09 end-to-end acceptance
  │                                                       │
  │                                                       └── T-10 README/docs
```

Sequential throughout: each layer consumes the contract of the one before it. The only
independent work is T-10 (docs), which can be drafted any time after T-02.

---

## Definition of Done

The standing bar every task clears, in addition to its own acceptance criteria:

- [ ] `python3 -m pytest tools/icloud/tests` passes.
- [ ] `ruff check tools/icloud` and `ruff format --check tools/icloud` clean (if `ruff` is
      available; otherwise PEP 8 by inspection).
- [ ] `--dry-run` performs **no writes** anywhere (artwork folder, state file, HA host).
- [ ] `manifest.json` is only ever written by `generate_manifest.py`.
- [ ] The sync never writes to the Photos library.
- [ ] No secrets, images, or generated manifests are committed (`tools/icloud/.env`,
      `www/epaper/*` stay git-ignored).
- [ ] No Home Assistant config (`configuration.yaml` / packages) is modified.

---

## Task summary

| Phase | Tasks | Capability | Risk |
|---|---|---|---|
| 0 — De-risk | T-01 | prove osxphotos + library access | **High (gates all)** |
| 1 — Core logic | T-02, T-03, T-04 | scaffold, selection, prepare+mirror | Low (unit-tested) |
| 2 — Wire the pipeline | T-05, T-06, T-07 | export, orchestrate, deploy | Medium |
| 3 — Schedule & accept | T-08, T-09, T-10 | launchd, end-to-end, docs | Medium |

**10 tasks, XS–M each. No task touches more than ~5 files.**

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| osxphotos can't read the library (Full Disk Access) | **High** — whole spec blocked | T-01 spike first; document the grant; fail loudly |
| Favorite originals off-disk ("Optimize Mac Storage") | Medium — export fails for some | T-01 checks; `PhotoInfo.export` triggers download; log missing assets |
| Mirror deletes unintended files | **High** — data loss | Managed-set state file; first-run adoption is dry-run-visible; only `*.png` in the artwork folder |
| macOS/Photos schema change breaks osxphotos | Medium | Pin the version; log it; upgrade deliberately |
| `magick`/`osxphotos` absent on the runner | Low | Preflight checks with clear messages; non-zero exit |
| Mac asleep at the scheduled time | Low | `RunAtLoad` + `StartInterval`; launchd catches up on wake |
| Half-written folder on failure | Medium | Prepare to staging; swap; manifest last |

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q3 | Config mechanism — **resolved: git-ignored `.env` + env override** | PLAN |
| Q4 | `EPAPER_DEST` and Photos library path values | Setup (user) |
| Q5 | Are favorite originals local? | T-01 |

No ask-first items: no purchases, no device/hardware changes, no HA config changes.