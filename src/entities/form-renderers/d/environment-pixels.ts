/** R3 environmental bodies: world-pixel clusters, shared by production and evidence. */
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
export type Ink = readonly [number, number, number];
export const ENV_INK = {
  seam: [20, 28, 28], shadow: [36, 46, 44], body: [64, 79, 73], ridge: [100, 117, 103],
  ash: [112, 113, 102], ashShadow: [59, 65, 62], oil: [29, 39, 39], oilRidge: [69, 94, 86],
  metal: [88, 91, 83], rust: [92, 75, 60], teal: [54, 154, 132], lit: [128, 198, 168],
} as const;
export function stageOf(c: CoverageId): number { return c === 'infiltrate' ? 0 : c === 'rewrite' ? 1 : 2; }
export function activityOf(p?: FormVisualPose): number {
  return p?.activity?.phase === 'rest' ? 0 : p?.activity?.phase === 'waking' ? p.activity.progress : 1;
}
export function putPixel(out: Uint8ClampedArray, w: number, h: number, x: number, y: number, ink: Ink, alpha = 255): void {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  out[i] = ink[0]; out[i+1] = ink[1]; out[i+2] = ink[2]; out[i+3] = alpha;
}
export function pixelLine(out: Uint8ClampedArray, w: number, h: number, ax: number, ay: number, bx: number, by: number, ink: Ink, alpha = 255, width = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(bx-ax), Math.abs(by-ay))));
  for (let i = 0; i <= n; i++) for (let k = 0; k < width; k++)
    putPixel(out,w,h,ax+(bx-ax)*i/n,ay+(by-ay)*i/n+k,ink,alpha);
}
/** Stable small-cell variation, never temporally random noise. */
export function cluster(x: number, y: number, seed: number): number {
  let n = Math.imul(Math.floor(x/3)+seed, 374761393) ^ Math.imul(Math.floor(y/2)+11,668265263);
  n = Math.imul(n ^ (n>>>13),1274126177); return (n>>>0)%11;
}
