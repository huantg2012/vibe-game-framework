/**
 * I5-G machine gate: 残茎同覆盖档 16 种子去重剪影 = 16；
 * 改写→覆盖粗占格距离 > 0.0059（该值必须 FAIL）。度量 6×8，不用 IoU。
 *
 *   npm run check:jia-stalk-clump
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mix32 } from '../../src/generation/seed-fork.ts';
import {
  SORTIE_SUBSTRATE_IDS,
  type CoverageId,
} from '../../src/generated/contamination-lexicon-data.ts';
import { operatorBudget, radiateAllowed } from '../../src/entities/form-renderers/d/genome/operators.ts';
import { countOpaquePixels } from '../../src/entities/form-renderers/d/genome/parts.ts';
import {
  STALK_CLUMP_ID,
  buildStalkClumpSkeleton,
  paintStalkClumpBody,
} from '../../src/entities/form-renderers/d/genome/stalk-clump.ts';
import { countOpaque4Components } from '../../src/entities/form-renderers/d/genome/weld.ts';

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

assert(operatorBudget('infiltrate') === 1, 'I5-D infiltrate budget still 1');
assert(operatorBudget('rewrite') === 3, 'I5-D rewrite budget still 3');
assert(operatorBudget('overwrite') === 5, 'I5-D overwrite budget still 5');
assert(!radiateAllowed('infiltrate') && !radiateAllowed('rewrite'), 'radiate still locked before overwrite');
assert(radiateAllowed('overwrite'), 'radiate still only at overwrite');

const stalkSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/stalk-clump.ts'), 'utf8');
const stalkCode = stalkSrc
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
  .join('\n');
assert(!/mix32\([^)]*substrate[^)]*\)\s*%\s*3/.test(stalkCode), 'must not use mix32(seed, substrate) % 3');
assert(!/\binsect_remnant\b/.test(stalkCode), 'stalk must not implement insect grammar');
assert(!/\bmammal_remnant\b/.test(stalkCode), 'stalk must not implement mammal grammar');
assert(!/\bworm_remnant\b/.test(stalkCode), 'stalk must not implement worm grammar');
assert(
  !/if\s*\(\s*(kind|variant|family)\s*===/.test(stalkCode),
  'must not hard-cut silhouette identities',
);

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/attach.ts'), 'utf8');
assert(!attachSrc.includes('STALK_CLUMP_ID'), 'stalk must not join isAnchoredFloorJia');

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(/case 'floor':\s*return attachJiaD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is still attachJiaD');
assert(!mixedSrc.includes('attachJiaGenomeD'), 'd-mixed does not call attachJiaGenomeD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

assert(SORTIE_SUBSTRATE_IDS.includes(STALK_CLUMP_ID), 'CSV flip: stalk_clump still sortie');

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

for (const coverage of COVERAGES) {
  for (const seed of seedList) {
    const sk = buildStalkClumpSkeleton(coverage, seed);
    const posts = sk.parts.filter((p) => p.kind === 'post' && p.role === 'spine');
    const plates = sk.parts.filter((p) => p.kind === 'plate');
    const masses = sk.parts.filter((p) => p.kind === 'mass');
    assert(posts.length >= 3, `${coverage} seed ${seed} needs ≥3 stem posts, got ${posts.length}`);
    assert(posts.length <= 12, `${coverage} seed ${seed} stem posts ${posts.length} look like a packed column`);
    assert(plates.length >= 1, `${coverage} seed ${seed} needs the shared ground plate`);
    assert(masses.length === 0, `${coverage} seed ${seed} must not be a segmented mass body`);
    assert(
      posts.every((p) => p.w >= 1 && p.w <= 3),
      `${coverage} seed ${seed} stem width must stay 1–3`,
    );
    const minX = Math.min(...posts.map((p) => p.x));
    const maxX = Math.max(...posts.map((p) => p.x + p.w));
    const maxW = Math.max(...posts.map((p) => p.w));
    assert(maxX - minX > maxW + 1, `${coverage} seed ${seed} must be a clump with gaps, not one column`);
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas 48x64');
    }
    const buf = paintStalkClumpBody(coverage, seed);
    const n = countOpaque4Components(buf);
    assert(n === 1, `${coverage} seed ${seed} weld 4-connected ${n} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} body empty`);
  }

  const masks = seedList.map((seed) => maskOf(paintStalkClumpBody(coverage, seed)));
  const distinct = distinctCount(masks);
  console.log(`stalk_clump ${coverage} distinct ${distinct} / ${SEEDS}`);
  assert(distinct === SEEDS, `${coverage} distinct silhouettes ${distinct} want ${SEEDS}`);
}

const pairDists: number[] = [];
for (const seed of seedList) {
  const rewrite = maskOf(paintStalkClumpBody('rewrite', seed));
  const overwrite = maskOf(paintStalkClumpBody('overwrite', seed));
  pairDists.push(coarseDist(rewrite, overwrite));
}
const diagSeed = mix32(7, STALK_CLUMP_ID) % 8192;
const diagDist = coarseDist(
  maskOf(paintStalkClumpBody('rewrite', diagSeed)),
  maskOf(paintStalkClumpBody('overwrite', diagSeed)),
);
const minDist = Math.min(...pairDists);
const medDist = median(pairDists);
console.log(
  `stalk_clump rewrite→overwrite coarse  min ${minDist.toFixed(4)}  median ${medDist.toFixed(4)}  seed7 ${diagDist.toFixed(4)}  baseline ${BASELINE_REWRITE_OVERWRITE}`,
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
  console.error(`check:jia-stalk-clump ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-stalk-clump PASS');
