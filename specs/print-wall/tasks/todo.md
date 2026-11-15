# Task List: Print Wall

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`. Never run
`set_mode.sh` (including `--migrate`) against the real `www/` tree, except in T-10.

---

## Phase 0 — Spec sync

### T-01: Bring the spec in line with the plan
**Description:** Apply the planning findings to `specs/print-wall/SPEC.md` so workers read
a correct spec. Add `set_mode.sh --refresh` (republish and deploy the active mode) to
Module 3, Commands and the capability map. Change Module 4 step 5 to call
`set_mode.sh --refresh` when `ACTIVE=art`. Replace the 13" photo-refresh command with
`EPAPER_IMAGES=www/epaper13-modes/photos sync_album.py --profile spectra6-133 --dest
"$EPAPER13_DEST"` followed by `set_mode.sh --refresh`, and explain why `--dest` is needed
(plan finding 1). Remove the type allowlist (Revision 7): the hand-picked list is the
scope, and the resolver reports the type but does not filter on it. Change the "Choosing
pre_filter" sample set to 2 prints, 2 paintings, 2 drawings and 2 photographs. Note that
`test_profile.py` gets updated for the new profile row. Remove the stale "re-run the spike"
non-goal and the matching Risks row.

**Acceptance criteria:**
- [x] `--refresh` is specified (behaviour, and refusal when `ACTIVE` is missing or names an empty mode) and is used by art-sync and the photo refresh.
- [x] No type allowlist remains; a print resolves like any other object.
- [x] The pre_filter review lists print, painting, drawing and photograph samples.
- [x] Revision line bumped to 7 with a one-line summary.

**Verification:**
- [x] `rg -q -- '--refresh' specs/print-wall/SPEC.md` and `! rg -q 'mezzotint, aquatint\) with' specs/print-wall/SPEC.md`

**Dependencies:** None · **Scope:** XS
**Tier:** light · **Risk:** normal · **Verify:** `rg -q -- 'set_mode.sh --refresh' specs/print-wall/SPEC.md`
**Files:** specs/print-wall/SPEC.md
**Context:** specs/print-wall/tasks/plan.md §Findings from planning; SPEC.md §Module 3, §Module 4, §Commands

---

## Phase 1 — Source (`museum-source`)

### T-02: Scaffold `tools/museum` and the pure resolver
**Description:** Create the `tools/museum` uv project (Python ≥3.11, no runtime
dependencies, pytest as a dev dependency) and `rijks.py`'s pure layer. Given a `fetch(url)
-> dict` callable, `resolve(object_number, fetch)` returns either a `Print` dataclass or a
`Skip(object_number, reason)`. It follows the spec's five steps: search, object, VisualItem
rights, DigitalObject, IIIF `info.json` orientation. Skip reasons are `not-found`,
`ambiguous`, `rights`, `portrait` and `no-image`. Record JSON fixtures
from the live API once, and commit them. Handle **both** record shapes (plan finding 7):
`timespan` as an object or a list, and creators under `carried_out_by` or
`part[].carried_out_by`, with `_label` or `notation[].@value`.

**Acceptance criteria:**
- [x] Fixtures resolve as expected. Accepted: print `RP-P-1956-733` (The Great Wave), painting `SK-A-3089`, photograph `RP-F-00-630`, drawing `RP-T-1921-120`. Skipped: In Copyright `RP-F-F02993` → `rights`; portrait `RP-P-RMA1442` → `portrait`; ambiguous `RP-F-2019-299-6-6` → `ambiguous`; unknown `XX-000-000` → `not-found`.
- [x] A portrait object never requests the image URL (the fake fetch records its calls).
- [x] Metadata fallbacks follow the spec table (`Untitled`, `Anonymous`, empty date), and the image URL ends in `/full/!1600,1600/0/default.jpg`.

**Verification:**
- [x] `uv run --directory tools/museum pytest tests/test_rijks.py`

**Dependencies:** T-01 · **Scope:** M
**Tier:** standard · **Risk:** normal · **Verify:** `uv run --directory tools/museum pytest tests/test_rijks.py`
**Files:** tools/museum/pyproject.toml, tools/museum/.gitignore, tools/museum/rijks.py, tools/museum/tests/test_rijks.py, tools/museum/tests/fixtures/
**Context:** SPEC.md §Module 1 — museum-source, §Code style, §Testing strategy; plan.md §Findings 7

### T-03: Live fetcher, cache, and `sync_prints.py --dry-run`
**Description:** Add the I/O layer to `rijks.py`. An HTTP fetcher (urllib,
`User-Agent: epaper-art-frame/print-wall`, `Accept: application/json`, at least 0.25 s
between requests, up to 3 retries with exponential backoff on 429/5xx, with sleep and
clock injected). A cache under `tools/museum/.cache/` (JSON hops and `info.json` keyed by
object number, images keyed by IIIF id), bypassed by `--refresh`. Image download for
accepted entries. Then create `sync_prints.py` with `--dry-run`, `--list PATH` and
`--refresh`, printing one line per entry: object number, title, artist, date, type,
rights, orientation, and ok or the skip reason. Seed `prints.toml` with the verified
examples from T-02.

**Acceptance criteria:**
- [ ] A cache hit makes zero fetch calls; `--refresh` makes them again.
- [ ] Retry and backoff on 429 and 5xx are covered by tests with a fake clock; a 404 is not retried.
- [ ] `--dry-run` writes nothing outside `.cache/`, and exits 0 even when entries are skipped.

**Verification:**
- [ ] `uv run --directory tools/museum pytest`
- [ ] Manual: `uv run --directory tools/museum python sync_prints.py --dry-run` against the live API shows both ok and skip lines.

**Dependencies:** T-02 · **Scope:** M
**Tier:** standard · **Risk:** normal · **Verify:** `uv run --directory tools/museum pytest`
**Files:** tools/museum/rijks.py, tools/museum/sync_prints.py, tools/museum/prints.toml, tools/museum/tests/test_fetch.py
**Context:** SPEC.md §Module 1 (Cache, Politeness, Exit criteria), §Curation workflow, §Commands

### Checkpoint A: Source
- [ ] `uv run --directory tools/museum pytest` passes
- [ ] A live `--dry-run` shows ok, `type`, `rights` and `portrait` lines
- [ ] Human review before Phase 2

---

## Phase 2 — Rendering (`placard`)

### T-04: Art profile row and placard renderer
**Description:** Add the `spectra6-133-art` row to `tools/epaper/profiles.json` (artwork
`www/epaper13-modes/art`, `ha_dir` `local/epaper13`, `pre_filter` empty for now). Update
`test_profile.py`: the known-profiles set becomes three names, and add a test that the
art row matches `spectra6-133` in size and palette but has its own artwork folder. Build
`placard.py`:
1. Compose: a 1600×1200 white canvas, the source fitted into the 1520×1016 art area with
   a 40 px margin, never cropped.
2. Dither: `prepare_image.sh --profile spectra6-133-art <composed> <out>`.
3. Letter: render the two lines in the configured font (default Georgia; overridable by
   `PLACARD_FONT`), threshold to 1-bit, and composite onto the 144 px strip. The title is
   about 40 px; the second line is `"artist, date"` (or just the artist) at about 30 px.
   Truncate a line wider than 1520 px with `…`.

Expose `python -m placard IMAGE TITLE ARTIST DATE OUT` and a filename helper that
sanitises object numbers to `[A-Za-z0-9._-]`.

**Acceptance criteria:**
- [ ] The output is 1600×1200, its unique colours are a subset of `palette-spectra6.png`, and strip pixels are only `#000000` or `#FFFFFF`.
- [ ] A tall input and a wide input are both fitted with no crop; a long title ends in `…`.
- [ ] Both suites pass with the new row; placard tests skip with a reason when `magick` is missing.

**Verification:**
- [ ] `uv run --directory tools/museum pytest tests/test_placard.py && uv run --directory tools/epaper pytest`

**Dependencies:** T-01 · **Scope:** M
**Tier:** standard · **Risk:** normal · **Verify:** `uv run --directory tools/museum pytest tests/test_placard.py && uv run --directory tools/epaper pytest`
**Files:** tools/epaper/profiles.json, tools/epaper/tests/test_profile.py, tools/museum/placard.py, tools/museum/tests/test_placard.py
**Context:** SPEC.md §Module 2 — placard; plan.md §Findings 3, 6

### T-05: Render review: pre_filter, font, sizes
**Description:** Resolve 2 prints, 2 paintings, 2 drawings and 2 photographs (PD, landscape) through
`sync_prints.py --dry-run` and the cache, then render each through `placard` with three
pre_filter candidates: (a) empty, (b) the photo filter `-modulate 95,160
-sigmoidal-contrast 4,50%`, (c) a milder one such as `-modulate 100,120
-sigmoidal-contrast 2,50%`. Build one contact sheet and a 1:1 crop sheet, open them for
the user, and **stop for the user's choice**. Record the chosen pre_filter in the profile
row (value and description), and mark Q1 (pre_filter) and Q2 (font) resolved in the spec.
Q3 (sizes) stays open until the panel check in T-10. Change the strip or type sizes only
if the user asks.

**Acceptance criteria:**
- [ ] The contact sheet covers 8 objects × 3 candidates, each labelled.
- [ ] The user's choice is written into `profiles.json`, and Q1 and Q2 in the spec are marked resolved with the date.
- [ ] Review images live outside the repo (the session temp dir).

**Verification:**
- [ ] Manual: the user confirms the choice; `uv run --directory tools/epaper pytest` still passes.

**Dependencies:** T-03, T-04 · **Scope:** S
**Tier:** standard · **Risk:** normal · **Verify:** `manual`
**Files:** tools/epaper/profiles.json, specs/print-wall/SPEC.md
**Context:** SPEC.md §Module 2 (Choosing pre_filter), §Dithering evidence, §Open questions Q1–Q3

### Checkpoint B: Rendering
- [ ] `uv run --directory tools/museum pytest && uv run --directory tools/epaper pytest`
- [ ] Q1 and Q2 resolved; placards look right on screen
- [ ] Human review before Phase 3

---

## Phase 3 — Modes (`mode-switch`)

### T-06: `set_mode.sh` publish, record, deploy, refresh, status
**Description:** Install `shellcheck` (`brew install shellcheck`). Write
`tools/museum/set_mode.sh` (POSIX `sh`, `set -eu`), with paths resolved from the script's
own location:
- `art|photos`: refuse a missing or empty mode folder. Otherwise `rsync -a --delete
  --include='*.png' --exclude='*'` that folder into `www/epaper13/` (keeping `.gitignore`),
  run `generate_manifest.py --profile spectra6-133 --dir www/epaper13`, write
  `www/epaper13-modes/ACTIVE`, and deploy with `push_to_ha.sh --profile spectra6-133
  "$EPAPER13_DEST"`. Print the rotation-position note.
- `--refresh`: does the same for the mode named in `ACTIVE`. Refuses if `ACTIVE` is missing.
- `--status`: prints the active mode and the PNG count of each mode folder.
- `-n/--dry-run`: prints the publish delta and the deploy plan and changes nothing.
- `--no-deploy`: publishes and records the mode but skips the push.

Add `www/epaper13-modes/art/.gitignore` and `photos/.gitignore` (images, manifest,
`.managed.json`), and `www/epaper13-modes/.gitignore` (`ACTIVE`). Write a pytest harness
that copies the script into a temp tree mirroring the repo layout. Use the real
`tools/epaper` `generate_manifest.py`, `device_profile.py` and `profiles.json`, and a stub
`push_to_ha.sh` that records its arguments. **Do not run the script against the real
`www/` tree.**

**Acceptance criteria:**
- [ ] After `art` or `photos`, the live folder holds exactly that mode's PNGs, the manifest matches, `ACTIVE` is written, and the stub received `--profile spectra6-133` and the destination.
- [ ] An empty or missing mode exits non-zero and leaves the live folder byte-identical; `--dry-run` changes nothing; `--refresh` with no `ACTIVE` exits non-zero.
- [ ] `www/epaper/` in the temp tree is untouched; `shellcheck tools/museum/set_mode.sh` is clean.

**Verification:**
- [ ] `uv run --directory tools/museum pytest tests/test_set_mode.py && shellcheck tools/museum/set_mode.sh`

**Dependencies:** T-01 · **Scope:** M
**Tier:** heavy · **Risk:** normal · **Verify:** `uv run --directory tools/museum pytest tests/test_set_mode.py && shellcheck tools/museum/set_mode.sh`
**Files:** tools/museum/set_mode.sh, tools/museum/tests/test_set_mode.py, www/epaper13-modes/.gitignore, www/epaper13-modes/art/.gitignore, www/epaper13-modes/photos/.gitignore
**Context:** SPEC.md §Module 3 — mode-switch, §Boundaries; plan.md §Findings 1, 2, 5; tools/epaper/push_to_ha.sh (folder-name check, remote delete)

### T-07: `set_mode.sh --migrate`
**Description:** Add the one-time migration. If `www/epaper13-modes/photos/` holds no PNGs,
**move** (never delete) `www/epaper13/*.png` and `www/epaper13/.managed.json` into it,
write `ACTIVE=photos`, and publish without deploying. A second run is a no-op that says
so. `--migrate --dry-run` lists what would move. Tests run on temp trees only. **Do not
run `--migrate` on the real tree; T-10 does that with the user.**

**Acceptance criteria:**
- [ ] After a migration, the photos folder holds the original PNGs (byte-identical checksums) and `.managed.json`, the live folder holds the same PNGs plus a manifest, and the push stub was not called.
- [ ] A second `--migrate` changes nothing and exits 0; `--migrate --dry-run` changes nothing.
- [ ] Migrating with an empty live folder exits non-zero without writing `ACTIVE`.

**Verification:**
- [ ] `uv run --directory tools/museum pytest tests/test_set_mode.py && shellcheck tools/museum/set_mode.sh`

**Dependencies:** T-06 · **Scope:** S
**Tier:** standard · **Risk:** high · **Verify:** `uv run --directory tools/museum pytest tests/test_set_mode.py && shellcheck tools/museum/set_mode.sh`
**Files:** tools/museum/set_mode.sh, tools/museum/tests/test_set_mode.py
**Context:** SPEC.md §Module 3 (One-time migration), §Risks (migration row)

### Checkpoint C: Modes
- [ ] `uv run --directory tools/museum pytest` and `shellcheck tools/museum/*.sh` pass
- [ ] Human review before Phase 4

---

## Phase 4 — Art sync and ship (`art-sync`)

### T-08: Full `sync_prints.py` run
**Description:** Extend `sync_prints.py` past `--dry-run`:
1. Resolve every entry, logging skips.
2. Render accepted entries through `placard` into a staging dir as
   `<sanitised object number>.png`.
3. Mirror into `www/epaper13-modes/art/` with `.managed.json` semantics: a local
   `plan_deletions`, copied from the album sync's behaviour and **not imported**; adopt the
   folder on the first run; copy only changed files; delete stale managed files.
4. Regenerate the manifest last with `generate_manifest.py --profile spectra6-133-art`.
5. If `ACTIVE` reads `art` and `--no-deploy` is not set, run `set_mode.sh --refresh`.
   Otherwise print `art staged (N objects); active mode is <mode> — run set_mode.sh art to
   show them`.

Subprocesses, the resolver and the renderer are injected for tests. Log a summary line:
resolved, skipped, rendered, deleted, and deployed or staged.

**Acceptance criteria:**
- [ ] The mirror delete set, the first-run adopt rule, and a byte-identical no-op re-run (manifest included) are covered by tests; a fully cached no-op makes zero fetch calls.
- [ ] `--refresh` is invoked only when `ACTIVE=art` and `--no-deploy` is absent; with `ACTIVE=photos`, only `www/epaper13-modes/art/` changes.
- [ ] A render failure leaves the art folder and its manifest unchanged and exits non-zero.

**Verification:**
- [ ] `uv run --directory tools/museum pytest`

**Dependencies:** T-03, T-04, T-06 · **Scope:** M
**Tier:** standard · **Risk:** normal · **Verify:** `uv run --directory tools/museum pytest`
**Files:** tools/museum/sync_prints.py, tools/museum/tests/test_sync_prints.py
**Context:** SPEC.md §Module 4 — art-sync, §Boundaries; plan.md §Architecture decisions; tools/icloud/sync_album.py (`plan_deletions`, `apply_artwork`) for reference only

### T-09: READMEs
**Description:** Write `tools/museum/README.md`: the curation workflow, every command, how
modes work, the rotation-position note (Q8), the sorted-order limit (Q4), skip reasons,
and troubleshooting (rights, portrait, cache, `EPAPER13_DEST`). Add a section to
`tools/icloud/README.md` on refreshing 13" photos after the migration: the
`EPAPER_IMAGES` + `--dest "$EPAPER13_DEST"` command, then `set_mode.sh --refresh`, and
why running it without the override writes the live folder.

**Acceptance criteria:**
- [ ] Every command in SPEC.md §Commands appears in `tools/museum/README.md`.
- [ ] `tools/icloud/README.md` documents the 13" photo refresh with `--dest` and `--refresh`.

**Verification:**
- [ ] `rg -q 'set_mode.sh --refresh' tools/icloud/README.md tools/museum/README.md`

**Dependencies:** T-07, T-08 · **Scope:** S
**Tier:** light · **Risk:** normal · **Verify:** `rg -q 'set_mode.sh --refresh' tools/icloud/README.md && rg -q 'set_mode.sh --refresh' tools/museum/README.md`
**Files:** tools/museum/README.md, tools/icloud/README.md
**Context:** SPEC.md §Curation workflow, §Commands, §Module 3 (rotation position), §Open questions Q4; plan.md §Findings 1

### T-10: Hardware end-to-end
**Description:** With the user, on the real tree and the live frame:
1. Record checksums of `www/epaper/*` and `www/epaper13/*.png`.
2. Run `set_mode.sh --migrate --dry-run`, then `--migrate`, and confirm the photos
   folder checksums match the old live folder.
3. Curate about 5 objects in `prints.toml` and run `sync_prints.py` (with
   `ACTIVE=photos`, it stages).
4. Run `EPAPER13_DEST=… set_mode.sh art`, press **next** on the frame, and check that the
   placards are readable at 1 m (resolves Q3).
5. Run `set_mode.sh photos`, press **next**, and confirm photos return.
6. Re-check the `www/epaper/` checksums, and confirm the 5.65" launchd log shows normal runs.

Record results and the Q3 resolution in the spec.

**Acceptance criteria:**
- [ ] Spec success criteria 1–6 observed on hardware; Q3 marked resolved with the date.
- [ ] The `www/epaper/` checksums are identical before and after.
- [ ] HA's `/local/epaper13/` holds exactly the active mode after each switch.

**Verification:**
- [ ] Manual, with the user present at the frame.

**Dependencies:** T-05, T-07, T-08, T-09 · **Scope:** S
**Tier:** standard · **Risk:** high · **Verify:** `manual`
**Files:** tools/museum/prints.toml, specs/print-wall/SPEC.md
**Context:** SPEC.md §Testing strategy (End-to-end), §Success criteria, §Open questions Q3

### Checkpoint D: Complete
- [ ] All 7 spec success criteria met
- [ ] `uv run --directory tools/museum pytest`, `uv run --directory tools/epaper pytest`, `shellcheck tools/museum/*.sh`
- [ ] Ready for review
