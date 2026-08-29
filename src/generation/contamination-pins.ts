/**
 * Contamination lexicon pin layers (DEC-076). Pure. Does not change collision.
 * Wall-after-floor four-connected count must stay 1; these only read the grid.
 */

import type {
  ContaminationPins,
  PaintFloorPin,
  WallEdgePolyline,
  CorridorAabb,
} from '@/generation/types';
import { TileType } from '@/types/game-types';
import type { KindlingTier, TileMapData } from '@/types/map-types';

export type { ContaminationPins, CorridorAabb, PaintFloorPin, WallEdgePolyline } from '@/generation/types';

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function isFloor(map: TileMapData, col: number, row: number): boolean {
  return map.tiles[row]?.[col] === TileType.FLOOR;
}

function isWall(map: TileMapData, col: number, row: number): boolean {
  return map.tiles[row]?.[col] === TileType.WALL;
}

function collectWallEdges(map: TileMapData): WallEdgePolyline[] {
  const { cols, rows } = map;
  const edge: number[] = [];
  const strike = new Map<number, Set<string>>();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isWall(map, col, row)) continue;
      const floors: { col: number; row: number }[] = [];
      for (const [dx, dy] of DIRS4) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds(cols, rows, nc, nr) || !isFloor(map, nc, nr)) continue;
        floors.push({ col: nc, row: nr });
      }
      if (floors.length === 0) continue;
      const i = at(cols, col, row);
      edge.push(i);
      const set = new Set<string>();
      for (const f of floors) set.add(`${f.col},${f.row}`);
      strike.set(i, set);
    }
  }

  const seen = new Set<number>();
  const lines: WallEdgePolyline[] = [];
  const edgeSet = new Set(edge);
  for (const start of edge) {
    if (seen.has(start)) continue;
    const stack = [start];
    seen.add(start);
    const tiles: { col: number; row: number }[] = [];
    const floors = new Set<string>();
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const col = cur % cols;
      const row = (cur / cols) | 0;
      tiles.push({ col, row });
      for (const key of strike.get(cur) ?? []) floors.add(key);
      for (const [dx, dy] of DIRS4) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds(cols, rows, nc, nr)) continue;
        const ni = at(cols, nc, nr);
        if (!edgeSet.has(ni) || seen.has(ni)) continue;
        seen.add(ni);
        stack.push(ni);
      }
    }
    if (tiles.length === 0 || floors.size === 0) continue;
    lines.push({
      tiles,
      strikeFloors: [...floors].map((key) => {
        const [c, r] = key.split(',');
        return { col: Number(c), row: Number(r) };
      }),
    });
  }
  lines.sort((a, b) => b.tiles.length - a.tiles.length);
  return lines;
}

function spanAlong(
  map: TileMapData,
  col: number,
  row: number,
  dx: number,
  dy: number,
): number {
  const { cols, rows } = map;
  let n = 0;
  let c = col + dx;
  let r = row + dy;
  while (inBounds(cols, rows, c, r) && isFloor(map, c, r) && n < 12) {
    n++;
    c += dx;
    r += dy;
  }
  return n;
}

function collectCorridors(map: TileMapData): CorridorAabb[] {
  const { cols, rows } = map;
  const tile = map.tileSize;
  const mark = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isFloor(map, col, row)) continue;
      const xSpan = 1 + spanAlong(map, col, row, 1, 0) + spanAlong(map, col, row, -1, 0);
      const ySpan = 1 + spanAlong(map, col, row, 0, 1) + spanAlong(map, col, row, 0, -1);
      if (Math.min(xSpan, ySpan) <= 4 && Math.max(xSpan, ySpan) >= 3) {
        mark[at(cols, col, row)] = 1;
      }
    }
  }

  const seen = new Uint8Array(cols * rows);
  const boxes: CorridorAabb[] = [];
  for (let i = 0; i < mark.length; i++) {
    if (!mark[i] || seen[i]) continue;
    const stack = [i];
    seen[i] = 1;
    let minCol = cols;
    let minRow = rows;
    let maxCol = 0;
    let maxRow = 0;
    let sumC = 0;
    let sumR = 0;
    let n = 0;
    const cells: number[] = [];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const col = cur % cols;
      const row = (cur / cols) | 0;
      cells.push(cur);
      n++;
      sumC += col;
      sumR += row;
      if (col < minCol) minCol = col;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;
      for (const [dx, dy] of DIRS4) {
        const nc = col + dx;
        const nr = row + dy;
        if (!inBounds(cols, rows, nc, nr)) continue;
        const ni = at(cols, nc, nr);
        if (!mark[ni] || seen[ni]) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (n < 6) continue;
    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    if (Math.min(width, height) > 5) continue;
    const cx = Math.round(sumC / n);
    const cy = Math.round(sumR / n);
    let core = at(cols, cx, cy);
    if (!mark[core]) core = cells[0]!;
    boxes.push({
      minCol,
      minRow,
      maxCol,
      maxRow,
      coreCol: core % cols,
      coreRow: (core / cols) | 0,
    });
  }
  boxes.sort((a, b) => {
    const aa = (a.maxCol - a.minCol + 1) * (a.maxRow - a.minRow + 1);
    const bb = (b.maxCol - b.minCol + 1) * (b.maxRow - b.minRow + 1);
    return bb - aa;
  });
  void tile;
  return boxes.slice(0, 8);
}

export interface PaintHostPinInput {
  readonly spawnCol: number;
  readonly spawnRow: number;
  readonly extractCol: number;
  readonly extractRow: number;
  readonly kindling: readonly { col: number; row: number; tier: KindlingTier }[];
  readonly paintCount: number;
}

export const PAINT_PINS_SHORT = 'paint pins short';

/** Chebyshev ≥6, or ≥5 when N≥9; then 4, then 3. Never clamp N. */
export function paintHostSpacingLadder(paintCount: number): readonly number[] {
  return paintCount >= 9 ? [5, 4, 3] : [6, 4, 3];
}

export function chebyshevCells(
  aCol: number,
  aRow: number,
  bCol: number,
  bRow: number,
): number {
  return Math.max(Math.abs(aCol - bCol), Math.abs(aRow - bRow));
}

function walkBits(map: TileMapData): Uint8Array {
  const { cols, rows } = map;
  const walk = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (isFloor(map, col, row)) walk[at(cols, col, row)] = 1;
    }
  }
  return walk;
}

function neighborWalkCount(walk: Uint8Array, cols: number, rows: number, col: number, row: number): number {
  let n = 0;
  for (const [dx, dy] of DIRS4) {
    const nc = col + dx;
    const nr = row + dy;
    if (!inBounds(cols, rows, nc, nr)) continue;
    if (walk[at(cols, nc, nr)]) n++;
  }
  return n;
}

function bfsFrom(
  walk: Uint8Array,
  cols: number,
  rows: number,
  start: number,
): { dist: Int16Array; parent: Int32Array } {
  const dist = new Int16Array(walk.length);
  const parent = new Int32Array(walk.length);
  dist.fill(-1);
  parent.fill(-1);
  if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
  const queue = [start];
  dist[start] = 0;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const col = cur % cols;
    const row = (cur / cols) | 0;
    const d = dist[cur]!;
    for (const [dx, dy] of DIRS4) {
      const nc = col + dx;
      const nr = row + dy;
      if (!inBounds(cols, rows, nc, nr)) continue;
      const ni = at(cols, nc, nr);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, parent };
}

function reconstructPath(parent: Int32Array, start: number, goal: number): number[] {
  if (goal < 0 || parent[goal] === undefined) return [];
  if (goal !== start && parent[goal] < 0) return [];
  const path: number[] = [];
  let cur = goal;
  while (cur >= 0) {
    path.push(cur);
    if (cur === start) break;
    cur = parent[cur]!;
  }
  if (path[path.length - 1] !== start) return [];
  path.reverse();
  return path;
}

function greedyKindlingCells(
  walk: Uint8Array,
  cols: number,
  rows: number,
  spawn: number,
  extract: number,
  kindling: readonly { col: number; row: number; tier: KindlingTier }[],
): Set<number> {
  const { parent } = bfsFrom(walk, cols, rows, spawn);
  const cells = new Set<number>();
  const take = (goal: number): void => {
    for (const cell of reconstructPath(parent, spawn, goal)) cells.add(cell);
  };
  take(extract);
  for (const node of kindling) {
    if (node.tier !== 'contested' && node.tier !== 'deep') continue;
    if (!inBounds(cols, rows, node.col, node.row)) continue;
    take(at(cols, node.col, node.row));
  }
  return cells;
}

function isBannedPaintSeat(
  col: number,
  row: number,
  spawnCol: number,
  spawnRow: number,
  extractCol: number,
  extractRow: number,
  kindlingCells: ReadonlySet<number>,
  cols: number,
): boolean {
  if (chebyshevCells(col, row, spawnCol, spawnRow) <= 3) return true;
  if (chebyshevCells(col, row, extractCol, extractRow) <= 3) return true;
  return kindlingCells.has(at(cols, col, row));
}

interface RankedSeat {
  readonly cell: number;
  readonly col: number;
  readonly row: number;
  readonly onGreedy: boolean;
  readonly throatScore: number;
  readonly neighbors: number;
  readonly dist: number;
}

function rankSeats(
  cells: Iterable<number>,
  walk: Uint8Array,
  cols: number,
  rows: number,
  greedy: ReadonlySet<number>,
  dist: Int16Array,
  banned: (col: number, row: number) => boolean,
): RankedSeat[] {
  const seats: RankedSeat[] = [];
  const seen = new Set<number>();
  for (const cell of cells) {
    if (seen.has(cell) || !walk[cell]) continue;
    seen.add(cell);
    const col = cell % cols;
    const row = (cell / cols) | 0;
    if (banned(col, row)) continue;
    const neighbors = neighborWalkCount(walk, cols, rows, col, row);
    seats.push({
      cell,
      col,
      row,
      onGreedy: greedy.has(cell),
      throatScore: 4 - neighbors,
      neighbors,
      dist: dist[cell]!,
    });
  }
  seats.sort((a, b) => {
    const throatA = a.neighbors === 2 ? 1 : 0;
    const throatB = b.neighbors === 2 ? 1 : 0;
    if (throatB !== throatA) return throatB - throatA;
    if (a.dist !== b.dist) return a.dist - b.dist;
    if (b.throatScore !== a.throatScore) return b.throatScore - a.throatScore;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  return seats;
}

function pickSpaced(seats: readonly RankedSeat[], count: number, minChebyshev: number): RankedSeat[] | null {
  const picked: RankedSeat[] = [];
  for (const seat of seats) {
    let ok = true;
    for (const other of picked) {
      if (chebyshevCells(seat.col, seat.row, other.col, other.row) < minChebyshev) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    picked.push(seat);
    if (picked.length === count) return picked;
  }
  return null;
}

function ringAround(cells: ReadonlySet<number>, walk: Uint8Array, cols: number, rows: number, radius: number): Set<number> {
  const out = new Set<number>();
  for (const cell of cells) {
    const col = cell % cols;
    const row = (cell / cols) | 0;
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) > radius) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (!inBounds(cols, rows, nc, nr)) continue;
        const ni = at(cols, nc, nr);
        if (walk[ni]) out.add(ni);
      }
    }
  }
  return out;
}

function reachableFloors(dist: Int16Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < dist.length; i++) if (dist[i]! >= 0) out.push(i);
  return out;
}

function toPins(seats: readonly RankedSeat[]): PaintFloorPin[] {
  return seats.map((seat) => ({
    floorCol: seat.col,
    floorRow: seat.row,
    onGreedy: seat.onGreedy,
    throatScore: seat.throatScore,
  }));
}

/**
 * Greedy kindling-path paint seats. Returns a fail string when the rolled N
 * cannot be placed; callers must retry the layout. Never clamps N down.
 */
export function placePaintFloorPins(
  map: TileMapData,
  input: PaintHostPinInput,
): PaintFloorPin[] | string {
  const n = input.paintCount;
  if (n <= 0) return [];
  const { cols, rows } = map;
  if (!inBounds(cols, rows, input.spawnCol, input.spawnRow)) {
    return `${PAINT_PINS_SHORT} (need ${n}, spawn out of bounds)`;
  }
  const walk = walkBits(map);
  const spawn = at(cols, input.spawnCol, input.spawnRow);
  const extract = at(cols, input.extractCol, input.extractRow);
  const { dist } = bfsFrom(walk, cols, rows, spawn);
  const greedy = greedyKindlingCells(walk, cols, rows, spawn, extract, input.kindling);
  const kindlingCells = new Set<number>();
  for (const node of input.kindling) {
    if (!inBounds(cols, rows, node.col, node.row)) continue;
    kindlingCells.add(at(cols, node.col, node.row));
  }
  const banned = (col: number, row: number): boolean =>
    isBannedPaintSeat(col, row, input.spawnCol, input.spawnRow, input.extractCol, input.extractRow, kindlingCells, cols);

  const pathSeats = rankSeats(greedy, walk, cols, rows, greedy, dist, banned);
  const ringSeats = rankSeats(ringAround(greedy, walk, cols, rows, 2), walk, cols, rows, greedy, dist, banned);
  const islandSeats = rankSeats(reachableFloors(dist), walk, cols, rows, greedy, dist, banned);
  const stages = [pathSeats, ringSeats, islandSeats];
  const spacings = paintHostSpacingLadder(n);

  for (const seats of stages) {
    for (const spacing of spacings) {
      const picked = pickSpaced(seats, n, spacing);
      if (picked) return toPins(picked);
    }
  }

  let best = 0;
  for (const seats of stages) {
    const trial = pickSpaced(seats, n, 3);
    if (trial) best = Math.max(best, trial.length);
    best = Math.max(best, Math.min(seats.length, n));
  }
  return `${PAINT_PINS_SHORT} (need ${n}, max placed ${best})`;
}

export function collectContaminationPins(
  map: TileMapData,
  paint: PaintHostPinInput,
): ContaminationPins | string {
  const paintFloors = placePaintFloorPins(map, paint);
  if (typeof paintFloors === 'string') return paintFloors;
  return {
    wallEdges: collectWallEdges(map),
    paintFloors,
    corridorAabbs: collectCorridors(map),
  };
}
