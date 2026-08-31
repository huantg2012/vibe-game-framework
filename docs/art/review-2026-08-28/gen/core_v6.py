#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
COH 核心抽卡 v6 —— 真正的等距(45°)投影重写
★ v4/v5 的根本错误：顶面只做了 y 压缩，没有旋转 45°。
  正确等距：sx=(dx-dy)/2, sy=(dx+dy)/2*K  → 正方形 footprint 投影成菱形。
  缺了旋转，画出来是"压扁的俯视"，不是斜视 —— 这就是一直没有 45° 的原因。
★ 另修正：侧面下边缘应跟随底面轮廓，v5 拉成了水平线。
"""
from PIL import Image
import os, math, random

W, H = 32, 40
K = 0.55                       # 公约：顶面压缩比
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cards"))

CORE_X=(0x14,0x17,0x1b,255); CORE_D=(0x22,0x26,0x2c,255)
CORE_M=(0x33,0x39,0x42,255);  CORE_L=(0x46,0x4d,0x58,255)
MET_D =(0x1a,0x1e,0x24,255);  MET_M =(0x2e,0x34,0x3c,255)
MET_L =(0x42,0x49,0x53,255)
TEAL_X=(0x0a,0x1f,0x1e,255);  TEAL_D=(0x0f,0x33,0x31,255)
TEAL_M=(0x1d,0x5e,0x5a,255);  TEAL_L=(0x2f,0x96,0x8f,255)
WARM  =(0x8a,0x5a,0x2a,255);  WARM_D=(0x5a,0x3a,0x1c,255)
GRD   =(0x18,0x1c,0x21,255);  SHADOW=(0x08,0x0a,0x0c,255)

def lum(c): return 0.299*c[0]+0.587*c[1]+0.114*c[2]
def new(): return Image.new("RGBA",(W,H),(0,0,0,0))
def put(im,x,y,c):
    xi,yi=int(round(x)),int(round(y))
    if 0<=xi<W and 0<=yi<H: im.putpixel((xi,yi),c)
def hline(im,a,b,y,c):
    for x in range(int(round(min(a,b))),int(round(max(a,b)))+1): put(im,x,y,c)
def vline(im,x,a,b,c):
    for y in range(int(round(min(a,b))),int(round(max(a,b)))+1): put(im,x,y,c)
def line(im,x0,y0,x1,y1,c):
    n=int(max(abs(x1-x0),abs(y1-y0))) or 1
    for i in range(n+1): put(im,round(x0+(x1-x0)*i/n),round(y0+(y1-y0)*i/n),c)
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

# ★ 真正的等距投影：旋转 45° + 压缩
def iso(dx,dy):
    sx=(dx-dy)*0.5
    sy=(dx+dy)*0.5*K
    return sx,sy

TOPS=[]; PRISMS=[]
def iso_prism(im, footprint, cx, cy_ground, height, top_c, side_cs,
              warp=None, seed=1):
    """
    footprint : 俯视平面多边形 [(dx,dy)]（未投影）
    cy_ground : 物体接地点在屏幕上的 y（底面中心）
    height    : 物体高度（屏幕像素，竖直向上）
    side_cs   : 各侧面颜色（按边序循环）
    """
    n=len(footprint); warp=warp or [0]*n
    PRISMS.append((list(footprint),cx,cy_ground,height,list(warp),top_c,list(side_cs)))
    proj=[iso(dx,dy) for dx,dy in footprint]
    # 顶面：整体上移 height
    top=[(cx+sx, cy_ground-height+sy+warp[i]) for i,(sx,sy) in enumerate(proj)]
    # 底面：地面上
    bot=[(cx+sx, cy_ground+sy) for sx,sy in proj]
    # 侧面：只画朝向观察者的边（边中点 sy 较大 = 前侧）
    for i in range(n):
        j=(i+1)%n
        if (proj[i][1]+proj[j][1])/2 <= 0: continue       # 后侧边，被顶面遮住
        fill_poly(im,[top[i],top[j],bot[j],bot[i]], side_cs[i%len(side_cs)])
    fill_poly(im, top, top_c)
    TOPS.append(list(top))
    return top

def ground_band(im,y0,y1,cx=16,rx=11,c=SHADOW,c2=GRD):
    for k,y in enumerate(range(y0,y1+1)):
        r=rx*(0.72+0.28*k/max(1,(y1-y0)))
        hline(im,cx-r,cx+r,y,c2 if k else c)

def render_break(im,x0,y0,x1,y1,seed=0,shift=1,scatter=8):
    rnd=random.Random(seed)
    for y in range(int(y0),int(y1)+1):
        off=int(round(math.sin(y*2.1+seed)*shift))
        for x in range(int(x0),int(x1)+1):
            if im.getpixel((x,y))[3]==0: continue
            t=(y-y0)/max(1,(y1-y0))
            c=TEAL_L if abs(t-0.5)<0.18 else (TEAL_M if abs(t-0.5)<0.34 else TEAL_D)
            put(im,x+off,y,c)
    for _ in range(scatter):
        ex=int(x0+rnd.random()*(x1-x0))+rnd.choice([-3,-2,2,3])
        ey=int(y0+rnd.random()*(y1-y0))+rnd.choice([-2,-1,1,2])
        if 0<=ex<W and 0<=ey<H:
            if im.getpixel((ex,ey))[3]>0 or rnd.random()<0.4:
                put(im,ex,ey,rnd.choice([TEAL_D,TEAL_M]))

def pipe(im,pts,c1=MET_L,c2=MET_D):
    for i in range(len(pts)-1): line(im,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],c1)
    for i in range(len(pts)-1): line(im,pts[i][0],pts[i][1]+1,pts[i+1][0],pts[i+1][1]+1,c2)
def warm_patch(im,x,y,w=3,h=2):
    rect(im,x,y,x+w-1,y+h-1,WARM_D); rect(im,x,y,x+w-2,y+h-2,WARM); put(im,x,y,WARM)
def bolt(im,x,y): put(im,x,y,MET_L)
def gauge(im,cx,cy,r=2):
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            if (x-cx)**2+(y-cy)**2<=r*r: put(im,x,y,MET_M)
    put(im,cx,cy,TEAL_L)
def vstripes(im,x0,x1,y0,y1,c,step=3):
    x=x0
    while x<=x1: vline(im,x,y0,y1,c); x+=step

# ============ A 敬畏：高瘦（footprint 小、height 大）============
def build_a():
    TOPS.clear(); im=new()
    # 俯视：不规则五边形（小占地）→ 投影成菱形
    fp=[(-4.5,-4.5),(4.5,-5.0),(5.0,4.0),(-1.0,5.5),(-5.0,2.0)]   # 放大占地：顶面太小时菱形读不出
    iso_prism(im,fp,16,34,22,
              top_c=TEAL_M,
              side_cs=[TEAL_X,TEAL_D,TEAL_M,TEAL_X],
              warp=[0,-1.2,0.6,0,1.0],seed=3)
    vstripes(im,11,21,14,31,TEAL_X,step=2)
    render_break(im,13,20,19,26,seed=3,shift=1,scatter=8)
    ground_band(im,34,36,rx=8)
    # 外挂：最小
    hline(im,10,22,31,MET_M); hline(im,10,22,32,MET_D)
    for (ax,ay,bx,by) in [(9,34,12,30),(23,34,20,30)]: line(im,ax,ay,bx,by,MET_D)
    pipe(im,[(21,27),(26,27),(26,33),(31,33)])
    bolt(im,12,31); bolt(im,19,31)
    warm_patch(im,24,28,3,2)
    return im,list(TOPS)

# ============ B 仪式：宽矮神龛（footprint 大、height 小）============
def build_b():
    TOPS.clear(); im=new()
    iso_prism(im,[(-9,-6),(-1,-8),(6,-6),(9,1),(2,7),(-7,6)],16,33,10,
              top_c=CORE_L,
              side_cs=[CORE_M,CORE_D,CORE_X,CORE_D,CORE_M],   # ★侧面不得含 CORE_L（与顶面同亮→斜面消失）
              warp=[0,0,-0.9,0.5,0,0],seed=9)
    # 暗内部
    fill_poly(im,[(13,24),(20,24),(19,29),(14,29)],CORE_X)
    # 内核（小，嵌在顶面）
    iso_prism(im,[(-2.6,-2.2),(0.8,-2.6),(2.8,0.4),(0.4,2.4),(-2.4,1.8)],
              16,30,5,top_c=TEAL_D,
              side_cs=[TEAL_X,TEAL_D,TEAL_M],seed=8)
    render_break(im,14,26,19,29,seed=9,shift=1,scatter=5)
    # 立柱：小 footprint、高 height，立在主体两侧
    for (dx,dy) in [(-11,-3),(11,-3)]:
        iso_prism(im,[(-1.8,-1.8),(1.8,-1.8),(1.8,1.8),(-1.8,1.8)],
                  16+dx*0.5, 33+dy*0.5*K-2, 14, top_c=CORE_L,
                  side_cs=[CORE_D,CORE_M],seed=4)
    # 横梁：长条 footprint，架在柱顶
    iso_prism(im,[(-9,-2.2),(9,-2.2),(9,2.2),(-9,2.2)],16,19,4,
              top_c=CORE_M,side_cs=[CORE_D,CORE_D],seed=6)
    ground_band(im,35,37,rx=13)
    warm_patch(im,4,30,4,2)
    gauge(im,30,28,2)
    return im,list(TOPS)

# ============ C 封印：中等箱体 ============
def build_c():
    TOPS.clear(); im=new()
    iso_prism(im,[(-8.5,-6.5),(8.5,-6.5),(8.5,6.5),(-8.5,6.5)],16,34,14,
              top_c=MET_L,                           # ★顶面要够亮：MET_M 与侧面差仅 21.6，不足公约 30
              side_cs=[MET_D,MET_D,MET_M,MET_D],     # 侧面以暗为主，拉开明暗差
              seed=5)
    # 加固带：★画在顶面内且用暗色。画在侧面会把侧面拉亮，斜面就读不出了
    for y in (20,21): hline(im,11,21,y,MET_D)
    # 分层线
    for y in (28,31): hline(im,9,23,y,SHADOW)
    # 内部暗区 + 观察窗
    rect(im,12,27,16,31,SHADOW)
    for (wx,wy,ww,wh) in [(13,28,3,2),(19,26,3,2)]:
        rect(im,wx,wy,wx+ww,wy+wh,CORE_X)
        for xx in range(wx,wx+ww+1): put(im,xx,wy,MET_L); put(im,xx,wy+wh,MET_L)
        render_break(im,wx+1,wy+1,wx+ww-1,wy+wh-1,seed=5,shift=1,scatter=3)
    pipe(im,[(24,26),(28,26),(28,34),(31,34)])
    pipe(im,[(8,33),(5,33),(5,29),(1,29)])
    gauge(im,27,29,2); gauge(im,5,31,2)
    ground_band(im,35,37,rx=12)
    warm_patch(im,15,33,4,2)
    return im,list(TOPS)

# ---------------- 生成 ----------------
os.makedirs(os.path.join(OUT,"preview3x"),exist_ok=True)
specs=[("core-v6-a",build_a),("core-v6-b",build_b),("core-v6-c",build_c)]
made=[]; PRISM_REGISTRY={}
for nm,fn in specs:
    PRISMS.clear(); im,tops=fn(); PRISM_REGISTRY[nm]=list(PRISMS)
    p=os.path.join(OUT,nm+".png"); im.save(p)
    big=im.resize((W*3,H*3),Image.NEAREST)
    bp=os.path.join(OUT,"preview3x",nm+"-3x.png"); big.save(bp)
    made.append((nm,im,p,big,bp,tops))

CMP_W=W*3*3+8*2
cmp=Image.new("RGBA",(CMP_W,H*3),(0x0d,0x11,0x14,255))
xo=0
for nm,im,p,big,bp,tops in made:
    cmp.alpha_composite(big,(xo,0)); xo+=W*3+8
cmp_p=os.path.join(OUT,"preview3x","compare-core-v6.png"); cmp.save(cmp_p)

print("="*70)
for nm,im,p,big,bp,tops in made:
    sil=[(x,y) for y in range(H) for x in range(W) if im.getpixel((x,y))[3]>0]
    xs=[a for a,b in sil]; ys=[b for a,b in sil]
    teal=sum(1 for y in range(H) for x in range(W)
             if (lambda c: c[3]>0 and c[1]>c[0]+25 and c[2]>c[0]+15)(im.getpixel((x,y))))
    warm=sum(1 for y in range(H) for x in range(W)
             if im.getpixel((x,y))[:3] in (WARM[:3],WARM_D[:3]))
    dark=sum(1 for x,y in sil if lum(im.getpixel((x,y)))<40)
    cols=im.getcolors()
    t=max(tops,key=lambda T:(max(a for a,b in T)-min(a for a,b in T))*(max(b for a,b in T)-min(b for a,b in T)))
    tx=[a for a,b in t]; ty=[b for a,b in t]
    tw,th=max(tx)-min(tx),max(ty)-min(ty)
    print(f"[{nm}] 剪影 {max(xs)-min(xs)+1}x{max(ys)-min(ys)+1}")
    print(f"  最大顶面 {tw:.1f}x{th:.1f}  压缩比 {th/tw:.2f}")
    print(f"  暗部 {100*dark/len(sil):.1f}%  teal {teal}  暖 {warm}  色数 {len(cols)}")
    print(f"  -> {p} ({os.path.getsize(p)}B)")
print("="*70); print(f"对比图 {cmp_p}")
