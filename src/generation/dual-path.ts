/**
 * Spec 21 dual-path machine check. Shared by generateRiftLayout and check:layout.
 * Do not keep a second copy of this gate.
 */

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Second path must be at least this times the main path's grid steps. */
export const DUAL_PATH_MIN_LENGTH_RATIO = 1.15;

export interface DualPathEval {
  readonly ok: boolean;
  readonly reason: string;
  readonly mainSteps: number;
  readonly altSteps: number;
  readonly mainOpenRatio: number;
  readonly altOpenRatio: number;
}

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function bfs(
  walk: Uint8Array,
  cols: number,
  rows: number,
  start: number,
): { dist: Int32Array; parent: Int32Array } {
  const dist = new Int32Array(walk.length).fill(-1);
  const parent = new Int32Array(walk.length).fill(-1);
  if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
  const queue = [start];
  dist[start] = 0;
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++]!;
    const col = cur % cols;
    const row = (cur / cols) | 0;
    const d = dist[cur]!;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds(cols, rows, nx, ny)) continue;
      const ni = at(cols, nx, ny);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, parent };
}

function reconstruct(parent: Int32Array, start: number, goal: number): number[] {
  if (goal < 0 || parent[goal] === undefined) return [];
  const path: number[] = [];
  let cur = goal;
  const guard = parent.length + 2;
  let n = 0;
  while (cur !== start && cur >= 0 && n++ < guard) {
    path.push(cur);
    cur = parent[cur]!;
  }
  if (cur !== start) return [];
  path.push(start);
  path.reverse();
  return path;
}

function wallNeighborCount(
  walls: Uint8Array,
  cols: number,
  rows: number,
  cell: number,
): number {
  const col = cell % cols;
  const row = (cell / cols) | 0;
  let n = 0;
  for (const [dx, dy] of DIRS4) {
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds(cols, rows, nx, ny)) continue;
    if (walls[at(cols, nx, ny)]) n++;
  }
  return n;
}

function openRatio(
  path: readonly number[],
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  if (path.length === 0) return 0;
  let open = 0;
  for (const cell of path) {
    if (wallNeighborCount(walls, cols, rows, cell) <= 1) open++;
  }
  return open / path.length;
}

function fail(
  reason: string,
  extra?: Partial<Pick<DualPathEval, 'mainSteps' | 'altSteps' | 'mainOpenRatio' | 'altOpenRatio'>>,
): DualPathEval {
  return {
    ok: false,
    reason,
    mainSteps: extra?.mainSteps ?? -1,
    altSteps: extra?.altSteps ?? -1,
    mainOpenRatio: extra?.mainOpenRatio ?? 0,
    altOpenRatio: extra?.altOpenRatio ?? 0,
  };
}

/**
 * Spec 21 steps 1–6. `walk` = floor (not wall, not void). `walls` = wall tiles only (not void).
 * Length = grid steps (BFS distance = path cells − 1).
 */
export function evaluateDualPath(
  walk: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  spawn: number,
  extract: number,
): DualPathEval {
  if (spawn === extract) return fail('no dual-path');
  if (spawn < 0 || extract < 0 || spawn >= walk.length || extract >= walk.length) {
    return fail('no dual-path');
  }
  if (!walk[spawn] || !walk[extract]) return fail('no dual-path');

  const mainSearch = bfs(walk, cols, rows, spawn);
  const mainSteps = mainSearch.dist[extract]!;
  if (mainSteps < 0) return fail('no dual-path');
  const mainPath = reconstruct(mainSearch.parent, spawn, extract);
  if (mainPath.length < 2) return fail('no dual-path', { mainSteps });

  const blocked = new Uint8Array(walk);
  for (const cell of mainPath) {
    if (cell !== spawn && cell !== extract) blocked[cell] = 0;
  }
  const altSearch = bfs(blocked, cols, rows, spawn);
  const altSteps = altSearch.dist[extract]!;
  if (altSteps < 0) return fail('no dual-path', { mainSteps });
  const altPath = reconstruct(altSearch.parent, spawn, extract);
  if (altPath.length < 2) return fail('no dual-path', { mainSteps, altSteps });

  if (altSteps < mainSteps * DUAL_PATH_MIN_LENGTH_RATIO) {
    return fail('no dual-path', { mainSteps, altSteps });
  }

  const mainOpenRatio = openRatio(mainPath, walls, cols, rows);
  const altOpenRatio = openRatio(altPath, walls, cols, rows);
  const mainIsShorter = mainSteps <= altSteps;
  const shortOpen = mainIsShorter ? mainOpenRatio : altOpenRatio;
  const longOpen = mainIsShorter ? altOpenRatio : mainOpenRatio;
  if (!(shortOpen > longOpen)) {
    return fail('no dual-path', { mainSteps, altSteps, mainOpenRatio, altOpenRatio });
  }

  return {
    ok: true,
    reason: '',
    mainSteps,
    altSteps,
    mainOpenRatio,
    altOpenRatio,
  };
}
