import type { Player } from '@/entities/player';
import {
  CHAMBER_DEVICE_ANCHORS, CHAMBER_DEVICE_FLOORS, CHAMBER_DEVICE_FOOTPRINTS, CHAMBER_FEET_RADIUS,
  CHAMBER_GROUND_OFFSET_Y, CHAMBER_MAX_STEP_MS, CHAMBER_SPAWN_POINT,
  CHAMBER_WALK_POLYGONS,
  type ChamberDevice, type ChamberPoint, type ChamberPolygon, type ChamberRoute,
} from './purification-chamber-layout';

/** Coordinates are the stable sole position, not the actor image center. */
export interface ChamberMovementState {
  x: number;
  y: number;
  route: ChamberRoute;
}

interface BoundarySegment {
  readonly ax: number;
  readonly ay: number;
  readonly dx: number;
  readonly dy: number;
  readonly lengthSquared: number;
  readonly nx: number;
  readonly ny: number;
}

const EPSILON = 1e-8;
const CONTACT_EPSILON = 1e-7;
const ROUTES = Object.keys(CHAMBER_WALK_POLYGONS) as ChamberRoute[];
const WALK_POLYGONS: readonly ChamberPolygon[] = Object.values(CHAMBER_WALK_POLYGONS);
const DEVICE_POLYGONS: readonly ChamberPolygon[] = Object.values(CHAMBER_DEVICE_FOOTPRINTS);

function squaredDistanceToSegment(x: number, y: number, edge: BoundarySegment): number {
  const t = Math.max(0, Math.min(1, ((x - edge.ax) * edge.dx + (y - edge.ay) * edge.dy) / edge.lengthSquared));
  return (x - edge.ax - t * edge.dx) ** 2 + (y - edge.ay - t * edge.dy) ** 2;
}

function containsPoint(polygon: ChamberPolygon, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!, b = polygon[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    const cross = (x - a.x) * dy - (y - a.y) * dx;
    if (Math.abs(cross) < EPSILON && (x - a.x) * (x - b.x) + (y - a.y) * (y - b.y) <= EPSILON) return true;
    if ((a.y > y) !== (b.y > y) && x < a.x + (y - a.y) * dx / dy) inside = !inside;
  }
  return inside;
}

function containsWalkPoint(x: number, y: number): boolean {
  for (const polygon of WALK_POLYGONS) if (containsPoint(polygon, x, y)) return true;
  return false;
}

function makeSegment(ax: number, ay: number, bx: number, by: number): BoundarySegment {
  const dx = bx - ax, dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const length = Math.sqrt(lengthSquared);
  return { ax, ay, dx, dy, lengthSquared, nx: -dy / length, ny: dx / length };
}

function polygonSegments(polygon: ChamberPolygon): BoundarySegment[] {
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!;
    return makeSegment(a.x, a.y, b.x, b.y);
  });
}

/** Split all polygon seams once, keeping only the exposed boundary of their union. */
function compileWalkBoundary(): BoundarySegment[] {
  const raw = WALK_POLYGONS.flatMap(polygonSegments);
  const result: BoundarySegment[] = [];
  for (const edge of raw) {
    const cuts = [0, 1];
    for (const other of raw) {
      const ox = other.ax - edge.ax, oy = other.ay - edge.ay;
      const denominator = edge.dx * other.dy - edge.dy * other.dx;
      if (Math.abs(denominator) > EPSILON) {
        const t = (ox * other.dy - oy * other.dx) / denominator;
        const u = (ox * edge.dy - oy * edge.dx) / denominator;
        if (t > EPSILON && t < 1 - EPSILON && u >= -EPSILON && u <= 1 + EPSILON) cuts.push(t);
      } else if (Math.abs(ox * edge.dy - oy * edge.dx) < EPSILON) {
        for (const end of [0, 1]) {
          const t = ((ox + other.dx * end) * edge.dx + (oy + other.dy * end) * edge.dy) / edge.lengthSquared;
          if (t > EPSILON && t < 1 - EPSILON) cuts.push(t);
        }
      }
    }
    cuts.sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const start = cuts[i - 1]!, end = cuts[i]!;
      if (end - start < EPSILON) continue;
      const middle = (start + end) / 2;
      const x = edge.ax + edge.dx * middle, y = edge.ay + edge.dy * middle;
      const sideA = containsWalkPoint(x + edge.nx * .01, y + edge.ny * .01);
      const sideB = containsWalkPoint(x - edge.nx * .01, y - edge.ny * .01);
      if (sideA === sideB) continue;
      result.push(makeSegment(edge.ax + edge.dx * start, edge.ay + edge.dy * start,
        edge.ax + edge.dx * end, edge.ay + edge.dy * end));
    }
  }
  return result;
}

const BOUNDARIES: readonly BoundarySegment[] = [
  ...compileWalkBoundary(), ...DEVICE_POLYGONS.flatMap(polygonSegments),
];

export function getChamberRouteAtPosition(position: ChamberPoint): ChamberRoute | null {
  for (const route of ROUTES) {
    if (containsPoint(CHAMBER_WALK_POLYGONS[route], position.x, position.y)) return route;
  }
  return null;
}

/** Full circular sole clearance; a supported center alone is insufficient. */
export function canStandInChamber(position: ChamberPoint): boolean {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !containsWalkPoint(position.x, position.y)) return false;
  for (const polygon of DEVICE_POLYGONS) if (containsPoint(polygon, position.x, position.y)) return false;
  const radiusSquared = CHAMBER_FEET_RADIUS * CHAMBER_FEET_RADIUS;
  for (const edge of BOUNDARIES) {
    if (squaredDistanceToSegment(position.x, position.y, edge) < radiusSquared - CONTACT_EPSILON) return false;
  }
  return true;
}

/** Invalid spawns fail explicitly; movement never projects or teleports onto a rail. */
export function createChamberMovementState(position: ChamberPoint = CHAMBER_SPAWN_POINT): ChamberMovementState {
  const route = getChamberRouteAtPosition(position);
  if (route === null || !canStandInChamber(position)) throw new Error('Chamber spawn has no full-body floor clearance');
  return { x: position.x, y: position.y, route };
}

export function getChamberMovementPosition(state: Readonly<ChamberMovementState>, out: { x: number; y: number }): void {
  out.x = state.x;
  out.y = state.y;
}

export function isChamberFloor(route: ChamberRoute): route is 'main' | 'upper' {
  return route === 'main' || route === 'upper';
}

// Shared synchronous scratch storage: step does not allocate in the scene update loop.
const hit = { time: 1, nx: 0, ny: 0 };

function recordHit(time: number, nx: number, ny: number, vx: number, vy: number): void {
  if (time >= -EPSILON && time < hit.time && vx * nx + vy * ny < -EPSILON) {
    hit.time = Math.max(0, time);
    hit.nx = nx;
    hit.ny = ny;
  }
}

function sweepEndpoint(x: number, y: number, vx: number, vy: number, ex: number, ey: number): void {
  const ox = x - ex, oy = y - ey;
  const a = vx * vx + vy * vy;
  const b = ox * vx + oy * vy;
  if (b >= 0) return;
  const c = ox * ox + oy * oy - CHAMBER_FEET_RADIUS * CHAMBER_FEET_RADIUS;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return;
  const time = (-b - Math.sqrt(discriminant)) / a;
  const nx = ox + vx * Math.max(0, time), ny = oy + vy * Math.max(0, time);
  const length = Math.hypot(nx, ny);
  recordHit(time, nx / length, ny / length, vx, vy);
}

function sweepCircle(x: number, y: number, vx: number, vy: number): void {
  hit.time = 1;
  hit.nx = 0;
  hit.ny = 0;
  for (const edge of BOUNDARIES) {
    const distance = (x - edge.ax) * edge.nx + (y - edge.ay) * edge.ny;
    const velocity = vx * edge.nx + vy * edge.ny;
    const side = distance >= 0 ? 1 : -1;
    if (velocity * side < -EPSILON) {
      const time = (side * CHAMBER_FEET_RADIUS - distance) / velocity;
      const projection = ((x + vx * time - edge.ax) * edge.dx + (y + vy * time - edge.ay) * edge.dy) / edge.lengthSquared;
      if (projection >= 0 && projection <= 1) recordHit(time, edge.nx * side, edge.ny * side, vx, vy);
    }
    sweepEndpoint(x, y, vx, vy, edge.ax, edge.ay);
    sweepEndpoint(x, y, vx, vy, edge.ax + edge.dx, edge.ay + edge.dy);
  }
}

/** Screen-space eight-way movement with continuous circle sweeps and wall sliding. */
export function stepChamberMovement(state: ChamberMovementState, input: ChamberPoint, deltaMs: number, speed: number): void {
  if (!Number.isFinite(deltaMs) || deltaMs <= 0 || !Number.isFinite(speed) || speed <= 0) return;
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return;
  const inputLength = Math.hypot(input.x, input.y);
  if (inputLength <= EPSILON) return;
  const travel = Math.min(deltaMs, CHAMBER_MAX_STEP_MS) * speed / 1000;
  let vx = input.x / Math.max(1, inputLength) * travel;
  let vy = input.y / Math.max(1, inputLength) * travel;
  // A corner can add contacts, but cannot generate extra travel or an unbounded loop.
  for (let contact = 0; contact < 6 && Math.hypot(vx, vy) > EPSILON; contact++) {
    sweepCircle(state.x, state.y, vx, vy);
    state.x += vx * hit.time;
    state.y += vy * hit.time;
    if (hit.time === 1) break;
    vx *= 1 - hit.time;
    vy *= 1 - hit.time;
    const intoWall = vx * hit.nx + vy * hit.ny;
    vx -= intoWall * hit.nx;
    vy -= intoWall * hit.ny;
  }
  const route = getChamberRouteAtPosition(state);
  if (route !== null) state.route = route;
}

/** Proximity remains scene-owned; intervening solids and another floor reject use. */
export function canInteractWithChamberDevice(state: Readonly<ChamberMovementState>, device: ChamberDevice): boolean {
  if (state.route !== CHAMBER_DEVICE_FLOORS[device]) return false;
  const anchor = CHAMBER_DEVICE_ANCHORS[device];
  const dx = anchor.x - state.x, dy = anchor.y - state.y;
  if (Math.hypot(dx, dy) <= EPSILON) return true;
  sweepCircle(state.x, state.y, dx, dy);
  return hit.time === 1;
}

/** Thin adapter over Player's existing keyboard ownership, rig and input freezes. */
export class PurificationChamberLocomotion {
  private readonly state: ChamberMovementState;

  constructor(private readonly player: Player) {
    const position = player.getPosition();
    this.state = createChamberMovementState({ x: position.x, y: position.y + CHAMBER_GROUND_OFFSET_Y });
  }

  /** Call immediately after Player.update, before scene proximity and audio queries. */
  update(deltaMs: number): void {
    stepChamberMovement(this.state, this.player.getMovementInput(), deltaMs, this.player.getEffectiveSpeed());
    this.player.applyConstrainedMovement(this.state.x, this.state.y - CHAMBER_GROUND_OFFSET_Y);
  }

  getRoute(): ChamberRoute { return this.state.route; }
  canInteract(device: ChamberDevice): boolean { return canInteractWithChamberDevice(this.state, device); }
}
