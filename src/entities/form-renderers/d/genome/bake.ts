/**
 * 基因谱甲共用烘焙（I5-N / I5-G 热修）。挂载与 `check:jia-genome-pose` 必须走这一条。
 * 顺序：骨架 → 算子 → weld/漆 → 朝向可读与信号相 → 可走步态（默认 idle 静帧）。
 * 禁止把剪影烘进贴图后整图画布转 90°/180° 冒充四向。
 */
import { clusterModeOf } from '@/entities/form-renderers/d/jia-cluster-mode';
import { applyOperators } from '@/entities/form-renderers/d/genome/operators';
import {
  DOORFRAME_ID,
  buildDoorframeSkeleton,
} from '@/entities/form-renderers/d/genome/doorframe';
import { buildFixtureSkeleton } from '@/entities/form-renderers/d/genome/fixture';
import {
  INSECT_REMNANT_ID,
  buildInsectRemnantSkeleton,
} from '@/entities/form-renderers/d/genome/insect-remnant';
import {
  MAMMAL_REMNANT_ID,
  buildMammalRemnantSkeleton,
} from '@/entities/form-renderers/d/genome/mammal-remnant';
import {
  ORGANIC_REMNANT_ID,
  buildOrganicRemnantSkeleton,
} from '@/entities/form-renderers/d/genome/organic-remnant';
import {
  STALK_CLUMP_ID,
  buildStalkClumpSkeleton,
} from '@/entities/form-renderers/d/genome/stalk-clump';
import {
  STREET_WRECKAGE_ID,
  buildStreetWreckageSkeleton,
} from '@/entities/form-renderers/d/genome/street-wreckage';
import {
  WORM_REMNANT_ID,
  buildWormRemnantSkeleton,
} from '@/entities/form-renderers/d/genome/worm-remnant';
import { applyJiaGenomeGait, type JiaGenomeGait } from '@/entities/form-renderers/d/genome/gait';
import { DEFAULT_GENOME_INK } from '@/entities/form-renderers/d/genome/parts';
import { paintWeldedBody } from '@/entities/form-renderers/d/genome/weld';
import { makeBuf, px, type PaintBuf, type Rgba } from '@/entities/form-renderers/d/genome/buffer';
import type { GenomeCanvas, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { FormVisualSignal } from '@/entities/form-renderers/form-renderer';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Facing4 } from '@/types/game-types';

export interface JiaGenomeBakeRequest {
  readonly substrate: string;
  readonly coverage: CoverageId;
  readonly seed: number;
  readonly facing4: Facing4;
  readonly signal: FormVisualSignal;
  readonly sense?: string;
  /** 默认 idle，静帧。walk 由挂载按需烤，避免 attach 预烤全部步态。 */
  readonly gait?: JiaGenomeGait;
  readonly frame?: number;
}

export interface JiaGenomeBakeResult {
  readonly buf: PaintBuf;
  readonly canvas: GenomeCanvas;
}

const CORE_INK = DEFAULT_GENOME_INK.core;
const GLOW_INK = DEFAULT_GENOME_INK.glow;

function facingDelta(facing: Facing4): { x: number; y: number } {
  switch (facing) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
  }
}

function buildJiaGenomeSkeleton(req: JiaGenomeBakeRequest): GenomeSkeleton {
  if (req.substrate === STREET_WRECKAGE_ID) {
    return buildStreetWreckageSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  if (req.substrate === DOORFRAME_ID) {
    return buildDoorframeSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  if (req.substrate === STALK_CLUMP_ID) {
    return buildStalkClumpSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  if (req.substrate === ORGANIC_REMNANT_ID) {
    return buildOrganicRemnantSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  if (req.substrate === INSECT_REMNANT_ID) {
    return buildInsectRemnantSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  if (req.substrate === MAMMAL_REMNANT_ID) {
    return buildMammalRemnantSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  if (req.substrate === WORM_REMNANT_ID) {
    return buildWormRemnantSkeleton(req.coverage, req.seed, req.sense, req.facing4);
  }
  return buildFixtureSkeleton(req.coverage, req.seed, req.sense);
}

function isGlowAt(buf: PaintBuf, x: number, y: number): boolean {
  const i = (y * buf.w + x) * 4;
  return buf.data[i] === GLOW_INK[0] && buf.data[i + 1] === GLOW_INK[1] && buf.data[i + 2] === GLOW_INK[2];
}

function opaquePts(buf: PaintBuf): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      out.push({ x, y });
    }
  }
  return out;
}

function centroidOf(pts: readonly { x: number; y: number }[]): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

function isLeading(
  x: number,
  y: number,
  facing: Facing4,
  cx: number,
  cy: number,
): boolean {
  if (facing === 'left') return x <= cx - 2;
  if (facing === 'right') return x >= cx + 2;
  if (facing === 'up') return y <= cy - 2;
  return y >= cy + 2;
}

function forwardScore(x: number, y: number, facing: Facing4): number {
  if (facing === 'left') return -x;
  if (facing === 'right') return x;
  if (facing === 'up') return -y;
  return y;
}

function recolorForward(buf: PaintBuf, facing: Facing4, n: number, color: Rgba, skipGlow: boolean): void {
  const pts = opaquePts(buf).filter((p) => !skipGlow || !isGlowAt(buf, p.x, p.y));
  const pool = pts.length > 0 ? pts : opaquePts(buf);
  pool.sort((a, b) => forwardScore(b.x, b.y, facing) - forwardScore(a.x, a.y, facing));
  const take = Math.min(n, pool.length);
  for (let i = 0; i < take; i++) {
    const p = pool[i]!;
    px(buf, p.x, p.y, color);
  }
}

function copyInk(src: PaintBuf, x: number, y: number): Rgba {
  const i = (y * src.w + x) * 4;
  return [src.data[i] ?? 0, src.data[i + 1] ?? 0, src.data[i + 2] ?? 0, src.data[i + 3] ?? 0];
}

function translateOpaque(src: PaintBuf, dx: number, dy: number): PaintBuf {
  if (dx === 0 && dy === 0) return src;
  const dst = makeBuf(src.w, src.h);
  for (const p of opaquePts(src)) {
    px(dst, p.x + dx, p.y + dy, copyInk(src, p.x, p.y));
  }
  return dst;
}

/** 像素质心钉到碰撞原点。算子改过骨架之后仍以烤漆质心为准。 */
function pinOpaqueCentroid(src: PaintBuf, originX: number, originY: number): PaintBuf {
  const c = centroidOf(opaquePts(src));
  return translateOpaque(src, Math.round(originX - c.x), Math.round(originY - c.y));
}

function opaqueBoxOf(pts: readonly { x: number; y: number }[]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} | null {
  if (pts.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

function wormHeadIsLowX(facing: Facing4): boolean {
  return facing === 'left' || facing === 'up';
}

/**
 * 蠕虫信号相。朝向已在骨架里完成，禁止 `shearX * t`。
 * idle 静；awake 头段抬 1px 且整节改 glow；inflated 沿 Y 相对原点加厚 1px 且干环/体段改 core；
 * strike 头端沿朝向伸出 1–2px 且领先改 glow。渗透档也必须四相可分。
 */
function applyWormSignal(
  src: PaintBuf,
  facing: Facing4,
  signal: FormVisualSignal,
  canvas: GenomeCanvas,
): PaintBuf {
  const pinned = pinOpaqueCentroid(src, canvas.originX, canvas.originY);
  const grounded =
    facing === 'up' ? translateOpaque(pinned, 0, -1) : facing === 'down' ? translateOpaque(pinned, 0, 1) : pinned;
  const mode = clusterModeOf(signal);
  if (mode === 'patrol') return grounded;

  const pts = opaquePts(grounded);
  const box = opaqueBoxOf(pts);
  if (!box) return grounded;
  const span = box.x1 - box.x0 + 1;
  const headW = Math.max(3, Math.round(span * 0.32));
  const headLow = wormHeadIsLowX(facing);
  const dir = facingDelta(facing);
  const originY = canvas.originY;
  const dst = makeBuf(grounded.w, grounded.h);

  const isHeadPx = (x: number): boolean =>
    headLow ? x <= box.x0 + headW - 1 : x >= box.x1 - headW + 1;

  if (mode === 'chase') {
    for (const p of pts) {
      const ink = isHeadPx(p.x) ? GLOW_INK : copyInk(grounded, p.x, p.y);
      const ny = isHeadPx(p.x) ? p.y - 1 : p.y;
      px(dst, p.x, ny, ink);
    }
    return dst;
  }

  if (mode === 'search') {
    for (const p of pts) {
      const ink = isGlowAt(grounded, p.x, p.y) ? copyInk(grounded, p.x, p.y) : CORE_INK;
      px(dst, p.x, p.y, ink);
      const thicken = p.y < originY ? -1 : 1;
      px(dst, p.x, p.y + thicken, ink);
    }
    return dst;
  }

  const reach = 2;
  for (const p of pts) {
    const head = isHeadPx(p.x);
    const ink = head ? GLOW_INK : copyInk(grounded, p.x, p.y);
    px(dst, p.x, p.y, ink);
    if (!head) continue;
    px(dst, p.x + dir.x, p.y + dir.y, GLOW_INK);
    px(dst, p.x + dir.x * reach, p.y + dir.y * reach, GLOW_INK);
  }
  return dst;
}

/**
 * 朝向可读：左右直立剪影上半身侧移（不是画布旋转）。
 * 信号相：`idle` 不动像素；`strike` 前倾 1–2px、伸出侧 +2px、领先簇改 glow；
 * `awake` / `inflated` 走 `clusterModeOf` 换簇亮暗。
 * 蠕虫走 `applyWormSignal`，禁止套用直立剪影错切。
 */
function applyFacingAndSignal(
  src: PaintBuf,
  facing: Facing4,
  signal: FormVisualSignal,
  canvas: GenomeCanvas,
  substrate: string,
): PaintBuf {
  if (substrate === WORM_REMNANT_ID) {
    return applyWormSignal(src, facing, signal, canvas);
  }
  const mode = clusterModeOf(signal);
  const strike = mode === 'strike';
  if (mode === 'patrol' && facing === 'down') return src;

  const dir = facingDelta(facing);
  const shearX = facing === 'left' ? -2 : facing === 'right' ? 2 : 0;
  const strikeLean = strike ? 2 : 0;
  const strikeReach = strike ? 2 : 0;
  const pts = opaquePts(src);
  const c = centroidOf(pts);
  const originY = Math.max(1, canvas.originY);
  const dst = makeBuf(src.w, src.h);

  for (const p of pts) {
    const i = (p.y * src.w + p.x) * 4;
    const t = Math.max(0, Math.min(1, (originY - p.y) / originY));
    let nx = p.x + Math.round(shearX * t) + Math.round(dir.x * strikeLean * t);
    let ny = p.y + Math.round(dir.y * strikeLean * t);
    if (strike && isLeading(p.x, p.y, facing, c.x, c.y)) {
      nx += dir.x * strikeReach;
      ny += dir.y * strikeReach;
    }
    const ink: Rgba = [
      src.data[i] ?? 0,
      src.data[i + 1] ?? 0,
      src.data[i + 2] ?? 0,
      src.data[i + 3] ?? 0,
    ];
    px(dst, nx, ny, ink);
  }

  if (strike) recolorForward(dst, facing, 2, GLOW_INK, true);
  else if (mode === 'chase') recolorForward(dst, facing, 8, GLOW_INK, true);
  else if (mode === 'search') recolorForward(dst, facing, 4, CORE_INK, true);

  return dst;
}

export function bakeJiaGenome(req: JiaGenomeBakeRequest): JiaGenomeBakeResult {
  const sk = buildJiaGenomeSkeleton(req);
  applyOperators(sk, req.coverage, req.seed);
  const welded = paintWeldedBody(sk);
  const posed = applyFacingAndSignal(welded, req.facing4, req.signal, sk.canvas, req.substrate);
  const buf = applyJiaGenomeGait(posed, {
    substrate: req.substrate,
    coverage: req.coverage,
    facing: req.facing4,
    gait: req.gait ?? 'idle',
    frame: req.frame ?? 0,
    originX: sk.canvas.originX,
    originY: sk.canvas.originY,
  });
  return { buf, canvas: sk.canvas };
}
