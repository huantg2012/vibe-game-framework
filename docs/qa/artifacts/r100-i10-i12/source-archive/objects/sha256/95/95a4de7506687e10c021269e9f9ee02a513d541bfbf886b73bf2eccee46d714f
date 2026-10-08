/**
 * Old paint-skin live body (fungal mat / ash veil). Atmosphere ground breath
 * is off (DEC-104). Do not hang this on sortie / map-lesson floors.
 */
import {
  CLUSTER_PULSE_SAMPLES,
  isClusterFloor,
  type ClusterOrganism,
  type ClusterPulseField,
} from '@/generation/preview-paint';

const STEP = (Math.PI * 2) / CLUSTER_PULSE_SAMPLES;
/** Whole-blob breath. ~3.1s for a full inflate-deflate cycle. */
const BREATH = 0.002;
const MID_FRAC = 0.62;
const CORE_OVERLAP = 0.68;
const ALPHA_MID = 252;
const ALPHA_OUTER = 248;
const ALPHA_FLAKE = 240;

const supportR = new Float32Array(CLUSTER_PULSE_SAMPLES);
const outerR = new Float32Array(CLUSTER_PULSE_SAMPLES);
const coreR = new Float32Array(CLUSTER_PULSE_SAMPLES);

function clampWalk(
  field: ClusterPulseField,
  cx: number,
  cy: number,
  cos: number,
  sin: number,
  from: number,
  want: number,
): number {
  if (want <= from) return from;
  let r = from;
  for (let s = from + 0.5; s <= want; s += 0.5) {
    if (!isClusterFloor(field.land, field.walls, field.cols, field.rows, field.tile, cx + cos * s, cy + sin * s)) {
      break;
    }
    r = s;
  }
  return r;
}

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

function putPixel(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
  alpha: number,
): void {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const o = (y * width + x) * 4;
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
  out[o + 3] = alpha;
}

function paintFlakes(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  org: ClusterOrganism,
  signed: number,
  rgb: readonly [number, number, number],
): void {
  if (signed < 0.35) return;
  const fade = (signed - 0.35) / 0.65;
  const alpha = Math.round(ALPHA_FLAKE * fade);
  for (let i = 0; i < CLUSTER_PULSE_SAMPLES; i += 5) {
    const outer = outerR[i]!;
    const ang = i * STEP;
    putPixel(
      out,
      width,
      height,
      Math.round(org.cx + Math.cos(ang) * (outer + 1)),
      Math.round(org.cy + Math.sin(ang) * (outer + 1)),
      rgb,
      alpha,
    );
  }
}

export function paintClusterBreath(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  field: ClusterPulseField,
  elapsedMs: number,
): void {
  out.fill(0);
  for (const org of field.organisms) {
    const signed = Math.sin(elapsedMs * BREATH + org.phase);
    const scale = 1 + org.breathAmp * signed;
    let maxR = 0;
    for (let i = 0; i < CLUSTER_PULSE_SAMPLES; i++) {
      const ang = i * STEP;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const core = org.coreRest[i]!;
      const shape = org.shapeRest[i]!;
      const outerWant = Math.max(core + 1.5, shape * scale);
      const midWant = core + (outerWant - core) * MID_FRAC;
      const mid = clampWalk(field, org.cx, org.cy, cos, sin, core, midWant);
      const outer = clampWalk(field, org.cx, org.cy, cos, sin, mid, Math.max(mid + 1, outerWant));
      coreR[i] = core;
      supportR[i] = mid;
      outerR[i] = outer;
      if (outer > maxR) maxR = outer;
    }

    const reach = Math.ceil(maxR) + 1;
    const x0 = Math.max(0, Math.floor(org.cx) - reach);
    const y0 = Math.max(0, Math.floor(org.cy) - reach);
    const x1 = Math.min(width - 1, Math.ceil(org.cx) + reach);
    const y1 = Math.min(height - 1, Math.ceil(org.cy) + reach);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - org.cx;
        const dy = y + 0.5 - org.cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.2) continue;
        let ang = Math.atan2(dy, dx);
        if (ang < 0) ang += Math.PI * 2;
        const core = radiusAt(coreR, ang);
        if (dist <= core * CORE_OVERLAP) continue;
        const outer = radiusAt(outerR, ang);
        if (dist > outer) continue;
        if (!isClusterFloor(field.land, field.walls, field.cols, field.rows, field.tile, x, y)) {
          continue;
        }
        const mid = radiusAt(supportR, ang);
        if (dist <= mid) putPixel(out, width, height, x, y, field.mid, ALPHA_MID);
        else putPixel(out, width, height, x, y, field.deep, ALPHA_OUTER);
      }
    }
    paintFlakes(out, width, height, org, signed, field.glow);
  }
}
