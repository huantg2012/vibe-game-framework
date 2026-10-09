import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import { nativeVolumeHeightAt } from '@/generation/world-study/native-volume-raster';

/** Immutable world-space integer-pixel queries used only by actor art masks.
 * Tactical visibility, Host fields and actor poses are deliberately not cached.
 * Each presentation owns its field; a new world/recovery constructs a new one. */
export class ActorOcclusionField {
  readonly width: number;
  readonly height: number;
  private solidHeights: Float32Array | null;

  constructor(private readonly world: Pick<MasterWorld, 'layout' | 'raster' | 'roleAt'>) {
    const map = world.layout.tileMap;
    this.width = Math.ceil(map.cols * map.tileSize);
    this.height = Math.ceil(map.rows * map.tileSize);
    const heights = new Float32Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let x = 0; x < this.width; x++) {
        // Source heights already are Float32. No quantization or ground rounding.
        heights[row + x] = world.roleAt(x, y) === 'solid'
          ? nativeVolumeHeightAt(world.raster, x, y) : -Infinity;
      }
    }
    this.solidHeights = heights;
  }

  get byteLength(): number { return this.solidHeights?.byteLength ?? 0; }

  /** x/y are the integer pixels in the existing mask scan; heightLimit is the
   * original max(1, ground-y), computed once per row instead of per pixel. */
  isVisibleAtPixel(x: number, y: number, heightLimit: number): boolean {
    const heights = this.solidHeights;
    if (!heights) throw new Error('Actor occlusion field used after destruction');
    // Preserve the original OR even for a malformed NaN ground value.
    if (Number.isNaN(heightLimit)) return this.world.roleAt(x, y) !== 'solid';
    return x < 0 || y < 0 || x >= this.width || y >= this.height
      || heights[y * this.width + x]! < heightLimit;
  }

  destroy(): void { this.solidHeights = null; }
}
