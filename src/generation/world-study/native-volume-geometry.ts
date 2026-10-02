/** Editable material constructions in Rift's existing XY plane. Z is real height;
 * it never changes the ground projection, character scale, or walkable floor. */
export type NativeVolumeFamily = 'folded-slab' | 'fibre-knot' | 'broken-shell';
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

function validateSpec(spec: Readonly<NativeVolumeSpec>): void {
  for (const [key, value] of Object.entries(spec)) {
    if (key !== 'family' && (typeof value !== 'number' || !Number.isFinite(value))) {
      throw new Error(`Native volume ${key} must be finite`);
    }
  }
  if (!['folded-slab', 'fibre-knot', 'broken-shell'].includes(spec.family)) throw new Error('Unknown native volume family');
  if (!Number.isInteger(spec.id) || spec.id < 1 || spec.id > 0x7fffffff) throw new Error('Volume id must be a positive Int32');
  if (!Number.isInteger(spec.seed)) throw new Error('Volume seed must be an integer');
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
      const lip=lerp(at,centre,Math.min(.26,inset/radius));
      const burial=clamp(at[2]/Math.max(3,s.height*.16),0,1);
      const spread=cutWidth*burial*(fault?.13+mouth*1.8:.26);
      const foot:Point=[at[0]+nx*spread,at[1]+ny*spread,0];
      const shoulder=lerp(lip,centre,Math.min(.34,(5+cutWidth*.7)*mouth/radius));
      rim.push({top:lip,foot,shoulder,mouth,distance:distance+edgeLength*t,fault});
    }
    distance+=edgeLength;
  }
  let contactPlaced=false;
  for(let i=0;i<rim.length;i++){
    const next=(i+1)%rim.length,a=rim[i]!,c=rim[next]!;
    const region=salt===2?NATIVE_VOLUME_REGIONS.compressed:NATIVE_VOLUME_REGIONS.intact;
    const topUv=(p:Point):UV=>[p[0],p[1]];
    b.quad(centre,a.shoulder,c.shoulder,centre,0,
      [topUv(centre),topUv(a.shoulder),topUv(c.shoulder),topUv(centre)],[0,0,1],region);
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
    const cx=curve(0,t),cy=curve(1,t),cz=Math.max(r*.62,curve(2,t));
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

export function buildNativeVolume(spec: Readonly<NativeVolumeSpec>): NativeVolumeMesh {
  validateSpec(spec);
  const builder = new MeshBuilder(spec);
  if (spec.family === 'folded-slab') foldedSlab(builder);
  else if (spec.family === 'fibre-knot') fibreKnot(builder);
  else brokenShell(builder);
  return builder.finish();
}
