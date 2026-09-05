#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
培养藏（spec 侧「改造祭坛」）—— 三卡。

身份已锁（`docs/design-notes/growth-console-identity.md`）：
**一具能装下人体的圆柱培养藏。舱里是冒泡的半透明液体。**

上一轮九张（操作件占空间）作废。人取卡 A 立缸继续优化，不翻生产。
对照课 `?lesson=growth-card`。

判据先写再画。禁止落成拱 / 钳 / 环。
"""
from __future__ import annotations

import json
import math
import os
import shutil
from collections import Counter, deque

from PIL import Image

# 卡 B / C 仍 32×36。卡 A 立缸 40×42（人点名加粗、压矮；宽仍大于净化器）。
W, H = 32, 36
SIZE_A = (40, 42)
SIZE_BC = (32, 36)
FRAMES = 8
FPS = 6
K = 0.55
GROUND = 28
CX = 16

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "cards"))
ANIM = os.path.join(OUT, "anim")
PREVIEW = os.path.join(OUT, "preview3x")
PUBLIC = os.path.normpath(
    os.path.join(HERE, "..", "..", "..", "..", "public", "assets", "sprites", "modules")
)
PALETTE_JSON = os.path.normpath(os.path.join(HERE, "..", "..", "palette.json"))
for d in (ANIM, PREVIEW, PUBLIC):
    os.makedirs(d, exist_ok=True)

VOID = (0x08, 0x0A, 0x0C, 255)
INK = (0x0D, 0x11, 0x14, 255)
SHADOW = (0x15, 0x1A, 0x1E, 255)
CLINIC = (0x1E, 0x22, 0x28, 255)
CONC_D = (0x2C, 0x2E, 0x33, 255)
CONC_M = (0x3A, 0x3D, 0x42, 255)
METAL = (0x4A, 0x4E, 0x55, 255)
METAL_L = (0x5A, 0x5F, 0x66, 255)
BONE = (0x3A, 0x38, 0x38, 255)
RUST = (0x5D, 0x48, 0x3E, 255)
EARTH = (0x50, 0x46, 0x3C, 255)
WOOD = (0x4F, 0x48, 0x35, 255)
WARM_D = (0x8A, 0x5C, 0x2A, 255)
TEAL_X = (0x0E, 0x4A, 0x3F, 255)
TEAL_D = (0x1A, 0x6B, 0x5C, 255)
TEAL_M = (0x1A, 0xAD, 0x96, 255)
TEAL_L = (0x2A, 0xE6, 0xC8, 255)

DARK_SET = {VOID[:3], INK[:3], SHADOW[:3]}

with open(PALETTE_JSON, "r", encoding="utf-8") as fh:
    PALETTE = {
        tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in json.load(fh)["colors"]
    }


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def is_teal(c):
    return c[1] > c[0] + 18 and c[2] > c[0] + 8


def is_warm(c):
    return c[:3] in {(0x8A, 0x5C, 0x2A), (0xC4, 0x87, 0x3A)}


def new(w=None, h=None):
    return Image.new("RGBA", (w or W, h or H), (0, 0, 0, 0))


def put(im, x, y, c):
    ww, hh = im.size
    xi, yi = int(round(x)), int(round(y))
    if 0 <= xi < ww and 0 <= yi < hh:
        im.putpixel((xi, yi), c)


def get(im, x, y):
    ww, hh = im.size
    if 0 <= x < ww and 0 <= y < hh:
        return im.getpixel((x, y))
    return (0, 0, 0, 0)


def hline(im, a, b, y, c):
    for x in range(int(min(a, b)), int(max(a, b)) + 1):
        put(im, x, y, c)


def line(im, x0, y0, x1, y1, c):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
    for i in range(n + 1):
        put(im, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c)


def fill_poly(im, pts, c):
    if len(pts) < 3:
        return
    ys = [p[1] for p in pts]
    n = len(pts)
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        xs = []
        for i in range(n):
            x0, y0 = pts[i]
            x1, y1 = pts[(i + 1) % n]
            if (y0 <= y < y1) or (y1 <= y < y0):
                xs.append(x0 + (y - y0) / (y1 - y0) * (x1 - x0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            hline(im, xs[i], xs[i + 1], y, c)


def iso(dx, dy):
    return (dx - dy) * 0.5, (dx + dy) * 0.5 * K


def iso_prism(im, fp, h, top_c, side_cs, z0=0.0, cx=CX, cyg=GROUND):
    proj = [iso(dx, dy) for dx, dy in fp]
    top = [(cx + sx, cyg - z0 - h + sy) for sx, sy in proj]
    bot = [(cx + sx, cyg - z0 + sy) for sx, sy in proj]
    n = len(fp)
    faces = {}
    for i in range(n):
        j = (i + 1) % n
        if (proj[i][1] + proj[j][1]) / 2 <= 0:
            continue
        quad = [top[i], top[j], bot[j], bot[i]]
        fill_poly(im, quad, side_cs[i % len(side_cs)])
        faces[i] = quad
    fill_poly(im, top, top_c)
    return top, bot, faces


def stain(im, x, y, c):
    if get(im, x, y)[3] >= 32:
        put(im, x, y, c)


def contact(im, rx=11, cx=CX, base=None):
    ww, hh = im.size
    if base is None:
        base = max((y for y in range(hh) for x in range(ww) if get(im, x, y)[3] >= 32),
                   default=GROUND)
    for dy, c in ((0, INK), (1, VOID)):
        y = base + 1 + dy
        r = rx * (1.0 - dy * 0.30)
        for x in range(int(cx - r), int(cx + r) + 1):
            if get(im, x, y)[3] >= 32:
                continue
            put(im, x, y, c)


def core_west_shadow(im, foot_cells, shift_x=-5):
    """核心在东。影子贴着缸底往西偏，不在缸下面另起一条悬空横杠。"""
    if not foot_cells:
        return
    for x, y in foot_cells:
        for dx, dy, c in (
            (shift_x, 0, INK),
            (shift_x - 1, 0, INK),
            (shift_x, 1, VOID),
            (shift_x - 2, 1, VOID),
            (shift_x - 1, 1, VOID),
        ):
            px, py = x + dx, y + dy
            if get(im, px, py)[3] >= 32:
                continue
            put(im, px, py, c)


def iso_disk(r):
    pts = []
    rr = r * r + 0.45
    for dy in range(-r - 1, r + 2):
        for dx in range(-r - 1, r + 2):
            if dx * dx + dy * dy <= rr:
                sx, sy = iso(dx, dy)
                pts.append((sx, sy, dx, dy))
    return pts


def upright_cylinder(im, cx, foot_y, r, height, top_c, left_c, right_c):
    """实心立缸。每一层都是完整圆盘，腔心稍后用液体覆盖，不许挖空。"""
    disk = iso_disk(r)
    body = []
    for z in range(height):
        for sx, sy, dx, dy in disk:
            x = int(round(cx + sx))
            y = int(round(foot_y - z + sy))
            c = left_c if sx < 0.3 else right_c
            put(im, x, y, c)
            body.append((x, y, dx, dy, z))
    top = []
    for sx, sy, dx, dy in disk:
        x = int(round(cx + sx))
        y = int(round(foot_y - height + sy))
        put(im, x, y, top_c)
        top.append((x, y, dx, dy))
    return body, top


def tube_horizontal(im, cx, foot_y, half_len, r, axis_z, top_c, left_c, right_c):
    """轴沿屏幕横，截面压扁。横棺用这个，避免 iso-dx 把管子画成又高又斜的一块。"""
    body = []
    rr = r * r + 0.45
    for t in range(-half_len, half_len + 1):
        for a in range(-r - 1, r + 2):
            for dz in range(-r - 1, r + 2):
                if a * a + dz * dz > rr:
                    continue
                x = cx + t
                y = int(round(foot_y - (axis_z + dz) + a * K))
                if dz >= r - 1.2:
                    c = top_c
                elif a < 0:
                    c = left_c
                else:
                    c = right_c
                put(im, x, y, c)
                body.append((x, y, t, a, dz))
    return body


def fill_liquid(im, cells, frame, seed, blob):
    """半透明：深浅分档 + 几格亮泡。暗团不对称。只改已有实体。"""
    live = set()
    cells = [(x, y) for x, y in cells if get(im, x, y)[3] >= 32]
    if not cells:
        return live
    ys = [y for _, y in cells]
    miny, maxy = min(ys), max(ys)
    span = max(1, maxy - miny)
    occ = set(cells)
    for x, y in cells:
        t = (y - miny) / span
        if t > 0.62:
            c = TEAL_X
        elif t > 0.32:
            c = TEAL_D
        else:
            c = TEAL_M
        if (x + y + seed) % 7 == 0 and t < 0.55:
            c = TEAL_X
        put(im, x, y, c)
    for i, (x, y) in enumerate(blob):
        if (x, y) in occ:
            put(im, x, y, TEAL_X)
            stain(im, x + 1, y + (i % 2), CLINIC)
    n_bub = 3
    for i in range(n_bub):
        idx = (seed * 13 + i * 17 + frame * 3) % len(cells)
        x, y = cells[idx]
        rise = int(round((frame / FRAMES) * span * 0.55 + i * 2))
        by = max(miny, y - (rise % (span + 1)))
        bx = x + (i % 3) - 1
        if (bx, by) in occ:
            put(im, bx, by, TEAL_L if i == 0 else TEAL_M)
            live.add((bx, by))
            if (bx, by + 1) in occ:
                put(im, bx, by + 1, TEAL_D)
                live.add((bx, by + 1))
    return live


def score_marks(im, spots):
    for x, y, c in spots:
        stain(im, x, y, c)


def foot_y(im):
    ww, hh = im.size
    ys = [y for y in range(hh) for x in range(ww) if get(im, x, y)[3] >= 32]
    return max(ys) if ys else GROUND


def enclosed_cells(im):
    ww, hh = im.size
    trans = {(x, y) for y in range(hh) for x in range(ww)
             if im.getpixel((x, y))[3] < 32}
    seen = set()
    q = deque()
    for x in range(ww):
        for y in (0, hh - 1):
            if (x, y) in trans:
                q.append((x, y))
                seen.add((x, y))
    for y in range(hh):
        for x in (0, ww - 1):
            if (x, y) in trans and (x, y) not in seen:
                q.append((x, y))
                seen.add((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in trans and n not in seen:
                seen.add(n)
                q.append(n)
    return trans - seen


# ---------------------------------------------------------------------
# 卡 A 立缸 —— 人能站进去。40×42。比细高版加粗、压矮。
# 中段整圈是舱液，约全高 70%。
# 主光源 = 核心（东 / 屏幕右）：右亮左暗；影子往西偏，缸贴地。
# ---------------------------------------------------------------------
def cardA(frame):
    wa, ha = SIZE_A
    im = new(wa, ha)
    cx, foot, radius, height = 21, 34, 16, 26
    # 核心在东：右面（sx>0）用亮金属，左面用暗混凝土。
    body, _top = upright_cylinder(
        im, cx, foot, radius, height,
        top_c=METAL_L, left_c=CONC_D, right_c=METAL,
    )
    glass_lo, glass_hi = 5, 19  # 15 / 26 ≈ 58% 的 z；屏幕舱液比另测
    hoop_side = 9
    rim2 = (radius - 1.15) ** 2
    glass_cells = []
    foot_cells = []
    for x, y, dx, dy, z in body:
        rad2 = dx * dx + dy * dy
        on_rim = rad2 >= rim2
        if z <= 3:
            foot_cells.append((x, y))
            if on_rim:
                put(im, x, y, METAL if dx >= 1 else CONC_D)
            else:
                put(im, x, y, INK if dx < -2 else (CONC_D if dx < 0 else METAL))
        elif glass_lo <= z <= glass_hi:
            # 中段整圈都是舱液。前脸不许留一圈金属当窗框。
            # 左右侧壁由后面「漏边收回」那一趟补上。
            glass_cells.append((x, y))
        elif z > glass_hi:
            put(im, x, y, METAL_L if dx >= 1 else CONC_D)
    blob = [
        (cx - 2, foot - 16), (cx, foot - 15), (cx - 3, foot - 12),
        (cx + 2, foot - 11), (cx + 1, foot - 8),
    ]
    live = fill_liquid(im, glass_cells, frame, 0xA01, blob)
    # 两道箍只缠在玻璃段的外壁，不切穿舱液。
    for z, c_r, c_l in ((10, METAL_L, CLINIC), (15, RUST, CONC_D)):
        for x, y, dx, dy, zz in body:
            # 箍只咬屏幕左右剪影。iso 里 |dx| 大会绕到画面正中。
            if zz == z and abs(x - cx) >= hoop_side:
                put(im, x, y, c_r if dx >= 1 else c_l)
    ww, hh = im.size
    for y in range(hh):
        for x in range(ww):
            if not is_teal(get(im, x, y)[:3]):
                continue
            if any(get(im, x + dx, y + dy)[3] < 32 for dx, dy in ((-1, 0), (1, 0), (0, 1))):
                put(im, x, y, METAL_L if x >= cx else CLINIC)
                live.discard((x, y))
    score_marks(im, [
        (cx - 10, foot - 6, RUST), (cx - 11, foot - 5, EARTH),
        (cx + 9, foot - 20, EARTH), (cx + 10, foot - 19, WOOD),
        (cx - 8, foot - 22, RUST),
    ])
    # 东侧棱上一格暖灯：玩家走近时的补光指示，不是第二套影子。
    for x, y, dx, dy, z in body:
        if z == height - 2 and dx >= 8 and abs(dy) <= 3:
            stain(im, x, y, WARM_D)
            break
    max_foot = max((y for _, y in foot_cells), default=foot)
    ground_foot = [(x, y) for x, y in foot_cells if y >= max_foot - 1]
    core_west_shadow(im, ground_foot, shift_x=-6)
    # 西侧内部背光（核心在东）。只改四邻都实心的格，不上外沿。
    occ_fill = {
        (x, y) for y in range(hh) for x in range(ww) if get(im, x, y)[3] >= 32
    }
    for y in range(hh):
        for x in range(ww):
            if x >= cx - 3:
                continue
            if y < foot - 10:
                continue
            if (x, y) not in occ_fill:
                continue
            if is_teal(get(im, x, y)[:3]) or is_warm(get(im, x, y)[:3]):
                continue
            if any((x + dx, y + dy) not in occ_fill for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                continue
            put(im, x, y, SHADOW)
    # 顶椭圆最上一行不要尖成两颗点。
    ys_top = [y for y in range(hh) for x in range(ww) if get(im, x, y)[3] >= 32]
    if ys_top:
        y_top = min(ys_top)
        xs = [x for x in range(ww) if get(im, x, y_top)[3] >= 32]
        if xs and max(xs) - min(xs) + 1 <= 6:
            for x in range(min(xs), max(xs) + 1):
                if get(im, x, y_top)[3] < 32:
                    put(im, x, y_top, METAL_L)
    # 近黑只许留在最底接地行。西侧脚上若露出 INK，收回成混凝土。
    occ_now = {
        (x, y) for y in range(hh) for x in range(ww) if get(im, x, y)[3] >= 32
    }
    max_opaque = max((y for _, y in occ_now), default=foot)
    for y in range(hh):
        for x in range(ww):
            if get(im, x, y)[:3] not in DARK_SET:
                continue
            if y >= max_opaque - 2:
                continue
            if any((x + dx, y + dy) not in occ_now for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                put(im, x, y, CONC_D)
    # 最底一行不许剩两颗金属点当小脚。
    for x in range(ww):
        c = get(im, x, max_opaque)[:3]
        if get(im, x, max_opaque)[3] < 32 or c in DARK_SET:
            continue
        if get(im, x, max_opaque - 1)[3] < 32:
            put(im, x, max_opaque, VOID)
    return im, live


# ---------------------------------------------------------------------
# 卡 B 横棺 —— 人能躺进去。一只槽托住一根管，不要两只脚。
# ---------------------------------------------------------------------
def cardB(frame):
    im = new()
    iso_prism(im, [(-8.5, -4.2), (8.5, -4.2), (8.5, 4.4), (-8.5, 4.4)], 4,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D], cx=16)
    body = tube_horizontal(
        im, 16, 27, half_len=11, r=4, axis_z=7,
        top_c=METAL_L, left_c=METAL, right_c=CONC_M,
    )
    for x, y, t, a, dz in body:
        if t in (-5, 6) and abs(dz) >= 2:
            put(im, x, y, METAL_L if dz > 0 else RUST)
    window = []
    for x, y, t, a, dz in body:
        # 侧窗是沿管的椭圆，不要整条亮矩形（会读成屏幕）。
        if a >= 1 and (t / 7.2) ** 2 + ((dz - 0.3) / 2.0) ** 2 <= 1.0:
            window.append((x, y))
    blob = [(12, 20), (13, 20), (14, 21), (15, 20), (16, 21), (13, 22)]
    live = fill_liquid(im, window, frame, 0xB02, blob)
    for y in range(H):
        for x in range(W):
            if not is_teal(get(im, x, y)[:3]):
                continue
            if any(get(im, x + dx, y + dy)[3] < 32 for dx, dy in ((-1, 0), (1, 0), (0, 1))):
                put(im, x, y, METAL)
                live.discard((x, y))
    score_marks(im, [
        (24, 15, RUST), (25, 16, EARTH), (23, 17, RUST),
        (7, 14, WOOD), (8, 15, EARTH),
    ])
    stain(im, 11, 13, WARM_D)
    for x, y in ((10, 14), (11, 13), (12, 14), (20, 14)):
        if get(im, x, y)[3] >= 32 and not is_teal(get(im, x, y)[:3]):
            stain(im, x, y, WARM_D)
            break
    contact(im, 9, cx=16)
    return im, live


# ---------------------------------------------------------------------
# 卡 C 沉井 —— 人往下沉。圆井口，不要方台、不要爪。
# ---------------------------------------------------------------------
def cardC(frame):
    im = new()
    body, top = upright_cylinder(
        im, 16, 27, r=10, height=4,
        top_c=METAL, left_c=CONC_D, right_c=CLINIC,
    )
    window = []
    for x, y, dx, dy in top:
        if dx * dx + dy * dy <= 6.6 * 6.6:
            window.append((x, y))
        else:
            put(im, x, y, METAL_L if dy < 0 else METAL)
    blob = [(15, 24), (16, 25), (17, 24), (14, 25), (16, 23)]
    live = fill_liquid(im, window, frame, 0xC03, blob)
    score_marks(im, [
        (10, 21, RUST), (11, 20, EARTH), (22, 22, WOOD),
        (20, 20, RUST), (13, 19, EARTH),
    ])
    for x, y in ((21, 22), (20, 21), (19, 20)):
        if get(im, x, y)[3] >= 32 and not is_teal(get(im, x, y)[:3]):
            stain(im, x, y, WARM_D)
            break
    contact(im, 8, cx=16)
    return im, live


# =====================================================================
# 闸门
# =====================================================================
def teal_components(cells):
    occ = set(cells)
    seen = set()
    sizes = []
    for start in cells:
        if start in seen:
            continue
        q = deque([start])
        seen.add(start)
        n = 0
        while q:
            x, y = q.popleft()
            n += 1
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                p = (x + dx, y + dy)
                if p in occ and p not in seen:
                    seen.add(p)
                    q.append(p)
        sizes.append(n)
    return sorted(sizes, reverse=True)


def has_screen(im, teal_cells):
    """孤立的亮矩形 = 屏幕。培养液是一大团，放过。"""
    ww, hh = im.size
    teal_set = set(teal_cells)
    if len(teal_set) >= 16:
        return False
    for y in range(0, int(hh * 0.48) - 2):
        for x in range(0, ww - 3):
            block = [(x + dx, y + dy) for dy in range(3) for dx in range(4)]
            cols = [get(im, px, py)[:3] for px, py in block]
            if any(get(im, px, py)[3] < 32 for px, py in block):
                continue
            if all(is_teal(c) or is_warm(c) for c in cols):
                return True
    return False


def audit(name, frames, live, form):
    im = frames[0]
    ww, hh = im.size
    pix = [
        (x, y, im.getpixel((x, y))[:3])
        for y in range(hh)
        for x in range(ww)
        if im.getpixel((x, y))[3] >= 32
    ]
    occ = {(x, y) for x, y, _ in pix}
    body = [c for _, _, c in pix if not is_teal(c)]
    maxy = max(y for _, y, _ in pix)

    changed = set()
    for f in frames[1:]:
        for y in range(hh):
            for x in range(ww):
                if f.getpixel((x, y)) != im.getpixel((x, y)):
                    changed.add((x, y))
    stray = sorted(changed - live)

    teal_cells = [(x, y) for x, y, c in pix if is_teal(c)]
    teal_side = [
        (x, y) for x, y in teal_cells
        if any((x + dx, y + dy) not in occ for dx, dy in ((-1, 0), (1, 0), (0, 1)))
    ]
    comps = teal_components(teal_cells)
    biggest = comps[0] if comps else 0
    enclosed = enclosed_cells(im)

    sil = [
        (x, y, c) for x, y, c in pix
        if any((x + dx, y + dy) not in occ for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    ]
    sil_up = [(x, y, c) for x, y, c in sil if y < maxy - 2 and not is_teal(c)]
    interior = [
        c for x, y, c in pix
        if not is_teal(c)
        and all((x + dx, y + dy) in occ for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    ]
    med = sorted(lum(c) for c in interior)[len(interior) // 2] if interior else 0
    dom, dom_n = Counter(c for _, _, c in sil_up).most_common(1)[0] if sil_up else ((0, 0, 0), 0)
    dark_edge_share = 100 * sum(1 for _, _, c in sil_up if lum(c) < 40.0) / max(1, len(sil_up))
    dark_on_sil = [(x, y) for x, y, c in sil_up if c in DARK_SET]

    mat = [(x, y) for x, y, c in pix if not is_teal(c)]
    miny = min(y for _, y in mat) if mat else 0
    top_row_w = len([1 for x, y in mat if y == miny])
    lefts, rights = [], []
    for y in range(miny, maxy - 2):
        row = [x for x, yy in mat if yy == y]
        if row:
            lefts.append(min(row))
            rights.append(max(row))
    slant = max(max(lefts) - min(lefts), max(rights) - min(rights)) if lefts else 0

    off = [c for _, _, c in pix if c not in PALETTE]
    tiers = [(c, n) for c, n in Counter(body).most_common() if 100 * n / max(1, len(body)) >= 8.0]
    top_body, top_n = Counter(body).most_common(1)[0] if body else ((0, 0, 0), 0)
    teal_share = 100 * len(teal_cells) / max(1, len(pix))
    dark_share = 100 * sum(1 for c in body if lum(c) <= 30) / max(1, len(body))
    bright_share = 100 * sum(1 for c in body if lum(c) >= 70) / max(1, len(body))
    warm_n = sum(1 for c in body if is_warm(c))
    blob_share = 100 * biggest / max(1, len(teal_cells))
    teal_lo, teal_hi = (16.0, 58.0) if form == "立缸" else (8.0, 40.0)

    teal_ys = [y for x, y in teal_cells]
    obj_ys = [y for x, y, c in pix if lum(c) > 18]
    glass_h = (max(teal_ys) - min(teal_ys) + 1) if teal_ys else 0
    obj_h = (max(obj_ys) - min(obj_ys) + 1) if obj_ys else 1
    glass_ratio = glass_h / obj_h

    # 立缸「不压全身」= 顶盖和缸底仍是材质。面积帽会和「中段整圈 70%」打架。
    if obj_ys:
        y0, y1 = min(obj_ys), max(obj_ys)
        band = 0.14 * (y1 - y0)
        top_cut = y0 + band
        bot_cut = y1 - band

        def _band_teal(lo, hi):
            cells = [
                c for x, y, c in pix
                if lo <= y <= hi and lum(c) > 18
            ]
            if not cells:
                return 0.0
            return 100 * sum(1 for c in cells if is_teal(c)) / len(cells)

        top_teal_share = _band_teal(y0, top_cut)
        bot_teal_share = _band_teal(bot_cut, y1)
    else:
        top_teal_share = bot_teal_share = 100.0
    ends_metal = top_teal_share < 22.0 and bot_teal_share < 22.0

    if form == "横卧":
        top_ok = 8 <= top_row_w <= 26
        top_label = "横管顶是一条长脊（顶行 8–26）"
    elif form == "立缸":
        top_ok = 3 <= top_row_w <= 16
        top_label = "圆柱顶是椭圆（顶行 3–16，不是立墙）"
    else:
        top_ok = 3 <= top_row_w <= 12
        top_label = "圆柱顶是椭圆（顶行 3–12，不是立墙）"

    max_body = max(obj_ys) if obj_ys else maxy
    float_gap = any(
        not any((x, y) in occ for x in range(ww))
        for y in range(max_body + 1, maxy)
    )
    shadow_px = [(x, y) for x, y, c in pix if c in DARK_SET]
    body_xy = [(x, y) for x, y, c in pix if lum(c) > 18]
    if shadow_px and body_xy:
        sh_cx = sum(x for x, _ in shadow_px) / len(shadow_px)
        bd_cx = sum(x for x, _ in body_xy) / len(body_xy)
        shadow_west = sh_cx < bd_cx - 0.3
    else:
        sh_cx, bd_cx, shadow_west = 0.0, 0.0, False
    xs_body = [x for x, y, c in pix if not is_teal(c) and lum(c) > 18]
    if obj_ys and xs_body:
        y_band0 = min(obj_ys) + int(obj_h * 0.28)
        y_band1 = min(obj_ys) + int(obj_h * 0.72)
        x0b, x1b = min(xs_body), max(xs_body)
        span = max(1, x1b - x0b)
        left_lums = [
            lum(c) for x, y, c in pix
            if not is_teal(c) and lum(c) > 18
            and y_band0 <= y <= y_band1 and x <= x0b + span * 0.38
        ]
        right_lums = [
            lum(c) for x, y, c in pix
            if not is_teal(c) and lum(c) > 18
            and y_band0 <= y <= y_band1 and x >= x1b - span * 0.38
        ]
        left_med = sorted(left_lums)[len(left_lums) // 2] if left_lums else 0
        right_med = sorted(right_lums)[len(right_lums) // 2] if right_lums else 0
    else:
        left_med = right_med = 0
    lit_east = right_med > left_med + 4.0

    checks = [
        ("色全在锁定色板", not off, f"off-palette={len(off)}"),
        ("变化只在声明的活层里", not stray, f"stray={len(stray)} {stray[:6]}"),
        ("单一主体色 < 45%", 100 * top_n / max(1, len(body)) < 45.0,
         f"{top_body} {100 * top_n / max(1, len(body)):.1f}%"),
        ("材质层 >= 3 档各 >= 8%", len(tiers) >= 3, f"tiers={len(tiers)}"),
        (
            "对混凝土有黑有亮",
            min((lum(c) for c in body), default=99) <= 26.0
            and max((lum(c) for c in body), default=0) >= 70.0
            and dark_share >= 8.0 and bright_share >= 6.0,
            f"dark={dark_share:.0f}% bright={bright_share:.0f}%",
        ),
        (f"舱液够成一团（≥ {teal_lo:.0f}%）", teal_share >= teal_lo, f"{teal_share:.1f}%"),
        (
            "顶盖与缸底仍是材质（两端舱液 < 22%）"
            if form == "立缸"
            else f"舱液不压全身 < {teal_hi:.0f}%",
            ends_metal if form == "立缸" else teal_share < teal_hi,
            f"top={top_teal_share:.0f}% bot={bot_teal_share:.0f}%"
            if form == "立缸"
            else f"{teal_share:.1f}%",
        ),
        ("舱液是一大团（最大块 ≥ 70%）", blob_share >= 70.0,
         f"blob={blob_share:.0f}% n={len(comps)}"),
        ("腔心填满（enclosed = 0）", len(enclosed) == 0, f"enclosed={len(enclosed)}"),
        ("青绿不从左右下沿漏到背景", not teal_side, f"side={teal_side[:4]}"),
        ("暖色指示 <= 3 格", warm_n <= 3, f"warm={warm_n}"),
        ("没有孤立亮矩形屏幕", not has_screen(im, teal_cells), "screen"),
        ("舱液确实在动", len(changed) >= 2, f"changed={len(changed)}"),
        (
            "外沿不半数压在暗档（< CONC_D 46）",
            dark_edge_share < 45.0,
            f"暗档外沿={dark_edge_share:.0f}% 众数={dom} lum={lum(dom):.1f} "
            f"share={100 * dom_n / max(1, len(sil_up)):.0f}% med={med:.1f}",
        ),
        ("近黑三色不上外沿（接地 3 行除外）", not dark_on_sil, f"n={len(dark_on_sil)} {dark_on_sil[:3]}"),
        (top_label, top_ok, f"top_row_w={top_row_w}"),
        ("45° 外缘不竖直（斜量 >= 3）", slant >= 3, f"slant={slant}"),
    ]
    if form == "立缸":
        checks.extend([
            ("舱液中段约占全高 70%（62–78%）", 0.62 <= glass_ratio <= 0.78,
             f"glass/obj={glass_ratio:.2f} ({glass_h}/{obj_h})"),
            ("缸贴地：本体与影子之间没有空行", not float_gap,
             f"body_max={max_body} opaque_max={maxy}"),
            ("接地影重心在缸西侧（核心在东）", shadow_west,
             f"shadow_cx={sh_cx:.1f} body_cx={bd_cx:.1f}"),
            ("右面亮过左面（核心从东打）", lit_east,
             f"right={right_med:.1f} left={left_med:.1f}"),
        ])
    ok = all(c[1] for c in checks)
    print(f"\n[{name}] opaque={len(pix)} body={len(body)} teal={len(teal_cells)}")
    for label, good, msg in checks:
        print(f"   {'OK ' if good else 'BAD'} {label}: {msg}")
    print("   body mix: " + ", ".join(
        f"{c}={100 * n / max(1, len(body)):.0f}%" for c, n in Counter(body).most_common(6)))
    return ok


def _x_runs(occ, y, x0, x1):
    xs = sorted(x for x, yy in occ if yy == y and x0 <= x <= x1)
    if not xs:
        return 0, []
    segs, a, prev = [], xs[0], xs[0]
    for x in xs[1:]:
        if x > prev + 1:
            segs.append((a, prev))
            a = x
        prev = x
    segs.append((a, prev))
    return len(segs), segs


def form_fingerprint(im):
    ww, hh = im.size
    px = [(x, y, im.getpixel((x, y))) for y in range(hh) for x in range(ww)
          if im.getpixel((x, y))[3] >= 32]
    maxy = max(y for _, y, _ in px)
    body = [(x, y) for x, y, c in px if y < maxy - 1 and lum(c[:3]) > 18]
    occ = set(body)
    xs = [x for x, _ in body]
    ys = [y for _, y in body]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    mid = (y0 + y1) / 2
    up = [x for x, y in body if y < mid]
    lo = [x for x, y in body if y >= mid]
    aspect = w / h
    shear = (sum(up) / len(up) - sum(lo) / len(lo)) / w
    rise = h / float(hh)

    y_mid = y0 + h // 2
    mid_runs, mid_segs = _x_runs(occ, y_mid, x0, x1)
    top3 = [_x_runs(occ, y, x0, x1)[0] for y in range(y0, min(y1, y0 + 2) + 1)]
    apex_two = sum(1 for r in top3 if r >= 2)

    trans = {(x, y) for y in range(hh) for x in range(ww)
             if im.getpixel((x, y))[3] < 32}
    seen = set()
    q = deque()
    for x in range(ww):
        for y in (0, hh - 1):
            if (x, y) in trans:
                q.append((x, y))
                seen.add((x, y))
    for y in range(hh):
        for x in (0, ww - 1):
            if (x, y) in trans and (x, y) not in seen:
                q.append((x, y))
                seen.add((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in trans and n not in seen:
                seen.add(n)
                q.append(n)
    enclosed_list = [(x, y) for x, y in (trans - seen) if x0 <= x <= x1 and y0 <= y <= y1]
    enclosed = len(enclosed_list)

    left_xs = range(x0, x0 + max(1, w // 3) + 1)
    right_xs = range(x1 - max(1, w // 3), x1 + 1)

    def avg_top(xr):
        vals = []
        for x in xr:
            col = [y for xx, y in body if xx == x]
            if col:
                vals.append(min(col))
        return sum(vals) / len(vals) if vals else 0.0

    slope = abs(avg_top(left_xs) - avg_top(right_xs)) / h

    arch_open = False
    if mid_runs >= 2:
        gx0, gx1 = mid_segs[0][1] + 1, mid_segs[1][0] - 1
        if gx0 <= gx1:
            gap_ok = True
            for y in range(y_mid, y1 + 1):
                if not any((x, y) not in occ for x in range(gx0, gx1 + 1)):
                    gap_ok = False
                    break
            yb = min(hh - 1, y1 + 1)
            below = any((x, yb) not in occ for x in range(gx0, gx1 + 1))
            arch_open = gap_ok and below

    return {
        "aspect": aspect, "shear": shear, "slope": slope, "rise": rise,
        "mid_runs": mid_runs, "apex_two": apex_two,
        "enclosed": enclosed, "arch_open": arch_open,
    }


# 判据先写。立缸 / 横卧 / 沉井互斥。拱 / 钳 / 环沿用供奉台定义，本台必须全红。
FORM_BANDS = {
    "立缸": lambda fp: (
        fp["aspect"] <= 0.78 and fp["rise"] >= 0.55 and fp["enclosed"] == 0
        and fp["apex_two"] < 2 and fp["mid_runs"] == 1
    ),
    "横卧": lambda fp: (
        0.90 <= fp["aspect"] <= 1.70 and 0.40 <= fp["rise"] < 0.55
        and fp["enclosed"] == 0 and fp["apex_two"] < 2
    ),
    "沉井": lambda fp: (
        fp["aspect"] >= 1.15 and fp["rise"] < 0.40 and fp["enclosed"] == 0
        and fp["apex_two"] < 2
    ),
    "拱": lambda fp: (
        fp["mid_runs"] >= 2 and fp["enclosed"] == 0
        and fp["arch_open"] and fp["apex_two"] == 0
    ),
    "钳": lambda fp: fp["apex_two"] >= 2 and fp["enclosed"] == 0,
    "环": lambda fp: fp["enclosed"] >= 20 and fp["mid_runs"] >= 2,
}


def ascii_art(im):
    ww, hh = im.size
    rows = []
    for y in range(hh):
        row = ""
        for x in range(ww):
            p = im.getpixel((x, y))
            if p[3] < 32:
                row += "."
            elif is_teal(p[:3]):
                row += "T"
            elif is_warm(p[:3]):
                row += "w"
            elif p[:3] in (RUST[:3], EARTH[:3], BONE[:3], WOOD[:3]):
                row += "m"
            elif lum(p[:3]) >= 70:
                row += "@"
            elif lum(p[:3]) >= 40:
                row += "#"
            elif lum(p[:3]) >= 22:
                row += "+"
            else:
                row += "-"
        rows.append(row)
    return "\n".join(rows)


def canvas_mask(im, tw=32, th=36):
    """画布对齐的占用，不按包围盒拉伸。包围盒归一化会让任何居中实心块 IoU 都很高。"""
    src = im.convert("RGBA")
    canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    sw, sh = src.size
    ox = (tw - sw) // 2
    oy = th - sh
    canvas.paste(src, (ox, oy), src)
    out = []
    for y in range(th):
        for x in range(tw):
            p = canvas.getpixel((x, y))
            out.append(1 if p[3] >= 32 and lum(p[:3]) > 18 else 0)
    return out


def iou(a, b):
    inter = sum(x and y for x, y in zip(a, b))
    union = sum(x or y for x, y in zip(a, b))
    return inter / union if union else 0.0


def load_offering_masks():
    masks = {}
    for key in ("g", "h", "i"):
        path = os.path.join(PUBLIC, f"offering-{key}-sheet.png")
        src = Image.open(path).convert("RGBA")
        frame = src.crop((0, 0, 32, 32))
        masks[key] = canvas_mask(frame)
    return masks


CARDS = (
    ("a", "立缸", cardA, "立缸"),
    ("b", "横棺", cardB, "横卧"),
    ("c", "沉井", cardC, "沉井"),
)

all_ok = True
FINGERPRINTS = []
FIRST_FRAMES = {}


def emit_card(key, label, fn, form):
    global all_ok
    name = f"growth-{key}"
    pairs = [fn(f) for f in range(FRAMES)]
    frames = [p[0] for p in pairs]
    live = set()
    for _, lv in pairs:
        live |= lv
    all_ok &= audit(f"卡 {key.upper()} {label}", frames, live, form)
    fw, fh = frames[0].size
    sheet = Image.new("RGBA", (fw * FRAMES, fh), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * fw, 0))
    frames[0].save(os.path.join(ANIM, f"{name}.png"))
    sheet_path = os.path.join(ANIM, f"{name}-sheet.png")
    sheet.save(sheet_path)
    frames[0].resize((fw * 3, fh * 3), Image.NEAREST).save(
        os.path.join(PREVIEW, f"{name}-3x.png"))
    frames[0].convert("RGB").save(
        os.path.join(ANIM, f"{name}.gif"), save_all=True,
        append_images=[f.convert("RGB") for f in frames[1:]],
        duration=int(1000 / FPS), loop=0)
    with open(os.path.join(ANIM, f"{name}.json"), "w", encoding="utf-8") as meta:
        json.dump({"name": name, "label": label, "frameWidth": fw, "frameHeight": fh,
                   "frames": FRAMES, "fps": FPS, "camera": "45deg isometric",
                   "form": form}, meta, ensure_ascii=False, indent=2)
    shutil.copyfile(sheet_path, os.path.join(PUBLIC, f"{name}-sheet.png"))
    FINGERPRINTS.append((key, label, form, form_fingerprint(frames[0])))
    FIRST_FRAMES[key] = frames[0]


for key, label, fn, form in CARDS:
    emit_card(key, label, fn, form)

print("\n[形体类] 声明的方向必须在数值上真的成立")
for key, label, form, fp in FINGERPRINTS:
    good = FORM_BANDS[form](fp)
    all_ok &= good
    print(
        f"   {'OK ' if good else 'BAD'} 卡 {key.upper()} {label} 声明「{form}」: "
        f"aspect={fp['aspect']:.2f} rise={fp['rise']:.2f} shear={fp['shear']:+.3f} "
        f"slope={fp['slope']:.2f} mid_runs={fp['mid_runs']} apex_two={fp['apex_two']} "
        f"enclosed={fp['enclosed']} arch_open={fp['arch_open']}"
    )

_forms = {f for _, _, f, _ in FINGERPRINTS}
print(f"   覆盖到的形体类：{len(_forms)} / 3 —— {'、'.join(sorted(_forms))}")
if len(_forms) != len(CARDS):
    all_ok = False
    print("   BAD 有两张卡塌进同一类")

print("   每张只准命中自己的类")
for key, label, form, fp in FINGERPRINTS:
    hits = [n for n in ("立缸", "横卧", "沉井") if FORM_BANDS[n](fp)]
    good = hits == [form]
    all_ok &= good
    print(f"   {'OK ' if good else 'BAD'} 卡 {key.upper()} 命中 {hits}（声明 {form}）")

fp_by = {k: fp for k, _, _, fp in FINGERPRINTS}
print("\n[禁供奉台开口三类]")
for key, label, _form, fp in FINGERPRINTS:
    hit = [name for name in ("拱", "钳", "环") if FORM_BANDS[name](fp)]
    if hit:
        all_ok = False
        print(f"   BAD 卡 {key.upper()} {label} 撞上 {hit}")
    else:
        print(f"   OK  卡 {key.upper()} {label} 不是拱 / 钳 / 环")

print("\n[谎称测试]")
if FORM_BANDS["沉井"](fp_by["a"]):
    all_ok = False
    print("   BAD 卡 A 当成沉井居然绿了")
else:
    print("   OK  卡 A 当成沉井是红的")
if FORM_BANDS["立缸"](fp_by["b"]):
    all_ok = False
    print("   BAD 卡 B 当成立缸居然绿了")
else:
    print("   OK  卡 B 当成立缸是红的")
if FORM_BANDS["横卧"](fp_by["c"]):
    all_ok = False
    print("   BAD 卡 C 当成横卧居然绿了")
else:
    print("   OK  卡 C 当成横卧是红的")

print("\n[对供奉台 G/H/I 画布占用 IoU（备注，不作为闸门）]")
offer = load_offering_masks()
for key, label, _form, _fp in FINGERPRINTS:
    mask = canvas_mask(FIRST_FRAMES[key])
    for ok_key, om in offer.items():
        v = iou(mask, om)
        print(f"   卡 {key.upper()} vs 供奉台 {ok_key.upper()}: IoU={v:.3f}")

S = 4
PAD = 10
COLS = 3
cell_w, cell_h = 40 * S, 56 * S
cw = (cell_w + PAD) * COLS + PAD
ch = cell_h + PAD * 2
board = Image.new("RGB", (cw, ch), CONC_M[:3])
for y in range(ch):
    for x in range(cw):
        if ((x // (S * 4)) + (y // (S * 4))) % 2 == 0:
            board.putpixel((x, y), CONC_D[:3])
for i, (key, label, fn, _fm) in enumerate(CARDS):
    src = fn(0)[0]
    scale = min(cell_w / src.size[0], cell_h / src.size[1])
    nw, nh = int(src.size[0] * scale), int(src.size[1] * scale)
    card = src.resize((nw, nh), Image.NEAREST)
    ox = PAD + i * (cell_w + PAD) + (cell_w - nw) // 2
    oy = PAD + (cell_h - nh)
    board.paste(card, (ox, oy), card)
board.save(os.path.join(ANIM, "growth-contact.png"))

if os.environ.get("SHOW_ASCII"):
    for key, label, fn, _fm in CARDS:
        print(f"\n=== 卡 {key.upper()} {label} ===")
        print(ascii_art(fn(0)[0]))

print("\n机械层" + ("全绿" if all_ok else "有 BAD，未过"))
raise SystemExit(0 if all_ok else 1)
