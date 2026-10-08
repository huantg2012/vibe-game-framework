/** One static surface shared by rendering and every visual ground attachment.
 * Gameplay still owns the unchanged XY floor/collision graph. No renderer may
 * add another vertical offset or a different interpolation of these samples. */
export interface GroundLandformDefinition {
  readonly id: string;
  readonly kind: 'ridge' | 'scour' | 'shelf';
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly angle: number;
  readonly height: number;
}

export interface GroundNormal { x: number; y: number; z: number }

export const GROUND_SAMPLE_STEP = 8;

interface Landform extends GroundLandformDefinition { cosine: number; sine: number }

export class GroundHeightField {
  readonly step = GROUND_SAMPLE_STEP;
  readonly columns: number;
  readonly rows: number;
  private readonly heights: Float32Array;
  private readonly minimum: number;
  private readonly maximum: number;
  private readonly maximumSlope: number;

  constructor(readonly width: number, readonly height: number,
    definitions: readonly GroundLandformDefinition[]) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
      || width % this.step !== 0 || height % this.step !== 0) {
      throw new Error('Ground dimensions must be positive multiples of the shared sample step.');
    }
    const forms: Landform[] = definitions.map(definition => {
      if (![definition.x, definition.y, definition.radiusX, definition.radiusY, definition.angle, definition.height].every(Number.isFinite)
        || definition.radiusX <= 0 || definition.radiusY <= 0
        || !['ridge', 'scour', 'shelf'].includes(definition.kind)) {
        throw new Error(`Invalid ground landform: ${definition.id}`);
      }
      const angle = definition.angle * Math.PI / 180;
      return { ...definition, cosine: Math.cos(angle), sine: Math.sin(angle) };
    });
    this.columns = width / this.step + 1;
    this.rows = height / this.step + 1;
    this.heights = new Float32Array(this.columns * this.rows);
    let minimum = Infinity, maximum = -Infinity, maximumSlope = 0;
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.columns; col++) {
      const x = col * this.step, y = row * this.step;
      let elevation = 0;
      for (const form of forms) {
        const dx = x - form.x, dy = y - form.y;
        const u = (dx * form.cosine + dy * form.sine) / form.radiusX;
        const v = (-dx * form.sine + dy * form.cosine) / form.radiusY;
        const distanceSquared = u * u + v * v;
        // A shelf is a broad deposit, never a step. Its shoulders blend into
        // the same traversable surface; the two other shapes form long dunes
        // and washed-out channels rather than noise-displaced hills.
        const influence = form.kind === 'shelf'
          ? Math.exp(-distanceSquared * distanceSquared * .8)
          : Math.exp(-distanceSquared * 1.2);
        elevation += form.height * influence;
      }
      this.heights[row * this.columns + col] = elevation;
      minimum = Math.min(minimum, elevation); maximum = Math.max(maximum, elevation);
    }
    for (let row = 0; row < this.rows - 1; row++) for (let col = 0; col < this.columns - 1; col++) {
      const a = this.heights[row * this.columns + col]!;
      const b = this.heights[(row + 1) * this.columns + col]!;
      const c = this.heights[row * this.columns + col + 1]!;
      const d = this.heights[(row + 1) * this.columns + col + 1]!;
      maximumSlope = Math.max(maximumSlope, Math.hypot(c - a, b - a) / this.step,
        Math.hypot(d - b, d - c) / this.step);
    }
    this.minimum = minimum; this.maximum = maximum; this.maximumSlope = maximumSlope;
    if (maximumSlope > .4) {
      throw new Error(`Ground slope ${maximumSlope.toFixed(3)} exceeds the traversable stage limit 0.4; widen the CSV landform.`);
    }
  }

  /** The exact triangles used by StageTerrain: a-b-c, then c-b-d. */
  heightAt(x: number, y: number): number {
    const gx = Math.max(0, Math.min(this.width, x)) / this.step;
    const gy = Math.max(0, Math.min(this.height, y)) / this.step;
    const col = Math.min(this.columns - 2, Math.floor(gx));
    const row = Math.min(this.rows - 2, Math.floor(gy));
    const u = gx - col, v = gy - row, index = row * this.columns + col;
    const a = this.heights[index]!, b = this.heights[index + this.columns]!;
    const c = this.heights[index + 1]!, d = this.heights[index + this.columns + 1]!;
    return u + v <= 1 ? a + (c - a) * u + (b - a) * v
      : d + (b - d) * (1 - u) + (c - d) * (1 - v);
  }

  normalAt(x: number, y: number, out: GroundNormal): GroundNormal {
    const gx = Math.max(0, Math.min(this.width, x)) / this.step;
    const gy = Math.max(0, Math.min(this.height, y)) / this.step;
    const col = Math.min(this.columns - 2, Math.floor(gx));
    const row = Math.min(this.rows - 2, Math.floor(gy));
    const index = row * this.columns + col;
    const a = this.heights[index]!, b = this.heights[index + this.columns]!;
    const c = this.heights[index + 1]!, d = this.heights[index + this.columns + 1]!;
    const first = gx - col + gy - row <= 1;
    const dx = (first ? c - a : d - b) / this.step;
    const dz = (first ? b - a : d - c) / this.step;
    const inverseLength = 1 / Math.hypot(dx, 1, dz);
    out.x = -dx * inverseLength; out.y = inverseLength; out.z = -dz * inverseLength;
    return out;
  }

  copyHeights(): Float32Array { return this.heights.slice(); }

  snapshot(): Record<string, number | string> {
    return { step: this.step, columns: this.columns, rows: this.rows,
      minimum: this.minimum, maximum: this.maximum, range: this.maximum - this.minimum,
      maximumSlope: this.maximumSlope, interpolation: 'same a-b-c / c-b-d triangles as terrain' };
  }
}
