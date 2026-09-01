#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
净化器 C 方向 v2 —— 由「悬浮环阵」改为「悬浮气团」。

★人反馈：这是净化点（人类据点），配色不该只有灰/蓝冷色，允许暖色。
  · 新增暖色梯度（WARM_X→WARM_HOT），暖色用作指示灯/加热件/过滤节点的光
  · 气团本体仍走 teal（它处理的就是污染），但设备上的灯与节点用暖色，
    冷主体 + 暖光点 = 在暗场景里既统一又醒目

★气团不是固体结构：用多个重叠椭圆 + 随相位形变的边缘来画，配缓慢脉动与内部流动。
  悬浮证据 = 地面投影（和 C 方向一致，无基座）。
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

# 冷色（石/金属/污染）
CORE_X=(0x14,0x17,0x1b,255); CORE_D=(0x22,0x26,0x2c,255)
CORE_M=(0x33,0x39,0x42,255); CORE_L=(0x46,0x4d,0x58,255)
MET_D =(0x1a,0x1e,0x24,255);  MET_M =(0x2e,0x34,0x3c,255)
MET_L =(0x42,0x49,0x53,255)
TEAL_X=(0x0a,0x1f,0x1e,255);  TEAL_D=(0x0f,0x33,0x31,255)
TEAL_M=(0x1d,0x5e,0x5a,255);  TEAL_L=(0x2f,0x96,0x8f,255)

# ★暖色梯度（新增：原来只有 WARM/WARM_D 两级，做不出光源层次）
WARM_X=(0x33,0x20,0x12,255)   # 极暗暖（灯座/暗部）
WARM_D=(0x5a,0x3a,0x1c,255)
WARM_M=(0x8a,0x5a,0x2a,255)
WARM_L=(0xc4,0x86,0x42,255)
WARM_HOT=(0xe8,0xb4,0x6a,255) # 灯芯

GRD=(0x18,0x1c,0x21,255); SHADOW=(0x08,0x0a,0x0c,255); BG=(0x0d,0x11,0x14,255)

def new(): return Image.new("RGBA",(W,H),(0,0,0,0))
def put(im,x,y,c):
    xi,yi=int(round(x)),int(round(y))
    if 0<=xi<W and 0<=yi<H: im.putpixel((xi,yi),c)
def hline(im,a,b,y,c):
    for x in range(int(round(min(a,b))),int(round(max(a,b)))+1): put(im,x,y,c)

def ellipse_fill(im, cx, cy, rx, ry, c, squash=1.0):
    for dy in range(-int(ry)-1, int(ry)+2):
        for dx in range(-int(rx)-1, int(rx)+2):
            if (dx/max(0.3,rx))**2 + (dy/max(0.3,ry))**2 <= 1.0:
                put(im, cx+dx, cy+dy*squash, c)

def iso(dx,dy): return (dx-dy)*0.5, (dx+dy)*0.5*K

def iso_prism(im, fp, cx, cyg, h, top_c, side_cs):
    n=len(fp); proj=[iso(dx,dy) for dx,dy in fp]
    top=[(cx+sx, cyg-h+sy) for sx,sy in proj]
    bot=[(cx+sx, cyg+sy) for sx,sy in proj]
    for i in range(n):
        j=(i+1)%n
        if (proj[i][1]+proj[j][1])/2 <= 0: continue
        pts=[top[i],top[j],bot[j],bot[i]]
        ys=[p[1] for p in pts]
        for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys)))+1):
            xs=[]
            for a in range(4):
                x0,y0=pts[a]; x1,y1=pts[(a+1)%4]
                if (y0<=y<y1) or (y1<=y<y0): xs.append(x0+(y-y0)/(y1-y0)*(x1-x0))
            xs.sort()
            for a in range(0,len(xs)-1,2): hline(im,xs[a],xs[a+1],y,side_cs[i%len(side_cs)])
    ys=[p[1] for p in top]
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys)))+1):
        xs=[]
        for a in range(n):
            x0,y0=top[a]; x1,y1=top[(a+1)%n]
            if (y0<=y<y1) or (y1<=y<y0): xs.append(x0+(y-y0)/(y1-y0)*(x1-x0))
        xs.sort()
        for a in range(0,len(xs)-1,2): hline(im,xs[a],xs[a+1],y,top_c)

def ground_ellipse(im, cy, rx, ry, c=GRD):
    ellipse_fill(im, 16, cy, rx, ry, c)

def gas_cloud(im, cx, cy, rx, ry, t, seed=1,
              outer=TEAL_X, mid=TEAL_D, inner=TEAL_M, hot=None):
    """悬浮气团：多个重叠椭圆，随相位 t 缓慢形变 + 内部流动。
       不是固体——边缘用最暗色，中心渐亮，靠层次读出"团"。"""
    rnd = random.Random(seed)
    lobes = [(0,0,1.0), (-0.45,0.18,0.62), (0.42,-0.12,0.66),
             (0.05,-0.42,0.55), (-0.12,0.44,0.5), (0.36,0.34,0.44)]
    for (ox,oy,sc) in lobes:
        # 每个瓣随 t 做小幅椭圆运动 → 气团在缓慢翻滚
        # 偏移从 ±1.3 收到 ±0.8：初版形变过猛（帧间差异达 148px，看着在抖不是翻滚）
        ax = ox*rx + math.sin(t*6.283 + seed + ox*5)*0.8
        ay = oy*ry + math.cos(t*6.283 + seed + oy*5)*0.6
        r2x = rx*sc*(0.94+0.10*math.sin(t*6.283+ox*7))
        r2y = ry*sc*(0.94+0.10*math.cos(t*6.283+oy*7))
        ellipse_fill(im, cx+ax, cy+ay, r2x, r2y, outer)
    for (ox,oy,sc) in lobes[:4]:
        ax = ox*rx*0.7 + math.sin(t*6.283+seed+1.3+ox*5)*1.1
        ay = oy*ry*0.7 + math.cos(t*6.283+seed+1.3+oy*5)*0.9
        ellipse_fill(im, cx+ax, cy+ay, rx*sc*0.72, ry*sc*0.72, mid)
    for (ox,oy,sc) in lobes[:2]:
        ax = ox*rx*0.4 + math.sin(t*6.283+seed+2.6+ox*4)*0.9
        ay = oy*ry*0.4 + math.cos(t*6.283+seed+2.6+oy*4)*0.7
        ellipse_fill(im, cx+ax, cy+ay, rx*sc*0.44, ry*sc*0.44, inner)
    if hot:
        # 暖色核心：随 t 明灭（灯/加热件）。
        # ★旧版是纯色椭圆直接压在 teal 气团上，边缘硬切很突兀。现在做多层衰减：
        #   外晕(WARM_X，接近气团暗部) → D → M → L → 灯芯(HOT)，让暖光"透出来"而不是"贴上去"。
        hx = cx + math.sin(t*6.283)*0.8
        pulse = t < 0.5
        # 层半径收窄（0.48→0.34）：过渡够用即可，否则暖色占比会从 13% 飙到 22%
        layers = [(0.34, WARM_X), (0.27, WARM_D),
                  (0.20, WARM_L if pulse else WARM_M),
                  (0.12, WARM_HOT if pulse else WARM_L)]
        for (kk, cc) in layers:
            ellipse_fill(im, hx, cy, rx*kk, ry*kk, cc)

def motes_in(im, n, cx, cy, r, t, seed=1, cols=(TEAL_X,TEAL_D)):
    """被吸入气团的微粒：半径随相位收缩"""
    rnd = random.Random(seed)
    for i in range(n):
        ph = (t + i/n) % 1.0
        a = rnd.random()*6.283
        rr = r*(1-ph)
        put(im, cx+rr*math.cos(a), cy+rr*0.55*math.sin(a), cols[i % len(cols)])

def lamp(im, x, y, t, phase=0.0, size=3):
    """暖色指示灯（人类设备的光源）—— 慢闪。
       ★做成 size×size 的块而不是单点：单像素灯在 3× 放大下几乎看不见，
         暖色占比也只有 2%，达不到"允许暖色"的要求。"""
    on = ((t + phase) % 1.0) < 0.62
    for dy in range(size):
        for dx in range(size):
            if on and dx == 0 and dy == 0:
                c = WARM_HOT                      # 灯芯最亮
            elif on:
                c = WARM_M if (dx+dy) % 2 == 0 else WARM_D
            else:
                c = WARM_X                        # 熄灭帧（灯座）
            put(im, x+dx, y+dy, c)

# =====================================================================
# C 方向（新）：悬浮气团
# =====================================================================

def c1(frame, frames):
    """C1 · 单团：一个悬浮气团 + 暖色核心灯 + 微粒被吸入；气团缓慢脉动"""
    im=new(); t=frame/frames
    ground_ellipse(im,40,8,2,GRD); ground_ellipse(im,40,5,1,SHADOW)
    gas_cloud(im,16,23,9.0,6.6,t,seed=3,
              outer=TEAL_X, mid=TEAL_D, inner=TEAL_M, hot=True)
    motes_in(im,7,16,23,13,t,seed=5)
    # 顶部一枚暖色指示灯（挂载点，交代它不是纯自然现象）
    lamp(im,16,12,t,0.0)
    return im

def c2(frame, frames):
    """C2 · 三团层叠：大团在下、两小团在上，各自异速翻滚；节点用暖色"""
    im=new(); t=frame/frames
    ground_ellipse(im,40,9,2,GRD); ground_ellipse(im,40,6,1,SHADOW)
    # 下大团
    gas_cloud(im,16,28,9.4,5.6,t*0.7,seed=7,outer=TEAL_X,mid=TEAL_D,inner=TEAL_M)
    # 上两小团（异速）
    gas_cloud(im,10,17,4.6,3.4,t*1.3,seed=11,outer=TEAL_X,mid=TEAL_D,inner=TEAL_L)
    gas_cloud(im,22,15,3.8,2.9,t*1.6+0.3,seed=13,outer=TEAL_X,mid=TEAL_M,inner=TEAL_L)
    # 三团之间的暖色过滤节点（灯串，依次明灭）
    for i,(nx,ny) in enumerate([(12,21),(19,19),(16,25),(15,15)]):
        lamp(im,nx,ny,t,phase=i/4,size=4)
    motes_in(im,6,16,26,14,t,seed=17)
    return im

def c3(frame, frames):
    """C3 · 气团 + 环绕符石：符石用暖色（被气团熏热/点亮），绕团公转并明灭"""
    im=new(); t=frame/frames
    ground_ellipse(im,40,8,2,GRD); ground_ellipse(im,40,5,1,SHADOW)
    gas_cloud(im,16,24,8.2,6.0,t,seed=19,outer=TEAL_X,mid=TEAL_D,inner=TEAL_M,hot=True)
    # 六枚暖色符石绕气团公转，依次明灭
    for i in range(6):
        a = math.radians(i*60 + t*360*0.5)
        x = 16 + 10.4*math.cos(a)
        y = 24 + 6.6*math.sin(a)
        lit = ((i + int(t*6)) % 3) == 0
        c = WARM_HOT if lit else WARM_D
        put(im,x,y,c); put(im,x+1,y,WARM_M if lit else WARM_X)
        put(im,x,y+1,WARM_X)
    motes_in(im,5,16,24,13,t,seed=23)
    return im

# ------------------------------------------------------------------ 输出
# 只保留 C1（人已暂存）；C2/C3 已移除
SPECS=[("purifier-c1",c1)]
TEALSET={TEAL_X[:3],TEAL_D[:3],TEAL_M[:3],TEAL_L[:3]}
WARMSET={WARM_X[:3],WARM_D[:3],WARM_M[:3],WARM_L[:3],WARM_HOT[:3]}

print("C 方向 v2：悬浮气团")
for name, fn in SPECS:
    frames=[fn(f,FRAMES) for f in range(FRAMES)]
    sheet=Image.new("RGBA",(W*FRAMES,H),(0,0,0,0))
    for i,f in enumerate(frames): sheet.alpha_composite(f,(i*W,0))
    sheet.save(os.path.join(ANIM,name+"-sheet.png"))
    json.dump({"key":name,"frameWidth":W,"frameHeight":H,"frames":FRAMES,"fps":8,
               "loop":True,"sheet":name+"-sheet.png"},
              open(os.path.join(ANIM,name+".json"),"w"), indent=1)
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
    print(f"  {name}: 实体{sil}  teal {100*teal/sil:.0f}%  暖色 {100*warm/sil:.0f}%  暗部 {100*dark/sil:.0f}%  帧间差异 {min(d)}~{max(d)}px")
print("\n输出:", ANIM)
