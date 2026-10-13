# Cut List & Measurements — Wooden Frame

Spec: [`../SPEC.md`](../SPEC.md) · Plan: [`../tasks/plan.md`](../tasks/plan.md)
Task: **F1.1 / F1.2** · Status: **measurements + cut list complete 2026-10-07; material/construction revised for plywood 2026-10-11; open: stage photos**

> **Measure, don't guess.** Fill the "Measured" cells with caliper readings from the *actual*
> **Module (F)**, NULA, LiPo and wire bundle. Do **not** copy catalogue/datasheet numbers into this
> file — everything is derived from what you measure. The single sanity reference in §6 is
> explicitly *not* for cutting.

---

## 1. Measured values (F1.1)

| Symbol | Meaning | Measured (mm) | Photo ref |
|---|---|---|---|
| `MO_W` | **Module (F) outline width** — panel + onboard driver PCB | **139.5** | manual |
| `MO_H` | **Module (F) outline height**, *excluding the protruding header* | **101.0** | manual |
| `HD_edge` | Which edge the 8-pin header protrudes from (`top/bottom/left/right` or "off the back") | **off the back** — at the **left edge** of the PCB (back facing up) | manual |
| `HD_proj` | Header protrusion beyond the board outline | **10.0** (depth, off the back) | manual |
| `EW` | **Overall envelope width incl. header** (add `HD_proj` if the header is on a short edge) | **139.5** (= `MO_W`; header is off the back → no width added) | derived |
| `EH` | **Overall envelope height incl. header** (add `HD_proj` if the header is on a long edge) | **101.0** (= `MO_H`; header is off the back) | derived |
| `ED` | Overall envelope **depth** incl. header (if it protrudes off the back) | **18.0** (= `PT` 8.0 + `HD_proj` 10.0) — *verify `PT` excludes the header* | derived |
| `PO_W` | Panel outline width (glass edge, smaller than module) | **125.0** | manual |
| `PO_H` | Panel outline height | **100.0** | manual |
| `AW` | Active / visible area width | **115.0** | manual |
| `AH` | Active / visible area height | **85.0** | manual |
| `PT` | Module thickness incl. header (panel + PCB + connector/header), **risers removed** | **8.0** | manual |
| `RD` | Cavity depth — **mock up** the back plate with the NULA + LiPo + wiring + a service loop; measure module-back → plate-inner-face | **12.5** (NULA + LiPo side by side; **excludes** battery-swell room — a LOWER bound) | manual |
| `BW` | LiPo width | **65.0** | manual |
| `BH` | LiPo height | **35.0** | manual |
| `BT` | LiPo thickness | **10.0** | manual |
| `NW` | NULA width | **70.0** | manual |
| `NH` | NULA height | **26.0** | manual |
| `NT` | NULA thickness | **7.0** | manual |

Notes / anything unexpected:

```
Module BODY outline measured 139.5 x 101.0 mm (user, manual). Waveshare lists 138.5 x 100.5 mm,
so the datasheet is ~1.0 mm tight in width and ~0.5 mm in height. Measure-first validated:
these measured values, not the catalogue, drive the rebate/cavity.
The 101.0 mm height EXCLUDES the protruding 8-pin header -> record the header edge, its
protrusion (HD_proj) and the overall envelope (EW x EH x ED). The rebate must clear the ENVELOPE,
not just the body.

Panel outline (PO) measured 125.0 x 100.0 mm - close to the datasheet 125.4 x 99.5 (good).
  -> Module is ~14.5 mm WIDER than the panel (139.5 vs 125.0): the PCB tab is on the WIDTH.
  -> Panels and modules agree in height (101 vs 100).

REVEAL BUDGET (measured): border = (PO - AW)/2
   horizontal = (125.0 - 115.0)/2 = 5.0 mm;  vertical = (100.0 - 85.0)/2 = 7.5 mm
  -> R must be <= 5.0 mm on the width, or the front face clips the image.
  -> RECOMMEND R = 4 mm (1 mm margin) -> front opening 117 x 92 mm.
     SUPERSEDED 2026-10-07: opening is now 117 x 88 (Rw/Rh = 4/6) to even the
     margin around the ACTIVE area, not the glass border -- see section 4.

LiPo measured 65.0 x 35.0 x 10.0 mm. Pouch cells swell: allow >=5 mm clearance
around it, so budget ~15 mm for the battery layer in RD, not 10. Hold it
removably (velcro/strap/pocket on the back plate), never bonded.

PT = 8.0 mm with the 4 corner risers removed (9.0 mm fitted). This is the module
BODY (panel + PCB); the 8-pin header protrudes a further HD_proj = 10 mm off the
back (see 2026-10-07 notes) -> envelope depth ED = 18.0 mm. The module's corner
holes are not used (the back plate carries the electronics), so removing the
risers is a free 1 mm.

NULA measured 70.0 x 26.0 x 7.0 mm. NULA (70x26) and LiPo (65x35) fit side
by side on the back plate (~140x100 available). RD is battery-bound: LiPo 10 +
>=5 swell = ~15 mm (vs NULA 7 + standoff ~5 = ~12 mm) -- confirm with the mock-up.

2026-10-07:
  HEADER: off the back, at the LEFT edge of the PCB (back up); HD_proj = 10 mm.
    Only ~2.5 mm remains between the header tip and the back plate at RD=12.5 ->
    "just enough space for the wires to bend". There is NO depth for a service
    loop at the header: route the loop IN-PLANE along the back plate. Do NOT mount
    the NULA or battery directly behind the header (the left-edge strip).
  ENVELOPE: header is off the back -> EW = MO_W 139.5, EH = MO_H 101.0 (unchanged);
    ED = PT + HD_proj = 8.0 + 10.0 = 18.0 (verify PT excludes the header).
  MODULE OVERHANG past the glass edge: left 7, right 7, top 0, bottom 0 mm ->
    the module is CENTRED on the panel; both stile rebates are equal (12.25) and
    the front opening needs no offset. Resolves the SPEC's asymmetric-tab warning
    for this unit (7+7 = 14 ~ the measured 14.5 mm width difference).
  RD = 12.5 mm measured with NULA + LiPo side by side (battery is the slightly
    thicker layer), EXCLUDING battery-swell room. SPEC allows >=5 mm around the
    LiPo -> the cavity must add swell + the 3 mm clearance, so 12.5 is a LOWER
    bound, not the cut value. RESOLVED 2026-10-07: swell allowance = +5 mm ->
    cavity depth = 12.5 + 5 + 3 = 20.5 mm (locks the spacer frame at F2.2).
  LEAD MAP: NOT REQUIRED -- the panel harness is already terminated and functional
    on the NULA (bench bring-up 2026-10-02). See section 2.

  2026-10-11 MATERIAL REVISION:
    The frame is built from ONE 1220 x 610 x 3.6 mm hardwood multiplex sheet, not
    a solid oak board (Q3 re-resolved). Construction becomes a LAMINATED, ROUTED
    RING: 4 layers (4 x 3.6 = 14.4 mm) glued into a block, then routed (outer
    153x124, rebate pocket 141.5x103, front opening 117x88 through the 3.5 mm lip).
    No mitres, no splines. Ply lamination edges LEFT EXPOSED.
    Only FD (frame depth 12 -> 14.4) and the spacer depth (20 -> 17.6) change;
    every opening/rebate/cavity/outer dimension is unchanged (see section 4).
```

---

## 2. Lead colour → signal map (F1.1)

> **Not required for this build (2026-10-07):** the panel harness is **already terminated and
> functional** on the NULA (bench bring-up 2026-10-02 — the device fetches and renders over HTTP).
> The colour map is only needed if the harness is **re-terminated**. The authoritative signal
> reference is the ESPHome `display` pin map in `config/esphome/epaper-art-frame.yaml`:
> CLK=GPIO12, MOSI/DIN=GPIO11, CS=GPIO10, DC=GPIO5, RST=GPIO6, BUSY=GPIO7 (inverted), + 3V3/GND.
> The table is left here for that contingency.

| Lead colour | Signal | Is it logic or power? | Notes |
|---|---|---|---|
| | CLK / SCK | logic | |
| | MOSI / DIN | logic | |
| | CS | logic | |
| | DC | logic | |
| | RST | logic | |
| | BUSY | logic | |
| | VCC / 3V3 | **power** | voltage: |
| | GND | power | |
| | (other) | | |
| | (other) | | |

> **Flag:** if any lead is a power rail beyond 3V3 (e.g. a panel rail), stop and raise it — direct
> wiring to the NULA may be wrong (see SPEC open question in `epaper-art-frame`).

---

## 3. USB-C orientation (F1.1, Q6)

- Edge the USB-C port exits the frame: **bottom** — **resolved 2026-10-07 (Q6).** The NULA's own
  receptacle faces **right** when mounted flat, so the board is **rotated 90°** in the cavity to point
  the receptacle down, and a **right-angle USB-C pigtail** carries it to a fixed receptacle at the
  bottom edge.
- Measured cable overmould size (for the F3.2 slot): `W × H` = `____ × ____ mm` — **TBD**
- Notes: The NULA receptacle sits **inside** the rear cavity (≈ `RD` 12.5 mm behind the module back,
  plus the frame face), so it is **not** at the frame edge and cannot be reached while wall-mounted
  without an opening. A **right-angle USB-C pigtail** (BOM) plugs into the NULA and presents a fixed
  receptacle at the bottom edge; the F3.2 slot is then cut for that receptacle/cable. "Overmould
  size" = the moulded plastic boot on a cable plug behind the metal connector; it is wider than the
  connector and sets the minimum slot/opening.

---

## 4. Derived dimensions (F1.2 — compute after §1)

```
front opening    = (PO_W - 2·Rw) × (PO_H - 2·Rh)  (reveal over the glass, per axis)
rebate / inner   = (EW + 2) × (EH + 2)           (clear the module ENVELOPE incl. header)
frame depth      = 4 × sheet(3.6) = 14.4 mm      (laminated ring; was 12 mm solid oak)
rebate depth     = frame depth − LIP (3.5)       (contains PT + clearance)
cavity depth     = RD + swell(+5) + 3 mm assembly
spacer depth     = PLATE_INNER − frame depth     (hidden rear-box wall)
frame outer      = opening + 2F, and ≥ EW + 2×margin
```

| Derived | Formula | Value (mm) |
|---|---|---|
| Reveal (over glass) Rw × Rh | chosen to even the margin around the **active area** | **4 W / 6 H** (glass border is 5 W / 7.5 H) |
| Frame face width `F` | chosen; floor ≈ 16 mm (must clear the board) | **18** |
| Front opening W × H | `PO − 2R` per axis | **117 × 88** |
| Rebate / inner W × H | `EW + 2` | **141.5 × 103** (header off the back → `EW`/`EH` = `MO`) |
| Frame member depth `FD` | `4 × sheet` | **14.4** (4 × 3.6 mm laminated; was 12 mm solid) |
| Rebate depth | `FD − LIP` (LIP 3.5) | **10.9** (contains module `PT` 8 + 2.9 clearance) |
| Cavity depth | `RD` + swell(5) + assembly(3) | **20.5** (12.5 + 5 + 3) — locks the spacer frame |
| Back-plate inner face | module back + cavity | **32.0** |
| Spacer depth | `PLATE_INNER − FD` | **17.6** (32.0 − 14.4) |
| Frame outer W × H | `opening + 2F` | **153 × 124** |

**Header edge:** **off the back, at the left edge**, protruding `HD_proj` = **10 mm** — only ~2.5 mm
to the back plate at `RD`=12.5. Depth-only, so it does **not** enlarge the rebate opening
(`EW`/`EH` = `MO`), but the **harness must bend in-plane** — no room for a depth-direction service
loop at the header. Do not mount the NULA/battery directly behind the header.

**Reveal:** chosen to leave an **even, minimal margin around the active pixels**, not an even reveal
over the glass (the glass border is uneven: 5 mm wide, 7.5 mm tall). So `Rw` = **4 mm**, `Rh` =
**6 mm** → front opening **117 × 88**, leaving **1.0 mm (W) / 1.5 mm (H)** of margin before the
600 × 448 image. The reveal is deliberately non-uniform (see SPEC success criteria).

---

## 5. Cut list (F1.2 — revised for plywood 2026-10-11)

Derived from §1 (measured) and §4 (design: **Rw/Rh = 4/6**, **F = 18**). The frame is **one
laminated, routed plywood ring** — not four joined members — so there are **no mitres and no
splines**, and the face is seamless. The rear box is a laminated spacer ring plus a single-layer back
plate. All three parts nest on **one 1220 × 610 × 3.6 mm sheet**.

| # | Part | Qty | Finished size (mm) | Build | Notes |
|---|---|---|---|---|---|
| 1 | Frame ring | 1 | **153 × 124 × 14.4** | **4 layers** of 3.6 mm ply glued flat | Rout: outer 153 × 124; rebate pocket **141.5 × 103**; front opening **117 × 88** through the 3.5 mm lip |
| 2 | Spacer ring | 1 | **153 × 124 × 17.6** | 5 layers (or 4 + a 3.2 mm shim); hidden | Inner opening **141.5 × 103**; wall ≈ 5.75 W / 10.5 H |
| 3 | Back plate | 1 | **153 × 124 × 3.6** | **1 layer** | Electronics carrier; screwed to the spacer, serviceable |

**Layer count / depth:** `FD` = 4 × 3.6 = **14.4 mm** → lip in front of the panel = `FD − rebate`
= 14.4 − 10.9 = **3.5 mm** (unchanged). A 3-layer frame (10.8 mm) leaves only a 2.3 mm lip and lets
the module back poke past the frame — do not go below 4 layers. Keep the **face veneer continuous**
across the whole ring and the **lamination edges clean** (they are exposed).

**Rebate routing:** from the back face, pocket **141.5 × 103** to a depth of `FD − 3.5` = **10.9 mm**
(leaving the 3.5 mm front lip); then cut the front opening **117 × 88** through that lip. The module
(`PT` 8 mm) then sits with ~2.9 mm clearance behind it inside the rebate.

**Rebate width** = half the gap between the front opening and the module envelope:
rails `(103 − 88)/2 = 7.5 mm`, stiles `(141.5 − 117)/2 = 12.25 mm` (module measured **centred** on
the panel — both stiles equal).

**Stock (F2.1):** one **hardwood multiplex (plywood) sheet, 1220 × 610 × 3.6 mm**. Consumption is
~20 % even with the routed-out centre wasted (frame 4 × 153×124 + spacer + back ≈ 0.15 m²), so one
sheet makes the frame with ample spare. Reuse the ring's routed-out centre for the spacer/back where
sizes allow.

Nesting plan (face veneer runs the same way across the whole ring; cut all layers of each part from
the same grain direction, then laminate):

```
  ┌── 4 × [153 × 124] frame layers ──┬── spacer layers ──┬── back plate ──┐
  └── route the rebate AFTER lamination; flat cauls + even clamp pressure ┘
```

**3D model:** `frame_model.py` generates:
- `frame.stl` — **SketchUp Free (web):** drag-and-drop onto the scene (or *Insert → My Device*).
  Unitless, single mesh — geometry/proportions only; the outer width reads **153**.
- `frame.dae` — COLLADA for SketchUp paid/desktop (grouped, real mm units).
- `frame.obj` + `frame.mtl` — general fallback.

**2D views (dimensioned):** `frame_views.py` generates `front.svg`, `side.svg`, `top.svg` and
`back.svg` (+ `.png` raster) — front elevation, **section A-A** (rail cross-section), **section B-B**
(stile cross-section) and the rear elevation, with every dimension from this cut list called out.

The frame carries the **L-profile rebate** (front opening 117 × 88, rebate pocket 141.5 × 103) at the
laminated **14.4 mm** depth; the display is glass + PCB with the active area marked, and the
header/electronics are indicative blocks — the wood geometry and all overall dimensions are exact.
(Corner seams in the mesh are an artefact of the generator; the real frame is a seamless ring.)

> **RESOLVED 2026-10-07 — module overhang (measured).** The module PCB extends past the glass edge
> **left 7 · right 7 · top 0 · bottom 0 mm**, so it is **centred** on the panel. **Both stile rebates
> are 12.25 mm** and the front opening needs **no offset** — the SPEC's "asymmetric tab" concern does
> not apply to this unit. Cut the stiles exactly as listed above.

---

## 6. Sanity reference — NOT for cutting

For a rough cross-check only, Waveshare lists the **Module (F)** as: **active area 114.9 × 85.8 mm**,
**panel outline 125.4 × 99.5 × 0.91 mm**, **module outline 138.5 × 100.5 mm** (the module is ~13 mm
wider than the panel because of its PCB tab). **The measured module was 139.5 × 101.0 mm — the
datasheet is ~1 mm tight, so trust the calipers.** If your reading is wildly different from §1,
re-measure before proceeding. **Cut to §1, never to this paragraph.**
