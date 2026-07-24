import type { Stage, RawImage, RGB, StageConfig } from '../types';
import { nearestColor } from '../color';
export const quantize: Stage<Extract<StageConfig, { name: 'quantize' }>> = {
  name: 'quantize',
  async run(img: RawImage, _cfg, ctx): Promise<RawImage> {
    if (!ctx.palette.length) throw new Error('quantize: empty palette (set config.paletteFile)');
    const d = Buffer.from(img.data);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const [r, g, b] = nearestColor([d[i], d[i + 1], d[i + 2]] as RGB, ctx.palette);
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    return { ...img, data: d };
  }
};
