# Bill of Materials — Wooden Frame

Spec: [`../SPEC.md`](../SPEC.md) · Plan: [`../tasks/plan.md`](../tasks/plan.md)
Status: collecting · 2026-09-29

> The frame is a 3.6 mm ply back plate (which also carries the electronics), a
> mitred hardwood frame, and the display sandwich. See the SPEC for the design.

## Core components

| Item | Spec | Have? |
|---|---|---|
| Display | Waveshare 5.65" **Module (F)**, 600×448 ACeP (panel + driver PCB) | yes |
| MCU | Soldered **NULA DeepSleep ESP32-S3** (N8R8) | yes |
| Battery | **3000 mAh LiPo**, 65 × 35 × 10 mm | ordered |
| Back plate / carrier | **3.6 mm plywood** | to cut |
| NULA standoffs | **M3** (nylon preferred) | ordered |

## Electronics sundries

| Item | Notes |
|---|---|
| **Battery connector adapter** | NULA is **JST-PH 2.0**; the battery is a **smaller JST** (likely JST-SH 1.25 / possibly JST-ZH 1.5). Get an adapter pigtail or re-crimp to JST-PH 2.0. **Verify polarity before connecting.** |
| 2 × 100 kΩ 1% resistors (+ 100 nF) | Battery ADC divider — the NULA has **none** |
| 30 AWG silicone wire + heat-shrink | Harness (8 runs: 3V3/GND/DIN/CLK/CS/DC/RST/BUSY) |
| Right-angle USB-C cable / pigtail | Charging access through the bottom slot |
| Velcro / strap / battery pocket | Holds the LiPo **removably** (never bonded) |
| Foam / rubber pad | NULA anti-rotation (single M3 hole) |
| M3 nylon washers + 2 × M3 screws | Board mounting |
| Zip-ties / cable clips / hot glue | Service-loop strain relief |
| Small wood screws | Back plate → spacer frame |
| Panel retaining stops (thin wood stops or z-clips) | Panel retention in the rebate |
| French cleat + wall screws/plugs | Wall mount |
| Wall bumpers/spacers | Keep the hung frame ≤2 mm off the wall |

## Consumables & tools

- Wood glue + clamps; spline/dowel stock for the mitres
- Sandpaper 120/180/240; oil/wax finish + applicator/rags
- Drill bits (3.2 mm clearance + pilots), countersink; wire strippers; PH0/PH1 drivers
- Soldering iron + solder/flux
- Digital calipers; **multimeter with a µA range** (P3.1 deep-sleep measurement)

## Not needed

- **TP4056** — the NULA has the onboard TP4056M charger
- **Breadboard / extension board** — direct wiring, for depth

## Open

- [ ] Confirm the battery's exact JST pitch (1.25 mm = JST-SH?) **and polarity**
- [ ] Confirm the NULA pin map (`3V3`, `GND`, GPIO 7–12) against the silkscreen
- [ ] Decide adapter cable vs re-crimp
