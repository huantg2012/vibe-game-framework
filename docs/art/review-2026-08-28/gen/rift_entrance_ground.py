#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
裂隙入口 —— 地面贴花

人 2026-09-04 推翻了「墙上的伤」那一整路：入口在**地面上**，不在墙上。
人留下卡 4 与卡 5（卡 6 囚笼落选，已整支删除），并定生产默认 = 卡 4（DEC-113）。

本批额外抽三个**占场地方式不同**的地面伤口，只进对照课，不翻生产默认：

  卡 4 地缝   地面上一道中间粗两边细的裂缝  → **生产默认（DEC-113）**
  卡 5 击裂   由中心点向周围辐射的裂缝，像钢化玻璃受击  → 留作对照
  卡 7 错位   两块混凝土板滑开，伤口是中间一条台阶状暗缝
  卡 8 掀皮   一块混凝土被掀起，伤口是新月形暗口
  卡 9 网裂   一片场地龟裂成网，没有主缝、没有受击点

编号跳过 6，不复活囚笼。人未抽不结案、不改 DEC-113。

人另已明令：**不需要显式呈现「裂隙那边是什么」。** 所以缝里只有深与青绿的丝，
不画别处的地板、砖、木——那等于承诺目的地，与「去向不可选」冲突。

身份锁：`docs/design-notes/rift-entrance-identity.md`「伤口渗漏，不是门」。
参考只取：世界背景、当前净化点、裂隙内部、已敲定的三台交互物与玩家画法。

相机：**地面平面内**（与净化点混凝土地面同一平面，顶视）。地面上的缝只能画在
地面平面里；按向下俯视 10° 画会被压成几乎看不见。已锁三台装置仍是 45° 等距，
本批不动它们。接线上这些都是地面贴花：锚点取中心，层压在地板之上、玩家之下。

画布 40×56、8 帧、6fps。落地底 = 净化点混凝土（主色明度 60.7 / 暗部 46.0），
所以缝要够黑、断口要够亮。

活层只有缝里的青绿；缝、断口、崩渣、板块逐帧钉死。变化只许落在声明的活层区域里。
"""
from __future__ import annotations

import json
import math
import os
import random
import shutil
from collections import Counter

from PIL import Image

W, H = 40, 56
FRAMES = 8
FPS = 6
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

# —— 锁定色板（名字跟 art-direction §2.2）——
VOID = (0x08, 0x0A, 0x0C, 255)        # void-black      缝的最深处
INK = (0x0D, 0x11, 0x14, 255)         # ambient-black   缝中段
SHADOW = (0x15, 0x1A, 0x1E, 255)      # shadow-grey     缝口
CLINIC = (0x1E, 0x22, 0x28, 255)      # frag-clinic     缝沿阴影
CONC_D = (0x2C, 0x2E, 0x33, 255)      # concrete-dark   地面暗部
CONC_M = (0x3A, 0x3D, 0x42, 255)      # concrete-mid    地面主色
METAL = (0x4A, 0x4E, 0x55, 255)       # metal-grey      新断口
METAL_L = (0x5A, 0x5F, 0x66, 255)     # metal-light     断口受光棱
BONE = (0x3A, 0x38, 0x38, 255)        # bone-grey
EARTH = (0x50, 0x46, 0x3C, 255)       # debris-earth    翻出来的土
RUST = (0x5D, 0x48, 0x3E, 255)        # debris-rust     锈桩
TEAL_X = (0x0E, 0x4A, 0x3F, 255)
TEAL_D = (0x1A, 0x6B, 0x5C, 255)
TEAL_M = (0x1A, 0xAD, 0x96, 255)
TEAL_L = (0x2A, 0xE6, 0xC8, 255)

TEAL_RAMP = (TEAL_X, TEAL_X, TEAL_D, TEAL_M, TEAL_L, TEAL_M, TEAL_D, TEAL_X)
# 缝里那条丝：主体压在最暗两档，只有几格在走。整条铺亮就是霓虹
C4_THREAD = (
    TEAL_X, TEAL_X, TEAL_X, TEAL_D, TEAL_X, TEAL_X, TEAL_D, TEAL_M,
    TEAL_L, TEAL_M, TEAL_D, TEAL_X, TEAL_X, TEAL_D, TEAL_X, TEAL_X,
)
DARK_SET = {VOID[:3], INK[:3], SHADOW[:3]}
# 落地底：净化点混凝土。地面主色 60.7 / 暗部 46.0，所以缝要够黑、断口要够亮
FLOOR_MAIN_LUM = 60.7

with open(PALETTE_JSON, "r", encoding="utf-8") as fh:
    PALETTE = {
        tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in json.load(fh)["colors"]
    }


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def is_teal(c):
    return c[1] > c[0] + 18 and c[2] > c[0] + 8


def new():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def put(im, x, y, c):
    xi, yi = int(round(x)), int(round(y))
    if 0 <= xi < W and 0 <= yi < H:
        im.putpixel((xi, yi), c)


def get(im, x, y):
    if 0 <= x < W and 0 <= y < H:
        return im.getpixel((x, y))
    return (0, 0, 0, 0)


def hline(im, a, b, y, c):
    for x in range(int(min(a, b)), int(max(a, b)) + 1):
        put(im, x, y, c)


def vline(im, x, a, b, c):
    for y in range(int(min(a, b)), int(max(a, b)) + 1):
        put(im, x, y, c)


def line(im, x0, y0, x1, y1, c):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
    for i in range(n + 1):
        put(im, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c)


def gap_color(t):
    """t = 离缝心的归一化距离（0 心、1 缝口）。深→浅，做出「有厚度」。"""
    if t < 0.34:
        return VOID
    if t < 0.68:
        return INK
    return SHADOW


def _dist_seg(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    l2 = vx * vx + vy * vy
    if l2 < 1e-9:
        return math.hypot(px - ax, py - ay), 0.0, 0.0
    t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / l2))
    qx, qy = ax + t * vx, ay + t * vy
    cross = vx * (py - ay) - vy * (px - ax)
    sign = 1.0 if cross >= 0 else -1.0
    return math.hypot(px - qx, py - qy), t, sign


def _dist_poly(px, py, poly):
    best = 1e9
    best_s = 1.0
    best_t = 0.0
    total = 0.0
    segs = []
    for i in range(len(poly) - 1):
        ax, ay = poly[i]
        bx, by = poly[i + 1]
        length = math.hypot(bx - ax, by - ay) or 1e-9
        segs.append((ax, ay, bx, by, length, total))
        total += length
    for ax, ay, bx, by, length, start in segs:
        d, t, s = _dist_seg(px, py, ax, ay, bx, by)
        if d < best:
            best = d
            best_s = s
            best_t = (start + t * length) / total if total > 0 else 0.0
    return best, best_t, best_s


def _point_in_poly(px, py, poly):
    n = len(poly)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py):
            xint = (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi
            if px < xint:
                inside = not inside
        j = i
    return inside


def _flood_count(cells):
    s = set(cells)
    seen = set()
    n = 0
    nbr = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for start in s:
        if start in seen:
            continue
        n += 1
        stack = [start]
        seen.add(start)
        while stack:
            cx, cy = stack.pop()
            for dx, dy in nbr:
                q = (cx + dx, cy + dy)
                if q in s and q not in seen:
                    seen.add(q)
                    stack.append(q)
    return n


# =====================================================================
# 卡 4 地缝 —— 地面上一道中间粗两边细的裂缝
# 人点名。画在地面平面内。缝里不画别处的地板。
# REF 已敲定对象：核心 v6-B / 净化器 B1 的「只填面、不描边、断口新鲜面更亮」；
#     DEC-110 残骸断口比风化地面新、亮。不学：装置外壳、指示灯、水池、涂上去的线。
# =====================================================================
_C4_CY = 28.0
_C4_X0, _C4_X1 = 2, 37
# 缝心走向：不是直线，也不是正弦，逐段折
_C4_WAVE = (
    (2, 0.0), (7, 1.2), (12, 0.4), (17, -0.8), (21, -0.4),
    (26, 0.9), (31, 0.2), (37, -0.6),
)


def _c4_center(x):
    for i in range(len(_C4_WAVE) - 1):
        x0, v0 = _C4_WAVE[i]
        x1, v1 = _C4_WAVE[i + 1]
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return _C4_CY + v0 + (v1 - v0) * t
    return _C4_CY


def _c4_half(x):
    """中间粗两边细：半宽在中段到 3.2，两端收到 0。上下缘不对称，避免读成一只眼。"""
    t = (x - _C4_X0) / (_C4_X1 - _C4_X0)
    bell = math.sin(math.pi * t) ** 1.9
    jag = 0.75 * math.sin(x * 2.3) + 0.45 * math.sin(x * 0.83 + 1.1)
    return max(0.0, bell * 3.2 + bell * jag)


# 支缝：从主缝中段岔出去，把纺锤形打断
_C4_SPURS = (
    ((16, 26), (13, 22), (11, 20)),
    ((23, 30), (26, 34), (28, 35)),
    ((19, 30), (18, 33)),
    ((27, 27), (31, 24)),
)


def _c4_gap_cells():
    cells = {}
    for x in range(_C4_X0, _C4_X1 + 1):
        cy = _c4_center(x)
        h = _c4_half(x)
        if h <= 0.0:
            continue
        # 上缘比下缘收一点：对称的纺锤就是一只眼
        for y in range(int(round(cy - h * 0.78)), int(round(cy + h)) + 1):
            t = abs(y - cy) / max(0.6, h)
            cells[(x, y)] = min(1.0, t)
    for spur in _C4_SPURS:
        for i in range(len(spur) - 1):
            x0, y0 = spur[i]
            x1, y1 = spur[i + 1]
            n = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 or 1
            for k in range(n + 1):
                sx = int(round(x0 + (x1 - x0) * k / n))
                sy = int(round(y0 + (y1 - y0) * k / n))
                cells[(sx, sy)] = min(cells.get((sx, sy), 1.0), 0.55 + 0.4 * (i / max(1, len(spur) - 1)))
    return cells


_C4_GAP = _c4_gap_cells()


def card4(frame):
    im = new()
    rnd = random.Random(4004)

    # 缝口两侧的新断口：亮，但断续，不许连成一圈把缝框起来
    for x in range(_C4_X0, _C4_X1 + 1):
        cy = _c4_center(x)
        h = _c4_half(x)
        if h <= 0.0:
            continue
        for sign in (-1, 1):
            edge = cy + sign * (h + 1)
            r = rnd.random()
            if r < 0.62:
                put(im, x, edge, METAL if r < 0.44 else METAL_L)
            elif r < 0.78:
                put(im, x, edge, CONC_M)
            if rnd.random() < 0.22:
                put(im, x, cy + sign * (h + 2), CLINIC)

    # 缝本身：中心最深，向缝口变浅 —— 这是「有厚度」，不是一条涂上去的线
    for (x, y), t in _C4_GAP.items():
        put(im, x, y, gap_color(t))

    # 崩渣：散在缝外，说明是崩开的，不是画上去的
    for _ in range(26):
        x = rnd.randint(_C4_X0 - 1, _C4_X1 + 1)
        cy = _c4_center(x)
        h = max(1.0, _c4_half(x))
        y = int(round(cy + rnd.choice((-1, 1)) * (h + rnd.uniform(2.0, 4.6))))
        if get(im, x, y)[3] >= 32:
            continue
        put(im, x, y, rnd.choice((CONC_M, CONC_D, CONC_D, EARTH, BONE)))
    for x, y in ((11, 23), (24, 34), (16, 34), (29, 23)):
        put(im, x, y, EARTH)
    put(im, 20, 22, RUST)
    put(im, 22, 35, RUST)

    # 活层：缝深处的青绿沿缝走。不成形、不透出别处。只落缝的内部格
    inner = {
        c
        for c in _C4_GAP
        if all((c[0] + dx, c[1] + dy) in _C4_GAP for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }
    # 一条连着的细丝，压在缝最深那一行。断成一段一段会读成一串小灯；
    # 整条铺亮会读成霓虹，所以主体用最暗两档，只有几格在走
    core = []
    for x in range(_C4_X0 + 5, _C4_X1 - 4):
        col = [c for c in inner if c[0] == x]
        if not col:
            continue
        core.append(min(col, key=lambda c: _C4_GAP[c]))
    for i, (x, y) in enumerate(core):
        put(im, x, y, C4_THREAD[(i - frame * 2) % len(C4_THREAD)])
    return im


# =====================================================================
# 卡 5 击裂 —— 由中心点向周围辐射的裂缝，像钢化玻璃受击
# 人点名。画在地面平面内。中心是受击点，不是发光核。
# REF 已敲定对象：同卡 4。不学：车轮辐条式的等角放射、圆环、能量圈。
# =====================================================================
_C5_CX, _C5_CY = 19.5, 28.0
# (角度度, 长度, 根半宽) —— 角度故意不等分，钢化玻璃不是辐条
_C5_RAYS = (
    (-4, 19.0, 0.5), (36, 16.5, 0.5), (78, 11.0, 0.5), (117, 17.5, 0.5),
    (152, 18.5, 0.5), (196, 12.0, 0.5), (232, 15.5, 0.5), (285, 10.5, 0.5),
    (318, 16.0, 0.5),
)
# 分叉：(母射线序号, 起始比例, 转角度, 长度)
_C5_BRANCH = (
    (0, 0.58, 22, 7.0), (3, 0.52, -26, 7.5), (4, 0.62, 20, 6.0),
    (6, 0.5, -24, 6.5), (8, 0.55, 24, 5.5),
)
# 环向裂：钢化玻璃会在放射之间连出短弧。这个尺寸下多了就成一团糊，只留一条
_C5_ARCS = ((10.5, 140, 205),)


def _c5_gap_cells():
    cells = {}

    def stroke(x0, y0, ang_deg, length, w0, w1=0.0):
        ang = math.radians(ang_deg)
        dx, dy = math.cos(ang), math.sin(ang) * 0.62  # 地面平面里纵向略压
        n = max(1, int(length * 3))
        for i in range(n + 1):
            t = i / n
            cx = x0 + dx * length * t
            cy = y0 + dy * length * t
            hw = w0 + (w1 - w0) * t
            span = int(math.ceil(hw))
            for oy in range(-span - 1, span + 2):
                for ox in range(-span - 1, span + 2):
                    d = math.hypot(ox, oy * 1.35)
                    if d <= hw + 0.35:
                        key = (int(round(cx + ox)), int(round(cy + oy)))
                        val = min(1.0, d / max(0.6, hw + 0.35))
                        cells[key] = min(cells.get(key, 1.0), val)

    # 受击点：只有两三格被压碎。团一大就成墨点
    for ox, oy in ((0, 0), (1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1), (0, -1)):
        cells[(int(_C5_CX) + ox, int(_C5_CY) + oy)] = 0.0

    ends = []
    for ang, length, w0 in _C5_RAYS:
        stroke(_C5_CX, _C5_CY, ang, length, w0)
        a = math.radians(ang)
        ends.append((_C5_CX + math.cos(a) * length, _C5_CY + math.sin(a) * 0.62 * length))
    for idx, at, turn, length in _C5_BRANCH:
        ang, ray_len, _ = _C5_RAYS[idx]
        a = math.radians(ang)
        bx = _C5_CX + math.cos(a) * ray_len * at
        by = _C5_CY + math.sin(a) * 0.62 * ray_len * at
        stroke(bx, by, ang + turn, length, 0.65)
    for r, a0, a1 in _C5_ARCS:
        steps = int((a1 - a0) / 6)
        for i in range(steps):
            t0 = math.radians(a0 + (a1 - a0) * i / steps)
            t1 = math.radians(a0 + (a1 - a0) * (i + 1) / steps)
            x0 = _C5_CX + math.cos(t0) * r
            y0 = _C5_CY + math.sin(t0) * 0.62 * r
            x1 = _C5_CX + math.cos(t1) * r
            y1 = _C5_CY + math.sin(t1) * 0.62 * r
            seg = math.hypot(x1 - x0, y1 - y0)
            stroke(x0, y0, math.degrees(math.atan2((y1 - y0) / 0.62, x1 - x0)), seg, 0.55)
    # 越靠受击点越深，往外越浅。只按横截面上色会整条都是最深的一档，
    # 读成一条涂黑的线，读不出「从这里被击穿、往外只是裂开」
    far = max(
        math.hypot(x - _C5_CX, (y - _C5_CY) / 0.62) for x, y in cells
    )
    for key, t in list(cells.items()):
        rad = math.hypot(key[0] - _C5_CX, (key[1] - _C5_CY) / 0.62) / far
        cells[key] = min(1.0, t * 0.42 + rad * 0.72)
    return cells


_C5_GAP = _c5_gap_cells()


def card5(frame):
    im = new()
    rnd = random.Random(5005)

    # 断口亮棱：贴着缝但只挑一侧、断续。两侧都铺满就成了勾边
    for (x, y) in sorted(_C5_GAP):
        for ox, oy in ((0, -1), (1, 0)):
            nx, ny = x + ox, y + oy
            if (nx, ny) in _C5_GAP or get(im, nx, ny)[3] >= 32:
                continue
            r = rnd.random()
            if r < 0.30:
                put(im, nx, ny, METAL if r < 0.19 else METAL_L)
            elif r < 0.44:
                put(im, nx, ny, CONC_M)

    for (x, y), t in _C5_GAP.items():
        put(im, x, y, gap_color(t))

    # 受击点周围翻出来的渣
    for _ in range(22):
        a = rnd.uniform(0, math.tau)
        r = rnd.uniform(4.5, 9.0)
        x = int(round(_C5_CX + math.cos(a) * r))
        y = int(round(_C5_CY + math.sin(a) * 0.62 * r))
        if get(im, x, y)[3] >= 32:
            continue
        put(im, x, y, rnd.choice((CONC_M, CONC_D, CONC_D, EARTH, BONE)))
    for x, y in ((14, 24), (26, 32), (21, 21), (18, 35)):
        if get(im, x, y)[3] < 32:
            put(im, x, y, EARTH)
    put(im, 24, 23, RUST)

    # 活层：青绿从受击点往外推，不是中心一盏灯。缝只有一像素宽，所以判据是
    # 「四邻都不透明」（缝两侧有断口亮棱托着）；贴到背景就会读成涂上去的荧光线
    inner = {
        c
        for c in _C5_GAP
        if all(get(im, c[0] + dx, c[1] + dy)[3] >= 32 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }
    deep = sorted(
        (c for c in _C5_GAP if c in inner),
        key=lambda c: math.hypot(c[0] - _C5_CX, (c[1] - _C5_CY) / 0.62),
    )
    # 靠受击点那一段连着发亮，往外淡出。按半径隔一圈点会读成一圈小灯
    reach = 5.0 + 2.2 * math.sin(frame / FRAMES * math.tau)
    for x, y in deep:
        d = math.hypot(x - _C5_CX, (y - _C5_CY) / 0.62)
        if d > reach:
            continue
        t = d / max(0.8, reach)
        if t < 0.28:
            c = TEAL_L
        elif t < 0.55:
            c = TEAL_M
        elif t < 0.8:
            c = TEAL_D
        else:
            c = TEAL_X
        put(im, x, y, c)
    return im


# =====================================================================
# 卡 7 错位 —— 两块混凝土板沿一条台阶状暗缝滑开
# 不是一道画在地板上的线：伤口是两块场地之间的那条缝。明度差表示错开，
# 不画成立着的台阶体积。缝宽几乎均匀（地质断层，不是钟形的地缝）。
# REF 同卡 4。不学：立着的台阶、精密切割的伸缩缝、门框。
# =====================================================================
_C7_FAULT = ((4, 17), (13, 21), (17, 27), (23, 30), (36, 40))
_C7_GAP_HW = 1.55


def _c7_gap_cells():
    cells = {}
    for y in range(12, 50):
        for x in range(1, 39):
            d, _t, _s = _dist_poly(x, y, _C7_FAULT)
            if d <= _C7_GAP_HW + 0.35:
                cells[(x, y)] = min(1.0, d / (_C7_GAP_HW + 0.35))
    return cells


_C7_GAP = _c7_gap_cells()


def card7(frame):
    im = new()
    rnd = random.Random(7007)

    for y in range(12, 50):
        for x in range(1, 39):
            if (x, y) in _C7_GAP:
                continue
            d, t, s = _dist_poly(x, y, _C7_FAULT)
            jag = 0.85 * math.sin(x * 1.63 + y * 0.41) + 0.4 * math.sin(y * 0.9)
            if t < 0.07 or t > 0.93:
                continue
            if s > 0 and 1.7 < d < 8.0 + jag and t <= 0.78:
                if d < 2.7:
                    r = rnd.random()
                    if r < 0.62:
                        put(im, x, y, METAL_L)
                    elif r < 0.90:
                        put(im, x, y, METAL)
                    else:
                        put(im, x, y, CONC_M)
                elif rnd.random() < 0.18:
                    put(im, x, y, CONC_D)
                else:
                    put(im, x, y, CONC_M)
            elif s < 0 and 1.7 < d < 8.6 + jag and t >= 0.22:
                if d < 2.7:
                    put(im, x, y, CONC_D if rnd.random() < 0.55 else CLINIC)
                elif rnd.random() < 0.22:
                    put(im, x, y, CLINIC)
                else:
                    put(im, x, y, CONC_D)

    for x, y in (
        (12, 20), (16, 23), (21, 27), (25, 30), (29, 33), (33, 36), (19, 25), (23, 29),
    ):
        if get(im, x, y)[3] >= 32 and (x, y) not in _C7_GAP:
            put(im, x, y, METAL_L)

    for (x, y), t in _C7_GAP.items():
        put(im, x, y, gap_color(t))

    for _ in range(10):
        x = rnd.randint(8, 32)
        y = rnd.randint(20, 38)
        if (x, y) in _C7_GAP and get(im, x, y)[:3] in DARK_SET:
            put(im, x, y, EARTH if rnd.random() < 0.6 else BONE)
    put(im, 15, 24, RUST)
    put(im, 28, 33, EARTH)

    inner = {
        c
        for c in _C7_GAP
        if all(
            get(im, c[0] + dx, c[1] + dy)[3] >= 32
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
    }
    core = []
    samples = sorted(inner, key=lambda c: _dist_poly(c[0], c[1], _C7_FAULT)[1])
    step = max(1, len(samples) // 18)
    core = samples[::step][:16]
    for i, (x, y) in enumerate(core):
        put(im, x, y, C4_THREAD[(i - frame * 2) % len(C4_THREAD)])
    return im


# =====================================================================
# 卡 8 掀皮 —— 一块混凝土被掀起，伤口是新月形暗口
# C / J 形开口 + 掀起的板块。用明度表示掀起，仍落在地面平面内。
# 不学：对称纺锤（眼）、绕口一圈亮棱（传送门）。
# =====================================================================
_C8_FLAKE = (
    (8, 22), (22, 18), (36, 21), (37, 30), (22, 36), (7, 34),
)
# 开口在左下：边 4→5（底）和 5→0（左）。右边是还连着的铰。
_C8_OPEN = (4, 5)


def _c8_edge_dist(x, y, edges):
    best = 1e9
    n = len(_C8_FLAKE)
    for i in edges:
        ax, ay = _C8_FLAKE[i]
        bx, by = _C8_FLAKE[(i + 1) % n]
        d, _t, _s = _dist_seg(x, y, ax, ay, bx, by)
        if d < best:
            best = d
    return best


def _c8_gap_cells():
    cells = {}
    for y in range(16, 44):
        for x in range(2, 32):
            if _point_in_poly(x + 0.5, y + 0.5, _C8_FLAKE):
                continue
            d_open = _c8_edge_dist(x, y, _C8_OPEN)
            d_hinge = _c8_edge_dist(x, y, (0, 1, 2, 3))
            if d_hinge + 0.5 < d_open:
                continue
            hw = 2.6
            if d_open <= hw:
                cells[(x, y)] = min(1.0, d_open / hw)
    return cells


_C8_GAP = _c8_gap_cells()


def card8(frame):
    im = new()
    rnd = random.Random(8008)

    for y in range(16, 38):
        for x in range(6, 39):
            if not _point_in_poly(x + 0.5, y + 0.5, _C8_FLAKE):
                continue
            on_open = False
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) in _C8_GAP:
                    on_open = True
                    break
            if on_open:
                put(im, x, y, METAL_L if rnd.random() < 0.55 else METAL)
            else:
                r = rnd.random()
                if r < 0.28:
                    put(im, x, y, CONC_D)
                elif r < 0.42:
                    put(im, x, y, BONE)
                elif r < 0.50:
                    put(im, x, y, CLINIC)
                else:
                    put(im, x, y, CONC_M)

    for (x, y) in _C8_GAP:
        for ox, oy in ((0, -1), (1, 0), (-1, 0), (0, 1)):
            nx, ny = x + ox, y + oy
            if (nx, ny) in _C8_GAP or _point_in_poly(nx + 0.5, ny + 0.5, _C8_FLAKE):
                continue
            if get(im, nx, ny)[3] >= 32:
                continue
            r = rnd.random()
            if r < 0.18:
                put(im, nx, ny, CONC_D)
            elif r < 0.24:
                put(im, nx, ny, EARTH)

    for (x, y), t in _C8_GAP.items():
        put(im, x, y, gap_color(t))

    put(im, 14, 30, EARTH)
    put(im, 20, 35, BONE)
    put(im, 33, 33, RUST)

    inner = {
        c
        for c in _C8_GAP
        if all(
            get(im, c[0] + dx, c[1] + dy)[3] >= 32
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
    }
    deep = sorted(inner, key=lambda c: _C8_GAP[c])[:16]
    if deep:
        reach = 9 + (frame % 4)
        for i, (x, y) in enumerate(deep[:reach]):
            t = i / max(1, reach - 1)
            if t < 0.3:
                c = TEAL_M
            elif t < 0.65:
                c = TEAL_D
            else:
                c = TEAL_X
            put(im, x, y, c)
    return im


# =====================================================================
# 卡 9 网裂 —— 一片场地龟裂成网，没有主缝、没有受击点
# 伤口占住一片，不是一条也不是一个点。结散开，格子大小不等。
# 不学：蜘蛛（中心等长放射）、车轮辐条、中心墨点。
# =====================================================================
_C9_V = (
    (11, 20), (19, 17), (28, 19), (35, 25),
    (9, 27), (17, 25), (26, 27), (33, 32),
    (13, 35), (22, 34), (30, 38),
    (23, 22),
)
_C9_E = (
    (0, 1), (1, 2), (2, 3),
    (0, 4), (1, 5), (2, 6), (3, 7),
    (4, 5), (5, 6), (6, 7),
    (4, 8), (5, 9), (6, 10),
    (8, 9), (9, 10),
    (1, 11), (5, 11), (2, 11), (6, 11),
)
_C9_DEEP = ((17, 25), (26, 27), (13, 35), (30, 38))


def _c9_gap_cells():
    cells = {}

    def stroke(x0, y0, x1, y1, w0):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) or 1
        for i in range(n + 1):
            t = i / n
            cx = x0 + (x1 - x0) * t
            cy = y0 + (y1 - y0) * t
            span = int(math.ceil(w0))
            for oy in range(-span - 1, span + 2):
                for ox in range(-span - 1, span + 2):
                    d = math.hypot(ox, oy * 1.2)
                    if d <= w0 + 0.32:
                        key = (int(round(cx + ox)), int(round(cy + oy)))
                        val = min(1.0, d / max(0.5, w0 + 0.32))
                        cells[key] = min(cells.get(key, 1.0), val)

    for a, b in _C9_E:
        x0, y0 = _C9_V[a]
        x1, y1 = _C9_V[b]
        stroke(x0, y0, x1, y1, 0.48)
    for key, t in list(cells.items()):
        dmin = min(math.hypot(key[0] - nx, key[1] - ny) for nx, ny in _C9_DEEP)
        cells[key] = min(1.0, 0.22 + 0.75 * min(1.0, dmin / 7.5))
    for nx, ny in _C9_DEEP:
        for ox, oy in ((0, 0), (1, 0), (0, 1)):
            key = (nx + ox, ny + oy)
            cells[key] = min(cells.get(key, 1.0), 0.08)
    return cells


_C9_GAP = _c9_gap_cells()


def card9(frame):
    im = new()
    rnd = random.Random(9009)

    for (x, y) in sorted(_C9_GAP):
        for ox, oy in ((0, -1), (1, 0)):
            nx, ny = x + ox, y + oy
            if (nx, ny) in _C9_GAP or get(im, nx, ny)[3] >= 32:
                continue
            r = rnd.random()
            if r < 0.34:
                put(im, nx, ny, METAL_L if r < 0.12 else (METAL if r < 0.26 else CONC_M))
            elif r < 0.44:
                put(im, nx, ny, CONC_D)

    for (x, y), t in _C9_GAP.items():
        put(im, x, y, gap_color(t))

    for _ in range(14):
        x = rnd.randint(8, 34)
        y = rnd.randint(16, 40)
        if get(im, x, y)[3] >= 32:
            continue
        put(im, x, y, rnd.choice((CONC_D, CONC_D, EARTH, BONE)))
    put(im, 15, 22, EARTH)
    put(im, 29, 30, RUST)

    inner = {
        c
        for c in _C9_GAP
        if all(
            get(im, c[0] + dx, c[1] + dy)[3] >= 32
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
    }
    path = []
    for a, b in ((5, 11), (11, 6), (6, 9)):
        x0, y0 = _C9_V[a]
        x1, y1 = _C9_V[b]
        n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
        for i in range(n + 1):
            p = (int(round(x0 + (x1 - x0) * i / n)), int(round(y0 + (y1 - y0) * i / n)))
            if p in inner and _C9_GAP.get(p, 1.0) > 0.30:
                path.append(p)
    for i, (x, y) in enumerate(path):
        put(im, x, y, C4_THREAD[(i - frame) % len(C4_THREAD)])
    return im


# =====================================================================
# 闸门
# =====================================================================
def analyse(frames, live_region):
    im = frames[0]
    pix = [
        (x, y, im.getpixel((x, y))[:3])
        for y in range(H)
        for x in range(W)
        if im.getpixel((x, y))[3] >= 32
    ]
    occ = {(x, y) for x, y, _ in pix}
    cmap = {(x, y): c for x, y, c in pix}
    body = [c for _, _, c in pix if not is_teal(c)]
    xs = [x for x, _, _ in pix]
    ys = [y for _, y, _ in pix]

    changed = set()
    for f in frames[1:]:
        for y in range(H):
            for x in range(W):
                if f.getpixel((x, y)) != im.getpixel((x, y)):
                    changed.add((x, y))
    stray = sorted(changed - live_region)

    teal_cells = [(x, y) for x, y, c in pix if is_teal(c)]
    teal_edge = [
        (x, y)
        for x, y in teal_cells
        if any((x + dx, y + dy) not in occ for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    ]
    off = [c for _, _, c in pix if c not in PALETTE]
    darkest = min(lum(c) for c in body)
    brightest = max(lum(c) for c in body)
    dark_share = 100 * sum(1 for c in body if lum(c) <= 30) / len(body)
    bright_share = 100 * sum(1 for c in body if lum(c) >= 70) / len(body)
    tiers = [(c, n) for c, n in Counter(body).most_common() if 100 * n / len(body) >= 8.0]
    top_body, top_n = Counter(body).most_common(1)[0]
    teal_share = 100 * len(teal_cells) / len(pix)

    checks = [
        ("色全在锁定色板", not off, f"off-palette={len(off)}"),
        ("变化只在声明的活层里", not stray, f"stray={len(stray)} {stray[:5]}"),
        ("单一主体色 < 45%", 100 * top_n / len(body) < 45.0, f"{top_body} {100 * top_n / len(body):.1f}%"),
        ("材质层 >= 3 档各 >= 8%", len(tiers) >= 3, f"tiers={len(tiers)}"),
        (
            "对混凝土有黑有亮",
            darkest <= 20.0 and brightest >= 70.0 and dark_share >= 15.0 and bright_share >= 5.0,
            f"darkest={darkest:.1f} brightest={brightest:.1f} dark={dark_share:.0f}% bright={bright_share:.0f}%",
        ),
        ("青绿只在缝里 / 口里", not teal_edge, f"edge={teal_edge[:5]}"),
        ("青绿不压全身 < 22%", teal_share < 22.0, f"{teal_share:.1f}%"),
    ]

    wide = (max(xs) - min(xs)) >= (max(ys) - min(ys))
    bright_cells = [(x, y) for x, y, c in pix if lum(c) >= 70.0]
    gap_cells = [(x, y) for x, y, c in pix if c in DARK_SET]
    cover = 100 * len(bright_cells) / max(1, len(gap_cells))
    checks += [
        (
            "躺在地面平面里（宽 >= 高）",
            wide,
            f"w={max(xs) - min(xs) + 1} h={max(ys) - min(ys) + 1}",
        ),
        ("亮断口断续、不勾边 < 70%", cover < 70.0, f"cover={cover:.0f}% of gap"),
        (
            "缝有三档深度",
            len({c for _, _, c in pix if c in DARK_SET}) >= 3,
            f"tiers={len({c for _, _, c in pix if c in DARK_SET})}",
        ),
    ]
    return checks, body, pix


def audit(name, frames, live_region):
    checks, body, pix = analyse(frames, live_region)
    ok = all(c[1] for c in checks)
    print(f"\n[{name}] opaque={len(pix)} body={len(body)}")
    for label, good, msg in checks:
        print(f"   {'OK ' if good else 'BAD'} {label}: {msg}")
    print(
        "   body mix: "
        + ", ".join(f"{c}={100 * n / len(body):.0f}%" for c, n in Counter(body).most_common(6))
    )
    return ok


# =====================================================================
# 地面伤口形体指纹（先写判据再画。量的是缝的几何，不是整张贴花的包围盒。）
#
# 本质锁「伤口渗漏」排除立着的体积与门框，但成立范围内还有好几种占场地方式。
# 卡 4 地缝 / 卡 5 击裂已经是其中两个；本批再抽三个，禁止塌回那两个。
#
#   elong     = 缝格 PCA 第一特征值占比。1 = 一条线，0.5 = 各向同性。
#   sol       = 缝格数 / 缝凸包面积。实心缝贴近凸包（高）；星形 / 新月会空一大块（低）。
#   wcv       = 沿主轴分箱后缝宽的变异系数。钟形缝高，等宽断层低。
#   mean_deg  = 缝格四连通平均度数。填实的厚缝内部都是 4，细线网大约 2。
#   hub       = 离缝重心 ≤ 4 格的缝格占比。辐射的受击点会堆在这里；网裂不会。
#   n_large   = 面积 ≥ 20 的材质连通块数（非暗、非青绿、不在缝里）。
#   blob      = 最大那块材质的格数。
#   slab_min  = 缝两侧材质的较小侧格数。两块板都在时两侧都大。
# =====================================================================
def _pca(cells):
    pts = list(cells)
    n = len(pts)
    mx = sum(p[0] for p in pts) / n
    my = sum(p[1] for p in pts) / n
    cxx = sum((p[0] - mx) ** 2 for p in pts) / n
    cyy = sum((p[1] - my) ** 2 for p in pts) / n
    cxy = sum((p[0] - mx) * (p[1] - my) for p in pts) / n
    tr = cxx + cyy
    det = cxx * cyy - cxy * cxy
    disc = max(0.0, tr * tr - 4 * det)
    l1 = (tr + math.sqrt(disc)) / 2
    l2 = (tr - math.sqrt(disc)) / 2
    elong = l1 / (l1 + l2) if (l1 + l2) > 1e-9 else 0.5
    ang = 0.5 * math.atan2(2 * cxy, cxx - cyy)
    return elong, mx, my, ang


def _convex_hull(pts):
    pts = sorted(set(pts))
    if len(pts) <= 2:
        return pts

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    lower = []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def _poly_area(poly):
    n = len(poly)
    if n < 3:
        return float(max(1, n))
    a = 0.0
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        a += x0 * y1 - x1 * y0
    return abs(a) / 2.0


def form_fingerprint(im, gap_cells):
    gap = list(gap_cells)
    elong, mx, my, ang = _pca(gap)
    occ = set()
    for x, y in gap:
        dx, dy = x - mx, y - my
        if dx * dx + dy * dy < 0.25:
            continue
        a = math.atan2(dy, dx)
        occ.add(int((a + math.pi) / (2 * math.pi) * 12) % 12)
    s = set(gap)
    junc = 0
    djunc = 0
    for x, y in s:
        deg = sum(
            (x + dx, y + dy) in s for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )
        if deg < 3:
            continue
        junc += 1
        if math.hypot(x - mx, y - my) >= 3.5:
            djunc += 1
    ca, sa = math.cos(ang), math.sin(ang)
    bins = {}
    for x, y in gap:
        t = int(round((x - mx) * ca + (y - my) * sa))
        p = -(x - mx) * sa + (y - my) * ca
        bins.setdefault(t, []).append(p)
    widths = [max(ps) - min(ps) + 1 for ps in bins.values() if len(ps) >= 2]
    if len(widths) < 4:
        wcv = 9.0
    else:
        mean = sum(widths) / len(widths)
        var = sum((w - mean) ** 2 for w in widths) / len(widths)
        wcv = math.sqrt(var) / mean if mean > 0 else 9.0
    side_a = side_b = 0
    blob_seen = set()
    blobs = []
    nbr = ((1, 0), (-1, 0), (0, 1), (0, -1))
    for y in range(H):
        for x in range(W):
            p = im.getpixel((x, y))
            if p[3] < 32 or is_teal(p[:3]) or p[:3] in DARK_SET:
                continue
            if (x, y) in s:
                continue
            signed = -(x - mx) * sa + (y - my) * ca
            if signed >= 0:
                side_a += 1
            else:
                side_b += 1
            if (x, y) in blob_seen:
                continue
            stack = [(x, y)]
            blob_seen.add((x, y))
            size = 0
            while stack:
                cx, cy = stack.pop()
                size += 1
                for dx, dy in nbr:
                    nx, ny = cx + dx, cy + dy
                    if (nx, ny) in blob_seen or not (0 <= nx < W and 0 <= ny < H):
                        continue
                    q = im.getpixel((nx, ny))
                    if q[3] < 32 or is_teal(q[:3]) or q[:3] in DARK_SET:
                        continue
                    if (nx, ny) in s:
                        continue
                    blob_seen.add((nx, ny))
                    stack.append((nx, ny))
            blobs.append(size)
    total = side_a + side_b
    slab = (min(side_a, side_b) / total) if total else 0.0
    hull = _convex_hull(gap)
    sol = len(gap) / _poly_area(hull)
    blob = max(blobs) if blobs else 0
    n_large = sum(1 for b in blobs if b >= 20)
    degs = [
        sum((x + dx, y + dy) in s for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        for x, y in s
    ]
    mean_deg = (sum(degs) / len(degs)) if degs else 0.0
    hub = sum(1 for x, y in s if math.hypot(x - mx, y - my) <= 4.0)
    hub_share = hub / len(s)
    voids = [
        (x, y)
        for y in range(H)
        for x in range(W)
        if im.getpixel((x, y))[3] >= 32 and im.getpixel((x, y))[:3] == VOID[:3]
    ]
    n_void = _flood_count(voids)
    return {
        "elong": elong,
        "sol": sol,
        "wcv": wcv,
        "mean_deg": mean_deg,
        "hub": hub_share,
        "n_large": n_large,
        "blob": blob,
        "slab": slab,
        "slab_min": min(side_a, side_b),
        "mat": total,
        "djunc": djunc,
        "bins": len(occ),
        "gap": len(s),
        "n_void": n_void,
    }


def ascii_art(im):
    rows = []
    for y in range(H):
        row = ""
        for x in range(W):
            p = im.getpixel((x, y))
            if p[3] < 32:
                row += "."
            elif is_teal(p[:3]):
                row += "T"
            elif p[:3] in (EARTH[:3], RUST[:3], BONE[:3]):
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


CARDS = (
    (4, "地缝", card4, set(_C4_GAP), "线缝"),
    (5, "击裂", card5, set(_C5_GAP), "辐射"),
    (7, "错位", card7, set(_C7_GAP), "错位"),
    (8, "掀皮", card8, set(_C8_GAP), "掀皮"),
    (9, "网裂", card9, set(_C9_GAP), "网裂"),
)

FORM_BANDS = {
    "线缝": lambda fp: (
        fp["n_large"] == 0 and fp["elong"] >= 0.86 and fp["mean_deg"] >= 2.80
    ),
    "辐射": lambda fp: (
        fp["n_large"] == 0
        and fp["elong"] >= 0.78
        and fp["sol"] <= 0.42
        and fp["mean_deg"] <= 2.55
    ),
    "错位": lambda fp: (
        fp["n_large"] >= 2 and fp["slab_min"] >= 60 and fp["mat"] >= 160
    ),
    "掀皮": lambda fp: (
        fp["n_large"] == 1 and fp["blob"] >= 35 and fp["sol"] <= 0.50
    ),
    "网裂": lambda fp: (
        fp["n_large"] == 0
        and fp["elong"] <= 0.76
        and fp["mean_deg"] <= 2.55
        and fp["n_void"] >= 3
    ),
}

all_ok = True
FINGERPRINTS = []
for variant, label, fn, live, form in CARDS:
    frames = [fn(f) for f in range(FRAMES)]
    name = f"rift-e{variant}"
    fp = form_fingerprint(frames[0], live)
    FINGERPRINTS.append((variant, label, form, fp))
    frames[0].save(os.path.join(ANIM, f"{name}.png"))
    sheet = Image.new("RGBA", (W * FRAMES, H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * W, 0))
    sheet_path = os.path.join(ANIM, f"{name}-sheet.png")
    sheet.save(sheet_path)
    sheet.resize((W * FRAMES * 3, H * 3), Image.NEAREST).save(
        os.path.join(ANIM, f"{name}-3x.png")
    )
    frames[0].resize((W * 3, H * 3), Image.NEAREST).save(
        os.path.join(PREVIEW, f"{name}-3x.png")
    )
    frames[0].convert("RGB").save(
        os.path.join(ANIM, f"{name}.gif"),
        save_all=True,
        append_images=[f.convert("RGB") for f in frames[1:]],
        duration=int(1000 / FPS),
        loop=0,
    )
    with open(os.path.join(ANIM, f"{name}.json"), "w", encoding="utf-8") as fh:
        json.dump(
            {
                "name": name,
                "label": label,
                "frameWidth": W,
                "frameHeight": H,
                "frames": FRAMES,
                "fps": FPS,
                "plane": "floor-plane",
            },
            fh,
            ensure_ascii=False,
            indent=2,
        )
    shutil.copyfile(sheet_path, os.path.join(PUBLIC, f"{name}-sheet.png"))
    all_ok &= audit(f"卡 {variant} {label}", frames, live)
    print(
        "   fingerprint: "
        + " ".join(
            f"{k}={v:.2f}" if isinstance(v, float) else f"{k}={v}"
            for k, v in fp.items()
        )
    )

print("\n[形体类] 声明的方向必须在数值上真的成立，且不得落进别的类")
for variant, label, declared, fp in FINGERPRINTS:
    hits = [name for name, pred in FORM_BANDS.items() if pred(fp)]
    own = declared in hits
    extra = [h for h in hits if h != declared]
    all_ok &= own and not extra
    print(
        f"   {'OK ' if own and not extra else 'BAD'} 卡 {variant} {label} 声明「{declared}」"
        f" 命中={hits or '无'}"
    )
    if not own:
        print(f"      自己的类没进去：{fp}")

fp7 = next(fp for v, _l, _d, fp in FINGERPRINTS if v == 7)
lie = FORM_BANDS["线缝"](fp7)
all_ok &= not lie
print(f"   {'OK ' if not lie else 'BAD'} 谎称测试：卡 7 当成线缝必须红")

# 对照图：三卡 4× 贴在混凝土色块上。速看用，真底是练习场与净化点
K = 4
PAD = 12
cw = (W * K + PAD) * len(CARDS) + PAD
ch = H * K + PAD * 2
board = Image.new("RGB", (cw, ch), CONC_M[:3])
for y in range(ch):
    for x in range(cw):
        if ((x // (K * 4)) + (y // (K * 4))) % 2 == 0:
            board.putpixel((x, y), CONC_D[:3])
for i, (variant, label, fn, live, _form) in enumerate(CARDS):
    card = fn(0).resize((W * K, H * K), Image.NEAREST)
    board.paste(card, (PAD + i * (W * K + PAD), PAD), card)
board.save(os.path.join(ANIM, "rift-ground-contact.png"))

if os.environ.get("SHOW_ASCII"):
    for variant, label, fn, _live, _form in CARDS:
        print(f"\n=== 卡 {variant} {label} ===")
        print(ascii_art(fn(0)))

print("\n机械层" + ("全绿" if all_ok else "有 BAD，未过"))
raise SystemExit(0 if all_ok else 1)
