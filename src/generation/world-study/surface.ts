/** Independent map bake: missing space stays black; matter exists on land. */
import { Raster } from './raster';
import { worldLandAt, worldWallAt } from './shape';
import { paintGroundMaterial } from './ground-material';
import { paintMaterialForms } from './material-forms';
import type { WorldSample } from './types';

export interface WorldSurface {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
}

/** This is missing space, not a material/palette value or an unlit wall. */
export const WORLD_VOID_COLOR = 0x000000;

export function renderWorldSurface(sample: WorldSample): WorldSurface {
  const width = sample.cols * sample.tileSize, height = sample.rows * sample.tileSize;
  const raster = new Raster(width, height);
  const floorMask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    floorMask[y * width + x] = worldLandAt(sample, x, y) && !worldWallAt(sample, x, y) ? 1 : 0;
  }
  raster.fill(WORLD_VOID_COLOR);
  paintGroundMaterial(raster, sample, floorMask);
  paintMaterialForms(raster, sample, floorMask);
  // No material operator or ground embellishment can give absent space a surface.
  raster.setClip(null);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!floorMask[y * width + x]) raster.pixel(x, y, WORLD_VOID_COLOR);
  }
  return { width, height, rgba: raster.rgba };
}
