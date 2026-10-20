import { resolveEnemyWorldAdaptation, type EnemyWorldAdaptation } from '@/entities/form-renderers/d/world-adaptation';

/** Isolated art-study inputs. No gameplay state or persistence is read here. */
export interface AssimilationLookState {
  readonly amount: number;
  readonly fibre: number;
  readonly membrane: number;
  readonly seconds: number;
  readonly motion: boolean;
  readonly subjective: boolean;
}

export interface AssimilationLookMetrics {
  count: number;
  totalMs: number;
  lastMs: number;
  maxMs: number;
  maskBytes: number;
  preparedFrames: number;
  changedPixels: number;
}

export function createAssimilationLookMetrics(): AssimilationLookMetrics {
  return { count: 0, totalMs: 0, lastMs: 0, maxMs: 0, maskBytes: 0, preparedFrames: 0, changedPixels: 0 };
}

export function recordAssimilationLookTime(metrics: AssimilationLookMetrics, start: number): void {
  const elapsed = performance.now() - start;
  metrics.count++;
  metrics.totalMs += elapsed;
  metrics.lastMs = elapsed;
  metrics.maxMs = Math.max(metrics.maxMs, elapsed);
}

const unit = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const smooth = (value: number): number => { const u = unit(value); return u * u * (3 - 2 * u); };
const fract = (value: number): number => value - Math.floor(value);

/** Allocated once per renderer; setters copy into it without retaining UI state. */
export class AssimilationLookParameters {
  enabled = false;
  amount = 0;
  fibre = 0;
  seconds = 0;
  fibrePhase = 0;
  membranePhase = 0;
  subjective = false;
  set(state: AssimilationLookState | null): void {
    this.enabled = state !== null;
    const fibre = unit(state?.fibre ?? 0), membrane = unit(state?.membrane ?? 0), sum = fibre + membrane;
    this.amount = sum > 0 ? smooth(state?.amount ?? 0) : 0;
    this.fibre = sum > 0 ? fibre / sum : 0;
    this.seconds = Number.isFinite(state?.seconds) ? state!.seconds : 0;
    // Interpolate two one-native-pixel material positions without a threshold
    // flip, geometry displacement, or alteration of the original gait.
    this.fibrePhase = state?.motion ? .5 + .5 * Math.sin(this.seconds * Math.PI * 2 / 3.7) : 0;
    this.membranePhase = state?.motion ? .5 + .5 * Math.sin(this.seconds * Math.PI * 2 / 4.6 + 1.2) : 0;
    this.subjective = state?.subjective ?? false;
  }
}

let palettes: readonly [EnemyWorldAdaptation, EnemyWorldAdaptation] | null = null;
/** Resolve the production world palettes once; no private art-study colour set. */
export function getAssimilationLookPalettes(): readonly [EnemyWorldAdaptation, EnemyWorldAdaptation] {
  if (!palettes) {
    const fibre = resolveEnemyWorldAdaptation('crystal-fibre'), membrane = resolveEnemyWorldAdaptation('ruptured-film');
    if (!fibre || !membrane) throw new Error('Assimilation study requires the admitted world material profiles.');
    palettes = [fibre, membrane];
  }
  return palettes;
}

/** rank, fibre tone 0/1, membrane tone 0/1, source boundary, moving material.
 * Sparse storage for the two body groups is under 1 MiB; attack arms are protected. */
export const ASSIMILATION_SURFACE_STRIDE = 7;

function fibreTone(x: number, y: number, z: number, phase: number): number {
  // Long, joined diagonals with a single fork near the shoulder.
  const fork = Math.max(0, y - 1.05) * (x < -.18 ? .3 : -.2);
  const band = fract((x + z * .65 + (y - .72) * .045 + fork + phase / 26.5) / .108);
  return band < .21 ? .13 : band < .67 ? .57 : .92;
}

function membraneTone(x: number, y: number, z: number, phase: number): number {
  // One broad folded surface, with a narrow turned edge. Not tiled noise.
  const fold = Math.abs(x) - .12 + (y - .78) * .25 + z * .18 + phase / 26.5;
  return fold < -.045 ? .57 : fold < -.003 ? .13 : fold < .025 ? .92 : .57;
}

/** Author-space metres: +Y up, +Z face, +X lamp/held-tool shoulder.
 * This is evaluated during opt-in preparation, never against screen coordinates. */
export function writeAssimilationSurface(
  x: number, y: number, z: number, albedoMax: number, emission: number,
  target: Uint8Array, offset: number, protectedPixel = false,
): void {
  if (protectedPixel || y <= .27 || y >= 1.20 || (z < -.17 && y > .68) || (x > .22 && y > .6)
    || (Math.abs(x) > .23 && y < .84)
    || emission > 0 || albedoMax < 38 || (Math.abs(x) < .036 && z > .08)) return;
  const shoulder = 1 - ((x + .265) / .17) ** 2 - ((y - 1.035) / .185) ** 2;
  const flank = 1 - ((x + .145) / .14) ** 2 - ((y - .79) / .24) ** 2;
  const hem = 1 - ((x - .14) / .145) ** 2 - ((y - .76) / .235) ** 2;
  const mass = Math.max(shoulder, flank, hem);
  if (mass <= 0) return;
  target[offset] = Math.round(24 + (1 - Math.min(1, mass)) * 200);
  target[offset + 1] = Math.round(fibreTone(x, y, z, 0) * 255);
  target[offset + 2] = Math.round(fibreTone(x, y, z, 1) * 255);
  target[offset + 3] = Math.round(membraneTone(x, y, z, 0) * 255);
  target[offset + 4] = Math.round(membraneTone(x, y, z, 1) * 255);
  // Both sources remain visible in a side view: shoulder bundles above, broad
  // waist/hem membrane below. Pure sources still occupy the full authored field.
  target[offset + 5] = Math.round(46 + unit((.94 - y) / .1) * 163);
  target[offset + 6] = (x < -.21 || y < .81) ? 1 : 0;
}

/** Scratch layout RGB / signed local-X normal relief / coverage. */
export function sampleAssimilationSurface(
  surface: Uint8Array, offset: number, look: AssimilationLookParameters,
  originalR: number, originalG: number, originalB: number, out: Float32Array,
): void {
  const rank = surface[offset]!;
  const coverage = rank === 0 ? 0 : look.amount * smooth((look.amount - rank / 255 + .12) / .24);
  out[4] = coverage;
  if (coverage === 0) {
    out[0] = originalR; out[1] = originalG; out[2] = originalB; out[3] = 0;
    return;
  }
  const moving = surface[offset + 6]!;
  const fibre = smooth((look.fibre - surface[offset + 5]! / 255 + .055) / .11);
  const f0 = surface[offset + 1]! / 255, f1 = surface[offset + 2]! / 255;
  const m0 = surface[offset + 3]! / 255, m1 = surface[offset + 4]! / 255;
  const fphase = moving * look.fibrePhase, mphase = moving * look.membranePhase;
  const ft = f0 + (f1 - f0) * fphase, mt = m0 + (m1 - m0) * mphase;
  const [fp, mp] = getAssimilationLookPalettes();
  const fc0 = f0 < .3 ? fp.dark : f0 > .8 ? fp.light : fp.mid;
  const fc1 = f1 < .3 ? fp.dark : f1 > .8 ? fp.light : fp.mid;
  const mc0 = m0 < .3 ? mp.dark : m0 > .8 ? mp.light : mp.mid;
  const mc1 = m1 < .3 ? mp.dark : m1 > .8 ? mp.light : mp.mid;
  // Blending occurs only at the bounded source boundary, not across the body.
  for (let channel = 0; channel < 3; channel++) {
    const fc = fc0[channel]! + (fc1[channel]! - fc0[channel]!) * fphase;
    const mc = mc0[channel]! + (mc1[channel]! - mc0[channel]!) * mphase;
    const original = channel === 0 ? originalR : channel === 1 ? originalG : originalB;
    out[channel] = original + (mc + (fc - mc) * fibre - original) * coverage;
  }
  out[3] = ((mt - .57) * .27 * (1 - fibre) + (ft - .57) * .34 * fibre) * coverage;
}

/** Same author-space fields as writeAssimilationSurface. No extra sampler/pass. */
export const ASSIMILATION_APPEARANCE_GLSL = `
uniform vec4 uAssimilation; // coverage, source ratio, fibre phase, membrane phase
uniform vec2 uAssimilationYaw;
uniform vec3 uAssimilationFibre[3],uAssimilationMembrane[3];
float assimilationSmooth(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
vec3 assimilationPalette(float tone,vec3 dark,vec3 mid,vec3 light){return tone<.3?dark:tone>.8?light:mid;}
float assimilationFibreTone(vec3 q,float phase){
 float fork=max(0.,q.y-1.05)*(q.x<-.18?.3:-.2);
 float band=fract((q.x+q.z*.65+(q.y-.72)*.045+fork+phase/26.5)/.108);
 return band<.21?.13:band<.67?.57:.92;
}
float assimilationMembraneTone(vec3 q,float phase){
 float fold=abs(q.x)-.12+(q.y-.78)*.25+q.z*.18+phase/26.5;
 return fold<-.045?.57:fold<-.003?.13:fold<.025?.92:.57;
}
void assimilationMaterial(vec3 relative,inout vec3 albedo,inout vec3 normal,vec4 material){
 if(uAssimilation.x<=0.)return;
 // Pose-matched forearm endpoints are the actual hand positions, including
 // walking and settling. Coarse body regions alone cannot protect every grip.
 if(uCapsuleCount>10&&(length(relative-uCapsuleB[8])<.13||length(relative-uCapsuleB[10])<.13))return;
 float c=uAssimilationYaw.x,s=uAssimilationYaw.y;
 vec3 q=vec3(relative.x*c-relative.z*s,relative.y,relative.x*s+relative.z*c);
 float x=q.x,y=q.y,z=q.z;
 if(y<=.27||y>=1.20||(z<-.17&&y>.68)||(x>.22&&y>.6)||(abs(x)>.23&&y<.84)||material.a>0.||
   max(albedo.r,max(albedo.g,albedo.b))<38./255.||(abs(x)<.036&&z>.08))return;
 float shoulder=1.-pow((x+.265)/.17,2.)-pow((y-1.035)/.185,2.);
 float flank=1.-pow((x+.145)/.14,2.)-pow((y-.79)/.24,2.);
 float hem=1.-pow((x-.14)/.145,2.)-pow((y-.76)/.235,2.);
 float mass=max(shoulder,max(flank,hem));if(mass<=0.)return;
 float rank=floor(24.+(1.-min(1.,mass))*200.+.5)/255.;
 float coverage=uAssimilation.x*assimilationSmooth((uAssimilation.x-rank+.12)/.24);if(coverage<=0.)return;
 float moving=x<-.21||y<.81?1.:0.;
 float fphase=moving*uAssimilation.z,mphase=moving*uAssimilation.w;
 float f0=assimilationFibreTone(q,0.),f1=assimilationFibreTone(q,1.);
 float m0=assimilationMembraneTone(q,0.),m1=assimilationMembraneTone(q,1.);
 float ft=mix(f0,f1,fphase),mt=mix(m0,m1,mphase);
 float boundary=floor(46.+clamp((.94-y)/.1,0.,1.)*163.+.5)/255.;
 float fibre=assimilationSmooth((uAssimilation.y-boundary+.055)/.11);
 vec3 fc=mix(assimilationPalette(f0,uAssimilationFibre[0],uAssimilationFibre[1],uAssimilationFibre[2]),
   assimilationPalette(f1,uAssimilationFibre[0],uAssimilationFibre[1],uAssimilationFibre[2]),fphase);
 vec3 mc=mix(assimilationPalette(m0,uAssimilationMembrane[0],uAssimilationMembrane[1],uAssimilationMembrane[2]),
   assimilationPalette(m1,uAssimilationMembrane[0],uAssimilationMembrane[1],uAssimilationMembrane[2]),mphase);
 albedo=mix(albedo,mix(mc,fc,fibre),coverage);
 float relief=((mt-.57)*.27*(1.-fibre)+(ft-.57)*.34*fibre)*coverage;
 normal=normalize(normal+vec3(c,0.,-s)*relief);
}
`;
