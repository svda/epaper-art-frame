# Bill of Materials — Wooden Frame for the 13.3" Panel

Spec: [`../SPEC.md`](../SPEC.md) · Plan: [`../tasks/plan.md`](../tasks/plan.md) · Cut list: [`cut-list.md`](./cut-list.md)
Status: **collecting · 2026-10-14** (Checkpoint A signed)

> A solid black walnut frame (one deep ring) with a **passepartout**, a **matte AR acrylic** cover, a
> floated panel, and a **3.6 mm ply back plate recessed flush** into the frame's back — the plate also
> carries the electronics. All sizes from `cut-list.md`; see the SPEC for the design.

## Core components

| Item | Spec | Have? |
|---|---|---|
| Display | E Ink **13.3" Spectra 6**, 1200×1600 (landscape), active **270.4 × 202.8** | yes |
| Board | Seeed **XIAO ePaper Display Board EE02** (XIAO ESP32-S3 Plus, 60-pin FPC) | yes |
| Battery | **3000 mAh LiPo**, 65 × 35 × 10 mm (same cell as the 5.65" frame) | yes |
| **Frame timber** | **Black walnut**: one board **≥ 28 mm thick × ≥ 20 mm wide × ≥ 1.5 m** (member = 18 wide × 27.6 deep; 4 pieces ≈ 1 465 mm + waste) | **to buy (F2.1, ask-first)** |
| Back plate | **3.6 mm plywood**, cut **381 × 313.4** (recessed flush) | to cut |
| Backing ring | **3.6 mm plywood**, **284.5 × 209** outer / 268.5 × 193 inner | to cut |
| Float spacer ring | **2.5 mm** card/foam, ring, inner ≈ mat window | to cut |
| Panel gasket + boss pads | **closed-cell foam** | to cut |

## Panels & glazing

| Item | Spec | Have? |
|---|---|---|
| **Acrylic** | **Matte anti-reflective, 2 mm**, cut **370 × 302.4** — sheet **≥ 372 × 304.4** | **ordered** |
| Mat board | **White archival, 2.5 mm**, cut **370 × 302.4**, window **270.4 × 202.8 (+0.5/−0)** | **ordered** |

> **Sheet note:** the original 400 × 300 mm sheet was **~2.4 mm too short** in height at F = 18 (the
> 296.4 aperture + a 4 mm lip needs 304.4); a larger matte AR sheet (≥ 372 × 304.4) is now **ordered**.

## Wall mount & hardware

| Item | Notes |
|---|---|
| **French cleat** | Hardwood rail **100 × 20 × ~12** + matching wall rail; **lateral stop** |
| Cleat screws | Small screws spread along the 9 mm back rim (or glue-blocked cleats) |
| Back-plate screws | Small wood screws, plate → frame (removable for service) |
| M2 standoffs | **36 × 75** c/c for the EE02, nylon preferred |
| M2 screws + nylon washers | Board mounting; foam anti-rotation pad |
| Zip-ties / cable clips | FPC service-loop strain relief |

## Electronics sundries

| Item | Notes |
|---|---|
| **Battery connector adapter** | EE02 is **JST-PH 2.0**; the cell is **Micro JST 1.25 mm** (PicoBlade / JST-GH class — **not** JST-SH, 1.0 mm). Ready-made **1.25 ↔ PH 2.0, 2-pin** cable, or crimp a PH pigtail onto the battery. **Verify polarity before connecting.** |
| **Right-angle USB-C pigtail** | Charging through the back-plate opening (frame off the wall) |
| USB-C receptacle/grommet | Fixed receptacle at the back-plate opening (or a right-angle connector direct) |
| Velcro / strap / battery pocket | Holds the LiPo **removably** (never bonded) |

## Consumables & tools

- Wood glue + clamps + **flat cauls**; **spline or dowel stock** for the mitres
- **Router bit** (straight/pattern) or stacked saw cuts for the 3-step rebate (lip / pocket / back rebate)
- Sandpaper 120/180/240; **satin oil or wax** finish + applicator/rags
- Drill bits (pilots + clearance), countersink; wire strippers; PH0/PH1 drivers
- Digital calipers; multimeter (battery/current), mitre saw, random-orbit sander

## Not needed

- **TP4056** — the EE02 has an **onboard charger**
- **Breadboard / extension board** — direct wiring, for depth
- **Glass/clear glazing** — deliberately matte AR only (no glare)

## Open

- [ ] Confirm the exact 1.25 mm battery series (PicoBlade vs JST-GH) and polarity
- [ ] Decide adapter cable vs crimp/solder a PH pigtail onto the battery
- [ ] Order the **larger acrylic sheet** (400 × 300 owned is too short)
- [ ] EE02 button/USB-C offsets — set the width of the back-plate opening at F1.1
