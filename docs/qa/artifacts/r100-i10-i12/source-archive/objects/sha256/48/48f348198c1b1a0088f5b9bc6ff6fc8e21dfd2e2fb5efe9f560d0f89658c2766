/** Integer-edged raster primitives shared by browser and offline map captures. */
export class Raster {
  readonly rgba: Uint8ClampedArray;
  private readonly words: Uint32Array;
  private clip: ((x: number, y: number) => boolean) | null = null;
  private paintObserver: ((startPixel: number, endPixel: number) => void) | null = null;
  private readonly littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  constructor(readonly width: number, readonly height: number) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) throw new Error('Invalid raster dimensions');
    this.rgba = new Uint8ClampedArray(width * height * 4);
    this.words = new Uint32Array(this.rgba.buffer);
  }

  private packed(color: number): number {
    const r = color >>> 16 & 255, g = color >>> 8 & 255, b = color & 255;
    return this.littleEndian ? (0xff000000 | b << 16 | g << 8 | r) >>> 0 : (r << 24 | g << 16 | b << 8 | 255) >>> 0;
  }

  setClip(clip: ((x: number, y: number) => boolean) | null): void { this.clip = clip; }

  /** Observe accepted writes, including same-color overpaint. End is exclusive. */
  setPaintObserver(observer: ((startPixel: number, endPixel: number) => void) | null): void { this.paintObserver = observer; }

  fill(color: number): void {
    this.words.fill(this.packed(color));
    this.paintObserver?.(0, this.words.length);
  }

  pixel(x: number, y: number, color: number): void {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || this.clip && !this.clip(x, y)) return;
    const index = y * this.width + x;
    this.words[index] = this.packed(color);
    this.paintObserver?.(index, index + 1);
  }

  rect(x: number, y: number, width: number, height: number, color: number): void {
    const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(this.width, Math.ceil(x + width));
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(this.height, Math.ceil(y + height));
    if (x1 <= x0 || y1 <= y0) return;
    const packed = this.packed(color);
    for (let row = y0; row < y1; row++) {
      if (!this.clip) {
        const start = row * this.width + x0, end = row * this.width + x1;
        this.words.fill(packed, start, end);
        this.paintObserver?.(start, end);
      } else for (let col = x0; col < x1; col++) if (this.clip(col, row)) {
        const index = row * this.width + col;
        this.words[index] = packed;
        this.paintObserver?.(index, index + 1);
      }
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: number, width = 1): void {
    if (width > 1) {
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (length < .5) { this.rect(x1 - width / 2, y1 - width / 2, width, width, color); return; }
      const nx = -(y2 - y1) / length * width / 2, ny = (x2 - x1) / length * width / 2;
      this.polygon([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]], color);
      return;
    }
    let x = Math.round(x1), y = Math.round(y1);
    const endX = Math.round(x2), endY = Math.round(y2);
    const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
    const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
    let error = dx + dy;
    while (true) {
      this.pixel(x, y, color);
      if (x === endX && y === endY) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }

  polygon(points: readonly (readonly [number, number])[], color: number): void {
    if (points.length < 3) return;
    let low = Infinity, high = -Infinity;
    for (const point of points) { low = Math.min(low, point[1]); high = Math.max(high, point[1]); }
    const minY = Math.max(0, Math.floor(low)), maxY = Math.min(this.height - 1, Math.ceil(high));
    for (let y = minY; y <= maxY; y++) {
      const scan = y + .5, intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!, b = points[(i + 1) % points.length]!;
        if ((a[1] <= scan && b[1] > scan) || (b[1] <= scan && a[1] > scan)) {
          intersections.push(a[0] + (scan - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
        }
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i + 1 < intersections.length; i += 2) {
        const start = Math.ceil(intersections[i]! - .5), end = Math.ceil(intersections[i + 1]! - .5);
        this.rect(start, y, end - start, 1, color);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: number): void {
    if (rx <= 0 || ry <= 0) return;
    const startY = Math.max(0, Math.ceil(cy - ry)), endY = Math.min(this.height - 1, Math.floor(cy + ry));
    for (let y = startY; y <= endY; y++) {
      const ratio = (y - cy) / ry;
      const halfWidth = rx * Math.sqrt(Math.max(0, 1 - ratio * ratio));
      this.rect(Math.ceil(cx - halfWidth), y, Math.floor(cx + halfWidth) - Math.ceil(cx - halfWidth) + 1, 1, color);
    }
  }
}
