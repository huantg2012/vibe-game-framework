import type { Vector2 } from '@/types/game-types';
import type { WalkGrid } from '@/types/map-types';

export interface VisibleTargetPolicy<T> {
  readonly getPosition: (target: T) => Readonly<Vector2>;
  readonly isAlive: (target: T) => boolean;
  readonly isVisible: (target: T) => boolean;
  readonly hasLineOfSight: (from: Readonly<Vector2>, to: Readonly<Vector2>) => boolean;
  readonly maxDistance?: number;
}

/** Read-only selection; equal-distance candidates retain the caller's stable order. */
export function selectNearestVisibleTarget<T>(
  origin: Readonly<Vector2>,
  targets: readonly T[],
  policy: VisibleTargetPolicy<T>,
): T | null {
  if (!finitePoint(origin)) return null;
  const limit = policy.maxDistance ?? Infinity;
  if (Number.isNaN(limit) || limit < 0) return null;
  let distanceSquared = limit * limit;
  let selected: T | null = null;
  for (const target of targets) {
    if (!policy.isAlive(target) || !policy.isVisible(target)) continue;
    const position = policy.getPosition(target);
    if (!finitePoint(position)) continue;
    const dx = position.x - origin.x;
    const dy = position.y - origin.y;
    const candidateDistance = dx * dx + dy * dy;
    if (candidateDistance > distanceSquared || (selected !== null && candidateDistance === distanceSquared)) continue;
    if (!policy.hasLineOfSight(origin, position)) continue;
    distanceSquared = candidateDistance;
    selected = target;
  }
  return selected;
}

export type ToolWalkGrid = Pick<WalkGrid, 'cols' | 'rows' | 'tileSize' | 'isWalkable'>;

export interface SingleWallLandingInput {
  /** Physics body centre, not the visual sprite's feet or texture origin. */
  readonly origin: Readonly<Vector2>;
  readonly direction: Readonly<Vector2>;
  readonly maxDistance: number;
  readonly bodyHalfWidth: number;
  readonly bodyHalfHeight: number;
  readonly grid: ToolWalkGrid;
  /** Must distinguish a real phaseable wall from VOID. Never called out of bounds. */
  readonly isPhaseableWall: (col: number, row: number) => boolean;
}

interface RayInterval { enter: number; exit: number }

/**
 * Finds the first safe body-centre position beyond exactly one solid tile.
 * Uses continuous swept AABB checks, so shallow angles cannot tunnel through a
 * second wall/VOID between sampling steps. Only intended for activation/preview,
 * not for every entity's movement update. No physics state or charges are changed.
 */
export function findSingleWallLanding(input: SingleWallLandingInput): Vector2 | null {
  const { origin, direction, grid, bodyHalfWidth: halfW, bodyHalfHeight: halfH, maxDistance } = input;
  if (!finitePoint(origin) || !finitePoint(direction)
    || !Number.isFinite(maxDistance) || maxDistance <= 0
    || !Number.isFinite(halfW) || halfW <= 0 || !Number.isFinite(halfH) || halfH <= 0
    || !Number.isFinite(grid.tileSize) || grid.tileSize <= 0
    || !Number.isSafeInteger(grid.cols) || grid.cols <= 0
    || !Number.isSafeInteger(grid.rows) || grid.rows <= 0) return null;
  const length = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(length) || length === 0) return null;
  const dx = direction.x / length;
  const dy = direction.y / length;
  const size = grid.tileSize;
  const epsilon = size * 1e-7; // Numerical separation, not a gameplay clearance parameter.
  if (!bodyFits(grid, origin.x, origin.y, halfW, halfH, epsilon)) return null;

  const endX = origin.x + dx * maxDistance;
  const endY = origin.y + dy * maxDistance;
  const minCol = Math.max(0, Math.floor(Math.min(origin.x, endX) / size));
  const maxCol = Math.min(grid.cols - 1, Math.floor(Math.max(origin.x, endX) / size));
  const minRow = Math.max(0, Math.floor(Math.min(origin.y, endY) / size));
  const maxRow = Math.min(grid.rows - 1, Math.floor(Math.max(origin.y, endY) / size));
  const interval: RayInterval = { enter: 0, exit: 0 };
  let wallCol = -1;
  let wallRow = -1;
  let firstDistance = Infinity;
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (grid.isWalkable(col, row)) continue;
      if (!intersectRayBox(origin, dx, dy, col * size, row * size,
        (col + 1) * size, (row + 1) * size, interval)) continue;
      if (interval.exit - interval.enter <= epsilon || interval.enter > maxDistance
        || interval.enter >= firstDistance) continue;
      firstDistance = interval.enter;
      wallCol = col;
      wallRow = row;
    }
  }
  if (wallCol < 0 || !input.isPhaseableWall(wallCol, wallRow)) return null;

  // Expand the crossed tile by the real collider: exiting this rectangle means
  // the complete body, including its trailing edge, has reached the far side.
  if (!intersectRayBox(origin, dx, dy, wallCol * size - halfW, wallRow * size - halfH,
    (wallCol + 1) * size + halfW, (wallRow + 1) * size + halfH, interval)) return null;
  const travel = interval.exit + epsilon;
  if (travel > maxDistance) return null;
  const x = origin.x + dx * travel;
  const y = origin.y + dy * travel;
  if (!bodyFits(grid, x, y, halfW, halfH, epsilon)) return null;

  // A valid endpoint alone is insufficient: the body must not clip another
  // obstacle on the way, including diagonal corners beside the selected tile.
  const sweepMinCol = Math.max(0, Math.floor((Math.min(origin.x, x) - halfW) / size));
  const sweepMaxCol = Math.min(grid.cols - 1, Math.floor((Math.max(origin.x, x) + halfW) / size));
  const sweepMinRow = Math.max(0, Math.floor((Math.min(origin.y, y) - halfH) / size));
  const sweepMaxRow = Math.min(grid.rows - 1, Math.floor((Math.max(origin.y, y) + halfH) / size));
  for (let row = sweepMinRow; row <= sweepMaxRow; row++) {
    for (let col = sweepMinCol; col <= sweepMaxCol; col++) {
      if ((col === wallCol && row === wallRow) || grid.isWalkable(col, row)) continue;
      if (intersectRayBox(origin, dx, dy, col * size - halfW + epsilon, row * size - halfH + epsilon,
        (col + 1) * size + halfW - epsilon, (row + 1) * size + halfH - epsilon, interval)
        && interval.enter < travel && interval.exit > 0) return null;
    }
  }
  return { x, y };
}

function finitePoint(point: Readonly<Vector2>): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function bodyFits(grid: ToolWalkGrid, x: number, y: number, halfW: number, halfH: number, epsilon: number): boolean {
  const left = x - halfW;
  const right = x + halfW;
  const top = y - halfH;
  const bottom = y + halfH;
  if (left < 0 || top < 0 || right > grid.cols * grid.tileSize || bottom > grid.rows * grid.tileSize) return false;
  for (let row = Math.floor((top + epsilon) / grid.tileSize); row <= Math.floor((bottom - epsilon) / grid.tileSize); row++) {
    for (let col = Math.floor((left + epsilon) / grid.tileSize); col <= Math.floor((right - epsilon) / grid.tileSize); col++) {
      if (!grid.isWalkable(col, row)) return false;
    }
  }
  return true;
}

function intersectRayBox(
  origin: Readonly<Vector2>, dx: number, dy: number,
  left: number, top: number, right: number, bottom: number, out: RayInterval,
): boolean {
  if ((dx === 0 && (origin.x < left || origin.x > right))
    || (dy === 0 && (origin.y < top || origin.y > bottom))) return false;
  const tx1 = dx === 0 ? -Infinity : (left - origin.x) / dx;
  const tx2 = dx === 0 ? Infinity : (right - origin.x) / dx;
  const ty1 = dy === 0 ? -Infinity : (top - origin.y) / dy;
  const ty2 = dy === 0 ? Infinity : (bottom - origin.y) / dy;
  out.enter = Math.max(0, Math.min(tx1, tx2), Math.min(ty1, ty2));
  out.exit = Math.min(Math.max(tx1, tx2), Math.max(ty1, ty2));
  return out.exit >= out.enter;
}

/** Furthest unobstructed floor point along a throw; never crosses walls or VOID. */
export function findSoundLureLanding(
  origin: Readonly<Vector2>, direction: Readonly<Vector2>, maxDistance: number,
  grid: ToolWalkGrid, minDistance: number,
): Vector2 | null {
  if (!finitePoint(origin) || !finitePoint(direction) || !Number.isFinite(maxDistance)
    || maxDistance <= 0 || !Number.isFinite(minDistance) || minDistance < 0
    || grid.tileSize <= 0) return null;
  const length = Math.hypot(direction.x, direction.y);
  if (!length || !Number.isFinite(length)) return null;
  const dx = direction.x / length, dy = direction.y / length;
  const col = Math.floor(origin.x / grid.tileSize), row = Math.floor(origin.y / grid.tileSize);
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !grid.isWalkable(col, row)) return null;
  let travel = maxDistance;
  const interval = { enter: 0, exit: 0 };
  const size = grid.tileSize;
  // The surrounding VOID ring also clips throws at the map boundary.
  const x2 = origin.x + dx * travel, y2 = origin.y + dy * travel;
  for (let r = Math.max(-1, Math.floor(Math.min(origin.y, y2) / size)); r <= Math.min(grid.rows, Math.floor(Math.max(origin.y, y2) / size)); r++) {
    for (let c = Math.max(-1, Math.floor(Math.min(origin.x, x2) / size)); c <= Math.min(grid.cols, Math.floor(Math.max(origin.x, x2) / size)); c++) {
      if (c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && grid.isWalkable(c, r)) continue;
      if (intersectRayBox(origin, dx, dy, c * size, r * size, (c + 1) * size, (r + 1) * size, interval)) {
        travel = Math.min(travel, interval.enter - 1); // One world pixel keeps the source off the wall face.
      }
    }
  }
  return travel >= minDistance && travel > 0 ? { x: origin.x + dx * travel, y: origin.y + dy * travel } : null;
}
