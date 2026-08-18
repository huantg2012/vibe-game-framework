/**
 * Ten style-anchor recipes on one island. Procedural top-down, not LLM.
 *
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/render-recipe-drafts.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRecipeDraft } from '../../src/generation/draft-pipeline.ts';
import { paintRuinedMask } from '../../src/generation/preview-paint.ts';
import { PREVIEW_RECIPES, RECIPE_GALLERY_ORDER, recipeById } from '../../src/generation/recipes.ts';
import type { RuinedMask } from '../../src/generation/types.ts';
import { writePng } from './png.ts';

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/art/demos/slice-6-outline/spatial-drafts',
);

const GALLERY_SEED = 101;
const ATMO_FRAMES = 8;
const ATMO_RECIPES = ['ridge-soil', 'ridge-clinic'] as const;
const STUMP_CLOSEUPS = ['ridge-soil', 'hunks-soil', 'shear-soil'] as const;

mkdirSync(DIR, { recursive: true });

function firstBole(mask: RuinedMask): { col: number; row: number } | null {
  const cells = mask.features.flatMap((feat) =>
    (feat.paint ?? []).filter((cell) => cell.role === 'stump'),
  );
  const set = new Set(cells.map((c) => `${c.col},${c.row}`));
  for (const cell of cells) {
    if (
      set.has(`${cell.col + 1},${cell.row}`) &&
      set.has(`${cell.col},${cell.row + 1}`) &&
      set.has(`${cell.col + 1},${cell.row + 1}`)
    ) {
      return { col: cell.col, row: cell.row };
    }
  }
  return null;
}

function cropRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  cw: number,
  ch: number,
): Uint8Array {
  const out = new Uint8Array(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const sx = x0 + x;
      const sy = y0 + y;
      const di = (y * cw + x) * 4;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) {
        out[di + 3] = 255;
        continue;
      }
      const si = (sy * width + sx) * 4;
      out[di] = rgba[si]!;
      out[di + 1] = rgba[si + 1]!;
      out[di + 2] = rgba[si + 2]!;
      out[di + 3] = rgba[si + 3]!;
    }
  }
  return out;
}

const cards: Array<{ id: string; label: string; file: string; fragmentTypeId: string }> = [];
const masks = new Map<string, RuinedMask>();

for (const recipe of PREVIEW_RECIPES) {
  const mask = generateRecipeDraft(GALLERY_SEED, recipe);
  if (!mask.metrics.leftoverConnected) {
    throw new Error(`${recipe.id}: leftover not connected`);
  }
  masks.set(recipe.id, mask);
  const painted = paintRuinedMask(mask, 16);
  const file = `recipe-${recipe.id}.png`;
  writePng(join(DIR, file), Buffer.from(painted.rgba), painted.width, painted.height);
  cards.push({ id: recipe.id, label: recipe.label, file, fragmentTypeId: recipe.fragmentTypeId });
}

for (const id of STUMP_CLOSEUPS) {
  const mask = masks.get(id);
  if (!mask) throw new Error(`missing mask ${id}`);
  const bole = firstBole(mask);
  if (!bole) throw new Error(`${id}: expected a stump for closeup`);
  const painted = paintRuinedMask(mask, 16);
  const T = 16;
  const pad = 3;
  const x0 = Math.max(0, (bole.col - pad) * T);
  const y0 = Math.max(0, (bole.row - pad) * T);
  const x1 = Math.min(painted.width, (bole.col + 2 + pad) * T);
  const y1 = Math.min(painted.height, (bole.row + 2 + pad) * T);
  const crop = cropRgba(painted.rgba, painted.width, painted.height, x0, y0, x1 - x0, y1 - y0);
  writePng(join(DIR, `stump-${id}.png`), Buffer.from(crop), x1 - x0, y1 - y0);
}

for (const id of ATMO_RECIPES) {
  const mask = masks.get(id);
  if (!mask) throw new Error(`missing mask ${id}`);
  for (let i = 0; i < ATMO_FRAMES; i++) {
    const painted = paintRuinedMask(mask, 16, {
      phase: i / ATMO_FRAMES,
      travelScale: 0.35,
    });
    writePng(join(DIR, `atmo-${id}-${i}.png`), Buffer.from(painted.rgba), painted.width, painted.height);
  }
}

function fig(id: string): string {
  const recipe = recipeById(id);
  return `<figure><img src="recipe-${id}.png" width="512" height="336" alt="${recipe.label}" /><figcaption>${recipe.label}<br />${id} · ${recipe.fragmentTypeId}</figcaption></figure>`;
}

const grid = RECIPE_GALLERY_ORDER.map(
  (row) => `    <div class="row">
      ${row.map(fig).join('\n      ')}
    </div>`,
).join('\n');

writeFileSync(
  join(DIR, 'index.html'),
  `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>空间草案 · 十风格锚</title>
  <style>
    body { margin: 24px; background: #0a0b0d; color: #c8cdd4; font: 14px/1.5 "Courier New", monospace; }
    h1 { font-size: 16px; font-weight: normal; color: #8a8f96; }
    p { color: #8a8f96; max-width: 80ch; }
    section { margin: 36px 0; }
    .row { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 16px; }
    figure { margin: 0; }
    figcaption { margin-top: 6px; font-size: 12px; color: #8a8f96; }
    h2 { font-size: 14px; font-weight: normal; color: #8a8f96; margin: 28px 0 8px; }
    img { display: block; image-rendering: pixelated; background: #080a0c; border: 1px solid #151a1e; }
    a { color: #c8cdd4; }
    .closeups img { width: 256px; height: auto; }
  </style>
</head>
<body>
  <h1>空间草案 · 十风格锚</h1>
  <p>同一块岛（种子 101），十个配方。墙是厚短残块，不是 1 格迷宫描线。树是圆切面桩 + 细根。黑坑是空洞；矩形青块是污染。天空巨影 8 帧循环。诊所 / 地铁没有树。这十张是策略锚的样例，不是要搬进游戏的地图。裂隙每次抽一个锚、换种子、在邻域里抖参数再生成；天空影在裂隙里按同一份场改相位循环。</p>
  <p><a href="probes/index.html">密度五案对照</a> · <a href="../index.html">返回陆地预览</a></p>
  <section>
    <h2>桩在哪</h2>
    <p>全图里桩是 2×2 圆切面（年轮 + 深色外皮），不是短石墙。下面三张是户外配方的特写。</p>
    <div class="row closeups">
      <figure><img src="stump-ridge-soil.png" alt="吞没褶脊桩" /><figcaption>吞没褶脊 · 桩特写</figcaption></figure>
      <figure><img src="stump-hunks-soil.png" alt="园缘残体桩" /><figcaption>园缘残体 · 桩特写</figcaption></figure>
      <figure><img src="stump-shear-soil.png" alt="土壤撕缝桩" /><figcaption>土壤撕缝 · 桩特写</figcaption></figure>
    </div>
  </section>
  <section>
    <h2>暗带会动</h2>
    <p>会。同一份氛围场只改 <code>phase</code>，胶囊沿风向滑过岛。雾池是烤死的，这 8 帧只动天空影。裂隙场景还没接这条场，进游戏暂时不会动。</p>
    <div class="row">
      <figure>
        <img id="atmo-ridge-soil" src="atmo-ridge-soil-0.png" width="512" height="336" alt="褶脊天空影循环" />
        <figcaption>吞没褶脊 · 8 帧循环</figcaption>
      </figure>
      <figure>
        <img id="atmo-ridge-clinic" src="atmo-ridge-clinic-0.png" width="512" height="336" alt="诊所天空影循环" />
        <figcaption>无菌折脊 · 8 帧循环（影更重、没有树）</figcaption>
      </figure>
    </div>
  </section>
  <section>
${grid}
  </section>
  <script>
    (function () {
      var frames = 8;
      function cycle(id, prefix) {
        var img = document.getElementById(id);
        if (!img) return;
        var i = 0;
        setInterval(function () {
          i = (i + 1) % frames;
          img.src = prefix + i + ".png";
        }, 180);
      }
      cycle("atmo-ridge-soil", "atmo-ridge-soil-");
      cycle("atmo-ridge-clinic", "atmo-ridge-clinic-");
    })();
  </script>
</body>
</html>
`,
);

console.log(`wrote ${cards.length} recipe drafts + stump closeups + ${ATMO_FRAMES} atmo frames in ${DIR}`);
