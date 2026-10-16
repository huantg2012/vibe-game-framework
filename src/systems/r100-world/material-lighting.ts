import type { WorldMaterialLighting } from '@/entities/form-renderers/d/world-material-light';
import type { NativeVolumeLight, NativeVolumeRaster } from '@/generation/world-study/native-volume-raster';

/** The same geometry-height shadow test used by the native surface receiver.
 * Lighting never grants tactical visibility; actor/paint FOV still owns alpha. */
export function createNativeMaterialLighting(raster: Pick<NativeVolumeRaster, 'width' | 'height' | 'heightField'>,
  lights: readonly NativeVolumeLight[], matterAt?: (x: number, y: number) => boolean): WorldMaterialLighting {
  const darkCell = (x: number, y: number): boolean => {
    const px = (x + .5) * 8, py = (y + .5) * 8;
    return px < 0 || py < 0 || px >= raster.width || py >= raster.height || !matterAt!(px, py);
  };
  // Match the native receiver's materialLightPath, including diagonal corner
  // rejection. The first light is the shoulder lamp and has the same exception.
  const hasMaterialPath = (x: number, y: number, light: NativeVolumeLight): boolean => {
    let cx = Math.floor(x / 8), cy = Math.floor(y / 8);
    const ex = Math.floor(light.x / 8), ey = Math.floor(light.y / 8);
    const dx = light.x - x, dy = light.y - y, sx = Math.sign(dx), sy = Math.sign(dy);
    const tx = Math.abs(dx) > .00001 ? 8 / Math.abs(dx) : 1e8;
    const ty = Math.abs(dy) > .00001 ? 8 / Math.abs(dy) : 1e8;
    let nx = Math.abs(dx) > .00001 ? ((cx + Math.max(sx, 0)) * 8 - x) / dx : 1e8;
    let ny = Math.abs(dy) > .00001 ? ((cy + Math.max(sy, 0)) * 8 - y) / dy : 1e8;
    for (let i = 0; i < 96; i++) {
      if (cx === ex && cy === ey) return true;
      if (Math.abs(nx - ny) < .000001) {
        if (darkCell(cx + sx, cy) || darkCell(cx, cy + sy)) return false;
        cx += sx; cy += sy; nx += tx; ny += ty;
      } else if (nx < ny) { cx += sx; nx += tx; }
      else { cy += sy; ny += ty; }
      if (darkCell(cx, cy)) return false;
    }
    return false;
  };
  return { lights, shadeAt(x, y, z, light) {
    if (matterAt && light !== lights[0] && !hasMaterialPath(x, y, light)) return 0;
    const steps = Math.max(2, Math.min(36, Math.ceil(Math.hypot(light.x - x, light.y - y) / 7)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps, px = Math.floor(x + (light.x - x) * t), py = Math.floor(y + (light.y - y) * t);
      if (px >= 0 && py >= 0 && px < raster.width && py < raster.height
        && raster.heightField[py * raster.width + px]! > z + (light.z - z) * t + 2) return .22;
    }
    return 1;
  } };
}
