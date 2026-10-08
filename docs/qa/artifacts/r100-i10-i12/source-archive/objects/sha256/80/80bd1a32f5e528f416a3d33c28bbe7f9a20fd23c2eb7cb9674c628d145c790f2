/** Admission of observable patrol gaps, not a second live AI or a combat solver.
 * Uses the production patrol speed/arrival/pause/turn contract. The 2.4s margin
 * exceeds the 1.2s search action; live physics/approach/alerted pursuit are tested
 * separately. No player state or enemy state is changed by this calculation. */
import { TileGrid } from '@/systems/tile-grid';
import { GAME_CONSTANTS } from '@/config/constants';
import { ENEMY_DATA } from '@/generated/enemy-data';
import { BODY_PROFILE_DATA } from '@/generated/contamination-body-data';
import { bodyHasSupport } from '@/systems/ai/physical-grid';
import { resolveNextWaypoint } from '@/systems/ai/behaviors';
import { degToRad, shortestArc, stepAngleToward } from '@/utils/math';
import { hasLineOfSight } from '@/utils/grid-raycast';
import type { EnemySpawnData } from '@/types/map-types';
import type { Vector2 } from '@/types/game-types';
import type { MasterWorld } from './r100-master-world';

const STEP_MS = 100, OBSERVATION_MS = 60000, WINDOW_MS = 2400;
export interface R100PatrolWindow {
  readonly id: string;
  readonly seat: Readonly<Vector2>;
  readonly startMs: number;
  readonly durationMs: number;
}
interface Track { position: Vector2; facing: number; index: number; direction: 1 | -1; pause: number;
  readonly points: readonly Vector2[]; readonly spawn: EnemySpawnData; readonly speed: number }
function advance(track: Track): void {
  if (track.pause > 0) {
    track.pause -= STEP_MS;
    if (track.pause <= 0) {
      const next = resolveNextWaypoint(track.spawn.patrol.mode, track.points.length, track.index, track.direction);
      track.index = next.index; track.direction = next.direction;
    }
    return;
  }
  const point = track.points[track.index]!, dx = point.x - track.position.x, dy = point.y - track.position.y, distance = Math.hypot(dx, dy);
  if (distance <= GAME_CONSTANTS.AI.ARRIVE_EPSILON) { track.pause = track.spawn.patrol.pauseMs ?? GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS; return; }
  track.facing = stepAngleToward(track.facing, Math.atan2(dy, dx), degToRad(GAME_CONSTANTS.AI.TURN_RATE) * STEP_MS / 1000);
  const move = Math.min(distance, track.speed * STEP_MS / 1000);
  track.position.x += dx / distance * move; track.position.y += dy / distance * move;
}
function sees(world: MasterWorld, track: Track, point: Readonly<Vector2>): boolean {
  const data = ENEMY_DATA[track.spawn.type], dx = point.x - track.position.x, dy = point.y - track.position.y, distance = Math.hypot(dx, dy);
  // Allow a body's positional/turning error; never admit a point at a mathematical cone edge.
  if (distance < GAME_CONSTANTS.AI.STANDOFF_DISTANCE + 8) return true;
  if (distance > data.sightRange + 8 || !hasLineOfSight(world.sight, track.position, point, data.sightRange + 8)) return false;
  const angle = Math.abs(shortestArc(Math.atan2(dy, dx) - track.facing));
  return angle <= degToRad(data.sightHalfAngleCore + 12)
    || (distance <= data.sightRangePeriph + 8 && angle <= degToRad(data.sightHalfAnglePeriph + 12));
}

export function findR100PatrolWindows(world: MasterWorld, enemies: readonly EnemySpawnData[],
  nodes: readonly { readonly id: string; readonly position: Readonly<Vector2> }[]): readonly R100PatrolWindow[] {
  if (enemies.some(enemy => enemy.patrol.mode === 'static' || enemy.patrol.waypoints.length < 2)) return [];
  const tracks: Track[] = enemies.map(spawn => ({ spawn, position: { x: (spawn.spawn.col + .5) * 8, y: (spawn.spawn.row + .5) * 8 },
    facing: degToRad(spawn.facing), index: 1, direction: 1, pause: 0,
    points: spawn.patrol.waypoints.map(cell => ({ x: (cell.col + .5) * 8, y: (cell.row + .5) * 8 })),
    speed: ENEMY_DATA[spawn.type].patrolSpeed * (BODY_PROFILE_DATA[spawn.form!.substrate]?.moveScale ?? 1) }));
  const radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS, grid = new TileGrid(world.layout.tileMap);
  const paint = new Set(world.pollution.paintCells.map(p => `${Math.floor(p.x / 32)},${Math.floor(p.y / 32)}`));
  const pending = nodes.map(node => {
    const seats: { position: Vector2; elapsed: number }[] = [];
    for (let dy = -radius; dy <= radius; dy += 8) for (let dx = -radius; dx <= radius; dx += 8) {
      const position = { x: node.position.x + dx, y: node.position.y + dy };
      if (Math.hypot(dx, dy) > radius || !bodyHasSupport(grid, position, 10, 10)
        || !hasLineOfSight(world.sight, position, node.position, radius + .001)) continue;
      const col = Math.floor(position.x / 32), row = Math.floor(position.y / 32);
      // Preserve an actual dry station even when the volume is releasing. This
      // does not remove pollution from the approach or grant a safe travel path.
      if (paint.has(`${col},${row}`) || world.pollution.volumes.some(box => col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow)) continue;
      seats.push({ position, elapsed: 0 });
    }
    return { node, seats, done: false };
  });
  const windows: R100PatrolWindow[] = [];
  for (let elapsed = STEP_MS; elapsed <= OBSERVATION_MS && windows.length < nodes.length; elapsed += STEP_MS) {
    for (const track of tracks) advance(track);
    for (const item of pending) {
      if (item.done) continue;
      for (const seat of item.seats) {
        seat.elapsed = tracks.some(track => sees(world, track, seat.position)) ? 0 : seat.elapsed + STEP_MS;
        if (seat.elapsed < WINDOW_MS) continue;
        windows.push({ id: item.node.id, seat: seat.position, startMs: elapsed - seat.elapsed, durationMs: seat.elapsed });
        item.done = true; break;
      }
    }
  }
  return windows;
}
