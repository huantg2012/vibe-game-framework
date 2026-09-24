export const MATERIALS = [
  'void', 'concrete', 'chalk', 'steel', 'paint', 'rust', 'glass', 'light', 'alien',
] as const;

export type Material = (typeof MATERIALS)[number];
export type Point = readonly [number, number];

export interface Ink {
  material: Material;
  tone: number;
  normal?: readonly [number, number, number];
  light?: number;
  emission?: boolean;
  shade?: number;
}

type PixelInk = readonly [number, number, number, number, number, number, number];

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

/** Indexed hard-edge paint. Drawing coordinates belong to the original 1536 × 1024 C. */
export class PixelLayer {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly mat: Uint8Array;
  readonly tone: Uint8Array;
  readonly normalX: Int8Array;
  readonly normalY: Int8Array;
  readonly normalZ: Int8Array;
  readonly light: Uint8Array;
  readonly emission: Uint8Array;
  private readonly scale: number;

  constructor(name: string, width = 960, height = 640, scale = 0.625) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 1 || height < 1 || !Number.isFinite(scale) || scale <= 0) {
      throw new RangeError('PixelLayer requires positive integer dimensions and a positive scale.');
    }
    this.name = name;
    this.width = width;
    this.height = height;
    this.scale = scale;
    const size = width * height;
    this.mat = new Uint8Array(size);
    this.tone = new Uint8Array(size);
    this.normalX = new Int8Array(size);
    this.normalY = new Int8Array(size);
    this.normalZ = new Int8Array(size);
    this.light = new Uint8Array(size);
    this.emission = new Uint8Array(size);
  }

  poly(points: readonly Point[], ink: Ink): void {
    this.fillPolygon(points, this.encode(ink));
  }

  clearPoly(points: readonly Point[]): void {
    this.fillPolygon(points, [0, 0, 0, 0, 0, 0, 0]);
  }

  rect(x: number, y: number, width: number, height: number, ink: Ink): void {
    if (![x, y, width, height].every(Number.isFinite) || width === 0 || height === 0) return;
    const x0 = Math.round(Math.min(x, x + width) * this.scale);
    const y0 = Math.round(Math.min(y, y + height) * this.scale);
    const x1 = Math.round(Math.max(x, x + width) * this.scale);
    const y1 = Math.round(Math.max(y, y + height) * this.scale);
    const paint = this.encode(ink);
    for (let row = Math.max(0, y0); row < Math.min(this.height, y1); row++) {
      this.span(row, x0, x1 - 1, paint);
    }
  }

  line(points: readonly Point[], ink: Ink, width?: number): void {
    if (points.length === 0 || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return;
    if (width !== undefined && (!Number.isFinite(width) || width <= 0)) return;
    const diameter = width === undefined ? 1 : Math.max(1, Math.round(width * this.scale));
    const before = Math.floor((diameter - 1) / 2);
    const after = diameter - before - 1;
    const paint = this.encode(ink);
    const vertices = points.map(([x, y]): Point => [Math.round(x * this.scale), Math.round(y * this.scale)]);
    const stamp = (x: number, y: number): void => {
      for (let row = Math.max(0, y - before); row <= Math.min(this.height - 1, y + after); row++) {
        this.span(row, x - before, x + after, paint);
      }
    };
    if (vertices.length === 1) {
      stamp(vertices[0]![0], vertices[0]![1]);
      return;
    }
    for (let segment = 1; segment < vertices.length; segment++) {
      const clipped = this.clipLine(vertices[segment - 1]!, vertices[segment]!, before, after);
      if (!clipped) continue;
      let [x0, y0, x1, y1] = clipped;
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        stamp(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const twiceError = 2 * error;
        if (twiceError >= dy) { error += dy; x0 += sx; }
        if (twiceError <= dx) { error += dx; y0 += sy; }
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, ink: Ink): void {
    if (![cx, cy, rx, ry].every(Number.isFinite) || rx < 0 || ry < 0) return;
    const x = Math.round(cx * this.scale), y = Math.round(cy * this.scale);
    const radiusX = Math.round(rx * this.scale), radiusY = Math.round(ry * this.scale);
    const paint = this.encode(ink);
    if (radiusY === 0) { this.span(y, x - radiusX, x + radiusX, paint); return; }
    const rxSquared = radiusX * radiusX, rySquared = radiusY * radiusY;
    for (let row = Math.max(0, y - radiusY); row <= Math.min(this.height - 1, y + radiusY); row++) {
      const offsetY = row - y;
      const remaining = rxSquared * (rySquared - offsetY * offsetY);
      // Integer extent search keeps the silhouette hard and deterministic, including tiny ellipses.
      let low = 0, high = radiusX;
      while (low < high) {
        const midpoint = Math.ceil((low + high) / 2);
        if (midpoint * midpoint * rySquared <= remaining) low = midpoint;
        else high = midpoint - 1;
      }
      this.span(row, x - low, x + low, paint);
    }
  }

  private encode(ink: Ink): PixelInk {
    const normal = ink.normal ?? [0, 0, 1];
    return [
      MATERIALS.indexOf(ink.material) + 1,
      Math.round(clamp(ink.tone - (ink.shade ?? 0), 0, 7)),
      Math.round(clamp(normal[0], -1, 1) * 127),
      Math.round(clamp(normal[1], -1, 1) * 127),
      Math.round(clamp(normal[2], -1, 1) * 127),
      Math.round(clamp(ink.light ?? 1, 0, 1) * 255),
      ink.emission ? 1 : 0,
    ];
  }

  private span(y: number, left: number, right: number, ink: PixelInk): void {
    if (y < 0 || y >= this.height || left > right) return;
    const start = y * this.width + Math.max(0, left);
    const end = y * this.width + Math.min(this.width - 1, right) + 1;
    if (start >= end) return;
    this.mat.fill(ink[0], start, end);
    this.tone.fill(ink[1], start, end);
    this.normalX.fill(ink[2], start, end);
    this.normalY.fill(ink[3], start, end);
    this.normalZ.fill(ink[4], start, end);
    this.light.fill(ink[5], start, end);
    this.emission.fill(ink[6], start, end);
  }

  private fillPolygon(points: readonly Point[], ink: PixelInk): void {
    if (points.length < 3 || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return;
    const vertices = points.map(([x, y]): Point => [Math.round(x * this.scale), Math.round(y * this.scale)]);
    const firstRow = Math.max(0, Math.min(...vertices.map((point) => point[1])));
    const lastRow = Math.min(this.height, Math.max(...vertices.map((point) => point[1])));
    for (let y = firstRow; y < lastRow; y++) {
      const intersections: number[] = [];
      // Pixel-center sampling and half-open edges prevent cracks between neighboring faces.
      const scanY = 2 * y + 1;
      for (let edge = 0; edge < vertices.length; edge++) {
        const a = vertices[edge]!, b = vertices[(edge + 1) % vertices.length]!;
        if ((2 * a[1] <= scanY && 2 * b[1] > scanY) || (2 * b[1] <= scanY && 2 * a[1] > scanY)) {
          intersections.push(a[0] + ((scanY - 2 * a[1]) * (b[0] - a[0])) / (2 * (b[1] - a[1])));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        this.span(y, Math.ceil(intersections[index]! - 0.5), Math.ceil(intersections[index + 1]! - 0.5) - 1, ink);
      }
    }
  }

  private clipLine(a: Point, b: Point, before: number, after: number): readonly [number, number, number, number] | null {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let entry = 0, exit = 1;
    const bounds: readonly Point[] = [
      [-dx, a[0] + after], [dx, this.width - 1 + before - a[0]],
      [-dy, a[1] + after], [dy, this.height - 1 + before - a[1]],
    ];
    for (const [direction, distance] of bounds) {
      if (direction === 0) { if (distance < 0) return null; continue; }
      const ratio = distance / direction;
      if (direction < 0) entry = Math.max(entry, ratio);
      else exit = Math.min(exit, ratio);
      if (entry > exit) return null;
    }
    return [
      Math.round(a[0] + entry * dx), Math.round(a[1] + entry * dy),
      Math.round(a[0] + exit * dx), Math.round(a[1] + exit * dy),
    ];
  }
}
