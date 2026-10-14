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

- Config: `esp32` (S3, 16 MB flash, octal PSRAM), `spi`, `display` with the EE02 pin map,
  `logger`, `api`, `ota`, `wifi` (via `secrets.yaml`), and a `lambda` drawing 6 colour bars plus
  geometry marks.
- Pin map from Seeed's `Seeed_GFX2` EE02 board config: CLK 7, MOSI 9, CS 44, CS1 41, DC 10,
  RST 38, BUSY 4 (`inverted: true`), PWR_EN 43.
- Do **not** add an `external_components:` source in this task.

**Acceptance criteria:**
- [ ] `esphome config` validates and `esphome compile` succeeds on ESPHome 2026.9.0.
- [ ] All **6** Spectra 6 colours render in the correct positions, correct 1200×1600 geometry,
      no corruption, **no mirroring**.
- [ ] **Q1 resolved** — BUSY polarity confirmed on the EE02 and recorded. If the driver times out
      waiting for IDLE, `inverted` is wrong; record which value is correct.
- [ ] **Q2 resolved** — the `flash_mode` / PSRAM combination that boots reliably is recorded
      (the NULA needed `qio` with octal PSRAM; Seeed's Arduino default is `dio`).
- [ ] **Q4 resolved** — `esphome analyze-memory` output captured and the PSRAM headroom after
      downloading a 1200×1600 RGB565 image is recorded. If it does not fit, the fallback
      intermediate buffer is chosen and recorded here.
- [ ] **Q6 resolved** — the upstream `t133a01` init sequence is confirmed to drive the EE02, or an
      `external_components` override is proposed (ask-first).

**Verification:**
- [ ] Photograph the rendered test pattern; compare against the expected 6-colour layout.
- [ ] Confirm no `Timeout while displaying image!` in the logs, and record `Setup display took …`.
- [ ] `esphome analyze-memory config/esphome/ee02-bringup.yaml` output pasted into the task notes.
- [ ] Q1/Q2/Q4/Q6 answers written back into `../SPEC.md`'s Open questions table.

**Dependencies:** none · **Scope:** M · **Files:** `config/esphome/ee02-bringup.yaml` (new),
`config/esphome/secrets.yaml` (git-ignored, existing).

---

### Checkpoint A — Hardware proven
- [ ] The EE02 panel renders 1200×1600 6-colour correctly from stock ESPHome.
- [ ] The image + panel buffers fit in PSRAM (or the documented fallback is chosen).
- [ ] Q1, Q2, Q4, Q6 answered and recorded.
- [ ] **Review with user** — proceed to Phase 1, or take the fallback path.

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
- [ ] `esphome config` passes for `devices/epaper-art-frame.yaml`.
- [ ] The existing 5.65" device's effective config is **unchanged** — pin map, `5.65in-f` model,
      `sleep_duration`/`run_duration`, `image_dir`, sensors — proven by diffing `esphome config`
      output against the captured baseline.
- [ ] No `!secret` appears outside `common/`.
- [ ] The device still boots and completes one wake cycle (config-diff alone is not proof).

**Verification:**
- [ ] `diff <baseline> <new esphome config output>` shows no behavioural change.
- [ ] `rg -n '!secret' config/esphome` returns hits only under `config/esphome/common/`.
- [ ] `esphome upload` + one observed wake on the existing frame.

**Dependencies:** P0.1 · **Scope:** M · **Files:** `config/esphome/common/base.yaml` (new),
`config/esphome/common/art-frame.yaml` (new),
`config/esphome/devices/epaper-art-frame.yaml` (new),
`config/esphome/epaper-art-frame.yaml` (removed).

---

### P1.2: Move the bring-up aids into `devices/`
**Description:** Move `epaper-bench.yaml`, `epaper-diag.yaml`, `nula-bringup.yaml` and P0.1's
`ee02-bringup.yaml` into `config/esphome/devices/`, and repoint their `!secret` / shared-config
needs at `common/` now that the seam exists. These stay permanent bring-up aids — they are not
part of the deployed pipeline.

**Acceptance criteria:**
- [ ] Each moved aid still passes `esphome config`, or is explicitly retired with a recorded reason.
- [ ] No `!secret` appears directly in a moved device file (it comes via `common/`).
- [ ] The `devices/` directory is now the single home of every flashable config.

**Verification:**
- [ ] `esphome config` on each of the four moved files.
- [ ] `rg -n '!secret' config/esphome/devices` returns nothing.

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
- [ ] `README.md` documents both devices and the profile-per-panel image workflow.
- [ ] No remaining reference to the old path `config/esphome/epaper-art-frame.yaml` in
      `README.md` or `specs/epaper-art-frame/SPEC.md`.
- [ ] `specs/epaper-art-frame/SPEC.md` changed **only** where it names the config path.
- [ ] README commands include `ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome"`.

**Verification:**
- [ ] `rg -n 'config/esphome/epaper-art-frame\.yaml' README.md specs/epaper-art-frame/SPEC.md`
      returns nothing.
- [ ] Walk the README's firmware commands once and confirm they run.

**Dependencies:** P1.2 · **Scope:** S · **Files:** `README.md`,
`specs/epaper-art-frame/SPEC.md` · **Ask first — editing a shipped spec.**

---

### Checkpoint B — Two devices, one codebase
- [ ] The existing frame still works, unchanged, from its new path.
- [ ] `common/` contains no device-specific value (no pin, dimension, or model).
- [ ] The registry is accurate.
- [ ] **Review with user** before Phase 2.

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
- [ ] No-argument invocations behave **exactly** as before: 600×448, 7 colours, `www/epaper/`.
- [ ] `--profile spectra6-133` produces a 1200×1600 PNG in which **every pixel** is one of the 6
      Spectra 6 colours.
- [ ] `palette-spectra6.png` contains exactly black, white, red, yellow, green, blue, each mapping
      to the code the `t133a01` driver expects.
- [ ] `EPAPER_PROFILE` is honoured, with CLI `--profile` taking precedence.
- [ ] `generate_manifest.py --check` still exits non-zero on a stale manifest.

**Verification:**
- [ ] `tools/epaper/prepare_image.sh <a real photo>` → `magick identify` reports 600×448; a
      palette-membership check reports 7 colours.
- [ ] `tools/epaper/prepare_image.sh --profile spectra6-133 <a real photo>` → 1200×1600, 6 colours.
- [ ] `tools/epaper/generate_manifest.py --profile spectra6-133 --check` on a fresh folder.

**Dependencies:** Checkpoint B · **Scope:** M · **Files:** `tools/epaper/prepare_image.sh`,
`tools/epaper/generate_manifest.py`, `tools/epaper/push_to_ha.sh`,
`tools/epaper/palette-spectra6.png` (new), `tools/epaper/README.md`.

---

### P2.2: Profile passthrough in the iCloud sync
**Description:** Add `--profile` (and `EPAPER_PROFILE`) to `tools/icloud/sync_album.py` and pass
it through to `prepare_image.sh`, so the launchd sync can target either panel. Document it in the
tool's README and `.env.example`.

**Acceptance criteria:**
- [ ] The launchd sync with no profile set behaves exactly as today (`acep565`, `www/epaper/`).
- [ ] `EPAPER_PROFILE=spectra6-133` prepares into `www/epaper13/` and regenerates that manifest.
- [ ] `--dry-run` still writes nothing.

**Verification:**
- [ ] `tools/icloud/.venv/bin/python tools/icloud/sync_album.py --dry-run` — unchanged output.
- [ ] `EPAPER_PROFILE=spectra6-133 … --dry-run` — targets `www/epaper13/`.
- [ ] `tools/icloud/.venv/bin/python -m pytest tools/icloud/tests` passes.

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
- [ ] `uv run --directory tools/epaper pytest` passes.
- [ ] Profile resolution is covered: dimensions, palette, artwork folder and HA path per profile,
      and `acep565` as the default.
- [ ] Both palette golden files are asserted to contain exactly the panel's colours.
- [ ] `generate_manifest.py --check` is covered for both stale and fresh manifests.

**Verification:**
- [ ] `uv run --directory tools/epaper pytest -q`.
- [ ] Deliberately break a profile dimension and confirm a test fails.

**Dependencies:** P2.1 · **Scope:** M · **Files:** `tools/epaper/pyproject.toml` (new),
`tools/epaper/tests/*` (new) · **Ask first — new dependency (dev-only pytest).**

---

### Checkpoint C — Pipeline serves both panels
- [ ] `prepare_image.sh` / `generate_manifest.py` / `push_to_ha.sh` work for both profiles.
- [ ] The iCloud sync is unchanged for the existing frame.
- [ ] `uv run --directory tools/epaper pytest` passes.
- [ ] **Review with user** before Phase 3.

---

## Phase 3 — EE02 device (`ee02-13in-spectra6`)

### P3.1: `devices/epaper-art-frame-13in.yaml` — real art, end to end
**Description:** Create the EE02 device on the shared structure: `substitutions` (device name,
`image_dir: local/epaper13`, pin map, cadence), `esp32`, `psram`, `spi`, the `epaper_spi` /
`t133a01` `display` block with `id: epaper_display`, and `packages:` pulling in `common/base.yaml`
and `common/art-frame.yaml`. Push the `spectra6-133` artwork to HA's `config/www/epaper13/`.

**Acceptance criteria:**
- [ ] `esphome config` validates and `esphome compile` succeeds.
- [ ] The device boots, connects to WiFi, fetches `manifest.json` from `/local/epaper13/`, and
      renders a real photo at 1200×1600.
- [ ] The render completes **before** `deep_sleep.enter` (never cut power mid-refresh).
- [ ] Two consecutive wakes show **different** images — the persisted round-robin index advances
      across the deep-sleep reboot.
- [ ] A missing or unreachable manifest logs a warning and still sleeps (no hang).

**Verification:**
- [ ] Logs show `manifest: N image(s)`, the chosen filename, and `Beginning sleep`.
- [ ] Second wake logs a different `showing i/N` and `Last image` in HA matches.
- [ ] `ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome analyze-memory
      config/esphome/devices/epaper-art-frame-13in.yaml` confirms PSRAM headroom at runtime.

**Dependencies:** Checkpoint C, P0.1 · **Scope:** M · **Files:**
`config/esphome/devices/epaper-art-frame-13in.yaml` (new), `www/epaper13/*` (artwork, git-ignored).

---

### P3.2: Battery sensor (Q3)
**Description:** Wire the EE02's battery measurement: an `adc` sensor on GPIO1 with the divider
gated by `ADC_EN` (GPIO6), driven high early in `on_boot` before sampling. Calibrate the divider
ratio against a multimeter and record it in the device YAML header.

**Acceptance criteria:**
- [ ] **Q3 resolved** — the divider ratio is recorded, and whether `ADC_EN` must be driven high
      before sampling is confirmed.
- [ ] The battery voltage reads plausibly against a multimeter (within ~5%) across two charge
      states.
- [ ] The sensor does not read a floating value when the divider is disabled.

**Verification:**
- [ ] Multimeter reading vs the reported `Battery voltage`, logged for two charge states.
- [ ] Answer written back into `../SPEC.md`'s Open questions table.

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
- [ ] A months-scale runtime estimate computed from the measured figures.
- [ ] The 24 h cadence confirmed, or a justified new cadence recorded in both the spec and the
      device file.

**Verification:**
- [ ] Multimeter (or coulomb counter) idle reading; extrapolated months figure.
- [ ] `SPEC.md` Power budget table has no placeholders left.

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

_(empty — add as bring-up turns up anything, in the style of `epaper-art-frame`'s KI-1)_
