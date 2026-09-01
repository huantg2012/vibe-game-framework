#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
写实工具库 v2 —— 依据 home 概念图实测的像素手法重写。

★从概念图（docs/art/demos/home/2026-07-22_164023）提取的真实手法：
  1. 同一个面上有 3~4 级明度混杂（形如 ==+==++===），不是整片同色
  2. 暗块直接嵌在亮面里（+++.::+++）—— 凹陷 / 污渍 / 孔洞
  3. 暖光只占小片（约 4×4），周围立刻转暗
  4. 没有连续长直线，边界都被打断

v1 的 panel() 是「竖条带 + 顶高光 + 底 AO」，规整得像 UI 控件，所以假。
v2 改为 mottle()：以基色为中心做多级明度散布 + 嵌入暗块 + 打断边界。
"""
import math, random

def put(im,x,y,c):
    xi,yi=int(round(x)),int(round(y))
    if 0<=xi<im.width and 0<=yi<im.height: im.putpixel((xi,yi),c)
def hline(im,a,b,y,c):
    a,b=int(round(min(a,b))),int(round(max(a,b)))
    for x in range(a,b+1): put(im,x,y,c)
def vline(im,x,a,b,c):
    a,b=int(round(min(a,b))),int(round(max(a,b)))
    for y in range(a,b+1): put(im,x,y,c)
def rect(im,x0,y0,x1,y1,c):
    x0,y0,x1,y1=int(round(min(x0,x1))),int(round(min(y0,y1))),int(round(max(x0,x1))),int(round(max(y0,y1)))
    for y in range(y0,y1+1): hline(im,x0,x1,y,c)

def shade(c,k):
    """按明度档量化后再返回。
    ★不量化会导致每次 shade() 都生成新色：v4 实测色数 45~69（像素画应 <=20），
      画面碎、读不出结构。这里把结果吸附到 6 档固定明度上。"""
    r=max(0,min(255,int(c[0]*k))); g=max(0,min(255,int(c[1]*k))); b=max(0,min(255,int(c[2]*k)))
    lum=0.299*r+0.587*g+0.114*b
    if lum<=0.5: return (0,0,0,255)
    # 6 档明度台阶
    steps=(14,26,40,56,76,104)
    tgt=min(steps,key=lambda s:abs(s-lum))
    f=tgt/max(1e-6,lum)
    return (max(0,min(255,int(r*f))), max(0,min(255,int(g*f))),
            max(0,min(255,int(b*f))), 255)

def mottle(im, x0,y0,x1,y1, base, seed=1, levels=(0.84,0.94,1.0,1.10),
           weights=(0.22,0.34,0.30,0.14), grain=2, blotch=0.10, lit_top=True):
    """斑驳面：多级明度按低频块散布。
       ★明度档必须收窄（0.84~1.10）：初版用 0.62~1.22，跨度过大会读作噪点而非材质。
       grain  : 色块粒度（2 = 2x2 一块）
       blotch : 嵌入暗块的比例（凹陷/污渍）"""
    rnd=random.Random(seed)
    pal=[shade(base,k) for k in levels]
    h=y1-y0+1
    gy=y0
    while gy<=y1:
        gx=x0
        while gx<=x1:
            r=rnd.random(); acc=0; idx=0
            for i,w in enumerate(weights):
                acc+=w
                if r<=acc: idx=i; break
            c=pal[idx]
            # 顶光：靠上的块提亮一档
            if lit_top and (gy-y0) < max(1,int(h*0.18)):
                c=shade(c,1.18)
            # 底部 AO
            if (gy-y0) > h*0.78:
                c=shade(c,0.72)
            for dy in range(grain):
                for dx in range(grain):
                    put(im,gx+dx,gy+dy,c)
            gx+=grain
        gy+=grain
    # 嵌入暗块（凹陷/污渍）—— 直接压在亮面里，这是"旧"的关键
    n=int((x1-x0+1)*h*blotch/6)
    for _ in range(n):
        bx=rnd.randint(x0,x1); by=rnd.randint(y0,y1)
        bw=rnd.randint(1,3); bh=rnd.randint(1,2)
        c=shade(base, 0.42 if rnd.random()<0.7 else 0.30)
        for dy in range(bh):
            for dx in range(bw):
                put(im,bx+dx,by+dy,c)

def broken_line(im, x0,x1,y, c, seed=1, keep=0.72):
    """打断的线：真实物件上没有连续长直线"""
    rnd=random.Random(seed)
    for x in range(int(x0),int(x1)+1):
        if rnd.random()<keep: put(im,x,y,c)

def rivet(im,x,y,c):
    """立体铆钉：高光 + 本体 + 下缘投影"""
    put(im,x,  y,   shade(c,1.62))
    put(im,x+1,y,   c)
    put(im,x,  y+1, shade(c,0.72))
    put(im,x+1,y+1, shade(c,0.44))

def bolt(im,x,y,c):
    """螺栓（比铆钉大一点，带十字槽暗示）"""
    rect(im,x,y,x+2,y+2, shade(c,0.9))
    put(im,x,y,shade(c,1.6)); put(im,x+1,y,shade(c,1.3))
    put(im,x+1,y+1,shade(c,0.5))
    put(im,x+2,y+2,shade(c,0.4))

def latch(im,x,y,c):
    rect(im,x,y,x+2,y+2, c)
    hline(im,x,x+2,y, shade(c,1.5))
    hline(im,x,x+2,y+3, shade(c,0.42))

def handle(im,x,y,c,length=3):
    vline(im,x,y,y+length,shade(c,0.8))
    vline(im,x+1,y,y+length,shade(c,1.4))
    hline(im,x,x+1,y+length+1,shade(c,0.42))

def dent(im,x,y,w,h,base):
    """凹痕：上缘暗、下缘亮（凹进去的光照逻辑）"""
    for dy in range(h):
        for dx in range(w):
            put(im,x+dx,y+dy, shade(base,0.52))
    hline(im,x,x+w-1,y, shade(base,0.34))
    hline(im,x,x+w-1,y+h-1, shade(base,1.15))

def rust_streak(im,x,y,length,base,seed=1):
    """锈迹/流痕：自上而下渐淡，宽度不均"""
    rnd=random.Random(seed)
    for i in range(length):
        w = 1 if rnd.random()<0.6 else 2
        k = 0.55 + 0.30*(i/max(1,length))
        for dx in range(w):
            put(im,x+dx,y+i, shade(base,k))

def contact_shadow(im, cx, cy, rx, ry):
    for dx in range(-int(rx),int(rx)+1):
        for dy in range(-int(ry),int(ry)+1):
            d=(dx/max(0.3,rx))**2+(dy/max(0.3,ry))**2
            if d<=1.0:
                put(im,cx+dx,cy+dy, shade((0x18,0x1c,0x21,255), 1.0-0.55*d))

def teal_glint(im, x,y, t, phase=0.0, size=1):
    """teal 点缀（污染公约色，小面积）"""
    ph=(t+phase)%1.0
    if ph<0.45: c=(0x2f,0x96,0x8f,255) if ph<0.2 else (0x1d,0x5e,0x5a,255)
    else:       c=(0x0f,0x33,0x31,255) if ph<0.8 else (0x0a,0x1f,0x1e,255)
    for dy in range(size):
        for dx in range(size): put(im,x+dx,y+dy,c)

def warm_pool(im, cx, cy, r, t, phase=0.0):
    """暖光小片（概念图手法：只占小片，周围立刻转暗）"""
    ph=(t+phase)%1.0
    k = 1.0 if ph<0.55 else 0.72
    pal=[(0xe8,0xb4,0x6a,255),(0xc4,0x86,0x42,255),(0x8a,0x5a,0x2a,255),(0x4a,0x30,0x16,255)]
    for dy in range(-r,r+1):
        for dx in range(-r,r+1):
            d=math.hypot(dx,dy)
            if d>r+0.2: continue
            idx=min(3,int(d/max(0.6,r/3.4)))
            put(im,cx+dx,cy+dy, shade(pal[idx],k))
