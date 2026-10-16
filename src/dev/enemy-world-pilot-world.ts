/** DEV visual pilot: the same fixed native constructions and material renderer
 * as the accepted map studies. No candidate search or production admission. */
import { createR100DirectConstructionRecipe } from '@/generation/world-study/r100-package';
import { constructNativeProductionLayout } from '@/generation/world-study/native-construction-recipe';
import { compileNativeTerrain } from '@/generation/world-study/native-terrain';
import { compileNativeVolumeRaster, NativeVolumeLighting, type NativeVolumeLight } from '@/generation/world-study/native-volume-raster';
import { paintMasterGround } from '@/systems/r100-world/ground';
import { bakeMasterSurface, masterVolumePalette } from '@/systems/r100-world/surface-bake';
import { MasterSurfaceRenderer } from '@/systems/r100-world/surface-renderer';
import { loadPaintedMaterial, type PaintedMaterial } from '@/systems/r100-world/painted-material';
import type { MasterSurfaceWorld } from '@/systems/r100-world/surface-world';
import { TileType } from '@/types/game-types';

export const PILOT_WORLDS = ['crystal-fibre', 'ruptured-film'] as const;
export type PilotWorldId = typeof PILOT_WORLDS[number];
export interface PilotWorld {
  id: PilotWorldId;
  label: string;
  mapSeed: number;
  renderer: MasterSurfaceRenderer;
  terrain: ReturnType<typeof compileNativeTerrain>;
  clear: (x: number, y: number) => boolean;
  shadeAt: (x:number,y:number,z:number,light:NativeVolumeLight)=>number;
  buildMs: number;
}
const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

export async function buildPilotWorld(id: PilotWorldId, progress: (text: string) => void): Promise<PilotWorld> {
  if (!import.meta.env.DEV) throw new Error('Enemy world pilot is DEV-only');
  const start = performance.now();
  const recipe = createR100DirectConstructionRecipe(id, 20261012, 'medium');
  const mapSeed = recipe.nativeConstruction!.geometrySeed;
  progress('构造关卡与真实地形支撑…'); await nextPaint();
  // The complete production CSV already includes the reviewed extensions.
  const construction = constructNativeProductionLayout(recipe);
  const definition = construction.definition;
  const terrain = compileNativeTerrain(definition, mapSeed, true);
  const families = [...new Set([definition.family, ...definition.instances.map(item => item.family ?? definition.family)])];
  progress('加载关卡原生材质…'); await nextPaint();
  const textures = await Promise.all(families.map(family => loadPaintedMaterial(family, family === definition.family ? recipe.appearance?.materialOrganization : undefined)));
  const painting: PaintedMaterial = { ...textures[0]!, appearance: recipe.appearance,
    families: Object.fromEntries(families.map((family, i) => [family, textures[i]!])) };
  progress('烘焙关卡表面…'); await nextPaint();
  const raster = compileNativeVolumeRaster(terrain.meshes, { x: 0, y: 0, width: terrain.width, height: terrain.height,
    pixelSize: 1, supportCellSize: 8, opticalHeight: 24, maxPixels: 8_388_608 });
  const world: MasterSurfaceWorld = { definition, meshes: terrain.meshes, raster, matterAt: terrain.matterAt, appearance: recipe.appearance,
    sample: { profile: { ...recipe.profile, surface: { ...recipe.profile.surface, quietness: definition.ground_quietness,
      contrast: definition.ground_contrast, coverage: definition.ground_coverage } }, topologyId: 'loops', seed: mapSeed,
      cols: definition.cols, rows: definition.rows, tileSize: 32, land: terrain.land, walls: terrain.walls,
      spawn: terrain.spawnPoint, exit: terrain.exitPoint, formations: [], flowAngle: terrain.flowAngle, deposition: terrain.deposition } };
  const ground = paintMasterGround(world);
  const volume = new NativeVolumeLighting(raster, masterVolumePalette(world), { seed: mapSeed, axis: definition.axis });
  const baked = bakeMasterSurface(world, ground, volume, painting);
  const renderer = new MasterSurfaceRenderer(world, undefined, undefined, painting, baked);
  const clear = (x: number, y: number): boolean => {
    const col = Math.floor(x / terrain.tileMap.tileSize), row = Math.floor(y / terrain.tileMap.tileSize);
    return col >= 0 && row >= 0 && col < terrain.tileMap.cols && row < terrain.tileMap.rows && terrain.tileMap.tiles[row]![col] === TileType.FLOOR;
  };
  const shadeAt = (x:number,y:number,z:number,light:NativeVolumeLight):number => {
    const steps=Math.max(2,Math.min(36,Math.ceil(Math.hypot(light.x-x,light.y-y)/7)));
    for(let i=1;i<steps;i++) {
      const t=i/steps,px=Math.floor(x+(light.x-x)*t),py=Math.floor(y+(light.y-y)*t);
      if(px>=0&&py>=0&&px<raster.width&&py<raster.height&&raster.heightField[py*raster.width+px]!>z+(light.z-z)*t+2)return .22;
    }
    return 1;
  };
  return { id, label: recipe.profile.label, mapSeed, renderer, terrain, clear, shadeAt, buildMs: performance.now() - start };
}
