#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生图 → 像素化 v2（人已放开三项约束）

放开的约束：
  1. 画布可放大  -> 储藏改用 48x48（原 32x36 像素预算不足，方盒子剪影信息量太低）
  2. 靠特征物辨识 -> 半开的门 + 溢出的薪柴 / 登记板等高辨识特征
  3. 可提亮      -> 暗部目标从 50%+ 降到 ~40%，保证 48px 下结构读得出

新约束：
  · 加固储藏柜（原「加固储物柜」）：重点在【加固】，要给出【可靠】的直接感受，
    不能是单薄铁皮柜 —— 厚壁、外框、四角护角、大螺栓阵、横向加强肋、粗锁杆
  · 军用箱阵：暂无补充
"""
import os, math, sys, json, glob
import os
from PIL import Image

CANVAS = 48                       # ★放大：32 -> 48
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cards"))
ANIM = os.path.join(OUT, "anim"); os.makedirs(ANIM, exist_ok=True)
SRC = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "refgen", "iso3"))

GREYS = [(0x10,0x13,0x16),(0x1a,0x1e,0x24),(0x25,0x2a,0x31),
         (0x33,0x39,0x42),(0x43,0x4a,0x55),(0x57,0x5f,0x6b),(0x6b,0x74,0x82)]
TEALS = [(0x0a,0x1f,0x1e),(0x0f,0x33,0x31),(0x1d,0x5e,0x5a),(0x2f,0x96,0x8f)]

def theme_ramp(base):
    out=[]
    bl = 0.299*base[0]+0.587*base[1]+0.114*base[2]
    for g in GREYS:
        gl = 0.299*g[0]+0.587*g[1]+0.114*g[2]
        f = gl/max(1e-6,bl)
        out.append(tuple(max(0,min(255,int(base[i]*f))) for i in range(3)))
    return out

def load_cut(path, thr=34, shrink=1):
    """读图 + 抠底 + 裁包围盒。
    ★背景色自动检测：不能假设一定是黑底 —— 实测军用箱那张生图背景是纯白(255)，
      按黑底阈值抠会把整张图当实体（结果满屏填充）。"""
    im = Image.open(path).convert("RGBA"); px=im.load(); w,h=im.size
    corners=[px[2,2][:3], px[w-3,2][:3], px[2,h-3][:3], px[w-3,h-3][:3]]
    avg=sum(sum(c) for c in corners)/(3*len(corners))
    white_bg = avg > 128
    def is_bg(r,g,b):
        return (min(r,g,b) >= 255-thr) if white_bg else (max(r,g,b) <= thr)
    for y in range(h):
        for x in range(w):
            r,g,b,a=px[x,y]
            if is_bg(r,g,b): px[x,y]=(r,g,b,0)
    for _ in range(shrink):
        edge=[]
        for y in range(1,h-1):
            for x in range(1,w-1):
                if px[x,y][3]==0: continue
                if (px[x-1,y][3]==0 or px[x+1,y][3]==0 or px[x,y-1][3]==0 or px[x,y+1][3]==0):
                    r,g,b,a=px[x,y]
                    if is_bg(*( (min(255,r+24),min(255,g+24),min(255,b+24)) if white_bg
                                else (max(0,r-24),max(0,g-24),max(0,b-24)) )):
                        edge.append((x,y))
        for (x,y) in edge: px[x,y]=(0,0,0,0)
    bb=im.getbbox()
    return im.crop(bb) if bb else im

def fit(im, canvas=CANVAS):
    """等比缩放到 canvas 内（长边对齐），再放到方形画布底部居中"""
    w,h=im.size
    if w>=h: nw,nh = canvas, max(1,round(h*canvas/w))
    else:    nh,nw = canvas, max(1,round(w*canvas/h))
    sm=im.resize((nw,nh), Image.BOX)
    out=Image.new("RGBA",(canvas,canvas),(0,0,0,0))
    out.alpha_composite(sm, ((canvas-nw)//2, canvas-nh))    # 底部对齐（物体站在地上）
    return out

def quantize(im, ramp, dark_bias=0.86, floor=0.10):
    """量化到色阶。
    ★dark_bias 从 0.62 提到 0.86：0.62 压得过猛，实测暗部 92%，形体被吞掉。
      floor：把最暗端抬一点，避免大片纯黑吃掉结构。"""
    out=Image.new("RGBA",im.size,(0,0,0,0))
    lums=[]
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=im.getpixel((x,y))
            if a>=96: lums.append(0.299*r+0.587*g+0.114*b)
    if not lums: return out
    lo,hi=min(lums),max(lums)
    ramp_l=[0.299*c[0]+0.587*c[1]+0.114*c[2] for c in ramp]
    top=max(ramp_l)
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=im.getpixel((x,y))
            if a<96: continue
            t=(0.299*r+0.587*g+0.114*b - lo)/max(1e-6,(hi-lo))
            t = floor + (1-floor) * (t ** (1.0/max(0.05,dark_bias)))
            tgt=t*top
            bi=min(range(len(ramp_l)), key=lambda i: abs(ramp_l[i]-tgt))
            c=ramp[bi]
            out.putpixel((x,y),(c[0],c[1],c[2],255))
    return out

def edge_light(im, ramp):
    """棱线提亮：实体边界朝上/朝左的一侧提亮一档（读出厚度=可靠感）"""
    src=im.copy()
    for y in range(im.height):
        for x in range(im.width):
            if src.getpixel((x,y))[3]==0: continue
            up  = src.getpixel((x,y-1))[3]==0 if y>0 else True
            left= src.getpixel((x-1,y))[3]==0 if x>0 else True
            if up or left:
                c=src.getpixel((x,y))
                cl=0.299*c[0]+0.587*c[1]+0.114*c[2]
                bi=min(range(len(ramp)), key=lambda i: abs(
                    (0.299*ramp[i][0]+0.587*ramp[i][1]+0.114*ramp[i][2]) - cl))
                nb=min(len(ramp)-1, bi+2)
                nc=ramp[nb]
                im.putpixel((x,y),(nc[0],nc[1],nc[2],255))
    return im

def contact_shadow(im):
    w,h=im.size
    ys=[y for y in range(h) if any(im.getpixel((x,y))[3]>0 for x in range(w))]
    if not ys: return im
    yb=max(ys)
    xs=[x for x in range(w) if im.getpixel((x,yb))[3]>0]
    if not xs: return im
    cx=(min(xs)+max(xs))//2; rx=max(4,(max(xs)-min(xs))//2+3)
    for dy in (1,2,3):
        yy=yb+dy
        if yy>=h: break
        r=rx*(1.0-0.20*dy)
        for x in range(int(cx-r),int(cx+r)+1):
            if 0<=x<w and im.getpixel((x,yy))[3]==0:
                im.putpixel((x,yy),(0x12,0x16,0x1a,255))
    return im

def teal_seq(base, spots, frames=8):
    """teal 点缀弱动效（人已确认可接受）。spots 为绝对像素坐标 + 尺寸"""
    seq=[]
    for f in range(frames):
        t=f/frames
        im=base.copy()
        for i,(sx,sy,sw,sh) in enumerate(spots):
            ph=(t+i/max(1,len(spots)))%1.0
            c = TEALS[3] if ph<0.20 else (TEALS[2] if ph<0.44 else
                (TEALS[1] if ph<0.72 else TEALS[0]))
            for dy in range(sh):
                for dx in range(sw):
                    x,y=sx+dx,sy+dy
                    if 0<=x<im.width and 0<=y<im.height:
                        im.putpixel((x,y),(c[0],c[1],c[2],255))
        seq.append(im)
    return seq

def stats(im):
    px=[im.getpixel((x,y)) for y in range(im.height) for x in range(im.width)
        if im.getpixel((x,y))[3]>0]
    if not px: return dict(n=0,dark=0,cols=0,teal=0)
    dark=sum(1 for p in px if 0.299*p[0]+0.587*p[1]+0.114*p[2]<40)
    tl=[tuple(c) for c in TEALS]
    teal=sum(1 for p in px if p[:3] in tl)
    return dict(n=len(px),dark=100*dark/len(px),
                cols=len(set(p[:3] for p in px)),teal=100*teal/len(px))

# ---------------------------------------------------------------- 执行
srcs=sorted(glob.glob(os.path.join(SRC,"*.png")))
print(f"素材 {len(srcs)} 张（48x48 画布）")

JOBS=[
    ("A_massively_reinforced", "storage-v1", (0x3c,0x48,0x58),
     # 特征物：门缝渗漏 + 中央锁具旁的状态点（靠特征辨识）
     lambda w,h: [(w//2-1, int(h*0.46), 2, 3), (w//2-1, int(h*0.62), 2, 3),
                  (int(w*0.30), int(h*0.54), 2, 2)]),
    ("Three_heavy_military", "storage-v2", (0x4e,0x56,0x36),
     lambda w,h: [(int(w*0.48), int(h*0.34), 2, 2), (int(w*0.26), int(h*0.66), 2, 2),
                  (int(w*0.70), int(h*0.66), 2, 2)]),
]

print("\n结果：")
for pat,name,theme,spotf in JOBS:
    m=[s for s in srcs if pat in os.path.basename(s)]
    if not m: print(f"  [{name}] 未找到源图"); continue
    cut=load_cut(m[0])
    small=fit(cut, CANVAS)
    ramp=theme_ramp(theme)
    q=quantize(small, ramp)
    q=edge_light(q, ramp)
    q=contact_shadow(q)
    q.save(os.path.join(ANIM,name+".png"))
    spots=spotf(q.width,q.height)
    seq=teal_seq(q,spots,8)
    sheet=Image.new("RGBA",(q.width*8,q.height),(0,0,0,0))
    for i,fm in enumerate(seq): sheet.alpha_composite(fm,(i*q.width,0))
    sheet.save(os.path.join(ANIM,name+"-sheet.png"))
    json.dump({"key":name,"frameWidth":q.width,"frameHeight":q.height,"frames":8,
               "fps":8,"loop":True,"sheet":name+"-sheet.png",
               "source":os.path.basename(m[0])},
              open(os.path.join(ANIM,name+".json"),"w"),ensure_ascii=False,indent=1)
    st=stats(q)
    d=[sum(1 for y in range(q.height) for x in range(q.width)
           if seq[i].getpixel((x,y))!=seq[i+1].getpixel((x,y))) for i in range(7)]
    print(f"  [{name}] 源{cut.size} -> {q.width}x{q.height}  实体{st['n']}  "
          f"暗部 {st['dark']:.0f}%  色数 {st['cols']}  teal {st['teal']:.1f}%  帧间 {min(d)}~{max(d)}px")
print("\n输出:",ANIM)
