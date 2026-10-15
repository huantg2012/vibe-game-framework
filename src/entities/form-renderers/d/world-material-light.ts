/** CPU material lighting for optional world-adapted bodies. Shares the ground
 * renderer's received-light model; callers own visibility and world shadows.
 */
import type { NativeVolumeLight } from '@/generation/world-study/native-volume-raster';

export interface WorldMaterialLighting {
  readonly lights: readonly NativeVolumeLight[];
  /** Real world height/VOID light-path sampling. Return received fraction 0–1. */
  readonly shadeAt?: (x: number, y: number, z: number, light: NativeVolumeLight) => number;
}

type MutableLight = [number, number, number];
const SKY_LENGTH = Math.hypot(.4, .5, .76);

/** Same ambient, diffuse, squared falloff and tone response as surface-renderer.
 * Supply out when sampling pixels to avoid per-pixel allocations.
 */
export function sampleWorldMaterialLight(
  context: WorldMaterialLighting, x: number, y: number, z: number,
  nx: number, ny: number, nz: number, volume: boolean,
  out: MutableLight = [0, 0, 0],
): readonly [number, number, number] {
  const normalLength = Math.max(.0001, Math.hypot(nx, ny, nz));
  nx /= normalLength; ny /= normalLength; nz /= normalLength;
  const hemisphere = .48 + .52 * Math.max(0, (nx * -.4 + ny * -.5 + nz * .76) / SKY_LENGTH);
  const ambient = volume ? .46 * hemisphere : .36;
  let r = ambient, g = ambient, b = ambient;
  for (let index = 0; index < Math.min(8, context.lights.length); index++) {
    const light = context.lights[index]!;
    if (light.radius <= 0 || light.intensity <= 0) continue;
    const dx = light.x - x, dy = light.y - y, dz = light.z - z;
    const distance = Math.hypot(dx, dy, dz);
    const fall = Math.max(0, 1 - distance / light.radius);
    let energy = fall * fall * light.intensity;
    if (energy <= .001) continue;
    if (context.shadeAt) energy *= Math.max(0, Math.min(1, context.shadeAt(x, y, z, light)));
    const diffuse = Math.max(0, (nx * dx + ny * dy + nz * dz) / Math.max(.01, distance));
    const received = diffuse * energy * (volume ? 1 : 1.25);
    r += light.color[0] * received;
    g += light.color[1] * received;
    b += light.color[2] * received;
  }
  out[0] = r / (1 + .28 * r) * 1.15;
  out[1] = g / (1 + .28 * g) * 1.15;
  out[2] = b / (1 + .28 * b) * 1.15;
  return out;
}
