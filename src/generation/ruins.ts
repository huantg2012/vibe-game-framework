/**
 * C2: many small porous masses on a C1 land mask.
 * Walk skeleton is shared. Identity comes from the fragment row.
 * Does not place spawn, extract, or atmosphere. Does not replace RiftScene.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import {
  ENABLED_RIFT_FRAGMENTS,
  RIFT_FRAGMENT_DATA,
  type RiftFragmentDef,
} from '@/generated/rift-fragment-data';
import { generateOutline } from '@/generation/outline-mask';
import { maxOpenYard, placeMasses } from '@/generation/masses';
import type { OutlineMask, RuinFeature, RuinMetrics, RuinedMask } from '@/generation/types';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import { SeededRandom } from '@/utils/random';

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

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function longAxis(cells: readonly { col: number; row: number }[]): number {
  if (cells.length === 0) return 0;
  let minC = cells[0]!.col;
  let maxC = cells[0]!.col;
  let minR = cells[0]!.row;
  let maxR = cells[0]!.row;
  for (const cell of cells) {
    if (cell.col < minC) minC = cell.col;
    if (cell.col > maxC) maxC = cell.col;
    if (cell.row < minR) minR = cell.row;
    if (cell.row > maxR) maxR = cell.row;
  }
  return Math.max(maxC - minC + 1, maxR - minR + 1);
}

function labelFloors(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): { labels: Int32Array; count: number } {
  const total = cols * rows;
  const labels = new Int32Array(total);
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (!land[i] || walls[i] || labels[i]) continue;
    count++;
    const stack = [i];
    labels[i] = count;
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const col = cur % cols;
      const row = (cur / cols) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny)) continue;
        const ni = at(cols, nx, ny);
        if (labels[ni] || !land[ni] || walls[ni]) continue;
        labels[ni] = count;
        stack.push(ni);
      }
    }
  }
  return { labels, count };
}

function disconnectedFloor(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  const { labels, count } = labelFloors(land, walls, cols, rows);
  if (count <= 1) return 0;
  const sizes = new Array<number>(count + 1).fill(0);
  for (let i = 0; i < labels.length; i++) sizes[labels[i]!]!++;
  let best = 0;
  for (let k = 1; k <= count; k++) if (sizes[k]! > best) best = sizes[k]!;
  let floor = 0;
  for (let i = 0; i < land.length; i++) if (land[i] && !walls[i]) floor++;
  return floor - best;
}

export function openSealedFloors(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): number {
  let punched = 0;
  for (let iter = 0; iter < 48; iter++) {
    const { labels, count } = labelFloors(land, walls, cols, rows);
    if (count <= 1) return punched;
    const sizes = new Array<number>(count + 1).fill(0);
    for (let i = 0; i < labels.length; i++) sizes[labels[i]!]!++;
    let main = 1;
    for (let k = 2; k <= count; k++) if (sizes[k]! > sizes[main]!) main = k;

    let both = -1;
    let leftoverOnly = -1;
    for (let i = 0; i < walls.length; i++) {
      if (!walls[i] || !land[i]) continue;
      const col = i % cols;
      const row = (i / cols) | 0;
      let touchMain = false;
      let touchLeftover = false;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny)) continue;
        const id = labels[at(cols, nx, ny)]!;
        if (id === main) touchMain = true;
        else if (id > 0) touchLeftover = true;
      }
      if (touchMain && touchLeftover) {
        both = i;
        break;
      }
      if (touchLeftover && leftoverOnly < 0) leftoverOnly = i;
    }
    const hit = both >= 0 ? both : leftoverOnly;
    if (hit < 0) return punched;
    walls[hit] = 0;
    punched++;
  }
  return punched;
}

function stamp(walls: Uint8Array, cells: readonly { col: number; row: number }[], cols: number): void {
  for (const cell of cells) walls[at(cols, cell.col, cell.row)] = 1;
}

function wallsFromFeatures(
  features: readonly RuinFeature[],
  cols: number,
  rows: number,
): Uint8Array {
  const walls = new Uint8Array(cols * rows);
  for (const feat of features) stamp(walls, feat.cells, cols);
  return walls;
}

function toTileMap(outline: OutlineMask, walls: Uint8Array): TileMapData {
  const tiles: number[][] = [];
  for (let row = 0; row < outline.rows; row++) {
    const line: number[] = [];
    for (let col = 0; col < outline.cols; col++) {
      const i = at(outline.cols, col, row);
      if (!outline.land[i]) line.push(TileType.VOID);
      else if (walls[i]) line.push(TileType.WALL);
      else line.push(TileType.FLOOR);
    }
    tiles.push(line);
  }
  return {
    cols: outline.cols,
    rows: outline.rows,
    tileSize: outline.tileSize,
    tiles,
  };
}

function measureRuins(
  outline: OutlineMask,
  walls: Uint8Array,
  features: readonly RuinFeature[],
): RuinMetrics {
  let wallCount = 0;
  for (let i = 0; i < walls.length; i++) if (walls[i]) wallCount++;
  return {
    wallCount,
    wallRatio: outline.metrics.landCount === 0 ? 0 : wallCount / outline.metrics.landCount,
    featureCount: features.length,
    leftoverConnected: disconnectedFloor(outline.land, walls, outline.cols, outline.rows) === 0,
  };
}

export function evaluateRuins(
  outline: OutlineMask,
  walls: Uint8Array,
  features: readonly RuinFeature[],
  def: RiftFragmentDef,
): { ok: boolean; reasons: string[]; metrics: RuinMetrics } {
  const metrics = measureRuins(outline, walls, features);
  const reasons: string[] = [];
  const g = GAME_CONSTANTS.GENERATION;

  if (features.length < def.featureCountMin) reasons.push('too-few-features');
  if (features.length > def.featureCountMax) reasons.push('too-many-features');
  if (metrics.wallRatio < g.WALL_RATIO_MIN) reasons.push('walls-too-sparse');
  if (metrics.wallRatio > g.WALL_RATIO_MAX) reasons.push('walls-too-dense');
  if (!metrics.leftoverConnected) reasons.push('splits-land');

  for (const feat of features) {
    if (feat.cells.length < 6) reasons.push('thin-mass');
    if (longAxis(feat.cells) < 4) reasons.push('short-mass');
  }
  if (maxOpenYard(outline.land, walls, outline.cols, outline.rows) > g.YARD_AREA_MAX) {
    reasons.push('yard-too-open');
  }

  const owned = new Uint8Array(walls.length);
  for (const feat of features) {
    for (const cell of feat.cells) owned[at(outline.cols, cell.col, cell.row)] = 1;
  }
  for (let i = 0; i < walls.length; i++) {
    if (walls[i] && !owned[i]) {
      reasons.push('orphan-walls');
      break;
    }
    if (walls[i] && !outline.land[i]) {
      reasons.push('wall-in-void');
      break;
    }
  }

  if (!features.every((f) => f.kind === def.massGrammar)) reasons.push('wrong-grammar');

  return { ok: reasons.length === 0, reasons, metrics };
}

export function enabledFragmentIds(): readonly string[] {
  return ENABLED_RIFT_FRAGMENTS.map((row) => row.id);
}

export function pickFragmentTypeId(seed: number): string {
  const rows = ENABLED_RIFT_FRAGMENTS;
  if (rows.length === 0) throw new Error('pickFragmentTypeId: no enabled rift fragments');
  return rows[seed % rows.length]!.id;
}

export function fragmentDef(id: string): RiftFragmentDef {
  const row = RIFT_FRAGMENT_DATA[id];
  if (!row) throw new Error(`Unknown rift fragment '${id}'`);
  if (!row.enabled) throw new Error(`Rift fragment '${id}' is not enabled this slice`);
  return row;
}

export function generateRuins(seed: number, fragmentTypeId?: string): RuinedMask {
  const id = fragmentTypeId ?? pickFragmentTypeId(seed);
  const def = fragmentDef(id);
  const outline = generateOutline(seed);
  const max = GAME_CONSTANTS.GENERATION.MAX_RUIN_ATTEMPTS;
  let lastReasons = 'unknown';

  for (let attempt = 0; attempt < max; attempt++) {
    const rng = new SeededRandom((seed ^ hashId(id) ^ (attempt * 0x9e3779b9)) >>> 0);
    const features = placeMasses(def, outline.land, outline.cols, outline.rows, rng);
    if (!features) {
      lastReasons = 'placement-failed';
      continue;
    }
    const walls = wallsFromFeatures(features, outline.cols, outline.rows);
    openSealedFloors(outline.land, walls, outline.cols, outline.rows);
    const verdict = evaluateRuins(outline, walls, features, def);
    if (verdict.ok) {
      return {
        seed,
        attempt,
        fragmentTypeId: id,
        outline,
        walls,
        features,
        tileMap: toTileMap(outline, walls),
        metrics: verdict.metrics,
      };
    }
    lastReasons = verdict.reasons.join(', ');
  }

  throw new Error(
    `generateRuins: seed ${seed} / ${id} produced no usable ruins after ${max} attempts (${lastReasons})`,
  );
}
