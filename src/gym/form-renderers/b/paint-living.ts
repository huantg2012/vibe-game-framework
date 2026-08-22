import { CLUSTER_PULSE_SAMPLES, type ClusterPulseField } from '@/generation/preview-paint';
import { paintClusterBreath } from '@/systems/cluster-pulse';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import type { LiveOrganism } from '@/gym/form-renderers/b/cluster-shape';
import type { DialectRecipe, SenseKind } from '@/gym/form-renderers/b/dialect';
import { CORE_TEAL, GREY_SHADOW, hash2, type Rgb } from '@/gym/form-renderers/b/palette';

/** Same coefficient as `cluster-pulse.ts` BREATH (~3.1s cycle). */
export const CLUSTER_BREATH = 0.002;
const STEP = (Math.PI * 2) / CLUSTER_PULSE_SAMPLES;
const CORE_OVERLAP = 0.68;
const TILE = 32;

function radiusAt(table: Float32Array, ang: number): number {
  let u = ang / STEP;
  const n = CLUSTER_PULSE_SAMPLES;
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

function hitchScale(recipe: DialectRecipe, pose: FormVisualPose, elapsedMs: number): number {
  if (recipe.motion === 'motion_coalesce') {
    const signed = Math.sin(elapsedMs * CLUSTER_BREATH * 2);
    return recipe.hitchPlant + (recipe.hitchLunge - recipe.hitchPlant) * (0.5 + 0.5 * signed);
  }
  if (!pose.moving || recipe.hitchPeriodMs <= 0) return 1;
  const u = (elapsedMs % recipe.hitchPeriodMs) / recipe.hitchPeriodMs;
  return u < 0.48 ? recipe.hitchPlant : recipe.hitchLunge;
}

function isLunge(recipe: DialectRecipe, pose: FormVisualPose, elapsedMs: number): boolean {
  if (!pose.moving) return false;
  if (recipe.motion === 'motion_coalesce') return hitchScale(recipe, pose, elapsedMs) > 0.95;
  const u = (elapsedMs % recipe.hitchPeriodMs) / recipe.hitchPeriodMs;
  return u >= 0.48;
}

export function deformOrganisms(
  organisms: LiveOrganism[],
  recipe: DialectRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  anchorX: number,
  anchorY: number,
): void {
  const fa = facingAngle(pose.facing4);
  const hitch = hitchScale(recipe, pose, elapsedMs);
  const slide =
    recipe.seamSlidePx > 0 ? Math.sin(elapsedMs * CLUSTER_BREATH) * recipe.seamSlidePx : 0;
  const wind = recipe.motion === 'motion_wind' ? Math.sin(elapsedMs * CLUSTER_BREATH) * 3.5 : 0;
  const open =
    recipe.openClose ? 0.55 + 0.45 * Math.abs(Math.sin(elapsedMs * CLUSTER_BREATH * recipe.rhythmScale)) : 1;
  const inflated = pose.signal === 'inflated' ? 1.2 : 1;
  for (const org of organisms) {
    org.cx = anchorX + org.dx + Math.cos(fa) * recipe.facingShift + wind;
    org.cy = anchorY + org.dy + Math.sin(fa) * recipe.facingShift + slide;
    org.breathAmp = Math.min(0.2, recipe.breathAmp * inflated);
    for (let i = 0; i < CLUSTER_PULSE_SAMPLES; i++) {
      const ang = i * STEP;
      const stretch = 1 + recipe.facingStretch * Math.cos(ang - fa);
      const openMul = recipe.openClose ? 1 + (open - 1) * Math.abs(Math.cos(ang)) : 1;
      const shape = org.shapeBase[i]! * hitch * stretch * openMul;
      const core = org.coreBase[i]!;
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
  recipe: DialectRecipe,
  seed: number,
): void {
  let maxR = 0;
  for (let i = 0; i < CLUSTER_PULSE_SAMPLES; i++) {
    if (org.coreRest[i]! > maxR) maxR = org.coreRest[i]!;
  }
  const reach = Math.ceil(maxR) + 2;
  const x0 = Math.max(0, Math.floor(org.cx) - reach);
  const y0 = Math.max(0, Math.floor(org.cy) - reach);
  const x1 = Math.min(width - 1, Math.ceil(org.cx) + reach);
  const y1 = Math.min(height - 1, Math.ceil(org.cy) + reach);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - org.cx;
      const dy = y + 0.5 - org.cy;
      const dist = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx);
      if (ang < 0) ang += Math.PI * 2;
      const core = radiusAt(org.coreRest, ang);
      if (dist > core * CORE_OVERLAP && dist >= 0.2) continue;
      if (hash2(x, y, seed) < recipe.holeChance) continue;
      const remnant = recipe.remnant;
      const useRemnant = remnant !== null && hash2(x + 3, y - 5, seed ^ 17) < (recipe.coverage === 'infiltrate' ? 0.45 : 0.18);
      putPixel(out, width, height, x, y, useRemnant && remnant ? remnant : recipe.ramp.core, 255);
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
  for (let i = 0; i < CLUSTER_PULSE_SAMPLES; i += 3) {
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

function paintSense(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  org: LiveOrganism,
  sense: SenseKind,
  facing: FormVisualPose['facing4'],
  awake: boolean,
): void {
  const fa = facingAngle(facing);
  const cx = Math.round(org.cx);
  const cy = Math.round(org.cy);
  if (sense === 'reverse' && !awake) {
    putPixel(out, width, height, cx, cy, CORE_TEAL.core, 160);
    return;
  }
  if (sense === 'cone') {
    for (let d = 2; d <= 5; d++) {
      putPixel(
        out,
        width,
        height,
        Math.round(org.cx + Math.cos(fa) * d),
        Math.round(org.cy + Math.sin(fa) * d),
        CORE_TEAL.bright,
        255,
      );
    }
    return;
  }
  if (sense === 'hear') {
    putPixel(out, width, height, cx + 3, cy, GREY_SHADOW, 255);
    putPixel(out, width, height, cx + 4, cy, CORE_TEAL.core, 255);
    return;
  }
  if (sense === 'narrow') {
    const tx = Math.cos(fa);
    const ty = Math.sin(fa);
    for (let d = -4; d <= 4; d++) {
      putPixel(out, width, height, Math.round(org.cx + tx * d), Math.round(org.cy + ty * d), CORE_TEAL.bright, 255);
    }
    return;
  }
  if (sense === 'touch') {
    putPixel(out, width, height, cx, cy + 6, CORE_TEAL.glow, 255);
    putPixel(out, width, height, cx, cy + 7, CORE_TEAL.core, 255);
    return;
  }
  if (sense === 'scent') {
    paintRim(out, width, height, org, CORE_TEAL.core);
    return;
  }
  if (sense === 'domain' || sense === 'reverse') {
    putPixel(out, width, height, cx, cy, CORE_TEAL.bright, 255);
    putPixel(out, width, height, cx + 1, cy, CORE_TEAL.bright, 255);
    putPixel(out, width, height, cx, cy + 1, CORE_TEAL.glow, 255);
  }
}

function punchHoles(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  recipe: DialectRecipe,
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

function paintVolume(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  recipe: DialectRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  seed: number,
): void {
  const vol = recipe.volume;
  if (!vol.enabled) return;
  const awake = pose.signal === 'awake';
  const dim = vol.dimUntilAwake && !awake;
  const alpha = dim ? Math.round(vol.alpha * 0.35) : vol.alpha;
  const fill = dim ? vol.fill * 0.45 : vol.fill;
  const signed = Math.sin(elapsedMs * CLUSTER_BREATH * recipe.rhythmScale);
  const pixShift = Math.round(signed * (recipe.motion === 'motion_wind' ? 4 : 2));
  const trail = recipe.motion === 'motion_trail' ? Math.round((elapsedMs * 0.012) % TILE) : 0;
  const inset = vol.insetTiles * TILE;
  const shift = vol.shiftTiles * TILE + pixShift + trail;
  const bandX0 = Math.max(0, shift);
  const bandX1 = Math.min(width, width - inset + shift);
  const deep = recipe.ramp.deep;
  const mid = recipe.ramp.mid;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < bandX0 || x >= bandX1) continue;
      const o = (y * width + x) * 4;
      if (out[o + 3]! > 0) continue;
      const cell = hash2(x + ((elapsedMs * 0.004) | 0), y, seed);
      if (cell > fill) continue;
      if ((x + y) % 2 === 1 && cell > fill * 0.65) continue;
      putPixel(out, width, height, x, y, cell > fill * 0.5 ? deep : mid, alpha);
    }
  }
}

export function paintLivingFrame(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  field: ClusterPulseField,
  organisms: LiveOrganism[],
  recipe: DialectRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  seed: number,
): void {
  const t = elapsedMs * recipe.rhythmScale;
  paintClusterBreath(out, width, height, field, t);
  punchHoles(out, width, height, recipe, seed);
  paintVolume(out, width, height, recipe, pose, t, seed);
  const awake = pose.signal === 'awake';
  const strike = pose.signal === 'strike';
  const inflated = pose.signal === 'inflated';
  const lunge = isLunge(recipe, pose, elapsedMs);
  const rim =
    (recipe.contactOnStrike && strike) ||
    (recipe.contactOnInflated && inflated) ||
    (recipe.contactOnLunge && lunge) ||
    (recipe.contactOnAwake && awake) ||
    recipe.sense === 'scent';
  const extraSeam = recipe.utteranceId === 'eye_in_the_seam';
  for (let i = 0; i < organisms.length; i++) {
    const org = organisms[i]!;
    paintCore(out, width, height, org, recipe, seed + i * 13);
    if (rim) paintRim(out, width, height, org, recipe.ramp.glow);
    if (i === 0) {
      paintSense(out, width, height, org, extraSeam ? 'narrow' : recipe.sense, pose.facing4, awake);
    }
  }
}

export function makePulseField(
  width: number,
  height: number,
  organisms: LiveOrganism[],
  recipe: DialectRecipe,
): ClusterPulseField {
  const land = new Uint8Array(width * height);
  land.fill(1);
  const walls = new Uint8Array(width * height);
  return {
    organisms: organisms as unknown as ClusterPulseField['organisms'],
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
