/** One discrete support surface for drawing, light, physics and navigation. */
import { worldLandAt, worldWallAt } from './shape';
import type { WorldSample } from './types';

export interface WorldSupportGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: 8;
  readonly walkable: Uint8Array;
}
const cache = new WeakMap<WorldSample, WorldSupportGrid>();
export function getWorldSupportGrid(sample: WorldSample): WorldSupportGrid {
  const existing = cache.get(sample);
  if (existing) return existing;
  const tileSize = 8;
  const cols = sample.cols * sample.tileSize / tileSize, rows = sample.rows * sample.tileSize / tileSize;
  if (!Number.isInteger(cols) || !Number.isInteger(rows)) throw new Error('World support dimensions must align to 8px');
  const walkable = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col * tileSize + tileSize / 2, y = row * tileSize + tileSize / 2;
    walkable[row * cols + col] = worldLandAt(sample, x, y) && !worldWallAt(sample, x, y) ? 1 : 0;
  }
  const result: WorldSupportGrid = { cols, rows, tileSize, walkable };
  cache.set(sample, result);
  return result;
}
export function worldSupportAt(sample: WorldSample, x: number, y: number): boolean {
  const grid = getWorldSupportGrid(sample);
  const col = Math.floor(x / grid.tileSize), row = Math.floor(y / grid.tileSize);
  return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows && grid.walkable[row * grid.cols + col] === 1;
}

/** Exact AABB-cell overlap, matching the formal 20×20 Arcade body. */
export function canStandWorld(sample: WorldSample, x: number, y: number, halfSize = 10): boolean {
  const grid = getWorldSupportGrid(sample);
  const left = Math.floor((x - halfSize + .001) / grid.tileSize), right = Math.floor((x + halfSize - .001) / grid.tileSize);
  const top = Math.floor((y - halfSize + .001) / grid.tileSize), bottom = Math.floor((y + halfSize - .001) / grid.tileSize);
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !grid.walkable[row * grid.cols + col]) return false;
  }
  return true;
}
