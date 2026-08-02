/**
 * Grid A* pathfinding - a shared service module, not a system (it holds no game state
 * and anything may import it, the same way `utils/grid-raycast` may be imported).
 *
 * 8-connected, octile heuristic, straight cost 1 and diagonal sqrt(2)
 * (docs/specs/system-enemy-ai.md rule N1). Diagonal steps are only legal when both
 * orthogonal neighbours are walkable (rule N2): the same geometric discipline the sight
 * rules apply to diagonal seams, so an enemy can never come through a corner the player
 * reads as sealed.
 *
 * Deviation from the spec's declared `findPath(grid, from, to, maxNodes)` free function:
 * this is a class with pre-allocated buffers that writes into a caller-owned array.
 * Searches are requested from the game loop, and the loop must not allocate (architecture
 * performance rules) - the same reason `utils/grid-raycast` writes into a caller-owned
 * `RayHit`. Occupancy is read through `WalkGrid` and the smoothing pass through
 * `OccluderGrid`, because the two are contractually separate even though Slice 1 derives
 * both from one tile array.
 */

import type { Vector2 } from '@/types/game-types';
import type { OccluderGrid, WalkGrid } from '@/types/map-types';
import { hasClearPath } from '@/utils/grid-raycast';

const SQRT2 = Math.SQRT2;
/** Octile heuristic weight for the diagonal part: sqrt(2) - 2. */
const OCTILE_D = SQRT2 - 2;

const enum NodeState {
  Unseen = 0,
  Open = 1,
  Closed = 2,
}

/** 8-neighbour offsets, orthogonals first so ties prefer straight steps. */
const NEIGHBOUR_COL = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const NEIGHBOUR_ROW = [0, 0, 1, -1, 1, -1, 1, -1] as const;

export interface PathfinderStats {
  /** Nodes expanded by the most recent search. */
  readonly nodesExpanded: number;
  /** Wall-clock cost of the most recent search (ms). */
  readonly lastMs: number;
  readonly avgMs: number;
  readonly searches: number;
}

export class GridPathfinder {
  private readonly cols: number;
  private readonly rows: number;
  private readonly tileSize: number;

  // --- search buffers, allocated once for the lifetime of the grid ---
  private readonly gScore: Float64Array;
  private readonly fScore: Float64Array;
  private readonly cameFrom: Int32Array;
  private readonly nodeState: Uint8Array;
  /** Generation each entry belongs to, so a search never has to clear the buffers. */
  private readonly stamp: Uint32Array;
  private readonly heap: Int32Array;
  private readonly rawPath: Int32Array;

  private generation = 0;
  private heapSize = 0;

  private nodesExpanded = 0;
  private lastMs = 0;
  private totalMs = 0;
  private searches = 0;

  private readonly anchor: Vector2 = { x: 0, y: 0 };
  private readonly probe: Vector2 = { x: 0, y: 0 };

  /**
   * @param clearance Width (px) of the body that will walk the result. Smoothing keeps
   *   this much room, so shortcuts stay passable instead of merely visible. 0 smooths for
   *   a point-sized walker.
   */
  constructor(
    private readonly walk: WalkGrid,
    private readonly occluders: OccluderGrid,
    private readonly clearance = 0
  ) {
    this.cols = walk.cols;
    this.rows = walk.rows;
    this.tileSize = walk.tileSize;

    const cells = this.cols * this.rows;
    this.gScore = new Float64Array(cells);
    this.fScore = new Float64Array(cells);
    this.cameFrom = new Int32Array(cells);
    this.nodeState = new Uint8Array(cells);
    this.stamp = new Uint32Array(cells);
    // Lazy deletion means a node can sit in the heap more than once.
    this.heap = new Int32Array(cells * 4);
    this.rawPath = new Int32Array(cells);
  }

  getStats(): PathfinderStats {
    return {
      nodesExpanded: this.nodesExpanded,
      lastMs: this.lastMs,
      avgMs: this.searches > 0 ? this.totalMs / this.searches : 0,
      searches: this.searches,
    };
  }

  /**
   * Searches from `from` to `to` and writes the smoothed waypoints into `out`, returning
   * how many were written (0 = no path within `maxNodes`).
   *
   * `out` must already hold `Vector2` objects; nothing is allocated. A path needing more
   * turns than `out.length` is truncated - the follower then simply asks again when it
   * reaches the last point it was given, which costs one extra search and never stalls.
   * The enemy's own position is not emitted: the first point is always somewhere to go.
   */
  findPath(from: Readonly<Vector2>, to: Readonly<Vector2>, out: Vector2[], maxNodes: number): number {
    const startedAt = performance.now();
    const count = this.search(from, to, out, maxNodes);

    this.lastMs = performance.now() - startedAt;
    this.totalMs += this.lastMs;
    this.searches++;
    return count;
  }

  /**
   * Breadth-first search for the nearest walkable tile centre around a world position,
   * written into `out`. Used for spawn recovery and for pulling extrapolated search
   * points back onto the floor. Returns false if nothing walkable is within `maxRadius`
   * tiles (a broken map, not a runtime condition).
   */
  findNearestWalkable(x: number, y: number, out: Vector2, maxRadius = 6): boolean {
    const startCol = Math.floor(x / this.tileSize);
    const startRow = Math.floor(y / this.tileSize);

    if (this.walk.isWalkable(startCol, startRow)) {
      out.x = x;
      out.y = y;
      return true;
    }

    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dRow = -radius; dRow <= radius; dRow++) {
        for (let dCol = -radius; dCol <= radius; dCol++) {
          // Only the ring at this radius; inner rings were checked already.
          if (Math.abs(dRow) !== radius && Math.abs(dCol) !== radius) continue;
          const col = startCol + dCol;
          const row = startRow + dRow;
          if (!this.walk.isWalkable(col, row)) continue;
          out.x = (col + 0.5) * this.tileSize;
          out.y = (row + 0.5) * this.tileSize;
          return true;
        }
      }
    }
    return false;
  }

  // ------------------------------------------------------------------ internals

  private search(
    from: Readonly<Vector2>,
    to: Readonly<Vector2>,
    out: Vector2[],
    maxNodes: number
  ): number {
    this.nodesExpanded = 0;
    if (out.length === 0) return 0;

    const tileSize = this.tileSize;
    const startCol = Math.floor(from.x / tileSize);
    const startRow = Math.floor(from.y / tileSize);
    const goalCol = Math.floor(to.x / tileSize);
    const goalRow = Math.floor(to.y / tileSize);

    if (!this.walk.isWalkable(startCol, startRow)) return 0;
    if (!this.walk.isWalkable(goalCol, goalRow)) return 0;

    const start = startRow * this.cols + startCol;
    const goal = goalRow * this.cols + goalCol;

    // Same tile: the goal is directly reachable, no search needed.
    if (start === goal) {
      out[0]!.x = to.x;
      out[0]!.y = to.y;
      return 1;
    }

    this.generation++;
    this.heapSize = 0;

    this.stamp[start] = this.generation;
    this.nodeState[start] = NodeState.Open;
    this.gScore[start] = 0;
    this.cameFrom[start] = -1;
    this.fScore[start] = this.heuristic(startCol, startRow, goalCol, goalRow);
    this.heapPush(start);

    while (this.heapSize > 0) {
      const current = this.heapPop();
      if (this.nodeState[current] === NodeState.Closed) continue;
      this.nodeState[current] = NodeState.Closed;

      if (current === goal) return this.buildPath(from, to, goal, out);

      if (++this.nodesExpanded >= maxNodes) return 0;

      const col = current % this.cols;
      const row = (current - col) / this.cols;
      const currentG = this.gScore[current]!;

      for (let i = 0; i < 8; i++) {
        const nextCol = col + NEIGHBOUR_COL[i]!;
        const nextRow = row + NEIGHBOUR_ROW[i]!;
        if (!this.walk.isWalkable(nextCol, nextRow)) continue;

        const diagonal = i >= 4;
        if (diagonal) {
          // Rule N2: no corner cutting. Both orthogonal neighbours must be open.
          if (!this.walk.isWalkable(nextCol, row) || !this.walk.isWalkable(col, nextRow)) continue;
        }

        const next = nextRow * this.cols + nextCol;
        if (this.stamp[next] === this.generation && this.nodeState[next] === NodeState.Closed) {
          continue;
        }

        const tentative = currentG + (diagonal ? SQRT2 : 1);
        const seen = this.stamp[next] === this.generation;
        if (seen && tentative >= this.gScore[next]!) continue;

        this.stamp[next] = this.generation;
        this.nodeState[next] = NodeState.Open;
        this.gScore[next] = tentative;
        this.cameFrom[next] = current;
        this.fScore[next] = tentative + this.heuristic(nextCol, nextRow, goalCol, goalRow);
        this.heapPush(next);
      }
    }

    return 0;
  }

  private heuristic(col: number, row: number, goalCol: number, goalRow: number): number {
    const dCol = Math.abs(col - goalCol);
    const dRow = Math.abs(row - goalRow);
    return dCol + dRow + OCTILE_D * Math.min(dCol, dRow);
  }

  /**
   * Walks `cameFrom` back from the goal, then string-pulls the tile chain (rule N7):
   * each point is skipped while the previous kept point still has a clear path to the
   * next one, which leaves only the real turns. Without this, enemies walk the grid
   * staircase and read as pieces on a board rather than as creatures.
   *
   * The skip test is width-aware. Using a bare sight test here produces shortcuts that
   * thread the corner between two diagonally offset walls, which a body wider than a
   * point then wedges against - the tile path itself is safe (rule N2 forbids corner
   * cutting), so all the risk lives in this pass.
   */
  private buildPath(
    from: Readonly<Vector2>,
    to: Readonly<Vector2>,
    goal: number,
    out: Vector2[]
  ): number {
    let length = 0;
    for (let node = goal; node !== -1; node = this.cameFrom[node]!) {
      this.rawPath[length++] = node;
    }

    // rawPath is goal -> start; index it backwards, dropping the enemy's own tile.
    const tileSize = this.tileSize;
    const nodeCount = length - 1;
    const pointAt = (index: number, target: Vector2): void => {
      if (index === nodeCount - 1) {
        target.x = to.x;
        target.y = to.y;
        return;
      }
      const node = this.rawPath[length - 2 - index]!;
      const col = node % this.cols;
      const row = (node - col) / this.cols;
      target.x = (col + 0.5) * tileSize;
      target.y = (row + 0.5) * tileSize;
    };

    this.anchor.x = from.x;
    this.anchor.y = from.y;

    let written = 0;
    let index = 0;
    while (index < nodeCount && written < out.length) {
      // Reach as far ahead as the anchor can see, then commit that point as a turn.
      let furthest = index;
      for (let probeIndex = index; probeIndex < nodeCount; probeIndex++) {
        pointAt(probeIndex, this.probe);
        if (!hasClearPath(this.occluders, this.anchor, this.probe, this.clearance)) break;
        furthest = probeIndex;
      }

      const emitted = out[written]!;
      pointAt(furthest, emitted);
      written++;
      this.anchor.x = emitted.x;
      this.anchor.y = emitted.y;
      index = furthest + 1;
    }

    return written;
  }

  private heapPush(node: number): void {
    if (this.heapSize >= this.heap.length) {
      // Only reachable if maxNodes is raised far past the buffer; drop the worst option
      // rather than crash, and let the search fail cleanly.
      return;
    }
    let child = this.heapSize++;
    this.heap[child] = node;
    const score = this.fScore[node]!;

    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.fScore[this.heap[parent]!]! <= score) break;
      this.heap[child] = this.heap[parent]!;
      this.heap[parent] = node;
      child = parent;
    }
  }

  private heapPop(): number {
    const top = this.heap[0]!;
    const last = this.heap[--this.heapSize]!;
    if (this.heapSize === 0) return top;

    this.heap[0] = last;
    const score = this.fScore[last]!;
    let parent = 0;

    for (;;) {
      const left = parent * 2 + 1;
      if (left >= this.heapSize) break;
      const right = left + 1;
      let best = left;
      if (right < this.heapSize && this.fScore[this.heap[right]!]! < this.fScore[this.heap[left]!]!) {
        best = right;
      }
      if (this.fScore[this.heap[best]!]! >= score) break;
      this.heap[parent] = this.heap[best]!;
      this.heap[best] = last;
      parent = best;
    }

    return top;
  }
}
