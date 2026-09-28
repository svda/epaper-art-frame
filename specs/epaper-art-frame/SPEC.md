# Spec: E-Paper Art Frame

Status: **spec-approved, not yet built** · Revision 1 (2026-09-27)
Slug: `epaper-art-frame`

> This is a from-scratch hardware + firmware device that lives *alongside* the Home Assistant
> config in this repo, not an HA automation. The HA surface is thin by design — HA serves images
> and observes the daily wake; it does not direct the device (a deep-sleep device is unreachable
> while asleep, which is ~99.9% of the time).
>
> **Revision 2 (2026-09-28).** The original premise — that ESPHome had no driver for the
> Waveshare 5.65" 7-colour ACeP panel and that a custom external component (`epaper_acep565`)
> ported from GxEPD2 was required — is no longer true. Upstream `waveshare_epaper` now ships
> `model: 5.65in-f` (`WaveshareEPaper5P65InF`), which already reuses ESPHome's 7-colour renderer
> and carries the ACeP565 init/waveform for 600×448. The custom component is therefore dropped and
> the device uses stock ESPHome. This removes the spec's highest-rated risk.

---

## Objective

A battery-powered wall display that shows curated art on a 7-colour e-paper panel, refreshing
once a day from a network folder. The device wakes, fetches the next image, renders it, and
sleeps for ~a day; dropping a file into the folder changes the rotation with no device-side
configuration.

### The system

| Property | Value |
|---|---|
| Display | Waveshare 5.65" 7-colour ACeP, 600×448 (4-wire SPI) |
| Microcontroller | ESP32-S3 (with PSRAM) |
| Firmware | ESPHome ≥ 2026.9.0 (stock `waveshare_epaper`, `model: 5.65in-f`) |
| Power | Single-cell LiPo (3.7 V) via low-quiescent regulator; TP4056 charger |
| Wake cycle | ~24 h sleep, ~1 min awake (drift tolerated) |
| Image source | Home Assistant `www/epaper/` served over plain HTTP (`/local/epaper/...`) |
| Selection | `manifest.json` lists images; device cycles round-robin across wakes |
| HA role | Serve images, observe the daily wake (battery voltage, last image) |

---

## Confirmed decisions (from interview)

- **Microcontroller: ESP32-S3**, replacing the Pico 2 W (the Pico's CYW43439 WiFi chip cannot
  sleep below ~1.5 mA; the ESP32-S3 deep-sleeps at ~7 µA).
- **Firmware: ESPHome (stock `waveshare_epaper` `5.65in-f`).** Originally assumed a custom external
  component over Arduino+GxEPD2; upstream now provides the panel driver, so no custom C++ is
  needed (Revision 2).
- **Source: HTTP static file server = HA's `www/` folder.**
- **Cadence: once a day.** Selection: cycle through folder contents.
- **Power: battery** (not yet purchased), so low quiescent current is a first-class requirement.

---

## Capability map

```
┌─────────────────────────────────────────────────────────────────┐
│                        epaper-art-frame                         │
├───────────────┬─────────────────┬───────────────┬───────────────┤
│ panel driver  │ device config   │ image pipeline│ hA-integration│
│ (ESPHome stock│ (ESPHome YAML)  │ (manifest +   │ (observation  │
│ waveshare_    │                 │  generator)   │  only)        │
│ epaper        │                 │               │               │
│ 5.65in-f)     │                 │               │               │
├───────────────┼─────────────────┼───────────────┼───────────────┤
│ 7-colour      │ deep sleep 24h  │ manifest.json │ device auto-  │
│ ACeP565 init  │ on_boot fetch+  │ generator     │ discovery     │
│ + waveform    │ render + cycle  │ script        │ battery/      │
│ 600×448       │ online_image    │ (optional     │ last-image    │
│ (upstream)    │ globals restore │  pre-dither)  │ sensors       │
└───────────────┴─────────────────┴───────────────┴───────────────┘
```

---

## Module 1 — Panel driver (stock ESPHome `waveshare_epaper`)

**Revision 2 — no custom code.** ESPHome 2026.9.0 ships `model: 5.65in-f`
(`WaveshareEPaper5P65InF`, `waveshare_epaper`), a purpose-built driver for this exact panel. It
already reuses the 7-colour `Color` palette and 3-bit-per-pixel packing from `WaveshareEPaper7C`,
and carries the ACeP565 init/waveform for 600×448 (`cmddata_5P65InF`: PSR/PWR/PFS/BTST/PLL/TSE/
CDI/TCON/TRES/PWS), a 35 s idle timeout, and refresh/power-off/deep-sleep sequencing.

- **No external component.** The device config declares `display: platform: waveshare_epaper,
  model: 5.65in-f` with `cs_pin`, `dc_pin`, `reset_pin`, `busy_pin`, `spi`.
- **BUSY polarity (Q3) resolved.** Upstream polls the BUSY pin directly via `wait_until_(IDLE/BUSY)`
  with no inversion flag, so no `inverted:` option is required. Confirm on the bench that the panel
  reaches IDLE (a wrong polarity surfaces as a timeout / `status_set_warning`).
- **Pin the ESPHome version** to a release containing `5.65in-f` (≥ 2026.9.0).

**Exit criteria:** a known test pattern renders 7 colours with correct geometry and no corruption,
from ESPHome, against the bare panel.

---

## Module 2 — Device config (ESPHome YAML)

- **`deep_sleep`:** `sleep_duration: 24h`, `run_duration: ~60s`. On boot it runs once, then sleeps.
  No strict clock time — drift is accepted (see intent).
- **`on_boot` sequence:** connect → fetch `{base_url}/manifest.json` → advance a persistent
  index → fetch the chosen image (`online_image` or `http_request` + `image`) → draw to the
  display → publish sensors → sleep.
- **Cycle index:** an ESPHome `global` with `restore_value: true` (persists across deep-sleep
  reboot via flash Preferences). Round-robin over `manifest.json`'s list.
- **Sensors:** `adc` battery voltage (with an internal divider configured for the board),
  `text_sensor` last-image filename, `wifi_signal`.
- **Config substitutions:** `image_base_url`, `wifi` credentials, panel pins.

---

## Module 3 — Image pipeline

- **`config/www/epaper/manifest.json`** — a JSON array of image filenames. This is the single
  source of truth for the rotation and is what survives "drop in / delete a file".
- **Generator script** — a small script (run on the HA host, or a dev machine) that scans
  `config/www/epaper/*.{png,jpg,jpeg}` and rewrites `manifest.json`. Runs on demand.
- **Image preparation (v1):** ESPHome downloads the image and quantises to 7 colours on-device.
  Acceptable for v1. A future enhancement pre-dithers/`600×448`-scales on the server for better
  colour accuracy.

**HA note:** `www/` is served by HA at `/local/...`; the device cannot rely on directory
listing, so the manifest is required (a bare static server has no listing either).

---

## Module 4 — HA integration (observation only)

- **Device discovery:** standard ESPHome native API. The device appears online only during its
  brief daily wake.
- **Optional automations** (deferred beyond v1): battery-low notification, regenerate-manifest
  on folder change (requires a filesystem watcher, which HA doesn't provide natively for `www/`).

---

## Power budget

> **Revision 3 (2026-09-28).** P0.2/P0.3 chose a **Heemol ESP32-S3 N16R8** (ESP32-S3-DevKitC-1
> class) and a **3000 mAh LiPo**. That board's deep-sleep draw is **5–15 mA** (AMS1117 LDO ~5 mA +
> CP2102N USB-UART 2–5 mA + power LED 2–3 mA; the chip alone is ~7 µA) — i.e. **~8–25 days**, not
> the 6–12 months originally assumed. The board is retained for **Phases 0–2** (bench + firmware
> bring-up, USB-powered); **Phase 3 owns the low-quiescent power stage** — design out/bypass the
> LDO and UART bridge, remove the power LED, and/or move to a bare ESP32-S3-WROOM-1 + low-Iq
> regulator. The 6–12 month target applies to the **final, low-quiescent build**, not the dev
> board.

| Phase | Current (approx.) | Duration/day |
|---|---|---|
| Deep sleep (chip alone) | ~7 µA | ~23 h 59 m |
| Deep sleep (stock DevKitC-1 board) | **5–15 mA** | ~23 h 59 m |
| Deep sleep (low-Iq power stage) | ~50–200 µA | ~23 h 59 m |
| Wake: WiFi connect + fetch | ~80–120 mA | ~3–5 s |
| Wake: e-paper refresh | ~30–60 mA | ~12–15 s |

- **The dominant idle cost is the board, not the chip.** Most ESP32-S3 dev boards carry a USB-UART
  bridge + LDO (and often a power LED) that draw milliamps even in deep sleep. This dwarfs the
  chip's ~7 µA and must be designed out in Phase 3 (bare module + low-quiescent LDO, or a board
  with a proven sleep design).
- **Battery sizing:** at 3000 mAh — **stock board ~8–25 days** (≈12.5 days at 10 mA); a low-Iq
  power stage reaches **~1.7–3.4 years** (50–200 µA). The 6–12 month goal sits between these and
  is met by a partially-optimised power stage.

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | Exact ESP32-S3 board/module (low-quiescent) to purchase | Phase 0 (hardware selection) |
| Q2 | Battery capacity + connector/charging board | Phase 0 (hardware selection) |
| Q3 | ACeP565 BUSY inversion needed? (resolved upstream: no inversion flag) | Bench confirm in P0.1 |
| Q4 | On-device quantisation quality acceptable, or pre-dither now | Phase 3 (image pipeline) |
| Q5 | Wake time of day (drift accepted in v1) | Deferred — config choice |

---

## Non-goals

- Live HA control / "show now" push (impossible while deep-sleeping).
- Partial refresh, multipage, touch, enclosure design, dashboard.
- Multi-image-per-day, motion wake, or any trigger other than the daily timer.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ~~Custom component can't drive the panel correctly~~ *(removed in Rev 2 — upstream `5.65in-f` ships the driver)* | — | — |
| Board quiescent current kills battery life | High | Design for sleep; choose board/module explicitly for it (Q1) |
| `online_image` + custom display memory layout mismatch | Medium | S3 + PSRAM; verify in Phase 1 with the spike output |
| Manifest drifts out of sync with folder | Low | Generator script is the only writer; document it |