import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import { nativeVolumeHeightAt } from '@/generation/world-study/native-volume-raster';

const ROW_BLOCK_WIDTH = 16;
interface ActorMaskRowSink { fillRect(x: number, y: number, width: number, height: number): unknown }

/** Immutable world-space integer-pixel queries used only by actor art masks.
 * Tactical visibility, Host fields and actor poses are deliberately not cached.
 * Each presentation owns its field; a new world/recovery constructs a new one. */
export class ActorOcclusionField {
  readonly width: number;
  readonly height: number;
  private solidHeights: Float32Array | null;
  private readonly blockColumns: number;
  private blockMaxHeights: Float32Array | null;

  constructor(private readonly world: Pick<MasterWorld, 'layout' | 'raster' | 'roleAt'>) {
    const map = world.layout.tileMap;
    this.width = Math.ceil(map.cols * map.tileSize);
    this.height = Math.ceil(map.rows * map.tileSize);
    this.blockColumns = Math.ceil(this.width / ROW_BLOCK_WIDTH);
    const heights = new Float32Array(this.width * this.height);
    const maxima = new Float32Array(this.blockColumns * this.height);
    for (let y = 0; y < this.height; y++) {
      const row = y * this.width;
      for (let block = 0; block < this.blockColumns; block++) {
        let maximum = -Infinity;
        const end = Math.min(this.width, (block + 1) * ROW_BLOCK_WIDTH);
        for (let x = block * ROW_BLOCK_WIDTH; x < end; x++) {
          // Source heights already are Float32. No quantization or ground rounding.
          const height = world.roleAt(x, y) === 'solid'
            ? nativeVolumeHeightAt(world.raster, x, y) : -Infinity;
          heights[row + x] = height;
          // A NaN solid never compares below the mask threshold. Make its
          // entire block conservative, including for an infinite threshold.
          maximum = Number.isNaN(height) ? Infinity : Math.max(maximum, height);
        }
        maxima[y * this.blockColumns + block] = maximum;
      }
    }
    this.solidHeights = heights;
    this.blockMaxHeights = maxima;
  }

  get byteLength(): number { return (this.solidHeights?.byteLength ?? 0) + (this.blockMaxHeights?.byteLength ?? 0); }

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

  /** Emit the original maximal visible spans without allocating per-row data.
   * A block can skip pixel checks only when every height is strictly below the
   * threshold; intersecting/exceptional blocks use the original pixel rule. */
  drawVisibleRow(sink: ActorMaskRowSink, x0: number, x1: number, y: number, heightLimit: number): void {
    const heights = this.solidHeights, maxima = this.blockMaxHeights;
    if (!heights || !maxima) throw new Error('Actor occlusion field used after destruction');
    // The original scanner used start=-1 and reset it at every visible negative
    // x. Consequently no negative-x span was ever emitted; keep that behavior.
    let x = Math.max(0, x0), start = -1;
    const end = x1 + 1;
    if (Number.isNaN(heightLimit)) {
      for (; x < end; x++) {
        const visible = this.world.roleAt(x, y) !== 'solid';
        if (visible && start < 0) start = x;
        if (!visible && start >= 0) { sink.fillRect(start, y, x - start, 1); start = -1; }
      }
    } else {
      const outsideRow = y < 0 || y >= this.height, row = y * this.width, blockRow = y * this.blockColumns;
      while (x < end) {
        const outside = outsideRow || x >= this.width;
        const block = Math.floor(x / ROW_BLOCK_WIDTH);
        const blockEnd = outside ? end : Math.min(end, this.width, (block + 1) * ROW_BLOCK_WIDTH);
        if (outside || maxima[blockRow + block]! < heightLimit) {
          if (start < 0) start = x;
          x = blockEnd;
          continue;
        }
        for (; x < blockEnd; x++) {
          const visible = heights[row + x]! < heightLimit;
          if (visible && start < 0) start = x;
          if (!visible && start >= 0) { sink.fillRect(start, y, x - start, 1); start = -1; }
        }
      }
    }
    if (start >= 0) sink.fillRect(start, y, end - start, 1);
  }

  destroy(): void { this.solidHeights = null; this.blockMaxHeights = null; }
}
