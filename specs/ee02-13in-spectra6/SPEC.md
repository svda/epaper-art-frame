# Spec: EE02 13.3" Spectra 6 Frame + Multi-Device Support

Status: **spec-approved, not yet built** · Revision 1 (2026-10-13)
Slug: `ee02-13in-spectra6`

> **What this adds.** A second art frame — Seeed XIAO ePaper Display Board EE02 + the 13.3"
> E Ink Spectra 6 panel (1200×1600, controller **T133A01**) — and the repo restructure that
> lets one ESPHome codebase serve more than one device.
>
> **Revision 2 (2026-10-14) — the driver claim in Revision 1 was wrong.** Revision 1 assumed stock
> ESPHome could drive this panel via `epaper_spi` / `model: t133a01`, because that model exists and
> the display block validated against the schema. Schema validity is not capability: the panel is
> **two UC8179 controllers in master/slave**, needing a dual-CS pin *pair* and a data format the
> `epaper_spi` class cannot express. The driver ran, pushed the full frame, and rendered nothing.
> Upstream support was requested in **esphome discussion #3507** and remains **open**.
>
> The device now uses the community **`ee02_epaper`** component
> (`rkaramandi/esphome-seeed-ee02`), pinned to a commit SHA, which is the only driver observed to
> work on this board+panel. It implements the full `DisplayBuffer` API, so the art-frame pipeline is
> unaffected. Bench-verified 2026-10-14: six correct Spectra 6 bands on the glass.
>
> **Revision 3 (2026-11-16) — the cadence is three refreshes a day, at fixed local times.** The
> frame now shows a new image at **06:00, 12:00 and 18:00** instead of every ~24 h, so the wall
> changes with breakfast, lunch and dinner. The pipeline sleeps to the next slot (`wake_hours` in
> `common/art-frame.yaml`), using SNTP for the clock — Home Assistant's API clock was tried first
> and abandoned: the device is only awake ~50 s, HA's client is not reliably connected inside that
> window, and `request_time()` is answered by whichever client connected first (an `esphome logs`
> session beats HA), so the schedule silently fell back to the fixed duration. SNTP syncs within a
> second of WiFi coming up. `sleep_duration` survives only as the fallback when the clock cannot
> sync. The 5.65" frame keeps its fixed cadence (`wake_hours: ""`). Cost: ~3× the awake
> window per day (~51 s each, so ~2.5 min total), still small against the cell's self-discharge,
> and 3× the panel refreshes.

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
| Display | 13.3" E Ink Spectra 6, 1200×1600, module marking T133A01 — **two UC8179 controllers in master/slave** (dual-CS) |
| Firmware | ESPHome ≥ 2026.9.0 + the community **`ee02_epaper`** external component, pinned to a commit SHA |
| Colours | black, white, red, yellow, green, blue (6) |
| Power | Single-cell LiPo via the EE02's JST 2.0mm connector + onboard charger + slide switch |
| Wake cycle | 06:00 / 12:00 / 18:00 local, ~1 min awake (Rev 3; was ~24 h) |
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
- **The panel driver is a community external component**, pinned by commit SHA. `ee02_epaper`
  handles `power_pin`, the dual-CS split and BUSY polarity internally, so those do not appear in the
  device config. Upstream `epaper_spi` cannot drive this panel — see the Q8 note.

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

The community **`ee02_epaper`** external component (`rkaramandi/esphome-seeed-ee02`), pinned to
commit `fce70b8`. The panel is **two UC8179 controllers in master/slave** — each carries half of
every row (300 bytes per controller per row) — and this component handles the dual-CS split, the
panel power pin and BUSY polarity internally. Full refresh ~29 s (bench-measured). It implements the
full `DisplayBuffer` API, so the drawing lambda and `online_image` pipeline are unchanged.

**Upstream `epaper_spi` cannot drive this panel.** `model: t133a01` validates against the schema and
will run — pushing the whole frame and reporting no error — but renders nothing, because the
`epaper_spi` class cannot express the second chip-select or the split data format. Upstream support
was requested in **esphome discussion #3507** and remains open. Revision 1 of this spec wrongly
assumed schema validity implied capability; see the Q8 note.

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
| Buttons prev / next | 2 / 3 | ext1 deep-sleep wake (active-LOW); button 3 (GPIO5) unwired — see [ee02-buttons](../ee02-buttons/SPEC.md) |
| BAT_ADC / ADC_EN | 1 / 6 | divider gated by ADC_EN (see Q3) |

### Device config

```yaml
external_components:
  - source:
      type: git
      url: https://github.com/rkaramandi/esphome-seeed-ee02
      ref: fce70b800fa7e7b57114bc8d46a1b665d86ae720   # pinned, not @main
    components: [ee02_epaper]
    refresh: 1d

display:
  - platform: ee02_epaper
    id: epaper_display
    cs_master_pin: ${cs_master_pin}  # GPIO44
    cs_slave_pin: ${cs_slave_pin}    # GPIO41
    dc_pin: ${dc_pin}                # GPIO10
    busy_pin: ${busy_pin}            # GPIO4  (polarity handled internally)
    reset_pin: ${reset_pin}          # GPIO38
    power_pin: ${power_pin}          # GPIO43 (PWR_EN, active-low, handled internally)
    rotation: 90                     # native 1200x1600 portrait -> 1600x1200 landscape
    update_interval: never
    lambda: |-
      it.fill(Color(255, 255, 255));   # REQUIRED: the buffer is not white by default
      it.image(0, 0, id(art_image));
```

Validated output on 2026.9.0: the component logs `Master half start` / `Slave half start` /
`Refresh (PON -> DRF -> POF)` / `Refresh complete`.

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
  **It must hold the six PURE primaries** (`#FF0000`, `#0000FF`, `#00FF00`, …), not measured
  colours: the `ee02_epaper` component quantises every pixel to the nearest of six pure primaries
  by squared RGB distance (a Voronoi partition, no thresholds), so the palette has to equal those
  references for the dither's output to map 1:1. A measured muted colour can fall into another
  colour's cell — a real red of `(110,60,50)` is closer to black than to red, and would render black.
- **Per-profile `pre_filter`** (`profiles.json`), applied by `prepare_image.sh` *before* the
  dither. Spectra 6's inks are physically muted, so photos quantised straight onto the palette look
  washed out; `spectra6-133` uses `-modulate 95,160 -sigmoidal-contrast 4,50%` (brightness,
  saturation, contrast), settled by eye across real images. `acep565` has none — that frame renders
  fine as-is, so the deployed 5.65" device is untouched.
- **Dither method is a profile field too** (`dither`). Both panels use **FloydSteinberg**.
  **Riemersma was tried and rejected (2026-10-14):** it measured worse on both a synthetic and a
  real image — +59% black and −29% green on the former; on a real photo it gave 0.9% green against
  11% yellow. The user confirmed it on the panel: *"way worse"*.
- **Yellow-vibrant / green-dark is the panel's gamut, not the prep.** On Spectra 6, yellow is a
  light ink and green a notably darker one, so green areas read near-black at distance while yellow
  pops. Measured: raising `sigmoidal-contrast` from 2 to 4 changes green by only −1.3% while cutting
  yellow 14.5% and adding black 9.6% — so no prep lever recovers green, and lowering contrast would
  make the yellow complaint *worse*. Accepted as a hardware characteristic; tuning stopped here.

> **COLOUR INVESTIGATION CLOSED (2026-10-14): the panel forces a yellow-or-green choice.**
> A `dither` + `backend` field exists in `profiles.json`, and an
> `OpenDisplay/epaper-dithering` backend (`tools/epaper/dither.py`, a Rust-cored library) was
> built and measured end to end. The findings, all measured on one real photo:
>
> | variant | black | white | **yellow** | red | blue | **green** |
> |---|---|---|---|---|---|---|
> | **magick + pre_filter (CHOSEN)** | 26.3 | 16.2 | **13.4** | 21.5 | 13.6 | 9.0 |
> | library, OKLab + idealised palette | 12.6 | 22.0 | **1.0** | 27.1 | 16.8 | **20.4** |
> | library, mid-tone yellow `(215,205,0)` | 16.9 | 13.1 | **37.6** | 6.6 | 25.7 | **0.1** |
>
> - **The library's OKLab matching fixes green** (9.0 → 20.4%) but **collapses yellow**
>   (13.4 → 1.0%). Since yellow is one of only two bright inks here, that reads as a *dark*
>   image — the user's verdict, twice, at neutral and at the earlier `exposure: 0.9`.
> - **The library's `tone`/`gamut` kwargs are no-ops** for idealised palettes: four variants
>   (plain, tone, gamut, both) produced byte-identical output. So they were never the lever.
> - **Forcing yellow back is a cliff, not a knob.** A mid-tone yellow reference swings yellow
>   1% → 38% while green 20% → **0%**, and red collapses to 6.6%. Verified that the custom
>   palette still mapped to the correct ink codes, so this is *usage*, not the driver.
> - **A measured (calibrated) palette was worse still:** its mid-grey white reference
>   `(168,180,182)` swallowed every mid-to-light mid-tone, giving **37% white** on the panel.
>   The component fork made to support it was reverted.
>
> **So: OKLab picks green where ImageMagick's sRGB matching picks yellow, and this six-ink panel
> cannot have both.** The brighter, yellower rendering was chosen. The library backend and its
> helper remain in the tree, inert, documented here, one `backend` value away from being
> re-enabled — with its dependency (`epaper-dithering`) still declared, since `dither.py` needs
> it and DBS refinement was never tried.
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
# Panel: E Ink Spectra 6, 1200x1600, T133A01 — two UC8179 controllers, master/slave
# Driver: community `ee02_epaper` external component, pinned to a commit SHA.
#         Upstream epaper_spi CANNOT drive this panel (esphome discussion #3507).
#
# PIN MAP (single source of truth — from Seeed_GFX2 EE02 board config)
#   SPI CLK -> GPIO7   MOSI -> GPIO9   CS master -> GPIO44   CS slave -> GPIO41
#   DC -> GPIO10   RST -> GPIO38   BUSY -> GPIO4   PWR_EN -> GPIO43 (active-low)
# ============================================================================

substitutions:
  device_name: epaper-art-frame-13in
  friendly_name: E-Paper Art Frame (13.3in)
  image_dir: "local/epaper13"
  clk_pin: GPIO7
  mosi_pin: GPIO9
  cs_master_pin: GPIO44
  cs_slave_pin: GPIO41
  dc_pin: GPIO10
  reset_pin: GPIO38
  busy_pin: GPIO4
  power_pin: GPIO43
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
  - platform: ee02_epaper
    id: epaper_display
    cs_master_pin: ${cs_master_pin}
    cs_slave_pin: ${cs_slave_pin}
    dc_pin: ${dc_pin}
    reset_pin: ${reset_pin}
    busy_pin: ${busy_pin}
    power_pin: ${power_pin}
    rotation: 90           # native 1200x1600 portrait -> 1600x1200 landscape
    update_interval: never
    lambda: |-
      it.fill(Color(255, 255, 255));   # REQUIRED: the buffer is not white by default
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

> **Partially measured (2026-10-14, P4.1).** The **durations are measured**; the **currents are
> not**, and no runtime estimate is given, because the dominant term — deep-sleep current — is
> unknown. Recording "unmeasured" beats recording a number we don't trust.

| Phase | Current | Duration/day |
|---|---|---|
| Deep sleep (EE02 + XIAO ESP32-S3 Plus) | **unmeasured** | ~23 h 59 m |
| Wake: WiFi connect + fetch + download | unmeasured | ~21 s (measured) |
| Wake: 1200×1600 Spectra 6 refresh | unmeasured | **~29 s (measured)** |
| **Total awake** | unmeasured | **~51 s (measured)** |

Measured from a wake log:

```
13:14:37  first log line (device already up)
13:14:41  image fully downloaded (10.2 s)
13:15:23  Refresh complete
13:15:28  Beginning sleep
```

So the panel refresh alone is **~29 s of the ~51 s awake** — it dominates the awake window, as
predicted. If the awake current is in the tens of mA (the expected order), the daily cost is well
under 1 mAh, and a 24 h cadence is limited by cell self-discharge rather than by the device.

**Why the currents are unmeasured.** Two attempts failed for instructive reasons:

1. **Meter in parallel, not series.** The probes were clipped onto the JST with the battery still
   plugged in, so the meter measured the current through *its own* shunt — 3.9 V ÷ ~850 kΩ ≈ the
   4.6 µA it displayed. Being identical awake and asleep was the giveaway: the reading was
   state-independent, so it could not have been the device.
2. **A DMM in series cannot span the range anyway.** On the µA range the burden resistance (~1 kΩ)
   would drop ~46 V at an awake current of 46 mA, browning the board out. That is the same failure
   recorded as KI-1 in `specs/epaper-art-frame/SPEC.md`, where an interrupted refresh left the panel
   stuck mid-cycle.

**To finish it**, either break the battery + lead and bridge it through the meter (the only path must
be through the meter), or insert a known shunt and measure the voltage across it — 1 Ω for the awake
figure (46 mA → 46 mV), ~100 kΩ for the sleep figure (4.6 µA → 0.46 V), the two swapped between
measurements since no single shunt covers a 10 000:1 range. A USB-C inline meter works for the awake
figure only; on USB the board's own quiescent dominates what the battery path would show.

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | EE02 panel BUSY polarity — ESPHome's E1004 model uses `inverted: true`; confirm on the EE02 | **Resolved** — BUSY is idle-HIGH (LOW = busy); handled inside `ee02_epaper` |
| Q2 | `flash_mode` for the XIAO ESP32-S3 Plus (16 MB flash + octal PSRAM): the NULA needed `qio`; Seeed's Arduino default is `dio` | **Resolved P0.1** — `qio` boots; esptool reports `Embedded PSRAM 8MB` and ESPHome logs `Size: 8192 KB` |
| Q3 | Battery divider ratio, and whether `ADC_EN` (GPIO6) must be driven high before sampling | **Resolved P3.2** — the EE02 has its own **1:1 divider (ratio 2.0)**, and **ADC_EN is ACTIVE-HIGH**. Meter 3.896 V vs firmware 3.86 V (raw pin 1.930 V) — 0.9% agreement, so 2.0 is kept rather than fitting a single sample's noise |
| Q4 | Does the RGB565 image buffer (3.84 MB) + panel buffer (960 KB) fit comfortably in 8 MB PSRAM at runtime | **Resolved P0.1** — `Allocating buffer: 1200x1600, 3840000 bytes` then `Decoding complete` |
| Q5 | Panel rotation/transform for portrait vs landscape mounting | **Provisionally resolved** — `rotation: 90` renders the native 1200×1600 as landscape 1600×1200 with correct orientation (bench, six-band test). Confirm against the enclosure |
| Q6 | Is the upstream `t133a01` init sequence correct for the EE02's power rails | **Resolved** — not by upstream; by the `ee02_epaper` component. Six correct Spectra 6 bands on the glass |
| Q7 | **PWR_EN polarity** — not in the original questions. ESPHome drives `enable_pin` HIGH by default | **Resolved P0.1** — PWR_EN is **ACTIVE-LOW** (see the note below) |
| Q8 | **Which driver can actually run this panel** — upstream `epaper_spi` cannot (dual-controller) | **Resolved** — community `ee02_epaper`, pinned to a SHA (see the Q8 note below) |

> **Q7 — the bug that made the panel blank (found 2026-10-14).** The panel power switch Q10 is a
> **CJ3407 P-channel MOSFET**: a high-side P-ch switch conducts when its gate is pulled **LOW**.
> ESPHome's default drives `enable_pin` **HIGH**, which held the panel unpowered — so the driver
> happily pushed the full 960 KB frame and the panel never responded. Fixed with
> `enable_pin: {number: GPIO43, inverted: true}`. **Evidence:** BUSY(GPIO4) sat permanently at 1
> before the fix and toggled 1→0(≈3 s)→1 after it.

> **Q8 — the wall P0.1 hit (2026-10-14), and the risk the plan flagged.** With the panel correctly
> powered, the driver deadlocks in **both** BUSY polarities, and never renders:
>
> | `busy_pin` | Result |
> |---|---|
> | `inverted: true` (idle = HIGH) | stuck in `INITIALISE` — `Waiting for idle in state INITIALISE`, forever |
> | `inverted: false` (idle = LOW) | clears `INITIALISE`, runs the whole init sequence (`0x74, 0xF0, 0x00, 0xA5, 0x50, 0x60, 0x86, 0xE3, 0x61, 0x01, 0xB6, 0x06, 0xB7, 0x05, 0xB0, 0xB1`), then stuck in `TRANSFER_DATA` |
>
> Read together: BUSY is **LOW after reset** and goes **HIGH once the init commands land** — the
> panel only becomes ready *after* the init sequence, while `EPaperBase::process_state_()` waits
> for idle *before* `INITIALISE` sends it. `is_idle_()` is `!busy_pin_->digital_read()`, and the
> wait has **no timeout**, so it blocks forever either way.
>
> The difference from Seeed's driver is timeouts, not pins or sequence: their init sequence matches
> ESPHome's command-for-command, and their `gfxWaitForPin(pin, readyHigh, timeoutMs = 30000)`
> proceeds after 30 s instead of hanging.
>
> **This is the plan's flagged risk realised** — *"ESPHome's `t133a01` model is tuned for the
> reTerminal E1004 wiring, not the EE02 rails"* — with the documented fallback being a small
> `external_components` override. **Ask-first.**
>
> **Power sequencing does not fix it (tried 2026-10-14).** Asserting PWR_EN from boot (a gpio
> switch on GPIO43, `restore_mode: ALWAYS_ON`) so the rails settle 500 ms before the driver's RESET
> pulse did not help: `INITIALISE` still blocked, for ~14 s in that run and >100 s earlier. That is
> expected in hindsight — the panel is waiting for its *configuration*, not its supply.
>
> **The decisive evidence is in Seeed's own driver.** `Driver_T133A01::reset()` is
> `delay(20); delay(20); busyWait();`, and `busyWait()` → `waitForReadyPin(pin, true)` carries a
> **30 000 ms timeout**. So Seeed meets the *same* never-ready condition and simply **proceeds after
> 30 s**. The panel only signals ready *after* the init sequence; ESPHome waits for ready *before*
> sending it, and its wait has no timeout. Nothing in the config can express "don't wait" — this
> needs a code fix: an `external_components` patch adding a timeout, or an upstream change.
>
> **Omitting `busy_pin` completes the cycle but aborts the refresh (tried 2026-10-14).** With no
> BUSY feedback at all, the driver runs the whole sequence in one pass and logs
> `Display update took 17591 ms` — `TRANSFER_DATA → POWER_ON → REFRESH_SCREEN → POWER_OFF →
> DEEP_SLEEP → IDLE`. But **DRF is followed by POF just 23 ms later** (`09:08:08.411` →
> `09:08:08.434`), so the panel's 15–30 s refresh is cut off almost immediately.
>
> **So the fix is precisely two-sided, and neither half is config-expressible:**
> 1. the pre-`INITIALISE` idle wait must be **bounded** — the panel is never ready before init;
> 2. the post-`REFRESH_SCREEN` idle wait must be **honoured** — it is the only signal that the
>    15–30 s refresh has finished, and the panel asserts BUSY throughout it.
>
> Seeed's driver gets this right by construction: a 30 s timeout on *every* wait. A minimal
> `external_components` patch therefore only needs a timeout added — it must **not** simply drop
> `busy_pin` back out, which is the aborted-refresh failure mode above.
>
> **The patch was written and is CORRECT BUT INSUFFICIENT (2026-10-14).** `config/esphome/components/`
> now carries a vendored `epaper_spi` (against ESPHome 2026.9.0) with the pre-`INITIALISE` wait
> bounded at 30 s, mirroring Seeed. It does exactly what it was built to do:
>
> ```
> [10:22:54.729][W][epaper_spi:169]: Panel not idle after 30000 ms in INITIALISE; proceeding anyway
> ```
>
> …after which the driver completed `INITIALISE → TRANSFER_DATA → POWER_ON → REFRESH_SCREEN`. **But
> the panel then holds BUSY busy forever after DRF** — still `Waiting for idle in state
> REFRESH_SCREEN` 3.5 minutes later, so the refresh never completes and nothing renders.
>
> **What that narrows it to.** BUSY semantics are now consistent — **LOW = busy, HIGH = idle**,
> matching Seeed's `gfxWaitForPin(readyHigh=true)`. The panel is busy after reset *and* again after
> DRF, and **neither busy period ever ends on its own**. Combined with the factory firmware drawing
> correctly, the panel is most likely **faulting** on our sequence rather than merely timing out.
> Remaining candidates, none of which logs alone can rank:
>
> - the transfer's CS/CS1 half-mapping (600 px per controller) being wrong for this panel revision;
> - an init value the EE02's panel dislikes (the sequence is copied from the E1004 model);
> - a rail/power sequencing difference the driver doesn't reproduce.
>
> **RESOLVED — use a community driver (2026-10-14).** The comparison test that settled it was not
> another flash: it was finding that **several people have already written working ESPHome drivers
> for this exact board+panel**. Both `rkaramandi/esphome-seeed-ee02` and `acegallagher/esphome-bigink`
> document the same root cause as esphome discussion #3507: *"the EE02 has two individual UC8179
> display controllers in master/slave configuration… more pins than the class allows and the data
> format gets real weird."* That is why no amount of patching `epaper_spi` was going to work — the
> model cannot express the hardware.
>
> The device now uses **`ee02_epaper`** (`rkaramandi/esphome-seeed-ee02`), pinned to commit
> `fce70b8` rather than `@main`. It handles `power_pin`, the dual-CS split and BUSY internally, and
> implements the full `DisplayBuffer` API — so `it.image()` and the `online_image` pipeline are
> unchanged. The 44-file vendored `epaper_spi` fork is **deleted**.
>
> Bench-verified 2026-10-14:
> ```
> Pushing framebuffer to panel...
> Master half start        <- dual-CS: master half
> Slave half start         <- dual-CS: slave half
> Refresh (PON -> DRF -> POF)...
> Refresh complete         <- 29 s, properly awaited
> Framebuffer push complete
> ```
> A 1600×1200 landscape image of six solid Spectra 6 bands rendered with **all six colours correct
> and correct orientation**.
>
> **Trade-off accepted:** a third-party component is a supply-chain and maintenance dependency. It is
> pinned to a SHA for reproducibility, and the fallback if it rots is to upstream a dual-controller
> model (esphome #3507) or vendor it ourselves.
>
> **VENDORED AND PATCHED (2026-10-14): the component's colour reference table was the bottleneck.**
> `config/esphome/components/ee02_epaper/` is now a local copy (of `rkaramandi/esphome-seeed-ee02`
> @ `fce70b8`) with one change: `color_to_e6_`'s reference table switched from the idealised pure
> primaries to the **measured** Spectra 6 palette, taken from `OpenDisplay/epaper-dithering`'s
> `SPECTRA_7_3_6COLOR_V2`:
>
> ```
> black (31,24,41)   white (168,180,182)   yellow (180,173,0)
> red  (113,24,19)   blue   (36,70,139)    green  (50,84,60)
> ```
>
> **Why.** The component quantises every pixel to the nearest reference colour. With the pure table a
> calibrated dither is re-quantised and muted colours land on the wrong codes — a measured red
> `(113,24,19)` is nearer black (7 208) than red (21 101), so the panel rendered **black**. Measured
> through the old table, a real photo gave **0.0% red and 0.0% green** with black at 50–65%; the
> library's whole value (OKLab perceptual matching, tone + gamut compression, DBS refinement) is lost
> unless the driver agrees on the palette.
>
> **Note the library ships both palettes:** `ColorScheme.BWGBRY` is Spectra 6 with the idealised pure
> primaries — identical to what the component had — which is why the incompatibility was invisible
> until calibrated output was fed through it.
>
> The existing ImageMagick/pure-primary output still maps correctly through the new table (a pure
> `(255,0,0)` is still nearest measured red), so the device remains functional throughout.
> **Still to do:** wire `epaper-dithering` into `prepare_image.sh` for this profile so the dither
> actually emits the measured palette, then A/B on the panel. `uv add epaper-dithering` for
> `tools/epaper` is the first step.
>
> **Fourth relative-path trap in this repo, worth knowing:** `external_components`'s local `path` is
> resolved against **the including config file's** directory, not the config root — `path: components`
> in `devices/*.yaml` looks for `devices/components` and fails. It must be `../components`. Same rule
> as `!secret` (main config's dir) and `ESPHOME_DATA_DIR` (must be absolute).

---

## Non-goals

- Wiring the EE02's third user button (GPIO5), or any button use beyond previous/next — see
  [ee02-buttons](../ee02-buttons/SPEC.md).
- Partial or fast refresh, multi-page, or dashboards.
- Migrating the existing 5.65" frame to a different board or panel.
- An enclosure for the 13.3" frame (specify separately if wanted, as `wooden-frame` was).
- Any change to the iCloud sync's photo-selection logic.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| PSRAM exhaustion (~4.8 MB of 8 MB for image + panel buffers) | **High** — OOM at boot or on download | Prove first at bring-up; if it fails, drop to a smaller intermediate (e.g. pre-scale/dither and a 4bpp-friendly path) rather than shipping a fragile config |
| **REALISED** — upstream `epaper_spi` / `model: t133a01` cannot drive this panel at all: it is two UC8179 controllers in master/slave, needing a dual-CS pin pair the class cannot express | **High** — the driver runs, pushes the whole frame, reports no error, and renders nothing | Resolved by adopting the community `ee02_epaper` component, pinned to a SHA (Q8) |
| Third-party component dependency (`ee02_epaper`) | Medium — supply chain and maintenance | Pinned to a commit SHA, not `@main`; fallback is to upstream a dual-controller model (esphome #3507) or vendor it ourselves |
| The refactor silently changes the working 5.65" frame | Medium — regression on a deployed device | Success criterion 2: byte-identical `esphome config` diff before/after |
| `!secret` used directly in a device file fails to resolve | Low — config will not validate | All `!secret` confined to `common/`; Level-1 gate catches it |
| 13.3" refresh current drains the battery faster than the 5.65" frame | Medium — cadence must change | Measure at bring-up (step 6); adjust `sleep_duration` if needed |
| Profile plumbing leaks into `sync_album.py` and breaks the launchd sync | Medium — silent sync failure | `acep565` is the default, so existing invocations are unchanged; assert it in Level-2 tests |
