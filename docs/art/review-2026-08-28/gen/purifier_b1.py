#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
净化器抽卡 v2 —— B(横卧过滤罐) / C(悬浮环阵) 两个方向，各 3 个变体。
★fatal 要求：过滤器必须有动效。因此不再输出单张静态 PNG 作为交付：
    · 评审交付 = GIF 动画（可直接看到动效）
    · 游戏集成 = spritesheet 图集 + JSON（Phaser 运行时资源，非评审交付物）

画布 32x44。一律使用真等距投影 iso()（旋转45°+压缩），不用只压缩不旋转的错误做法。
动画用相位 t = frame/frames 驱动，元素位置/相位随 t 循环变化。
"""
import os
from PIL import Image
import os, math, random, json

W, H = 32, 44
K = 0.55
FRAMES = 8
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cards"))
ANIM = os.path.join(OUT, "anim")
os.makedirs(ANIM, exist_ok=True)

CORE_X=(0x14,0x17,0x1b,255); CORE_D=(0x22,0x26,0x2c,255)
CORE_M=(0x33,0x39,0x42,255); CORE_L=(0x46,0x4d,0x58,255)
MET_D =(0x1a,0x1e,0x24,255);  MET_M =(0x2e,0x34,0x3c,255)
MET_L =(0x42,0x49,0x53,255)
TEAL_X=(0x0a,0x1f,0x1e,255);  TEAL_D=(0x0f,0x33,0x31,255)
TEAL_M=(0x1d,0x5e,0x5a,255);  TEAL_L=(0x2f,0x96,0x8f,255)
GRD   =(0x18,0x1c,0x21,255);  SHADOW=(0x08,0x0a,0x0c,255)
BG    =(0x0d,0x11,0x14,255)

# ★暖色梯度（公共要求，不是 C 专项）
#   人反馈：这是净化点（人类据点），配色不该只有灰/蓝冷色，允许暖色。
#   用法：冷色做主体（石/金属/污染 teal），暖色做光源（指示灯/加热件/标记）
WARM_X  =(0x33,0x20,0x12,255)   # 极暗暖（灯座/熄灭帧）
WARM_D  =(0x5a,0x3a,0x1c,255)
WARM_M  =(0x8a,0x5a,0x2a,255)
WARM_L  =(0xc4,0x86,0x42,255)
WARM_HOT=(0xe8,0xb4,0x6a,255)   # 灯芯
WARMSET={WARM_X[:3],WARM_D[:3],WARM_M[:3],WARM_L[:3],WARM_HOT[:3]}

def lamp(im, x, y, t, phase=0.0, size=3, halo=0.8):
    """暖色指示灯。
    ★旧版是 size×size 纯色方块直接贴在冷色主体上，边缘硬切、很突兀。
      现在做径向衰减：中心 WARM_HOT → L → M → D → 外晕 WARM_X（最暗暖，接近环境色），
      让暖光有一个"照亮周围"的过渡带，而不是一块贴上去的颜色。
    """
    on = ((t + phase) % 1.0) < 0.62
    cx, cy = x + (size-1)/2.0, y + (size-1)/2.0
    R = size/2.0 + halo
    for iy in range(int(cy-R)-1, int(cy+R)+2):
        for ix in range(int(cx-R)-1, int(cx+R)+2):
            d = math.hypot(ix-cx, iy-cy)
            if d > R: continue
            if on:
                if   d <= 0.6: c = WARM_HOT
                elif d <= 1.3: c = WARM_L
                elif d <= 2.1: c = WARM_M
                elif d <= 2.9: c = WARM_D
                else:          c = WARM_X          # 外晕：暗暖，融入环境
            else:
                if d > R - halo: continue          # 熄灭帧不画外晕
                c = WARM_X                         # 只留灯座暗暖
            put(im, ix, iy, c)

def warn_strip(im, x0, y, n, t, phase=0.0):
    """暖色警示带：★两端渐隐，中间实 —— 硬切的端点同样会显突兀。"""
    for i in range(n):
        on = ((t + i/n + phase) % 1.0) < 0.55
        if i == 0 or i == n-1:
            c = WARM_D if on else WARM_X           # 端点用暗一档做过渡
        else:
            c = WARM_M if on else WARM_X
        put(im, x0+i, y, c)

def new(): return Image.new("RGBA",(W,H),(0,0,0,0))
def put(im,x,y,c):
    xi,yi=int(round(x)),int(round(y))
    if 0<=xi<W and 0<=yi<H: im.putpixel((xi,yi),c)
def hline(im,a,b,y,c):
    for x in range(int(round(min(a,b))),int(round(max(a,b)))+1): put(im,x,y,c)
def vline(im,x,a,b,c):
    for y in range(int(round(min(a,b))),int(round(max(a,b)))+1): put(im,x,y,c)
def rect(im,x0,y0,x1,y1,c):
    for y in range(int(y0),int(y1)+1): hline(im,x0,x1,y,c)

def fill_poly(im,pts,c):
    if len(pts)<3: return
    ys=[p[1] for p in pts]; n=len(pts)
    for y in range(int(math.floor(min(ys))),int(math.ceil(max(ys)))+1):
        xs=[]
        for i in range(n):
            x0,y0=pts[i]; x1,y1=pts[(i+1)%n]
            if (y0<=y<y1) or (y1<=y<y0): xs.append(x0+(y-y0)/(y1-y0)*(x1-x0))
        xs.sort()
        for i in range(0,len(xs)-1,2): hline(im,xs[i],xs[i+1],y,c)

def iso(dx,dy): return (dx-dy)*0.5, (dx+dy)*0.5*K

def iso_prism(im, fp, cx, cyg, h, top_c, side_cs, seed=1):
    n=len(fp); proj=[iso(dx,dy) for dx,dy in fp]
    top=[(cx+sx, cyg-h+sy) for sx,sy in proj]
    bot=[(cx+sx, cyg+sy) for sx,sy in proj]
    for i in range(n):
        j=(i+1)%n
        if (proj[i][1]+proj[j][1])/2 <= 0: continue
        fill_poly(im,[top[i],top[j],bot[j],bot[i]], side_cs[i%len(side_cs)])
    fill_poly(im, top, top_c)
    return top

def iso_taper(im, fp, cx, cyg, h, top_scale, top_c, side_cs, seed=1):
    n=len(fp); bp=[iso(dx,dy) for dx,dy in fp]
    tp=[(sx*top_scale, sy*top_scale) for sx,sy in bp]
    bot=[(cx+sx, cyg+sy) for sx,sy in bp]
    top=[(cx+sx, cyg-h+sy) for sx,sy in tp]
    for i in range(n):
        j=(i+1)%n
        if (bp[i][1]+bp[j][1])/2 <= 0: continue
        fill_poly(im,[top[i],top[j],bot[j],bot[i]], side_cs[i%len(side_cs)])
    fill_poly(im, top, top_c)
    return top

def ring(im, cx, cy, r, squash, c, t0=0.0, span=1.0, step=4, dash=0, gap=0.35):
    """等距椭圆环。t0/span 控制相位，可画出断续弧；dash>0 时按段断续。"""
    s = 0
    while s < 360*span:
        ang = t0*360 + s
        a = math.radians(ang)
        draw = True
        if dash:
            seg = 360.0/dash
            if ((ang % seg)/seg) > (1-gap): draw = False
        if draw:
            put(im, cx+r*math.cos(a), cy+r*squash*math.sin(a), c)
        s += step

def ground_ellipse(im, cy, rx, ry, c=GRD):
    for dx in range(-int(rx),int(rx)+1):
        for dy in range(-int(ry),int(ry)+1):
            if (dx/rx)**2+(dy/ry)**2 <= 1.0: put(im,16+dx, cy+dy, c)

# =====================================================================
# B 方向：横卧过滤罐（宽矮容器）
# =====================================================================

def b1(frame, frames):
    """B1 · 单罐过滤腔：观察窗内介质缓慢翻滚 + 进气吸入 + 排气排出"""
    im=new(); t=frame/frames
    iso_prism(im,[(-9,5),(-4,9),(9,3),(11,-3),(4,-9),(-9,-3)],16,32,9,
              top_c=MET_L,side_cs=[MET_D,MET_M,MET_D])
    for (ex,ey) in [(8,28),(24,28)]:
        for dy in range(-5,6): put(im,ex,ey+dy,MET_L)
    for y in range(26,32,2): hline(im,9,13,y,CORE_X)
    iso_prism(im,[(-1.4,-1.4),(1.4,-1.4),(1.4,1.4),(-1.4,1.4)],26,29,4,
              top_c=MET_M,side_cs=[MET_D,MET_L])
    # 观察窗：介质随 t 上下翻滚（用相位偏移的横向条带表达流动）
    rect(im,13,25,22,33,CORE_X)
    rect(im,14,26,21,32,TEAL_D)
    # ★初版只有 5 条线在动，帧间差异仅 7~17px（占实体 2~5%），实机看不出在动。
    #   现在：介质层加密到 7 条 + 每层带横向偏移 + 亮滤材沿介质漂移。
    for i in range(7):
        y = 26 + int((i + t*7) % 7)          # 介质层循环下移
        off = int(2*math.sin((i + t*7)*0.9)) # 横向摆动
        hline(im,15+off,20-off,y,TEAL_X)
    for (wx,wy) in [(16+int(2*math.sin(t*6.28)),28),(18,29+int(2*math.sin(t*6.28+1)))]:
        put(im,wx,wy,TEAL_M)
    put(im,17+int(2*math.sin(t*6.28)),27+int(3*((t*2)%1)),TEAL_L)  # 滤材翻滚
    for dy in range(-4,5):
        put(im,10,28+dy,TEAL_X); put(im,22,28+dy,TEAL_D)
    for (lx,ly) in [(10,37),(23,37)]:
        iso_prism(im,[(-1.6,-1.6),(1.6,-1.6),(1.6,1.6),(-1.6,1.6)],lx,ly,5,
                  top_c=MET_D,side_cs=[MET_D,MET_M])
    # ★人反馈：去掉 4 个黄色圆球灯，只保留横向暖色断带。
    #   圆球灯读作"装饰物"，与罐体的工业感冲突；横向断带读作"警示标识"，更贴切。
    # 罐身暖色警示带（跑马灯明灭，两端渐隐）
    warn_strip(im,8,24,9,t,0.0)
    warn_strip(im,8,25,9,t,0.12)
    # 排气：微粒随 t 向右飘散
    for i in range(9):
        ph=(t+i/9)%1.0
        put(im,28+int(ph*5), 23+int(math.sin(ph*6.28)*3), TEAL_D if i%2 else TEAL_X)
    # 进气：微粒被吸入（向左进入格栅）
    for i in range(5):
        ph=(t+i/5)%1.0
        put(im,16-int(ph*6), 25+int(math.cos(ph*6.28)*3), TEAL_X)
    ground_ellipse(im,41,11,2)
    return im

def b2(frame, frames):
    """B2 · 双罐并联：两个卧罐上下叠放，中间连管；两窗介质反向流动"""
    im=new(); t=frame/frames
    # 上罐
    iso_prism(im,[(-8,4),(-3,8),(8,3),(10,-3),(3,-8),(-8,-3)],16,24,7,
              top_c=MET_L,side_cs=[MET_D,MET_M,MET_D])
    # 下罐
    iso_prism(im,[(-8,4),(-3,8),(8,3),(10,-3),(3,-8),(-8,-3)],16,36,7,
              top_c=MET_L,side_cs=[MET_D,MET_M,MET_D])
    # 中间连管（气流从上罐流向下罐）
    vline(im,24,26,34,MET_D); vline(im,25,26,34,MET_M)
    for i in range(4):
        ph=(t+i/4)%1.0
        put(im,25, 26+int(ph*8), TEAL_M)      # 管内向下流动的光点
    # 两个观察窗：介质反向流动
    for (wy,dirn) in [(22,1),(34,-1)]:
        rect(im,13,wy-4,21,wy+2,CORE_X)
        rect(im,14,wy-3,20,wy+1,TEAL_D)
        for i in range(4):
            x = 15 + int((i + dirn*t*4) % 4)*2
            put(im,x, wy-1, TEAL_X); put(im,x, wy, TEAL_X)
        put(im,17+dirn,wy-1,TEAL_M)
    for (lx,ly) in [(10,41),(23,41)]:
        iso_prism(im,[(-1.6,-1.6),(1.6,-1.6),(1.6,1.6),(-1.6,1.6)],lx,ly,4,
                  top_c=MET_D,side_cs=[MET_D,MET_M])
    # ★暖色光源：两个观察窗各配状态灯 + 支架警示灯 + 罐身警示带（与 B1 同量级）
    lamp(im,11,16,t,0.0,size=3)
    lamp(im,11,29,t,0.5,size=3)
    lamp(im,22,37,t,0.25,size=4)
    lamp(im,20,19,t,0.7,size=2)
    for i in range(8):
        on = ((t + i/8) % 1.0) < 0.55
        put(im,9+i, 25, WARM_M if on else WARM_X)
        put(im,9+i, 32, WARM_D if on else WARM_X)
    # 顶部排气
    for i in range(5):
        ph=(t+i/5)%1.0
        put(im,16+int(math.sin(ph*6)*2), 12-int(ph*5), TEAL_X if i%2 else TEAL_D)
    ground_ellipse(im,43,11,2)
    return im

def b3(frame, frames):
    """B3 · 卧罐 + 立式过滤柱：两级过滤（先沉降后精滤），柱内介质上升"""
    im=new(); t=frame/frames
    # 卧罐（沉降段）
    iso_prism(im,[(-9,4),(-4,8),(7,3),(9,-3),(3,-8),(-9,-3)],16,36,7,
              top_c=MET_L,side_cs=[MET_D,MET_M,MET_D])
    rect(im,10,32,19,37,CORE_X); rect(im,11,33,18,36,TEAL_D)
    for i in range(3):
        x = 12 + int((i + t*3) % 3)*2
        put(im,x,34,TEAL_X); put(im,x,35,TEAL_X)
    # 立式精滤柱（在罐体上方，锥形收窄）
    iso_taper(im,[(-5,-3.4),(5,-3.4),(4,3.4),(-4,3.4)],10,30,20,0.5,
              top_c=MET_M,side_cs=[MET_D,MET_M,CORE_X,CORE_M])
    # 柱内介质上升（光点向上循环）
    for i in range(4):
        ph=(t+i/4)%1.0
        y = 29 - int(ph*18)
        x = 10 + int(ph*3)
        put(im,x, y, TEAL_D if i%2 else TEAL_M)
    # 柱顶排气口
    iso_prism(im,[(-2,-2),(2,-2),(2,2),(-2,2)],11,9,3,
              top_c=MET_M,side_cs=[MET_D,MET_L])
    for i in range(4):
        ph=(t+i/4)%1.0
        put(im,11+int(math.sin(ph*5)*2), 6-int(ph*4), TEAL_X)
    for (lx,ly) in [(9,40),(19,40)]:
        iso_prism(im,[(-1.4,-1.4),(1.4,-1.4),(1.4,1.4),(-1.4,1.4)],lx,ly,4,
                  top_c=MET_D,side_cs=[MET_D,MET_M])
    # ★暖色光源：加热指示灯 + 沉降段状态灯 + 柱身警示带（与 B1 同量级）
    lamp(im,6,25,t,0.0,size=4)
    lamp(im,19,32,t,0.5,size=3)
    lamp(im,9,12,t,0.3,size=2)
    for i in range(7):
        on = ((t + i/7) % 1.0) < 0.55
        put(im,6+i, 38, WARM_M if on else WARM_X)
        put(im,6+i, 39, WARM_D if on else WARM_X)
    ground_ellipse(im,42,11,2)
    return im

# =====================================================================
# C 方向：悬浮环阵（无基座）
# =====================================================================

def c1(frame, frames):
    """C1 · 双环悬浮：两环反向旋转 + 微粒被吸入核心 + 核心脉动"""
    im=new(); t=frame/frames
    ground_ellipse(im,38,8,2,GRD); ground_ellipse(im,38,5,1,SHADOW)
    # 核心脉动（明暗交替）
    pulse = TEAL_L if t < 0.5 else TEAL_M
    iso_taper(im,[(-3.2,-3.2),(3.2,-3.2),(0,5.2)],16,24,6,0.6,
              top_c=pulse,side_cs=[TEAL_D,TEAL_M])
    # 两环反向旋转：相位随 t 移动
    # ★初版环密度过高(step5)且多用 TEAL_D(亮度恰为40，卡在暗部阈值外)，
    #   导致 teal 占 74%、暗部仅 29%。现在放宽步长、主体走最暗的 TEAL_X。
    ring(im,16,24,9.2,0.40,TEAL_X,t0=t,      step=7)
    ring(im,16,24,6.0,1.35,TEAL_X,t0=-t,     step=7)
    # 旋转虚影亮弧（少量，够表达"在转"）
    ring(im,16,24,9.2,0.40,TEAL_L,t0=t,      span=0.12, step=7)
    ring(im,16,24,6.0,1.35,TEAL_L,t0=-t+0.35,span=0.12, step=7)
    # 微粒向核心汇聚
    for i in range(5):
        ph=(t+i/5)%1.0
        r = 12*(1-ph)                       # 半径收缩 = 被吸入
        a = math.radians(i*72 + t*360)
        put(im, 16+r*math.cos(a), 24+r*0.5*math.sin(a), TEAL_X if ph<0.5 else TEAL_D)
    return im

def c2(frame, frames):
    """C2 · 三轴环笼：三个不同轴向的环嵌套旋转（ gyroscope 感）"""
    im=new(); t=frame/frames
    ground_ellipse(im,39,7,2,GRD); ground_ellipse(im,39,4,1,SHADOW)
    iso_taper(im,[(-2.6,-2.6),(2.6,-2.6),(0,4.2)],16,23,5,0.6,
              top_c=TEAL_L,side_cs=[TEAL_D,TEAL_M])
    # 三个环：squash 不同 = 轴向不同，转速不同
    # ★初版三环各画三遍且 step5，teal 占 78%、暗部 30%。改为每环两遍、步长放宽、主体走 TEAL_X
    for (rad,sq,sp) in [(9.5,0.22,1.0),(8.6,0.85,-0.7),(7.4,1.55,0.45)]:
        ring(im,16,23,rad,sq,TEAL_X,t0=t*sp,     step=7, dash=4, gap=0.34)
        ring(im,16,23,rad,sq,TEAL_L,t0=t*sp+0.5, step=7, dash=3, gap=0.58)
    for i in range(4):
        ph=(t+i/4)%1.0
        a = math.radians(i*90 - t*180)
        r = 11*(1-ph*0.8)
        put(im,16+r*math.cos(a), 23+r*0.55*math.sin(a), TEAL_X)
    return im

def c3(frame, frames):
    """C3 · 环 + 符石阵：单主环旋转 + 六枚符石绕环公转（各自明灭）"""
    im=new(); t=frame/frames
    ground_ellipse(im,39,9,2,GRD); ground_ellipse(im,39,6,1,SHADOW)
    iso_taper(im,[(-2.8,-2.8),(2.8,-2.8),(0,4.6)],16,24,6,0.55,
              top_c=TEAL_L,side_cs=[TEAL_D,TEAL_M])
    # 主环（略倾斜）
    ring(im,16,24,8.8,0.55,TEAL_X,t0=t*0.5, step=5)
    ring(im,16,24,8.8,0.55,TEAL_D,t0=t*0.5+0.05, step=5, dash=4, gap=0.30)
    ring(im,16,24,8.8,0.55,TEAL_L,t0=t*0.5+0.25, span=0.12, step=5)
    # 六枚符石沿环公转，各自明灭
    for i in range(6):
        a = math.radians(i*60 + t*360*0.5)
        x = 16 + 8.8*math.cos(a)
        y = 24 + 8.8*0.55*math.sin(a)
        lit = ((i + int(t*6)) % 3) == 0
        c = TEAL_L if lit else TEAL_D
        put(im,x,y,c); put(im,x+1,y,c); put(im,x,y+1,TEAL_X)
    # 中心吸入的微粒
    for i in range(3):
        ph=(t+i/3)%1.0
        a = math.radians(i*120 + t*360)
        r = 10*(1-ph)
        put(im,16+r*math.cos(a), 24+r*0.5*math.sin(a), TEAL_X)
    return im

# ------------------------------------------------------------------ 输出
# ★只负责 B 方向。C 方向已改为「悬浮气团」，由 gen_purifier_c2.py 生成
#  （本文件里的 c1/c2/c3 是已废弃的环阵版，若一并输出会覆盖气团版）
# 只保留 B1（人已暂存）；B2/B3 已移除
SPECS = [("purifier-b1",b1)]

for name, fn in SPECS:
    frames = [fn(f, FRAMES) for f in range(FRAMES)]
    # 输出 spritesheet 图集 + JSON（评审在 HTML 里看，游戏运行时读图集）
    sheet = Image.new("RGBA",(W*FRAMES, H),(0,0,0,0))
    for i,f in enumerate(frames): sheet.alpha_composite(f,(i*W,0))
    sheet_path = os.path.join(ANIM, name+"-sheet.png")
    sheet.save(sheet_path)
    meta = {"key":name,"frameWidth":W,"frameHeight":H,"frames":FRAMES,"fps":8,
            "loop":True,"sheet":name+"-sheet.png"}
    json.dump(meta, open(os.path.join(ANIM,name+".json"),"w"), indent=1)
    # 统计（用色值集合判定，不能用 g>r+25 阈值：TEAL_X 的 g-r 只有 21 会被漏判）
    TEALSET={TEAL_X[:3],TEAL_D[:3],TEAL_M[:3],TEAL_L[:3]}
    sil=teal=warm=dark=0
    for y in range(H):
        for x in range(W):
            p=frames[0].getpixel((x,y))
            if p[3]==0: continue
            sil+=1
            c=p[:3]
            if c in TEALSET: teal+=1
            if c in WARMSET: warm+=1
            if 0.299*p[0]+0.587*p[1]+0.114*p[2] < 40: dark+=1
    d=[sum(1 for y in range(H) for x in range(W)
           if frames[i].getpixel((x,y))!=frames[i+1].getpixel((x,y))) for i in range(FRAMES-1)]
    print(f"[{name}] 实体{sil}  teal {100*teal/sil:>2.0f}%  暖色 {100*warm/sil:>2.0f}%  "
          f"暗部 {100*dark/sil:>2.0f}%  帧间差异 {min(d)}~{max(d)}px")
print("\n输出目录:", ANIM)
