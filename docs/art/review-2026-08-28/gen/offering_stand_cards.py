#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
供奉台（spec 侧「防御点」）—— 三卡

身份已锁（人 2026-09-04，`docs/design-notes/offering-stand-identity.md`）：
**一台同时起收容、控制、暴露三种作用的装置。** 不是架子、不是祭坛。
装置本身不出力；转化是冲击做的。

人另已拍板：
  · 相机 = **45° 等距**（顶面旋转 45° + 压缩 0.55），与已锁三台同一套。
  · **外观不显槽数**——不画可数槽位。H / I 的青绿是装填光点（空 / 一 / 二 / 三档 = 0 / 1 / 2 / 3+ 个残渣；第 4 槽不另开一档），贴在夹持面上浮动，不对应具体槽位。

三张 = 三种人造收容手段，每张都朝外开一面：
  卡 A 压钳   夹：四面合围的压钳，只前左那面敞开
  卡 B 笼斗   围：顶上有格栅盖的笼，前左那面笼条被压断
  卡 C 浇墩   浇：混凝土把残渣浇死，前左面留一个粗糙敞口

三轴取值（`offering-stand-identity.md` 第 3 节声明的可分维度）：
  用什么手段收容与控制 · 朝外那一面怎么开 · 「在挨压」怎么被读出

落地底 = 净化点混凝土（主色明度 60.7 / 暗部 46.0）。画布 32×32，七点里最小。
活层只有装置内部那点青绿；结构逐帧钉死。

**防香炉硬闸门：** 青绿绝不许溢出口沿往上飘——每个 teal 像素的正上方必须
被不透明的非 teal 结构盖住。青绿往上冒一次，整件就读成火盆／香炉。
"""
from __future__ import annotations

import json
import math
import os
import random
import shutil
from collections import Counter, deque, deque

from PIL import Image

W, H = 32, 32
FRAMES = 8
FPS = 6
K = 0.55          # 顶面压缩比，与已锁三台同一公约
GROUND = 23       # footprint 中心的屏幕 y；前角还会往下探约 5 行，接地斑落在 29/30
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

# —— 锁定色板（名字跟 art-direction §2.2）——
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
WARM_D = (0x8A, 0x5C, 0x2A, 255)   # 极小功能指示，要能答「指示」
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
    """真等距：旋转 45° + 压缩。与 core_v6 / purifier_b1 同一份公约。"""
    return (dx - dy) * 0.5, (dx + dy) * 0.5 * K


def iso_prism(im, fp, h, top_c, side_cs, z0=0.0, cx=CX, cyg=GROUND):
    """只填面就停：顶面 + 朝观者的两个侧面。不描边——外沿就是面色。

    side_cs 按边序号索引；边 1 = 前右面，边 2 = 前左面（正方 footprint 时）。
    朝后的边被剔掉（被顶面遮住）。
    """
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


def iso_taper(im, fp, h, top_scale, top_c, side_cs, z0=0.0, cx=CX, cyg=GROUND):
    """上下不同大小的台体。笼斗用它：上宽下窄。"""
    bp = [iso(dx, dy) for dx, dy in fp]
    tp = [(sx * top_scale, sy * top_scale) for sx, sy in bp]
    bot = [(cx + sx, cyg - z0 + sy) for sx, sy in bp]
    top = [(cx + sx, cyg - z0 - h + sy) for sx, sy in tp]
    n = len(fp)
    faces = {}
    for i in range(n):
        j = (i + 1) % n
        if (bp[i][1] + bp[j][1]) / 2 <= 0:
            continue
        quad = [top[i], top[j], bot[j], bot[i]]
        fill_poly(im, quad, side_cs[i % len(side_cs)])
        faces[i] = quad
    fill_poly(im, top, top_c)
    return top, bot, faces


def poly_cells(quad):
    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    cells = set()
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        acc = []
        n = len(quad)
        for i in range(n):
            x0, y0 = quad[i]
            x1, y1 = quad[(i + 1) % n]
            if (y0 <= y < y1) or (y1 <= y < y0):
                acc.append(x0 + (y - y0) / (y1 - y0) * (x1 - x0))
        acc.sort()
        for i in range(0, len(acc) - 1, 2):
            for x in range(int(round(acc[i])), int(round(acc[i + 1])) + 1):
                cells.add((x, y))
    return cells


def erode(cells, steps=1):
    cur = set(cells)
    for _ in range(steps):
        cur = {
            c for c in cur
            if all((c[0] + dx, c[1] + dy) in cur for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        }
    return cur


def blob_depth(cells):
    depth = {}
    cur = set(cells)
    d = 0
    while cur:
        edge = {
            c for c in cur
            if any((c[0] + dx, c[1] + dy) not in cur for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        }
        for c in edge:
            depth[c] = d
        cur -= edge
        d += 1
    return depth


def ragged_band(front, lo_frac, hi_frac, rnd, bite=3):
    """在一个侧面上取一块参差的开口。

    横向的整齐亮矩形贴在块体上会读成屏幕／读数盘（实测撞过），
    所以开口必须逐行参差、整体偏竖，不是一条横槽。
    """
    ys = sorted({c[1] for c in front})
    if len(ys) < 4:
        return set()
    lo = ys[int(len(ys) * lo_frac)]
    hi = ys[min(len(ys) - 1, int(len(ys) * hi_frac))]
    out = set()
    for y in range(lo, hi + 1):
        row = sorted(c[0] for c in front if c[1] == y)
        if len(row) < 4:
            continue
        a = row[0] + rnd.randint(1, bite)
        b = row[-1] - rnd.randint(1, bite)
        if b - a < 1:
            continue
        out |= {(x, y) for x in range(a, b + 1)}
    return out


def recess(im, cells, lip=METAL_L, rnd=None):
    """朝外那一面开的槽：面上一圈受光断口 → 槽沿在暗里 → 里面那点异源物质。

    45° 下每个可见侧面只有 5–8 像素宽，同心多层凹龛放不进去，所以深度只做一层：
    槽的边界圈是 SHADOW，里面才是 teal。断口亮棱画在槽**外面**的面上（断续），
    说明这一面是人故意开的，不是自己烂的。

    青绿被 SHADOW 圈围住 → 碰不到背景；上方是装置结构 → 不可能往上冒（防香炉）。
    返回 teal 格集合 = 活层。
    """
    rnd = rnd or random.Random(0x5107)
    # 开口整体必须落在实体内部：只要有一格贴到剪影，槽沿那圈暗色就变成了勾边
    cells = {
        c for c in cells
        if all(get(im, c[0] + dx, c[1] + dy)[3] >= 32
               for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)))
    }
    if not cells:
        return set()
    # 槽外面的受光断口，断续
    for x, y in sorted(cells):
        for ox, oy in ((0, -1), (-1, 0), (1, 0), (0, 1)):
            n = (x + ox, y + oy)
            if n in cells or get(im, n[0], n[1])[3] < 32:
                continue
            if rnd.random() < 0.55:
                put(im, n[0], n[1], lip if rnd.random() < 0.6 else METAL)
    depth = blob_depth(cells)
    teal = set()
    for c, d in depth.items():
        if d == 0:
            put(im, c[0], c[1], SHADOW)
        else:
            put(im, c[0], c[1], TEAL_X)
            teal.add(c)
    return teal


def beam(im, x0, y0, x1, y1, core, up, down, half=1.5):
    """屏幕空间的斜梁：顶棱受光 · 芯 · 底棱背光。half = 垂向半厚（像素）。

    45° 下把一根斜臂用 iso_prism 拼段会碎掉（一格进深只换 0.275 行），
    所以斜臂直接在屏幕空间画，体积仍然靠邻棱明度差，不靠描边。

    梁身必须**填面**，不能沿垂线逐格 put：45° 斜线的单位垂线四舍五入成
    (+1,-1)，加上去得到的是隔一格的平行线，梁身会漏成一串点（实测撞过）。
    """
    n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
    ux, uy = (x1 - x0) / n, (y1 - y0) / n
    px, py = -uy, ux            # 指向屏幕上方那一侧的单位垂线
    L = math.hypot(px, py) or 1
    px, py = px / L * half, py / L * half
    fill_poly(im, [(x0 + px, y0 + py), (x1 + px, y1 + py),
                   (x1 - px, y1 - py), (x0 - px, y0 - py)], core)
    line(im, x0 + px, y0 + py, x1 + px, y1 + py, up)
    line(im, x0 - px, y0 - py, x1 - px, y1 - py, down)


def stain(im, x, y, c):
    """磨损 / 指示灯只许落在已有实体上。不加这道守卫，一颗漆会浮在空中读成噪点。"""
    if get(im, x, y)[3] >= 32:
        put(im, x, y, c)


def contact(im, rx=11, cx=CX, base=None):
    """接地：薄两行。填实的深色椭圆压在底部会读成花盆，所以压到最薄。"""
    if base is None:
        base = max((y for y in range(H) for x in range(W) if get(im, x, y)[3] >= 32),
                   default=GROUND)
    for dy, c in ((0, INK), (1, VOID)):
        y = base + 1 + dy
        r = rx * (1.0 - dy * 0.30)
        for x in range(int(cx - r), int(cx + r) + 1):
            if get(im, x, y)[3] >= 32:
                continue
            put(im, x, y, c)


def bars_on_quad(im, quad, step, c):
    """在一个侧面上打竖缝，读成栅栏。只在该面已有像素上覆写。"""
    xs = [p[0] for p in quad]
    ys = [p[1] for p in quad]
    x0, x1 = int(min(xs)), int(max(xs))
    y0, y1 = int(min(ys)), int(max(ys))
    for x in range(x0, x1 + 1):
        if (x - x0) % step:
            continue
        for y in range(y0, y1 + 1):
            if get(im, x, y)[3] >= 32 and not is_teal(get(im, x, y)[:3]):
                put(im, x, y, c)


def teal_ramp(t):
    if t < 0.25:
        return TEAL_X
    if t < 0.5:
        return TEAL_D
    if t < 0.78:
        return TEAL_M
    return TEAL_L


def breathe(cells, frame, seed):
    """里面那点东西在顶：按格的相位错开，慢慢起伏。不是闪灯。"""
    rnd = random.Random(seed)
    phases = {c: rnd.random() for c in cells}
    out = {}
    for c in cells:
        v = 0.5 + 0.5 * math.sin(frame / FRAMES * math.tau + phases[c] * math.tau)
        out[c] = teal_ramp(0.18 + v * 0.72)
    return out


# 装填档（H / I）：空 / 一 / 二 / 三。三档 = 装填 1 / 2 / 3+ 个残渣，
# 第 4 槽不另开一档——外观不显槽数。
# 光点贴在夹持面上浮动，不悬在透明里（否则「青绿碰背景」闸门红，
# 也读成荧光涂鸦）。空档不画青绿。
CHARGE_OFFSETS = {
    1: ((0, 0), (1, 0)),
    2: ((0, 0), (1, 0), (-1, 0), (0, 1), (1, 1), (0, -1)),
    3: (
        (0, 0), (1, 0), (-1, 0), (0, 1), (0, -1),
        (1, 1), (-1, 1), (1, -1), (-1, -1), (2, 0), (-2, 0), (0, 2),
    ),
}


def charge_breathe_range(charge):
    if charge <= 1:
        return 0.04, 0.40
    if charge == 2:
        return 0.22, 0.78
    return 0.42, 1.00


def charge_light(im, pocket, origin, charge, frame, seed):
    """在已有实体上盖一团青绿光点。charge=0 不画。"""
    live = set()
    if charge <= 0 or not pocket:
        return live
    ox, oy = origin
    bob = int(round(math.sin(frame / FRAMES * math.tau) * (0.55 + 0.22 * charge)))
    cy = oy + bob
    cx, cy = min(pocket, key=lambda p: abs(p[0] - ox) + abs(p[1] - cy))
    for dx, dy in CHARGE_OFFSETS[charge]:
        x, y = cx + dx, cy + dy
        if (x, y) not in pocket:
            continue
        if get(im, x, y)[3] < 32:
            continue
        if any(get(im, x + ax, y + ay)[3] < 32
               for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            continue
        put(im, x, y, TEAL_X)
        live.add((x, y))
    if not live:
        return live
    lo, hi = charge_breathe_range(charge)
    rnd = random.Random(seed)
    phases = {c: rnd.random() for c in live}
    for c in live:
        v = 0.5 + 0.5 * math.sin(frame / FRAMES * math.tau + phases[c] * math.tau)
        put(im, c[0], c[1], teal_ramp(lo + v * (hi - lo)))
    return live


# =====================================================================
# 卡 A 压钳 —— 夹。两条厚颊板从两端夹死中间的收容腔，压板从上面封顶，
#              丝杆与手轮是人拧紧的手段；只有前左那一面开着槽。
# 收容 = 腔体被金属包住 · 控制 = 丝杆 + 手轮 · 暴露 = 前左的槽
# =====================================================================
def cardA(frame):
    im = new()
    rnd = random.Random(0xA11)
    iso_prism(im, [(-9, -7), (9, -7), (9, 7), (-9, 7)], 3,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])

    # 收容腔壳：偏暗，读成里面是凹的
    _, _, body = iso_prism(
        im, [(-8, -6), (8, -6), (8, 6), (-8, 6)], 12, z0=3,
        top_c=CLINIC, side_cs=[CLINIC, CLINIC, CONC_D, CLINIC])

    # 两端的厚颊板：夹。右侧受光
    iso_prism(im, [(-8.5, -6.5), (-5.5, -6.5), (-5.5, 6.5), (-8.5, 6.5)], 14, z0=3,
              top_c=METAL, side_cs=[METAL, CONC_M, METAL_L, METAL])
    iso_prism(im, [(5.5, -6.5), (8.5, -6.5), (8.5, 6.5), (5.5, 6.5)], 14, z0=3,
              top_c=METAL, side_cs=[METAL, CONC_M, METAL_L, METAL])

    # 压板：从上面封顶
    iso_prism(im, [(-9, -7), (9, -7), (9, 7), (-9, 7)], 2, z0=15,
              top_c=METAL_L, side_cs=[METAL, CONC_M, METAL_L, METAL])

    # 丝杆 + 手轮：控制
    iso_prism(im, [(-11.5, 1), (11.5, 1), (11.5, 2.4), (-11.5, 2.4)], 2, z0=9,
              top_c=METAL_L, side_cs=[METAL, CONC_D, METAL, METAL])
    iso_prism(im, [(-14, 0.2), (-11, 0.2), (-11, 3.2), (-14, 3.2)], 4, z0=8,
              top_c=METAL_L, side_cs=[METAL, CONC_D, BONE, METAL])
    put(im, 8, 22, RUST)
    put(im, 23, 21, RUST)
    put(im, 21, 8, WARM_D)

    # 前左那一面开的槽：压力从这儿进来
    front = poly_cells(body[2])
    live = recess(im, ragged_band(front, 0.18, 0.86, rnd, bite=3), rnd=rnd)

    for (x, y), c in breathe(live, frame, 0xA11).items():
        put(im, x, y, c)
    contact(im, 11)
    return im, live


# =====================================================================
# 卡 B 笼斗 —— 围。竖笼条围住，顶上格栅盖封死，两道箍勒紧，
#              前左那一段笼条被压断，断口就是暴露面。
# 收容 = 笼 + 顶盖 · 控制 = 笼条与箍 · 暴露 = 被压断的那一段
# =====================================================================
def cardB(frame):
    im = new()
    rnd = random.Random(0xB22)
    iso_prism(im, [(-9, -7), (9, -7), (9, 7), (-9, 7)], 4,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])

    _, _, faces = iso_taper(
        im, [(-6.5, -5), (6.5, -5), (6.5, 5), (-6.5, 5)], 11, 1.10,
        top_c=CLINIC, side_cs=[METAL, CONC_M, METAL_L, METAL], z0=4)
    # 竖笼条：缝内缩一格，不许爬到面的外沿
    for idx, quad in faces.items():
        inner = erode(poly_cells(quad), 2)
        xs = sorted({c[0] for c in inner})
        if not xs:
            continue
        for x, y in inner:
            if (x - xs[0]) % 3 == 0:
                put(im, x, y, SHADOW if idx == 1 else CLINIC)

    # 顶上的格栅盖：封住上面
    top, _, _ = iso_prism(
        im, [(-8.5, -6.5), (8.5, -6.5), (8.5, 6.5), (-8.5, 6.5)], 2, z0=15,
        top_c=METAL, side_cs=[METAL, CONC_M, METAL_L, METAL])
    grate = erode(poly_cells(top), 1)
    gx = sorted({c[0] for c in grate})
    for x, y in grate:
        if gx and (x - gx[0]) % 3 == 0:
            put(im, x, y, CLINIC)

    # 两道箍：勒紧
    for k, col in ((8, METAL_L), (12, METAL_L)):
        for dx in range(-9, 10):
            sx, sy = iso(dx, 5.0)
            if get(im, CX + sx, GROUND - k + sy)[3] >= 32:
                put(im, CX + sx, GROUND - k + sy, col)
    put(im, 9, 21, RUST)
    put(im, 22, 20, RUST)
    put(im, 20, 8, WARM_D)

    # 前左那一段笼条被压断
    front = poly_cells(faces[2])
    live = recess(im, ragged_band(front, 0.16, 0.82, rnd, bite=3), rnd=rnd)

    for (x, y), c in breathe(live, frame, 0xB22).items():
        put(im, x, y, c)
    contact(im, 11)
    return im, live


# =====================================================================
# 卡 C 浇墩 —— 浇。混凝土把异源物质浇死在里面，箍筋勒住，
#              前左面留一个粗糙敞口（拆模留下的洞）。
# 收容 = 整块浇死 · 控制 = 模板缝与箍筋 · 暴露 = 留的那个洞
# 破「宽矮块 = 箱子」：比宽更高 + 顶面缺一角 + 脚下地被顶裂（长进地里）
# =====================================================================
_C_FLOOR = set()


def cardC(frame):
    im = new()
    rnd = random.Random(0xC33)

    floor = set()
    for ang, length in ((-16, 10.0), (28, 8.0), (104, 5.5), (150, 9.5),
                        (208, 7.0), (300, 8.5)):
        a = math.radians(ang)
        n = int(length * 3)
        for i in range(n + 1):
            t = i / n
            floor.add((int(round(CX + math.cos(a) * length * t)),
                       int(round(GROUND + 4 + math.sin(a) * 0.34 * length * t))))
    for x, y in floor:
        put(im, x, y, INK if abs(x - CX) < 5 else SHADOW)
    for x, y in sorted(floor):
        for ox, oy in ((0, -1), (1, 0)):
            if (x + ox, y + oy) in floor or get(im, x + ox, y + oy)[3] >= 32:
                continue
            r = rnd.random()
            if r < 0.40:
                put(im, x + ox, y + oy, METAL if r < 0.24 else METAL_L)
            elif r < 0.56:
                put(im, x + ox, y + oy, CONC_M)
    _C_FLOOR.clear()
    _C_FLOOR.update(floor)

    _, _, faces = iso_prism(
        im, [(-7, -5.5), (7, -5.5), (7, 5.5), (-7, 5.5)], 18,
        top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])
    # 顶沿被磨出的亮棱：混凝土棱角崩掉后露出较新的骨料
    for dx in range(-7, 8):
        sx, sy = iso(dx, 5.5)
        put(im, CX + sx, GROUND - 18 + sy, METAL_L)
    for dy in range(-5, 6):
        sx, sy = iso(7, dy)
        put(im, CX + sx, GROUND - 18 + sy, METAL_L)
    corner = [
        (CX + iso(2.5, -5.5)[0], GROUND - 18 + iso(2.5, -5.5)[1]),
        (CX + iso(7, -5.5)[0], GROUND - 18 + iso(7, -5.5)[1]),
        (CX + iso(7, -1.0)[0], GROUND - 18 + iso(7, -1.0)[1]),
    ]
    fill_poly(im, corner, (0, 0, 0, 0))
    for i in range(len(corner)):
        line(im, *corner[i], *corner[(i + 1) % len(corner)], METAL_L)

    # 模板缝 + 箍筋 + 锈渍
    # 箍筋绕过转角：两个可见面都要带。只箍前左那一面时，前右整片背光面成了
    # 全卡最大的单色块，而它又是最暗的一档——整件就读成一坨剪影（闸门抓到过）。
    for k, col in ((4, CONC_D), (10, METAL_L), (15, CONC_D)):
        for dx in range(-7, 8):
            sx, sy = iso(dx, 5.5)
            if get(im, CX + sx, GROUND - k + sy)[3] >= 32:
                put(im, CX + sx, GROUND - k + sy, col)
        for dy in range(-5, 6):
            sx, sy = iso(7, dy)
            if get(im, CX + sx, GROUND - k + sy)[3] >= 32:
                put(im, CX + sx, GROUND - k + sy, col)
    for x, y in ((10, 18), (22, 13), (12, 9)):
        put(im, x, y, RUST)
    put(im, 18, 6, WARM_D)

    # 前左面留的粗糙敞口：逐行错开，不是一个方洞
    front = poly_cells(faces[2])
    live = recess(im, ragged_band(front, 0.14, 0.84, rnd, bite=2), lip=CONC_M, rnd=rnd)

    for (x, y), c in breathe(live, frame, 0xC33).items():
        put(im, x, y, c)
    contact(im, 11)
    return im, live


# =====================================================================
# 第二轮：换可分维度。第一轮 A/B/C 三张共用同一句形体——实心方块 + 前左面开洞，
# 只有块的高矮与表面纹理在换，所以剪影类别只有一个，区分度低（人 2026-09-04）。
# 这一轮按**形体类**拆，一张一类：
#   卡 D 举出   横向外伸：宽底 + 长斜臂 + 末端爪罩把残渣递到装置外的空气里（Γ 形）
#   卡 E 顶咬   竖向细高：窄脚 + 细柱 + 顶部偏心咬合头（丁形）
#   卡 F 压槽   贴地矮宽：矮槽 + 偏心压板压住大半个槽口，只露一段月牙（一条）
# 三张的收容 / 控制 / 暴露仍然同时成立，只是被摆在完全不同的体积里。
# =====================================================================

# ---------------------------------------------------------------------
# 卡 D 举出 —— 横向外伸。宽底座压住地面，配重箱平衡，一根斜臂把爪罩举到
#              装置本体外的空气里：残渣悬在半空，压力从四面直接打在它身上。
# 收容 = 爪罩扣着 · 控制 = 铰盘 + 斜撑 + 配重 · 暴露 = 整个举出去，最直白的一张
# 破「宽矮块 = 箱子」：重心与体量都被拉到画布左上，剪影是 Γ 不是方
# ---------------------------------------------------------------------
def cardD(frame):
    im = new()
    rnd = random.Random(0xD44)

    # 宽底座：必须看起来压得住外伸的臂
    iso_prism(im, [(-6, -6), (9, -6), (9, 6), (-6, 6)], 6,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])
    # 地锚楔：两根不等长，钉进混凝土
    iso_prism(im, [(-7, 4), (-4, 4), (-4, 6), (-7, 6)], 2,
              top_c=METAL_L, side_cs=[METAL, CONC_D, METAL, METAL])
    iso_prism(im, [(6, 5.5), (9.5, 5.5), (9.5, 7), (6, 7)], 1.5,
              top_c=METAL, side_cs=[METAL, CONC_D, METAL_L, METAL])

    # 配重箱：坐在底座后半截，读出这是台机械而不是雕塑。
    # 第一版又高又暗（h=8、前右面 CLINIC），在图上读成一片黑帆盖过了臂。
    # 压矮 + 给它自己的三级明度（锈顶 / 骨灰前左 / clinic 前右）。
    iso_prism(im, [(3.5, -4.5), (8.5, -4.5), (8.5, 0), (3.5, 0)], 5, z0=6,
              top_c=RUST, side_cs=[RUST, CLINIC, BONE, RUST])
    # 铰盘：臂的转轴
    iso_prism(im, [(-1, 0), (3.5, 0), (3.5, 4.5), (-1, 4.5)], 3, z0=6,
              top_c=METAL_L, side_cs=[METAL, CONC_D, METAL, METAL])

    # 斜撑：先画，让主梁压在它上面 → 读成三角桁架，不是一根光棍
    beam(im, 14, 19, 13, 14, core=CONC_D, up=METAL, down=CLINIC, half=1.0)
    # 主梁：从铰盘斜向前左上举出去
    beam(im, 16, 16, 10, 10, core=METAL, up=METAL_L, down=CONC_D, half=1.5)

    # 叉头：两根不等高的齿从上面岔开，残渣夹在齿间的蹼上。
    # 两件事是实测撞出来的，别退回去：
    #  · 罩子做成「紧凑的封闭块 + 高处一块矩形青绿」= 一张朝左的机器脸（青绿劈成
    #    两块正好当两只眼）。破法：齿必须**越过**残渣往上伸，剪影顶端是岔的不是圆的。
    #  · 青绿必须是不规则的一团，逐行宽度不等。整齐矩形不是眼睛就是屏幕。
    live = set()
    for y, spans in (
        (2, ((4, 5, METAL_L),)),
        (3, ((4, 6, METAL_L),)),
        (4, ((4, 6, METAL_L), (8, 10, METAL))),
        (5, ((4, 6, METAL_L), (7, 10, METAL))),
        (6, ((4, 5, METAL_L), (6, 6, SHADOW), (9, 9, SHADOW), (10, 11, METAL))),
        (7, ((4, 5, METAL_L), (6, 6, SHADOW), (10, 10, SHADOW), (11, 12, METAL))),
        (8, ((4, 5, METAL_L), (6, 6, SHADOW), (10, 10, SHADOW), (11, 12, METAL))),
        (9, ((5, 6, METAL), (9, 9, SHADOW), (10, 12, METAL))),
        (10, ((5, 7, METAL), (8, 8, SHADOW), (9, 12, CONC_D))),
        (11, ((6, 8, METAL), (9, 12, CONC_D))),
        (12, ((7, 9, METAL), (10, 12, CONC_D))),
        (13, ((9, 11, CONC_D),)),
    ):
        for a, b, c in spans:
            hline(im, a, b, y, c)
    for y, (a, b) in ((6, (7, 8)), (7, (7, 9)), (8, (7, 9)), (9, (7, 8))):
        for x in range(a, b + 1):
            put(im, x, y, TEAL_X)
            live.add((x, y))
    stain(im, 12, 20, RUST)
    stain(im, 15, 22, RUST)
    stain(im, 21, 12, WARM_D)

    for (x, y), c in breathe(live, frame, 0xD44).items():
        put(im, x, y, c)
    contact(im, 12)
    return im, live


# ---------------------------------------------------------------------
# 卡 E 抱箍 —— 竖向细高。一根柱从脚盘贯到顶，中段被一副比柱宽的抱箍咬住，
#              残渣在箍的前左面开的口里；两只拧紧耳不对称地挂在箍两端。
# 收容 = 箍抱死 · 控制 = 拧紧耳 · 暴露 = 箍上那道口
# 破「图腾 / 路灯 / 神龛」：柱顶必须**高过**箍。第一版把箍做成柱顶的头，
#   整件立刻读成柱子上顶了个脑袋，青绿口成了两只眼。
# ---------------------------------------------------------------------
def cardE(frame):
    im = new()
    rnd = random.Random(0xE55)

    # 窄脚盘：两级。脚大了就回到矮宽块，那是卡 F 的活
    iso_prism(im, [(-4.2, -3.4), (4.2, -3.4), (4.2, 3.4), (-4.2, 3.4)], 2,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])
    iso_prism(im, [(-3, -2.4), (3, -2.4), (3, 2.4), (-3, 2.4)], 2, z0=2,
              top_c=CONC_M, side_cs=[CLINIC, CLINIC, CONC_D, CLINIC])

    # 柱：一根贯到顶
    iso_prism(im, [(-2.4, -2.4), (2.4, -2.4), (2.4, 2.4), (-2.4, 2.4)], 18, z0=4,
              top_c=METAL, side_cs=[METAL, CLINIC, CONC_M, METAL])
    # 两道细横箍：一像素的环是「人造立柱」最省的证据。
    # 第一版在柱顶侧挂了一块托座，图上读成一个鼓包，整根柱子变成石头，删掉。
    for k in (7, 19):
        for dx in range(-3, 4):
            sx, sy = iso(dx, 2.4)
            if get(im, CX + sx, GROUND - k + sy)[3] >= 32:
                put(im, CX + sx, GROUND - k + sy, METAL_L)
        for dy in range(-3, 4):
            sx, sy = iso(2.4, dy)
            if get(im, CX + sx, GROUND - k + sy)[3] >= 32:
                put(im, CX + sx, GROUND - k + sy, CONC_M)

    # 抱箍：咬在柱子中段。**沿 dx 拉长、进深压薄**，不是一个方块——
    # 45° 下方块的前左面只有「dx 跨度 × 0.5」那么宽，±5 的箍只给到 5 像素，
    # recess 的鳞边 + 内缘过滤会把开口吃到只剩一颗青绿（实测 teal=1）。
    # 拉到 dx ±9 才有 9 像素可用，同时剪影上是细柱中段套一圈宽领。
    BAND_DX, BAND_Z0, BAND_H = 9.0, 9.0, 6.0
    _, _, band = iso_prism(im, [(-BAND_DX, -1.6), (BAND_DX, -1.6),
                                (BAND_DX, 1.6), (-BAND_DX, 1.6)], BAND_H, z0=BAND_Z0,
                           top_c=METAL, side_cs=[METAL, CONC_D, METAL_L, METAL])
    # 拧紧耳：不对称、不等长。两件事都是实测撞出来的：
    #  · 屏幕空间画——1.6 格进深的 iso_prism 侧面不到一像素，会退化成浮在空中的顶面。
    #  · 锚点必须**从箍的几何算**。45° 下箍的左右两端不在同一行（左端高、右端低），
    #    钉死行号的耳朵一改箍就浮空。
    for sign, half in ((1, 1), (-1, 0)):
        sx, sy = iso(BAND_DX * sign, 0)
        ax = int(round(CX + sx))
        ay = int(round(GROUND - BAND_Z0 - BAND_H / 2 + sy))
        for i in (1, 2):
            vline(im, ax + sign * i, ay - half, ay + half + 1,
                  METAL if i == 1 else CONC_D)
        hline(im, ax + sign, ax + sign * 2, ay - half, METAL_L)

    front = poly_cells(band[2])
    live = recess(im, ragged_band(front, 0.12, 0.88, rnd, bite=2), rnd=rnd)

    stain(im, 15, 18, RUST)
    stain(im, 17, 6, RUST)
    stain(im, 20, 13, WARM_D)

    for (x, y), c in breathe(live, frame, 0xE55).items():
        put(im, x, y, c)
    contact(im, 8)
    return im, live


# ---------------------------------------------------------------------
# 卡 F 压槽 —— 贴地矮宽。一个矮槽坐在混凝土上，一块偏心的厚压板压住大半个
#              槽口，只留一段月牙敞着；螺栓不等长地锚在槽沿上，地被压裂。
# 收容 = 槽壁 + 压板 · 控制 = 压板重量 + 螺栓 · 暴露 = 那段月牙
# 破「箱子 / 花盆」：偏心不对称 + 槽沿崩一角 + 地裂是细线不是填实的深椭圆
# ---------------------------------------------------------------------
_F_FLOOR = set()


def cardF(frame):
    im = new()
    rnd = random.Random(0xF66)

    # 槽体：矮宽
    _, _, faces = iso_prism(im, [(-10, -8), (10, -8), (10, 8), (-10, 8)], 5,
                            top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])
    # 槽沿崩掉一角：破对称
    chip = [
        (CX + iso(-10, 2)[0], GROUND - 5 + iso(-10, 2)[1]),
        (CX + iso(-10, 8)[0], GROUND - 5 + iso(-10, 8)[1]),
        (CX + iso(-5, 8)[0], GROUND - 5 + iso(-5, 8)[1]),
    ]
    fill_poly(im, chip, CONC_D)
    for i in range(len(chip)):
        line(im, *chip[i], *chip[(i + 1) % len(chip)], CONC_M)

    # 槽口：顶面内部一块，偏前左
    top_cells = {
        (x, y) for x in range(W) for y in range(H)
        if get(im, x, y)[:3] == CONC_M[:3]
    }
    mouth = {c for c in erode(top_cells, 2) if c[1] >= 12}
    live = recess(im, mouth, lip=METAL_L, rnd=rnd)

    # 压板：压住槽口后半截，露出一段月牙
    iso_prism(im, [(-9, -7), (9, -7), (9, 1.5), (-9, 1.5)], 3, z0=5,
              top_c=METAL, side_cs=[METAL, CONC_D, METAL_L, METAL])
    for dx in range(-9, 10):
        sx, sy = iso(dx, 1.5)
        put(im, CX + sx, GROUND - 8 + sy, METAL_L)
    # 卡杆：横过月牙压住残渣（青绿头顶必须有结构）
    iso_prism(im, [(-9, 4.2), (9, 4.2), (9, 5.4), (-9, 5.4)], 1.2, z0=5.4,
              top_c=METAL_L, side_cs=[METAL, CONC_D, METAL, METAL])
    # 螺栓：不等长，锚在压板上。屏幕空间画 2 像素粗的短桩——
    # 1.4 格进深的 iso_prism 侧面不到一像素，会退化成一颗浮在空中的顶面。
    # 桩高压到 2 格：拔高一根会在剪影上戳出一根天线，这张卡的整个身份是贴地矮宽
    for dx, dy, hh in ((-8, -6, 2), (7, -5, 2), (-1, -1, 1)):
        sx, sy = iso(dx, dy)
        bx, by = int(round(CX + sx)), int(round(GROUND - 8 + sy))
        for k in range(hh):
            put(im, bx, by - k, METAL)
            put(im, bx + 1, by - k, CONC_D)
        put(im, bx, by - hh, METAL_L)
        put(im, bx + 1, by - hh, METAL)

    contact(im, 13)

    # 地被压裂：短、断续、不等长，紧贴槽脚。不画亮断口——
    # 单像素亮点散在离本体好几格的地上会读成噪点，不是裂。
    floor = set()
    for ang, length in ((-14, 3.0), (28, 2.5), (158, 3.5), (202, 2.5), (312, 2.0)):
        a = math.radians(ang)
        n = int(length * 4)
        for i in range(n + 1):
            r = 9.0 + length * i / n
            floor.add((int(round(CX + math.cos(a) * r)),
                       int(round(GROUND + 4 + math.sin(a) * 0.34 * r))))
    floor = {c for c in floor if get(im, c[0], c[1])[3] < 32}
    for x, y in floor:
        put(im, x, y, SHADOW if abs(x - CX) > 11 else INK)
    _F_FLOOR.clear()
    _F_FLOOR.update(floor)

    for x, y in ((8, 21), (23, 17), (12, 14)):
        if get(im, x, y)[3] >= 32:
            put(im, x, y, RUST)
    for x, y in ((20, 11),):
        if get(im, x, y)[3] >= 32:
            put(im, x, y, WARM_D)

    for (x, y), c in breathe(live, frame, 0xF66).items():
        put(im, x, y, c)
    return im, live


# =====================================================================
# 第三轮：再换可分维度。第二轮把体积分布拆成方块 / 横伸 / 竖高 / 贴地，
# 人看到差异了但还没抽。这一轮不再落回那四类——再拆一次体积的
# **开口怎么占空间**：从当中看过去 / 顶上两座峰 / 整件就是圈。
# 三张仍同时起收容、控制、暴露，仍站在开阔混凝土地上，仍 45° 等距。
#
# 判据先写再画（量已在 A–F 上探过：它们 mid_runs 全是 1，apex_two 至多 1，
# 封闭内孔要么 0 要么是卡 C 格栅那 9 格，且卡 C 的 mid_runs 仍是 1）：
#   拱  mid_runs >= 2 且 enclosed == 0 且 arch_open 且 apex_two == 0
#   钳  apex_two >= 2 且 enclosed == 0
#   环  enclosed >= 20 且 mid_runs >= 2
# 方块加一条排除：mid_runs == 1 且 apex_two < 2（否则新卡会落回方块）。
# =====================================================================

# ---------------------------------------------------------------------
# 卡 G 拱 —— 开口占空间。两根不等高的墩，顶上一条压梁把它们拧在一起，
#              当中是通的；残渣卡在梁下那一口里，压力从喉里穿过去。
# 收容 = 卡在咬口里 · 控制 = 压梁 + 偏心螺栓 · 暴露 = 整条喉是敞的
# 主导分量：暴露（从当中看过去）。
# 破「门框 / 神龛」：墩不等高、梁是压条不是横楣、喉里挂的是一团残渣不是一扇门。
# 破「传送门」：青绿只在梁下那一团，不绕喉走一圈。
# ---------------------------------------------------------------------
def cardG(frame):
    im = new()

    # 两墩用各自的屏幕锚点画，避免同一份 footprint 在 45° 下叠成一根。
    # 左矮右高：长短不齐。
    iso_prism(im, [(-3.4, -2.6), (3.4, -2.6), (3.4, 2.8), (-3.4, 2.8)], 11,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D], cx=10)
    iso_prism(im, [(-2.8, -2.4), (3.0, -2.4), (3.0, 2.6), (-2.8, 2.6)], 14,
              top_c=METAL, side_cs=[METAL, CLINIC, METAL_L, METAL], cx=22)

    # 压梁：屏幕空间填面。iso_prism 跨两墩会把喉填实，剪影回到方块。
    beam(im, 10, 11, 22, 8, core=METAL, up=METAL_L, down=CONC_D, half=1.6)
    # 偏心螺栓钉在梁上，2 像素粗
    put(im, 14, 9, METAL_L)
    put(im, 15, 9, METAL)
    put(im, 14, 10, CONC_D)
    put(im, 15, 10, RUST)

    # 咬口挂在梁下正中，金属包一圈再填青绿——不许用近黑去描喉沿。
    live = set()
    catch = [
        (15, 11), (16, 11), (17, 11),
        (14, 12), (15, 12), (16, 12), (17, 12), (18, 12),
        (15, 13), (16, 13), (17, 13),
    ]
    for x, y in catch:
        put(im, x, y, METAL)
    for x, y in ((15, 12), (16, 12), (17, 12), (16, 13)):
        if all(get(im, x + dx, y + dy)[3] >= 32
               for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1))):
            put(im, x, y, TEAL_X)
            live.add((x, y))

    stain(im, 10, 21, RUST)
    stain(im, 22, 10, WARM_D)

    for (x, y), c in breathe(live, frame, 0x677).items():
        put(im, x, y, c)

    # 两只脚必须用同一条接地行。后画的那只如果按「当前最底像素」算，
    # 会把先画的那圈近黑当成底，第二圈更靠下，短墩脚上的墨会爬出接地 3 行。
    feet = [y for y in range(H) for x in range(W) if get(im, x, y)[3] >= 32]
    foot = max(feet) if feet else GROUND
    contact(im, rx=4, cx=10, base=foot)
    contact(im, rx=4, cx=22, base=foot)
    return im, live


# ---------------------------------------------------------------------
# 卡 H 钳 —— 顶上两座峰。一只浇死的脚墩，两臂朝上岔开，残渣夹在丫口；
#              剪影是 Y，不是单柱，也不是往旁边伸的长臂。
# 收容 = 夹在丫口的蹼里 · 控制 = 两臂 + 横栓 · 暴露 = 丫口朝外
# 主导分量：控制（钳住）。
# 破「横伸」：臂往上岔，不往旁边送。破「四条腿 / 虫」：只有两臂，至少 2 像素宽。
# 破「机器脸」：齿越过残渣；青绿不是两块等大矩形。
# 装填：空档丫口是空的；有残渣时一团光点贴在蹼上浮动（1/2/3 档变大变亮）。
# ---------------------------------------------------------------------
def cardH(frame, charge=2):
    im = new()

    iso_prism(im, [(-5.2, -3.8), (5.4, -3.8), (5.4, 4.0), (-5.2, 4.0)], 5,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])

    # 两臂：顶端各 2 像素，几乎同高。3 像素顶会让顶行宽到 6，菱形闸门红。
    fill_poly(im, [(10, 17), (13, 18), (9, 4), (6, 2)], METAL)
    fill_poly(im, [(13, 18), (14, 16), (10, 4), (9, 4)], CONC_D)
    line(im, 6, 2, 8, 3, METAL_L)
    fill_poly(im, [(18, 18), (21, 17), (24, 4), (22, 2)], CONC_M)
    fill_poly(im, [(16, 17), (18, 18), (22, 2), (20, 4)], CONC_D)
    line(im, 22, 2, 24, 4, METAL)
    stain(im, 21, 8, RUST)
    stain(im, 8, 10, RUST)

    # 丫口的蹼要盖过半高，否则 mid_runs 仍是 2，跟拱撞。
    fill_poly(im, [(11, 13), (21, 13), (20, 19), (12, 20)], METAL)
    hline(im, 11, 21, 19, METAL_L)
    stain(im, 12, 19, RUST)

    pocket = [
        (14, 16), (15, 16), (16, 16), (17, 16),
        (14, 17), (15, 17), (16, 17), (17, 17),
        (15, 18), (16, 18),
        (13, 16), (18, 16), (13, 17), (18, 17),
        (14, 15), (15, 15), (16, 15), (17, 15),
        (15, 14), (16, 14),
    ]
    for x, y in pocket:
        if get(im, x, y)[3] >= 32:
            put(im, x, y, CONC_D)
    hold = {
        (x, y) for x, y in pocket
        if get(im, x, y)[3] >= 32
        and all(get(im, x + dx, y + dy)[3] >= 32
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }

    stain(im, 14, 22, RUST)
    stain(im, 20, 13, WARM_D)

    live = charge_light(im, hold, (16, 16), charge, frame, 0x788)
    contact(im, 9)
    return im, live


# ---------------------------------------------------------------------
# 卡 I 环 —— 整件就是圈。一段回收的管立在脚座上，销钉把它钉进混凝土；
#              残渣贴在圈心下沿，压力从圈孔穿过去。
# 收容 = 圈住 · 控制 = 底销 · 暴露 = 圈孔朝观者
# 主导分量：收容（围成一圈）但仍故意留孔。
# 破「门框」：不是两柱一楣，是一段弯管。破「传送门」：孔偏心、亮断口只留一段弧。
# 破「车轮」：没有等分辐条。销钉只钉在底弧上，不穿过圈心。
# 装填：空档圈孔是空的；有残渣时一团光点贴在圈心下沿浮动（1/2/3 档变大变亮）。
# ---------------------------------------------------------------------
def cardI(frame, charge=2):
    im = new()

    iso_prism(im, [(-5.6, -4.0), (5.6, -4.0), (5.6, 4.0), (-5.6, 4.0)], 2.6,
              top_c=CONC_M, side_cs=[CONC_D, CLINIC, CONC_D, CONC_D])

    cx, cy, rx, ry = 16.0, 13.0, 9.2, 10.0
    hcx, hcy, irx, iry = 16.7, 13.5, 4.5, 5.2  # 孔偏心，破满圈门环
    shell, hole = set(), set()
    for y in range(H):
        for x in range(W):
            on = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0
            inn = ((x - hcx) / irx) ** 2 + ((y - hcy) / iry) ** 2 <= 1.0
            if on and not inn:
                shell.add((x, y))
            elif inn and 0 <= x < W:
                hole.add((x, y))
    for x, y in shell:
        if y < cy - 4:
            c = METAL_L
        elif x < cx:
            c = METAL
        elif y > cy + 4:
            c = CONC_M
        else:
            c = CONC_M
        put(im, x, y, c)

    lip = {
        (x, y) for x, y in shell
        if any((x + dx, y + dy) in hole for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }
    # 内沿是剪影（对着孔），不许落近黑，否则就是换色描边。
    for x, y in lip:
        put(im, x, y, METAL)
    for x, y in lip:
        if y < cy - 1 and (x + y) % 2 == 0 and x <= cx + 1:
            put(im, x, y, METAL_L)

    hold = {
        (x, y) for x, y in shell
        if y >= cy - 1
        and (x, y) not in lip
        and (x, y) not in hole
        and all(get(im, x + dx, y + dy)[3] >= 32
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    }

    # 底销：只钉在圈的底弧上，往下进脚座。不穿过圈心。
    bot = max((y for _, y in shell), default=22)
    pins = [(x, y) for x, y in shell if y >= bot - 1 and 14 <= x <= 18]
    for x, y in pins:
        put(im, x, y, RUST)
        if get(im, x, y + 1)[3] >= 32 or y + 1 >= GROUND:
            stain(im, x, y + 1, CONC_D)

    stain(im, 11, 18, RUST)
    stain(im, 20, 16, WARM_D)

    live = charge_light(im, hold, (16, 18), charge, frame, 0x899)
    contact(im, 8)
    return im, live


# =====================================================================
# 闸门
# =====================================================================
def audit(name, frames, live, exempt=frozenset()):
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
    maxy = max(y for _, y, _ in pix)

    changed = set()
    for f in frames[1:]:
        for y in range(H):
            for x in range(W):
                if f.getpixel((x, y)) != im.getpixel((x, y)):
                    changed.add((x, y))
    stray = sorted(changed - live)

    teal_cells = [(x, y) for x, y, c in pix if is_teal(c)]
    teal_edge = [
        (x, y) for x, y in teal_cells
        if any((x + dx, y + dy) not in occ for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    ]
    # 防香炉：每个 teal 像素正上方必须被不透明的非 teal 结构盖住
    spill = []
    for x, y in teal_cells:
        capped = any(
            (x, yy) in cmap and not is_teal(cmap[(x, yy)]) for yy in range(y - 1, -1, -1)
        )
        if not capped:
            spill.append((x, y))

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
    med = sorted(lum(c) for c in interior)[len(interior) // 2]
    dom, dom_n = Counter(c for _, _, c in sil_up).most_common(1)[0]
    dark_edge_share = 100 * sum(1 for _, _, c in sil_up if lum(c) < 40.0) / len(sil_up)
    dark_on_sil = [(x, y) for x, y, c in sil_up if c in DARK_SET and (x, y) not in exempt]

    # 45° 等距证据：顶面是菱形（顶行窄）+ 左右外缘不竖直
    mat = [(x, y) for x, y, c in pix if not is_teal(c)]
    miny = min(y for _, y in mat)
    top_row_w = len([1 for x, y in mat if y == miny])
    lefts, rights = [], []
    for y in range(miny, maxy - 2):
        row = [x for x, yy in mat if yy == y]
        if row:
            lefts.append(min(row))
            rights.append(max(row))
    slant = max(max(lefts) - min(lefts), max(rights) - min(rights)) if lefts else 0

    off = [c for _, _, c in pix if c not in PALETTE]
    tiers = [(c, n) for c, n in Counter(body).most_common() if 100 * n / len(body) >= 8.0]
    top_body, top_n = Counter(body).most_common(1)[0]
    teal_share = 100 * len(teal_cells) / len(pix)
    dark_share = 100 * sum(1 for c in body if lum(c) <= 30) / len(body)
    bright_share = 100 * sum(1 for c in body if lum(c) >= 70) / len(body)

    checks = [
        ("色全在锁定色板", not off, f"off-palette={len(off)}"),
        ("变化只在声明的活层里", not stray, f"stray={len(stray)} {stray[:4]}"),
        ("单一主体色 < 45%", 100 * top_n / len(body) < 45.0, f"{top_body} {100 * top_n / len(body):.1f}%"),
        ("材质层 >= 3 档各 >= 8%", len(tiers) >= 3, f"tiers={len(tiers)}"),
        (
            "对混凝土有黑有亮",
            min(lum(c) for c in body) <= 26.0 and max(lum(c) for c in body) >= 70.0
            and dark_share >= 10.0 and bright_share >= 8.0,
            f"dark={dark_share:.0f}% bright={bright_share:.0f}%",
        ),
        ("青绿只在装置里（不碰背景）", not teal_edge, f"edge={teal_edge[:4]}"),
        ("青绿不溢口沿（防香炉）", not spill, f"spill={spill[:4]}"),
        ("青绿不压全身 < 22%", teal_share < 22.0, f"{teal_share:.1f}%"),
        # 判据换过两次（2026-09-04），两次都是误判，不是放宽。要抓的那件事没变：
        # **整件不许读成一坨暗剪影**（卡 C 第一版主导可见面是最暗档，就是这个病）。
        #   v1「外沿众数亮度 >= 内部中位数 - 4」——在**细高 / 骨架式**对象上误报：
        #      细柱几乎全是外沿，内部样本少且偏亮，合法背光面被判成描边
        #      （卡 E 顶咬实测 dom=46.0 vs 内部中位 60.7）。
        #   v2「外沿众数亮度 >= 40」——判据落在**众数**上，平票时会抖：
        #      卡 D 举出实测 CLINIC 23% 对 METAL 22%，改三颗爪尖就翻红。
        #   v3（现行）改问占比：外沿压在 CONC_D 以下的比例不许接近半数。
        # 描边由下一条「近黑三色不上外沿」承担，两条不重叠。
        (
            "外沿不半数压在暗档（< CONC_D 46）",
            dark_edge_share < 45.0,
            f"暗档外沿={dark_edge_share:.0f}% 众数={dom} lum={lum(dom):.1f} "
            f"share={100 * dom_n / len(sil_up):.0f}%",
        ),
        ("近黑三色不上外沿（接地 3 行除外）", not dark_on_sil, f"n={len(dark_on_sil)} {dark_on_sil[:3]}"),
        ("45° 顶面是菱形（顶行 <= 5）", top_row_w <= 5, f"top_row_w={top_row_w}"),
        ("45° 外缘不竖直（斜量 >= 3）", slant >= 3, f"slant={slant}"),
    ]
    ok = all(c[1] for c in checks)
    print(f"\n[{name}] opaque={len(pix)} body={len(body)} teal={len(teal_cells)}")
    for label, good, msg in checks:
        print(f"   {'OK ' if good else 'BAD'} {label}: {msg}")
    print("   body mix: " + ", ".join(
        f"{c}={100 * n / len(body):.0f}%" for c, n in Counter(body).most_common(6)))
    return ok


# =====================================================================
# 形体类闸门（人 2026-09-04 抓回来的那一条）
#
# 人否掉第一轮的原话：「三个卡本质上是同一个方向只是调整了大小，区分度非常低。」
# 那不是像素问题，是**可分维度选错**——三张都声明了不同的收容手段，但画出来是
# 同一句形体。手段（夹 / 围 / 浇）在 32×32 的剪影上只值几像素纹理差。
#
# 所以每张卡必须声明形体类，机器验证数值真的落在那一类里。
# 前四类量 aspect / shear（体积分布）。第三轮三张量开口拓扑：
#   mid_runs  = 材质包围盒半高那一行的不透明 x 段数（去接地、去近黑）
#   apex_two  = 顶上 3 行里有几行是 2 段及以上（两座峰）
#   enclosed  = 不与画布边 4 连通的透明格（真正的内孔）
#   arch_open = 半高处两段之间的缝一直通到包围盒底
# 判据先写再画。A–F 探过：mid_runs 全 1，apex_two 至多 1（卡 D 叉头），
# 卡 C 格栅有 9 格假内孔但 mid_runs 仍是 1，所以 enclosed 门槛放在 20。
# =====================================================================
FORM_BANDS = {
    "方块": lambda fp: (
        0.58 <= fp["aspect"] <= 0.90 and abs(fp["shear"]) <= 0.12
        and fp["mid_runs"] == 1 and fp["apex_two"] < 2
    ),
    "横伸": lambda fp: abs(fp["shear"]) >= 0.20,
    "竖高": lambda fp: fp["aspect"] <= 0.56,
    "贴地": lambda fp: fp["aspect"] >= 1.05,
    "拱": lambda fp: (
        fp["mid_runs"] >= 2 and fp["enclosed"] == 0
        and fp["arch_open"] and fp["apex_two"] == 0
    ),
    "钳": lambda fp: fp["apex_two"] >= 2 and fp["enclosed"] == 0,
    "环": lambda fp: fp["enclosed"] >= 20 and fp["mid_runs"] >= 2,
}


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
    px = [(x, y, im.getpixel((x, y))) for y in range(H) for x in range(W)
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

    y_mid = y0 + h // 2
    mid_runs, mid_segs = _x_runs(occ, y_mid, x0, x1)
    top3 = [_x_runs(occ, y, x0, x1)[0] for y in range(y0, min(y1, y0 + 2) + 1)]
    apex_two = sum(1 for r in top3 if r >= 2)

    trans = {(x, y) for y in range(H) for x in range(W)
             if im.getpixel((x, y))[3] < 32}
    seen = set()
    q = deque()
    for x in range(W):
        for y in (0, H - 1):
            if (x, y) in trans:
                q.append((x, y))
                seen.add((x, y))
    for y in range(H):
        for x in (0, W - 1):
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
    enclosed = sum(1 for x, y in (trans - seen) if x0 <= x <= x1 and y0 <= y <= y1)

    arch_open = False
    if mid_runs >= 2:
        gx0, gx1 = mid_segs[0][1] + 1, mid_segs[1][0] - 1
        if gx0 <= gx1:
            gap_ok = True
            for y in range(y_mid, y1 + 1):
                if not any((x, y) not in occ for x in range(gx0, gx1 + 1)):
                    gap_ok = False
                    break
            yb = min(H - 1, y1 + 1)
            below = any((x, yb) not in occ for x in range(gx0, gx1 + 1))
            arch_open = gap_ok and below

    return {
        "aspect": aspect, "shear": shear,
        "mid_runs": mid_runs, "apex_two": apex_two,
        "enclosed": enclosed, "arch_open": arch_open,
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
            elif p[:3] in (RUST[:3], EARTH[:3], BONE[:3], WARM_D[:3]):
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


CARDS = (("a", "压钳", cardA, frozenset(), "方块"),
         ("b", "笼斗", cardB, frozenset(), "方块"),
         ("c", "浇墩", cardC, _C_FLOOR, "方块"),
         ("d", "举出", cardD, frozenset(), "横伸"),
         ("e", "抱箍", cardE, frozenset(), "竖高"),
         ("f", "压槽", cardF, _F_FLOOR, "贴地"),
         ("g", "拱", cardG, frozenset(), "拱"),
         ("h", "钳", cardH, frozenset(), "钳"),
         ("i", "环", cardI, frozenset(), "环"))

all_ok = True
FINGERPRINTS = []
CHARGE_KEYS = {"h", "i"}
CHARGE_TIERS = 4  # 0 空 + 1/2/3 档


def _teal_count(im):
    return sum(
        1 for y in range(H) for x in range(W)
        if im.getpixel((x, y))[3] >= 32 and is_teal(im.getpixel((x, y))[:3])
    )


def _teal_mean_lum(im):
    cells = [
        lum(im.getpixel((x, y))[:3])
        for y in range(H) for x in range(W)
        if im.getpixel((x, y))[3] >= 32 and is_teal(im.getpixel((x, y))[:3])
    ]
    return sum(cells) / len(cells) if cells else 0.0


def _occ_mask(im):
    return tuple(
        (x, y)
        for y in range(H) for x in range(W)
        if im.getpixel((x, y))[3] >= 32
    )


def emit_card(key, label, fn, exempt, form):
    global all_ok
    name = f"offering-{key}"
    if key in CHARGE_KEYS:
        bands = []
        for charge in range(CHARGE_TIERS):
            pairs = [fn(f, charge) for f in range(FRAMES)]
            frames = [p[0] for p in pairs]
            live = set()
            for _, lv in pairs:
                live |= lv
            bands.append((charge, frames, live))
            all_ok &= audit(f"卡 {key.upper()} {label} 装填{charge}", frames, live, exempt)
        counts = [_teal_count(bands[c][1][0]) for c in range(CHARGE_TIERS)]
        lums = [_teal_mean_lum(bands[c][1][0]) for c in range(CHARGE_TIERS)]
        occs = [_occ_mask(bands[c][1][0]) for c in range(CHARGE_TIERS)]
        charge_ok = (
            counts[0] == 0
            and counts[1] < counts[2] < counts[3]
            and lums[1] < lums[2] < lums[3]
            and all(o == occs[0] for o in occs[1:])
        )
        all_ok &= charge_ok
        print(
            f"   {'OK ' if charge_ok else 'BAD'} 装填三档（空=0、个数升、亮度升、剪影钉死）: "
            f"n={counts} lum={['%.1f' % v for v in lums]} "
            f"occ_lock={all(o == occs[0] for o in occs[1:])}"
        )
        sheet = Image.new("RGBA", (W * FRAMES * CHARGE_TIERS, H), (0, 0, 0, 0))
        for charge, frames, _ in bands:
            for i, f in enumerate(frames):
                sheet.paste(f, ((charge * FRAMES + i) * W, 0))
        preview_frames = bands[2][1]
        fp_im = bands[0][1][0]
    else:
        pairs = [fn(f) for f in range(FRAMES)]
        preview_frames = [p[0] for p in pairs]
        live = set()
        for _, lv in pairs:
            live |= lv
        all_ok &= audit(f"卡 {key.upper()} {label}", preview_frames, live, exempt)
        sheet = Image.new("RGBA", (W * FRAMES, H), (0, 0, 0, 0))
        for i, f in enumerate(preview_frames):
            sheet.paste(f, (i * W, 0))
        fp_im = preview_frames[0]

    preview_frames[0].save(os.path.join(ANIM, f"{name}.png"))
    sheet_path = os.path.join(ANIM, f"{name}-sheet.png")
    sheet.save(sheet_path)
    preview_frames[0].resize((W * 3, H * 3), Image.NEAREST).save(
        os.path.join(PREVIEW, f"{name}-3x.png"))
    preview_frames[0].convert("RGB").save(
        os.path.join(ANIM, f"{name}.gif"), save_all=True,
        append_images=[f.convert("RGB") for f in preview_frames[1:]],
        duration=int(1000 / FPS), loop=0)
    with open(os.path.join(ANIM, f"{name}.json"), "w", encoding="utf-8") as fh:
        json.dump({"name": name, "label": label, "frameWidth": W, "frameHeight": H,
                   "frames": FRAMES * (CHARGE_TIERS if key in CHARGE_KEYS else 1),
                   "fps": FPS, "camera": "45deg isometric",
                   "form": form,
                   **({"chargeTiers": CHARGE_TIERS} if key in CHARGE_KEYS else {})},
                  fh, ensure_ascii=False, indent=2)
    shutil.copyfile(sheet_path, os.path.join(PUBLIC, f"{name}-sheet.png"))
    FINGERPRINTS.append((key, label, form, form_fingerprint(fp_im)))


for key, label, fn, exempt, form in CARDS:
    emit_card(key, label, fn, exempt, form)

print("\n[形体类] 声明的方向必须在数值上真的成立")
for key, label, form, fp in FINGERPRINTS:
    good = FORM_BANDS[form](fp)
    all_ok &= good
    print(
        f"   {'OK ' if good else 'BAD'} 卡 {key.upper()} {label} 声明「{form}」: "
        f"aspect={fp['aspect']:.2f} shear={fp['shear']:+.3f} "
        f"mid_runs={fp['mid_runs']} apex_two={fp['apex_two']} "
        f"enclosed={fp['enclosed']} arch_open={fp['arch_open']}"
    )
    if form in ("拱", "钳", "环") and FORM_BANDS["方块"](fp):
        all_ok = False
        print(f"   BAD 卡 {key.upper()} 谎称成方块居然绿了")
_forms = {f for _, _, f, _ in FINGERPRINTS}
print(f"   覆盖到的形体类：{len(_forms)} / {len(FORM_BANDS)} —— {'、'.join(sorted(_forms))}")
if FORM_BANDS["方块"](next(fp for k, _, f, fp in FINGERPRINTS if k == "d")):
    all_ok = False
    print("   BAD 卡 D 谎称成方块居然绿了")
else:
    print("   OK  谎称测试：卡 D 当成方块是红的")
_ghi_ok = True
for key in ("g", "h", "i"):
    fp = next(fp for k, _, f, fp in FINGERPRINTS if k == key)
    if FORM_BANDS["方块"](fp):
        all_ok = False
        _ghi_ok = False
        print(f"   BAD 谎称测试：卡 {key.upper()} 当成方块居然绿了")
if _ghi_ok:
    print("   OK  谎称测试：卡 G / H / I 当成方块都是红的")

# 对照图：九卡 3×3，6× 贴在混凝土色块上。速看用，真底是练习场与净化点
S = 6
PAD = 10
COLS = 3
ROWS = (len(CARDS) + COLS - 1) // COLS
cw = (W * S + PAD) * COLS + PAD
ch = (H * S + PAD) * ROWS + PAD
board = Image.new("RGB", (cw, ch), CONC_M[:3])
for y in range(ch):
    for x in range(cw):
        if ((x // (S * 4)) + (y // (S * 4))) % 2 == 0:
            board.putpixel((x, y), CONC_D[:3])
for i, (key, label, fn, _ex, _fm) in enumerate(CARDS):
    card = fn(0)[0].resize((W * S, H * S), Image.NEAREST)
    col, row = i % COLS, i // COLS
    board.paste(card, (PAD + col * (W * S + PAD), PAD + row * (H * S + PAD)), card)
board.save(os.path.join(ANIM, "offering-contact.png"))

if os.environ.get("SHOW_ASCII"):
    for key, label, fn, _ex, _fm in CARDS:
        print(f"\n=== 卡 {key.upper()} {label} ===")
        print(ascii_art(fn(0)[0]))

print("\n机械层" + ("全绿" if all_ok else "有 BAD，未过"))
raise SystemExit(0 if all_ok else 1)
