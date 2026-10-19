# Task List: Wooden Frame for the 13.3" Spectra 6 Panel

Plan: [`plan.md`](./plan.md) · Spec: [`../SPEC.md`](../SPEC.md)

Every task additionally clears the **Definition of Done** in `plan.md`.

---

## Phase 1 — Measure & design

### F1.1: Measure the panel, EE02 and LiPo
> **Status (2026-10-14): COMPLETE** — recorded in [`../drawings/cut-list.md`](../drawings/cut-list.md) §1.
> Active **270.4 × 202.8**, glass **284.5 × 209**, borders **3.1/11.0/3.1/3.1**, `PT` **1.0**, `FT`
> **0.5**, no bow, LiPo **65 × 35 × 10**, EE02 **43 × 81 × 8** (holes **36 × 75**; buttons + USB-C
> right, battery JST bottom, FPC left/top), `RD` **10** (owner reduced from 12; excl. 3 mm swell).
> Only remaining: stage photos under `photos/01-measure/`.

**Description:** With calipers, measure and record the panel outline, thickness, per-side borders,
the FPC (edge/width/length), `MO`, the EE02 board (outline, thickness, mounting-hole spacing, and the
edge/offset of USB-C, the power switch and the two buttons), and the LiPo. Mock up the back plate
with the EE02 + LiPo + wiring + service loop and measure `RD`.

**Acceptance criteria:**
- [x] Active area, panel outline, per-side borders, `PT`, `FT`, flatness measured and recorded.
- [x] FPC edge (panel right) + connector position (board left/top) recorded; direct plug, no extension.
- [x] `MO` **289.5 × 209** (glass + ~5 mm FPC stub; FPC **25 mm wide**, bends ~5 mm out from the glass edge).
- [x] EE02 board + hole spacing (**36 × 75**) + button/USB/battery edges recorded.
- [x] LiPo outline + thickness (**65 × 35 × 10**) recorded.
- [x] Stack mock-up; `RD` measured (**12**, owner reduced to **10**); photo under `photos/01-measure/` pending.

**Verification:**
- [ ] Caliper readings logged in `drawings/cut-list.md` §1. — active/PO/borders/PT/FT logged; photos
      under `photos/01-measure/` still pending.
- [x] No dimension taken from a datasheet. — confirmed 2026-10-14.

**Dependencies:** none · **Files:** `specs/wooden-frame-13in/drawings/cut-list.md`, `photos/01-measure/` ·
**Scope:** S

---

### F1.2: Derive dimensions and write the cut list
> **Status (2026-10-14): COMPLETE.** Landscape, equal mat border, `F` 18 → `M` 46.8 → opening
> **364 × 296.4**, outer **400 × 332.4**, mat window **270.4 × 202.8**, panel seated **3.95 mm right**,
> member **27.6** (one solid piece), `AC` **2**, `BP` **3.6**, total depth **27.6**.

**Description:** Apply the SPEC dimensional model to the recorded measurements and produce a solid-
hardwood cut list (member lengths, mitres, rebate/spline positions, back plate) plus the mat window and
acrylic sizes. Keep it to one board so grain runs continuously.

**Acceptance criteria:**
- [x] Frame outer, opening, mat border/window, seat offset, member depth derived.
- [x] Cut plan shows the four members + plate from one board for continuous grain (`cut-list.md` §3).
- [x] Mat window (270.4 × 202.8) and acrylic cut (~370 × 302.4) listed, centred on the active area.

**Verification:**
- [x] Reviewed against the SPEC (incl. the `code-review-and-quality` audit); no catalogue-derived
      numbers. **User sign-off 2026-10-14 (Checkpoint A).**

**Dependencies:** F1.1 · **Files:** `specs/wooden-frame-13in/drawings/cut-list.md` · **Scope:** S

---

### Checkpoint A — Measurements & cut list correct
- [x] All measurements recorded (cut-list §1): panel, `MO`, EE02, LiPo, `RD`.
- [x] Cut list + mat/acrylic derived (§2–§3); depth stack complete (`AC` 2, `BP` 3.6, total 27.6).
- [x] **Checkpoint A SIGNED 2026-10-14** — cleared to buy timber (F2.1).

---

## Phase 2 — Mill & joinery

### F2.1: Buy hardwood, mill and cut the frame members — ask first
> **Status (2026-10-14):** species **black walnut** (Q3 resolved); satin oil/wax. Owner action: acquire the board.

**Description:** Confirm the hardwood species/tone (ask-first), square and cut the four frame members
to length with 45° mitres. Test the mitre setup on offcuts first.

**Acceptance criteria:**
- [x] Species/tone chosen and approved; timber acquired.
- [x] Four members cut to the cut-list lengths (400 / 332.4); mitres test-fitted on offcuts.
- [ ] Members marked to preserve continuous grain around the frame.

**Dependencies:** Checkpoint A · **Scope:** S · **Files:** `drawings/cut-list.md`

---

### F2.2: Machine the member (one setup — lip + pocket + back rebate)
**Description:** Machine each member in **one setup**, front to back: a **3 mm front lip** (leaves the
364 × 296.4 opening) → a **pocket to depth 24** at **372 × 304.4** (the acrylic/mat rebate *and* the
electronics cavity) → a **3.6 mm back rebate** (8 mm lip, opening 384 × 316.4) for the flush plate.
Cut the spline grooves/dowel holes in the mitres.

**Acceptance criteria:**
- [ ] Front lip + pocket leave the 364 × 296.4 opening and take the acrylic/mat.
- [ ] Pocket depth 24 — the plate inner face is the pocket floor.
- [ ] Back rebate (3.6 deep, 8 mm lip) takes the plate flush, hidden from the side.
- [ ] Spline grooves/dowel positions matched across all four corners.

**Dependencies:** F2.1 · **Scope:** M · **Files:** `drawings/cut-list.md`

---

### Checkpoint B — Dry fit (no glue)
- [ ] Frame joints assemble with no gaps; diagonals equal (square).
- [ ] Acrylic + mat + float spacer ring + panel + foam + backing ring fit; acrylic never touches the panel.
- [ ] Panel located on the mat window (±0.5 mm); seat offset 3.95 mm right.
- [ ] Full electronics stack fits the cavity with the FPC service loop.
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

### F3.2: Cut the back rebate and the back-plate access
**Description:** Cut the **back rebate** (depth 3.6, ~8 mm lip) into the frame's back so the back
plate sits **flush and hidden**, and cut the **back plate** (carries the electronics — see F5.1) plus
the 4 pads/bosses that capture the backing ring. In the plate, cut **one opening** exposing the
board's **whole right side** (buttons, USB-C, power switch), sized from the F1.1 layout. Provide the
French-cleat recess/reinforcement.

**Acceptance criteria:**
- [ ] Back plate removable with screws only; sits **flush in the back rebate (hidden from the side)**.
- [ ] The opening exposes the board's right side (buttons + USB-C + switch); concealed from the front.
- [ ] 4 pads/bosses press the backing ring; cavity depth clears the measured `RD`.

**Dependencies:** F3.1 · **Scope:** M · **Files:** `drawings/cut-list.md`

---

### Checkpoint C — Structure complete
- [ ] Frame square, solid, back panel removable; panel drops in and out freely.
- [ ] **Review with user** before finishing.

---

## Phase 4 — Finish

### F4.1: Sand, roundover and oil; cure
**Description:** Sand 120 → 180 → 240 grit, break all edges with a consistent 3 mm roundover, apply
the oil/wax finish to a satin sheen, and cure fully (≥72 h per the product data sheet) before anything
goes inside.

**Acceptance criteria:**
- [ ] Even satin sheen; no drips, runs, sanding marks or glue spots.
- [ ] Edges uniformly rounded; no sharp arrises.
- [ ] Finish fully cured (no solvent smell) before the mat/acrylic/electronics go in.

**Verification:**
- [ ] Photos committed under `photos/04-finish/`.

**Dependencies:** Checkpoint C · **Scope:** M

---

### F4.2: Cut the mat and the acrylic
**Description:** Bevel-cut the mat window to ≈ 271 × 203 (active area + tolerance), centred on the
**active area**; cut the matte AR acrylic to **370 × 302.4** (the pocket less 1 mm). Keep the
acrylic's protective film on until final assembly.

**Acceptance criteria:**
- [ ] Mat window even all round the active area; bevel clean, no overcuts.
- [ ] Acrylic cut to fit the rebate with clearance; matte face intact, film on.
- [ ] No dust/fingerprints on the mat or acrylic faces.

**Dependencies:** F4.1 · **Scope:** S

---

## Phase 5 — Install & accept

### F5.1: Mount the electronics and fit the front stack
**Description:** Mount the **EE02 flipped onto the back plate** (component side toward the plate;
its left-edge FPC connector facing the panel) and the LiPo (**removably**) with **M2 standoffs**
(36 × 75). The **25 mm ribbon has no extender**, so the board **straddles the panel's right edge**
and the **backing ring is notched** over it. Route the ribbon with **slack (never taut) and no twist**;
anchor the leads with a **service loop**, strain-relieved off all sharp edges. Cut the **back-plate
opening** over the board's right side (buttons + USB-C + switch). Fit the front stack into the rebate —
**acrylic, mat, float spacer ring, panel** — locating the panel on the mat window (±0.5 mm, 3.95 mm
right); back it with **foam pads + the notched backing ring** (foam pad on the board's edge where it
backs the panel); the ring is **captured by 4 pads/bosses on the back plate**; screw the back plate on.

**Acceptance criteria:**
- [ ] Back plate is both the panel and the electronics carrier; unscrews with the electronics attached.
- [ ] FPC inserted flat — a gentle S-bend/fold only, **no twist**, never taut.
- [ ] Panel floated ≈2.5 mm; acrylic bears on the frame/mat, never the panel.
- [ ] Buttons + USB-C + switch are reachable through the back-plate opening; LiPo replaceable without dismantling.

**Dependencies:** F4.2 · **Scope:** M

---

### F5.2: Buttons/USB test, wall-mount and hang test
**Description:** With the frame assembled, verify the buttons wake and step the art and that USB-C
charges — using the back-plate opening with the frame **off the wall**. Install the French cleat and
hang the frame; load-test with 2× the device weight and leave 24 h.

**Acceptance criteria:**
- [ ] Prev/next buttons work through the back-plate opening **with the frame off the wall**; each wakes and steps the rotation.
- [ ] USB-C plugs in and charges via the back-plate opening (off the wall); power switch reachable.
- [ ] Hangs flat (no rock, no slide); holds 2× device weight; undisturbed for 24 h.

**Dependencies:** F5.1 · **Scope:** S

---

### F5.3: Final acceptance and cross-spec update
**Description:** Run the device acceptance inside the finished frame: render the next image, deep-
sleep, and confirm a button press steps the rotation. Photograph the finished unit. Tick the
`ee02-13in-spectra6` enclosure non-goal and the `ee02-buttons` Q5 button-access requirement, and
record any deviations.

**Acceptance criteria:**
- [ ] Device renders and deep-sleeps inside the finished frame; buttons step the rotation.
- [ ] No electronics/wiring/battery visible from the front; mat border equal within 1 mm.
- [ ] `ee02-13in-spectra6` and `ee02-buttons` cross-references ticked.
- [ ] `drawings/cut-list.md` reflects what was actually built.

**Verification:**
- [ ] `ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" .venv/bin/esphome config config/esphome/devices/epaper-art-frame-13in.yaml` still validates.
- [ ] Photos committed under `photos/05-installed/`.

**Dependencies:** F5.2 · **Scope:** S · **Files:** `specs/ee02-13in-spectra6/tasks/todo.md`, `specs/ee02-buttons/SPEC.md`

---

### Checkpoint D — Frame complete
- [ ] All SPEC success criteria met.
- [ ] **Review with user** — the frame is finished; the enclosure requirement is satisfied.
