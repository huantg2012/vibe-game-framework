/** Independent human-remnant model. Geometry lives in ground X/Y + height Z;
 * each facing is reprojected before rasterization, never a rotated bitmap. */
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { PaintBuf } from './genome/buffer';
import { createModelRaster } from './model-raster';
import type { GenomeCanvas } from './genome/types';

export type HumanPhase = 'idle' | 'walk' | 'alert' | 'windup' | 'strike' | 'recover';
export interface HumanModelRequest {
  seed: number;
  coverage: CoverageId;
  facing4: 'up' | 'down' | 'left' | 'right';
  phase: HumanPhase;
  phase01: number;
  restAmount?: number;
}
export const HUMAN_WALK_CYCLE_MS = 960;
type V = readonly [number, number, number];
type RGB = readonly [number, number, number];
// Independent material study: soot cloth, dry warm skin, folded grey-green replacement.
// No emissive channel, translucent fringe, noise texture, or borrowed palette.
const CLOTH: RGB = [98, 94, 84];
const FLESH: RGB = [159, 145, 121];
const DARK: RGB = [48, 43, 44];
const REWRITE: RGB = [83, 110, 103];
const EDGE: RGB = [182, 164, 137];
const smooth = (p: number): number => p*p*(3-2*p);

export function bakeHumanModel(req: HumanModelRequest): {buf: PaintBuf; canvas: GenomeCanvas} {
  const r = createModelRaster(req, 'human');
  const { buf, canvas, volume, tube: limb } = r;
  const level=req.coverage==='infiltrate'?0:req.coverage==='rewrite'?1:2;
  const rewritten=level===1;
  const p=Math.max(0,Math.min(1,Number.isFinite(req.phase01)?req.phase01:0));
  const gait=req.phase==='walk'?Math.sin((p===1?0:p)*Math.PI*2):0;
  const breath=req.phase==='idle'?Math.sin((p===1?0:p)*Math.PI*2)*.45:0;
  const gather=req.phase==='windup'?smooth(p):0;
  const hit=req.phase==='strike'?1-.2*smooth(p):req.phase==='recover'?.8*(1-smooth(p)):0;
  const watch=req.phase==='alert'?.5-.5*Math.cos(p*Math.PI*2):0;
  const asym=((req.seed>>>0)%7-3)*.15;
  const sink=gather*2.5+hit*2-Math.abs(gait)*.8;
  const thrust=hit*9-gather*2+gait*.7;
  const pelvis:V=[level===2?2:rewritten?1.6:0,thrust*.28,12-sink+Math.abs(gait)*.6];
  const chest:V=[rewritten?-5.5:-2-level*.6,(rewritten?7.5:5)+thrust,23-level*1.8-sink+breath];
  const crown:V=[(rewritten?-1.4:-3.5-level*.9)+asym,(rewritten?10:8)+thrust+watch,(rewritten?26.3:31-level*3.7)-sink+breath];
  const motion=(side:number):number=>gait*side;
  // The same two bearing legs persist into the middle tier. At the high tier,
  // one ankle is swallowed by the descending torso, but feet never levitate.
  for(const side of [-1,1]){
    if(level===2&&side===1)continue;
    const step=motion(side);
    const lift=req.phase==='walk'?Math.max(0,step)*2.2:0;
    const foot:V=[side*(level===2?4.4:3.3),step*3.7+hit*side+(level===2?-3:0),1.2+lift];
    const knee:V=[side*3.6+level*.25,1-step*1.4+thrust*.25,6.8-sink*.35+lift*.3];
    const hip:V=[pelvis[0]+side*2.7,pelvis[1],pelvis[2]];
    limb(foot,knee,1.65,2.1,level===2&&side===1?REWRITE:CLOTH);
    limb(knee,hip,2.1,2.45,CLOTH);
    volume([{at:[foot[0],foot[1]+1,foot[2]-.9],rx:1.8,ry:2.8},{at:foot,rx:1.6,ry:2.2}],DARK);
  }
  // Lower cloth survives as a split, weight-bearing hem, not a military coat.
  volume([{at:[pelvis[0],pelvis[1],9.5-sink],rx:4.5,ry:2.5},{at:pelvis,rx:4.3,ry:2.8},{at:[-1,1+thrust*.45,17-sink],rx:3.6,ry:2.6}],CLOTH);
  if(level>0){
    // A solid but impossibly offset waist joint; no floating debris or tendrils.
    volume([{at:[rewritten?1:-1,1+thrust*.45,15-sink],rx:3.3,ry:2.3},{at:[rewritten?-4:-2,(rewritten?5:3)+thrust*.65,18-sink],rx:rewritten?3:4.2,ry:3}],DARK);
  }
  volume([{at:[rewritten?.6:-1-level*.6,1.5+thrust,17-sink],rx:level===2?7:rewritten?3:4,ry:3},{at:chest,rx:level===2?8.5:rewritten?7.3:6.2,ry:4.4+level*.4},{at:[chest[0]-(rewritten?1.7:.4),chest[1]-.5,chest[2]+(rewritten?3.8:2.3)],rx:level===2?4:rewritten?4.8:5.3+level,ry:level===2?4.2:3.6}],level>0?REWRITE:CLOTH);
  if(rewritten){
    // The old back and the new shoulder occupy different load paths, visible from behind too.
    volume([{at:[1.8,1+thrust,17-sink],rx:2.3,ry:2.2},{at:[-1,3+thrust,21-sink],rx:3,ry:2.6},{at:[-6.5,4+thrust,24.5-sink],rx:2.1,ry:2}],CLOTH);
  }
  // Deliberately one large displacement surface, not random crack/noise fill.
  if(level>0)volume([{at:[chest[0]+2,chest[1]+2.2,chest[2]-5],rx:2.8,ry:1.2},{at:[chest[0]+1,chest[1]+2.5,chest[2]+.6],rx:3.8,ry:1.1}],REWRITE);
  else limb([chest[0]-2,chest[1]+3.25,chest[2]-3],[chest[0]+1,chest[1]+3.4,chest[2]+1],.55,.6,DARK);
  // Arms do not share the leg phase in rewrite: the retained human parts obey
  // a new causal sequence. Strike starts at the actual maximum contact pose.
  for(const side of [-1,1]){
    const wrong=level===1?(side===1?-gait*.3:gait*.7):motion(-side);
    const shoulder:V=[chest[0]+side*(6+level*.4),chest[1]+side*(rewritten?2:.7),chest[2]-.2+(side===1?(rewritten?-5:-3):rewritten?2:0)];
    const elbow:V=[shoulder[0]+side*(rewritten?(side===1?4:1):1.3+level*.7),(rewritten?4:1)+thrust*.7+wrong*2-gather*3,(rewritten?(side===1?10.5:19):17-level*.7)-sink];
    if(level===2&&side===1)continue;
    const hand:V=[shoulder[0]+side*(rewritten?(side===1?5:2):.5+level),(rewritten?6:3)+wrong*3+hit*(side===1?13:6)-gather*5,(rewritten?(side===1?4:12):10-level-(side===1?2:0)-(level===2?4:0))-sink+hit*(side===1?8:5)];
    limb(shoulder,elbow,2.25+level*.25,1.65,level===2?REWRITE:CLOTH);
    limb(elbow,hand,1.65,1.4,level===2&&side===-1?REWRITE:FLESH);
    // One blunt palm and two finger notches suffice at 1:1.
    volume([{at:[hand[0],hand[1],hand[2]-2],rx:1.6,ry:1.1},{at:[hand[0]-.35,hand[1],hand[2]+.5],rx:1.7,ry:1.2}],FLESH);
    if(side===1)limb([hand[0]+1,hand[1]+1,hand[2]-1],[hand[0]+1,hand[1]+1,hand[2]-3],.45,.4,EDGE);
  }
  if(level<2){
    limb([chest[0],chest[1],chest[2]+1], [crown[0],crown[1]-.3,crown[2]-4],1.5,1.6,DARK);
    volume([{at:[crown[0]+.5,crown[1]+.6,crown[2]-5.8],rx:2,ry:2},{at:[crown[0],crown[1],crown[2]-1],rx:2.8,ry:2.6},{at:crown,rx:2,ry:2}],FLESH);
    // Face is an erased plane with a single recessed seam, not eyes or teeth.
    limb([crown[0]+.7,crown[1]+2.55,crown[2]-4.8],[crown[0]+.7,crown[1]+2.55,crown[2]-2.2],.4,.4,DARK);
    if(level===1)limb([crown[0]-2,crown[1],crown[2]-4],[chest[0]-4,chest[1]+2,chest[2]],1.1,1.5,REWRITE);
  }else{
    // The former head is an off-axis face fossil sunk into the shoulder mass.
    volume([{at:[chest[0]-4,chest[1]+3.8,15-sink],rx:1.5,ry:.8},{at:[chest[0]-5,chest[1]+3.5,21-sink],rx:2.4,ry:1},{at:[chest[0]-5,chest[1]+2.8,23-sink],rx:1.5,ry:.8}],FLESH);
    volume([{at:[3,2+thrust*.7,1.5],rx:3.8,ry:4.3},{at:[4,1+thrust,13-sink],rx:4.8,ry:4},{at:[2,2+thrust,22-sink],rx:6,ry:4},{at:[-3,4+thrust,26-sink],rx:3.8,ry:4}],REWRITE);
    // Embedded right palm: a surviving human gesture with no free arm above it.
    limb([6,4+thrust,12-sink],[7,5+thrust,8-sink],1.35,1.6,FLESH);
    limb([chest[0]-5,chest[1]+4.5,17-sink],[chest[0]-5,chest[1]+4.5,20-sink],.45,.45,DARK);
  }
  r.finish();
  return {buf,canvas};
}
