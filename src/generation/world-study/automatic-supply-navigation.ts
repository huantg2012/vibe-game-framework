import { GAME_CONSTANTS } from '@/config/constants';
import { bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import type { TileGrid } from '@/systems/tile-grid';
import type { R100AutomaticSupplyPolicy } from './automatic-supply-policy';

const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
export interface AutomaticSupplyCoverage {
  readonly maxPx: number;
  readonly p95Px: number;
  readonly uncoveredFraction: number;
  readonly worstCell: number;
}
export interface AutomaticSupplySpace {
  readonly bodyAreaPx2: number;
  readonly originP95Px: number;
  readonly originMaxPx: number;
}
export function automaticSupplyBudget(space: AutomaticSupplySpace, minimumNodes: number, policy: R100AutomaticSupplyPolicy): number {
  // Area contributes px²/(px² per node); route contributes px/(px per node).
  // Both terms are measured on the reachable 20px-body graph. Equal-area maps
  // with longer detours can require more supply, without a world-specific quota.
  return Math.max(minimumNodes, Math.ceil(space.bodyAreaPx2 / policy.bodyAreaPerNodePx2 + space.originP95Px / policy.routePerNodePx));
}

/** One frozen physical adjacency graph, shared by all supply queries. The work
 * counter covers graph construction and every Dijkstra edge visit, including
 * independent final verification. It cannot restart its allowance per node. */
export class AutomaticSupplyNavigation {
  readonly cells: readonly number[];
  readonly space: AutomaticSupplySpace;
  readonly work = { graphEdgeChecks: 0, routeEdgeVisits: 0, routeQueries: 0 };
  private readonly edges: Uint8Array;
  private readonly offsets: readonly number[];
  private readonly costs: readonly number[];
  private readonly heap: Int32Array;
  private readonly heapPositions: Int32Array;
  constructor(grid: TileGrid, originDistance: Float64Array, private readonly policy: R100AutomaticSupplyPolicy) {
    const size = grid.cols * grid.rows;
    if (size > policy.maxBodyCells || originDistance.length !== size) this.fail('body-grid-budget');
    this.edges = new Uint8Array(size);
    this.heap = new Int32Array(size);
    this.heapPositions = new Int32Array(size);
    this.offsets = directions.map(([dx, dy]) => dy * grid.cols + dx);
    this.costs = directions.map(([dx, dy]) => Math.hypot(dx, dy) * grid.tileSize);
    const cells: number[] = [], distances: number[] = [];
    const half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
    for (let cell = 0; cell < size; cell++) {
      if (!Number.isFinite(originDistance[cell])) continue;
      cells.push(cell); distances.push(originDistance[cell]!);
      const x = cell % grid.cols, y = Math.floor(cell / grid.cols);
      const point = { x: (x + .5) * grid.tileSize, y: (y + .5) * grid.tileSize };
      for (let dir = 0; dir < directions.length; dir++) {
        this.work.graphEdgeChecks++; this.checkWork();
        const [dx, dy] = directions[dir]!, next = cell + this.offsets[dir]!;
        if (x + dx < 0 || y + dy < 0 || x + dx >= grid.cols || y + dy >= grid.rows
          || !Number.isFinite(originDistance[next])) continue;
        if (bodyDisplacementFraction(grid, point, half, half, dx * grid.tileSize, dy * grid.tileSize) >= 1) this.edges[cell]! |= 1 << dir;
      }
    }
    if (!cells.length) this.fail('empty-body-domain');
    distances.sort((a, b) => a - b);
    this.cells = cells;
    this.space = { bodyAreaPx2: cells.length * grid.tileSize ** 2,
      originP95Px: distances[Math.ceil(distances.length * .95) - 1]!, originMaxPx: distances[distances.length - 1]! };
  }
  emptyDistances(): Float64Array { return new Float64Array(this.edges.length).fill(Infinity); }
  distancesFrom(sources: readonly number[]): Float64Array {
    const distance = this.emptyDistances(); this.addSources(distance, sources); return distance;
  }
  /** Decrease-only multi-source Dijkstra: previously covered cells only expand
   * again when a new legal interaction seat actually improves their distance. */
  addSources(distance: Float64Array, sources: readonly number[]): void {
    this.work.routeQueries++;
    this.heapPositions.fill(-1);
    let length = 0;
    const push = (cell: number): void => {
      let index = this.heapPositions[cell]!;
      if (index < 0) index = length++;
      while (index > 0) {
        const above = (index - 1) >> 1, parent = this.heap[above]!;
        if (distance[parent]! <= distance[cell]!) break;
        this.heap[index] = parent; this.heapPositions[parent] = index; index = above;
      }
      this.heap[index] = cell; this.heapPositions[cell] = index;
    };
    for (const source of sources) {
      if (!Number.isInteger(source) || source < 0 || source >= distance.length) this.fail('invalid-interaction-cell');
      if (distance[source]! > 0) { distance[source] = 0; push(source); }
    }
    while (length) {
      const cell = this.heap[0]!, last = this.heap[--length]!;
      this.heapPositions[cell] = -1;
      if (length) {
        let index = 0;
        while (index * 2 + 1 < length) {
          let child = index * 2 + 1;
          if (child + 1 < length && distance[this.heap[child + 1]!]! < distance[this.heap[child]!]!) child++;
          if (distance[this.heap[child]!]! >= distance[last]!) break;
          this.heap[index] = this.heap[child]!; this.heapPositions[this.heap[index]!] = index; index = child;
        }
        this.heap[index] = last; this.heapPositions[last] = index;
      }
      const bits = this.edges[cell]!;
      for (let dir = 0; dir < directions.length; dir++) {
        if (!(bits & (1 << dir))) continue;
        this.work.routeEdgeVisits++; this.checkWork();
        const next = cell + this.offsets[dir]!, cost = distance[cell]! + this.costs[dir]!;
        if (cost >= distance[next]!) continue;
        distance[next] = cost; push(next);
      }
    }
  }
  coverage(distance: Float64Array): AutomaticSupplyCoverage {
    const values: number[] = [];
    let maxPx = -1, worstCell = -1, uncovered = 0;
    for (const cell of this.cells) {
      const value = distance[cell]!; values.push(value);
      if (value > maxPx) { maxPx = value; worstCell = cell; }
      if (value > this.policy.p95CoveragePx) uncovered++;
    }
    values.sort((a, b) => a - b);
    return { maxPx, p95Px: values[Math.ceil(values.length * .95) - 1]!, uncoveredFraction: uncovered / values.length, worstCell };
  }
  private checkWork(): void {
    if (this.work.graphEdgeChecks + this.work.routeEdgeVisits > this.policy.maxWorkEdges) this.fail('navigation-work-budget');
  }
  private fail(reason: string): never {
    throw Object.assign(new Error(`Automatic supply rejected: ${reason}`), { diagnostics: { automaticSupply: { stage: 'navigation', reason, work: { ...this.work } } } });
  }
}
