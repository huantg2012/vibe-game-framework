/**
 * 占漆活层：沿生长方向连续扩散 / 收缩，不是绕画布中心拉伸。
 * 树末端沿支脉外探；环沿径向改环宽；团沿瓣相位鼓 / 收。
 * 油膜三变体（传了 veinVariant 时）：聚珠逐珠径向错相；沾抹沿抹向伸收；薄滩径向胀缩 + 峰值提亮弯月边。
 * 核点钉在静帧位置。禁止 4 帧切换、禁止换 shader。
 */
import {
  colorPaintField,
  PAINT_CORE_LO,
  type PaintGrowthGuide,
} from '@/entities/form-renderers/d/paint-genome/bake';
import type { FragmentContamRamp, Rgb } from '@/entities/form-renderers/d/fragment-ramp';

/** Same coefficient as `cluster-pulse.ts` BREATH. ~3.1s inflate-deflate. */
export const PAINT_BREATH = 0.002;
/** Inflated half-cycle for step-chaos +2/+4. Host billing reads this, not the old whole-map pulse. */
export const PAINT_INFLATED_SIN = 0.35;

/** Billing / visual signal. Phase is `elapsedMs * PAINT_BREATH + offset`. */
export function isPaintInflated(phase: number): boolean {
  return Math.sin(phase) > PAINT_INFLATED_SIN;
}
/** Idle ~8% (DEC-070 5–20%). Not a coverage slider. */
export const PAINT_IDLE_AMP = 0.08;
/** Inflated ~18%, still under the 20% cap. Amplitude only — same ramp. */
export const PAINT_INFLATED_AMP = 0.18;

/** Shared breath vs per-bead phase offset. t=0 stays rest (bead term subtracts sin(φ)). */
const BEAD_GROUP_MIX = 0.58;
const BEAD_PHASE_MIX = 0.28;
/** Golden angle so neighbouring beads do not share a phase. */
const BEAD_PHASE_STEP = 2.399963229728653;
/** Rim-pool edge lift starts late in the inflate half-cycle; only the silhouette, not the film. */
const RIM_LIFT_START = 0.2;
const RIM_LIFT_MAX = 0.18;

export interface PaintLiveArgs {
  readonly rest: Float32Array;
  readonly scratch: Float32Array;
  readonly out: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
  readonly elapsedMs: number;
  readonly inflated: boolean;
  readonly ramp: FragmentContamRamp;
  readonly growth: PaintGrowthGuide;
}

function sampleField(field: Float32Array, w: number, h: number, px: number, py: number): number {
  if (px < 0 || py < 0 || px > w - 1 || py > h - 1) {
    const ix = Math.round(px);
    const iy = Math.round(py);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return 0;
    return field[iy * w + ix]!;
  }
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = px - x0;
  const ty = py - y0;
  const a = field[y0 * w + x0]!;
  const b = field[y0 * w + x1]!;
  const c = field[y1 * w + x0]!;
  const d = field[y1 * w + x1]!;
  return a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
}

function hasEmptyNeighbor(field: Float32Array, w: number, h: number, x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return true;
  const i = y * w + x;
  return field[i - 1]! < 0.1 || field[i + 1]! < 0.1 || field[i - w]! < 0.1 || field[i + w]! < 0.1;
}

function sampleRadial(
  dst: Float32Array,
  src: Float32Array,
  w: number,
  h: number,
  i: number,
  x: number,
  y: number,
  ox: number,
  oy: number,
  signedLocal: number,
  amp: number,
  span: number,
): void {
  const dx = x + 0.5 - ox;
  const dy = y + 0.5 - oy;
  const r2 = dx * dx + dy * dy;
  if (r2 <= 1e-8) {
    dst[i] = src[i]!;
    return;
  }
  const r = Math.sqrt(r2);
  const t = Math.min(1, r / Math.max(1, span));
  const disp = signedLocal * amp * span * t * t;
  dst[i] = sampleField(src, w, h, x - (dx / r) * disp, y - (dy / r) * disp);
}

function beadSigned(elapsedMs: number, signed: number, unit: number): number {
  const phase = unit * BEAD_PHASE_STEP;
  const shifted = Math.sin(elapsedMs * PAINT_BREATH + phase) - Math.sin(phase);
  let local = signed * BEAD_GROUP_MIX + shifted * BEAD_PHASE_MIX;
  if (local > 1) local = 1;
  if (local < -1) local = -1;
  return local;
}

function liftPaintRim(field: Float32Array, w: number, h: number, signed: number): void {
  if (signed <= RIM_LIFT_START) return;
  const lift = ((signed - RIM_LIFT_START) / (1 - RIM_LIFT_START)) * RIM_LIFT_MAX;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (field[i]! < 0.1) continue;
      if (!hasEmptyNeighbor(field, w, h, x, y)) continue;
      const next = field[i]! + lift;
      field[i] = next > 1 ? 1 : next;
    }
  }
}

function pinCores(
  dst: Float32Array,
  src: Float32Array,
  w: number,
  h: number,
  rimPool: boolean,
): void {
  const n = w * h;
  for (let i = 0; i < n; i++) {
    const rest = src[i]!;
    if (rimPool) {
      const x = i % w;
      const y = (i / w) | 0;
      const rim = rest >= 0.1 && hasEmptyNeighbor(src, w, h, x, y);
      if (rest >= PAINT_CORE_LO && !rim) dst[i] = rest;
      else if (!rim && dst[i]! >= PAINT_CORE_LO) dst[i] = PAINT_CORE_LO - 0.01;
      continue;
    }
    if (rest >= PAINT_CORE_LO) dst[i] = rest;
    else if (dst[i]! >= PAINT_CORE_LO) dst[i] = PAINT_CORE_LO - 0.01;
  }
}

function deformAlongGrowth(
  dst: Float32Array,
  src: Float32Array,
  w: number,
  h: number,
  signed: number,
  amp: number,
  elapsedMs: number,
  growth: PaintGrowthGuide,
): void {
  if (Math.abs(signed * amp) < 1e-8 && growth.veinVariant !== 3) {
    dst.set(src);
    return;
  }
  const topo = growth.topology;
  const variant = growth.veinVariant;
  const phi = growth.senseAngle;
  const cs = Math.cos(phi);
  const sn = Math.sin(phi);
  const lobes = growth.lobeCount;
  const unitIndex = growth.unitIndex;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const u = unitIndex[i]!;
      const ox = growth.ox[u]!;
      const oy = growth.oy[u]!;
      if (topo === 'vein_tree' && variant === 3) {
        sampleRadial(dst, src, w, h, i, x, y, ox, oy, beadSigned(elapsedMs, signed, u), amp, growth.span[u]!);
        continue;
      }
      if (topo === 'vein_tree' && variant === 5) {
        sampleRadial(dst, src, w, h, i, x, y, ox, oy, signed, amp, growth.span[u]!);
        continue;
      }
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      if (topo === 'vein_tree') {
        const along = dx * cs + dy * sn;
        const perp = -dx * sn + dy * cs;
        const span = Math.max(1, growth.span[u]!);
        const t = along <= 0 ? 0 : Math.min(1, along / span);
        const falloff = variant === 4 ? t : t * t;
        const disp = signed * amp * span * falloff;
        const srcAlong = along - disp;
        dst[i] = sampleField(
          src,
          w,
          h,
          ox + srcAlong * cs - perp * sn - 0.5,
          oy + srcAlong * sn + perp * cs - 0.5,
        );
        continue;
      }
      const r2 = dx * dx + dy * dy;
      if (r2 <= 1e-8) {
        dst[i] = src[i]!;
        continue;
      }
      const r = Math.sqrt(r2);
      const ux = dx / r;
      const uy = dy / r;
      let disp = 0;
      if (topo === 'holed_veil') {
        const inner = growth.innerR[u]!;
        const outer = Math.max(inner + 1, growth.outerR[u]!);
        const mid = 0.5 * (inner + outer);
        const half = Math.max(1, 0.5 * (outer - inner));
        const edge = Math.min(1, Math.abs(r - mid) / half);
        const side = r >= mid ? 1 : -1;
        disp = signed * amp * outer * edge * side;
      } else {
        const span = Math.max(1, growth.span[u]!);
        const t = Math.min(1, r / span);
        const phase = Math.cos(lobes * Math.atan2(dy, dx) + phi);
        disp = signed * amp * span * phase * t * t;
      }
      dst[i] = sampleField(src, w, h, x - ux * disp, y - uy * disp);
    }
  }
  pinCores(dst, src, w, h, variant === 5);
  if (variant === 5) liftPaintRim(dst, w, h, signed);
}

function tryFlake(out: Uint8ClampedArray, j: number, glow: Rgb, alpha: number): boolean {
  if ((out[j + 3] ?? 0) !== 0) return false;
  out[j] = glow[0];
  out[j + 1] = glow[1];
  out[j + 2] = glow[2];
  out[j + 3] = alpha;
  return true;
}

function paintRimFlakes(
  out: Uint8ClampedArray,
  w: number,
  h: number,
  signed: number,
  glow: Rgb,
): void {
  if (signed < PAINT_INFLATED_SIN) return;
  const alpha = Math.round(240 * ((signed - PAINT_INFLATED_SIN) / 0.65));
  const row = w * 4;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if ((out[i + 3] ?? 0) === 0) continue;
      if ((x * 13 + y * 7) % 5 !== 0) continue;
      if (tryFlake(out, i - 4, glow, alpha)) continue;
      if (tryFlake(out, i + 4, glow, alpha)) continue;
      if (tryFlake(out, i - row, glow, alpha)) continue;
      tryFlake(out, i + row, glow, alpha);
    }
  }
}

/** Paint one live frame into preallocated `out` / `scratch`. No heap alloc. */
export function paintPaintGenomeLive(args: PaintLiveArgs): void {
  const signed = Math.sin(args.elapsedMs * PAINT_BREATH);
  const amp = args.inflated ? PAINT_INFLATED_AMP : PAINT_IDLE_AMP;
  deformAlongGrowth(
    args.scratch,
    args.rest,
    args.w,
    args.h,
    signed,
    amp,
    args.elapsedMs,
    args.growth,
  );
  colorPaintField(args.out, args.scratch, args.w, args.h, args.ramp);
  paintRimFlakes(args.out, args.w, args.h, signed, args.ramp.glow);
}
