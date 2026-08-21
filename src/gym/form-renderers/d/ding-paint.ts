/**
 * Scheme D 丁 painters. Soft SDF / 1px contours / kinked veins.
 * Forbidden: per-pixel hash fill, checkerboard skip, oil-film tiling.
 */
import type { FormVisualPose } from '@/gym/form-renderers/form-renderer';
import type { DingRecipe, ScatterVein } from '@/gym/form-renderers/d/ding-recipe';
import {
  breathScale,
  contourPoint,
  contourSteps,
  rimDistance,
  type CloudPose,
} from '@/gym/form-renderers/d/ding-cloud';
import type { Rgb } from '@/gym/form-renderers/d/fragment-ramp';

function put(out: Uint8ClampedArray, w: number, h: number, x: number, y: number, rgb: Rgb, a: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= w || iy >= h || a <= 0) return;
  const o = (iy * w + ix) * 4;
  const prev = out[o + 3]!;
  if (a < prev) return;
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
  out[o + 3] = a > 255 ? 255 : a;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function walkLine(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgb: Rgb,
  a: number,
): void {
  let ix = Math.round(x0);
  let iy = Math.round(y0);
  const tx = Math.round(x1);
  const ty = Math.round(y1);
  const dx = Math.abs(tx - ix);
  const dy = Math.abs(ty - iy);
  const sx = ix < tx ? 1 : -1;
  const sy = iy < ty ? 1 : -1;
  let err = dx - dy;
  while (true) {
    put(out, w, h, ix, iy, rgb, a);
    if (ix === tx && iy === ty) break;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      ix += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy += sy;
    }
  }
}

function mapVein(v: ScatterVein, cloud: CloudPose, shiftX: number, shiftY: number): {
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  bx: number;
  by: number;
} {
  return {
    ax: cloud.cx + v.ax * cloud.rx * cloud.breath + shiftX,
    ay: cloud.cy + v.ay * cloud.ry * cloud.breath + shiftY,
    kx: cloud.cx + v.kx * cloud.rx * cloud.breath + shiftX,
    ky: cloud.cy + v.ky * cloud.ry * cloud.breath + shiftY,
    bx: cloud.cx + v.bx * cloud.rx * cloud.breath + shiftX,
    by: cloud.cy + v.by * cloud.ry * cloud.breath + shiftY,
  };
}

function paintContour(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  cloud: CloudPose,
  recipe: DingRecipe,
  extraPx: number,
  rgb: Rgb,
  alpha: number,
): void {
  const steps = contourSteps(cloud.rx + extraPx, cloud.ry + extraPx);
  const step = (Math.PI * 2) / steps;
  for (let i = 0; i < steps; i++) {
    const p = contourPoint(i * step, cloud, recipe.harmonics, extraPx);
    put(out, w, h, p.x, p.y, rgb, alpha);
  }
}

function paintSoftVolume(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  cloud: CloudPose,
  recipe: DingRecipe,
  edgeA: number,
  coreA: number,
  hollow: boolean,
): void {
  const pad = 2;
  const x0 = Math.max(0, Math.floor(cloud.cx - cloud.rx * 1.25) - pad);
  const y0 = Math.max(0, Math.floor(cloud.cy - cloud.ry * 1.25) - pad);
  const x1 = Math.min(w - 1, Math.ceil(cloud.cx + cloud.rx * 1.25) + pad);
  const y1 = Math.min(h - 1, Math.ceil(cloud.cy + cloud.ry * 1.25) + pad);
  const innerCut = hollow ? 0.78 : 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = rimDistance(x, y, cloud, recipe.harmonics);
      if (d >= 1.04 || d < innerCut) continue;
      const t = smoothstep(0.28, 1.04, d);
      const a = Math.round(lerp(coreA, edgeA, t));
      if (a < 8) continue;
      const rgb = d < 0.42 ? recipe.mid : recipe.deep;
      put(out, w, h, x, y, rgb, a);
    }
  }
}

function paintEcho(out: Uint8ClampedArray, w: number, h: number, cloud: CloudPose, recipe: DingRecipe, elapsedMs: number, edgeA: number): void {
  paintSoftVolume(out, w, h, cloud, recipe, Math.round(edgeA * 0.35), Math.round(recipe.coreAlpha * 0.22), true);
  const n = recipe.echoRings;
  for (let i = 0; i < n; i++) {
    const lag = recipe.echoLagMs[i] ?? 0;
    const localBreath = breathScale(elapsedMs, recipe.breathPeriodMs, recipe.breathAmp, lag);
    const ringCloud: CloudPose = { ...cloud, breath: localBreath };
    const extra = i * recipe.echoSpacing;
    const rgb = i === 0 ? recipe.mid : recipe.core;
    const a = i === 0 ? edgeA : Math.max(70, edgeA - i * 18);
    paintContour(out, w, h, ringCloud, recipe, extra, rgb, a);
  }
}

function paintScatter(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  cloud: CloudPose,
  recipe: DingRecipe,
  elapsedMs: number,
): void {
  paintSoftVolume(out, w, h, cloud, recipe, 28, 48, true);
  const shift = Math.round(Math.sin((elapsedMs / recipe.breathPeriodMs) * Math.PI * 2) );
  const veins = recipe.veins;
  for (let i = 0; i < veins.length; i++) {
    const mapped = mapVein(veins[i]!, cloud, shift, 0);
    const rgb = i % 2 === 0 ? recipe.core : recipe.glow;
    walkLine(out, w, h, mapped.ax, mapped.ay, mapped.kx, mapped.ky, rgb, 210);
    walkLine(out, w, h, mapped.kx, mapped.ky, mapped.bx, mapped.by, rgb, 210);
  }
}

function paintSqueeze(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  cloud: CloudPose,
  recipe: DingRecipe,
  edgeA: number,
  coreA: number,
): void {
  paintSoftVolume(out, w, h, cloud, recipe, edgeA, coreA, false);
}

export function paintDingFrame(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  recipe: DingRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  cloud: CloudPose,
): void {
  out.fill(0);
  const awake = pose.signal === 'awake';
  const edgeA = awake ? Math.min(220, recipe.edgeAlpha + 28) : recipe.edgeAlpha;
  const coreA = awake ? Math.min(230, recipe.coreAlpha + 16) : recipe.coreAlpha;
  if (recipe.family === 'sound_echo') paintEcho(out, width, height, cloud, recipe, elapsedMs, edgeA);
  else if (recipe.family === 'light_scatter') paintScatter(out, width, height, cloud, recipe, elapsedMs);
  else paintSqueeze(out, width, height, cloud, recipe, edgeA, coreA);

  const coreLit = !recipe.reverseCore || awake;
  const coreA2 = coreLit ? (awake ? 255 : 180) : 36;
  const coreRgb = coreLit ? (awake ? recipe.glow : recipe.core) : recipe.deep;
  const cx = Math.round(cloud.cx);
  const cy = Math.round(cloud.cy);
  put(out, width, height, cx, cy, coreRgb, coreA2);
  put(out, width, height, cx + 1, cy, coreRgb, coreA2);
  put(out, width, height, cx, cy + 1, coreRgb, coreA2);
  put(out, width, height, cx + 1, cy + 1, awake ? recipe.glow : coreRgb, coreA2);
}
