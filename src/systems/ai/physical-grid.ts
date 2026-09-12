import type { Vector2 } from '@/types/game-types';
import type { OccluderGrid, WalkGrid } from '@/types/map-types';

/** Ray-based body clearance must query physical support, never optical visibility. */
export function createMovementOccluders(walk: WalkGrid): OccluderGrid {
  return {
    get cols() { return walk.cols; },
    get rows() { return walk.rows; },
    get tileSize() { return walk.tileSize; },
    get version() { return walk.version; },
    isOpaque(col, row) {
      return col < 0 || row < 0 || col >= walk.cols || row >= walk.rows || !walk.isWalkable(col, row);
    },
  };
}

/**
 * Return the legal fraction of a direct displacement of the real physics AABB.
 * Sweeping its centre against expanded blocked tiles catches the full segment,
 * including a void between two legal endpoints. No allocation or body mutation.
 */
export function bodyDisplacementFraction(
  walk: WalkGrid,
  center: Readonly<Vector2>,
  halfWidth: number,
  halfHeight: number,
  dx: number,
  dy: number,
): number {
  if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(halfWidth)
    || !Number.isFinite(halfHeight) || !Number.isFinite(dx) || !Number.isFinite(dy)
    || halfWidth < 0 || halfHeight < 0) return 0;
  if (dx === 0 && dy === 0) return 0;
  const size = walk.tileSize, epsilon = 1e-6;
  const firstCol = Math.max(-1, Math.floor((Math.min(center.x, center.x + dx) - halfWidth) / size));
  const lastCol = Math.min(walk.cols, Math.floor((Math.max(center.x, center.x + dx) + halfWidth) / size));
  const firstRow = Math.max(-1, Math.floor((Math.min(center.y, center.y + dy) - halfHeight) / size));
  const lastRow = Math.min(walk.rows, Math.floor((Math.max(center.y, center.y + dy) + halfHeight) / size));
  let fraction = 1;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      if (col >= 0 && row >= 0 && col < walk.cols && row < walk.rows && walk.isWalkable(col, row)) continue;
      const minX = col * size - halfWidth + epsilon, maxX = (col + 1) * size + halfWidth - epsilon;
      const minY = row * size - halfHeight + epsilon, maxY = (row + 1) * size + halfHeight - epsilon;
      let entry = 0, exit = fraction;
      if (dx === 0) {
        if (center.x <= minX || center.x >= maxX) continue;
      } else {
        const a = (minX - center.x) / dx, b = (maxX - center.x) / dx;
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
      if (dy === 0) {
        if (center.y <= minY || center.y >= maxY) continue;
      } else {
        const a = (minY - center.y) / dy, b = (maxY - center.y) / dy;
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
      if (entry < exit && exit > 0) fraction = Math.min(fraction, entry);
    }
  }
  return fraction < 1 ? Math.max(0, fraction - .0001 / Math.max(Math.abs(dx), Math.abs(dy))) : 1;
}
