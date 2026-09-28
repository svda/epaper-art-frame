# Task List: E-Paper Art Frame

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

---

## Phase 0 — De-risk (spike)

### P0.1: Bench test — stock `waveshare_epaper` `5.65in-f` drives the panel
**Description:** Author the device YAML stub that renders a 7-colour test pattern on the Waveshare
5.65" ACeP panel using ESPHome's built-in `waveshare_epaper` driver with `model: 5.65in-f`
(≥ 2026.9.0). Config: `esp32` (S3 + PSRAM), `spi`, the `display` with `cs/dc/reset/busy` pins, and
a `lambda` drawing 7 colour bars + geometry marks. No custom component — Revision 2 removed it.
- Pin the ESPHome version to ≥ 2026.9.0 (first release containing `5.65in-f`).
- Do **not** modify ESPHome core or add an `external_components:` source.

**Acceptance criteria:**
- [x] `esphome config` validates and `esphome compile` succeeds against the pinned ESPHome version.
      — done 2026-09-28 on ESPHome 2026.9.0 (zero config warnings).
- [ ] A test pattern (7 colour bars + geometry marks) renders on the physical panel with correct
      colours in the correct positions, no corruption. — **deferred: needs panel + ESP32-S3.**
- [ ] BUSY polarity confirmed (Q3) and recorded — no inversion expected. — **deferred: needs panel.**

**Verification:**
- [ ] Photograph the rendered test pattern; compare against expected 7-colour layout.

**Dependencies:** none (YAML can be authored before hardware arrives) · **Files:**
`config/esphome/epaper-art-frame.yaml` (stub), `.gitignore`, `config/esphome/secrets.yaml`
(git-ignored) · **Scope:** S

---

### P0.2: Select the ESP32-S3 board/module (Q1) — ask first
**Description:** Choose the low-quiescent ESP32-S3 build target. The deciding factor is deep-sleep
current, not price. Evaluate: bare ESP32-S3-WROOM module + low-quiescent LDO vs. a dev board with
a proven sleep design (LILYGO/Lolin ESP32-S3 Mini, Adafruit Feather ESP32-S3). Record the choice,
its idle current, and the pin map in the device YAML header.

**Acceptance criteria:**
- [x] One board/module selected, with a cited deep-sleep quiescent figure.
      — **Heemol ESP32-S3 N16R8** (DevKitC-1 form factor, ESP32-S3-WROOM-1-N16R8,
      16 MB flash / 8 MB octal PSRAM). Cited quiescent for a stock ESP32-S3-DevKitC-1 class board:
      **5-15 mA** (AMS1117-3.3 LDO ~5 mA + CP2102N USB-UART 2-5 mA + power LED 2-3 mA; the chip
      itself is ~7 uA, datasheet v1.6 §4.7). Source: hubble.com ESP32 deep-sleep guide. To be
      measured in P3.1. **See the battery-life conflict in P0.3.**
- [x] Pin map (SPI CLK/MOSI/CS/DC/RST/BUSY + ADC + power) written into the device YAML header.

**Resolution (2026-09-28):** board + pin map recorded in the `epaper-art-frame.yaml` header;
`esp32.board: esp32-s3-devkitc-1`, `flash_size: 16MB`, octal PSRAM. Chosen by user (ask-first).

**Dependencies:** none · **Scope:** XS · **Files:** `config/esphome/epaper-art-frame.yaml`
(comment header) · **Ask first — user purchase.**

---

### P0.3: Select the battery + charging board (Q2) — ask first
**Description:** Choose the power path: single-cell LiPo/Li-ion (2000–2500 mAh) into the board's
regulator, plus TP4056 or the board's onboard charger. Record capacity and expected lifetime from
the SPEC power budget.

**Acceptance criteria:**
- [x] Battery capacity + charging solution recorded; ~6-12 month estimate re-derived from the
      chosen board's quiescent current. — **3000 mAh LiPo + TP4056** (user choice). Re-derived from
      the P0.2 board quiescent (5-15 mA, *not* the chip's ~7 uA): **~8-25 days** (10 mA → ~12.5
      days). The 6-12 month estimate holds only with the dev-board parasitics removed
      (low-Iq path ~50-200 uA → ~3.4 years). **Recorded as a conflict; see Checkpoint A / P3.1.**

**Resolution (2026-09-28):** recorded in the `epaper-art-frame.yaml` header. Ask-first purchase
approved by user.

**Dependencies:** P0.2 · **Scope:** XS · **Files:** `config/esphome/epaper-art-frame.yaml`
(comment header) · **Ask first — user purchase.**

---

### Checkpoint A — Panel renders from ESPHome
- [ ] P0.1 test pattern photographed and correct.
- [ ] Board, battery, pins decided and recorded.
- [ ] **Review with user** — proceed to Phase 1 (or fall back to Arduino+GxEPD2 if the spike failed).

---

## Phase 1 — Device config

### P1.1: Full device YAML — deep sleep, WiFi, sensors
**Description:** Complete `epaper-art-frame.yaml`: `esp32` (variant from P0.2, PSRAM), `spi`,
the `epaper_acep565` display, `deep_sleep` (`sleep_duration: 24h`, `run_duration: 60s`), `wifi`
(via `secrets.yaml`), `logger`, `api`, `adc` battery sensor, `text_sensor` last-image,
`wifi_signal`. Assign pins from P0.2.

**Acceptance criteria:**
- [ ] `esphome config` clean; `esphome compile` succeeds.
- [ ] Device boots, connects, renders a static image, then enters sleep on schedule.

**Verification:**
- [ ] Confirm sleep entry in logs; confirm a subsequent scheduled wake.

**Dependencies:** P0.2 · **Scope:** M · **Files:** `config/esphome/epaper-art-frame.yaml`,
`config/esphome/secrets.yaml` (git-ignored).

---

### P1.2: Manifest fetch + persistent cycle index
**Description:** Add an `on_boot` script: fetch `{image_base_url}/manifest.json`, advance a
`global int art_index` (`restore_value: true`), wrap mod list length, publish last-image name.

**Acceptance criteria:**
- [ ] Index advances round-robin across reboots (survives deep sleep via restore).
- [ ] Missing/unreachable manifest handled without crashing (logs + sleeps).

**Verification:**
- [ ] Two consecutive wakes pick different indices; index persists across a flash reset
      boundary check.

**Dependencies:** P1.1 · **Scope:** S · **Files:** `epaper-art-frame.yaml`.

---

### P1.3: Fetch + render the chosen image
**Description:** Fetch the image named by the manifest index and draw it to the display.
Use `online_image` (or `http_request` + `image`) and the display `lambda`. Confirm 7-colour
quantisation renders acceptably on-device (Q4).

**Acceptance criteria:**
- [ ] A real image from the folder renders fully (no clipping/corruption).
- [ ] Q4 answer recorded: on-device quantisation quality acceptable, or pre-dither required.

**Verification:**
- [ ] Photograph a rendered real image; note colour fidelity.

**Dependencies:** P1.2 · **Scope:** M · **Files:** `epaper-art-frame.yaml`.

---

### P1.4: Verify from HA (observation)
**Description:** Confirm the device appears in HA via the ESPHome API during its wake, and that
battery voltage + last-image + WiFi sensors publish.

**Acceptance criteria:**
- [ ] Device discovered in HA; named sensors populated after a wake.

**Verification:**
- [ ] Developer Tools → States shows the device's sensors fresh after a scheduled wake.

**Dependencies:** P1.3 · **Scope:** XS · **Files:** none (verification).

---

### Checkpoint B — Device works

- [ ] One full wake cycle: fetch → render → publish → sleep, observed end-to-end.
- [ ] **Review with user** before Phase 2.

---

## Phase 2 — Image pipeline

### P2.1: `manifest.json` + generator script
**Description:** Create `config/www/epaper/manifest.json` and a generator script (Python) that
scans `config/www/epaper/*.{png,jpg,jpeg}` and rewrites the manifest, sorting deterministically.
The script is the only writer of the manifest.

**Acceptance criteria:**
- [ ] Script rewrites the manifest to exactly match folder contents; documented in a README line.
- [ ] HA serves `/local/epaper/*` correctly.

**Verification:**
- [ ] Add + remove a file, regenerate, confirm manifest tracks it; fetch `manifest.json` over
      HTTP from HA.

**Dependencies:** none · **Scope:** S · **Files:** `config/www/epaper/manifest.json`,
`config/www/epaper/generate_manifest.py`.

---

### P2.2: Seed a small curated set
**Description:** Drop 3–5 real images into the folder, regenerate the manifest, confirm the
device cycles through them over consecutive days.

**Acceptance criteria:**
- [ ] Device renders each seeded image correctly over successive wakes.

**Verification:**
- [ ] Photograph the rotation; confirm no two consecutive days repeat.

**Dependencies:** P2.1, Checkpoint B · **Scope:** S · **Files:** `config/www/epaper/*`.

---

### P2.3 (optional): Pre-dither script
**Description:** If P1.3 answered Q4 as "pre-dither required", add a server-side script that
scales to 600×448 and dithers to the 7-colour palette before serving. Fold the output into the
manifest generator.

**Acceptance criteria:**
- [ ] Pre-dithered files render with visibly better fidelity than on-device quantisation.

**Dependencies:** P1.3 (Q4) · **Scope:** M · **Files:** `generate_manifest.py` (extended).

---

### Checkpoint C — Rotation is real

- [ ] Folder contents drive the rotation with no device-side edits.
- [ ] **Review with user** before Phase 3.

---

## Phase 3 — Battery & acceptance

### P3.1: Battery integration + measurement
**Description:** Wire the battery/charger from P0.3 (or onboard charger); measure actual deep-sleep
and wake current.

**Acceptance criteria:**
- [ ] Measured deep-sleep current recorded; actual lifetime estimate computed from measurement.

**Verification:**
- [ ] Multimeter (or coulomb counter) idle reading; extrapolated months figure.

**Dependencies:** Checkpoint C, P0.3 hardware · **Scope:** S · **Files:** none (hardware).

---

### P3.2: Enclosure / mounting
**Description:** Fit panel + board + battery into/onto a frame. Battery must be accessible for
charging without disassembly.

**Acceptance criteria:**
- [ ] Device hangs/stands; battery reachable for charging.

**Dependencies:** P3.1 · **Scope:** S · **Files:** none (hardware) · **Ask first — user-provided
frame/enclosure.**

---

### P3.3: Live acceptance — a week unattended
**Description:** Leave the device wall-mounted for a week. Confirm daily rotation, no stuck
refreshes, and battery voltage trend.

**Acceptance criteria:**
- [ ] 7 consecutive daily refreshes observed without intervention.
- [ ] Battery voltage trend consistent with the months-scale estimate.

**Verification:**
- [ ] HA history of the daily wake sensor over the week.

**Dependencies:** P3.2 · **Scope:** M · **Files:** none.

---

### Checkpoint D — Shipped

- [ ] A week of unattended daily rotation on battery.
- [ ] **Review with user** — initiative-level success criteria in `SPEC.md` walked through.