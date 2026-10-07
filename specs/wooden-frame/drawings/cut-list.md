# Cut List & Measurements — Wooden Frame

Spec: [`../SPEC.md`](../SPEC.md) · Plan: [`../tasks/plan.md`](../tasks/plan.md)
Task: **F1.1 / F1.2** · Status: **measurements + cut list complete 2026-10-07; open: stage photos**

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
front opening    = (PO_W - 2R) × (PO_H - 2R)     (reveal over the panel edge)
rebate / inner   = (EW + 2) × (EH + 2)           (clear the module ENVELOPE incl. header)
rebate depth     = PT + 0.5 mm
cavity depth     = RD + swell(+5) + 3 mm assembly
frame outer      = opening + 2F, and ≥ EW + 2×margin
```

| Derived | Formula | Value (mm) |
|---|---|---|
| Reveal `R` (design 3–5 mm) | chosen; border is **5.0 mm (W)** / 7.5 mm (H) | **4** (1.0 mm margin on width) |
| Frame face width `F` (design 35–45 mm) | chosen | **40** |
| Front opening W × H | `PO − 2R` | **117 × 92** |
| Rebate / inner W × H | `EW + 2` | **141.5 × 103** (header off the back → `EW`/`EH` = `MO`) |
| Rebate depth | `PT + 0.5` | **8.5** |
| Cavity depth | `RD` + swell(5) + assembly(3) | **20.5** (12.5 + 5 + 3) — locks the spacer frame |
| Frame outer W × H | `opening + 2F` | **197 × 172** |

**Header edge:** **off the back, at the left edge**, protruding `HD_proj` = **10 mm** — only ~2.5 mm
to the back plate at `RD`=12.5. Depth-only, so it does **not** enlarge the rebate opening
(`EW`/`EH` = `MO`), but the **harness must bend in-plane** — no room for a depth-direction service
loop at the header. Do not mount the NULA/battery directly behind the header.

**Reveal:** chosen `R` = **4 mm** (≤ the 5.0 mm panel border on the width, so the front face does not
clip the image). Front opening **117 × 92**.

---

## 5. Cut list (F1.2)

Derived 2026-10-07 from §1 (measured) and §4 (design: **R = 4**, **F = 40**). All four frame members
are cut from **one board** so the grain runs continuously around the finished frame.

| # | Member | Qty | Length (mm) | Mitre | Rebate | Spline/dowel | Notes |
|---|---|---|---|---|---|---|---|
| 1 | Top rail | 1 | **197** | 45° × 2 | **8.5 deep × 5.5 wide** | 2 splines | outer length (long-point → long-point) |
| 2 | Bottom rail | 1 | **197** | 45° × 2 | 8.5 deep × 5.5 wide | 2 splines | |
| 3 | Left stile | 1 | **172** | 45° × 2 | **8.5 deep × 12.25 wide** | 2 splines | module centred (overhang 7 mm) |
| 4 | Right stile | 1 | **172** | 45° × 2 | 8.5 deep × 12.25 wide | 2 splines | module centred (overhang 7 mm) |
| 5 | Spacer frame | 2 + 2 | **197 / 172** | 45° × 2 (or butt) | — | — | height **≈ 17** (cavity 20.5 − 3.5); hidden rear box |
| 6 | Back panel | 1 | **197 × 172** | — | — | — | **3.6 mm ply**; screwed to the spacer frame, serviceable |

**Stock (F2.1):** one board, **≥ 45 mm wide × ≥ 12 mm thick × ≥ ~1100 mm usable length**
(4 members = 197+172+197+172 = 738 mm, plus a 45° mitre wedge at each of the 8 ends ≈ 40 mm each).
Chosen frame-member **depth = 12 mm** → lip in front of the panel = 12 − 8.5 = **3.5 mm**; a thinner
board leaves a fragile lip (do not go below ~10.5 mm). The **reference face must be flat and the
thickness consistent** — an inconsistent thickness shows as an uneven reveal.

**Rebate width** = half the gap between the front opening and the module envelope:
rails `(103 − 92)/2 = 5.5 mm`, stiles `(141.5 − 117)/2 = 12.25 mm` (module measured **centred** on
the panel — both stiles equal).

Nesting plan (grain runs continuously; cut mitres sequentially, rotating the stock 90° between
members so the grain flows around the perimeter):

```
  ├── 197 (top) ──┼── 172 (left) ──┼── 197 (bottom) ──┼── 172 (right) ──┤
  every end 45°; test the mitre setup on offcuts before cutting the good stock
```

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
