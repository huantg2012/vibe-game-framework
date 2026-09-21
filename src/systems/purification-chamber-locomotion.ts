import type { Player } from '@/entities/player';
import {
  CHAMBER_MAX_STEP_MS, CHAMBER_ROUTES, CHAMBER_ROUTE_LENGTHS,
  CHAMBER_SPAWN_POINT, CHAMBER_STAIR_ENTRY_DISTANCE,
  type ChamberPoint, type ChamberRoute, type ChamberStair,
} from './purification-chamber-layout';

export interface ChamberMovementState {
  route: ChamberRoute;
  /** Distance in world pixels along the route, starting at its `start` anchor. */
  distance: number;
}

/** Project a spawn/recovery position onto the nearest legal walk surface. */
export function createChamberMovementState(position: ChamberPoint = CHAMBER_SPAWN_POINT): ChamberMovementState {
  let nearest: ChamberMovementState = { route: 'main', distance: 0 };
  let nearestSquared = Infinity;
  for (const route of Object.keys(CHAMBER_ROUTES) as ChamberRoute[]) {
    const { start, end } = CHAMBER_ROUTES[route];
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = CHAMBER_ROUTE_LENGTHS[route];
    const t = Math.max(0, Math.min(1, ((position.x - start.x) * dx + (position.y - start.y) * dy) / (length * length)));
    const squared = (position.x - start.x - dx * t) ** 2 + (position.y - start.y - dy * t) ** 2;
    if (squared < nearestSquared) {
      nearest = { route, distance: t * length };
      nearestSquared = squared;
    }
  }
  return nearest;
}

export function getChamberMovementPosition(
  state: Readonly<ChamberMovementState>, out: { x: number; y: number },
): void {
  const { start, end } = CHAMBER_ROUTES[state.route];
  const t = Math.max(0, Math.min(1, state.distance / CHAMBER_ROUTE_LENGTHS[state.route]));
  out.x = start.x + (end.x - start.x) * t;
  out.y = start.y + (end.y - start.y) * t;
}

export function isChamberFloor(route: ChamberRoute): route is 'main' | 'upper' {
  return route === 'main' || route === 'upper';
}

/**
 * Shared pure path solver. Input axes are intent, not world-space displacement:
 * A/D traverse a floor; W/S traverse a stair. A diagonal chord never adds speed.
 * No physics gravity or collision response can move the body outside this graph.
 */
export function stepChamberMovement(
  state: ChamberMovementState, input: ChamberPoint, deltaMs: number, speed: number,
): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0 || !Number.isFinite(speed) || speed <= 0) return;
  let travel = Math.min(deltaMs, CHAMBER_MAX_STEP_MS) * speed / 1000;
  if (isChamberFloor(state.route)) {
    const route = state.route;
    const length = CHAMBER_ROUTE_LENGTHS[route];
    const stairIntent = route === 'main' ? input.y < 0 : input.y > 0;
    const nearLeft = state.distance <= CHAMBER_STAIR_ENTRY_DISTANCE;
    const nearRight = length - state.distance <= CHAMBER_STAIR_ENTRY_DISTANCE;
    if (stairIntent && (nearLeft || nearRight)) {
      // Walk the remaining landing distance before climbing: no sideways snap.
      const gap = nearLeft ? state.distance : length - state.distance;
      if (travel < gap) {
        state.distance += nearLeft ? -travel : travel;
        return;
      }
      travel -= gap;
      const stair: ChamberStair = nearLeft ? 'left-stair' : 'right-stair';
      state.route = stair;
      state.distance = route === 'main' ? 0 : CHAMBER_ROUTE_LENGTHS[stair];
    } else {
      const direction = Number.isFinite(input.x) ? Math.sign(input.x) : 0;
      state.distance = Math.max(0, Math.min(length, state.distance + direction * travel));
      return;
    }
  }

  const route = state.route;
  const direction = Number.isFinite(input.y) ? -Math.sign(input.y) : 0;
  if (direction === 0) return;
  const length = CHAMBER_ROUTE_LENGTHS[route];
  state.distance = Math.max(0, Math.min(length, state.distance + direction * travel));
  if (state.distance === 0) {
    state.route = 'main';
    state.distance = route === 'left-stair' ? 0 : CHAMBER_ROUTE_LENGTHS.main;
  } else if (state.distance === length) {
    state.route = 'upper';
    state.distance = route === 'left-stair' ? 0 : CHAMBER_ROUTE_LENGTHS.upper;
  }
}

/** Thin adapter over Player's existing keyboard ownership, rig and input freezes. */
export class PurificationChamberLocomotion {
  private readonly state: ChamberMovementState;
  private readonly position = { x: 0, y: 0 };

  constructor(private readonly player: Player) {
    this.state = createChamberMovementState(player.getPosition());
  }

  /** Call immediately after Player.update, before scene proximity and audio queries. */
  update(deltaMs: number): void {
    stepChamberMovement(this.state, this.player.getMovementInput(), deltaMs, this.player.getEffectiveSpeed());
    getChamberMovementPosition(this.state, this.position);
    this.player.applyConstrainedMovement(this.position.x, this.position.y);
  }

  getRoute(): ChamberRoute { return this.state.route; }
  canInteract(): boolean { return isChamberFloor(this.state.route); }
}
