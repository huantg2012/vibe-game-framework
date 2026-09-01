#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
储藏 STORAGE 抽卡 —— 收容三卡（机制已锁：关住才能折算）

三张完整组合，不是换箱子外壳：
  C1 顶压观察井  封闭方量 + 顶缝看得见内容物在顶玻璃
  C2 加压封舱    立式罐 + 箍压 + 只从缝里漏光
  C3 分匣封存    三只互不混的密封安瓿，错相脉动

画布 32×36。真等距（旋转 45° + y 压缩 0.55）。8 帧 / 8fps。
配色故意走多族：冷金属 + 铜/赭材料 + 暖功能灯 + 青绿被关物。
禁止 real_tools.shade() 的灰阶量化——那会把色相掐死。
"""
from __future__ import annotations

import json
import math
import os
import random
from PIL import Image

W, H = 32, 36
K = 0.55
FRAMES = 8
FPS = 8
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "cards"))
ANIM = os.path.join(OUT, "anim")
os.makedirs(ANIM, exist_ok=True)

# —— 锁定色板里能对上的族（不新开格）——
VOID = (0x08, 0x0A, 0x0C, 255)
INK = (0x0D, 0x11, 0x14, 255)
SLATE_X = (0x15, 0x1A, 0x1E, 255)
SLATE_D = (0x1E, 0x22, 0x28, 255)
SLATE_M = (0x2C, 0x2E, 0x33, 255)
SLATE_L = (0x3A, 0x3D, 0x42, 255)
METAL = (0x4A, 0x4E, 0x55, 255)
METAL_L = (0x5A, 0x5F, 0x66, 255)

EARTH = (0x50, 0x46, 0x3C, 255)      # debris-earth
RUST = (0x5D, 0x48, 0x3E, 255)       # debris-rust
WOOD = (0x4F, 0x48, 0x35, 255)       # debris-wood
EARTH_D = (0x2A, 0x1F, 0x1C, 255)
EARTH_X = (0x2A, 0x24, 0x20, 255)

WARM_X = (0x2A, 0x20, 0x18, 255)
WARM_D = (0x5A, 0x3A, 0x1C, 255)
WARM_M = (0x8A, 0x5C, 0x2A, 255)     # warm-dim
WARM_L = (0xC4, 0x87, 0x3A, 255)     # warm-glow
WARM_HOT = (0xE0, 0xA8, 0x48, 255)

TEAL_X = (0x0E, 0x4A, 0x3F, 255)
TEAL_D = (0x1A, 0x6B, 0x5C, 255)
TEAL_M = (0x1A, 0xAD, 0x96, 255)
TEAL_L = (0x2A, 0xE6, 0xC8, 255)
TEAL_HOT = (0x3C, 0xFF, 0xD4, 255)

SICK = (0x4A, 0x6B, 0x3A, 255)       # 病绿，仅 C3 中罐：被关物互不混
SICK_L = (0x6A, 0x88, 0x40, 255)
COPPER = (0x8A, 0x5C, 0x2A, 255)
COPPER_L = (0xC4, 0x87, 0x3A, 255)
WARN = (0xB8, 0x90, 0x40, 255)       # 中等/临界赭
DANGER = (0xCC, 0x33, 0x33, 255)     # 仅作针尖，极小

GROUND = (0x18, 0x1C, 0x21, 255)


def new():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


def put(im, x, y, c):
    xi, yi = int(round(x)), int(round(y))
    if 0 <= xi < W and 0 <= yi < H:
        im.putpixel((xi, yi), c)


def hline(im, a, b, y, c):
    for x in range(int(round(min(a, b))), int(round(max(a, b))) + 1):
        put(im, x, y, c)


def vline(im, x, a, b, c):
    for y in range(int(round(min(a, b))), int(round(max(a, b))) + 1):
        put(im, x, y, c)


def rect(im, x0, y0, x1, y1, c):
    for y in range(int(round(y0)), int(round(y1)) + 1):
        hline(im, x0, x1, y, c)


def iso(dx, dy):
    return (dx - dy) * 0.5, (dx + dy) * 0.5 * K


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


def line(im, x0, y0, x1, y1, c):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) or 1
    for i in range(n + 1):
        put(im, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, c)


def iso_prism(im, fp, cx, cyg, h, top_c, side_cs, edge=SLATE_X):
    """核心 v6 同一套：整面分色，侧面不得与顶面同亮，否则斜面消失。"""
    proj = [iso(dx, dy) for dx, dy in fp]
    top = [(cx + sx, cyg - h + sy) for sx, sy in proj]
    bot = [(cx + sx, cyg + sy) for sx, sy in proj]
    n = len(fp)
    for i in range(n):
        j = (i + 1) % n
        if (proj[i][1] + proj[j][1]) / 2 <= 0:
            continue
        fill_poly(im, [top[i], top[j], bot[j], bot[i]], side_cs[i % len(side_cs)])
        line(im, top[i][0], top[i][1], top[j][0], top[j][1], edge)
        line(im, bot[i][0], bot[i][1], bot[j][0], bot[j][1], edge)
        line(im, top[i][0], top[i][1], bot[i][0], bot[i][1], edge)
    fill_poly(im, top, top_c)
    for i in range(n):
        j = (i + 1) % n
        line(im, top[i][0], top[i][1], top[j][0], top[j][1], edge)
    return top, bot


def iso_cyl(im, cx, cyg, rx, ry, h, left_c, mid_c, right_c, top_c, top_hi):
    """等距圆柱：左右壁分色 + 顶椭圆。"""
    for y in range(int(cyg - h), int(cyg) + 1):
        half = rx * math.sqrt(max(0.0, 1.0 - 0.0))
        for dx in range(-int(rx), int(rx) + 1):
            if abs(dx) > rx:
                continue
            if dx < -rx * 0.28:
                c = left_c
            elif dx > rx * 0.28:
                c = right_c
            else:
                c = mid_c
            put(im, cx + dx, y, c)
    # 顶盖椭圆
    for dy in range(-int(ry) - 1, int(ry) + 2):
        for dx in range(-int(rx) - 1, int(rx) + 2):
            if (dx / max(0.4, rx)) ** 2 + (dy / max(0.35, ry)) ** 2 <= 1.02:
                c = top_hi if dx < 0 else top_c
                put(im, cx + dx, cyg - h + dy, c)
    # 底椭圆暗边
    for dy in range(-int(ry * 0.6), int(ry) + 1):
        for dx in range(-int(rx), int(rx) + 1):
            if (dx / max(0.4, rx)) ** 2 + (dy / max(0.35, ry)) ** 2 <= 1.0:
                if im.getpixel((int(cx + dx), int(min(H - 1, cyg + dy))))[3] == 0:
                    put(im, cx + dx, cyg + dy, SLATE_X)
    return cyg - h


def lamp(im, x, y, t, phase=0.0, size=3):
    on = ((t + phase) % 1.0) < 0.68
    cx, cy = x + (size - 1) / 2.0, y + (size - 1) / 2.0
    R = size / 2.0 + 1.4
    for iy in range(int(cy - R) - 1, int(cy + R) + 2):
        for ix in range(int(cx - R) - 1, int(cx + R) + 2):
            d = math.hypot(ix - cx, iy - cy)
            if d > R:
                continue
            if on:
                if d <= 0.55:
                    c = WARM_HOT
                elif d <= 1.2:
                    c = WARM_L
                elif d <= 2.0:
                    c = WARM_M
                else:
                    c = WARM_D
            else:
                if d > R - 1.2:
                    continue
                c = WARM_X
            put(im, ix, iy, c)


def contact_shadow(im, cx, cy, rx, ry):
    for dx in range(-int(rx), int(rx) + 1):
        for dy in range(-int(ry), int(ry) + 1):
            d = (dx / max(0.3, rx)) ** 2 + (dy / max(0.3, ry)) ** 2
            if d <= 1.0:
                put(im, cx + dx, cy + dy, VOID if d > 0.55 else INK)


def warn_band(im, x0, x1, y, t, phase=0.0):
    n = int(x1 - x0) + 1
    for i in range(n):
        on = ((t + i / max(1, n) + phase) % 1.0) < 0.58
        if i == 0 or i == n - 1:
            c = WARM_D if on else WARM_X
        else:
            c = WARN if on else WARM_D
        put(im, x0 + i, y, c)


# =====================================================================
# C1 顶压观察井
# =====================================================================
def card1(frame, frames):
    """封闭方量。内容物从内部顶着顶缝，不是侧窗流水（那是净化器）。"""
    im = new()
    t = frame / frames
    contact_shadow(im, 16, 33, 11, 2)

    # 土色座：材料色，打破灰
    iso_prism(
        im,
        [(-11, 6), (11, 6), (11, -6), (-11, -6)],
        16, 32, 4,
        top_c=EARTH,
        side_cs=[EARTH_X, EARTH_D],
        edge=EARTH_X,
    )

    # 井体：左暗右中、顶亮 —— 菱形必须一眼读出
    top, _ = iso_prism(
        im,
        [(-8, 7), (8, 7), (8, -7), (-8, -7)],
        16, 28, 13,
        top_c=SLATE_L,
        side_cs=[SLATE_X, SLATE_M],
        edge=INK,
    )

    # 铜箍：左右可见面各一条（材料，不是灯）
    hline(im, 7, 14, 22, COPPER)
    hline(im, 7, 14, 23, COPPER_L)
    hline(im, 18, 25, 22, WARM_D)
    hline(im, 18, 25, 23, COPPER)

    # 顶缝：嵌在顶面菱形里的更深菱形
    slit = [(16, 13), (21, 16), (16, 19), (11, 16)]
    fill_poly(im, slit, INK)
    inner = [(16, 14), (20, 16), (16, 18), (12, 16)]
    fill_poly(im, inner, TEAL_X)

    # 顶压鼓包：沿缝走一圈，亮脊换位（帧差要大）
    ang = t * 2 * math.pi
    bx = 16 + int(round(3.6 * math.sin(ang)))
    by = 16 + int(round(1.6 * math.cos(ang)))
    for dy in range(-2, 3):
        for dx in range(-3, 4):
            if abs(dx) + abs(dy) <= 3:
                put(im, bx + dx, by + dy, TEAL_D)
    put(im, bx, by, TEAL_L)
    put(im, bx + (1 if math.cos(ang) > 0 else -1), by, TEAL_HOT)
    # 被压回去的余波
    put(im, 13 + int((t * 7) % 6), 16, TEAL_M)
    put(im, 19 - int((t * 7) % 6), 17, TEAL_D)

    # 玻璃冷高光
    put(im, 19, 15, METAL_L)
    put(im, 13, 17, SLATE_M)

    # 四角铜卡钉在菱形顶面
    for (px, py) in ((11, 14), (21, 14), (11, 20), (21, 20)):
        put(im, px, py, COPPER_L)
        put(im, px + 1, py, COPPER)

    put(im, 24, 25, RUST)
    put(im, 24, 26, RUST)
    lamp(im, 22, 18, t, 0.0, size=3)
    put(im, 8, 19, METAL_L if (frame % 4) < 2 else METAL)
    return im


# =====================================================================
# C2 加压封舱
# =====================================================================
def card2(frame, frames):
    """立式罐。没有大窗。箍在呼吸，缝在漏压。"""
    im = new()
    t = frame / frames
    contact_shadow(im, 16, 33, 10, 2)

    iso_prism(
        im,
        [(-9, 5), (9, 5), (9, -5), (-9, -5)],
        16, 32, 3,
        top_c=EARTH,
        side_cs=[EARTH_X, EARTH_D],
        edge=EARTH_X,
    )

    iso_cyl(
        im, 16, 29,
        rx=7.4, ry=3.2, h=16,
        left_c=SLATE_X, mid_c=SLATE_D, right_c=SLATE_M,
        top_c=SLATE_L, top_hi=METAL_L,
    )

    shift = 1 if (frame % 4) >= 2 else 0
    for y, col in ((16, COPPER_L), (22, COPPER), (27, WARM_D)):
        hline(im, 10 + shift, 22 + shift, y, col)
        put(im, 9 + shift, y, SLATE_X)
        put(im, 23 + shift, y, METAL)

    # 赭带：这张卡的配色签名
    warn_band(im, 10, 22, 19, t, 0.0)
    warn_band(im, 10, 22, 20, t, 0.12)

    # 竖缝压力光往上顶（被按住的溢散）
    seam_x = 20
    head = 27 - int((t * 8) % 10)
    for i in range(9):
        y = 27 - i
        if 13 <= y <= 27:
            put(im, seam_x, y, TEAL_X)
    put(im, seam_x, max(13, head), TEAL_HOT)
    put(im, seam_x, max(13, head + 1), TEAL_L)
    put(im, seam_x, max(13, head + 2), TEAL_M)
    put(im, seam_x + 1, max(13, head), TEAL_D if frame % 2 else TEAL_M)

    for (px, py) in ((13, 12), (19, 12), (16, 11)):
        put(im, px, py, METAL_L)
    put(im, 12, 17, SLATE_X)
    put(im, 12 + (1 if math.sin(t * 6.28) > 0 else 0), 17, DANGER)
    lamp(im, 21, 13, t, 0.35, size=3)
    return im


# =====================================================================
# C3 分匣封存
# =====================================================================
def card3(frame, frames):
    """三只密封安瓿，内容物互不混、错相脉动。禁止贯通层板（那是货架）。"""
    im = new()
    t = frame / frames
    contact_shadow(im, 16, 33, 12, 2)

    iso_prism(
        im,
        [(-12, 5), (12, 5), (12, -5), (-12, -5)],
        16, 32, 4,
        top_c=WOOD,
        side_cs=[EARTH_X, EARTH_D],
        edge=EARTH_X,
    )

    # 左右立柱 + 顶梁（门框，不是层架）
    for x in (5, 26):
        vline(im, x, 11, 28, SLATE_M)
        vline(im, x + 1, 11, 28, METAL)
    hline(im, 5, 27, 11, METAL)
    hline(im, 5, 27, 12, SLATE_L)
    hline(im, 6, 26, 10, COPPER)

    def ampule(cx, phase, glass_l, glass, glass_r, juice, juice_hi, juice_hot):
        ph = (t + phase) % 1.0
        # 瓶身：左右分色，中间留 1px 空隙给邻瓶
        for y in range(16, 27):
            put(im, cx - 2, y, glass_l)
            put(im, cx - 1, y, glass)
            put(im, cx, y, glass)
            put(im, cx + 1, y, glass_r)
        # 塞子（封死）
        hline(im, cx - 2, cx + 1, 15, COPPER)
        hline(im, cx - 1, cx, 14, COPPER_L)
        hline(im, cx - 2, cx + 1, 27, SLATE_X)
        # 液面起伏
        level = 18 + int(round(2.0 * math.sin(ph * 6.28)))
        for y in range(level, 27):
            put(im, cx - 1, y, juice)
            put(im, cx, y, juice_hi)
        swirl = cx - 1 + (1 if math.sin(ph * 6.28 + 1.0) > 0 else 0)
        put(im, swirl, min(26, level + 1 + int((ph * 3) % 2)), juice_hot)
        # 单瓶卡箍，禁止画成贯通层板
        clamp = COPPER_L if ph < 0.55 else WARM_D
        put(im, cx - 3, 21, WARM_HOT if ph < 0.55 else WARM_X)
        hline(im, cx - 2, cx + 1, 21, clamp)

    # 左青绿 / 中病绿 / 右锈玻璃+青绿核 —— 三色互不混
    ampule(10, 0.00, TEAL_X, TEAL_D, TEAL_M, TEAL_D, TEAL_M, TEAL_L)
    ampule(16, 0.33, WOOD, SICK, SICK_L, SICK, SICK_L, WARM_L)
    ampule(22, 0.66, EARTH_D, RUST, EARTH, TEAL_X, TEAL_D, TEAL_M)

    lamp(im, 24, 12, t, 0.2, size=3)
    put(im, 16, 10, WARM_HOT if frame % 2 == 0 else WARM_L)
    return im


# =====================================================================
# C4 沉口封井
# =====================================================================
def card4(frame, frames):
    """东西埋在地里，盖子几乎贴地。内容物从底下顶篦子，再被按回去。"""
    im = new()
    t = frame / frames
    contact_shadow(im, 16, 33, 13, 2)

    # 宽矮土台：这是地面装置，不是立柜
    iso_prism(
        im,
        [(-13, 7), (13, 7), (13, -7), (-13, -7)],
        16, 32, 6,
        top_c=EARTH,
        side_cs=[EARTH_X, EARTH_D],
        edge=EARTH_X,
    )

    # 井圈（金属口，加高一截，避免只剩一条缝）
    iso_prism(
        im,
        [(-8, 6), (8, 6), (8, -6), (-8, -6)],
        16, 26, 5,
        top_c=SLATE_L,
        side_cs=[SLATE_X, SLATE_M],
        edge=INK,
    )

    # 篦子：顶面菱形里的横条，不是玻璃窗
    grate = [(16, 18), (24, 23), (16, 28), (8, 23)]
    fill_poly(im, grate, INK)
    for i in range(5):
        y = 20 + i
        hline(im, 11 + (i % 2), 21 - (i % 2), y, RUST if i % 2 else WOOD)
    # 井盖拉环（人侧，证明这是盖子不是柜台）
    hline(im, 14, 18, 17, COPPER_L)
    put(im, 14, 16, COPPER)
    put(im, 18, 16, COPPER)
    put(im, 16, 15, METAL_L)

    # 地底顶压：0–3 上涌，4–7 被按回去
    rise = int(round(4 * abs(math.sin(t * math.pi))))
    for k in range(rise + 1):
        y = 27 - k
        hline(im, 13, 19, y, TEAL_D if k < rise else TEAL_L)
    if rise >= 2:
        put(im, 16, 27 - rise, TEAL_HOT)
        put(im, 15, 28 - rise, TEAL_M)
        put(im, 17, 28 - rise, TEAL_M)
    # 从篦缝挤出的一点（到顶才亮）
    if rise >= 3:
        put(im, 16, 23, TEAL_L)
        put(im, 17, 24, TEAL_HOT if frame % 2 == 0 else TEAL_M)

    # 井圈四角螺栓 + 一侧暖灯
    for (px, py) in ((10, 21), (22, 21), (10, 27), (22, 27)):
        put(im, px, py, METAL_L)
    lamp(im, 23, 19, t, 0.1, size=3)
    # 锈迹沿土台流下
    put(im, 24, 28, RUST)
    put(im, 24, 29, RUST)
    put(im, 23, 30, EARTH_D)
    return im


# =====================================================================
# C5 辐条锁核
# =====================================================================
def card5(frame, frames):
    """从四面把核按住。不是罐子，是一把锁。"""
    im = new()
    t = frame / frames
    contact_shadow(im, 16, 33, 11, 2)

    iso_prism(
        im,
        [(-10, 5), (10, 5), (10, -5), (-10, -5)],
        16, 32, 3,
        top_c=SLATE_D,
        side_cs=[SLATE_X, EARTH_D],
        edge=INK,
    )

    cx, cy = 16, 19
    # 外环（等距压扁）
    for s in range(0, 360, 6):
        a = math.radians(s)
        x = cx + 11 * math.cos(a)
        y = cy + 6 * math.sin(a)
        put(im, x, y, METAL if s % 12 == 0 else SLATE_M)
    for s in range(0, 360, 8):
        a = math.radians(s)
        put(im, cx + 10 * math.cos(a), cy + 5.2 * math.sin(a), SLATE_X)

    # 六根铜辐条：整圈慢转，像在拧紧
    rot = t * 60.0
    for i in range(6):
        a = math.radians(i * 60 + rot)
        for r in range(3, 11):
            x = cx + r * math.cos(a)
            y = cy + r * 0.52 * math.sin(a)
            put(im, x, y, COPPER_L if r < 5 else COPPER)
        put(im, cx + 10 * math.cos(a), cy + 5.2 * math.sin(a), WARM_D)

    # 被锁的核：胀缩，但出不了辐条
    pulse = 2 + (1 if (frame % 4) < 2 else 0)
    for dy in range(-pulse, pulse + 1):
        for dx in range(-pulse, pulse + 1):
            if abs(dx) + abs(dy) <= pulse:
                put(im, cx + dx, cy + dy, TEAL_D)
    put(im, cx, cy, TEAL_HOT)
    put(im, cx - 1, cy, TEAL_L)
    put(im, cx + 1, cy, TEAL_M)

    # 轴心暖灯（锁的人侧）
    lamp(im, 22, 13, t, 0.4, size=3)
    # 环上赭点：锁位标记
    mark = int((t * 6) % 6)
    am = math.radians(mark * 60 + rot)
    put(im, cx + 11 * math.cos(am), cy + 6 * math.sin(am), WARN)
    return im


# =====================================================================
# C6 铅封石匣
# =====================================================================
def card6(frame, frames):
    """横卧石匣。盖子压着，只从咬口渗一点。不是过滤罐。"""
    im = new()
    t = frame / frames
    contact_shadow(im, 16, 33, 13, 2)

    # 匣身：扁、宽、矮
    iso_prism(
        im,
        [(-13, 5), (13, 5), (13, -7), (-13, -7)],
        16, 31, 7,
        top_c=SLATE_M,
        side_cs=[SLATE_X, SLATE_D],
        edge=INK,
    )

    # 铅条：两条竖向捆死
    for x in (11, 21):
        vline(im, x, 20, 29, METAL)
        vline(im, x + 1, 20, 29, METAL_L)
        put(im, x, 20, SLATE_X)
        put(im, x, 29, SLATE_X)

    # 盖：微抬一角再落下（咬合）
    lift = 2 if frame in (2, 3) else (1 if frame in (1, 4) else 0)
    iso_prism(
        im,
        [(-11, 5), (11, 5), (11, -5), (-11, -5)],
        16, 22 - lift, 3,
        top_c=SLATE_L,
        side_cs=[SLATE_D, SLATE_M],
        edge=INK,
    )

    # 咬口渗光：沿盖沿走
    seam_t = (t * 8) % 8
    sx = 10 + int(seam_t * 1.6)
    put(im, sx, 20 - lift, TEAL_L)
    put(im, sx + 1, 20 - lift, TEAL_M)
    put(im, sx + 2, 21 - lift, TEAL_D)
    if lift >= 1:
        put(im, 16, 21 - lift, TEAL_HOT)
        put(im, 15, 22 - lift, TEAL_D)

    # 蜡封（赭，人打的封）
    put(im, 16, 24, WARN)
    put(im, 15, 25, WARM_D)
    put(im, 16, 25, WARM_L)
    put(im, 17, 25, WARM_D)
    put(im, 16, 26, WARM_X)

    lamp(im, 23, 16 - lift, t, 0.25, size=3)
    # 匣角锈
    put(im, 25, 28, RUST)
    put(im, 24, 29, RUST)
    return im


CARDS = (
    ("c1", "顶压观察井", "关着，但你看得见它在顶缝里顶玻璃", card1),
    ("c2", "加压封舱", "用箍把东西按死，只从缝里漏一点光", card2),
    ("c3", "分匣封存", "一份一份关，互不混，才折算得干净", card3),
    ("c4", "沉口封井", "东西在地底下顶篦子，盖子几乎贴地", card4),
    ("c5", "辐条锁核", "从四面把核按住，它胀也出不来", card5),
    ("c6", "铅封石匣", "盖子压着，只从咬口渗一点", card6),
)


def sheet_of(frames_im):
    sheet = Image.new("RGBA", (W * FRAMES, H), (0, 0, 0, 0))
    for i, im in enumerate(frames_im):
        sheet.paste(im, (i * W, 0))
    return sheet


def gif_of(frames_im, path):
    # 评审用 GIF：铺到净化点底色上，避免透明被量化成脏块
    bg = Image.new("RGBA", (W, H), INK)
    seq = []
    for im in frames_im:
        layer = bg.copy()
        layer.alpha_composite(im)
        seq.append(layer.convert("P", palette=Image.ADAPTIVE, colors=48))
    seq[0].save(
        path,
        save_all=True,
        append_images=seq[1:],
        duration=int(1000 / FPS),
        loop=0,
        disposal=2,
    )


def upscale(im, n=3):
    return im.resize((im.width * n, im.height * n), Image.NEAREST)


def frame_delta(a, b):
    n = 0
    for y in range(H):
        for x in range(W):
            if a.getpixel((x, y)) != b.getpixel((x, y)):
                n += 1
    return n


def write_html(meta):
    path = os.path.join(ANIM, "storage-c-cards.html")
    cards_js = json.dumps(meta, ensure_ascii=False)
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>储藏收容三卡</title>
<style>
  body{{margin:0;padding:24px;background:#0d1114;color:#c8cdd4;
    font:13px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}}
  h1{{font-size:17px;margin:0 0 8px}}
  .lead{{color:#8a8f96;margin:0 0 18px}}
  .row{{display:flex;gap:18px;flex-wrap:wrap}}
  .card{{background:#151a1e;border:1px solid #2a2d32;padding:14px;width:200px}}
  .card h3{{margin:0 0 4px;font-size:14px}}
  .desc{{color:#8a8f96;font-size:12px;min-height:48px}}
  .stage{{width:96px;height:108px;margin:10px auto;background:#0d1114;border:1px solid #2a2d32}}
  .sprite{{width:96px;height:108px;image-rendering:pixelated;background-repeat:no-repeat;
    background-size:768px 108px;animation:play 1s steps(8) infinite}}
  @keyframes play{{from{{background-position:0 0}}to{{background-position:-768px 0}}}}
  code{{color:#1aad96}}
</style>
</head>
<body>
<h1>储藏 · 收容三卡</h1>
<p class="lead">32×36 · 8 帧 · 8fps · 放大 3×。机制已锁：收容越完整，溢散越少，折算越高。生产默认仍是橙色方块。</p>
<div class="row" id="row"></div>
<script>
const CARDS = {cards_js};
const row = document.getElementById('row');
for (const c of CARDS) {{
  const el = document.createElement('div');
  el.className = 'card';
  el.innerHTML = `<h3>${{c.id.toUpperCase()}} ${{c.name}}</h3>
    <p class="desc">${{c.read}}</p>
    <div class="stage"><div class="sprite" style="background-image:url('${{c.sheet}}')"></div></div>
    <div style="color:#8a8f96;font-size:11px">帧差 ${{c.delta}} px · <code>${{c.sheet}}</code></div>`;
  row.appendChild(el);
}}
</script>
</body>
</html>
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print("html", path)


def main():
    meta = []
    for key, name, read, fn in CARDS:
        frames = [fn(i, FRAMES) for i in range(FRAMES)]
        sheet = sheet_of(frames)
        sheet_name = f"storage-{key}-sheet.png"
        sheet_path = os.path.join(ANIM, sheet_name)
        sheet.save(sheet_path)
        gif_of(frames, os.path.join(ANIM, f"storage-{key}.gif"))
        upscale(frames[0], 3).save(os.path.join(ANIM, f"storage-{key}-3x.png"))
        frames[0].save(os.path.join(ANIM, f"storage-{key}.png"))
        d = frame_delta(frames[0], frames[4])
        print(f"{key}  {name}  delta0-4={d}px")
        if d < 28:
            print(f"  WARN: motion may be too quiet ({d} < 28)")
        meta.append(
            {
                "id": key,
                "name": name,
                "read": read,
                "sheet": sheet_name,
                "delta": d,
                "frameWidth": W,
                "frameHeight": H,
                "frames": FRAMES,
                "fps": FPS,
            }
        )
        with open(os.path.join(ANIM, f"storage-{key}.json"), "w", encoding="utf-8") as f:
            json.dump(meta[-1], f, ensure_ascii=False, indent=1)
    write_html(meta)


if __name__ == "__main__":
    main()
