# Spec: EE02 13.3" Spectra 6 Frame + Multi-Device Support

Status: **spec-approved, not yet built** · Revision 1 (2026-10-13)
Slug: `ee02-13in-spectra6`

> **What this adds.** A second art frame — Seeed XIAO ePaper Display Board EE02 + the 13.3"
> E Ink Spectra 6 panel (1200×1600, controller **T133A01**) — and the repo restructure that
> lets one ESPHome codebase serve more than one device.
>
> **Key finding (de-risks the whole thing).** Stock ESPHome already drives this panel. ESPHome
> 2026.9.0's `epaper_spi` component ships `model: t133a01` (1200×1600, 6-colour, dual-CS), so
> no custom component is needed — the same shape of win as `epaper-art-frame` Revision 2. The
> exact EE02 display block in Module 2 was run through `esphome config` on 2026.9.0 and
> **validated**, so the pins, `cs1_pin`, `enable_pin` and `busy_pin` semantics below are proven
> against the schema, not assumed.

---

## Objective

Add a second battery-powered wall display showing curated art on a 6-colour 13.3" e-paper
panel, behaving exactly like the existing 5.65" frame (wake, fetch the next image, render,
sleep ~a day), and restructure `config/esphome/` so a third device would not mean a third copy
of the pipeline.

**The user** is the same household as the existing frame. **Success** is a second frame on the
wall, fed from the same source photo set, rendered for its own panel geometry and palette, and
a repo where "add a device" means adding one file plus one profile.

### The system

| Property | Value |
|---|---|
| Board | Seeed XIAO ePaper Display Board EE02 (XIAO ESP32-S3 Plus, 60-pin FPC) |
| Display | 13.3" E Ink Spectra 6, 1200×1600, controller T133A01 (dual-CS: `CSB_M`/`CSB_S`) |
| Firmware | ESPHome ≥ 2026.9.0, stock `epaper_spi`, `model: t133a01` |
| Colours | black, white, red, yellow, green, blue (6) |
| Power | Single-cell LiPo via the EE02's JST 2.0mm connector + onboard charger + slide switch |
| Wake cycle | ~24 h sleep, ~1 min awake (drift tolerated) |
| Image source | Home Assistant `www/epaper13/` served at `/local/epaper13/` |
| Selection | `manifest.json` round-robin, index persisted across deep-sleep reboots |
| SoC memory | 16 MB flash, 8 MB octal PSRAM (`OPI PSRAM`) |

---

## Confirmed decisions (from interview)

- **Second art frame, same behaviour.** Not a dashboard; no new interaction model.
- **Per-device image profiles from one source.** One photo set, two prepared outputs
  (600×448 7-colour and 1200×1600 6-colour), two manifests, two HA folders, independent
  rotations.
- **`common/` + `devices/` ESPHome packages**, with `ESPHOME_DATA_DIR` pinned so both devices
  share one build cache.
- **Battery, ~24 h cadence**, same as the existing frame.
- **Verification:** `esphome config` + pytest for the image pipeline + a written bench checklist.
- **Boundaries** accepted as proposed (see below).

---

## Capability map

| Module id | Responsibility | Depends on |
|---|---|---|
| `multi-device-config` | Split `config/esphome/` into shared packages + per-device profiles; a device registry; per-device image profiles in `tools/epaper/`. The existing 5.65" device's behaviour must not change. | — |
| `ee02-13in-spectra6` | EE02 + 13.3" Spectra 6 device: T133A01 bring-up, deep-sleep art-frame pipeline at 1200×1600 6-colour, deployment. | `multi-device-config` |

Build order: `multi-device-config` → `ee02-13in-spectra6`

---

## Module 1 — `multi-device-config`

### The package seam

**Rule: a device file contains only what is true of that device.** Everything shared lives in
`common/` and is pulled in with `packages:`.

`common/base.yaml` — `api`, `ota`, `wifi`, `captive_portal`, `logger`, `http_request`, and
every `!secret` reference in the repo.

`common/art-frame.yaml` — the device-agnostic art-frame pipeline: `on_boot` → fetch
`manifest.json` → advance the persisted index → download the image → `component.update` →
wait for the API → `deep_sleep.enter`. Plus the `globals` (round-robin index), the two
`scripts`, the `image:` (`online_image`, `RGB565`), and the `wifi_signal` / `uptime` /
`last_image` sensors. The display id is fixed as **`epaper_display`** in every device file so
the shared pipeline can call `component.update: epaper_display`.

`devices/<device>.yaml` — `substitutions` (device name, image dir, pin map, sleep cadence),
`esp32:`, `psram:`, `spi:`, and `display:`.

**Why `display:` is not shared.** The platform, model, dimensions, and optional keys
(`cs1_pin`, `enable_pin`) differ per panel, and ESPHome list-merging across packages makes a
partially-overridden `display:` list fragile. Keeping it in the device file is explicit and
costs two duplicated lines of draw lambda. No `!remove` or substitution tricks.

### ESPHome mechanics this structure depends on

These were read out of the installed ESPHome 2026.9.0 source and are load-bearing:

- **`!secret` resolves relative to the *including* file**, falling back to the main config's
  directory **only for included files**. A `!secret` used directly in a device file would look
  for `devices/secrets.yaml` and hard-fail. → **All `!secret` use stays in `common/`**;
  `secrets.yaml` stays at `config/esphome/secrets.yaml`.
- **The build dir is derived from the main config's directory** (`config_dir/.esphome`), and
  there is no CLI flag for it — only the `ESPHOME_DATA_DIR` env var. → **Every ESPHome command
  sets `ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome"`** (run from the repo root), so both
  devices share one build cache instead of creating `devices/.esphome/`.
  **The value must be absolute** — a relative one is re-relativised against the config dir and
  doubles (`…/.esphome/build/<name>/config/esphome/.esphome/build/<name>/sdkconfig…`), failing
  the build with a `kconfgen FileNotFoundError`. Found while building P0.1.
- **`dimensions` must be a dict** for `epaper_spi` (`width:`/`height:`). The `1200x1600`
  string form is rejected by the schema — verified, not assumed.

### Device registry

The root `README.md` gains a **Devices** table — the single index of what exists:

| Device | Board | Panel | Config | Artwork | HA path |
|---|---|---|---|---|---|
| `epaper-art-frame` | Soldered NULA ESP32-S3 | 5.65" ACeP 7-colour 600×448 | `config/esphome/devices/epaper-art-frame.yaml` | `www/epaper/` | `/local/epaper/` |
| `epaper-art-frame-13in` | Seeed EE02 | 13.3" Spectra 6 1200×1600 | `config/esphome/devices/epaper-art-frame-13in.yaml` | `www/epaper13/` | `/local/epaper13/` |

The existing ESPHome node name `epaper-art-frame` is **unchanged** — it is the HA device
identity and the mDNS hostname. Only its file path changes.

### Image pipeline profiles

`tools/epaper/` gains a **profile** concept — the single source of truth for
"what a panel needs", replacing the hard-coded 600×448 / 7-colour assumptions:

| Profile | Size | Palette golden file | Artwork folder | Default? |
|---|---|---|---|---|
| `acep565` | 600×448 | `palette-acep7.png` (7 colours) | `www/epaper/` | **yes** |
| `spectra6-133` | 1200×1600 | `palette-spectra6.png` (6 colours) | `www/epaper13/` | no |

Every script takes `--profile <id>` (and `EPAPER_PROFILE`), defaulting to `acep565` so
existing invocations and the launchd iCloud sync keep working untouched. `--dir` /
`EPAPER_IMAGES` still override the folder. `sync_album.py` gains `--profile` (and
`EPAPER_PROFILE`) and passes it through to `prepare_image.sh`.

**Exit criteria:** `esphome config` passes for both device files; the existing 5.65" device's
effective config is unchanged; `prepare_image.sh` with no arguments still produces a 600×448
7-colour PNG.

---

## Module 2 — `ee02-13in-spectra6`

### Panel and driver

Stock `epaper_spi` with `model: t133a01` — a 6-colour controller IC driving a 1200×1600
panel over a **dual-CS** SPI architecture, where `CS`/`CS1` each carry half of every row's
pixel data (600 pixels per controller). Data rate 10 MHz, minimum update interval 30 s, full
refresh ~30 s.

No custom component and no `external_components:` override in v1. If the ESPHome model's init
sequence (tuned for the reTerminal E1004 wiring) turns out to be wrong for the EE02's power
rails, the fallback is a small `external_components` override — see Risks.

### Pin map (single source of truth)

Taken from Seeed's own hardware-verified Arduino board config
(`Seeed_GFX2` → `Config_XIAO_ePaper_EE02_Board` → `esp32DisplayPins(10, -1, 41)`), then
confirmed against the EE02 schematic net names and validated with `esphome config`.

| Signal | GPIO | Note |
|---|---|---|
| SPI SCLK | 7 | `D8` |
| SPI MOSI | 9 | `D10` |
| EPD CS (`CSB_M`) | 44 | |
| EPD CS1 (`CSB_S`) | 41 | required by the dual-CS T133A01 |
| EPD DC | 10 | |
| EPD RST | 38 | |
| EPD BUSY | 4 | `inverted: true` (see Open Question Q1) |
| Panel PWR_EN | 43 | `enable_pin`; driven high before init |
| Buttons 1/2/3 | 2 / 3 / 5 | not wired in v1 |
| BAT_ADC / ADC_EN | 1 / 6 | divider gated by ADC_EN (see Q3) |

### Device config

```yaml
display:
  - platform: epaper_spi
    id: epaper_display
    model: t133a01
    dimensions:
      width: 1200
      height: 1600
    cs_pin: ${cs_pin}       # GPIO44
    cs1_pin: ${cs1_pin}     # GPIO41
    dc_pin: ${dc_pin}       # GPIO10
    reset_pin: ${reset_pin} # GPIO38
    busy_pin:
      number: ${busy_pin}   # GPIO4
      inverted: true
    enable_pin: ${enable_pin}  # GPIO43
    update_interval: never
    lambda: |-
      it.fill(Color(255, 255, 255));
      it.image(0, 0, id(art_image));
```

Validated output on 2026.9.0: `data_rate: 10MHz`, `spi_mode: MODE0`, `rotation: 0`,
`full_update_every: 1`.

### Memory budget

| Allocation | Size |
|---|---|
| Panel frame buffer (1200×1600, 4 bpp) | ~960 KB |
| `online_image` decoded buffer (RGB565) | 3.84 MB |
| **Total in PSRAM** | **~4.8 MB of 8 MB** |

Feasible, and the single biggest technical risk. Must be proven at bring-up (`esphome
analyze-memory` plus a real render) before anything else is tuned.

### Image pipeline

- New palette golden file `tools/epaper/palette-spectra6.png` — exactly the 6 Spectra 6
  colours (black, white, red, yellow, green, blue), matching the codes the driver expects.
- `prepare_image.sh --profile spectra6-133` → cover-crop to 1200×1600, dither, remap to that
  palette. On-device quantisation is not used, for the same reason as the existing frame: raw
  RGB bands badly on photos.
- Artwork folder `www/epaper13/` (images + generated `manifest.json`, both git-ignored),
  pushed to the HA host's `config/www/epaper13/` and served at `/local/epaper13/`.

### Deployment

Flash over USB first, then OTA. The HA host is reached by DNS name (`server`), never `.local`
— mDNS does not resolve from the ESP.

---

## Project structure

```
config/esphome/
  common/
    base.yaml               # api, ota, wifi, captive_portal, logger, http_request
                            # the ONLY place !secret is used
    art-frame.yaml          # fetch → render → sleep pipeline; globals, scripts,
                            # online_image, sensors; calls component.update: epaper_display
  devices/
    epaper-art-frame.yaml   # 5.65" ACeP on NULA — moved, not rewritten
    epaper-art-frame-13in.yaml
    epaper-bench.yaml       # bring-up aid: no deep sleep, USB-powered
    epaper-diag.yaml        # bring-up aid: panel self-test
    nula-bringup.yaml       # bring-up aid: NULA pin/PSRAM probe
  secrets.yaml              # git-ignored; referenced only from common/
  .esphome/                 # git-ignored; shared build cache (ESPHOME_DATA_DIR)

tools/epaper/
  profiles…                 # profile table (acep565, spectra6-133)
  prepare_image.sh          # --profile; default acep565
  generate_manifest.py      # --profile; default acep565
  push_to_ha.sh             # --profile; default acep565
  palette-acep7.png         # 7-colour golden file
  palette-spectra6.png      # 6-colour golden file (new)
  tests/                    # pytest (new)
  pyproject.toml            # dev-only pytest dependency (new)
  README.md                 # document profiles

tools/icloud/
  sync_album.py             # --profile / EPAPER_PROFILE passthrough
  README.md                 # document the profile passthrough

www/epaper/                 # 5.65" artwork — images + manifest.json git-ignored
www/epaper13/               # 13.3" artwork — images + manifest.json git-ignored (new)

specs/ee02-13in-spectra6/   # this spec
```

---

## Commands

All ESPHome commands run **from the repo root** and set `ESPHOME_DATA_DIR` so the build cache
lives in one place:

```
# Validate (also validates every shared package each device pulls in)
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome config config/esphome/devices/epaper-art-frame.yaml
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome config config/esphome/devices/epaper-art-frame-13in.yaml

# Build
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome compile config/esphome/devices/epaper-art-frame-13in.yaml

# Flash (USB first, then OTA). upload does NOT recompile after a config edit.
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome upload config/esphome/devices/epaper-art-frame-13in.yaml

# Logs over the network API (the EE02's console may be USB-SERIAL-JTAG, so serial is unreliable)
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome logs config/esphome/devices/epaper-art-frame-13in.yaml --device epaper-art-frame-13in.local

# Memory check for the PSRAM budget
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome analyze-memory config/esphome/devices/epaper-art-frame-13in.yaml
```

```
# Image pipeline — 13.3" panel
tools/epaper/prepare_image.sh --profile spectra6-133 ~/Downloads/IMG_1234.HEIC
tools/epaper/generate_manifest.py --profile spectra6-133
tools/epaper/push_to_ha.sh --profile spectra6-133 user@host:/path/to/config/www/epaper13/

# Image pipeline — existing 5.65" panel (unchanged behaviour; profile is the default)
tools/epaper/prepare_image.sh ~/Downloads/IMG_1234.HEIC
python3 tools/epaper/generate_manifest.py
tools/epaper/push_to_ha.sh user@host:/path/to/config/www/epaper/

# Tests
uv run --directory tools/epaper pytest
tools/icloud/.venv/bin/python -m pytest tools/icloud/tests
```

---

## Code style

One real device file beats three paragraphs of rules:

```yaml
# config/esphome/devices/epaper-art-frame-13in.yaml
# ============================================================================
# 13.3" Spectra 6 art frame — Seeed XIAO ePaper Display Board EE02
# Panel: E Ink Spectra 6, 1200x1600, T133A01 (dual-CS)
# Driver: stock ESPHome `epaper_spi`, model `t133a01` (>= 2026.9.0).
#
# PIN MAP (single source of truth — from Seeed_GFX2 EE02 board config)
#   SPI CLK -> GPIO7   MOSI -> GPIO9   CS -> GPIO44   CS1 -> GPIO41
#   DC -> GPIO10   RST -> GPIO38   BUSY -> GPIO4 (inverted)   PWR_EN -> GPIO43
# ============================================================================

substitutions:
  device_name: epaper-art-frame-13in
  friendly_name: E-Paper Art Frame (13.3in)
  image_dir: "local/epaper13"
  clk_pin: GPIO7
  mosi_pin: GPIO9
  cs_pin: GPIO44
  cs1_pin: GPIO41
  dc_pin: GPIO10
  reset_pin: GPIO38
  busy_pin: GPIO4
  enable_pin: GPIO43
  run_duration: 180s     # backstop only — the pipeline sleeps as soon as the render returns
  sleep_duration: 24h

packages:
  base: !include ../common/base.yaml
  art_frame: !include ../common/art-frame.yaml

esp32:
  board: esp32-s3-devkitc-1
  variant: esp32s3
  flash_size: 16MB

psram:
  mode: octal
  speed: 80MHz

spi:
  clk_pin: ${clk_pin}
  mosi_pin: ${mosi_pin}

display:
  - platform: epaper_spi
    id: epaper_display
    model: t133a01
    # `dimensions` must be a dict for epaper_spi — the "1200x1600" string form is rejected.
    dimensions:
      width: 1200
      height: 1600
    cs_pin: ${cs_pin}
    cs1_pin: ${cs1_pin}
    dc_pin: ${dc_pin}
    reset_pin: ${reset_pin}
    # Q1: ESPHome's E1004 model uses inverted: true for this panel; confirm on the EE02.
    busy_pin:
      number: ${busy_pin}
      inverted: true
    enable_pin: ${enable_pin}
    update_interval: never
    lambda: |-
      it.fill(Color(255, 255, 255));
      it.image(0, 0, id(art_image));
```

Conventions:

- **Pin map lives in `substitutions:` and is referenced as `${…}` everywhere else.** No GPIO
  number appears twice.
- **Device file header is the pin map's single source of truth**, with the banner comment
  block used by the existing configs.
- **`common/` never contains a device-specific value** — no pin, no dimension, no model.
- **Comments explain *why*, not *what***: bench findings, hardware quirks, and non-obvious
  constraints (e.g. "backstop only — never cut power mid-refresh").
- **Shell scripts**: `#!/usr/bin/env sh`, `set -eu`, a `usage()` heredoc, `--`-terminated
  options, and errors to stderr with exit code 2 for usage / 1 for environment problems —
  matching `prepare_image.sh` and `push_to_ha.sh`.
- **Python**: `from __future__ import annotations`, `argparse`, `Path`, `pathlib`-first,
  docstrings that state the script's contract (e.g. "this script is the only writer of
  `manifest.json`").
- **Profiles are data, not branches.** Adding a device means adding a profile row and a device
  file — not an `if` in a script.

---

## Testing strategy

Three levels, because half of this is hardware.

**Level 1 — schema (fast, no hardware).** `esphome config` must pass for **every**
`config/esphome/devices/*.yaml`, which transitively validates both `common/` packages. A
device file that does not validate is a broken build. This is the gate that catches `!secret`
resolution mistakes and the `dimensions` dict requirement.

**Level 2 — pipeline unit tests (pytest).** In `tools/epaper/tests/`, run with
`uv run --directory tools/epaper pytest`:

- the profile table resolves to the right dimensions, palette, artwork folder and HA path per
  profile, and `acep565` is the default;
- `palette-acep7.png` and `palette-spectra6.png` contain exactly the panel's colours;
- `prepare_image.sh --profile spectra6-133` output is 1200×1600 and every pixel is a member of
  the 6-colour palette (and the default profile still yields 600×448 7-colour);
- `generate_manifest.py --check` fails on a stale manifest and passes on a fresh one.

`tools/epaper/pyproject.toml` carries a dev-only `pytest` dependency, matching the
`tools/icloud/` precedent. Tests assert behaviour, not that a name is exported.

**Level 3 — bench checklist (manual, on real hardware).** Written down, run in order, and its
results recorded back into this spec:

1. USB-flash the device config; confirm it boots and logs over the network API.
2. Render a known test pattern: all **6** colours correct, correct 1200×1600 geometry, no
   corruption, **no mirroring**.
3. Confirm BUSY polarity — if the driver times out waiting for IDLE, flip `inverted`.
4. Fetch and render a real image from HA; confirm the `Last image` sensor matches.
5. Confirm deep sleep: the device sleeps, wakes after `sleep_duration`, and the round-robin
   index advances.
6. Measure awake and sleep current; confirm the render completes before `deep_sleep.enter`.

---

## Boundaries

**Always**

- Run `esphome config` on every changed device YAML **and** the shared packages before
  committing.
- Keep the existing 5.65" device's behaviour and pin map identical through the refactor.
- Run pytest for `tools/epaper/` after any pipeline change.
- Update `README.md` and this spec when the structure changes.
- Keep per-device artwork folders git-ignored.

**Ask first**

- Changing anything in `common/` that alters the existing device's pins or behaviour.
- Bumping the pinned ESPHome version or adding a component.
- Deleting or renaming `config/esphome/epaper-art-frame.yaml` (referenced by `README.md` and
  the existing specs).
- Adding a dependency.
- Changing the HA folder layout or `push_to_ha.sh` targets.

**Never**

- Commit `secrets.yaml`, API keys, or WiFi credentials.
- Cut power mid-refresh — `deep_sleep.enter` must come after the render completes.
- Bake 600×448 or the 7-colour palette into shared code paths.
- Edit vendored `.venv/` or `.esphome/`.
- Leave a device config that fails `esphome config`.

---

## Success criteria

1. `esphome config` passes for `devices/epaper-art-frame.yaml` and
   `devices/epaper-art-frame-13in.yaml`; `esphome compile` succeeds for both.
2. **No regression:** the existing 5.65" device's effective config (pin map, display model,
   sleep cadence, HA image path) is unchanged by the refactor — proven by diffing
   `esphome config` output before and after.
3. `uv run --directory tools/epaper pytest` passes.
4. The 13.3" panel renders a known test pattern with all 6 Spectra 6 colours, correct
   1200×1600 geometry, and no mirroring.
5. A real photo renders on the 13.3" panel, the device deep-sleeps, and on the next wake it
   shows the next image in the rotation.
6. `prepare_image.sh --profile spectra6-133` produces a 1200×1600 PNG whose every pixel is one
   of the 6 panel colours, while the default profile still produces 600×448 7-colour.
7. `www/epaper13/manifest.json` plus its images are pushed to the HA host and served at
   `/local/epaper13/`.
8. Awake and sleep current are measured and recorded in the power budget below.

---

## Power budget

> Not yet measured for the 13.3" panel. The structure mirrors the existing frame's budget; the
> numbers are placeholders until bring-up step 6 fills them in. The larger panel's ~30 s full
> refresh dominates the awake window, so the refresh current is the figure that decides whether
> the 24 h cadence holds on the same battery.

| Phase | Current | Duration/day |
|---|---|---|
| Deep sleep (EE02 + XIAO ESP32-S3 Plus) | to measure | ~23 h 59 m |
| Wake: WiFi connect + fetch | to measure | ~3–5 s |
| Wake: 1200×1600 Spectra 6 refresh | to measure (~30 s blocking) | ~30 s |

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | EE02 panel BUSY polarity — ESPHome's E1004 model uses `inverted: true`; confirm on the EE02 | **Resolved P0.1** — BUSY is idle-HIGH, so `inverted: true` is correct (the driver's `is_idle_()` is `!digital_read()`) |
| Q2 | `flash_mode` for the XIAO ESP32-S3 Plus (16 MB flash + octal PSRAM): the NULA needed `qio`; Seeed's Arduino default is `dio` | **Resolved P0.1** — `qio` boots; esptool reports `Embedded PSRAM 8MB` and ESPHome logs `Size: 8192 KB` |
| Q3 | Battery divider ratio, and whether `ADC_EN` (GPIO6) must be driven high before sampling | Bench; calibrate against a multimeter |
| Q4 | Does the RGB565 image buffer (3.84 MB) + panel buffer (960 KB) fit comfortably in 8 MB PSRAM at runtime | Bench — needs the spike image served from HA |
| Q5 | Panel rotation/transform for portrait vs landscape mounting | Bench, then the enclosure decision |
| Q6 | Is the ESPHome `t133a01` init sequence (tuned for the E1004 wiring) correct for the EE02's power rails | Bench — visual confirmation of the test pattern |
| Q7 | **PWR_EN polarity** — not in the original questions. ESPHome drives `enable_pin` HIGH by default | **Resolved P0.1** — PWR_EN is **ACTIVE-LOW** (see the note below) |

> **Q7 — the bug that made the panel blank (found 2026-10-14).** The panel power switch Q10 is a
> **CJ3407 P-channel MOSFET**: a high-side P-ch switch conducts when its gate is pulled **LOW**.
> ESPHome's default drives `enable_pin` **HIGH**, which held the panel unpowered — so the driver
> happily pushed the full 960 KB frame (~3 s of SPI) and the panel never responded. Fixed with
> `enable_pin: {number: GPIO43, inverted: true}`. **Evidence:** BUSY(GPIO4) sat permanently at 1
> before the fix and toggled 1→0(≈3 s)→1 after it. This cost nothing to find only because
> `busy_pin` was temporarily omitted so the panel could be probed directly — the same trick
> `epaper-diag.yaml` uses.

---

## Non-goals

- Wiring the EE02's 3 user buttons (v1 is "same behaviour as the existing frame").
- Partial or fast refresh, multi-page, dashboards, or any trigger other than the daily timer.
- Migrating the existing 5.65" frame to a different board or panel.
- An enclosure for the 13.3" frame (specify separately if wanted, as `wooden-frame` was).
- Any change to the iCloud sync's photo-selection logic.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| PSRAM exhaustion (~4.8 MB of 8 MB for image + panel buffers) | **High** — OOM at boot or on download | Prove first at bring-up; if it fails, drop to a smaller intermediate (e.g. pre-scale/dither and a 4bpp-friendly path) rather than shipping a fragile config |
| ESPHome's `t133a01` model is tuned for the E1004 wiring, not the EE02 rails | Medium — panel does not initialise | Bench bring-up; fallback is a small `external_components` override |
| The refactor silently changes the working 5.65" frame | Medium — regression on a deployed device | Success criterion 2: byte-identical `esphome config` diff before/after |
| `!secret` used directly in a device file fails to resolve | Low — config will not validate | All `!secret` confined to `common/`; Level-1 gate catches it |
| 13.3" refresh current drains the battery faster than the 5.65" frame | Medium — cadence must change | Measure at bring-up (step 6); adjust `sleep_duration` if needed |
| Profile plumbing leaks into `sync_album.py` and breaks the launchd sync | Medium — silent sync failure | `acep565` is the default, so existing invocations are unchanged; assert it in Level-2 tests |
