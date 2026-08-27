/**
 * I5-G machine gate: 有机残影同覆盖档 16 种子去重剪影 = 16；
 * 改写→覆盖粗占格距离 > 0.0059（该值必须 FAIL）。
 * 渗透→改写不得只靠画布从 32 高变 48 高：消掉画布垫高后再比。
 *
 *   npm run check:jia-organic-remnant
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
  ORGANIC_REMNANT_ID,
  buildOrganicRemnantSkeleton,
  paintOrganicRemnantBody,
} from '../../src/entities/form-renderers/d/genome/organic-remnant.ts';
import { countOpaque4Components } from '../../src/entities/form-renderers/d/genome/weld.ts';
import type { GenomeSkeleton } from '../../src/entities/form-renderers/d/genome/types.ts';

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
} | null {
  let x0 = buf.w;
  let y0 = buf.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x0, y0, x1, y1 };
}

function cropOpaque(buf: { data: Uint8ClampedArray; w: number; h: number }): Uint8Array | null {
  const box = opaqueBox(buf);
  if (!box) return null;
  const w = box.x1 - box.x0 + 1;
  const h = box.y1 - box.y0 + 1;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = box.x0 + x;
      const sy = box.y0 + y;
      if ((buf.data[(sy * buf.w + sx) * 4 + 3] ?? 0) !== 0) out[y * w + x] = 1;
    }
  }
  return out;
}

function cropsEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function dimKey(sk: GenomeSkeleton): string {
  return sk.parts
    .filter((p) => p.kind === 'mass' || p.role === 'limb')
    .map((p) => `${p.kind}:${p.w}x${p.h}`)
    .sort()
    .join(',');
}

function relativeLayout(sk: GenomeSkeleton): string {
  const minX = Math.min(...sk.parts.map((p) => p.x));
  const minY = Math.min(...sk.parts.map((p) => p.y));
  return sk.parts
    .map((p) => `${p.kind}:${p.role ?? ''}:${p.x - minX},${p.y - minY},${p.w}x${p.h}`)
    .sort()
    .join('|');
}

assert(operatorBudget('infiltrate') === 1, 'I5-D infiltrate budget still 1');
assert(operatorBudget('rewrite') === 3, 'I5-D rewrite budget still 3');
assert(operatorBudget('overwrite') === 5, 'I5-D overwrite budget still 5');
assert(!radiateAllowed('infiltrate') && !radiateAllowed('rewrite'), 'radiate still locked before overwrite');
assert(radiateAllowed('overwrite'), 'radiate still only at overwrite');

const organicSrc = readFileSync(
  resolve(ROOT, 'src/entities/form-renderers/d/genome/organic-remnant.ts'),
  'utf8',
);
const organicCode = organicSrc
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
  .join('\n');
assert(!/mix32\([^)]*substrate[^)]*\)\s*%\s*3/.test(organicCode), 'must not use mix32(seed, substrate) % 3');
assert(!/\binsect_remnant\b/.test(organicCode), 'organic must not implement insect grammar');
assert(!/\bmammal_remnant\b/.test(organicCode), 'organic must not implement mammal grammar');
assert(!/\bworm_remnant\b/.test(organicCode), 'organic must not implement worm grammar');
assert(
  !/if\s*\(\s*(kind|variant|family)\s*===/.test(organicCode),
  'must not hard-cut silhouette identities',
);

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/attach.ts'), 'utf8');
assert(!attachSrc.includes('ORGANIC_REMNANT_ID'), 'organic must not join isAnchoredFloorJia');

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(/case 'floor':\s*return attachJiaGenomeD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is attachJiaGenomeD');
assert(!mixedSrc.includes('attachJiaD'), 'd-mixed no longer calls attachJiaD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

assert(SORTIE_SUBSTRATE_IDS.includes(ORGANIC_REMNANT_ID), 'CSV flip: organic_remnant still sortie');

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

for (const coverage of COVERAGES) {
  for (const seed of seedList) {
    const sk = buildOrganicRemnantSkeleton(coverage, seed);
    const masses = sk.parts.filter((p) => p.kind === 'mass');
    const limbs = sk.parts.filter((p) => p.role === 'limb' && p.kind === 'post');
    assert(masses.length === 1, `${coverage} seed ${seed} needs exactly 1 mass, got ${masses.length}`);
    assert(
      limbs.length >= 2 && limbs.length <= 4,
      `${coverage} seed ${seed} limbs ${limbs.length} want 2–4`,
    );
    const heights = new Set(limbs.map((p) => p.h));
    assert(heights.size >= 2, `${coverage} seed ${seed} limbs must be unequal length`);
    const mass = masses[0]!;
    const bottomLimbs = limbs.filter((p) => p.y + p.h >= mass.y + mass.h - 2);
    assert(
      !(limbs.length === 4 && bottomLimbs.length === 4),
      `${coverage} seed ${seed} four bottom limbs read as a quadruped`,
    );
    const leftPairs = limbs.filter((p) => p.x + p.w <= mass.x + 1);
    const rightPairs = limbs.filter((p) => p.x >= mass.x + mass.w - 1);
    assert(
      !(leftPairs.length >= 3 && rightPairs.length >= 3),
      `${coverage} seed ${seed} left/right pairs read as an insect`,
    );
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas 48x64');
    }
    const buf = paintOrganicRemnantBody(coverage, seed);
    const n = countOpaque4Components(buf);
    assert(n === 1, `${coverage} seed ${seed} weld 4-connected ${n} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} body empty`);
  }

  const masks = seedList.map((seed) => maskOf(paintOrganicRemnantBody(coverage, seed)));
  const distinct = distinctCount(masks);
  console.log(`organic_remnant ${coverage} distinct ${distinct} / ${SEEDS}`);
  assert(distinct === SEEDS, `${coverage} distinct silhouettes ${distinct} want ${SEEDS}`);
}

for (const seed of seedList) {
  const infSk = buildOrganicRemnantSkeleton('infiltrate', seed);
  const rewSk = buildOrganicRemnantSkeleton('rewrite', seed);
  assert(
    dimKey(infSk) !== dimKey(rewSk),
    `seed ${seed} infiltrate→rewrite part sizes identical (canvas pad only)`,
  );
  assert(
    relativeLayout(infSk) !== relativeLayout(rewSk),
    `seed ${seed} infiltrate→rewrite layout is only a downward shift`,
  );
  const infBuf = paintOrganicRemnantBody('infiltrate', seed);
  const rewBuf = paintOrganicRemnantBody('rewrite', seed);
  const infCrop = cropOpaque(infBuf);
  const rewCrop = cropOpaque(rewBuf);
  assert(infCrop !== null && rewCrop !== null, `seed ${seed} empty body after crop`);
  if (infCrop && rewCrop) {
    assert(
      !cropsEqual(infCrop, rewCrop),
      `seed ${seed} infiltrate→rewrite identical after bbox align (canvas height fake)`,
    );
  }
}

const pairDists: number[] = [];
for (const seed of seedList) {
  const rewrite = maskOf(paintOrganicRemnantBody('rewrite', seed));
  const overwrite = maskOf(paintOrganicRemnantBody('overwrite', seed));
  pairDists.push(coarseDist(rewrite, overwrite));
}
const diagSeed = mix32(7, ORGANIC_REMNANT_ID) % 8192;
const diagDist = coarseDist(
  maskOf(paintOrganicRemnantBody('rewrite', diagSeed)),
  maskOf(paintOrganicRemnantBody('overwrite', diagSeed)),
);
const minDist = Math.min(...pairDists);
const medDist = median(pairDists);
console.log(
  `organic_remnant rewrite→overwrite coarse  min ${minDist.toFixed(4)}  median ${medDist.toFixed(4)}  seed7 ${diagDist.toFixed(4)}  baseline ${BASELINE_REWRITE_OVERWRITE}`,
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
  console.error(`check:jia-organic-remnant ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-organic-remnant PASS');
