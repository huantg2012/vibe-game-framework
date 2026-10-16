/** Three candidate bodies, authored as real local-space components. A is the
 * unmodified production Haven model. B/C retain the same skeleton and rigid
 * identity pieces, replacing only coat and pack geometry before articulation.
 * No production module is changed; the selected version can later be promoted.
 */
import { Model, add, cross, dot, mul, sub, unit, type Material, type V3 } from '../../docs/art/demos/purification-last-light/model';
import { buildActor, ACTOR_HEIGHT, ACTOR_OBJECT_ID, ACTOR_LAMP_LOCAL } from '../../docs/art/demos/purification-last-light/actor';
import { lastLightWalkLeg, lastLightIdleLift, lastLightFootPoint, lastLightWalkTorsoPoint, lastLightWalkUpperPoint, lastLightWalkArm } from '../../src/art/last-light-gait';

export type CandidateId='a'|'b'|'c'|'haven';
type ClothedVariant='b'|'c';
export function buildCandidateActor(m:Model,id:CandidateId,position:V3=[0,0,0],facing=0,breath=0,walkPhase?:number,settle=0):void {
  if(id==='a'||id==='haven')buildActor(m,position,facing,breath,walkPhase,settle);
  else buildClothedActor(id,m,position,facing,breath,walkPhase,settle);
}

function buildClothedActor(variant:ClothedVariant,m:Model,position:V3,facing:number,breath=0,walkPhase?:number,settle=0):void {
  if(settle>=1){walkPhase=undefined;breath=0;settle=0;}
  const previousLayer=m.layer;
  m.layer='haven';
  m.at(position,facing,ACTOR_OBJECT_ID,()=>{
    const walking=walkPhase!==undefined;
    const cycle=(walkPhase??0)/(Math.PI*2);
    const lift=lastLightIdleLift(breath);
    // Separated, weight-bearing legs. The right boot is half a pace forward.
    for(const [x,z,t] of [[-.148,-.075,.88],[.143,.080,1.04]] as const) {
      if(walking){
        const leg=lastLightWalkLeg(cycle,x>0,settle);
        const hip=leg.hip as V3,knee=leg.knee as V3,ankle=leg.ankle as V3;
        posePart(m,point=>lastLightFootPoint(leg,point),boot=>{
          boot.box([x,.055,.047],[.184,.105,.286],'black',.038,.96);
          loaf(boot,[[x,.09,.047,.093,.133],[x,.16,.025,.094,.119],[x,.235,-.020,.086,.092]],'cloth',t*.80,10);
          boot.beam([x-.069,.209,.063],[x+.070,.214,.062],.024,.021,'cloth',t*.62);
        });
        limb(m,hip,knee,.100,.083,'cloth',t);
        limb(m,knee,ankle,.082,.078,'cloth',t);
        loaf(m,[[knee[0],knee[1]-.055,knee[2],.076,.073],[knee[0],knee[1],knee[2]+.009,.086,.089],[knee[0],knee[1]+.050,knee[2],.078,.073]],'cloth',t,10);
        m.beam([knee[0]-.063,knee[1]+.012,knee[2]+.065],[knee[0]+.054,knee[1]+.025,knee[2]+.064],.024,.018,'cloth',t*1.18);
        continue;
      }
      const stride=0,rise=0,ankle=z,knee=z;
      m.box([x,.055+rise,ankle+.047],[.184,.105,.286],'black',.038,.96);
      loaf(m,[
        [x,.09+rise,ankle+.047,.093,.133],
        [x,.16+rise,ankle+.025,.094,.119],
        [x,.235+rise,ankle-.020,.086,.092],
      ],'cloth',t*.80,10);
      loaf(m,[
        [x,.203+rise,ankle-.018,.079,.079],
        [x,.38+rise*.38,knee-.017,.077,.078],
        [x+(x<0?.008:-.008),.52+lift*.3,z-.028+stride*.17,.084,.098],
        [x*.87,.735+lift,z-.041,.099,.104],
      ],'cloth',t,10);
      // Cloth folds follow the knee and boot cuff, not armour kneepads.
      m.beam([x-.065,.392+rise*.38,knee+.055],[x+.055,.405+rise*.38,knee+.061],.024,.018,'cloth',t*1.18);
      m.beam([x-.069,.209+rise,ankle+.063],[x+.070,.214+rise,ankle+.062],.024,.021,'cloth',t*.62);
    }

    posePart(m,point=>walking?lastLightWalkTorsoPoint(point,cycle,settle):add(point,[0,lift,0]),torso=>{
      buildCoat(torso,variant,cycle,walking);
      torso.beam([-.222,.792,.108],[.213,.795,.116],.047,.038,'cloth',.58);
      torso.box([.022,.80,.171],[.056,.052,.023],'bronze',.008,.78);
      torso.beam([.023,.847,.16],[.022,1.18,.165],.020,.015,'black',.85);
      torso.box([-.126,1.033,.176],[.129,.126,.043],'cloth',.022,.98);
      torso.beam([-.190,1.095,.185],[-.068,1.095,.185],.027,.018,'cloth',1.23);
    });

    posePart(m,point=>walking?lastLightWalkUpperPoint(point,cycle,settle,'pack'):add(point,[0,lift,0]),torso=>{
      buildPack(torso,variant);
    });

    // The shoulder/elbow/wrist chain is already posed by the shared body rig.
    // Build those joints directly; mapping them through the chest again would
    // rotate twice and pull the elbows and hands away from the sleeves.
    if(walking){
      const left=lastLightWalkArm(false,cycle,settle),right=lastLightWalkArm(true,cycle,settle);
      limb(m,left.shoulder,left.elbow,.103,.095,'cloth',1.38);
      limb(m,left.elbow,left.wrist,.086,.079,'cloth',1.20);
      limb(m,right.shoulder,right.elbow,.099,.094,'cloth',1.40);
      limb(m,right.elbow,right.wrist,.084,.078,'cloth',1.25);
      posePart(m,handPoint([-.328,.943,.041],[-.312,.758,.083],left.elbow,left.wrist),hand=>{
        loaf(hand,[[-.311,.707,.083,.073,.062],[-.316,.757,.082,.078,.067],[-.318,.80,.076,.067,.059]],'cloth',.56,10);
      });
      posePart(m,handPoint([.331,.955,.006],[.328,.775,.066],right.elbow,right.wrist),hand=>{
        loaf(hand,[[.328,.723,.063,.070,.061],[.329,.775,.065,.076,.068],[.329,.814,.060,.067,.06]],'cloth',.60,10);
      });
    }else posePart(m,point=>add(point,[0,lift,0]),torso=>{
      limb(torso,[-.279,1.142,.012],[-.328,.943,.041],.103,.095,'cloth',1.38);
      limb(torso,[-.328,.943,.041],[-.312,.758,.083],.086,.079,'cloth',1.20);
      limb(torso,[.276,1.145,.008],[.331,.955,.006],.099,.094,'cloth',1.40);
      limb(torso,[.331,.955,.006],[.328,.775,.066],.084,.078,'cloth',1.25);
      loaf(torso,[[-.311,.707,.083,.073,.062],[-.316,.757,.082,.078,.067],[-.318,.80,.076,.067,.059]],'cloth',.56,10);
      loaf(torso,[[.328,.723,.063,.070,.061],[.329,.775,.065,.076,.068],[.329,.814,.060,.067,.06]],'cloth',.60,10);
    });

    posePart(m,point=>walking?lastLightWalkUpperPoint(point,cycle,settle,'head'):add(point,[0,lift,0]),torso=>{
      // The round protective hood/helmet and one black visor slit carry the
      // strongest facial identity from the production sprite. Never paired eyes.
      loaf(torso,[[0,1.211,.021,.148,.123],[0,1.292,.015,.151,.122],[0,1.337,.016,.117,.102]],'cloth',.63,12);
      loaf(torso,[
        [0,1.307,.007,.142,.120],
        [0,1.381,.011,.185,.160],
        [0,1.472,.014,.197,.176],
        [0,1.566,.003,.176,.157],
        [0,1.632,-.006,.118,.107],
        [0,ACTOR_HEIGHT,-.009,.046,.050],
      ],'iron',1.18,16);
      // Rolled lower rim of the helmet; only actual exposed metal catches light.
      ovalBand(torso,[0,1.382,.011],.191,.168,.029,'iron',1.02,16);
      for(let j=0;j<7;j++) {
        const a=Math.PI*.19+j/7*Math.PI*.62,b=Math.PI*.19+(j+1)/7*Math.PI*.62;
        torso.quad([Math.cos(a)*.199,1.438,.014+Math.sin(a)*.178],[Math.cos(b)*.199,1.438,.014+Math.sin(b)*.178],[Math.cos(b)*.198,1.485,.014+Math.sin(b)*.178],[Math.cos(a)*.198,1.485,.014+Math.sin(a)*.178],'black',.91);
      }
      torso.beam([-.066,1.638,-.078],[.040,1.651,-.039],.020,.016,'iron',1.07);
      torso.box([-.176,1.423,-.003],[.052,.099,.093],'iron',.015,.66);
      torso.box([.176,1.423,-.003],[.052,.099,.093],'iron',.015,.69);
    });

    posePart(m,point=>walking?lastLightWalkUpperPoint(point,cycle,settle,'chest'):add(point,[0,lift,0]),torso=>{
      // One compact lamp on the character's right shoulder. The lens and a tiny
      // side window emit; the housing remains opaque and casts real shadows.
      torso.beam([.24,1.179,.017],[.37,1.179,.043],.042,.051,'iron',.68);
      torso.box([.401,1.211,.101],[.152,.140,.177],'iron',.023,.95);
      torso.box([.401,1.211,.195],[.108,.081,.017],'lamp',.006,1);
      torso.box([.480,1.211,.132],[.012,.053,.065],'lamp',.004,.61);
      // A small rear aperture keeps the single shoulder lantern recognizable
      // in the default back-facing stance without turning the helmet into eyes.
      torso.box([.401,1.211,.006],[.082,.056,.010],'lamp',.003,.54);
      torso.beam([.353,1.17,.207],[.451,1.17,.207],.020,.017,'iron',.6);
      torso.cable([[.356,1.199,.055],[.306,1.14,-.067],[.264,1.018,-.206]],.022,'black',.9);
      torso.light(ACTOR_LAMP_LOCAL,[1,.83,.55],.65,2.6,{kind:'shoulder',id:'actor-shoulder'});
    });
  });
  m.layer=previousLayer;
}


/** The working jacket keeps its waist seam; variants change cloth structure,
 * not the body's coordinate system or limb lengths. */
function buildCoat(m:Model,variant:ClothedVariant,cycle:number,walking:boolean):void {
  loaf(m,[
    [0,.63,0,.252,.169],[0,.73,-.008,.258,.166],
    [0,.83,-.003,.227,.161],[0,1.035,.009,.260,.179],
    [0,1.171,.007,.276,.162],[0,1.245,.015,.202,.134],
  ],'cloth',1.48,12);
  if(variant==='b'){
    // Four volumetric panels: left/right, front/back. The centre remains open
    // and each panel has inner cloth, folded side returns and a solid hem.
    const sway=walking?Math.sin(cycle*Math.PI*2)*.026:0;
    for(const side of [-1,1])for(const rear of [false,true]){
      const z=rear?-.16:.16,edge=side*.254,inner=side*.035;
      const lowY=side<0?.385:.405;
      const swing=walking?Math.sin(cycle*Math.PI*2+(side>0?Math.PI:0))*.039:0;
      clothPanel(m,[
        [inner,.735,z],[edge,.74,z*.80],
        [side*.297,lowY+.025,z*1.16+swing],
        [side*.055,lowY,z*1.21+swing+sway],
      ],rear?.96:1.30,rear?-.022:.022);
      // A folded lap is structural cloth relief, not a dark ink contour.
      m.beam([side*.14,.61,z*1.13],[side*.17,lowY+.04,z*1.20+swing],.019,.020,'cloth',rear?.91:1.42);
    }
  }else{
    // A soft cut shoulder mantle; a broad upper back and short asymmetric
    // drops wrap the shoulders, while leaving forearms and the lantern clear.
    // Rings close every seam and provide actual thickness at the hem.
    loaf(m,[
      [0,.97,-.009,.293,.180],
      [0,1.065,-.018,.369,.199],
      [0,1.145,-.012,.382,.191],
      [0,1.224,.010,.265,.153],
      [0,1.274,.010,.164,.124],
    ],'cloth',1.42,16);
    // Uneven folded cloth over the upper arms; no metal shoulder plates.
    clothPanel(m,[[-.18,1.21,.13],[-.36,1.10,.13],[-.34,.97,.14],[-.17,1.015,.184]],1.22,.022);
    clothPanel(m,[[.18,1.21,.13],[.342,1.10,.13],[.322,1.005,.153],[.16,1.045,.184]],1.30,.022);
    m.beam([-.19,1.13,.187],[.125,1.095,.191],.024,.019,'cloth',.73);
    m.box([.08,1.104,.205],[.041,.045,.018],'bronze',.006,.78);
    clothPanel(m,[[-.234,.71,.134],[-.033,.701,.164],[-.037,.615,.175],[-.214,.636,.16]],.86,.018);
    clothPanel(m,[[.023,.705,.163],[.234,.721,.131],[.218,.638,.155],[.036,.616,.176]],.96,.018);
  }
}

function clothPanel(m:Model,points:readonly[V3,V3,V3,V3],tint:number,thickness:number):void {
  const inner=points.map(p=>[p[0],p[1],p[2]-thickness] as V3);
  m.quad(...points,'cloth',tint);
  m.quad(inner[3]!,inner[2]!,inner[1]!,inner[0]!,'cloth',tint*.86);
  for(let i=0;i<4;i++){const j=(i+1)%4;m.quad(points[i]!,points[j]!,inner[j]!,inner[i]!,'cloth',tint*.94);}
}

function buildPack(m:Model,variant:ClothedVariant):void {
  const narrow=variant==='b';
  const low=narrow?.685:.585,high=narrow?1.255:1.075;
  const rx=narrow?.176:.246,rz=narrow?.088:.135,z=narrow?-.235:-.286;
  // Frame belongs to the load, so replacement packs do not retain a floating
  // frame from the old shape. Straps still attach to the common shoulders.
  for(const side of [-1,1]){
    const x=side*rx*.78;
    m.beam([x,low+.006,z+.043],[x,high-.025,z+.047],.034,.039,'iron',.56);
  }
  loaf(m,[[0,low,z+.016,rx*.80,rz*.78],[0,low+.055,z,rx,rz],
    [0,high-.085,z+.006,rx*1.01,rz],[0,high-.025,z+.019,rx*.86,rz*.84]],'cloth',1.41,12);
  loaf(m,[[0,high-.09,z+.005,rx*1.045,rz*1.04],
    [0,high-.035,z+.012,rx*1.03,rz*1.05],[0,high,z+.031,rx*.85,rz*.76]],'cloth',1.50,12);
  for(const side of [-1,1]){
    const x=side*rx*.52;
    m.cable([[x,high,z+.014],[x,high-.05,z-rz-.008],[x,low+.10,z-rz-.012],[x,low+.035,z-.054]],.032,'cloth',.53);
    m.box([x,low+.17,z-rz-.016],[.052,.048,.024],'iron',.007,.90);
    m.cable([[side*.159,high-.03,z+.09],[side*.167,1.248,.005],[side*.167,1.157,.143],[side*.129,.954,.184]],.044,'cloth',.60);
  }
  m.box([-rx-.035,(low+high)*.5,z],[.086,.187,.132],'cloth',.030,.93);
  const toolX=rx+.045;
  m.beam([toolX,low-.005,z],[toolX+.014,low+.31,z],.033,.038,'wood',.78);
  m.beam([toolX-.037,low+.331,z-.003],[toolX+.067,low+.314,z-.003],.042,.049,'iron',.7);
  m.beam([toolX+.005,low+.122,z-.045],[toolX+.010,low+.192,z-.045],.045,.028,'cloth',.55);
}

/** Move a rigid glove with the forearm's rotation, anchored at its posed wrist.
 * Inputs are already in actor-local posed space; never apply a torso map here. */
function handPoint(restElbow:V3,restWrist:V3,elbow:V3,wrist:V3):(point:V3)=>V3 {
  const from=unit(sub(restWrist,restElbow)),to=unit(sub(wrist,elbow));
  const axis=cross(from,to),cosine=dot(from,to);
  if(cosine<-.999999){
    const halfTurn=unit(cross(from,Math.abs(from[0])<.8?[1,0,0]:[0,1,0]));
    return point=>{const relative=sub(point,restWrist);return add(wrist,sub(mul(halfTurn,2*dot(halfTurn,relative)),relative));};
  }
  return point=>{
    const relative=sub(point,restWrist),first=cross(axis,relative);
    return add(wrist,add(relative,add(first,mul(cross(axis,first),1/(1+cosine)))));
  };
}

/** Bake a rigid articulated part in local space, then recompute transformed
 * triangle normals through the ordinary model path. Lamps use the same map. */
function posePart(target:Model,point:(p:V3)=>V3,draw:(part:Model)=>void):void {
  const part=new Model();draw(part);
  for(const t of part.triangles)target.triangle(point(t.a),point(t.b),point(t.c),t.material,t.tint);
  for(const l of part.lights)target.light(point(l.position),l.color,l.power,l.radius,{kind:l.kind,id:l.id});
}

type Ring=readonly[cx:number,y:number,cz:number,rx:number,rz:number];
function loaf(m:Model,rings:readonly Ring[],material:Material,tint:number,segments:number):void {
  const pts=rings.map(([cx,y,cz,rx,rz])=>Array.from({length:segments},(_,i)=>{const a=i/segments*Math.PI*2;return [cx+Math.cos(a)*rx,y,cz+Math.sin(a)*rz] as V3;}));
  for(let row=0;row<pts.length-1;row++)for(let i=0;i<segments;i++) {
    const j=(i+1)%segments;
    m.quad(pts[row]![i]!,pts[row+1]![i]!,pts[row+1]![j]!,pts[row]![j]!,material,tint);
  }
  const lo=rings[0]!,hi=rings[rings.length-1]!;
  for(let i=0;i<segments;i++) {
    const j=(i+1)%segments;
    m.triangle([lo[0],lo[1],lo[2]],pts[0]![i]!,pts[0]![j]!,material,tint);
    m.triangle([hi[0],hi[1],hi[2]],pts[pts.length-1]![j]!,pts[pts.length-1]![i]!,material,tint);
  }
}

function limb(m:Model,a:V3,b:V3,r0:number,r1:number,material:Material,tint:number):void {
  const axis=unit(sub(b,a)),side=unit(cross(axis,[0,0,1])),up=unit(cross(side,axis)),segments=10;
  const ring=(p:V3,r:number):V3[]=>Array.from({length:segments},(_,i)=>{const t=i/segments*Math.PI*2;return add(p,add(mul(side,Math.cos(t)*r),mul(up,Math.sin(t)*r*.86)));});
  const aa=ring(a,r0),bb=ring(b,r1);
  for(let i=0;i<segments;i++){const j=(i+1)%segments;m.quad(aa[i]!,bb[i]!,bb[j]!,aa[j]!,material,tint);m.triangle(a,aa[j]!,aa[i]!,material,tint);m.triangle(b,bb[i]!,bb[j]!,material,tint);}
}

function ovalBand(m:Model,c:V3,rx:number,rz:number,height:number,material:Material,tint:number,segments:number):void {
  loaf(m,[[c[0],c[1]-height/2,c[2],rx,rz],[c[0],c[1]+height/2,c[2],rx,rz]],material,tint,segments);
}
