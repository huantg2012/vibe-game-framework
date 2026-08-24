/**
 * 一次性探针：把 I6-A 定稿的身份配方写进内存，烤真实地面，算 art 定义的身份指纹，
 * 核实四张启用碎片互不相同，并检查地物段数改小是否会让残墟生成失败。
 * 只在内存改，不动 data/ 与 src/。
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { generateRuins } from '@/generation/ruins';
import { paintRuinedMask } from '@/generation/preview-paint';

const T = 16;
const SEEDS = [101, 404, 707, 1234, 5678];

interface Patch {
  readonly id: string;
  readonly label: string;
  readonly set?: Record<string, number | string | boolean>;
}

const PATCHES: readonly Patch[] = [
  { id: 'frag-outdoor', label: '户外土壤（现表）' },
  { id: 'frag-clinic', label: '医院实验室（现表）' },
  { id: 'frag-metro', label: '地铁工业（现表）' },
  {
    id: 'frag-library',
    label: '旧图书馆（I6-A 定稿）',
    set: {
      enabled: true,
      stainThreshold: 0.6,
      stainStrength: 0.3,
      grimeAmp: 0.34,
      macroAmp: 0.2,
      scratchPer1000px2: 0.8,
      fleckPer1000px2: 0.7,
      featureWidthTiles: 1,
      featureLengthTiles: 6,
      featureCountMin: 8,
      featureCountMax: 11,
      wallBv: 24,
      wallBiasR: 1.02,
      wallBiasG: 0.93,
      wallBiasB: 0.68,
    },
  },
];

for (const p of PATCHES) {
  if (!p.set) continue;
  const row = RIFT_FRAGMENT_DATA[p.id] as unknown as Record<string, number | string | boolean>;
  for (const [k, v] of Object.entries(p.set)) row[k] = v;
}

function band(v: number, lo: number, hi: number): string {
  return v < lo ? '低' : v > hi ? '高' : '中';
}

function fingerprint(id: string, seed: number) {
  const mask = generateRuins(seed, id);
  const painted = paintRuinedMask(mask, T);
  const cols = mask.outline.cols;
  const wallHist = new Map<string, number>();
  const floorLum: number[] = [];
  for (let y = 0; y < painted.height; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < painted.width; x++) {
      const col = (x / T) | 0;
      const idx = row * cols + col;
      if (!mask.outline.land[idx]) continue;
      const i = (y * painted.width + x) * 4;
      const r = painted.rgba[i] ?? 0;
      const g = painted.rgba[i + 1] ?? 0;
      const b = painted.rgba[i + 2] ?? 0;
      if (mask.walls[idx]) {
        const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
        wallHist.set(hex, (wallHist.get(hex) ?? 0) + 1);
      } else {
        floorLum.push((r + g + b) / 3);
      }
    }
  }
  const wallMode = [...wallHist.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '无';
  const mean = floorLum.reduce((a, b) => a + b, 0) / Math.max(1, floorLum.length);
  const sd = Math.sqrt(floorLum.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, floorLum.length));
  const n = mask.features.length;
  return {
    wallMode,
    sd,
    sdBand: band(sd, 4.5, 7.0),
    grammar: mask.features[0]?.kind ?? '无',
    featureCount: n,
    countBand: n < 12 ? 'few' : n > 20 ? 'many' : 'mid',
  };
}

console.log('身份指纹（真实烤图）');
console.log('碎片'.padEnd(24), '墙众数'.padEnd(10), '地板标准差'.padEnd(14), '质量语法'.padEnd(12), '地物段数'.padEnd(14), 'core');
const cores = new Map<string, string[]>();
for (const p of PATCHES) {
  const rows = SEEDS.map((s) => {
    try {
      return fingerprint(p.id, s);
    } catch (e) {
      return { err: e instanceof Error ? e.message : String(e) } as never;
    }
  });
  const failed = rows.filter((r) => 'err' in (r as object));
  if (failed.length > 0) {
    console.log(p.label.padEnd(24), `生成失败 ${failed.length}/${SEEDS.length}   ${(failed[0] as unknown as { err: string }).err.slice(0, 90)}`);
    continue;
  }
  const r = rows[1]!;
  const sdList = rows.map((x) => x.sd.toFixed(1)).join('/');
  const cntList = rows.map((x) => x.featureCount).join('/');
  const core = `${r.wallMode}|${r.sdBand}|${r.grammar}|${r.countBand}`;
  console.log(
    p.label.padEnd(24),
    r.wallMode.padEnd(10),
    `${sdList} → ${r.sdBand}`.padEnd(26),
    String(r.grammar).padEnd(12),
    `${cntList} → ${r.countBand}`.padEnd(22),
    core,
  );
  cores.set(core, [...(cores.get(core) ?? []), p.id]);
}

console.log('');
console.log('闸门判定：四张启用碎片的 core 是否互不相同');
let collide = false;
for (const [core, ids] of cores) {
  if (ids.length > 1) collide = true;
  console.log(`  ${core}`.padEnd(46) + ` ← ${ids.join(' , ')}${ids.length > 1 ? '   ⚠ 撞车' : ''}`);
}
console.log(collide ? '结论：仍有撞车，闸门 FAIL' : `结论：${cores.size} 张落 ${cores.size} 个不同 core，闸门 PASS`);
