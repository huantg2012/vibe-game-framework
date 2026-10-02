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
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const size = Math.hypot(nx, ny, nz);
    if (size < 1e-6) return;
    nx /= size; ny /= size; nz /= size;
    if (wanted && nx * wanted[0] + ny * wanted[1] + nz * wanted[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const normal: Point = [nx, ny, nz];
    const ia = this.vertex(a, uvs[0], normal), ib = this.vertex(b, uvs[1], normal);
    const ic = this.vertex(c, uvs[2], normal), id = this.vertex(d, uvs[3], normal);
    this.triangles.push(ia, ib, ic, ia, ic, id); this.slots.push(material, material); this.regions.push(region, region);
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

/** The primary form is a ground-connected pressure mass, not an extruded ribbon.
 * Its near cross-section has real XY width: foot -> broken face -> shoulder.
 * Higher variants raise the far back only, preserving a lit near section below
 * shoulder-lamp height. One local reverse fault cuts across the original beds. */
function foldedSlab(b: MeshBuilder): void {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const seedShift = (phase(s.seed, 101) - .5) * .075;
  const faultX = l * (.035 + seedShift);
  const faultLean = .24 + phase(s.seed, 103) * .18;
  const faceWidth = clamp(s.thickness * 1.6, Math.min(12, w * .20), Math.min(24, w * .24));
  const footY = w * .5;
  const shoulderY = footY - faceWidth - Math.min(clamp(s.thickness * .5, 5, 9), w * .07);
  const frontHeight = Math.min(23, h * .65);
  const crestY = -w * (.18 + seedShift);
  const stations = [-w * .53, -w * .46, -w * .34, crestY, -w * .04,
    shoulderY - faceWidth * .34, shoulderY, shoulderY + faceWidth * .40,
    shoulderY + faceWidth * .79, footY - Math.min(4, w * .033), footY];
  const steps = Math.max(28, Math.ceil(l / 5));
  const rows: Point[][] = [], depressions: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = (t - .5) * l;
    const endRamp = Math.min(1, t / .08, (1 - t) / .10);
    // One broad bulge toward the compression outlet, not uniformly nibbled edges.
    const pressure = Math.exp(-Math.pow((x - faultX) / (l * .20), 2));
    const sideBend = Math.sin(t * Math.PI) * w * seedShift;
    const backHeight = h * (.89 + .11 * Math.sin(t * Math.PI));
    const profileHeight = [0, Math.min(5, h * .1), backHeight * .73, backHeight,
      Math.max(frontHeight + 2, backHeight * .85), Math.min(h * .86, frontHeight + 5),
      frontHeight, frontHeight * .67, frontHeight * .32, 2.2, 0];
    const row: Point[] = [], depression: number[] = [];
    for (let j = 0; j < stations.length; j++) {
      let y = stations[j]! + sideBend;
      // Adjacent beds terminate against an offset fault. The two sides cannot
      // be read as a single smooth slope or an evenly stepped manufactured box.
      const faultDistance = x - faultX - y * faultLean;
      const mouthWidth = faceWidth * (.68 + Math.max(0, y / w) * .60);
      const inFault = y > -w * .21 && y < shoulderY + faceWidth * .87;
      const groove = inFault ? Math.max(0, 1 - Math.abs(faultDistance) / mouthWidth) : 0;
      const faultFloor = Math.min(4.5, frontHeight * .2);
      let z = profileHeight[j]!;
      const dent = Math.max(0, z - faultFloor) * groove;
      z -= dent;
      // Quiet bed tops are broad. Local compression puts actual broken facets
      // into the face; their pixels, shading and shadows share these vertices.
      if (j >= 6 && j <= 8 && groove < .25) {
        const fracture = (Math.sin(t * 18 + phase(s.seed, 107) * 2) + Math.sin(t * 7 + .3)) * .75;
        z += fracture * pressure * s.distortion;
        y += Math.sin(t * 11 + j * .8) * pressure * 1.7 * s.distortion;
      }
      row.push([x, y, Math.max(0, z * endRamp)]); depression.push(dent);
    }
    rows.push(row); depressions.push(depression);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < stations.length - 1; j++) {
    const a = rows[i]!, c = rows[i + 1]!;
    const depth = (depressions[i]![j]! + depressions[i + 1]![j]! + depressions[i]![j + 1]! + depressions[i + 1]![j + 1]!) * .25;
    const isSection = j >= 6 || j === 1, fault = depth > 2;
    const cellX = ((i + .5) / steps - .5) * l;
    const pressure = Math.abs(cellX - faultX) < l * .14;
    let material = isSection ? 1 : 0;
    let region: number = isSection ? NATIVE_VOLUME_REGIONS.fractured : pressure ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.intact;
    if (fault) { material = 2; region = NATIVE_VOLUME_REGIONS.peeled; }
    if (fault && j === 6 && Math.abs(cellX - faultX - stations[j]! * faultLean) < faceWidth * .45) material = 3;
    // On cuts V is true elevation: bedding ends follow height and terminate at
    // the fault instead of drawing parallel outlines around every broad face.
    const tex = isSection || fault ? [[i * l / steps, a[j]![2]], [(i + 1) * l / steps, c[j]![2]],
      [(i + 1) * l / steps, c[j + 1]![2]], [i * l / steps, a[j + 1]![2]]] as const
      : [[i * l / steps, stations[j]! + w * .53], [(i + 1) * l / steps, stations[j]! + w * .53],
        [(i + 1) * l / steps, stations[j + 1]! + w * .53], [i * l / steps, stations[j + 1]! + w * .53]] as const;
    b.quad(a[j]!, c[j]!, c[j + 1]!, a[j + 1]!, material, tex, [0, 0, 1], region);
    // Closed underside at the ground. It is never used as a coloured black hole.
    b.quad([a[j]![0], a[j]![1], 0], [a[j + 1]![0], a[j + 1]![1], 0],
      [c[j + 1]![0], c[j + 1]![1], 0], [c[j]![0], c[j]![1], 0], 2, tex, [0, 0, -1]);
  }
  const reverseReach = w * (.27 + s.fold * .13);
  const wedgeY = shoulderY + faceWidth * .47;
  pressureWedge(b, [[faultX - faceWidth * .70, wedgeY, frontHeight * .70],
    [faultX + faceWidth * .05, wedgeY - 5, frontHeight * .90],
    [faultX - faceWidth * .38, wedgeY + reverseReach, 3.5],
    [faultX - faceWidth * 1.20, wedgeY + reverseReach * .73, 5.8]], faceWidth * .48);
  pressureWedge(b, [[faultX + faceWidth * .17, wedgeY, frontHeight * .75],
    [faultX + faceWidth * .95, wedgeY + 1, frontHeight * .58],
    [faultX + faceWidth * 1.50, wedgeY + reverseReach * .66, 3.5],
    [faultX + faceWidth * .45, wedgeY + reverseReach * .83, 5.8]], faceWidth * .42);
  b.joint([faultX + stations[6]! * faultLean, stations[6]!, 5.5]);
}

/** Ejected fragments remain rooted in the common pressure outlet. Full-section
 * inclined cuts surround the top; no lamination strips are used for thickness. */
function pressureWedge(b: MeshBuilder, top: readonly [Point, Point, Point, Point], bevel: number): void {
  const cx = top.reduce((sum, p) => sum + p[0], 0) / 4, cy = top.reduce((sum, p) => sum + p[1], 0) / 4;
  const foot: Point[] = top.map(p => {
    const dx = p[0] - cx, dy = p[1] - cy, length = Math.hypot(dx, dy) || 1;
    return [p[0] + dx / length * bevel, p[1] + dy / length * bevel, 0] as Point;
  });
  b.quad(top[0], top[1], top[2], top[3], 0, [[0, 0], [18, 0], [18, 26], [0, 26]], [0, 0, 1], NATIVE_VOLUME_REGIONS.compressed);
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    b.quad(top[i]!, foot[i]!, foot[next]!, top[next]!, 1,
      [[i * 12, top[i]![2]], [i * 12, 0], [(i + 1) * 12, 0], [(i + 1) * 12, top[next]![2]]], [0, 0, 1], NATIVE_VOLUME_REGIONS.fractured);
  }
  b.quad(foot[0]!, foot[3]!, foot[2]!, foot[1]!, 2, [[0, 0], [0, 26], [18, 26], [18, 0]], [0, 0, -1]);
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
    const smooth = t * t * (3 - 2 * t), dx = c[0] - a[0], dy = c[1] - a[1], len = Math.hypot(dx, dy);
    const vx = -dy / len, vy = dx / len, along = i / steps;
    const clampWidth = 1 - Math.exp(-Math.pow((along - .50) / .16, 2)) * (salt === 0 ? .30 : .12);
    const rootTaper = .68 + Math.sin(along * Math.PI) * .34;
    const r = radius * rootTaper * clampWidth;
    const cx = a[0] + dx * smooth, cy = a[1] + dy * smooth, cz = Math.max(r * .62, a[2] + (c[2] - a[2]) * smooth);
    const ring: Point[] = [];
    for (let j = 0; j < cross; j++) {
      const angle = j / cross * TAU;
      // Broad facets flatten under tension. A few joined ridges survive at the
      // ends; the intact trunk does not become a comb of equal-width noodles.
      const root = Math.pow(Math.abs(along - .5) * 2, 5);
      const flute = 1 + Math.cos(angle * 5 + salt) * .09 * root;
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
    const lip = 1 + .09 * s.distortion * Math.sin(angle * 2 + seedPhase) - jointCompression * .10;
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
        oy + sa * ry * r - inner * ry * (.13 + s.distortion * .08), z * (1 - flare * .34)]);
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
