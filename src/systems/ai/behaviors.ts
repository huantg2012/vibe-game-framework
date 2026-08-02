/**
 * What each state actually does (docs/specs/system-enemy-ai.md, section B).
 *
 * The first readable signal is always the behaviour itself, never an effect (rule R1):
 * patrol is an even walk with pauses, suspicion is *stop - turn - creep*, searching is
 * middling speed with stop-and-look, a chase is flat-out and direct, and walking home is
 * unhurried and facing away. A player who can read those five apart can make the
 * "go around or risk it" decision without being told anything.
 *
 * Movement is expressed as an intent (direction, speed, optional look angle) that is
 * resolved once at the end of each enemy's update. That keeps turning, separation and
 * velocity in one place instead of scattered through five state handlers, and it means
 * nothing here allocates - the intent is a single module-level scratch object reused by
 * every enemy in the frame.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { AIState, type Vector2 } from '@/types/game-types';
import type { EnemyAIState } from '@/types/ai-types';
import type { PatrolMode } from '@/types/map-types';
import type { Enemy } from '@/entities/enemy-factory';
import type { AIContext } from '@/systems/ai/context';
import { hasClearPath } from '@/utils/grid-raycast';
import { degToRad, quantizeFacing4, stepAngleToward } from '@/utils/math';

/** Reused every enemy, every frame. Never escapes this module. */
const intent = {
  dirX: 0,
  dirY: 0,
  speed: 0,
  lookAngle: 0,
  hasLook: false,
};

const scratchTarget: Vector2 = { x: 0, y: 0 };

/** Two legs per waypoint - one for each direction a pingpong route can leave it in. */
export function patrolLegIndex(fromIndex: number, direction: 1 | -1): number {
  return fromIndex * 2 + (direction > 0 ? 0 : 1);
}

/** Where a route goes after `index`, and which way it is then travelling. */
export function resolveNextWaypoint(
  mode: PatrolMode,
  count: number,
  index: number,
  direction: 1 | -1
): { index: number; direction: 1 | -1 } {
  if (mode === 'static' || count <= 1) return { index, direction };
  if (mode === 'loop') return { index: (index + 1) % count, direction };

  // pingpong: turn around at either end.
  let nextDirection = direction;
  let next = index + direction;
  if (next >= count) {
    nextDirection = -1;
    next = index - 1;
  } else if (next < 0) {
    nextDirection = 1;
    next = index + 1;
  }
  return { index: Math.max(0, Math.min(count - 1, next)), direction: nextDirection };
}

export function clearPath(enemy: Enemy): void {
  enemy.ai.pathPoints = null;
  enemy.ai.pathLength = 0;
  enemy.ai.pathCursor = 0;
}

/** Follows an existing points array by reference - precomputed patrol legs are not copied. */
function setPath(enemy: Enemy, points: Vector2[] | null): void {
  if (!points || points.length === 0) {
    clearPath(enemy);
    return;
  }
  enemy.ai.pathPoints = points;
  enemy.ai.pathLength = points.length;
  enemy.ai.pathCursor = 0;
}

/** Starts (or restarts) the current patrol leg, remembering it so it can be resumed. */
export function setPatrolLeg(enemy: Enemy, leg: Vector2[] | null): void {
  enemy.ai.currentPatrolLeg = leg;
  setPath(enemy, leg);
}

/** Rejoins the remembered leg at its closest point, so no progress is thrown away. */
function resumePatrolLeg(enemy: Enemy): void {
  const ai = enemy.ai;
  const leg = ai.currentPatrolLeg;
  if (!leg || leg.length === 0) return;

  let nearest = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < leg.length; i++) {
    const distance = distanceTo(ai, leg[i]!);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = i;
    }
  }

  ai.pathPoints = leg;
  ai.pathLength = leg.length;
  ai.pathCursor = nearest;
}

/** Publishes an A* result that was written into the enemy's own dynamic buffer. */
export function assignDynamicPath(enemy: Enemy, pointCount: number): void {
  const ai = enemy.ai;
  if (pointCount <= 0) {
    clearPath(enemy);
    return;
  }
  ai.pathPoints = ai.dynamicPath;
  ai.pathLength = pointCount;
  ai.pathCursor = 0;
}

export function hasUsablePath(ai: EnemyAIState): boolean {
  return ai.pathPoints !== null && ai.pathCursor < ai.pathLength;
}

/** Index of the patrol waypoint closest in a straight line - where RETURN heads for. */
export function nearestWaypointIndex(enemy: Enemy): number {
  const ai = enemy.ai;
  let best = ai.patrolIndex;
  let bestDistanceSq = Infinity;
  for (let i = 0; i < ai.patrolWaypoints.length; i++) {
    const waypoint = ai.patrolWaypoints[i]!;
    const deltaX = waypoint.x - ai.position.x;
    const deltaY = waypoint.y - ai.position.y;
    const distanceSq = deltaX * deltaX + deltaY * deltaY;
    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      best = i;
    }
  }
  return best;
}

/** Runs one frame of behaviour for one enemy and writes the resulting velocity/facing. */
export function updateBehavior(enemy: Enemy, ctx: AIContext): void {
  intent.dirX = 0;
  intent.dirY = 0;
  intent.speed = 0;
  intent.hasLook = false;

  switch (enemy.ai.state) {
    case AIState.PATROL:
      updatePatrol(enemy, ctx);
      break;
    case AIState.SUSPICIOUS:
      updateSuspicious(enemy, ctx);
      break;
    case AIState.ALERT:
      updateAlert(enemy, ctx);
      break;
    case AIState.CHASE:
      updateChase(enemy, ctx);
      break;
    case AIState.RETURN:
      updateReturn(enemy, ctx);
      break;
  }

  applySeparation(enemy, ctx);
  applyFacing(enemy, ctx);
  applyVelocity(enemy);
}

// ------------------------------------------------------------------ states

/**
 * Even pace along the authored route, dwelling at each waypoint. The dwell is the
 * player's window: a patrol that never stops is a train timetable, one that stops too
 * long is a waiting game.
 */
function updatePatrol(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  const waypoints = ai.patrolWaypoints;
  if (waypoints.length === 0) return;

  const route = enemy.spawnData.patrol;

  if (ai.waypointPauseMs > 0) {
    ai.waypointPauseMs -= ctx.dtMs;
    scanWaypointAngles(enemy, ctx, route.scanAngles);
    if (ai.waypointPauseMs <= 0) {
      ai.waypointPauseMs = 0;
      advancePatrol(enemy);
    }
    return;
  }

  const target = waypoints[ai.patrolIndex]!;
  if (distanceTo(ai, target) <= config.ARRIVE_EPSILON) {
    ai.waypointPauseMs = route.pauseMs ?? config.WAYPOINT_PAUSE_MS;
    ai.scanIndex = 0;
    ai.scanPhaseMs = 0;
    clearPath(enemy);
    return;
  }

  // Patrol legs were precomputed at create, so patrolling never asks A* for anything.
  // If the leg was dropped (an unstick, say), pick it back up at the nearest point rather
  // than walking the whole leg again - or, worse, falling back to a straight line that
  // aims through a wall.
  const speed = enemy.config.speeds[AIState.PATROL];
  if (!hasUsablePath(ai) && ai.currentPatrolLeg) resumePatrolLeg(enemy);
  if (hasUsablePath(ai) && followPath(enemy, speed)) return;
  steerTo(enemy, target.x, target.y, speed);
}

/**
 * Stop, turn, then creep in. The standstill at the start is deliberately held long
 * enough to be seen even when the enemy is already facing the right way - it is the only
 * warning the player gets before certainty completes (rule B2).
 */
function updateSuspicious(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  ai.suspicionTimerMs += ctx.dtMs;

  const target = ai.investigatePos;
  if (!target) {
    // Downgraded out of a search: nothing specific left to look at, stay wary in place.
    scanInPlace(enemy, ctx);
    return;
  }

  if (ai.suspiciousTurnHoldMs > 0) {
    ai.suspiciousTurnHoldMs -= ctx.dtMs;
    lookAt(ai, target.x, target.y);
    return;
  }

  if (distanceTo(ai, target) > config.ARRIVE_EPSILON) {
    navigateTo(enemy, ctx, target.x, target.y, enemy.config.speeds[AIState.SUSPICIOUS]);
    return;
  }

  scanInPlace(enemy, ctx);
}

/** Work through the search points, looking around at each one. */
function updateAlert(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  ai.searchTimerMs += ctx.dtMs;

  if (ai.searchHoldMs > 0) {
    ai.searchHoldMs -= ctx.dtMs;
    scanInPlace(enemy, ctx);
    if (ai.searchHoldMs <= 0) {
      ai.searchHoldMs = 0;
      ai.searchIndex++;
      ai.scanPhaseMs = 0;
      clearPath(enemy);
    }
    return;
  }

  if (ai.searchIndex < ai.searchPointCount) {
    const target = ai.searchPoints[ai.searchIndex]!;
    if (distanceTo(ai, target) <= config.ARRIVE_EPSILON) {
      ai.searchHoldMs = config.SEARCH_HOLD_MS;
      ai.scanPhaseMs = 0;
      clearPath(enemy);
      return;
    }
    navigateTo(enemy, ctx, target.x, target.y, enemy.config.speeds[AIState.ALERT]);
    return;
  }

  // Queue exhausted but the search timer has not run out: keep looking from here.
  scanInPlace(enemy, ctx);
}

/**
 * Straight at the player while it can see them, at the last known position while it
 * cannot. Closing to `STANDOFF_DISTANCE` and holding there is where this system stops:
 * whether to actually swing is combat's decision (`isEngaged()`).
 */
function updateChase(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;

  const sees = ai.losGraceMs === 0;
  const target = sees || !ai.lastSeenPlayerPos ? ctx.playerPos : ai.lastSeenPlayerPos;
  const distance = distanceTo(ai, ctx.playerPos);

  if (sees && distance <= config.STANDOFF_DISTANCE) ai.engaged = true;
  else if (!sees || distance > config.STANDOFF_DISTANCE + config.STANDOFF_BAND) ai.engaged = false;

  if (ai.engaged) {
    lookAt(ai, ctx.playerPos.x, ctx.playerPos.y);
    if (distance < config.STANDOFF_DISTANCE - config.STANDOFF_BAND) {
      steerTo(
        enemy,
        ai.position.x * 2 - ctx.playerPos.x,
        ai.position.y * 2 - ctx.playerPos.y,
        config.STANDOFF_ADJUST_SPEED
      );
    }
    return;
  }

  navigateTo(enemy, ctx, target.x, target.y, enemy.config.speeds[AIState.CHASE]);
}

/** Walk back to the nearest waypoint and resume the route. */
function updateReturn(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  const waypoints = ai.patrolWaypoints;

  if (waypoints.length === 0 || ai.pathFailCount >= config.PATH_FAIL_LIMIT) {
    // Cannot get home (or there is nowhere to get home to): resume patrolling here.
    ctx.requestState(enemy, AIState.PATROL);
    return;
  }

  const target = waypoints[ai.patrolIndex]!;
  if (distanceTo(ai, target) <= config.ARRIVE_EPSILON) {
    ctx.requestState(enemy, AIState.PATROL);
    return;
  }

  navigateTo(enemy, ctx, target.x, target.y, enemy.config.speeds[AIState.RETURN]);
}

// ------------------------------------------------------------------ navigation

/**
 * Heads for a world position, using a straight line when one exists and a path when it
 * does not (rules N3/N4).
 *
 * Testing for a clear line before asking for a path is the single most effective
 * simplification available: during a chase it is true most of the time, which keeps A*
 * usage near zero exactly when the frame budget matters most. The test is width-aware,
 * because a sight line can pass a corner the body cannot.
 *
 * While a path is still pending the enemy keeps moving - either along its previous path
 * or straight at the target, leaning on Arcade to slide it along walls. Standing still
 * waiting for a path would read as the enemy freezing, which is worse than any imperfect
 * route.
 */
function navigateTo(
  enemy: Enemy,
  ctx: AIContext,
  targetX: number,
  targetY: number,
  speed: number
): void {
  const ai = enemy.ai;
  scratchTarget.x = targetX;
  scratchTarget.y = targetY;

  const clearance = GAME_CONSTANTS.AI.BODY_SIZE;
  if (
    ai.preferPathMs <= 0 &&
    hasClearPath(ctx.occluders, ai.position, scratchTarget, clearance)
  ) {
    clearPath(enemy);
    ai.pathRequestPending = false;
    steerTo(enemy, targetX, targetY, speed);
    return;
  }

  const following = hasUsablePath(ai);
  const drift = Math.hypot(
    targetX - ai.pathTargetAtRequest.x,
    targetY - ai.pathTargetAtRequest.y
  );
  if (!following || drift > GAME_CONSTANTS.AI.REPATH_MOVE_THRESHOLD) {
    requestPath(enemy, targetX, targetY);
  }

  if (following && followPath(enemy, speed)) return;
  steerTo(enemy, targetX, targetY, speed);
}

function requestPath(enemy: Enemy, targetX: number, targetY: number): void {
  const ai = enemy.ai;
  ai.pathRequestTarget.x = targetX;
  ai.pathRequestTarget.y = targetY;
  if (!ai.pathRequestPending) {
    ai.pathRequestPending = true;
    ai.pathRequestAgeMs = 0;
  }
}

/** Advances along the current path. Returns false once it has been walked out. */
function followPath(enemy: Enemy, speed: number): boolean {
  const ai = enemy.ai;
  const points = ai.pathPoints;
  if (!points) return false;

  const epsilon = GAME_CONSTANTS.AI.ARRIVE_EPSILON;
  while (ai.pathCursor < ai.pathLength) {
    const point = points[ai.pathCursor]!;
    if (distanceTo(ai, point) > epsilon) {
      steerTo(enemy, point.x, point.y, speed);
      return true;
    }
    ai.pathCursor++;
  }

  clearPath(enemy);
  return false;
}

// ------------------------------------------------------------------ intent helpers

function steerTo(enemy: Enemy, targetX: number, targetY: number, speed: number): void {
  intent.dirX = targetX - enemy.ai.position.x;
  intent.dirY = targetY - enemy.ai.position.y;
  intent.speed = speed;
}

function lookAt(ai: EnemyAIState, targetX: number, targetY: number): void {
  intent.lookAngle = Math.atan2(targetY - ai.position.y, targetX - ai.position.x);
  intent.hasLook = true;
}

/**
 * Sweeps the head left and right around the heading the sweep started on. Piecewise
 * rather than sinusoidal on purpose: the turn rate then produces a visible dwell at each
 * extreme, so "it is looking around" reads at a glance.
 */
function scanInPlace(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  if (ai.scanPhaseMs === 0) ai.scanBaseAngle = ai.facingAngle;
  ai.scanPhaseMs += ctx.dtMs;

  const phase = ai.scanPhaseMs % config.SCAN_SWEEP_PERIOD_MS;
  const side = phase < config.SCAN_SWEEP_PERIOD_MS / 2 ? 1 : -1;
  intent.lookAngle = ai.scanBaseAngle + degToRad(config.SCAN_SWEEP_ANGLE) * side;
  intent.hasLook = true;
}

/** Cycles the authored scan headings while dwelling at a waypoint (rule B1). */
function scanWaypointAngles(
  enemy: Enemy,
  ctx: AIContext,
  scanAngles: readonly number[] | undefined
): void {
  if (!scanAngles || scanAngles.length === 0) return;

  const ai = enemy.ai;
  ai.scanPhaseMs += ctx.dtMs;
  if (ai.scanPhaseMs >= GAME_CONSTANTS.AI.SCAN_HOLD_MS) {
    ai.scanPhaseMs = 0;
    ai.scanIndex = (ai.scanIndex + 1) % scanAngles.length;
  }
  intent.lookAngle = degToRad(scanAngles[ai.scanIndex]!);
  intent.hasLook = true;
}

function advancePatrol(enemy: Enemy): void {
  const ai = enemy.ai;
  const from = ai.patrolIndex;
  const next = resolveNextWaypoint(ai.patrolMode, ai.patrolWaypoints.length, from, ai.patrolDir);

  ai.patrolIndex = next.index;
  ai.patrolDir = next.direction;
  if (next.index === from) {
    setPatrolLeg(enemy, null);
    return;
  }
  setPatrolLeg(enemy, ai.patrolPaths[patrolLegIndex(from, next.direction)] ?? null);
}

/**
 * Soft repulsion instead of enemy-vs-enemy physics: two bodies colliding in a corridor
 * jam and jitter, which looks broken. Nudging their headings apart does not.
 */
function applySeparation(enemy: Enemy, ctx: AIContext): void {
  if (intent.speed <= 0) return;

  const config = GAME_CONSTANTS.AI;
  const radius = config.SEPARATION_RADIUS;
  const ai = enemy.ai;
  let pushX = 0;
  let pushY = 0;

  for (const other of ctx.enemies) {
    if (other === enemy) continue;
    const deltaX = ai.position.x - other.ai.position.x;
    const deltaY = ai.position.y - other.ai.position.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance >= radius || distance <= 0.001) continue;
    const strength = (radius - distance) / radius / distance;
    pushX += deltaX * strength;
    pushY += deltaY * strength;
  }

  if (pushX === 0 && pushY === 0) return;

  const length = Math.hypot(intent.dirX, intent.dirY);
  if (length > 0) {
    intent.dirX /= length;
    intent.dirY /= length;
  }
  intent.dirX += pushX * config.SEPARATION_WEIGHT;
  intent.dirY += pushY * config.SEPARATION_WEIGHT;
}

/**
 * Turns at `TURN_RATE` toward the movement direction, or toward an explicit look target
 * when standing. Turn rate is a balance value, not a cosmetic one: it is what decides
 * whether getting behind the enemy is a move or a coin flip (invariant I6).
 */
function applyFacing(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  let target: number | null = null;

  if (intent.speed > 0 && (intent.dirX !== 0 || intent.dirY !== 0)) {
    target = Math.atan2(intent.dirY, intent.dirX);
  } else if (intent.hasLook) {
    target = intent.lookAngle;
  }

  if (target !== null) {
    const maxStep = degToRad(GAME_CONSTANTS.AI.TURN_RATE) * (ctx.dtMs / 1000);
    ai.facingAngle = stepAngleToward(ai.facingAngle, target, maxStep);
  }

  ai.facing4 = quantizeFacing4(
    ai.facingAngle,
    ai.facing4,
    degToRad(GAME_CONSTANTS.PLAYER.FACING_QUANT_HYSTERESIS)
  );
}

function applyVelocity(enemy: Enemy): void {
  if (intent.speed <= 0) {
    enemy.setVelocity(0, 0);
    return;
  }

  const length = Math.hypot(intent.dirX, intent.dirY);
  if (length <= 0.0001) {
    enemy.setVelocity(0, 0);
    return;
  }

  const scale = intent.speed / length;
  enemy.setVelocity(intent.dirX * scale, intent.dirY * scale);
}

function distanceTo(ai: EnemyAIState, target: Readonly<Vector2>): number {
  return Math.hypot(target.x - ai.position.x, target.y - ai.position.y);
}
