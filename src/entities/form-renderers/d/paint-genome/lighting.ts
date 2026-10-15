/** Receive actual world lights on the already painted Host surface. */
import { sampleWorldMaterialLight, type WorldMaterialLighting } from '../world-material-light';

const illumination: [number, number, number] = [0, 0, 0];

function heightOf(field: Float32Array, index: number): number {
  const density = field[index] ?? 0;
  return density >= .1 ? Math.min(3, 1 + density * 2) : 0;
}

/** Pixel-alpha and field are unchanged. left/top are actual world coordinates. */
export function applyPaintWorldLighting(
  pixels: Uint8ClampedArray, field: Float32Array, w: number, h: number,
  left: number, top: number, lighting: WorldMaterialLighting,
): void {
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const index = y * w + x, rgba = index * 4;
    if (!pixels[rgba + 3]) continue;
    // 1–3px material relief follows the existing body density. Sloping lips
    // receive light directionally, without a separately drawn dark outline.
    const height = heightOf(field, index);
    const nx = (heightOf(field, index - 1) - heightOf(field, index + 1)) * .5;
    const ny = (heightOf(field, index - w) - heightOf(field, index + w)) * .5;
    sampleWorldMaterialLight(lighting, left + x + .5, top + y + .5, height, nx, ny, 1, false, illumination);
    pixels[rgba] = Math.min(255, Math.round(pixels[rgba]! * illumination[0]));
    pixels[rgba + 1] = Math.min(255, Math.round(pixels[rgba + 1]! * illumination[1]));
    pixels[rgba + 2] = Math.min(255, Math.round(pixels[rgba + 2]! * illumination[2]));
  }
}
