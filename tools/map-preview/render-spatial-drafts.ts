/**
 * Hardcoded spatial-intent sketches on a real C1 island.
 * Not the generator. For looking, not for shipping.
 *
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/render-spatial-drafts.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOutline } from '../../src/generation/outline-mask.ts';
import { paintRuinedMask } from '../../src/generation/preview-paint.ts';
import type { OutlineMask, RuinFeature, RuinedMask } from '../../src/generation/types.ts';
import { writePng } from './png.ts';

const DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/art/demos/slice-6-outline/spatial-drafts',
);

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function stamp(
  walls: Uint8Array,
  land: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): void {
  if (col < 0 || row < 0 || col >= cols || row >= rows) return;
  const i = at(cols, col, row);
  if (land[i]) walls[i] = 1;
}

function stampRectOutline(
  walls: Uint8Array,
  land: Uint8Array,
  cols: number,
  rows: number,
  x: number,
  y: number,
  w: number,
  h: number,
  skip: ReadonlySet<string>,
): void {
  for (let c = x; c < x + w; c++) {
    if (!skip.has(`${c},${y}`)) stamp(walls, land, cols, rows, c, y);
    if (!skip.has(`${c},${y + h - 1}`)) stamp(walls, land, cols, rows, c, y + h - 1);
  }
  for (let r = y; r < y + h; r++) {
    if (!skip.has(`${x},${r}`)) stamp(walls, land, cols, rows, x, r);
    if (!skip.has(`${x + w - 1},${r}`)) stamp(walls, land, cols, rows, x + w - 1, r);
  }
}

function stampBar(
  walls: Uint8Array,
  land: Uint8Array,
  cols: number,
  rows: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thick: number,
  gapFrom: number,
  gapTo: number,
): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let s = 0; s <= steps; s++) {
    if (s >= gapFrom && s <= gapTo) continue;
    const col = Math.round(x0 + ((x1 - x0) * s) / steps);
    const row = Math.round(y0 + ((y1 - y0) * s) / steps);
    for (let t = 0; t < thick; t++) {
      stamp(walls, land, cols, rows, col + t, row);
      stamp(walls, land, cols, rows, col, row + t);
    }
  }
}

function interiorPaint(land: Uint8Array, walls: Uint8Array, cols: number, rows: number): RuinFeature {
  const paint: Array<{ col: number; row: number; role: 'interior' }> = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || walls[i]) continue;
      let n = 0;
      for (const [dx, dy] of dirs) {
        const nx = col + dx;
        const ny = row + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (walls[at(cols, nx, ny)]) n++;
      }
      if (n >= 1) paint.push({ col, row, role: 'interior' });
    }
  }
  return { kind: 'ridge', cells: [], paint };
}

function toMask(outline: OutlineMask, walls: Uint8Array, typeId: string): RuinedMask {
  let wallCount = 0;
  for (let i = 0; i < walls.length; i++) if (walls[i]) wallCount++;
  return {
    seed: outline.seed,
    attempt: 0,
    fragmentTypeId: typeId,
    outline,
    walls,
    features: [interiorPaint(outline.land, walls, outline.cols, outline.rows)],
    tileMap: outline.tileMap,
    metrics: {
      wallCount,
      wallRatio: outline.metrics.landCount === 0 ? 0 : wallCount / outline.metrics.landCount,
      featureCount: 1,
      leftoverConnected: true,
    },
  };
}

function wrongCourtyard(outline: OutlineMask): Uint8Array {
  const walls = new Uint8Array(outline.land.length);
  const { cols, rows, land } = outline;
  const b = outline.metrics.bbox;
  const cx = b.minCol + ((b.width / 2) | 0);
  const cy = b.minRow + ((b.height / 2) | 0);
  const houses = [
    { x: cx - 12, y: cy - 10, w: 7, h: 6, skip: [`${cx - 6},${cy - 5}`] },
    { x: cx + 4, y: cy - 10, w: 7, h: 6, skip: [`${cx + 4},${cy - 5}`] },
    { x: cx - 12, y: cy + 3, w: 7, h: 6, skip: [`${cx - 6},${cy + 3}`] },
    { x: cx + 4, y: cy + 3, w: 7, h: 6, skip: [`${cx + 4},${cy + 3}`] },
  ];
  for (const h of houses) {
    stampRectOutline(walls, land, cols, rows, h.x, h.y, h.w, h.h, new Set(h.skip));
  }
  return walls;
}

function wildRidge(outline: OutlineMask): Uint8Array {
  const walls = new Uint8Array(outline.land.length);
  const { cols, rows, land } = outline;
  const b = outline.metrics.bbox;
  stampBar(
    walls,
    land,
    cols,
    rows,
    b.minCol + 4,
    b.minRow + 14,
    b.maxCol - 4,
    b.minRow + 18,
    2,
    18,
    21,
  );
  stampBar(
    walls,
    land,
    cols,
    rows,
    b.minCol + 8,
    b.minRow + 6,
    b.minCol + 22,
    b.minRow + 16,
    2,
    9,
    11,
  );
  stampBar(
    walls,
    land,
    cols,
    rows,
    b.minCol + 28,
    b.maxRow - 8,
    b.maxCol - 6,
    b.maxRow - 4,
    2,
    8,
    10,
  );
  return walls;
}

function wildShear(outline: OutlineMask): Uint8Array {
  const walls = new Uint8Array(outline.land.length);
  const { cols, rows, land } = outline;
  const b = outline.metrics.bbox;
  const fault = b.minCol + ((b.width * 0.52) | 0);
  for (let row = b.minRow + 3; row <= b.maxRow - 3; row++) {
    const jog = ((row / 3) | 0) % 2;
    const col = fault + jog;
    if (row >= b.minRow + 12 && row <= b.minRow + 14) continue;
    if (row >= b.minRow + 24 && row <= b.minRow + 26) continue;
    stamp(walls, land, cols, rows, col, row);
    stamp(walls, land, cols, rows, col + 1, row);
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 7 || c === 0) stamp(walls, land, cols, rows, fault - 8 + c, b.minRow + 8 + r);
    }
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 7 || c === 4) {
        stamp(walls, land, cols, rows, fault + 4 + c, b.minRow + 11 + r);
      }
    }
  }
  return walls;
}

function wildHunks(outline: OutlineMask): Uint8Array {
  const walls = new Uint8Array(outline.land.length);
  const { cols, rows, land } = outline;
  const b = outline.metrics.bbox;
  stampBar(walls, land, cols, rows, b.minCol + 6, b.minRow + 8, b.minCol + 8, b.minRow + 22, 3, 7, 9);
  stampBar(walls, land, cols, rows, b.minCol + 6, b.minRow + 8, b.minCol + 18, b.minRow + 9, 2, 99, 99);
  stampBar(
    walls,
    land,
    cols,
    rows,
    b.minCol + 30,
    b.minRow + 6,
    b.maxCol - 8,
    b.minRow + 20,
    2,
    10,
    13,
  );
  stampBar(
    walls,
    land,
    cols,
    rows,
    b.minCol + 16,
    b.maxRow - 10,
    b.minCol + 36,
    b.maxRow - 6,
    3,
    8,
    11,
  );
  return walls;
}

mkdirSync(DIR, { recursive: true });
const outline = generateOutline(101);
const jobs = [
  { file: 'wrong-courtyard.png', type: 'frag-outdoor', walls: wrongCourtyard(outline) },
  { file: 'wild-ridge.png', type: 'frag-outdoor', walls: wildRidge(outline) },
  { file: 'wild-shear.png', type: 'frag-metro', walls: wildShear(outline) },
  { file: 'wild-hunks.png', type: 'frag-outdoor', walls: wildHunks(outline) },
] as const;

for (const job of jobs) {
  const painted = paintRuinedMask(toMask(outline, job.walls, job.type), 16);
  writePng(join(DIR, job.file), Buffer.from(painted.rgba), painted.width, painted.height);
}

writeFileSync(
  join(DIR, 'index.html'),
  `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>空间草案 · 硬编码示意</title>
  <style>
    body { margin: 24px; background: #0a0b0d; color: #c8cdd4; font: 14px/1.5 "Courier New", monospace; }
    h1 { font-size: 16px; font-weight: normal; color: #8a8f96; }
    p { color: #8a8f96; max-width: 72ch; }
    section { margin: 36px 0; }
    img { display: block; image-rendering: pixelated; background: #080a0c; border: 1px solid #151a1e; }
    .bad { color: #8a5c2a; }
  </style>
</head>
<body>
  <h1>同一块岛（种子 101）· 硬编码走法示意</h1>
  <p>不是生成器。四张都钉在人已认的那块陆地上，只换岛上站什么。进游戏仍是旧图。</p>

  <section>
    <p class="bad">不适配 · 四栋围院。农舍逻辑，院子是主角，房子是院墙。世界观要的是野外残片，不是村口。</p>
    <img src="wrong-courtyard.png" width="768" height="504" alt="四栋围院" />
  </section>

  <section>
    <p>对照 · 上一轮生成器实际长这样（撒薄墙）。</p>
    <img src="../c2-outdoor-101.png" width="768" height="504" alt="现生成器" />
  </section>

  <section>
    <p>候选 · 野外褶脊。脊是地形，两边都能走，中间缺口能穿。没有院子。</p>
    <img src="wild-ridge.png" width="768" height="504" alt="褶脊" />
  </section>

  <section>
    <p>候选 · 错位拼合。一条撕裂缝把一块体量切开错位，两边还是野外。不是房子。</p>
    <img src="wild-shear.png" width="768" height="504" alt="错位" />
  </section>

  <section>
    <p>候选 · 几块野外残体。大块、能绕能穿，中间是野地，不是围出来的院。</p>
    <img src="wild-hunks.png" width="768" height="504" alt="残体" />
  </section>
</body>
</html>
`,
);
console.log(`wrote spatial drafts in ${DIR}`);
