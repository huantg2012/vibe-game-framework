/**
 * C1: grow + erode a single irregular island, keep the largest 4-connected
 * component, reject masks that still read as a rectangle (or a nibbled one).
 *
 * Walls are C2 (`ruins.ts`). Spawn / extract / atmosphere and RiftScene
 * wiring come later.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import { SeededRandom } from '@/utils/random';
import type {
  OutlineMask,
  OutlineMetrics,
  OutlineReject,
  OutlineVerdict,
} from '@/generation/types';

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

/** Land cells plus out-of-bounds, matching the design-preview grow rule. */
function landOrOobNeighbors8(
  land: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds(cols, rows, nx, ny) || land[at(cols, nx, ny)]) n++;
    }
  }
  return n;
}

function largestComponent(land: Uint8Array, cols: number, rows: number): Uint8Array {
  const seen = new Uint8Array(cols * rows);
  let best: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = at(cols, col, row);
      if (!land[i] || seen[i]) continue;
      const stack = [i];
      seen[i] = 1;
      const cells: number[] = [];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        cells.push(cur);
        const c = cur % cols;
        const r = (cur / cols) | 0;
        for (const [dx, dy] of DIRS4) {
          const nx = c + dx;
          const ny = r + dy;
          if (!inBounds(cols, rows, nx, ny)) continue;
          const ni = at(cols, nx, ny);
          if (seen[ni] || !land[ni]) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
      if (cells.length > best.length) best = cells;
    }
  }

  const out = new Uint8Array(cols * rows);
  for (const i of best) out[i] = 1;
  return out;
}

export function measureOutline(
  land: Uint8Array,
  cols: number,
  rows: number,
): OutlineMetrics {
  const ring = GAME_CONSTANTS.GENERATION.BORDER_RING;
  let landCount = 0;
  let minCol = cols;
  let minRow = rows;
  let maxCol = -1;
  let maxRow = -1;
  let ringLand = 0;
  let roughCells = 0;
  const edgeHas = [false, false, false, false];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at(cols, col, row)]) continue;
      landCount++;
      if (col < minCol) minCol = col;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;
      if (col < ring || row < ring || col >= cols - ring || row >= rows - ring) {
        ringLand++;
      }
      if (col === 0) edgeHas[0] = true;
      if (col === cols - 1) edgeHas[1] = true;
      if (row === 0) edgeHas[2] = true;
      if (row === rows - 1) edgeHas[3] = true;

      let touchesVoid = false;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny) || !land[at(cols, nx, ny)]) {
          touchesVoid = true;
          break;
        }
      }
      if (touchesVoid) roughCells++;
    }
  }

  const width = landCount === 0 ? 0 : maxCol - minCol + 1;
  const height = landCount === 0 ? 0 : maxRow - minRow + 1;
  const bboxArea = Math.max(1, width * height);
  const innerW = Math.max(0, cols - ring * 2);
  const innerH = Math.max(0, rows - ring * 2);
  const ringCells = cols * rows - innerW * innerH;

  return {
    landCount,
    fillRatio: landCount / (cols * rows),
    bbox: {
      minCol: landCount === 0 ? 0 : minCol,
      minRow: landCount === 0 ? 0 : minRow,
      maxCol: landCount === 0 ? 0 : maxCol,
      maxRow: landCount === 0 ? 0 : maxRow,
      width,
      height,
    },
    bboxFill: landCount / bboxArea,
    borderOccupancy: ringCells === 0 ? 0 : ringLand / ringCells,
    edgesTouching: edgeHas.filter(Boolean).length,
    roughness: landCount === 0 ? 0 : roughCells / landCount,
  };
}

export function evaluateOutline(
  land: Uint8Array,
  cols: number,
  rows: number,
): OutlineVerdict {
  const g = GAME_CONSTANTS.GENERATION;
  const metrics = measureOutline(land, cols, rows);
  const reasons: string[] = [];

  if (metrics.landCount === 0) reasons.push('empty');
  if (metrics.fillRatio < g.LAND_FILL_MIN) reasons.push('too-small');
  if (metrics.fillRatio > g.LAND_FILL_MAX) reasons.push('fills-buffer');
  if (metrics.borderOccupancy > g.BORDER_OCCUPANCY_MAX) reasons.push('hugs-frame');
  if (metrics.bboxFill > g.BBOX_FILL_MAX) reasons.push('filled-rectangle');
  if (metrics.roughness < g.ROUGHNESS_MIN) reasons.push('smooth-box');
  if (metrics.edgesTouching > g.MAX_EDGES_TOUCHING) reasons.push('touches-all-sides');

  const slack =
    cols - metrics.bbox.width + (rows - metrics.bbox.height);
  if (slack < g.MIN_BBOX_SLACK) reasons.push('flush-with-buffer');

  const nibbled =
    metrics.bbox.width >= cols - 4 &&
    metrics.bbox.height >= rows - 4 &&
    metrics.bboxFill > 0.72;
  if (nibbled) reasons.push('nibbled-rectangle');

  if (reasons.length > 0) {
    return { ok: false, reasons, metrics };
  }
  return { ok: true, reasons: [], metrics };
}

function growErode(rng: SeededRandom, cols: number, rows: number): Uint8Array {
  const land = new Uint8Array(cols * rows);
  const walkers = 4 + rng.nextInt(0, 2);
  for (let s = 0; s < walkers; s++) {
    let x = Math.floor(cols * (0.24 + rng.next() * 0.52));
    let y = Math.floor(rows * (0.24 + rng.next() * 0.52));
    const steps = 130 + rng.nextInt(0, 110);
    for (let i = 0; i < steps; i++) {
      land[at(cols, x, y)] = 1;
      // Prefer the long axis so later spawn/extract can sit at opposite ends.
      const horizontal = rng.next() < 0.6;
      if (horizontal) x += rng.next() < 0.5 ? 1 : -1;
      else y += rng.next() < 0.5 ? 1 : -1;
      x = Math.max(3, Math.min(cols - 4, x));
      y = Math.max(3, Math.min(rows - 4, y));
    }
  }

  // Fatten walker traces. n>=3 or thin ridges never thicken; keep iters modest
  // so the mass does not flood the buffer.
  const growIters = 8 + rng.nextInt(0, 3);
  for (let iter = 0; iter < growIters; iter++) {
    const next = new Uint8Array(land);
    for (let y = 2; y < rows - 2; y++) {
      for (let x = 2; x < cols - 2; x++) {
        const n = landOrOobNeighbors8(land, cols, rows, x, y);
        if (!land[at(cols, x, y)] && n >= 3 && rng.next() < 0.7) {
          next[at(cols, x, y)] = 1;
        }
      }
    }
    land.set(next);
  }

  const erodeIters = 4 + rng.nextInt(0, 2);
  for (let iter = 0; iter < erodeIters; iter++) {
    const next = new Uint8Array(land);
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1; x < cols - 1; x++) {
        const n = landOrOobNeighbors8(land, cols, rows, x, y);
        if (land[at(cols, x, y)] && n <= 2) next[at(cols, x, y)] = 0;
      }
    }
    land.set(next);
  }

  return largestComponent(land, cols, rows);
}

function toTileMap(land: Uint8Array, cols: number, rows: number): TileMapData {
  const tiles: number[][] = [];
  for (let row = 0; row < rows; row++) {
    const line: number[] = [];
    for (let col = 0; col < cols; col++) {
      line.push(land[at(cols, col, row)] ? TileType.FLOOR : TileType.VOID);
    }
    tiles.push(line);
  }
  return {
    cols,
    rows,
    tileSize: GAME_CONSTANTS.TILE_SIZE,
    tiles,
  };
}

export function tryGenerateOutlineOnce(
  attemptSeed: number,
  cols = GAME_CONSTANTS.GENERATION.BUFFER_COLS,
  rows = GAME_CONSTANTS.GENERATION.BUFFER_ROWS,
): OutlineMask | OutlineReject {
  const rng = new SeededRandom(attemptSeed);
  const land = growErode(rng, cols, rows);
  const verdict = evaluateOutline(land, cols, rows);
  if (!verdict.ok) return verdict;
  return {
    seed: attemptSeed,
    attempt: 0,
    cols,
    rows,
    tileSize: GAME_CONSTANTS.TILE_SIZE,
    land,
    tileMap: toTileMap(land, cols, rows),
    metrics: verdict.metrics,
  };
}

/**
 * Deterministic: the same `seed` always yields the same mask (including which
 * retry attempt won). Throws in development if every attempt is a bad map.
 */
export function generateOutline(seed: number): OutlineMask {
  const cols = GAME_CONSTANTS.GENERATION.BUFFER_COLS;
  const rows = GAME_CONSTANTS.GENERATION.BUFFER_ROWS;
  const max = GAME_CONSTANTS.GENERATION.MAX_OUTLINE_ATTEMPTS;
  let last: OutlineReject | null = null;

  for (let attempt = 0; attempt < max; attempt++) {
    const attemptSeed = (seed + attempt * 0x9e3779b9) >>> 0;
    const result = tryGenerateOutlineOnce(attemptSeed, cols, rows);
    if ('tileMap' in result) {
      return { ...result, seed, attempt };
    }
    last = result;
  }

  const why = last?.reasons.join(', ') ?? 'unknown';
  throw new Error(
    `generateOutline: seed ${seed} produced no usable land after ${max} attempts (${why})`,
  );
}

export function isLandCell(mask: OutlineMask, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= mask.cols || row >= mask.rows) return false;
  return mask.land[at(mask.cols, col, row)] === 1;
}
