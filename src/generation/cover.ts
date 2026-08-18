/**
 * Layer 1b: stealth cover + biological stamps.
 * Stubs / clumps / plates, plus trees, remains, and void hollows.
 * Never seals a room. Never splits walkable land.
 */

import { countWalkableComponents } from '@/generation/connectivity';
import { maxOpenYard, maxOpenYardRect } from '@/generation/masses';
import type { RuinCell, RuinPaintCell } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

export type CoverAlign = 'free' | 'ortho';
export type CoverCut = 'stub' | 'clump' | 'plate';

export interface CoverSpec {
  readonly align: CoverAlign;
  readonly trees: number;
  readonly remains: number;
  readonly hollows: number;
  readonly cuts: number;
  readonly cycle: readonly CoverCut[];
}

const YARD_TARGET = 48;
const SIGHT_TARGET = 10;
const WALL_RATIO_CAP = 0.22;

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function isFloor(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): boolean {
  if (!inBounds(cols, rows, col, row)) return false;
  const i = at(cols, col, row);
  return !!land[i] && !walls[i];
}

function exteriorVoidMask(land: Uint8Array, cols: number, rows: number): Uint8Array {
  const ext = new Uint8Array(land.length);
  const stack: number[] = [];
  const mark = (i: number): void => {
    if (i < 0 || i >= land.length || land[i] || ext[i]) return;
    ext[i] = 1;
    stack.push(i);
  };
  for (let col = 0; col < cols; col++) {
    mark(at(cols, col, 0));
    mark(at(cols, col, rows - 1));
  }
  for (let row = 0; row < rows; row++) {
    mark(at(cols, 0, row));
    mark(at(cols, cols - 1, row));
  }
  while (stack.length > 0) {
    const i = stack.pop()!;
    const col = i % cols;
    const row = (i / cols) | 0;
    if (col > 0) mark(i - 1);
    if (col < cols - 1) mark(i + 1);
    if (row > 0) mark(i - cols);
    if (row < rows - 1) mark(i + cols);
  }
  return ext;
}

function continuesSight(walls: Uint8Array, exterior: Uint8Array, i: number): boolean {
  return !walls[i] && !exterior[i];
}

function perpSpan(
  walls: Uint8Array,
  exterior: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  horizontalRun: boolean,
): number {
  let n = 0;
  if (horizontalRun) {
    let r = row;
    while (r >= 0 && continuesSight(walls, exterior, at(cols, col, r))) r--;
    for (r = r + 1; r < rows; r++) {
      if (!continuesSight(walls, exterior, at(cols, col, r))) break;
      n++;
    }
  } else {
    let c = col;
    while (c >= 0 && continuesSight(walls, exterior, at(cols, c, row))) c--;
    for (c = c + 1; c < cols; c++) {
      if (!continuesSight(walls, exterior, at(cols, c, row))) break;
      n++;
    }
  }
  return n;
}

function isOpenSightCell(
  walls: Uint8Array,
  exterior: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  horizontalRun: boolean,
): boolean {
  if (!continuesSight(walls, exterior, at(cols, col, row))) return false;
  return perpSpan(walls, exterior, cols, rows, col, row, horizontalRun) >= 2;
}

interface SightRun {
  readonly horizontal: boolean;
  readonly col: number;
  readonly row: number;
  readonly length: number;
}

function longestOpenSightRun(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): SightRun {
  const exterior = exteriorVoidMask(land, cols, rows);
  let best: SightRun = { horizontal: true, col: 0, row: 0, length: 0 };
  for (let row = 0; row < rows; row++) {
    let run = 0;
    let start = 0;
    for (let col = 0; col <= cols; col++) {
      const open =
        col < cols && isOpenSightCell(walls, exterior, cols, rows, col, row, true);
      if (open) {
        if (run === 0) start = col;
        run++;
        if (run > best.length) best = { horizontal: true, col: start, row, length: run };
      } else run = 0;
    }
  }
  for (let col = 0; col < cols; col++) {
    let run = 0;
    let start = 0;
    for (let row = 0; row <= rows; row++) {
      const open =
        row < rows && isOpenSightCell(walls, exterior, cols, rows, col, row, false);
      if (open) {
        if (run === 0) start = row;
        run++;
        if (run > best.length) best = { horizontal: false, col, row: start, length: run };
      } else run = 0;
    }
  }
  return best;
}

export function maxClearSightline(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  return longestOpenSightRun(land, walls, cols, rows).length;
}

function landCount(land: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < land.length; i++) if (land[i]) n++;
  return n;
}

function wallCount(walls: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < walls.length; i++) if (walls[i]) n++;
  return n;
}

function voidDist(land: Uint8Array, cols: number, rows: number, col: number, row: number): number {
  let best = cols + rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (land[at(cols, c, r)]) continue;
      const d = Math.abs(c - col) + Math.abs(r - row);
      if (d < best) best = d;
    }
  }
  return best;
}

function abutsReservedWall(
  walls: Uint8Array,
  reserved: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): boolean {
  for (const [dx, dy] of ROOT_DIRS) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds(cols, rows, nc, nr)) continue;
    const i = at(cols, nc, nr);
    if (reserved[i] && walls[i]) return true;
  }
  return false;
}

function tryAddWalls(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  cells: readonly RuinCell[],
  avoid?: Uint8Array,
): boolean {
  if (cells.length === 0) return false;
  const trial = new Uint8Array(walls);
  let stamped = 0;
  for (const cell of cells) {
    if (!isFloor(land, walls, cols, rows, cell.col, cell.row)) continue;
    const i = at(cols, cell.col, cell.row);
    if (avoid && avoid[i]) continue;
    if (avoid && abutsReservedWall(walls, avoid, cols, rows, cell.col, cell.row)) continue;
    trial[i] = 1;
    stamped++;
  }
  if (stamped === 0) return false;
  if (countWalkableComponents(land, trial, cols, rows) !== 1) return false;
  walls.set(trial);
  return true;
}

function tryPunchLand(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  cells: readonly RuinCell[],
  avoid?: Uint8Array,
): boolean {
  if (cells.length === 0) return false;
  const trialLand = new Uint8Array(land);
  const trialWalls = new Uint8Array(walls);
  for (const cell of cells) {
    const i = at(cols, cell.col, cell.row);
    if (!land[i]) return false;
    if (avoid && avoid[i]) return false;
    trialLand[i] = 0;
    trialWalls[i] = 0;
  }
  const empty = new Uint8Array(land.length);
  if (countWalkableComponents(trialLand, empty, cols, rows) !== 1) return false;
  if (countWalkableComponents(trialLand, trialWalls, cols, rows) !== 1) return false;
  land.set(trialLand);
  walls.set(trialWalls);
  return true;
}

function paintAround(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  near: readonly RuinCell[],
  role: RuinPaintCell['role'],
  radius: number,
): RuinPaintCell[] {
  const paint: RuinPaintCell[] = [];
  const seen = new Set<number>();
  for (const cell of near) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const col = cell.col + dx;
        const row = cell.row + dy;
        if (!isFloor(land, walls, cols, rows, col, row)) continue;
        const i = at(cols, col, row);
        if (seen.has(i)) continue;
        seen.add(i);
        paint.push({ col, row, role });
      }
    }
  }
  return paint;
}

function pickFloor(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
  used: readonly RuinCell[],
  minDist: number,
  preferOpen: boolean,
): RuinCell | null {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const candidates: RuinCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < minDist)) continue;
      if (preferOpen) {
        const inYard =
          col >= yard.col &&
          col < yard.col + yard.width &&
          row >= yard.row &&
          row < yard.row + yard.height;
        if (!inYard && yard.area > 8) continue;
      }
      candidates.push({ col, row });
    }
  }
  if (candidates.length === 0) {
    if (preferOpen) return pickFloor(land, walls, cols, rows, rng, used, minDist, false);
    return null;
  }
  return candidates[rng.nextInt(0, candidates.length - 1)]!;
}

function stubCells(seed: RuinCell, align: CoverAlign, rng: SeededRandom): RuinCell[] {
  const len = rng.nextInt(3, 5);
  const horiz = align === 'ortho' ? rng.next() < 0.5 : rng.next() < 0.5;
  const turn = align === 'ortho' && rng.next() < 0.4;
  const cells: RuinCell[] = [];
  let col = seed.col;
  let row = seed.row;
  let h = horiz;
  for (let k = 0; k < len; k++) {
    cells.push({ col, row });
    if (turn && k === ((len / 2) | 0)) h = !h;
    if (h) col += 1;
    else row += 1;
  }
  return cells;
}

function clumpCells(seed: RuinCell, rng: SeededRandom): RuinCell[] {
  const w = rng.nextInt(2, 3);
  const h = rng.nextInt(2, 3);
  const cells: RuinCell[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) cells.push({ col: seed.col + dx, row: seed.row + dy });
  }
  return cells;
}

function plateCells(seed: RuinCell, align: CoverAlign, rng: SeededRandom): RuinCell[] {
  const long = rng.nextInt(3, 6);
  const thick = rng.nextInt(1, 2);
  const horiz = align === 'ortho' ? rng.next() < 0.5 : rng.next() < 0.55;
  const cells: RuinCell[] = [];
  for (let a = 0; a < long; a++) {
    for (let t = 0; t < thick; t++) {
      cells.push(horiz ? { col: seed.col + a, row: seed.row + t } : { col: seed.col + t, row: seed.row + a });
    }
  }
  return cells;
}

function bisectYard(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  kind: CoverCut,
  slot: number,
): RuinCell[] {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  if (yard.area < 9) return [];
  const frac = 0.3 + (slot % 3) * 0.2;
  const cx = yard.col + Math.max(0, Math.min(yard.width - 1, (yard.width * frac) | 0));
  const cy = yard.row + Math.max(0, Math.min(yard.height - 1, (yard.height * frac) | 0));
  const wide = yard.width >= yard.height;
  const useClump = kind === 'clump' && yard.area <= 64;
  if (useClump) {
    return [
      { col: cx, row: cy },
      { col: cx + 1, row: cy },
      { col: cx, row: cy + 1 },
      { col: cx + 1, row: cy + 1 },
    ];
  }
  const vertical = wide;
  const gap = 1 + (slot % 2);
  const span = vertical ? Math.max(2, yard.height - gap) : Math.max(2, yard.width - gap);
  const thick = kind === 'plate' ? 2 : 1;
  const cells: RuinCell[] = [];
  for (let a = 0; a < span; a++) {
    for (let t = 0; t < thick; t++) {
      cells.push(
        vertical
          ? { col: cx + t, row: yard.row + a }
          : { col: yard.col + a, row: cy + t },
      );
    }
  }
  return cells;
}

function floorCellsOnRun(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  run: SightRun,
): RuinCell[] {
  const out: RuinCell[] = [];
  for (let k = 0; k < run.length; k++) {
    const cell = run.horizontal
      ? { col: run.col + k, row: run.row }
      : { col: run.col, row: run.row + k };
    if (isFloor(land, walls, cols, rows, cell.col, cell.row)) out.push(cell);
  }
  return out;
}

function bisectSightline(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  kind: CoverCut,
  slot: number,
  rng: SeededRandom,
): RuinCell[] {
  const run = longestOpenSightRun(land, walls, cols, rows);
  if (run.length < 5) return [];
  const floors = floorCellsOnRun(land, walls, cols, rows, run);
  if (floors.length === 0) return [];
  const exterior = exteriorVoidMask(land, cols, rows);
  const seed = floors[Math.max(0, Math.min(floors.length - 1, ((floors.length * (0.35 + (slot % 3) * 0.15)) | 0)))]!;
  const width = perpSpan(walls, exterior, cols, rows, seed.col, seed.row, run.horizontal);
  const keepGap = Math.max(1, width - 1);
  if (kind === 'clump' && keepGap >= 2 && run.length <= 12) return clumpCells(seed, rng);
  const along = Math.min(keepGap, kind === 'plate' ? 6 : 5);
  const cells: RuinCell[] = [];
  for (let a = 0; a < along; a++) {
    cells.push(
      run.horizontal
        ? { col: seed.col, row: seed.row - ((along / 2) | 0) + a }
        : { col: seed.col - ((along / 2) | 0) + a, row: seed.row },
    );
  }
  if (kind === 'plate' && keepGap >= 3) {
    for (let a = 0; a < along; a++) {
      cells.push(
        run.horizontal
          ? { col: seed.col + 1, row: seed.row - ((along / 2) | 0) + a }
          : { col: seed.col - ((along / 2) | 0) + a, row: seed.row + 1 },
      );
    }
  }
  return cells.length > 0 ? cells : [seed];
}

function remainsCells(seed: RuinCell, align: CoverAlign, rng: SeededRandom): RuinCell[] {
  if (rng.next() < 0.55) return clumpCells(seed, rng).slice(0, rng.nextInt(2, 4));
  return stubCells(seed, align, rng).slice(0, rng.nextInt(3, 4));
}

const ROOT_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function boleCells(seed: RuinCell): RuinCell[] {
  return [
    { col: seed.col, row: seed.row },
    { col: seed.col + 1, row: seed.row },
    { col: seed.col, row: seed.row + 1 },
    { col: seed.col + 1, row: seed.row + 1 },
  ];
}

function canPlaceBole(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
  clearRing: boolean,
): boolean {
  const bole = boleCells(seed);
  for (const cell of bole) {
    if (!isFloor(land, walls, cols, rows, cell.col, cell.row)) return false;
  }
  const mine = new Set(bole.map((c) => `${c.col},${c.row}`));
  for (const cell of bole) {
    if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return false;
  }
  if (!clearRing) return true;
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const col = seed.col + dx;
      const row = seed.row + dy;
      if (!inBounds(cols, rows, col, row)) continue;
      if (walls[at(cols, col, row)]) return false;
    }
  }
  return true;
}

function growRoots(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
  rng: SeededRandom,
): RuinCell[] {
  const order = [...ROOT_DIRS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    const tmp = order[i]!;
    order[i] = order[j]!;
    order[j] = tmp;
  }
  const rootN = rng.nextInt(3, 4);
  const seen = new Set(boleCells(seed).map((c) => `${c.col},${c.row}`));
  const roots: RuinCell[] = [];
  for (let r = 0; r < rootN; r++) {
    const [dx, dy] = order[r]!;
    const len = rng.nextInt(2, 4);
    let col = dx > 0 ? seed.col + 1 : dx < 0 ? seed.col : seed.col + (rng.next() < 0.5 ? 0 : 1);
    let row = dy > 0 ? seed.row + 1 : dy < 0 ? seed.row : seed.row + (rng.next() < 0.5 ? 0 : 1);
    const arm: RuinCell[] = [];
    for (let k = 0; k < len; k++) {
      col += dx;
      row += dy;
      if (!isFloor(land, walls, cols, rows, col, row)) break;
      if (touchesForeignWall(walls, cols, rows, col, row, seen)) break;
      const key = `${col},${row}`;
      if (seen.has(key) || arm.some((c) => `${c.col},${c.row}` === key)) continue;
      arm.push({ col, row });
    }
    if (arm.length < 2) continue;
    for (const cell of arm) {
      seen.add(`${cell.col},${cell.row}`);
      roots.push(cell);
    }
  }
  return roots;
}

function growStump(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
  clearRing: boolean,
  rng: SeededRandom,
): { bole: RuinCell[]; roots: RuinCell[] } | null {
  if (!canPlaceBole(land, walls, cols, rows, seed, clearRing)) return null;
  const bole = boleCells(seed);
  const roots = growRoots(land, walls, cols, rows, seed, rng);
  const mine = new Set([...bole, ...roots].map((c) => `${c.col},${c.row}`));
  for (const cell of [...bole, ...roots]) {
    if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return { bole, roots: [] };
  }
  return { bole, roots };
}

function touchesForeignWall(
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
  mine: ReadonlySet<string>,
): boolean {
  for (const [dx, dy] of ROOT_DIRS) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds(cols, rows, nc, nr)) continue;
    if (!walls[at(cols, nc, nr)]) continue;
    if (!mine.has(`${nc},${nr}`)) return true;
  }
  return false;
}

function markStumpReserve(
  reserved: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
  cells: readonly RuinCell[],
): void {
  const stamp = (col: number, row: number): void => {
    if (!inBounds(cols, rows, col, row)) return;
    reserved[at(cols, col, row)] = 1;
  };
  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) stamp(seed.col + dx, seed.row + dy);
  }
  for (const cell of cells) {
    stamp(cell.col, cell.row);
    stamp(cell.col + 1, cell.row);
    stamp(cell.col - 1, cell.row);
    stamp(cell.col, cell.row + 1);
    stamp(cell.col, cell.row - 1);
  }
}

function collectStumpSites(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  used: readonly RuinCell[],
  blocked: readonly RuinCell[],
  clearRing: boolean,
): RuinCell[] {
  const seeds: RuinCell[] = [];
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < 10)) continue;
      if (blocked.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < 2)) continue;
      const seed = { col, row };
      if (!canPlaceBole(land, walls, cols, rows, seed, clearRing)) continue;
      seeds.push(seed);
    }
  }
  return seeds;
}

function scoreStumpSite(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
): number {
  const yard = maxOpenYardRect(land, walls, cols, rows);
  const inYard =
    seed.col >= yard.col &&
    seed.col < yard.col + yard.width &&
    seed.row >= yard.row &&
    seed.row < yard.row + yard.height;
  return (inYard ? 24 : 0) + voidDist(land, cols, rows, seed.col, seed.row);
}

function pickStumpSite(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  used: readonly RuinCell[],
  blocked: readonly RuinCell[],
  rng: SeededRandom,
): { seed: RuinCell; bole: RuinCell[]; roots: RuinCell[] } | null {
  for (const clearRing of [true, false]) {
    const sites = collectStumpSites(land, walls, cols, rows, used, blocked, clearRing);
    if (sites.length === 0) continue;
    const ranked = sites
      .map((seed) => ({ seed, score: scoreStumpSite(land, walls, cols, rows, seed) }))
      .sort((a, b) => b.score - a.score);
    const cut = Math.max(1, (ranked.length * 0.4) | 0);
    const pool = ranked.slice(0, cut);
    const seed = pool[rng.nextInt(0, pool.length - 1)]!.seed;
    const grown = growStump(land, walls, cols, rows, seed, clearRing, rng);
    if (grown) return { seed, bole: grown.bole, roots: grown.roots };
  }
  return null;
}

function hollowCells(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  seed: RuinCell,
  rng: SeededRandom,
): RuinCell[] {
  const rad = rng.nextInt(1, 2);
  const cells: RuinCell[] = [];
  for (let dy = -rad; dy <= rad; dy++) {
    for (let dx = -rad; dx <= rad; dx++) {
      if (dx * dx + dy * dy > rad * rad + 1) continue;
      const col = seed.col + dx;
      const row = seed.row + dy;
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      cells.push({ col, row });
    }
  }
  return cells;
}

export function applyCover(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  spec: CoverSpec,
  rng: SeededRandom,
): RuinPaintCell[] {
  const paint: RuinPaintCell[] = [];
  const used: RuinCell[] = [];
  const reserved = new Uint8Array(land.length);

  const place = (cells: RuinCell[], around: RuinPaintCell['role'] | null, radius: number): boolean => {
    if (!tryAddWalls(land, walls, cols, rows, cells, reserved)) return false;
    used.push(cells[0]!);
    if (around) paint.push(...paintAround(land, walls, cols, rows, cells, around, radius));
    return true;
  };

  const blocked: RuinCell[] = [];
  for (let t = 0; t < spec.trees; t++) {
    let placed = false;
    for (let tryN = 0; tryN < 20 && !placed; tryN++) {
      const site = pickStumpSite(land, walls, cols, rows, used, blocked, rng);
      if (!site) break;
      const withRoots = site.bole.concat(site.roots);
      const cells = tryAddWalls(land, walls, cols, rows, withRoots, reserved)
        ? withRoots
        : tryAddWalls(land, walls, cols, rows, site.bole, reserved)
          ? site.bole
          : null;
      if (!cells) {
        blocked.push(site.seed);
        continue;
      }
      used.push(site.seed);
      markStumpReserve(reserved, cols, rows, site.seed, cells);
      for (const cell of site.bole) {
        const i = at(cols, cell.col, cell.row);
        if (land[i] && walls[i]) paint.push({ col: cell.col, row: cell.row, role: 'stump' });
      }
      if (cells.length > site.bole.length) {
        for (const cell of site.roots) {
          const i = at(cols, cell.col, cell.row);
          if (land[i] && walls[i]) paint.push({ col: cell.col, row: cell.row, role: 'root' });
        }
      }
      placed = true;
    }
  }

  for (let r = 0; r < spec.remains; r++) {
    const seed = pickFloor(land, walls, cols, rows, rng, used, 7, true);
    if (!seed) break;
    place(remainsCells(seed, spec.align, rng), 'wreck', 1);
  }

  for (let h = 0; h < spec.hollows; h++) {
    let placed = false;
    for (let tryN = 0; tryN < 24 && !placed; tryN++) {
      const seed = pickFloor(land, walls, cols, rows, rng, used, 8, true);
      if (!seed) break;
      if (voidDist(land, cols, rows, seed.col, seed.row) < 3) continue;
      const cells = hollowCells(land, walls, cols, rows, seed, rng);
      if (tryPunchLand(land, walls, cols, rows, cells, reserved)) {
        used.push(seed);
        placed = true;
      }
    }
  }

  const cycle = spec.cycle.length > 0 ? spec.cycle : (['clump', 'stub'] as const);
  const checkYard = 80;
  const checkSight = 14;
  for (let c = 0; c < spec.cuts; c++) {
    const landN = landCount(land);
    const ratio = landN === 0 ? 0 : wallCount(walls) / landN;
    const yard = maxOpenYard(land, walls, cols, rows);
    const sight = maxClearSightline(land, walls, cols, rows);
    if (yard <= YARD_TARGET && sight <= SIGHT_TARGET) break;
    if (ratio >= WALL_RATIO_CAP && yard <= checkYard && sight <= checkSight) break;
    const kind = cycle[c % cycle.length]!;
    const preferSight = sight > checkSight && (sight * 2 >= yard || yard <= checkYard);
    const cells = preferSight
      ? bisectSightline(land, walls, cols, rows, kind, c, rng)
      : bisectYard(land, walls, cols, rows, kind, c);
    if (place(cells, null, 0)) continue;
    const run = longestOpenSightRun(land, walls, cols, rows);
    const floors = floorCellsOnRun(land, walls, cols, rows, run);
    if (floors.length > 0 && run.length > checkSight) {
      const nib = floors[(floors.length / 2) | 0]!;
      if (place([nib], null, 0)) continue;
    }
    const seed = pickFloor(land, walls, cols, rows, rng, used, 4, true);
    if (!seed) continue;
    const fallback =
      kind === 'plate'
        ? plateCells(seed, spec.align, rng)
        : kind === 'clump'
          ? clumpCells(seed, rng)
          : stubCells(seed, spec.align, rng);
    if (place(fallback, null, 0)) continue;
    if (yard > checkYard) {
      const hole = hollowCells(land, walls, cols, rows, seed, rng);
      if (tryPunchLand(land, walls, cols, rows, hole, reserved)) used.push(seed);
    }
  }

  for (let extra = 0; extra < 16; extra++) {
    const sight = maxClearSightline(land, walls, cols, rows);
    const yard = maxOpenYard(land, walls, cols, rows);
    if (sight <= checkSight && yard <= checkYard) break;
    const run = longestOpenSightRun(land, walls, cols, rows);
    const floors = floorCellsOnRun(land, walls, cols, rows, run);
    if (floors.length === 0) break;
    const nib = floors[(extra * 3 + ((floors.length / 2) | 0)) % floors.length]!;
    const cells = bisectSightline(land, walls, cols, rows, 'stub', extra, rng);
    if (place(cells, null, 0)) continue;
    if (place([nib], null, 0)) continue;
    if (yard > checkYard) {
      const hole = hollowCells(land, walls, cols, rows, nib, rng);
      tryPunchLand(land, walls, cols, rows, hole, reserved);
    }
  }

  return paint;
}

export function stumpTouchesStone(
  walls: Uint8Array,
  cols: number,
  rows: number,
  paint: readonly RuinPaintCell[],
): boolean {
  const wood = paint.filter((c) => c.role === 'stump' || c.role === 'root');
  const mine = new Set(wood.map((c) => `${c.col},${c.row}`));
  for (const cell of wood) {
    if (touchesForeignWall(walls, cols, rows, cell.col, cell.row, mine)) return true;
  }
  return false;
}

export function countBoles(
  paint: readonly RuinPaintCell[],
  walls?: Uint8Array,
  cols?: number,
): number {
  const stumps = paint.filter((c) => {
    if (c.role !== 'stump') return false;
    if (!walls || cols === undefined) return true;
    return !!walls[c.row * cols + c.col];
  });
  let n = 0;
  const seen = new Set<string>();
  for (const cell of stumps) {
    for (const [ox, oy] of [
      [0, 0],
      [-1, 0],
      [0, -1],
      [-1, -1],
    ] as const) {
      const c0 = cell.col + ox;
      const r0 = cell.row + oy;
      const key = `${c0},${r0}`;
      if (seen.has(key)) continue;
      const has = (dc: number, dr: number): boolean =>
        stumps.some((c) => c.col === c0 + dc && c.row === r0 + dr);
      if (has(0, 0) && has(1, 0) && has(0, 1) && has(1, 1)) {
        seen.add(key);
        n++;
      }
    }
  }
  return n;
}
