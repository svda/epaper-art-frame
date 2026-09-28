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
| `MO_W` | **Module (F) outline width** — panel + onboard driver PCB (**true footprint**) | **139.5** | manual |
| `MO_H` | **Module (F) outline height** | **101.0** | manual |
| `PO_W` | Panel outline width (glass edge, smaller than module) | | |
| `PO_H` | Panel outline height | | |
| `AW` | Active / visible area width | | |
| `AH` | Active / visible area height | | |
| `PT` | Module thickness (panel + PCB + FPC connector/header) | | |
| `RD` | Rear stack depth — **mock up** NULA + LiPo + module PCB/header + wiring + a service loop, measure the total | | |
| `BW` | LiPo width | | |
| `BH` | LiPo height | | |
| `BT` | LiPo thickness | | |

Notes / anything unexpected:

```
Module outline measured 139.5 x 101.0 mm (user, manual). Waveshare lists 138.5 x 100.5 mm,
so the datasheet is ~1.0 mm tight in width and ~0.5 mm in height. Measure-first validated:
these measured values, not the catalogue, drive the rebate/cavity.
ASSUMPTION to confirm: the 139.5 x 101.0 is the panel + PCB outline only, NOT including the
exposed FPC/header or any protective film. If a film/connector protrudes, note it separately.
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
rebate / inner   = (MO_W + 2) × (MO_H + 2)       (clear the module PCB + tab)
rebate depth     = PT + 0.5 mm
cavity depth     = RD + 3 mm minimum
frame outer      = opening + 2F, and ≥ MO + 2×margin
```

| Derived | Formula | Value (mm) |
|---|---|---|
| Reveal `R` (design 3–5 mm) | chosen | |
| Frame face width `F` (design 35–45 mm) | chosen | |
| Front opening W × H | `PO − 2R` | × |
| Rebate / inner W × H | `MO + 2` | **141.5 × 103.0** (from measured MO) |
| Rebate depth | `PT + 0.5` | |
| Cavity depth | `RD + 3` | |
| Frame outer W × H | `opening + 2F` | × |

**Module tab:** which edge does the PCB tab (FPC connector + header) extend from? `____`
(give that side extra clearance / a wider member).

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
