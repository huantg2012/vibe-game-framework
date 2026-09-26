import {base,carveFloor,type Option} from './shared';
import {type Model,type V2,type V3} from '../purification-last-light/model';
import { rebuildRift, RIFT_APPROACH, RIFT_FOOTPRINT } from './rift-a';

// The building has lost this floor, rather than acquiring a painted dark patch.
// All corners stay convex so the shared clipping operation has one clear solid.
const BREACH:V2[]=[[5.2,-1.65],[8.1,-2.15],[11.7,-1.4],[11.6,.55],[9.95,1.95],[7.65,2.68],[5.30,.85]];

/** Exposed strata and hanging broken wall continue below the new inner edge.
 * Nothing closes the bottom of the void: far fabric is visible through it. */
function section(m:Model,path:readonly V2[]):void {
  let index=0;
  for(let edge=0;edge<path.length;edge++) {
    const a=path[edge]!,b=path[(edge+1)%path.length]!;
    const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
    const n=Math.max(3,Math.ceil(len/.61));
    const stations=Array.from({length:n+1},(_,j)=>{
      const t=j/n,x=a[0]+dx*t,z=a[1]+dz*t;
      const notch=j===0||j===n?.035:.035+((j*7+edge*3)%5)*.025;
      return {
        outer:[x,.002,z] as V3,
        lip:[x+nx*notch,-.028-((j+edge)%3)*.017,z+nz*notch] as V3,
        bed:[x+nx*(notch+.065),-.21-((j+edge)%4)*.018,z+nz*(notch+.065)] as V3,
        body:[x+nx*(notch-.015),-.93-((j*2+edge)%5)*.055,z+nz*(notch-.015)] as V3,
        tail:[x+nx*(notch+.05),-2.45-((j*3+edge)%7)*.22,z+nz*(notch+.05)] as V3,
      };
    });
    for(let j=0;j<n;j++) {
      const s=stations[j]!,t=stations[j+1]!;
      m.quad(s.outer,s.lip,t.lip,t.outer,'cutstone',.86);
      m.quad(s.lip,s.bed,t.bed,t.lip,'cutstone',.78);
      m.quad(s.bed,s.body,t.body,t.bed,'stone',.74);
      // Selected pieces terminate early, exposing deeper broken structure.
      if((j+edge)%4!==1)m.quad(s.body,s.tail,t.tail,t.body,'stone',.68);
      if((index++%5)===0) {
        const x=(s.body[0]+t.body[0])*.5,z=(s.body[2]+t.body[2])*.5;
        m.rock([x,-.53,z],[.24,.27,.23],'stone',9320+index,.76);
      }
    }
  }
  m.beam([7.09,-.38,-1.85],[7.25,-3.72,-1.83],.37,.45,'stone',.72);
  m.beam([10.83,-.46,-1.59],[10.56,-3.16,-1.40],.35,.48,'stone',.70);
  m.beam([6.62,-.57,-1.52],[10.99,-.67,-1.39],.21,.38,'iron',.61);
  m.beam([7.33,-.19,-1.73],[7.39,-2.07,-1.47],.044,.055,'iron',.64);
  m.beam([10.67,-.24,-1.48],[10.55,-1.79,-1.28],.050,.059,'iron',.67);
  m.cable([[8.02,-.25,-1.80],[8.21,-1.86,-1.71],[8.89,-2.29,-1.43],[9.47,-1.87,-1.12],[9.86,-.26,-1.45]],.054,'iron',.53);
}

/** Broad stone/steel gallery with bearings overlapping the uncut floor. */
function crossing(m:Model):void {
  const a:V2=[4.80,-1.48],b:V2=[12.00,.83];
  const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
  const point=(t:number,w:number,y:number):V3=>[a[0]+dx*t+nx*w,y,a[1]+dz*t+nz*w];
  const corners=[point(0,-1.13,.058),point(1,-1.13,.058),point(1,1.13,.058),point(0,1.13,.058)];
  m.slab(corners.map(p=>[p[0],p[2]] as V2),.057,-.29,'cutstone',.88);
  for(const w of [-.89,.89]) {
    m.beam(point(-.035,w,-.40),point(1.035,w,-.40),.19,.43,'iron',.66);
    m.beam(point(-.05,w,-.165),point(1.05,w,-.165),.33,.11,'iron',.61);
    m.beam(point(-.05,w,-.62),point(1.05,w,-.62),.34,.10,'iron',.65);
  }
  for(const t of [.02,.32,.67,.98])m.beam(point(t,-1.10,-.56),point(t,1.10,-.56),.13,.24,'iron',.57);
  for(const t of [0,1]) {
    const p=point(t,0,-.38);
    m.at(p,Math.atan2(dx,dz),0,()=>m.box([0,0,0],[2.55,.34,.54],'stone',.028,.75));
  }
  // Actual narrow fractures, not a ceremonial tile grid.
  m.cable([point(.27,-1.13,.061),point(.29,-.46,.061),point(.25,.14,.061),point(.31,.53,.061)],.019,'black',.52);
  m.cable([point(.70,1.13,.061),point(.68,.64,.061),point(.73,.08,.061)],.017,'black',.49);
  m.rock(point(.40,-1.13,-.02),[.28,.15,.28],'stone',9387,.77);
  m.rock(point(.73,1.13,-.03),[.23,.13,.31],'stone',9388,.79);
}

export function buildOption():Option {
  const haven=base();
  const {model,core,stations}=haven;
  carveFloor(model,BREACH,.25);
  section(model,BREACH);
  crossing(model);
  rebuildRift(haven);
  return {
    id:'a',title:'断裂回廊 · 断沿裂隙',
    summary:'保留 A 的断口与宽回廊。裂隙移到左前断沿，竖向撕开空间并贯穿楼板剖面；备行站位留在内侧完整地坪。',
    tradeoff:'出发与朝拜各有接近路线。边缘伤口朝外延伸，不侵占炉边休息或西侧设备的操作面。',
    model,stations,changedObjects:[0,6],carved:BREACH,
    design:[
      '左前出发、右侧朝拜；核心、炉席与四个设备保持原位。',
      '裂隙采用不对称的深色内喉、错层薄边与断续灰绿微光，光落在地坪和建筑切面上。',
      '备行点位于完整地坪，离开休息区后可直接接近；功能仍是准备出发。',
    ],
    route:[[3.8,.035,3.8],[4.10,.035,1.15],[3.70,.035,-.77],[4.80,.07,-1.48],[8.40,.07,-.325],[12.00,.07,.83],core.approach],
    routes:[
      {label:'从西楼梯直达核心',points:[[2,.035,-.5],[3.2,.035,-1.25],[4.80,.07,-1.48],[8.40,.07,-.325],[12.00,.07,.83],core.approach]},
      {label:'站立参考点 → 裂隙备行',points:[[3.8,.035,3.8],[2.25,.06,4.08],RIFT_APPROACH]},
      {label:'西楼梯 → 净化器',points:[[2,.035,-.5],[1.0,.05,.8],[-.803981,.07,1.720855]]},
    ],
    stop:RIFT_APPROACH,
    footprint:RIFT_FOOTPRINT,
    callouts:[
      {text:'真实断口：可见多层剖面',point:[7.84,-.54,1.59]},
      {text:'宽石回廊 · 2.26m',point:[8.40,.09,-.325]},
      {text:'时空伤口贯穿前断沿',point:[.6,1.25,5.94]},
      {text:'内侧完整地坪备行',point:RIFT_APPROACH},
    ],
  };
}
