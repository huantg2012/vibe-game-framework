#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
裂隙入口 —— 地面两卡（卡 4 地缝 / 卡 5 击裂）

人 2026-09-04 推翻了「墙上的伤」那一整路：入口在**地面上**，不在墙上。
人点名三个地面方向，出了三张，人留下卡 4 与卡 5（卡 6 囚笼落选，已整支删除）：

  卡 4 地缝   地面上一道中间粗两边细的裂缝  → **生产默认（DEC-113）**
  卡 5 击裂   由中心点向周围辐射的裂缝，像钢化玻璃受击  → 留作对照 `?entrance=5`

人另已明令：**不需要显式呈现「裂隙那边是什么」。** 所以缝里只有深与青绿的丝，
不画别处的地板、砖、木——那等于承诺目的地，与「去向不可选」冲突。

身份锁：`docs/design-notes/rift-entrance-identity.md`「伤口渗漏，不是门」。
参考只取：世界背景、当前净化点、裂隙内部、已敲定的三台交互物与玩家画法。

相机：**地面平面内**（与净化点混凝土地面同一平面，顶视）。地面上的缝只能画在
地面平面里；按向下俯视 10° 画会被压成几乎看不见。已锁三台装置仍是 45° 等距，
本批不动它们。接线上这两张是地面贴花：锚点取中心，层压在地板之上、玩家之下。

画布 40×56、8 帧、6fps。落地底 = 净化点混凝土（主色明度 60.7 / 暗部 46.0），
所以缝要够黑、断口要够亮。

活层只有缝里的青绿；缝、断口、崩渣逐帧钉死。变化只许落在声明的活层区域里。
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
    (4, "地缝", card4, set(_C4_GAP)),
    (5, "击裂", card5, set(_C5_GAP)),
)

all_ok = True
for variant, label, fn, live in CARDS:
    frames = [fn(f) for f in range(FRAMES)]
    name = f"rift-e{variant}"
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
for i, (variant, label, fn, live) in enumerate(CARDS):
    card = fn(0).resize((W * K, H * K), Image.NEAREST)
    board.paste(card, (PAD + i * (W * K + PAD), PAD), card)
board.save(os.path.join(ANIM, "rift-ground-contact.png"))

if os.environ.get("SHOW_ASCII"):
    for variant, label, fn, _live in CARDS:
        print(f"\n=== 卡 {variant} {label} ===")
        print(ascii_art(fn(0)))

print("\n机械层" + ("全绿" if all_ok else "有 BAD，未过"))
raise SystemExit(0 if all_ok else 1)
