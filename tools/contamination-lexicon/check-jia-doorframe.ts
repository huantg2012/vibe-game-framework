/**
 * I5-F machine gate: 门框同覆盖档 16 种子去重剪影 = 16；
 * 改写→覆盖粗占格距离 > 0.0059；与街具残骸的跨基体粗占格中位
 * 明显高于现状竖杆对（灯柱/栏柱约 0.008）。度量 6×8，不用 IoU。
 *
 *   npm run check:jia-doorframe
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
import { countOpaquePixels, drawSkeleton } from '../../src/entities/form-renderers/d/genome/parts.ts';
import {
  DOORFRAME_ID,
  buildDoorframeSkeleton,
  paintDoorframeBody,
} from '../../src/entities/form-renderers/d/genome/doorframe.ts';
import {
  STREET_WRECKAGE_ID,
  paintStreetWreckageBody,
} from '../../src/entities/form-renderers/d/genome/street-wreckage.ts';
import { countOpaque4Components, paintWeldedBody } from '../../src/entities/form-renderers/d/genome/weld.ts';
import type { GenomeNode, GenomeSkeleton } from '../../src/entities/form-renderers/d/genome/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE_REWRITE_OVERWRITE = 0.0059;
const LAMP_RAIL_MEDIAN = 0.008;
const CROSS_MEDIAN_FLOOR = 0.016;
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

function openingBox(sk: GenomeSkeleton): { x0: number; x1: number; y0: number; y1: number } | null {
  const posts = sk.parts.filter((p) => p.kind === 'post');
  const beam = sk.parts.find((p) => p.kind === 'beam');
  if (!beam || posts.length === 0) return null;
  const beamBottom = beam.y + beam.h;
  const ground = Math.max(...posts.map((p) => p.y + p.h));
  let x0: number;
  let x1: number;
  if (posts.length >= 2) {
    const ordered = [...posts].sort((a, b) => a.x - b.x);
    x0 = ordered[0]!.x + ordered[0]!.w;
    x1 = ordered[ordered.length - 1]!.x;
  } else {
    const post = posts[0]!;
    const postMid = post.x + post.w / 2;
    const beamMid = beam.x + beam.w / 2;
    if (postMid <= beamMid) {
      x0 = post.x + post.w;
      x1 = beam.x + beam.w;
    } else {
      x0 = beam.x;
      x1 = post.x;
    }
  }
  if (x1 - x0 < 4) return null;
  return { x0, x1, y0: beamBottom, y1: ground };
}

function opaqueInBox(
  buf: { data: Uint8ClampedArray; w: number; h: number },
  box: { x0: number; x1: number; y0: number; y1: number },
): { opaque: number; total: number } {
  const x0 = Math.max(0, Math.floor(box.x0));
  const x1 = Math.min(buf.w, Math.ceil(box.x1));
  const mid0 = box.y0 + (box.y1 - box.y0) * 0.25;
  const mid1 = box.y0 + (box.y1 - box.y0) * 0.85;
  const y0 = Math.max(0, Math.floor(mid0));
  const y1 = Math.min(buf.h, Math.ceil(mid1));
  let opaque = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total += 1;
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) !== 0) opaque += 1;
    }
  }
  return { opaque, total };
}

assert(operatorBudget('infiltrate') === 1, 'I5-D infiltrate budget still 1');
assert(operatorBudget('rewrite') === 3, 'I5-D rewrite budget still 3');
assert(operatorBudget('overwrite') === 5, 'I5-D overwrite budget still 5');
assert(!radiateAllowed('infiltrate') && !radiateAllowed('rewrite'), 'radiate still locked before overwrite');
assert(radiateAllowed('overwrite'), 'radiate still only at overwrite');

const doorSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/genome/doorframe.ts'), 'utf8');
const doorCode = doorSrc
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
  .join('\n');
assert(!/mix32\([^)]*substrate[^)]*\)\s*%\s*3/.test(doorCode), 'must not use mix32(seed, substrate) % 3');
assert(!/\blamp_pillar\b/.test(doorCode), 'doorframe must not name lamp_pillar');
assert(!/\brailing_post\b/.test(doorCode), 'doorframe must not name railing_post');
assert(!/\bstreet_wreckage\b/.test(doorCode), 'doorframe grammar must not branch on street_wreckage');
assert(
  !/if\s*\(\s*(kind|variant|family)\s*===/.test(doorCode),
  'must not hard-cut three silhouette identities',
);

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(/case 'floor':\s*return attachJiaGenomeD\(ctx\);/.test(mixedSrc), 'd-mixed floor path is attachJiaGenomeD');
assert(!mixedSrc.includes('attachJiaD'), 'd-mixed no longer calls attachJiaD');

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('form-renderers/d/genome'), 'RiftScene does not import genome');

assert(!SORTIE_SUBSTRATE_IDS.includes('lamp_pillar'), 'CSV flip: lamp_pillar left sortie');
assert(!SORTIE_SUBSTRATE_IDS.includes('railing_post'), 'CSV flip: railing_post left sortie');
assert(SORTIE_SUBSTRATE_IDS.includes(DOORFRAME_ID), 'CSV flip: doorframe still sortie');
assert(SORTIE_SUBSTRATE_IDS.includes(STREET_WRECKAGE_ID), 'CSV flip: street_wreckage is sortie');

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

for (const coverage of COVERAGES) {
  for (const seed of seedList) {
    const sk = buildDoorframeSkeleton(coverage, seed);
    const posts = sk.parts.filter((p) => p.kind === 'post');
    const beams = sk.parts.filter((p) => p.kind === 'beam');
    const plates = sk.parts.filter((p) => p.kind === 'plate');
    assert(posts.length === 1 || posts.length === 2, `${coverage} seed ${seed} posts ${posts.length} want 1 or 2`);
    assert(beams.length >= 1, `${coverage} seed ${seed} needs the top beam`);
    assert(plates.length === 0, `${coverage} seed ${seed} must not use a street-wreckage plate`);
    assert(sk.canvas.collision === 20, `${coverage} collision must stay 20`);
    if (coverage === 'infiltrate') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 32, 'infiltrate canvas 32x32');
    } else if (coverage === 'rewrite') {
      assert(sk.canvas.w === 32 && sk.canvas.h === 48, 'rewrite canvas 32x48');
    } else {
      assert(sk.canvas.w === 48 && sk.canvas.h === 64, 'overwrite canvas 48x64');
    }

    const box = openingBox(sk);
    assert(box !== null, `${coverage} seed ${seed} opening box missing`);
    if (box) {
      assert(box.x1 - box.x0 >= 6, `${coverage} seed ${seed} opening width ${box.x1 - box.x0} want ≥6`);
      const grammarBuf = drawSkeleton(sk);
      const hole = opaqueInBox(grammarBuf, box);
      const frac = hole.total === 0 ? 1 : hole.opaque / hole.total;
      assert(
        frac <= 0.22,
        `${coverage} seed ${seed} opening filled ${frac.toFixed(3)} (opaque ${hole.opaque}/${hole.total})`,
      );
    }

    const weldedGrammar = paintWeldedBody({
      canvas: sk.canvas,
      parts: sk.parts.map(
        (p): GenomeNode => ({
          kind: p.kind,
          x: p.x,
          y: p.y,
          w: p.w,
          h: p.h,
          mat: p.mat,
          role: p.role,
          bend: p.bend,
        }),
      ),
    });
    assert(countOpaque4Components(weldedGrammar) === 1, `${coverage} seed ${seed} grammar weld not 1`);

    const buf = paintDoorframeBody(coverage, seed);
    const n = countOpaque4Components(buf);
    assert(n === 1, `${coverage} seed ${seed} weld 4-connected ${n} want 1`);
    assert(countOpaquePixels(buf) > 0, `${coverage} seed ${seed} body empty`);
  }

  const masks = seedList.map((seed) => maskOf(paintDoorframeBody(coverage, seed)));
  const distinct = distinctCount(masks);
  console.log(`doorframe ${coverage} distinct ${distinct} / ${SEEDS}`);
  assert(distinct === SEEDS, `${coverage} distinct silhouettes ${distinct} want ${SEEDS}`);
}

const pairDists: number[] = [];
for (const seed of seedList) {
  const rewrite = maskOf(paintDoorframeBody('rewrite', seed));
  const overwrite = maskOf(paintDoorframeBody('overwrite', seed));
  pairDists.push(coarseDist(rewrite, overwrite));
}
const diagSeed = mix32(7, DOORFRAME_ID) % 8192;
const diagDist = coarseDist(
  maskOf(paintDoorframeBody('rewrite', diagSeed)),
  maskOf(paintDoorframeBody('overwrite', diagSeed)),
);
const minDist = Math.min(...pairDists);
const medDist = median(pairDists);
console.log(
  `doorframe rewrite→overwrite coarse  min ${minDist.toFixed(4)}  median ${medDist.toFixed(4)}  seed7 ${diagDist.toFixed(4)}  baseline ${BASELINE_REWRITE_OVERWRITE}`,
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

const crossDists: number[] = [];
for (const seed of seedList) {
  crossDists.push(
    coarseDist(
      maskOf(paintDoorframeBody('overwrite', seed)),
      maskOf(paintStreetWreckageBody('overwrite', seed)),
    ),
  );
}
const crossMin = Math.min(...crossDists);
const crossMed = median(crossDists);
console.log(
  `doorframe↔street_wreckage overwrite coarse  min ${crossMin.toFixed(4)}  median ${crossMed.toFixed(4)}  lamp/rail ~${LAMP_RAIL_MEDIAN}  floor ${CROSS_MEDIAN_FLOOR}`,
);
assert(
  crossMed > CROSS_MEDIAN_FLOOR,
  `cross-substrate median ${crossMed.toFixed(4)} must beat ${CROSS_MEDIAN_FLOOR} (lamp/rail ~${LAMP_RAIL_MEDIAN})`,
);
assert(
  crossMin > LAMP_RAIL_MEDIAN,
  `cross-substrate min ${crossMin.toFixed(4)} must beat lamp/rail ~${LAMP_RAIL_MEDIAN}`,
);

if (failed > 0) {
  console.error(`check:jia-doorframe ${failed} failed`);
  process.exit(1);
}
console.log('check:jia-doorframe PASS');
