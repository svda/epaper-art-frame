# Implementation Plan: Wooden Frame for the 13.3" Spectra 6 Panel

Spec: [`../SPEC.md`](../SPEC.md) · Plan created 2026-10-14
Task list: [`todo.md`](./todo.md)

---

## Overview

Build a one-off, furniture-grade **solid-hardwood** frame that houses the Seeed EE02 + 13.3" E Ink
Spectra 6 panel (1200×1600) and a LiPo, presented as a **matted framed print**: a **passepartout**
(white archival mat, bevel window cut to the active area) and a **matte anti-reflective acrylic**
cover, over a panel **floated** ~2.5 mm behind the mat. The frame is a mitred hardwood picture frame
with the back plate **recessed into the frame's back**; the EE02 + LiPo ride on it. Everything derives from
**measurements of the physical parts**, never from catalogues.

---

## Architecture decisions

- **Measure-first.** No dimension is hard-coded. `PO`, `PT`, `MO`, `RD` and the EE02/LiPo are
  measured with calipers before any timber is cut; every frame dimension is derived from them.
- **The mat is the reveal.** The frame opening is sized so the **mat border is equal** on all four
  sides; the **mat window** is the active area, centred on the *pixels* (not the glass). The frame
  lip holds the acrylic + mat, so the opening need not chase the glass edge.
- **Equal mat border fixes the outer size.** A 4:3 active area needs the frame exactly
  `AW − AH` = **67.6 mm** wider than tall → outer ≈ **400 × 332.4 mm**.
- **Panel seated off-centre.** The active area is 3.95 mm left of the glass centre, so the panel is
  seated **3.95 mm right** of the opening centre; the mat absorbs the uneven bezel.
- **Float, don't flush.** The panel sits `G` ≈ 2.5 mm behind the mat — a crisp shadow line and
  tolerance against the window cut, and the acrylic never touches the panel.
- **Solid hardwood, mitred + splined.** Members cut with a mitre saw, corners reinforced with
  splines or dowels, rebates cut with a router or stacked saw cuts. No table saw / router table.
- **Back plate carries the electronics.** The EE02 (M3 standoffs) and the LiPo (removable — velcro /
  strap / pocket) mount on the back plate's inner face; unscrewing it frees the electronics. The board
  is **flipped so its component side faces the back plate**; the panel's FPC takes a gentle
  **S-bend**/fold (no twist) to the board's left-edge connector.
- **Back-plate access.** The onboard **buttons** and the **USB-C** face inward (toward the back plate)
  and are reached through **one opening in the back plate** over the board's **whole right side**,
  with the frame **off the wall** (owner accepted — no wall-mounted access required); USB-C via a
  right-angle connector through the opening (`ee02-buttons` Q5).
- **Wall mount:** French cleat on the frame's **solid back rim** (widened to 20 mm for screw purchase — **not** the removable plate), with a lateral stop.
- **Evidence lives in the repo:** cut list under `drawings/`, stage photos under `photos/`.

---

## Sequencing rationale

```
measure parts ──→ derive cut list + mat/acrylic ──→ mill + mitre ──→ rebate + spacer ──→ glue-up
                                                                          │
                    sand + finish (cure ≥72 h) ◄── back rebate + plate ──┘
                             │
        cut mat + acrylic ──→ fit front stack + electronics ──→ buttons/USB test ──→ wall test ──→ accept
```

- **Measurement gates everything.** Cutting hardwood to a wrong dimension wastes the most expensive
  material — measure and derive first, and prove it with a dry fit before glue.
- **Dry fit before glue.** Joints *and* the full front + electronics stack are assembled with no glue,
  so depth/clearance errors surface while they are still cheap.
- **Finish before the mat/acrylic/electronics.** Oil/wax must fully cure (≥72 h) before anything
  goes in — off-gassing must not sit against the panel/mat, and dust must not settle on them.
- **Acceptance is cross-spec:** the frame isn't done until the device renders, deep-sleeps, and the
  buttons step the rotation inside it.

---

## Parallelisation

- **Sequential throughout** — this is a single physical object; each step consumes the previous.
- The only independent prep: the **hardwood purchase** (species, ask-first) and sourcing the **mat +
  matte AR acrylic** can happen while measurement is under way.

---

## Definition of Done (standing bar)

In addition to each task's acceptance criteria:

- [ ] Every dimensional symbol measured and recorded **before** any cut is made.
- [ ] A photograph is committed for each build stage (`photos/`).
- [ ] `drawings/cut-list.md` matches what was actually built (updated if the build deviates).
- [ ] Commits carry `Spec:` / `Task:` / `Co-Authored-By:` trailers (per `AGENTS.md`).
- [ ] The device config is **not** modified by this initiative except the read-only re-validation
      (`esphome config …/epaper-art-frame-13in.yaml`).
- [ ] No mains power; panel and LiPo never bonded or stressed; the mat/acrylic faces never touched.

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Cut to catalogue dimensions, not the real panel | **High** | Measure first; dry-fit the panel before glue-up |
| Frame sized to the panel, not the module/FPC tab | **High** | Size the rebate/cavity to `MO + clearance`; record the tab side (right) |
| Mat window clips the image / shows the bezel | **High** | Window centred on the **active area** (+0.5 mm tol); float; dry-fit |
| Acrylic presses on / rubs the panel | **High** | Float gap `G`; acrylic bears on the frame/mat; dust-free assembly |
| Rear cavity too shallow (EE02 + LiPo + loop) | Medium | Mock the stack on the back plate; measure `RD` before cutting the spacer |
| Buttons/USB/switch unreachable once mounted | Medium | Right-edge (stile) cutouts; verify hung, before finishing |
| FPC stressed or broken | **High** | Anchored service loop; never taut; no sharp edges |
| Mitres open / out of square | Medium | Splines/dowels + dry fit + check diagonals |
| Finish off-gassing in a closed box | Medium | Cure ≥72 h; oil/wax only |
| LiPo swell / not replaceable | Medium | ≥3 mm swell allowance (owner); JST reachable; plate screwed |
| Acrylic scratches during assembly | Medium | Keep the protective film on until closed; handle by edges |

---

## Ask-first / gated items

- **F2.1 (buy hardwood):** species resolved — **black walnut**, satin oil/wax (Q3).
- **Mat + acrylic:** white archival 2.5 mm mat; matte AR acrylic 2 mm (Q3).
- **Checkpoint A:** confirm the derived cut list + mat/acrylic spec before any timber is cut (pending sign-off).

---

## Open questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | Measurements + `RD`/`AC`/`BP`. | **Complete** |
| Q2 | Button/USB/switch access — one back-plate opening, off-wall. | **Resolved** |
| Q3 | Species/mat/acrylic — black walnut; white archival; matte AR. | **Resolved** |
| Q4 | Final `F`/`M` — 18 / 46.8 (outer 400 × 332.4). | **Resolved** |
| Q5 | Power switch — same back-plate opening. | **Resolved** |
| Q6 | French cleat vs other mount — confirm wall type/load. | Owner |

---

## Task summary

| Phase | Tasks | Deliverable |
|---|---|---|
| 1 — Measure & design | F1.1–F1.2 | Recorded measurements, derived cut list + mat/acrylic spec |
| 2 — Mill & joinery | F2.1–F2.2 | Cut members, rebate, spacer |
| 3 — Assemble | F3.1–F3.2 | Glued frame, back rebate, plate access |
| 4 — Finish | F4.1–F4.2 | Sanded, oiled, cured; mat + acrylic cut |
| 5 — Install & accept | F5.1–F5.3 | Working, wall-mounted, cross-spec updated |

**11 tasks. Sizes XS–M. Sequential; measurement is the hard gate.**
