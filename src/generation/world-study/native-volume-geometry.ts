/** Editable material constructions in Rift's existing XY plane. Z is real height;
 * it never changes the ground projection, character scale, or walkable floor. */
import { buildExpandedNativeVolume, NATIVE_VOLUME_SHAPE_PROFILES, type NativeVolumeShapeProfile as NativeVolumeV3Profile } from './native-volume-expansion';
import { buildGroundNativeVolume, NATIVE_VOLUME_V4_PROFILES, type NativeVolumeV4Profile } from './native-volume-ground';
import { appendNativeGroundEdges, type NativeGroundEdgeContext } from './native-volume-ground-edge';
import { smoothOrganizedSurface } from './native-volume-organization';
export { NATIVE_VOLUME_SHAPE_PROFILES } from './native-volume-expansion';
export { NATIVE_VOLUME_V4_PROFILES } from './native-volume-ground';
export type NativeVolumeShapeProfile = NativeVolumeV3Profile | NativeVolumeV4Profile;
export type NativeVolumeFamily = 'folded-slab' | 'fibre-knot' | 'broken-shell' | 'granular-ridge' | 'membrane-rim' | 'gel-flow';
/** Stable raster encoding; append rather than reorder existing families. */
export const NATIVE_VOLUME_FAMILY_SEQUENCE: readonly NativeVolumeFamily[] = ['folded-slab', 'fibre-knot', 'broken-shell', 'granular-ridge', 'membrane-rim', 'gel-flow'];
export type NativeVolumeMaterialSlot = 'outer' | 'cut' | 'inner' | 'joint';
export const NATIVE_VOLUME_MATERIALS = ['outer', 'cut', 'inner', 'joint'] as const;
/** Construction history, not texture presets. The maker assigns these where
 * folding compresses a layer, opens a peel, or expels an actual broken section. */
export const NATIVE_VOLUME_REGIONS = { intact: 0, compressed: 1, peeled: 2, fractured: 3, tension: 4, glazed: 5 } as const;
export interface NativeVolumeSpec {
  id: number; family: NativeVolumeFamily; seed: number;
  x: number; y: number; rotation: number;
  length: number; width: number; height: number; thickness: number;
  /** Shape controls, supplied by the content table; these are not game grades. */
  fold: number; branches: number; opening: number; distortion: number;
  /** Explicit physical role from the author. Omitted/0 preserves relief geometry. */
  blocking?: number;
  /** Explicit authored construction schema. Omitted retains the approved masters. */
  constructionVersion?: 1 | 2 | 3 | 4;
  /** Explicit versioned topology, independent of the source material family. */
  shapeProfile?: NativeVolumeShapeProfile;
  /** Ground-side shallow section, owned by one v4 primary-material relief. */
  groundEdgeWidth?: number;
}
export interface NativeVolumePoint { x: number; y: number; z: number }
export interface NativeVolumeJoint extends NativeVolumePoint { readonly index: number }
export interface NativeVolumeBounds { minX: number; minY: number; maxX: number; maxY: number; maxZ: number }
export interface NativeVolumeMesh {
  readonly spec: Readonly<NativeVolumeSpec>;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  /** Material-space coordinates in native pixels, independent of the camera. */
  readonly uv: Float32Array;
  readonly indices: Uint32Array;
  readonly materials: Uint8Array;
  readonly regions: Uint8Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bounds: Readonly<NativeVolumeBounds>;
  readonly joints: readonly NativeVolumeJoint[];
}

type Point = readonly [number, number, number];
type UV = readonly [number, number];
const TAU = Math.PI * 2;
const clamp = (v: number, low: number, high: number): number => Math.max(low, Math.min(high, v));

/** Seed changes joined geometry, not a field of disconnected decorative debris. */
function phase(seed: number, salt: number): number {
  let a = Math.imul((seed | 0) ^ salt, 0x45d9f3b);
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b);
  return ((a ^ (a >>> 16)) >>> 0) / 0x100000000;
}

export function validateNativeVolumeSpec(spec: Readonly<NativeVolumeSpec>): void {
  const numbers = ['id', 'seed', 'x', 'y', 'rotation', 'length', 'width', 'height', 'thickness', 'fold', 'branches', 'opening', 'distortion'] as const;
  const keys = new Set<string>([...numbers, 'family', 'blocking', 'constructionVersion', 'shapeProfile', 'groundEdgeWidth']);
  if (Object.keys(spec).some(key => !keys.has(key)) || numbers.some(key => !Number.isFinite(spec[key])))
    throw new Error('Native volume must contain exactly the known required numeric fields');
  for (const [key, value] of Object.entries(spec)) {
    if (key !== 'family' && key !== 'shapeProfile' && !((key === 'blocking' || key === 'constructionVersion') && value === undefined)
      && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`Native volume ${key} must be finite`);
    }
  }
  if (!['folded-slab', 'fibre-knot', 'broken-shell', 'granular-ridge', 'membrane-rim', 'gel-flow'].includes(spec.family)) throw new Error('Unknown native volume family');
  if (!Number.isInteger(spec.id) || spec.id < 1 || spec.id > 0x7fffffff) throw new Error('Volume id must be a positive Int32');
  if (!Number.isInteger(spec.seed)) throw new Error('Volume seed must be an integer');
  if (spec.constructionVersion !== undefined && ![1, 2, 3, 4].includes(spec.constructionVersion)) throw new Error('Native volume constructionVersion must be 1, 2, 3 or 4');
  const profiles: readonly string[] = spec.constructionVersion === 4 ? NATIVE_VOLUME_V4_PROFILES : spec.constructionVersion === 3 ? NATIVE_VOLUME_SHAPE_PROFILES : [];
  if (profiles.length ? !profiles.includes(spec.shapeProfile!) : spec.shapeProfile !== undefined)
    throw new Error('Native volume shapeProfile must belong to its explicit construction version');
  if (spec.blocking !== undefined && spec.blocking !== 0 && spec.blocking !== 1) throw new Error('Native volume blocking must be 0 or 1');
  if ((spec.shapeProfile === 'settled-sheet' || spec.shapeProfile === 'settled-fan') && (spec.blocking !== 0 || spec.height > 6))
    throw new Error('Settled material requires explicit nonblocking material with height at most 6');
  if (spec.groundEdgeWidth !== undefined && (spec.constructionVersion !== 4 || spec.blocking !== 0 || spec.height > 6
    || spec.groundEdgeWidth < 8 || spec.groundEdgeWidth > 24)) throw new Error('Native ground edge requires v4 low relief and width 8–24px');
  if (spec.length < 16 || spec.width < 12 || spec.height < 2 || spec.thickness < 1
    || spec.length > 2048 || spec.width > 2048 || spec.height > 512
    || spec.thickness > Math.min(spec.length, spec.width) * .45) throw new Error('Native volume dimensions outside bounded construction range');
  for (const key of ['fold', 'opening', 'distortion'] as const) {
    if (spec[key] < 0 || spec[key] > 1) throw new Error(`Native volume ${key} must be in [0, 1]`);
  }
  if (!Number.isInteger(spec.branches) || spec.branches < 2 || spec.branches > 8) throw new Error('Native volume branches must be an integer in [2, 8]');
}

class MeshBuilder {
  private readonly points: number[] = [];
  private readonly normalData: number[] = [];
  private readonly texels: number[] = [];
  private readonly triangles: number[] = [];
  private readonly slots: number[] = [];
  private readonly regions: number[] = [];
  private readonly joints: NativeVolumeJoint[] = [];
  private readonly bounds: NativeVolumeBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: 0 };
  private readonly cosine: number;
  private readonly sine: number;
  constructor(readonly spec: Readonly<NativeVolumeSpec>) {
    this.cosine = Math.cos(spec.rotation); this.sine = Math.sin(spec.rotation);
  }
  private vertex(p: Point, uv: UV, n: Point): number {
    const x = this.spec.x + p[0] * this.cosine - p[1] * this.sine;
    const y = this.spec.y + p[0] * this.sine + p[1] * this.cosine;
    const z = Math.max(0, p[2]);
    this.bounds.minX = Math.min(this.bounds.minX, x); this.bounds.maxX = Math.max(this.bounds.maxX, x);
    this.bounds.minY = Math.min(this.bounds.minY, y); this.bounds.maxY = Math.max(this.bounds.maxY, y);
    this.bounds.maxZ = Math.max(this.bounds.maxZ, z);
    const index = this.points.length / 3;
    this.points.push(x, y, z);
    this.normalData.push(n[0] * this.cosine - n[1] * this.sine, n[0] * this.sine + n[1] * this.cosine, n[2]);
    this.texels.push(uv[0], uv[1]);
    return index;
  }
  quad(a: Point, b: Point, c: Point, d: Point, material: number, uvs: readonly [UV, UV, UV, UV], wanted?: Point, region = 0): void {
    const triangle=(p:Point,q:Point,r:Point,up:UV,uq:UV,ur:UV):void=>{
      const ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2],vx=r[0]-p[0],vy=r[1]-p[1],vz=r[2]-p[2];
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const size=Math.hypot(nx,ny,nz);if(size<1e-6)return;
      nx/=size;ny/=size;nz/=size;if(wanted&&nx*wanted[0]+ny*wanted[1]+nz*wanted[2]<0){nx=-nx;ny=-ny;nz=-nz;}
      const normal:Point=[nx,ny,nz];
      this.triangles.push(this.vertex(p,up,normal),this.vertex(q,uq,normal),this.vertex(r,ur,normal));
      this.slots.push(material);this.regions.push(region);
    };
    // Bent quads are two actual planes. Copying the first triangle's normal to
    // the second makes height and lighting disagree on every warped shoulder.
    triangle(a,b,c,uvs[0],uvs[1],uvs[2]);triangle(a,c,d,uvs[0],uvs[2],uvs[3]);
  }

  joint(p: Point): void {
    this.joints.push({ index: this.joints.length,
      x: this.spec.x + p[0] * this.cosine - p[1] * this.sine,
      y: this.spec.y + p[0] * this.sine + p[1] * this.cosine, z: p[2] });
  }
  finish(): NativeVolumeMesh {
    // Content authors specify maximum world height, not an extra displacement
    // on top of thickness. Preserve positions, normals and source lights together.
    const heightScale = this.spec.height / Math.max(1, this.bounds.maxZ);
    for (let i = 0; i < this.points.length; i += 3) {
      this.points[i + 2] = this.points[i + 2]! * heightScale;
      const nx = this.normalData[i]!, ny = this.normalData[i + 1]!, nz = this.normalData[i + 2]! / heightScale;
      const length = Math.hypot(nx, ny, nz) || 1;
      this.normalData[i] = nx / length; this.normalData[i + 1] = ny / length; this.normalData[i + 2] = nz / length;
    }
    for (const joint of this.joints) joint.z *= heightScale;
    this.bounds.maxZ = this.spec.height;
    return { spec: Object.freeze({ ...this.spec }), positions: new Float32Array(this.points), normals: new Float32Array(this.normalData),
      uv: new Float32Array(this.texels), indices: new Uint32Array(this.triangles), materials: new Uint8Array(this.slots), regions: new Uint8Array(this.regions),
      vertexCount: this.points.length / 3, triangleCount: this.slots.length, bounds: Object.freeze(this.bounds), joints: this.joints };
  }
}

/** Three unequal pieces of one buckled bed meet at a branching shear fault.
 * There is no longitudinal array of repeated profiles. Each bed has an actual
 * buried end, a broad sloping shoulder and a few broken, offset cut planes. */
function foldedSlab(b: MeshBuilder): void {
  const s=b.spec,l=s.length,w=s.width,h=s.height;
  const shift=(phase(s.seed,101)-.5)*.05;
  const thrust=(s.fold-.5)*.075;
  const px=(x:number):number=>(x+shift)*l;
  const py=(y:number):number=>y*w;
  const near=(ratio:number):number=>Math.min(h*ratio,19+s.thickness*.22);
  const a:Point[]=[
    [-l*.51,py(-.14),0],[-l*.37,py(-.37),h*.33],
    [px(-.15),py(-.43),h*.6424],[px(.025),py(-.20),h*.486],
    [px(-.014),py(.058+thrust),near(.31056-thrust*.68)],[px(-.19),py(.235),near(.1902)],
    [-l*.42,py(.135),h*.025],
  ];
  const c:Point[]=[
    [px(.035),py(-.30),h*.7028],[px(.22),py(-.49),h*.9836],
    [l*.49,py(-.27),h*.16],[l*.46,py(-.005),h*.025],
    [px(.24),py(.095),near(.1662)],[px(.085),py(-.025),near(.3218)],
  ];
  const outlet:Point[]=[
    [px(-.26),py(.30),near(.11)],[px(-.075),py(.135+thrust),near(.21)],
    [px(.09),py(.13+thrust),near(.19)],[px(.265),py(.35),near(.08)],
    [px(.095),py(.535),0],[px(-.15),py(.49),h*.018],
  ];
  // A broad bedding surface is one inclined mother plane. Its triangulation
  // must not create a spurious star-shaped ridge at the triangulation centre.
  // Different layers, and the actual section planes below, carry the folds.
  const plane=(outline:Point[],peak:number,dx:number,dy:number):Point=>{
    const depth=outline.map(p=>p[0]*dx+p[1]*dy),min=Math.min(...depth),span=Math.max(...depth)-min;
    for(let i=0;i<outline.length;i++)outline[i]=[outline[i]![0],outline[i]![1],(depth[i]!-min)/span*peak];
    const x=outline.reduce((n,p)=>n+p[0],0)/outline.length,y=outline.reduce((n,p)=>n+p[1],0)/outline.length;
    return [x,y,(x*dx+y*dy-min)/span*peak];
  };
  const aCentre=plane(a,h*.73,.16,-1);
  const cCentre=plane(c,h,-.35,-1);
  const outletCentre=plane(outlet,near(.25),.13,-1);
  // Adjacent cut faces share the fault; large tops are neither concentric rings
  // nor three independently placed stones. Low relief uses these same planes.
  bedMass(b,a,aCentre,0,[3,4],Math.min(24,Math.max(9,w*.12)));
  bedMass(b,c,cCentre,1,[4,5],Math.min(21,Math.max(8,w*.105)));
  bedMass(b,outlet,outletCentre,2,[0,1],Math.min(17,Math.max(7,w*.085)));
}

/** A fault opens into one broad mouth and returns into its parent bed at both
 * ends. The peeled shoulder is real coplanar geometry with its own material
 * region, not a bright perimeter painted around a complete stone. */
function bedMass(b:MeshBuilder,top:readonly Point[],centre:Point,salt:number,faultEdges:readonly number[],cutWidth:number):void {
  const n=top.length,s=b.spec;
  const lerp=(a:Point,c:Point,t:number):Point=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t,a[2]+(c[2]-a[2])*t];
  // A solid bed ends in a real section, including its otherwise flat outlet.
  // The affine lift retains each broad mother plane and the authored maximum
  // height; three unequal beds do not acquire one level, regular pedestal.
  const footHeight=s.blocking===1?Math.min(s.height*.42,8.5+salt*.9+phase(s.seed,810+salt)*1.2):0;
  const lift=(p:Point):Point=>footHeight>0?[p[0],p[1],footHeight+p[2]*(1-footHeight/s.height)]:p;
  const surfaceCentre=lift(centre);
  type EdgePoint={top:Point;foot:Point;shoulder:Point;mouth:number;distance:number;fault:boolean};
  const rim:EdgePoint[]=[];
  let distance=0;
  const mouthPeak=.43+phase(s.seed,700+salt)*.16;
  for(let i=0;i<n;i++){
    const p=top[i]!,q=top[(i+1)%n]!,rank=faultEdges.indexOf(i),fault=rank>=0;
    const subdivisions=fault?5:1;
    const edgeLength=Math.hypot(q[0]-p[0],q[1]-p[1]);
    for(let j=0;j<subdivisions;j++){
      const t=j/subdivisions,at=lerp(p,q,t),along=(rank+t)/faultEdges.length;
      const lobe=fault?clamp(along<mouthPeak?along/mouthPeak:(1-along)/(1-mouthPeak),0,1):0;
      const mouth=lobe*lobe*(3-2*lobe);
      // Inset the upper lip while spreading its lower termination. This single
      // opening has a real width gradient, rather than another uniform bevel.
      const radius=Math.hypot(at[0]-centre[0],at[1]-centre[1])||1;
      const nx=(at[0]-centre[0])/radius,ny=(at[1]-centre[1])/radius;
      const inset=cutWidth*mouth*(salt===2?.52:.78);
      let lip=lerp(at,centre,Math.min(.26,inset/radius));
      const burial=clamp(at[2]/Math.max(3,s.height*.16),0,1);
      const spread=cutWidth*burial*(fault?.13+mouth*1.8:.26);
      const foot:Point=[at[0]+nx*spread,at[1]+ny*spread,0];
      if(footHeight>0){
        // Leave the exact old foot and all high shoulders in place. Where the
        // old plane buried itself into the ground, draw its upper end inward
        // to expose 6–10 native pixels of steep section. The existing wide
        // fault mouth remains wide rather than gaining a second uniform rim.
        const sectionWidth=6.5+phase(s.seed,830+salt)*1.5+(at[0]/s.length+.5)*1.1+mouth*.8;
        const run=Math.hypot(lip[0]-foot[0],lip[1]-foot[1]);
        const lowEnd=1-clamp(at[2]/(footHeight*2),0,1);
        const toCentre=Math.hypot(lip[0]-centre[0],lip[1]-centre[1])||1;
        lip=lerp(lip,centre,clamp((sectionWidth-run)*lowEnd/toCentre,0,.34));
      }
      const shoulder=lift(lerp(lip,centre,Math.min(.34,(5+cutWidth*.7)*mouth/radius)));
      lip=lift(lip);
      rim.push({top:lip,foot,shoulder,mouth,distance:distance+edgeLength*t,fault});
    }
    distance+=edgeLength;
  }
  let contactPlaced=false;
  for(let i=0;i<rim.length;i++){
    const next=(i+1)%rim.length,a=rim[i]!,c=rim[next]!;
    const region=salt===2?NATIVE_VOLUME_REGIONS.compressed:NATIVE_VOLUME_REGIONS.intact;
    const topUv=(p:Point):UV=>[p[0],p[1]];
    b.quad(surfaceCentre,a.shoulder,c.shoulder,surfaceCentre,0,
      [topUv(surfaceCentre),topUv(a.shoulder),topUv(c.shoulder),topUv(surfaceCentre)],[0,0,1],region);
    // The exposure is assigned to an actual shoulder adjacent to the mouth;
    // arbitrary triangles elsewhere on the broad top cannot acquire it.
    b.quad(a.shoulder,a.top,c.top,c.shoulder,0,
      [topUv(a.shoulder),topUv(a.top),topUv(c.top),topUv(c.shoulder)],[0,0,1],NATIVE_VOLUME_REGIONS.peeled);
    const endDistance=next===0?distance:c.distance;
    const sideUv=(p:Point,d:number):UV=>[d,p[2]];
    const open=a.fault&&Math.max(a.mouth,c.mouth)>.08;
    b.quad(a.top,a.foot,c.foot,c.top,open?1:0,
      [sideUv(a.top,a.distance),sideUv(a.foot,a.distance),sideUv(c.foot,endDistance),sideUv(c.top,endDistance)],
      [0,0,1],open?NATIVE_VOLUME_REGIONS.fractured:region);
    b.quad([centre[0],centre[1],0],c.foot,a.foot,[centre[0],centre[1],0],2,
      [topUv(centre),topUv(c.foot),topUv(a.foot),topUv(centre)],[0,0,-1],NATIVE_VOLUME_REGIONS.intact);
    if(salt===0&&!contactPlaced&&a.fault&&a.mouth>.5&&c.mouth>a.mouth){
      // Recessed contact lies on this very cut plane. It does not float above
      // a removed intermediate bevel or light up the complete rim.
      // Use barycentric coordinates of the actual first section triangle.
      // Bilinear interpolation of a warped quad can sit under its rasterized
      // plane, concealing the emitter even when its boundary looks correct.
      const point=(t:number,v:number):Point=>[a.top[0]+t*(c.foot[0]-a.top[0])+v*(a.foot[0]-a.top[0]),
        a.top[1]+t*(c.foot[1]-a.top[1])+v*(a.foot[1]-a.top[1]),
        a.top[2]+t*(c.foot[2]-a.top[2])+v*(a.foot[2]-a.top[2])+.055];
      const p0=point(.08,.08),p1=point(.46,.08),p2=point(.46,.42),p3=point(.08,.42);
      b.quad(p0,p3,p2,p1,3,[[0,0],[0,6],[12,6],[12,0]],[0,0,1],NATIVE_VOLUME_REGIONS.compressed);
      b.joint([(p0[0]+p1[0]+p2[0]+p3[0])*.25,(p0[1]+p1[1]+p2[1]+p3[1])*.25,(p0[2]+p1[2]+p2[2]+p3[2])*.25]);
      contactPlaced=true;
    }
  }
}

/** Swept elliptical strands share a pulled centre. Long axes, taper and the
 * eccentric throat are structural; smaller strands remain joined to their root. */
function fibreKnot(b: MeshBuilder): void {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const knotX = l * (-.08 + (phase(s.seed, 211) - .5) * .045), knotY = w * (.05 + .12 * s.distortion + (phase(s.seed, 213) - .5) * .035);
  const main: Point[] = [[-l * .51, -w * .16, s.thickness * .6], [-l * .30, -w * .08, h * .27],
    [knotX, knotY, h * .57], [l * .18, w * .02, h * .38], [l * .5, w * .19, s.thickness * .63]];
  sweptBundle(b, main, w * .145, 0);
  const cross: Point[] = [[-l * .24, w * .48, s.thickness * .44], [-l * .18, w * .28, h * .29],
    [knotX + w * .07, knotY, h * .82], [l * .04, -w * .15, h * .45], [l * .15, -w * .46, s.thickness * .51]];
  sweptBundle(b, cross, w * .080, 1);
  if (s.branches >= 3) {
    const subordinate: Point[] = [[l * .41, -w * .38, s.thickness * .36], [l * .20, -w * .16, h * .25],
      [knotX + w * .06, knotY - w * .045, h * .69], [-l * .13, w * .26, h * .35]];
    sweptBundle(b, subordinate, w * .047, 2);
  }
  b.joint([knotX + w * .04, knotY, h * .84]);
}

function sweptBundle(b: MeshBuilder, spine: readonly Point[], radius: number, salt: number): void {
  const s = b.spec, cross = 18, steps = (spine.length - 1) * 8;
  const rings: Point[][] = [];
  for (let i = 0; i <= steps; i++) {
    const whole = i / steps * (spine.length - 1), segment = Math.min(spine.length - 2, Math.floor(whole));
    const t = i === steps ? 1 : whole - segment;
    const a = spine[segment]!, c = spine[segment + 1]!;
    const before = spine[Math.max(0, segment - 1)]!, after = spine[Math.min(spine.length - 1, segment + 2)]!;
    const curve = (channel:number, q:number):number => .5*((2*a[channel]!) + (-before[channel]!+c[channel]!)*q
      +(2*before[channel]!-5*a[channel]!+4*c[channel]!-after[channel]!)*q*q
      +(-before[channel]!+3*a[channel]!-3*c[channel]!+after[channel]!)*q*q*q);
    const tangent = (channel:number):number => .5*((-before[channel]!+c[channel]!)
      +2*(2*before[channel]!-5*a[channel]!+4*c[channel]!-after[channel]!)*t
      +3*(-before[channel]!+3*a[channel]!-3*c[channel]!+after[channel]!)*t*t);
    const dx=tangent(0),dy=tangent(1),len=Math.hypot(dx,dy)||1;
    const vx = -dy / len, vy = dx / len, along = i / steps;
    const clampWidth = 1 - Math.exp(-Math.pow((along - .50) / .16, 2)) * (salt === 0 ? .30 : .12);
    const rootTaper = .28 + Math.pow(Math.sin(along * Math.PI),.7) * .75;
    const r = radius * rootTaper * clampWidth;
    const cx=curve(0,t),cy=curve(1,t),cz=Math.max(r*(s.constructionVersion===2?.78:.62),curve(2,t));
    const ring: Point[] = [];
    for (let j = 0; j < cross; j++) {
      const angle = j / cross * TAU;
      // Broad facets flatten under tension. A few joined ridges survive at the
      // ends; the intact trunk does not become a comb of equal-width noodles.
      const root = Math.pow(Math.abs(along - .5) * 2, 5);
      const flute = 1 + Math.cos(angle * 5 + salt + along * 3) * (.045 + .07 * root);
      ring.push([cx + vx * Math.cos(angle) * r * flute, cy + vy * Math.cos(angle) * r * flute,
        cz + Math.sin(angle) * r * (.57 + .19 * Math.sin(along * Math.PI))]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < cross; j++) {
    const a = rings[i]!, c = rings[i + 1]!, k = (j + 1) % cross;
    const slot = salt > 0 && i > steps * .45 && i < steps * .54 && j > 2 && j < 5 ? 3 : 0;
    b.quad(a[j]!, c[j]!, c[k]!, a[k]!, slot,
      [[i * s.length / steps, j * radius * TAU / cross], [(i + 1) * s.length / steps, j * radius * TAU / cross],
        [(i + 1) * s.length / steps, (j + 1) * radius * TAU / cross], [i * s.length / steps, (j + 1) * radius * TAU / cross]]);
    if(s.constructionVersion===2&&salt===1&&i===Math.floor(steps*.5)&&j===3){
      // Source coordinates belong to the exposed strand triangle, never the
      // empty space between its authored fork and the old knot-centre guess.
      b.joint([(a[j]![0]+c[j]![0]+c[k]![0])/3,(a[j]![1]+c[j]![1]+c[k]![1])/3,
        (a[j]![2]+c[j]![2]+c[k]![2])/3+.055]);
    }
  }
  for (const end of [0, steps]) {
    const r = rings[end]!;
    const middle: Point = [r.reduce((sum, p) => sum + p[0], 0) / cross, r.reduce((sum, p) => sum + p[1], 0) / cross,
      r.reduce((sum, p) => sum + p[2], 0) / cross];
    for (let j = 0; j < cross; j++) {
      const k = (j + 1) % cross;
      b.quad(middle, r[j]!, r[k]!, middle, end === 0 ? 1 : 2, [[0, 0], [j, radius], [j + 1, radius], [0, 0]]);
    }
  }
}

/** A broken, eccentric thick wall with separate outer slope, laminated rim,
 * inward-facing cavity wall and a real bottom. The missing wedge is actual air. */
function brokenShell(b: MeshBuilder): void {
  const s = b.spec;
  const gap = .82 + s.opening * 1.35;
  shellPetal(b, -s.length * .06, -s.width * .045, s.length * .49, s.width * .47, gap * .5, TAU - gap, 1, 0);
  // A smaller, reversed petal meets the main shell at a displaced seam. Its lip
  // opens into the first cavity; it is not a second concentric rim around it.
  shellPetal(b, s.length * .22, s.width * .16, s.length * .25, s.width * .31,
    Math.PI * 1.10, Math.PI * (1.08 + s.fold * .13), .68, 1);
  b.joint([s.length * .22, s.width * .02, s.height * .34]);
}

function shellPetal(b: MeshBuilder, ox: number, oy: number, rx: number, ry: number, begin: number, sweep: number, heightScale: number, salt: number): void {
  const s = b.spec, around = 54, radial = 16, seedPhase = phase(s.seed, 53 + salt) * TAU;
  const rings: Point[][] = [];
  for (let i = 0; i <= around; i++) {
    const angle = begin + i / around * sweep, ca = Math.cos(angle), sa = Math.sin(angle);
    const jointCompression = Math.exp(-Math.pow((i / around - .78) / .20, 2));
    const lip = 1 + .12 * s.distortion * Math.sin(angle * 2 + seedPhase) - jointCompression * .10 + .045 * Math.sin(angle * 9 + salt);
    const rimZ = s.height * heightScale * (.60 + .26 * Math.sin(angle - .5) + .12 * Math.cos(angle * 2 + seedPhase));
    const thickness = clamp(s.thickness / Math.min(rx, ry), .10, .42);
    const rimInner = .69 - thickness * .43;
    const profile: Array<readonly [number, number]> = [[1, 0], [.96, rimZ * .22], [.84 * lip, rimZ * .68],
      [.73 * lip, rimZ], [rimInner, rimZ * .94], [rimInner - .09, rimZ * .60], [.31, rimZ * .14], [.15, s.thickness * .17], [0, s.thickness * .13]];
    const ring: Point[] = [];
    for (let j = 0; j <= radial; j++) {
      const f = j / radial * (profile.length - 1), a = Math.floor(f), t = f - a;
      const p = profile[a]!, q = profile[Math.min(a + 1, profile.length - 1)]!;
      const r = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
      const inner = 1 - r;
      const flare = Math.exp(-Math.pow((angle - (begin + .32)) / .35, 2)) * s.fold;
      // The biased cavity floor turns one side into a broad near wall and the
      // opposite side into a compressed back wall. Their normals cannot agree.
      ring.push([ox + ca * rx * r + inner * rx * (.24 + s.distortion * .17) + flare * rx * .10 * r,
        oy + sa * ry * r - inner * ry * (.13 + s.distortion * .08), z * (1 - flare * .34) * (1 + .07 * Math.sin(angle * 7 + seedPhase) * r)]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < around; i++) for (let j = 0; j < radial; j++) {
    const a = rings[i]!, c = rings[i + 1]!;
    const slot = j < 6 ? 0 : j < 8 ? 1 : j < 13 ? 2 : 0;
    b.quad(a[j]!, c[j]!, c[j + 1]!, a[j + 1]!, salt === 1 && i < 4 && j >= 7 && j < 12 ? 3 : slot,
      [[i / around * sweep * (rx + ry) * .5, j / radial * s.width], [(i + 1) / around * sweep * (rx + ry) * .5, j / radial * s.width],
        [(i + 1) / around * sweep * (rx + ry) * .5, (j + 1) / radial * s.width], [i / around * sweep * (rx + ry) * .5, (j + 1) / radial * s.width]], [0, 0, 1]);
  }
  for (const end of [0, around]) {
    const ring = rings[end]!;
    for (let j = 0; j < radial; j++) {
      const a = ring[j]!, c = ring[j + 1]!;
      const sign = end === 0 ? -1 : 1, angle = begin + end / around * sweep;
      const dx = -Math.sin(angle) * s.thickness * .72 * sign, dy = Math.cos(angle) * s.thickness * .72 * sign;
      b.quad(a, c, [c[0] + dx, c[1] + dy, 0], [a[0] + dx, a[1] + dy, 0], 1,
        [[j * s.width / radial, a[2]], [(j + 1) * s.width / radial, c[2]], [(j + 1) * s.width / radial, 0], [j * s.width / radial, 0]], [0, 0, 1]);
    }
  }
}


/** A continuous compacted ridge carries unequal, interlocking aggregate lobes.
 * The granular faces are geometry, not disconnected circles or surface dots. */
function granularRidge(b: MeshBuilder): void {
  const s=b.spec, along=30, across=14, rows:Point[][]=[];
  const authored=s.constructionVersion===2;
  const clusters=Array.from({length:s.branches+3},(_,i)=>({
    x:(i+.25+phase(s.seed,910+i)*.5)/(s.branches+3),
    y:.24+phase(s.seed,950+i)*.5, span:.09+phase(s.seed,980+i)*.08,
    rise:.10+phase(s.seed,1010+i)*.20,
  }));
  for(let i=0;i<=along;i++){
    const u=i/along,taper=.25+.75*Math.pow(Math.sin(Math.PI*u),authored?.25+s.opening*.90:.48),row:Point[]=[];
    const spine=Math.sin(u*(authored?2.2+s.fold*3:4.5)+phase(s.seed,897)*2)*s.width*(authored?.025+s.distortion*.13:.11);
    for(let j=0;j<=across;j++){
      const v=j/across,edge=Math.min(u*along,(1-u)*along,v*across,(1-v)*across);
      const foot=Math.min(1,edge),peak=(authored?.28+s.fold*.30:.43)+.08*Math.sin(u*5.4);
      const side=v<peak?v/peak:(1-v)/(1-peak);
      let rise=Math.pow(Math.max(0,side),authored?.48+s.fold*1.20:.86)*(.51+.16*Math.sin(u*4+1));
      for(const c of clusters){
        const distance=Math.abs(u-c.x)/c.span+Math.abs(v-c.y)/.26;
        rise+=Math.max(0,1-distance)*c.rise*(authored?.45+s.distortion*2:1);
      }
      const z=(s.blocking===1?Math.min(8,s.height*.26)*foot:0)+s.height*rise*foot*Math.pow(Math.sin(Math.PI*u),.34);
      row.push([(u-.5)*s.length,(v-.5)*s.width*taper+spine,z]);
    }rows.push(row);
  }
  for(let i=0;i<along;i++)for(let j=0;j<across;j++){
    const cut=j===0||j===across-1||i===0||i===along-1;
    const a=rows[i]![j]!,c=rows[i+1]![j]!,d=rows[i+1]![j+1]!,e=rows[i]![j+1]!;
    b.quad(a,c,d,e,cut?1:j>8?2:0,[[i*s.length/along,j*s.width/across],[(i+1)*s.length/along,j*s.width/across],
      [(i+1)*s.length/along,(j+1)*s.width/across],[i*s.length/along,(j+1)*s.width/across]],[0,0,1],
      cut?NATIVE_VOLUME_REGIONS.fractured:j<6?NATIVE_VOLUME_REGIONS.compressed:NATIVE_VOLUME_REGIONS.intact);
  }
  surfaceFracture(b,rows,[[10.1,5.9],[11.8,6.1],[12.5,5.6],[14.2,5.8],[15.1,6.4],[17.4,6.2]],.085);
}

/** An eccentric torn sheet between thickened edges. The centre is a shallow
 * tension membrane, not the deep opaque cavity of the approved shell family. */
function membraneRim(b: MeshBuilder): void {
  const s=b.spec,around=46,radial=12,rows:Point[][]=[];
  const begin=.20+s.opening*.3,sweep=TAU-(1.35+s.opening*1.15),offset=phase(s.seed,1131)*1.4;
  for(let i=0;i<=around;i++){
    const angle=begin+i/around*sweep,ca=Math.cos(angle),sa=Math.sin(angle);
    const uneven=1+.13*Math.sin(angle*3+offset)+.06*Math.cos(angle*5-.3);
    const crown=s.height*(.64+.24*Math.sin(angle+.8)+.09*Math.cos(angle*2+offset));
    const profile:readonly (readonly [number,number])[]=[
      [1,0],[.955,s.blocking===1?Math.min(crown*.35,9):crown*.05],
      [.875,crown*.82],[.78,crown],[.69,crown*.62],[.54,crown*.15],[0,crown*.075],
    ];
    const row:Point[]=[];
    for(let j=0;j<=radial;j++){
      const q=j/radial*(profile.length-1),n=Math.floor(q),f=q-n;
      const p=profile[n]!,next=profile[Math.min(n+1,profile.length-1)]!;
      const r=p[0]+(next[0]-p[0])*f,z=p[1]+(next[1]-p[1])*f;
      // The sheet is pulled toward an off-centre attachment. Fine tension
      // ridges remain on the inner material; silhouette stays one solid edge.
      const tension=j>8?Math.sin(angle*11+r*5)*s.thickness*.12*r:0;
      row.push([ca*s.length*.50*r*uneven+(1-r)*s.length*.10,sa*s.width*.49*r*uneven-(1-r)*s.width*.17,z+tension]);
    }rows.push(row);
  }
  for(let i=0;i<around;i++)for(let j=0;j<radial;j++){
    const a=rows[i]!,c=rows[i+1]!;
    const slot=j<2?1:j<8?0:2;
    b.quad(a[j]!,c[j]!,c[j+1]!,a[j+1]!,slot,[[i*s.length/around,j*s.width/radial],[(i+1)*s.length/around,j*s.width/radial],
      [(i+1)*s.length/around,(j+1)*s.width/radial],[i*s.length/around,(j+1)*s.width/radial]],[0,0,1],
      j>7?NATIVE_VOLUME_REGIONS.tension:NATIVE_VOLUME_REGIONS.intact);
  }
  surfaceFracture(b,rows,[[12.2,2.8],[13.5,3.3],[13.2,4.4],[14.1,5.0],[13.7,6.3],[14.6,7.6],[14.4,8.7]],.095);
  // Ragged open ends have real section surfaces. No dark painted border or
  // transparent sprite extends beyond the body footprint.
  for(const i of [0,around])for(let j=0;j<radial;j++){
    const a=rows[i]![j]!,c=rows[i]![j+1]!,angle=begin+i/around*sweep,sign=i===0?-1:1;
    const dx=-Math.sin(angle)*s.thickness*.30*sign,dy=Math.cos(angle)*s.thickness*.30*sign;
    b.quad(a,c,[c[0]+dx,c[1]+dy,0],[a[0]+dx,a[1]+dy,0],1,
      [[j*s.width/radial,a[2]],[(j+1)*s.width/radial,c[2]],[(j+1)*s.width/radial,0],[j*s.width/radial,0]],[0,0,1],NATIVE_VOLUME_REGIONS.fractured);
  }
}

/** A viscous front has a thick, lobed advancing edge and a broad flattened
 * wake. Its height and footprint stay fixed; reflected light supplies motion. */
function gelFlow(b: MeshBuilder): void {
  const s=b.spec,along=32,across=20,rows:Point[][]=[];
  const profile:readonly (readonly [number,number])[]=[[0,0],[.08,.11],[.33,.19],[.58,.38],[.78,.78],[.88,1],[.95,.52],[1,0]];
  for(let i=0;i<=along;i++){
    const u=i/along,side=Math.pow(Math.sin(Math.PI*u),.35),lobes=.12*Math.sin(u*13+phase(s.seed,1207)*2)+.055*Math.sin(u*27+.5);
    const row:Point[]=[];
    for(let j=0;j<=across;j++){
      const v=j/across;let p=0;while(p+1<profile.length&&profile[p+1]![0]<v)p++;
      const a=profile[p]!,c=profile[Math.min(p+1,profile.length-1)]!,f=(v-a[0])/Math.max(.001,c[0]-a[0]);
      const ridge=a[1]+(c[1]-a[1])*f,edge=Math.min(u*along,(1-u)*along,v*across,(1-v)*across);
      const foot=s.blocking===1?Math.min(s.height*.22,7)*Math.min(1,edge):0;
      row.push([(u-.5)*s.length+(v-.5)*s.length*.08,(v-.5)*s.width*(.30+side*.70)+Math.pow(v,3)*lobes*s.width,
        foot+ridge*s.height*side*(.75+.19*Math.sin(u*8+.2))]);
    }rows.push(row);
  }
  for(let i=0;i<along;i++)for(let j=0;j<across;j++){
    const front=j>=18,thin=j<=6;
    const a=rows[i]![j]!,c=rows[i+1]![j]!,d=rows[i+1]![j+1]!,e=rows[i]![j+1]!;
    b.quad(a,c,d,e,front?1:thin?2:0,[[i*s.length/along,j*s.width/across],[(i+1)*s.length/along,j*s.width/across],
      [(i+1)*s.length/along,(j+1)*s.width/across],[i*s.length/along,(j+1)*s.width/across]],[0,0,1],
      thin?NATIVE_VOLUME_REGIONS.peeled:front?NATIVE_VOLUME_REGIONS.compressed:NATIVE_VOLUME_REGIONS.glazed);
  }
  surfaceFracture(b,rows,[[10.2,17.4],[11.5,17.1],[12.1,17.7],[13.8,17.8],[14.4,18.3],[16.5,18.1]],.09);
}

/** Two broad beds are displaced across a through-going shear lane. The lane
 * is omitted from the mesh, so rendering, movement and attacks share its air. */
function shearedBeds(b: MeshBuilder): void {
  const s=b.spec,l=s.length,w=s.width,h=s.height;
  const gap=Math.min(w*.40,Math.max(30,w*(.12+s.opening*.15)));
  const shear=l*(.025+s.distortion*.10),skew=(phase(s.seed,1301)-.5)*w*.05;
  const upper:Point[]=[[-l*.5,-w*.27,0],[-l*.36,-w*.50,0],[l*.36-shear,-w*.44,0],
    [l*.50-shear,-gap*.56+skew,0],[l*.12-shear,-gap*.5+skew,0],[-l*.42,-gap*.60,0]];
  const lower:Point[]=[[-l*.43+shear,gap*.62,0],[-l*.04+shear,gap*.5+skew,0],[l*.48,gap*.60,0],
    [l*.44,w*.43,0],[l*.16,w*.5,0],[-l*.5+shear,w*.36,0]];
  const incline=(outline:Point[],peak:number,dx:number,dy:number):Point=>{
    let min=Infinity,max=-Infinity;
    for(const p of outline){const q=p[0]*dx+p[1]*dy;min=Math.min(min,q);max=Math.max(max,q);}
    let x=0,y=0;
    for(let i=0;i<outline.length;i++){
      const p=outline[i]!;x+=p[0];y+=p[1];outline[i]=[p[0],p[1],(p[0]*dx+p[1]*dy-min)/(max-min)*peak];
    }
    x/=outline.length;y/=outline.length;
    return [x,y,(x*dx+y*dy-min)/(max-min)*peak];
  };
  // The two large planes tilt in opposition; the low front remains a section,
  // not a surface which invites walking onto an invisible blocking footprint.
  bedMass(b,upper,incline(upper,h,.12,-1),0,[3,4],Math.min(6,w*.024));
  bedMass(b,lower,incline(lower,h*(.32+s.fold*.50),-.10,1),1,[0,1],Math.min(5,w*.022));
  if(s.branches>=5){
    const toe:Point[]=[[-l*.42,w*.39,0],[-l*.14,w*.42,0],[-l*.05,w*.57,0],[-l*.36,w*.59,0]];
    bedMass(b,toe,incline(toe,h*.17,.2,-1),2,[0,1],Math.min(8,w*.03));
  }
}

/** A pulled mother strand and authored fork count replace the same three-way
 * knot everywhere. Branches rejoin the load-bearing axis; gaps remain ground. */
function tensileBranches(b:MeshBuilder):void {
  const s=b.spec,l=s.length,w=s.width,h=s.height;
  const pull=s.fold,joinX=l*(-.18+.18*s.opening),joinY=w*(phase(s.seed,1321)-.5)*.10;
  const radius=Math.max(s.thickness*.65,w*(.068+.028*(1-pull)));
  const main:Point[]=[[-l*.52,-w*.08,s.thickness*.65],[-l*.28,-w*.04,h*.43],
    [joinX,joinY,h*.72],[l*.25,w*(.03+.10*s.distortion),h*.48],[l*.52,w*.14,s.thickness*.72]];
  sweptBundle(b,main,radius,0);
  for(let arm=1;arm<s.branches;arm++){
    const side=arm%2===1?-1:1,rank=Math.floor((arm-1)/2),spread=.27+rank*.12;
    const attachX=joinX+l*(rank*.07-.025),attachY=joinY+w*rank*.018;
    const endX=l*(.46-rank*.11)*(arm%3===0?-1:1);
    const endY=side*w*Math.min(.50,spread+s.opening*.18);
    const branch:Point[]=[[attachX-l*.10,attachY,h*.55],[attachX,attachY,h*(.74-rank*.06)],
      [attachX+(endX-attachX)*.55,endY*(.37+.30*(1-pull)),h*(.40-rank*.03)],
      [endX,endY,s.thickness*(.46+.06*rank)]];
    sweptBundle(b,branch,radius*(.70-rank*.085),arm);
  }
}

/** An exposed horseshoe wall has an actual floor opening. Radial sections stop
 * at the inner foot instead of triangulating across the cavity. */
function openShellWall(b:MeshBuilder):void {
  const s=b.spec,around=56,radial=8,rows:Point[][]=[];
  const gap=.76+s.opening*2.40,begin=gap*.5,sweep=TAU-gap;
  const inner=.43+s.opening*.19,phaseOffset=phase(s.seed,1351)*TAU;
  for(let i=0;i<=around;i++){
    const u=i/around,angle=begin+u*sweep,ca=Math.cos(angle),sa=Math.sin(angle);
    const uneven=1+s.distortion*(.075*Math.sin(angle*2+phaseOffset)+.035*Math.sin(angle*5));
    const crown=s.height*(.66+.23*Math.sin(angle+.7)+.09*Math.cos(angle*2+phaseOffset));
    const foot=s.blocking===1?Math.min(9,s.height*.3):s.height*.05;
    const lip=.82-s.fold*.07;
    const profile:readonly (readonly[number,number])[]=[[1,0],[.97,foot],[.91,crown*.58],[lip,crown],
      [lip-.045,crown*.97],[inner+.075,crown*.72],[inner+.025,foot],[inner,0],[inner,0]];
    rows.push(profile.map(([r,z])=>[ca*s.length*.5*r*uneven+(1-r)*s.length*s.distortion*.07,
      sa*s.width*.5*r*uneven,z] as Point));
  }
  for(let i=0;i<around;i++)for(let j=0;j<radial;j++){
    const a=rows[i]!,c=rows[i+1]!,joint=i===Math.floor(around*.69)&&j===4;
    const slot=joint?3:j<3?0:j<5?1:2;
    b.quad(a[j]!,c[j]!,c[j+1]!,a[j+1]!,slot,[[i*s.length/around,j*s.width/radial],[(i+1)*s.length/around,j*s.width/radial],
      [(i+1)*s.length/around,(j+1)*s.width/radial],[i*s.length/around,(j+1)*s.width/radial]],[0,0,1],j<3?NATIVE_VOLUME_REGIONS.intact:j<5?NATIVE_VOLUME_REGIONS.fractured:NATIVE_VOLUME_REGIONS.glazed);
    if(joint)b.joint([(a[j]![0]+c[j+1]![0])*.5,(a[j]![1]+c[j+1]![1])*.5,(a[j]![2]+c[j+1]![2])*.5]);
  }
  // Open end faces terminate each wall in a thick visible section. They never
  // fan toward the cavity centre, which would create an invisible blocking lid.
  for(const end of [0,around]){
    const row=rows[end]!,angle=begin+end/around*sweep,sign=end===0?-1:1;
    for(let j=0;j<radial-1;j++){
      const a=row[j]!,c=row[j+1]!,dx=-Math.sin(angle)*s.thickness*.40*sign,dy=Math.cos(angle)*s.thickness*.40*sign;
      b.quad(a,c,[c[0]+dx,c[1]+dy,0],[a[0]+dx,a[1]+dy,0],1,
        [[j*s.width/radial,a[2]],[(j+1)*s.width/radial,c[2]],[(j+1)*s.width/radial,0],[j*s.width/radial,0]],[0,0,1],NATIVE_VOLUME_REGIONS.fractured);
    }
  }
}

/** A stretched sheet curls along its back and tears inward from the free edge.
 * The V-shaped missing strips are real negative space, not dark paint on a bowl. */
function tornMembrane(b:MeshBuilder):void {
  const s=b.spec,along=36,across=12,rows:Point[][]=[];
  const tearAt=.36+phase(s.seed,1381)*.17,tearDepth=.30+s.opening*.58;
  for(let i=0;i<=along;i++){
    const u=i/along,edgeTaper=.63+.37*Math.sin(Math.PI*u),row:Point[]=[];
    const tear=tearDepth*Math.pow(Math.max(0,1-Math.abs(u-tearAt)/(.11+s.distortion*.045)),.72);
    const second=s.branches>=5?tearDepth*.68*Math.pow(Math.max(0,1-Math.abs(u-.79)/.08),.8):0;
    const front=1-Math.max(tear,second);
    for(let j=0;j<=across;j++){
      const v=j/across,local=v*front;
      const taut=Math.pow(Math.sin(Math.PI*u),.45),curl=Math.exp(-Math.pow((local-(.16+s.fold*.09))/.18,2));
      const fold=Math.pow(Math.max(0,Math.sin(u*Math.PI*(s.branches-1)+local*2)),3)*s.distortion*.15;
      const foot=s.blocking===1?Math.min(8,s.height*.30):0;
      const z=foot+s.height*taut*(curl*(.50+s.fold*.30)+.075+fold)*(.55+.45*Math.sin(Math.PI*v));
      row.push([(u-.5)*s.length,(local-.5)*s.width*edgeTaper,z]);
    }rows.push(row);
  }
  for(let i=0;i<along;i++)for(let j=0;j<across;j++){
    const a=rows[i]!,c=rows[i+1]!,slot=j<3?0:j>9?1:2;
    b.quad(a[j]!,c[j]!,c[j+1]!,a[j+1]!,slot,[[i*s.length/along,j*s.width/across],[(i+1)*s.length/along,j*s.width/across],
      [(i+1)*s.length/along,(j+1)*s.width/across],[i*s.length/along,(j+1)*s.width/across]],[0,0,1],j<3?NATIVE_VOLUME_REGIONS.compressed:NATIVE_VOLUME_REGIONS.tension);
  }
  // Give the entire torn boundary actual 3–6px section width in the XY view.
  const outline:Point[]=[];
  for(let i=0;i<=along;i++)outline.push(rows[i]![0]!);
  for(let j=1;j<=across;j++)outline.push(rows[along]![j]!);
  for(let i=along-1;i>=0;i--)outline.push(rows[i]![across]!);
  for(let j=across-1;j>0;j--)outline.push(rows[0]![j]!);
  for(let i=0;i<outline.length;i++){
    const a=outline[i]!,c=outline[(i+1)%outline.length]!,dx=c[0]-a[0],dy=c[1]-a[1],length=Math.hypot(dx,dy)||1;
    const width=s.blocking===1?Math.min(6,s.thickness*.55):1.5,ox=dy/length*width,oy=-dx/length*width;
    b.quad(a,[a[0]+ox,a[1]+oy,0],[c[0]+ox,c[1]+oy,0],c,1,[[0,a[2]],[0,0],[length,0],[length,c[2]]],[0,0,1],NATIVE_VOLUME_REGIONS.fractured);
  }
  surfaceFracture(b,rows,[[8.2,3.4],[9.7,4.0],[10.3,4.5],[11.8,4.8],[12.3,5.4]],.085);
}

/** A broad low pool piles into unequal rounded fronts. Fold is accumulation;
 * opening releases a longer shallow wake. The perimeter remains a physical lip. */
function pooledGel(b:MeshBuilder):void {
  const s=b.spec,along=38,across=22,rows:Point[][]=[];
  const lobeCount=Math.max(2,s.branches-1),offset=phase(s.seed,1411)*1.7;
  for(let i=0;i<=along;i++){
    const u=i/along,side=Math.pow(Math.sin(Math.PI*u),.28),row:Point[]=[];
    const lobes=Math.pow(.5+.5*Math.sin(u*Math.PI*2*lobeCount+offset),2);
    const irregular=.045*Math.sin(u*19+offset);
    for(let j=0;j<=across;j++){
      const v=j/across,edge=Math.min(u*along,(1-u)*along,v*across,(1-v)*across);
      const frontAt=.74+s.opening*.13,front=Math.exp(-Math.pow((v-frontAt)/(.09+s.fold*.09),2));
      const pool=.065+Math.sin(Math.PI*v)*(.09+s.opening*.04);
      const ridge=front*(.42+s.fold*.39)*(.60+.40*lobes);
      const foot=s.blocking===1?Math.min(8,s.height*.28)*Math.min(1,edge):0;
      row.push([(u-.5)*s.length+(v-.5)*s.length*s.distortion*.10,
        (v-.5)*s.width*(.50+side*.50)+Math.pow(v,4)*s.width*(lobes*(.09+s.distortion*.12)+irregular),
        foot+(pool+ridge)*s.height*side*Math.min(1,edge)]);
    }rows.push(row);
  }
  for(let i=0;i<along;i++)for(let j=0;j<across;j++){
    const a=rows[i]!,c=rows[i+1]!,front=j>=across-2,thin=j<across*.48;
    b.quad(a[j]!,c[j]!,c[j+1]!,a[j+1]!,front?1:thin?2:0,[[i*s.length/along,j*s.width/across],[(i+1)*s.length/along,j*s.width/across],
      [(i+1)*s.length/along,(j+1)*s.width/across],[i*s.length/along,(j+1)*s.width/across]],[0,0,1],
      front?NATIVE_VOLUME_REGIONS.compressed:thin?NATIVE_VOLUME_REGIONS.peeled:NATIVE_VOLUME_REGIONS.glazed);
  }
  surfaceFracture(b,rows,[[12.1,17.4],[13.2,17.8],[14.1,17.7],[15.2,18.1],[16.4,18.0]],.09);
}

/** A fracture follows a material failure across the actual triangular skin;
 * never make entire regular tessellation cells luminous. All ribbon corners
 * sample the same plane as the opaque construction below them. */
function surfaceFracture(b:MeshBuilder,rows:readonly (readonly Point[])[],path:readonly (readonly[number,number])[],halfWidth:number):void {
  const sample=(u:number,v:number):Point=>{
    const i=clamp(Math.floor(u),0,rows.length-2),j=clamp(Math.floor(v),0,rows[0]!.length-2),a=u-i,t=v-j;
    const p=rows[i]![j]!,q=rows[i+1]![j]!,r=rows[i+1]![j+1]!,s=rows[i]![j+1]!;
    const weights=t<=a?[1-a,a-t,t,0]:[1-t,0,a,t-a];
    return [p[0]*weights[0]!+q[0]*weights[1]!+r[0]*weights[2]!+s[0]*weights[3]!,
      p[1]*weights[0]!+q[1]*weights[1]!+r[1]*weights[2]!+s[1]*weights[3]!,
      p[2]*weights[0]!+q[2]*weights[1]!+r[2]*weights[2]!+s[2]*weights[3]!+.12];
  };
  for(let i=1;i<path.length;i++){
    const a=path[i-1]!,c=path[i]!,dx=c[0]-a[0],dy=c[1]-a[1],length=Math.hypot(dx,dy),px=-dy/length*halfWidth,py=dx/length*halfWidth;
    const uv:readonly[UV,UV,UV,UV]=[[a[0]+px,a[1]+py],[c[0]+px,c[1]+py],[c[0]-px,c[1]-py],[a[0]-px,a[1]-py]];
    b.quad(sample(...uv[0]),sample(...uv[1]),sample(...uv[2]),sample(...uv[3]),3,uv,[0,0,1],NATIVE_VOLUME_REGIONS.fractured);
  }
  const centre=path[Math.floor(path.length/2)]!;b.joint(sample(...centre));
}

export function buildNativeVolume(spec: Readonly<NativeVolumeSpec>, ground?: NativeGroundEdgeContext): NativeVolumeMesh {
  validateNativeVolumeSpec(spec);
  if (spec.groundEdgeWidth !== undefined && !ground) throw new Error('Native ground edge is missing its authoritative terrain context');
  const builder = new MeshBuilder(spec);
  if (spec.constructionVersion === 4) buildGroundNativeVolume(builder);
  else if (spec.constructionVersion === 3) buildExpandedNativeVolume(builder);
  else if (spec.constructionVersion === 2) {
    if (spec.family === 'folded-slab') shearedBeds(builder);
    else if (spec.family === 'fibre-knot') tensileBranches(builder);
    else if (spec.family === 'broken-shell') openShellWall(builder);
    else if (spec.family === 'membrane-rim') tornMembrane(builder);
    else if (spec.family === 'gel-flow') pooledGel(builder);
    else granularRidge(builder);
  }
  else if (spec.family === 'folded-slab') foldedSlab(builder);
  else if (spec.family === 'fibre-knot') fibreKnot(builder);
  else if (spec.family === 'broken-shell') brokenShell(builder);
  else if (spec.family === 'granular-ridge') granularRidge(builder);
  else if (spec.family === 'membrane-rim') membraneRim(builder);
  else gelFlow(builder);
  if (spec.groundEdgeWidth !== undefined) appendNativeGroundEdges(builder, ground!);
  const mesh = builder.finish();
  if (spec.constructionVersion === 4 && (spec.shapeProfile === 'compressed-wedge' || spec.shapeProfile === 'porous-break'))
    return smoothOrganizedSurface(mesh);
  return mesh;
}
