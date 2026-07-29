/**
 * Grid raycasting on a tile occluder grid (DDA / Amanatides-Woo traversal).
 *
 * Stateless helpers, not a system: the player's visibility system and the enemy AI both
 * import them so that "can A see B" is answered by exactly one piece of code. If the AI
 * had its own occlusion test, "I can't see it, so it can't see me" would stop being true,
 * and that inference is the basis of stealth (system-enemy-ai rule P3).
 *
 * Deviation from the spec signature: results are written into a caller-owned `RayHit`
 * instead of being returned fresh, because these run up to 60 times per frame and the
 * game loop must not allocate.
 */

import type { OccluderGrid } from '@/types/map-types';
import type { Vector2 } from '@/types/game-types';

export interface RayHit {
  /** Impact point, or the ray's end point when nothing was hit. */
  x: number;
  y: number;
  /** Distance travelled (px). Equals the distance limit when nothing was hit. */
  dist: number;
  hit: boolean;
}

export function createRayHit(): RayHit {
  return { x: 0, y: 0, dist: 0, hit: false };
}

/**
 * How close (px) a ray must pass to a shared tile vertex to be treated as passing
 * exactly through it. Rays threading the zero-width gap between two diagonally
 * adjacent walls are blocked (system-movement-vision rule 14) - otherwise players
 * could peek around corners through a seam that visibly has no opening.
 */
const CORNER_MARGIN = 1;

const losScratch: RayHit = createRayHit();

/** Casts a ray at `angleRad` (radians, 0 = +x) and writes the result into `out`. */
export function castRay(
  grid: OccluderGrid,
  origin: Vector2,
  angleRad: number,
  maxDist: number,
  out: RayHit
): RayHit {
  return castRayDirection(
    grid,
    origin.x,
    origin.y,
    Math.cos(angleRad),
    Math.sin(angleRad),
    maxDist,
    out
  );
}

/**
 * Casts a ray along a unit direction. Stops at the first opaque tile or at `maxDist`.
 * `dirX`/`dirY` must be normalised.
 */
export function castRayDirection(
  grid: OccluderGrid,
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  maxDist: number,
  out: RayHit
): RayHit {
  const tileSize = grid.tileSize;
  let col = Math.floor(originX / tileSize);
  let row = Math.floor(originY / tileSize);

  // Origin inside a wall: degenerate, report a zero-length hit and let the caller decide.
  if (grid.isOpaque(col, row)) {
    out.x = originX;
    out.y = originY;
    out.dist = 0;
    out.hit = true;
    return out;
  }

  const stepCol = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepRow = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;

  const invX = stepCol !== 0 ? 1 / Math.abs(dirX) : Infinity;
  const invY = stepRow !== 0 ? 1 / Math.abs(dirY) : Infinity;
  const deltaX = tileSize * invX;
  const deltaY = tileSize * invY;

  let nextX =
    stepCol > 0
      ? ((col + 1) * tileSize - originX) * invX
      : stepCol < 0
        ? (originX - col * tileSize) * invX
        : Infinity;
  let nextY =
    stepRow > 0
      ? ((row + 1) * tileSize - originY) * invY
      : stepRow < 0
        ? (originY - row * tileSize) * invY
        : Infinity;

  // A ray can cross at most cols+rows grid lines before leaving the map.
  const maxSteps = grid.cols + grid.rows + 2;

  for (let step = 0; step < maxSteps; step++) {
    const throughVertex =
      stepCol !== 0 && stepRow !== 0 && Math.abs(nextX - nextY) <= CORNER_MARGIN;

    if (throughVertex) {
      const dist = nextX < nextY ? nextX : nextY;
      if (dist > maxDist) break;
      // Both flanking tiles solid => the seam has no opening.
      if (grid.isOpaque(col + stepCol, row) && grid.isOpaque(col, row + stepRow)) {
        return writeHit(out, originX, originY, dirX, dirY, dist, true);
      }
      col += stepCol;
      row += stepRow;
      nextX += deltaX;
      nextY += deltaY;
      if (grid.isOpaque(col, row)) {
        return writeHit(out, originX, originY, dirX, dirY, dist, true);
      }
      continue;
    }

    let dist: number;
    if (nextX < nextY) {
      dist = nextX;
      if (dist > maxDist) break;
      col += stepCol;
      nextX += deltaX;
    } else {
      dist = nextY;
      if (dist > maxDist) break;
      row += stepRow;
      nextY += deltaY;
    }

    if (grid.isOpaque(col, row)) {
      return writeHit(out, originX, originY, dirX, dirY, dist, true);
    }
  }

  return writeHit(out, originX, originY, dirX, dirY, maxDist, false);
}

/**
 * True when nothing opaque sits between the two points. Uses the exact segment
 * direction rather than an angle round-trip, so long sight lines stay accurate.
 */
export function hasLineOfSight(
  grid: OccluderGrid,
  from: Vector2,
  to: Vector2,
  maxDist?: number
): boolean {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

  if (length < 1e-6) {
    return !grid.isOpaque(Math.floor(from.x / grid.tileSize), Math.floor(from.y / grid.tileSize));
  }
  if (maxDist !== undefined && length > maxDist) return false;

  castRayDirection(grid, from.x, from.y, deltaX / length, deltaY / length, length, losScratch);
  return !losScratch.hit || losScratch.dist >= length - 0.001;
}

function writeHit(
  out: RayHit,
  originX: number,
  originY: number,
  dirX: number,
  dirY: number,
  dist: number,
  hit: boolean
): RayHit {
  out.x = originX + dirX * dist;
  out.y = originY + dirY * dist;
  out.dist = dist;
  out.hit = hit;
  return out;
}
