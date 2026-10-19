# Spec: Wooden Frame for the 13.3" Spectra 6 Panel

Status: **draft — awaiting review** · Revision 1 (2026-10-14)
Slug: `wooden-frame-13in`
Related: [`../ee02-13in-spectra6/SPEC.md`](../ee02-13in-spectra6/SPEC.md) (the device this houses),
[`../ee02-buttons/SPEC.md`](../ee02-buttons/SPEC.md) (hands this spec the button-access requirement),
[`../wooden-frame/SPEC.md`](../wooden-frame/SPEC.md) (the 5.65" frame — the precedent this mirrors)

> This spec covers a **physical, handmade solid-hardwood frame with a passepartout** that houses the
> Seeed XIAO ePaper Display Board **EE02**, the **13.3" E Ink Spectra 6** panel (1200×1600,
> landscape-mounted) and a LiPo. It is a *separate deliverable*: `ee02-13in-spectra6` lists "an
> enclosure for the 13.3\" frame" as a **non-goal** (specify separately, as `wooden-frame` was), and
> `ee02-buttons` Q5 handed the enclosure the requirement that the **prev/next buttons are reachable
> when wall-mounted**. **Owner decision (2026-10-14): that is relaxed here** — the board is mounted
> **component-side to the back plate** and the buttons + USB-C are reached through **one opening in
> the back plate with the frame off the wall**. When this spec is built, the enumeration is satisfied
> under that relaxed access rule (cross-referenced, not duplicated).

---

## Objective

A one-off, furniture-grade hardwood frame that presents the 13.3" display as a **matted framed
print**, not a screen. It carries the panel, the EE02, and the battery; hides all electronics; gives
the panel real protection (a matte anti-reflective acrylic cover); and stays serviceable — the panel
comes out without damage, the battery is replaceable, and USB-C charging and the prev/next buttons are
reachable through the back-plate opening (with the frame off the wall).

**Users**

| User | Need |
|---|---|
| Household / guests (viewers) | Reads as a professionally matted print; no visible wiring, boards or battery; no glare |
| The maker (owner) | Charge and swap the battery easily; press prev/next (frame off the wall); a build achievable with a mitre saw, router, drill and sander |

**Success looks like:** on the wall, a visitor assumes it is a framed, matted print — not an e-paper
panel.

**Out of scope:** batch production, CNC, mains power, enclosures for any other panel, and any change
to the device's firmware or behaviour.

---

## Design decisions (from interview)

- **Objective priority:** furniture-grade appearance / intentional décor.
- **Form factor:** a **landscape** picture frame in **black walnut**, a **passepartout** (mat) with
  a bevel window cut to the **active area**, and a **recessed back plate** — set into a rebate in the
  frame's back so it is **flush and not visible from the side** — that carries the electronics. The
  frame is **one solid ring** (a front rebate for the stack + a back rebate for the plate). Visible
  face = mat, not panel bezel.
- **Frame outer ≈ 400 × 332.4 mm (40 × 33.2 cm).** 40 cm nominal width; the height is set so the mat
  border is **equal on all four sides** (see the dimensional model — a 4:3 active area needs a frame
  exactly `AW − AH` = **67.6 mm** wider than tall for equal borders).
- **Construction:** mitred hardwood corners, **reinforced with splines or dowels**, rebates cut with
  a router (or stacked saw cuts) — the same workshop as the 5.65" spec. **No table saw / router
  table required.**
- **Material / finish:** **black walnut** (Q3 resolved 2026-10-14), **satin oil or wax**.
- **Passepartout:** **white, ~2.5 mm archival mat board**, single bevel, window cut to the **active
  area** (not the glass edge), **floated 2–3 mm** off the panel so a clean shadow line borders the
  image and the window is forgiving of cut tolerance.
- **Glazing:** a **matte (anti-reflective) acrylic** sheet in front of the mat — protection without
  glare. Cut to **≈ 370 × 302.4 mm** (the 372 × 304.4 pocket less 1 mm drop-in; = the 364 × 296.4
  opening + 4 mm per side). **Sheet ≥ 372 × 304.4 — the owned 400 × 300 is ~2.4 mm too short; use a
  ~400 × 400 / A2 sheet.** (Explicitly *not* glossy glass or clear acrylic.)
- **Panel retention (float, no bonding).** The panel glass (**284.5 × 209**) is **smaller than the
  opening** (364 × 296.4), so it does **not** reach the frame rebate. It is held by: a **float spacer
  ring** (2.5 mm card/foam, ring-shaped) between the mat and the panel, which sets the shadow gap `G`
  and keeps the panel off the mat/acrylic; a **backing ring** (**3.6 mm plywood**, ~8 mm wide) sitting
  **behind the panel's edge only** (outer ≈ the panel edge, 284.5 × 209; the centre stays open so the
  EE02 + LiPo clear it), **notched on the right** over the board's footprint (the board straddles the
  panel's right edge; its foam-padded edge backs that stretch), with **closed-cell foam** between it
  and the panel's back pressing gently forward. The ring is **captured by the back plate**: **4 pads/bosses**, the **same width as the
  ring**, on the plate's inner face press it forward **directly behind it** when the
  plate is screwed on — **no fixing in the frame**. Nothing is bonded to the panel; **unscrew the back
  plate → the ring + panel lift out**.
- **Panel interface:** the **EE02 + its 60-pin FPC**; the panel is **two UC8179 controllers in
  master/slave**. The cavity must clear the FPC and the driver/FPC tab, not just the glass.
  **Cross-spec dependency:** the whole layout (seat offset right, board straddling the panel's right
  edge, plate opening side) assumes the FPC lands on the panel's **right** in the mounted landscape
  orientation —
  confirm against [`../ee02-13in-spectra6/SPEC.md`](../ee02-13in-spectra6/SPEC.md) **Q5**
  (`rotation: 90`) at Checkpoint A.
- **Back plate = electronics carrier.** The **EE02 board** (M2 standoffs) and the **LiPo** (held
  **removably** — velcro / strap / pocket, never bonded) mount on the back plate's inner face;
  unscrewing the plate frees all the electronics. The plate sits in a **3.6 mm rebate in the frame's
  back** (~9 mm rim) — **flush and hidden from the side**. The EE02 mounts **flipped** (component side toward
  the plate); the panel's FPC takes a gentle **S-bend**/fold. The panel is held in **front** by the
  float spacer ring + mat and in **back** by the foam + backing ring (see Panel retention), with a
  **service loop** so the plate can be removed.
- **Buttons & power — one back opening.** The panel's FPC exits the panel's **right** edge; the
  EE02's 60-pin connector is on the board's **left** edge (at the top). Mount the board on the **back
  plate**, **flipped** so its **component side faces the back plate** (buttons + USB-C face inward).
  The ribbon is only **25 mm** long, so — with **no extender** (owner decision) — the board cannot sit
  fully inboard: it **straddles the panel's right edge**, the ribbon running **~20 mm inboard with
  slack** (never taut, no twist). **Consequence: the backing ring is notched** over the board's
  footprint (see Panel retention). A **single opening in the back plate** exposes the whole **right
  side of the board** (both buttons, the USB-C and the power switch), reached with the frame **off the
  wall** (accepted — no wall-mounted access). The board is **never glued to the panel**. Q2.
- **Charging / power:** through that same opening — either plug a **right-angle USB-C** connector in
  directly, or leave a short **USB-C pigtail** plugged in and dress its free end at the opening (Q5).
- **Wall mount — load path defined.** A **French cleat** mounted on the frame's **solid back rim**,
  **not** the removable plate, plus a **lateral stop** (a cleat slides sideways). The frame hangs on a
  separate wall rail; the plate still unscrews with the frame hung. **Constraint at `F` = 18: the back
  rim is only 9 mm** — use a **long cleat with small screws spread along it** (or a couple of glue-blocked
  hardwood cleats) for purchase. If that proves too thin, revisit `F` / the outer.
- **Nothing bonded; nothing visible from the front.**

---

## Dimensional model

The panel, EE02 and battery are in hand, so **the build starts by measuring, not by trusting
catalogues.** Frame dimensions are *derived* from measured values. The one figure taken from physics
(derived, then confirmed by calipers) is the active area.

| Symbol | Meaning | Source |
|---|---|---|
| `AW × AH` | **Active area (landscape)** — 1200×1600 px at 0.169 mm/px, 13.3" diagonal | **confirmed: 270.4 × 202.8 mm** (owner, 2026-10-14) |
| `PO_W × PO_H` | Panel outline (glass edge), **landscape** | **confirmed: 284.5 × 209 mm** (owner, 2026-10-14) |
| `MO_W × MO_H` | Module footprint — glass + the rigid FPC stub (60-pin, **25 mm wide**, flexes **~5 mm** out from the glass edge) | **289.5 × 209 mm** (glass 284.5 + up to 5 mm FPC; owner, 2026-10-14) |
| `PT` | Panel **glass** thickness (excl. the FPC/connector stiffener) | **confirmed: 1.0 mm** (owner, 2026-10-14) |
| `FT` | FPC/connector stack thickness | **confirmed: 0.5 mm** (owner, 2026-10-14; `FT < PT`, so `PT` governs) |
| `EE_W × EE_H × EE_T` | EE02 board outline + thickness; feature edges | **confirmed: 43 × 81 × 8 mm** — buttons + USB-C on the RIGHT long edge, battery JST on the BOTTOM short edge, 60-pin FPC connector on the LEFT edge (top); mounting holes **36 × 75 mm c/c** (owner, 2026-10-14) |
| `BW × BH × BT` | LiPo outline + thickness | **confirmed: 65 × 35 × 10 mm** (same cell as the 5.65" frame; swell allowance **3 mm**, owner) |
| `MB` | Passepartout board thickness | chosen: **2.5 mm** |
| `AC` | Matte AR acrylic thickness | chosen: **2 mm** |
| `G` | **Float gap** — mat → panel (shadow line) | chosen: **2.5 mm** (2–3) |
| `M` | **Mat border** (equal on all four sides) | chosen: **≈ 46.8 mm** |
| `F` | Frame face width | chosen: **≈ 18 mm** |
| `FD` | Frame member depth — **one solid piece** (front rebate + back rebate) | **27.6 mm** (= total) |
| `RD` | Electronics cavity depth (panel-back → plate-inner) — EE02 + LiPo side by side | **10 mm** (measured 12, owner reduced by 2; excl. swell) |
| `BP` | Back plate thickness | **3.6 mm** plywood (as the 5.65" frame) |

Derived:

```
mat window         = AW + tol  ×  AH + tol        (tol ≈ 0.5–1 mm; centred on the ACTIVE area)
frame opening      = AW + 2M   ×  AH + 2M          (= mat outer; the visible aperture)
frame outer        = opening + 2F
equal mat border ⇒ outer_w − outer_h = AW − AH = 67.6 mm
target 400 wide  ⇒ M + F = (400 − AW)/2 = 64.8 mm  (e.g. F 18 → M 46.8)
MODULE_BACK        = lip + AC + MB + G + PT    (= 11 mm; front face → panel back)
plate inner        = MODULE_BACK + RD + swell   (= 11 + 10 + 3 = 24 mm; pocket floor)
front opening      = 364 × 296.4                (= AW + 2M × AH + 2M)
pocket             = 372 × 304.4, d = 3 → 24    (rebate for acrylic/mat AND electronics cavity)
back rebate        = 382 × 314.4, d = 24 → 27.6 (9 mm rim, takes the flush plate)
frame member depth = 3 + 21 + 3.6 = 27.6 mm      (ONE solid piece — machine in one setup)
```
**Machining, front to back: 3 mm lip (leaves the 364 × 296.4 opening) → 21 mm pocket to d=24 at
372 × 304.4 → 3.6 mm back rebate (9 mm rim) → 27.6 total.**

**Worked example (to be reconciled with the measured panel):** outer **400 × 332.4 mm**; `F` = 28 →
`M` = 46.8 → opening **364 × 296.4 mm**; mat window **270.4 × 202.8 mm**. The panel (measure `PO`)
must fit behind the mat inside the opening, and the module/FPC tab must clear the rear cavity.

**Confirmed footprint (per-side borders).** Active **270.4 × 202.8 mm** sits on a **284.5 × 209 mm**
glass with borders **left 3.1 · right 11.0 · top 3.1 · bottom 3.1 mm**. The **FPC/connector is on the
right**, so the glass is ~7.9 mm wider there and the active area sits **≈ 3.95 mm LEFT of the glass
centre** (vertically centred). The mat (window = active area) covers the bezel on every side. The
panel clears the 364 × 296.4 opening with ≈ 39.75 mm (W) / 43.7 mm (H) to spare — all of it behind the
mat. `PO` therefore **does not** change the frame face or the mat; it fixes the **seat offset**: place
the glass centre **≈ 3.95 mm right of the opening centre** so the window centres on the pixels, and
keep the right side clear for the FPC loop.

**The mat window is centred on the ACTIVE area, not on the glass.** Confirmed on this panel: the
active area sits **3.95 mm left of the glass centre** (the right side carries the connector), with the
other three borders equal. So the frame opening stays optically centred while the **panel is seated
offset** — the mat window centres on the pixels, the mat absorbs the uneven bezel.

---

## Commands

Physical build procedures, plus the repo commands that gate each increment.

```
Measure & record   → digital calipers; log every value in drawings/cut-list.md
Layout & cut list  → derive the frame/mat dimensions from the model above; write drawings/cut-list.md
Draw views         → python3 drawings/frame_views.py; rasterise front/side/top/back .svg → .png
Mill & mitre       → square and cut the four members; test the mitre on offcuts first
Machine member     → 3 mm lip (leaves the opening) → 21 mm pocket to d=24 → 3.6 mm back rebate
Dry fit            → assemble joints AND the acrylic + mat + panel + electronics stack, no glue
Glue up & clamp    → splines/dowels + glue; check corners for square before clamping
Sand               → 120 → 180 → 240 grit; break all edges with a 3 mm roundover
Finish             → oil/wax per product data sheet; fully cure (≥72 h) before electronics go in
Cut mat & acrylic  → bevel the mat window to the active area; cut the AR acrylic; dust-free assembly
Fit check          → mat window even around the active area; panel floated; acrylic not touching panel
Button/USB check   → prev/next press cleanly through the back-plate openings; USB-C plugs in (off-wall)
Wall test          → hang with 2× device weight; confirm no rock and no slide (gap = cleat standoff)
Commit             → git add specs/wooden-frame-13in && git commit -F -   (Spec:/Task: trailers)
Device re-validate → ESPHOME_DATA_DIR="$PWD/config/esphome/.esphome" \
                       .venv/bin/esphome config config/esphome/devices/epaper-art-frame-13in.yaml
```

---

## Project structure

```
specs/wooden-frame-13in/
  SPEC.md                 → this spec
  drawings/cut-list.md    → measured values, derived dimensions, cut list, mat/acrylic/joinery notes
  drawings/*.md|*.svg     → sketches / section views (as needed)
  photos/                 → build-stage photographs (measurement, dry fit, glue-up, finish, installed)
```

Physical work happens at the bench; the **recorded evidence lives in this directory** so a future
session can reproduce the build. The device firmware stays where it is
(`config/esphome/`, `specs/ee02-13in-spectra6/`) — this spec never modifies it except via the
re-validation command above.

---

## Code Style (design standards)

Consistency of detail is what separates "furniture" from "homemade". One worked example of the
standard, rather than rules in the abstract:

```
Front elevation (not to scale)
┌───────────────────────────────────────────┐   even mat border all four sides (M ≈ 37)
│  ┌─────────────────────────────────────┐  │   corners: closed 45° mitre, splined; grain runs
│  │   1200 × 1600 px  →  active area    │  │   continuously around the frame
│  │   270.4 × 202.8 mm (landscape)      │  │   mat: white, single bevel, window = active area
│  └─────────────────────────────────────┘  │   panel floated ≈2.5 mm → crisp shadow line
└───────────────────────────────────────────┘   edge: 3 mm roundover, sanded to 240, oiled satin
        F ≈ 18 mm face width
```

Conventions:

- **Equal mat border on all four sides** — the single most visible quality signal. The window is
  centred on the **active pixels** (even ≤0.5 mm margin), never on the glass edge.
- **The mat is the reveal.** The frame lip holds the acrylic + mat; the panel bezel and FPC are
  hidden behind the mat, so the frame opening need not chase the glass edge.
- Grain runs continuously around the frame (mitred corners, sequential cuts from one board).
- Edge profile: consistent **3 mm roundover**, no sharp arrises.
- Splines: aligned, equal width, sanded flush — a deliberate detail, not a repair.
- Finish: **satin**, even sheen, no drips, runs or sanding marks. **No finish on the mat or acrylic.**
- The **shadow line** between the mat bevel and the panel is even all round (that is `G`).
- Hardware: countersunk, seated flush, single style; no visible hardware from the front.
- All dimensions recorded to **0.5 mm**; work to **±1 mm** on the mat window.

---

## Testing Strategy

No unit tests — the "tests" are fit, tolerance and durability checks, each with photo evidence.

| Check | Level | Pass condition |
|---|---|---|
| Measurement record | small | Every symbol measured and logged **before** any cut |
| Dry fit (joints) | small | All four corners meet with no gaps before glue |
| Dry fit (front stack) | small | Acrylic + mat + spacer ring + panel + backing fit the frame; acrylic never touches the panel; panel located to ±0.5 mm |
| Mat window | small | Margin around the active area even ±0.5 mm; no pixels clipped; no bezel visible |
| Removability | integration | Panel comes out with a screwdriver in <5 min, no flex, FPC never taut |
| Buttons | integration | Prev/next press cleanly through the **back-plate openings** (frame off the wall); each wakes and steps the art |
| Charge / power | integration | USB-C plugs in and charges, and the power switch works, via the **back-plate opening** (frame off the wall) |
| Battery replaceable | integration | LiPo unplugs and swaps without cutting/dismantling the frame |
| Wall mounting | large | Hangs flat (no rock, ≤2 mm gap), holds 2× device weight, undisturbed for 24 h |
| Finish cure | integration | No solvent smell; finish fully cured before the cavity is closed |
| Device still works | e2e | The device renders and deep-sleeps inside the frame; buttons step the rotation |

---

## Boundaries

**Always do**
- Measure the physical panel, EE02 and battery with calipers and record the values before cutting
- Dry-fit the joints *and* the full front + electronics stack before any glue or finish
- Keep the panel's FPC strain-free — never taut, never pinched, never over a sharp edge
- Leave **≥3 mm** clearance around the panel edge and **≥3 mm** around the LiPo (owner's swell allowance)
- Keep the **prev/next buttons, USB-C and the power switch reachable** with the frame mounted
- Keep the mat window centred on the **active area**; keep the mat/acrylic clean during assembly
- Fully cure the finish (≥72 h per the product data sheet) **before** closing electronics inside
- Photograph each build stage and commit the cut list + photos under `specs/wooden-frame-13in/`
- Commit with `Spec:` / `Task:` / `Co-Authored-By:` trailers per `AGENTS.md`

**Ask first**
- Buying hardwood or any new tool (species = **black walnut**, Q3 resolved)
- Choosing the acrylic (matte AR, thickness) and the mat (colour/thickness) — Q2/Q3
- Deviating from the measured dimensions or the mat-border / frame-width allowances
- Drilling or screwing into **the panel** itself, or pressing on the active area
- Adding real glazing (glass / clear acrylic) or changing the no-glare decision
- Changing the wall-mount method or the button-access mechanism
- Any change that would make the panel or battery non-removable

**Never do**
- **No mains/AC power** — the device is battery-only
- **Never permanently bond** the panel or the LiPo (no glue, no permanent tape)
- Never let solvents or solvent-based finishes touch the panel, mat, acrylic or electronics
- Never sand, cut, drill, or clean the panel itself; never touch the mat or acrylic faces
- Never pull, kink, crush, **twist** or solder-stress the panel's FPC — route it with **bends/folds only**
- Never squeeze, bend or flex the panel or the LiPo
- Never seal the LiPo in a way that prevents replacement
- Never modify `ee02-13in-spectra6`'s firmware/config from this spec (re-validate only)
- Never re-purpose the 5.65" spec's tasks here, or vice versa

---

## Success Criteria

- [ ] All symbols in the dimensional model measured, recorded and committed **before** cutting
- [ ] Frame reads as furniture: continuous grain, closed mitres, uniform satin finish, no visible hardware from the front
- [ ] **Mat border equal within 1 mm** on all four sides; **margin around the active area even ±0.5 mm**; no pixels clipped, no bezel visible
- [ ] Panel floated ≈2.5 mm behind the mat; the shadow line is even; the acrylic does not touch the panel
- [ ] Panel removable with a screwdriver in <5 minutes, no flex, FPC never taut
- [ ] **Prev/next buttons work through the back-plate openings** (frame off the wall); USB-C charging and the power switch likewise
- [ ] Battery replaceable without dismantling the frame
- [ ] Hangs flat and securely (no rock, no slide, 2× device weight, 24 h undisturbed)
- [ ] No electronics, wiring or battery visible from the front
- [ ] The device still renders and deep-sleeps after installation; a button press steps the rotation

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Cut to catalogue dimensions, not the real panel | **High** — wasted hardwood, re-cut | Measure first; dry-fit the panel before glue-up |
| Frame sized to the panel, not the module/FPC tab | **High** — frame won't close | Size the rebate/cavity to `MO + clearance`; record the tab orientation before cutting |
| Mat window clips the image or shows the bezel | **High** — the primary visual defect | Window centred on the **active area** with a small tolerance; float the panel; dry-fit before final assembly |
| Acrylic presses on the panel / rubs | **High** — panel damage | Float gap `G`; acrylic bears on the frame/mat, never the panel; dust-free assembly |
| Rear cavity too shallow (EE02 + LiPo + loop) | Medium | Mount the EE02 + LiPo + wiring on the back plate, fit it, and measure `RD` before cutting the spacer |
| Buttons/USB reachable only with the frame off the wall | Low — accepted | Back-plate openings; owner accepted no wall-mounted access (Q2) |
| FPC stressed or broken | **High** — panel unusable | Strain-relieve the FPC (service loop, anchored, never taut); no sharp edges |
| Mitres open / out of square | Medium | Splines/dowels + dry fit + check diagonals before clamping |
| Finish off-gassing in a closed box | Medium | Cure ≥72 h; oil/wax only, no solvent lacquer |
| LiPo swell / not replaceable | Medium | ≥3 mm swell allowance (owner); JST reachable; plate screwed, not glued |
| Glass-hard acrylic scratches during assembly | Medium | Leave the protective film on until the frame is closed; handle by the edges |

---

## Open Questions

| # | Question | Resolved by |
|---|---|---|
| Q1 | **Measurements complete (owner, 2026-10-14):** active **270.4 × 202.8**, glass **284.5 × 209**, borders **3.1/11.0/3.1/3.1**, `PT` **1.0**, `FT` **0.5**, no bow, LiPo **65 × 35 × 10**, EE02 **43 × 81 × 8** (holes **36 × 75**), `MO` **289.5 × 209** (FPC 25 mm wide on the right edge, flexes ~5 mm out), `RD` **10**, `AC` **2**, `BP` **3.6**. | Complete |
| Q2 | Button access — **resolved 2026-10-14**: board mounted component-side to the **back plate**; the buttons, USB-C and switch are reached through **one back-plate opening** over the board's right side, with the frame off the wall. No external buttons. | Resolved |
| Q3 | **Resolved 2026-10-14** — hardwood **black walnut** (satin oil/wax); mat **white archival 2.5 mm**; acrylic **matte AR 2 mm**. | Resolved |
| Q4 | **Resolved 2026-10-14** — `F` **18**, `M` **46.8** → outer **400 × 332.4**, equal mat border (2.6× slim). | Resolved |
| Q5 | **Resolved 2026-10-14** — the power slide switch is reached through the **same back-plate opening** (it sits above the buttons); no separate cutout. | Resolved |
| Q6 | French cleat vs other mount — confirm the wall type/load. | Owner decision |
