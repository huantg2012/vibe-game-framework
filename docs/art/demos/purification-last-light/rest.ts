import {Model,type V3} from './model';

export const REST_OBJECT_ID=8;
export const REST_POSITION:V3=[1,0,1.5];
export const REST_YAW=Math.atan2(2.8,-1);
export const REST_SEAT_HEIGHT=.48;
export const REST_APPROACH:V3=[REST_POSITION[0]+Math.sin(REST_YAW)*1.15,0,REST_POSITION[2]+Math.cos(REST_YAW)*1.15];
export interface RestPoint {id:number;key:string;name:string;position:V3;yaw:number;approach:V3;description:string;}

/** A wall footing that remains bonded to the floor. The surviving coping is
 * usable as a seat; the broken pier and buried return explain its origin. */
export function buildRestRemnant(m:Model):RestPoint {
  m.at(REST_POSITION,REST_YAW,REST_OBJECT_ID,()=>{
    m.slab([[-1.42,-.54],[-.7,-.62],[.57,-.57],[1.32,-.43],[1.26,.22],[.85,.35],[-.92,.36],[-1.43,.17]],.045,-.16,'stone',.75);
    // Rubble core and mortar bed are visible where the ashlar skin broke off.
    m.slab([[-1.22,-.44],[1.16,-.39],[1.1,.21],[-1.15,.22]],.32,.018,'stone',.65);
    m.box([-.72,.145,-.12],[.83,.24,.68],'cutstone',.027,.78);
    m.box([.065,.13,-.16],[.68,.22,.61],'cutstone',.037,.82);
    m.box([.74,.145,-.14],[.62,.24,.60],'cutstone',.031,.75);
    m.box([-.45,.325,-.13],[1.17,.125,.66],'cutstone',.027,.83);
    m.box([.62,.32,-.15],[.91,.13,.64],'cutstone',.04,.79);
    // One thick original coping, an exposed bed joint and a chipped front
    // return: geometry catches the fire across three different face angles.
    m.slab([[-1.16,-.49],[.83,-.48],[1.17,-.30],[1.12,.14],[.83,.28],[-.73,.27],[-1.16,.16]],.393,.365,'stone',.57);
    m.slab([[-1.17,-.50],[.84,-.49],[1.21,-.29],[1.11,.18],[.81,.30],[-.68,.30],[-1.20,.14]],REST_SEAT_HEIGHT,.394,'cutstone',.94);
    m.beam([-.72,.467,.301],[.79,.467,.301],.026,.041,'cutstone',1.02);
    // The last pier rises only at one end, with a jagged fracture instead of
    // a symmetrical armrest. Its masonry grows out of the same foundation.
    m.box([-1.055,.59,-.25],[.36,.42,.52],'cutstone',.033,.80);
    m.rock([-1.065,.82,-.27],[.40,.29,.51],'stone',7411,.79);
    m.slab([[-1.24,-.46],[-.86,-.45],[-.85,-.18],[-1.22,-.13]],.87,.76,'stone',.77);
    m.rock([1.19,.15,-.10],[.29,.28,.39],'stone',7413,.74);
    m.rock([1.36,.068,-.31],[.23,.14,.31],'cutstone',7417,.86);
    // Severed return is nearly flush with the floor; it reads as the trace
    // of a lost wall, leaving the approach and the player's feet unobstructed.
    m.slab([[-1.35,-.48],[-.9,-.51],[-.96,-1.01],[-1.19,-1.17],[-1.40,-1.0]],.055,-.025,'cutstone',.69);
    m.rock([-1.42,.049,-.77],[.23,.12,.22],'stone',7421,.67);
  });
  return {id:REST_OBJECT_ID,key:'rest',name:'断墙',position:REST_POSITION,yaw:REST_YAW,approach:REST_APPROACH,description:'墙身已经断去，石压顶还留着一段。可以坐下。'};
}
