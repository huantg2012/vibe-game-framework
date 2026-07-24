import type { Stage, RawImage, StageConfig } from '../types';
function bbox(img: RawImage) {
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] !== 0) {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}
export const cropPad: Stage<Extract<StageConfig, { name: 'cropPad' }>> = {
  name: 'cropPad',
  async run(img: RawImage, _cfg, ctx): Promise<RawImage> {
    const { width: tw, height: th } = ctx.config.targetSize;
    const out = Buffer.alloc(tw * th * 4);
    const bb = bbox(img);
    if (!bb) return { data: out, width: tw, height: th };
    const cw = bb.maxX - bb.minX + 1, ch = bb.maxY - bb.minY + 1;
    const offX = Math.max(0, Math.floor((tw - cw) / 2));
    const offY = Math.max(0, Math.floor((th - ch) / 2));
    for (let y = 0; y < ch && y + offY < th; y++) for (let x = 0; x < cw && x + offX < tw; x++) {
      const s = ((bb.minY + y) * img.width + (bb.minX + x)) * 4;
      const dst = ((y + offY) * tw + (x + offX)) * 4;
      out[dst] = img.data[s]; out[dst + 1] = img.data[s + 1]; out[dst + 2] = img.data[s + 2]; out[dst + 3] = img.data[s + 3];
    }
    return { data: out, width: tw, height: th };
  }
};
