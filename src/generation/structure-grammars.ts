/**
 * Preview structure grammars. Walls only. Scatter/FX live in draft-pipeline.
 * Does not wire RiftScene.
 */

import type { OutlineMask, RuinCell, RuinPaintCell } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

export type StructureGrammar =
  | 'ridge'
  | 'shear'
  | 'hunks'
  | 'rim'
  | 'orthoRidge'
  | 'plates'
  | 'twinRidge'
  | 'pads';

export interface StructureBuildSpec {
  readonly grammar: StructureGrammar;
  readonly density: number;
  readonly gapiness: number;
  readonly thickness: 1 | 2 | 3;
  readonly align: 'free' | 'ortho';
}

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIRS8: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function isLand(land: Uint8Array, cols: number, rows: number, col: number, row: number): boolean {
  return inBounds(cols, rows, col, row) && !!land[at(cols, col, row)];
}

function landBBox(land: Uint8Array, cols: number, rows: number) {
  let minC = cols;
  let minR = rows;
  let maxC = 0;
  let maxR = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at(cols, col, row)]) continue;
      if (col < minC) minC = col;
      if (row < minR) minR = row;
      if (col > maxC) maxC = col;
      if (row > maxR) maxR = row;
    }
  }
  return { minC, minR, maxC, maxR, width: maxC - minC + 1, height: maxR - minR + 1 };
}

function thicken2(
  spine: readonly RuinCell[],
  land: Uint8Array,
  cols: number,
  rows: number,
): RuinCell[] {
  const out: RuinCell[] = [];
  const seen = new Set<number>();
  for (const cell of spine) {
    for (const extra of solidRect(cell.col, cell.row, 2, 2, land, cols, rows)) {
      const i = at(cols, extra.col, extra.row);
      if (seen.has(i)) continue;
      seen.add(i);
      out.push(extra);
    }
  }
  return out;
}

function stamp(walls: Uint8Array, cells: readonly RuinCell[], cols: number): void {
  for (const cell of cells) walls[at(cols, cell.col, cell.row)] = 1;
}

function raiseNear(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  near: readonly RuinCell[],
  radius: number,
): RuinPaintCell[] {
  const paint: RuinPaintCell[] = [];
  const seen = new Set<number>();
  for (const cell of near) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = cell.col + dx;
        const row = cell.row + dy;
        if (!isLand(land, cols, rows, col, row)) continue;
        const i = at(cols, col, row);
        if (walls[i] || seen.has(i)) continue;
        seen.add(i);
        paint.push({ col, row, role: 'debris' });
      }
    }
  }
  return paint;
}

function pickLand(
  land: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
  n: number,
  minDist: number,
  filter?: (cell: RuinCell) => boolean,
): RuinCell[] {
  const all: RuinCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at(cols, col, row)]) continue;
      const cell = { col, row };
      if (filter && !filter(cell)) continue;
      all.push(cell);
    }
  }
  const out: RuinCell[] = [];
  let guard = 0;
  while (out.length < n && guard++ < 600 && all.length > 0) {
    const cell = all[rng.nextInt(0, all.length - 1)]!;
    if (out.some((p) => Math.abs(p.col - cell.col) + Math.abs(p.row - cell.row) < minDist)) continue;
    out.push(cell);
  }
  return out;
}

function nearVoid(land: Uint8Array, cols: number, rows: number, col: number, row: number): boolean {
  for (const [dx, dy] of DIRS4) {
    if (!isLand(land, cols, rows, col + dx, row + dy)) return true;
  }
  return false;
}

function pickInterior(
  land: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
  inset = 3,
): RuinCell | null {
  const box = landBBox(land, cols, rows);
  const hits: RuinCell[] = [];
  const minC = box.minC + inset;
  const maxC = box.maxC - inset;
  const minR = box.minR + inset;
  const maxR = box.maxR - inset;
  for (let row = minR; row <= maxR; row++) {
    for (let col = minC; col <= maxC; col++) {
      if (isLand(land, cols, rows, col, row)) hits.push({ col, row });
    }
  }
  if (hits.length === 0) return pickLand(land, cols, rows, rng, 1, 1)[0] ?? null;
  return hits[rng.nextInt(0, hits.length - 1)]!;
}

function walkLimited(
  land: Uint8Array,
  cols: number,
  rows: number,
  start: RuinCell,
  dx: number,
  dy: number,
  len: number,
  rng: SeededRandom,
  bend: boolean,
): RuinCell[] {
  const cells: RuinCell[] = [];
  const seen = new Set<string>();
  let col = start.col;
  let row = start.row;
  let ux = dx;
  let uy = dy;
  const bendAt = bend ? ((len / 2) | 0) : -1;
  for (let step = 0; step < len; step++) {
    const key = `${col},${row}`;
    if (!seen.has(key) && isLand(land, cols, rows, col, row)) {
      seen.add(key);
      cells.push({ col, row });
    }
    if (step === bendAt) {
      const left = rng.next() < 0.5;
      const nx = left ? -uy : uy;
      const ny = left ? ux : -ux;
      ux = nx;
      uy = ny;
    }
    let nc = col + ux;
    let nr = row + uy;
    if (bend && rng.next() < 0.28) {
      nc += rng.next() < 0.5 ? -uy : uy;
      nr += rng.next() < 0.5 ? ux : -ux;
    }
    if (!isLand(land, cols, rows, nc, nr)) {
      const opts: RuinCell[] = [];
      for (const [sx, sy] of DIRS8) {
        if (isLand(land, cols, rows, col + sx, row + sy) && !seen.has(`${col + sx},${row + sy}`)) {
          opts.push({ col: col + sx, row: row + sy });
        }
      }
      if (opts.length === 0) break;
      const pick = opts[rng.nextInt(0, opts.length - 1)]!;
      nc = pick.col;
      nr = pick.row;
    }
    col = nc;
    row = nr;
  }
  return cells;
}

function heading(rng: SeededRandom): { dx: number; dy: number } {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const;
  const d = dirs[rng.nextInt(0, dirs.length - 1)]!;
  return { dx: d[0], dy: d[1] };
}

function splitGap(spine: readonly RuinCell[], gapAt: number, gap: number): RuinCell[] {
  return spine.filter((_, i) => i < gapAt || i >= gapAt + gap);
}

function solidRect(ox: number, oy: number, w: number, h: number, land: Uint8Array, cols: number, rows: number): RuinCell[] {
  const cells: RuinCell[] = [];
  for (let row = oy; row < oy + h; row++) {
    for (let col = ox; col < ox + w; col++) {
      if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
    }
  }
  return cells;
}

function buildRidge(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const start = pickInterior(land, cols, rows, rng, 4);
  if (!start) return { walls, paint };
  const { dx, dy } = heading(rng);
  const len = rng.nextInt(7, 10);
  const spine = walkLimited(land, cols, rows, start, dx, dy, len, rng, true);
  const gapped = splitGap(spine, Math.max(2, ((spine.length / 2) | 0) - 1), 2);
  stamp(walls, thicken2(gapped, land, cols, rows), cols);
  const nugs = 1 + (rng.next() < spec.density ? 1 : 0);
  for (const seed of pickLand(land, cols, rows, rng, nugs, 6)) {
    if (Math.abs(seed.col - start.col) + Math.abs(seed.row - start.row) > 8) continue;
    stamp(walls, solidRect(seed.col, seed.row, rng.nextInt(2, 3), rng.nextInt(2, 3), land, cols, rows), cols);
  }
  paint.push(...raiseNear(land, walls, cols, rows, gapped, 2));
  return { walls, paint };
}

function buildShear(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const vertical = box.height >= box.width * 0.7;
  const segments = 2 + (spec.density > 0.55 ? 1 : 0);
  const lipLen = rng.nextInt(4, 7);
  const thick = Math.max(2, spec.thickness);
  const gap = thick + 3 + (rng.next() < 0.5 ? 1 : 0);
  const axis0 = vertical
    ? box.minR + 3 + rng.nextInt(0, Math.max(1, box.height - lipLen - 8))
    : box.minC + 3 + rng.nextInt(0, Math.max(1, box.width - lipLen - 8));
  const cross = vertical
    ? box.minC + ((box.width / 2) | 0) - ((gap / 2) | 0)
    : box.minR + ((box.height / 2) | 0) - ((gap / 2) | 0);
  for (let s = 0; s < segments; s++) {
    const stagger = s * (lipLen + 1);
    const along = axis0 + stagger;
    const shift = (s % 2) * gap;
    const cells: RuinCell[] = [];
    for (let k = 0; k < lipLen; k++) {
      for (let t = 0; t < thick; t++) {
        const col = vertical ? cross + shift + t : along + k;
        const row = vertical ? along + k : cross + shift + t;
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  }
  return { walls, paint };
}

function buildHunks(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const n = 3 + (spec.density > 0.6 ? 2 : 1);
  const seeds = pickLand(land, cols, rows, rng, n, 7);
  for (const seed of seeds) {
    const w = rng.nextInt(2, 4);
    const h = rng.nextInt(2, 4);
    const cells = solidRect(seed.col, seed.row, w, h, land, cols, rows);
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  }
  return { walls, paint };
}

function buildRim(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const n = 2 + (spec.density > 0.6 ? 1 : 0);
  const seeds = pickLand(land, cols, rows, rng, n, 8, (c) => nearVoid(land, cols, rows, c.col, c.row));
  for (const seed of seeds) {
    const alongEdge: RuinCell[] = [seed];
    let col = seed.col;
    let row = seed.row;
    for (let step = 0; step < rng.nextInt(5, 8); step++) {
      let next: RuinCell | null = null;
      for (const [dx, dy] of DIRS4) {
        const nc = col + dx;
        const nr = row + dy;
        if (!isLand(land, cols, rows, nc, nr)) continue;
        if (!nearVoid(land, cols, rows, nc, nr)) continue;
        if (alongEdge.some((c) => c.col === nc && c.row === nr)) continue;
        next = { col: nc, row: nr };
        break;
      }
      if (!next) break;
      alongEdge.push(next);
      col = next.col;
      row = next.row;
    }
    stamp(walls, thicken2(alongEdge, land, cols, rows), cols);
    paint.push(...raiseNear(land, walls, cols, rows, alongEdge, 1));
  }
  return { walls, paint };
}

function buildOrthoRidge(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const start = pickInterior(land, cols, rows, rng, 4);
  if (!start) return { walls, paint };
  const arm = rng.nextInt(4, 6);
  const thick = Math.max(2, spec.thickness);
  const horizFirst = rng.next() < 0.5;
  const sH = rng.next() < 0.5 ? 1 : -1;
  const sV = rng.next() < 0.5 ? 1 : -1;
  const cells: RuinCell[] = [];
  const addArm = (dx: number, dy: number): void => {
    for (let k = 0; k < arm; k++) {
      for (let t = 0; t < thick; t++) {
        const col = start.col + dx * k + (dy !== 0 ? t : 0);
        const row = start.row + dy * k + (dx !== 0 ? t : 0);
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
  };
  if (horizFirst) {
    addArm(sH, 0);
    addArm(0, sV);
  } else {
    addArm(0, sV);
    addArm(sH, 0);
  }
  stamp(walls, cells, cols);
  paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  return { walls, paint };
}

function buildTwinRidge(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const horiz = box.width >= box.height;
  const len = rng.nextInt(5, 6);
  const thick = Math.max(2, spec.thickness);
  const spacing = 3;
  const cx = box.minC + ((box.width / 2) | 0) - ((horiz ? len : thick) / 2 | 0);
  const cy = box.minR + ((box.height / 2) | 0) - ((horiz ? thick : len) / 2 | 0);
  const cells: RuinCell[] = [];
  for (let beam = 0; beam < 2; beam++) {
    const off = beam * (thick + spacing);
    for (let k = 0; k < len; k++) {
      for (let t = 0; t < thick; t++) {
        const col = horiz ? cx + k : cx + off + t;
        const row = horiz ? cy + off + t : cy + k;
        if (isLand(land, cols, rows, col, row)) cells.push({ col, row });
      }
    }
  }
  stamp(walls, cells, cols);
  paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  return { walls, paint };
}

function buildPlates(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const horiz = box.width >= box.height;
  const n = 2 + (spec.density > 0.65 ? 1 : 0);
  const thick = Math.max(2, spec.thickness);
  const spacing = 4;
  for (let i = 0; i < n; i++) {
    const len = rng.nextInt(5, 8);
    const cells: RuinCell[] = [];
    if (horiz) {
      const row = box.minR + 3 + i * (thick + spacing);
      const start = box.minC + 2 + rng.nextInt(0, 4) + (i % 2) * 2;
      for (let k = 0; k < len; k++) {
        for (let w = 0; w < thick; w++) {
          const col = start + k;
          const r = row + w;
          if (isLand(land, cols, rows, col, r)) cells.push({ col, row: r });
        }
      }
    } else {
      const col = box.minC + 3 + i * (thick + spacing);
      const start = box.minR + 2 + rng.nextInt(0, 4) + (i % 2) * 2;
      for (let k = 0; k < len; k++) {
        for (let w = 0; w < thick; w++) {
          const c = col + w;
          const row = start + k;
          if (isLand(land, cols, rows, c, row)) cells.push({ col: c, row });
        }
      }
    }
    stamp(walls, cells, cols);
    paint.push(...raiseNear(land, walls, cols, rows, cells, 1));
  }
  return { walls, paint };
}

function landInRect(
  land: Uint8Array,
  cols: number,
  rows: number,
  minC: number,
  minR: number,
  w: number,
  h: number,
): number {
  let n = 0;
  for (let row = minR; row < minR + h; row++) {
    for (let col = minC; col < minC + w; col++) {
      if (isLand(land, cols, rows, col, row)) n++;
    }
  }
  return n;
}

function buildPads(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const want = spec.density > 0.9 ? 2 : 1;
  const placed: RuinCell[] = [];
  let guard = 0;
  while (placed.length < want && guard++ < 400) {
    const w = rng.nextInt(8, 10);
    const h = rng.nextInt(7, 9);
    const seed = pickInterior(land, cols, rows, rng, 3);
    if (!seed) break;
    const minC = seed.col - ((w / 2) | 0);
    const minR = seed.row - ((h / 2) | 0);
    if (landInRect(land, cols, rows, minC, minR, w, h) < w * h * 0.72) continue;
    if (placed.some((p) => Math.abs(p.col - seed.col) + Math.abs(p.row - seed.row) < 10)) continue;
    placed.push(seed);
    const open = rng.nextInt(0, 3);
    const cells: RuinCell[] = [];
    const ring = 2;
    for (let row = minR; row < minR + h; row++) {
      for (let col = minC; col < minC + w; col++) {
        if (!isLand(land, cols, rows, col, row)) continue;
        const onN = row < minR + ring;
        const onS = row >= minR + h - ring;
        const onW = col < minC + ring;
        const onE = col >= minC + w - ring;
        const onEdge = onN || onS || onW || onE;
        if (!onEdge) {
          paint.push({ col, row, role: 'interior' });
          continue;
        }
        if (open === 0 && onN) continue;
        if (open === 1 && onE) continue;
        if (open === 2 && onS) continue;
        if (open === 3 && onW) continue;
        cells.push({ col, row });
      }
    }
    stamp(walls, cells, cols);
  }
  return { walls, paint };
}

export function buildStructure(
  outline: OutlineMask,
  rng: SeededRandom,
  spec: StructureBuildSpec,
): { walls: Uint8Array; paint: RuinPaintCell[] } {
  switch (spec.grammar) {
    case 'ridge':
      return buildRidge(outline, rng, spec);
    case 'shear':
      return buildShear(outline, rng, spec);
    case 'hunks':
      return buildHunks(outline, rng, spec);
    case 'rim':
      return buildRim(outline, rng, spec);
    case 'orthoRidge':
      return buildOrthoRidge(outline, rng, spec);
    case 'plates':
      return buildPlates(outline, rng, spec);
    case 'twinRidge':
      return buildTwinRidge(outline, rng, spec);
    case 'pads':
      return buildPads(outline, rng, spec);
  }
}
