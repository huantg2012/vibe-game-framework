import { type V3, type Model } from '../purification-last-light/model';
import { base, type Option } from './shared';

/** A surviving wall section: the crown is a broken volume, not a dark line
 * pasted onto the walking surface. Each station describes a real cross-section. */
function brokenWall(m:Model, points:readonly {x:number;z:number;height:number;width:number}[], tint:number):void {
  for(let i=0;i<points.length-1;i++) {
    const a=points[i]!,b=points[i+1]!;
    const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
    const side=(p:typeof a,s:number,y:number):V3=>[p.x+nx*p.width*s,y,p.z+nz*p.width*s];
    const al=side(a,-.5,.08),ar=side(a,.5,.08),bl=side(b,-.5,.08),br=side(b,.5,.08);
    const at=side(a,-.5,a.height),au=side(a,.5,a.height+.035);
    const bt=side(b,-.5,b.height),bu=side(b,.5,b.height-.027);
    m.quad(al,at,bt,bl,'stone',tint);
    m.quad(ar,br,bu,au,'stone',tint*.95);
    m.quad(at,au,bu,bt,'cutstone',tint*1.03);
    if(i===0)m.quad(al,ar,au,at,'stone',tint*.92);
    if(i===points.length-2)m.quad(bl,bt,bu,br,'stone',tint*.92);
  }
}

export function buildOption():Option {
  const {model,core,world}=base();
  model.at(core.position,core.yaw,0,()=>{
    // This single L-shaped remnant joins the surviving upper-storey masonry.
    // Its open side faces the crossing; the shrine's front is never fenced in.
    model.slab([[-2.34,.58],[-1.71,.69],[-1.66,6.12],[-3.88,6.12],[-4.00,5.47],[-2.36,5.48]],.145,-.12,'cutstone',.75);
    brokenWall(model,[
      {x:-2.01,z:.73,height:.41,width:.50},
      {x:-2.00,z:1.14,height:.67,width:.52},
      {x:-2.03,z:1.62,height:.92,width:.52},
      {x:-2.02,z:2.18,height:.87,width:.55},
      {x:-2.00,z:2.66,height:1.01,width:.54},
      {x:-2.01,z:3.21,height:.96,width:.58},
      {x:-2.01,z:3.74,height:.90,width:.56},
      {x:-2.01,z:4.36,height:.99,width:.58},
      {x:-2.01,z:4.80,height:.74,width:.56},
      {x:-2.03,z:5.31,height:.91,width:.57},
      {x:-2.01,z:5.81,height:.83,width:.58},
    ],.80);
    brokenWall(model,[
      {x:-2.04,z:5.80,height:.83,width:.57},
      {x:-2.43,z:5.80,height:1.03,width:.57},
      {x:-2.81,z:5.80,height:1.02,width:.58},
      {x:-3.11,z:5.81,height:1.25,width:.59},
      {x:-3.42,z:5.82,height:1.35,width:.60},
      {x:-3.73,z:5.80,height:1.78,width:.61},
    ],.78);
    // A recessed bedding course and two surviving facing stones reveal how
    // the wall was made; chipped ends expose the rough body underneath.
    model.box([-1.711,.205,2.26],[.055,.115,1.68],'cutstone',.014,.75);
    model.box([-1.745,.64,2.52],[.09,.39,.91],'cutstone',.024,.81);
    model.box([-1.755,.61,1.64],[.095,.36,.66],'cutstone',.024,.76);
    model.box([-1.736,.65,3.56],[.075,.41,.83],'cutstone',.024,.78);
    model.box([-1.748,.37,4.92],[.074,.37,1.12],'cutstone',.024,.77);
    model.box([-2.86,.195,5.487],[1.30,.105,.075],'cutstone',.014,.72);
    model.box([-2.59,.66,5.51],[.58,.53,.10],'cutstone',.026,.76);
    model.box([-3.25,.76,5.497],[.53,.72,.115],'cutstone',.025,.80);
    // The fracture exposes a small amount of aggregate at the crown, rather
    // than distributing decorative stones across the otherwise clear floor.
    model.rock([-1.99,.94,1.60],[.24,.16,.38],'stone',8171,.87);
    model.rock([-2.03,1.025,2.67],[.34,.13,.29],'stone',8172,.82);
    model.rock([-3.12,1.25,5.80],[.35,.17,.35],'stone',8173,.78);
    model.rock([-3.72,1.78,5.77],[.48,.21,.46],'stone',8174,.78);
    // A partly surviving return ties into the pier underneath the upper floor.
    model.beam([-3.78,.22,5.78],[-3.79,2.37,5.82],.39,.46,'stone',.72);
    model.beam([-3.97,1.79,5.65],[-4.28,2.30,5.68],.115,.14,'iron',.57);
  });
  return {
    id:'b',title:'残墙围合',
    summary:'沿上层遗构接出一段低残墙，把核心前方变成单侧有依托、正面敞开的静室。',
    tradeoff:'空间归属最清楚；右侧视野会收拢，遗迹的体量也会增加。',
    model,
    route:[[2,.035,-.5],[5.1,.035,.10],[7.30,.035,.72],world(0,.035,3.90),world(0,.035,2.45)],
    stop:world(0,.035,2.45),
    footprint:[world(-1.66,.03,.57),world(-1.66,.03,6.14),world(-4.01,.03,6.14),world(-4.01,.03,5.45),world(-2.35,.03,5.45),world(-2.35,.03,.57)],
    callouts:[
      {text:'残墙与上层遗构衔接',point:world(-3.78,1.50,5.80)},
      {text:'低墙形成单侧边界',point:world(-1.72,.68,3.95)},
      {text:'正面保留宽阔入口',point:world(0,.05,3.58)},
    ],
  };
}
