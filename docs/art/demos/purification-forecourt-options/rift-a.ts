import { type Haven } from '../purification-last-light/scene';
import { type Model, type V2, type V3 } from '../purification-last-light/model';
import { carveFloor } from './shared';

export const RIFT_POSITION:V3=[1.55,0,4.45];
export const RIFT_APPROACH:V3=[1.37,.07,3.57];
export const RIFT_YAW=.20;
const c=Math.cos(RIFT_YAW),s=Math.sin(RIFT_YAW);
const world=(x:number,y:number,z:number):V3=>[RIFT_POSITION[0]+x*c+z*s,y,RIFT_POSITION[2]+z*c-x*s];
// One convex physical cut drives both the architecture and navigation. The
// throat crosses the platform's outer edge; it is not a black decal on a floor.
const NOTCH:V2[]=[[-.05,-.29],[.18,-.11],[.36,.65],[.29,2.52],[-.25,2.61],[-.39,.66]];
export const RIFT_FOOTPRINT:V3[]=NOTCH.map(([x,z])=>world(x,.08,z));
export const RIFT_INTERACTION={
  // The tear has no machine front: every bank with supporting floor is usable.
  // Share the physical cut, so moving or reshaping it cannot detach access.
  perimeter:RIFT_FOOTPRINT.map(([x,,z])=>[x,.07,z] as V3),
};
export const RIFT_FORM={shape:'ground-throat-v2',mouthWidth:.75,depth:2.12};

/** A narrow tear shears the floor, its structural bed and the hanging wall.
 * There is no above-ground portal plane. Interrupted inner radiance reveals
 * displaced strata, then disappears into a deeper opening below the building. */
function wound(m:Model):void {
  const z=[-.20,.08,.65,1.19,1.72,2.26,2.54];
  const left=[-.09,-.25,-.39,-.37,-.34,-.30,-.25];
  const right=[.07,.22,.36,.34,.32,.30,.28];
  for(const side of [-1,1]){
    const xs=side<0?left:right;
    const bank=(i:number,level:number):V3=>{
      const x=xs[i]!;
      // Successive broken courses shift sideways as well as downwards. The
      // near bank drops out early so it cannot cover the deeper rear wall.
      const offsets=[0,side*.045,side*.065+.10,side*.08+.19];
      const lip=side<0&&i>=3?[-.18,-.48,-.28,-.44][i-3]!:.055;
      const heights=[lip,Math.min(lip-.19,-.24),-.91,-2.12];
      return[x+offsets[level]!,heights[level]!+(level>0?Math.sin(i*2.4+side)*.065:0),z[i]!+level*.055];
    };
    for(let i=0;i<z.length-1;i++){
      const a=bank(i,0),b=bank(i+1,0);
      const width=(i===0?.09:.16)+(i%2)*.04;
      const outer=(p:V3):V3=>[p[0]+side*width,p[1]+(i%2?.025:0),p[2]];
      if(!(side>0&&i>=3))m.quad(outer(a),outer(b),b,a,'cutstone',side<0?.83:.72);
      // Separate stone lip, coarse construction core, and recessed masonry.
      for(let level=0;level<3;level++){
        if((side>0&&i>=3)||(side<0&&i===4&&level>0))continue;
        const aa=bank(i,level),bb=bank(i+1,level),cc=bank(i+1,level+1),dd=bank(i,level+1);
        m.quad(aa,bb,cc,dd,level===0?'cutstone':'stone',level===0?.85:level===1?.72:.48);
        if(level>0&&i>0){
          const mid:V3=[(aa[0]+dd[0])*.5,(aa[1]+dd[1])*.5,(aa[2]+bb[2])*.5];
          m.rock([mid[0]-side*.022,mid[1],mid[2]],[.085,.12+(i%2)*.08,.25],'cutstone',9810+i+level*11+(side+1)*40,.72);
        }
      }
      // Sparse, recessed living fractures: the cut is not edged with neon.
      if((side<0?[1,2,4]:[0,3]).includes(i)){
        const aa=bank(i,1),bb=bank(i+1,1);
        m.cable([[aa[0]-side*.013,aa[1]-.04,aa[2]+.04],[(aa[0]+bb[0])*.5-side*.04,-.44,(aa[2]+bb[2])*.5],[bb[0]-side*.03,bb[1]-.18,bb[2]-.04]],.023,'pollutant',.82);
        if(side<0&&i===2)m.beam([aa[0]+.025,-.47,aa[2]+.07],[bb[0]+.03,-.69,bb[2]-.08],.018,.023,'energy',.68);
      }
      if(side<0&&[2,4].includes(i)){
        const p=bank(i,2);
        m.beam([p[0]+.05,p[1]-.18,p[2]+.07],[p[0]+.10,p[1]-.49,p[2]+.18],.027,.03,'pollutant',.68);
      }
    }
  }
  // The inland tip is a broken wedge, not an erected frame or plinth.
  m.quad([-.09,.055,-.20],[.07,.055,-.20],[.10,-.30,-.12],[-.07,-.30,-.12],'cutstone',.86);
  m.quad([-.07,-.30,-.12],[.10,-.30,-.12],[.21,-1.1,.08],[.06,-1.1,.08],'stone',.6);
  // Exposed reinforcement belongs to the ripped structural bed. Neither bar
  // bridges the mouth or reads as a walkable strip.
  m.beam([-.57,-.20,.78],[-.20,-.24,.85],.037,.046,'iron',.72);
  m.beam([.52,-.27,1.59],[.21,-.38,1.70],.032,.041,'iron',.64);
  m.rock([-.47,-1.20,1.92],[.25,.45,.39],'stone',9851,.65);
  m.rock([.51,-.83,2.25],[.23,.49,.32],'stone',9852,.60);
  m.rock([-.52,.09,.62],[.19,.15,.31],'cutstone',9853,.86);
  m.rock([.46,-.65,1.76],[.18,.35,.25],'stone',9854,.68);
  m.slab([[-.37,1.45],[-.21,1.51],[-.20,1.85],[-.34,1.94]],-.57,-.70,'cutstone',.73);
  m.cable([[-.27,-.72,1.51],[-.20,-.90,1.71],[-.26,-1.04,1.84]],.032,'pollutant',.86);
  // At the production 26.5px/m scale, each short fold owns 1–2 pixels.
  // Detached depths, dark gaps and unequal bends rule out a neon perimeter.
  m.cable([[-.24,-.15,.39],[-.20,-.24,.54],[-.24,-.34,.69]],.055,'energy',.90);
  m.cable([[-.23,-.43,1.14],[-.17,-.53,1.25],[-.21,-.59,1.43]],.068,'energy',.86);
  m.cable([[-.10,-.85,1.99],[-.04,-.93,2.11],[-.08,-1.06,2.29]],.06,'energy',.81);
  // Short stress seams continue the architecture into the approaching floor.
  m.cable([[-.05,.079,-.29],[-.16,.079,-.55],[-.10,.079,-.71]],.014,'black',.62);
  m.cable([[-.43,.08,.70],[-.67,.08,.62],[-.81,.08,.44]],.015,'black',.64);
  // Radiance escapes from the interior. A faint spill above the tip lets the
  // player identify the wound before the shoulder lamp reveals its sections.
  m.light([-.06,-.18,.57],[.25,.36,.30],1.35,2.05,{kind:'pollution',id:'rift-torn-edge'});
  m.light([.03,.18,-.14],[.25,.36,.31],.70,1.85,{kind:'pollution',id:'rift-inland-spill'});
  m.light([.05,-.45,1.90],[.23,.35,.29],1.8,1.9,{kind:'pollution',id:'rift-underfloor'});
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
  station.description='左前地坪撕裂并贯穿建筑断沿的狭长裂隙；从内侧完整地坪靠近。';
}
