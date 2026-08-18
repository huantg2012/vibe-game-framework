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

function firstLandOnRay(
  land: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  dx: number,
  dy: number,
): RuinCell | null {
  for (let s = 0; s < cols + rows; s++) {
    const c = col + dx * s;
    const r = row + dy * s;
    if (!inBounds(cols, rows, c, r)) return null;
    if (land[at(cols, c, r)]) return { col: c, row: r };
  }
  return null;
}

function walkRidge(
  land: Uint8Array,
  cols: number,
  rows: number,
  start: RuinCell,
  toward: RuinCell,
  rng: SeededRandom,
): RuinCell[] {
  const cells: RuinCell[] = [];
  const seen = new Set<string>();
  let col = start.col;
  let row = start.row;
  for (let step = 0; step < 220; step++) {
    const key = `${col},${row}`;
    if (!seen.has(key) && isLand(land, cols, rows, col, row)) {
      seen.add(key);
      cells.push({ col, row });
    }
    if (Math.abs(col - toward.col) + Math.abs(row - toward.row) <= 2) break;
    const pullC = Math.sign(toward.col - col);
    const pullR = Math.sign(toward.row - row);
    let nc = col + pullC;
    let nr = row + pullR;
    if (rng.next() < 0.55) {
      const j = rng.nextInt(-1, 1);
      if (Math.abs(pullC) >= Math.abs(pullR)) nr += j;
      else nc += j;
    }
    if (!isLand(land, cols, rows, nc, nr)) {
      const opts: RuinCell[] = [];
      for (const [dx, dy] of DIRS8) {
        if (isLand(land, cols, rows, col + dx, row + dy)) opts.push({ col: col + dx, row: row + dy });
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

function walkOrtho(
  land: Uint8Array,
  cols: number,
  rows: number,
  start: RuinCell,
  toward: RuinCell,
  rng: SeededRandom,
): RuinCell[] {
  const cells: RuinCell[] = [];
  const seen = new Set<string>();
  let col = start.col;
  let row = start.row;
  let horiz = Math.abs(toward.col - start.col) >= Math.abs(toward.row - start.row);
  for (let step = 0; step < 220; step++) {
    const key = `${col},${row}`;
    if (!seen.has(key) && isLand(land, cols, rows, col, row)) {
      seen.add(key);
      cells.push({ col, row });
    }
    if (Math.abs(col - toward.col) + Math.abs(row - toward.row) <= 1) break;
    if (rng.next() < 0.16) horiz = !horiz;
    const pullC = Math.sign(toward.col - col);
    const pullR = Math.sign(toward.row - row);
    let nc = col;
    let nr = row;
    if (horiz) nc = col + (pullC || (rng.next() < 0.5 ? 1 : -1));
    else nr = row + (pullR || (rng.next() < 0.5 ? 1 : -1));
    if (!isLand(land, cols, rows, nc, nr)) {
      horiz = !horiz;
      nc = col;
      nr = row;
      if (horiz) nc = col + (pullC || 0);
      else nr = row + (pullR || 0);
    }
    if (!isLand(land, cols, rows, nc, nr)) {
      const opts: RuinCell[] = [];
      for (const [dx, dy] of DIRS4) {
        if (isLand(land, cols, rows, col + dx, row + dy)) opts.push({ col: col + dx, row: row + dy });
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

function thicken(
  spine: readonly RuinCell[],
  land: Uint8Array,
  cols: number,
  rows: number,
  radius: number,
): RuinCell[] {
  const out: RuinCell[] = [];
  const seen = new Set<number>();
  for (const cell of spine) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius + 1) continue;
        const col = cell.col + dx;
        const row = cell.row + dy;
        if (!isLand(land, cols, rows, col, row)) continue;
        const i = at(cols, col, row);
        if (seen.has(i)) continue;
        seen.add(i);
        out.push({ col, row });
      }
    }
  }
  return out;
}

function punchGaps(cells: RuinCell[], nGaps: number, gapLen: number, rng: SeededRandom): RuinCell[] {
  if (cells.length < 20) return cells;
  const n = cells.length < 36 ? Math.min(nGaps, 1) : nGaps;
  const len = Math.min(gapLen, cells.length < 36 ? 2 : gapLen);
  const drop = new Set<string>();
  const span = Math.max(4, cells.length - len - 4);
  for (let g = 0; g < n; g++) {
    const atIndex = rng.nextInt(4, span);
    for (let k = 0; k < len; k++) {
      const cell = cells[atIndex + k];
      if (cell) drop.add(`${cell.col},${cell.row}`);
    }
  }
  const kept = cells.filter((c) => !drop.has(`${c.col},${c.row}`));
  return kept.length < 8 ? cells : kept;
}

function growBlob(
  land: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
  want: number,
  rng: SeededRandom,
): RuinCell[] {
  const out: RuinCell[] = [];
  const seen = new Set<number>([at(cols, seed.col, seed.row)]);
  const frontier: RuinCell[] = [seed];
  while (out.length < want && frontier.length > 0) {
    const idx = rng.nextInt(0, frontier.length - 1);
    const cur = frontier.splice(idx, 1)[0]!;
    if (!isLand(land, cols, rows, cur.col, cur.row)) continue;
    out.push(cur);
    const order = [...DIRS8];
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(0, i);
      const tmp = order[i]!;
      order[i] = order[j]!;
      order[j] = tmp;
    }
    for (const [dx, dy] of order) {
      const col = cur.col + dx;
      const row = cur.row + dy;
      if (!isLand(land, cols, rows, col, row)) continue;
      const i = at(cols, col, row);
      if (seen.has(i)) continue;
      seen.add(i);
      frontier.push({ col, row });
    }
  }
  return out;
}

function shellOf(blob: readonly RuinCell[]): RuinCell[] {
  const set = new Set(blob.map((c) => `${c.col},${c.row}`));
  return blob.filter((c) => {
    let open = 0;
    for (const [dx, dy] of DIRS4) {
      if (!set.has(`${c.col + dx},${c.row + dy}`)) open++;
    }
    return open > 0;
  });
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

function gapCount(gapiness: number): number {
  return 1 + ((gapiness * 3) | 0);
}

function gapLen(gapiness: number): number {
  return 2 + ((gapiness * 2) | 0);
}

function pairEnds(outline: OutlineMask, rng: SeededRandom, align: 'free' | 'ortho') {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const horiz = box.width >= box.height;
  const jitter = align === 'ortho' ? 0 : rng.nextInt(0, 2);
  const a = horiz
    ? firstLandOnRay(land, cols, rows, box.minC, box.minR + ((box.height / 2) | 0) + jitter, 1, 0)
    : firstLandOnRay(land, cols, rows, box.minC + ((box.width / 2) | 0) + jitter, box.minR, 0, 1);
  const b = horiz
    ? firstLandOnRay(land, cols, rows, box.maxC, box.minR + ((box.height / 2) | 0) - jitter, -1, 0)
    : firstLandOnRay(land, cols, rows, box.minC + ((box.width / 2) | 0) - jitter, box.maxR, 0, -1);
  return { a, b, horiz, box };
}

function walkByAlign(
  land: Uint8Array,
  cols: number,
  rows: number,
  start: RuinCell,
  toward: RuinCell,
  rng: SeededRandom,
  align: 'free' | 'ortho',
): RuinCell[] {
  return align === 'ortho'
    ? walkOrtho(land, cols, rows, start, toward, rng)
    : walkRidge(land, cols, rows, start, toward, rng);
}

function buildRidge(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const { a, b, horiz, box } = pairEnds(outline, rng, spec.align);
  if (!a || !b) return { walls, paint };
  const spine = walkByAlign(land, cols, rows, a, b, rng, spec.align);
  const thick = thicken(spine, land, cols, rows, spec.thickness - 1);
  stamp(walls, punchGaps(thick, gapCount(spec.gapiness), gapLen(spec.gapiness), rng), cols);
  paint.push(...raiseNear(land, walls, cols, rows, spine, 2));
  if (spec.align === 'ortho') {
    const stubs = 2 + (spec.density > 0.5 ? 1 : 0);
    for (const seed of pickLand(land, cols, rows, rng, stubs, 8)) {
      const toward: RuinCell = horiz
        ? { col: seed.col, row: seed.row + (rng.next() < 0.5 ? 8 : -8) }
        : { col: seed.col + (rng.next() < 0.5 ? 8 : -8), row: seed.row };
      const stub = walkOrtho(land, cols, rows, seed, toward, rng).slice(0, rng.nextInt(6, 10));
      stamp(walls, punchGaps(thicken(stub, land, cols, rows, 0), 1, 2, rng), cols);
    }
  } else if (spec.density > 0.4 && rng.next() < 0.7) {
    const c = pickLand(land, cols, rows, rng, 1, 8)[0];
    if (c) {
      const d: RuinCell = horiz
        ? { col: c.col, row: c.row + (c.row > box.minR + box.height / 2 ? -10 : 10) }
        : { col: c.col + (c.col > box.minC + box.width / 2 ? -10 : 10), row: c.row };
      const spine2 = walkByAlign(land, cols, rows, c, d, rng, spec.align).slice(0, 16);
      stamp(walls, punchGaps(thicken(spine2, land, cols, rows, 0), 1, 2, rng), cols);
    }
  }
  return { walls, paint };
}

function buildShear(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const vertical = box.height >= box.width * 0.7;
  const fault: RuinCell[] = [];
  if (vertical) {
    let col = box.minC + ((box.width / 2) | 0);
    for (let row = box.minR; row <= box.maxR; row++) {
      if (spec.align === 'free') col += rng.nextInt(-1, 1);
      else if (rng.next() < 0.12) col += rng.next() < 0.5 ? -1 : 1;
      col = Math.max(box.minC + 3, Math.min(box.maxC - 3, col));
      if (isLand(land, cols, rows, col, row)) fault.push({ col, row });
    }
  } else {
    let row = box.minR + ((box.height / 2) | 0);
    for (let col = box.minC; col <= box.maxC; col++) {
      if (spec.align === 'free') row += rng.nextInt(-1, 1);
      else if (rng.next() < 0.12) row += rng.next() < 0.5 ? -1 : 1;
      row = Math.max(box.minR + 3, Math.min(box.maxR - 3, row));
      if (isLand(land, cols, rows, col, row)) fault.push({ col, row });
    }
  }
  stamp(walls, punchGaps(thicken(fault, land, cols, rows, spec.thickness - 1), gapCount(spec.gapiness), 3, rng), cols);
  if (spec.align === 'ortho') {
    const slip = 2;
    const slipped: RuinCell[] = fault.map((c) =>
      vertical ? { col: c.col + slip, row: c.row } : { col: c.col, row: c.row + slip },
    );
    stamp(
      walls,
      punchGaps(
        thicken(
          slipped.filter((c) => isLand(land, cols, rows, c.col, c.row)),
          land,
          cols,
          rows,
          0,
        ),
        1,
        2,
        rng,
      ),
      cols,
    );
  }
  const split = vertical
    ? (c: RuinCell) => c.col < box.minC + ((box.width / 2) | 0)
    : (c: RuinCell) => c.row < box.minR + ((box.height / 2) | 0);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || walls[i]) continue;
      if (split({ col, row })) paint.push({ col, row, role: 'debris' });
    }
  }
  if (spec.density > 0.45) {
    for (const seed of pickLand(land, cols, rows, rng, spec.align === 'ortho' ? 1 : 2, 10)) {
      const blob = growBlob(land, cols, rows, seed, rng.nextInt(16, 28), rng);
      stamp(walls, punchGaps(shellOf(blob), 2, 2, rng), cols);
    }
  }
  return { walls, paint };
}

function stampShells(
  outline: OutlineMask,
  rng: SeededRandom,
  seeds: readonly RuinCell[],
  wantMin: number,
  wantMax: number,
  gapiness: number,
) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  for (const seed of seeds) {
    const blob = growBlob(land, cols, rows, seed, rng.nextInt(wantMin, wantMax), rng);
    stamp(walls, punchGaps(shellOf(blob), gapCount(gapiness), gapLen(gapiness), rng), cols);
    for (const cell of blob) {
      if (!walls[at(cols, cell.col, cell.row)]) paint.push({ col: cell.col, row: cell.row, role: 'interior' });
    }
    paint.push(...raiseNear(land, walls, cols, rows, blob, 1));
  }
  return { walls, paint };
}

function buildHunks(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const n = 2 + ((spec.density * 3) | 0);
  const seeds = pickLand(outline.land, outline.cols, outline.rows, rng, n, 10);
  return stampShells(outline, rng, seeds, 24, 48, spec.gapiness);
}

function buildRim(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const n = 4 + ((spec.density * 2) | 0);
  const seeds = pickLand(land, cols, rows, rng, n, 7, (c) => nearVoid(land, cols, rows, c.col, c.row));
  return stampShells(outline, rng, seeds, 14, 24, spec.gapiness);
}

function buildOrthoRidge(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  return buildRidge(outline, rng, { ...spec, align: 'ortho', thickness: 1 });
}

function buildTwinRidge(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const { a, b, horiz } = pairEnds(outline, rng, 'ortho');
  if (!a || !b) return { walls, paint };
  const spine = walkOrtho(land, cols, rows, a, b, rng);
  const off = rng.nextInt(2, 3);
  const spine2: RuinCell[] = [];
  for (const cell of spine) {
    const col = horiz ? cell.col : cell.col + off;
    const row = horiz ? cell.row + off : cell.row;
    if (isLand(land, cols, rows, col, row)) spine2.push({ col, row });
  }
  const g = Math.min(2, gapCount(spec.gapiness));
  const gl = 2;
  stamp(walls, punchGaps(thicken(spine, land, cols, rows, 0), g, gl, rng), cols);
  stamp(walls, punchGaps(thicken(spine2, land, cols, rows, 0), g, gl, rng), cols);
  paint.push(...raiseNear(land, walls, cols, rows, spine.concat(spine2), 1));
  return { walls, paint };
}

function buildPlates(outline: OutlineMask, rng: SeededRandom, spec: StructureBuildSpec) {
  const { land, cols, rows } = outline;
  const box = landBBox(land, cols, rows);
  const walls = new Uint8Array(land.length);
  const paint: RuinPaintCell[] = [];
  const horiz = box.width >= box.height;
  const n = 5 + (spec.density > 0.6 ? 1 : 0);
  const thick = spec.thickness;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1);
    const cells: RuinCell[] = [];
    if (horiz) {
      const row = box.minR + ((box.height * t) | 0);
      const len = rng.nextInt(8, 14);
      const start = box.minC + rng.nextInt(1, Math.max(1, box.width - len - 1));
      for (let k = 0; k < len; k++) {
        for (let w = 0; w < thick; w++) {
          const col = start + k;
          const r = row + w;
          if (isLand(land, cols, rows, col, r)) cells.push({ col, row: r });
        }
      }
    } else {
      const col = box.minC + ((box.width * t) | 0);
      const len = rng.nextInt(8, 14);
      const start = box.minR + rng.nextInt(1, Math.max(1, box.height - len - 1));
      for (let k = 0; k < len; k++) {
        for (let w = 0; w < thick; w++) {
          const c = col + w;
          const row = start + k;
          if (isLand(land, cols, rows, c, row)) cells.push({ col: c, row });
        }
      }
    }
    stamp(walls, punchGaps(cells, 1, 2, rng), cols);
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
  const want = 5 + (spec.density > 0.55 ? 1 : 0);
  const placed: RuinCell[] = [];
  let guard = 0;
  while (placed.length < want && guard++ < 500) {
    const w = rng.nextInt(6, 8);
    const h = rng.nextInt(5, 7);
    const seed = pickLand(land, cols, rows, rng, 1, 1)[0];
    if (!seed) break;
    const minC = seed.col - ((w / 2) | 0);
    const minR = seed.row - ((h / 2) | 0);
    if (landInRect(land, cols, rows, minC, minR, w, h) < w * h * 0.72) continue;
    if (placed.some((p) => Math.abs(p.col - seed.col) + Math.abs(p.row - seed.row) < 8)) continue;
    placed.push(seed);
    const open = rng.nextInt(0, 3);
    const cells: RuinCell[] = [];
    for (let row = minR; row < minR + h; row++) {
      for (let col = minC; col < minC + w; col++) {
        if (!isLand(land, cols, rows, col, row)) continue;
        const onN = row === minR;
        const onS = row === minR + h - 1;
        const onW = col === minC;
        const onE = col === minC + w - 1;
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
