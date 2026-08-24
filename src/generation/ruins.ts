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
import { leftoverDisconnectedCount, openSealedFloors } from '@/generation/connectivity';
import { generateOutline } from '@/generation/outline-mask';
import { massGrammarVecEqual, maxOpenYard, placeMasses, resolveMassGrammar } from '@/generation/masses';
import type { OutlineMask, RuinFeature, RuinMetrics, RuinedMask } from '@/generation/types';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import { SeededRandom } from '@/utils/random';

export { openSealedFloors } from '@/generation/connectivity';

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
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
    leftoverConnected: leftoverDisconnectedCount(outline.land, walls, outline.cols, outline.rows) === 0,
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

  const expectedVec = resolveMassGrammar(def.massGrammar);
  if (
    !features.every((f) => {
      try {
        return massGrammarVecEqual(resolveMassGrammar(f.kind), expectedVec);
      } catch {
        return false;
      }
    })
  ) {
    reasons.push('wrong-grammar');
  }

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
