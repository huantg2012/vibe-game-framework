import { renderDensePlayerFrame } from '../../../../../src/entities/player-sprite-dense';
import type { SampleState } from './scene';
import { blend, gauss } from './lighting';

const W = 960;
const SCALE = 1.5;
const SIZE = 48;
export const PLAYER_FEET = { x: 310, y: 389 } as const;
const frame = renderDensePlayerFrame('up', 'idle', 0);

/** Existing actor identity and 33px body. Relighting changes color, never its source silhouette. */
export function paintSamplePlayer(pixels: Uint8ClampedArray, owners: Uint8Array, state: SampleState): void {
  const left = PLAYER_FEET.x - SIZE / 2;
  const top = PLAYER_FEET.y - 26 * SCALE;
  // Short attached shadow follows the same source as the devices.
  for (let y = PLAYER_FEET.y - 3; y < PLAYER_FEET.y + 14; y++) for (let x = PLAYER_FEET.x - 16; x < PLAYER_FEET.x + 34; x++) {
    const shadow = gauss(x, y, PLAYER_FEET.x + 7, PLAYER_FEET.y + 3, 13, 3.8) * .46;
    if (pixels[(y * W + x) * 4 + 3]) blend(pixels, (y * W + x) * 4, [17, 22, 27], shadow);
  }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const sx = Math.floor(x / SCALE), sy = Math.floor(y / SCALE);
    const from = (sy * 32 + sx) * 4;
    if (!frame[from + 3]) continue;
    const dx = left + x, dy = top + y;
    const i = dy * W + dx, p = i * 4;
    const nearEdge = sx > 0 && !frame[(sy * 32 + sx - 1) * 4 + 3];
    const topEdge = sy > 0 && !frame[((sy - 1) * 32 + sx) * 4 + 3];
    const light = state === 'ambient' ? .17 : .24 + (nearEdge ? .10 : 0);
    const sourceLum = (frame[from]! + frame[from + 1]! + frame[from + 2]!) / 3;
    const gain = sourceLum > 35 ? light : light * .22;
    pixels[p] = Math.round(frame[from]! * (1.02 + gain) + 8 * gain);
    pixels[p + 1] = Math.round(frame[from + 1]! * (1.10 + gain) + 9 * gain);
    pixels[p + 2] = Math.round(frame[from + 2]! * (1.21 + gain) + 12 * gain);
    pixels[p + 3] = 255;
    if (topEdge && sourceLum > 40) blend(pixels, p, [156, 157, 159], .18);
    if (state !== 'ambient' && nearEdge && sourceLum > 35) blend(pixels, p, [97, 166, 116], .14);
    owners[i] = 255;
  }
}
