# Cut List & Measurements — Wooden Frame

Spec: [`../SPEC.md`](../SPEC.md) · Plan: [`../tasks/plan.md`](../tasks/plan.md)
Task: **F1.1 / F1.2** · Status: **awaiting measurements**

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
| `HD_edge` | Which edge the 8-pin header protrudes from (`top/bottom/left/right` or "off the back") | | |
| `HD_proj` | Header protrusion beyond the board outline | | |
| `EW` | **Overall envelope width incl. header** (add `HD_proj` if the header is on a short edge) | | |
| `EH` | **Overall envelope height incl. header** (add `HD_proj` if the header is on a long edge) | | |
| `ED` | Overall envelope **depth** incl. header (if it protrudes off the back) | | |
| `PO_W` | Panel outline width (glass edge, smaller than module) | **125.0** | manual |
| `PO_H` | Panel outline height | **100.0** | manual |
| `AW` | Active / visible area width | **115.0** | manual |
| `AH` | Active / visible area height | **85.0** | manual |
| `PT` | Module thickness (panel + PCB + FPC connector/header) | | |
| `RD` | Cavity depth — **mock up** the back plate with the NULA + LiPo + wiring + a service loop; measure module-back → plate-inner-face | | |
| `BW` | LiPo width | **65.0** | manual |
| `BH` | LiPo height | **35.0** | manual |
| `BT` | LiPo thickness | **10.0** | manual |

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
```

---

## 2. Lead colour → signal map (F1.1)

Photograph the bundle first, then identify each lead. Cross-reference the ESPHome `display` pins in
`config/esphome/epaper-art-frame.yaml`.

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

- Edge the USB-C port faces when the board sits in the cavity: `bottom / left / right / top`
- Measured cable overmould size (for the F3.2 slot): `W × H` = `____ × ____ mm`
- Notes:

---

## 4. Derived dimensions (F1.2 — compute after §1)

```
front opening    = (PO_W - 2R) × (PO_H - 2R)     (reveal over the panel edge)
rebate / inner   = (EW + 2) × (EH + 2)           (clear the module ENVELOPE incl. header)
rebate depth     = PT + 0.5 mm
cavity depth     = RD + 3 mm minimum
frame outer      = opening + 2F, and ≥ EW + 2×margin
```

| Derived | Formula | Value (mm) |
|---|---|---|
| Reveal `R` (design 3–5 mm) | chosen; **recommend 4 mm** (border is 5.0 mm W) | |
| Frame face width `F` (design 35–45 mm) | chosen | |
| Front opening W × H | `PO − 2R` | R=3 → **119 × 94**; R=4 → **117 × 92**; R=5 → **115 × 90** |
| Rebate / inner W × H | `EW + 2` | × (needs `EW`/`EH`) |
| Rebate depth | `PT + 0.5` | |
| Cavity depth | `RD + 3` | |
| Frame outer W × H | `opening + 2F` | × |

**Header edge:** which edge does the 8-pin header protrude from, and by how far? `____`
(the rebate must clear the envelope, not just the board outline).

**Reveal:** keep `R` ≤ ~5 mm (panel border ≈ 5.0 mm on the width) so the front face doesn't clip
the image. Choose `R` = `____` mm (3–5).

---

## 5. Cut list (F1.2 — to complete)

All four members cut from one board so grain runs continuously.

| # | Member | Length (mm) | Mitre | Rebate | Spline/dowel | Notes |
|---|---|---|---|---|---|---|
| 1 | Top | | 45° / 45° | | | |
| 2 | Bottom | | 45° / 45° | | | |
| 3 | Left | | 45° / 45° | | | |
| 4 | Right | | 45° / 45° | | | |
| 5 | Spacer frame ×4 | | | | | cavity depth |
| 6 | Back panel | | — | — | — | screwed, serviceable |

Nesting plan (sketch which member is cut where on the board):

```
<sketch>
```

---

## 6. Sanity reference — NOT for cutting

For a rough cross-check only, Waveshare lists the **Module (F)** as: **active area 114.9 × 85.8 mm**,
**panel outline 125.4 × 99.5 × 0.91 mm**, **module outline 138.5 × 100.5 mm** (the module is ~13 mm
wider than the panel because of its PCB tab). **The measured module was 139.5 × 101.0 mm — the
datasheet is ~1 mm tight, so trust the calipers.** If your reading is wildly different from §1,
re-measure before proceeding. **Cut to §1, never to this paragraph.**
