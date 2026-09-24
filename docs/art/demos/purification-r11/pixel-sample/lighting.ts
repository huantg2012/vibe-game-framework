import { PixelLayer, type Point } from './raster';

const W = 960, H = 640;
export const clamp = (v: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, v));
export const gauss = (x: number, y: number, cx: number, cy: number, rx: number, ry: number): number =>
  Math.exp(-0.5 * (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));

/** Separable, finite support filter. Only light/air masks use this; paint is never blurred. */
export function soften(input: Float32Array, radius: number, rounds = 2): Float32Array {
  let data = input.slice();
  const size = radius * 2 + 1;
  for (let pass = 0; pass < rounds; pass++) {
    const horizontal = new Float32Array(W * H);
    const vertical = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      let sum = 0;
      const row = y * W;
      for (let x = -radius; x <= radius; x++) if (x >= 0 && x < W) sum += data[row + x]!;
      for (let x = 0; x < W; x++) {
        horizontal[row + x] = sum / size;
        if (x - radius >= 0) sum -= data[row + x - radius]!;
        if (x + radius + 1 < W) sum += data[row + x + radius + 1]!;
      }
    }
    for (let x = 0; x < W; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) if (y >= 0 && y < H) sum += horizontal[y * W + x]!;
      for (let y = 0; y < H; y++) {
        vertical[y * W + x] = sum / size;
        if (y - radius >= 0) sum -= horizontal[(y - radius) * W + x]!;
        if (y + radius + 1 < H) sum += horizontal[(y + radius + 1) * W + x]!;
      }
    }
    data = vertical;
  }
  return data;
}

function paintedMask(polygons: readonly (readonly Point[])[]): Float32Array {
  const p = new PixelLayer('shadow-mask');
  for (const points of polygons) p.poly(points, { material: 'void', tone: 0 });
  return Float32Array.from(p.mat, value => value ? 1 : 0);
}

export interface LightFields {
  readonly cast: Float32Array;
  readonly contact: Float32Array;
  readonly wall: Float32Array;
}

/** Receiver masks are registered to the C structures and its single core source. */
export function buildLightFields(contactLayer: PixelLayer): LightFields {
  const cast = paintedMask([
    // The two core cheeks interrupt the light close to their feet.
    [[306, 583], [330, 589], [287, 651], [247, 664], [262, 622]],
    [[430, 580], [458, 590], [548, 640], [525, 652], [453, 617]],
    // The purifier throws a low shadow away from the core, across the same lower floor.
    [[694, 593], [739, 594], [841, 639], [818, 660], [723, 628]],
    // Original guard posts, with a short, physically connected foot and falling penumbra.
    [[836, 643], [840, 643], [862, 658], [856, 658]],
    [[854, 637], [858, 637], [882, 652], [877, 652]],
    [[504, 732], [507, 732], [530, 764], [526, 764]],
  ]);
  const hard = soften(cast, 1, 1);
  const soft = soften(cast, 4, 2);
  for (let i = 0; i < hard.length; i++) hard[i] = hard[i]! * 0.45 + soft[i]! * 0.55;
  const contact = soften(Float32Array.from(contactLayer.mat, value => value ? 1 : 0), 3, 2);
  const wall = paintedMask([
    // A shadow sits behind the massive casting, including what is visible through its bore.
    [[548, 404], [590, 397], [638, 420], [685, 455], [681, 517], [579, 519], [544, 489]],
    // Core shoulders shade the wall behind them, never become outlines around the sprite.
    [[304, 396], [356, 376], [393, 418], [387, 515], [300, 527]],
    [[426, 376], [467, 398], [513, 476], [514, 523], [432, 516]],
  ]);
  return { cast: hard, contact, wall: soften(wall, 5, 2) };
}

export interface AirFields {
  readonly nearBloom: Float32Array;
  readonly farBloom: Float32Array;
}

export function buildAirFields(emission: Float32Array): AirFields {
  return { nearBloom: soften(emission, 3, 3), farBloom: soften(emission, 13, 3) };
}

export function blend(pixel: Uint8ClampedArray, offset: number, color: readonly number[], amount: number): void {
  const t = clamp(amount);
  for (let c = 0; c < 3; c++) pixel[offset + c] = Math.round(pixel[offset + c]! * (1 - t) + color[c]! * t);
}
