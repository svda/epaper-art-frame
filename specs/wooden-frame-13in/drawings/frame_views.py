#!/usr/bin/env python3
"""Generate dimensioned 2D orthographic views (SVG) of the 13.3" frame.

Outputs, next to this script:
  front.svg  front elevation   -- outer / opening / mat window / panel glass
  side.svg   vertical section  -- rail cross-section, the depth stack (A-A)
  top.svg    horizontal section -- stile cross-section, the depth stack (B-B)
  back.svg   rear elevation    -- back plate, opening, EE02 layout, cleat

All dimensions in mm, from cut-list.md (2026-10-14). Pure stdlib SVG.
Rasterise with headless Chrome (accurate text):
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
    --screenshot=front.png --window-size=W,H file://$PWD/front.svg
"""

from __future__ import annotations

import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
S = 3.0  # px per mm

# --- dimensions (mm) --------------------------------------------------------
F = 18.0
OUTER_W, OUTER_H = 400.0, 332.4
OPEN_W, OPEN_H = OUTER_W - 2 * F, OUTER_H - 2 * F      # 364 × 296.4
MAT_W, MAT_H = 270.4, 202.8            # mat window = active area
PO_W, PO_H = 284.5, 209.0              # panel glass outline
BORD_L, BORD_R, BORD_T, BORD_B = 3.1, 11.0, 3.1, 3.1
SEAT = (BORD_R - BORD_L) / 2           # 3.95, glass centre right of the window centre
MAT_BORDER = (OUTER_W - 2 * F - MAT_W) / 2   # 40.8

# depth stack (mm), front face = 0
LIP, AC, MB, GAP, PT = 3.0, 2.0, 2.5, 2.5, 1.0
MODULE_BACK = LIP + AC + MB + GAP + PT       # 11  (front face -> panel back)
RD, SWELL = 10.0, 3.0                          # panel back -> plate inner (excl. + incl. swell)
PLATE_INNER = MODULE_BACK + RD + SWELL        # 24  (pocket floor = back-rebate inner face)
BP = 3.6                                        # back plate, recessed into the back rebate
TOTAL = PLATE_INNER + BP                       # 27.6 (ONE solid member)
BACK_LIP = 9.0                                  # back rim (F−LIP_OVER−ledge); cleat purchase
LIP_OVER = 4.0                                  # lip overlap over the acrylic
RING_FRONT = MODULE_BACK + 0.5                 # 11.5 ring/foam front (panel back + 0.5)
REB_RAIL = OPEN_H / 2 + LIP_OVER                # 152.2 (pocket 304.4 tall)
REB_STILE = OPEN_W / 2 + LIP_OVER               # 186   (pocket 372 wide)

# EE02 board (mm) + LiPo
EE_W, EE_H = 43.0, 81.0
EE_HOLE_LR, EE_HOLE_TB = 36.0, 75.0
LIPO_W, LIPO_H = 65.0, 35.0

INK, RED, GREY = "#1a1a1a", "#c0392b", "#9aa0a6"
GLASS, PCB, MATC, ACTIVE, CLEAT, SPACERC = "#3f7fbf", "#2e8b57", "#c9b79c", "#8e44ad", "#b9770e", "#6b7280"
HEAD = 'font-family="Helvetica,Arial,sans-serif"'


class Svg:
    def __init__(self, w, h, title, subtitle=""):
        self.w, self.h, self.title, self.subtitle = w, h, title, subtitle
        self.o = []

    def raw(self, s):
        self.o.append(s)

    def line(self, x1, y1, x2, y2, w=1.0, color=INK, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.raw(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="{w}"{d}/>')

    def rect(self, x, y, w, h, sw=1.0, color=INK, dash=None, fill="none"):
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.raw(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" stroke="{color}" stroke-width="{sw}"{d}/>')

    def poly(self, pts, sw=1.0, color=INK, fill="none"):
        p = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        self.raw(f'<polygon points="{p}" fill="{fill}" stroke="{color}" stroke-width="{sw}"/>')

    def circle(self, x, y, r, sw=1.0, color=INK, fill="none"):
        self.raw(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{fill}" stroke="{color}" stroke-width="{sw}"/>')

    def text(self, x, y, t, size=11, anchor="middle", rot=0, color=INK, weight="normal"):
        tr = f' transform="rotate({rot} {x:.1f} {y:.1f})"' if rot else ''
        self.raw(f'<text x="{x:.1f}" y="{y:.1f}" {HEAD} font-size="{size}" text-anchor="{anchor}" fill="{color}" font-weight="{weight}"{tr}>{t}</text>')

    def arrow(self, x, y, d, L=7, W=2.4, color=RED):
        pts = {"l": [(x, y), (x + L, y - W), (x + L, y + W)], "r": [(x, y), (x - L, y - W), (x - L, y + W)],
               "u": [(x, y), (x - W, y + L), (x + W, y + L)], "d": [(x, y), (x - W, y - L), (x + W, y - L)]}[d]
        self.raw('<polygon points="' + " ".join(f"{a:.1f},{b:.1f}" for a, b in pts) + f'" fill="{color}"/>')

    def render(self):
        head = f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
        bg = f'<rect x="0" y="0" width="{self.w}" height="{self.h}" fill="#ffffff"/>'
        t = f'<text x="{self.w/2:.0f}" y="28" {HEAD} font-size="17" font-weight="bold" text-anchor="middle" fill="#111">{self.title}</text>'
        sub = (f'<text x="{self.w/2:.0f}" y="47" {HEAD} font-size="11" text-anchor="middle" fill="#666">{self.subtitle}</text>' if self.subtitle else '')
        return head + bg + t + sub + "".join(self.o) + "</svg>"


def dim_h(sv, x1, x2, y, label, ext_y=None, size=11, color=RED, above=True):
    sv.line(x1, y, x2, y, w=0.9, color=color)
    sv.arrow(x1, y, "l", color=color); sv.arrow(x2, y, "r", color=color)
    if ext_y is not None:
        ye = y - 6 if y < ext_y else y + 6
        sv.line(x1, ext_y, x1, ye, w=0.5, color=color, dash="2,2"); sv.line(x2, ext_y, x2, ye, w=0.5, color=color, dash="2,2")
    sv.text((x1 + x2) / 2, y - 5 if above else y + 13, label, size=size, color=color)


def dim_v(sv, y1, y2, x, label, ext_x=None, size=11, color=RED, left=True):
    sv.line(x, y1, x, y2, w=0.9, color=color)
    sv.arrow(x, y1, "u", color=color); sv.arrow(x, y2, "d", color=color)
    if ext_x is not None:
        xe = x - 6 if x < ext_x else x + 6
        sv.line(ext_x, y1, xe, y1, w=0.5, color=color, dash="2,2"); sv.line(ext_x, y2, xe, y2, w=0.5, color=color, dash="2,2")
    sv.text(x - 5 if left else x + 13, (y1 + y2) / 2, label, size=size, color=color, rot=-90, anchor="middle")


def leader(sv, x1, y1, x2, y2, label, size=10, color=INK):
    sv.line(x1, y1, x2, y2, w=0.7, color=color); sv.circle(x1, y1, 1.6, sw=0, color=color, fill=color)
    a = "start" if x2 >= x1 else "end"
    sv.text(x2 + (4 if x2 >= x1 else -4), y2 + 3, label, size=size, color=color, anchor=a)


def save(sv, name):
    (OUT / name).write_text(sv.render(), encoding="utf-8")
    print(f"  wrote {name}")


def front():
    ox, oy = 130, 140
    w, h = OUTER_W * S, OUTER_H * S
    sv = Svg(int(ox + w + 90), int(oy + h + 150), "FRONT ELEVATION", "scale 3 px/mm · dimensions mm")

    def X(mm): return ox + (mm + OUTER_W / 2) * S
    def Y(mm): return oy + (mm + OUTER_H / 2) * S

    # panel glass (hidden behind mat), offset so the ACTIVE area aligns with the window
    gcx = SEAT
    sv.rect(X(gcx - PO_W / 2), Y(-PO_H / 2), PO_W * S, PO_H * S, sw=0.9, color=GLASS, dash="5,4")
    # mat window (= active area) and opening and outer
    sv.rect(X(-MAT_W / 2), Y(-MAT_H / 2), MAT_W * S, MAT_H * S, sw=0.9, color=ACTIVE, dash="3,3")
    sv.rect(X(-OPEN_W / 2), Y(-OPEN_H / 2), OPEN_W * S, OPEN_H * S, sw=1.3, color=MATC)
    sv.rect(X(-OUTER_W / 2), Y(-OUTER_H / 2), w, h, sw=1.8)

    # centrelines
    sv.line(X(0), oy - 96, X(0), oy + h + 26, w=0.7, color=GREY, dash="12,3,2,3")
    sv.line(ox - 30, Y(0), ox + w + 30, Y(0), w=0.7, color=GREY, dash="12,3,2,3")
    sv.text(X(0), oy - 102, "A", size=12, color=RED, weight="bold")
    sv.text(ox + w + 38, Y(0) + 4, "B", size=12, color=RED, weight="bold")

    dim_h(sv, ox, ox + w, oy - 66, "400", ext_y=oy)
    dim_h(sv, X(-OPEN_W / 2), X(OPEN_W / 2), oy - 34, f"{OPEN_W:g}  opening", ext_y=oy)
    dim_h(sv, X(-MAT_W / 2), X(MAT_W / 2), oy + h + 30, "270.4  mat window / image", ext_y=oy + h, above=False)
    dim_v(sv, oy, oy + h, ox - 66, "332.4", ext_x=ox)
    dim_v(sv, Y(-OPEN_H / 2), Y(OPEN_H / 2), ox - 34, f"{OPEN_H:g}", ext_x=ox)

    leader(sv, X((OPEN_W / 2 + OUTER_W / 2) / 2), Y(-OPEN_H / 2 - 6), ox + w + 4, oy + 6, f"face width F = {F:g}", color=INK)

    nx, ny = 30, oy + h + 60
    for i, (c, t) in enumerate([
        (ACTIVE, "mat window 270.4 x 202.8  (= active area / image)"),
        (MATC, f"mat border {MAT_BORDER:g} (equal all round); frame opening {OPEN_W:g} x {OPEN_H:g}"),
        (GLASS, "panel glass 284.5 x 209 (hidden; seated 3.95 right so the window centres on the pixels)"),
        (RED, "A-A: side section     B-B: top section"),
    ]):
        sv.line(nx, ny + i * 17 - 4, nx + 16, ny + i * 17 - 4, w=3, color=c)
        sv.text(nx + 24, ny + i * 17, t, size=10.5, color=INK, anchor="start")
    return sv


def back():
    ox, oy = 130, 140
    w, h = OUTER_W * S, OUTER_H * S
    sv = Svg(int(ox + w + 440), int(oy + h + 150), "BACK ELEVATION", "scale 3 px/mm · viewed from the back · dimensions mm")

    def X(mm): return ox + (mm + OUTER_W / 2) * S     # +mm = right as seen from the BACK
    def Y(mm): return oy + (OUTER_H / 2 - mm) * S     # +mm = up

    sv.rect(X(-OUTER_W / 2), Y(OUTER_H / 2), w, h, sw=1.8)                     # frame outer
    brw, brh = OUTER_W / 2 - BACK_LIP, OUTER_H / 2 - BACK_LIP
    sv.rect(X(-brw), Y(brh), 2 * brw * S, 2 * brh * S, sw=1.4, fill="#f6f4ef")  # back plate (recessed, flush)
    # panel + backing ring (hidden behind the plate); the board sits inside the ring
    sv.rect(X(-SEAT - PO_W / 2), Y(PO_H / 2), PO_W * S, PO_H * S, sw=0.8, color=GREY, dash="4,4")
    sv.rect(X(-SEAT - PO_W / 2 + 8), Y(PO_H / 2 - 8), (PO_W - 16) * S, (PO_H - 16) * S, sw=0.8, color="#8a8f98", dash="3,3")

    # EE02 inside the ring (as seen from the back); LiPo beside it
    bx0, by0 = -SEAT - PO_W / 2 + 12, -PO_H / 2 + 12   # board corner — clear of the ring
    sv.rect(X(bx0), Y(by0 + EE_H), EE_W * S, EE_H * S, sw=1.2, color=PCB, fill="#eaf6ef")
    sv.text(X(bx0 + EE_W / 2), Y(by0 + EE_H / 2) + 4, "EE02", size=10, color=PCB)
    # standoff holes 36 x 75
    for dx in (3.5, 39.5):
        for dy in (3.0, 78.0):
            sv.circle(X(bx0 + dx), Y(by0 + dy), 3, sw=1.0, color=PCB)
    lx0 = bx0 + EE_W + 8
    sv.rect(X(lx0), Y(by0 + EE_H), LIPO_W * S, LIPO_H * S, sw=1.2, color=GREY, fill="#f0f0f0")
    sv.text(X(lx0 + LIPO_W / 2), Y(by0 + EE_H / 2) + 4, "LiPo", size=9.5, color=INK)

    # back-plate opening over the board's other (right) side
    op = 12.0
    sv.rect(X(bx0 + EE_W - 6), Y(by0 + EE_H + 6), op * S, (EE_H + 12) * S, sw=1.4, fill="#333")
    leader(sv, X(bx0 + EE_W - 6 + op / 2), Y(by0 + EE_H / 2), X(OUTER_W / 2 + 30), Y(-40),
           "back-plate opening: buttons + USB-C + switch", color=INK)

    # screws (into the spacer wall)
    sx, sy = OUTER_W / 2 - 14, OUTER_H / 2 - 14
    for x in (sx, -sx):
        for y in (sy, -sy):
            sv.circle(X(x), Y(y), 4, sw=1.2)
    leader(sv, X(sx), Y(-sy), X(OUTER_W / 2 + 30), Y(-sy - 10), "4 x screws (back plate -> frame)", color=INK)

    # French cleat near the top
    sv.rect(X(-50), Y(OUTER_H / 2 - 2), 100 * S, 18 * S, sw=1.3, color=CLEAT, fill="#fbf3e3")
    sv.text(X(0), Y(OUTER_H / 2 - 2) + 4, "French cleat 100 x 20", size=9.5, color=CLEAT)

    dim_h(sv, ox, ox + w, oy - 60, "400", ext_y=oy)
    dim_v(sv, oy, oy + h, ox - 60, "332.4", ext_x=ox)

    nx, ny = 30, oy + h + 30
    for i, t in enumerate([
        "back plate 384 x 316.4 x 3.6 ply, recessed flush (screws to the frame; carries EE02 + LiPo)",
        "EE02 43 x 81 inboard, clear of the backing ring/boss (flipped; standoffs 36 x 75)",
        "board clear of the ring so the FPC plugs straight in; one opening reaches buttons/USB/switch",
        "total frame depth 27.6 (front face -> back plate)",
    ]):
        sv.text(nx, ny + i * 17, "·  " + t, size=10.5, color=INK, anchor="start")
    return sv


def side():
    ox, oy = 250, 150
    sv = Svg(int(ox + TOTAL * S + 250), int(oy + OUTER_H * S + 210), "SECTION A-A  (side)",
             "scale 3 px/mm · cut through the rails · dimensions mm")

    def X(d): return ox + d * S
    def Y(z): return oy + (OUTER_H / 2 - z) * S

    def band(d0, d1, z0, z1, **kw):
        d0, d1 = sorted((d0, d1)); z0, z1 = sorted((z0, z1))
        sv.rect(X(d0), Y(z1), (d1 - d0) * S, (z1 - z0) * S, **kw)

    o, i1, i0, br = OUTER_H / 2, REB_RAIL, OUTER_H / 2 - F, OUTER_H / 2 - BACK_LIP
    for sgn in (1, -1):
        sv.poly([(X(0), Y(sgn * i0)), (X(0), Y(sgn * o)), (X(TOTAL), Y(sgn * o)),
                 (X(TOTAL), Y(sgn * br)), (X(PLATE_INNER), Y(sgn * br)),
                 (X(PLATE_INNER), Y(sgn * i1)), (X(LIP), Y(sgn * i1)), (X(LIP), Y(sgn * i0))],
                sw=1.7)                                       # FRAME — one solid piece (front + back rebate)
        band(RING_FRONT + 3.6, PLATE_INNER, sgn * (PO_H / 2 - 8), sgn * (PO_H / 2), sw=0.8,
             color="#c9a227", fill="#fbf3d5")                                    # plate boss — same width as the ring
    band(LIP, LIP + AC, -REB_RAIL, REB_RAIL, sw=1.0, color=GLASS, fill="#eaf2fa")     # acrylic
    band(LIP + AC, LIP + AC + MB, -REB_RAIL, REB_RAIL, sw=1.0, color=MATC, fill="#f3ecdf")  # mat (rabbet size)
    band(MODULE_BACK - PT, MODULE_BACK, -PO_H / 2, PO_H / 2, sw=1.0, color=PCB, fill="#eaf6ef")  # panel
    for sgn in (1, -1):  # float spacer ring (sets gap G, behind the mat)
        band(LIP + AC + MB, MODULE_BACK - PT, sgn * MAT_H / 2, sgn * REB_RAIL, sw=0.8, color="#b58b5a", fill="#f7f1e8")
    for sgn in (1, -1):  # foam gasket + backing ring — a narrow ring behind the panel edge only
        band(MODULE_BACK, RING_FRONT, sgn * (PO_H / 2 - 8), sgn * PO_H / 2, sw=0.6, color="#c8b6a0", fill="#faf7f2")
        band(RING_FRONT, RING_FRONT + 3.6, sgn * (PO_H / 2 - 8), sgn * PO_H / 2, sw=0.9, color="#8a8f98", fill="#eceff2")
    band(PLATE_INNER, TOTAL, -br, br, sw=1.4, fill="#f3f3f0")       # back plate — INSET, flush with the frame back

    sv.line(ox - 20, Y(0), ox + TOTAL * S + 20, Y(0), w=0.7, color=GREY, dash="12,3,2,3")
    dim_v(sv, oy, oy + OUTER_H * S, ox - 52, "332.4", ext_x=ox)

    lx = ox + TOTAL * S + 14
    leader(sv, X(TOTAL - 2), Y(OUTER_H / 2 - 8), lx, Y(150), "frame (one solid piece) 27.6", color=INK)
    leader(sv, X(RING_FRONT + 1.8), Y(PO_H / 2 + 6), lx, Y(118), "foam + backing ring 3.6", color="#8a8f98")
    leader(sv, X((RING_FRONT + 3.6 + PLATE_INNER) / 2), Y(PO_H / 2 - 8), lx, Y(86), "plate boss (presses gasket centre)", color="#c9a227")
    leader(sv, X(TOTAL - 1), Y(-(OUTER_H / 2 - 4)), lx, Y(-150), "back plate 3.6 — recessed, flush", color=INK)

    yb = oy + OUTER_H * S + 24
    for i, (d0, d1, val, name) in enumerate([
        (0, MODULE_BACK, "11", "front stack (lip 3·acrylic 2·mat 2.5·gap 2.5·panel 1)"),
        (MODULE_BACK, PLATE_INNER, "13", "cavity"),
        (PLATE_INNER, TOTAL, "3.6", "back plate (recessed)"),
        (0, TOTAL, "27.6", "frame depth / overall"),
    ]):
        dim_h(sv, X(d0), X(d1), yb + i * 22, f"{val}  {name}", above=False, size=10)
    return sv


def top():
    ox, oy = 150, 150
    sv = Svg(int(ox + OUTER_W * S + 120), int(oy + TOTAL * S + 200), "SECTION B-B  (top)",
             "scale 3 px/mm · cut through the stiles · dimensions mm")

    def X(x): return ox + (x + OUTER_W / 2) * S
    def Y(d): return oy + d * S

    def band(x0, x1, d0, d1, **kw):
        x0, x1 = sorted((x0, x1)); d0, d1 = sorted((d0, d1))
        sv.rect(X(x0), Y(d0), (x1 - x0) * S, (d1 - d0) * S, **kw)

    o, i1, i0, br = OUTER_W / 2, REB_STILE, OUTER_W / 2 - F, OUTER_W / 2 - BACK_LIP
    for sgn in (1, -1):
        sv.poly([(X(sgn * i0), Y(0)), (X(sgn * o), Y(0)), (X(sgn * o), Y(TOTAL)),
                 (X(sgn * br), Y(TOTAL)), (X(sgn * br), Y(PLATE_INNER)),
                 (X(sgn * i1), Y(PLATE_INNER)), (X(sgn * i1), Y(LIP)), (X(sgn * i0), Y(LIP))],
                sw=1.7)                                       # FRAME — one solid piece
        band(sgn * (PO_W / 2 - 8), sgn * (PO_W / 2), RING_FRONT + 3.6, PLATE_INNER, sw=0.8,
             color="#c9a227", fill="#fbf3d5")                                    # plate boss — same width as the ring
    band(-REB_STILE, REB_STILE, LIP, LIP + AC, sw=1.0, color=GLASS, fill="#eaf2fa")
    band(-REB_STILE, REB_STILE, LIP + AC, LIP + AC + MB, sw=1.0, color=MATC, fill="#f3ecdf")
    band(-PO_W / 2, PO_W / 2, MODULE_BACK - PT, MODULE_BACK, sw=1.0, color=PCB, fill="#eaf6ef")
    for sgn in (1, -1):
        band(sgn * MAT_W / 2, sgn * REB_STILE, LIP + AC + MB, MODULE_BACK - PT, sw=0.8, color="#b58b5a", fill="#f7f1e8")
    for sgn in (1, -1):  # foam gasket + backing ring — behind the panel edge only
        band(sgn * (PO_W / 2 - 8), sgn * PO_W / 2, MODULE_BACK, RING_FRONT, sw=0.6, color="#c8b6a0", fill="#faf7f2")
        band(sgn * (PO_W / 2 - 8), sgn * PO_W / 2, RING_FRONT, RING_FRONT + 3.6, sw=0.9, color="#8a8f98", fill="#eceff2")
    band(-br, br, PLATE_INNER, TOTAL, sw=1.4, fill="#f3f3f0")       # back plate — recessed, flush

    dim_h(sv, ox, ox + OUTER_W * S, oy - 70, "400", ext_y=oy)
    dim_h(sv, X(-OPEN_W / 2), X(OPEN_W / 2), oy - 42, f"{OPEN_W:g}  opening", ext_y=oy)
    dim_v(sv, oy, oy + TOTAL * S, ox + OUTER_W * S + 50, "27.6", ext_x=ox + OUTER_W * S, left=False)
    sv.text(ox + OUTER_W * S / 2, oy + TOTAL * S + 40, "frame = one solid piece, 27.6 deep · back plate recessed (flush)",
            size=10.5, color=INK)
    return sv


def main():
    print("Frame views written:")
    save(front(), "front.svg")
    save(side(), "side.svg")
    save(top(), "top.svg")
    save(back(), "back.svg")
    return 0


if __name__ == "__main__":
    sys.exit(main())
