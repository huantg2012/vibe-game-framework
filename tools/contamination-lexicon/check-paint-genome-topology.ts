/**
 * 占漆拓扑闸门：测 `bakePaintGenome`，禁止测旧占漆挂载与旧簇布局函数。
 * 方法：占用掩膜降到 8×8 粗占格再比 L1。禁止用 IoU 当验收。
 * 活层：`paintPaintGenomeLive` 在 t=0 与四分之一周期峰值之间必须有像素差，且峰值不得等于旧 4 帧 nearest 缩放。相邻 16ms 量化后可能同像素，故不测邻帧。
 * 生长方向：测场值位移（禁止 IoU）。油膜末端沿主轴 > 侧向；灰幕外沿 > 中心；菌毯瓣尖 > 瓣谷。先量再锁。
 *
 * 热修后先量再锁（种子 1000 + i×977，连续性 colony，画布 88，2026-08-27）：
 *   跨基体 coarse min 实测 0.1154 → CROSS_SUBSTRATE_FLOOR 0.10（热修前 0.06）
 *   覆盖三档两两 min 实测灰幕渗透→覆盖 0.0682 → COVERAGE_PAIR_FLOOR 0.06
 *   整块 vs 菌落 min 实测 0.0248 → CONTINUITY_FLOOR 0.02
 *   菌毯覆盖中心占用 min 实测 0.99；灰幕中心 max 实测 0.045
 *   油膜变体两两 coarse min：第一轮 A/B/C 实测 0.0183；第二轮 D/E/F（kimi-k3，从「油膜做污染体基底」原初 idea 重推：聚珠成滩 / 沾抹拖尾 / 薄滩收边）加入后六支两两 min 实测 0.0183（A→C；新变体最小对 E→A 0.0283，F 与一切 ≥0.11）→ VEIN_VARIANT_PAIR_FLOOR 0.015
 *   油膜生产三变体 × 三覆盖档 vs 菌毯 lobe_mass / 灰幕 holed_veil 粗占格（I7-T，种子 1000 + i×977，连续性 colony，2026-08-27）：
 *     全组 min 实测 0.1462（v5 薄滩渗透 vs 菌毯）→ PRODUCTION_CROSS_FLOOR 0.12
 *     v3 聚珠 vs 菌毯 min 0.1698 / vs 灰幕 min 0.1710
 *     v4 沾抹 vs 菌毯 min 0.2071 / vs 灰幕 min 0.1887
 *     v5 薄滩 vs 菌毯 min 0.1462 / vs 灰幕 min 0.2614（薄滩覆盖档未撞灰幕）
 *   活层生长方向（整块单团，峰值相对谷值，2026-08-27）：油膜主轴 1.6015 / 尖-侧 1.3779 / 嗅觉主轴 1.5270；灰幕外沿 3.5944 / 内沿内收 3.1302；菌毯瓣尖 1.4547 / 尖-谷 2.0447
 *   油膜三变体活层（整块单团，峰值相对谷值，2026-08-27 I7-R）：聚珠径向 2.3979 / 珠间 |Δ| 1.4031 / 单位 min 7；沾抹主轴 6.0000 / 尖-侧 5.7771 / 嗅觉 9.1962；薄滩径向 4.4467 / 边场 Δ 0.0981 / 内部 glow Δ 0
 *
 *   npm run check:paint-genome-topology
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bakePaintGenome,
  collectPaintGenomeFloorTiles,
  occupancyMaskOf,
} from '../../src/entities/form-renderers/d/paint-genome/bake.ts';
import {
  oilFilmProductionVeinVariant,
  resolvePaintVeinVariant,
  type PaintVeinVariant,
} from '../../src/entities/form-renderers/d/paint-genome/topology.ts';
import { PAINT_BREATH, paintPaintGenomeLive } from '../../src/entities/form-renderers/d/paint-genome/live.ts';
import type { ContinuityId, CoverageId } from '../../src/generated/contamination-lexicon-data.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SELF = resolve(ROOT, 'tools/contamination-lexicon/check-paint-genome-topology.ts');
const PAINT_DIR = resolve(ROOT, 'src/entities/form-renderers/d/paint-genome');

/** 先量再锁。跨基体三种拓扑（团/树/环）粗占格应明显分开。热修前地板 0.06。 */
const CROSS_SUBSTRATE_FLOOR = 0.1;
/** 同基体渗透 / 改写 / 覆盖三档两两可分，禁止只测渗透→覆盖。 */
const COVERAGE_PAIR_FLOOR = 0.06;
/** 占用轴进了烘焙：不同 sense 或 rhythm 粗占格必须 > 0。 */
const AXIS_DIST_FLOOR = 0;
/** 整块 vs 菌落（同画布）必须可分。合同写 organism，实现 ContinuityId 是 monolith。 */
const CONTINUITY_FLOOR = 0.02;
/** 油膜渗透包围盒填充必须明显低于菌毯（树不能和团一样实）。 */
const OIL_BBOX_VS_FUNGAL = 0.72;
/** 菌毯覆盖档中心仍是肉；灰幕中心应空。 */
const FUNGAL_OVERWRITE_CENTER_MIN = 0.55;
const ASH_CENTER_MAX = 0.2;
/** 油膜六变体（两轮抽卡）两两粗占格。先量再锁。六支实测 min 0.0183。 */
const VEIN_VARIANT_PAIR_FLOOR = 0.015;
/** 生产油膜 3/4/5 × 三覆盖档 vs 菌毯/灰幕缺省粗占格。先量再锁。全组实测 min 0.1462。 */
const PRODUCTION_CROSS_FLOOR = 0.12;
const PRODUCTION_VEIN_VARIANTS: readonly (3 | 4 | 5)[] = [3, 4, 5];
const PRODUCTION_VEIN_LABEL: Record<3 | 4 | 5, string> = {
  3: 'beads',
  4: 'smear',
  5: 'rim_pool',
};

const CD = 8;
const SEEDS = 8;
const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const SUBSTRATES = ['fungal_mat', 'oil_film', 'ash_veil'] as const;
const COVERAGE_PAIRS: readonly [CoverageId, CoverageId][] = [
  ['infiltrate', 'rewrite'],
  ['rewrite', 'overwrite'],
  ['infiltrate', 'overwrite'],
];

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed += 1;
  console.error(`FAIL ${msg}`);
}

function coarse(mask: Uint8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(CD * CD);
  const cw = w / CD;
  const ch = h / CD;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      const c = Math.min(CD - 1, (x / cw) | 0);
      const r = Math.min(CD - 1, (y / ch) | 0);
      const bin = r * CD + c;
      out[bin] = (out[bin] ?? 0) + 1;
    }
  }
  const per = cw * ch;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / per;
  return out;
}

function coarseDist(a: Uint8Array, b: Uint8Array, w: number, h: number): number {
  const ca = coarse(a, w, h);
  const cb = coarse(b, w, h);
  let s = 0;
  for (let i = 0; i < ca.length; i++) s += Math.abs(ca[i]! - cb[i]!);
  return s / ca.length;
}

function centerOccupancy(mask: Uint8Array, w: number, h: number, radiusFrac: number): number {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const r = Math.min(w, h) * radiusFrac;
  const r2 = r * r;
  let n = 0;
  let occ = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > r2) continue;
      n += 1;
      if (mask[y * w + x]) occ += 1;
    }
  }
  return n === 0 ? 0 : occ / n;
}

function bboxFill(mask: Uint8Array, w: number, h: number): number {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      n += 1;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (n === 0 || maxX < minX) return 0;
  return n / ((maxX - minX + 1) * (maxY - minY + 1));
}

function buffersEqual(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function importLines(src: string): string[] {
  return src.split('\n').filter((line) => /^\s*import\s/.test(line));
}

function bakeOne(
  substrate: string,
  coverage: CoverageId,
  seed: number,
  extra: {
    continuity?: ContinuityId;
    sense?: string;
    rhythm?: string;
    veinVariant?: PaintVeinVariant;
  } = {},
) {
  return bakePaintGenome({
    substrate,
    coverage,
    seed,
    continuity: extra.continuity ?? 'colony',
    sense: extra.sense ?? 'sense_touch',
    rhythm: extra.rhythm ?? 'rhythm_open',
    fragmentTypeId: 'frag-clinic',
    veinVariant: extra.veinVariant,
  });
}

const selfSrc = readFileSync(SELF, 'utf8');
assert(selfSrc.includes('bakePaintGenome'), 'gate must bakePaintGenome');
assert(
  !importLines(selfSrc).some((line) => line.includes('/bing') || line.includes('bing-shape')),
  'gate must not import old paint attach or cluster layout',
);
assert(!/assert\([^)]*iou/i.test(selfSrc), 'must not assert IoU');
assert(selfSrc.includes('sense_touch') && selfSrc.includes('rhythm_pulse'), 'gate must bake occupying sense/rhythm');
assert(selfSrc.includes("continuity: 'monolith'") || selfSrc.includes('continuity: extra.continuity'), 'gate probes continuity');
assert(selfSrc.includes('veinVariant'), 'gate must bake oil-film vein variants');
assert(selfSrc.includes('PRODUCTION_CROSS_FLOOR'), 'gate must floor production oil vs fungal/ash');

const paintFiles = readdirSync(PAINT_DIR).filter((name) => name.endsWith('.ts'));
assert(paintFiles.length > 0, 'paint-genome module present');
for (const name of paintFiles) {
  const src = readFileSync(resolve(PAINT_DIR, name), 'utf8');
  const imports = importLines(src);
  assert(
    !imports.some((line) => line.includes('form-renderers/d/genome')),
    `${name} must not import d/genome`,
  );
  assert(!imports.some((line) => line.includes('genome/operators')), `${name} must not import genome operators`);
  assert(!imports.some((line) => line.includes('genome/weld')), `${name} must not import genome weld`);
  assert(!imports.some((line) => line.includes('contam-preview')), `${name} must not import proto tools`);
  assert(!imports.some((line) => /from ['"]tools\//.test(line)), `${name} must not import tools/**`);
  if (name === 'bake.ts' || name === 'attach.ts') {
    assert(src.includes('sense'), `${name} must read sense`);
    assert(src.includes('rhythm'), `${name} must read rhythm`);
  }
  if (name === 'attach.ts' || name === 'live.ts') {
    assert(!src.includes('pingPongFrame'), `${name} must not ping-pong prebaked frames`);
    assert(!src.includes('BREATH_FRAMES'), `${name} must not cut four baked breath frames`);
  }
  if (name === 'live.ts') {
    assert(src.includes('growth'), 'live must deform along growth guide');
    assert(!src.includes('1 + amp * signed'), 'live must not anisotropic-stretch from canvas center');
    assert(src.includes('veinVariant'), 'live must branch oil-film variants');
  }
}

const mixedSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/scheme-d-mixed.ts'), 'utf8');
assert(mixedSrc.includes('attachBingPaintGenome'), 'd-mixed oil film routes to paint genome');
assert(
  /substrate === 'oil_film' \? attachBingPaintGenome\(ctx\) : attachBingD\(ctx\)/.test(mixedSrc),
  'd-mixed paint: oil_film paint-genome, else attachBingD',
);
assert(mixedSrc.includes('attachBingD'), 'd-mixed keeps attachBingD for fungal_mat / ash_veil');
assert(
  !/case 'paint':\s*return attachBingD\(ctx\);/.test(mixedSrc),
  'd-mixed paint path no longer funnels all paint through attachBingD',
);

const gymSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/gym-attach.ts'), 'utf8');
assert(gymSrc.includes('attachBingPaintGenome'), 'gym visual routes paint to attachBingPaintGenome');
assert(/occupancy === 'paint'\) return attachBingPaintGenome/.test(gymSrc), 'gym paint occupancy uses paint genome');

const attachSrc = readFileSync(resolve(ROOT, 'src/entities/form-renderers/d/paint-genome/attach.ts'), 'utf8');
assert(attachSrc.includes('resolvePaintVeinVariant'), 'paint-genome attach samples omitted oil-film variants');
assert(attachSrc.includes('oil_film_variant') || attachSrc.includes('resolvePaintVeinVariant'), 'attach uses production oil-film sample');
assert(attachSrc.includes('collectPaintGenomeFloorTiles'), 'attach collects paint step floors');
assert(attachSrc.includes('stepFloors'), 'attach exposes stepFloors');

assert(oilFilmProductionVeinVariant(1000) === oilFilmProductionVeinVariant(1000), 'oil film sample is stable');
assert(resolvePaintVeinVariant('oil_film', 1000) === oilFilmProductionVeinVariant(1000), 'omitted oil film variant samples');
assert(resolvePaintVeinVariant('oil_film', 1000, 0) === 0, 'explicit pin wins over sample');
assert(resolvePaintVeinVariant('fungal_mat', 1000) === undefined, 'fungal_mat does not sample oil variants');
assert(resolvePaintVeinVariant('ash_veil', 1000) === undefined, 'ash_veil does not sample oil variants');
{
  const sampled = new Set<number>();
  for (let seed = 0; seed < 96; seed++) sampled.add(oilFilmProductionVeinVariant(seed));
  assert(
    sampled.has(3) && sampled.has(4) && sampled.has(5) && sampled.size === 3,
    `oil film sample covers 3/4/5 (got ${[...sampled].join(',')})`,
  );
}
{
  const topoSrc = readFileSync(resolve(PAINT_DIR, 'topology.ts'), 'utf8');
  assert(
    topoSrc.includes("mix32(seed, 'oil_film_variant')"),
    'oil film sample uses mix32(seed, oil_film_variant)',
  );
  assert(topoSrc.includes('function veinTree'), 'default veinTree implementation stays for A/B/C and gate');
}

const riftSrc = readFileSync(resolve(ROOT, 'src/scenes/rift-scene.ts'), 'utf8');
assert(!riftSrc.includes('paint-genome'), 'RiftScene does not import paint-genome');
assert(!riftSrc.includes('src/gym/'), 'RiftScene does not import gym');

type Baked = ReturnType<typeof bakePaintGenome>;
const baked: Record<string, Record<CoverageId, Baked[]>> = {};

for (const substrate of SUBSTRATES) {
  baked[substrate] = { infiltrate: [], rewrite: [], overwrite: [] };
  for (const coverage of COVERAGES) {
    for (const seed of seedList) {
      const row = bakeOne(substrate, coverage, seed);
      assert(row.canvasW === 88 && row.canvasH === 88, `${substrate} canvas ${row.canvasW}x${row.canvasH} want 88`);
      const opaque = occupancyMaskOf(row.buf).reduce((n, v) => n + v, 0);
      assert(opaque > 20, `${substrate} ${coverage} seed ${seed} opaque ${opaque} want > 20`);
      baked[substrate]![coverage].push(row);
    }
  }
}

assert(baked.fungal_mat!.infiltrate[0]!.topology === 'lobe_mass', 'fungal_mat topology lobe_mass');
assert(baked.oil_film!.infiltrate[0]!.topology === 'vein_tree', 'oil_film topology vein_tree');
assert(baked.ash_veil!.infiltrate[0]!.topology === 'holed_veil', 'ash_veil topology holed_veil');

const fieldBake = bakeOne('oil_film', 'infiltrate', 1000, { continuity: 'field' });
assert(fieldBake.canvasW === 144 && fieldBake.canvasH === 144, `field canvas ${fieldBake.canvasW} want 144`);

const crossDists: number[] = [];
for (const coverage of COVERAGES) {
  for (let i = 0; i < SEEDS; i++) {
    for (let a = 0; a < SUBSTRATES.length; a++) {
      for (let b = a + 1; b < SUBSTRATES.length; b++) {
        const left = baked[SUBSTRATES[a]!]![coverage][i]!;
        const right = baked[SUBSTRATES[b]!]![coverage][i]!;
        crossDists.push(coarseDist(occupancyMaskOf(left.buf), occupancyMaskOf(right.buf), left.canvasW, left.canvasH));
      }
    }
  }
}
const crossMin = Math.min(...crossDists);
console.log(`cross-substrate coarse min ${crossMin.toFixed(4)}  floor ${CROSS_SUBSTRATE_FLOOR}`);
assert(crossMin > CROSS_SUBSTRATE_FLOOR, `cross-substrate min ${crossMin.toFixed(4)} want > ${CROSS_SUBSTRATE_FLOOR}`);

for (const substrate of SUBSTRATES) {
  for (const [leftId, rightId] of COVERAGE_PAIRS) {
    const dists: number[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const left = baked[substrate]![leftId][i]!;
      const right = baked[substrate]![rightId][i]!;
      dists.push(coarseDist(occupancyMaskOf(left.buf), occupancyMaskOf(right.buf), left.canvasW, left.canvasH));
    }
    const dMin = Math.min(...dists);
    console.log(`${substrate} ${leftId}→${rightId} coarse min ${dMin.toFixed(4)}  floor ${COVERAGE_PAIR_FLOOR}`);
    assert(
      dMin > COVERAGE_PAIR_FLOOR,
      `${substrate} ${leftId}→${rightId} min ${dMin.toFixed(4)} want > ${COVERAGE_PAIR_FLOOR}`,
    );
  }
}

const fungalOvrCenters: number[] = [];
const ashInfCenters: number[] = [];
const ashOvrCenters: number[] = [];
for (let i = 0; i < SEEDS; i++) {
  const fungalOvr = baked.fungal_mat!.overwrite[i]!;
  const ashInf = baked.ash_veil!.infiltrate[i]!;
  const ashOvr = baked.ash_veil!.overwrite[i]!;
  const fC = centerOccupancy(occupancyMaskOf(fungalOvr.buf), fungalOvr.canvasW, fungalOvr.canvasH, 0.14);
  const aInf = centerOccupancy(occupancyMaskOf(ashInf.buf), ashInf.canvasW, ashInf.canvasH, 0.14);
  const aOvr = centerOccupancy(occupancyMaskOf(ashOvr.buf), ashOvr.canvasW, ashOvr.canvasH, 0.14);
  fungalOvrCenters.push(fC);
  ashInfCenters.push(aInf);
  ashOvrCenters.push(aOvr);
  assert(
    fC > aInf,
    `fungal overwrite center ${fC.toFixed(3)} want > ash infiltrate ${aInf.toFixed(3)} (not the same hollow)`,
  );
  assert(
    fC > aOvr,
    `fungal overwrite center ${fC.toFixed(3)} want > ash overwrite ${aOvr.toFixed(3)}`,
  );
}
const fungalOvrCenterMin = Math.min(...fungalOvrCenters);
const ashInfCenterMax = Math.max(...ashInfCenters);
const ashOvrCenterMax = Math.max(...ashOvrCenters);
console.log(
  `fungal overwrite center min ${fungalOvrCenterMin.toFixed(4)}  floor ${FUNGAL_OVERWRITE_CENTER_MIN}`,
);
console.log(`ash infiltrate center max ${ashInfCenterMax.toFixed(4)}  ceiling ${ASH_CENTER_MAX}`);
console.log(`ash overwrite center max ${ashOvrCenterMax.toFixed(4)}  ceiling ${ASH_CENTER_MAX}`);
assert(
  fungalOvrCenterMin > FUNGAL_OVERWRITE_CENTER_MIN,
  `fungal overwrite center ${fungalOvrCenterMin.toFixed(4)} want > ${FUNGAL_OVERWRITE_CENTER_MIN}`,
);
assert(ashInfCenterMax < ASH_CENTER_MAX, `ash infiltrate center ${ashInfCenterMax.toFixed(4)} want < ${ASH_CENTER_MAX}`);
assert(ashOvrCenterMax < ASH_CENTER_MAX, `ash overwrite center ${ashOvrCenterMax.toFixed(4)} want < ${ASH_CENTER_MAX}`);

const oilBbox: number[] = [];
const fungalBbox: number[] = [];
for (let i = 0; i < SEEDS; i++) {
  const oil = baked.oil_film!.infiltrate[i]!;
  const fungal = baked.fungal_mat!.infiltrate[i]!;
  oilBbox.push(bboxFill(occupancyMaskOf(oil.buf), oil.canvasW, oil.canvasH));
  fungalBbox.push(bboxFill(occupancyMaskOf(fungal.buf), fungal.canvasW, fungal.canvasH));
}
const oilBboxMax = Math.max(...oilBbox);
const fungalBboxMin = Math.min(...fungalBbox);
const oilVsFungal = oilBboxMax / Math.max(0.001, fungalBboxMin);
console.log(
  `oil infiltrate bbox-fill max ${oilBboxMax.toFixed(4)} / fungal min ${fungalBboxMin.toFixed(4)} = ${oilVsFungal.toFixed(4)}  want < ${OIL_BBOX_VS_FUNGAL}`,
);
assert(oilBboxMax < fungalBboxMin, `oil bbox-fill ${oilBboxMax.toFixed(4)} want < fungal ${fungalBboxMin.toFixed(4)}`);
assert(
  oilVsFungal < OIL_BBOX_VS_FUNGAL,
  `oil/fungal bbox-fill ${oilVsFungal.toFixed(4)} want < ${OIL_BBOX_VS_FUNGAL}`,
);

const productionCrossDists: number[] = [];
for (const veinVariant of PRODUCTION_VEIN_VARIANTS) {
  for (const coverage of COVERAGES) {
    const vsFungal: number[] = [];
    const vsAsh: number[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const oil = bakeOne('oil_film', coverage, seedList[i]!, { veinVariant });
      const fungal = baked.fungal_mat![coverage][i]!;
      const ash = baked.ash_veil![coverage][i]!;
      assert(fungal.topology === 'lobe_mass', `fungal_mat topology ${fungal.topology} want lobe_mass`);
      assert(ash.topology === 'holed_veil', `ash_veil topology ${ash.topology} want holed_veil`);
      const oilMask = occupancyMaskOf(oil.buf);
      const df = coarseDist(oilMask, occupancyMaskOf(fungal.buf), oil.canvasW, oil.canvasH);
      const da = coarseDist(oilMask, occupancyMaskOf(ash.buf), oil.canvasW, oil.canvasH);
      vsFungal.push(df);
      vsAsh.push(da);
      productionCrossDists.push(df, da);
    }
    const fungalMin = Math.min(...vsFungal);
    const ashMin = Math.min(...vsAsh);
    const label = `oil v${veinVariant} ${PRODUCTION_VEIN_LABEL[veinVariant]} ${coverage}`;
    console.log(`${label} vs fungal_mat coarse min ${fungalMin.toFixed(4)}  floor ${PRODUCTION_CROSS_FLOOR}`);
    console.log(`${label} vs ash_veil coarse min ${ashMin.toFixed(4)}  floor ${PRODUCTION_CROSS_FLOOR}`);
    assert(
      fungalMin > PRODUCTION_CROSS_FLOOR,
      `${label} vs fungal_mat min ${fungalMin.toFixed(4)} want > ${PRODUCTION_CROSS_FLOOR}`,
    );
    assert(
      ashMin > PRODUCTION_CROSS_FLOOR,
      `${label} vs ash_veil min ${ashMin.toFixed(4)} want > ${PRODUCTION_CROSS_FLOOR}`,
    );
  }
}
const productionCrossMin = Math.min(...productionCrossDists);
console.log(
  `oil production variants vs fungal/ash coarse min ${productionCrossMin.toFixed(4)}  floor ${PRODUCTION_CROSS_FLOOR}`,
);
assert(
  productionCrossMin > PRODUCTION_CROSS_FLOOR,
  `oil production vs fungal/ash min ${productionCrossMin.toFixed(4)} want > ${PRODUCTION_CROSS_FLOOR}`,
);

const senseDists: number[] = [];
const rhythmDists: number[] = [];
for (const substrate of SUBSTRATES) {
  for (const coverage of COVERAGES) {
    for (const seed of seedList) {
      const a = bakeOne(substrate, coverage, seed, { sense: 'sense_touch', rhythm: 'rhythm_open' });
      const b = bakeOne(substrate, coverage, seed, { sense: 'sense_scent', rhythm: 'rhythm_open' });
      const c = bakeOne(substrate, coverage, seed, { sense: 'sense_touch', rhythm: 'rhythm_pulse' });
      const da = coarseDist(occupancyMaskOf(a.buf), occupancyMaskOf(b.buf), a.canvasW, a.canvasH);
      const db = coarseDist(occupancyMaskOf(a.buf), occupancyMaskOf(c.buf), a.canvasW, a.canvasH);
      senseDists.push(da);
      rhythmDists.push(db);
    }
  }
}
const senseMin = Math.min(...senseDists);
const rhythmMin = Math.min(...rhythmDists);
console.log(`sense coarse min ${senseMin.toFixed(4)}  floor ${AXIS_DIST_FLOOR}`);
console.log(`rhythm coarse min ${rhythmMin.toFixed(4)}  floor ${AXIS_DIST_FLOOR}`);
assert(senseMin > AXIS_DIST_FLOOR, `sense min ${senseMin.toFixed(4)} want > ${AXIS_DIST_FLOOR}`);
assert(rhythmMin > AXIS_DIST_FLOOR, `rhythm min ${rhythmMin.toFixed(4)} want > ${AXIS_DIST_FLOOR}`);

const continuityDists: number[] = [];
for (const substrate of SUBSTRATES) {
  for (const coverage of COVERAGES) {
    for (const seed of seedList) {
      const mono = bakeOne(substrate, coverage, seed, { continuity: 'monolith' });
      const colony = bakeOne(substrate, coverage, seed, { continuity: 'colony' });
      assert(mono.canvasW === 88 && colony.canvasW === 88, 'monolith and colony stay 88');
      continuityDists.push(
        coarseDist(occupancyMaskOf(mono.buf), occupancyMaskOf(colony.buf), mono.canvasW, mono.canvasH),
      );
    }
  }
}
const continuityMin = Math.min(...continuityDists);
console.log(`monolith vs colony coarse min ${continuityMin.toFixed(4)}  floor ${CONTINUITY_FLOOR}`);
assert(
  continuityMin > CONTINUITY_FLOOR,
  `monolith vs colony min ${continuityMin.toFixed(4)} want > ${CONTINUITY_FLOOR}`,
);

for (const substrate of SUBSTRATES) {
  for (const coverage of COVERAGES) {
    const rows = baked[substrate]![coverage];
    let allSame = true;
    for (let i = 1; i < rows.length; i++) {
      if (!buffersEqual(rows[0]!.buf.data, rows[i]!.buf.data)) {
        allSame = false;
        break;
      }
    }
    assert(!allSame, `${substrate} ${coverage} all ${SEEDS} seeds pixel-identical`);
  }
}

function discreteScale(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(src.length);
  const ox = w * 0.5;
  const oy = h * 0.5;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if ((src[i + 3] ?? 0) === 0) continue;
      const nx = Math.round(ox + (x - ox) * sx);
      const ny = Math.round(oy + (y - oy) * sy);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = (ny * w + nx) * 4;
      dst[j] = src[i]!;
      dst[j + 1] = src[i + 1]!;
      dst[j + 2] = src[i + 2]!;
      dst[j + 3] = src[i + 3]!;
    }
  }
  return dst;
}

function countOpaqueDiff(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n += 1;
  }
  return n;
}

function countRgb(buf: Uint8ClampedArray, rgb: readonly [number, number, number]): number {
  let n = 0;
  for (let i = 0; i < buf.length; i += 4) {
    if ((buf[i + 3] ?? 0) === 0) continue;
    if (buf[i] === rgb[0] && buf[i + 1] === rgb[1] && buf[i + 2] === rgb[2]) n += 1;
  }
  return n;
}

/**
 * Live layer: two elapsedMs must differ in pixels, and must not equal the old 4-frame
 * nearest-neighbour scales. Measures rest vs quarter-cycle peak (adjacent 16ms frames
 * can quantize identical).
 */
const LIVE_SX = [1, 1.08, 1, 0.94] as const;
const LIVE_SY = [1, 0.94, 1, 1.08] as const;
const peakMs = Math.PI / (2 * PAINT_BREATH);
for (const substrate of SUBSTRATES) {
  const row = bakeOne(substrate, 'infiltrate', 1000);
  const n = row.canvasW * row.canvasH;
  const scratch = new Float32Array(n);
  const restPx = new Uint8ClampedArray(n * 4);
  const peakPx = new Uint8ClampedArray(n * 4);
  const inflatedPx = new Uint8ClampedArray(n * 4);
  paintPaintGenomeLive({
    rest: row.field,
    scratch,
    out: restPx,
    w: row.canvasW,
    h: row.canvasH,
    elapsedMs: 0,
    inflated: false,
    ramp: row.ramp,
    growth: row.growth,
  });
  paintPaintGenomeLive({
    rest: row.field,
    scratch,
    out: peakPx,
    w: row.canvasW,
    h: row.canvasH,
    elapsedMs: peakMs,
    inflated: false,
    ramp: row.ramp,
    growth: row.growth,
  });
  paintPaintGenomeLive({
    rest: row.field,
    scratch,
    out: inflatedPx,
    w: row.canvasW,
    h: row.canvasH,
    elapsedMs: peakMs,
    inflated: true,
    ramp: row.ramp,
    growth: row.growth,
  });
  assert(buffersEqual(restPx, row.buf.data), `${substrate} live t=0 must match bake rest`);
  const diff = countOpaqueDiff(restPx, peakPx);
  console.log(`${substrate} live rest→peak pixel diff ${diff}`);
  assert(diff > 0, `${substrate} live rest vs peak must differ (not a still)`);
  for (let frame = 0; frame < LIVE_SX.length; frame++) {
    const cut = discreteScale(row.buf.data, row.canvasW, row.canvasH, LIVE_SX[frame]!, LIVE_SY[frame]!);
    assert(
      !buffersEqual(peakPx, cut),
      `${substrate} live peak must not equal prebaked scale frame ${frame}`,
    );
  }
  const restCore = countRgb(restPx, row.ramp.core);
  const infCore = countRgb(inflatedPx, row.ramp.core);
  assert(
    infCore === restCore,
    `${substrate} inflated must not grow core pixels (${infCore} vs rest ${restCore})`,
  );
}

const OIL_LIVE_VARIANTS = PRODUCTION_VEIN_VARIANTS;
for (const veinVariant of OIL_LIVE_VARIANTS) {
  const row = bakeOne('oil_film', 'infiltrate', 1000, { continuity: 'monolith', veinVariant });
  const n = row.canvasW * row.canvasH;
  const scratch = new Float32Array(n);
  const restPx = new Uint8ClampedArray(n * 4);
  const peakPx = new Uint8ClampedArray(n * 4);
  paintPaintGenomeLive({
    rest: row.field,
    scratch,
    out: restPx,
    w: row.canvasW,
    h: row.canvasH,
    elapsedMs: 0,
    inflated: false,
    ramp: row.ramp,
    growth: row.growth,
  });
  paintPaintGenomeLive({
    rest: row.field,
    scratch,
    out: peakPx,
    w: row.canvasW,
    h: row.canvasH,
    elapsedMs: peakMs,
    inflated: false,
    ramp: row.ramp,
    growth: row.growth,
  });
  assert(buffersEqual(restPx, row.buf.data), `oil v${veinVariant} live t=0 must match bake rest`);
  const diff = countOpaqueDiff(restPx, peakPx);
  console.log(`oil v${veinVariant} live rest→peak pixel diff ${diff}`);
  assert(diff > 0, `oil v${veinVariant} live rest vs peak must differ (not a still)`);
  for (let frame = 0; frame < LIVE_SX.length; frame++) {
    const cut = discreteScale(row.buf.data, row.canvasW, row.canvasH, LIVE_SX[frame]!, LIVE_SY[frame]!);
    assert(
      !buffersEqual(peakPx, cut),
      `oil v${veinVariant} live peak must not equal prebaked scale frame ${frame}`,
    );
  }
}

const FIELD_TH = 0.1;

function primaryUnit(growth: Baked['growth']): number {
  let best = 0;
  for (let i = 1; i < growth.unitCount; i++) {
    if (growth.span[i]! > growth.span[best]!) best = i;
  }
  return best;
}

function fieldStats(
  field: Float32Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  cs: number,
  sn: number,
  unitIndex: Uint8Array,
  unit: number,
): { maxAlong: number; maxAbsPerp: number; maxR: number; minR: number } {
  let maxAlong = -Infinity;
  let maxAbsPerp = 0;
  let maxR = 0;
  let minR = Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (unitIndex[i] !== unit || field[i]! < FIELD_TH) continue;
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const along = dx * cs + dy * sn;
      const perp = -dx * sn + dy * cs;
      const r = Math.hypot(dx, dy);
      if (along > maxAlong) maxAlong = along;
      const ap = Math.abs(perp);
      if (ap > maxAbsPerp) maxAbsPerp = ap;
      if (r > maxR) maxR = r;
      if (r < minR) minR = r;
    }
  }
  return { maxAlong, maxAbsPerp, maxR, minR };
}

function sectorMeanR(
  field: Float32Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  lobes: number,
  phi: number,
  tip: boolean,
  unitIndex: Uint8Array,
  unit: number,
): number {
  let wSum = 0;
  let s = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (unitIndex[i] !== unit) continue;
      const v = field[i]!;
      if (v < 0.05) continue;
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      const phase = Math.cos(lobes * Math.atan2(dy, dx) + phi);
      if (tip && phase < 0.45) continue;
      if (!tip && phase > -0.45) continue;
      s += v * Math.hypot(dx, dy);
      wSum += v;
    }
  }
  return wSum <= 0 ? 0 : s / wSum;
}

function centerOccFrac(
  field: Float32Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  radius: number,
): number {
  const r2 = radius * radius;
  let n = 0;
  let occ = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x + 0.5 - ox;
      const dy = y + 0.5 - oy;
      if (dx * dx + dy * dy > r2) continue;
      n += 1;
      if (field[y * w + x]! >= FIELD_TH) occ += 1;
    }
  }
  return n === 0 ? 0 : occ / n;
}

function liveField(row: Baked, elapsedMs: number): Float32Array {
  const n = row.canvasW * row.canvasH;
  const scratch = new Float32Array(n);
  const out = new Uint8ClampedArray(n * 4);
  paintPaintGenomeLive({
    rest: row.field,
    scratch,
    out,
    w: row.canvasW,
    h: row.canvasH,
    elapsedMs,
    inflated: false,
    ramp: row.ramp,
    growth: row.growth,
  });
  return scratch;
}

function peakField(row: Baked): Float32Array {
  return liveField(row, peakMs);
}

function troughField(row: Baked): Float32Array {
  return liveField(row, (3 * Math.PI) / (2 * PAINT_BREATH));
}

function weightedMean(
  field: Float32Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  metric: (dx: number, dy: number) => number,
  unitIndex: Uint8Array,
  unit: number,
): number {
  let wSum = 0;
  let s = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (unitIndex[i] !== unit) continue;
      const v = field[i]!;
      if (v < FIELD_TH) continue;
      s += v * metric(x + 0.5 - ox, y + 0.5 - oy);
      wSum += v;
    }
  }
  return wSum <= 0 ? 0 : s / wSum;
}

function unitMaxR(
  field: Float32Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  unitIndex: Uint8Array,
  unit: number,
): number {
  let m = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (unitIndex[i] !== unit || field[i]! < FIELD_TH) continue;
      const r = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      if (r > m) m = r;
    }
  }
  return m;
}

function hasEmpty4(field: Float32Array, w: number, h: number, x: number, y: number): boolean {
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return true;
  const i = y * w + x;
  return field[i - 1]! < 0.1 || field[i + 1]! < 0.1 || field[i - w]! < 0.1 || field[i + w]! < 0.1;
}

function rimMean(field: Float32Array, w: number, h: number): number {
  let s = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (field[i]! < 0.1) continue;
      if (!hasEmpty4(field, w, h, x, y)) continue;
      s += field[i]!;
      n += 1;
    }
  }
  return n === 0 ? 0 : s / n;
}

function interiorGlowCount(field: Float32Array, w: number, h: number): number {
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (field[i]! < 0.95) continue;
      if (hasEmpty4(field, w, h, x, y)) continue;
      n += 1;
    }
  }
  return n;
}

const oilTipOverSide: number[] = [];
const oilTipDelta: number[] = [];
const oilSideDelta: number[] = [];
const oilScentTipDelta: number[] = [];
const ashOuterOverCenter: number[] = [];
const ashOuterDelta: number[] = [];
const ashInnerDelta: number[] = [];
const fungalTipOverValley: number[] = [];
const fungalTipDelta: number[] = [];

for (const seed of seedList) {
  const oil = bakeOne('oil_film', 'infiltrate', seed, { continuity: 'monolith' });
  const u = primaryUnit(oil.growth);
  const ox = oil.growth.ox[u]!;
  const oy = oil.growth.oy[u]!;
  const cs = Math.cos(oil.growth.senseAngle);
  const sn = Math.sin(oil.growth.senseAngle);
  const alongOf = (dx: number, dy: number) => dx * cs + dy * sn;
  const perpOf = (dx: number, dy: number) => Math.abs(-dx * sn + dy * cs);
  const oilPeakF = peakField(oil);
  const oilTroughF = troughField(oil);
  const peakS = fieldStats(oilPeakF, oil.canvasW, oil.canvasH, ox, oy, cs, sn, oil.growth.unitIndex, u);
  const troughS = fieldStats(oilTroughF, oil.canvasW, oil.canvasH, ox, oy, cs, sn, oil.growth.unitIndex, u);
  const meanAlongD =
    weightedMean(oilPeakF, oil.canvasW, oil.canvasH, ox, oy, alongOf, oil.growth.unitIndex, u) -
    weightedMean(oilTroughF, oil.canvasW, oil.canvasH, ox, oy, alongOf, oil.growth.unitIndex, u);
  const tipD = Math.max(meanAlongD, peakS.maxAlong - troughS.maxAlong);
  const sideD = Math.abs(
    weightedMean(oilPeakF, oil.canvasW, oil.canvasH, ox, oy, perpOf, oil.growth.unitIndex, u) -
      weightedMean(oilTroughF, oil.canvasW, oil.canvasH, ox, oy, perpOf, oil.growth.unitIndex, u),
  );
  oilTipDelta.push(tipD);
  oilSideDelta.push(sideD);
  oilTipOverSide.push(tipD - sideD);

  const oilScent = bakeOne('oil_film', 'infiltrate', seed, { continuity: 'monolith', sense: 'sense_scent' });
  const us = primaryUnit(oilScent.growth);
  const oxs = oilScent.growth.ox[us]!;
  const oys = oilScent.growth.oy[us]!;
  const css = Math.cos(oilScent.growth.senseAngle);
  const sns = Math.sin(oilScent.growth.senseAngle);
  const scentAlong = (dx: number, dy: number) => dx * css + dy * sns;
  const scentPeakF = peakField(oilScent);
  const scentTroughF = troughField(oilScent);
  const scentPeakS = fieldStats(
    scentPeakF,
    oilScent.canvasW,
    oilScent.canvasH,
    oxs,
    oys,
    css,
    sns,
    oilScent.growth.unitIndex,
    us,
  );
  const scentTroughS = fieldStats(
    scentTroughF,
    oilScent.canvasW,
    oilScent.canvasH,
    oxs,
    oys,
    css,
    sns,
    oilScent.growth.unitIndex,
    us,
  );
  const scentMeanD =
    weightedMean(scentPeakF, oilScent.canvasW, oilScent.canvasH, oxs, oys, scentAlong, oilScent.growth.unitIndex, us) -
    weightedMean(scentTroughF, oilScent.canvasW, oilScent.canvasH, oxs, oys, scentAlong, oilScent.growth.unitIndex, us);
  oilScentTipDelta.push(Math.max(scentMeanD, scentPeakS.maxAlong - scentTroughS.maxAlong));

  const ash = bakeOne('ash_veil', 'infiltrate', seed, { continuity: 'monolith' });
  const ua = primaryUnit(ash.growth);
  const ax = ash.growth.ox[ua]!;
  const ay = ash.growth.oy[ua]!;
  const ashRest = fieldStats(ash.field, ash.canvasW, ash.canvasH, ax, ay, 1, 0, ash.growth.unitIndex, ua);
  const ashPeakF = peakField(ash);
  const ashPeak = fieldStats(ashPeakF, ash.canvasW, ash.canvasH, ax, ay, 1, 0, ash.growth.unitIndex, ua);
  const outerD = ashPeak.maxR - ashRest.maxR;
  const innerD = ashRest.minR - ashPeak.minR;
  const holeR = Math.max(4, ashRest.minR * 0.45);
  const centerD =
    Math.abs(
      centerOccFrac(ashPeakF, ash.canvasW, ash.canvasH, ax, ay, holeR) -
        centerOccFrac(ash.field, ash.canvasW, ash.canvasH, ax, ay, holeR),
    ) * holeR;
  ashOuterDelta.push(outerD);
  ashInnerDelta.push(innerD);
  ashOuterOverCenter.push(outerD - centerD);

  const fungal = bakeOne('fungal_mat', 'infiltrate', seed, { continuity: 'monolith' });
  const uf = primaryUnit(fungal.growth);
  const fx = fungal.growth.ox[uf]!;
  const fy = fungal.growth.oy[uf]!;
  const k = fungal.growth.lobeCount;
  const phi = fungal.growth.senseAngle;
  const idx = fungal.growth.unitIndex;
  const tipRest = sectorMeanR(fungal.field, fungal.canvasW, fungal.canvasH, fx, fy, k, phi, true, idx, uf);
  const valleyRest = sectorMeanR(fungal.field, fungal.canvasW, fungal.canvasH, fx, fy, k, phi, false, idx, uf);
  const fungalPeak = peakField(fungal);
  const tipPeakR = sectorMeanR(fungalPeak, fungal.canvasW, fungal.canvasH, fx, fy, k, phi, true, idx, uf);
  const valleyPeakR = sectorMeanR(fungalPeak, fungal.canvasW, fungal.canvasH, fx, fy, k, phi, false, idx, uf);
  fungalTipDelta.push(tipPeakR - tipRest);
  fungalTipOverValley.push(tipPeakR - tipRest - (valleyPeakR - valleyRest));
}

const oilTipMin = Math.min(...oilTipDelta);
const oilSideMax = Math.max(...oilSideDelta);
const oilTipOverSideMin = Math.min(...oilTipOverSide);
const oilScentTipMin = Math.min(...oilScentTipDelta);
const ashOuterMin = Math.min(...ashOuterDelta);
const ashInnerMin = Math.min(...ashInnerDelta);
const ashOuterOverCenterMin = Math.min(...ashOuterOverCenter);
const fungalTipMin = Math.min(...fungalTipDelta);
const fungalTipOverValleyMin = Math.min(...fungalTipOverValley);

console.log(
  `oil tip peak-trough min ${oilTipMin.toFixed(4)}  side |Δ| max ${oilSideMax.toFixed(4)}  tip-side min ${oilTipOverSideMin.toFixed(4)}`,
);
console.log(`oil sense_scent tip peak-trough min ${oilScentTipMin.toFixed(4)}`);
console.log(
  `ash outerΔ min ${ashOuterMin.toFixed(4)}  inner-in Δ min ${ashInnerMin.toFixed(4)}  outer-center min ${ashOuterOverCenterMin.toFixed(4)}`,
);
console.log(`fungal tipΔ min ${fungalTipMin.toFixed(4)}  tip-valley min ${fungalTipOverValleyMin.toFixed(4)}`);

assert(oilTipMin > 1.2, `oil tip along-axis peak-trough ${oilTipMin.toFixed(4)} want > 1.2`);
assert(oilTipOverSideMin > 1.0, `oil tip Δ - side Δ ${oilTipOverSideMin.toFixed(4)} want > 1.0`);
assert(oilScentTipMin > 1.2, `oil scent-axis peak-trough ${oilScentTipMin.toFixed(4)} want > 1.2 (not canvas-X stretch)`);
assert(ashOuterMin > 2.5, `ash outer Δ ${ashOuterMin.toFixed(4)} want > 2.5`);
assert(ashInnerMin > 2.0, `ash inner-edge-in Δ ${ashInnerMin.toFixed(4)} want > 2.0`);
assert(ashOuterOverCenterMin > 2.5, `ash outer Δ - center Δ ${ashOuterOverCenterMin.toFixed(4)} want > 2.5`);
assert(fungalTipMin > 1.0, `fungal tip Δ ${fungalTipMin.toFixed(4)} want > 1.0`);
assert(fungalTipOverValleyMin > 1.4, `fungal tip Δ - valley Δ ${fungalTipOverValleyMin.toFixed(4)} want > 1.4`);

const beadUnits: number[] = [];
const beadRadial: number[] = [];
const beadPhaseSep: number[] = [];
const smearTipDelta: number[] = [];
const smearSideDelta: number[] = [];
const smearTipOverSide: number[] = [];
const smearScentTipDelta: number[] = [];
const poolRadial: number[] = [];
const poolRimDelta: number[] = [];
const poolInteriorGlowDelta: number[] = [];

for (const seed of seedList) {
  const beads = bakeOne('oil_film', 'infiltrate', seed, { continuity: 'monolith', veinVariant: 3 });
  beadUnits.push(beads.growth.unitCount);
  const peakB = peakField(beads);
  const troughB = troughField(beads);
  const d0 =
    unitMaxR(peakB, beads.canvasW, beads.canvasH, beads.growth.ox[0]!, beads.growth.oy[0]!, beads.growth.unitIndex, 0) -
    unitMaxR(troughB, beads.canvasW, beads.canvasH, beads.growth.ox[0]!, beads.growth.oy[0]!, beads.growth.unitIndex, 0);
  beadRadial.push(d0);
  assert(beads.growth.unitCount >= 2, `oil beads seed ${seed} units ${beads.growth.unitCount} want >= 2`);
  const d1 =
    unitMaxR(peakB, beads.canvasW, beads.canvasH, beads.growth.ox[1]!, beads.growth.oy[1]!, beads.growth.unitIndex, 1) -
    unitMaxR(troughB, beads.canvasW, beads.canvasH, beads.growth.ox[1]!, beads.growth.oy[1]!, beads.growth.unitIndex, 1);
  beadPhaseSep.push(Math.abs(d0 - d1));

  const smear = bakeOne('oil_film', 'infiltrate', seed, { continuity: 'monolith', veinVariant: 4 });
  const su = primaryUnit(smear.growth);
  const sox = smear.growth.ox[su]!;
  const soy = smear.growth.oy[su]!;
  const scs = Math.cos(smear.growth.senseAngle);
  const ssn = Math.sin(smear.growth.senseAngle);
  const smearAlong = (dx: number, dy: number) => dx * scs + dy * ssn;
  const smearPerp = (dx: number, dy: number) => Math.abs(-dx * ssn + dy * scs);
  const smearPeakF = peakField(smear);
  const smearTroughF = troughField(smear);
  const smearPeakS = fieldStats(smearPeakF, smear.canvasW, smear.canvasH, sox, soy, scs, ssn, smear.growth.unitIndex, su);
  const smearTroughS = fieldStats(
    smearTroughF,
    smear.canvasW,
    smear.canvasH,
    sox,
    soy,
    scs,
    ssn,
    smear.growth.unitIndex,
    su,
  );
  const smearMeanD =
    weightedMean(smearPeakF, smear.canvasW, smear.canvasH, sox, soy, smearAlong, smear.growth.unitIndex, su) -
    weightedMean(smearTroughF, smear.canvasW, smear.canvasH, sox, soy, smearAlong, smear.growth.unitIndex, su);
  const smearTip = Math.max(smearMeanD, smearPeakS.maxAlong - smearTroughS.maxAlong);
  const smearSide = Math.abs(
    weightedMean(smearPeakF, smear.canvasW, smear.canvasH, sox, soy, smearPerp, smear.growth.unitIndex, su) -
      weightedMean(smearTroughF, smear.canvasW, smear.canvasH, sox, soy, smearPerp, smear.growth.unitIndex, su),
  );
  smearTipDelta.push(smearTip);
  smearSideDelta.push(smearSide);
  smearTipOverSide.push(smearTip - smearSide);

  const smearScent = bakeOne('oil_film', 'infiltrate', seed, {
    continuity: 'monolith',
    sense: 'sense_scent',
    veinVariant: 4,
  });
  const ssu = primaryUnit(smearScent.growth);
  const ssox = smearScent.growth.ox[ssu]!;
  const ssoy = smearScent.growth.oy[ssu]!;
  const sscs = Math.cos(smearScent.growth.senseAngle);
  const sssn = Math.sin(smearScent.growth.senseAngle);
  const scentAlongOf = (dx: number, dy: number) => dx * sscs + dy * sssn;
  const scentPeakF = peakField(smearScent);
  const scentTroughF = troughField(smearScent);
  const scentPeakS = fieldStats(
    scentPeakF,
    smearScent.canvasW,
    smearScent.canvasH,
    ssox,
    ssoy,
    sscs,
    sssn,
    smearScent.growth.unitIndex,
    ssu,
  );
  const scentTroughS = fieldStats(
    scentTroughF,
    smearScent.canvasW,
    smearScent.canvasH,
    ssox,
    ssoy,
    sscs,
    sssn,
    smearScent.growth.unitIndex,
    ssu,
  );
  const scentMeanD =
    weightedMean(scentPeakF, smearScent.canvasW, smearScent.canvasH, ssox, ssoy, scentAlongOf, smearScent.growth.unitIndex, ssu) -
    weightedMean(
      scentTroughF,
      smearScent.canvasW,
      smearScent.canvasH,
      ssox,
      ssoy,
      scentAlongOf,
      smearScent.growth.unitIndex,
      ssu,
    );
  smearScentTipDelta.push(Math.max(scentMeanD, scentPeakS.maxAlong - scentTroughS.maxAlong));

  const pool = bakeOne('oil_film', 'infiltrate', seed, { continuity: 'monolith', veinVariant: 5 });
  const pu = primaryUnit(pool.growth);
  const pox = pool.growth.ox[pu]!;
  const poy = pool.growth.oy[pu]!;
  const poolPeakF = peakField(pool);
  const poolTroughF = troughField(pool);
  poolRadial.push(
    unitMaxR(poolPeakF, pool.canvasW, pool.canvasH, pox, poy, pool.growth.unitIndex, pu) -
      unitMaxR(poolTroughF, pool.canvasW, pool.canvasH, pox, poy, pool.growth.unitIndex, pu),
  );
  poolRimDelta.push(rimMean(poolPeakF, pool.canvasW, pool.canvasH) - rimMean(poolTroughF, pool.canvasW, pool.canvasH));
  poolInteriorGlowDelta.push(
    interiorGlowCount(poolPeakF, pool.canvasW, pool.canvasH) -
      interiorGlowCount(pool.field, pool.canvasW, pool.canvasH),
  );
}

const beadUnitMin = Math.min(...beadUnits);
const beadRadialMin = Math.min(...beadRadial);
const beadPhaseMin = Math.min(...beadPhaseSep);
const smearTipMin = Math.min(...smearTipDelta);
const smearSideMax = Math.max(...smearSideDelta);
const smearTipOverSideMin = Math.min(...smearTipOverSide);
const smearScentTipMin = Math.min(...smearScentTipDelta);
const poolRadialMin = Math.min(...poolRadial);
const poolRimMin = Math.min(...poolRimDelta);
const poolInteriorGlowMax = Math.max(...poolInteriorGlowDelta);

console.log(`oil beads units min ${beadUnitMin}  radial peak-trough min ${beadRadialMin.toFixed(4)}  |Δ0-Δ1| min ${beadPhaseMin.toFixed(4)}`);
console.log(
  `oil smear tip peak-trough min ${smearTipMin.toFixed(4)}  side |Δ| max ${smearSideMax.toFixed(4)}  tip-side min ${smearTipOverSideMin.toFixed(4)}`,
);
console.log(`oil smear sense_scent tip peak-trough min ${smearScentTipMin.toFixed(4)}`);
console.log(
  `oil rim-pool radial min ${poolRadialMin.toFixed(4)}  rim Δ min ${poolRimMin.toFixed(4)}  interior glow Δ max ${poolInteriorGlowMax}`,
);

assert(beadUnitMin > 3, `oil beads unitCount ${beadUnitMin} want > 3 (not one blob)`);
assert(beadRadialMin > 1.8, `oil beads radial peak-trough ${beadRadialMin.toFixed(4)} want > 1.8`);
assert(beadPhaseMin > 1.0, `oil beads |Δ0-Δ1| ${beadPhaseMin.toFixed(4)} want > 1.0 (phase offset, not uniform scale)`);
assert(smearTipMin > 4.5, `oil smear along-axis peak-trough ${smearTipMin.toFixed(4)} want > 4.5`);
assert(smearTipOverSideMin > 4.0, `oil smear tip Δ - side Δ ${smearTipOverSideMin.toFixed(4)} want > 4.0`);
assert(smearScentTipMin > 7.0, `oil smear scent-axis peak-trough ${smearScentTipMin.toFixed(4)} want > 7.0`);
assert(poolRadialMin > 3.2, `oil rim-pool radial peak-trough ${poolRadialMin.toFixed(4)} want > 3.2`);
assert(poolRimMin > 0.07, `oil rim-pool rim field Δ ${poolRimMin.toFixed(4)} want > 0.07`);
assert(poolInteriorGlowMax <= 2, `oil rim-pool interior glow Δ ${poolInteriorGlowMax} want <= 2 (edge only)`);

const VEIN_VARIANTS: readonly PaintVeinVariant[] = [0, 1, 2, 3, 4, 5];
const VEIN_PAIRS: [PaintVeinVariant, PaintVeinVariant][] = [];
for (let a = 0; a < VEIN_VARIANTS.length; a++) {
  for (let b = a + 1; b < VEIN_VARIANTS.length; b++) {
    VEIN_PAIRS.push([VEIN_VARIANTS[a]!, VEIN_VARIANTS[b]!]);
  }
}
const veinPairDists: number[] = [];
const veinPairMins: Record<string, number> = {};
for (const [leftId, rightId] of VEIN_PAIRS) veinPairMins[`${leftId}-${rightId}`] = Infinity;
for (const coverage of COVERAGES) {
  for (const seed of seedList) {
    const rows = VEIN_VARIANTS.map((veinVariant) =>
      bakePaintGenome({
        substrate: 'oil_film',
        coverage,
        seed,
        continuity: 'colony',
        sense: 'sense_touch',
        rhythm: 'rhythm_open',
        fragmentTypeId: 'frag-clinic',
        veinVariant,
      }),
    );
    for (const row of rows) {
      assert(row.topology === 'vein_tree', `oil vein variant topology ${row.topology}`);
      const opaque = occupancyMaskOf(row.buf).reduce((n, v) => n + v, 0);
      assert(opaque > 20, `oil vein variant opaque ${opaque} want > 20`);
    }
    for (const [leftId, rightId] of VEIN_PAIRS) {
      const left = rows[leftId]!;
      const right = rows[rightId]!;
      const d = coarseDist(occupancyMaskOf(left.buf), occupancyMaskOf(right.buf), left.canvasW, left.canvasH);
      veinPairDists.push(d);
      const key = `${leftId}-${rightId}`;
      veinPairMins[key] = Math.min(veinPairMins[key]!, d);
    }
  }
}
const veinPairMin = Math.min(...veinPairDists);
const veinPairSummary = VEIN_PAIRS.map(
  ([leftId, rightId]) => `${leftId}-${rightId} ${veinPairMins[`${leftId}-${rightId}`]!.toFixed(4)}`,
).join('  ');
console.log(
  `oil vein variant pairwise coarse min ${veinPairMin.toFixed(4)}  ${veinPairSummary}  floor ${VEIN_VARIANT_PAIR_FLOOR}`,
);
assert(
  veinPairMin > VEIN_VARIANT_PAIR_FLOOR,
  `oil vein variant pairwise min ${veinPairMin.toFixed(4)} want > ${VEIN_VARIANT_PAIR_FLOOR}`,
);

{
  const TILE = 32;
  const originX = 80;
  const originY = 80;
  const originCol = Math.floor(originX / TILE);
  const originRow = Math.floor(originY / TILE);
  let fieldTiles = 0;
  let beyondCore = 0;
  for (const seed of seedList) {
    for (const veinVariant of PRODUCTION_VEIN_VARIANTS) {
      const baked = bakePaintGenome({
        substrate: 'oil_film',
        coverage: 'rewrite',
        seed,
        continuity: 'field',
        sense: 'sense_touch',
        rhythm: 'rhythm_open',
        fragmentTypeId: 'frag-clinic',
        veinVariant,
      });
      const floors = collectPaintGenomeFloorTiles(
        baked.field,
        baked.canvasW,
        baked.canvasH,
        originX,
        originY,
        TILE,
      );
      fieldTiles += floors.length;
      for (const floor of floors) {
        const chebyshev = Math.max(Math.abs(floor.col - originCol), Math.abs(floor.row - originRow));
        if (chebyshev > 1) beyondCore += 1;
      }
    }
  }
  assert(fieldTiles > 0, `field oil film step floors ${fieldTiles} want > 0`);
  assert(beyondCore > 0, `field oil film tiles beyond pin Chebyshev 1: ${beyondCore} want > 0`);
}

if (failed > 0) {
  console.error(`check:paint-genome-topology FAILED (${failed})`);
  process.exit(1);
}
console.log('check:paint-genome-topology OK');
