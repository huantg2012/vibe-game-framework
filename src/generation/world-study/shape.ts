/** Continuous reconstruction shared by visible outlines and body collision. */
import type { WorldSample } from './types';

interface ShapeFields { land: Float32Array; walls: Float32Array }
const cache = new WeakMap<WorldSample, ShapeFields>();

function smooth(mask: Uint8Array, cols: number, rows: number): Float32Array {
  const output = new Float32Array(mask.length);
  const weights = [1, 2, 1];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    let value = 0;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      const nx = col + x, ny = row + y;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) value += mask[ny * cols + nx]! * weights[x + 1]! * weights[y + 1]!;
    }
    // A small regularisation removes sampling staircases, not entire masses.
    output[row * cols + col] = mask[row * cols + col]! * .45 + value / 16 * .55;
  }
  return output;
}

function fieldsFor(sample: WorldSample): ShapeFields {
  let fields = cache.get(sample);
  if (!fields) {
    fields = { land: smooth(sample.land, sample.cols, sample.rows), walls: smooth(sample.walls, sample.cols, sample.rows) };
    cache.set(sample, fields);
  }
  return fields;
}

function at(sample: WorldSample, field: Float32Array, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= sample.cols * sample.tileSize || y >= sample.rows * sample.tileSize) return false;
  const gx = x / sample.tileSize - .5, gy = y / sample.tileSize - .5;
  const col = Math.floor(gx), row = Math.floor(gy), tx = gx - col, ty = gy - row;
  const cell = (c: number, r: number): number => c < 0 || r < 0 || c >= sample.cols || r >= sample.rows ? 0 : field[r * sample.cols + c]!;
  const top = cell(col, row) * (1 - tx) + cell(col + 1, row) * tx;
  const bottom = cell(col, row + 1) * (1 - tx) + cell(col + 1, row + 1) * tx;
  return top * (1 - ty) + bottom * ty >= .5;
}

export function worldLandAt(sample: WorldSample, x: number, y: number): boolean {
  return at(sample, fieldsFor(sample).land, x, y);
}

export function worldWallAt(sample: WorldSample, x: number, y: number): boolean {
  return at(sample, fieldsFor(sample).walls, x, y);
}
