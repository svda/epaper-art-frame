# Implementation Plan: EE02 13.3" Spectra 6 Frame + Multi-Device Support

Spec: [`../SPEC.md`](../SPEC.md) · Plan created 2026-10-13
Task list: [`todo.md`](./todo.md)

---

## Overview

Add a second battery-powered art frame — Seeed XIAO ePaper Display Board EE02 + the 13.3" E Ink
Spectra 6 panel (1200×1600, T133A01) — and restructure `config/esphome/` so one codebase serves
multiple devices. There is **no custom firmware**: ESPHome 2026.9.0's `epaper_spi` ships
`model: t133a01`, and the exact EE02 display block was already validated with `esphome config`.

Two modules, five phases. The work is ordinary ESPHome config, a profile parameter for the
image tooling, and a bench bring-up — but the plan front-loads the one genuinely unknown thing.

---

## Architecture decisions

- **`common/` holds behaviour, `devices/` holds hardware.** A device file contains only what is
  true of that device (pins, panel model, dimensions, cadence); everything shared lives in
  `common/base.yaml` (api, ota, wifi, logger, captive portal) and `common/art-frame.yaml` (the
  fetch → render → sleep pipeline).
- **`display:` stays in the device file.** Platform, model, dimensions and the optional
  `cs1_pin`/`enable_pin` differ per panel, and ESPHome's list-merging across packages makes a
  partially-overridden `display:` list fragile. Explicit beats clever; the cost is two
  duplicated lines of draw lambda.
- **All `!secret` lives in `common/`.** ESPHome resolves `!secret` relative to the *including*
  file and only falls back to the main config's directory for included files — a `!secret` used
  directly in `devices/*.yaml` would look for `devices/secrets.yaml` and hard-fail.
- **`ESPHOME_DATA_DIR=config/esphome/.esphome` on every command.** The build dir is derived from
  the main config's directory and there is no CLI flag for it; pinning it keeps one shared build
  cache instead of one per device.
- **Profiles are data, not branches.** `acep565` (600×448, 7-colour) and `spectra6-133`
  (1200×1600, 6-colour) are a table. Adding a panel is a row plus a device file — never an `if`.
- **`acep565` is the default profile.** Existing invocations, the launchd iCloud sync, and the
  deployed 5.65" frame keep working with zero changes.
- **The existing node name `epaper-art-frame` does not change.** It is the HA device identity and
  the mDNS hostname; only its file path moves.

---

## Sequencing rationale

```
Phase 0  de-risk: EE02 panel + PSRAM, standalone spike        ← fail fast; gates everything
   │
Phase 1  config structure: common/ + devices/                 ← module multi-device-config
   │
Phase 2  image profiles: prepare / manifest / push / sync     ← module multi-device-config
   │
Phase 3  EE02 device: real art, end-to-end on battery         ← module ee02-13in-spectra6
   │
Phase 4  acceptance: current, soak                            ← module ee02-13in-spectra6
```

- **Why a Phase 0 spike, out of module order.** The module build order is
  `multi-device-config → ee02-13in-spectra6`, and that order is respected for *delivery* — module 1
  is complete before the module 2 device exists. But the panel is a physical unknown, and the
  repo already has the precedent (`epaper-art-frame` Phase 0, plus the permanent bring-up aids
  `nula-bringup.yaml` / `epaper-diag.yaml`): prove the hardware renders before building structure
  around it. The spike is a **standalone config**, not the module 2 deliverable, so it does not
  reorder the modules.
- **Why the spike is cheap.** The driver is not novel — stock ESPHome, schema already validated.
  The residual unknowns are BUSY polarity, `flash_mode`, and whether 4.8 MB fits in 8 MB PSRAM.
  One session, one file, and the two High risks in the spec are retired.
- **Why the config refactor precedes the profiles.** The profiles touch `tools/`, the refactor
  touches `config/`; they are independent, but doing the refactor first means the EE02 device file
  lands on its final home with no second move.
- **Why the EE02 device precedes acceptance.** Current measurement and the soak need a device that
  actually sleeps on a schedule.
- **Hardware gate.** The EE02 + panel are already owned (that is the premise of this spec). The
  battery is the EE02's own JST connector — no purchase needed. No ask-first purchases.

---

## Parallelisation

- **Sequential throughout, with one exception.** P0.1 → P1.x: the spike proves the panel, the
  refactor is independent but cheap and unblocks everything. P2.x: P2.1 (scripts) and P2.3 (tests)
  are coupled — write the tests against the profile table as it lands. P2.2 (`sync_album.py`) is
  independent of P2.1's internals and can be written in parallel with it once the profile *names*
  are fixed.
- **Safe to parallelise:** P2.2 against P2.1/P2.3. Documentation updates.
- **Must be sequential:** everything from P0.1 → P1.1 (the refactor's "no regression" proof needs
  a pre-refactor baseline captured first), and P3.x → P4.x.

---

## Definition of Done

The standing bar every task clears, in addition to its own acceptance criteria:

- [ ] `ESPHOME_DATA_DIR=config/esphome/.esphome .venv/bin/esphome config <device yaml>` validates
      with no warnings.
- [ ] `esphome compile` succeeds against the pinned ESPHome version (≥ 2026.9.0).
- [ ] No secrets committed — credentials only via `secrets.yaml`, which is git-ignored.
- [ ] Pin assignments documented once, in the device YAML header.
- [ ] The existing 5.65" device's effective config is unchanged (pin map, display model, sleep
      cadence, HA image path) — checked by diffing `esphome config` output.
- [ ] `uv run --directory tools/epaper pytest` passes after any `tools/epaper/` change.
- [ ] No HA config (`configuration.yaml` / packages) is modified.
- [ ] Every physical wiring change is photographed/logged so a future session can reproduce it.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| PSRAM exhaustion (~4.8 MB of 8 MB: 3.84 MB RGB565 + 960 KB panel buffer) | **High** — OOM at boot or on download | P0.1 proves it before anything else; fallback is a smaller intermediate buffer (pre-scale/dither) |
| ESPHome's `t133a01` model is tuned for the reTerminal E1004 wiring, not the EE02 rails | Medium — panel does not initialise | P0.1; fallback is a small `external_components` override |
| The refactor silently changes the working 5.65" frame | Medium — regression on a deployed device | P1.1 captures a `esphome config` baseline *before* the change and diffs after |
| `!secret` used directly in a device file fails to resolve | Low — config will not validate | All `!secret` confined to `common/`; the P1.1 gate catches it |
| 13.3" refresh current drains the battery faster than the 5.65" frame | Medium — cadence must change | P4.1 measures; adjust `sleep_duration` if needed |
| Profile plumbing breaks the launchd iCloud sync | Medium — silent sync failure | `acep565` is the default; P2.2 asserts no-arg behaviour is unchanged |
| Editing `specs/epaper-art-frame/` to update path references | Low — touching a shipped spec | Scoped to path references only; ask-first, called out in P1.3 |

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | EE02 panel BUSY polarity (E1004 model uses `inverted: true`) | P0.1 |
| Q2 | `flash_mode` for the XIAO ESP32-S3 Plus (16 MB flash + octal PSRAM) | P0.1 |
| Q3 | Battery divider ratio + whether `ADC_EN` (GPIO6) must be driven high before sampling | P3.2 |
| Q4 | Does 4.8 MB fit comfortably in 8 MB PSRAM | P0.1 |
| Q5 | Panel rotation/transform for portrait vs landscape mounting | P0.1, then the enclosure decision |
| Q6 | Is the `t133a01` init sequence correct for the EE02 power rails | P0.1 |

---

## Task summary

| Phase | Tasks | Module | Hardware needed |
|---|---|---|---|
| 0 — De-risk | 1 | `ee02-13in-spectra6` (spike) | EE02 + panel |
| 1 — Config structure | 3 | `multi-device-config` | — |
| 2 — Image profiles | 3 | `multi-device-config` | — |
| 3 — EE02 device | 2 | `ee02-13in-spectra6` | EE02 + panel + battery |
| 4 — Acceptance | 2 | `ee02-13in-spectra6` | EE02 + panel + battery |

**11 tasks. Sizes S–M throughout; no task touches more than ~5 files.**

**Ask-first items requiring user approval before the task proceeds:** editing
`specs/epaper-art-frame/SPEC.md` to update the moved config path (P1.3), and the fallback to an
`external_components` override if P0.1 shows the upstream `t133a01` model is wrong for the EE02.
