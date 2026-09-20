/** A sight-revision cache shared by the material and its danger deposits. Samples
 * remain at native world pixels and use the scene's existing LOS/light query.
 * Callers without a revision provider receive a fresh cache every frame. */
export class PaintSurfaceVisibility {
  private readonly values: Float32Array;
  private readonly stride: number;
  private readonly rows: number;
  private readonly point = { x: 0, y: 0 };
  private left = 0;
  private top = 0;
  private revision?: number;

  constructor(
    width: number,
    height: number,
    private readonly sampleAt: (point: Readonly<{ x: number; y: number }>) => number,
  ) {
    // Deposits cover whole touched 32px host cells, including the margins
    // beyond the anatomy texture. Those pixels share this same sight cache.
    this.stride = width + 64;
    this.rows = height + 64;
    this.values = new Float32Array(this.stride * this.rows);
  }

  begin(left: number, top: number, revision?: number): void {
    const nextLeft = Math.floor(left) - 32, nextTop = Math.floor(top) - 32;
    if (revision !== undefined && this.revision === revision && this.left === nextLeft && this.top === nextTop) return;
    this.left = nextLeft;
    this.top = nextTop;
    this.revision = revision;
    this.values.fill(-1);
  }

  at(x: number, y: number): number {
    const wx = Math.floor(x), wy = Math.floor(y);
    const col = wx - this.left, row = wy - this.top;
    const index = row * this.stride + col;
    const cached = col >= 0 && col < this.stride && row >= 0 && row < this.rows;
    if (cached && this.values[index]! >= 0) return this.values[index]!;
    this.point.x = wx + .5;
    this.point.y = wy + .5;
    const value = this.sampleAt(this.point);
    if (cached) this.values[index] = value;
    return value;
  }

  /** Keep the material's RGB and opacity contract; only sight modulates alpha. */
  clip(pixels: Uint8ClampedArray, width: number, height: number, left: number, top: number): boolean {
    let visible = false;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const alpha = (y * width + x) * 4 + 3;
      if (!pixels[alpha]) continue;
      pixels[alpha] = Math.round(pixels[alpha]! * this.at(left + x, top + y));
      visible ||= pixels[alpha]! > 0;
    }
    return visible;
  }
}
