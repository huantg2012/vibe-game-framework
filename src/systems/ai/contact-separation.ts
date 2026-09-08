import { GAME_CONSTANTS } from '@/config/constants';
import type { Vector2 } from '@/types/game-types';
import type { WalkGrid } from '@/types/map-types';

/** Allocated at spawn. Position is the engine's live position, not a copied AI snapshot. */
export interface ContactBody {
  readonly id: string;
  readonly position: Readonly<Vector2>;
  readonly size: number;
  readonly immovable: boolean;
  remaining: number;
  moveTo(x: number, y: number): void;
}

/** Check the swept square footprint, including void and out-of-bounds tiles. */
function clearMove(body: ContactBody, grid: WalkGrid, x: number, y: number): boolean {
  const dx = x - body.position.x;
  const dy = y - body.position.y;
  const samples = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const half = body.size / 2 - 0.001;
  for (let step = 0; step <= samples; step++) {
    const px = body.position.x + dx * step / samples;
    const py = body.position.y + dy * step / samples;
    const minCol = Math.floor((px - half) / grid.tileSize);
    const maxCol = Math.floor((px + half) / grid.tileSize);
    const minRow = Math.floor((py - half) / grid.tileSize);
    const maxRow = Math.floor((py + half) / grid.tileSize);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !grid.isWalkable(col, row)) return false;
      }
    }
  }
  return true;
}

function push(body: ContactBody, other: ContactBody, grid: WalkGrid, nx: number, ny: number, amount: number): void {
  const distance = Math.min(body.remaining, amount);
  if (body.immovable || distance <= 0) return;
  // Full correction, then axis slides, then the two wall tangents. All candidates
  // must increase distance from this neighbour and keep the full body on the floor.
  const oldDistance = Math.hypot(body.position.x - other.position.x, body.position.y - other.position.y);
  for (let candidate = 0; candidate < 5; candidate++) {
    let dx = nx * distance;
    let dy = ny * distance;
    if (candidate === 1) dy = 0;
    if (candidate === 2) dx = 0;
    if (candidate === 3) { dx = -ny * distance; dy = nx * distance; }
    if (candidate === 4) { dx = ny * distance; dy = -nx * distance; }
    const x = body.position.x + dx;
    const y = body.position.y + dy;
    if (Math.hypot(x - other.position.x, y - other.position.y) <= oldDistance + 0.0001) continue;
    if (!clearMove(body, grid, x, y)) continue;
    body.moveTo(x, y);
    body.remaining -= Math.hypot(dx, dy);
    return;
  }
}

/** Gentle position correction handles stopped/coincident bodies without moving fixed forms. */
export function separateContacts(bodies: readonly ContactBody[], grid: WalkGrid, deltaMs: number): void {
  const dt = Math.max(0, Math.min(deltaMs, GAME_CONSTANTS.AI.DT_CLAMP_MS));
  for (const body of bodies) body.remaining = GAME_CONSTANTS.AI.STANDOFF_ADJUST_SPEED * dt / 1000;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!;
        if (a.immovable && b.immovable) continue;
        const dx = a.position.x - b.position.x;
        const dy = a.position.y - b.position.y;
        const distance = Math.hypot(dx, dy);
        const overlap = (a.size + b.size) / 2 - distance;
        if (overlap <= 0.001) continue;
        // Identity, not random noise, chooses opposite escapes for exact coincidence.
        const nx = distance > 0.001 ? dx / distance : a.id < b.id ? -1 : 1;
        const ny = distance > 0.001 ? dy / distance : 0;
        const share = a.immovable || b.immovable ? overlap : overlap / 2;
        push(a, b, grid, nx, ny, share);
        push(b, a, grid, -nx, -ny, share);
      }
    }
  }
}
