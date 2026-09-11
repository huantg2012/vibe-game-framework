import type { GeneratedRiftLayout } from '@/generation/types';
import { TileType } from '@/types/game-types';

/** A map-boundary flood distinguishes the outer vista from holes INSIDE the
 * route. Internal absences are never windows onto another visible world. */
export class VoidRegions {
  private readonly exterior: Uint8Array;
  private readonly cols: number;
  private readonly rows: number;
  private readonly size: number;

  constructor(private readonly map: GeneratedRiftLayout['tileMap']) {
    this.cols = map.cols; this.rows = map.rows; this.size = map.tileSize;
    this.exterior = new Uint8Array(this.cols * this.rows);
    const queue = new Int32Array(this.exterior.length); let tail = 0;
    const add = (x: number, y: number): void => {
      const i = y * this.cols + x;
      if (map.tiles[y]?.[x] !== TileType.VOID || this.exterior[i]) return;
      this.exterior[i] = 1; queue[tail++] = i;
    };
    for (let x = 0; x < this.cols; x++) { add(x, 0); add(x, this.rows - 1); }
    for (let y = 1; y < this.rows - 1; y++) { add(0, y); add(this.cols - 1, y); }
    for (let head = 0; head < tail; head++) {
      const i = queue[head]!, x = i % this.cols, y = Math.floor(i / this.cols);
      if (x > 0) add(x - 1, y); if (x + 1 < this.cols) add(x + 1, y);
      if (y > 0) add(x, y - 1); if (y + 1 < this.rows) add(x, y + 1);
    }
  }

  isInterior(x: number, y: number): boolean {
    const col = Math.floor(x / this.size), row = Math.floor(y / this.size);
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows
      && this.map.tiles[row]![col] === TileType.VOID && !this.exterior[row * this.cols + col];
  }

  isExterior(x: number, y: number): boolean {
    const col = Math.floor(x / this.size), row = Math.floor(y / this.size);
    return col < 0 || row < 0 || col >= this.cols || row >= this.rows
      || this.exterior[row * this.cols + col] === 1;
  }
}
