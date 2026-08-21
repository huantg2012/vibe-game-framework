import { paintClusterBreath } from '@/systems/cluster-pulse';
import type { FormVisualPose } from '@/gym/form-renderers/form-renderer';
import type { BingRecipe, CoreShiftMode } from '@/gym/form-renderers/d/bing-dialect';
import { BING_PULSE_SAMPLES, CLUSTER_BREATH, hash2 } from '@/gym/form-renderers/d/bing-hash';
import type { LiveOrganism } from '@/gym/form-renderers/d/bing-shape';
import type { Rgb } from '@/gym/form-renderers/d/fragment-ramp';

const STEP = (Math.PI * 2) / BING_PULSE_SAMPLES;
const CORE_OVERLAP = 0.68;
const BRIGHT: Rgb = [0x3c, 0xff, 0xd4];

type PulseField = Parameters<typeof paintClusterBreath>[3];

function radiusAt(table: Float32Array, ang: number): number {
  let u = ang / STEP;
  const n = BING_PULSE_SAMPLES;
  u = ((u % n) + n) % n;
  const i = u | 0;
  const f = u - i;
  const a = table[i]!;
  const b = table[(i + 1) % n]!;
  return a + (b - a) * f;
}

function facingAngle(facing: FormVisualPose['facing4']): number {
  if (facing === 'right') return 0;
  if (facing === 'down') return Math.PI / 2;
  if (facing === 'left') return Math.PI;
  return -Math.PI / 2;
}

function shiftOffset(
  facing: FormVisualPose['facing4'],
  mode: CoreShiftMode,
  px: number,
): { ox: number; oy: number } {
  if (mode === 'none' || px <= 0) return { ox: 0, oy: 0 };
  const fa = facingAngle(facing);
  let ang = fa;
  if (mode === 'side') ang = fa + Math.PI / 2;
  if (mode === 'back') ang = fa + Math.PI;
  return { ox: Math.cos(ang) * px, oy: Math.sin(ang) * px };
}

function putPixel(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgb: Rgb,
  alpha: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const o = (y * width + x) * 4;
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
  out[o + 3] = alpha;
}

/**
 * Weak modulation only: wind slides the blob; inflated uses the locked 20% cap.
 * Silhouette scale stays inside `paintClusterBreath` (DEC-070).
 */
export function deformBingOrganisms(
  organisms: LiveOrganism[],
  recipe: BingRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  anchorX: number,
  anchorY: number,
): void {
  const wind = recipe.motion === 'motion_wind' ? Math.sin(elapsedMs * CLUSTER_BREATH) * 3.5 : 0;
  const amp = pose.signal === 'inflated' ? 0.2 : recipe.breathAmp;
  for (const org of organisms) {
    org.cx = anchorX + org.dx + wind;
    org.cy = anchorY + org.dy;
    org.breathAmp = amp;
    for (let i = 0; i < BING_PULSE_SAMPLES; i++) {
      const core = org.coreBase[i]!;
      const shape = org.shapeBase[i]!;
      org.shapeRest[i] = Math.max(core + 0.5, shape);
      org.coreRest[i] = core;
    }
  }
}

function paintCore(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  org: LiveOrganism,
  recipe: BingRecipe,
  pose: FormVisualPose,
  seed: number,
): void {
  const { ox, oy } = shiftOffset(pose.facing4, recipe.coreShiftMode, recipe.coreShiftPx);
  const cx = org.cx + ox;
  const cy = org.cy + oy;
  const coreRgb = pose.signal === 'inflated' ? BRIGHT : recipe.ramp.core;
  let maxR = 0;
  for (let i = 0; i < BING_PULSE_SAMPLES; i++) {
    if (org.coreRest[i]! > maxR) maxR = org.coreRest[i]!;
  }
  const reach = Math.ceil(maxR) + 2;
  const x0 = Math.max(0, Math.floor(cx) - reach);
  const y0 = Math.max(0, Math.floor(cy) - reach);
  const x1 = Math.min(width - 1, Math.ceil(cx) + reach);
  const y1 = Math.min(height - 1, Math.ceil(cy) + reach);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx);
      if (ang < 0) ang += Math.PI * 2;
      const core = radiusAt(org.coreRest, ang);
      if (dist > core * CORE_OVERLAP && dist >= 0.2) continue;
      if (hash2(x, y, seed) < recipe.holeChance) continue;
      const remnant = recipe.remnant;
      const useRemnant =
        remnant !== null && hash2(x + 3, y - 5, seed ^ 17) < (recipe.coverage === 'infiltrate' ? 0.45 : 0.18);
      putPixel(out, width, height, x, y, useRemnant && remnant ? remnant : coreRgb, 255);
    }
  }
}

function paintRim(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  org: LiveOrganism,
  rgb: Rgb,
): void {
  for (let i = 0; i < BING_PULSE_SAMPLES; i += 3) {
    const outer = org.shapeRest[i]!;
    const ang = i * STEP;
    putPixel(
      out,
      width,
      height,
      Math.round(org.cx + Math.cos(ang) * (outer + 1)),
      Math.round(org.cy + Math.sin(ang) * (outer + 1)),
      rgb,
      240,
    );
  }
}

function punchHoles(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  recipe: BingRecipe,
  seed: number,
): void {
  if (recipe.holeChance < 0.05) return;
  const n = width * height;
  for (let i = 0; i < n; i++) {
    const a = i * 4 + 3;
    if (out[a]! === 0) continue;
    const x = i % width;
    const y = (i / width) | 0;
    if (hash2(x, y, seed ^ 91) < recipe.holeChance) out[a] = 0;
  }
}

export function paintBingFrame(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  field: PulseField,
  organisms: LiveOrganism[],
  recipe: BingRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  seed: number,
): void {
  const t = elapsedMs * recipe.rhythmScale;
  paintClusterBreath(out, width, height, field, t);
  punchHoles(out, width, height, recipe, seed);
  const inflated = pose.signal === 'inflated';
  const rim = recipe.rimAlways || (recipe.rimOnInflated && inflated);
  for (let i = 0; i < organisms.length; i++) {
    const org = organisms[i]!;
    paintCore(out, width, height, org, recipe, pose, seed + i * 13);
    if (rim) paintRim(out, width, height, org, recipe.ramp.glow);
  }
}

export function makeBingPulseField(
  width: number,
  height: number,
  organisms: LiveOrganism[],
  recipe: BingRecipe,
): PulseField {
  const land = new Uint8Array(width * height);
  land.fill(1);
  const walls = new Uint8Array(width * height);
  return {
    organisms,
    deep: [recipe.ramp.deep[0], recipe.ramp.deep[1], recipe.ramp.deep[2]],
    mid: [recipe.ramp.mid[0], recipe.ramp.mid[1], recipe.ramp.mid[2]],
    glow: [recipe.ramp.glow[0], recipe.ramp.glow[1], recipe.ramp.glow[2]],
    land,
    walls,
    cols: width,
    rows: height,
    tile: 1,
  };
}
