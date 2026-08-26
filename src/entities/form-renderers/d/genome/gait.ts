/**
 * 基因谱甲步态像素（I5-G 热修）。Phaser-free。
 * 挂载与 `check:jia-genome-pose` 经 `bakeJiaGenome` 走这一条。
 * 禁止 import `jia-pixels.ts`。
 *
 * 残茎：茎间空隙开合 ≤1px，不要黏膜蠕动、不要整团 squash。
 * 虫：整段足柱左右交替；髋少足端多，抬 2–3px、水平 1–2px，读得出多足横向走。
 * 哺乳动物：同一套剪影特征调走法（低身水平 squash、长肢高抬、撑开外移、直立两足+臂对侧），整段肢动，不抄虫、不整团 squash 交差。
 * 大号蠕虫：永远横躺；硬边分节沿横轴依次离地抬 2–3px（整节动），残余动词是拱，不是黏膜正弦、不是整团 squash、不是巡路滑步。
 * 有机残影 / 夹具：squash-stretch；渗透无 melt，改写/覆盖沿朝向 ±1px melt。
 */
import { INSECT_REMNANT_ID } from '@/entities/form-renderers/d/genome/insect-remnant';
import { MAMMAL_REMNANT_ID } from '@/entities/form-renderers/d/genome/mammal-remnant';
import { STALK_CLUMP_ID } from '@/entities/form-renderers/d/genome/stalk-clump';
import { WORM_REMNANT_ID } from '@/entities/form-renderers/d/genome/worm-remnant';
import { makeBuf, type PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Facing4 } from '@/types/game-types';

export type JiaGenomeGait = 'idle' | 'walk';

/** 与 `pingPongFrame` / 旧生产甲 walk 同 4 帧。 */
export const JIA_GENOME_WALK_FRAMES = 4;

/** 量级对照 `warpMotion` 的 WALK_SX/SY，不从 `jia-pixels.ts` 拉取。 */
const WALK_SX = [1, 1.1, 1, 0.9];
const WALK_SY = [1, 0.88, 1, 1.12];

const MELT_ALONG_FACING: Record<Facing4, { x: number; y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

export interface JiaGenomeGaitRequest {
  readonly substrate: string;
  readonly coverage: CoverageId;
  readonly facing: Facing4;
  readonly gait: JiaGenomeGait;
  readonly frame: number;
  readonly originX: number;
  readonly originY: number;
}

function isMeltRgb(r: number, g: number, b: number): boolean {
  return g > r + 18 && g > b - 8 && r < 90 && b < 180;
}

function copyPx(src: PaintBuf, dst: PaintBuf, i: number, nx: number, ny: number): void {
  if (nx < 0 || ny < 0 || nx >= dst.w || ny >= dst.h) return;
  const j = (ny * dst.w + nx) * 4;
  dst.data[j] = src.data[i]!;
  dst.data[j + 1] = src.data[i + 1]!;
  dst.data[j + 2] = src.data[i + 2]!;
  dst.data[j + 3] = src.data[i + 3]!;
}

function stalkWalkGap(src: PaintBuf, frame: number): PaintBuf {
  const amp = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  if (amp === 0) return src;
  const plateTop = Math.max(0, src.h - 3);
  let minX = src.w;
  let maxX = -1;
  for (let y = 0; y < plateTop; y++) {
    for (let x = 0; x < src.w; x++) {
      if ((src.data[(y * src.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0) return src;
  const split = (minX + maxX) >> 1;
  const dst = makeBuf(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      let nx = x;
      if (y < plateTop) {
        const move = minX === maxX ? x >= split : x > split;
        if (move) nx = x + amp;
      }
      copyPx(src, dst, i, nx, y);
    }
  }
  return dst;
}

function remnantWalk(
  src: PaintBuf,
  frame: number,
  facing: Facing4,
  originX: number,
  originY: number,
  melt: boolean,
): PaintBuf {
  const sx = WALK_SX[frame] ?? 1;
  const sy = WALK_SY[frame] ?? 1;
  const meltAmt = melt && (frame === 1 || frame === 3) ? (frame === 1 ? 1 : -1) : 0;
  if (sx === 1 && sy === 1 && meltAmt === 0) return src;
  const dir = MELT_ALONG_FACING[facing];
  const dst = makeBuf(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      let nx = Math.round(originX + (x - originX) * sx);
      let ny = Math.round(originY + (y - originY) * sy);
      if (
        meltAmt !== 0 &&
        isMeltRgb(src.data[i]!, src.data[i + 1]!, src.data[i + 2]!)
      ) {
        nx += dir.x * meltAmt;
        ny += dir.y * meltAmt;
      }
      copyPx(src, dst, i, nx, ny);
    }
  }
  return dst;
}

/**
 * 多足横向走：腹甲以下整段左右肢交替抬 2–3px、水平 1–2px（髋少、足端多，髋也动）。
 * 腹甲 lift 帧 1px 起伏。不拆茎间空隙，不整团 squash，不沿朝向 melt。
 */
function insectWalkStride(src: PaintBuf, frame: number): PaintBuf {
  const liftLeft = frame === 1;
  const liftRight = frame === 3;
  const plant = frame === 0 ? -1 : frame === 2 ? 1 : 0;
  if (!liftLeft && !liftRight && plant === 0) return src;

  let minX = src.w;
  let maxX = -1;
  let minY = src.h;
  let maxY = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if ((src.data[(y * src.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return src;
  const splitX = (minX + maxX) >> 1;
  const bodyH = Math.max(1, maxY - minY);
  const hipY = minY + Math.max(3, Math.floor(bodyH * 0.36));
  const legSpan = Math.max(1, maxY - hipY);
  const bob = liftLeft || liftRight ? -1 : 0;
  const dst = makeBuf(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      let nx = x;
      let ny = y;
      if (y < hipY) {
        ny = y + bob;
        copyPx(src, dst, i, nx, ny);
        continue;
      }
      const t = (y - hipY) / legSpan;
      const lift = 2 + Math.round(t);
      const slide = 1 + Math.round(t);
      const left = x <= splitX;
      if (liftLeft && left) {
        ny = y - lift;
        nx = x - slide;
      } else if (liftRight && !left) {
        ny = y - lift;
        nx = x + slide;
      } else if (plant !== 0) {
        nx = left ? x + plant * slide : x - plant * slide;
      }
      copyPx(src, dst, i, nx, ny);
    }
  }
  return dst;
}

function spanInBand(src: PaintBuf, y0: number, y1: number): { lo: number; hi: number; span: number } {
  let lo = src.w;
  let hi = -1;
  const top = Math.max(0, Math.min(y0, y1));
  const bot = Math.min(src.h - 1, Math.max(y0, y1));
  for (let y = top; y <= bot; y++) {
    for (let x = 0; x < src.w; x++) {
      if ((src.data[(y * src.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  }
  return { lo, hi, span: hi < 0 ? 0 : hi - lo + 1 };
}

/**
 * 按烤出来的剪影特征调同一套走法：低身水平多于抬、长肢抬 ≥3、撑开外移、直立两足+臂对侧。
 * 整段肢从髋到足端一起动。不要四套互不相干的假动画，不要脚尖，不要整团 squash 交差。
 */
function mammalWalkStride(src: PaintBuf, frame: number, facing: Facing4): PaintBuf {
  const liftA = frame === 1;
  const liftB = frame === 3;
  const plant = frame === 0 ? -1 : frame === 2 ? 1 : 0;
  if (!liftA && !liftB && plant === 0) return src;

  let minX = src.w;
  let maxX = -1;
  let minY = src.h;
  let maxY = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if ((src.data[(y * src.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return src;

  const bodyH = Math.max(1, maxY - minY);
  const bodyW = Math.max(1, maxX - minX + 1);
  const topSpan = spanInBand(src, minY + Math.floor(bodyH * 0.05), minY + Math.floor(bodyH * 0.22)).span;
  const midSpan = spanInBand(src, minY + Math.floor(bodyH * 0.32), minY + Math.floor(bodyH * 0.55)).span;
  const botSpan = spanInBand(src, minY + Math.floor(bodyH * 0.72), minY + Math.floor(bodyH * 0.95)).span;
  const upright = bodyH >= bodyW * 1.02 && midSpan >= botSpan * 0.8 && topSpan <= midSpan * 0.92;
  const splayed = !upright && botSpan >= midSpan + 2;
  const hipY = minY + Math.max(3, Math.floor(bodyH * (upright ? 0.56 : 0.4)));
  const longLimb = maxY - hipY >= Math.max(8, Math.floor(bodyH * 0.42));
  const lowBody = !upright && bodyW >= bodyH * 0.92 && !longLimb;
  const spanX = Math.max(1, bodyW);
  const midX = (minX + maxX) >> 1;
  const slideDir = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const bob = liftA || liftB ? -1 : 0;
  const dst = makeBuf(src.w, src.h);
  const squash = lowBody ? (frame === 1 ? 1.12 : frame === 3 ? 0.88 : 1) : 1;
  const liftBase = longLimb ? 3 : lowBody ? 1 : 2;
  const slide = lowBody ? 2 : 1;
  const splayAmt = splayed ? 1 + (lowBody ? 0 : 1) : 0;
  const armTop = minY + Math.floor(bodyH * 0.28);

  const binOf = (x: number): number => {
    const t = (x - minX) / spanX;
    return Math.min(3, Math.max(0, Math.floor(t * 4)));
  };

  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      let nx = x;
      let ny = y;
      if (upright) {
        if (y >= hipY) {
          const t = (y - hipY) / Math.max(1, maxY - hipY);
          const lift = 2 + Math.round(t);
          const left = x <= midX;
          if (liftA && left) ny = y - lift;
          else if (liftB && !left) ny = y - lift;
          else if (plant !== 0) nx = x + plant * (left ? -1 : 1);
        } else if (y >= armTop && (x <= minX + Math.floor(bodyW * 0.28) || x >= maxX - Math.floor(bodyW * 0.28))) {
          const left = x <= midX;
          if (liftA && !left) nx = x + 1;
          else if (liftB && left) nx = x - 1;
          else if (plant !== 0) nx = x + plant * (left ? 1 : -1);
        } else {
          ny = y + bob;
        }
        copyPx(src, dst, i, nx, ny);
        continue;
      }
      if (y < hipY) {
        ny = y + bob;
        copyPx(src, dst, i, nx, ny);
        continue;
      }
      if (squash !== 1) nx = Math.round(midX + (x - midX) * squash);
      const t = (y - hipY) / Math.max(1, maxY - hipY);
      const lift = liftBase + Math.round(t);
      const bin = binOf(x);
      const diagA = bin === 0 || bin === 2;
      const along = bin <= 1 ? -1 : 1;
      const outward = x <= midX ? -splayAmt : splayAmt;
      if (liftA && diagA) {
        ny = y - lift;
        nx += (slideDir || along) * slide + outward;
      } else if (liftB && !diagA) {
        ny = y - lift;
        nx += (slideDir || -along) * slide + outward;
      } else if (plant !== 0) {
        nx += plant * (slideDir || along) * slide + outward;
      }
      copyPx(src, dst, i, nx, ny);
    }
  }
  return dst;
}

/**
 * 拱：沿横长条依次把硬边分节离地抬 2–3px，整节一起动。
 * 所有朝向都按 X 切带、`ny = y - lift`。禁止竖长条往 +X 顶。
 * 禁止外沿正弦、禁止整团 squash 交差、禁止巡路滑步。
 */
function wormArchStride(src: PaintBuf, frame: number): PaintBuf {
  const peak = ((frame % JIA_GENOME_WALK_FRAMES) + JIA_GENOME_WALK_FRAMES) % JIA_GENOME_WALK_FRAMES;
  let minX = src.w;
  let maxX = -1;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if ((src.data[(y * src.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }
  if (maxX < 0) return src;
  const span = Math.max(1, maxX - minX + 1);
  const nBands = Math.min(4, Math.max(2, span));
  const neighbor = (peak + 1) % nBands;
  const dst = makeBuf(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      const t = (x - minX) / span;
      const band = Math.min(nBands - 1, Math.max(0, Math.floor(t * nBands)));
      let lift = 0;
      if (band === peak) lift = 3;
      else if (band === neighbor) lift = 2;
      copyPx(src, dst, i, x, y - lift);
    }
  }
  return dst;
}

export function applyJiaGenomeGait(src: PaintBuf, req: JiaGenomeGaitRequest): PaintBuf {
  if (req.gait !== 'walk') return src;
  const frame = ((req.frame % JIA_GENOME_WALK_FRAMES) + JIA_GENOME_WALK_FRAMES) % JIA_GENOME_WALK_FRAMES;
  if (req.substrate === STALK_CLUMP_ID) return stalkWalkGap(src, frame);
  if (req.substrate === INSECT_REMNANT_ID) return insectWalkStride(src, frame);
  if (req.substrate === MAMMAL_REMNANT_ID) return mammalWalkStride(src, frame, req.facing);
  if (req.substrate === WORM_REMNANT_ID) return wormArchStride(src, frame);
  const melt = req.coverage !== 'infiltrate';
  return remnantWalk(src, frame, req.facing, req.originX, req.originY, melt);
}
