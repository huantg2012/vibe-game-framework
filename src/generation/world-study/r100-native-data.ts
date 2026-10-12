import { hydrateR100MasterWorld as hydrateRevision9World } from '../legacy-r100-v9/executor-recovery.js';
/** Pure transferable native world payload; methods are rebuilt on the receiving thread. */
import type { GeneratedRiftLayout } from '@/generation/types';
import type { MasterWorld, MasterPhysicalRole } from './r100-master-world';
import type { PollutionGradeDefinition } from './pollution-grade';
import { TileGrid } from '@/systems/tile-grid';
import { TileType } from '@/types/game-types';
import { validateSearchSites } from './search-site-placement';

export type R100NativeWorldData = Omit<MasterWorld, 'layout' | 'sight' | 'combat' | 'matterAt' | 'roleAt'> & {
  readonly gradeDefinition: PollutionGradeDefinition;
  readonly packageHash: string;
};
export function serializeR100MasterWorld(world: MasterWorld, gradeDefinition: PollutionGradeDefinition, packageHash: string): R100NativeWorldData {
  const { layout: _layout, sight: _sight, combat: _combat, matterAt: _matterAt, roleAt: _roleAt, ...data } = world;
  return { ...data, gradeDefinition, packageHash };
}
export function hydrateR100MasterWorld(native: R100NativeWorldData, layout: GeneratedRiftLayout): MasterWorld {
  if (native.algorithmRevision === 9) return hydrateRevision9World(native, layout);
  const map = layout.tileMap, width = map.cols * map.tileSize, height = map.rows * map.tileSize;
  if (map.tileSize !== 8 || native.hostTileMap.tileSize !== 32 || native.raster.width !== width
    || native.raster.height !== height || native.raster.objectId.length !== width * height)
    throw new Error('Native world transfer dimensions do not match its physical layout');
  const matterAt = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height
    && map.tiles[Math.floor(y / map.tileSize)]![Math.floor(x / map.tileSize)] !== TileType.VOID;
  const roles = new Map<number, MasterPhysicalRole>(native.definition.instances.map(instance => [instance.id, instance.role]));
  const roleAt = (x: number, y: number): MasterPhysicalRole | null => !matterAt(x, y) ? null
    : roles.get(native.raster.objectId[Math.floor(y) * width + Math.floor(x)]!) ?? null;
  const world: MasterWorld = { ...native, layout, matterAt, roleAt, combat: new TileGrid(map),
    sight: { cols: map.cols, rows: map.rows, tileSize: map.tileSize, version: 0,
      isOpaque: (col, row) => col < 0 || row < 0 || col >= map.cols || row >= map.rows || map.tiles[row]![col] === TileType.VOID } };
  validateSearchSites(world);
  return world;
}
