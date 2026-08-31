"""节点 1 · 核心（CORE）第 2 轮抽卡 —— 深化版

设定：燃烧薪柴的反应装置。薪柴＝取自裂隙的污染物，
      所以火焰是 teal（与污染源同源），不是橙色，也不是原来的蓝色。

第 1 轮（core-a-furnace / core-b-tower / core-c-open）方向获认可但完成度不足，
本轮在保持方向的前提下：
  · 深化工业结构（箍环 / 管道 / 阀门 / 铆钉 / 支架 / 检修梯）
  · 强化"在烧"的读感（火焰分层：外焰暗 teal → 内焰白热）
  · 严格 45° 伪 3D：顶面压缩 0.55、侧面前亮后暗、接地投影

运行：python3 docs/art/review-2026-08-28/gen/core_r2.py
产出目录：docs/art/review-2026-08-28/cards/
"""
import math, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "cards")
OUT = os.path.normpath(OUT)

SQUASH = 0.55          # 45° 顶面透视压缩


def canvas(w, h):
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)


def shade(col, f):
    return tuple(max(0, min(255, int(c * f))) for c in col[:3])


def box(d, x, y, w, h, col, a=255):
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=col + (a,))


def hline(d, x0, x1, y, col, a=255):
    d.line([(x0, y), (x1, y)], fill=col + (a,), width=1)


def vline(d, x, y0, y1, col, a=255):
    d.line([(x, y0), (x, y1)], fill=col + (a,), width=1)


def disc(d, cx, cy, r, col, a=255):
    if r > 0:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col + (a,))


def ring(d, cx, cy, r, col, w=1, a=255):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col + (a,), width=w)


def hex_top(cx, cy, r, sq=SQUASH):
    return [(cx + r * math.cos(math.radians(60 * i - 90)),
             cy + r * math.sin(math.radians(60 * i - 90)) * sq) for i in range(6)]


def prism(d, pts, height, top_col, front_col, back_col, edge_col=None, cy=0):
    """45° 柱体：顶面 pts 向下拉出侧面。后侧额外压暗，确保明度层次 ≥30。"""
    front_col = shade(front_col, 0.95)
    back_col = shade(back_col, 0.74)
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        if abs(y2 - y1) < 0.5 and abs(x2 - x1) < 0.5:
            continue
        col = front_col if (y1 + y2) / 2 > cy else back_col
        d.polygon([(x1, y1), (x2, y2), (x2, y2 + height), (x1, y1 + height)],
                  fill=col + (255,))
    d.polygon(pts, fill=top_col + (255,))
    if edge_col:
        d.line(pts + [pts[0]], fill=edge_col + (255,), width=1)


def ground_shadow(d, cx, y, w, h=3, a=75):
    d.ellipse([cx - w / 2, y, cx + w / 2, y + h], fill=(0, 0, 0) + (a,))


# 调色板（沿用项目）
CONC_D = (0x2c, 0x2e, 0x33)
CONC_M = (0x3a, 0x3d, 0x42)
METAL = (0x4a, 0x4e, 0x55)
METAL_L = (0x5a, 0x5f, 0x66)
METAL_H = (0x6e, 0x74, 0x7c)
SHADOW = (0x22, 0x26, 0x2c)
# 火焰（teal，与污染源同源）
FLAME_OUT = (0x1a, 0x6b, 0x5c)
FLAME_MID = (0x2a, 0xe6, 0xc8)
FLAME_HOT = (0x7f, 0xff, 0xee)
FLAME_WHT = (0xdf, 0xff, 0xf8)
FLAME_DEEP = (0x0e, 0x26, 0x2a)
GLASS = (0x0e, 0x20, 0x2a)


def flame(d, cx, base_y, w, h):
    """teal 火焰：外焰暗 → 中焰亮 → 内焰白热，顶部收窄。"""
    for i in range(h):
        t = i / max(h - 1, 1)
        hw = max(1, int(w * (1 - t * 0.6)))
        col = FLAME_OUT if t < 0.45 else FLAME_MID
        hline(d, cx - hw, cx + hw, base_y - i, col, 215)
    disc(d, cx, base_y - int(h * 0.55), 1, FLAME_HOT)
    disc(d, cx, base_y - int(h * 0.8), 1, FLAME_WHT)


def save(img, name):
    img.save(os.path.join(OUT, name + ".png"))
    print("  →", name, img.size)


# ---------------------------------------------------------------- 方案 A'
def core_a2_furnace():
    """A' 炉膛式（深化）：观察窗收窄让出结构空间，补箍环/管道/阀门/铆钉。"""
    img, d = canvas(32, 40)
    ground_shadow(d, 16, 36, 26)
    base = hex_top(16, 29, 13)
    prism(d, base, 6, CONC_M, CONC_D, SHADOW, METAL, cy=29)
    body = hex_top(16, 22, 9, 0.62)
    prism(d, body, 13, CONC_M, CONC_D, SHADOW, METAL, cy=22)
    for ly in (18, 26):                       # 炉体箍环
        hline(d, 8, 24, ly, METAL)
    box(d, 13, 26, 6, 6, GLASS)               # 观察窗（收窄）
    flame(d, 16, 31, 2, 5)
    d.line([(12, 25), (20, 25), (20, 32), (12, 32), (12, 25)], fill=METAL + (255,), width=1)
    hline(d, 12, 20, 29, METAL)               # 窗棂
    box(d, 14, 14, 4, 5, METAL)               # 顶部排气
    box(d, 13, 12, 6, 2, METAL_H)
    disc(d, 16, 11, 1, FLAME_MID)             # 排气口逸出的 teal
    box(d, 24, 27, 6, 3, CONC_D)              # 侧面燃料输入管（内缩，不贴右边界）
    hline(d, 24, 29, 28, METAL)
    box(d, 6, 24, 2, 6, CONC_D)               # 左侧阀门
    disc(d, 7, 27, 1, METAL_H)
    for bx in (8, 13, 18, 23):                # 底座铆钉
        disc(d, bx, 32, 1, METAL_H)
    return img


# ---------------------------------------------------------------- 方案 B'
def core_b2_tower():
    """B' 塔式（深化）：补支撑支架与检修梯，让下半部不再是废空间。"""
    img, d = canvas(32, 40)
    ground_shadow(d, 16, 36, 22)
    base = hex_top(16, 31, 11)
    prism(d, base, 4, CONC_M, CONC_D, SHADOW, METAL, cy=31)
    body = hex_top(16, 23, 7, 0.6)
    prism(d, body, 13, CONC_M, CONC_D, SHADOW, METAL, cy=23)
    for ly in (19, 25, 31):                   # 三道箍环
        hline(d, 10, 22, ly, METAL)
    box(d, 14, 11, 4, 8, METAL)               # 烟囱（延长至与炉体相接，避免塔身断开）
    box(d, 13, 9, 6, 2, METAL_H)
    for i in range(3):                        # 顶部溢出的火舌
        flame(d, 15 + i, 9, 1, 3 + i)
    box(d, 13, 28, 6, 4, GLASS)               # 底部观察窗
    disc(d, 16, 31, 2, FLAME_OUT)
    disc(d, 16, 30, 1, FLAME_MID)
    d.line([(12, 27), (20, 27), (20, 32), (12, 32), (12, 27)], fill=METAL + (255,), width=1)
    vline(d, 25, 20, 32, METAL)               # 侧面燃料管
    box(d, 24, 19, 3, 3, METAL_L)
    for sx in (9, 23):                        # 两侧支撑支架（斜撑）
        d.line([(sx, 34), (sx + (3 if sx < 16 else -3), 26)], fill=METAL + (200,), width=1)
    for ly in range(20, 33, 3):               # 检修梯横档
        hline(d, 7, 9, ly, METAL_L)
    vline(d, 7, 20, 33, METAL)
    vline(d, 9, 20, 33, METAL)
    return img


# ---------------------------------------------------------------- 方案 C'
def core_c2_open():
    """C' 开放式（深化）：炉壁做内外分层（厚度），火焰收束，补加料口。"""
    img, d = canvas(32, 40)
    ground_shadow(d, 16, 36, 26)
    base = hex_top(16, 26, 13)                # 整体上移 3px，压缩顶部留白
    prism(d, base, 5, CONC_M, CONC_D, SHADOW, METAL, cy=26)
    rim = hex_top(16, 21, 11, 0.6)            # 炉口外沿（放大 1px，更饱满）
    prism(d, rim, 9, METAL, CONC_D, SHADOW, METAL_H, cy=21)
    inner = hex_top(16, 21, 8, 0.6)           # 炉膛内壁（凹陷）
    d.polygon(inner, fill=FLAME_DEEP + (255,))
    d.line(inner + [inner[0]], fill=METAL + (255,), width=1)
    for i in range(3):                        # 炉内三束火（收束规模）
        flame(d, 13 + i * 3, 24, 1, 4 + i)
    disc(d, 16, 23, 4, FLAME_OUT, 110)        # 炉膛辉光
    for i in range(6):                        # 顶沿固定卡榫
        a = math.radians(60 * i - 90)
        box(d, int(16 + 11 * math.cos(a)) - 1,
            int(21 + 6.6 * math.sin(a)) - 1, 3, 2, METAL_H)
    box(d, 25, 25, 6, 3, CONC_D)              # 侧面加料口（内缩，不贴边）
    hline(d, 25, 30, 26, METAL)
    box(d, 4, 24, 3, 4, CONC_D)               # 左侧出渣口
    box(d, 4, 24, 3, 1, METAL)
    for bx in (9, 16, 23):                    # 底座铆钉
        disc(d, bx, 29, 1, METAL_H)
    return img


ALL = [
    ("core-a2-furnace", core_a2_furnace),
    ("core-b2-tower", core_b2_tower),
    ("core-c2-open", core_c2_open),
]

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("节点1 核心 · 第2轮抽卡")
    for n, fn in ALL:
        save(fn(), n)
    print("完成 →", OUT)
