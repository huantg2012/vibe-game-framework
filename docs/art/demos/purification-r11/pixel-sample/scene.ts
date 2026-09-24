import { buildArchitectureLayers, buildIntrusionLayer } from './architecture';
import { buildDeviceLayers } from './devices';
import { MATERIALS, PixelLayer } from './raster';
import { LIGHT_RGB } from './palette';

export type SampleState = 'ambient' | 'core' | 'intrusion';
export const SAMPLE_CROP = { x: 158, y: 202, width: 442, height: 290 } as const;
export const WIDTH = 960;
export const HEIGHT = 640;

let cached: { layers: PixelLayer[] } | undefined;
export function buildSample(): { layers: PixelLayer[] } {
  if (!cached) {
    const architecture = buildArchitectureLayers();
    const foreground = architecture.splice(5);
    cached = { layers: [...architecture, ...buildDeviceLayers(), ...foreground, buildIntrusionLayer()] };
  }
  return cached;
}

/** One authored palette lookup per opaque pixel. No image input or RGB lighting overlay. */
export function renderLayer(layer: PixelLayer, state: SampleState): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  if (layer.name === 'intrusion' && state !== 'intrusion') return pixels;
  const { x: startX, y: startY, width, height } = SAMPLE_CROP;
  for (let y = startY; y < startY + height; y++) {
    for (let x = startX; x < startX + width; x++) {
      const i = y * WIDTH + x;
      const materialIndex = layer.mat[i]!;
      if (materialIndex === 0) continue;
      const material = MATERIALS[materialIndex - 1]!;
      let tone = layer.tone[i]!;
      if (layer.emission[i]) {
        if (state === 'ambient') tone = Math.min(3, tone);
      } else if (state !== 'ambient' && layer.light[i]) {
        // The source is inside the core, above its base. Perspective compresses the floor pool.
        const dx = (389 * 0.625 - x) / 182;
        const dy = (573 * 0.625 - y) / 92;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const inverse = 1 / Math.sqrt(dx * dx + dy * dy + 0.75 * 0.75);
        const incidence = Math.max(0, (layer.normalX[i]! * dx + layer.normalY[i]! * dy + layer.normalZ[i]! * 0.75) / 127 * inverse);
        const strength = Math.max(0, 1 - distance) * incidence * layer.light[i]! / 255;
        // A finite material-specific lookup makes light transitions without surface-wide dithering.
        const gain = Math.min(2.6, strength * 3.8);
        tone = Math.min(material === 'light' ? 7 : 6, tone + Math.round(gain * 4) / 4);
      }
      const rgb = LIGHT_RGB[material][Math.min(28, Math.max(0, Math.round(tone * 4)))]!;
      const p = i * 4;
      pixels[p] = rgb[0]!; pixels[p + 1] = rgb[1]!; pixels[p + 2] = rgb[2]!; pixels[p + 3] = 255;
    }
  }
  return pixels;
}

export function renderSample(state: SampleState): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (const layer of buildSample().layers) {
    const paint = renderLayer(layer, state);
    for (let i = 0; i < pixels.length; i += 4) {
      if (paint[i + 3]) {
        pixels[i] = paint[i]!; pixels[i + 1] = paint[i + 1]!; pixels[i + 2] = paint[i + 2]!; pixels[i + 3] = 255;
      }
    }
  }
  return pixels;
}
