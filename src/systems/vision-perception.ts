/** Display-only perception field. It never decides tactical visibility. */
export type VisionPresentation = 'legacy' | 'perceptual' | 'light-eater';

export const PERCEPTION_PIXEL_SIZE = 2;

function saturate(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smooth(value: number): number {
  const t = saturate(value);
  return t * t * (3 - 2 * t);
}

/** Clear near the body, continuous detail loss toward the authoritative limit. */
export function perceptionTransmission(distance: number, range: number, clearRadius: number): number {
  if (range <= 0 || distance >= range) return 0;
  const clear = Math.min(clearRadius, range * 0.4);
  if (distance <= clear) return 1;
  const falloff = smooth((distance - clear) / Math.max(1, range - clear));
  return 1 - falloff;
}

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

/** Uneven drifting deposits, rather than an outline or periodic pulse. */
export function perceptionVeil(worldX: number, worldY: number, elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  const broad = noise((worldX + seconds * 6.8) / 92, (worldY - seconds * 4.1) / 74);
  const broken = noise((worldX - seconds * 4.4) / 31, (worldY + seconds * 4.3) / 39);
  return smooth((broad * 0.74 + broken * 0.26 - 0.31) / 0.43);
}

export function advancePerceptionTime(elapsedMs: number, deltaMs: number): number {
  return elapsedMs + (Number.isFinite(deltaMs) ? Math.max(0, deltaMs) : 0);
}

export interface PerceptionRaster {
  readonly width: number;
  readonly height: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly originX: number;
  readonly originY: number;
  readonly clearRadius: number;
  readonly maximumRange: number;
  readonly rangeAt: (angle: number) => number;
  /** Existing authoritative LOS, evaluated only when the geometric cache changes. */
  readonly lineOfSightAt: (x: number, y: number) => boolean;
}

export interface PerceptionGeometryScratch {
  /** Shared cell corners: 0 unchecked, 1 blocked/outside range, 2 clear. */
  readonly cornerVisibility: Uint8Array;
}

/** Store only transmission permitted by the original range and exact LOS. */
export function rebuildPerceptionField(field: Float32Array, raster: PerceptionRaster, scratch: PerceptionGeometryScratch): void {
  field.fill(0);
  scratch.cornerVisibility.fill(0);
  const pixel = PERCEPTION_PIXEL_SIZE;
  const margin = pixel * Math.SQRT1_2;
  const left = Math.max(0, Math.floor((raster.originX - raster.maximumRange - raster.worldX) / pixel));
  const right = Math.min(raster.width, Math.ceil((raster.originX + raster.maximumRange - raster.worldX) / pixel));
  const top = Math.max(0, Math.floor((raster.originY - raster.maximumRange - raster.worldY) / pixel));
  const bottom = Math.min(raster.height, Math.ceil((raster.originY + raster.maximumRange - raster.worldY) / pixel));
  for (let y = top; y < bottom; y++) {
    const wy = raster.worldY + (y + 0.5) * pixel;
    const dy = wy - raster.originY;
    for (let x = left; x < right; x++) {
      const wx = raster.worldX + (x + 0.5) * pixel;
      const dx = wx - raster.originX;
      const distance = Math.hypot(dx, dy);
      const range = raster.rangeAt(Math.atan2(dy, dx));
      // Conservative cell coverage: a 2px texel never extends the range silhouette.
      const transmission = perceptionTransmission(distance + margin, range, raster.clearRadius);
      if (transmission > 0 && perceptionCellVisible(x, y, raster, scratch)) {
        field[y * raster.width + x] = transmission;
      }
    }
  }
}

function perceptionCellVisible(x: number, y: number, raster: PerceptionRaster, scratch: PerceptionGeometryScratch): boolean {
  for (let cy = y; cy <= y + 1; cy++) for (let cx = x; cx <= x + 1; cx++) {
    const index = cy * (raster.width + 1) + cx;
    let visible = scratch.cornerVisibility[index]!;
    if (visible === 0) {
      const wx = raster.worldX + cx * PERCEPTION_PIXEL_SIZE;
      const wy = raster.worldY + cy * PERCEPTION_PIXEL_SIZE;
      const dx = wx - raster.originX, dy = wy - raster.originY;
      visible = Math.hypot(dx, dy) < raster.rangeAt(Math.atan2(dy, dx)) && raster.lineOfSightAt(wx, wy) ? 2 : 1;
      scratch.cornerVisibility[index] = visible;
    }
    if (visible !== 2) return false;
  }
  return true;
}

export interface PerceptionPaint {
  readonly width: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly originX: number;
  readonly originY: number;
  readonly clearRadius: number;
  readonly corruption: number;
  readonly elapsedMs: number;
  readonly voidColor: number;
  readonly contaminationColor: number;
}

/** Writes an ordinary alpha-darkness mask; unknown cells remain fully opaque. */
export function paintPerceptionField(data: Uint8ClampedArray, field: Float32Array, paint: PerceptionPaint): void {
  const vr = (paint.voidColor >> 16) & 255, vg = (paint.voidColor >> 8) & 255, vb = paint.voidColor & 255;
  const cr = (paint.contaminationColor >> 16) & 255, cg = (paint.contaminationColor >> 8) & 255;
  const cb = paint.contaminationColor & 255;
  // Remove the legacy saturated teal. The veil borrows only a trace of that hue.
  const grey = cr * 0.2126 + cg * 0.7152 + cb * 0.0722;
  const tr = grey * 0.92 + cr * 0.08, tg = grey * 0.92 + cg * 0.08, tb = grey * 0.92 + cb * 0.08;
  for (let i = 0; i < field.length; i++) {
    const offset = i * 4;
    const base = field[i]!;
    if (base <= 0) {
      data[offset] = vr; data[offset + 1] = vg; data[offset + 2] = vb; data[offset + 3] = 255;
      continue;
    }
    const wx = paint.worldX + (i % paint.width + 0.5) * PERCEPTION_PIXEL_SIZE;
    const wy = paint.worldY + (Math.floor(i / paint.width) + 0.5) * PERCEPTION_PIXEL_SIZE;
    const distance = Math.hypot(wx - paint.originX, wy - paint.originY);
    const bodyProtection = smooth((distance - paint.clearRadius) / 44);
    const deposit = paint.corruption * bodyProtection * perceptionVeil(wx, wy, paint.elapsedMs);
    const visibility = base * (1 - deposit * 0.60);
    // Scattering disappears with admitted transmission. A constant fog colour
    // at near-zero transmission would draw a grey fan against unknown black.
    const tint = deposit * 0.16 * Math.sqrt(base);
    data[offset] = vr + (tr - vr) * tint;
    data[offset + 1] = vg + (tg - vg) * tint;
    data[offset + 2] = vb + (tb - vb) * tint;
    data[offset + 3] = Math.round((1 - visibility) * 255);
  }
}
