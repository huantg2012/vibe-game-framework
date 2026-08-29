/**
 * I5-K machine gate（第三轮透视排足）：虫同覆盖档 16 种子去重剪影 = 16；
 * 改写→覆盖粗占格距离 > 0.0059（该值必须 FAIL）。度量 6×8，不用 IoU。
 * limb post 总数 ∈ [4,10]；另抽 ≥64 种子看分布（均值 5.2–6.8，禁清一色 8–10）。
 * 同一骨架足柱 h 的 max−min ≥ 2。着地不是通栏，左右可以 1–5 段。
 * 中央团、weld=1、禁止俯视圆盘、无 flesh、未进固着名单。
 *
 *   npm run check:jia-insect-remnant
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mix32 } from '../../src/generation/seed-fork.ts';
import {
  SORTIE_SUBSTRATE_IDS,
  SUBSTRATE_DATA,
  type CoverageId,
} from '../../src/generated/contamination-lexicon-data.ts';
import { operatorBudget, radiateAllowed } from '../../src/entities/form-renderers/d/genome/operators.ts';
import { countOpaquePixels, drawSkeleton } from '../../src/entities/form-renderers/d/genome/parts.ts';
import {
  INSECT_REMNANT_ID,
  buildInsectRemnantSkeleton,
  paintInsectRemnantBody,
} from '../../src/entities/form-renderers/d/genome/insect-remnant.ts';
import { countOpaque4Components } from '../../src/entities/form-renderers/d/genome/weld.ts';
import type { GenomeNode, GenomeSkeleton } from '../../src/entities/form-renderers/d/genome/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_REWRITE_OVERWRITE = 0.0059;
const MASK_W = 48;
const MASK_H = 64;
const CD_COLS = 6;
const CD_ROWS = 8;
const SEEDS = 16;
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
}

function maskOf(buf: { data: Uint8ClampedArray; w: number; h: number }): Uint8Array {
  const m = new Uint8Array(MASK_W * MASK_H);
  const ox = ((MASK_W - buf.w) / 2) | 0;
  const oy = MASK_H - buf.h;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      const px = x + ox;
      const py = y + oy;
      if (px < 0 || py < 0 || px >= MASK_W || py >= MASK_H) continue;
      m[py * MASK_W + px] = 1;
    }
  }
  return m;
}

function coarse(mask: Uint8Array): Float32Array {
  const out = new Float32Array(CD_COLS * CD_ROWS);
  const cw = MASK_W / CD_COLS;
  const ch = MASK_H / CD_ROWS;
  for (let y = 0; y < MASK_H; y++) {
    for (let x = 0; x < MASK_W; x++) {
      if (!mask[y * MASK_W + x]) continue;
      const c = Math.min(CD_COLS - 1, (x / cw) | 0);
      const r = Math.min(CD_ROWS - 1, (y / ch) | 0);
      const bin = r * CD_COLS + c;
      out[bin] = (out[bin] ?? 0) + 1;
    }
  }
  const per = cw * ch;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / per;
  return out;
}

function coarseDist(a: Uint8Array, b: Uint8Array): number {
  const ca = coarse(a);
  const cb = coarse(b);
  let s = 0;
  for (let i = 0; i < ca.length; i++) s += Math.abs(ca[i]! - cb[i]!);
  return s / ca.length;
}

function distinctCount(masks: readonly Uint8Array[]): number {
  const keys = new Set<string>();
  for (const m of masks) keys.add(Buffer.from(m).toString('base64'));
  return keys.size;
}

function median(vals: number[]): number {
  const a = [...vals].sort((x, y) => x - y);
  return a.length === 0 ? 0 : a[a.length >> 1]!;
}

function opaqueBox(buf: { data: Uint8ClampedArray; w: number; h: number }): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  n: number;
} | null {
  let x0 = buf.w;
  let y0 = buf.h;
  let x1 = -1;
  let y1 = -1;
  let n = 0;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      n += 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1, n };
}

/**
 * 俯视圆盘：下半中轴也填实（圆肚）。直立虫腹下应空、足在两侧。
 */
function looksLikeTopDownDisc(buf: { data: Uint8ClampedArray; w: number; h: number }): boolean {
  const box = opaqueBox(buf);
  if (!box) return true;
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const midX = (box.x0 + box.x1) / 2;
  const lowerY0 = box.y0 + Math.floor(bh * 0.45);
  const band = Math.max(2, Math.floor(bw * 0.22));
  let centerLower = 0;
  let sideLower = 0;
  for (let y = lowerY0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (Math.abs(x - midX) <= band) centerLower += 1;
      else sideLower += 1;
    }
  }
  return sideLower > 0 && centerLower >= sideLower * 0.7;
}

function limbPosts(sk: GenomeSkeleton): GenomeNode[] {
  return sk.parts.filter((p) => p.role === 'limb' && p.kind === 'post');
}

function limbPostHeightSpread(sk: GenomeSkeleton): number {
  const hs = limbPosts(sk).map((p) => p.h);
  if (hs.length === 0) return 0;
  return Math.max(...hs) - Math.min(...hs);
}

/**
 * 烤漆下缘（最底 3 行并集）左右不透明游程。
 * 通栏横条 / 左右各一块实心柱 → 每侧 1 段。
 */
function groundFootRuns(buf: { data: Uint8ClampedArray; w: number; h: number }): {
  left: number;
  right: number;
} {
  const box = opaqueBox(buf);
  if (!box) return { left: 0, right: 0 };
  const mid = Math.floor((box.x0 + box.x1) / 2);
  const y0 = Math.max(box.y0, box.y1 - 2);
  const occupied = (x: number): boolean => {
    for (let y = y0; y <= box.y1; y++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) !== 0) return true;
    }
    return false;
  };
  const runsBetween = (x0: number, x1: number): number => {
    let n = 0;
    let inside = false;
    for (let x = x0; x <= x1; x++) {
      const on = occupied(x);
      if (on && !inside) {
        n += 1;
        inside = true;
      } else if (!on) {
        inside = false;
      }
    }
    return n;
  };
  return {
    left: runsBetween(box.x0, mid - 1),
    right: runsBetween(mid + 1, box.x1),
  };
}

/** 整条下缘实心通栏 = 门板，FAIL。左右游程 1–5 合法。 */
function isSolidGroundBar(buf: { data: Uint8ClampedArray; w: number; h: number }): boolean {
  const box = opaqueBox(buf);
  if (!box) return true;
  const mid = Math.floor((box.x0 + box.x1) / 2);
  const y0 = Math.max(box.y0, box.y1 - 2);
  const occupied = (x: number): boolean => {
    for (let y = y0; y <= box.y1; y++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) !== 0) return true;
    }
    return false;
  };
  let filled = 0;
  const total = box.x1 - box.x0 + 1;
  for (let x = box.x0; x <= box.x1; x++) {
    if (occupied(x)) filled += 1;
  }
  return occupied(mid) && filled >= Math.ceil(total * 0.82);
}

assert(operatorBudget('infiltrate') === 1, 'I5-D infiltrate budget still 1');
assert(operatorBudget('rewrite') === 3, 'I5-D rewrite budget still 3');
assert(operatorBudget('overwrite') === 5, 'I5-D overwrite budget still 5');
assert(!radiateAllowed('infiltrate') && !radiateAllowed('rewrite'), 'radiate still locked before overwrite');
assert(radiateAllowed('overwrite'), 'radiate still only at overwrite');

const insectSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/insect-remnant.ts'), 'utf8');
const insectCode = insectSrc
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
  .join('\n');
const randomSrc = readFileSync(resolve(ROOT, 'src/utils/random.ts'), 'utf8');
assert(randomSrc.includes('nextGaussian'), 'SeededRandom must expose nextGaussian');
assert(/Math\.sqrt\(\s*-2/.test(randomSrc), 'nextGaussian must be Box-Muller');
assert(!/mix32\([^)]*substrate[^)]*\)\s*%\s*3/.test(insectCode), 'must not use mix32(seed, substrate) % 3');
assert(!/\bmammal_remnant\b/.test(insectCode), 'insect must not implement mammal grammar');
assert(!/\bworm_remnant\b/.test(insectCode), 'insect must not implement worm grammar');
assert(
  !/if\s*\(\s*(kind|variant|family)\s*===/.test(insectCode),
  'must not hard-cut silhouette identities',
);
assert(!/\bflesh\b/.test(insectCode), 'insect carapace must not use flesh as a material');
assert(!/\bpairCount\b/.test(insectCode), 'must not layout by left/right pair counts');
assert(!/3\s*\+\s*Math\.round/.test(insectCode), 'must not use 3+round uniform pair count');
assert(/layoutInsectNodes\([\s\S]*facing/.test(insectSrc), 'layoutInsectNodes must take facing');

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/attach.ts'), 'utf8');
assert(!attachSrc.includes('INSECT_REMNANT_ID'), 'insect must not join isAnchoredFloorJia');

const gaitSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/gait.ts'), 'utf8');
assert(gaitSrc.includes('INSECT_REMNANT_ID'), 'gait branches on insect_remnant');
assert(gaitSrc.includes('insectWalkStride'), 'insect gait is a stride, not stalk gap or remnant squash');
assert(!/footY = maxY - 1/.test(gaitSrc), 'insect stride must not limit motion to the tip row');
assert(!/from ['"][^'"]*jia-pixels/.test(gaitSrc), 'gait must not import jia-pixels');

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(/case 'floor':\s*return attachJiaGenomeD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is attachJiaGenomeD');
assert(!mixedSrc.includes('attachJiaD'), 'd-mixed no longer calls attachJiaD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

assert(SORTIE_SUBSTRATE_IDS.includes(INSECT_REMNANT_ID), 'insect_remnant is sortie');
assert(SUBSTRATE_DATA[INSECT_REMNANT_ID]?.enabledScope === 'sortie', 'CSV enabled_scope is sortie');

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

{
  const downSk = buildInsectRemnantSkeleton('infiltrate', seedList[0]!, undefined, 'down');
  const leftSk = buildInsectRemnantSkeleton('infiltrate', seedList[0]!, undefined, 'left');
  assert(
    JSON.stringify(downSk.parts) !== JSON.stringify(leftSk.parts),
    'layout must consume facing4 (down vs left skeletons identical)',
  );
}

for (const coverage of COVERAGES) {
  const groundLeft: number[] = [];
  const groundRight: number[] = [];
  for (const seed of seedList) {
    const sk = buildInsectRemnantSkeleton(coverage, seed);
    const masses = sk.parts.filter((p) => p.kind === 'mass' && p.role === 'spine');
    const limbs = limbPosts(sk);
    const femurs = sk.parts.filter((p) => p.role === 'limb' && p.kind === 'beam');
    const segs = sk.parts.filter((p) => p.role === 'accent' && (p.kind === 'nub' || p.kind === 'mass'));
    assert(masses.length === 1, `${coverage} seed ${seed} needs exactly 1 carapace mass, got ${masses.length}`);
    const mass = masses[0];
    if (mass) {
      assert(mass.w >= mass.h, `${coverage} seed ${seed} carapace must be wider than tall, not a disc`);
      assert(mass.mat !== 'flesh', `${coverage} seed ${seed} carapace must not be flesh`);
      const leftPosts = limbs.filter((p) => p.x + p.w / 2 < mass.x + mass.w / 2);
      const rightPosts = limbs.filter((p) => p.x + p.w / 2 > mass.x + mass.w / 2);
      const leftMin = leftPosts.length > 0 ? Math.min(...leftPosts.map((p) => p.x)) : mass.x;
      const rightMax = rightPosts.length > 0 ? Math.max(...rightPosts.map((p) => p.x + p.w)) : mass.x + mass.w;
      assert(
        limbs.every((p) => p.w === 1),
        `${coverage} seed ${seed} shaft width must stay 1px`,
      );
      assert(leftMin < mass.x, `${coverage} seed ${seed} left legs must extend past the carapace`);
      assert(rightMax > mass.x + mass.w, `${coverage} seed ${seed} right legs must extend past the carapace`);
      assert(femurs.length === limbs.length, `${coverage} seed ${seed} femurs ${femurs.length} want one per limb post (${limbs.length})`);
      const upward = limbs.filter((p) => p.y + p.h <= mass.y + 1);
      assert(upward.length === 0, `${coverage} seed ${seed} legs must not radiate above the carapace`);
    }
    assert(
      limbs.length >= 4 && limbs.length <= 10,
      `${coverage} seed ${seed} limb posts ${limbs.length} want 4–10`,
    );
    const spread = limbPostHeightSpread(sk);
    assert(spread >= 2, `${coverage} seed ${seed} limb post h spread ${spread} want ≥2 (equal-length door)`);
    assert(segs.length <= 2, `${coverage} seed ${seed} abdominal segments ${segs.length} want 0–2`);
    const hanging = segs.filter((p) => mass && p.y >= mass.y + mass.h + 2);
    assert(hanging.length === 0, `${coverage} seed ${seed} must not hang a bead string under the belly`);
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas 48x64');
    }
    const raw = drawSkeleton(sk);
    assert(!looksLikeTopDownDisc(raw), `${coverage} seed ${seed} grammar silhouette reads as a top-down disc`);
    const buf = paintInsectRemnantBody(coverage, seed);
    const welded = countOpaque4Components(buf);
    assert(welded === 1, `${coverage} seed ${seed} weld 4-connected ${welded} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} body empty`);
    const feet = groundFootRuns(buf);
    groundLeft.push(feet.left);
    groundRight.push(feet.right);
    assert(
      !isSolidGroundBar(buf),
      `${coverage} seed ${seed} painted ground is a solid full-width bar (door)`,
    );
    assert(
      feet.left <= 5 && feet.right <= 5,
      `${coverage} seed ${seed} painted ground runs L${feet.left}/R${feet.right} want ≤5 each`,
    );
  }

  console.log(
    `insect_remnant ${coverage} ground runs left min ${Math.min(...groundLeft)} max ${Math.max(...groundLeft)} / right min ${Math.min(...groundRight)} max ${Math.max(...groundRight)}`,
  );
  const masks = seedList.map((seed) => maskOf(paintInsectRemnantBody(coverage, seed)));
  const distinct = distinctCount(masks);
  console.log(`insect_remnant ${coverage} distinct ${distinct} / ${SEEDS}`);
  assert(distinct === SEEDS, `${coverage} distinct silhouettes ${distinct} want ${SEEDS}`);
}

{
  const DIST_SEEDS = 80;
  const distSeeds = Array.from({ length: DIST_SEEDS }, (_, i) => 50 + i * 7919);
  const counts = distSeeds.map(
    (seed) => limbPosts(buildInsectRemnantSkeleton('infiltrate', seed)).length,
  );
  const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
  const hiTail = counts.filter((v) => v >= 8).length / counts.length;
  const minC = Math.min(...counts);
  const maxC = Math.max(...counts);
  console.log(
    `insect_remnant leg-count n=${DIST_SEEDS} min ${minC} max ${maxC} mean ${mean.toFixed(3)} share8-10 ${(hiTail * 100).toFixed(1)}%`,
  );
  assert(
    counts.every((v) => v >= 4 && v <= 10),
    `distribution counts must stay in [4,10], got min ${minC} max ${maxC}`,
  );
  assert(mean >= 5.2 && mean <= 6.8, `distribution mean ${mean.toFixed(3)} want 5.2–6.8`);
  assert(hiTail <= 0.5, `distribution share of 8–10 is ${(hiTail * 100).toFixed(1)}% want ≤50%`);
}

const pairDists: number[] = [];
for (const seed of seedList) {
  const rewrite = maskOf(paintInsectRemnantBody('rewrite', seed));
  const overwrite = maskOf(paintInsectRemnantBody('overwrite', seed));
  pairDists.push(coarseDist(rewrite, overwrite));
}
const diagSeed = mix32(7, INSECT_REMNANT_ID) % 8192;
const diagDist = coarseDist(
  maskOf(paintInsectRemnantBody('rewrite', diagSeed)),
  maskOf(paintInsectRemnantBody('overwrite', diagSeed)),
);
const minDist = Math.min(...pairDists);
const medDist = median(pairDists);
console.log(
  `insect_remnant rewrite→overwrite coarse  min ${minDist.toFixed(4)}  median ${medDist.toFixed(4)}  seed7 ${diagDist.toFixed(4)}  baseline ${BASELINE_REWRITE_OVERWRITE}`,
);
assert(
  minDist > BASELINE_REWRITE_OVERWRITE,
  `rewrite→overwrite min coarse ${minDist.toFixed(4)} must beat baseline ${BASELINE_REWRITE_OVERWRITE}`,
);
assert(
  medDist > BASELINE_REWRITE_OVERWRITE,
  `rewrite→overwrite median coarse ${medDist.toFixed(4)} must beat baseline ${BASELINE_REWRITE_OVERWRITE}`,
);
assert(
  diagDist > BASELINE_REWRITE_OVERWRITE,
  `rewrite→overwrite diagnostic coarse ${diagDist.toFixed(4)} must beat baseline ${BASELINE_REWRITE_OVERWRITE}`,
);

if (failed > 0) {
  console.error(`check:jia-insect-remnant ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-insect-remnant PASS');
