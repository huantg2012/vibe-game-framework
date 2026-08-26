/**
 * I5-H production gate: 粗占格判别度。测 `bakeJiaGenome`，禁止再测旧生产甲烤漆入口。
 * 方法对照 `tools/contam-preview/measure-distinctness.ts` 的 coarse / coarseDist：
 * 掩膜对齐到 48×64，降到 6×8 占格率再比 L1。禁止用 IoU 当验收。
 *
 *   npm run check:contam-distinct
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeJiaGenome } from '../../src/entities/form-renderers/d/genome/bake.ts';
import { DOORFRAME_ID } from '../../src/entities/form-renderers/d/genome/doorframe.ts';
import { INSECT_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/insect-remnant.ts';
import { MAMMAL_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/mammal-remnant.ts';
import { ORGANIC_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/organic-remnant.ts';
import { STALK_CLUMP_ID } from '../../src/entities/form-renderers/d/genome/stalk-clump.ts';
import { STREET_WRECKAGE_ID } from '../../src/entities/form-renderers/d/genome/street-wreckage.ts';
import { WORM_REMNANT_ID } from '../../src/entities/form-renderers/d/genome/worm-remnant.ts';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SELF = resolve(ROOT, 'tools/contamination-lexicon/check-contam-distinct.ts');

/** 现状灯柱/栏柱手写分支的改写→覆盖距离。改写→覆盖与跨基体阈值必须严格大于该值。 */
const LEGACY_BASELINE = 0.0059;
/**
 * 先量 `bakeJiaGenome`（种子 1000 + i×977，与各基体闸门同一列表）再锁。
 * 改写→覆盖取七基体已绿最小值（哺乳动物 0.0117）附近，不得拍到 0.0059。
 * 渗透→改写单独锁现状最小值：哺乳动物 0.0052，本批不改骨架。
 */
const INFILTRATE_REWRITE_FLOOR = 0.0051;
const REWRITE_OVERWRITE_FLOOR = 0.0116;
/** 跨甲基体粗占格下限。量得 min 0.0081。 */
const CROSS_SUBSTRATE_FLOOR = 0.008;

const MASK_W = 48;
const MASK_H = 64;
const CD_COLS = 6;
const CD_ROWS = 8;
const SEEDS = 16;
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const SUBSTRATES = [
  STREET_WRECKAGE_ID,
  DOORFRAME_ID,
  STALK_CLUMP_ID,
  ORGANIC_REMNANT_ID,
  INSECT_REMNANT_ID,
  MAMMAL_REMNANT_ID,
  WORM_REMNANT_ID,
] as const;

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

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

/** 只打日志，禁止 assert。 */
function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let uni = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x || y) uni += 1;
    if (x && y) inter += 1;
  }
  return uni === 0 ? 1 : inter / uni;
}

function distinctCount(masks: readonly Uint8Array[]): number {
  const keys = new Set<string>();
  for (const m of masks) keys.add(Buffer.from(m).toString('base64'));
  return keys.size;
}

function median(vals: readonly number[]): number {
  const a = [...vals].sort((x, y) => x - y);
  return a.length === 0 ? 0 : a[a.length >> 1]!;
}

function bakeMask(substrate: string, coverage: CoverageId, seed: number): Uint8Array {
  const baked = bakeJiaGenome({
    substrate,
    coverage,
    seed,
    facing4: 'down',
    signal: 'idle',
  });
  return maskOf(baked.buf);
}

const selfSrc = readFileSync(SELF, 'utf8');
assert(!/from ['"][^'"]*jia-paint['"]/.test(selfSrc), 'production distinct gate must not import old jia paint');
assert(!/from ['"][^'"]*jia-silhouette['"]/.test(selfSrc), 'production distinct gate must not import old jia silhouette');
assert(selfSrc.includes('bakeJiaGenome'), 'production distinct gate must bakeJiaGenome');
assert(!/assert\([^)]*iou/.test(selfSrc), 'must not assert IoU');
assert(REWRITE_OVERWRITE_FLOOR > LEGACY_BASELINE, 'rewrite→overwrite floor must fail the 0.0059 baseline');
assert(CROSS_SUBSTRATE_FLOOR > LEGACY_BASELINE, 'cross-substrate floor must fail the 0.0059 baseline');

const masks: Record<string, Record<CoverageId, Uint8Array[]>> = {};
for (const substrate of SUBSTRATES) {
  masks[substrate] = {
    infiltrate: [],
    rewrite: [],
    overwrite: [],
  };
  for (const coverage of COVERAGES) {
    const row = seedList.map((seed) => bakeMask(substrate, coverage, seed));
    masks[substrate][coverage] = row;
    const distinct = distinctCount(row);
    console.log(`${substrate} ${coverage} distinct ${distinct} / ${SEEDS}`);
    assert(distinct === SEEDS, `${substrate} ${coverage} distinct ${distinct} want ${SEEDS}`);
  }
}

const adjacentDists: number[] = [];
const rewriteOverwriteBySub: Record<string, number> = {};
for (const substrate of SUBSTRATES) {
  const infRew: number[] = [];
  const rewOvr: number[] = [];
  const iouInfRew: number[] = [];
  const iouRewOvr: number[] = [];
  for (let i = 0; i < SEEDS; i++) {
    const inf = masks[substrate]!.infiltrate[i]!;
    const rew = masks[substrate]!.rewrite[i]!;
    const ovr = masks[substrate]!.overwrite[i]!;
    const d0 = coarseDist(inf, rew);
    const d1 = coarseDist(rew, ovr);
    infRew.push(d0);
    rewOvr.push(d1);
    adjacentDists.push(d0, d1);
    iouInfRew.push(iou(inf, rew));
    iouRewOvr.push(iou(rew, ovr));
  }
  const rewOvrMin = Math.min(...rewOvr);
  rewriteOverwriteBySub[substrate] = rewOvrMin;
  console.log(
    [
      `${substrate} adjacent coarse`,
      `infiltrate→rewrite min ${Math.min(...infRew).toFixed(4)} median ${median(infRew).toFixed(4)}`,
      `rewrite→overwrite min ${rewOvrMin.toFixed(4)} median ${median(rewOvr).toFixed(4)}`,
      `(IoU log only inf→rew ${median(iouInfRew).toFixed(3)} rew→ovr ${median(iouRewOvr).toFixed(3)})`,
    ].join('  '),
  );
  assert(
    Math.min(...infRew) > INFILTRATE_REWRITE_FLOOR,
    `${substrate} infiltrate→rewrite min ${Math.min(...infRew).toFixed(4)} want > ${INFILTRATE_REWRITE_FLOOR}`,
  );
  assert(
    rewOvrMin > REWRITE_OVERWRITE_FLOOR,
    `${substrate} rewrite→overwrite min ${rewOvrMin.toFixed(4)} want > ${REWRITE_OVERWRITE_FLOOR}`,
  );
}

const infRewAll: number[] = [];
const rewOvrAll: number[] = [];
for (let i = 0; i < adjacentDists.length; i += 2) {
  infRewAll.push(adjacentDists[i]!);
  rewOvrAll.push(adjacentDists[i + 1]!);
}
const infRewMin = Math.min(...infRewAll);
const rewOvrMinAll = Math.min(...rewOvrAll);
console.log(
  `infiltrate→rewrite coarse min ${infRewMin.toFixed(4)}  floor ${INFILTRATE_REWRITE_FLOOR}`,
);
console.log(
  `rewrite→overwrite coarse min ${rewOvrMinAll.toFixed(4)}  floor ${REWRITE_OVERWRITE_FLOOR}  legacy ${LEGACY_BASELINE}`,
);
assert(infRewMin > INFILTRATE_REWRITE_FLOOR, `infiltrate→rewrite min ${infRewMin.toFixed(4)} want > ${INFILTRATE_REWRITE_FLOOR}`);
assert(rewOvrMinAll > REWRITE_OVERWRITE_FLOOR, `rewrite→overwrite min ${rewOvrMinAll.toFixed(4)} want > ${REWRITE_OVERWRITE_FLOOR}`);
assert(rewOvrMinAll > LEGACY_BASELINE, `rewrite→overwrite min ${rewOvrMinAll.toFixed(4)} must beat legacy ${LEGACY_BASELINE}`);

const crossDists: number[] = [];
for (const coverage of COVERAGES) {
  for (let i = 0; i < SEEDS; i++) {
    for (let a = 0; a < SUBSTRATES.length; a++) {
      for (let b = a + 1; b < SUBSTRATES.length; b++) {
        const left = masks[SUBSTRATES[a]!]![coverage][i]!;
        const right = masks[SUBSTRATES[b]!]![coverage][i]!;
        crossDists.push(coarseDist(left, right));
      }
    }
  }
}
const crossMin = Math.min(...crossDists);
const crossMed = median(crossDists);
console.log(
  `cross-substrate coarse min ${crossMin.toFixed(4)} median ${crossMed.toFixed(4)}  floor ${CROSS_SUBSTRATE_FLOOR}`,
);
assert(crossMin > CROSS_SUBSTRATE_FLOOR, `cross-substrate min ${crossMin.toFixed(4)} want > ${CROSS_SUBSTRATE_FLOOR}`);
assert(crossMin > LEGACY_BASELINE, `cross-substrate min ${crossMin.toFixed(4)} must beat legacy ${LEGACY_BASELINE}`);

console.log(
  `rewrite→overwrite mins ${SUBSTRATES.map((id) => `${id}=${rewriteOverwriteBySub[id]!.toFixed(4)}`).join(' ')}`,
);

if (failed > 0) {
  console.error(`check:contam-distinct FAILED (${failed})`);
  process.exit(1);
}
console.log('check:contam-distinct OK');
