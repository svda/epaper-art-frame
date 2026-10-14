# Spec: EE02 User Buttons — Previous / Next Artwork

Status: **approved** · Revision 1 (2026-10-14)
Slug: `ee02-buttons`

> **What this adds.** On the EE02 13.3" frame, the two user buttons (GPIO2 / GPIO3) wake
> the device from deep sleep and step the artwork rotation one image back or forward. The
> third button (GPIO5) stays unwired. Nothing new is added to the server side: Home
> Assistant still only serves images and observes the daily wake — the buttons are a
> purely on-device index operation.
>
> This closes the "not wired in v1" line in
> [`specs/ee02-13in-spectra6/SPEC.md`](../ee02-13in-spectra6/SPEC.md) (`:185`, and the
> non-goal at `:677`).

---

## Objective

Give the household a way to change what the frame shows **without waiting for the next
scheduled wake and without opening a phone**. Pressing the previous/next button wakes the
device, shows the adjacent image in the round-robin, and it goes back to sleep.

**The user** is the same household as the existing frames. **Success** is: a press lands
the adjacent image on the glass within ~30–60 s; the round-robin index persists so the
daily timer continues from wherever the user left off; and the existing 5.65" frame's
behaviour is unchanged.

### Scope check (Phase 0)

Single capability — no capability map. This is one behaviour on one device, and it does
not bundle independently testable modules.

### Confirmed decisions (from interview)

- **Household-facing artwork control** — not a setup/maintenance affordance.
- **Wakes and responds on the spot**, from deep sleep. A press that does something a day
  later is not a control.
- **~30 s response latency accepted** — the 13.3" Spectra 6 refresh alone measured ~29 s
  (see the parent spec's power budget).
- **Previous / next only.** Favorite is out of scope (it would require a new device→HA
  write path, against the "HA never directs the device" design). Shuffle is out of scope.
- **Third button (GPIO5) left unwired.**
- **Physical access is a requirement for the not-yet-specified EE02 enclosure** — the
  buttons must be reachable when the frame is wall-mounted. This spec defines the
  firmware behaviour; the enclosure spec owns the access cutout.

---

## The system

| Property | Value |
|---|---|
| Device | `epaper-art-frame-13in` (Seeed XIAO ePaper Display Board EE02) |
| Buttons | GPIO2 = previous, GPIO3 = next, GPIO5 = **unwired** |
| Wake source | `esp32_ext1_wakeup`, `mode: ANY_LOW` (press pulls the pin LOW) |
| Direction signal | `deep_sleep` per-pin `on_wake` sets a `art_direction` global (+1 / −1) |
| Response | wake → join WiFi → fetch manifest → render adjacent image → sleep |
| Latency | ~30–60 s (dominated by the ~29 s Spectra 6 full refresh) |
| Server surface | **unchanged** — no new HA entity, endpoint, or write path |

### Behaviour

1. Device is in deep sleep (asleep ~99.9% of the time, e-paper holds its image).
2. A button press pulls its pin LOW and wakes the ESP32 via `ext1`.
3. ESPHome's per-pin `on_wake` trigger fires (setup priority 700) and sets
   `art_direction` to −1 (previous) or +1 (next).
4. The shared `on_boot` (priority 600) waits for WiFi, fetches `manifest.json`, and runs
   `show_image`, which offsets the persisted index by the direction.
5. The image renders (~29 s), the device publishes its sensors, and deep-sleeps.
6. A timer wake (the daily cadence) fires no `on_wake`, so `art_direction` stays at its
   default +1 — **next image, exactly as today**.

### Index semantics

`art_index` is persisted across deep-sleep reboots and always holds the **index of the
next image to show** (the existing invariant). Let `c` = image count.

| Wake | direction | image shown | `art_index` after |
|---|---|---|---|
| Timer (daily) | +1 | `art_index` | `art_index + 1` |
| Next button | +1 | `art_index` | `art_index + 1` |
| Previous button | −1 | `art_index − 2` | `art_index − 1` |

All arithmetic is modulo `c`. So after a "previous" press the last-shown image is
`art_index − 2`, and the next timer wake shows `art_index − 1` — the image that follows
the one the user just saw. Forward and backward are consistent.

---

## Design

### Device file — `config/esphome/devices/epaper-art-frame-13in.yaml`

Add the two button pins and the ext1 wake configuration. `deep_sleep:` is already defined
in `common/art-frame.yaml`; this **deep-merges** into it (package merge combines dicts),
so `id` / `run_duration` / `sleep_duration` are not repeated here.

```yaml
substitutions:
  # (existing entries unchanged)
  button_prev_pin: GPIO2
  button_next_pin: GPIO3
  # GPIO5 is deliberately unwired — see Non-goals.

deep_sleep:
  # Both buttons wake the device; the timer wake (sleep_duration) is unaffected.
  esp32_ext1_wakeup:
    mode: ANY_LOW
    pins:
      - pin:
          number: ${button_prev_pin}
          mode: INPUT_PULLUP
        on_wake:
          then:
            - lambda: id(art_direction) = -1;
      - pin:
          number: ${button_next_pin}
          mode: INPUT_PULLUP
        on_wake:
          then:
            - lambda: id(art_direction) = 1;
```

The device header comment block gains the button pin map, and the
`Buttons 1/2/3 -> GPIO2 / GPIO3 / GPIO5 (not wired in v1)` line is updated to
`prev / next / unwired`.

### Shared pipeline — `config/esphome/common/art-frame.yaml`

Two changes. Both are **behaviour-preserving when `art_direction == 1`**, so the 5.65"
frame (which has no buttons and never sets the global) is unaffected.

**1. New global:**

```yaml
globals:
  # (existing entries unchanged)
  # Rotation direction for the current wake: +1 = next (the default, set at
  # construction on every boot), -1 = previous (set by the ext1 on_wake trigger
  # before the fetch runs). Never restored — a fresh boot always starts at +1.
  - id: art_direction
    type: int
    restore_value: false
    initial_value: "1"
```

**2. `show_next_image` → `show_image`, direction-aware:**

```yaml
  - id: show_image
    then:
      - lambda: |-
          if (id(art_count) <= 0) {
            ESP_LOGW("art", "no images in manifest; nothing to show");
            return;
          }
          int c = id(art_count);
          int i = ((id(art_index) % c) + c) % c;
          // Backward: show the image before the last one shown (art_index - 2),
          // then leave art_index one step back.
          if (id(art_direction) < 0)
            i = ((i - 2) % c + c) % c;
          std::string url = std::string("${ha_url}/${image_dir}/") + id(art_list)[i];
          ESP_LOGI("art", "showing %d/%d (dir %d): %s", i + 1, c, id(art_direction), url.c_str());
          id(art_image).set_url(url);
          id(art_image).update();
          id(last_image).publish_state(id(art_list)[i]);
          id(art_index) = ((i + 1) % c + c) % c;
```

`fetch_manifest`'s call site changes from `script.execute: show_next_image` to
`script.execute: show_image`. The id is internal to `common/` — nothing else references it.

### Why the ordering is safe (verified against ESPHome 2026.9.0 source)

- `deep_sleep`'s `Ext1WakeTrigger` runs at setup priority **700**
  (`esphome/components/deep_sleep/deep_sleep_component.h:88,113`).
- The shared `on_boot` runs at priority **600** (`art-frame.yaml`).
- Higher setup priority runs first, so `art_direction` is set **before** `fetch_manifest`
  executes.
- Package merge deep-merges dicts and concatenates lists
  (`esphome/config_helpers.py:77`), so the device `deep_sleep:` block merges into the
  common one rather than replacing it.

---

## Commands

Run **from the repo root**; `ESPHOME_DATA_DIR` is pinned so both devices share one build
cache.

```
# Validate (transitively validates both common/ packages)
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
  .venv/bin/esphome config config/esphome/devices/epaper-art-frame-13in.yaml
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
  .venv/bin/esphome config config/esphome/devices/epaper-art-frame.yaml   # no-regression gate

# Build + flash (upload does NOT recompile after a config edit — compile first)
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
  .venv/bin/esphome compile config/esphome/devices/epaper-art-frame-13in.yaml
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
  .venv/bin/esphome upload  config/esphome/devices/epaper-art-frame-13in.yaml

# Logs over the network API
ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
  .venv/bin/esphome logs config/esphome/devices/epaper-art-frame-13in.yaml \
    --device epaper-art-frame-13in.local
```

---

## Code style

- **Pin map lives in `substitutions:`**, referenced as `${…}` everywhere else — no GPIO
  number appears twice, matching the existing device files.
- **The device file holds only what is true of that device** — the button pins and the
  ext1 wake config. The pipeline stays device-agnostic in `common/`.
- **Comments explain *why***: e.g. why `art_direction` is never restored, why the ext1
  trigger's 700 > `on_boot`'s 600 matters.
- **`common/` never contains a device-specific value** — no pin, no dimension, no model.
- **Behaviour-preserving by default**: `art_direction == 1` reproduces the current
  pipeline byte-for-byte in effect.

---

## Testing strategy

Two levels — this is hardware; there is no unit-test seam for ESPHome YAML, and the
`tools/epaper` pytest suite is untouched by this change.

**Level 1 — schema (fast, no hardware).** `esphome config` must pass for **both** device
files. This is the gate that catches an invalid ext1 pin, a wrong wake mode, or a broken
package merge.

**Level 3 — bench checklist (manual, on real hardware).** Run in order; record results
back into this spec.

1. `esphome config` passes for both devices; `esphome compile` succeeds.
2. Flash the EE02; confirm it boots and logs over the network API.
3. **Timer wake unchanged:** let the device sleep, wake on the timer, and confirm it
   shows the next image in rotation and the `Last image` sensor updates.
4. **Next button:** press GPIO3. Confirm the device wakes, logs `dir 1`, and shows the
   next image.
5. **Previous button:** press GPIO2. Confirm the device wakes, logs `dir -1`, and shows
   the previous image.
6. **Persistence:** after a previous press, let the timer wake fire; confirm it shows the
   image *after* the one just shown (index continued, not reset).
7. **Idempotence / edge:** press rapidly during the awake window — confirm at most one
   step per wake (see Open Questions), and that a single-image manifest does not crash.

---

## Boundaries

**Always**

- Run `esphome config` on **both** device YAMLs before committing.
- Keep the existing 5.65" device's behaviour identical — its wake must still show the
  next image.
- Keep the button pins in `substitutions:` and the pipeline device-agnostic.
- Update `specs/ee02-13in-spectra6/SPEC.md`'s "not wired in v1" line and the device
  registry when this ships.

**Ask first**

- Changing anything in `common/` that alters the existing device's behaviour beyond the
  direction plumbing.
- Adding a dependency, bumping the pinned ESPHome version, or touching the community
  `ee02_epaper` component.
- Changing the wake mode, the pin map, or wiring the third button.

**Never**

- Add a device→HA write path (no favorite, no control channel).
- Cut power mid-refresh — the existing sleep-after-render guarantee must hold on button
  wakes too.
- Break the daily timer wake by making it depend on a button.
- Commit `secrets.yaml`, API keys, or WiFi credentials.

---

## Success criteria

1. `esphome config` passes for `devices/epaper-art-frame-13in.yaml` and
   `devices/epaper-art-frame.yaml`; `esphome compile` succeeds for both.
2. **No regression:** the 5.65" frame's effective config and behaviour are unchanged — its
   timer wake still shows the next image. Proven by `esphome config` diff (only the new
   `art_direction` global and the renamed script appear) plus a bench timer wake.
3. Pressing GPIO3 wakes the EE02 and shows the **next** image within ~60 s; the log shows
   `dir 1`.
4. Pressing GPIO2 wakes the EE02 and shows the **previous** image within ~60 s; the log
   shows `dir -1`.
5. After a button press, the next timer wake continues the rotation from the adjusted
   index — it does not reset or repeat.
6. The device deep-sleeps after every button wake (never stays awake), and the third
   button (GPIO5) is unconnected.

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | Are the EE02 buttons active-LOW, and does the board provide external pull-ups? | Bench: read pin state idle vs pressed. If no external pull-up, `mode: INPUT_PULLUP` (already assumed) is required. |
| Q2 | Does `ANY_LOW` validate for the ESP32-S3 variant in ESPHome 2026.9.0? | **Resolved** — `esphome config` accepts `mode: ANY_LOW` on the S3, and `esphome compile` succeeds. |
| Q3 | Does a second press during the ~51 s awake window get lost (ext1 cannot re-trigger while awake)? | Bench step 7. If a lost press is unacceptable, a follow-up could poll the buttons while awake — **out of scope** for v1. |
| Q4 | Does the community `ee02_epaper` component's `power_pin` handling interfere with RTC-domain pin config on GPIO2/3? | Bench: confirm both wakes work with the panel driver active. |
| Q5 | How are the buttons reached with the frame wall-mounted? | **Not this spec** — a requirement handed to the future EE02 enclosure spec (cutout, or lift-off access). |
| Q6 | Does holding GPIO3 LOW at a button wake disturb boot, given GPIO3 is a strapping pin? | Bench: confirm every "next" press boots normally. |

> **GPIO3 is an ESP32-S3 strapping pin** (JTAG signal source select). Configuring the internal
> pull-up on it raises ESPHome's strapping-pin warning. It does **not** affect boot mode (that is
> GPIO0 / GPIO46), so it is benign for normal operation — but a deep-sleep wake *is* a reset and
> the button is held LOW at that instant, so Q6 verifies it on the bench.

---

## Non-goals

- **Favorite** — would add a device→HA write path; rejected in the interview.
- **Shuffle / random** — rejected in the interview.
- **Wiring the third button (GPIO5)** — left unwired.
- **Any maintenance/setup action** (re-provision, factory reset, status display).
- **Multi-step navigation within one wake** (e.g. press-and-hold to scroll) — one step per
  wake in v1.
- **Live control** — the device is asleep ~99.9% of the time; the buttons are a wake
  source, not a control panel.
- **Any change to the image pipeline, HA folders, or the daily cadence.**
- **The EE02 enclosure** — specify separately; this spec only states the access
  requirement.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Buttons have no external pull-up and float when unpressed → spurious wakes | Medium — battery drain, random image changes | `mode: INPUT_PULLUP` (Q1); bench-verify idle level before deploying |
| `ANY_LOW` rejected for the S3 variant | Low — config fails loudly | Level-1 gate; fall back to `ALL_LOW` (two buttons pressed together — not acceptable) or per-pin polarity with `inverted` |
| A button press is lost if it happens while the device is already awake | Low — user presses again | Documented (Q3); accepted for v1 |
| Adding the direction plumbing changes the 5.65" frame | Medium — regression on a deployed device | Success criterion 2: `esphome config` diff + bench timer wake; default `+1` preserves behaviour |
| `deep_sleep:` package merge replaces rather than merges | Low — config error or lost `id` | Level-1 `esphome config` catches a missing `id`/`sleep_duration`; merge semantics verified in source (`config_helpers.py:77`) |
| Physical access omitted from the enclosure → firmware with no user | Medium — feature unusable when mounted | Handed to the EE02 enclosure spec as an explicit requirement (Q5) |
