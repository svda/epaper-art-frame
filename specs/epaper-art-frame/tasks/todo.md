# Task List: E-Paper Art Frame

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

---

## Phase 0 — De-risk (spike)

### P0.1: Bench test — stock `waveshare_epaper` `5.65in-f` drives the panel
> **Bench progress (2026-09-28, Heemol N16R8):**
> - **Fixed a boot-blocker:** the default DIO flash mode crashed in
>   `esp_psram_extram_test` at boot (flash cache corruption) with octal PSRAM. Setting
>   `esp32.flash_mode: qio` (WROOM-1 R8 = Quad flash + Octal PSRAM) fixes it — PSRAM now reports
>   `Available: YES, Size: 8192 KB` and the display initializes. Applied to both the bench and
>   device configs.
> - **Fixed the render block:** the panel's BUSY is **active-LOW** — ESPHome waits for LOW (IDLE)
>   unless `busy_pin` is `inverted: true`. With inversion the 35 s timeout is gone
>   (`Setup display took 208 ms`, full ~30 s refresh) and the 7-colour pattern renders.
>   ESPHome side verified: QIO boot, PSRAM 8 MB, pins CLK12/MOSI11/CS10/DC9/RST8/BUSY7, SPI 2 MHz.

**Description:** Author the device YAML stub that renders a 7-colour test pattern on the Waveshare
5.65" ACeP panel using ESPHome's built-in `waveshare_epaper` driver with `model: 5.65in-f`
(≥ 2026.9.0). Config: `esp32` (S3 + PSRAM), `spi`, the `display` with `cs/dc/reset/busy` pins, and
a `lambda` drawing 7 colour bars + geometry marks. No custom component — Revision 2 removed it.
- Pin the ESPHome version to ≥ 2026.9.0 (first release containing `5.65in-f`).
- Do **not** modify ESPHome core or add an `external_components:` source.

**Acceptance criteria:**
- [x] `esphome config` validates and `esphome compile` succeeds against the pinned ESPHome version.
      — done 2026-09-28 on ESPHome 2026.9.0 (zero config warnings).
- [x] A test pattern (7 colour bars + geometry marks) renders on the physical panel with correct
      colours in the correct positions, no corruption. — **done 2026-09-28** (Heemol N16R8 bench;
      render confirmed).
- [x] BUSY polarity confirmed (Q3) and recorded — **inversion REQUIRED** (`inverted: true`).

**Verification:**
- [x] Photograph the rendered test pattern; compare against expected 7-colour layout.

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
      — **Soldered NULA DeepSleep ESP32-S3** (amazon.nl B0FZDDH33Y / soldered.com 333352).
      Marketed as ESP32-S3-WROOM-1-N8R8 (8 MB flash + 8 MB PSRAM); vendor deep-sleep claim **7 uA**
      (chip-level; requires all peripherals off + **JP1 open** to cut the WS2812B LED).
      Sources: docs.soldered.com (hardware-details), amazon.nl listing. Measured in P3.1.
      PSRAM **confirmed 8 MB (N8R8)** (user-verified 2026-09-28), so the 7-colour driver's ~1.0 MB
      of frame buffer fits.
- [x] Pin map (SPI CLK/MOSI/CS/DC/RST/BUSY + ADC + power) written into the device YAML header.
      **PROVISIONAL**, derived from the NULA pinout v1.0.0; confirm before wiring.

**Resolution (2026-09-28; revised Rev 4):** re-targeted from the Heemol N16R8 DevKitC-1 to the NULA
DeepSleep — the DevKitC-1 class draws 5-15 mA deep sleep (~8-25 days), the NULA targets ~7 uA.
`esp32.board: esp32-s3-devkitc-1`, `flash_size: 8MB`, octal PSRAM. PSRAM confirmed 8 MB (N8R8).
Chosen by user (ask-first).

**Dependencies:** none · **Scope:** XS · **Files:** `config/esphome/epaper-art-frame.yaml`
(comment header) · **Ask first — user purchase.**

---

### P0.3: Select the battery + charging board (Q2) — ask first
**Description:** Choose the power path: single-cell LiPo/Li-ion (2000–2500 mAh) into the board's
regulator, plus TP4056 or the board's onboard charger. Record capacity and expected lifetime from
the SPEC power budget.

**Acceptance criteria:**
- [x] Battery capacity + charging solution recorded; ~6-12 month estimate re-derived from the
      chosen board's quiescent current. — **3000 mAh single-cell LiPo**, charged by the NULA's
      onboard **TP4056M** (a separate TP4056 module is no longer needed). At the vendor 7 uA figure
      the runtime is battery-self-discharge bound, so the **6-12 month target is met with margin**;
      even at a measured 200 uA it is ~1.7 years. P3.1 measures the real figure (7 uA excludes
      peripheral/LED leakage) and confirms JP1 is open.

**Resolution (2026-09-28; revised Rev 4):** recorded in the `epaper-art-frame.yaml` header.
Ask-first purchase approved by user (amazon.nl B0FZDDH33Y).

**Dependencies:** P0.2 · **Scope:** XS · **Files:** `config/esphome/epaper-art-frame.yaml`
(comment header) · **Ask first — user purchase.**

---

### Checkpoint A — Panel renders from ESPHome
- [x] P0.1 test pattern renders and is correct (bench-verified 2026-09-28).
- [x] Board, battery, pins decided and recorded.
- [ ] **Review with user** — proceed to Phase 1.

---

## Bench bring-up (Heemol devkit, USB, no battery) — 2026-09-29

Goal: prove the Phase-1 path end-to-end on the devkit before the NULA arrives.

- [x] WiFi connects (`IoT`, 192.168.2.90) and the device fetches over HTTP.
- [x] Fetch → decode → render works end-to-end:
      `http://server:8123/local/epaper/test.png` (PNG, 14.6 KB) → RGB565 buffer
      600×448 (537,600 B, allocated in PSRAM) → drawn on the 5.65in-F panel.
      User confirms the image rendered correctly.
- [x] Notes: use the HA host **`server`** (DNS) — **mDNS names do not resolve** from the
      ESP (`getaddrinfo() returns 202` for `homeassistant.local`). `esphome upload` does
      **not** recompile after a config edit — run `esphome compile` first.
- [ ] Not yet: manifest + round-robin index, battery/ADC sensor, deep sleep (USB for now).

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

### P3.1: Battery integration + deep-sleep measurement
**Description:** Wire the 3000 mAh LiPo to the NULA's JST connector (onboard TP4056M charger) and
measure actual deep-sleep and wake current. **Open JP1** to disconnect the WS2812B LED. The panel
refresh dominates wake energy, so the deep-sleep figure sets battery life; confirm it is close to
the vendor's 7 uA.

**Acceptance criteria:**
- [ ] Measured deep-sleep current recorded (JP1 open); lifetime estimate computed from it.
- [ ] Measured figure consistent with the SPEC's 6-12 month target (or variance documented).

**Verification:**
- [ ] Multimeter (or coulomb counter) idle reading; extrapolated months figure.

**Dependencies:** Checkpoint C, P0.3 hardware · **Scope:** S · **Files:** none (hardware).

---

### P3.2: Enclosure / mounting — moved to the `wooden-frame` spec
**Description:** Fit panel + board + battery into/onto a frame. Battery must be accessible for
charging without disassembly.
**Moved:** this task is now specified by [`../../wooden-frame/SPEC.md`](../../wooden-frame/SPEC.md)
(slug `wooden-frame`), which supersedes the brief requirement below. Build and verify it there; this
task is done when that spec's success criteria are met.

**Acceptance criteria:**
- [ ] Device hangs/stands; battery reachable for charging. → verified by the `wooden-frame` success
      criteria (see that spec).

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
