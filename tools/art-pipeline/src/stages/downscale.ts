import sharp from 'sharp';
import type { Stage, RawImage, StageConfig } from '../types';
const KERNEL = { nearest: sharp.kernel.nearest, mitchell: sharp.kernel.mitchell, lanczos3: sharp.kernel.lanczos3 } as const;
export const downscale: Stage<Extract<StageConfig, { name: 'downscale' }>> = {
  name: 'downscale',
  async run(img: RawImage, cfg, ctx): Promise<RawImage> {
    const { width, height } = ctx.config.targetSize;
    // 注：sharp resize 会对含 alpha 图做预乘/反预乘；bgRemove 应在 downscale 之前。
    const { data, info } = await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } })
      .resize(width, height, { kernel: KERNEL[cfg.filter], fit: 'inside' })
      .raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  }
};
