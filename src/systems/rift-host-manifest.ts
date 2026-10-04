/** Exact Host target order, shared by offline admission and background preparation. */
import type { GeneratedRiftLayout } from '@/generation/types';
import type { TileMapData } from '@/types/map-types';
import { TileGrid } from './tile-grid';
import { GAME_CONSTANTS } from '@/config/constants';
import { mix32 } from '@/generation/seed-fork';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '@/entities/form-renderers/d/paint-genome/bake';
import { paintGenomePreparationKey, type PreparedPaintGenome } from '@/entities/form-renderers/d/paint-genome/prepared';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { colonyNucleusSeatsInFloors, resolveStopLoss } from './contamination-host-live';

export interface RiftHostManifest {
  readonly targets: readonly string[];
  readonly nucleusCounts: ReadonlyMap<string, number>;
}
/** Supplying bakes is strict: no missing or foreign entry may trigger a re-bake. */
export function createRiftHostManifest(layout: GeneratedRiftLayout, hostTileMap: TileMapData,
  prepared?: readonly PreparedPaintGenome[]): RiftHostManifest {
  const manifest = { targets: [] as string[], nucleusCounts: new Map<string, number>() };
  const grid = new TileGrid(hostTileMap), tile = GAME_CONSTANTS.TILE_SIZE, c = GAME_CONSTANTS.CONTAMINATION;
  let paintIndex = 0, volumeIndex = 0, wallIndex = 0;
  for (const form of layout.contaminationDraw.forms) {
    if (form.portfolio === 'jia') continue;
    const stop = resolveStopLoss(form);
    if (stop === 'illegal') throw new Error('Invalid authored host');
    const id = form.portfolio === 'bing' ? `ENM_BING_${String(paintIndex + 1).padStart(2, '0')}`
      : form.portfolio === 'ding' ? `ENM_DING_${String(++volumeIndex).padStart(2, '0')}` : `ENM_YI_${String(++wallIndex).padStart(2, '0')}`;
    let targetCount = 1;
    if (form.portfolio === 'bing') {
      const slot = paintIndex, pin = layout.contaminationPins.paintFloors[paintIndex++]!;
      const seed = mix32(layout.seed, id);
      const request = { substrate: form.substrate, coverage: form.coverage, seed, continuity: form.continuity,
        sense: form.lexemes.sense, rhythm: form.lexemes.rhythm, fragmentTypeId: layout.fragmentTypeId,
        veinVariant: resolvePaintVeinVariant(form.substrate, seed), geometryVersion: layout.paintGeometryVersion ?? 1 } as const;
      if (prepared && prepared[slot]?.key !== paintGenomePreparationKey(request)) throw new Error('Prepared admission Host identity differs');
      const baked = prepared ? prepared[slot]!.baked : bakePaintGenome(request);
      const floors = collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH,
        pin.floorCol * tile + tile / 2, pin.floorRow * tile + tile / 2, tile).filter(p => grid.isWalkable(p.col, p.row));
      const seats = stop.family === 'scatter_rejoin'
        ? colonyNucleusSeatsInFloors(floors, c.COLONY_NUCLEUS_COUNT_MIN, c.COLONY_NUCLEUS_COUNT_MAX, c.COLONY_NUCLEUS_MIN_TILE_GAP, 2) : [];
      manifest.nucleusCounts.set(id, stop.family === 'scatter_rejoin' ? Math.max(c.COLONY_NUCLEUS_COUNT_MIN, seats.length) : 0);
      targetCount = floors.length === 0 || (stop.family === 'scatter_rejoin' && seats.length < c.COLONY_NUCLEUS_COUNT_MIN) ? 0 : Math.max(1, seats.length);
    }
    if (stop.hittable) for (let i = 0; i < targetCount; i++) manifest.targets.push(`core:${id}:${i}`);
  }
  if (prepared && prepared.length !== paintIndex) throw new Error('Prepared admission Host count differs');
  return manifest;
}
