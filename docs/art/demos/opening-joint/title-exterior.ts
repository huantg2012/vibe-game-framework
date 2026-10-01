/** F title exterior in artwork coordinates. Authored depth windows protect the
 * heavy architecture; transported density, not a camera pan, supplies motion. */
const W = 960, H = 640;
type P = readonly [number, number];
type Poly = readonly P[];
const clamp = (v: number): number => Math.max(0, Math.min(1, v));
const smooth = (v: number): number => { const s = clamp(v); return s * s * (3 - 2 * s); };
const fract = (v: number): number => v - Math.floor(v);
const random = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
function inside(x: number, y: number, p: Poly): boolean {
  let hit = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i]!, b = p[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
function edgeDistance(x: number, y: number, p: Poly): number {
  let d = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const u = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy));
    d = Math.min(d, Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy));
  }
  return d;
}
// These are spaces BETWEEN structures, not rectangular glow decals. Their
// depth ordering is authored against F; source luminance only softens density.
const WINDOWS: readonly { depth: number; shape: Poly }[] = [
  { depth: 3, shape: [[691,0],[899,0],[894,132],[872,164],[879,200],[811,247],[763,257],[713,259],[677,223],[679,97]] },
  { depth: 2, shape: [[490,51],[609,70],[606,196],[621,207],[617,240],[646,270],[620,309],[545,336],[506,367],[487,358],[487,293],[461,269]] },
  { depth: 1, shape: [[469,407],[502,400],[526,415],[550,457],[611,489],[626,640],[423,640],[429,568],[454,535],[461,474]] },
];
const OCCLUDERS: readonly Poly[] = [
  [[535,49],[557,55],[539,221],[527,214]],
  [[466,189],[571,232],[574,251],[555,266],[464,221]],
  [[477,270],[535,301],[536,326],[516,313],[476,294]],
  [[604,0],[691,0],[679,223],[690,245],[678,283],[643,289],[610,235],[606,199]],
  [[794,118],[879,144],[900,135],[902,154],[877,172],[795,139]],
  [[737,154],[859,190],[860,209],[753,179],[752,241],[734,259],[734,174]],
  [[747,242],[816,222],[836,258],[791,297],[718,280]],
  // The core's upper metal arch protrudes above the platform silhouette.
  [[804,194],[834,201],[846,234],[816,246],[792,225]],
  [[459,478],[481,477],[503,640],[472,640]],
  [[360,578],[529,500],[540,509],[539,527],[365,606]],
];
const STAIN_AREAS: readonly Poly[] = [
  [[375,266],[421,271],[434,325],[487,363],[507,402],[473,408],[407,341],[370,308]],
  [[453,193],[575,233],[575,290],[519,267],[493,235],[453,220]],
  [[608,204],[696,241],[695,277],[645,265]],
  [[730,151],[857,183],[857,213],[755,185],[752,244],[731,256]],
  [[363,459],[407,481],[437,524],[436,554],[411,534],[380,502],[362,490]],
];
interface AirPixel { x: number; y: number; index: number; weight: number; depth: number; }
interface StainPixel { x: number; y: number; index: number; weight: number; }

export class JointTitleExterior {
  readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly frame: ImageData;
  private readonly noise = new Float32Array(128 * 128);
  private readonly air: AirPixel[] = [];
  private readonly stains: StainPixel[] = [];
  private readonly visibility = new Float32Array(W * H);
  private disposed = false;

  constructor(private readonly source: Uint8ClampedArray) {
    this.canvas.width = W; this.canvas.height = H;
    this.context = this.canvas.getContext('2d')!;
    this.context.imageSmoothingEnabled = false;
    this.frame = this.context.createImageData(W, H);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      this.noise[y * 128 + x] = random(x + y * 153.73);
    }
    for (let y = 0; y < H; y++) for (let x = 360; x < W; x++) {
      const index = (y * W + x) * 4;
      const r = source[index]!, g = source[index + 1]!, b = source[index + 2]!;
      const space = WINDOWS.find(region => inside(x, y, region.shape));
      if (space && !OCCLUDERS.some(p => inside(x, y, p))) {
        const feather = smooth(edgeDistance(x, y, space.shape) / 11);
        const weight = feather * clamp((55 - Math.max(r, g, b)) / 30);
        if (weight > .005) {
          this.air.push({ x, y, index, weight, depth: space.depth });
          this.visibility[y * W + x] = weight;
        }
      }
      // Follow only existing contaminated material. The muted pigment shifts
      // in brightness; no new green veins are invented on clean masonry.
      if (g > 29 && g > r * 1.30 && g > b * 1.06 && STAIN_AREAS.some(p => inside(x, y, p))) {
        this.stains.push({ x, y, index, weight: clamp((g - r - 5) / 23) });
      }
    }
  }

  private field(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const u = smooth(x - ix), v = smooth(y - iy);
    const a = this.noise[(iy & 127) * 128 + (ix & 127)]!;
    const b = this.noise[(iy & 127) * 128 + ((ix + 1) & 127)]!;
    const c = this.noise[((iy + 1) & 127) * 128 + (ix & 127)]!;
    const d = this.noise[((iy + 1) & 127) * 128 + ((ix + 1) & 127)]!;
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  private passage(t: number): { age: number; strength: number; reverse: boolean } | null {
    // An early encounter is visible during a normal title dwell. Later gaps
    // differ; the title never becomes a metronomic monster carousel.
    const time = ((t % 127) + 127) % 127;
    for (const [start, duration, reverse] of [[7,12,0],[49,14,1],[103,11,0]] as const) {
      const age = (time - start) / duration;
      if (age >= 0 && age <= 1) return { age, strength: smooth(age / .18) * smooth((1 - age) / .24), reverse: !!reverse };
    }
    return null;
  }

  draw(t: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(t)) t = 0;
    const out = this.frame.data; out.fill(0);
    const event = this.passage(t);
    const position = event ? (event.reverse ? 1 - event.age : event.age) : 0;
    for (const p of this.air) {
      const speed = p.depth === 1 ? 8.2 : p.depth === 2 ? 5.4 : 2.7;
      const u = p.x + t * speed, v = p.y - t * (p.depth === 1 ? 3.4 : 1.25);
      // Broad transported fronts have fractured, multi-scale margins. Narrow
      // strands ride within them; a static grain layer cannot do this job.
      const broad = this.field(u / 63 + p.depth * 17, v / 47);
      const billow = this.field(u / 27 - 11, v / 20 + broad * 1.8);
      const strand = this.field(u / 11, v / 8);
      const density = smooth((broad * .62 + billow * .29 + strand * .09 - .28) / .50);
      const alpha = (.025 + density * (p.depth === 1 ? .28 : p.depth === 2 ? .27 : .23)) * p.weight;
      let red = 57, green = 67, blue = 64;
      let opacity = alpha;
      if (event && p.depth >= 2) {
        // Only an enormous partial curved flank is seen, never an outlined
        // creature. Its interior subtracts the far air, with the pillars in front.
        const cx = 465 + position * 440;
        const center = 155 + (p.x - cx) * .21 + Math.sin((p.x - cx) / 110) * 29;
        const dx = (p.x - cx) / 136;
        const dy = (p.y - center) / (57 + this.field(p.x / 53, p.y / 49) * 24);
        const flank = smooth((1 - dx * dx - dy * dy) * 3);
        const shadow = flank * event.strength * .72 * p.weight;
        opacity = alpha + shadow * (1 - alpha);
        if (opacity > 0) {
          red = (57 * alpha * (1 - shadow) + 5 * shadow) / opacity;
          green = (67 * alpha * (1 - shadow) + 10 * shadow) / opacity;
          blue = (64 * alpha * (1 - shadow) + 10 * shadow) / opacity;
        }
      }
      out[p.index] = red; out[p.index + 1] = green; out[p.index + 2] = blue;
      out[p.index + 3] = Math.round(opacity * 255);
    }
    for (const p of this.stains) {
      const phase = p.y * .040 + p.x * .021 - t * .62;
      const pulse = Math.sin(phase + this.field(p.x / 18, p.y / 18) * 3);
      const crest = Math.max(0, pulse) ** 3;
      const gain = .80 + crest * .95;
      for (let c = 0; c < 3; c++) out[p.index + c] = Math.min(125, this.source[p.index + c]! * gain);
      out[p.index + 3] = Math.round(p.weight * 178);
    }
    this.context.putImageData(this.frame, 0, 0);
    this.drawDebris(t);
  }

  private drawDebris(t: number): void {
    const origins: readonly P[] = [[558,256],[529,317],[679,274],[748,202],[493,415],[420,538]];
    for (let i = 0; i < origins.length; i++) {
      const [ox, oy] = origins[i]!;
      const cycle = 13.3 + i * 2.73;
      const local = ((t + i * 3.1) % cycle + cycle) % cycle;
      if (local > 4.8) continue;
      const progress = local / 4.8;
      const x = Math.round(ox + Math.sin(local * .7 + i) * 2 + local * (i % 2 ? -1.1 : .8));
      const y = Math.round(oy + local * 10 + local * local * 3.4);
      if (x < 360 || x >= W || y < 0 || y >= H) continue;
      const fade = Math.sin(progress * Math.PI) * .68;
      // Clip the complete fragment footprint, including its dark cap. Testing
      // only the anchor lets a 2px chip leak over an adjacent foreground edge.
      for (let dy = -1; dy < (i % 3 === 0 ? 3 : 1); dy++) for (let dx = 0; dx < (dy < 0 ? 1 : 1 + i % 2); dx++) {
        const px = x + dx, py = y + dy;
        if (px >= W || py < 0 || py >= H) continue;
        const alpha = fade * this.visibility[py * W + px]!;
        if (alpha < .015) continue;
        this.context.fillStyle = dy < 0 ? `rgba(48,56,51,${alpha * .6})` : `rgba(111,119,108,${alpha})`;
        this.context.fillRect(px, py, 1, 1);
      }
    }
  }

  destroy(): void {
    this.disposed = true; this.canvas.width = 0; this.canvas.height = 0;
  }
}
