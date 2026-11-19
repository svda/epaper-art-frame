# Task List: Bun / TypeScript migration

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task also has to meet the **Definition of Done** in `plan.md`. Module specs are
`../SPEC-<module>.md`.

---

## Phase 1 — workspace ([SPEC-workspace](../SPEC-workspace.md))

### T-01: Root Bun workspace with typecheck, lint and test
**Acceptance:**
- [x] Root `package.json` (workspaces `tools/*`, scripts test/typecheck/lint/format), `tsconfig.json`, `biome.json`, `node_modules/` in `.gitignore`
- [x] Dev deps only: `typescript`, `@types/bun`, `@biomejs/biome`
- [x] One smoke test passes under `bun test`

**Verify:** `bun install && bun test && bun run typecheck && bun run lint`
**Files:** `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `bun.lock` · **Deps:** none · **Size:** S

### T-02: `@frame/cli` shared helpers
**Acceptance:**
- [x] `UsageError`, `repoRoot`, `parseArgs`, `exec`/`Exec`, `parseEnvFile`, `main` as in the spec's API contract
- [x] The env-file cases from `icloud/tests/test_config.py` are ported. Exit codes are 2 for usage errors and 1 for other errors.

**Verify:** `bun test tools/cli`
**Files:** `tools/cli/package.json`, `tools/cli/src/index.ts`, `tools/cli/test/cli.test.ts` · **Deps:** T-01 · **Size:** S

### Checkpoint: Foundation
- [x] Workspace is green, and the uv projects still pass `uv run pytest`

---

## Phase 2 — epaper ([SPEC-epaper](../SPEC-epaper.md))

### T-03: Device profiles library and `profile` CLI
**Acceptance:**
- [x] `loadProfile`, `listProfiles`, `defaultProfileId`, honouring `$EPAPER_PROFILE`, with snake_case → camelCase mapping
- [x] CLI flags match `device_profile.py`: `[profile] [field]`, `--default --list --artwork --palette --json`
- [x] `test_profile.py` and `test_palettes.py` are ported

**Verify:** `bun test tools/epaper`, and diff `bun tools/epaper/src/profile.ts --json spectra6-133` against the Python output
**Files:** `tools/epaper/package.json`, `src/profile.ts`, `test/profile.test.ts`, `test/palettes.test.ts` · **Deps:** T-02 · **Size:** M

### T-04: `prepareImage` and `prepare` CLI (replaces prepare_image.sh)
**Acceptance:**
- [x] Golden `magick` argv tests for each profile × cover/fit × rotate × dither override, matching the argv that `prepare_image.sh` builds
- [x] Unknown `backend` → `UsageError`. Flags and `$EPAPER_IMAGES` behave the same as today.
- [x] Integration test (skipped without `magick`): output has the profile's dimensions and only palette colours

**Verify:** `bun test tools/epaper`. Manual: run both versions on 3 sample photos (1 HEIC) and compare the output visually.
**Files:** `src/prepare.ts`, `test/prepare.test.ts`, `test/fixtures/` · **Deps:** T-03 · **Size:** M

### T-05: `generateManifest` and `manifest` CLI
**Acceptance:**
- [x] `test_generate_manifest.py` is ported, including the HEIC-convert option (via `prepareImage`)
- [x] Golden test: the JSON is byte-identical to the Python output for the same folder

**Verify:** `bun test tools/epaper`, and diff both versions' output on `www/epaper13`
**Files:** `src/manifest.ts`, `test/manifest.test.ts` · **Deps:** T-04 · **Size:** S

### T-06: `push` and `push` CLI (replaces push_to_ha.sh)
**Acceptance:**
- [x] Same options and positional `[user@]host:/path`. ssh/scp argv go through `Exec`.
- [x] Golden argv test, and `--dry-run` prints the same command as the sh version

**Verify:** `bun test tools/epaper`. Manual: dry-run both versions and compare.
**Files:** `src/push.ts`, `test/push.test.ts` · **Deps:** T-03 · **Size:** S

### T-07: Cut over epaper and delete its Python/sh
**Acceptance:**
- [ ] Manual: prepare, manifest and push to the real 13" frame works end to end, and ESPHome loads the result — **waived by the user on 2026-11-19 ("skip hardware check"); still to do after the cutover**
- [x] Delete `*.py`, `*.sh`, `tests/`, `pyproject.toml` and `uv.lock` in `tools/epaper`. Update the README.
- [x] museum and icloud Python still work. They shell out to the old scripts, so point their path constants at `bun tools/epaper/src/*.ts` until they're ported.

**Verify:** `bun test`, plus `uv run pytest` in museum and icloud
**Files:** `tools/epaper/README.md`, `tools/museum/set_mode.sh`, `tools/museum/sync_prints.py`, `tools/icloud/sync_album.py`, deletions · **Deps:** T-04, T-05, T-06 · **Size:** M

### Checkpoint: epaper
- [ ] Real-frame run OK · review with human before Phase 3

---

## Phase 3a — icloud ([SPEC-icloud](../SPEC-icloud.md))

### T-08: Spike — read Photos.sqlite and export via osascript
**Acceptance:**
- [x] A throwaway script lists the configured album's newest N assets (uuid, date, filename, local/cloud, adjusted) from a read-only copy of Photos.sqlite. The result matches the Python `--dry-run` selection.
- [x] Exports 1 cloud-only, 1 edited and 1 shared-album photo through `osascript`, and records the timing
- [x] Findings are noted in SPEC-icloud: the schema tables used, the macOS version, and the permissions needed

**Verify:** Manual run on the real library · **Files:** `tools/icloud/spike/` (deleted in T-13), `../SPEC-icloud.md` · **Deps:** T-02 · **Size:** S
**Stop rule:** if either half fails, stop and re-spec. Don't start T-09.

### T-09: `PhotoSource` with sqlite reader
**Acceptance:**
- [x] `src/photos-db.ts` implements `PhotoSource.list(album)`, detects the schema variant and fails closed
- [x] `photos-db.test.ts` runs against a synthetic SQLite database built inside the test

**Verify:** `bun test tools/icloud` · **Files:** `tools/icloud/package.json`, `src/photo-source.ts`, `src/photos-db.ts`, `test/photos-db.test.ts` · **Deps:** T-08 · **Size:** M

### T-10: Export (copy local original, or osascript) and selection
**Acceptance:**
- [x] `test_export.py` and `test_selection.py` are ported. The local copy, the osascript path for cloud/edited photos, and the failure → reported skip are all covered with fakes.

**Verify:** `bun test tools/icloud` · **Files:** `src/export.ts`, `src/selection.ts`, `test/export.test.ts`, `test/selection.test.ts` · **Deps:** T-09 · **Size:** M

### T-11: Mirror, sync and deploy via `@frame/epaper`
**Acceptance:**
- [x] `test_mirror.py`, `test_sync.py`, `test_deploy.py` and `test_config.py` are ported
- [x] `sync-album` CLI flags match today's, and `--dry-run` writes nothing

**Verify:** `bun test tools/icloud`. Manual: `--dry-run` on the real library selects the same photos as the Python version.
**Files:** `src/mirror.ts`, `src/sync-album.ts`, `test/{mirror,sync,deploy,config}.test.ts` · **Deps:** T-10, T-07 · **Size:** M

### T-12: launchd agent rendering and install
**Acceptance:**
- [x] `test_agent.py` is ported. ProgramArguments run `bun …/sync-album.ts`.
- [x] The README documents the Full Disk Access and Automation (Photos) grants for `bun`

**Verify:** `bun test tools/icloud`, `plutil -lint` on the rendered plist · **Files:** `src/agent.ts`, `test/agent.test.ts`, `com.sander.epaper-album.plist.template`, `README.md` · **Deps:** T-11 · **Size:** S

### T-13: Cut over icloud and delete its Python
**Acceptance:**
- [ ] Manual: the installed agent runs one scheduled sync end to end on the 5.65" frame, including a cloud-only photo — **agent reinstalled 2026-11-19; its first run fails closed with EPERM until Full Disk Access (and then Automation→Photos) is granted to the bun binary**
- [x] Delete `sync_album.py`, `conftest.py`, `tests/`, `pyproject.toml`, `uv.lock`, `.python-version` and `spike/`

**Verify:** `bun test` · **Files:** deletions, `README.md` · **Deps:** T-12 · **Size:** S

### Checkpoint: icloud
- [ ] The launchd sync is live on TS · review with human

---

## Phase 3b — museum ([SPEC-museum](../SPEC-museum.md)) — parallel with 3a

### T-14: Rijksmuseum client
**Acceptance:**
- [x] `test_rijks.py` and `test_fetch.py` are ported with an injected fetcher. The cache layout, retry/backoff and hashing are unchanged. The fixtures move to `test/fixtures/` as-is.

**Verify:** `bun test tools/museum` · **Files:** `tools/museum/package.json`, `src/rijks.ts`, `test/{rijks,fetch}.test.ts`, `test/fixtures/` · **Deps:** T-07 · **Size:** M

### T-15: Placard render
**Acceptance:**
- [x] `test_placard.py` is ported. The golden `magick` argv matches `placard.py`, and the positional args are the same.

**Verify:** `bun test tools/museum` · **Files:** `src/placard.ts`, `test/placard.test.ts` · **Deps:** T-14 · **Size:** S

### T-16: `sync-prints`
**Acceptance:**
- [x] `test_sync_prints.py` is ported. `prints.toml` is read with `Bun.TOML.parse`, and the flags are `--config --set --dry-run --refresh --no-deploy`.
- [x] `--dry-run` plan output matches the Python version for the current `prints.toml`

**Verify:** `bun test tools/museum`, and diff both versions' dry-run output · **Files:** `src/sync-prints.ts`, `test/sync-prints.test.ts` · **Deps:** T-15 · **Size:** M

### T-17: `set-mode` (replaces set_mode.sh)
**Acceptance:**
- [x] `test_set_mode.py` is ported. It supports `art|photos`, `--refresh`, `--migrate`, `--status`, `-n`, `--no-deploy` and `$EPAPER13_DEST`, and calls `@frame/epaper` directly.

**Verify:** `bun test tools/museum` · **Files:** `src/set-mode.ts`, `test/set-mode.test.ts` · **Deps:** T-16 · **Size:** M

### T-18: Cut over museum and delete its Python/sh
**Acceptance:**
- [ ] Manual: `set-mode art`, then `set-mode photos`, then `--status` on the real 13" frame — **waived by the user on 2026-11-19 ("skip hardware check"); still to do after the cutover**
- [x] `record_fixtures.py` becomes `test/record-fixtures.ts`. Delete the `*.py`, `*.sh`, `conftest.py` and uv files. Update the README.

**Verify:** `bun test` · **Files:** `test/record-fixtures.ts`, `README.md`, deletions · **Deps:** T-17 · **Size:** S

### Checkpoint: museum
- [ ] Mode switching is live on TS · review with human

---

## Phase 4 — wrap-up

### T-19: Repo-wide cleanup and docs
**Acceptance:**
- [ ] No `pyproject.toml`, `uv.lock`, `*.py` or tool `*.sh` files under `tools/` (`fd -e py -e sh . tools` is empty)
- [ ] The root README documents `bun install` and every command. Decide on the single `frame` bin (open question).

**Verify:** `bun install && bun test && bun run typecheck && bun run lint` on a fresh clone · **Files:** `README.md`, `tools/*/README.md` · **Deps:** T-13, T-18 · **Size:** S

### Checkpoint: Complete
- [ ] All umbrella success criteria met · ready for review
