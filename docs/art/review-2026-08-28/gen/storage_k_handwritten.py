#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
储藏 STORAGE 抽卡 v4 —— 从「使用状态」出发，不只是换箱子外壳。

★前两轮的根本问题：我从「箱子种类」出发（货柜/保险柜/档案柜…），那只是换外壳。
  真实感应该从「它在这个世界里怎么被使用」长出来：谁在用、用了多久、里面装什么、坏在哪。

★写实手法（依据 home 概念图实测，见 real2.py）：
  同面 3~4 级明度混杂 / 暗块嵌在亮面里 / 暖光只占小片 / 没有连续长直线

主题色 = 各交互物独有色（teal 是污染公约色，只做点缀）；主体冷灰。
画布 32x36。
"""
import os, math, random, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import os
from PIL import Image
from real_tools import (put,hline,vline,rect,shade,mottle,broken_line,rivet,bolt,latch,
                   handle,dent,rust_streak,contact_shadow,teal_glint,warm_pool)

W,H=32,36; K=0.55; FRAMES=8
OUT=os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cards"))
ANIM=os.path.join(OUT,"anim"); os.makedirs(ANIM,exist_ok=True)

G_X=(0x14,0x17,0x1b,255); G_D=(0x22,0x26,0x2c,255); G_M=(0x33,0x39,0x42,255); G_L=(0x46,0x4d,0x58,255)
def new(): return Image.new("RGBA",(W,H),(0,0,0,0))
def iso(dx,dy): return (dx-dy)*0.5,(dx+dy)*0.5*K

def iso_faces(im,hw,hd,cx,cyg,h,top_base,l_base,r_base,seed=1,blotch=0.10):
    """等距体块，三个面都用 mottle 画（斑驳），不是纯色"""
    def P(dx,dy):
        sx,sy=iso(dx,dy); return (cx+sx,cyg+sy)
    t0,t1,t2,t3=P(-hw,-hd),P(hw,-hd),P(hw,hd),P(-hw,hd)
    for (b,c,base,sd) in ((t0,t3,l_base,seed*7+1),(t3,t2,r_base,seed*7+2)):
        pts=[b,c,(c[0],c[1]+h),(b[0],b[1]+h)]
        ys=[p[1] for p in pts]; y0,y1=int(math.floor(min(ys))),int(math.ceil(max(ys)))
        # 先算出该面的 x 范围逐行填 mottle 色
        # ★逐像素随机会变成噪点（v4 初版满屏 #=O 高频跳变，读不出物件）。
        #   改为 2x2 低频块 + 相邻块明度接近（幅度 ±0.12），才读作材质。
        rnd=random.Random(sd)
        blk={}
        for y in range(y0,y1+1):
            xs=[]
            for i in range(4):
                x0,yy0=pts[i]; x1,yy1=pts[(i+1)%4]
                if (yy0<=y<yy1) or (yy1<=y<yy0):
                    xs.append(x0+(y-yy0)/(yy1-yy0)*(x1-x0))
            xs.sort()
            if len(xs)<2: continue
            tv=(y-y0)/max(1,(y1-y0))
            for x in range(int(round(xs[0])),int(round(xs[-1]))+1):
                key=(x//2, y//2)
                if key not in blk:
                    blk[key]=rnd.choice((0.90,0.97,1.04,1.10))
                k=blk[key]*(1.08-0.30*tv)
                put(im,x,y,shade(base,k))
    # 顶面
    ys=[p[1] for p in (t0,t1,t2,t3)]
    rnd=random.Random(seed*7+3); tblk={}
    for y in range(int(math.floor(min(ys))),int(math.ceil(max(ys)))+1):
        xs=[]
        for i in range(4):
            pts=[t0,t1,t2,t3]; x0,yy0=pts[i]; x1,yy1=pts[(i+1)%4]
            if (yy0<=y<yy1) or (yy1<=y<yy0): xs.append(x0+(y-yy0)/(yy1-yy0)*(x1-x0))
        xs.sort()
        if len(xs)<2: continue
        for x in range(int(round(xs[0])),int(round(xs[-1]))+1):
            key=(x//2,y//2)
            if key not in tblk: tblk[key]=rnd.choice((0.92,1.0,1.08))
            put(im,x,y,shade(top_base,tblk[key]))
    return (t0,t1,t2,t3)

# ============ 1 值守货柜：门半开、门口堆了正在清点的箱 ============
def k1(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,12,2)
    iso_faces(im,10,6,16,18,13,(0x2b,0x36,0x44,255),G_D,(0x2b,0x36,0x44,255),seed=1)
    mottle(im,7,19,25,29,(0x2b,0x36,0x44,255),seed=11,blotch=0.14)
    for i in range(-9,10,3):                    # 波纹
        broken_line(im,16+i*0.5,16+i*0.5,y=0,c=G_X,seed=i) if False else None
        vline(im,16+i*0.5,19,29,shade((0x2b,0x36,0x44,255),1.30 if (i//3)%2 else 0.64))
    broken_line(im,7,25,18,G_X,seed=3); broken_line(im,7,25,29,G_X,seed=4)
    # 门半开：左门外摆，露出内部暗腔
    rect(im,9,20,12,29,G_X)                     # 内部暗腔
    mottle(im,10,21,12,28,G_D,seed=13,grain=1,blotch=0.2,lit_top=False)
    vline(im,13,19,29,G_L)                      # 开着的门边
    handle(im,14,23,G_L)
    for bx in (8,24):
        rivet(im,bx,18,G_L); rivet(im,bx,29,G_L)
    rust_streak(im,22,20,7,(0x6b,0x42,0x2a,255),seed=5)
    # 门口清点用的小箱（在用的痕迹）
    rect(im,17,27,21,30,shade(G_M,0.9)); hline(im,17,21,27,shade(G_M,1.3))
    teal_glint(im,11,24,t,size=1); teal_glint(im,11,26,t,phase=0.4,size=1)
    warm_pool(im,25,17,2,t,0.2)                 # 挂在柜角的工作灯
    return im

# ============ 2 层架 + 分类筐：用得最勤的那种 ============
def k2(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,12,2)
    for cx in (7,25):                            # 侧立柱
        vline(im,cx,9,30,shade(G_M,0.7)); vline(im,cx+1,9,30,shade(G_M,1.25))
        for by in (11,17,23,29): rivet(im,cx,by,G_L)
    for by in (27,21,15):                        # 三层板（斑驳）
        mottle(im,7,by,26,by+1,G_M,seed=by,grain=1,blotch=0.12)
        broken_line(im,7,26,by+2,G_X,seed=by)
    # 层上分类筐：大小不一、不对齐（真在用）
    for (bx,by,bw,bh,sd) in ((9,24,4,3,31),(14,23,5,4,33),(20,24,4,3,35),
                             (9,18,5,3,37),(16,17,4,4,39),(21,18,4,3,41)):
        mottle(im,bx,by,bx+bw,by+bh,shade(G_L,0.9),seed=sd,grain=1,blotch=0.16)
        broken_line(im,bx,bx+bw,by,shade(G_L,1.4),seed=sd+1)
        hline(im,bx,bx+bw,by+bh,shade(G_L,0.45))
    # 一筐里的薪柴（点缀）
    gx = 15 if t<0.5 else 21
    teal_glint(im,gx,24,t,size=2)
    dent(im,10,28,3,2,G_M)
    return im

# ============ 3 加固储物柜：被撞过、门歪了 ============
def k3(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,10,2)
    iso_faces(im,8,6,16,18,15,G_M,G_D,G_M,seed=3)
    mottle(im,9,19,23,30,G_M,seed=43,blotch=0.16)
    # 门：右门下沉（歪了）
    vline(im,16,19,30,G_X)
    for (x0,x1,dy) in ((9,15,0),(17,23,1)):
        broken_line(im,x0,x1,19+dy,shade(G_L,1.3),seed=x0)
        broken_line(im,x0,x1,30+dy,G_X,seed=x0+1)
        handle(im,x1-2 if x0==9 else x0+1,24+dy,G_L)
    dent(im,18,26,4,3,G_M)                       # 撞痕
    rust_streak(im,20,29,5,(0x6b,0x42,0x2a,255),seed=7)
    for bx in range(10,24,4): bolt(im,bx,18,G_L)
    teal_glint(im,16,22,t,size=1); teal_glint(im,16,27,t,phase=0.5,size=1)
    return im

# ============ 4 木箱堆：三只叠着、最上那只开着 ============
def k4(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,12,2)
    WOOD=(0x6b,0x4a,0x2f,255)
    # 下两只（错位叠放）
    iso_faces(im,9,5,15,29,7,WOOD,shade(WOOD,0.6),WOOD,seed=5)
    iso_faces(im,8,5,18,23,7,WOOD,shade(WOOD,0.6),WOOD,seed=6)
    for (y0,y1,x0,x1,sd) in ((23,28,10,24,51),(17,22,11,25,53)):
        mottle(im,x0,y0,x1,y1,WOOD,seed=sd,blotch=0.14)
        for yy in range(y0,y1,2): broken_line(im,x0,x1,yy,shade(WOOD,0.55),seed=yy)
    # 最上那只（开盖）
    iso_faces(im,7,4,16,16,6,WOOD,shade(WOOD,0.6),WOOD,seed=7)
    rect(im,11,10,21,12,G_X)                     # 开口暗腔
    for i in range(4): teal_glint(im,12+i*2,11,t,phase=i*0.25,size=1)
    # 金属角与钉
    for (ax,ay) in ((10,23),(24,23),(11,17),(25,17)):
        rivet(im,ax,ay,G_M)
    return im

# ============ 5 壁挂格架：钉在边界墙上、格子里塞满 ============
def k5(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,32,11,2)
    mottle(im,6,10,26,30,G_D,seed=61,grain=2,blotch=0.18)   # 背板
    for r in range(4):                                       # 四层格
        y=12+r*5
        broken_line(im,6,26,y,shade(G_L,1.2),seed=y)
        broken_line(im,6,26,y+4,G_X,seed=y+1)
        for c in range(3):
            x=7+c*7
            vline(im,x,y,y+4,shade(G_M,0.8))
            # 格内塞的东西（密度不一 = 真在用）
            fill = (r+c)%3
            if fill:
                mottle(im,x+1,y+1,x+5,y+3,shade(G_L,0.85),seed=r*9+c,grain=1,blotch=0.2)
        # 某一格有 teal
        if r==1: teal_glint(im,9,y+2,t,size=2)
        if r==3: teal_glint(im,23,y+2,t,phase=0.5,size=1)
    for bx in (6,26):
        for by in (11,20,29): bolt(im,bx,by,G_L)
    return im

# ============ 6 台面 + 下柜：有人在这儿分装 ============
def k6(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,12,2)
    iso_faces(im,10,6,16,22,9,G_M,G_D,G_M,seed=8)            # 下柜
    mottle(im,7,23,25,30,G_M,seed=71,blotch=0.15)
    for dx in (11,16,21): vline(im,dx,23,30,G_X)             # 柜门缝
    for dx in (13,18,23): handle(im,dx,26,G_L)
    # 台面（更亮、有工具与划痕）
    mottle(im,6,19,26,21,shade(G_L,0.95),seed=73,grain=1,blotch=0.10)
    broken_line(im,6,26,19,shade(G_L,1.5),seed=75)
    broken_line(im,6,26,22,G_X,seed=76)
    # 台面上的物件：秤/罐/摊开的薪柴
    rect(im,9,16,12,19,shade(G_M,1.05)); hline(im,9,12,16,shade(G_L,1.3))
    rect(im,19,17,22,19,shade(G_M,0.95))
    for i in range(3): teal_glint(im,14+i*2,18,t,phase=i*0.3,size=1)
    warm_pool(im,24,15,2,t,0.1)                              # 台灯
    return im

# ============ 7 滚笼车：正被推进来、门开着 ============
def k7(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,11,2)
    COP=(0x6b,0x42,0x2a,255)
    iso_faces(im,9,6,16,27,3,G_D,G_D,G_M,seed=9)             # 底盘
    for i in range(0,19,2):                                   # 网（打断，避免规整）
        broken_line(im,8+i*0.5,8+i*0.5,y=0,c=COP,seed=i) if False else None
        for yy in range(13,26):
            if (yy+i)%3: put(im,8+i*0.5,yy,shade(COP,0.85 if (i//2)%2 else 0.6))
    for j in range(13,27,3): broken_line(im,8,24,j,COP,seed=j)
    for cx in (8,24):
        vline(im,cx,12,27,shade(G_L,0.85)); vline(im,cx+1,12,27,shade(G_L,1.3))
    # 内部堆的东西（随推动轻晃）
    off = 1 if (t%1.0)<0.5 else 0
    mottle(im,11+off,18,20+off,24,shade(G_M,0.85),seed=81,grain=1,blotch=0.18)
    teal_glint(im,14+off,20,t,size=2)
    for wx in (10,22):                                        # 轮
        rect(im,wx,29,wx+1,30,G_X); put(im,wx,29,shade(G_L,1.4))
    rust_streak(im,24,14,6,COP,seed=11)
    return im

# ============ 8 军用箱阵：整齐码放、编号朝外 ============
def k8(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,12,2)
    OL=shade((0x4a,0x52,0x33,255),0.72)
    # 下排两只 + 上排一只（码放）
    for (cx,cyg,hw,sd) in ((10,29,6,91),(22,29,6,93),(16,22,6,95)):
        iso_faces(im,hw,4,cx,cyg,6,OL,shade(OL,0.6),OL,seed=sd)
        x0,x1=cx-6,cx+6
        mottle(im,x0,cyg-5,x1,cyg,OL,seed=sd+1,blotch=0.16)
        broken_line(im,x0,x1,cyg-6,shade(OL,1.45),seed=sd+2)
        for lx in (cx-3,cx+2): latch(im,lx,cyg-4,G_L)
        rect(im,cx-2,cyg-2,cx+1,cyg-2,shade(OL,1.25))        # 编号条
    teal_glint(im,16,17,t,size=1); teal_glint(im,10,25,t,phase=0.5,size=1)
    return im

# ============ 9 抽屉柜：一层拉开、里面分格 ============
def k9(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,10,2)
    SL=(0x35,0x45,0x48,255)
    iso_faces(im,8,5,16,17,17,SL,shade(SL,0.62),SL,seed=10)
    openi=int(t*4)%4
    for i in range(4):
        dy=18+i*3
        if i==openi:
            # 拉开的抽屉：向前下方偏移，露出分格与内容
            rect(im,8,dy,24,dy+3,G_X)
            mottle(im,9,dy,23,dy+2,shade(SL,1.15),seed=100+i,grain=1,blotch=0.12)
            for gx in (12,16,20): vline(im,gx,dy,dy+2,G_X)
            teal_glint(im,13,dy+1,t,size=1); teal_glint(im,17,dy+1,t,phase=0.3,size=1)
            broken_line(im,8,24,dy+3,G_X,seed=i)
        else:
            mottle(im,10,dy,22,dy+2,SL,seed=110+i,grain=1,blotch=0.10)
            broken_line(im,10,22,dy,shade(SL,1.35),seed=i)
        handle(im,16,dy+1,G_L,length=1)
        rect(im,12,dy+1,14,dy+1,(0xb8,0xb2,0xa4,255))         # 标签
    rust_streak(im,23,20,6,(0x6b,0x42,0x2a,255),seed=13)
    return im

# ============ 10 玻璃柜：里面陈列取回的样本 ============
def k10(f,n):
    im=new(); t=f/n
    contact_shadow(im,16,31,10,2)
    COP=(0x6b,0x42,0x2a,255)
    iso_faces(im,8,5,16,17,17,G_D,shade(G_D,0.7),G_M,seed=12)
    # 铜框（打断）
    for x in range(8,25):
        if (x%7): put(im,x,12,COP); put(im,x,13,shade(COP,0.6))
        if (x%5): put(im,x,29,shade(COP,1.2))
    for y in range(12,30):
        if (y%6): put(im,8,y,COP)
        if (y%5): put(im,24,y,shade(COP,0.75))
    # 玻璃：暗底 + 两道斜反光（不连续）
    mottle(im,9,14,23,28,G_X,seed=121,grain=1,blotch=0.06,lit_top=False)
    for i in (0,9):
        for d in range(5):
            if (d+i)%2 or d<3: put(im,10+i+d,27-d,shade(G_M,1.45))
    # 内两层搁架 + 样本
    for (sy,cnt) in ((20,3),(26,2)):
        broken_line(im,9,23,sy,shade(G_M,1.15),seed=sy)
        for j in range(cnt):
            gx=12+j*4
            mottle(im,gx,sy-3,gx+2,sy-1,shade(G_M,0.9),seed=sy+j,grain=1,blotch=0.15)
            teal_glint(im,gx,sy-2,t,phase=j*0.33,size=1)
    handle(im,16,21,COP,length=2)
    return im

SPECS=[("storage-k1",k1,"值守货柜","深蓝灰"),("storage-k2",k2,"层架+分类筐","冷灰"),
       ("storage-k3",k3,"加固储物柜","冷灰"),("storage-k4",k4,"木箱堆","暖褐"),
       ("storage-k5",k5,"壁挂格架","冷灰"),("storage-k6",k6,"台面+下柜","冷灰"),
       ("storage-k7",k7,"滚笼车","暗铜"),("storage-k8",k8,"军用箱阵","苔绿"),
       ("storage-k9",k9,"抽屉柜","青灰"),("storage-k10",k10,"玻璃陈列柜","暗铜")]

TEALSET={(0x0a,0x1f,0x1e),(0x0f,0x33,0x31),(0x1d,0x5e,0x5a),(0x2f,0x96,0x8f)}
print("储藏抽卡 v4（从使用状态出发 + 概念图写实手法）")
for name,fn,label,tone in SPECS:
    frames=[fn(f,FRAMES) for f in range(FRAMES)]
    sheet=Image.new("RGBA",(W*FRAMES,H),(0,0,0,0))
    for i,fm in enumerate(frames): sheet.alpha_composite(fm,(i*W,0))
    sheet.save(os.path.join(ANIM,name+"-sheet.png"))
    json.dump({"key":name,"label":label,"theme":tone,"frameWidth":W,"frameHeight":H,
               "frames":FRAMES,"fps":8,"loop":True,"sheet":name+"-sheet.png"},
              open(os.path.join(ANIM,name+".json"),"w"),ensure_ascii=False,indent=1)
    sil=teal=dark=0; lv=set()
    for y in range(H):
        for x in range(W):
            p=frames[0].getpixel((x,y))
            if p[3]==0: continue
            sil+=1; lv.add(p[:3])
            if p[:3] in TEALSET: teal+=1
            if 0.299*p[0]+0.587*p[1]+0.114*p[2]<40: dark+=1
    d=[sum(1 for y in range(H) for x in range(W)
           if frames[i].getpixel((x,y))!=frames[i+1].getpixel((x,y))) for i in range(FRAMES-1)]
    print(f"  {name:<12}{label:<10}{tone:<6} teal {100*teal/sil:>2.0f}%  暗部 {100*dark/sil:>2.0f}%  色数 {len(lv):>3}  帧间 {min(d):>3}~{max(d):>3}px")
print("\n输出:",ANIM)
