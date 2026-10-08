/**
 * I5-L 热修：哺乳动物骨架语法。一行基体，共用连续轴采样。
 * 猫科 / 鹿科 / 爬行 / 类人是圆上重叠盆地，对照街具残骸 spread/lift。
 * 相位 mix32(seed, 'mammal_remnant:phase') 把小整数种子打散，再加噪声；
 * 不是 % 3 / % 4，不是四条手写剪影表。
 * 直立度高 → 前肢改成侧伸臂；撑开高且非直立 → 肢向两侧；肢/躯干比高 → 鹿；其余低身长尾 → 猫。
 * 基体侧骸骨 / 干尸；禁止 flesh。算子 / weld / 漆由调用方接。
 */
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { genomeCanvasOf } from '@/entities/form-renderers/d/genome/canvas';
import { applyOperators } from '@/entities/form-renderers/d/genome/operators';
import { paintWeldedBody } from '@/entities/form-renderers/d/genome/weld';
import type { PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import type { GenomeMat, GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Facing4 } from '@/types/game-types';

export const MAMMAL_REMNANT_ID = 'mammal_remnant' as const;

/** 猫科 / 鹿科 / 爬行 / 类人。与布局同一套轴，不是目录另写的假剪影。 */
export type MammalNeighborhoodId = 'cat' | 'deer' | 'crawler' | 'humanoid';

export const MAMMAL_NEIGHBORHOODS: readonly MammalNeighborhoodId[] = [
  'cat',
  'deer',
  'crawler',
  'humanoid',
];

export const MAMMAL_NEIGHBORHOOD_LABEL: Record<MammalNeighborhoodId, string> = {
  cat: '猫科',
  deer: '鹿科',
  crawler: '爬行',
  humanoid: '类人',
};

export function mammalHallId(hood: MammalNeighborhoodId): string {
  return `${MAMMAL_REMNANT_ID}:${hood}`;
}

export function mammalNeighborhoodFromHallId(hallId: string): MammalNeighborhoodId | null {
  if (!hallId.startsWith(`${MAMMAL_REMNANT_ID}:`)) return null;
  const hood = hallId.slice(MAMMAL_REMNANT_ID.length + 1);
  return MAMMAL_NEIGHBORHOODS.includes(hood as MammalNeighborhoodId)
    ? (hood as MammalNeighborhoodId)
    : null;
}

const HARD_MATS: readonly GenomeMat[] = ['bone', 'concrete', 'metal'];
const LEG_MATS: readonly GenomeMat[] = ['bone', 'metal', 'metalMid'];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function wrapUnit(t: number): number {
  return t - Math.floor(t);
}

function circDist(a: number, b: number): number {
  const d = Math.abs(wrapUnit(a) - wrapUnit(b));
  return Math.min(d, 1 - d);
}

export interface MammalAxes {
  lowness: number;
  limbRatio: number;
  splay: number;
  upright: number;
  tailAmt: number;
  headRatio: number;
  leanAmt: number;
}

/**
 * 圆上四个重叠盆地（猫 / 鹿 / 爬 / 类人）。权重随相位连续，邻域可交叠。
 * 类人盆地更窄，厅里默认脸不是直立两足。
 */
function basinWeights(phase: number): { cat: number; deer: number; crawler: number; humanoid: number } {
  const sigma = 0.1;
  const twoSig = 2 * sigma * sigma;
  const hill = (center: number): number => {
    const d = circDist(phase, center);
    return Math.exp(-(d * d) / twoSig);
  };
  const cat = hill(0.18);
  const deer = hill(0.38);
  const crawler = hill(0.58);
  const humanoid = hill(0.86);
  const sum = cat + deer + crawler + humanoid;
  return { cat: cat / sum, deer: deer / sum, crawler: crawler / sum, humanoid: humanoid / sum };
}

export function sampleMammalAxes(seed: number, rng: SeededRandom): MammalAxes {
  const phase = wrapUnit(mix32(seed, 'mammal_remnant:phase') / 4294967296 + (rng.next() - 0.5) * 0.08);
  const w = basinWeights(phase);
  const n = (scale: number): number => (rng.next() - 0.5) * scale;
  return {
    lowness: clamp01(w.cat * 0.9 + w.deer * 0.28 + w.crawler * 0.5 + w.humanoid * 0.22 + n(0.08)),
    limbRatio: clamp01(w.cat * 0.16 + w.deer * 0.86 + w.crawler * 0.36 + w.humanoid * 0.46 + n(0.08)),
    splay: clamp01(w.cat * 0.14 + w.deer * 0.18 + w.crawler * 0.86 + w.humanoid * 0.32 + n(0.08)),
    upright: clamp01(w.cat * 0.14 + w.deer * 0.24 + w.crawler * 0.18 + w.humanoid * 0.86 + n(0.08)),
    tailAmt: clamp01(w.cat * 0.9 + w.deer * 0.16 + w.crawler * 0.84 + w.humanoid * 0.06 + n(0.08)),
    headRatio: clamp01(w.cat * 0.52 + w.deer * 0.18 + w.crawler * 0.4 + w.humanoid * 0.5 + n(0.1)),
    leanAmt: clamp01(0.2 + rng.next() * 0.6),
  };
}

/**
 * 与 `layoutMammalNodes` 同一套轴：直立度高 → 类人，撑开高且非直立 → 爬行，
 * 肢/躯干比高 → 鹿，其余 → 猫。不是 % 4，也不是测量剪影另判。
 */
export function mammalHoodFromAxes(axes: MammalAxes): MammalNeighborhoodId {
  if (axes.upright > 0.58) return 'humanoid';
  if (axes.splay > 0.52) return 'crawler';
  if (axes.limbRatio > 0.55) return 'deer';
  return 'cat';
}

export function mammalNeighborhoodOf(seed: number): MammalNeighborhoodId {
  const rng = new SeededRandom(mix32(seed, 'mammal_remnant:layout'));
  return mammalHoodFromAxes(sampleMammalAxes(seed, rng));
}

/** 身低且肢短时压扁躯干、封短肢。连续轴，不是邻域 if 身份。 */
function flattenLowTorso(
  torsoW: number,
  torsoH: number,
  lowness: number,
  limbRatio: number,
  splayOut: boolean,
  maxW: number,
): { torsoW: number; torsoH: number } {
  if (splayOut || lowness <= 0.42 || limbRatio >= 0.52) return { torsoW, torsoH };
  const flatH = Math.min(torsoH, 5);
  return { torsoW: Math.max(torsoW, Math.min(flatH + 2, maxW)), torsoH: flatH };
}

function capLimbLen(len: number, avail: number, lowness: number, limbRatio: number, splayOut: boolean): number {
  if (splayOut) return clamp(len, 4, avail);
  const cap = clamp(Math.round(4 + limbRatio * 14 + (1 - lowness) * 8), 4, avail);
  return clamp(Math.min(len, cap), 4, avail);
}

function sitLowTorsoY(
  torsoY: number,
  torsoH: number,
  groundY: number,
  lowness: number,
  limbRatio: number,
  splayOut: boolean,
  minY: number,
  maxY: number,
): number {
  if (splayOut || lowness <= 0.42 || limbRatio >= 0.52) return torsoY;
  const cap = capLimbLen(20, 20, lowness, limbRatio, false);
  return clamp(Math.max(torsoY, groundY - cap - torsoH + 1), minY, maxY);
}

function pickMat(rng: SeededRandom, pool: readonly GenomeMat[]): GenomeMat {
  const t = rng.next();
  if (t < 0.34) return pool[0]!;
  if (t < 0.67) return pool[1]!;
  return pool[2]!;
}

function ensureLimbSpread(hs: number[]): void {
  if (hs.length < 2) return;
  let maxH = Math.max(...hs);
  let minH = Math.min(...hs);
  if (maxH - minH >= 2) return;
  const maxI = hs.indexOf(maxH);
  const minI = hs.indexOf(minH);
  if (minI !== maxI) hs[minI] = Math.max(2, maxH - 2);
  minH = Math.min(...hs);
  maxH = Math.max(...hs);
  if (maxH - minH < 2) hs[maxI] = minH + 2;
}

function tailPixels(lowness: number, limbRatio: number, splay: number, upright: number, tailAmt: number): number {
  if (upright > 0.58) return 0;
  const splayOut = splay > 0.52;
  const deerish = limbRatio > 0.55 && !splayOut;
  const catish = lowness > 0.38 && limbRatio < 0.55 && !splayOut;
  let t = tailAmt;
  if (splayOut) t = Math.max(t, 0.68);
  if (catish) t = Math.max(t, 0.68);
  if (deerish) t = Math.min(t, 0.38);
  if (t <= 0.28) return 0;
  return 2 + Math.round(t * 5);
}

function layoutMammalNodes(w: number, h: number, seed: number, facing: Facing4): GenomeNode[] {
  const rng = new SeededRandom(mix32(seed, 'mammal_remnant:layout'));
  const axes = sampleMammalAxes(seed, rng);
  const lowness = axes.lowness;
  const limbRatio = axes.limbRatio;
  const splay = axes.splay;
  const upright = axes.upright;
  const tailAmt = axes.tailAmt;
  const headRatio = axes.headRatio;
  const leanAmt = axes.leanAmt;
  const farScale = 0.7 + rng.next() * 0.14;
  const jitter = rng.nextInt(-1, 1);
  const filamentRoll = rng.next();
  const antlerRoll = rng.next();
  const torsoMat = pickMat(rng, HARD_MATS);
  const headMat = pickMat(rng, HARD_MATS);
  const limbMats: GenomeMat[] = [
    pickMat(rng, LEG_MATS),
    pickMat(rng, LEG_MATS),
    pickMat(rng, LEG_MATS),
    pickMat(rng, LEG_MATS),
  ];

  const hood = mammalHoodFromAxes(axes);
  const armsOut = hood === 'humanoid';
  const splayOut = hood === 'crawler';
  const lean = Math.round(leanAmt * 3);
  const tailLen = tailPixels(lowness, limbRatio, splay, upright, tailAmt);
  const antlers =
    !armsOut && limbRatio > 0.55 && headRatio < 0.48 && antlerRoll > 0.32 ? (antlerRoll > 0.66 ? 2 : 1) : 0;
  const gaitPad = 2;
  const groundY = h - 2;
  const sideView = facing === 'left' || facing === 'right';
  const parts: GenomeNode[] = [];

  const addLimb = (x: number, y: number, lw: number, lh: number, mat: GenomeMat): void => {
    const px = clamp(x, 0, w - lw);
    const ph = clamp(lh, 2, Math.max(2, h - 2));
    const py = clamp(Math.min(y, h - ph), 0, h - ph);
    parts.push({
      kind: 'post',
      x: px,
      y: py,
      w: lw,
      h: ph,
      mat,
      role: 'limb',
    });
  };

  const addHip = (fromX: number, toX: number, y: number, mat: GenomeMat): void => {
    const x0 = Math.min(fromX, toX);
    const x1 = Math.max(fromX, toX);
    if (x1 <= x0) return;
    parts.push({
      kind: 'beam',
      x: clamp(x0, 0, w - 1),
      y: clamp(y, 0, h - 1),
      w: clamp(x1 - x0 + 1, 1, w),
      h: 1,
      mat,
      role: 'rib',
    });
  };

  if (armsOut) {
    const towardX = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
    const towardY = facing === 'down' ? 1 : facing === 'up' ? -1 : 0;
    const torsoW = clamp(6 + Math.round((1 - lowness) * 2), 6, w <= 32 ? 8 : 10);
    const torsoH = clamp(7 + Math.round(upright * 2) + (h > 32 ? 2 : 0), 7, h <= 32 ? 10 : 14);
    const headW = clamp(3 + Math.round(headRatio * 2), 3, Math.min(5, torsoW - 1));
    const headH = clamp(3 + Math.round(headRatio * 2), 3, 5);
    const cx = clamp(Math.floor(w / 2) + towardX * lean + jitter, gaitPad + 6, w - gaitPad - 6);
    const headY = clamp(2 + (h > 32 ? 1 : 0) + (towardY > 0 ? 1 : 0), 1, 6);
    const torsoY = headY + headH - 1;
    const torsoX = clamp(cx - Math.floor(torsoW / 2), gaitPad, w - torsoW - gaitPad);
    const headX = clamp(cx - Math.floor(headW / 2) + towardX * (1 + (lean > 1 ? 1 : 0)), gaitPad, w - headW - gaitPad);
    const attachY = torsoY + torsoH - 1;
    const avail = Math.max(6, groundY - attachY);
    const footA = clamp(Math.round(avail * (0.68 + limbRatio * 0.26)), 6, avail);
    const footB = clamp(Math.round(footA * farScale), 5, Math.max(5, footA - 2));
    const stance = 2 + Math.round(splay * 2);
    const footLX = clamp(torsoX + 1 - (facing === 'left' ? 1 : 0), gaitPad, w - 2);
    const footRX = clamp(torsoX + torsoW - 2 + (facing === 'right' ? 1 : 0), footLX + stance, w - 2);
    const armY = clamp(torsoY + 1 + Math.round((torsoH - 3) * 0.32) + (towardY > 0 ? 1 : 0), torsoY, torsoY + torsoH - 2);
    const armBase = 3 + Math.round((0.35 + splay * 0.45) * (w <= 32 ? 2 : 3));
    const armL = clamp(armBase + (facing === 'left' ? 1 : 0), 3, 6);
    const armR = clamp(armBase + (facing === 'right' ? 1 : 0) + (farScale < 0.78 ? -1 : 1), 3, 6);

    parts.push({
      kind: 'mass',
      x: torsoX,
      y: torsoY,
      w: torsoW,
      h: torsoH,
      mat: torsoMat,
      role: 'spine',
    });
    parts.push({
      kind: 'mass',
      x: headX,
      y: headY,
      w: headW,
      h: headH,
      mat: headMat,
      role: 'head',
    });
    parts.push({
      kind: 'post',
      x: clamp(cx, 0, w - 1),
      y: clamp(headY + headH - 1, 0, h - 2),
      w: 1,
      h: 2,
      mat: 'bone',
      role: 'rib',
    });

    addLimb(torsoX - armL + 1, armY, armL, 2, limbMats[0]!);
    addLimb(torsoX + torsoW - 1, armY, armR, 2, limbMats[1]!);
    addLimb(footLX, attachY, 1, footA, limbMats[2]!);
    addLimb(footRX, attachY, 1, footB, limbMats[3]!);
  } else if (sideView) {
    const toward = facing === 'left' ? -1 : 1;
    let torsoW = clamp(7 + Math.round(lowness * 2 + (splayOut ? 3 : 0) + (w <= 32 ? 0 : 2)), 7, Math.max(7, w - 14));
    let torsoH = clamp(3 + Math.round((1 - lowness) * 3 + (1 - upright) * 1), 3, h <= 32 ? 6 : 8);
    if (limbRatio > 0.55 && !splayOut) {
      torsoW = Math.min(torsoW, w <= 32 ? 8 : 9);
      torsoH = Math.min(torsoH, 5);
    }
    const flatSide = flattenLowTorso(torsoW, torsoH, lowness, limbRatio, splayOut, w <= 32 ? 9 : 11);
    torsoW = flatSide.torsoW;
    torsoH = flatSide.torsoH;
    let headW = clamp(3 + Math.round(headRatio * (w <= 32 ? 2 : 3)), 3, 6);
    let headH = clamp(3 + Math.round(headRatio * 2), 3, 5);
    if (headW >= torsoW) headW = Math.max(3, torsoW - 2);
    if (headH > torsoH) headH = torsoH;

    const bodyW = headW + torsoW - 1;
    const minCx = gaitPad + Math.floor(bodyW / 2);
    const maxCx = w - gaitPad - Math.ceil(bodyW / 2);
    const cx = clamp(Math.floor(w / 2) + toward * lean + jitter, minCx, Math.max(minCx, maxCx));
    let headX: number;
    let torsoX: number;
    if (facing === 'left') {
      headX = clamp(cx - Math.floor(bodyW / 2), gaitPad, w - bodyW - gaitPad);
      torsoX = headX + headW - 1;
    } else {
      torsoX = clamp(cx - Math.floor(bodyW / 2), gaitPad, w - bodyW - gaitPad);
      headX = torsoX + torsoW - 1;
    }

    const minLimb = splayOut ? 4 : 4 + Math.round(limbRatio * 5);
    const maxTorsoY = groundY - minLimb - 1;
    const slackY = Math.max(0, maxTorsoY - torsoH + 1 - 2);
    let torsoY = clamp(
      2 + Math.round(lowness * slackY) - Math.round(limbRatio * 2) - (h <= 32 ? 0 : 1),
      2,
      Math.max(2, maxTorsoY - torsoH + 1),
    );
    torsoY = sitLowTorsoY(
      torsoY,
      torsoH,
      groundY,
      lowness,
      limbRatio,
      splayOut,
      2,
      Math.max(2, maxTorsoY - torsoH + 1),
    );
    const headY = clamp(
      torsoY + Math.round((torsoH - headH) * 0.35) + (lean > 0 ? 1 : 0),
      1,
      torsoY + torsoH - 2,
    );

    parts.push({
      kind: 'mass',
      x: torsoX,
      y: torsoY,
      w: torsoW,
      h: torsoH,
      mat: torsoMat,
      role: 'spine',
    });
    parts.push({
      kind: 'mass',
      x: headX,
      y: headY,
      w: headW,
      h: headH,
      mat: headMat,
      role: 'head',
    });
    const joinX = facing === 'left' ? torsoX : headX;
    parts.push({
      kind: 'post',
      x: clamp(joinX, 0, w - 1),
      y: clamp(Math.min(headY + Math.floor(headH / 2), torsoY + torsoH - 1), 0, h - 2),
      w: 1,
      h: 2,
      mat: 'bone',
      role: 'rib',
    });

    const attachY = torsoY + torsoH - 1;
    const avail = Math.max(splayOut ? 4 : 5, groundY - attachY);
    const wantLen = Math.round(avail * (0.55 + limbRatio * 0.38 - lowness * 0.4));
    const baseLen = capLimbLen(wantLen, avail, lowness, limbRatio, splayOut);
    const nearLen = baseLen;
    const farLen = capLimbLen(Math.round(baseLen * farScale), avail, lowness, limbRatio, splayOut);
    const rearNear = capLimbLen(nearLen + (limbRatio > 0.5 ? -1 : 1), avail, lowness, limbRatio, splayOut);
    const rearFar = capLimbLen(farLen + (limbRatio > 0.5 ? 0 : -1), avail, lowness, limbRatio, splayOut);
    const out = splayOut ? 1 + Math.round(splay * 2) : Math.round(splay);
    const frontX = facing === 'left' ? torsoX + 1 - out : torsoX + torsoW - 2 + out;
    const rearX = facing === 'left' ? torsoX + torsoW - 3 + out : torsoX + 1 - out;
    const inset = facing === 'left' ? 2 : -2;
    const xs = [frontX, frontX + inset, rearX + (facing === 'left' ? -2 : 2), rearX];
    const hs = [nearLen, farLen, rearFar, rearNear];
    ensureLimbSpread(hs);
    const usedX = new Set<number>();
    for (let i = 0; i < 4; i++) {
      let lx = xs[i]!;
      if (usedX.has(lx)) {
        const nudge = facing === 'left' ? (i < 2 ? -1 : 1) : i < 2 ? 1 : -1;
        lx = clamp(lx + nudge, gaitPad, w - 2);
        if (usedX.has(lx)) lx = clamp(lx + (nudge < 0 ? -1 : 1), 0, w - 1);
      }
      usedX.add(lx);
      addLimb(lx, attachY, 1, hs[i]!, limbMats[i]!);
      if (lx + 1 < torsoX) addHip(lx, torsoX, attachY, limbMats[i]!);
      else if (lx > torsoX + torsoW - 1) addHip(torsoX + torsoW - 1, lx, attachY, limbMats[i]!);
    }

    if (tailLen > 0) {
      const hipX = facing === 'left' ? torsoX + torsoW - 1 : torsoX;
      if (filamentRoll > 0.5) {
        parts.push({
          kind: 'filament',
          x: clamp(hipX + (facing === 'left' ? 1 : -1), 0, w - 1),
          y: clamp(torsoY + Math.floor(torsoH * 0.45), 0, h - tailLen),
          w: 1,
          h: tailLen,
          bend: facing === 'left' ? 1 : -1,
          mat: 'bone',
          role: 'accent',
        });
      } else {
        parts.push({
          kind: 'post',
          x: clamp(hipX + (facing === 'left' ? 1 : -tailLen), 0, w - tailLen),
          y: clamp(torsoY + Math.floor(torsoH * 0.4), 0, h - 1),
          w: tailLen,
          h: 1,
          mat: 'bone',
          role: 'accent',
        });
      }
    }
  } else {
    const towardDown = facing === 'down';
    let torsoW = clamp(5 + Math.round((splayOut ? 1 : 2) + lowness), 5, w <= 32 ? (splayOut ? 7 : 8) : 10);
    let torsoH = clamp(4 + Math.round((splayOut ? 4 : 2) + (1 - lowness) * 2 + (h <= 32 ? 0 : 2)), 4, h <= 32 ? 10 : 12);
    if (limbRatio > 0.55 && !splayOut) {
      torsoW = Math.min(torsoW, 6);
      torsoH = Math.min(torsoH, h <= 32 ? 5 : 6);
    }
    if (splayOut) {
      torsoW = Math.min(torsoW, torsoH);
    }
    const flatDown = flattenLowTorso(torsoW, torsoH, lowness, limbRatio, splayOut, w <= 32 ? 8 : 10);
    torsoW = flatDown.torsoW;
    torsoH = flatDown.torsoH;
    let headW = clamp(3 + Math.round(headRatio * 2), 3, 5);
    let headH = clamp(3 + Math.round(headRatio * (h <= 32 ? 2 : 3)), 3, 6);
    if (headW >= torsoW) headW = Math.max(3, torsoW - 1);
    if (headH > torsoH) headH = torsoH;

    const stackH = headH + torsoH - 1;
    const minLimb = splayOut ? 4 : 4 + Math.round(limbRatio * 5);
    const cx = clamp(Math.floor(w / 2) + jitter, gaitPad + 4, w - gaitPad - 4);
    const torsoX = clamp(cx - Math.floor(torsoW / 2), gaitPad + (splayOut ? 2 : 0), w - torsoW - gaitPad - (splayOut ? 2 : 0));
    const headNudge = towardDown ? 0 : lean > 0 ? (rng.next() < 0.5 ? -1 : 1) : 0;
    const headX = clamp(cx - Math.floor(headW / 2) + headNudge, gaitPad, w - headW - gaitPad);
    const slack = Math.max(0, groundY - minLimb - stackH - 2);
    const drop = Math.round(lowness * slack * 1.02) - Math.round(limbRatio * 2);

    let torsoY: number;
    let headY: number;
    if (towardDown) {
      const top = clamp(2 + drop + (lean > 2 ? 1 : 0), 2, 2 + slack);
      torsoY = top;
      headY = torsoY + torsoH - 1;
    } else {
      headY = clamp(2 + drop, 2, 2 + slack);
      torsoY = headY + headH - 1;
    }
    const stackedMax = Math.max(2, groundY - minLimb - torsoH);
    torsoY = sitLowTorsoY(torsoY, torsoH, groundY, lowness, limbRatio, splayOut, 2, stackedMax);
    if (towardDown) headY = torsoY + torsoH - 1;
    else headY = clamp(torsoY - headH + 1, 1, torsoY);

    parts.push({
      kind: 'mass',
      x: torsoX,
      y: torsoY,
      w: torsoW,
      h: torsoH,
      mat: torsoMat,
      role: 'spine',
    });
    parts.push({
      kind: 'mass',
      x: headX,
      y: headY,
      w: headW,
      h: headH,
      mat: headMat,
      role: 'head',
    });
    const joinY = towardDown ? torsoY + torsoH - 1 : headY + headH - 1;
    parts.push({
      kind: 'post',
      x: clamp(cx, 0, w - 1),
      y: clamp(joinY, 0, h - 2),
      w: 1,
      h: 2,
      mat: 'bone',
      role: 'rib',
    });

    const rearAttach = towardDown ? torsoY + Math.max(1, Math.floor(torsoH * 0.4)) : torsoY + torsoH - 1;
    const frontAttach = towardDown ? headY + 1 : torsoY + 1;
    const rearAvail = Math.max(4, groundY - rearAttach);
    const frontAvail = Math.max(4, groundY - frontAttach);
    const rearLen = capLimbLen(
      Math.round(rearAvail * (0.52 + limbRatio * 0.4 - lowness * 0.4)),
      rearAvail,
      lowness,
      limbRatio,
      splayOut,
    );
    const frontLen = capLimbLen(
      Math.round(frontAvail * (0.5 + limbRatio * 0.32 - lowness * 0.32) * (towardDown ? 0.88 : 1)),
      frontAvail,
      lowness,
      limbRatio,
      splayOut,
    );
    const farFront = capLimbLen(Math.round(frontLen * farScale), frontAvail, lowness, limbRatio, splayOut);
    const farRear = capLimbLen(Math.round(rearLen * 0.82), rearAvail, lowness, limbRatio, splayOut);
    const out = splayOut ? 2 + Math.round(splay) : Math.round(splay * 0.8);
    const rearLeftX = clamp(torsoX - out, gaitPad, w - 2);
    const rearRightX = clamp(torsoX + torsoW - 1 + out, gaitPad, w - 2);
    const frontLeftX = clamp(headX - (splayOut ? out : 0), gaitPad, w - 2);
    const frontRightX = clamp(headX + headW - 1 + (splayOut ? out : 0), gaitPad, w - 2);
    const pair: Array<{ x: number; y: number; h: number }> = [
      { x: rearLeftX, y: rearAttach, h: rearLen },
      { x: frontLeftX, y: frontAttach, h: towardDown ? farFront : frontLen },
      { x: frontRightX, y: frontAttach, h: towardDown ? frontLen : farFront },
      { x: rearRightX, y: rearAttach, h: farRear },
    ];
    const pairHs = pair.map((leg) => leg.h);
    ensureLimbSpread(pairHs);
    pair.forEach((leg, i) => {
      leg.h = pairHs[i]!;
    });
    const used = new Set<number>();
    pair.forEach((leg, i) => {
      let lx = leg.x;
      if (used.has(lx)) {
        const nudge = lx <= cx ? -2 : 2;
        lx = clamp(lx + nudge, gaitPad, w - 2);
        if (used.has(lx)) lx = clamp(lx + (nudge < 0 ? -1 : 1), 0, w - 1);
      }
      used.add(lx);
      addLimb(lx, leg.y, 1, leg.h, limbMats[i]!);
      if (lx + 1 < torsoX) addHip(lx, torsoX, leg.y, limbMats[i]!);
      else if (lx > torsoX + torsoW - 1) addHip(torsoX + torsoW - 1, lx, leg.y, limbMats[i]!);
    });

    if (tailLen > 0) {
      const hipY = towardDown ? torsoY : torsoY + torsoH - 1;
      const tailX = clamp(torsoX + torsoW - 1, 0, w - 1);
      if (filamentRoll > 0.5) {
        parts.push({
          kind: 'filament',
          x: tailX,
          y: clamp(towardDown ? hipY - tailLen + 1 : hipY, 0, h - tailLen),
          w: 1,
          h: tailLen,
          bend: rng.next() < 0.5 ? -1 : 1,
          mat: 'bone',
          role: 'accent',
        });
      } else {
        parts.push({
          kind: 'post',
          x: tailX,
          y: clamp(towardDown ? Math.max(0, hipY - tailLen + 1) : hipY, 0, h - tailLen),
          w: 1,
          h: tailLen,
          mat: 'bone',
          role: 'accent',
        });
      }
    }
  }

  if (antlers > 0) {
    const head = parts.find((p) => p.role === 'head');
    if (head) {
      const ax0 = facing === 'left' ? head.x : facing === 'right' ? head.x + head.w - 1 : head.x + 1;
      const ay = facing === 'down' ? head.y + head.h - 1 : head.y;
      parts.push({
        kind: 'nub',
        x: clamp(ax0, 0, w - 1),
        y: clamp(ay - (facing === 'down' ? 0 : 1), 0, h - 2),
        w: 1,
        h: 2,
        mat: 'bone',
        role: 'accent',
      });
      if (antlers > 1) {
        parts.push({
          kind: 'nub',
          x: clamp(ax0 + (facing === 'left' ? 1 : facing === 'right' ? -1 : 2), 0, w - 1),
          y: clamp(ay - (facing === 'down' ? 0 : 1), 0, h - 2),
          w: 1,
          h: 2,
          mat: 'bone',
          role: 'accent',
        });
      }
    }
  }

  const spine = parts.find((p) => p.role === 'spine');
  parts.push({
    kind: 'core',
    x: clamp((spine?.x ?? Math.floor(w / 2)) + 1, 0, w - 1),
    y: clamp((spine?.y ?? 4) + 1, 0, h - 1),
    w: 1,
    h: 1,
    mat: 'glow',
    role: 'accent',
  });

  return parts;
}

export function buildMammalRemnantSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  const parts = layoutMammalNodes(canvas.w, canvas.h, seed, facing4);
  return {
    canvas,
    parts,
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintMammalRemnantBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildMammalRemnantSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
