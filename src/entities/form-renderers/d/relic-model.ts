/** Floor-bound remnants of construction and street furniture. A stationary
 * threshold/base supports individually articulated leaves, beams or clamps.
 * Wall-host skins remain a separate renderer and do not use these models. */
import { createModelRaster, modelProgress, modelSeed, smoothModel, type CreatureModelRequest, type CreatureModelResult, type ModelColor, type ModelPoint } from './model-raster';

export const DOOR_WALK_CYCLE_MS = 2200;
export const WRECKAGE_WALK_CYCLE_MS = 2040;
export const DOOR_VARIANTS = ['closed-jamb', 'broken-lintel', 'folding-gate'] as const;
export const WRECKAGE_VARIANTS = ['compressed-cabinet', 'cantilever-bench', 'wheel-cradle'] as const;
export const doorVariantOf = (seed: number): number => modelSeed(seed ^ 0x79a1c) % DOOR_VARIANTS.length;
export const wreckageVariantOf = (seed: number): number => modelSeed(seed ^ 0xc4b18) % WRECKAGE_VARIANTS.length;
const CONCRETE: ModelColor = [120, 119, 110];
const METAL: ModelColor = [110, 116, 116];
const RUST: ModelColor = [126, 103, 80];
const CUT: ModelColor = [169, 161, 139];
const DARK: ModelColor = [43, 47, 47];
const RECAST: ModelColor = [83, 112, 108];
const JOIN: ModelColor = [144, 166, 150];
type Raster = ReturnType<typeof createModelRaster>;

function box(r: Raster, at: ModelPoint, size: ModelPoint, color: ModelColor): void {
  const [x, y, z] = at, [w, d, h] = size;
  const p: ModelPoint[] = [[x-w/2,y-d/2,z-h/2],[x+w/2,y-d/2,z-h/2],[x+w/2,y+d/2,z-h/2],[x-w/2,y+d/2,z-h/2],[x-w/2,y-d/2,z+h/2],[x+w/2,y-d/2,z+h/2],[x+w/2,y+d/2,z+h/2],[x-w/2,y+d/2,z+h/2]];
  for(const ids of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]) r.face(ids.map(i=>p[i]!),color);
}

/** A four-sided beam, with its cross section perpendicular to its load axis. */
function beam(r: Raster, a: ModelPoint, b: ModelPoint, thickness: number, color: ModelColor): void {
  r.tube(a,b,thickness,thickness,color,4);
}
function motion(req: CreatureModelRequest) {
  const p=modelProgress(req.phase01), cycle=p===1?0:p;
  const rest=modelProgress(req.restAmount??0);
  const gather=req.phase==='windup'?smoothModel(p):0;
  const hit=req.phase==='strike'?1-.2*smoothModel(p):req.phase==='recover'?.8*(1-smoothModel(p)):0;
  const moving=req.phase==='walk'||req.phase==='idle';
  const settle=1-rest;
  const tremble=moving?Math.sin(cycle*Math.PI*2)*.025*settle:0;
  const watch=req.phase==='alert'?(.12+Math.sin(cycle*Math.PI*2)*.05)*settle:0;
  return {rest,settle,gather,hit,tremble,watch};
}

/** Leaf hinge has a fixed vertical bearing. The sweep advances into local +Y,
 * so the visible contact member follows the committed attack heading. */
function doorLeaf(r: Raster, hinge: ModelPoint, side: number, width: number, height: number, angle: number, color: ModelColor, split: boolean): void {
  const end: ModelPoint=[hinge[0]-side*Math.cos(angle)*width,hinge[1]+Math.sin(angle)*width,hinge[2]];
  const a:ModelPoint=[hinge[0],hinge[1],hinge[2]+height];
  const b:ModelPoint=[end[0],end[1],end[2]+height-(split?2.4:0)];
  // A slab with actual front/back and edge faces. The former zero-thickness
  // polygon vanished when viewed along the frame from either side.
  const dx=end[0]-hinge[0],dy=end[1]-hinge[1],length=Math.hypot(dx,dy)||1;
  const normal:ModelPoint=[-dy/length*(split?1.5:1.2),dx/length*(split?1.5:1.2),0];
  const slab=[hinge,end,b,a];
  const front=slab.map((p):ModelPoint=>[p[0]+normal[0],p[1]+normal[1],p[2]]);
  const back=slab.map((p):ModelPoint=>[p[0]-normal[0],p[1]-normal[1],p[2]]);
  r.face(front,color);r.face([...back].reverse(),color);
  for(let i=0;i<4;i++)r.face([front[i]!,back[i]!,back[(i+1)%4]!,front[(i+1)%4]!],color);
  beam(r,hinge,a,1.05,METAL);
  beam(r,end,b,1.05,split?JOIN:RUST);
  beam(r,a,b,1.15,color);
  beam(r,hinge,end,1.15,color);
  const mid0:ModelPoint=[hinge[0],hinge[1]+.1,hinge[2]+height*.47];
  const mid1:ModelPoint=[end[0],end[1]+.1,end[2]+height*.47];
  beam(r,mid0,mid1,split?1.7:.75,split?DARK:RUST);
  if(split) beam(r,[hinge[0],hinge[1]+.2,hinge[2]+height*.7],[end[0],end[1]+.2,end[2]+height*.3],1.1,RECAST);
}

export function bakeDoorModel(req: CreatureModelRequest): CreatureModelResult {
  // Mechanical rest closes the members instead of rescaling the construction.
  const r=createModelRaster({...req,restAmount:0},'door');
  const v=doorVariantOf(req.seed), level=req.coverage==='infiltrate'?0:req.coverage==='rewrite'?1:2;
  const {settle,gather,hit,tremble,watch}=motion(req);
  const width=v===0?11.5:v===1?12.5:9.5;
  const height=v===0?28:v===1?24.5:26;
  // Deep threshold and boxed jambs carry the 20px floor body from every view.
  box(r,[0,0,1.1],[width*2+5,18,2.2],CONCRETE);
  box(r,[0,8.6,1.6],[width*2+3,1.1,.7],CUT);
  const open=.12+settle*.5+watch+tremble-gather*.24+hit*.78;

  if(v===0){
    box(r,[-width,0,height*.5+1],[3.1,12,height],level===2?RECAST:CONCRETE);
    box(r,[width,0,(height-2)*.5+1],[3.1,12,height-2],level?RECAST:CONCRETE);
    if(level<2) box(r,[0,0,height+1],[width*2+3,12,3.1],CONCRETE);
    else {
      // The old top is rerouted into two crossing lintels at different levels.
      beam(r,[-width,0,height],[5,1,height-7],2.5,RECAST);
      beam(r,[width,0,height-2],[-5,-1,height-10],2.4,RECAST);
    }
    doorLeaf(r,[-width+1.8,4.4,2.3],-1,level===2?11.8:9.5,height-4,open+(level===1?.22:0),level?RECAST:RUST,level>0);
    if(level>0) doorLeaf(r,[width-1.8,2.5,level===1?7:3],1,level===1?7:11.3,level===1?14:19,open*.76+.27,level===1?METAL:RECAST,true);
    else doorLeaf(r,[width-1.8,2.5,2.3],1,7.2,height-4,.13+open*.35,METAL,false);
  }else if(v===1){
    // An asymmetric L-shaped ruin: the missing side is genuinely absent.
    box(r,[-width+1,0,height*.5+1],[5.1,12,height],CONCRETE);
    box(r,[width-1,0,5],[4.5,12,7.5],level?RECAST:CONCRETE);
    beam(r,[-width+1,0,height],[level?7:10,0,height-(level?7:2.3)],2.7,level?RECAST:METAL);
    doorLeaf(r,[-width+3,4.5,2.8],-1,level===2?17:15,level===2?17.5:18.5,open+.15,level?RECAST:RUST,level>0);
    if(level===1) beam(r,[width-1,0,7],[4,1,height-6],2.4,RECAST);
    if(level===2){
      // The broken beam closes across the leaf rather than growing a new limb.
      beam(r,[-width+1,0,height-4],[5,4+hit*4,12-gather*1.5],2.6,RECAST);
      box(r,[width-1,-1,9],[5.1,3.4,10],DARK);
    }
  }else{
    // A narrow folding gate, with three thick panels sharing a central hinge.
    for(const side of [-1,1])box(r,[side*width,0,height*.5+1],[2.8,12,height],level===2?RECAST:METAL);
    box(r,[0,0,height+1],[width*2+3,12,2.1],METAL);
    for(const side of [-1,1]){
      const a=open+(side===1?level*.22:0);
      const hinge:ModelPoint=[side*(width-1.2),4.4,2.7];
      doorLeaf(r,hinge,side,7.3,level===2?17:21,a,level&&side===1?RECAST:RUST,level>0);
      if(level===2){
        const end:ModelPoint=[hinge[0]-side*Math.cos(a)*7.3,hinge[1]+Math.sin(a)*7.3,8];
        doorLeaf(r,end,-side,7.2,10,a*.65+.8,RECAST,true);
      }
    }
    if(level===1)beam(r,[-width,-.8,height-4],[width,-.8,12],2.2,RECAST);
  }
  return {buf:r.buf,canvas:r.canvas};
}

export function bakeWreckageModel(req: CreatureModelRequest): CreatureModelResult {
  const r=createModelRaster({...req,restAmount:0},'wreckage');
  const v=wreckageVariantOf(req.seed), level=req.coverage==='infiltrate'?0:req.coverage==='rewrite'?1:2;
  const {settle,gather,hit,tremble,watch}=motion(req);
  box(r,[0,0,.9],[v===1?28:21,13,1.8],DARK);
  const reach=settle*2.3-gather*3+hit*9+watch*2+tremble*4;
  const lift=settle*2.7+gather*3.5-hit*3.4;
  const sweep=-gather*5+hit*6;

  if(v===0){
    // A compressed cabinet/housing with a hinged load plate, not a robot body.
    box(r,[-3,-1,10.2],[12,9,17],level===2?RECAST:METAL);
    box(r,[5,-1,7.4],[6,8,11],level?RECAST:RUST);
    box(r,[-3,3.6,10],[8.5,.8,12.4],DARK);
    for(const z of [6,11.4,16])box(r,[-3,4.2,z],[8.2,.6,.85],RUST);
    const base:ModelPoint=[-3,2,17.7];
    const end:ModelPoint=[(level===1?2:level===2?4:-2)+sweep,8+reach,15+lift-(level===2?4:0)];
    beam(r,base,end,2.3,level?RECAST:METAL);
    r.face([[-8,2,17.7],[2,2,17.7],[end[0]+5,end[1],end[2]],[end[0]-5,end[1],end[2]]],level?RECAST:RUST);
    beam(r,[end[0]-5,end[1],end[2]],[end[0]+5,end[1],end[2]],1.4,level?JOIN:CUT);
    if(level===1)box(r,[-8.4,-1,15.5],[4,7,12],RECAST);
    if(level===2){
      // Several rigid faces occupy incompatible axes but stay under one load.
      beam(r,[-8,-3,3],[-5,-2,25],2.8,RECAST);
      beam(r,[-5,-2,25],[8,3,19],3.2,RECAST);
      r.face([[-7,0,5],[-8,0,19],[4,2,22],[5,2,5]],RECAST);
      box(r,[2,4,9],[3,3,9],RUST);
    }
  }else if(v===1){
    // Wide, low seat slab and diagonal broken supports. The top can clamp down
    // into the same bearing frame instead of breathing as one scaled image.
    for(const side of [-1,1]){
      beam(r,[side*11,-4,1.7],[side*8,-2,9],2,METAL);
      beam(r,[side*11,5,1.7],[side*8,-2,9],1.8,level===2?RECAST:METAL);
    }
    box(r,[0,-1.7,8.8],[25,5,3.2],level?RECAST:RUST);
    const topY=5.6+reach, topZ=11+lift;
    r.face([[-11,-2,10.4],[11,-2,10.4],[11+sweep,topY,topZ],[-11+sweep,topY,topZ]],level===2?RECAST:RUST);
    beam(r,[-11+sweep,topY,topZ],[11+sweep,topY,topZ],1.4,level?JOIN:METAL);
    for(const side of [-1,1])beam(r,[side*10,-2,10.4],[side*10+sweep,topY,topZ],1.2,METAL);
    if(level>0){
      const top:ModelPoint=[level===1?-7:-3,-3,(level===1?22:25)+settle*1.8-gather*.9-hit*2];
      beam(r,[-9,-3,8],top,3.1,RECAST);
      beam(r,top,[8,-2,level===2?18:12],level===2?3.4:2.3,RECAST);
      if(level===2)box(r,[4,-1,7],[7,7,9],RECAST);
    }
  }else{
    // A wheel pressed into a cradle. The remnant is built around a closed ring,
    // then a displaced hub and clamping half-rim replace its circular purpose.
    const ringAt:ModelPoint=[0,-2,10];
    const count=10, radius=8.1;
    for(let i=0;i<count;i++){
      const a=i*Math.PI*2/count,b=(i+1)*Math.PI*2/count;
      const at:ModelPoint=[Math.cos(a)*radius,-2,10+Math.sin(a)*radius];
      const next:ModelPoint=[Math.cos(b)*radius,-2,10+Math.sin(b)*radius];
      beam(r,at,next,1.6,level===2?RECAST:METAL);
      if(i%2===0)beam(r,ringAt,at,.65,RUST);
    }
    r.mass([0,-1.8,10],[2.6,1.8,2.5],RUST);
    for(const side of [-1,1])beam(r,[side*9,2,1.7],[side*6,-2,12],2.2,level?RECAST:METAL);
    const end:ModelPoint=[(level===1?3.8:0)+sweep,6+reach,10+lift];
    beam(r,[0,-2,10],end,2.1,level?RECAST:RUST);
    beam(r,[end[0]-6,end[1],end[2]],[end[0]+6,end[1],end[2]],1.9,level?JOIN:METAL);
    if(level===1)r.mass([-6,-1,12],[4.2,3.4,5.1],RECAST);
    if(level===2){
      // One half-ring is folded out of plane and pressed against the old rim.
      const crownA:ModelPoint=[-5,4+settle,18.5+settle*2+gather-hit*1.5];
      const crownB:ModelPoint=[5,2,20+settle*2.2+gather-hit*1.5];
      beam(r,[-8,-2,9],crownA,2.9,RECAST);
      beam(r,crownA,crownB,2.6,RECAST);
      beam(r,crownB,[9,-1,7],3,RECAST);
      r.face([[-6,-1,5],crownA,crownB,[7,-1,5]],RECAST);
    }
  }
  return {buf:r.buf,canvas:r.canvas};
}
