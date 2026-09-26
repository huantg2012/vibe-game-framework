import { type Haven } from '../purification-last-light/scene';
import { type Model, type V2, type V3 } from '../purification-last-light/model';
import { carveFloor } from './shared';

export const RIFT_POSITION:V3=[.6,0,5.94];
export const RIFT_APPROACH:V3=[1.15,.07,4.30];
export const RIFT_YAW=-Math.atan2(1.74,4.02);
const c=Math.cos(RIFT_YAW),s=Math.sin(RIFT_YAW);
const world=(x:number,y:number,z:number):V3=>[RIFT_POSITION[0]+x*c+z*s,y,RIFT_POSITION[2]-x*s+z*c];
const NOTCH:V2[]=[[-.86,-.12],[-.47,-.42],[.36,-.38],[.97,.09],[.95,.82],[-.74,.76]];
export const RIFT_FOOTPRINT:V3[]=NOTCH.map(([x,z])=>world(x,.08,z));

/** A wound in space and the building's edge, not a constructed portal.
 * Its irregular aperture bends in depth; only interrupted torn layers emit.
 * The physical void continues below the floor into the exposed building. */
function wound(m:Model):void {
  const y=[-1.57,-1.05,-.42,.08,.57,1.02,1.39,1.74,2.06,2.37,2.64];
  const left=[-.02,-.23,-.39,-.38,-.69,-.62,-.44,-.38,-.13,.15,.41];
  const right=[.03,.15,.29,.43,.61,.70,.49,.54,.44,.36,.42];
  const bend=[.04,.08,.02,-.01,.05,.16,.11,.06,.01,-.04,-.11];
  const p=(i:number,side:number,depth=0):V3=>{
    const x=side<0?left[i]!:side>0?right[i]!:(left[i]!+right[i]!)*.5;
    // The tear rolls toward the camera above the stone. Its broad opening is
    // visible without turning the floor break away from the building's edge.
    return [x,y[i]!,bend[i]!+depth-x*Math.max(0,Math.min(.64,y[i]!*.85))];
  };
  for(let i=0;i<y.length-1;i++) {
    // A recessed throat, with asymmetrical folded skins in front of it.
    m.quad(p(i,-1,-.17),p(i+1,-1,-.19),p(i+1,1,-.19),p(i,1,-.17),'black',.51);
    for(const side of [-1,1]) {
      const a=p(i,side),b=p(i+1,side);
      const inset=(q:V3,n:number,d:number):V3=>[q[0]-side*n,q[1],q[2]+d];
      const width=(i===0||i===y.length-2)?.006:(side<0?.065:.092);
      m.quad(a,b,inset(b,width,.026),inset(a,width,.026),'pollutant',.82+(i%3)*.055);
      m.quad(inset(a,width,.026),inset(b,width,.026),inset(b,width+.060,-.11),inset(a,width+.060,-.11),'pollutant',.49);
      m.quad(inset(a,width+.060,-.11),inset(b,width+.060,-.11),p(i+1,side,-.19),p(i,side,-.17),'black',.66);
      // No closed neon outline: some edges disappear completely into darkness.
      if((side<0?[2,3,5,6,8]:[1,4,7]).includes(i)) {
        const d=side<0?.027:.034;
        m.quad(inset(a,width*.28,.044),inset(b,width*.28,.044),inset(b,width*.28+d,.049),inset(a,width*.28+d,.049),'energy',.84);
      }
    }
    // A few displaced inner echoes imply a depth discontinuity, not a lens fill.
    if([3,5,7].includes(i)) {
      const a=p(i,-1,-.10),b=p(i+1,-1,-.09);
      m.beam([a[0]+.18,a[1]+.11,a[2]],[b[0]+.13,b[1]-.13,b[2]],.034,.037,'energy',.57);
    }
  }
  // Local bed, structural core and separated hanging masonry remain one break.
  m.slab([[-1.0,-.18],[-.49,-.54],[-.37,-.33],[-.67,.18],[-.93,.26]],.074,-.23,'cutstone',.86);
  m.slab([[.37,-.47],[.99,-.01],[1.13,.24],[.70,.32],[.47,.04]],.072,-.29,'cutstone',.82);
  m.rock([-.73,-.62,.15],[.47,1.05,.51],'stone',9731,.76);
  m.rock([.63,-.87,.12],[.42,1.38,.48],'stone',9732,.77);
  m.rock([-.52,-1.46,.21],[.29,.53,.35],'stone',9733,.69);
  m.beam([-.92,-.27,-.03],[-.38,-.34,.24],.06,.08,'iron',.62);
  m.beam([.72,-.36,.02],[.37,-.55,.32],.05,.075,'iron',.58);
  // Stress traces continue inland, below ankle height and outside the stand pad.
  m.cable([[-.47,.085,-.35],[-.72,.085,-.65],[-1.03,.085,-.67],[-1.32,.085,-.96]],.019,'black',.6);
  m.cable([[.43,.08,-.32],[.82,.08,-.68],[1.22,.08,-.72]],.017,'black',.6);
  m.cable([[-.46,.09,-.31],[-.58,.09,-.43],[-.70,.09,-.56]],.026,'pollutant',.70);
  m.rock([-.89,.15,-.26],[.29,.24,.31],'stone',9734,.78);
  m.rock([.86,.12,-.09],[.23,.18,.30],'stone',9735,.8);
  // Broken matter is displaced along the tear, never in a symmetrical halo.
  m.rock([-.68,.80,.04],[.14,.23,.09],'stone',9736,.78);
  m.rock([.68,1.60,.02],[.10,.20,.07],'stone',9737,.70);
  m.light([-.23,.91,.36],[.26,.37,.31],1.30,2.9,{kind:'pollution',id:'rift-torn-edge'});
  m.light([.12,.66,-.58],[.26,.37,.32],1.20,3.2,{kind:'pollution',id:'rift-inland-spill'});
  m.light([.01,-.68,.31],[.24,.35,.30],.75,1.9,{kind:'pollution',id:'rift-underfloor'});
}

export function rebuildRift(haven:Haven):void {
  const {model}=haven;
  const station=haven.stations.find(station=>station.key==='rift');
  if(!station)throw new Error('A requires the existing Rift interaction.');
  for(let i=model.triangles.length-1;i>=0;i--)if(model.triangles[i]!.object===station.id)model.triangles.splice(i,1);
  for(let i=model.lights.length-1;i>=0;i--)if(model.lights[i]!.id.startsWith('rift-'))model.lights.splice(i,1);
  carveFloor(model,NOTCH.map(([x,z])=>{const p=world(x,0,z);return [p[0],p[2]] as V2;}),.25);
  model.at(RIFT_POSITION,RIFT_YAW,station.id,()=>wound(model));
  station.position=RIFT_POSITION;station.yaw=RIFT_YAW;station.approach=RIFT_APPROACH;
  station.description='左前断沿中的时空伤口；从内侧完整地坪靠近并备行。';
}
