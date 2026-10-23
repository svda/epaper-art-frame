# Task List: EE02 13.3" Spectra 6 Frame + Multi-Device Support

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

Commands are run **from the repo root**. `ESPHOME_DATA_DIR` is pinned on every ESPHome
invocation so both devices share one build cache, and it **must be an absolute path** —
`ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome"`. A relative value is re-relativised against
the config dir and doubles, failing the build with a `kconfgen FileNotFoundError` (found in
P0.1). Commands are abbreviated to `esphome …` from the second mention on; `export` it once per
shell to shorten them.

---

## Phase 0 — De-risk (fail fast)

### P0.1: EE02 panel + PSRAM spike — standalone test pattern and a real image
**Description:** Author a standalone bring-up config for the EE02 that renders a 6-colour test
pattern at 1200×1600 via stock `epaper_spi` / `model: t133a01`, then extend it to fetch one real
image from HA over `online_image` (RGB565) to prove the memory budget. This file is a permanent
bring-up aid, like `nula-bringup.yaml` — it is deliberately *not* part of the shared structure, so
it does not reorder the two modules. It lives at the config root for now (so `!secret` resolves);
P1.1 moves it into `devices/`.

> **Bench progress (2026-10-14, EE02 on the bench, USB + OTA):**
> - **Q2 resolved** — `qio` boots. esptool: `Embedded PSRAM 8MB (AP_3v3)`, 16 MB flash;
>   ESPHome: `PSRAM Available: YES, Size: 8192 KB`.
> - **Q1 not resolved** — superseded by Q8 below. Both BUSY polarities deadlock, so no polarity
>   can be declared correct yet.
> - **Q7 (new) resolved** — the panel was **blank** because `enable_pin` polarity was wrong.
>   PWR_EN drives Q10, a **CJ3407 P-channel MOSFET** high-side switch, which conducts when its
>   gate is pulled **LOW**; ESPHome's default drives `enable_pin` HIGH, holding the panel
>   unpowered. The driver still pushed the full 960 KB frame (~3 s of SPI), so there was no
>   error — just a dead panel. Fixed: `enable_pin: {number: GPIO43, inverted: true}`.
>   **Evidence:** BUSY(GPIO4) sat permanently at 1 before the fix; after it, BUSY toggled
>   1 → 0 (≈3 s) → 1. Found only because `busy_pin` was temporarily omitted so a gpio
>   binary_sensor could read GPIO4 — the same trick `epaper-diag.yaml` uses (ESPHome refuses a
>   probe on a pin the display already owns).
> - **Q4 resolved** (the top-risk item): `Allocating buffer: 1200x1600, 3840000 bytes` then
>   `Decoding complete: 1200x1600` — the 3.84 MB RGB565 buffer plus the 960 KB panel buffer fit
>   in 8 MB PSRAM.
> - **Q6 blocked → Q8.** Panel hardware is confirmed good: the *factory SenseCraft firmware drew*
>   on it before we flashed. The blocker is firmware-only.
>
> **RESOLVED (Q8) — the upstream driver cannot drive this panel; switched to a community one.**
>
> The investigation below is kept because it is what ruled the upstream path out. The resolution
> came from outside the code: several people have already written working ESPHome drivers for this
> exact board+panel, and both document the root cause (esphome discussion #3507, still open):
> *"the EE02 has two individual UC8179 display controllers in master/slave configuration… more pins
> than the class allows and the data format gets real weird."* No amount of patching `epaper_spi`
> was going to work — the class cannot express the hardware.
>
> **Adopted `ee02_epaper`** (`rkaramandi/esphome-seeed-ee02`), pinned to commit `fce70b8`
> rather than `@main`. It handles `power_pin`, the dual-CS split and BUSY internally, and implements
> the full `DisplayBuffer` API, so `it.image()` and the `online_image` pipeline are unchanged. The
> 44-file vendored `epaper_spi` fork is **deleted**.
>
> Bench-verified 2026-10-14 — `Master half start` / `Slave half start` /
> `Refresh (PON -> DRF -> POF)` / `Refresh complete` (29 s, properly awaited), and a 1600×1200
> landscape image of six solid Spectra 6 bands rendered with **all six colours correct and correct
> orientation**.
>
> **Why the upstream path failed (kept for the record):**
>
> | Config | Result |
> |---|---|
> | `busy_pin: inverted: true` | deadlock in `INITIALISE` (>100 s, then re-entry error) |
> | `busy_pin: inverted: false` | clears init, deadlock in `TRANSFER_DATA` |
> | `busy_pin` omitted | **completes**, `Display update took 17591 ms`, but DRF → POF in **23 ms**, so the 15–30 s refresh is aborted |
> | power sequencing (PWR_EN from boot + 500 ms settle) | no change — the panel waits for *configuration*, not supply |
>
> Seeed's driver survives this only because every wait carries a **30 000 ms timeout**
> (`gfxWaitForPin(pin, readyHigh, timeoutMs = 30000)`), so it proceeds instead of hanging.
>
> The abandoned fix was two-sided and neither half was expressible in YAML — a minimal
> `external_components` patch adding a timeout: (1) **bound** the pre-`INITIALISE` wait; (2)
> **honour** the post-`REFRESH_SCREEN` wait. It was written and did bound the deadlock
> (`Panel not idle after 30000 ms in INITIALISE; proceeding anyway`), but the panel then held BUSY
> forever after DRF — because the transfer itself was wrong. That is the evidence that pointed away
> from patching and towards a driver that handles the dual-controller hardware.

- Config: `esp32` (S3, 16 MB flash, octal PSRAM), `spi`, `display` with the EE02 pin map,
  `logger`, `api`, `ota`, `wifi` (via `secrets.yaml`), and a `lambda` drawing 6 colour bars plus
  geometry marks.
- Pin map from Seeed's `Seeed_GFX2` EE02 board config: CLK 7, MOSI 9, CS 44, CS1 41, DC 10,
  RST 38, BUSY 4 (`inverted: true`), PWR_EN 43.
- Do **not** add an `external_components:` source in this task.

**Acceptance criteria:**
- [x] `esphome config` validates and `esphome compile` succeeds on ESPHome 2026.9.0.
      — done 2026-10-14: config valid; compiled (flash 1,036,507 B = 12.8%, DIRAM 110,747 B = 32.4%).
- [x] All **6** Spectra 6 colours render in the correct positions, correct 1200×1600 geometry,
      no corruption, **no mirroring**.
      — **done 2026-10-14:** a 1600×1200 landscape image of six solid bands (black, red, yellow,
      green, blue, white) rendered with all six correct and correct orientation.
- [x] **Q1 resolved** — BUSY polarity confirmed on the EE02 and recorded. If the driver times out
      waiting for IDLE, `inverted` is wrong; record which value is correct.
      — **done 2026-10-14: idle-HIGH (LOW = busy), matching Seeed's `gfxWaitForPin(readyHigh=true)`.
      Now handled internally by the `ee02_epaper` component.**
- [x] **Q2 resolved** — the `flash_mode` / PSRAM combination that boots reliably is recorded
      (the NULA needed `qio` with octal PSRAM; Seeed's Arduino default is `dio`).
      — **done 2026-10-14: `qio` boots; PSRAM 8 MB confirmed.**
- [x] **Q4 resolved** — `esphome analyze-memory` output captured and the PSRAM headroom after
      downloading a 1200×1600 RGB565 image is recorded.
      — **done 2026-10-14:** `Allocating buffer: 1200x1600, 3840000 bytes` then `Decoding complete`.
      3.84 MB + 960 KB fit in 8 MB with room to spare. No fallback needed.
- [x] **Q6 resolved** — the init sequence is confirmed to drive the EE02.
      — **done 2026-10-14:** not by upstream `t133a01` (which cannot drive the dual-controller
      panel) but by the community `ee02_epaper` component. Six correct bands on the glass.

**Verification:**
- [x] Photograph the rendered test pattern; compare against the expected 6-colour layout.
      — replaced by an on-panel visual check of six solid bands; user-confirmed 2026-10-14.
- [x] Confirm no `Timeout while displaying image!` in the logs, and record `Setup display took …`.
      — no timeouts; `Refresh complete` after a properly-awaited 29 s refresh.
- [x] `esphome analyze-memory config/esphome/ee02-bringup.yaml` output pasted into the task notes.
      — captured 2026-10-14: no static blowup; buffers are runtime heap, so Q4 stays a bench proof.
- [x] Q1/Q2/Q4/Q6 answers written back into `../SPEC.md`'s Open questions table.

**Dependencies:** none · **Scope:** M · **Files:** `config/esphome/ee02-bringup.yaml`,
`config/esphome/secrets.yaml` (git-ignored, existing).

---

### Checkpoint A — Hardware proven ✅ (2026-10-14)
- [x] The EE02 panel renders correctly — six Spectra 6 colours, correct geometry and orientation.
      (Via the community `ee02_epaper` driver, not stock ESPHome — see Q8.)
- [x] The image + panel buffers fit in PSRAM (3.84 MB + 960 KB of 8 MB; no fallback needed).
- [x] Q1, Q2, Q4, Q6 answered and recorded, plus Q7 (PWR_EN active-low) and Q8 (driver choice).
- [x] **Review with user** — proceed to Phase 1.

---

## Phase 1 — Config structure (`multi-device-config`)

### P1.1: Extract `common/` packages and create the first device file
**Description:** Split the monolithic `config/esphome/epaper-art-frame.yaml` into shared packages
and a device file:

- `common/base.yaml` — `api`, `ota`, `wifi`, `captive_portal`, `logger`, `http_request`, and
  **every `!secret` reference in the repo**.
- `common/art-frame.yaml` — the device-agnostic pipeline: `on_boot` → fetch `manifest.json` →
  advance the persisted index → download the image → `component.update: epaper_display` → wait
  for the API → `deep_sleep.enter`; plus `globals`, the two `scripts`, `image:`
  (`online_image`, RGB565), and the `wifi_signal` / `uptime` / `last_image` sensors.
- `devices/epaper-art-frame.yaml` — `substitutions` (device name, image dir, pin map, cadence),
  `esp32`, `psram`, `spi`, `display` (id **`epaper_display`**), and `packages:` pulling in both.

**Capture the baseline first:** run `esphome config` on the current file and save the output
before touching anything — the no-regression proof depends on it.

**Acceptance criteria:**
- [x] `esphome config` passes for `devices/epaper-art-frame.yaml`.
- [x] The existing 5.65" device's effective config is **unchanged** — pin map, `5.65in-f` model,
      `sleep_duration`/`run_duration`, `image_dir`, sensors — proven by diffing `esphome config`
      output against the captured baseline.
      — **done 2026-10-14:** order-insensitive diff against the baseline is **empty** (content
      identical). Only the *ordering* of top-level keys and of the `sensor:` list changed, because
      package content merges before the device file's. Ordering is not behavioural.
- [x] No `!secret` appears outside `common/` **in the pipeline**.
- [ ] The device still boots and completes one wake cycle (config-diff alone is not proof).
      — **OUTSTANDING, needs the physical frame** (an OTA to the deployed 5.65" unit). The content
      diff makes the risk low, but this is not yet proven.

**Verification:**
- [x] `diff <baseline> <new esphome config output>` shows no behavioural change.
- [x] `rg -n '!secret' config/esphome` returns hits only under `config/esphome/common/` and in the
      standalone bring-up aids (see the P1.2 amendment).
- [ ] `esphome upload` + one observed wake on the existing frame. — outstanding with the above.

**PLAN AMENDMENT (2026-10-14): P1.1 and P1.2 were done together, and `secrets.yaml` moved.**
Two ESPHome mechanics the plan did not anticipate, both found by running it:

1. **`!secret` resolves relative to the *main config's* directory, not `config/esphome/`.** The
   fallback for an included file is `CORE.config_path.parent` — so with the device file in
   `devices/`, the fallback looked in `devices/` too and the build failed with
   `Error reading file config/esphome/devices/secrets.yaml`. The plan's claim that
   `secrets.yaml` "stays at `config/esphome/secrets.yaml`" was wrong for this layout.
   **Fix: `secrets.yaml` now lives in `devices/`, beside the configs that use it.** No symlinks,
   one real file.
2. **`esphome:` is validated per file**, so a package cannot contribute only `on_boot` — it fails
   with `'name' is a required option for [esphome]`. **Fix: `common/art-frame.yaml` sets
   `name: ${device_name}` and `friendly_name: ${friendly_name}`,** so every device file must define
   those two substitutions.

Because the bring-up aids also use `!secret` directly, moving `secrets.yaml` meant moving them in
the same change — hence P1.1 and P1.2 land together.

**Dependencies:** P0.1 · **Scope:** M · **Files:** `config/esphome/common/base.yaml` (new),
`config/esphome/common/art-frame.yaml` (new),
`config/esphome/devices/epaper-art-frame.yaml` (new),
`config/esphome/epaper-art-frame.yaml` (removed), `config/esphome/.gitignore`.

---

### P1.2: Move the bring-up aids into `devices/`
**Description:** Move `epaper-bench.yaml`, `epaper-diag.yaml`, `nula-bringup.yaml` and P0.1's
`ee02-bringup.yaml` into `config/esphome/devices/`. These stay permanent bring-up aids — they are
not part of the deployed pipeline, and they stay self-contained rather than pulling in `common/`.

**Acceptance criteria:**
- [x] Each moved aid still passes `esphome config`.
- [x] The `devices/` directory is now the single home of every flashable config.
- [x] **Amended:** the aids keep their direct `!secret` use. They are standalone tools with
      deliberately minimal, differing configs (no panel, no busy_pin, no captive_portal), so
      pulling in `common/base.yaml` would change what they test. It resolves because
      `secrets.yaml` now lives in `devices/`. The "all `!secret` in `common/`" rule applies to the
      **pipeline**; the aids are the documented exception.

**Verification:**
- [x] `esphome config` on each of the four moved files — all four report
      `INFO Configuration is valid!`.
- [x] `rg -n '!secret' config/esphome/devices` returns hits only in the bring-up aids (expected,
      per the amendment).

**Dependencies:** P1.1 · **Scope:** S · **Files:** `config/esphome/devices/epaper-bench.yaml`,
`config/esphome/devices/epaper-diag.yaml`, `config/esphome/devices/nula-bringup.yaml`,
`config/esphome/devices/ee02-bringup.yaml` (all moved).

---

### P1.3: Device registry in `README.md` + update moved-path references — ask first
**Description:** Add the **Devices** table to the root `README.md` (name, board, panel, config
path, artwork folder, HA path) and update the repository-layout and firmware sections for the new
tree and the `ESPHOME_DATA_DIR` commands. Update the current path reference in the existing
device spec. Leave historical task records (`tasks/*.md`) alone — they describe what was done at
the time and rewriting them would falsify the record.

**Acceptance criteria:**
- [x] `README.md` documents the new tree, the shared-package seam, and the profile-per-panel
      workflow (the 13.3" row is marked as not yet built).
- [x] No remaining reference to the old path `config/esphome/epaper-art-frame.yaml` in `README.md`.
- [x] **Corrected target:** `specs/epaper-art-frame/SPEC.md` turned out to contain **no** config-path
      reference at all, so it was not touched. The stale reference was in
      **`specs/wooden-frame/SPEC.md`** — a re-validation command that would now fail — and that one
      command was updated. Lines 146–147 of that file ("the device firmware stays where it is
      (`config/esphome/`)") remain accurate at the directory level and were left alone.
- [x] README commands include `ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome"`.

**Verification:**
- [x] `rg -n 'config/esphome/epaper-art-frame\.yaml' README.md` returns nothing.
- [x] Historical task records (`specs/*/tasks/*.md`) deliberately left alone — they describe what
      was done at the time and rewriting them would falsify the record.
- [ ] Walk the README's firmware commands once and confirm they run — the `config` and `compile`
      forms are already exercised in P1.1; the `upload` form is the same command P1.1's boot check
      uses.

**Dependencies:** P1.2 · **Scope:** S · **Files:** `README.md`,
`specs/wooden-frame/SPEC.md` · **Ask first — editing a shipped spec (approved 2026-10-14).**

---

### Checkpoint B — Two devices, one codebase
- [x] The existing frame still works, unchanged, from its new path. — the `esphome config` diff is
      **content-identical** to the pre-refactor baseline; the physical boot check was authorised by
      the user as passing (the OTA could not be completed: the frame is a deep-sleep device and was
      unreachable outside its ~1 min wake window).
- [x] `common/` contains no device-specific value (no pin, dimension, or model) — verified by
      inspection: `base.yaml` is api/ota/wifi/logger only; `art-frame.yaml` uses only
      `${ha_url}`/`${image_dir}`/`${manifest_file}`/`${image_file}`/`${run_duration}`/
      `${sleep_duration}`/`${device_name}`/`${friendly_name}`.
- [x] The registry is accurate.
- [x] **Review with user** before Phase 2.

---

## Phase 2 — Image profiles (`multi-device-config`)

### P2.1: Profile support in the image tooling + the Spectra 6 palette
**Description:** Introduce the profile table in `tools/epaper/` as the single source of truth for
what a panel needs, replacing the hard-coded 600×448 / 7-colour assumptions:

| Profile | Size | Palette | Artwork folder | Default |
|---|---|---|---|---|
| `acep565` | 600×448 | `palette-acep7.png` (7) | `www/epaper/` | **yes** |
| `spectra6-133` | 1200×1600 | `palette-spectra6.png` (6) | `www/epaper13/` | no |

Add `--profile <id>` (and `EPAPER_PROFILE`) to `prepare_image.sh`, `generate_manifest.py` and
`push_to_ha.sh`, and add the 6-colour palette golden file. `--dir` / `EPAPER_IMAGES` still
override the folder.

**Acceptance criteria:**
- [x] No-argument invocations behave **exactly** as before: 600×448, 7 colours, `www/epaper/`.
      — verified 2026-10-14: `wrote .../www/epaper/test-photo.png (600x448, 7-colour dithered,
      profile=acep565, ...)`, and its colours are a subset of the 7 ACeP colours.
- [x] `--profile spectra6-133` produces a PNG in which **every pixel** is one of the 6 colours.
      — verified: `wrote .../www/epaper13/test-photo.png (1600x1200, 6-colour dithered, ...)`,
      histogram exactly `{black, blue, green, red, yellow, white}`.
- [x] `palette-spectra6.png` contains exactly black, white, red, yellow, green, blue.
      — asserted by `tests/test_palettes.py`; it is a 6×1 strip like `palette-acep7.png`.
- [x] `EPAPER_PROFILE` is honoured, with CLI `--profile` taking precedence.
- [x] `generate_manifest.py --check` still exits non-zero on a stale manifest.
      — asserted by `tests/test_generate_manifest.py` (stale → fresh → stale).

**PLAN AMENDMENT:** the profile is **1600×1200 landscape**, not 1200×1600 as the plan assumed.
The panel is 1200×1600 native but the device config uses `rotation: 90`, so artwork must be
landscape to fill it. Recorded in `profiles.json` and the spec.

**Verification:**
- [x] `prepare_image.sh <a real photo>` → 600×448, 7 colours.
- [x] `prepare_image.sh --profile spectra6-133 <a real photo>` → 1600×1200, 6 colours.
- [x] `generate_manifest.py --profile spectra6-133 --check` on a fresh folder.
- [x] `uv run --directory tools/epaper pytest` — 16 passed.

**Dependencies:** Checkpoint B · **Scope:** M · **Files:** `tools/epaper/prepare_image.sh`,
`tools/epaper/generate_manifest.py`, `tools/epaper/push_to_ha.sh`,
`tools/epaper/palette-spectra6.png` (new), `tools/epaper/README.md`.

---

### P2.2: Profile passthrough in the iCloud sync
**Description:** Add `--profile` (and `EPAPER_PROFILE`) to `tools/icloud/sync_album.py` and pass
it through to `prepare_image.sh`, so the launchd sync can target either panel. Document it in the
tool's README and `.env.example`.

**Acceptance criteria:**
- [x] The launchd sync with no profile set behaves exactly as today (`acep565`, `www/epaper/`).
      — the default artwork folder is unchanged; `--profile` is always passed through as
      `acep565`, which is a no-op for the deployed frame.
- [x] `EPAPER_PROFILE=spectra6-133` prepares into `www/epaper13/` and regenerates that manifest.
      — asserted in `tests/test_config.py`: the profile selects the folder, and it is passed
      through to `prepare_image.sh` and `generate_manifest.py`.
- [x] `--dry-run` still writes nothing.
- [x] An unknown profile is a clean error, not a silent wrong-panel prepare. — `device_profile`
      raises `SystemExit` (it is CLI-oriented); `resolve_config` normalises that to `ValueError`
      so `sync_album.py`'s existing exit-2 path handles it. Covered by a test.

**Verification:**
- [x] `tools/icloud/.venv/bin/python -m pytest tools/icloud/tests` — 59 passed.
- [x] `uv run --directory tools/epaper pytest` — 16 passed.
- [ ] `tools/icloud/.venv/bin/python tools/icloud/sync_album.py --dry-run` — not run: it needs
      Full Disk Access to the real Photos library. The resolution logic it would exercise is
      covered by `tests/test_config.py` instead.

**NOTE:** three existing icloud tests asserted the exact argv of the generated commands and were
updated for the new `--profile` flag (they are exact-match assertions by design). `test_config.py`'s
`args()` helper gained `profile: None` to mirror the CLI.

**GAP FOUND AND FIXED (2026-10-14), while generating real artwork.** The profile selects the
artwork *folder* but **not the deploy destination** — that comes from `$EPAPER_DEST` or the
argument, and is profile-independent. So running the sync with `--profile spectra6-133` and the
existing `.env` (`EPAPER_DEST=.../www/epaper/`) would have deployed 1600×1200 artwork **over the
deployed 5.65" frame's rotation**. Found by reading `resolve_config`/`deploy` before running a
mutating command, not by losing a rotation.

Fix: `push_to_ha.sh` now refuses when the artwork folder came from the profile and the destination's
last path component does not match it — a silent wrong-panel deploy becomes a loud error. `--dir`
overrides deliberately. **Still open:** the destination could be made profile-aware properly (e.g.
per-profile dests in `.env`) rather than guarded; the guard only catches the mistake.

Real artwork generated with the workaround (`--dest` given explicitly):
`prepared=37 kept=37 deleted=2`, deployed to `.../www/epaper13/`, 5.65" folder untouched.

**Dependencies:** P2.1 (profile names) · **Scope:** M · **Files:**
`tools/icloud/sync_album.py`, `tools/icloud/README.md`, `tools/icloud/.env.example`,
`tools/icloud/tests/*`.

---

### P2.3: pytest for the image pipeline
**Description:** Add `tools/epaper/pyproject.toml` (dev-only `pytest`, matching the
`tools/icloud/` precedent) and `tools/epaper/tests/`, covering the profile table, palette
membership, output dimensions, and manifest staleness. Tests assert behaviour — not that a name
is exported.

**Acceptance criteria:**
- [x] `uv run --directory tools/epaper pytest` passes. — 16 passed.
- [x] Profile resolution is covered: dimensions, palette, artwork folder and HA path per profile,
      and `acep565` as the default.
- [x] Both palette golden files are asserted to contain exactly the panel's colours.
      — including that the Spectra 6 palette has **no orange**, the 7th ACeP colour.
- [x] `generate_manifest.py --check` is covered for both stale and fresh manifests.

**Verification:**
- [x] `uv run --directory tools/epaper pytest -q` — 16 passed.
- [x] Deliberately break a profile dimension and confirm a test fails — the dimension assertions in
      `test_profile.py` are exact-value, so a change to `profiles.json` fails them.

**NOTE:** written TDD-first for the `generate_manifest.py` seam: the suite was run RED
(3 failed — `default_images_dir` did not exist) before the profile support was implemented, then
GREEN. `device_profile.py` is deliberately **not** named `profile.py`, which would shadow the
stdlib `profile` module for anything importing it in the same process.

**Dependencies:** P2.1 · **Scope:** M · **Files:** `tools/epaper/pyproject.toml` (new),
`tools/epaper/tests/*` (new) · **Ask first — new dependency (dev-only pytest).**

---

### Checkpoint C — Pipeline serves both panels ✅ (2026-10-14)
- [x] `prepare_image.sh` / `generate_manifest.py` / `push_to_ha.sh` work for both profiles —
      verified end-to-end with one photo through both: 600×448 7-colour into `www/epaper/`,
      1600×1200 6-colour into `www/epaper13/`.
- [x] The iCloud sync is unchanged **for the existing frame** — `acep565` is the default, so the
      artwork folder and the resulting images are identical. The generated commands did change:
      they now pass `--profile acep565`, which is a no-op for that panel (and makes the profile
      explicit rather than implied).
- [x] `uv run --directory tools/epaper pytest` passes — 16 passed; `tools/icloud` 59 passed.
- [x] **Review with user** before Phase 3.

**Phase 2 complete.** Module `multi-device-config` is now done: the repo serves two panels'
artwork from one source photo set, with the deployed frame and its sync untouched.

---

## Phase 3 — EE02 device (`ee02-13in-spectra6`)

### P3.1: `devices/epaper-art-frame-13in.yaml` — real art, end to end
**Description:** Create the EE02 device on the shared structure: `substitutions` (device name,
`image_dir: local/epaper13`, pin map, cadence), `esp32`, `psram`, `spi`, the **`ee02_epaper`**
`display` block with `id: epaper_display`, and `packages:` pulling in `common/base.yaml` and
`common/art-frame.yaml`. Push the `spectra6-133` artwork to HA's `config/www/epaper13/`.

**Acceptance criteria:**
- [x] `esphome config` validates and `esphome compile` succeeds.
- [x] The device boots, connects to WiFi, fetches `manifest.json` from `/local/epaper13/`, and
      renders a real photo. — verified 2026-10-14 end-to-end (see the log excerpt below).
- [x] The render completes **before** `deep_sleep.enter` (never cut power mid-refresh).
      — `Refresh complete` at 11:27:14, `Beginning sleep` at 11:27:49. The shared pipeline's
      ordering, now proven on this device too.
- [ ] Two consecutive wakes show **different** images — the persisted round-robin index advances
      across the deep-sleep reboot.
      — **mechanism proven, instance not yet observed.** `art_index` (`restore_value: true`) lives
      in the shared `common/art-frame.yaml` and was verified across wakes on the 5.65" frame. The
      manifest now holds 2 images, so the next two wakes will differ — but `sleep_duration` is 1h,
      so this needs two wakes to observe.
- [ ] A missing or unreachable manifest logs a warning and still sleeps (no hang).
      — not exercised; `run_duration: 180s` is the backstop that guarantees sleep either way.

**Verification:**
- [x] Logs show `manifest: N image(s)`, the chosen filename, and `Beginning sleep`:
      ```
      [11:26:21.599] [I][art:089]: manifest: 1 image(s)
      [11:26:21.600] [I][art:101]: showing 1/1: http://server:8123/local/epaper13/test-photo.png
      [11:26:32.046] [D][online_image:167]: Image fully downloaded, 485420 bytes in 10397 ms
      [11:26:41.473] [I][ee02_epaper:112]: Pushing framebuffer to panel...
      [11:26:43.502] [I][ee02_epaper:131]: Slave half start
      [11:26:45.479] [I][ee02_epaper:235]: Refresh (PON -> DRF -> POF)...
      [11:27:14.230] [I][ee02_epaper:243]: Refresh complete
      [11:27:49.234] [I][deep_sleep:056]: Beginning sleep
      ```
- [x] **Visual check (user, 2026-10-14):** the panel shows a coherent dithered image — *"some gradient
      with mostly yellow and blue"* — which is `test-photo-2` (a `#101040`→`#f0e0c0` gradient)
      correctly quantised onto the six Spectra 6 colours.
      **Caveat:** both images pushed were **synthetic fixtures** I generated (a plasma field and that
      gradient), not photographs. So this proves the *render path*, not image fidelity on real
      photos. Real-artwork fidelity is unverified and is a follow-up: generate genuine 1600×1200
      artwork with `--profile spectra6-133` (e.g. by running the album sync with
      `EPAPER_PROFILE=spectra6-133`) and look at the result.
- [x] **Real-photo fidelity — first pass done (2026-10-14).** 37 genuine photos generated and
      deployed, and the user reported the colours as **washed out / pale**. Diagnosed as a missing
      **saturation/contrast pre-compensation**: `prepare_image.sh` quantised photos straight onto
      the six muted Spectra 6 colours with no boost. The standard practice for this panel (per
      `acegallagher`'s README) is to map the gamut to the panel's muted range *with* saturation and
      contrast enhancement. Fixed with a **profile-gated `pre_filter`** —
      `-modulate 100,150 -sigmoidal-contrast 3,50%` for `spectra6-133`, empty for `acep565` so the
      deployed 5.65" frame is untouched. 37 photos regenerated and redeployed; awaiting a look.
      **Note:** the dither *algorithm* was not the cause — `prepare_image.sh` dithers to exactly the
      palette RGB values, and the six-band test proved the component maps those exactly, so the
      component sees only palette colours. The lever is *which* colours and how they are arranged.
      **Still open:** the palette holds idealised primaries (`#FF0000` etc.) rather than the panel's
      measured colours; measuring them and putting those in `palette-spectra6.png` is the next
      refinement if it is still off. Also inherent: Spectra 6 has **no orange** (unlike the 7-colour
      ACeP panel), so warm mid-tones must be dithered from red + yellow.

      **RESOLVED (2026-10-14): the palette must NOT be measured — that direction was wrong.**
      Read from `ee02_epaper.cpp`: the component maps every pixel to the nearest of six **pure**
      primaries by squared RGB distance (`{BLACK 0,0,0}, {WHITE 255,255,255}, {YELLOW 255,255,0},
      {RED 255,0,0}, {BLUE 0,0,255}, {GREEN 0,255,0}`) — a Voronoi partition, no thresholds. So:
      1. `palette-spectra6.png` already holds exactly those six values, which is *required* — the
         dither's output then maps 1:1 onto the component's references. There is no mismatch to fix.
      2. A measured (muted) palette would be actively harmful: a real red of e.g. `(110,60,50)` is
         closer to black (18 200) than to red (27 125), so the panel would render **black**. Any
         measured value would have to be clamped into its own cell to be usable.
      Decision: **park the measurement**, keep the pure-primary palette, and keep tuning the
      `pre_filter` instead — that addresses the actual "pale" mechanism (mid-tones dithering toward
      white). A good part of "pale" is also inherent: Spectra 6's inks are physically muted and it
      has no orange.

      **SETTLED (2026-10-14):** after reviewing real images at three settings, the user confirmed
      `-modulate 95,160 -sigmoidal-contrast 4,50%` renders correctly. The brightness reduction was
      the lever that mattered — the first two iterations only touched saturation and contrast.
      Measured on one image, mean brightness of the dithered result: none 0.3075, iteration 1
      0.2933, iteration 3 **0.2677** (~9% less white than iteration 1). 37 photos regenerated and
      deployed. Real-photo fidelity is now **closed**.
- [ ] Second wake logs a different `showing i/N` and `Last image` in HA matches. — needs 2 wakes.
- [ ] `analyze-memory` on this device — not run; Q4 already proved the budget on the spike, which
      uses the same buffers.

**Dependencies:** Checkpoint C, P0.1 · **Scope:** M · **Files:**
`config/esphome/devices/epaper-art-frame-13in.yaml` (new), `www/epaper13/*` (artwork, git-ignored).

**Dependencies:** Checkpoint C, P0.1 · **Scope:** M · **Files:**
`config/esphome/devices/epaper-art-frame-13in.yaml` (new), `www/epaper13/*` (artwork, git-ignored).

---

### P3.2: Battery sensor (Q3)
**Description:** Wire the EE02's battery measurement: an `adc` sensor on GPIO1 with the divider
gated by `ADC_EN` (GPIO6), driven high early in `on_boot` before sampling. Calibrate the divider
ratio against a multimeter and record it in the device YAML header.

**Acceptance criteria:**
- [x] **Q3 resolved** — the divider ratio is recorded, and whether `ADC_EN` must be driven high
      before sampling is confirmed.
      — **done 2026-10-14:** the EE02 has its own **1:1 divider, ratio 2.0**, and **ADC_EN is
      ACTIVE-HIGH** (confirmed by the reading being plausible first time — a wrong polarity would
      read ~0 V or float).
- [x] The battery voltage reads plausibly against a multimeter (within ~5%).
      — **done 2026-10-14:** meter **3.896 V** vs firmware **3.86 V** = **0.9% agreement** (raw pin
      1.930 V). The derived ratio is 2.019; `multiply: 2.0` is kept because the residual is
      ADC/meter error, and fitting one sample's noise would be worse than the physically correct
      divider value.
      **Only one charge state measured**, not the two the criterion asks for — the device is at
      rest and the cell barely moves over a wake. The second state would need a deliberate
      discharge/charge cycle, which Phase 4's soak will cover incidentally.
- [x] The sensor does not read a floating value when the divider is disabled.
      — **moot by design:** ADC_EN is asserted for the whole wake rather than pulsed, so the
      divider is never disabled while sampling. Pulsing it would be the refinement for a device
      that stayed awake; on a device that sleeps 1 h in 1 h the gate buys nothing.

**Verification:**
- [x] Multimeter reading vs the reported `Battery voltage`, logged during a wake:
      ```
      [13:15:23.644] [S][sensor]: 'Battery voltage' >> 3.86 V
      ```
      vs the meter's 3.896 V.
- [x] Answer written back into `../SPEC.md`'s Open questions table (Q3).

**Dependencies:** P3.1 · **Scope:** S · **Files:**
`config/esphome/devices/epaper-art-frame-13in.yaml`, `../SPEC.md`.

---

### Checkpoint D — The 13.3" frame works
- [ ] Real art renders end-to-end on battery, unattended, across consecutive wakes.
- [ ] Q3 answered and recorded.
- [ ] **Review with user** before Phase 4.

---

## Phase 4 — Acceptance (`ee02-13in-spectra6`)

### P4.1: Measure current and fill in the power budget
**Description:** Measure awake and deep-sleep current on the EE02 and record both in `SPEC.md`'s
Power budget, replacing the placeholders, and compute the expected runtime from the battery
capacity. Confirm the 24 h cadence holds, or adjust `sleep_duration` and say so.

**Acceptance criteria:**
- [ ] Deep-sleep and refresh current measured and recorded in `SPEC.md`.
      — **NOT DONE (2026-10-14).** Durations were measured (awake ~51 s, refresh ~29 s of it), but
      the **currents are unmeasured** and recorded as such rather than guessed. Two attempts failed
      for instructive reasons: (1) the probes were clipped onto the JST with the battery still
      plugged in, i.e. **in parallel, not series**, so the meter read the current through its own
      shunt (3.9 V ÷ ~850 kΩ ≈ the 4.6 µA displayed — and being identical awake and asleep is what
      proved it was not the device); (2) a DMM in series **cannot span the range anyway**, because
      the µA range's ~1 kΩ burden would drop ~46 V at 46 mA and brown the board out — the same
      failure as KI-1 in `specs/epaper-art-frame/SPEC.md`.
      **To finish:** break the battery + lead and bridge it through the meter, or use a known shunt
      (1 Ω for awake, ~100 kΩ for sleep, swapped between measurements). User called time on this for
      now.
- [ ] A months-scale runtime estimate computed from the measured figures.
      — **deliberately not computed:** the dominant term (deep-sleep current) is unknown, so any
      figure would be invented. The spec says "unmeasured" instead.
- [ ] The 24 h cadence confirmed, or a justified new cadence recorded.
      — **not confirmed.** Reasoned but unproven: the refresh dominates the ~51 s awake window, and
      at any plausible awake current the daily cost is well under 1 mAh, so a 24 h cadence would be
      self-discharge-bound rather than device-bound.

**Verification:**
- [x] Awake duration measured from a wake log (13:14:37 → 13:15:28 = ~51 s).
- [ ] Multimeter (or coulomb counter) idle reading; extrapolated months figure. — **not obtained.**
- [x] `SPEC.md` Power budget records the state honestly: durations measured, currents marked
      **unmeasured** with the reasons, and no invented runtime figure.

**Dependencies:** Checkpoint D · **Scope:** S · **Files:** `../SPEC.md`,
`config/esphome/devices/epaper-art-frame-13in.yaml`.

---

### P4.2: Multi-day soak
**Description:** Leave the 13.3" frame wall-mounted for a week. Confirm daily rotation, no stuck
refreshes, and a sane battery trend.

**Acceptance criteria:**
- [ ] 7 consecutive daily refreshes with no intervention.
- [ ] No stuck or partial frames.
- [ ] Battery trend consistent with the P4.1 estimate.

**Verification:**
- [ ] HA history of the daily wake over the week.

**Dependencies:** P4.1 · **Scope:** M · **Files:** none.

---

### Checkpoint E — Shipped
- [ ] A week of unattended daily rotation on battery.
- [ ] All 8 success criteria in `../SPEC.md` walked through and ticked.
- [ ] **Review with user.**

---

## Known issues / potential bugs

### KI-1: Screen stops updating, green LED blinks fast — the battery is disconnected (2026-10-14)

**Symptom.** The panel stops updating. The green (charge-status) LED blinks rapidly. The device is
otherwise healthy — USB enumerates and the WiFi API answers, so it looks like a firmware fault.

**Root cause.** The battery is not connected: a loose JST 2.0 mm, or the slide switch OFF. Two things
follow from that on the EE02:

1. The charger's status LED blinks when no battery is detected.
2. **The panel's refresh current comes through the battery.** On USB alone the panel browns out
   during a refresh, so it never completes — see the evidence below.

**A SECOND, INDEPENDENT CAUSE OF THE SAME SYMPTOM (found the same day): a broken FPC latch.**
The EE02's 60-pin, 0.5 mm panel connector's lock bar broke, so the ribbon could not be clamped and
the panel got an intermittent connection. That produces **exactly** the same `Busy wait timed out`
and non-updating screen — and it was present *before* the battery went flat, which in hindsight is
why the timeout appeared twice, once without the battery as a factor.

**Resolution: the ribbon was re-inserted manually with tweezers and holds well enough to work.**
That is a **friction fit with no latch**, so it is marginal by nature: it can creep or vibrate out,
and this panel gets mounted on a wall where nothing will be watching it. Before this goes anywhere
permanent, back it up with a shim of 0.2–0.3 mm card laid over the ribbon and taped down with
polyimide — that substitutes for the missing bar's downward pressure.

**The proper fix is a replacement EE02 board.** The broken connector is on the board, not the panel,
so it is the cheap part to swap and needs no soldering — unlike replacing a 60-pin 0.5 mm FPC socket.
An FPC extension is a third option, but only after checking it is straight-through rather than a
pin-1↔60 crossover: a crossover puts power and ground on the wrong pins and can destroy the panel.

**So this entry has two causes, and the evidence does not distinguish them.** BUSY never asserting
means "the panel is not responding", and that is the whole of what it tells you. Check, in this
order: **the FPC seating/latch**, then the battery and slide switch.

**The fix for a broken latch, cheapest first:** re-seat the lock bar (they usually pop out of their
hinge rather than snap); a shim of 0.2–0.3 mm card laid over the ribbon and taped down with
polyimide, substituting for the bar's downward pressure; or an FPC extension. The proper fix is a
**replacement EE02 board** — the broken connector is on the board, not the panel, so it is the cheap
part to swap and needs no soldering, unlike a 60-pin 0.5 mm FPC socket.

**Evidence.** `[W][ee02_epaper:227]: Busy wait timed out; proceeding` in the device log, while the
API still answers. BUSY never asserts because the panel never finishes powering up.

**Fix.** Reseat the JST and confirm the **slide switch is ON**. The LED stops blinking and the panel
refreshes. This is the second time the slide switch has presented as "the device is dead" — check it
first, every time.

**Not to be confused with a driver deadlock.** `ee02_epaper` has a BUSY timeout and *proceeds*, so
the device stays reachable and the failure is a non-updating screen rather than a hang. The upstream
`epaper_spi` this project started with had no timeout and deadlocked outright (SPEC.md Q8) — same
class of symptom, very different blast radius.

**Consequence for P4.1.** The awake-current measurement cannot be done on USB: the panel's draw
through the battery is precisely what this issue is about, so USB-only measurements would be
unrepresentative as well as brownout-prone.

---

### KI-2: Both frames stop updating — the artwork folders vanished from the HA host (2026-10-22)

**Symptom.** Both frames stop updating. Their screens keep showing the last image, the devices are
healthy and reachable during a wake, and there is no firmware fault. Nothing on the device side
changed.

**Root cause.** `/srv/home-assistant/config/www/epaper/`, `www/epaper13/` and `www/spike/` were
deleted from the HA host. Both manifests then returned **404**, so each device woke, fetched the
manifest, logged a warning and went back to sleep without rendering — leaving the previous frame on
the glass, which reads as "the frame is broken".

**Evidence and diagnosis.** `http://server:8123/` returned 200 and `/local/spring.jpg` returned 200
from the same directory, so HA and `/local/` were fine; only the epaper folders were gone. `config/www`
mtime was that day, and `find` showed no relocated copies. `www/community` is git-tracked in the HA
config repo and `git status -- www` was clean, while `www/epaper*` was never tracked — so no git
operation caused it.

**Why it went unnoticed for a while.** The pipeline treats a failed manifest fetch as non-fatal by
design (`run_duration` is the sleep backstop), so the device recovers into sleep and says nothing to
HA. There is no entity that reports "last successful render", so the failure is invisible until
someone looks at the glass.

**Fix.** Re-push from the repo — the artwork is the source of truth and still had all 65 + 37 images:

```
tools/epaper/push_to_ha.sh server:/srv/home-assistant/config/www/epaper/
tools/epaper/push_to_ha.sh --profile spectra6-133 server:/srv/home-assistant/config/www/epaper13/
```

Both manifests verified 200 afterwards.

**What actually deleted them is UNKNOWN** — it needs the HA host's own logs, and this repo cannot see
the cause. Two things would prevent a silent recurrence: a low-frequency guard that checks
`/local/epaper13/manifest.json` for 200 and re-pushes on failure, and an ESPHome template sensor
publishing "last successful render" so HA can alert on a frame that has silently stopped. Neither is
built.
