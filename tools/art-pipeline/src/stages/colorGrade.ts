import type { Stage, RawImage, StageConfig } from '../types';
import { rgbToLuma } from '../color';
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
export const colorGrade: Stage<Extract<StageConfig, { name: 'colorGrade' }>> = {
  name: 'colorGrade',
  async run(img: RawImage, cfg): Promise<RawImage> {
    const { brightness = 1, saturation = 1, tint, tintAmount = 0 } = cfg;
    const d = Buffer.from(img.data);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] * brightness, g = d[i + 1] * brightness, b = d[i + 2] * brightness;
      const l = rgbToLuma([r, g, b]);
      r = l + (r - l) * saturation; g = l + (g - l) * saturation; b = l + (b - l) * saturation;
      if (tint && tintAmount > 0) {
        r = r + (tint[0] - r) * tintAmount; g = g + (tint[1] - g) * tintAmount; b = b + (tint[2] - b) * tintAmount;
      }
      d[i] = clamp(r); d[i + 1] = clamp(g); d[i + 2] = clamp(b);
    }
    return { ...img, data: d };
  }
};
