import { ShapeUtils, Vector2 } from 'three';
import { Model, add, cross, mul, random, sub, unit, type Material, type V2, type V3 } from './model';

const UPPER_PATH:V2[]=[[2.6,-6.8],[4.2,-8.05],[7.37,-7.9],[7.63,-7.66],[8.08,-7.82],[11.35,-7.2],[13.4,-5.54],[13.22,-2.2],[11.38,-2.24],[11.18,-2.01],[9.14,-2.33],[8.98,-2.91],[8.56,-3.13],[8.42,-2.63],[7.62,-2.60],[7.37,-3.16],[6.96,-3.08],[6.7,-2.83],[5.52,-2.75],[3.65,-3.58],[3.46,-3.95],[2.8,-4.39]];

const MAIN_PATH:V2[]=[[-5,-4],[-2.9,-5.08],[-2.72,-4.88],[-2.4,-5.32],[2,-7],[5.7,-6.5],[5.88,-6.24],[6.28,-6.42],[9,-5],[14,-2],[14.4,.30],[14.23,.60],[14.63,1.02],[15,4],[13.76,5.26],[13.45,5.21],[13.42,5.60],[12,7],[9.45,7.42],[9.19,7.19],[8.95,7.50],[7.9,7.6],[7.67,7.40],[7.42,7.73],[5,8],[2.43,6.93],[2.41,6.66],[2.02,6.74],[-2,5],[-3.12,3.39],[-2.92,3.11],[-3.35,2.95],[-5,1],[-4.82,.44],[-5.1,.19]];

export interface WalkSurface { readonly id: string; readonly points: readonly V3[]; }
function tiltedLayer(path:readonly V2[],height:number,slopeX:number,slopeZ:number):readonly V3[] {
  const cx=path.reduce((a,p)=>a+p[0],0)/path.length,cz=path.reduce((a,p)=>a+p[1],0)/path.length;
  return path.map(([x,z])=>[x,height+(x-cx)*slopeX+(z-cz)*slopeZ,z] as V3);
}
const FLOOR_LAYERS:readonly (readonly V3[])[]=[
  tiltedLayer([[-3.15,3.1],[-1.9,2.72],[.5,3.3],[2.35,4.73],[2.25,6.6],[-1.87,4.87]],.064,.008,-.011),
  tiltedLayer([[2.62,4.93],[4.89,3.72],[6.24,4.15],[6.88,7.55],[5.06,7.79],[2.63,6.85]],.074,-.005,.016),
  tiltedLayer([[-4.72,-3.51],[-3.42,-4.24],[-2.74,-3.73],[-3.00,-1.82],[-2.53,-.28],[-3.30,.61],[-4.82,.67]],.045,.013,-.006),
  tiltedLayer([[11.44,2.29],[13.89,1.56],[14.70,3.98],[13.53,5.16],[12.12,6.63],[11.12,5.10]],.062,.014,-.007),
];
function rampTop(a:V3,b:V3,width:number):readonly V3[] {
  const dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz),px=-dz/len*width/2,pz=dx/len*width/2;
  return [[a[0]-px,a[1]+.035,a[2]-pz],[b[0]-px,b[1]+.035,b[2]-pz],[b[0]+px,b[1]+.035,b[2]+pz],[a[0]+px,a[1]+.035,a[2]+pz]];
}
/** Exact top polygons of the four intentionally traversable structures. */
export const WALK_SURFACES: readonly WalkSurface[] = [
  {id:'main',points:MAIN_PATH.map(([x,z])=>[x,0,z] as V3)},
  {id:'upper',points:UPPER_PATH.map(([x,z])=>[x,2.6,z] as V3)},
  {id:'west-ramp',points:rampTop([2,0,-.5],[3.5,2.6,-4],1.9)},
  {id:'east-ramp',points:rampTop([12,0,1],[12,2.6,-2.5],1.8)},
  ...FLOOR_LAYERS.map((points,i)=>({id:`old-floor-layer-${i+1}`,points})),
];

/** Surviving library fabric. The usable floor is one connected, broken remnant;
 * the dark shapes below it are its structure, not a decorative border. */
export function buildEnvironment(m: Model): void {
  m.object = 0;
  m.layer = 'far';
  distantFabric(m);
  m.layer = 'middle';
  fallenLibrary(m);
  m.layer = 'near';
  attachedRemains(m);
  m.layer = 'haven';
  inhabitedRemnant(m);
}

function cuboid(m: Model, c: V3, s: V3, mat: Material, tint = 1): void {
  const [x,y,z]=c, [w,h,d]=s.map(v=>v/2) as [number,number,number];
  const a:V3=[x-w,y-h,z-d], b:V3=[x+w,y-h,z-d], c1:V3=[x+w,y-h,z+d], d1:V3=[x-w,y-h,z+d];
  const e:V3=[x-w,y+h,z-d], f:V3=[x+w,y+h,z-d], g:V3=[x+w,y+h,z+d], h1:V3=[x-w,y+h,z+d];
  m.quad(e,h1,g,f,mat,tint); m.quad(a,b,c1,d1,mat,tint);
  m.quad(a,e,f,b,mat,tint); m.quad(d1,c1,g,h1,mat,tint);
  m.quad(a,d1,h1,e,mat,tint); m.quad(b,f,g,c1,mat,tint);
}

function brokenSlab(m: Model, path: readonly V2[], y: number, depth: number, seed: number, tint = .9): void {
  const rng=random(seed);
  const signedArea=path.reduce((sum,a,i)=>{const b=path[(i+1)%path.length]!;return sum+a[0]*b[1]-b[0]*a[1];},0),orientation=signedArea>=0?1:-1;
  const outline:V2[]=[];
  for(let i=0;i<path.length;i++) {
    const a=path[i]!,b=path[(i+1)%path.length]!,dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    const count=Math.max(1,Math.ceil(length/(.35+rng()*.20)));
    for(let j=0;j<count;j++) {
      const t=j/count;
      // Original major corners survive. Between them the exposed aggregate
      // either projects or is bitten away, in small groups of unequal size.
      const displacement=j===0?0:(rng()<.24?-.10-rng()*.09:(rng()-.54)*.12);
      outline.push([a[0]+dx*t+dz/length*displacement*orientation,a[1]+dz*t-dx/length*displacement*orientation]);
    }
  }
  const inner:V3[]=[],lip:V3[]=[],bed:V3[]=[],body:V3[]=[],bottom:V3[]=[];
  for(let i=0;i<outline.length;i++) {
    const a=outline[(i-1+outline.length)%outline.length]!,p=outline[i]!,b=outline[(i+1)%outline.length]!;
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1,nx=dz/length*orientation,nz=-dx/length*orientation;
    const recess=.08+rng()*.05,midOffset=(rng()-.5)*.11,bottomOffset=(rng()-.4)*.16;
    inner.push([p[0]-nx*.115,y,p[1]-nz*.115]);
    lip.push([p[0],y-.014-rng()*.045,p[1]]);
    bed.push([p[0]-nx*recess,y-.14-rng()*.055,p[1]-nz*recess]);
    body.push([p[0]+nx*midOffset,y-depth*(.38+rng()*.12),p[1]+nz*midOffset]);
    bottom.push([p[0]+nx*bottomOffset,y-depth*(.79+rng()*.42),p[1]+nz*bottomOffset]);
  }
  const faces=ShapeUtils.triangulateShape(inner.map(p=>new Vector2(p[0],p[2])),[]);
  for(const f of faces)m.triangle(inner[f[0]!]!,inner[f[2]!]!,inner[f[1]!]!,'cutstone',tint);
  for(let i=0;i<outline.length;i++) {
    const j=(i+1)%outline.length;
    m.quad(inner[i]!,inner[j]!,lip[j]!,lip[i]!,'cutstone',tint*.94);
    m.quad(lip[i]!,lip[j]!,bed[j]!,bed[i]!,'cutstone',tint*.79);
    m.quad(bed[i]!,bed[j]!,body[j]!,body[i]!,'stone',tint*.84);
    m.quad(body[i]!,body[j]!,bottom[j]!,bottom[i]!,'stone',tint*.76);
  }
}

function inhabitedRemnant(m: Model): void {
  const main=MAIN_PATH;
  brokenSlab(m,main,0,1.1,7201,.94);
  for(const [i,patch] of FLOOR_LAYERS.entries()) {
    const triangles=ShapeUtils.triangulateShape(patch.map(p=>new Vector2(p[0],p[2])),[]);
    for(const tri of triangles)m.triangle(patch[tri[0]!]!,patch[tri[2]!]!,patch[tri[1]!]!,'cutstone',.90+i*.013);
    for(let j=0;j<patch.length;j++) {
      const a=patch[j]!,b=patch[(j+1)%patch.length]!;
      m.quad(a,[a[0],-.07,a[2]],[b[0],-.07,b[2]],b,'stone',.73);
    }
  }

  // Thick pieces of the original walls remain attached below the floor.
  // Their broken depth varies, making the silhouette a torn building rather
  // than a plate balanced on a regular forest of thin supports.
  brokenSlab(m,[[-2.57,4.18],[-1.64,4.29],[-.13,5.50],[-.50,5.72],[-1.82,5.03],[-2.50,4.35]],-.17,3.7,1143,.76);
  brokenSlab(m,[[3.89,7.18],[4.76,6.79],[5.78,7.06],[6.29,7.66],[5.05,7.95],[4.1,7.5]],-.20,4.5,1147,.74);
  brokenSlab(m,[[11.80,6.89],[11.61,6.17],[12.34,5.76],[13.43,5.53],[13.15,5.97],[12.28,6.84]],-.19,2.5,1160,.68);
  m.rock([4.65,-1.14,7.53],[1.52,2.00,1.10],'stone',1184,.79);
  m.rock([-1.61,-1.46,4.94],[1.37,2.41,.89],'stone',1188,.74);
  m.beam([4.15,-2.82,7.42],[6.02,-4.81,7.21],.35,.42,'iron',.56);

  // Two surviving joists explain the slab's long span. Their irregular ends
  // project out of the concrete, and the severed bars continue below the face.
  m.beam([-3.9,-.82,.65],[12.4,-.82,5.62],.39,.69,'iron',.7);
  m.beam([-1.1,-.9,-3.82],[14.3,-.9,1.01],.32,.61,'iron',.66);
  m.beam([2.6,-.85,-5.35],[5.17,-.85,7.78],.26,.62,'iron',.72);
  m.beam([10.24,-.78,-3.7],[10.32,-.78,7.02],.31,.57,'iron',.69);
  const brokenSupports:[V3,V3,number,number][]=[
    [[-3.83,-.47,2.36],[-3.49,-5.8,2.37],.43,.58],
    [[.33,-.61,5.57],[.58,-7.7,5.43],.29,.45],
    [[5.18,-.67,7.66],[5.4,-8.8,7.3],.53,.65],
    [[10.2,-.58,7.0],[10.33,-4.85,7.11],.43,.52],
    [[13.85,-.5,4.84],[13.36,-6.23,5.00],.46,.65]
  ];
  for(const [a,b,w,d] of brokenSupports) {
    m.beam(a,b,w,d,'stone',.74);
    m.beam([a[0]-.13,a[1]-.4,a[2]+.28],[b[0]-.15,b[1]-.32,b[2]+.23],.075,.095,'iron',.67);
  }
  const bars:[V3,V3][]=[
    [[-3.45,-.3,2.9],[-3.63,-3.22,3.01]], [[-3.24,-.48,3.11],[-3.02,-1.8,3.27]],
    [[1.3,-.32,6.31],[1.46,-3.93,6.55]], [[2.05,-.42,6.6],[1.83,-2.72,6.64]],
    [[6.97,-.43,7.57],[7.1,-5.1,7.82]], [[7.17,-.27,7.50],[7.14,-3.1,7.73]],
    [[9.07,-.3,7.42],[9.27,-2.53,7.68]], [[12.23,-.28,6.57],[12.5,-3.62,6.7]]
  ];
  for(const [a,b] of bars) m.beam(a,b,.046,.055,'iron',.83);
  m.cable([[-3.54,-.15,2.49],[-3.68,-2.7,2.6],[-2.95,-4.9,2.71],[-1.44,-5.24,3.41],[-.28,-4.6,4.69],[.58,-.57,5.57]],.075,'black',.9);
  m.cable([[5.05,-.55,7.76],[5.22,-4.6,7.81],[5.8,-6.65,7.77],[7.03,-7.11,7.75],[8.02,-5.77,7.78],[8.48,-.42,7.55]],.06,'iron',.64);

  // A few large cracks divide the load-bearing slab. Most of the walking
  // surface remains broad and quiet; no repeated paving grid is introduced.
  fracture(m,[[-4.83,.8],[-3.96,.73],[-3.4,1.12],[-2.85,1.19]],0,31);
  fracture(m,[[2.3,6.8],[2.89,5.73],[3.78,5.31],[4.06,4.69],[5.14,4.15]],0,32);
  fracture(m,[[12.0,6.98],[11.47,6.03],[11.59,5.38]],0,33);
  fracture(m,[[14.42,.61],[13.82,.50],[13.41,-.07],[12.76,-.30]],0,34);
  fracture(m,[[-1.2,-5.65],[-.9,-4.8],[.15,-4.07],[.53,-3.29]],0,35);

  // Chips are part of the broken edge profile, not surface-wide freckles.
  const edgeChips:V3[]=[[-4.56,.02,1.61],[-3.44,.02,2.83],[-3.09,.02,3.25],[1.99,.02,6.71],[2.48,.02,6.82],[5.17,.02,7.72],[7.53,.01,7.62],[8.98,.03,7.45],[13.53,.02,5.36],[14.36,.03,.68],[-2.64,.02,-5.04]];
  edgeChips.forEach((p,i)=>m.rock(p,[.37+(i%3)*.12,.10+(i%2)*.08,.24+(i%4)*.05],'cutstone',400+i,.92));
  sectionAggregate(m,[[2.7,-.45,6.83],[5.5,-.46,7.84],[8.0,-.53,7.59],[12.6,-.61,6.14],[-3.92,-.49,2.28]],131);

  const upper=UPPER_PATH;
  brokenSlab(m,upper,2.6,.77,7401,.87);
  brokenSlab(m,[[5.04,-3.37],[5.61,-3.56],[6.57,-3.09],[6.32,-2.84],[5.61,-2.76]],2.44,1.34,7403,.75);
  brokenSlab(m,[[9.34,-3.33],[9.53,-3.12],[10.21,-2.34],[9.42,-2.24],[9.14,-2.55]],2.43,1.10,7408,.70);
  m.rock([7.33,2.41,-3.06],[.56,.5,.56],'stone',7411,.81);
  m.rock([8.83,2.43,-2.97],[.51,.42,.59],'stone',7413,.78);
  m.beam([3.35,1.97,-4.24],[12.62,1.97,-2.55],.36,.49,'iron',.74);
  m.beam([4.7,2.08,-6.61],[4.70,.02,-5.04],.34,.41,'stone',.84);
  m.beam([8.05,2.1,-3.4],[8.07,.06,-3.39],.44,.49,'stone',.8);
  m.beam([12.65,2.02,-2.7],[12.65,.08,-2.7],.41,.48,'stone',.75);
  ramp(m,[2,0,-.5],[3.5,2.6,-4],1.9,true);
  ramp(m,[12,0,1],[12,2.6,-2.5],1.8,false);
  fracture(m,[[7.5,-7.77],[7.41,-6.83],[7.9,-6.3]],2.6,56);

  // The upper landing is backed by a remaining library wall, with big empty
  // bays between the frames. Its height varies instead of closing the scene.
  m.at([8.8,2.6,-6.76],-.12,0,()=>bookcase(m,3.08,3.95,.72,77,true));
  m.at([12.32,2.6,-5.13],-.28,0,()=>bookcase(m,2.45,4.64,.80,81,true));
  m.at([4.13,2.6,-6.55],.19,0,()=>bookcase(m,1.58,2.8,.59,96,false));
  m.beam([13.28,2.57,-5.2],[13.44,8.36,-5.37],.58,.71,'stone',.72);
  m.beam([9.53,2.54,-7.2],[9.68,7.1,-7.22],.49,.61,'stone',.74);
  m.beam([9.56,6.94,-7.21],[13.46,8.12,-5.32],.56,.71,'stone',.77);
  m.rock([13.40,8.33,-5.34],[.7,.56,.8],'stone',560,.84);
  m.rock([9.69,7.16,-7.2],[.6,.47,.68],'stone',563,.8);
  // Broken high lintel and dangling stays are a silhouette, not a roof.
  m.beam([4.19,5.38,-7.14],[7.71,5.40,-7.62],.46,.40,'wood',.7);
  m.cable([[7.6,5.43,-7.59],[7.49,4.7,-7.62],[7.52,3.61,-7.60]],.045,'iron',.66);
  // The foreground wall return frames the haven without closing its approach.
  // Deep shelf cells face the camera; the outer pier is a torn wall, not a
  // fourth identical vertical post beside the devices.
  m.at([14.12,0,2.9],1.22,0,()=>bookcase(m,3.5,3.52,.78,221,true));
  brokenSlab(m,[[14.38,3.91],[14.96,3.8],[14.24,5.00],[13.89,4.67]],3.78,5.10,2201,.67);
  m.rock([14.40,3.81,4.17],[.83,.62,1.10],'stone',2218,.74);
  m.beam([14.36,3.67,4.10],[14.74,4.28,3.92],.058,.069,'iron',.71);
  m.beam([13.70,3.39,1.26],[14.41,3.63,4.0],.18,.25,'wood',.6);
  // Detritus has causes and collection points: the broken wall joint, the
  // foot of the remaining shelves, and the place where someone tends a fire.
  rubblePocket(m,[13.52,.025,4.75],[.75,.33],9,2312,.78);
  rubblePocket(m,[5.25,.032,7.50],[.58,.22],7,2317,.83);
  rubblePocket(m,[-2.31,.016,4.40],[.50,.22],6,2321,.75);
  rubblePocket(m,[8.85,2.62,-2.98],[.42,.27],5,2327,.74);
  furnace(m,[8,0,6]);
  m.at([8.95,.02,5.78],-.25,0,()=>{
    cuboid(m,[0,.27,0],[.64,.54,.65],'wood',.66);
    for(const x of [-.28,.28])cuboid(m,[x,.31,.332],[.047,.48,.035],'iron',.66);
    cuboid(m,[0,.56,0],[.7,.08,.71],'wood',.87);
  });
  m.cylinder([10.13,.44,5.22],.27,.86,'iron',16,.21,.67);
  m.cylinder([10.13,.92,5.22],.14,.13,'iron',12,.14,.75);
  // Loose folios gather against furniture rather than carpeting the floor.
  for(const [x,z,a] of [[7.12,6.17,.13],[8.73,6.85,-.23],[11.85,-5.84,.21],[10.57,-6.35,-.14]] as const) {
    m.at([x,z<0?2.61:.015,z],a,0,()=>cuboid(m,[0,0,0],[.36,.018,.48],'paper',.6));
  }
  m.cable([[8.57,.04,5.80],[9.34,.07,5.28],[9.9,.04,4.58],[10.44,.04,3.32],[10.06,.04,1.74],[9.56,.04,.65]],.078,'black',.9);
  m.cable([[8.87,.06,5.11],[8.46,.055,4.93],[7.84,.07,4.99],[7.39,.08,5.27],[7.14,.065,5.85],[7.28,.062,6.48],[7.75,.067,6.79],[8.35,.045,6.75],[8.72,.03,6.48]],.055,'iron',.57);
  m.at([13.65,.025,3.31],.12,0,()=>{
    cuboid(m,[0,.062,0],[.35,.12,.47],'cloth',.55);
    cuboid(m,[.014,.123,-.015],[.32,.018,.42],'paper',.61);
    cuboid(m,[-.08,.18,.04],[.38,.078,.5],'wood',.54);
  });
  for(const [x,z,a] of [[13.15,3.92,-.23],[13.44,3.71,.18],[7.31,6.58,.48]] as const)m.at([x,.025,z],a,0,()=>{
    m.quad([-.14,.004,-.18],[.17,.004,-.18],[.17,.036,.19],[-.14,.02,.19],'paper',.62);
  });
}

function ramp(m:Model,a:V3,b:V3,width:number,rail:boolean):void {
  const dx=b[0]-a[0], dz=b[2]-a[2], len=Math.hypot(dx,dz), px=-dz/len*width/2,pz=dx/len*width/2;
  const al:V3=[a[0]-px,a[1]+.035,a[2]-pz],ar:V3=[a[0]+px,a[1]+.035,a[2]+pz],bl:V3=[b[0]-px,b[1]+.035,b[2]-pz],br:V3=[b[0]+px,b[1]+.035,b[2]+pz];
  // Winding follows the upward normal regardless of the ramp's direction.
  m.quad(al,ar,br,bl,'cutstone',.88);
  const below=(p:V3):V3=>[p[0],p[1]-.22,p[2]];
  m.quad(al,below(al),below(bl),bl,'stone',.69);
  m.quad(ar,br,below(br),below(ar),'stone',.69);
  m.beam([al[0],al[1]-.24,al[2]],[bl[0],bl[1]-.24,bl[2]],.16,.24,'iron',.68);
  m.beam([ar[0],ar[1]-.24,ar[2]],[br[0],br[1]-.24,br[2]],.16,.24,'iron',.68);
  if(rail) {
    for(const t of [.12,.55,.96]) {
      const x=al[0]+(bl[0]-al[0])*t,y=al[1]+(bl[1]-al[1])*t,z=al[2]+(bl[2]-al[2])*t;
      m.beam([x,y,z],[x,y+.77,z],.054,.066,'iron',.79);
    }
    m.beam([al[0]+(bl[0]-al[0])*.1,al[1]+(bl[1]-al[1])*.1+.77,al[2]+(bl[2]-al[2])*.1],[bl[0],bl[1]+.77,bl[2]],.061,.066,'iron',.84);
  }
}

function fracture(m:Model,path:readonly V2[],y:number,seed:number):void {
  m.cable(path.map(([x,z])=>[x,y+.011,z] as V3),.027,'black',.73);
  const rng=random(seed);
  for(let i=1;i<path.length-1;i++) {
    const p=path[i]!;
    if(i%2)m.rock([p[0]+.038,y+.008,p[1]-.025],[.12+rng()*.16,.045,.09],'stone',seed+i,.83);
  }
}

function sectionAggregate(m:Model,areas:readonly V3[],seed:number):void {
  const rng=random(seed);
  for(const [x,y,z] of areas)for(let i=0;i<5;i++) {
    m.rock([x+(rng()-.5)*.78,y+(rng()-.5)*.24,z+(rng()-.5)*.08],[.08+rng()*.11,.05+rng()*.09,.055],'cutstone',seed+i*9,.7+rng()*.23);
  }
}

function rubblePocket(m:Model,origin:V3,spread:V2,count:number,seed:number,tint:number):void {
  const rng=random(seed);
  for(let i=0;i<count;i++) {
    const x=origin[0]+(rng()-.5)*spread[0]*2,z=origin[2]+(rng()-.5)*spread[1]*2;
    const size=.07+rng()*.16;
    m.rock([x,origin[1]+size*.2,z],[size*1.25,size*.55,size],'stone',seed+i,tint*(.85+rng()*.25));
  }
}

function bookcase(m:Model,width:number,height:number,depth:number,seed:number,full:boolean):void {
  const rng=random(seed), levels=full?5:4, cell=height/levels;
  cuboid(m,[0,height/2,-depth*.46],[width,height,.11],'wood',.48);
  for(const x of [-width/2,width/2])m.box([x,height/2,0],[.18,height+.08,depth+.10],'wood',.035,.73);
  for(let row=0;row<=levels;row++) {
    const y=row*cell;
    cuboid(m,[0,y,0],[width+.13,.12,depth+.08],'wood',row===levels?.88:.72);
    cuboid(m,[0,y-.032,depth*.5+.025],[width+.12,.06,.055],'iron',.68);
    if(row===levels)continue;
    let x=-width/2+.16;
    while(x<width/2-.2) {
      const bw=.085+rng()*.10, bh=cell*(.53+rng()*.32), z=depth*.5-.12-rng()*.10;
      if(rng()<(full?.78:.56)) {
        const t=.56+rng()*.28;
        const mat:Material=rng()>.38?'wood':'cloth';
        cuboid(m,[x+bw/2,y+.08+bh/2,z-.12],[bw,bh,.3],mat,t);
        // Thin paper edge and spine bands remain geometry at pixel scale.
        if(bw>.13)cuboid(m,[x+bw/2,y+bh-.006,z+.034],[bw*.62,.038,.018],'paper',.61);
        if(rng()>.5)cuboid(m,[x+bw/2,y+.08+bh*.24,z+.037],[bw*.67,.024,.022],'bronze',.5);
      }
      x+=bw+.024+rng()*.04;
    }
  }
  for(const x of [-width/2+.1,width/2-.1])m.box([x,.12,0],[.27,.25,depth+.16],'wood',.04,.65);
}

function furnace(m:Model,origin:V3):void {
  m.at(origin,-.12,0,()=>{
    for(const x of [-.6,.6])for(const z of [-.32,.34])m.box([x,.19,z],[.19,.36,.2],'iron',.035,.6);
    m.box([0,.36,0],[1.51,.21,1.05],'iron',.065,.72);
    m.box([0,1.31,0],[1.53,.20,1.03],'iron',.07,.8);
    m.box([0,.84,-.40],[1.37,.78,.19],'iron',.038,.6);
    for(const x of [-.66,.66])m.box([x,.84,0],[.20,.86,.98],'iron',.048,.66);
    cuboid(m,[0,.75,-.278],[1.16,.61,.017],'black',.65);
    m.rock([-.28,.49,.08],[.44,.20,.39],'ember',988,.68);
    m.rock([.13,.48,.13],[.34,.18,.36],'ember',981,.96);
    m.rock([.32,.52,-.07],[.29,.29,.3],'ember',985,.8);
    for(let i=0;i<7;i++)m.beam([-.53+i*.176,.46,.454],[-.53+i*.176,1.18,.454],.05,.058,'iron',.69);
    m.beam([-.58,.72,.46],[.58,.72,.46],.045,.053,'iron',.6);
    m.box([0,1.44,0],[1.19,.08,.75],'iron',.022,.68);
    m.cylinder([.43,1.84,-.22],.135,.70,'iron',14,.135,.6);
    m.cylinder([.43,2.19,-.22],.16,.07,'iron',14,.16,.72);
    m.light([0,.72,.62],[1,.50,.16],3,5);
    m.at([-.35,1.51,-.06],.15,0,()=>{
      cuboid(m,[0,.03,0],[.43,.05,.36],'paper',.68);
      cuboid(m,[.06,.07,.025],[.40,.026,.30],'paper',.59);
    });
  });
}

function attachedRemains(m:Model):void {
  // This torn edge belongs to the playable remnant. The diagonal member
  // continues down into the void, connecting foreground and middle distance.
  brokenSlab(m,[[-7.34,-1.45],[-5.09,-2.78],[-4.8,-2.1],[-5.1,.2],[-4.83,1],[-5.5,1.30],[-5.73,.72],[-6.1,.81],[-7.5,-.74]],-.23,.97,773,.78);
  m.beam([-5.11,-.81,-1.62],[-10.52,-6.0,2.31],.49,.83,'iron',.69);
  m.beam([-5.7,-.77,-.4],[-9.63,-4.4,3.71],.27,.40,'iron',.59);
  m.rock([-7.29,-.23,-1.07],[.74,.42,.72],'stone',919,.77);
  m.beam([-6.54,-.36,-1.58],[-6.96,-3.7,-1.66],.12,.12,'iron',.58);
  m.cable([[-5.57,-.36,-1.3],[-6.19,-1.42,-1.1],[-7.33,-2.73,-.4],[-8.84,-3.64,1.47]],.07,'iron',.66);
  // A severed pillar capital below the near slab is large enough to read as
  // architecture, but most of its supporting length is lost in darkness.
  brokenSlab(m,[[-1.5,7.1],[-.03,6.68],[.92,7.23],[.66,8.72],[-.94,9.15],[-1.71,8.51]],-5.72,.62,793,.70);
  m.beam([-.43,-6.25,7.92],[-.52,-12.1,8.0],.49,.62,'stone',.6);
  m.beam([-.8,-6.31,7.74],[-.81,-8.46,7.64],.052,.06,'iron',.7);
  brokenSlab(m,[[8.08,10.61],[10.07,10.02],[11.2,11.5],[9.33,12.41],[8.71,11.97]],-8.45,.88,796,.54);
  m.beam([8.5,-8.91,11.36],[4.9,-11.8,13.52],.55,.74,'stone',.54);
  pollutionSeam(m,[[-6.72,-.16,-1.31],[-6.38,-.13,-1.11],[-6.17,-.12,-.81],[-5.98,-.12,-.88]],.052,.42);
  contaminatedAttachment(m,[-6.13,-.21,-.93],[1,0,0],[0,0,1],1.1,.64,3502,.83);
  beamInfection(m,[-5.11,-.81,-1.62],[-10.52,-6.0,2.31],.49,.83,.21,1.25,3508,.97);
  rubblePocket(m,[-6.59,-.19,-1.05],[.36,.42],8,3511,.66);
  // Split masonry exposes a short return plane on the right lower fracture.
  m.rock([12.17,-1.70,6.58],[.85,1.65,.9],'stone',3527,.64);
  m.rock([12.84,-.83,5.81],[.75,1.13,.72],'stone',3529,.71);
  m.beam([12.33,-.48,6.21],[12.46,-1.61,6.33],.075,.095,'iron',.68);
}

function fallenLibrary(m:Model):void {
  m.beam([-12.4,-7.4,4.7],[-7.95,2.8,-.79],.85,1.04,'stone',.57);
  m.beam([-12.52,-7.26,4.64],[-8.08,2.92,-.83],.11,.12,'iron',.55);
  m.beam([-12.4,-7.4,4.7],[-6.3,-5.25,8.43],.77,.72,'stone',.55);
  brokenSlab(m,[[-11.1,2.67],[-9.4,1.88],[-7.7,2.71],[-7.86,3.63],[-9.42,4.5],[-10.67,3.94]],-2.96,.67,801,.64);
  m.beam([-9.52,-3.4,3.1],[-9.36,-9.4,3.23],.55,.69,'stone',.51);
  // The shelf is visibly no longer on the same ground plane as the haven.
  m.at([-10.1,-5.6,6.7],-.35,0,()=>{
    bookcase(m,3.9,2.4,.67,632,false);
    m.beam([-2.12,2.49,-.3],[1.88,2.81,-.32],.16,.28,'wood',.54);
  });
  // Tilted frame: custom struts keep the whole ruin tilted, rather than merely
  // rotating a sound cabinet in plan.
  const a:V3=[-10.72,-1.7,-.51],b:V3=[-7.51,.4,-2.03],c:V3=[-8.97,3.81,-2.24],d:V3=[-12.2,1.63,-.72];
  for(const [p,q] of [[a,b],[b,c],[c,d],[d,a]] as [V3,V3][])m.beam(p,q,.23,.27,'wood',.55);
  for(const t of [.32,.67]) {
    const p:V3=[a[0]+(d[0]-a[0])*t,a[1]+(d[1]-a[1])*t,a[2]+(d[2]-a[2])*t];
    const q:V3=[b[0]+(c[0]-b[0])*t,b[1]+(c[1]-b[1])*t,b[2]+(c[2]-b[2])*t];
    m.beam(p,q,.15,.23,'wood',.60);
  }
  m.beam([-12.77,-7.2,-3.29],[-12.19,3.13,-3.81],.62,.83,'stone',.51);
  m.beam([-12.21,2.76,-3.71],[-7.65,2.34,-5.68],.83,.97,'stone',.62);
  m.cable([[-8.47,2.58,-5.43],[-8.72,.21,-5.4],[-8.53,-2.1,-5.58],[-8.73,-6.42,-5.47]],.069,'iron',.65);
  brokenSlab(m,[[-5.58,6.0],[-4.8,5.7],[-3.83,6.19],[-4.02,7.03],[-5.34,7.31]],-4.56,.5,847,.64);
  m.rock([-8.19,-1.95,4.25],[.82,.62,.83],'stone',858,.6);
  m.rock([-5.64,-5.47,4.47],[.58,.34,.48],'stone',859,.5);
  pollutionSeam(m,[[-11.74,-5.6,4.07],[-11.25,-4.45,3.47],[-10.95,-3.94,3.19],[-10.59,-2.98,2.58]],.064,.39);
  pollutionSeam(m,[[-8.64,2.63,-5.17],[-9.32,2.71,-4.92],[-9.44,2.70,-4.70]],.048,.33);
  beamInfection(m,[-12.4,-7.4,4.7],[-7.95,2.8,-.79],.85,1.04,.43,1.65,3611,1.07);
  beamInfection(m,[-12.21,2.76,-3.71],[-7.65,2.34,-5.68],.83,.97,.71,1.21,3617,.97);
  contaminatedAttachment(m,[-9.61,-2.94,3.86],[1,0,0],[0,0,1],.85,.66,3629,.92);
  rubblePocket(m,[-9.53,-2.93,3.91],[.72,.25],9,3631,.61);
  m.rock([-12.02,2.8,-3.80],[.98,.95,1.14],'stone',3651,.57);
  m.rock([-8.1,2.39,-5.43],[.65,.69,.86],'stone',3657,.63);
  m.beam([-8.41,2.46,-5.14],[-8.12,1.53,-5.2],.056,.06,'iron',.59);

  tiltedBookcase(m,[[-7.43,-4.81,3.70],[-4.91,-3.61,2.69],[-5.80,-.82,2.41],[-8.32,-2.02,3.42]],3711);
  m.cable([[-8.25,-1.99,3.43],[-8.46,-3.45,3.46],[-8.31,-5.16,3.38],[-7.66,-5.76,3.76]],.044,'iron',.57);
  // A broken arch shoulder farther behind the fallen furniture has a deep
  // horizontal return; it does not become another thin isolated column.
  brokenSlab(m,[[-13.68,-2.07],[-12.64,-2.76],[-11.11,-1.94],[-10.97,-1.06],[-11.84,-.71],[-12.40,-1.2],[-13.55,-.93]],-1.2,1.1,3761,.55);
  m.beam([-12.62,-1.82,-1.83],[-13.49,-5.65,-1.21],.71,.89,'stone',.48);
  m.beam([-11.15,-1.55,-1.40],[-10.00,-2.75,-.37],.83,.64,'stone',.50);
  contaminatedAttachment(m,[-12.05,-1.18,-1.43],[1,0,0],[0,0,1],.68,.47,3767,.93);
}

function distantFabric(m:Model):void {
  // One enormous arch fragment and one crossed gallery give distant scale.
  // No floor connects them, and large areas between them remain completely void.
  m.beam([-18.4,-7.5,-13.4],[-17.74,9.44,-13.17],1.14,1.42,'stone',.46);
  m.beam([-17.74,9.12,-13.17],[-11.57,10.66,-15.71],1.20,1.32,'stone',.48);
  m.beam([-11.57,10.54,-15.71],[-11.31,14.3,-15.8],1.05,1.26,'stone',.41);
  m.rock([-17.76,9.69,-13.18],[1.42,.65,1.60],'stone',661,.50);
  m.beam([-17.24,8.84,-12.85],[-17.1,3.1,-12.8],.105,.10,'iron',.5);
  m.beam([-12.17,10.42,-15.04],[-12.44,4.16,-15.0],.09,.09,'iron',.52);
  m.cable([[-13.16,10.26,-14.56],[-13.18,6.4,-14.49],[-13.54,2.8,-14.23],[-13.69,-1.7,-14.36]],.074,'iron',.48);
  brokenSlab(m,[[-21.7,-6.14],[-19.9,-7.18],[-9.49,-10.29],[-8.83,-9.46],[-9.59,-8.42],[-16.5,-6.53],[-17.6,-6.51],[-21.12,-5.23]],4.3,.64,701,.47);
  m.beam([-20.58,3.78,-5.96],[-20.48,-5.9,-5.71],.69,.89,'stone',.40);
  m.beam([-13.38,3.75,-8.11],[-15.9,-5.7,-5.65],.45,.56,'stone',.39);
  m.beam([-20.01,4.1,-6.54],[-8.97,4.10,-9.56],.095,.13,'iron',.44);
  for(const x of [-19.7,-15.9,-12.9])m.beam([x,4.2,-6.7-(x+19.7)*.275],[x,5.09,-6.7-(x+19.7)*.275],.065,.07,'iron',.45);
  m.beam([-19.7,5.09,-6.7],[-12.9,5.09,-8.57],.074,.075,'iron',.43);
  // An almost invisible second pier, not a repeated architectural row.
  m.beam([-8.72,-6.1,-19.63],[-8.83,6.7,-19.5],1.46,1.31,'stone',.35);
  brokenSlab(m,[[-9.97,-20.23],[-7.4,-20.78],[-6.93,-18.39],[-9.73,-17.72]],6.64,.81,721,.36);
  pollutionSeam(m,[[-17.2,9.61,-12.86],[-16.46,9.84,-13.2],[-15.7,10.02,-13.51],[-15.27,10.1,-13.43]],.085,.28);
  pollutionSeam(m,[[-20.68,4.35,-5.71],[-19.9,4.35,-5.93],[-19.26,4.35,-6.17]],.08,.24);
}

function pollutionSeam(m:Model,path:readonly V3[],width:number,tint:number):void {
  // These are exposed contaminated cracks, never a trim around every object.
  m.cable(path,width,'pollutant',tint);
  for(let i=1;i<path.length;i+=2) {
    const p=path[i]!;
    m.rock(p,[width*2.7,width*1.3,width*2.4],'pollutant',997+i,tint*.87);
  }
}

/** A rooted, broken group of accretions on a real receiving plane. Gaps between
 * its lobes expose the original masonry; it is neither a stripe nor trim. */
function contaminatedAttachment(m:Model,origin:V3,u:V3,v:V3,length:number,width:number,seed:number,tint:number):void {
  const rng=random(seed);
  let normal=unit(cross(u,v));
  if(normal[0]*19+normal[1]*24+normal[2]*30<0)normal=mul(normal,-1);
  const pos=(x:number,y:number,lift=.006):V3=>add(origin,add(add(mul(u,x),mul(v,y)),mul(normal,lift)));
  for(let k=0;k<9;k++) {
    const x=(rng()-.5)*length,y=(rng()-.5)*width;
    const rx=length*(.035+rng()*.07),ry=width*(.075+rng()*.16);
    const contour:V3[]=[];
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2,r=.64+rng()*.5;contour.push(pos(x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r));}
    const c=pos(x,y,.014+rng()*.023);
    for(let i=0;i<6;i++)m.triangle(c,contour[i]!,contour[(i+1)%6]!,'pollutant',tint*(.67+rng()*.40));
    if(k%3===0) {
      const edge=pos(x+rx*.5,y+ry*.2,.03);
      m.rock(edge,[.078,.048,.066],'pollutant',seed+k,tint*.83);
    }
  }
}

function beamInfection(m:Model,a:V3,b:V3,width:number,depth:number,t:number,length:number,seed:number,tint:number):void {
  const axis=unit(sub(b,a)),side=unit(cross(axis,Math.abs(axis[1])>.94?[1,0,0]:[0,1,0])),face=unit(cross(side,axis));
  const origin=add(add(a,mul(sub(b,a),t)),mul(face,depth*.505));
  contaminatedAttachment(m,origin,axis,side,length,width*.88,seed,tint);
}

function tiltedBookcase(m:Model,points:readonly[V3,V3,V3,V3],seed:number):void {
  const [a,b,c,d]=points,rng=random(seed),up=unit(sub(d,a)),across=unit(sub(b,a)),normal=unit(cross(across,up));
  const mix=(p:V3,q:V3,t:number):V3=>add(p,mul(sub(q,p),t));
  for(const [p,q] of [[a,b],[b,c],[c,d],[d,a]] as [V3,V3][])m.beam(p,q,.18,.29,'wood',.6);
  for(const t of [.26,.53,.79]) {
    const p=mix(a,d,t),q=mix(b,c,t);
    m.beam(p,q,.12,.28,'wood',.64);
    for(let j=0;j<8;j++)if(rng()>.38) {
      const x=(j+.34+rng()*.23)/8,h=.30+rng()*.30;
      const lo=add(mix(p,q,x),mul(normal,.11)),hi=add(lo,mul(up,h));
      m.beam(lo,hi,.092+rng()*.057,.19,rng()>.5?'wood':'cloth',.49+rng()*.22);
      if(j%3===0)m.beam(add(hi,mul(up,-.035)),hi,.10,.198,'paper',.48);
    }
  }
  const brokenBack=[add(a,mul(normal,-.13)),add(b,mul(normal,-.13)),add(mix(b,c,.38),mul(normal,-.13)),add(mix(a,d,.33),mul(normal,-.13))] as const;
  m.quad(...brokenBack,'wood',.41);
  m.beam(add(d,mul(up,-.10)),add(c,mul(across,.12)),.17,.30,'wood',.64);
  contaminatedAttachment(m,add(mix(d,c,.18),mul(normal,.15)),across,up,.62,.31,seed+78,.78);
}
