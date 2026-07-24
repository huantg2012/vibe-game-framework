import type { Stage, RawImage, RGB, StageConfig } from '../types';
import { rgbDistance } from '../color';
export const bgRemove: Stage<Extract<StageConfig, { name: 'bgRemove' }>> = {
  name: 'bgRemove',
  async run(img: RawImage, cfg): Promise<RawImage> {
    const { color, threshold } = cfg;
    const d = Buffer.from(img.data);
    for (let i = 0; i < d.length; i += 4) {
      if (rgbDistance([d[i], d[i + 1], d[i + 2]] as RGB, color) < threshold) d[i + 3] = 0;
    }
    return { ...img, data: d };
  }
};
