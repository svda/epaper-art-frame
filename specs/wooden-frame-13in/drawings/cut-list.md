# Cut List & Measurements — Wooden Frame for the 13.3" Panel

Spec: [`../SPEC.md`](../SPEC.md) · Device: [`../../ee02-13in-spectra6/SPEC.md`](../../ee02-13in-spectra6/SPEC.md)
Task: **F1.1 / F1.2** · Status: **measurements recorded; cut list derived (rev 2026-10-14). Open: `MO` / FPC offset.**

> **Measure, don't guess.** Fill the "Measured" cells from calipers on the *actual* panel, EE02 and
> LiPo. Do **not** copy catalogue numbers in. The `§5` reference is explicitly *not* for cutting.

---

## 1. Measured values (F1.1)

| Symbol | Meaning | Measured (mm) | Source |
|---|---|---|---|
| `AW × AH` | **Active area (landscape)** — 1600×1200 px, 13.3" | **270.4 × 202.8** | confirmed (owner 2026-10-14) |
| `PO_W × PO_H` | Panel outline (glass edge), landscape | **284.5 × 209.0** | confirmed (owner 2026-10-14) |
| `PT` | Panel glass thickness (excl. FPC stiffener) | **1.0** | confirmed (owner 2026-10-14) |
| `FT` | FPC/connector stack thickness | **0.5** (`< PT`, so `PT` governs) | confirmed (owner 2026-10-14) |
| `bow` | Panel flatness (mid vs edge) | **none** | confirmed (owner 2026-10-14) |
| `border L/R/T/B` | Per-side glass borders (left/right/top/bottom) | **3.1 / 11.0 / 3.1 / 3.1** | confirmed (owner 2026-10-14) |
| `FPC edge` | Edge the 60-pin FPC exits | **right edge** | confirmed (owner 2026-10-14) |
| `FPC W / bend` | FPC width; distance from the glass edge before it bends | **W 25 mm; bends ~5 mm out from the glass edge** | confirmed (owner 2026-10-14) |
| `MO_W × MO_H` | **Module footprint** — glass + the rigid FPC stub | **289.5 × 209** (glass 284.5 + ~5 mm FPC) | derived |
| `EE_W × EE_H × EE_T` | EE02 board outline + thickness (XIAO seated) | **43 × 81 × 8** | confirmed (owner 2026-10-14) |
| `EE_holes` | EE02 mounting-hole spacing (ltr × ttb) | **36 × 75** c/c | confirmed (owner 2026-10-14) |
| `BTN/USB/SW` | EE02 button / USB-C / battery-JST edge + offset | **buttons + USB-C on the RIGHT edge; battery JST at the BOTTOM; offsets TBD** | confirmed (owner 2026-10-14) |
| `FPC conn` | Position of the 60-pin FPC connector on the board | **left edge, at the top** | confirmed (owner 2026-10-14) |
| `BW × BH × BT` | LiPo outline + thickness | **65 × 35 × 10** (same cell as the 5.65" frame) | confirmed (owner 2026-10-14) |

Notes / anything unexpected:

```
2026-10-14  ACTIVE + GLASS CONFIRMED
  Active area 270.4 x 202.8 mm; glass outline 284.5 x 209.0 mm (landscape).
  -> Borders are UNEVEN: left 3.1, right 11.0, top 3.1, bottom 3.1 mm.
     The FPC/connector is on the RIGHT, so the glass is ~7.9 mm wider there.
  -> The active area sits ~3.95 mm LEFT of the glass centre (vertically centred).
     The mat window is placed on the ACTIVE area, so the PANEL is seated offset:
     glass centre ~3.95 mm RIGHT of the opening centre, keeping the right side
     clear for the FPC loop.
  -> PO does not change the frame face or the mat: the frame is pinned by the active
     area (see section 2). It only confirms the panel fits and sets the seat offset.

  TO MEASURE: FPC width/length, MO, EE02 hole spacing + feature offsets. Then mock up
  the electronics stack to measure RD (rear cavity), a LOWER BOUND (excludes swell).

2026-10-14  THICKNESS CONFIRMED
  PT = 1.0 mm (glass), FT = 0.5 mm (FPC/connector, thinner so PT governs), no bow.
  -> front rebate depth = lip 3 + AC 2 + MB 2.5 + G 2.5 + PT 1.0 + clr 0.5 = 11.5 mm
     (frame member depth FD). Finalise after the acrylic thickness is chosen.

2026-10-14  EE02 BOARD CONFIRMED
  Board 43 x 81 x 8 mm. Edge map (board upright): buttons + USB-C on the RIGHT long
  edge; battery JST on the BOTTOM short edge; 60-pin FPC connector on the LEFT long
  edge, at the TOP.
  -> Mounting DECIDED (2026-10-14): board on the BACK PLATE, FLIPPED so its component
     side faces the plate -- buttons + USB-C face inward (toward the back). The ribbon
     takes a gentle S-BEND/fold -- never a twist (twisting a flat ribbon stresses it).
     No glue to the panel.
  -> ONE OPENING in the back plate exposes the board's WHOLE RIGHT SIDE (buttons +
     USB-C + power switch), reached with the frame OFF the wall (owner accepted).
     USB-C is edge-mounted, so plug a right-angle connector through the opening (or
     leave a short pigtail dressed at it).
  -> LAYOUT (2026-10-14): the EE02 sits at the BOTTOM-LEFT **inboard** (viewed from the back),
     **clear of the backing ring/boss**, so the panel FPC still plugs STRAIGHT into the board's
     left-edge connector -- NO extension. The back-plate opening goes over the board's other
     (buttons/USB) side.

2026-10-14  DEPTH CONFIRMED (final)
  RD = 10.0 mm (owner reduced 12 -> 10); EXCLUDES swell.
  -> back-plate inner face = front stack 11 + RD 10 + swell 3 = 24 mm
  -> total member depth = 24 + BP 3.6 = 27.6 mm (one solid piece); back rebate = BP (3.6, 9 mm rim)
  -> AC = 2, BP = 3.6. No depth gate remains.
```

---

## 2. Derived dimensions (F1.2 — design values)

Design choices (2026-10-14): **landscape**, **solid hardwood**, **white 2.5 mm archival mat**,
**matte AR acrylic ≈ 2 mm**, **float gap 2.5 mm**, **equal mat border**.

```
mat window         = AW + tol  ×  AH + tol    (tol ≈ 0.5–1 mm; centred on the ACTIVE area)
frame opening      = AW + 2M   ×  AH + 2M      (visible aperture = mat outer)
frame outer        = opening + 2F
equal border    ⇒  outer_w − outer_h = AW − AH = 67.6 mm
```

| Derived | Formula | Value (mm) |
|---|---|---|
| Mat window | `AW × AH` | **270.4 × 202.8** (+0.5/−0; never clip a pixel) |
| Mat border `M` | chosen; `M = 64.8 − F` | **46.8** (with `F` = 18) |
| Frame face width `F` | chosen | **18** |
| Frame opening | `AW + 2M × AH + 2M` | **364 × 296.4** |
| Frame outer | `opening + 2F` | **400 × 332.4** (40 × 33.2 cm) |
| Acrylic / mat | `opening + 2 × overlap (4)` | **372 × 304.4** (cut ~370 × 302.4 — drop-in clearance) |
| Panel bezel (hidden by the mat) | per-side `L/R/T/B` | **3.1 / 11.0 / 3.1 / 3.1** |
| Panel seat offset | `(border R − border L)/2` | **3.95 mm right of the opening centre** |
| Panel clearance in opening | `(opening − PO)/2` | **39.75 W / 43.7 H** |
| Front stack (front → panel back) | `lip(3) + AC(2) + MB(2.5) + G(2.5) + PT(1.0)` | **11** |
| `RD` (panel back → plate inner) | LiPo 10; owner reduced 12 → 10 | **10.0** (incl. wiring) |
| Swell allowance | owner: 3 mm | **3.0** |
| Back-plate inner face (pocket floor) | `11 + RD(10) + swell(3)` | **24** |
| Back rebate (plate recess) | `BP`, 9 mm rim | **3.6** |
| **Total member depth** | `plate inner + BP` | **27.6** |

**Mat window centring:** the window is centred on the **active area**, not the glass. Confirmed on
this panel: the active area sits **3.95 mm left of the glass centre**, so the panel is seated with its
glass centre **3.95 mm right of the opening centre** (right side = FPC), keeping the acrylic floating
`G` off the panel.

---

## 3. Cut list (F1.2)

> **One member, one setup.** Each frame member is a single solid piece **27.6 mm thick**, machined from
> the front: a **3 mm lip** (leaves the **364 × 296.4** front opening) over a **pocket to depth 24** at
> **372 × 304.4** — the pocket is *both* the rebate for the acrylic/mat *and* the electronics cavity —
> then a **3.6 mm back rebate** (9 mm rim, opening **382 × 314.4**) for the plate. **3 + 21 + 3.6 = 27.6.**
> Open at build time: `MO`/FPC offset, spline/dowel layout.

| # | Member | Qty | Outer length (mm) | Mitre | Machining (depths, mm) | Notes |
|---|---|---|---|---|---|---|
| 1 | Top rail | 1 | **400** | 45° × 2 | lip 3 → pocket to 24 → back rebate 3.6 | 27.6 thick |
| 2 | Bottom rail | 1 | **400** | 45° × 2 | as rail 1 | |
| 3 | Left stile | 1 | **332.4** | 45° × 2 | as rail 1 | |
| 4 | Right stile | 1 | **332.4** | 45° × 2 | as rail 1 | |
| 5 | Back plate | 1 | **381 × 313.4 × 3.6** | — | — | 1 mm clearance in the 382 × 314.4 rebate; recessed **flush**, hidden from the side; screws to the frame; carries EE02 + LiPo + the opening + 4 bosses |
| 6 | Float spacer ring | 1 | ring | — | — | **2.5 mm** card/foam; sets gap `G`; inner ≈ mat window |
| 7 | Backing ring | 1 | **284.5 × 209 (outer) · 268.5 × 193 (inner)** | — | — | **3.6 mm plywood**, ~8 mm ring **behind the panel edge only**; captured by the 4 plate bosses |
| 8 | French cleat (frame rail) | 1 | 100 × 20 × ~12 | — | — | rail screwed to the frame's **20 mm back rim** (≥4 screws, cross-grain) — **not the plate**; + a matching wall rail; add a **lateral stop** |

**Stock:** one **black walnut** board, **width ≥ ~20 mm** (member = `F` 18 + saw allowance), **thickness
≥ 28 mm**, **length ≥ ~1.48 m** (400 + 400 + 332.4 + 332.4 + mitre waste). Flat reference face.

**Recessed plate:** cut to **381 × 313.4** (1 mm drop-in clearance); keep the 4 screws ≥5 mm in from the
edge.

**Mat & acrylic (cut after the frame is true):** mat **white 2.5 mm**, single bevel, **cut 370 × 302.4**
(1 mm under the 372 × 304.4 pocket; still covers the 364 × 296.4 opening under the lip) with a **window
270.4 × 202.8 (+0.5 / −0)**, centred on the **active area**. Matte **AR acrylic** cut to **370 × 302.4**.

> **Sheet size:** the glazing needs a sheet **≥ 372 × 304.4**. The owned **400 × 300 is ~2.4 mm too short**
> in height (the F=18 aperture 296.4 + the 4 mm lip exceeds 300). **Get a ~400 × 400 / A2 sheet.** Keep
> its film on until the frame is closed.

---

## 4. Joinery & assembly notes

- Mitred corners, **splined or dowelled**; dry-fit and check diagonals before glue.
- Front stack, front → back: **acrylic → mat → float gap `G` → panel**. The acrylic bears on the
  frame/mat, **never** on the panel.
- Electronics (EE02 + LiPo) mount on the **back plate** (removable, screwed) with a **service loop**;
  the FPC stays strain-free.
- **Buttons (GPIO2/GPIO3), USB-C and the power switch must be reachable wall-mounted** — cutouts on
  the bottom edge (see SPEC Q2/Q5).

---

## 5. Sanity reference — NOT for cutting

The panel is a 13.3" 1200×1600 Spectra 6 (module marking T133A01): active area ≈ 270.4 × 202.8 mm at
≈ 0.169 mm/px (150 ppi). The measured glass came in at **284.5 × 209 mm**. Confirm against `§1`; cut
to `§1`, never to this paragraph.
