import { clearanceField } from './open-space';
import { canStandWorld } from './support';
import type { WorldSample } from './types';

const DIRECTIONS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
export const OPEN_SPACE_LIMITS = {
  broadFloorRatio: .56, multidirectionalRatio: .43, localOpenRatio: .18,
  coreCoverage: .985, maximumAlleyCells: 14,
} as const;

export interface SpaceQuality {
  readonly accepted: boolean;
  readonly failures: readonly string[];
  readonly floorCells: number;
  readonly voidFraction: number;
  readonly broadFloorRatio: number;
  readonly multidirectionalRatio: number;
  readonly worstLocalOpenRatio: number;
  readonly coreCoverage: number;
  readonly longestAlley: number;
  readonly bodyRoute: boolean;
}

function connected(mask: Uint8Array, cols: number, rows: number, start: number): { cells: number[]; parent: Int32Array } {
  const parent = new Int32Array(mask.length).fill(-1), cells: number[] = [];
  if (start < 0 || !mask[start]) return { cells, parent };
  cells.push(start); parent[start] = start;
  for (let head = 0; head < cells.length; head++) {
    const cell = cells[head]!, x = cell % cols, y = Math.floor(cell / cols);
    for (const [dx, dy] of CARDINAL) {
      const nx = x + dx, ny = y + dy, next = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || !mask[next] || parent[next] !== -1) continue;
      parent[next] = cell; cells.push(next);
    }
  }
  return { cells, parent };
}

/** Shared exact 20×20 body against the authoritative rendered support. */
export function openSpaceBodyFits(sample: WorldSample, x: number, y: number): boolean {
  return canStandWorld(sample, x, y);
}

/** Sweep a broad-core path, not merely its endpoints, against rendered geometry. */
function bodyRoute(sample: WorldSample, parent: Int32Array, start: number, goal: number): boolean {
  if (parent[goal] === -1) return false;
  const { cols, tileSize: tile } = sample;
  let cell = goal;
  while (cell !== start) {
    const previous = parent[cell]!;
    if (previous < 0 || previous === cell) return false;
    const x = (cell % cols + .5) * tile, y = (Math.floor(cell / cols) + .5) * tile;
    const px = (previous % cols + .5) * tile, py = (Math.floor(previous / cols) + .5) * tile;
    for (let offset = 0; offset <= tile; offset += 2) {
      if (!openSpaceBodyFits(sample, x + (px - x) * offset / tile, y + (py - y) * offset / tile)) return false;
    }
    cell = previous;
  }
  return openSpaceBodyFits(sample, sample.spawn.x, sample.spawn.y);
}

/** Runtime gate: a connected maze does not qualify as an open outdoor field. */
export function evaluateOpenSpace(sample: WorldSample): SpaceQuality {
  const { cols, rows, tileSize, land, walls } = sample, failures: string[] = [];
  const floor = Uint8Array.from(land, (value, i) => value && !walls[i] ? 1 : 0);
  const distance = clearanceField(floor, cols, rows), coast = clearanceField(land, cols, rows);
  const core = Uint8Array.from(floor, (value, i) => value && distance[i]! >= 3 ? 1 : 0);
  const open = new Uint8Array(floor.length), alley = new Uint8Array(floor.length);
  const start = Math.floor(sample.spawn.y / tileSize) * cols + Math.floor(sample.spawn.x / tileSize);
  const goal = Math.floor(sample.exit.y / tileSize) * cols + Math.floor(sample.exit.x / tileSize);
  let floorCells = 0, coreCells = 0, openCells = 0, landCells = 0;
  const ray = (x: number, y: number, dx: number, dy: number): { length: number; wall: boolean } => {
    for (let step = 1; step <= 12; step++) {
      const nx = x + dx * step, ny = y + dy * step, cell = ny * cols + nx;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return { length: step - 1, wall: false };
      if (!floor[cell]) return { length: step - 1, wall: walls[cell] === 1 };
    }
    return { length: 12, wall: false };
  };
  for (let cell = 0; cell < floor.length; cell++) {
    landCells += land[cell]!;
    if (!floor[cell]) continue;
    floorCells++; coreCells += core[cell]!;
    const x = cell % cols, y = Math.floor(cell / cols);
    let openAxes = 0, pinched = false, longAxis = false;
    for (const [dx, dy] of DIRECTIONS) {
      const left = ray(x, y, dx, dy), right = ray(x, y, -dx, -dy);
      // Opposite directions are one axis, not two independent escape options.
      if (left.length >= 4 && right.length >= 4 && left.length + right.length >= 13) openAxes++;
      if (left.wall && right.wall && left.length + right.length + 1 <= 8) pinched = true;
      if (left.length + right.length >= 18) longAxis = true;
    }
    if (openAxes >= 2) { open[cell] = 1; openCells++; }
    // Coastline's thin outer band is not a corridor between two holes.
    if (coast[cell]! >= 6 && pinched && longAxis && openAxes < 2) alley[cell] = 1;
  }
  const allReach = connected(floor, cols, rows, start), coreReach = connected(core, cols, rows, start);
  if (allReach.cells.length !== floorCells) failures.push('Disconnected supported floor');
  const broadFloorRatio = coreCells / Math.max(1, floorCells), coreCoverage = coreReach.cells.length / Math.max(1, coreCells);
  const multidirectionalRatio = openCells / Math.max(1, floorCells);
  if (broadFloorRatio < OPEN_SPACE_LIMITS.broadFloorRatio) failures.push('Too little broad floor');
  if (coreCoverage < OPEN_SPACE_LIMITS.coreCoverage) failures.push('Narrow bottleneck splits broad floor');
  if (multidirectionalRatio < OPEN_SPACE_LIMITS.multidirectionalRatio) failures.push('Too little multidirectional open space');
  let minX = cols, minY = rows, maxX = 0, maxY = 0;
  for (const cell of coreReach.cells) { const x = cell % cols, y = Math.floor(cell / cols); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (minX > cols * .24 || maxX < cols * .76 || minY > rows * .25 || maxY < rows * .75)
    failures.push('Broad floor does not cross the interior in both axes');
  let worstLocalOpenRatio = 1;
  // Interior windows prevent a broad peripheral bypass from hiding a maze.
  for (let y = 12; y < rows - 12; y += 8) for (let x = 12; x < cols - 12; x += 8) {
    if (coast[y * cols + x]! < 9) continue;
    let count = 0, opened = 0;
    for (let dy = -8; dy < 8; dy++) for (let dx = -8; dx < 8; dx++) {
      const cell = (y + dy) * cols + x + dx;
      if (floor[cell]) { count++; opened += open[cell]!; }
    }
    if (count >= 96) worstLocalOpenRatio = Math.min(worstLocalOpenRatio, opened / count);
  }
  if (worstLocalOpenRatio < OPEN_SPACE_LIMITS.localOpenRatio) failures.push('Locally corridor-dominated interior');
  let longestAlley = 0;
  for (let cell = 0; cell < alley.length; cell++) {
    if (!alley[cell]) continue;
    const x = cell % cols, y = Math.floor(cell / cols);
    for (const [dx, dy] of DIRECTIONS) {
      let length = 1;
      while (x + dx * length >= 0 && x + dx * length < cols && y + dy * length >= 0 && y + dy * length < rows
        && alley[(y + dy * length) * cols + x + dx * length]) length++;
      longestAlley = Math.max(longestAlley, length);
    }
  }
  if (longestAlley > OPEN_SPACE_LIMITS.maximumAlleyCells) failures.push('Long alley between tears');
  const continuous = bodyRoute(sample, coreReach.parent, start, goal);
  if (!continuous) failures.push('No continuous broad-body spawn/exit route');
  return { accepted: failures.length === 0, failures, floorCells, voidFraction: 1 - floorCells / Math.max(1, landCells),
    broadFloorRatio, multidirectionalRatio, worstLocalOpenRatio, coreCoverage, longestAlley, bodyRoute: continuous };
}
