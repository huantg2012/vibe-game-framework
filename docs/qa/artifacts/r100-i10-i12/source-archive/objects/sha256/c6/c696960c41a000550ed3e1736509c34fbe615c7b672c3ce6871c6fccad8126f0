/** CSV-authored encounters feeding the production RiftScene. No alternate simulation. */
import { GAME_CONSTANTS } from '@/config/constants';
import { BUILD_LAB_PLACEMENTS, BUILD_LAB_SCENES, type BuildLabSceneId } from '@/generated/build-lab-data';
import { supportsRuntimeForm, type ContaminationForm } from '@/generation/contamination-draw';
import { measureOutline } from '@/generation/outline-mask';
import type { CorridorAabb, GeneratedRiftLayout, RuinFeature } from '@/generation/types';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type TileCoord } from '@/types/game-types';
import type { ContaminantNodeDef, EnemySpawnData, KindlingNodeDef, KindlingTier, TileMapData } from '@/types/map-types';

export const BUILD_LAB_VOLUMES = ['gas_mass', 'mist_bank', 'dust_swarm'] as const;
export type BuildLabVolume = typeof BUILD_LAB_VOLUMES[number];
const TILE = GAME_CONSTANTS.TILE_SIZE;

function integers(text: string, count: number): number[] {
  const values = text.split(':').map(Number);
  if (values.length !== count || values.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error(`Invalid build-lab coordinates: ${text}`);
  return values;
}
function cell(text: string): TileCoord {
  const [col, row] = integers(text, 2);
  return { col: col!, row: row! };
}
function world(point: TileCoord) { return { x: (point.col + .5) * TILE, y: (point.row + .5) * TILE }; }

export function createBuildLabLayout(sceneId: BuildLabSceneId, seed: number, volume: BuildLabVolume = 'gas_mass'): GeneratedRiftLayout {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !BUILD_LAB_VOLUMES.includes(volume)) throw new Error('Invalid build-lab seed or volume');
  const definition = BUILD_LAB_SCENES.find(row => row.id === sceneId);
  if (!definition) throw new Error(`Unknown build-lab scene: ${sceneId}`);
  const { cols, rows } = definition;
  const tiles: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(TileType.VOID));
  const land = new Uint8Array(cols * rows), walls = new Uint8Array(cols * rows);
  const features: RuinFeature[] = [];
  for (const [rectangles, type] of [[definition.floors, TileType.FLOOR], [definition.walls, TileType.WALL]] as const) {
    for (const rectangle of rectangles.split('|').filter(Boolean)) {
      const [left, top, width, height] = integers(rectangle, 4) as [number, number, number, number];
      if (!width || !height || left + width > cols || top + height > rows) throw new Error(`Build-lab rectangle outside ${sceneId}`);
      const cells: TileCoord[] = [];
      for (let row = top; row < top + height; row++) for (let col = left; col < left + width; col++) {
        if (type === TileType.WALL && !land[row * cols + col]) throw new Error('Build-lab wall outside land');
        tiles[row]![col] = type; land[row * cols + col] = 1;
        walls[row * cols + col] = type === TileType.WALL ? 1 : 0;
        cells.push({ col, row });
      }
      if (type === TileType.WALL) features.push({ kind: 'slab', cells });
    }
  }
  const tileMap: TileMapData = { cols, rows, tileSize: TILE, tiles };
  const grid = new TileGrid(tileMap);
  const spawn = cell(definition.spawn), extract = cell(definition.extract);
  const assertWalkable = (point: TileCoord, label: string) => {
    if (!grid.isWalkable(point.col, point.row)) throw new Error(`Build-lab ${label} is not walkable in ${sceneId}`);
  };
  assertWalkable(spawn, 'spawn'); assertWalkable(extract, 'extraction');
  const reachable = new Set<number>([spawn.row * cols + spawn.col]);
  const queue = [spawn];
  for (let at = 0; at < queue.length; at++) {
    const point = queue[at]!;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const col = point.col + dx!, row = point.row + dy!, index = row * cols + col;
      if (grid.isWalkable(col, row) && !reachable.has(index)) { reachable.add(index); queue.push({ col, row }); }
    }
  }
  const enemySpawns: EnemySpawnData[] = [], kindlingNodes: KindlingNodeDef[] = [], contaminantNodes: ContaminantNodeDef[] = [];
  const forms: ContaminationForm[] = [], corridors: CorridorAabb[] = [];
  for (const row of BUILD_LAB_PLACEMENTS.filter(entry => entry.scene === sceneId)) {
    const point = { col: row.col, row: row.row };
    assertWalkable(point, row.id);
    if (!reachable.has(row.row * cols + row.col)) throw new Error(`Build-lab ${row.id} is unreachable`);
    const id = `BL_${sceneId}_${row.id}`;
    if (row.kind === 'kindling' || row.kind === 'contaminant') {
      if (!['safe','contested','deep'].includes(row.tier)) throw new Error('Invalid build-lab loot tier');
      const node = { id, position: world(point), tier: row.tier as KindlingTier };
      if (row.kind === 'kindling') kindlingNodes.push(node); else contaminantNodes.push(node);
      continue;
    }
    const form: ContaminationForm = {
      substrate: row.kind === 'volume' ? volume : row.substrate,
      coverage: row.coverage as ContaminationForm['coverage'], continuity: 'monolith',
      portfolio: row.kind === 'volume' ? 'ding' : 'jia', occupancy: row.kind === 'volume' ? 'volume' : 'floor',
      lexemes: { motion: row.motion, sense: row.sense, rhythm: row.rhythm, contact: row.contact },
    };
    if (!supportsRuntimeForm(form)) throw new Error(`Build-lab ${row.id} violates the production capability catalog`);
    forms.push(form);
    if (row.kind === 'volume') {
      const [minCol, minRow, maxCol, maxRow] = integers(row.box, 4) as [number, number, number, number];
      if (maxCol <= minCol || maxRow <= minRow) throw new Error('Invalid volume rectangle');
      for (let y = minRow; y <= maxRow; y++) for (let x = minCol; x <= maxCol; x++) assertWalkable({ col: x, row: y }, 'volume');
      corridors.push({ minCol, minRow, maxCol, maxRow, coreCol: row.col, coreRow: row.row });
    } else {
      const waypoints = row.patrol.split('|').map(cell);
      waypoints.forEach(point => assertWalkable(point, 'patrol'));
      enemySpawns.push({ id, type: row.sense === 'sense_hear' ? 'rewriter' : 'infiltrator',
        spawn: point, facing: row.facing, patrol: { waypoints, mode: 'pingpong' }, form });
    }
  }
  if (forms.filter(form => form.lexemes.sense === 'sense_hear').length !== 1) throw new Error('Build-lab must retain the production one-hearing-axis contract');
  const outlineTiles = tiles.map(row => row.map(tile => tile === TileType.WALL ? TileType.FLOOR : tile));
  const outline = { seed, attempt: 0, cols, rows, tileSize: TILE, land,
    tileMap: { cols, rows, tileSize: TILE, tiles: outlineTiles }, metrics: measureOutline(land, cols, rows) };
  const wallCount = walls.reduce((sum, value) => sum + value, 0);
  return { seed, recipeId: `build-lab-${sceneId}`, fragmentTypeId: 'frag-library', contaminationAge: 'new', ruinSeverity: 'broken',
    tileMap, ruins: { seed, attempt: 0, fragmentTypeId: 'frag-library', outline, walls, features, tileMap,
      metrics: { wallCount, wallRatio: wallCount / outline.metrics.landCount, featureCount: features.length,
        leftoverConnected: reachable.size === outline.metrics.landCount - wallCount }, contaminationAge: 'new', ruinSeverity: 'broken' },
    walkableMask: grid, spawnPoint: world(spawn),
    extractionPoint: { id: `BL_${sceneId}_exit`, position: world(extract), triggerRadius: GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS },
    enemySpawns, kindlingNodes, contaminantNodes, landmarks: [],
    contaminationPins: { wallEdges: [], paintFloors: [], corridorAabbs: corridors },
    contaminationDraw: { forms, warnings: [] },
  };
}

/** Stable comparison signature includes every fixture input, excluding equipment and random UUIDs. */
export function buildLabFixtureSignature(sceneId: BuildLabSceneId, seed: number, volume: BuildLabVolume): string {
  const text = JSON.stringify({ version: 1, scene: BUILD_LAB_SCENES.find(row => row.id === sceneId),
    placements: BUILD_LAB_PLACEMENTS.filter(row => row.scene === sceneId), seed, volume: sceneId === 'periodic' ? volume : null });
  let value = 2166136261;
  for (let index = 0; index < text.length; index++) value = Math.imul(value ^ text.charCodeAt(index), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}
