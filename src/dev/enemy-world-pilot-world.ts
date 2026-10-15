/** DEV visual pilot: the same fixed native constructions and material renderer
 * as the accepted map studies. No candidate search or production admission. */
import { createR100NativeSpatialDevelopmentRecipe } from '@/generation/world-study/r100-package';
import { constructNativeSpatialReference, parseNativeSpatialConstructionReference } from '@/generation/world-study/native-spatial-construction-reference';
import { parseNativeConstructionShore } from '@/generation/world-study/native-spatial-construction-shore';
import { parseNativeConstructionExtensionPolicy } from '@/generation/world-study/native-spatial-construction-extension';
import { compileNativeTerrain } from '@/generation/world-study/native-terrain';
import { compileNativeVolumeRaster, NativeVolumeLighting, type NativeVolumeLight } from '@/generation/world-study/native-volume-raster';
import { paintMasterGround } from '@/systems/r100-world/ground';
import { bakeMasterSurface, masterVolumePalette } from '@/systems/r100-world/surface-bake';
import { MasterSurfaceRenderer } from '@/systems/r100-world/surface-renderer';
import { loadPaintedMaterial, type PaintedMaterial } from '@/systems/r100-world/painted-material';
import type { MasterSurfaceWorld } from '@/systems/r100-world/surface-world';
import { TileType } from '@/types/game-types';
import registryCSV from '../../data/rift-native-construction-samples.csv?raw';
import extensionModuleSource from '@/generation/world-study/native-spatial-construction-extension.ts?raw';

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
async function source(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.text();
}
const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const sha = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), byte => byte.toString(16).padStart(2, '0')).join('');

export async function buildPilotWorld(id: PilotWorldId, progress: (text: string) => void): Promise<PilotWorld> {
  if (!import.meta.env.DEV) throw new Error('Enemy world pilot is DEV-only');
  const start = performance.now();
  const row = registryCSV.trim().split(/\r?\n/).slice(1).map(line => line.split(',')).find(row => row[0] === id);
  if (!row) throw new Error(`Unregistered map study ${id}`);
  const [referenceCSV, shoreCSV, extensionCSV] = await Promise.all([
    source(row[2]!), source(row[3]!), source('/data/rift-native-construction-extension.csv'),
  ]);
  const [referenceHash, shoreHash, extensionHash, moduleHash] = await Promise.all([referenceCSV, shoreCSV, extensionCSV, extensionModuleSource].map(sha));
  const reference = parseNativeSpatialConstructionReference(referenceCSV, referenceHash!);
  const recipe = createR100NativeSpatialDevelopmentRecipe(id, reference.seed, 'medium');
  progress('构造关卡与真实地形支撑…'); await nextPaint();
  const construction = constructNativeSpatialReference(recipe, reference, undefined,
    { policy: parseNativeConstructionShore(shoreCSV, shoreHash!), combinedSourceHash: await sha(JSON.stringify({ referenceSHA256: referenceHash, shoreSHA256: shoreHash })) },
    { policy: parseNativeConstructionExtensionPolicy(extensionCSV, extensionHash!), moduleSourceHash: moduleHash!,
      combinedSourceHash: await sha(JSON.stringify({ referenceSHA256: referenceHash, shoreSHA256: shoreHash, extensionSHA256: extensionHash, extensionModuleSHA256: moduleHash })) });
  const definition = construction.definition;
  const terrain = compileNativeTerrain(definition, reference.seed, true);
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
      contrast: definition.ground_contrast, coverage: definition.ground_coverage } }, topologyId: 'loops', seed: reference.seed,
      cols: definition.cols, rows: definition.rows, tileSize: 32, land: terrain.land, walls: terrain.walls,
      spawn: terrain.spawnPoint, exit: terrain.exitPoint, formations: [], flowAngle: terrain.flowAngle, deposition: terrain.deposition } };
  const ground = paintMasterGround(world);
  const volume = new NativeVolumeLighting(raster, masterVolumePalette(world), { seed: reference.seed, axis: definition.axis });
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
  return { id, label: row[1]!, mapSeed: reference.seed, renderer, terrain, clear, shadeAt, buildMs: performance.now() - start };
}
