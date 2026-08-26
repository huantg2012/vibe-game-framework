/**
 * I5-M machine gate：大号蠕虫同覆盖档 16 种子去重剪影 = 16；
 * 改写→覆盖粗占格距离 > 0.0059（该值必须 FAIL）。度量 6×8，不用 IoU。
 * 节数 4–8；无肢柱；weld=1；无 flesh。永远横躺。
 * 四朝向像素质心钉在原点 3px 内，两两 ≤ 4px。
 * 渗透 + 覆盖四信号相 RGBA 4/4，且 awake/inflated/strike 均 ≠ idle。
 * 不得读成残茎丛 / 横向多足虫 / 四足哺乳动物。
 *
 *   npm run check:jia-worm-remnant
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
import { bakeJiaGenome } from '../../src/entities/form-renderers/d/genome/bake.ts';
import { operatorBudget, radiateAllowed } from '../../src/entities/form-renderers/d/genome/operators.ts';
import { countOpaquePixels, drawSkeleton } from '../../src/entities/form-renderers/d/genome/parts.ts';
import {
  WORM_REMNANT_ID,
  buildWormRemnantSkeleton,
  paintWormRemnantBody,
} from '../../src/entities/form-renderers/d/genome/worm-remnant.ts';
import { countOpaque4Components } from '../../src/entities/form-renderers/d/genome/weld.ts';
import type { GenomeNode, GenomeSkeleton } from '../../src/entities/form-renderers/d/genome/types.ts';
import type { FormVisualSignal } from '../../src/entities/form-renderers/form-renderer.ts';
import type { Facing4 } from '../../src/types/game-types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_REWRITE_OVERWRITE = 0.0059;
const MASK_W = 48;
const MASK_H = 64;
const CD_COLS = 6;
const CD_ROWS = 8;
const SEEDS = 16;
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const FACINGS: readonly Facing4[] = ['down', 'up', 'left', 'right'];
const SIGNALS: readonly FormVisualSignal[] = ['idle', 'awake', 'inflated', 'strike'];
const DEFAULT_SEED = 1000;

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

function hypot(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

function rgbaKey(buf: { data: Uint8ClampedArray }): string {
  return Buffer.from(buf.data).toString('base64');
}

function opaqueCentroid(buf: { data: Uint8ClampedArray; w: number; h: number }): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      sx += x;
      sy += y;
      n += 1;
    }
  }
  if (n === 0) return { x: 0, y: 0 };
  return { x: sx / n, y: sy / n };
}

function median(vals: number[]): number {
  const a = [...vals].sort((x, y) => x - y);
  return a.length === 0 ? 0 : a[a.length >> 1]!;
}

function bodySegs(sk: GenomeSkeleton): GenomeNode[] {
  return sk.parts.filter(
    (p) => (p.role === 'spine' || p.role === 'head') && (p.kind === 'mass' || p.kind === 'post'),
  );
}

function limbPosts(sk: GenomeSkeleton): GenomeNode[] {
  return sk.parts.filter((p) => p.role === 'limb');
}

/** 残茎丛：共享着地点的 3+ 根竖茎，或底座 + 并行高杆。 */
function looksLikeStalkClump(sk: GenomeSkeleton): boolean {
  const plates = sk.parts.filter((p) => p.kind === 'plate' || p.role === 'base');
  const tall = sk.parts.filter(
    (p) => p.role === 'spine' && p.kind === 'post' && p.h >= 6 && p.h >= p.w * 2,
  );
  if (plates.length >= 1 && tall.length >= 3) return true;
  if (tall.length >= 3) {
    const grounds = tall.map((p) => p.y + p.h);
    if (Math.max(...grounds) - Math.min(...grounds) <= 2) return true;
  }
  const segs = bodySegs(sk);
  if (segs.length < 3) return false;
  const xs = segs.map((p) => p.x + p.w / 2).sort((a, b) => a - b);
  const ys = segs.map((p) => p.y + p.h / 2).sort((a, b) => a - b);
  const xSpan = xs[xs.length - 1]! - xs[0]!;
  const ySpan = ys[ys.length - 1]! - ys[0]!;
  const tallish = segs.filter((p) => p.h >= p.w * 2 && p.h >= 6).length;
  return tallish >= 3 && xSpan > ySpan * 1.2;
}

/** 横向多足虫：宽扁腹甲 + 两侧肢柱。 */
function looksLikeLateralInsect(sk: GenomeSkeleton): boolean {
  const limbs = limbPosts(sk);
  if (limbs.length >= 4) return true;
  const masses = sk.parts.filter((p) => p.kind === 'mass');
  if (masses.length === 1 && limbs.length >= 2) {
    const mass = masses[0]!;
    if (mass.w >= mass.h) {
      const left = limbs.filter((p) => p.x + p.w <= mass.x);
      const right = limbs.filter((p) => p.x >= mass.x + mass.w);
      if (left.length >= 1 && right.length >= 1) return true;
    }
  }
  return false;
}

/** 四足纵轴哺乳动物：头+躯干两团 + 四肢。 */
function looksLikeQuadMammal(sk: GenomeSkeleton): boolean {
  const limbs = sk.parts.filter((p) => p.role === 'limb' && p.kind === 'post');
  if (limbs.length === 4) return true;
  const masses = sk.parts.filter((p) => p.kind === 'mass');
  return masses.length === 2 && limbs.length >= 2;
}

function stripSpans(sk: GenomeSkeleton): { xSpan: number; ySpan: number } {
  const segs = bodySegs(sk);
  const xs = segs.map((p) => p.x + p.w / 2).sort((a, b) => a - b);
  const ys = segs.map((p) => p.y + p.h / 2).sort((a, b) => a - b);
  return {
    xSpan: xs.length === 0 ? 0 : xs[xs.length - 1]! - xs[0]!,
    ySpan: ys.length === 0 ? 0 : ys[ys.length - 1]! - ys[0]!,
  };
}

/** 永远横躺：4–8 节沿 X 相接，X 跨度明显大于 Y。竖长条必须 FAIL。 */
function isSegmentedStrip(sk: GenomeSkeleton): boolean {
  const segs = bodySegs(sk);
  if (segs.length < 4 || segs.length > 8) return false;
  const { xSpan, ySpan } = stripSpans(sk);
  return xSpan > ySpan * 1.15;
}

assert(operatorBudget('infiltrate') === 1, 'I5-D infiltrate budget still 1');
assert(operatorBudget('rewrite') === 3, 'I5-D rewrite budget still 3');
assert(operatorBudget('overwrite') === 5, 'I5-D overwrite budget still 5');
assert(!radiateAllowed('infiltrate') && !radiateAllowed('rewrite'), 'radiate still locked before overwrite');
assert(radiateAllowed('overwrite'), 'radiate still only at overwrite');

const wormSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/worm-remnant.ts'), 'utf8');
const wormCode = wormSrc
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
  .join('\n');
assert(!/mix32\([^)]*substrate[^)]*\)\s*%\s*3/.test(wormCode), 'must not use mix32(seed, substrate) % 3');
assert(!/\binsect_remnant\b/.test(wormCode), 'worm must not implement insect grammar');
assert(!/\bmammal_remnant\b/.test(wormCode), 'worm must not implement mammal grammar');
assert(!/\bstalk_clump\b/.test(wormCode), 'worm must not implement stalk grammar');
assert(
  !/if\s*\(\s*(kind|variant|family)\s*===/.test(wormCode),
  'must not hard-cut silhouette identities',
);
assert(!/\bflesh\b/.test(wormCode), 'worm body must not use flesh as a material');
assert(!/\bfilament\b/.test(wormCode), 'worm must not use filament (fluid tail / wave edge)');
assert(!/role:\s*'limb'/.test(wormCode), 'worm grammar must not assign role limb');
assert(/layoutWormNodes\([\s\S]*facing/.test(wormSrc), 'layoutWormNodes must take facing');
assert(!/\bsideView\b/.test(wormCode), 'must not use sideView to stand the strip up');
assert(wormSrc.includes('pinWormPartsToOrigin'), 'must pin the strip to origin after layout');
assert(!/\bbandCenterY\b/.test(wormCode), 'must not throw the strip to canvas edges via bandCenterY');

const bakeSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/bake.ts'), 'utf8');
assert(bakeSrc.includes('buildWormRemnantSkeleton'), 'bake branches worm_remnant to grammar skeleton');
assert(bakeSrc.includes('WORM_REMNANT_ID'), 'bake recognizes worm_remnant');
assert(bakeSrc.includes('applyWormSignal'), 'bake must apply worm signal without upright shear');
{
  const wormFn = bakeSrc.split('function applyWormSignal')[1]?.split('function applyFacingAndSignal')[0] ?? '';
  assert(wormFn.length > 0, 'applyWormSignal body missing');
  assert(!wormFn.includes('shearX'), 'worm signal must not use shearX * t');
  assert(!wormFn.includes('recolorForward'), 'worm signal must not recolor 4–8px via recolorForward');
}

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/attach.ts'), 'utf8');
assert(!attachSrc.includes('WORM_REMNANT_ID'), 'worm must not join isAnchoredFloorJia');

const gaitSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/gait.ts'), 'utf8');
assert(gaitSrc.includes('WORM_REMNANT_ID'), 'gait branches on worm_remnant');
assert(gaitSrc.includes('wormArchStride'), 'worm gait is an arch, not stalk gap or remnant squash');
{
  const wormArchFn = gaitSrc.split('function wormArchStride')[1]?.split(/\nfunction /)[0] ?? '';
  assert(wormArchFn.includes('y - lift'), 'worm arch must lift off the ground on every facing');
  assert(!wormArchFn.includes('x + lift'), 'worm arch must not bulge sideways for a vertical strip');
}
assert(!/Math\.sin/.test(gaitSrc), 'gait must not use sine mucus waves');
assert(!/from ['"][^'"]*jia-pixels/.test(gaitSrc), 'gait must not import jia-pixels');

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(/case 'floor':\s*return attachJiaD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is still attachJiaD');
assert(!mixedSrc.includes('attachJiaGenomeD'), 'd-mixed does not call attachJiaGenomeD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

assert(!SORTIE_SUBSTRATE_IDS.includes(WORM_REMNANT_ID), 'worm_remnant stays gym, not sortie');
assert(SUBSTRATE_DATA[WORM_REMNANT_ID]?.enabledScope === 'gym', 'CSV enabled_scope still gym');

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);
const segCounts: number[] = [];

{
  const downSk = buildWormRemnantSkeleton('infiltrate', seedList[0]!, undefined, 'down');
  const leftSk = buildWormRemnantSkeleton('infiltrate', seedList[0]!, undefined, 'left');
  assert(
    JSON.stringify(downSk.parts) !== JSON.stringify(leftSk.parts),
    'layout must consume facing4 (down vs left skeletons identical)',
  );
  const faceSeed = seedList[0]!;
  for (const facing of FACINGS) {
    for (const coverage of COVERAGES) {
      const sk = buildWormRemnantSkeleton(coverage, faceSeed, undefined, facing);
      const { xSpan, ySpan } = stripSpans(sk);
      assert(
        xSpan > ySpan * 1.15,
        `${coverage} ${facing} seed ${faceSeed} not horizontal (xSpan ${xSpan.toFixed(1)} ySpan ${ySpan.toFixed(1)})`,
      );
      assert(
        isSegmentedStrip(sk),
        `${coverage} ${facing} seed ${faceSeed} grammar is not a horizontal segmented strip`,
      );
    }
  }
  console.log(`worm_remnant four facings × 3 coverages all horizontal (seed ${faceSeed})`);
}

for (const coverage of COVERAGES) {
  for (const seed of seedList) {
    const sk = buildWormRemnantSkeleton(coverage, seed);
    const segs = bodySegs(sk);
    const limbs = limbPosts(sk);
    segCounts.push(segs.length);
    assert(
      segs.length >= 4 && segs.length <= 8,
      `${coverage} seed ${seed} segments ${segs.length} want 4–8`,
    );
    assert(limbs.length === 0, `${coverage} seed ${seed} has ${limbs.length} limb parts, want 0`);
    assert(
      segs.every((p) => p.mat !== 'flesh'),
      `${coverage} seed ${seed} body segment uses flesh`,
    );
    const { xSpan, ySpan } = stripSpans(sk);
    assert(
      xSpan > ySpan * 1.15,
      `${coverage} seed ${seed} default-down not horizontal (xSpan ${xSpan.toFixed(1)} ySpan ${ySpan.toFixed(1)})`,
    );
    const crosses = segs.map((p) => p.h);
    assert(
      crosses.every((c) => c >= 3 && c <= 6),
      `${coverage} seed ${seed} segment cross ${Math.min(...crosses)}–${Math.max(...crosses)} want 3–6`,
    );
    const thick = Math.max(...crosses);
    const thin = Math.min(...crosses);
    assert(thick > thin, `${coverage} seed ${seed} missing a thicker segment (${thin}–${thick})`);
    assert(!looksLikeStalkClump(sk), `${coverage} seed ${seed} grammar reads as a stalk clump`);
    assert(!looksLikeLateralInsect(sk), `${coverage} seed ${seed} grammar reads as a lateral insect`);
    assert(!looksLikeQuadMammal(sk), `${coverage} seed ${seed} grammar reads as a quadruped mammal`);
    assert(isSegmentedStrip(sk), `${coverage} seed ${seed} grammar is not a single segmented strip`);
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas 48x64');
    }
    const raw = drawSkeleton(sk);
    assert(countOpaquePixels(raw) > 0, `${coverage} seed ${seed} grammar silhouette empty`);
    const buf = paintWormRemnantBody(coverage, seed);
    const welded = countOpaque4Components(buf);
    assert(welded === 1, `${coverage} seed ${seed} weld 4-connected ${welded} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} body empty`);
  }

  const masks = seedList.map((seed) => maskOf(paintWormRemnantBody(coverage, seed)));
  const distinct = distinctCount(masks);
  console.log(`worm_remnant ${coverage} distinct ${distinct} / ${SEEDS}`);
  assert(distinct === SEEDS, `${coverage} distinct silhouettes ${distinct} want ${SEEDS}`);
}

{
  const minC = Math.min(...segCounts);
  const maxC = Math.max(...segCounts);
  console.log(`worm_remnant segment count over 16×3 min ${minC} max ${maxC}`);
  assert(minC >= 4 && maxC <= 8, `segment range ${minC}–${maxC} want within 4–8`);
}

const pairDists: number[] = [];
for (const seed of seedList) {
  const rewrite = maskOf(paintWormRemnantBody('rewrite', seed));
  const overwrite = maskOf(paintWormRemnantBody('overwrite', seed));
  pairDists.push(coarseDist(rewrite, overwrite));
}
const diagSeed = mix32(7, WORM_REMNANT_ID) % 8192;
const diagDist = coarseDist(
  maskOf(paintWormRemnantBody('rewrite', diagSeed)),
  maskOf(paintWormRemnantBody('overwrite', diagSeed)),
);
const minDist = Math.min(...pairDists);
const medDist = median(pairDists);
console.log(
  `worm_remnant rewrite→overwrite coarse  min ${minDist.toFixed(4)}  median ${medDist.toFixed(4)}  seed7 ${diagDist.toFixed(4)}  baseline ${BASELINE_REWRITE_OVERWRITE}`,
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

{
  const originDists: number[] = [];
  const pairDists: number[] = [];
  for (const coverage of COVERAGES) {
    const cents: Partial<Record<Facing4, { x: number; y: number }>> = {};
    for (const facing of FACINGS) {
      const baked = bakeJiaGenome({
        substrate: WORM_REMNANT_ID,
        coverage,
        seed: DEFAULT_SEED,
        facing4: facing,
        signal: 'idle',
      });
      const c = opaqueCentroid(baked.buf);
      cents[facing] = c;
      const d = hypot(c.x - baked.canvas.originX, c.y - baked.canvas.originY);
      originDists.push(d);
      console.log(
        `worm_remnant ${coverage} ${facing} centroid (${c.x.toFixed(1)},${c.y.toFixed(1)}) origin (${baked.canvas.originX},${baked.canvas.originY}) dist ${d.toFixed(2)}`,
      );
      assert(
        d <= 3,
        `${coverage} ${facing} opaque centroid ${d.toFixed(2)}px from origin, want ≤ 3`,
      );
    }
    for (let i = 0; i < FACINGS.length; i++) {
      for (let j = i + 1; j < FACINGS.length; j++) {
        const a = cents[FACINGS[i]!]!;
        const b = cents[FACINGS[j]!]!;
        const d = hypot(a.x - b.x, a.y - b.y);
        pairDists.push(d);
        assert(
          d <= 4,
          `${coverage} ${FACINGS[i]} vs ${FACINGS[j]} centroid dist ${d.toFixed(2)} want ≤ 4`,
        );
      }
    }
  }
  console.log(
    `worm_remnant facing centroids  origin max ${Math.max(...originDists).toFixed(2)}  pairwise max ${Math.max(...pairDists).toFixed(2)}`,
  );
}

{
  const signalCoverages: readonly CoverageId[] = ['infiltrate', 'overwrite'];
  for (const coverage of signalCoverages) {
    const keys: string[] = [];
    for (const signal of SIGNALS) {
      const baked = bakeJiaGenome({
        substrate: WORM_REMNANT_ID,
        coverage,
        seed: DEFAULT_SEED,
        facing4: 'down',
        signal,
      });
      keys.push(rgbaKey(baked.buf));
    }
    const distinct = new Set(keys).size;
    console.log(`worm_remnant ${coverage} signal distinct ${distinct} / 4`);
    assert(distinct === 4, `${coverage} signal distinct ${distinct} want 4/4`);
    const idle = keys[SIGNALS.indexOf('idle')]!;
    const awake = keys[SIGNALS.indexOf('awake')]!;
    const inflated = keys[SIGNALS.indexOf('inflated')]!;
    const strike = keys[SIGNALS.indexOf('strike')]!;
    assert(awake !== idle, `${coverage} awake equals idle`);
    assert(inflated !== idle, `${coverage} inflated equals idle`);
    assert(strike !== idle, `${coverage} strike equals idle`);
  }
}

if (failed > 0) {
  console.error(`check:jia-worm-remnant ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-worm-remnant PASS');
