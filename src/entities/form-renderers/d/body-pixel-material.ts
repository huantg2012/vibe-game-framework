/** Shared, deliberately small body-ink vocabulary. Anatomy owns its shapes;
 * this module owns pigment steps and the selective one-pixel contact edge.
 * No screen-space noise, blur, normal gradient, or frame-random texture. */
import type { PaintBuf } from './genome/buffer';

export type BodyInk = readonly [number, number, number];
export const BODY_INKS = {
  soot: [[25, 30, 29], [40, 47, 43], [58, 65, 57]],
  hide: [[53, 54, 47], [92, 89, 75], [130, 123, 101]],
  bone: [[80, 78, 67], [130, 122, 101], [170, 157, 129]],
  foreign: [[32, 52, 47], [62, 91, 80], [107, 135, 115]],
} as const;

export function bodyInk(base: BodyInk, illumination: number, fold = 0): BodyInk {
  const brightness = (base[0] + base[1] + base[2]) / 3;
  const material = brightness < 65 ? BODY_INKS.soot
    : base[1] > base[0] + 4 ? BODY_INKS.foreign
    : brightness > 133 ? BODY_INKS.bone : BODY_INKS.hide;
  // Deep shadow belongs to folds/contact, not an entire polygon normal.
  const step = brightness < 65 ? (illumination > .58 ? 1 : 0) : illumination > .64 ? 2 : 1;
  return material[Math.max(0, Math.min(2, step + fold)) as 0 | 1 | 2];
}

/** A broken fold with a short dry ridge, not an all-over grain. Inputs are
 * body-part coordinates, so a limb carries its marks while articulating. */
export function bodyFold(u: number, v: number, family: string): number {
  const positive = (n: number, span: number) => ((n % span) + span) % span;
  if (family === 'growth') {
    const grain = positive(u + Math.floor(v / 5) * .45, 4.8);
    return grain < .75 && positive(v, 11) < 7 ? -1 : grain >= .75 && grain < 1.35 && positive(v, 11) < 4 ? 1 : 0;
  }
  const band = Math.floor(v / 5.5);
  const along = positive(u + band * 1.8, family === 'remnant' ? 9 : 11);
  const across = positive(v + u * (family === 'worm' ? .18 : .35), 5.5);
  if (along < 5 && across < .85) return -1;
  if (along > 1 && along < 3.8 && across >= .85 && across < 1.6) return 1;
  return 0;
}

/** Shade inside the silhouette only: never closes inter-limb negative space
 * and never changes collision anchors or grows the body's apparent size. */
export function finishBodyPixels(buf: PaintBuf): void {
  const original = new Uint8ClampedArray(buf.data);
  const opaque = (x: number, y: number) => x >= 0 && x < buf.w && y >= 0 && y < buf.h && original[(y * buf.w + x) * 4 + 3] !== 0;
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
    const i = (y * buf.w + x) * 4;
    if (!original[i + 3]) continue;
    // Lit upper contours remain open. The lower/right lip gets a broken dark
    // edge only when a substantial body lies behind it, not on thin feelers.
    if ((!opaque(x, y + 1) || !opaque(x + 1, y)) && opaque(x - 1, y) && opaque(x, y - 1)) {
      const green = original[i + 1]! > original[i]! + 5;
      const ink = green ? BODY_INKS.foreign[0] : BODY_INKS.soot[1];
      buf.data.set(ink, i);
    }
  }
}

/** The accepted insect has authored linework rather than the common volume
 * painter. Preserve its exact silhouette/linework, remap pigments to the same
 * body ink set instead of rebuilding its successful anatomy. */
export function alignAuthoredBodyInks(buf: PaintBuf): void {
  const inks = Object.values(BODY_INKS).flat();
  const memo = new Map<number, BodyInk>();
  for (let i = 0; i < buf.data.length; i += 4) {
    if (!buf.data[i + 3]) continue;
    const r = buf.data[i]!, g = buf.data[i + 1]!, b = buf.data[i + 2]!;
    const key = r * 65536 + g * 256 + b;
    let ink = memo.get(key);
    if (!ink) {
      let best = Infinity;
      for (const candidate of inks) {
        const d = (r - candidate[0]) ** 2 + (g - candidate[1]) ** 2 + (b - candidate[2]) ** 2;
        if (d < best) { best = d; ink = candidate; }
      }
      memo.set(key, ink!);
    }
    buf.data.set(ink!, i);
  }
}
