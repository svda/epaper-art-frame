# Task List: Wooden Frame for the E-Paper Panel

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

---

## Phase 1 — Measure & design

### F1.1: Measure the panel, electronics and leads; map the flying leads
> **Status (2026-09-28):** recording worksheet created at
> [`../drawings/cut-list.md`](../drawings/cut-list.md) (§1 measurements, §2 lead map, §3 USB-C).
> **Blocked on your physical caliper readings + a photo of the lead bundle** — tick the criteria
> below once §1–§3 are filled in.

**Description:** With calipers, measure and record the panel **outline** (`PO_W × PO_H`), thickness
(`PT`), the panel's active area, and the rear stack (`RD`: NULA + LiPo + lead breakout + connector +
service loop), mocked up as it will sit. Photograph the panel's **flying-lead bundle** and build the
**lead colour → signal map** (CLK / MOSI / CS / DC / RST / BUSY / power / GND), cross-checking
against the `epaper-art-frame` ESPHome `display` pin map. Flag any lead that is a voltage rail
rather than logic.

**Acceptance criteria:**
- [ ] All symbols (`PO_W`, `PO_H`, `PT`, `RD`) measured and recorded in `drawings/cut-list.md`.
- [ ] Lead colour → signal map recorded; any non-logic (power-rail) lead identified.
- [ ] Rear-stack mock-up photographed and its measured depth documented.
- [ ] USB-C port orientation (which edge it faces) recorded (Q6).

**Verification:**
- [ ] Caliper readings logged; photos committed under `photos/01-measure/`.
- [ ] No dimension taken from a datasheet.

**Dependencies:** none · **Files:** `specs/wooden-frame/drawings/cut-list.md`, `photos/01-measure/` ·
**Scope:** S

---

### F1.2: Derive dimensions and write the cut list
**Description:** Apply the SPEC dimensional model to the recorded measurements —
`opening = PO − 2R`, `rebate depth = PT + 0.5 mm`, `cavity = RD + 3 mm`, `outer = opening + 2F` —
and produce a timber cut list (member lengths, mitre angles, rebate/spline positions, spacer frame
members, back panel size). Keep it to one board so grain runs continuously.

**Acceptance criteria:**
- [ ] Cut list complete, with every dimension traced to a measured value and an allowance.
- [ ] Cut plan shows all members nested on one board for continuous grain.
- [ ] Reveal `R` fixed in 3–5 mm and frame face width `F` in 35–45 mm.

**Verification:**
- [ ] Review the cut list against the SPEC; confirm no catalogue-derived numbers.

**Dependencies:** F1.1 · **Files:** `specs/wooden-frame/drawings/cut-list.md` · **Scope:** S

---

### Checkpoint A — Measurements & cut list correct
- [ ] Measurements + lead map committed and reviewed before any hardwood is cut.
- [ ] Confirm French cleat mount, landscape orientation, and no glazing still stand.
- [ ] **Review with user** — proceed to cutting (this is the expensive mistake to avoid).

---

## Phase 2 — Mill & joinery

### F2.1: Buy timber, mill and cut the frame members — ask first
**Description:** Confirm the hardwood species/tone (Q3, ask-first purchase), then square and cut the
four frame members to length with 45° mitres. Test the mitre setup on offcuts first.

**Acceptance criteria:**
- [ ] Species/tone chosen and approved; timber acquired.
- [ ] Four members cut to the cut-list lengths; mitres test-fitted on offcuts.
- [ ] Members marked to preserve continuous grain around the frame.

**Dependencies:** Checkpoint A · **Scope:** S · **Files:** `drawings/cut-list.md` ·
**Ask first — hardwood purchase / species.**

---

### F2.2: Cut the rebate, spline grooves and rear-box spacer members
**Description:** Machine the internal rebate (depth `PT + 0.5 mm`, width for the panel + stops) and
the spline grooves/dowel holes in the mitres. Cut the spacer-frame members that create the rear
cavity depth (`RD + 3 mm`).

**Acceptance criteria:**
- [ ] Rebate matches the measured panel thickness and allows the stops.
- [ ] Spline grooves/dowel positions matched across all four corners.
- [ ] Spacer members sized to give the measured cavity depth plus clearance.

**Dependencies:** F2.1 · **Scope:** M · **Files:** `drawings/cut-list.md`

---

### Checkpoint B — Dry fit (no glue)
- [ ] Frame joints assemble with no gaps; diagonals equal (square).
- [ ] Panel seats in the rebate, reveal uniform ±0.5 mm, no side loading.
- [ ] Full electronics stack fits the cavity with the lead service loop.
- [ ] **Review with user** before glue/finish.

---

## Phase 3 — Assemble

### F3.1: Glue up the frame corners
**Description:** Glue the mitres with splines or dowels; clamp and verify square before the glue
sets; clean squeeze-out.

**Acceptance criteria:**
- [ ] Corners closed (no visible gap >0.2 mm); frame square (diagonals within 1 mm).
- [ ] Splines/dowels seated and flush; no clamp marks.

**Dependencies:** Checkpoint B · **Scope:** S

---

### F3.2: Build the rear box and cut the USB-C access
**Description:** Assemble the spacer frame + screwed back panel to enclose the cavity. Cut a
bottom-edge slot for the USB-C cable overmould (confirm orientation from F1.1/Q6) and provide the
French cleat recess/reinforcement.

**Acceptance criteria:**
- [ ] Back panel removable with screws only (no glue) for service.
- [ ] USB-C plug/cable connects with the slot aligned; slot concealed from the front.
- [ ] Cavity depth clears the measured stack.

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

### F5.1: Fit retaining stops and install the electronics
**Description:** Fit the removable retaining stops and mount the NULA, LiPo and lead breakout in the
cavity. Route the flying leads through an **anchored service loop**, strain-relieved off all sharp
edges. Confirm the panel is removable and the LiPo can be unplugged/replaced.

**Acceptance criteria:**
- [ ] Panel retained with stops bearing on the frame, not the glass; ≥3 mm edge clearance.
- [ ] Leads strain-relieved (service loop, anchored, never taut).
- [ ] Panel removes with a screwdriver in <5 min; LiPo replaceable without dismantling.

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
