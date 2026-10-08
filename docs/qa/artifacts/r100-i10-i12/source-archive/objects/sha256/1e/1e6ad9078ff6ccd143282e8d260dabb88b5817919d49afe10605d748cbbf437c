/** Source identity describes a reachable district, never the contents of one pile. */
import { CATALOG_SOURCE_AFFINITIES } from '@/generated/contaminant-catalog-data';
import type { WalkGrid } from '@/types/map-types';
import type { Vector2 } from '@/types/game-types';
import { mix32 } from './seed-fork';

export interface SourceRegionNode { readonly id: string; readonly position: Vector2 }
export interface SourceRegionAssignment { readonly sourceTag: string; readonly hint: string }

function distances(grid: WalkGrid, point: Vector2): Int32Array {
  const result = new Int32Array(grid.cols * grid.rows).fill(-1);
  const col = Math.floor(point.x / grid.tileSize), row = Math.floor(point.y / grid.tileSize);
  if (!grid.isWalkable(col, row)) return result;
  const queue = new Int32Array(result.length);
  let read = 0, write = 0;
  const start = row * grid.cols + col;
  queue[write++] = start; result[start] = 0;
  while (read < write) {
    const current = queue[read++]!, x = current % grid.cols, y = Math.floor(current / grid.cols);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx!, ny = y + dy!;
      if (nx < 0 || nx >= grid.cols || ny < 0 || ny >= grid.rows || !grid.isWalkable(nx, ny)) continue;
      const index = ny * grid.cols + nx;
      if (result[index] !== -1) continue;
      result[index] = result[current]! + 1; queue[write++] = index;
    }
  }
  return result;
}

/** Stable geodesic Voronoi split. All piles (including fuel) participate equally. */
export function createContaminantSourceRegions(input: {
  grid: WalkGrid; spawn: Vector2; nodes: readonly SourceRegionNode[]; seed: number;
}): ReadonlyMap<string, SourceRegionAssignment> {
  const { grid } = input;
  const index = (node: SourceRegionNode) => Math.floor(node.position.y / grid.tileSize) * grid.cols + Math.floor(node.position.x / grid.tileSize);
  const reachable = distances(grid, input.spawn);
  const nodes = [...input.nodes].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(nodes.map(node => node.id)).size !== nodes.length) throw Error('Duplicate source region node');
  const candidates = nodes.filter(node => (reachable[index(node)] ?? -1) >= 0);
  const result = new Map<string, SourceRegionAssignment>();
  const assignment = (sourceTag: string): SourceRegionAssignment => ({ sourceTag, hint: CATALOG_SOURCE_AFFINITIES[sourceTag]?.[0]?.publicHint ?? '残留特征混杂' });
  for (const node of nodes) result.set(node.id, assignment('unbiased'));
  if (candidates.length < 2) return result;
  const fields = candidates.map(node => distances(grid, node.position));
  let a = 0, b = 1, farthest = -1;
  for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
    const distance = fields[i]![index(candidates[j]!)]!;
    if (distance > farthest) { farthest = distance; a = i; b = j; }
  }
  const labels = Object.keys(CATALOG_SOURCE_AFFINITIES).filter(id => id !== 'unbiased')
    .sort((x, y) => (mix32(input.seed, `source:${x}`) >>> 0) - (mix32(input.seed, `source:${y}`) >>> 0) || x.localeCompare(y));
  if (labels.length < 2) return result;
  for (const node of candidates) {
    const da = fields[a]![index(node)]!, db = fields[b]![index(node)]!;
    // Pair order is stable by node ID. A seed always belongs to its own district.
    const side = node.id === candidates[b]!.id ? 1 : da <= db ? 0 : 1;
    result.set(node.id, assignment(labels[side]!));
  }
  return result;
}
