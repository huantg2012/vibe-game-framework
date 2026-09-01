#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
45° 判定（能区分"压扁俯视"vs"真等距斜视"）
核心指标 = 顶面菱形度：
  真等距投影下，正方形/多边形 footprint 投影成菱形，顶面左右边界随 y 单调变化（有斜边）。
  v4/v5 只做 y 压缩不旋转，顶面是压扁的矩形，左右边界几乎不变 → 菱形度≈0。
另有：顶面厚度、顶面/侧面明暗差（公约要求 ≥30）
"""
import math, sys, os, importlib.util
from PIL import Image

W, H = 32, 40

def scan_rows(poly):
    """多边形每一行的 (minx, maxx)"""
    ys = [p[1] for p in poly]; n = len(poly)
    rows = []
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys)))+1):
        xs = []
        for i in range(n):
            x0, y0 = poly[i]; x1, y1 = poly[(i+1) % n]
            if (y0 <= y <= y1) or (y1 <= y < y0) or (y1 <= y and y1 == y0):
                if y1 != y0: xs.append(x0 + (y-y0)/(y1-y0)*(x1-x0))
                else: xs += [x0, x1]
        if xs: rows.append((y, min(xs), max(xs)))
    return sorted(rows)

def diamondness(poly):
    """左右边界随 y 变化的总幅度 = 斜边强度。越大越像菱形(真等距)"""
    rows = scan_rows(poly)
    if len(rows) < 3: return 0.0, 0.0, 0
    lefts = [r[1] for r in rows]; rights = [r[2] for r in rows]
    return (max(lefts)-min(lefts) + max(rights)-min(rights)) / 2.0, \
           max(r[2]-r[1] for r in rows), len(rows)

def lum(c): return 0.299*c[0] + 0.587*c[1] + 0.114*c[2]

def topface_poly(script, nm, prism):
    """按脚本的投影方式重建顶面多边形"""
    fp, cx, cy, h, warp = prism[:5]                 # 兼容 5/7 元素两种记录格式
    K = script.K
    if hasattr(script, 'iso'):                      # v6：真等距（旋转+压缩）
        proj = [script.iso(dx, dy) for dx, dy in fp]
        return [(cx+sx, cy-h+sy+warp[i]) for i, (sx, sy) in enumerate(proj)]
    return [(cx+dx, cy+dy*K+warp[i]) for i, (dx, dy) in enumerate(fp)]

def report(script_path, label):
    import io, contextlib
    spec = importlib.util.spec_from_file_location('g', script_path)
    g = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()):   # 抑制被导入脚本的生成日志
        spec.loader.exec_module(g)
    print(f"\n########## {label} ##########")
    print(f"{'图':<13}{'菱形度':>8}{'顶面厚':>7}{'顶面宽':>7}{'明暗差':>8}   判定")
    print('-'*62)
    for nm, prisms in g.PRISM_REGISTRY.items():
        im = Image.open(f"{g.OUT}/{nm}.png").convert('RGBA')
        best = None
        for pr in prisms:
            poly = topface_poly(g, nm, pr)
            d, w, th = diamondness(poly)
            area = w * th
            if best is None or area > best[5]:      # ★按顶面面积挑主体，不是挑菱形度最大的小构件
                best = (d, w, th, poly, pr, area)
        d, w, th, poly, pr = best[:5]
        # 明暗差：顶面色 vs 最暗侧面色（取顶面区域与下方像素均值）
        tl = lum(g.__dict__.get('TEAL_M', (0,0,0)))
        # 用图实测：顶面行均值 vs 顶面下方 3 行均值
        rows = scan_rows(poly)
        tlum = []
        for (y, a, b) in rows:
            for x in range(int(round(a)), int(round(b))+1):
                if 0 <= x < W and 0 <= y < H:
                    p = im.getpixel((x, y))
                    if p[3] > 0: tlum.append(lum(p))
        slum = []
        if rows:
            ybot = rows[-1][0]
            for y in range(ybot+2, min(H, ybot+7)):
                for x in range(W):
                    p = im.getpixel((x, y))
                    if p[3] > 0: slum.append(lum(p))
        tavg = sum(tlum)/len(tlum) if tlum else 0
        savg = sum(slum)/len(slum) if slum else 0
        # ★明暗差用调色板算「材质」对比：顶面 vs 最暗侧面。
        #   图实测会把 teal(污染发光)/暖色(光源)计入侧面，那些不是材质，会低估对比。
        if len(pr) >= 7:
            diff = lum(pr[5]) - min(lum(c) for c in pr[6])
        else:
            diff = tavg - savg
        ok = 'OK(45°斜视)' if d >= 3.0 else ('弱' if d >= 1.5 else 'FAIL(压扁俯视/立面)')
        dflag = 'OK' if diff >= 30 else '不足'
        print(f"{nm:<13}{d:>8.2f}{th:>7}{w:>7.1f}{diff:>8.1f}   {ok} / 明暗差{dflag}")

if __name__ == '__main__':
    # 用法: python3 check_iso.py <生成脚本.py> [对照脚本.py]
    here = os.path.dirname(os.path.abspath(__file__))
    args = sys.argv[1:]
    if args:
        report(args[0], os.path.basename(args[0]))
    else:
        report(os.path.join(here, 'core_v6.py'), 'core_v6.py')
    if len(args) > 1:
        report(args[1], os.path.basename(args[1]) + '（对照）')
