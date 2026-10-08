/**
 * Layer 1b: stealth cover + biological stamps.
 * Stubs / clumps / plates, plus trees, remains, and void hollows.
 * Never seals a room. Never splits walkable land.
 */

import { countWalkableComponents } from '@/generation/connectivity';
import { maxOpenYardRect } from '@/generation/masses';
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

const WALL_RATIO_CAP = 0.18;

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

function clumpCells(seed: RuinCell, rng: SeededRandom): RuinCell[] {
  const w = rng.nextInt(2, 3);
  const h = rng.nextInt(2, 3);
  const cells: RuinCell[] = [];
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) cells.push({ col: seed.col + dx, row: seed.row + dy });
  }
  return cells;
}

function wallNormal(
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): { dx: number; dy: number } | null {
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds(cols, rows, nc, nr)) continue;
    if (walls[at(cols, nc, nr)]) return { dx, dy };
  }
  return null;
}

function pickAbutting(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
  used: readonly RuinCell[],
  minDist: number,
): RuinCell | null {
  const candidates: RuinCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor(land, walls, cols, rows, col, row)) continue;
      if (!wallNormal(walls, cols, rows, col, row)) continue;
      if (used.some((p) => Math.abs(p.col - col) + Math.abs(p.row - row) < minDist)) continue;
      candidates.push({ col, row });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[rng.nextInt(0, candidates.length - 1)]!;
}

function abutMass(
  kind: CoverCut,
  seed: RuinCell,
  walls: Uint8Array,
  cols: number,
  rows: number,
  rng: SeededRandom,
): RuinCell[] {
  const n = wallNormal(walls, cols, rows, seed.col, seed.row);
  if (kind === 'clump' || !n) return clumpCells(seed, rng);
  const alongX = n.dy !== 0;
  const long = rng.nextInt(4, 6);
  const cells: RuinCell[] = [];
  for (let a = 0; a < long; a++) {
    for (let t = 0; t < 2; t++) {
      const col = alongX ? seed.col + a : seed.col - n.dx * t;
      const row = alongX ? seed.row - n.dy * t : seed.row + a;
      cells.push({ col, row });
    }
  }
  return cells;
}

function remainsCells(seed: RuinCell, rng: SeededRandom): RuinCell[] {
  return clumpCells(seed, rng).slice(0, rng.nextInt(3, 4));
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
  const nearWall = wallNormal(walls, cols, rows, seed.col, seed.row) ? 20 : 0;
  return (inYard ? 8 : 0) + nearWall + voidDist(land, cols, rows, seed.col, seed.row);
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
    const seed =
      pickAbutting(land, walls, cols, rows, rng, used, 6) ??
      pickFloor(land, walls, cols, rows, rng, used, 7, false);
    if (!seed) break;
    place(remainsCells(seed, rng), 'wreck', 1);
  }

  for (let h = 0; h < spec.hollows; h++) {
    let placed = false;
    for (let tryN = 0; tryN < 24 && !placed; tryN++) {
      const seed = pickFloor(land, walls, cols, rows, rng, used, 8, false);
      if (!seed) break;
      if (voidDist(land, cols, rows, seed.col, seed.row) < 3) continue;
      const cells = hollowCells(land, walls, cols, rows, seed, rng);
      if (tryPunchLand(land, walls, cols, rows, cells, reserved)) {
        used.push(seed);
        placed = true;
      }
    }
  }

  const cycle = spec.cycle.length > 0 ? spec.cycle : (['clump', 'plate'] as const);
  const cutN = Math.min(spec.cuts, 4);
  for (let c = 0; c < cutN; c++) {
    const landN = landCount(land);
    const ratio = landN === 0 ? 0 : wallCount(walls) / landN;
    if (ratio >= WALL_RATIO_CAP) break;
    const kind = cycle[c % cycle.length]! === 'stub' ? 'clump' : cycle[c % cycle.length]!;
    const seed = pickAbutting(land, walls, cols, rows, rng, used, 5);
    if (!seed) break;
    const cells = abutMass(kind, seed, walls, cols, rows, rng);
    if (place(cells, null, 0)) continue;
    place(clumpCells(seed, rng), null, 0);
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
