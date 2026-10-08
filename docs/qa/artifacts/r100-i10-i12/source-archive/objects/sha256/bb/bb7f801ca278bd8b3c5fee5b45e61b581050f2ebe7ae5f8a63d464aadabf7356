import {
  LAST_LIGHT_OBSTACLES, LAST_LIGHT_STATIONS, LAST_LIGHT_FOOT_RADIUS,
  REST_POSITION, REST_YAW, REST_WORLD_APPROACH, sampleLastLightSurface,
  type ChamberDevice, type LastLightRoute, type WorldPoint,
} from './last-light-layout';

export type LastLightInteractionKey = ChamberDevice | 'rest';
export interface LastLightInteractionState extends WorldPoint { readonly route: LastLightRoute }
export interface LastLightInteractionEdge {
  readonly a: WorldPoint;
  readonly b: WorldPoint;
  /** Unit normal, from the usable edge toward the standing floor. */
  readonly nx: number;
  readonly nz: number;
}
export interface LastLightInteractionProfile {
  readonly key: LastLightInteractionKey;
  readonly route: LastLightRoute;
  readonly edges: readonly LastLightInteractionEdge[];
  readonly reach: number;
  /** Openings allow access around the physical perimeter, without a back face. */
  readonly perimeter?: boolean;
  readonly backstop?: { readonly x: number; readonly z: number; readonly nx: number; readonly nz: number };
}
export type LastLightStandQuery = (point: WorldPoint, route: LastLightRoute) => boolean;
export const LAST_LIGHT_INTERACTION_KEYS: readonly LastLightInteractionKey[] =
  ['core', 'storage', 'purifier', 'offering', 'growth', 'rift', 'rest'];
/** Feet-to-object-edge distance in metres, independent of camera projection. */
export const LAST_LIGHT_INTERACTION_REACH = 1.4;
/** A new target must be clearly nearer; leaving a valid region still clears immediately. */
export const LAST_LIGHT_INTERACTION_SWITCH_MARGIN = .16;
const EPSILON = 1e-7;
const STAND_OFF = LAST_LIGHT_FOOT_RADIUS + .025;

interface StationGeometry {
  readonly key: LastLightInteractionKey;
  readonly position: readonly number[];
  readonly yaw: number;
  readonly approach: readonly number[];
  readonly floor: LastLightRoute;
  /** Authored open-object perimeter, or a legacy one-sided threshold. */
  readonly interaction?: { readonly perimeter: readonly (readonly number[])[] } | {
    readonly edge: readonly [readonly number[], readonly number[]];
    readonly outward: readonly [number, number];
  };
}
function profileFor(station: StationGeometry): LastLightInteractionProfile {
  const { key, position, yaw, approach } = station;
  const cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const world = (x: number, z: number): WorldPoint => ({
    x: position[0]! + x * cosine + z * sine,
    y: position[1]!,
    z: position[2]! - x * sine + z * cosine,
  });
  const edge = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number): LastLightInteractionEdge => ({
    a: world(ax, az), b: world(bx, bz), nx: nx * cosine + nz * sine, nz: -nx * sine + nz * cosine,
  });
  const obstacle = LAST_LIGHT_OBSTACLES.find(item => item.id === key);
  let edges: readonly LastLightInteractionEdge[];
  let backstop: LastLightInteractionProfile['backstop'];
  let perimeter = false;
  if (station.interaction) {
    const authored = station.interaction;
    const point = (p: readonly number[]): WorldPoint => ({ x: p[0]!, y: p[1]!, z: p[2]! });
    if ('perimeter' in authored) {
      const boundary = authored.perimeter.map(point);
      const area = boundary.reduce((sum, a, i) => {
        const b = boundary[(i + 1) % boundary.length]!;
        return sum + a.x * b.z - b.x * a.z;
      }, 0);
      if (boundary.length < 3 || !Number.isFinite(area) || Math.abs(area) < EPSILON) throw new Error(`Invalid ${key} interaction perimeter`);
      edges = boundary.map((a, i) => {
        const b = boundary[(i + 1) % boundary.length]!, dx = b.x - a.x, dz = b.z - a.z;
        const length = Math.hypot(dx, dz), winding = Math.sign(area);
        if (length < EPSILON) throw new Error(`Invalid ${key} interaction perimeter edge`);
        return { a, b, nx: winding * dz / length, nz: -winding * dx / length };
      });
      perimeter = true;
    } else {
      const length = Math.hypot(...authored.outward);
      if (length < EPSILON) throw new Error(`Invalid ${key} interaction normal`);
      edges = [{ a: point(authored.edge[0]), b: point(authored.edge[1]), nx: authored.outward[0] / length, nz: authored.outward[1] / length }];
    }
  } else if (obstacle) {
    // The physical base comes from the authored mesh. The approved approach
    // chooses its operating face; it is no longer a compulsory parking point.
    const [minX, minZ, maxX, maxZ] = obstacle.bounds as [number, number, number, number];
    const centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
    const dx = approach[0]! - position[0]!, dz = approach[2]! - position[2]!;
    const localX = dx * cosine - dz * sine, localZ = dx * sine + dz * cosine;
    const frontOnX = Math.abs((localX - centerX) / (maxX - minX)) > Math.abs((localZ - centerZ) / (maxZ - minZ));
    if (frontOnX) {
      const sign = localX >= centerX ? 1 : -1, front = sign > 0 ? maxX : minX;
      backstop = { ...world(centerX, centerZ), nx: sign * cosine, nz: -sign * sine };
      edges = [edge(front, minZ, front, maxZ, sign, 0),
        edge(centerX, minZ, front, minZ, 0, -1), edge(centerX, maxZ, front, maxZ, 0, 1)];
    } else {
      const sign = localZ >= centerZ ? 1 : -1, front = sign > 0 ? maxZ : minZ;
      backstop = { ...world(centerX, centerZ), nx: sign * sine, nz: sign * cosine };
      edges = [edge(minX, front, maxX, front, 0, sign),
        edge(minX, centerZ, minX, front, -1, 0), edge(maxX, centerZ, maxX, front, 1, 0)];
    }
  } else {
    // Older exported non-solid stations retain a floor threshold until they
    // provide an explicit authoring edge. No centre-circle exception is used.
    const dx = approach[0]! - position[0]!, dz = approach[2]! - position[2]!;
    const length = Math.hypot(dx, dz), nx = dx / length, nz = dz / length;
    const x = approach[0]! - nx * STAND_OFF, z = approach[2]! - nz * STAND_OFF;
    edges = [{ a: { x: x - nz * .46, y: position[1]!, z: z + nx * .46 },
      b: { x: x + nz * .46, y: position[1]!, z: z - nx * .46 }, nx, nz }];
  }
  return { key, route: station.floor, edges, backstop, perimeter, reach: LAST_LIGHT_INTERACTION_REACH };
}
export const LAST_LIGHT_INTERACTION_PROFILES: readonly LastLightInteractionProfile[] = [
  ...LAST_LIGHT_STATIONS.map(station => profileFor(station as StationGeometry)),
  profileFor({ key: 'rest', position: [REST_POSITION.x, REST_POSITION.y, REST_POSITION.z], yaw: REST_YAW,
    approach: [REST_WORLD_APPROACH.x, REST_WORLD_APPROACH.y, REST_WORLD_APPROACH.z], floor: 'main' }),
];

// Reused scratch state: synchronous queries never retain it or allocate a path.
const probe = { x: 0, y: 0, z: 0 };
function reachableStandingEdge(state: LastLightInteractionState, x: number, z: number, canStand: LastLightStandQuery): boolean {
  const distance = Math.hypot(x - state.x, z - state.z);
  const count = Math.max(1, Math.ceil(distance / .06));
  for (let index = 0; index <= count; index++) {
    const fraction = index / count;
    probe.x = state.x + (x - state.x) * fraction;
    probe.z = state.z + (z - state.z) * fraction;
    const surface = sampleLastLightSurface(state.route, probe.x, probe.z);
    if (!surface || Math.abs(surface.height - state.y) > .16) return false;
    probe.y = surface.height;
    if (!canStand(probe, state.route)) return false;
  }
  return true;
}

/** Infinity means ineligible. Reach goes to the physical operating frontage,
 * never through its own base to one special approach point. */
export function lastLightInteractionDistance(
  state: LastLightInteractionState,
  profile: LastLightInteractionProfile,
  canStand: LastLightStandQuery,
): number {
  if (state.route !== profile.route || !Number.isFinite(state.x + state.y + state.z)) return Infinity;
  const backstop = profile.backstop;
  if (backstop && (state.x - backstop.x) * backstop.nx + (state.z - backstop.z) * backstop.nz < -EPSILON) return Infinity;
  let nearest = Infinity;
  for (const edge of profile.edges) {
    if (Math.abs(state.y - edge.a.y) > .16) continue;
    const ex = edge.b.x - edge.a.x, ez = edge.b.z - edge.a.z;
    const lengthSquared = ex * ex + ez * ez;
    if (lengthSquared < EPSILON) continue;
    const normalDistance = (state.x - edge.a.x) * edge.nx + (state.z - edge.a.z) * edge.nz;
    if (normalDistance < -EPSILON || normalDistance > profile.reach) continue;
    const fraction = Math.max(0, Math.min(1, ((state.x - edge.a.x) * ex + (state.z - edge.a.z) * ez) / lengthSquared));
    const x = edge.a.x + ex * fraction, z = edge.a.z + ez * fraction;
    const distance = Math.hypot(state.x - x, state.z - z);
    if (distance > profile.reach || distance >= nearest) continue;
    // At a convex opening corner, offset toward the player rather than along
    // one face normal: the latter can put the foot circle across the next bank.
    // A player already close to the bank need not step farther toward the void.
    const offset = profile.perimeter ? Math.min(1, STAND_OFF / Math.max(distance, EPSILON)) : 0;
    const standX = profile.perimeter ? x + (state.x - x) * offset : x + edge.nx * STAND_OFF;
    const standZ = profile.perimeter ? z + (state.z - z) * offset : z + edge.nz * STAND_OFF;
    if (reachableStandingEdge(state, standX, standZ, canStand)) {
      nearest = distance;
    } else if (profile.perimeter) {
      // Where a bank meets the platform rim, the geometrically closest point
      // can have no room for feet, while a neighbouring bank point is usable.
      // Search that same edge without relaxing reach, support or obstruction.
      const divisions = Math.ceil(Math.sqrt(lengthSquared) / .06);
      for (const direction of [-1, 1]) {
        for (let index = 1; index <= divisions; index++) {
          const candidate = Math.max(0, Math.min(1, fraction + direction * index / divisions));
          const cx = edge.a.x + ex * candidate, cz = edge.a.z + ez * candidate;
          const candidateDistance = Math.hypot(state.x - cx, state.z - cz);
          if (candidateDistance > profile.reach || candidateDistance >= nearest) break;
          const candidateOffset = Math.min(1, STAND_OFF / Math.max(candidateDistance, EPSILON));
          const endpoint = candidate === 0 || candidate === 1;
          // A shifted point inside a bank must retain perpendicular foot
          // clearance; a radial offset there would graze the bank itself.
          const sx = endpoint ? cx + (state.x - cx) * candidateOffset : cx + edge.nx * STAND_OFF;
          const sz = endpoint ? cz + (state.z - cz) * candidateOffset : cz + edge.nz * STAND_OFF;
          if (reachableStandingEdge(state, sx, sz, canStand)) {
            nearest = candidateDistance;
            break;
          }
          if (candidate === 0 || candidate === 1) break;
        }
      }
    }
  }
  return nearest;
}

export function chooseLastLightInteraction(
  distances: Readonly<Record<LastLightInteractionKey, number>>,
  previous: LastLightInteractionKey | null,
): LastLightInteractionKey | null {
  let nearest: LastLightInteractionKey | null = null, distance = Infinity;
  for (const key of LAST_LIGHT_INTERACTION_KEYS) {
    if (distances[key] < distance) { nearest = key; distance = distances[key]; }
  }
  if (previous && Number.isFinite(distances[previous]) && distances[previous] <= distance + LAST_LIGHT_INTERACTION_SWITCH_MARGIN) return previous;
  return nearest;
}
