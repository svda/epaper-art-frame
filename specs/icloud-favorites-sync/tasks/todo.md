# Task List: iCloud Favorites Sync

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

---

## Phase 0 — De-risk (spike)

### T-01: Confirm osxphotos reads the library and exposes favorites
**Description:** Install `osxphotos`, grant Full Disk Access to the runner, and prove the core
assumption: the local Photos library exposes favorites with capture dates, and favorite originals
are available on disk (or downloadable). This is the highest-risk unknown; if it fails, the spec's
approach is wrong and we stop.

**Acceptance criteria:**
- [ ] `osxphotos` installed and importable; version recorded.
- [ ] `PhotoInfo.favorite` and `.date` are readable for the system library.
- [ ] The count and capture-date ordering of favorites is confirmed (sanity-checked against Photos.app).
- [ ] Q5 answered: whether favorite originals are local or off-disk ("Optimize Mac Storage").
- [ ] Full Disk Access requirement and the exact grant steps are recorded in the tool README.

**Verification:**
- [ ] A one-off script prints the 50 most recent favorites (uuid, date, filename) and it matches
      what Photos.app shows; export one favorite successfully.

**Dependencies:** none · **Scope:** S · **Files:** `tools/icloud/README.md` (spike notes)

---

## Phase 1 — Core sync logic (testable without macOS)

### T-02: Scaffold the sync tool, config, and CLI
**Description:** Create `tools/icloud/` with `sync_favorites.py` as a thin CLI (`--dry-run`,
`--library`, `--top-n`, `--config`) that loads config from a git-ignored `.env` with environment
overrides. No selection logic yet — just argument parsing, config resolution, preflight checks
(`osxphotos`, `magick`, `scp`, `python3` present), and logging.

**Acceptance criteria:**
- [ ] `python3 tools/icloud/sync_favorites.py --help` works; `--dry-run` is accepted.
- [ ] Config precedence: CLI flag > env var > `.env` > default.
- [ ] Missing prerequisites produce a clear non-zero exit, not a traceback.
- [ ] `tools/icloud/.env` is git-ignored.

**Verification:**
- [ ] Run `--help` and a preflight failure case; confirm messages and exit codes.
- [ ] `git status` shows `.env` untracked.

**Dependencies:** T-01 · **Scope:** S · **Files:** `tools/icloud/sync_favorites.py`,
`tools/icloud/.env.example`, `tools/icloud/.gitignore`, `tools/icloud/tests/__init__.py`

---

### T-03: Selection logic + unit tests
**Description:** Implement `select_favorites(db, top_n)` — filter `photo.favorite`, exclude
videos/Live-Photo movies, sort by capture date descending, cap at `top_n`. Tested entirely against
a fake PhotosDB; no real library or macOS.

**Acceptance criteria:**
- [ ] Non-favorites and movies are excluded.
- [ ] Results are ordered capture-date descending.
- [ ] Exactly `top_n` returned when more exist; all returned when fewer.
- [ ] Deterministic tie-breaking (stable secondary key, e.g. uuid) so order doesn't flap.

**Verification:**
- [ ] `python3 -m pytest tools/icloud/tests` passes, including edge cases (0, <N, >N, ties,
      missing dates).

**Dependencies:** T-02 · **Scope:** S · **Files:** `tools/icloud/sync_favorites.py`,
`tools/icloud/tests/test_selection.py`

---

### T-04: Prepare + mirror the artwork folder + tests
**Description:** Implement the folder step: export each selected favorite to a temp staging dir,
run `prepare_image.sh <staged> --out-dir <staging> <uuid>.png`, then atomically swap the prepared
PNGs into `www/epaper/` and delete managed files no longer selected. Maintain
`www/epaper/.managed.json`. First run adopts the folder (removes unmanaged `*.png`). Tested against
temp directories with a stubbed `magick`.

**Acceptance criteria:**
- [ ] Output filenames are `<uuid>.png` and device-safe (no commas/quotes/`]`).
- [ ] The mirror delete set is exactly (previously managed) minus (currently selected).
- [ ] First run removes unmanaged `*.png`; subsequent runs do not touch unmanaged files.
- [ ] `--dry-run` prints the delete set and writes nothing (folder, state file, or manifest).
- [ ] `generate_manifest.py` is invoked last; it remains the manifest's only writer.

**Verification:**
- [ ] `python3 -m pytest tools/icloud/tests` passes (add/remove/no-op/empty/first-run cases).
- [ ] Manual: run against a temp artwork dir, inspect folder + `.managed.json`.

**Dependencies:** T-03 · **Scope:** M · **Files:** `tools/icloud/sync_favorites.py`,
`tools/icloud/tests/test_mirror.py`, `tools/icloud/tests/conftest.py`

---

### Checkpoint A — Core logic correct on fakes
- [ ] All unit tests pass; `--dry-run` is provably read-only.
- [ ] **Review with user** before touching the real library.

---

## Phase 2 — Wire the pipeline

### T-05: Real export from the Photos library
**Description:** Replace the stubbed export with the real `PhotoInfo.export`, handling missing /
off-disk originals (trigger download where possible, log what could not be retrieved). No partial
failures: if a selected favorite can't be exported, the run reports it and continues with the rest
while exiting non-zero.

**Acceptance criteria:**
- [ ] Selected favorites export to staging with real bytes.
- [ ] Missing/optimized assets are logged explicitly and counted.
- [ ] A run with ≥1 unexportable favorite still produces a consistent folder and a clear warning.

**Verification:**
- [ ] Run against the real library with `--dry-run` off; confirm 50 staged PNGs and a clean log.

**Dependencies:** T-04, T-01 (Q5) · **Scope:** M · **Files:** `tools/icloud/sync_favorites.py`

---

### T-06: Orchestrate the full run
**Description:** Wire select → export → prepare → mirror → `generate_manifest.py --check` into one
command with end-of-run summary logging. Idempotent: a no-op run changes nothing (manifest
byte-identical, nothing copied).

**Acceptance criteria:**
- [ ] One command produces a consistent `www/epaper/` (≤50 PNGs + `manifest.json`).
- [ ] Re-running with no favorite changes is a no-op (verified by hashes).
- [ ] `generate_manifest.py --check` passes after a run.
- [ ] Any step's failure exits non-zero without a half-written folder.

**Verification:**
- [ ] Run twice; diff folder hashes; confirm no-op.
- [ ] Inject a failure (e.g. break `magick` path) and confirm no partial state.

**Dependencies:** T-05 · **Scope:** M · **Files:** `tools/icloud/sync_favorites.py`

---

### T-07: Deploy to the HA host
**Description:** After a successful local run, invoke `tools/epaper/push_to_ha.sh` with the
configured destination. Skip deploy when nothing changed. Handle an unreachable host with a clear
non-zero exit that leaves the local folder intact.

**Acceptance criteria:**
- [ ] A changed run deploys; an unchanged run skips deploy.
- [ ] Unreachable HA host → clear error, non-zero exit, local folder/manifest untouched.
- [ ] `EPAPER_DEST` is read from config; no destination is hard-coded.

**Verification:**
- [ ] Push a changed set and fetch `manifest.json` + an image over HTTP from HA.
- [ ] Simulate an unreachable host; confirm behavior.

**Dependencies:** T-06 · **Scope:** S · **Files:** `tools/icloud/sync_favorites.py`

---

### Checkpoint B — A real run reaches the device
- [ ] A single real run puts the 50 favorites on HA.
- [ ] The device renders one of them on its next wake.
- [ ] **Review with user** before scheduling.

---

## Phase 3 — Schedule & acceptance

### T-08: launchd LaunchAgent + logging
**Description:** Ship `tools/icloud/<label>.plist` running the sync every 6 h and at load, with
stdout/stderr redirected to a rotating log. Document load/reload/unload and how to read the log.

**Acceptance criteria:**
- [ ] `launchctl load -w` installs it; `launchctl list` shows it.
- [ ] It runs at load and on the interval; the log captures each run's summary.
- [ ] A failed run is visible in the log (and exit status is non-zero).

**Verification:**
- [ ] Load the agent, force a run, confirm log output and a subsequent scheduled run.

**Dependencies:** T-07 · **Scope:** S · **Files:** `tools/icloud/com.sander.epaper-favorites.plist`,
`tools/icloud/README.md`

---

### T-09: End-to-end acceptance
**Description:** Verify the actual promise: favoriting a photo on the phone makes it appear on the
frame, with no command run; unfavoriting removes it.

**Acceptance criteria:**
- [ ] Favorite a new photo on the phone → within one sync interval it is prepared, deployed, and
      in the manifest.
- [ ] Unfavorite a photo → it drops out on the next sync.
- [ ] The rotation holds the 50 most recent by capture date.
- [ ] No manual command is run at any point.

**Verification:**
- [ ] Observe two consecutive sync intervals covering one add and one remove; confirm on HA and,
      if available, on the device.

**Dependencies:** T-08 · **Scope:** S · **Files:** none (verification)

---

### T-10: README + operations docs
**Description:** Document install (`osxphotos`), the Full Disk Access grant, config keys, how to
run manually, how to read logs, and troubleshooting (missing assets, unreachable HA, `magick`
absent). Note the future non-goal of porting `generate_manifest.py` to another language.

**Acceptance criteria:**
- [ ] A new operator can set up the sync from the README alone.
- [ ] Full Disk Access steps, config keys, and troubleshooting are covered.
- [ ] The spec's non-goals (icloudpd, shared albums, firmware) are restated.

**Verification:**
- [ ] Walk the README on a clean shell; confirm each command works as written.

**Dependencies:** T-02 (draftable after) · **Scope:** S · **Files:** `tools/icloud/README.md`

---

### Checkpoint C — Shipped
- [ ] Two consecutive intervals of hands-off add/remove observed.
- [ ] **Review with user** — walk the spec's success criteria.