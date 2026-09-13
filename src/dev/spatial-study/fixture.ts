/** One logical route shared by both cameras. No display projection enters this file. */
import { GAME_CONSTANTS } from '@/config/constants';
import { SPATIAL_STUDY_PLACEMENTS, SPATIAL_STUDY_SCENES, SPATIAL_STUDY_WATER } from '@/generated/spatial-study-data';
import { supportsRuntimeForm, type ContaminationForm } from '@/generation/contamination-draw';
import { measureOutline } from '@/generation/outline-mask';
import type { GeneratedRiftLayout, RuinFeature } from '@/generation/types';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type TileCoord } from '@/types/game-types';
import type { ContaminantNodeDef, EnemySpawnData, KindlingNodeDef, KindlingTier, TileMapData } from '@/types/map-types';

export const SPATIAL_SCENE = SPATIAL_STUDY_SCENES[0];
export const SPATIAL_WATER = SPATIAL_STUDY_WATER[0];
const TILE = GAME_CONSTANTS.TILE_SIZE;
export interface SpatialFixtureDefinition {
  readonly id: string; readonly cols: number; readonly rows: number;
  readonly floors: string; readonly walls: string; readonly voids?: string;
  readonly spawn: string; readonly extract: string;
  readonly fragmentTypeId?: string; readonly recipeId?: string;
}
export interface SpatialFixturePlacement {
  readonly id: string; readonly kind: string; readonly col: number; readonly row: number; readonly tier: string;
  readonly substrate: string; readonly coverage: string; readonly motion: string; readonly sense: string;
  readonly rhythm: string; readonly contact: string; readonly facing: number; readonly patrol: string;
  readonly lootPoolId?: string; readonly allowWeapon?: boolean;
}
function integers(value: string, count: number): number[] {
  const result = value.split(':').map(Number);
  if (result.length !== count || result.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error(`Invalid spatial coordinate: ${value}`);
  return result;
}
function cell(text: string): TileCoord { const [col, row] = integers(text, 2); return { col: col!, row: row! }; }
function world(p: TileCoord) { return { x: (p.col + .5) * TILE, y: (p.row + .5) * TILE }; }

export function createSpatialStudyLayout(seed: number, definition: SpatialFixtureDefinition = SPATIAL_SCENE,
  placements: readonly SpatialFixturePlacement[] = SPATIAL_STUDY_PLACEMENTS): GeneratedRiftLayout {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子须为 0–4294967295 之间的整数');
  const { cols, rows } = definition;
  const tiles: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(TileType.VOID));
  const land = new Uint8Array(cols * rows), walls = new Uint8Array(cols * rows), features: RuinFeature[] = [];
  for (const [rectangles, type] of [[definition.floors, TileType.FLOOR], [definition.voids ?? '', TileType.VOID], [definition.walls, TileType.WALL]] as const) {
    for (const text of rectangles.split('|').filter(Boolean)) {
      const [left, top, width, height] = integers(text, 4) as [number, number, number, number];
      if (!width || !height || left + width > cols || top + height > rows) throw new Error('Spatial rectangle outside map');
      const cells: TileCoord[] = [];
      for (let row = top; row < top + height; row++) for (let col = left; col < left + width; col++) {
        if (type === TileType.WALL && !land[row * cols + col]) throw new Error('Spatial wall outside floor');
        tiles[row]![col] = type; land[row * cols + col] = type === TileType.VOID ? 0 : 1; walls[row * cols + col] = type === TileType.WALL ? 1 : 0;
        cells.push({ col, row });
      }
      if (type === TileType.WALL) features.push({ kind: 'slab', cells });
    }
  }
  const tileMap: TileMapData = { cols, rows, tileSize: TILE, tiles }, grid = new TileGrid(tileMap);
  const spawn = cell(definition.spawn), extract = cell(definition.extract);
  const reachable = new Set<number>(), queue = [spawn];
  const assertFloor = (p: TileCoord) => { if (!grid.isWalkable(p.col, p.row)) throw new Error('Spatial placement is not floor'); };
  assertFloor(spawn); assertFloor(extract); reachable.add(spawn.row * cols + spawn.col);
  for (let at = 0; at < queue.length; at++) {
    const p = queue[at]!;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const col = p.col + dx!, row = p.row + dy!, key = row * cols + col;
      if (grid.isWalkable(col, row) && !reachable.has(key)) { reachable.add(key); queue.push({ col, row }); }
    }
  }
  if (!reachable.has(extract.row * cols + extract.col)) throw new Error('Unreachable spatial extraction');
  const forms: ContaminationForm[] = [], enemySpawns: EnemySpawnData[] = [];
  const kindlingNodes: KindlingNodeDef[] = [], contaminantNodes: ContaminantNodeDef[] = [];
  for (const row of placements) {
    const point = { col: row.col, row: row.row }, id = `SS_${row.id}`;
    assertFloor(point);
    if (!reachable.has(row.row * cols + row.col)) throw new Error('Unreachable spatial placement');
    if (row.kind !== 'enemy') {
      const tier = row.tier as KindlingTier;
      if (!['safe','contested','deep'].includes(tier)) throw new Error('Invalid spatial loot tier');
      const node = { id, position: world(point), tier };
      if (row.kind === 'kindling') kindlingNodes.push({ ...node, ...(row.allowWeapon === undefined ? {} : { allowWeapon: row.allowWeapon }) });
      else if (row.kind === 'contaminant') contaminantNodes.push({ ...node, ...(row.lootPoolId ? { lootPoolId: row.lootPoolId } : {}) });
      else throw new Error(`Unknown spatial placement kind: ${row.kind}`);
      continue;
    }
    const form: ContaminationForm = { substrate: row.substrate, coverage: row.coverage as ContaminationForm['coverage'],
      continuity: 'monolith', portfolio: 'jia', occupancy: 'floor',
      lexemes: { motion: row.motion, sense: row.sense, rhythm: row.rhythm, contact: row.contact } };
    if (!supportsRuntimeForm(form)) throw new Error('Spatial study enemy is outside the production catalog');
    const waypoints = row.patrol.split('|').map(cell);
    for (const point of waypoints) {
      assertFloor(point);
      if (!reachable.has(point.row * cols + point.col)) throw new Error('Unreachable spatial patrol point');
    }
    forms.push(form);
    // Match the formal Rift generator's sense-to-runtime-class mapping. A
    // sight-based insect must not consume the exactly-one hearing-body budget.
    enemySpawns.push({ id, type: form.lexemes.sense === 'sense_hear' ? 'rewriter' : 'infiltrator',
      spawn: point, facing: row.facing, patrol: { waypoints, mode: 'pingpong' }, form });
  }
  if (forms.filter(form => form.lexemes.sense === 'sense_hear').length !== 1) throw new Error('Spatial study requires one production hearing entity');
  const outlineTiles = tiles.map(row => row.map(tile => tile === TileType.WALL ? TileType.FLOOR : tile));
  const outline = { seed, attempt: 0, cols, rows, tileSize: TILE, land,
    tileMap: { cols, rows, tileSize: TILE, tiles: outlineTiles }, metrics: measureOutline(land, cols, rows) };
  const wallCount = walls.reduce((sum, value) => sum + value, 0);
  const fragmentTypeId = definition.fragmentTypeId ?? 'frag-library';
  return { seed, recipeId: definition.recipeId ?? `spatial-study-${definition.id}`, fragmentTypeId, contaminationAge: 'new', ruinSeverity: 'broken',
    tileMap, ruins: { seed, attempt: 0, fragmentTypeId, outline, walls, features, tileMap,
      metrics: { wallCount, wallRatio: wallCount / outline.metrics.landCount, featureCount: features.length,
        leftoverConnected: reachable.size === outline.metrics.landCount - wallCount }, contaminationAge: 'new', ruinSeverity: 'broken' },
    walkableMask: grid, spawnPoint: world(spawn),
    extractionPoint: { id: 'SS_exit', position: world(extract), triggerRadius: GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS },
    enemySpawns, kindlingNodes, contaminantNodes, landmarks: [],
    contaminationPins: { wallEdges: [], paintFloors: [], corridorAabbs: [] }, contaminationDraw: { forms, warnings: [] } };
}

/** Includes mechanics/data, deliberately excludes projection and random item instance ids. */
export function spatialFixtureSignature(seed: number): string {
  const input = JSON.stringify({ schema: 1, seed, scene: SPATIAL_SCENE, placements: SPATIAL_STUDY_PLACEMENTS, water: SPATIAL_WATER });
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}
