import { resolveEnemyWorldAdaptation, type EnemyWorldAdaptation } from '@/entities/form-renderers/d/world-adaptation';

export interface AssimilationPalette {
  readonly dark: readonly [number, number, number];
  readonly mid: readonly [number, number, number];
  readonly light: readonly [number, number, number];
}

/** Material input only; no gameplay state or persistence is read here. */
export interface AssimilationLookState {
  readonly amount: number;
  readonly fibre: number;
  readonly membrane: number;
  readonly seconds: number;
  readonly motion: boolean;
  readonly subjective: boolean;
  readonly palettes?: readonly [AssimilationPalette, AssimilationPalette];
  readonly neutralFraction?: number;
  readonly neutralPalette?: AssimilationPalette;
  /** Stable palette objects may update in place; renderers track this revision. */
  readonly paletteRevision?: number;
}

/** Existing palette.json industrial greys, never a fabricated historical world. */
export const ASSIMILATION_NEUTRAL_PALETTE: AssimilationPalette = Object.freeze({
  dark: [44, 46, 51] as const, mid: [58, 61, 66] as const, light: [74, 78, 85] as const,
});

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
  neutralFraction = 0;
  fibrePalette: AssimilationPalette = getAssimilationLookPalettes()[0];
  membranePalette: AssimilationPalette = getAssimilationLookPalettes()[1];
  neutralPalette: AssimilationPalette = ASSIMILATION_NEUTRAL_PALETTE;
  paletteRevision = 0;
  set(state: AssimilationLookState | null): void {
    this.enabled = state !== null;
    const fibre = unit(state?.fibre ?? 0), membrane = unit(state?.membrane ?? 0), sum = fibre + membrane;
    this.neutralFraction = unit(state?.neutralFraction ?? 0);
    this.amount = sum > 0 || this.neutralFraction > 0 ? smooth(state?.amount ?? 0) : 0;
    this.fibre = sum > 0 ? fibre / sum : 0;
    const sources = state?.palettes ?? getAssimilationLookPalettes();
    this.fibrePalette = sources[0];
    this.membranePalette = sources[1];
    this.neutralPalette = state?.neutralPalette ?? ASSIMILATION_NEUTRAL_PALETTE;
    this.paletteRevision = state?.paletteRevision ?? 0;
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

/** rank, fibre tone 0/1, membrane tone 0/1, source boundary, moving material,
 * neutral boundary and quiet neutral tone.
 * Sparse storage for the original two body groups is under 1 MiB. */
export const ASSIMILATION_SURFACE_STRIDE = 9;
/** Actual palm/tool contact radius around the posed right wrist; not a glove mask. */
export const ASSIMILATION_GRIP_CONTACT_RADIUS = .065;

function fibreTone(x: number, y: number, z: number, phase: number): number {
  // Long, joined diagonals with a single fork near the shoulder.
  const fork = Math.max(0, y - 1.05) * (x < -.18 ? .3 : -.2);
  const band = fract((x + z * .65 + (y - .72) * .045 + fork + phase / 26.5) / .17);
  return band < .14 ? .13 : band < .9 ? .57 : .92;
}

function membraneTone(x: number, y: number, z: number, phase: number): number {
  // One broad folded surface, with a narrow turned edge. Not tiled noise.
  const fold = Math.abs(x) - .12 + (y - .78) * .25 + z * .18 + phase / 26.5;
  return fold < -.045 ? .57 : fold < -.003 ? .13 : fold < .025 ? .92 : .57;
}

/** Author-space metres: +Y up, +Z face, +X lamp/held-tool shoulder.
 * This is evaluated during opt-in preparation, never against screen coordinates.
 * protectedPixel is a small actual right-palm/tool contact, never a whole hand. */
export function writeAssimilationSurface(
  x: number, y: number, z: number, albedoMax: number, emission: number,
  target: Uint8Array, offset: number, protectedPixel = false,
): void {
  target.fill(0, offset, offset + ASSIMILATION_SURFACE_STRIDE);
  const visor = albedoMax < 20 && y > 1.22 && z > .12 && Math.abs(x) < .24;
  if (y <= .09 || emission > 0 || visor || protectedPixel) return;
  // Short, thin remnants of the original material, interleaved with the
  // continuous organism. They are counted in the full opaque denominator.
  const trace = fract((x + z * .46 + y * .07) / .22 + Math.sin(y * 5 + z) * .15);
  if (trace > .81 && Math.sin(y * 11 + z * 3) > 0) return;
  const shoulder = 1 - ((x + .265) / .17) ** 2 - ((y - 1.035) / .185) ** 2;
  const flank = 1 - ((x + .145) / .14) ** 2 - ((y - .79) / .24) ** 2;
  const hem = 1 - ((x - .14) / .145) ** 2 - ((y - .76) / .235) ** 2;
  const distance = Math.max(0, 1 - Math.max(shoulder, flank, hem));
  target[offset] = Math.round(32 + unit(distance / 3) * 168 + unit((y - 1.18) / .48) * 30);
  target[offset + 1] = Math.round(fibreTone(x, y, z, 0) * 255);
  target[offset + 2] = Math.round(fibreTone(x, y, z, 1) * 255);
  target[offset + 3] = Math.round(membraneTone(x, y, z, 0) * 255);
  target[offset + 4] = Math.round(membraneTone(x, y, z, 1) * 255);
  // A diagonal wrap joins the left shoulder to the right shin, while membrane
  // reaches the opposing shoulder. Neither source stops at a horizontal seam.
  const turn = (y - .75) * 2.4;
  const wrap = (x * Math.sin(turn) + z * Math.cos(turn)) / Math.max(.1, Math.hypot(x, z));
  target[offset + 5] = Math.round(46 + unit(.5 + .8 * wrap) * 163);
  target[offset + 6] = (x < -.21 || y < .81) ? 1 : 0;
  target[offset + 7] = Math.round(24 + unit(.5 + .5 * Math.sin(x * 4 + y * 5.3 - z * 3)) * 207);
  // Broad old-material lamina with sparse dark seams, not a third invented organism.
  const seam = fract(x * 2.9 + y * 2.1 + z * .7);
  target[offset + 8] = Math.round((seam > .94 ? .13 : seam > .88 ? .92 : .57) * 255);
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
  const fp = look.fibrePalette, mp = look.membranePalette;
  const neutral = smooth((look.neutralFraction - surface[offset + 7]! / 255 + .055) / .11);
  const neutralTone = surface[offset + 8]! / 255;
  const neutralColor = neutralTone < .3 ? look.neutralPalette.dark
    : neutralTone > .8 ? look.neutralPalette.light : look.neutralPalette.mid;
  const fc0 = f0 < .3 ? fp.dark : f0 > .8 ? fp.light : fp.mid;
  const fc1 = f1 < .3 ? fp.dark : f1 > .8 ? fp.light : fp.mid;
  const mc0 = m0 < .3 ? mp.dark : m0 > .8 ? mp.light : mp.mid;
  const mc1 = m1 < .3 ? mp.dark : m1 > .8 ? mp.light : mp.mid;
  // Blending occurs only at the bounded source boundary, not across the body.
  for (let channel = 0; channel < 3; channel++) {
    const fc = fc0[channel]! + (fc1[channel]! - fc0[channel]!) * fphase;
    // The turned membrane edge retains its palette hue without reading as an
    // emissive stripe on dark limbs. Broad mid and dark surfaces are unchanged.
    const ml0 = m0 > .8 ? (mc0[channel]! + mp.mid[channel]!) * .5 : mc0[channel]!;
    const ml1 = m1 > .8 ? (mc1[channel]! + mp.mid[channel]!) * .5 : mc1[channel]!;
    const mc = ml0 + (ml1 - ml0) * mphase;
    const original = channel === 0 ? originalR : channel === 1 ? originalG : originalB;
    const typedColor = mc + (fc - mc) * fibre;
    out[channel] = original + (typedColor + (neutralColor[channel]! - typedColor) * neutral - original) * coverage;
  }
  out[3] = (((mt - .57) * .27 * (1 - fibre) + (ft - .57) * .34 * fibre) * (1 - neutral)
    + (neutralTone - .57) * .08 * neutral) * coverage;
}

/** Same author-space fields as writeAssimilationSurface. No extra sampler/pass. */
export const ASSIMILATION_APPEARANCE_GLSL = `
uniform vec4 uAssimilation; // coverage, source ratio, fibre phase, membrane phase
uniform vec2 uAssimilationYaw;
uniform vec3 uAssimilationFibre[3],uAssimilationMembrane[3];
uniform float uAssimilationNeutralFraction;
uniform vec3 uAssimilationNeutral[3];
float assimilationSmooth(float x){x=clamp(x,0.,1.);return x*x*(3.-2.*x);}
vec3 assimilationPalette(float tone,vec3 dark,vec3 mid,vec3 light){return tone<.3?dark:tone>.8?light:mid;}
float assimilationFibreTone(vec3 q,float phase){
 float fork=max(0.,q.y-1.05)*(q.x<-.18?.3:-.2);
 float band=fract((q.x+q.z*.65+(q.y-.72)*.045+fork+phase/26.5)/.17);
 return band<.14?.13:band<.9?.57:.92;
}
float assimilationMembraneTone(vec3 q,float phase){
 float fold=abs(q.x)-.12+(q.y-.78)*.25+q.z*.18+phase/26.5;
 return fold<-.045?.57:fold<-.003?.13:fold<.025?.92:.57;
}
void assimilationMaterial(vec3 relative,inout vec3 albedo,inout vec3 normal,vec4 material){
 if(uAssimilation.x<=0.)return;
 float c=uAssimilationYaw.x,s=uAssimilationYaw.y;
 vec3 q=vec3(relative.x*c-relative.z*s,relative.y,relative.x*s+relative.z*c);
 float x=q.x,y=q.y,z=q.z;
 bool visor=max(albedo.r,max(albedo.g,albedo.b))<20./255.&&y>1.22&&z>.12&&abs(x)<.24;
 bool grip=uCapsuleCount>10&&length(relative-uCapsuleB[10])<${ASSIMILATION_GRIP_CONTACT_RADIUS};
 if(y<=.09||material.a>0.||visor||grip)return;
 float trace=fract((x+z*.46+y*.07)/.22+sin(y*5.+z)*.15);
 if(trace>.81&&sin(y*11.+z*3.)>0.)return;
 float shoulder=1.-pow((x+.265)/.17,2.)-pow((y-1.035)/.185,2.);
 float flank=1.-pow((x+.145)/.14,2.)-pow((y-.79)/.24,2.);
 float hem=1.-pow((x-.14)/.145,2.)-pow((y-.76)/.235,2.);
 float distance=max(0.,1.-max(shoulder,max(flank,hem)));
 float rank=floor(32.+clamp(distance/3.,0.,1.)*168.+clamp((y-1.18)/.48,0.,1.)*30.+.5)/255.;
 float coverage=uAssimilation.x*assimilationSmooth((uAssimilation.x-rank+.12)/.24);if(coverage<=0.)return;
 float moving=x<-.21||y<.81?1.:0.;
 float fphase=moving*uAssimilation.z,mphase=moving*uAssimilation.w;
 float f0=assimilationFibreTone(q,0.),f1=assimilationFibreTone(q,1.);
 float m0=assimilationMembraneTone(q,0.),m1=assimilationMembraneTone(q,1.);
 float ft=mix(f0,f1,fphase),mt=mix(m0,m1,mphase);
 float turn=(y-.75)*2.4;
 float wrap=(x*sin(turn)+z*cos(turn))/max(.1,length(q.xz));
 float boundary=floor(46.+clamp(.5+.8*wrap,0.,1.)*163.+.5)/255.;
 float fibre=assimilationSmooth((uAssimilation.y-boundary+.055)/.11);
 float neutralBoundary=floor(24.+clamp(.5+.5*sin(x*4.+y*5.3-z*3.),0.,1.)*207.+.5)/255.;
 float neutral=assimilationSmooth((uAssimilationNeutralFraction-neutralBoundary+.055)/.11);
 float seam=fract(x*2.9+y*2.1+z*.7);
 float neutralTone=floor((seam>.94?.13:seam>.88?.92:.57)*255.+.5)/255.;
 vec3 fc=mix(assimilationPalette(f0,uAssimilationFibre[0],uAssimilationFibre[1],uAssimilationFibre[2]),
   assimilationPalette(f1,uAssimilationFibre[0],uAssimilationFibre[1],uAssimilationFibre[2]),fphase);
 vec3 membraneLight=mix(uAssimilationMembrane[1],uAssimilationMembrane[2],.5);
 vec3 mc=mix(assimilationPalette(m0,uAssimilationMembrane[0],uAssimilationMembrane[1],membraneLight),
   assimilationPalette(m1,uAssimilationMembrane[0],uAssimilationMembrane[1],membraneLight),mphase);
 vec3 nc=assimilationPalette(neutralTone,uAssimilationNeutral[0],uAssimilationNeutral[1],uAssimilationNeutral[2]);
 albedo=mix(albedo,mix(mix(mc,fc,fibre),nc,neutral),coverage);
 float relief=(((mt-.57)*.27*(1.-fibre)+(ft-.57)*.34*fibre)*(1.-neutral)+(neutralTone-.57)*.08*neutral)*coverage;
 normal=normalize(normal+vec3(c,0.,-s)*relief);
}
`;
