#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 PNG 转成字符画，让我能真正"看到"图，不再盲画。
用法: python3 see.py <path> [宽度] [高度]
字符: 空=透明/黑  . : - = + # =灰阶由暗到亮   t/T=teal暗/亮   O=暖色
"""
from PIL import Image
import sys

def art(path, w=None, h=None):
    im = Image.open(path).convert('RGBA')
    if w:
        im = im.resize((w, h or w), Image.NEAREST)
    W, H = im.size
    rows = []
    for y in range(H):
        row = ''
        for x in range(W):
            r, g, b, a = im.getpixel((x, y))
            if a < 32:
                row += ' '
                continue
            lum = 0.299*r + 0.587*g + 0.114*b
            if g > r + 25 and b > r + 15:           # teal：r 低、g/b 都高（g≈b，不能判 g>b）
                row += 'T' if lum > 45 else 't'
            elif r > g + 18 and r > b + 25:         # 暖色
                row += 'O'
            elif lum < 22: row += ' '
            elif lum < 34: row += '.'
            elif lum < 46: row += ':'
            elif lum < 58: row += '-'
            elif lum < 70: row += '='
            elif lum < 84: row += '+'
            else: row += '#'
        rows.append(row)
    return '\n'.join(rows)

if __name__ == '__main__':
    p = sys.argv[1]
    w = int(sys.argv[2]) if len(sys.argv) > 2 else None
    h = int(sys.argv[3]) if len(sys.argv) > 3 else None
    im = Image.open(p)
    print(f"# {p}  原尺寸 {im.size[0]}x{im.size[1]}" + (f"  -> 显示 {w}x{h or w}" if w else ""))
    print(art(p, w, h))
