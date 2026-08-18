/**
 * Procedural top-down wilderness drafts (same camera + paint as the C1/C2 atlas).
 *
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/render-wilderness-draft.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paintRuinedMask } from '../../src/generation/preview-paint.ts';
import {
  generateWildernessDraft,
  WILDERNESS_KINDS,
} from '../../src/generation/wilderness-draft.ts';
import { writePng } from './png.ts';

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/art/demos/slice-6-outline/spatial-drafts',
);

const SEEDS = [101, 202, 303, 404];
const LABELS: Record<string, string> = {
  ridge: '褶脊',
  shear: '撕缝错位',
  hunks: '野外残体',
};

mkdirSync(DIR, { recursive: true });
const cards: Array<{ kind: string; seed: number; file: string }> = [];

for (const kind of WILDERNESS_KINDS) {
  for (const seed of SEEDS) {
    const mask = generateWildernessDraft(seed, kind);
    const painted = paintRuinedMask(mask, 16);
    const file = `proc-${kind}-${seed}.png`;
    writePng(join(DIR, file), Buffer.from(painted.rgba), painted.width, painted.height);
    cards.push({ kind, seed, file });
  }
}

const sections = WILDERNESS_KINDS.map((kind) => {
  const figs = cards
    .filter((c) => c.kind === kind)
    .map(
      (c) =>
        `<figure><img src="${c.file}" width="512" height="336" alt="${kind} ${c.seed}" /><figcaption>${c.seed}</figcaption></figure>`,
    )
    .join('\n      ');
  return `  <section>
    <p>程序化 · 俯视 · ${LABELS[kind]}（同一套生成器，换种子）</p>
    <div class="row">
      ${figs}
    </div>
  </section>`;
}).join('\n');

writeFileSync(
  join(DIR, 'index.html'),
  `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>空间草案 · 程序化俯视</title>
  <style>
    body { margin: 24px; background: #0a0b0d; color: #c8cdd4; font: 14px/1.5 "Courier New", monospace; }
    h1 { font-size: 16px; font-weight: normal; color: #8a8f96; }
    p { color: #8a8f96; max-width: 72ch; }
    section { margin: 36px 0; }
    .row { display: flex; flex-wrap: wrap; gap: 16px; }
    figure { margin: 0; }
    figcaption { margin-top: 6px; font-size: 12px; color: #8a8f96; }
    img { display: block; image-rendering: pixelated; background: #080a0c; border: 1px solid #151a1e; }
    .bad { color: #c4873a; }
  </style>
</head>
<body>
  <h1>空间草案 · 程序化俯视</h1>
  <p>和游戏同一台摄像机、同一套漆。种子进生成器，不是概念图。进游戏仍是旧图。</p>
  <section>
    <p class="bad">对照 · 农舍围院（不适配）</p>
    <img src="wrong-courtyard.png" width="512" height="336" alt="围院" />
  </section>
  <section>
    <p>对照 · 上一轮撒薄墙</p>
    <img src="../c2-outdoor-101.png" width="512" height="336" alt="撒墙" />
  </section>
${sections}
</body>
</html>
`,
);
console.log(`wrote ${cards.length} procedural drafts in ${DIR}`);
