# Task List: EE02 User Buttons — Previous / Next Artwork

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

Commands run **from the repo root**. `ESPHOME_DATA_DIR` is pinned on every ESPHome invocation
so both devices share one build cache, and it **must be an absolute path** —
`ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome"`. A relative value is re-relativised against
the config dir and doubles, failing the build.

---

## Phase 1 — Pipeline (shared)

### B1.1: Add direction plumbing to `common/art-frame.yaml`
**Description:** Introduce the device-agnostic half of the feature. Add an `art_direction`
global (int, `restore_value: false`, `initial_value: "1"`) and make the image-selection script
direction-aware: rename `show_next_image` → `show_image`, offset the persisted index by
`art_direction`, and update the `fetch_manifest` call site. With `art_direction == 1` the
effective behaviour must be **identical** to today.

**First step — capture the baseline:** before editing, save the 5.65" frame's effective config
so B3.1 can prove no regression:

```
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
  .venv/bin/esphome config config/esphome/devices/epaper-art-frame.yaml \
  > /tmp/epaper-art-frame.before.yaml
```

**Acceptance criteria:**
- [x] `art_direction` global defined with `restore_value: false`, `initial_value: "1"`.
- [x] `show_next_image` renamed to `show_image`; `fetch_manifest` calls `script.execute: show_image`.
- [x] For `art_direction == 1` the shown image and the index update are unchanged from today.
- [x] For `art_direction == -1` the script shows `art_index − 2` and leaves `art_index − 1`
      (all modulo count); negative modulo is handled (`((x % c) + c) % c`).
- [x] No `#include`, no new dependency, no device-specific value added to `common/`.

**Verification:**
- [x] `esphome config config/esphome/devices/epaper-art-frame.yaml` passes (5.65" still valid).
- [x] Manual read of the lambda: trace index arithmetic for `c = 3`, `art_index = 0`, both
      directions, and confirm the semantics table in the spec holds.

**Dependencies:** None · **Scope:** S · **Files:** `config/esphome/common/art-frame.yaml`

---

## Phase 2 — Device (EE02)

### B2.1: Wire the two buttons on the EE02 device file
**Description:** Add `button_prev_pin: GPIO2` / `button_next_pin: GPIO3` substitutions and a
`deep_sleep: esp32_ext1_wakeup` block (`mode: ANY_LOW`) whose per-pin `on_wake` sets
`id(art_direction)` to −1 / +1. Update the device header pin map to `prev / next / unwired`.

**Acceptance criteria:**
- [x] `deep_sleep:` block adds **only** `esp32_ext1_wakeup` — `id`, `run_duration`,
      `sleep_duration` remain inherited from `common/`.
- [x] Both pins configured `mode: INPUT_PULLUP`; `mode: ANY_LOW`.
- [x] GPIO2's `on_wake` sets `art_direction = -1`; GPIO3's sets `art_direction = 1`.
- [x] GPIO5 (third button) is **not** referenced.
- [x] Header comment records the button pin map and the `prev / next / unwired` roles.

**Verification:**
- [x] `esphome config config/esphome/devices/epaper-art-frame-13in.yaml` passes.
- [x] `esphome compile config/esphome/devices/epaper-art-frame-13in.yaml` succeeds (lambda compiles).
- [x] `esphome config` output shows `deep_sleep` with both the inherited fields and
      `esp32_ext1_wakeup`.

**Dependencies:** B1.1 · **Scope:** S · **Files:** `config/esphome/devices/epaper-art-frame-13in.yaml`

---

## Checkpoint A: After Phase 2
- [ ] `esphome config` passes for both device files.
- [ ] `esphome compile` succeeds for the EE02 device.
- [ ] Review with human before flashing / proceeding to docs.

---

## Phase 3 — Validate

### B3.1: No-regression gate for the 5.65" frame
**Description:** Diff the post-change `esphome config` for `epaper-art-frame` against the
baseline captured in B1.1. The only permitted differences are the new `art_direction` global
and the `show_next_image` → `show_image` rename; the pin map, display model, cadence, HA image
path, and pipeline behaviour must be identical.

**Acceptance criteria:**
- [x] Diff contains **only** the `art_direction` global and the script rename/call-site change.
- [x] No change to pins, `display:`, `deep_sleep` cadence, or image URLs for the 5.65" device.

**Verification:**
- [x] `diff /tmp/epaper-art-frame.before.yaml <(esphome config … epaper-art-frame.yaml)` reviewed.

**Dependencies:** B1.1 · **Scope:** S · **Files:** none (validation only)

### B3.2: Update the docs that claim the buttons are unwired
**Description:** Retire the stale claims now that the buttons are wired: the parent spec's
`Buttons 1/2/3 … not wired in v1` pin-map line and the buttons non-goal
(`specs/ee02-13in-spectra6/SPEC.md:185`, `:677`), and the matching header line in the device
file (already touched by B2.1). **Ask-first.**

**Acceptance criteria:**
- [x] Parent spec's pin-map line and non-goal reflect that prev/next are wired (GPIO5 still unwired).
- [x] No other parent-spec content changes (the adjacent "any trigger other than the daily timer"
      clause was dropped to avoid contradicting the new button trigger).

**Verification:**
- [x] `rg -n "not wired in v1" specs/ee02-13in-spectra6/` returns nothing.

**Dependencies:** B2.1 · **Scope:** S · **Files:** `specs/ee02-13in-spectra6/SPEC.md`

---

## Phase 4 — Bench (hardware)

### B4.1: Bench verification checklist
**Description:** Flash the EE02 and run the spec's bench checklist, recording results back into
`../SPEC.md`'s Open Questions table.

**Acceptance criteria:**
- [x] Timer wake still shows the next image and updates the `Last image` sensor (no regression) —
      verified from a serial capture of a full cycle (fetch → render 43 s → index persisted → sleep).
- [x] GPIO3 (next) wakes the device and shows the next image — **user-confirmed on the panel**.
- [x] GPIO2 (previous) wakes the device and shows the previous image — **user-confirmed on the panel**.
- [x] The index write was observed (`preferences: Writing 2 items … `), so the next timer wake
      continues from the adjusted index (mechanism verified; not separately eyeballed).
- [ ] Rapid presses during the awake window produce at most one step — not tested; documented as
      accepted (one step per wake). A single-image manifest is handled by the `art_count <= 0` guard.
- [x] No spurious wakes with the buttons idle (spec Q1).
- [x] Q1 / Q4 / Q6 resolved in `../SPEC.md`.

**Verification:**
- [x] Serial capture showed the pre-API pipeline lines (`manifest: 37 image(s)`,
      `showing 21/37 (dir 1)`, `Refresh complete`, `Beginning sleep`) on a boot cycle.
- [x] Both buttons confirmed on the panel by the user. (Note: `dir` cannot be read over network
      logs — it is logged before the API connects — and attaching the USB-Serial-JTAG reader
      resets the S3, so the direction was confirmed visually, not from logs.)

**Dependencies:** B2.1, B3.1 · **Scope:** M · **Files:** `specs/ee02-buttons/SPEC.md` (notes)

---

## Checkpoint: Complete
- [x] All Phase 1–4 acceptance criteria met (rapid-press edge case untested and documented as
      accepted; one step per wake).
- [x] No-regression gate (B3.1) clean.
- [x] Success criteria 1–6 in `../SPEC.md` all satisfied (1–2 verified on hardware 2026-10-14).
- [x] Ready for review / commit.
