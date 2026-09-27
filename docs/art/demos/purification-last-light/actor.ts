import { Model, add, cross, mul, sub, unit, type Material, type V3 } from './model';

/** This is the same warm-grey worker as player-sprite-dense.ts, reconstructed
 * for the haven's fixed pixel grid. Rift continues using its existing sprite. */
export const ACTOR_POSITION:V3=[3.8,0,3.8];
export const ACTOR_FACING=Math.atan2(9,-.4);
export const ACTOR_LAMP_LOCAL:V3=[.323,1.296,.205];
export const ACTOR_HEIGHT=1.665;
export const ACTOR_OBJECT_ID=7;

export function actorLampAnchor(position:V3=ACTOR_POSITION,facing=ACTOR_FACING,breath=0,walkPhase?:number):V3 {
  const c=Math.cos(facing),s=Math.sin(facing),p=ACTOR_LAMP_LOCAL;
  const strideLift=walkPhase===undefined?0:.018*(1-Math.cos(walkPhase*2));
  return [position[0]+p[0]*c+p[2]*s,position[1]+p[1]+Math.sin(breath)*.008+strideLift,position[2]-p[0]*s+p[2]*c];
}

/** Facing is yaw in radians; local +Z is the face, local +X the lamp shoulder.
 * A tiny breath moves the coat, pack and lamp together while the soles stay put. */
export function buildActor(m:Model,position:V3=ACTOR_POSITION,facing=ACTOR_FACING,breath=0,walkPhase?:number):void {
  const previousLayer=m.layer;
  m.layer='haven';
  m.at(position,facing,ACTOR_OBJECT_ID,()=>{
    const walking=walkPhase!==undefined;
    const lift=Math.sin(breath)*.008+(walking?.018*(1-Math.cos(walkPhase*2)):0);
    // Separated, weight-bearing legs. The right boot is half a pace forward.
    for(const [x,z,t] of [[-.148,-.075,.88],[.143,.080,1.04]] as const) {
      const phase=(walkPhase??0)+(x<0?0:Math.PI);
      const stride=walking?Math.sin(phase)*.29:0;
      const rise=walking?Math.max(0,Math.cos(phase))*.115:0;
      const ankle=z+stride,knee=z+stride*.38;
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

    m.at([0,lift,0],0,ACTOR_OBJECT_ID,()=>{
      // A worn canvas work coat: broad shoulders narrow into the waist, then
      // loosen at the hem. It has curved cloth mass, not a plated torso box.
      loaf(m,[
        [0,.63,0,.252,.169],
        [0,.73,-.008,.258,.166],
        [0,.83,-.003,.227,.161],
        [0,1.035,.009,.260,.179],
        [0,1.171,.007,.276,.162],
        [0,1.245,.015,.202,.134],
      ],'cloth',1.48,12);
      // Short split tails leave the two legs legible at the actual 38px scale.
      m.quad([-.234,.71,.134],[-.033,.701,.164],[-.037,.615,.175],[-.214,.636,.16],'cloth',.86);
      m.quad([.023,.705,.163],[.234,.721,.131],[.218,.638,.155],[.036,.616,.176],'cloth',.96);
      m.beam([-.222,.792,.108],[.213,.795,.116],.047,.038,'cloth',.58);
      m.box([.022,.80,.171],[.056,.052,.023],'bronze',.008,.78);
      m.beam([.023,.847,.16],[.022,1.18,.165],.020,.015,'black',.85);
      m.box([-.126,1.033,.176],[.129,.126,.043],'cloth',.022,.98);
      m.beam([-.190,1.095,.185],[-.068,1.095,.185],.027,.018,'cloth',1.23);

      // The pack is a recognizable silhouette from behind and from either side:
      // a rounded canvas body, folded lid, two straps and an iron carrying frame.
      m.beam([-.175,.707,-.231],[-.180,1.223,-.218],.036,.043,'iron',.56);
      m.beam([.175,.707,-.231],[.180,1.223,-.218],.036,.043,'iron',.56);
      loaf(m,[
        [0,.701,-.254,.166,.104],
        [0,.761,-.283,.206,.132],
        [0,1.12,-.274,.209,.133],
        [0,1.206,-.257,.179,.113],
      ],'cloth',1.41,12);
      loaf(m,[[0,1.134,-.278,.219,.14],[0,1.195,-.274,.216,.141],[0,1.227,-.255,.175,.102]],'cloth',1.50,12);
      for(const x of [-.11,.11]) {
        m.cable([[x,1.232,-.259],[x,1.195,-.404],[x,.811,-.417],[x,.748,-.365]],.032,'cloth',.53);
        m.box([x,.871,-.42],[.052,.048,.024],'iron',.007,.90);
        m.cable([[x*1.45,1.222,-.16],[x*1.52,1.248,.005],[x*1.52,1.157,.143],[x*1.17,.954,.184]],.044,'cloth',.60);
      }
      m.box([-.237,.932,-.277],[.106,.214,.145],'cloth',.034,.93);
      // A compact field tool hangs at the pack edge, as equipment, not a weapon.
      m.beam([.252,.70,-.29],[.267,1.035,-.29],.033,.038,'wood',.78);
      m.beam([.209,1.056,-.293],[.313,1.039,-.293],.042,.049,'iron',.7);
      m.beam([.257,.827,-.335],[.262,.897,-.335],.045,.028,'cloth',.55);

      // Relaxed arms break away from the torso. Their cuffs and gloves are soft
      // shapes; there are no large pauldrons, metal biceps or luminous trim.
      const swing=walking?Math.sin(walkPhase)*.14:0;
      limb(m,[-.279,1.142,.012],[-.328,.943,.041-swing*.55],.103,.095,'cloth',1.38);
      limb(m,[-.328,.943,.041-swing*.55],[-.312,.758,.083-swing],.086,.079,'cloth',1.20);
      limb(m,[.276,1.145,.008],[.331,.955,.006+swing*.55],.099,.094,'cloth',1.40);
      limb(m,[.331,.955,.006+swing*.55],[.328,.775,.066+swing],.084,.078,'cloth',1.25);
      loaf(m,[[-.311,.707,.083-swing,.073,.062],[-.316,.757,.082-swing,.078,.067],[-.318,.80,.076-swing,.067,.059]],'cloth',.56,10);
      loaf(m,[[.328,.723,.063+swing,.070,.061],[.329,.775,.065+swing,.076,.068],[.329,.814,.060+swing,.067,.06]],'cloth',.60,10);

      // The round protective hood/helmet and one black visor slit carry the
      // strongest facial identity from the production sprite. Never paired eyes.
      loaf(m,[[0,1.211,.021,.148,.123],[0,1.292,.015,.151,.122],[0,1.337,.016,.117,.102]],'cloth',.63,12);
      loaf(m,[
        [0,1.307,.007,.142,.120],
        [0,1.381,.011,.185,.160],
        [0,1.472,.014,.197,.176],
        [0,1.566,.003,.176,.157],
        [0,1.632,-.006,.118,.107],
        [0,ACTOR_HEIGHT,-.009,.046,.050],
      ],'iron',1.18,16);
      // Rolled lower rim of the helmet; only actual exposed metal catches light.
      ovalBand(m,[0,1.382,.011],.191,.168,.029,'iron',1.02,16);
      for(let j=0;j<7;j++) {
        const a=Math.PI*.19+j/7*Math.PI*.62,b=Math.PI*.19+(j+1)/7*Math.PI*.62;
        m.quad([Math.cos(a)*.199,1.438,.014+Math.sin(a)*.178],[Math.cos(b)*.199,1.438,.014+Math.sin(b)*.178],[Math.cos(b)*.198,1.485,.014+Math.sin(b)*.178],[Math.cos(a)*.198,1.485,.014+Math.sin(a)*.178],'black',.91);
      }
      m.beam([-.066,1.638,-.078],[.040,1.651,-.039],.020,.016,'iron',1.07);
      m.box([-.176,1.423,-.003],[.052,.099,.093],'iron',.015,.66);
      m.box([.176,1.423,-.003],[.052,.099,.093],'iron',.015,.69);

      // One compact lamp on the character's right shoulder. The lens and a tiny
      // side window emit; the housing remains opaque and casts real shadows.
      m.beam([.24,1.179,.017],[.37,1.179,.043],.042,.051,'iron',.68);
      m.box([.401,1.211,.101],[.152,.140,.177],'iron',.023,.95);
      m.box([.401,1.211,.195],[.108,.081,.017],'lamp',.006,1);
      m.box([.480,1.211,.132],[.012,.053,.065],'lamp',.004,.61);
      // A small rear aperture keeps the single shoulder lantern recognizable
      // in the default back-facing stance without turning the helmet into eyes.
      m.box([.401,1.211,.006],[.082,.056,.010],'lamp',.003,.54);
      m.beam([.353,1.17,.207],[.451,1.17,.207],.020,.017,'iron',.6);
      m.cable([[.356,1.199,.055],[.306,1.14,-.067],[.264,1.018,-.206]],.022,'black',.9);
      m.light(ACTOR_LAMP_LOCAL,[1,.83,.55],.65,2.6,{kind:'shoulder',id:'actor-shoulder'});
    });
  });
  m.layer=previousLayer;
}

/** The seated pose uses the same helmet, work coat, pack and shoulder lantern.
 * Its anchor is on the floor below the pelvis, with local +Z towards the toes.
 * seatHeight is the actual stone surface: the pelvis bears on that surface,
 * while knees and boots form a separate bent-leg silhouette. */
export const SEATED_ACTOR_HEAD_ABOVE_SEAT= .985;
export function seatedActorLampAnchor(position:V3,facing:number,seatHeight=.48):V3 {
  const c=Math.cos(facing),s=Math.sin(facing);
  const p:V3=[ACTOR_LAMP_LOCAL[0],ACTOR_LAMP_LOCAL[1]+seatHeight-.68,ACTOR_LAMP_LOCAL[2]-.06];
  return [position[0]+p[0]*c+p[2]*s,position[1]+p[1],position[2]-p[0]*s+p[2]*c];
}

export function buildSeatedActor(m:Model,position:V3,facing:number,seatHeight=.48):void {
  const previousLayer=m.layer,h=seatHeight;
  m.layer='haven';
  try {
    m.at(position,facing,ACTOR_OBJECT_ID,()=>{
      // A broad compressed seat, then two almost-horizontal thighs. The knees
      // are staggered slightly, so both folded legs remain readable in profile.
      loaf(m,[[0,h+.018,-.004,.218,.145],[0,h+.083,.016,.234,.165],[0,h+.149,.007,.216,.149]],'cloth',1.06,12);
      for(const [x,kneeZ,ankleZ,t] of [[-.146,.385,.505,.92],[.151,.425,.560,1.04]] as const) {
        const hip:V3=[x*.88,h+.096,.042],knee:V3=[x,h+.018,kneeZ],ankle:V3=[x,.179,ankleZ];
        limb(m,hip,knee,.105,.099,'cloth',t*1.14);
        loaf(m,[[x,h-.061,kneeZ,.080,.074],[x,h+.016,kneeZ+.015,.100,.088],[x,h+.088,kneeZ-.002,.077,.076]],'cloth',t,10);
        limb(m,[x,h-.011,kneeZ+.014],ankle,.083,.080,'cloth',t);
        m.beam([x-.065,h+.051,kneeZ+.074],[x+.062,h+.067,kneeZ+.071],.024,.018,'cloth',t*1.17);
        m.beam([x-.067,.223,ankleZ+.063],[x+.068,.217,ankleZ+.060],.024,.020,'cloth',t*.62);
        m.box([x,.055,ankleZ+.077],[.184,.105,.286],'black',.038,.96);
        loaf(m,[[x,.09,ankleZ+.077,.093,.133],[x,.16,ankleZ+.025,.094,.119],[x,.225,ankleZ-.018,.084,.090]],'cloth',t*.80,10);
      }

      // The cloth gathers over the loaded hips; the chest settles back, rather
      // than shortening a standing body or burying its straight legs in stone.
      loaf(m,[
        [0,h+.040,.008,.246,.164],
        [0,h+.133,-.013,.249,.166],
        [0,h+.230,-.047,.223,.159],
        [0,h+.420,-.066,.260,.178],
        [0,h+.500,-.077,.273,.160],
        [0,h+.565,-.065,.202,.134],
      ],'cloth',1.48,12);
      m.beam([-.217,h+.176,.105],[.209,h+.179,.114],.047,.038,'cloth',.58);
      m.box([.022,h+.185,.164],[.056,.052,.023],'bronze',.008,.78);
      m.beam([.023,h+.235,.113],[.022,h+.512,.096],.020,.015,'black',.85);
      m.box([-.126,h+.356,.108],[.129,.126,.043],'cloth',.022,.98);
      m.beam([-.190,h+.418,.118],[-.068,h+.418,.118],.027,.018,'cloth',1.23);
      m.beam([-.210,h+.079,.162],[-.054,h+.066,.184],.030,.023,'cloth',.96);
      m.beam([.043,h+.066,.184],[.204,h+.090,.167],.029,.021,'cloth',1.07);

      // Upper arms rest beside the ribcage; forearms reach forward onto the
      // thighs. Small asymmetry reads as released weight, not a formal squat.
      limb(m,[-.273,h+.474,-.061],[-.301,h+.231,.058],.101,.088,'cloth',1.38);
      limb(m,[-.301,h+.231,.058],[-.161,h+.173,.320],.083,.074,'cloth',1.20);
      limb(m,[.271,h+.473,-.065],[.305,h+.218,.080],.099,.087,'cloth',1.40);
      limb(m,[.305,h+.218,.080],[.161,h+.159,.353],.082,.073,'cloth',1.25);
      loaf(m,[[-.151,h+.108,.338,.063,.079],[-.151,h+.161,.332,.074,.084],[-.159,h+.190,.314,.064,.063]],'cloth',.56,10);
      loaf(m,[[.154,h+.097,.369,.063,.079],[.155,h+.148,.360,.074,.084],[.162,h+.178,.345,.063,.065]],'cloth',.60,10);

      // Keep equipment at its original physical scale. Only its placement
      // follows the lowered, slightly reclined shoulders.
      m.at([0,h-.68,-.06],0,ACTOR_OBJECT_ID,()=>{
        m.beam([-.175,.707,-.231],[-.180,1.223,-.218],.036,.043,'iron',.56);
        m.beam([.175,.707,-.231],[.180,1.223,-.218],.036,.043,'iron',.56);
        loaf(m,[[0,.701,-.254,.166,.104],[0,.761,-.283,.206,.132],[0,1.12,-.274,.209,.133],[0,1.206,-.257,.179,.113]],'cloth',1.41,12);
        loaf(m,[[0,1.134,-.278,.219,.14],[0,1.195,-.274,.216,.141],[0,1.227,-.255,.175,.102]],'cloth',1.50,12);
        for(const x of [-.11,.11]) {
          m.cable([[x,1.232,-.259],[x,1.195,-.404],[x,.811,-.417],[x,.748,-.365]],.032,'cloth',.53);
          m.box([x,.871,-.42],[.052,.048,.024],'iron',.007,.90);
          m.cable([[x*1.45,1.222,-.16],[x*1.52,1.248,.005],[x*1.52,1.157,.143],[x*1.17,.954,.184]],.044,'cloth',.60);
        }
        m.box([-.237,.932,-.277],[.106,.214,.145],'cloth',.034,.93);
        m.beam([.252,.70,-.29],[.267,1.035,-.29],.033,.038,'wood',.78);
        m.beam([.209,1.056,-.293],[.313,1.039,-.293],.042,.049,'iron',.7);
        m.beam([.257,.827,-.335],[.262,.897,-.335],.045,.028,'cloth',.55);

        loaf(m,[[0,1.211,.021,.148,.123],[0,1.292,.015,.151,.122],[0,1.337,.016,.117,.102]],'cloth',.63,12);
        loaf(m,[[0,1.307,.007,.142,.120],[0,1.381,.011,.185,.160],[0,1.472,.014,.197,.176],[0,1.566,.003,.176,.157],[0,1.632,-.006,.118,.107],[0,ACTOR_HEIGHT,-.009,.046,.050]],'iron',1.18,16);
        ovalBand(m,[0,1.382,.011],.191,.168,.029,'iron',1.02,16);
        for(let j=0;j<7;j++) {
          const a=Math.PI*.19+j/7*Math.PI*.62,b=Math.PI*.19+(j+1)/7*Math.PI*.62;
          m.quad([Math.cos(a)*.199,1.438,.014+Math.sin(a)*.178],[Math.cos(b)*.199,1.438,.014+Math.sin(b)*.178],[Math.cos(b)*.198,1.485,.014+Math.sin(b)*.178],[Math.cos(a)*.198,1.485,.014+Math.sin(a)*.178],'black',.91);
        }
        m.beam([-.066,1.638,-.078],[.040,1.651,-.039],.020,.016,'iron',1.07);
        m.box([-.176,1.423,-.003],[.052,.099,.093],'iron',.015,.66);
        m.box([.176,1.423,-.003],[.052,.099,.093],'iron',.015,.69);

        m.beam([.24,1.179,.017],[.37,1.179,.043],.042,.051,'iron',.68);
        m.box([.401,1.211,.101],[.152,.140,.177],'iron',.023,.95);
        m.box([.401,1.211,.195],[.108,.081,.017],'lamp',.006,1);
        m.box([.480,1.211,.132],[.012,.053,.065],'lamp',.004,.61);
        m.box([.401,1.211,.006],[.082,.056,.010],'lamp',.003,.54);
        m.beam([.353,1.17,.207],[.451,1.17,.207],.020,.017,'iron',.6);
        m.cable([[.356,1.199,.055],[.306,1.14,-.067],[.264,1.018,-.206]],.022,'black',.9);
        m.light(ACTOR_LAMP_LOCAL,[1,.83,.55],.65,2.6,{kind:'shoulder',id:'actor-shoulder'});
      });
    });
  } finally { m.layer=previousLayer; }
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
