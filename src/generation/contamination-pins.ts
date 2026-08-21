/**
 * Contamination lexicon pin layers (DEC-076). Pure. Does not change collision.
 * Wall-after-floor four-connected count must stay 1; these only read the grid.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { mix32 } from '@/generation/seed-fork';
import type { ContaminationPins, RuinedMask, WallEdgePolyline, ClusterCorePin, CorridorAabb } from '@/generation/types';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import { SeededRandom } from '@/utils/random';

export type { ClusterCorePin, ContaminationPins, CorridorAabb, WallEdgePolyline } from '@/generation/types';

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

function collectClusterCores(ruins: RuinedMask, tileSize: number): ClusterCorePin[] {
  const land = ruins.outline.land;
  const walls = ruins.walls;
  const cols = ruins.outline.cols;
  const rows = ruins.outline.rows;
  const floors: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (land[i] && !walls[i]) floors.push(i);
  }
  if (floors.length === 0) return [];
  const age = ruins.contaminationAge ?? 'standard';
  const rng = new SeededRandom(mix32(ruins.seed, 'contam-cluster'));
  const count =
    age === 'new' ? rng.nextInt(4, 9) : age === 'standard' ? rng.nextInt(4, 12) : rng.nextInt(7, 20);
  const pins: ClusterCorePin[] = [];
  const used = new Set<number>();
  for (let n = 0; n < count; n++) {
    const cell = floors[rng.nextInt(0, floors.length - 1)]!;
    if (used.has(cell)) continue;
    used.add(cell);
    const col = cell % cols;
    const row = (cell / cols) | 0;
    if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
    pins.push({
      organismIndex: pins.length,
      cx: col * tileSize + tileSize / 2,
      cy: row * tileSize + tileSize / 2,
      floorCol: col,
      floorRow: row,
    });
  }
  return pins;
}

export function collectContaminationPins(map: TileMapData, ruins: RuinedMask): ContaminationPins {
  const tile = map.tileSize || GAME_CONSTANTS.TILE_SIZE;
  return {
    wallEdges: collectWallEdges(map),
    clusterCores: collectClusterCores(ruins, tile),
    corridorAabbs: collectCorridors(map),
  };
}
