/**
 * Ordered walk along a wall-edge tile *set*. Pure. Does not change collision.
 *
 * Why this file exists (DEC-080 / R2-C0):
 * `collectWallEdges` in contamination-pins.ts discovers wall tiles that touch
 * floor, then groups them with DFS `stack.pop()`. The resulting `tiles` array
 * is a **set in visit order**, not a walk along the wall skin. 乙 "slowly roam
 * connected wall faces" needs an ordered path. Reordering inside
 * `collectWallEdges` would silently change sortie pin identity:
 * `spawnYi` takes `edge.tiles[slot]`, so a different array order is a different
 * spawn tile, and birth-tile choice on a sortie would drift with no layout
 * checksum catching it.
 *
 * Contract:
 * - **Do not call this from `collectWallEdges`.** Sortie keeps reading the
 *   original array. Birth-tile selection stays bit-identical to before this file.
 * - This function is for `gymLiveMotion` (practice lexicon lesson). Default
 *   host path does not import a reordered array into spawn.
 * - Tile **set** is unchanged: no cells added or removed. Only stringing.
 * - Connectivity FATAL still holds: we never write walls or floors.
 *
 * Multi-component input: each 4-connected component is walked separately and
 * concatenated. Consecutive tiles that are not 4-adjacent are segment breaks;
 * the caller stitches (R2-C2).
 */

export type WallFace = 'n' | 'e' | 's' | 'w';

export interface FormWallAttach {
  /** 墙格朝向可走地板的那一面 */
  face: WallFace;
  /** 指向可走地板的单位法线（face='s' → nx=0, ny=1） */
  nx: number;
  ny: number;
  /** 墙-地交界中点的世界像素（贴附点，不是格心） */
  seamX: number;
  seamY: number;
}

export interface WallTile {
  readonly col: number;
  readonly row: number;
}

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Same discovery order as `collectWallEdges` DIRS4: E, W, S, N. */
const FACE_BY_DELTA: ReadonlyArray<{
  readonly dx: number;
  readonly dy: number;
  readonly face: WallFace;
  readonly nx: number;
  readonly ny: number;
}> = [
  { dx: 1, dy: 0, face: 'e', nx: 1, ny: 0 },
  { dx: -1, dy: 0, face: 'w', nx: -1, ny: 0 },
  { dx: 0, dy: 1, face: 's', nx: 0, ny: 1 },
  { dx: 0, dy: -1, face: 'n', nx: 0, ny: -1 },
];

function tileKey(tile: WallTile): string {
  return `${tile.col},${tile.row}`;
}

function uniqueTiles(tiles: readonly WallTile[]): WallTile[] {
  const seen = new Set<string>();
  const out: WallTile[] = [];
  for (const tile of tiles) {
    const id = tileKey(tile);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ col: tile.col, row: tile.row });
  }
  return out;
}

export function sameWallEdgeTileSet(
  a: readonly WallTile[],
  b: readonly WallTile[],
): boolean {
  const sa = new Set(a.map(tileKey));
  const sb = new Set(b.map(tileKey));
  if (sa.size !== sb.size) return false;
  for (const id of sa) if (!sb.has(id)) return false;
  return true;
}

function buildAdj(tiles: readonly WallTile[]): Map<string, WallTile[]> {
  const index = new Map<string, WallTile>();
  for (const tile of tiles) index.set(tileKey(tile), tile);
  const adj = new Map<string, WallTile[]>();
  for (const tile of tiles) {
    const nbs: WallTile[] = [];
    for (const [dx, dy] of DIRS4) {
      const nb = index.get(tileKey({ col: tile.col + dx, row: tile.row + dy }));
      if (nb) nbs.push(nb);
    }
    adj.set(tileKey(tile), nbs);
  }
  return adj;
}

function lexLess(a: WallTile, b: WallTile): boolean {
  if (a.row !== b.row) return a.row < b.row;
  return a.col < b.col;
}

function remainingDegree(
  tile: WallTile,
  remaining: ReadonlySet<string>,
  adj: Map<string, WallTile[]>,
): number {
  let n = 0;
  for (const nb of adj.get(tileKey(tile)) ?? []) {
    if (remaining.has(tileKey(nb))) n++;
  }
  return n;
}

function pickStart(
  remaining: ReadonlySet<string>,
  byKey: Map<string, WallTile>,
  adj: Map<string, WallTile[]>,
): WallTile {
  let best: WallTile | null = null;
  let bestDeg = 99;
  for (const id of remaining) {
    const tile = byKey.get(id)!;
    const deg = remainingDegree(tile, remaining, adj);
    if (
      !best ||
      deg < bestDeg ||
      (deg === bestDeg && lexLess(tile, best))
    ) {
      best = tile;
      bestDeg = deg;
    }
  }
  return best!;
}

function connectedComponents(
  tiles: readonly WallTile[],
  adj: Map<string, WallTile[]>,
): WallTile[][] {
  const seen = new Set<string>();
  const comps: WallTile[][] = [];
  for (const start of tiles) {
    const sid = tileKey(start);
    if (seen.has(sid)) continue;
    const stack = [start];
    seen.add(sid);
    const comp: WallTile[] = [];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(tileKey(cur)) ?? []) {
        const nid = tileKey(nb);
        if (seen.has(nid)) continue;
        seen.add(nid);
        stack.push(nb);
      }
    }
    comp.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
    comps.push(comp);
  }
  comps.sort((a, b) => {
    const aa = a[0]!;
    const bb = b[0]!;
    return aa.row !== bb.row ? aa.row - bb.row : aa.col - bb.col;
  });
  return comps;
}

function orderComponent(tiles: readonly WallTile[], adj: Map<string, WallTile[]>): WallTile[] {
  const byKey = new Map(tiles.map((t) => [tileKey(t), t] as const));
  const remaining = new Set(byKey.keys());
  const out: WallTile[] = [];
  while (remaining.size > 0) {
    let cur = pickStart(remaining, byKey, adj);
    remaining.delete(tileKey(cur));
    out.push(cur);
    while (true) {
      const candidates = (adj.get(tileKey(cur)) ?? []).filter((nb) => remaining.has(tileKey(nb)));
      if (candidates.length === 0) break;
      candidates.sort((a, b) => {
        const da = remainingDegree(a, remaining, adj);
        const db = remainingDegree(b, remaining, adj);
        if (da !== db) return da - db;
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      cur = candidates[0]!;
      remaining.delete(tileKey(cur));
      out.push(cur);
    }
  }
  return out;
}

/**
 * String a wall-edge tile set into a 4-connected walk (path cover).
 * Throws if the output set diverges — that would be a programming error, not a
 * map failure. Gym and `check:layout` also print `sameWallEdgeTileSet`.
 */
export function orderWallEdgeTiles(tiles: readonly WallTile[]): WallTile[] {
  const unique = uniqueTiles(tiles);
  if (unique.length === 0) return [];
  const adj = buildAdj(unique);
  const out: WallTile[] = [];
  for (const comp of connectedComponents(unique, adj)) {
    out.push(...orderComponent(comp, adj));
  }
  if (!sameWallEdgeTileSet(unique, out) || out.length !== unique.length) {
    throw new Error('orderWallEdgeTiles: tile set changed (must only reorder)');
  }
  return out;
}

/**
 * Wall-floor seam for one wall tile.
 *
 * Face pick when several floor neighbours exist: first 4-adjacent floor in
 * DIRS4 order (east, west, south, north) that appears in `floorTiles`.
 * Matches how `collectWallEdges` scans neighbours, so gym attach agrees with
 * pin discovery. If none of the four neighbours is in `floorTiles`, fall back
 * to east (DIRS4[0]) — still a seam on that tile, never a new cell.
 */
export function wallAttachForTile(
  tile: WallTile,
  floorTiles: readonly WallTile[],
  tileSize: number,
): FormWallAttach {
  const floors = new Set(floorTiles.map(tileKey));
  let picked = FACE_BY_DELTA[0]!;
  for (const face of FACE_BY_DELTA) {
    if (floors.has(tileKey({ col: tile.col + face.dx, row: tile.row + face.dy }))) {
      picked = face;
      break;
    }
  }
  const originX = tile.col * tileSize;
  const originY = tile.row * tileSize;
  const half = tileSize / 2;
  let seamX = originX + half;
  let seamY = originY + half;
  if (picked.face === 'e') {
    seamX = originX + tileSize;
    seamY = originY + half;
  } else if (picked.face === 'w') {
    seamX = originX;
    seamY = originY + half;
  } else if (picked.face === 's') {
    seamX = originX + half;
    seamY = originY + tileSize;
  } else {
    seamX = originX + half;
    seamY = originY;
  }
  return {
    face: picked.face,
    nx: picked.nx,
    ny: picked.ny,
    seamX,
    seamY,
  };
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`wall-edge-path self-check: ${msg}`);
}

function isFourAdjacent(a: WallTile, b: WallTile): boolean {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row) === 1;
}

/**
 * Synthetic + set-equality invariants. Called from `check:layout` (and gym can
 * log `sameWallEdgeTileSet`). Does not touch `collectWallEdges`.
 */
export function selfCheckWallEdgePath(): void {
  const empty = orderWallEdgeTiles([]);
  assert(empty.length === 0, 'empty');

  const one = [{ col: 3, row: 4 }];
  const oneOut = orderWallEdgeTiles(one);
  assert(sameWallEdgeTileSet(one, oneOut) && oneOut.length === 1, 'single');

  const line = [
    { col: 0, row: 2 },
    { col: 0, row: 0 },
    { col: 0, row: 4 },
    { col: 0, row: 1 },
    { col: 0, row: 3 },
  ];
  const lineOut = orderWallEdgeTiles(line);
  assert(sameWallEdgeTileSet(line, lineOut), 'line set');
  for (let i = 1; i < lineOut.length; i++) {
    assert(isFourAdjacent(lineOut[i - 1]!, lineOut[i]!), `line walk ${i}`);
  }

  const loop = [
    { col: 1, row: 1 },
    { col: 2, row: 1 },
    { col: 2, row: 2 },
    { col: 1, row: 2 },
  ];
  const loopOut = orderWallEdgeTiles(loop);
  assert(sameWallEdgeTileSet(loop, loopOut), 'loop set');
  for (let i = 1; i < loopOut.length; i++) {
    assert(isFourAdjacent(loopOut[i - 1]!, loopOut[i]!), `loop walk ${i}`);
  }

  const plus = [
    { col: 5, row: 5 },
    { col: 5, row: 4 },
    { col: 5, row: 6 },
    { col: 4, row: 5 },
    { col: 6, row: 5 },
  ];
  const plusOut = orderWallEdgeTiles(plus);
  assert(sameWallEdgeTileSet(plus, plusOut), 'plus set');

  const two = [
    { col: 0, row: 0 },
    { col: 0, row: 1 },
    { col: 8, row: 3 },
    { col: 9, row: 3 },
  ];
  const twoOut = orderWallEdgeTiles(two);
  assert(sameWallEdgeTileSet(two, twoOut), 'two-component set');
  assert(isFourAdjacent(twoOut[0]!, twoOut[1]!), 'comp A walk');
  assert(isFourAdjacent(twoOut[2]!, twoOut[3]!), 'comp B walk');
}
