# Cut List & Measurements — Wooden Frame

Spec: [`../SPEC.md`](../SPEC.md) · Plan: [`../tasks/plan.md`](../tasks/plan.md)
Task: **F1.1 / F1.2** · Status: **awaiting measurements**

> **Measure, don't guess.** Fill the "Measured" cells with caliper readings from the *actual*
> panel, NULA, LiPo and lead bundle. Do **not** copy catalogue/datasheet numbers into this file —
> everything is derived from what you measure. The single sanity reference in §6 is explicitly
> *not* for cutting.

---

## 1. Measured values (F1.1)

| Symbol | Meaning | Measured (mm) | Photo ref |
|---|---|---|---|
| `PO_W` | Panel outline width (outer edge) | | |
| `PO_H` | Panel outline height | | |
| `PT` | Panel thickness | | |
| `AW` | Panel active/visible area width | | |
| `AH` | Panel active/visible area height | | |
| `RD` | Rear stack depth — **mock up** NULA + LiPo + lead breakout + connector + a service loop, measure the total | | |
| `BW` | LiPo width | | |
| `BH` | LiPo height | | |
| `BT` | LiPo thickness | | |

Notes / anything unexpected:

```
<record observations here>
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
front opening   = (PO_W - 2R) × (PO_H - 2R)
rebate depth    = PT + 0.5 mm
internal cavity = RD + 3 mm minimum
frame outer     = opening + 2F
```

| Derived | Formula | Value (mm) |
|---|---|---|
| Reveal `R` (design 3–5 mm) | chosen | |
| Frame face width `F` (design 35–45 mm) | chosen | |
| Opening W × H | `PO − 2R` | × |
| Rebate depth | `PT + 0.5` | |
| Cavity depth | `RD + 3` | |
| Frame outer W × H | `opening + 2F` | × |

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

For a rough cross-check only: a 5.65" 600×448 (4:3) panel should have an **active area around
114.5 × 85.5 mm**, with the outline larger. If your caliper reading is wildly different, re-measure
before proceeding. **Cut to §1, never to this paragraph.**
