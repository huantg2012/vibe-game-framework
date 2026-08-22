/**
 * Scheme D 丁：概念基体配方。gym only。
 * 油膜不是丁的主外形；未知基体落到余响，不落到棋盘填盒。
 */
import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContinuityId, CoverageId } from '@/generated/contamination-lexicon-data';
import { mix32 } from '@/generation/seed-fork';
import type { FormAttachContext } from '@/gym/form-renderers/form-renderer';
import { coreMarkPx, resolveStopLoss } from '@/systems/contamination-host-live';
import {
  deriveFragmentContamRamp,
  LEXICON_DEFAULT_FRAGMENT,
  type FragmentContamRamp,
  type Rgb,
} from '@/gym/form-renderers/d/fragment-ramp';

export const DING_FAMILIES = ['sound_echo', 'light_scatter', 'space_interval'] as const;
export type DingFamily = (typeof DING_FAMILIES)[number];

const CORE_TEALS: readonly Rgb[] = [
  [0x1a, 0xad, 0x96],
  [0x2a, 0xe6, 0xc8],
  [0x3c, 0xff, 0xd4],
];

export interface CloudHarmonics {
  readonly a2: number;
  readonly p2: number;
  readonly a3: number;
  readonly p3: number;
  readonly a5: number;
  readonly p5: number;
  readonly notchA: number;
  readonly notchW: number;
}

export interface ScatterVein {
  readonly ax: number;
  readonly ay: number;
  readonly kx: number;
  readonly ky: number;
  readonly bx: number;
  readonly by: number;
}

export interface DingRecipe {
  readonly family: DingFamily;
  readonly coverage: CoverageId;
  readonly continuity: ContinuityId;
  readonly motion: string;
  readonly sense: string;
  readonly rhythm: string;
  readonly contact: string;
  readonly utteranceId: string | undefined;
  readonly seed: number;
  readonly fragmentTypeId: string;
  readonly ramp: FragmentContamRamp;
  readonly deep: Rgb;
  readonly mid: Rgb;
  readonly core: Rgb;
  readonly glow: Rgb;
  readonly edgeAlpha: number;
  readonly coreAlpha: number;
  readonly breathAmp: number;
  readonly breathPeriodMs: number;
  readonly harmonics: CloudHarmonics;
  readonly echoRings: number;
  readonly echoSpacing: number;
  readonly echoLagMs: readonly number[];
  readonly veins: readonly ScatterVein[];
  readonly squeeze: 'narrow' | 'offset';
  readonly squeezePx: number;
  readonly reverseCore: boolean;
  readonly paintStrikeCore: boolean;
  readonly strikeCorePx: number;
}

function unit(seed: number, label: string): number {
  return mix32(seed, label) / 4294967296;
}

function clampCoreTeal(rgb: Rgb): Rgb {
  let best = CORE_TEALS[0]!;
  let bestD = Infinity;
  for (const p of CORE_TEALS) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function dingFamilyOf(substrate: string): DingFamily {
  if (substrate === 'light_scatter') return 'light_scatter';
  if (substrate === 'space_interval') return 'space_interval';
  return 'sound_echo';
}

function breathPeriodMs(rhythm: string): number {
  if (rhythm === 'rhythm_pulse') return 2000;
  if (rhythm === 'rhythm_sleep') return 4000;
  if (rhythm === 'rhythm_sky') return 3800;
  if (rhythm === 'rhythm_cluster') return 3100;
  return 3000;
}

function coverageAlpha(coverage: CoverageId): { edge: number; core: number; amp: number } {
  if (coverage === 'infiltrate') return { edge: 70, core: 160, amp: 0.08 };
  if (coverage === 'rewrite') return { edge: 95, core: 190, amp: 0.12 };
  return { edge: 120, core: 220, amp: 0.15 };
}

function makeHarmonics(seed: number): CloudHarmonics {
  return {
    a2: 0.1 + unit(seed, 'h2') * 0.06,
    p2: unit(seed, 'p2') * Math.PI * 2,
    a3: 0.06 + unit(seed, 'h3') * 0.05,
    p3: unit(seed, 'p3') * Math.PI * 2,
    a5: 0.03 + unit(seed, 'h5') * 0.04,
    p5: unit(seed, 'p5') * Math.PI * 2,
    notchA: unit(seed, 'na') * Math.PI * 2,
    notchW: 0.22 + unit(seed, 'nw') * 0.18,
  };
}

function makeVeins(seed: number, count: number): ScatterVein[] {
  const out: ScatterVein[] = [];
  for (let i = 0; i < count; i++) {
    const a = unit(seed, `va:${i}`) * Math.PI * 2;
    const b = a + Math.PI * (0.55 + unit(seed, `vb:${i}`) * 0.5);
    const kink = (a + b) * 0.5 + (unit(seed, `vk:${i}`) - 0.5) * 0.8;
    const inner = 0.08 + unit(seed, `vi:${i}`) * 0.18;
    const outer = 0.72 + unit(seed, `vo:${i}`) * 0.2;
    const kR = 0.28 + unit(seed, `vr:${i}`) * 0.28;
    out.push({
      ax: Math.cos(a) * inner,
      ay: Math.sin(a) * inner,
      kx: Math.cos(kink) * kR,
      ky: Math.sin(kink) * kR,
      bx: Math.cos(b) * outer,
      by: Math.sin(b) * outer,
    });
  }
  return out;
}

export function dingRecipeFromForm(form: ContaminationForm, ctx: FormAttachContext): DingRecipe {
  const fragmentTypeId = ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT;
  const family = dingFamilyOf(form.substrate);
  const seed = ctx.seed;
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  const alpha = coverageAlpha(form.coverage);
  const rings = 2 + (mix32(seed, 'echo-n') % 2);
  const spacing = 3 + (mix32(seed, 'echo-s') % 4);
  const lag0 = 300 + (mix32(seed, 'echo-l0') % 301);
  const lag1 = 300 + (mix32(seed, 'echo-l1') % 301);
  const veinCount = 3 + (mix32(seed, 'vein-n') % 6);
  const squeeze: 'narrow' | 'offset' = mix32(seed, 'squeeze') % 2 === 0 ? 'narrow' : 'offset';
  const watching = form.utteranceId === 'corridor_watching';
  const stop = resolveStopLoss(form);
  const paintStrikeCore = stop !== 'illegal' && stop.hittable;
  return {
    family,
    coverage: form.coverage,
    continuity: form.continuity,
    motion: form.lexemes.motion,
    sense: form.lexemes.sense,
    rhythm: form.lexemes.rhythm,
    contact: form.lexemes.contact,
    utteranceId: form.utteranceId,
    seed,
    fragmentTypeId,
    ramp,
    deep: ramp.deep,
    mid: ramp.mid,
    core: clampCoreTeal(ramp.core),
    glow: clampCoreTeal(ramp.glow),
    edgeAlpha: alpha.edge,
    coreAlpha: alpha.core,
    breathAmp: alpha.amp,
    breathPeriodMs: breathPeriodMs(form.lexemes.rhythm),
    harmonics: makeHarmonics(seed),
    echoRings: rings,
    echoSpacing: spacing,
    echoLagMs: rings === 2 ? [0, lag0] : [0, lag0, lag1],
    veins: makeVeins(seed, veinCount),
    squeeze,
    squeezePx: squeeze === 'narrow' ? 32 : 8 + (mix32(seed, 'sqpx') % 9),
    reverseCore: watching || form.lexemes.sense === 'sense_reverse',
    paintStrikeCore,
    strikeCorePx: stop === 'illegal' || !stop.hittable ? 0 : coreMarkPx(stop.corePolicy, 2),
  };
}
