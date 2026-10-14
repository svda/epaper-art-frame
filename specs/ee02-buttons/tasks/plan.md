# Implementation Plan: EE02 User Buttons — Previous / Next Artwork

Spec: [`../SPEC.md`](../SPEC.md) · Plan created 2026-10-14
Task list: [`todo.md`](./todo.md)

---

## Overview

Add previous/next artwork control to the EE02 13.3" frame. Two GPIO buttons wake the device
from deep sleep via `esp32_ext1_wakeup`; a per-pin `on_wake` trigger sets a rotation-direction
global that the shared pipeline reads before fetching. No custom C++, no new server surface,
and the existing 5.65" frame is unaffected.

Four phases: pipeline plumbing → device wiring → validation/no-regression → bench. The whole
change is two YAML files plus a manual bench pass.

---

## Architecture decisions

- **Direction is a shared concept, pins are device hardware.** `art_direction` and the
  direction-aware `show_image` script live in `common/art-frame.yaml`; the button pins and the
  `esp32_ext1_wakeup` config live in the device file. This keeps `common/` device-agnostic and
  lets a future device opt in with no pipeline change.
- **Use ESPHome's native ext1 `on_wake`, not a custom `on_boot`.** `Ext1WakeTrigger`
  (`deep_sleep_component.h:104`) already detects *which* pin woke the device and fires at setup
  priority **700** — before the shared `on_boot` at **600** — so direction is set before the
  fetch with no manual `esp_sleep_get_ext1_wakeup_status()` parsing and no second `on_boot`
  merge to reason about.
- **`deep_sleep:` deep-merges across packages.** The device file adds only `esp32_ext1_wakeup`;
  `id` / `run_duration` / `sleep_duration` stay in `common/` (merge semantics verified:
  `config_helpers.py:77` deep-merges dicts).
- **Behaviour-preserving by default.** A timer wake fires no `on_wake`, so `art_direction` stays
  at its construction-time default `+1` — the 5.65" frame's wake shows the next image exactly as
  today. The default is the no-regression guarantee.
- **One step per wake.** The device sleeps immediately after the render, so a press during the
  ~51 s awake window is ignored. Accepted for v1 (spec Q3).
- **The third button stays unwired.** GPIO5 is reserved, not implemented.

---

## Sequencing rationale

```
Phase 1  pipeline: art_direction + direction-aware show_image   ← common/ (no hardware)
   │
Phase 2  device: button pins + ext1 on_wake                     ← EE02 device file
   │
   ├── Checkpoint A: both device configs validate + 13in compiles
   │
Phase 3  validate: no-regression diff + doc updates
   │
Phase 4  bench: timer / next / previous / persistence           ← EE02 on the bench
```

- **Why pipeline first.** The device file's `on_wake` lambda assigns `id(art_direction)`, so the
  global must exist before the device file validates. It also lets the 5.65" frame be validated
  against the changed `common/` in isolation.
- **Why capture the 5.65" baseline first.** The no-regression proof (Phase 3) needs a
  `esphome config` snapshot from *before* `common/` changes — so B1.1 captures it as its first
  step.
- **Why bench is last and manual.** This is hardware; the schema gate cannot prove a button
  wakes the device or that the index continues correctly.

---

## Parallelisation

- **Sequential throughout.** B1.1 → B2.1 is a hard dependency; B3.x need both; B4.1 needs a
  flashed device. B3.2 (docs) is independent of B3.1 and may run alongside it.

---

## Definition of Done

The standing bar every task clears, in addition to its own acceptance criteria:

- [ ] `ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome config <device yaml>`
      validates for **both** device files (absolute path — a relative value breaks the build).
- [ ] `esphome compile` succeeds for the EE02 device (catches lambda errors `config` cannot).
- [ ] No secrets committed — credentials only via git-ignored `secrets.yaml`.
- [ ] Pin assignments documented once, in the device YAML header.
- [ ] The existing 5.65" device's effective config is unchanged apart from the new
      `art_direction` global and the renamed script — checked by diffing `esphome config` output.
- [ ] No HA config is modified.
- [ ] Any physical wiring/measurement is logged so a future session can reproduce it.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Buttons have no external pull-up and float when unpressed | Medium — spurious wakes / battery drain | `mode: INPUT_PULLUP` (spec Q1); B4.1 verifies idle level before deploy |
| `ANY_LOW` rejected for the ESP32-S3 variant | Low — config fails loudly | B3.1 `esphome config` gate |
| A button press is lost while the device is awake | Low — user presses again | Documented (spec Q3); accepted for v1 |
| Adding the direction plumbing changes the 5.65" frame | Medium — regression on a deployed device | B1.1 captures a pre-change `esphome config` baseline; B3.1 diffs; default `+1` preserves behaviour |
| `deep_sleep:` package merge replaces rather than merges | Low — lost `id` / `sleep_duration` | B3.1 `esphome config` catches a missing `id`; merge semantics verified in source |
| Physical access omitted from the future enclosure | Medium — firmware with no user | Handed to the EE02 enclosure spec as a requirement (spec Q5) |

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | Button polarity + whether the EE02 has external pull-ups | B4.1 |
| Q2 | Does `ANY_LOW` validate for the S3 variant | B3.1 |
| Q3 | Is a press during the awake window lost | B4.1 |
| Q4 | Does `ee02_epaper`'s `power_pin` handling interfere with RTC-domain pins on GPIO2/3 | B4.1 |
| Q5 | How the buttons are reached when mounted | The future EE02 enclosure spec |

---

## Task summary

| Phase | Tasks | Hardware needed |
|---|---|---|
| 1 — Pipeline | 1 | — |
| 2 — Device | 1 | — |
| 3 — Validate | 2 | — |
| 4 — Bench | 1 | EE02 + panel + battery |

**5 tasks. Sizes S throughout; no task touches more than 2 files.**

**Ask-first item:** editing `specs/ee02-13in-spectra6/SPEC.md` (B3.2) to retire the "not wired
in v1" line and the buttons non-goal.
