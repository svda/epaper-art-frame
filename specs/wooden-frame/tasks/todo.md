# Task List: Wooden Frame for the E-Paper Panel

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

---

## Phase 1 — Measure & design

### F1.1: Measure the panel, electronics and leads; map the flying leads
> **Status (2026-10-07):** worksheet at [`../drawings/cut-list.md`](../drawings/cut-list.md).
> Recorded: module **139.5 × 101.0**, panel **125.0 × 100.0**, active **115.0 × 85.0**, `PT` **8.0**,
> header **off the back / left edge, `HD_proj` 10.0** (→ `EW`/`EH` unchanged, `ED` 18.0),
> `RD` **12.5** (excl. swell; +5 chosen → cavity **20.5**), battery **65 × 35 × 10**, NULA
> **70 × 26 × 7**. USB-C **Q6 resolved — bottom** (NULA rotated 90°, pigtail to a bottom receptacle).
> **Lead map waived** — the harness is already terminated and functional on the NULA.
> Remaining: stage photos under `photos/01-measure/`; then F1.2 (derive the cut list).

**Description:** With calipers, measure and record the panel **outline** (`PO_W × PO_H`), thickness
(`PT`), the panel's active area, and the cavity depth (`RD`: module back → back-plate inner face, i.e.
NULA + LiPo + wiring + service loop), mocked up as it will sit. Photograph the panel's **flying-lead bundle** and build the
**lead colour → signal map** (CLK / MOSI / CS / DC / RST / BUSY / power / GND), cross-checking
against the `epaper-art-frame` ESPHome `display` pin map. Flag any lead that is a voltage rail
rather than logic.

**Acceptance criteria:**
- [x] All symbols (`MO_W`, `MO_H`, `PO_W`, `PO_H`, `AW`, `AH`, `PT`, `RD`, battery) measured and
      recorded in `drawings/cut-list.md`. — **done 2026-10-07**, incl. `HD_edge`/`HD_proj` (10.0),
      `ED` (18.0), `RD` (12.5).
- [x] Lead colour → signal map recorded; any non-logic (power-rail) lead identified. — **waived**
      2026-10-07: the harness is already terminated and functional on the NULA (bench 2026-10-02);
      the firmware pin map is the reference (cut-list §2).
- [ ] Sandwich depth mock-up photographed and its measured depth (`RD`) documented. — `RD` measured
      (12.5; +5 swell → cavity 20.5); **photo still pending** under `photos/01-measure/`.
- [x] USB-C port orientation (which edge it faces) recorded (Q6). — **bottom edge** (NULA rotated
      90°, right-angle pigtail to a fixed bottom receptacle).

**Verification:**
- [x] Caliper readings logged in `drawings/cut-list.md` §1. — photos under `photos/01-measure/`
      still **pending**.
- [x] No dimension taken from a datasheet. — confirmed 2026-10-07.

**Dependencies:** none · **Files:** `specs/wooden-frame/drawings/cut-list.md`, `photos/01-measure/` ·
**Scope:** S

---

### F1.2: Derive dimensions and write the cut list
> **Status (2026-10-07):** derived in [`../drawings/cut-list.md`](../drawings/cut-list.md) §4–§5.
> Design values **Rw/Rh = 4/6**, **`F` = 18** → front opening **117 × 88**, frame outer
> **153 × 124**, rebate **8.5 mm deep**, cavity **20.5 mm**, member lengths **153 / 124**. The
> reveal is sized to the **active area** (even ~1–1.5 mm margin), so it is intentionally non-uniform
> over the glass (whose border is 5 W / 7.5 H). `F` was cut from the initial 40 to 18: the board
> (139.5 wide) forces a floor of ~16 mm; at 18 mm the oak past the board is 6.75 mm and the wall
> outboard of the rebate is 5.75 mm. Module overhang **L/R 7 / 7, T/B 0 / 0** → module **centred**,
> both stile rebates **12.25 mm**, no opening offset. Spacer/back-panel depths remain provisional on
> the F2.1 board thickness.

**Description:** Apply the SPEC dimensional model to the recorded measurements —
`opening = PO − 2R`, `rebate depth = PT + 0.5 mm`, `cavity = RD + swell + clearance`, `outer = opening + 2F` —
and produce a timber cut list (member lengths, mitre angles, rebate/spline positions, spacer frame
members, back panel size). Keep it to one board so grain runs continuously.

**Acceptance criteria:**
- [x] Cut list complete, with every dimension traced to a measured value and an allowance. — **done
      2026-10-07** (module centred; no offset required).
- [x] Cut plan shows all members nested on one board for continuous grain. — board sizing and
      sequential-mitre technique recorded (cut-list §5).
- [x] Reveal `R` and frame face width `F` chosen. — `Rw/Rh` = **4/6** (even active margin);
      `F` = **18** (below the SPEC's 35–45 starting range; deliberately slimmed — the board forces a
      ~16 mm floor).

**Verification:**
- [ ] Review the cut list against the SPEC; confirm no catalogue-derived numbers. — self-checked
      2026-10-07; **disclose the open item and get user sign-off** (Checkpoint A).

**Dependencies:** F1.1 · **Files:** `specs/wooden-frame/drawings/cut-list.md` · **Scope:** S

---

### Checkpoint A — Measurements & cut list correct
- [x] Measurements + cut list recorded and reviewed (cut-list §1–§5). Lead map **waived** (harness
      already wired).
- [x] Confirmed 2026-10-07: **French cleat** mount, **landscape** orientation, **no glazing**.
- [x] **Reviewed with user** 2026-10-07 — cleared to proceed to timber (F2.1, ask-first).
- [x] Commit the `specs/wooden-frame/` measurements + cut list before any hardwood is cut. —
      `3adc201`.

---

## Phase 2 — Laminate & rout

### F2.1: Laminate the frame ring from the plywood sheet
> **Status (2026-10-11):** material bought — **one 1220 × 610 × 3.6 mm hardwood multiplex sheet**
> (Q3 re-resolved). Owner action: cut layers and laminate (physical bench step).

**Description:** Cut **4 layers** of 3.6 mm ply to the ring blank (153 × 124, plus a trim allowance)
and glue them flat into a **14.4 mm** block with even clamp pressure and flat cauls; let it cure.
**No mitres, no splines** — the ring is routed after lamination. Keep the face veneer grain
consistent across the layers.

**Acceptance criteria:**
- [x] Material chosen and acquired. — hardwood multiplex, one 1220 × 610 × 3.6 mm sheet, bought
      2026-10-11.
- [ ] Four 3.6 mm layers cut and laminated to a flat 14.4 mm block (no twist/rock).
- [ ] Face veneer grain kept consistent across all layers.

**Dependencies:** Checkpoint A · **Scope:** S · **Files:** `drawings/cut-list.md`

---

### F2.2: Rout the ring rebate and build the spacer ring
**Description:** Rout the ring — outer **153 × 124**; the stepped rebate: pocket **141.5 × 103** to
**10.9 mm** deep from the back face (leaving the 3.5 mm front lip), then the front opening
**117 × 88** through that lip. Laminate and cut the **spacer ring** to the **17.6 mm** cavity depth
(inner 141.5 × 103). Take light passes; back the ply to avoid chip-out on the exposed edge.

**Acceptance criteria:**
- [ ] Ring outer 153 × 124; front opening 117 × 88; rebate pocket 141.5 × 103, 10.9 mm deep.
- [ ] Edges clean (no chip-out); the exposed lamination is consistent.
- [ ] Spacer ring gives the measured cavity depth (17.6 mm) plus clearance.

**Dependencies:** F2.1 · **Scope:** M · **Files:** `drawings/cut-list.md`

---

### Checkpoint B — Dry fit (no glue)
- [ ] Ring square and flat (diagonals equal, no rock); spacer sits flush.
- [ ] Panel seats in the rebate, active-area margin even ±0.5 mm, no side loading.
- [ ] Full electronics stack fits the cavity with the lead service loop.
- [ ] **Review with user** before glue/finish.

---

## Phase 3 — Assemble

### F3.1: Attach the spacer ring; true the frame
**Description:** Glue the laminated spacer ring to the back of the frame ring, verify the frame is
square and flat (diagonals within 1 mm), and clean up squeeze-out.

**Acceptance criteria:**
- [ ] Spacer ring bonded flush to the frame back; no gaps.
- [ ] Frame square (diagonals within 1 mm); no rock when laid face-down.

**Dependencies:** Checkpoint B · **Scope:** S

---

### F3.2: Build the rear box and cut the USB-C access
**Description:** Cut the **3.6 mm ply back plate** (one layer of the sheet; it also carries the
electronics — see F5.1) and a bottom-edge slot for the USB-C cable overmould (confirm orientation
from F1.1/Q6); provide the French cleat recess/reinforcement.

**Acceptance criteria:**
- [ ] Back plate removable with screws only (no glue) for service.
- [ ] USB-C plug/cable connects with the slot aligned; slot concealed from the front.
- [ ] Cavity depth clears the measured `RD`.

**Dependencies:** F3.1 · **Scope:** M · **Files:** `drawings/cut-list.md`

---

### Checkpoint C — Structure complete
- [ ] Frame square, solid, back panel removable; panel drops in and out freely.
- [ ] **Review with user** before finishing.

---

## Phase 4 — Finish

### F4.1: Sand, roundover and oil; cure
**Description:** Sand 120 → 180 → 240 grit, break all edges with a consistent 3 mm roundover, apply
the oil/wax finish to a satin sheen, and cure fully (≥72 h per the product data sheet) before any
electronics go inside.

**Acceptance criteria:**
- [ ] Even satin sheen; no drips, runs, sanding marks or glue spots.
- [ ] Edges uniformly rounded; no sharp arrises.
- [ ] Finish fully cured (no solvent smell) before closing the cavity.

**Verification:**
- [ ] Photos committed under `photos/04-finish/`.

**Dependencies:** Checkpoint C · **Scope:** M

---

## Phase 5 — Install & accept

### F5.1: Mount the electronics on the back plate and fit it
**Description:** Mount the NULA (M3 standoff + a foam anti-rotation pad at the far end) and the LiPo
(**removably** — velcro / strap / pocket, never bonded) on the **inner face of the 3.6 mm ply back
plate**. Route the flying leads through an **anchored service loop**, strain-relieved off all sharp
edges, with the NULA's USB-C reaching the bottom slot. Screw the plate to the spacer frame and fit the
removable retaining stops.

**Acceptance criteria:**
- [ ] The back plate is both the panel and the electronics carrier; it unscrews freely with the
      electronics attached.
- [ ] Leads strain-relieved (service loop, anchored, never taut); panel ≥3 mm edge clearance.
- [ ] USB-C reaches the bottom slot; LiPo replaceable without dismantling the frame.

**Dependencies:** F4.1 · **Scope:** M

---

### F5.2: Fit wall-mount hardware and hang test
**Description:** Install the French cleat/wall hardware and hang the frame. Load-test with 2× the
device weight and leave 24 h.

**Acceptance criteria:**
- [ ] Hangs flat (no rock, ≤2 mm wall gap); holds 2× device weight.
- [ ] Undisturbed for 24 h; no sag, no pull-out.
- [ ] USB-C charging still accessible while wall-mounted.

**Dependencies:** F5.1 · **Scope:** S

---

### F5.3: Final acceptance and cross-spec update
**Description:** Run the device acceptance inside the finished frame: render the test pattern / next
image and enter deep sleep. Photograph the finished unit. Mark the `epaper-art-frame` P3.2 task done
and record any deviations.

**Acceptance criteria:**
- [ ] Device renders and deep-sleeps while inside the finished frame.
- [ ] No electronics/wiring/battery visible from the front.
- [ ] `epaper-art-frame` P3.2 acceptance ticked with a photo reference.
- [ ] `drawings/cut-list.md` reflects what was actually built.

**Verification:**
- [ ] `.venv/bin/esphome config config/esphome/epaper-art-frame.yaml` still validates.
- [ ] Photos committed under `photos/05-installed/`.

**Dependencies:** F5.2 · **Scope:** S · **Files:** `specs/epaper-art-frame/tasks/todo.md`

---

### Checkpoint D — Frame complete
- [ ] All SPEC success criteria met.
- [ ] **Review with user** — the frame is finished; `epaper-art-frame` P3.2 satisfied.
