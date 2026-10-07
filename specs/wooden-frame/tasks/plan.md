# Implementation Plan: Wooden Frame for the E-Paper Panel

Spec: [`../SPEC.md`](../SPEC.md) · Plan created 2026-09-28
Task list: [`todo.md`](./todo.md)

---

## Overview

Build a one-off, furniture-grade hardwood frame that houses the Waveshare 5.65" F-variant e-paper
panel (flying leads, no driver HAT), the Soldered NULA DeepSleep ESP32-S3 and a 3000 mAh LiPo. The
frame is a mitred picture frame with a hidden rear box; the panel sits in a rebate behind removable
retaining stops. Everything derives from **measurements of the physical parts**, never from
catalogue numbers.

---

## Architecture decisions

- **Measure-first.** No dimension is hard-coded. `PO_W/PO_H`, `PT`, `RD` are measured with calipers
  before any timber is cut; every frame dimension is derived from them (SPEC "Dimensional model").
- **Mitred frame + hidden rear box.** Slim visible bezel; depth lives behind, in a spacer frame
  closed by a **3.6 mm ply back plate**.
- **Back plate carries the electronics.** The NULA and LiPo mount on the back plate's inner face, so
  it is both the frame's back panel and the electronics carrier — one part, and unscrewing it frees
  all the electronics. USB-C oriented to the bottom slot.
- **Splines or dowels reinforce the mitres** (mitre saw + drill only; no table saw/router table).
- **Rebate retention, nothing bonded.** Panel held by removable stops; LiPo held so it can be
  unplugged and replaced.
- **Flying leads are strain-relieved** with an anchored service loop — they are the fragile part.
- **Wall mount:** French cleat (agreed default) — holds flat, spreads load, easy to re-hang.
- **No glazing**; **landscape** orientation; **USB-C exits the bottom edge** (frame hangs flush).
- **Evidence lives in the repo:** cut list under `drawings/`, stage photos under `photos/`.

---

## Sequencing rationale

```
measure parts ──→ derive cut list ──→ mill + mitre ──→ rebate + spacer ──→ glue-up
                                                              │
                          sand + finish (cure ≥72 h) ◄── rear box + USB-C slot
                                   │
                     electronics install + strain relief ──→ wall test ──→ acceptance
```

- **Measurement gates everything.** Cutting hardwood to a wrong dimension wastes the most expensive
  material — so measure and derive first, and prove it with a dry fit before glue.
- **Dry fit before glue.** Joints *and* the full electronics stack are assembled with no glue, so
  depth/clearance errors surface while they are still cheap.
- **Finish before electronics.** Oil/wax must fully cure (≥72 h) before the cavity is closed, so
  off-gassing doesn't sit against the panel/board.
- **Acceptance last, and it is cross-spec:** the frame isn't done until the device still renders and
  deep-sleeps inside it.

---

## Parallelisation

- **Sequential throughout** — this is a single physical object; each step consumes the previous.
- The only independent prep: the **hardwood purchase** (species choice, ask-first) can happen while
  measurement is under way.

---

## Definition of Done (standing bar)

In addition to each task's acceptance criteria:

- [ ] Every dimensional symbol measured and recorded **before** any cut is made.
- [ ] A photograph is committed for each build stage (`photos/`).
- [ ] `drawings/cut-list.md` matches what was actually built (updated if the build deviates).
- [ ] Commits carry `Spec:` / `Task:` / `Co-Authored-By:` trailers (per `AGENTS.md`).
- [ ] The device config is **not** modified by this initiative except the read-only re-validation
      (`.venv/bin/esphome config config/esphome/epaper-art-frame.yaml`).
- [ ] No mains power; panel and LiPo never bonded or stressed.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cut to catalogue dimensions, not the real panel | **High** | Measure first; dry-fit the panel before glue-up |
| Mitres open / out of square | Medium | Splines/dowels + dry fit + check diagonals before clamping |
| Rear cavity too shallow | Medium | Mount the NULA + LiPo + leads + loop on the back plate, fit it, and measure `RD` |
| Panel stressed by retaining stops | **High** | Stops bear on the frame, not the glass; ≥3 mm clearance |
| Flying leads stressed/broken | **High** | Anchored service loop; never taut; no sharp edges |
| Finish off-gassing in a closed box | Medium | Cure ≥72 h; oil/wax only |
| LiPo swell / not replaceable | Medium | ≥5 mm clearance; JST reachable; back panel screwed |
| Can't recharge while wall-mounted | Medium | Bottom-edge USB-C slot sized for the cable overmould |

---

## Ask-first / gated items

- **F2.1 (buy hardwood):** species/tone is an ask-first purchase decision (open question Q3).
- **F3.2 (USB-C slot):** **Q6 resolved 2026-10-07** — bottom edge (NULA rotated 90°, pigtail to a
  fixed receptacle). Size the slot to the receptacle/overmould at F3.2.
- **Checkpoint A (2026-10-07):** **French cleat**, **landscape**, **no glazing** confirmed. Remaining
  gate before cutting = the ask-first hardwood species/stock at F2.1.

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q2 | Wall mount: French cleat (default) vs D-rings vs keyholes | **Resolved 2026-10-07** — French cleat |
| Q3 | Hardwood species + tone | **Resolved 2026-10-07** — oak, satin oil/wax |
| Q5 | No glazing (assumed) | **Resolved 2026-10-07** — no glazing |
| Q6 | USB-C exits the bottom edge? | **Resolved 2026-10-07** — NULA rotated 90°, right-angle pigtail to a fixed bottom-edge receptacle |

---

## Task summary

| Phase | Tasks | Deliverable |
|---|---|---|
| 1 — Measure & design | F1.1–F1.2 | Recorded measurements, lead map, cut list |
| 2 — Mill & joinery | F2.1–F2.2 | Cut members, rebate, spacers |
| 3 — Assemble | F3.1–F3.2 | Glued frame, rear box, USB-C slot |
| 4 — Finish | F4.1 | Sanded, oiled, cured |
| 5 — Install & accept | F5.1–F5.3 | Working, wall-mounted, device re-validated |

**10 tasks. Sizes XS–M. Sequential; measurement is the hard gate.**
