/**
 * Five density-scheme probes on the same island. Procedural top-down, not LLM.
 *
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/render-density-probes.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRecipeDraft } from '../../src/generation/draft-pipeline.ts';
import { maxOpenYard } from '../../src/generation/masses.ts';
import { paintRuinedMask } from '../../src/generation/preview-paint.ts';
import { recipeById } from '../../src/generation/recipes.ts';
import { mix32 } from '../../src/generation/seed-fork.ts';
import { SeededRandom } from '../../src/utils/random.ts';
import {
  applyProbe,
  coverDistanceField,
  coverStats,
  tintTiles,
  type ProbeScheme,
} from './density-probes.ts';
import { writePng } from './png.ts';

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/art/demos/slice-6-outline/spatial-drafts/probes',
);

const GALLERY_SEED = 101;
const RECIPES = ['ridge-soil', 'ridge-clinic'] as const;
const SCHEMES: readonly ProbeScheme[] = ['A', 'B', 'C', 'D', 'E'];
const TILE = 16;

const CAPTION: Record<ProbeScheme, string> = {
  A: '同一套形状加件，新坨落进当前最大空地',
  B: '补到下一坨进入 7 格锥就停；留一块 6×6 院',
  C: '一道厚隔断切开盆地，口在尽端，院内再放家具',
  D: '现图上的可藏距离场：越红越远，>7 格就是操场',
  E: '从已有大件长出 2 厚法兰；青带贴墙，黄带暴露',
};

mkdirSync(DIR, { recursive: true });

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const cards: string[] = [];

for (const recipeId of RECIPES) {
  const recipe = recipeById(recipeId);
  const base = generateRecipeDraft(GALLERY_SEED, recipe);
  const baseCover = coverStats(base);
  const basePainted = paintRuinedMask(base, TILE);
  writePng(join(DIR, `${recipeId}-now.png`), Buffer.from(basePainted.rgba), basePainted.width, basePainted.height);
  const baseYard = maxOpenYard(base.outline.land, base.walls, base.outline.cols, base.outline.rows);
  cards.push(
    `<figure><img src="${recipeId}-now.png" width="512" height="336" alt="${recipe.label} 现图" /><figcaption>${recipe.label} · 现图<br />墙 ${(base.metrics.wallRatio * 100).toFixed(1)}% · 空矩形 ${baseYard} · 掩护距离中位 ${fmt(baseCover.median)} / P90 ${fmt(baseCover.p90)}</figcaption></figure>`,
  );

  for (const scheme of SCHEMES) {
    const rng = new SeededRandom(mix32(GALLERY_SEED, `probe:${recipeId}:${scheme}`));
    const applied = scheme === 'D' ? { mask: base, stats: {
      wallRatio: base.metrics.wallRatio,
      maxYard: baseYard,
      medianCover: baseCover.median,
      p90Cover: baseCover.p90,
    } } : applyProbe(base, scheme, rng);
    const painted = paintRuinedMask(applied.mask, TILE);
    const rgba = new Uint8Array(painted.rgba);
    const cols = applied.mask.outline.cols;
    const rows = applied.mask.outline.rows;
    if (scheme === 'D') {
      const dist = coverDistanceField(applied.mask);
      tintTiles(rgba, painted.width, painted.height, TILE, cols, rows, applied.mask.outline.land, applied.mask.walls, (col, row) => {
        const d = dist[row * cols + col]!;
        if (d > 1e8) return [180, 20, 20, 0.55];
        const t = Math.min(1, d / 12);
        return [40 + 215 * t, 30 * (1 - t), 20, 0.42] as const;
      });
    }
    if (scheme === 'E') {
      const dist = coverDistanceField(applied.mask);
      tintTiles(rgba, painted.width, painted.height, TILE, cols, rows, applied.mask.outline.land, applied.mask.walls, (col, row) => {
        const d = dist[row * cols + col]!;
        if (d <= 2) return [26, 173, 150, 0.28];
        if (d >= 6) return [224, 168, 72, 0.28];
        return null;
      });
    }
    const file = `${recipeId}-${scheme}.png`;
    writePng(join(DIR, file), Buffer.from(rgba), painted.width, painted.height);
    cards.push(
      `<figure><img src="${file}" width="512" height="336" alt="${recipe.label} 方案 ${scheme}" /><figcaption><strong>${scheme}</strong> ${recipe.label}<br />${CAPTION[scheme]}<br />墙 ${(applied.stats.wallRatio * 100).toFixed(1)}% · 空矩形 ${applied.stats.maxYard} · 掩护距离中位 ${fmt(applied.stats.medianCover)} / P90 ${fmt(applied.stats.p90Cover)}</figcaption></figure>`,
    );
  }
}

writeFileSync(
  join(DIR, 'index.html'),
  `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>密度五案 · 程序化对照</title>
  <style>
    body { margin: 24px; background: #0a0b0d; color: #c8cdd4; font: 14px/1.5 "Courier New", monospace; }
    h1 { font: 16px/1.4 "Courier New", monospace; font-weight: normal; color: #8a8f96; }
    p, li { color: #8a8f96; max-width: 88ch; }
    a { color: #c8cdd4; }
    .row { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0 36px; }
    figure { margin: 0; max-width: 512px; }
    figcaption { margin-top: 6px; font-size: 12px; color: #8a8f96; }
    img { display: block; image-rendering: pixelated; background: #080a0c; border: 1px solid #151a1e; }
    strong { color: #c8cdd4; font-weight: normal; }
    h2 { font-size: 14px; font-weight: normal; color: #8a8f96; margin: 28px 0 8px; }
  </style>
</head>
<body>
  <h1>密度五案 · 同一岛（种子 101）</h1>
  <p>程序化俯视，和十锚同一套漆。不是概念图。左列户外褶脊，右列诊所折脊（无树、雾轻）。现图是对照；A–E 是五条方案的极限草稿，<strong>还没定哪条进生成器</strong>。</p>
  <p><a href="../index.html">返回十锚</a></p>
  <ul>
    <li><strong>A</strong> 同家族加件，落到最大空地里</li>
    <li><strong>B</strong> 按 7 格锥补洞，留一块 6×6 院</li>
    <li><strong>C</strong> 厚隔断开盆地，口在尽端</li>
    <li><strong>D</strong> 不改墙，只给现图涂可藏距离（红 = 灯里没有下一坨）</li>
    <li><strong>E</strong> 大件长法兰；青 = 贴墙隐蔽带，黄 = 暴露空地</li>
  </ul>
  <h2>吞没褶脊 · frag-outdoor</h2>
  <div class="row">
    ${cards.filter((_, i) => i < 6).join('\n    ')}
  </div>
  <h2>无菌折脊 · frag-clinic</h2>
  <div class="row">
    ${cards.filter((_, i) => i >= 6).join('\n    ')}
  </div>
</body>
</html>
`,
);

console.log(`wrote density probes in ${DIR}`);
