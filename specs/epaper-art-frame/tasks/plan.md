# Implementation Plan: E-Paper Art Frame

Spec: [`../SPEC.md`](../SPEC.md) · Plan created 2026-09-27
Task list: [`todo.md`](./todo.md)

---

## Overview

Build a battery-powered wall-art frame driven by an ESP32-S3 running ESPHome, showing images
from a network folder on a Waveshare 5.65" 7-colour ACeP e-paper panel, once a day. As of
Revision 2 there is **no custom firmware code**: ESPHome ≥ 2026.9.0 ships `waveshare_epaper`
`model: 5.65in-f`, a purpose-built ACeP565 driver. The work is standard ESPHome config, a
manifest generator script, and thin HA observation.

Four capabilities, four phases. **Phase 0 must succeed before anything else is worth doing** —
the panel must render from ESPHome (now a bench confirmation of an upstream driver, not a port).

---

## Architecture decisions

- **Deep sleep is the device's normal state.** ~24 h asleep, <1 min awake. No live HA control;
  HA observes the brief daily wake only.
- **Manifest is the source of truth for the rotation.** A bare static server has no directory
  listing, so the device can't discover folder contents by itself; `manifest.json` lists them.
- **Use the upstream 5.65in-f driver; no custom component.** Upstream `WaveshareEPaper5P65InF`
  already reuses the 7-colour palette/3-bit packing and carries ACeP565's resolution + init +
  waveform. Requires ESPHome ≥ 2026.9.0.
- **Cycle state on flash, not RAM.** `global` + `restore_value` survives the deep-sleep reboot.
- **New top-level directories, not HA package files.** The YAML lives under a device directory
  (e.g. `config/esphome/` or a sibling repo area); it is *not* an HA automation and never goes in
  `configuration.yaml`.

---

## Sequencing rationale

```
Phase 0  bench test: stock waveshare_epaper 5.65in-f + pattern   ← panel must render, or stop
   │
Phase 1  device config: deep sleep + fetch + render + cycle      ← delivers the device
   │
Phase 2  image pipeline: manifest + generator (+ HA www folder)  ← makes rotation real
   │
Phase 3  battery + enclosure + live acceptance                   ← months-on-battery proof
```

- **Why the panel bench test is first.** The device depends on the panel rendering correctly from
  ESPHome. The driver now exists upstream, so this is a bench confirmation (panel + dev board,
  USB-powered), not a port — but it still gates everything downstream.
- **Why device config before the image pipeline.** The config is what makes the spike usable;
  the manifest has no value until there's a device that consumes it.
- **Hardware gate.** Phases 0–2 need physical hardware (ESP32-S3 + the panel the user owns + a
  battery/charger purchase in Phase 3). The panel is already owned; the ESP32-S3 and battery are
  purchases — flagged as ask-first items.

---

## Hardware selection (Q1/Q2, settled in Phase 0)

Two decisions carry disproportionate power weight and should be made *before* buying:

1. **ESP32-S3 board vs bare module.** The dominant idle draw is the dev board's USB-UART + LDO
   (~100 µA–1 mA), not the chip (~7 µA). Prefer either (a) a bare ESP32-S3-WROOM module + a
   low-quiescent LDO, or (b) a board with a known-good deep-sleep design. Candidates to evaluate
   in the spike: LILYGO/Lolin ESP32-S3 Mini, Adafruit Feather ESP32-S3 (onboard LiPo charger +
   fuel gauge), bare ESP32-S3 module.
2. **Battery.** Single-cell LiPo/Li-ion into a low-quiescent regulator (module's VSYS/5V path as
   appropriate); TP4056 or the board's onboard charger; 2000–2500 mAh for 6–12 months.

Both are "ask first — user purchase/action" items, recorded as spikes in `todo.md`.

---

## Parallelisation

- **Sequential throughout.** Phase 0 → 1: the config depends on the component's exact
  `display:` schema. Phase 1 → 2: the manifest scheme depends on how `on_boot` fetches. Phase 2 →
  3: battery-life measurement needs an end-to-end device.
- The only safe internal parallelisation: hardware purchase (Phase 0 ask-first) can overlap
  writing the external component, since the component can be written and even CI-syntax-checked
  (pins absent) before the board arrives.

---

## Definition of Done

The standing bar every task clears, in addition to its own acceptance criteria:

- [ ] `esphome` config validates (`esphome config <yaml>`) with no warnings for this device.
- [ ] Firmware compiles (`esphome compile <yaml>`) against the pinned ESPHome version (≥ 2026.9.0).
- [ ] No secrets (WiFi password) committed — use `secrets.yaml` which is git-ignored.
- [ ] Pin assignments documented once, in one place (the device YAML header).
- [ ] Every physical wiring change is photographed/logged so a future session can reproduce it.
- [ ] No HA config (`configuration.yaml` / packages) is modified by this initiative unless a task
      explicitly names it.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Upstream 5.65in-f driver misbehaves on the physical panel | Medium — invalidates the firmware choice | Phase 0 bench test first; upstream is the reference; fallback is a pinned older ESPHome or Arduino+GxEPD2 |
| BUSY polarity wrong → wrong idle detection | Low | Upstream 5.65in-f reads BUSY directly (no inversion); a mismatch shows as a timeout / `status_set_warning` in the bench test |
| Dev-board quiescent current ruins battery life | High | Phase 0 hardware selection explicitly optimises for it; Phase 3 measures it |
| `online_image` decode + 7-colour buffer exceeds RAM | Medium | S3 + PSRAM; verify in Phase 1 using the spike component |
| WiFi/`online_image` fetch height | Low | 600×448 image is ~tens of KB; matches GxEPD2's WiFi example scale |
| Clock drift on a bare 24h sleep | Low | Accepted by design (intent); SNTP+nudge is a future refinement |

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | Which ESP32-S3 board/module (low-quiescent) | P0.2 |
| Q2 | Battery capacity + charging board | P0.3 |
| Q3 | ACeP565 BUSY inversion needed? (resolved upstream: no) | Confirm in P0.1 |
| Q4 | On-device quantisation acceptable, or pre-dither now | Phase 2 |
| Q5 | Wake time of day | Deferred |

**Ask-first items requiring user approval before the task proceeds:** P0.2 (buy ESP32-S3),
P0.3 (buy battery/charger), and any decision to fall back to Arduino+GxEPD2 if the spike fails.

---

## Task summary

| Phase | Tasks | Capability | Hardware needed |
|---|---|---|---|
| 0 — De-risk (bench) | 3 | panel driver confirm, hardware selection | panel + ESP32-S3 |
| 1 — Device config | 4 | deep sleep, fetch, render, cycle | panel + ESP32-S3 |
| 2 — Image pipeline | 3 | manifest, generator, HA www | — |
| 3 — Battery & acceptance | 3 | battery, enclosure, live proof | battery/charger |

**13 scheduled tasks. No task touches more than a handful of files; sizes XS–M throughout.**