# Spec: Wooden Frame for the E-Paper Panel

Status: **draft — awaiting review** · Revision 1 (2026-09-28)
Slug: `wooden-frame`
Related: [`../epaper-art-frame/SPEC.md`](../epaper-art-frame/SPEC.md) (the device this houses)

> This spec covers a **physical, handmade hardwood frame** that houses the Waveshare 5.65" 7-colour
> ACeP panel, the Soldered NULA DeepSleep ESP32-S3 and a 3000 mAh LiPo. It is a *separate
> deliverable* from the device itself: `epaper-art-frame` lists "enclosure design" as a **non-goal**,
> so the frame is specified here. When this spec is built, `epaper-art-frame`'s **P3.2
> "Enclosure / mounting"** is satisfied by it (cross-referenced, not duplicated).

---

## Objective

A one-off, furniture-grade wooden frame that makes the e-paper display read as an intentional piece
of décor in a living space — not a hobby project on the wall. It must look like a well-made picture
frame from the front, hide all electronics from view, and still be completely serviceable: the panel
must come out without damage and the battery must charge and be replaceable without destroying the
frame.

**Users**

| User | Need |
|---|---|
| Household / guests (viewers) | Reads as framed art; no visible wiring, boards or battery; no glare |
| The maker (owner) | Recharge the battery easily; swap the panel/battery/board later; a build achievable with a mitre saw, drill and sander |

**Success looks like:** mounted on the wall, a visitor assumes it is a professionally framed print.

**Out of scope:** batch production, CNC, glazing, mains power, enclosure for any other panel.

---

## Design decisions (from interview)

- **Objective priority:** furniture-grade appearance / intentional décor.
- **Form factor:** mitred hardwood picture frame with a clean visible reveal, plus a **hidden rear
  box** (spacer frame + a **3.6 mm ply back plate** that also carries the electronics).
- **Workshop:** mitre saw (or mitre box + handsaw), drill, random-orbit sander. Mitred corners
  glued and **reinforced with splines or dowels**; rebates cut with a router or stacked saw cuts.
- **Material / finish:** hardwood (oak / ash / walnut / maple) with an **oil or wax finish**.
- **Panel retention:** panel rests in a machined **rebate**, held by thin **removable retaining
  stops** (wood stops or z-clips). Nothing is bonded to the panel.
- **Panel interface:** the panel is the **Module (F)** — no Raspberry-Pi-style HAT, but the module
  carries its **own onboard driver PCB**, with a 30-pin FPC (`AYF532435`) and an 8-pin header
  exposing **VCC, GND, DIN, CLK, CS, DC, RST, BUSY** via coloured jumper wires. The **module outline
  (138.5 × 100.5 mm)** is ~13 mm wider than the panel itself (125.4 × 99.5 mm), so the rear cavity
  must clear the PCB tab, not just the panel. The leads still need **strain relief, a service loop,
  and a defined route** to the NULA.
- **Back plate = electronics carrier.** A single **3.6 mm plywood plate** is both the frame's back
  panel and the electronics carrier: the NULA (M3 standoff + a foam anti-rotation pad at the far end)
  and the LiPo (held **removably** — velcro / strap / pocket, never bonded) mount on its **inner
  face**. Unscrewing the back plate pulls the whole electronics out in one piece. The panel stays
  separate, held in the front rebate by the stops, with a **service loop** in the harness so the
  plate can be freed. Orient the NULA so its **USB-C reaches the bottom slot**.
- **Glazing:** **none** (assumed) — the panel is matte and already reads as paper; glass/acrylic adds
  glare, weight and depth.

---

## Dimensional model

The panel and electronics are in hand, so **the build starts by measuring, not by trusting
catalogues.** All frame dimensions are *derived* from measured values:

| Symbol | Meaning | Source |
|---|---|---|
| `MO_W × MO_H` | **Module (F) outline** — panel + onboard driver PCB (**the true footprint**) | measured: **139.5 × 101.0 mm** (Waveshare ref 138.5 × 100.5 — ~1 mm tight) |
| `PO_W × PO_H` | Panel outline (glass edge), **smaller** than the module | measured: **125.0 × 100.0 mm** (ref 125.4 × 99.5) |
| `AW × AH` | Active / visible area | measured: **115.0 × 85.0 mm** (ref 114.9 × 85.8) |
| `PT` | Module thickness incl. header, risers removed (9.0 mm with the 4 corner risers fitted) | measured: **8.0 mm** |
| `RD` | Cavity depth: module back → back-plate inner face (NULA + LiPo + wiring + service loop) | measured / mock-up |
| `R` | **Reveal** — how far the frame overlaps the panel edge, per side | design: **3–5 mm** |
| `F` | Frame face width | design: **35–45 mm** |
| `BP` | Back plate thickness — 3.6 mm ply; **also the electronics carrier** | design: **3.6 mm** |

Derived:

```
front opening      = PO_W - 2R  ×  PO_H - 2R      (reveal over the panel edge)
rebate / inner     = MO_W + 2 mm  ×  MO_H + 2 mm  (must clear the module PCB and its tab)
rebate depth       = PT + 0.5 mm
cavity depth       = RD + 3 mm minimum
frame outer        = opening + 2F, and ≥ MO + 2×margin   (F must clear the module tab)
```

**The module PCB tab is asymmetric** (it extends ~13 mm on one side) — record its orientation
before cutting and give that side a wider member / more clearance.

**Reference (to be verified, not assumed):** Waveshare lists **active area 114.9 × 85.8 mm**,
**panel outline 125.4 × 99.5 × 0.91 mm**, **Module (F) outline 138.5 × 100.5 mm**. The module
measured **139.5 × 101.0 mm** — the datasheet is ~1 mm tight, which is exactly why this spec is
measure-first. Confirm everything with calipers; **do not cut to catalogue numbers.**

---

## Commands

Physical build procedures, plus the repo commands that gate each increment.

```
Measure & record   → digital calipers; log every value in drawings/cut-list.md
Layout & cut list  → derive all dimensions from the model above; write drawings/cut-list.md
Dry fit            → assemble all joints AND the panel + electronics stack with no glue
Cut rebates        → router or stacked saw cuts; test-fit offcuts first
Glue up & clamp    → splines/dowels + glue; check corners for square before clamping
Sanding           → 120 → 180 → 240 grit; break all edges with a 3 mm roundover
Finish            → oil/wax per product data sheet; fully cure (≥72 h) before electronics go in
Fit check         → panel in rebate, reveal uniform, panel removable, USB-C reachable
Wall test         → hang with 2× device weight; confirm no rock and a ≤2 mm wall gap
Commit            → git add specs/wooden-frame && git commit -F -   (with Spec:/Task: trailers)
Device re-validate → .venv/bin/esphome config config/esphome/epaper-art-frame.yaml
```

---

## Project Structure

```
specs/wooden-frame/
  SPEC.md                 → this spec
  drawings/cut-list.md    → measured values, derived dimensions, cut list, joinery notes
  drawings/*.md|*.svg     → sketches / section views (as needed)
  photos/                 → build-stage photographs (measurement, dry fit, glue-up, finish, installed)
```

Physical work happens at the bench; the **recorded evidence lives in this directory** so a future
session can reproduce the build. The device firmware stays where it is
(`config/esphome/`, `specs/epaper-art-frame/`) — this spec never modifies it except via the
re-validation command above.

---

## Code Style (design standards)

Consistency of detail is what separates "furniture" from "homemade". One worked example of the
standard, rather than rules in the abstract:

```
Front elevation (not to scale)
┌───────────────────────────────┐   reveal R uniform on all 4 sides
│  ┌─────────────────────────┐  │   corners: closed 45° mitre, spline visible as a
│  │  600 × 448 e-paper      │  │   thin line, grain running continuously around
│  └─────────────────────────┘  │   edge: 3 mm roundover, sanded to 240, oiled satin
└───────────────────────────────┘   hardware: brass or black, countersunk, no proud heads
        F = 35–45 mm face width
```

Conventions:

- **Reveal uniform within 0.5 mm** on all four sides — the single most visible quality signal
- Grain runs continuously around the frame (mitred corners, sequential cuts from one board)
- Edge profile: consistent **3 mm roundover**, no sharp arrises
- Splines: aligned, equal width, sanded flush — a deliberate detail, not a repair
- Finish: **satin**, even sheen, no drips, runs or sanding marks
- Hardware: countersunk, seated flush, single style
- All dimensions recorded to **0.5 mm**; work to ±1 mm on the opening

---

## Testing Strategy

No unit tests — the "tests" are fit, tolerance and durability checks, each with photo evidence.

| Check | Level | Pass condition |
|---|---|---|
| Measurement record | small | Every symbol measured and logged **before** any cut |
| Dry fit (joints) | small | All four corners meet with no gaps before glue |
| Dry fit (panel) | small | Panel seats in the rebate, reveal uniform ±0.5 mm, no side loading |
| Removability | integration | Panel comes out with a screwdriver in <5 min, no flex, FPC never taut |
| Charge access | integration | USB-C cable plugs in and charges with the frame wall-mounted |
| Battery replaceable | integration | LiPo can be unplugged and replaced without cutting/dismantling the frame |
| Wall mounting | large | Hangs flat (no rock, ≤2 mm gap), holds 2× device weight, undisturbed for 24 h |
| Finish cure | integration | No solvent smell; finish fully cured before the cavity is closed |
| Device still works | e2e | After installation, the device renders and enters deep sleep (P0.1 test pattern, then daily rotation) |

---

## Boundaries

**Always do**
- Measure the physical panel, NULA and battery with calipers and record the values before cutting
- Dry-fit every joint *and* the full electronics stack before any glue or finish
- Leave **≥3 mm** clearance around the panel edge and **≥5 mm** around the LiPo (pouch cells swell)
- Keep the panel's FPC/ribbon cable strain-free — never taut, never pinched
- **Strain-relieve the flying-lead bundle**: anchor it to the frame, include a service loop, and
  keep it off sharp edges
- Keep the USB-C port reachable from the **bottom edge** (the frame hangs flush on the wall)
- Fully cure the finish (≥72 h per the product data sheet) **before** closing electronics inside
- Photograph each build stage and commit the cut list + photos under `specs/wooden-frame/`
- Commit with `Spec:` / `Task:` / `Co-Authored-By:` trailers per `AGENTS.md`

**Ask first**
- Buying furniture-grade hardwood or any new tool
- Deviating from the measured dimensions or the reveal/frame-width allowances
- Drilling or screwing into **the panel** itself (mounting holes, brackets)
- Adding glazing (glass/acrylic) or changing the no-glazing decision
- Changing the wall-mount method
- Any change that would make the panel or battery non-removable

**Never do**
- **No mains/AC power** — the device is battery-only
- **Never permanently bond** the panel or the LiPo to the frame (no glue, no permanent tape)
- Never let solvents or solvent-based finishes touch the panel or electronics
- Never sand, cut, drill, or clean the panel itself
- Never pull, kink, crush or solder-stress the panel's flying leads
- Never squeeze, bend or flex the panel or the LiPo
- Never seal the LiPo in a way that prevents replacement
- Never modify `epaper-art-frame`'s firmware/config from this spec (re-validate only)
- Never re-purpose the e-paper spec's tasks here, or vice versa

---

## Success Criteria

- [ ] All symbols in the dimensional model measured, recorded and committed **before** cutting
- [ ] Frame reads as furniture: continuous grain, closed mitres, uniform satin finish, no visible hardware from the front
- [ ] **Reveal uniform within 0.5 mm** on all four sides; panel square in the opening
- [ ] Panel removable with a screwdriver in <5 minutes, no flex, FPC never taut
- [ ] USB-C charging works with the frame wall-mounted; battery replaceable without dismantling
- [ ] Hangs flat and securely (no rock, ≤2 mm wall gap, 2× device weight, 24 h undisturbed)
- [ ] No electronics, wiring or battery visible from the front
- [ ] Device still renders and deep-sleeps after installation

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Cut to catalogue dimensions, not the real panel | **High** — wasted hardwood, re-cut | Measure first; dry-fit the panel before glue-up |
| Mitchell corners open / out of square | Medium | Splines/dowels + dry fit + check diagonals before clamping |
| Frame sized to the **panel**, not the module → PCB tab clashes | **High** — frame won't close | Size the rebate/cavity to `MO + 2 mm`; record the asymmetric tab orientation before cutting |
| Rear cavity too shallow (stack-up underestimated) | Medium | Mount the NULA + LiPo + wiring + loop on the back plate, fit it, and measure `RD` before cutting the spacer |
| Flying leads stressed or broken at the panel | **High** — panel unusable | Strain-relieve the lead bundle (service loop, anchored to the frame, never taut); never route over a sharp edge |
| Panel stressed by the retaining stops | **High** — cracked panel | Stops bear on the frame/sub-panel, not the glass; ≥3 mm clearance; no clamping pressure on the panel |
| Finish off-gassing inside the closed box | Medium | Cure ≥72 h before closing; oil/wax only, no solvent lacquer |
| LiPo swell / not replaceable | Medium | ≥5 mm clearance; JST reachable; back panel screwed, not glued |
| Frame cannot be recharged while wall-mounted | Medium | Bottom-edge USB-C slot, sized for the cable overmould |

---

## Open Questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | ~~Panel-to-MCU interface: 30-pin FPC breakout vs Waveshare HAT?~~ **Resolved:** the F variant has **no driver HAT** — the panel connects via a ribbon/FPC and flying leads. Record the **lead colour → signal map** against the `epaper-art-frame` ESPHome pin map before wiring. | Recorded at measurement |
| Q2 | Wall-mount method: **French cleat** (default assumption) vs two D-rings vs keyholes? | Confirmation before mounting hardware is fitted |
| Q3 | Hardwood species + tone to suit the room? | Before buying timber |
| Q4 | Orientation confirmed as **landscape** (600 wide × 448 tall)? | Before cutting |
| Q5 | Confirm **no glazing** (assumed) — or acrylic if you want protection? | Before assembling the front |
| Q6 | USB-C is assumed to exit the **bottom** edge — confirm the port's orientation on the NULA once in hand? | At measurement |
