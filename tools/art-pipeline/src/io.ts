import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import type { RawImage, RGB } from './types';
export async function loadRaw(file: string): Promise<RawImage> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}
export async function saveRaw(img: RawImage, file: string): Promise<void> {
  await sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } }).png().toFile(file);
}
const hexToRgb = (h: string): RGB => {
  const n = parseInt(h.replace('#',''), 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
};
export async function loadPalette(file: string): Promise<RGB[]> {
  const j = JSON.parse(await readFile(file, 'utf8')) as { colors: string[] };
  return j.colors.map(hexToRgb);
}
