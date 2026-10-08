/**
 * The infiltrator's five-state FSM (docs/specs/system-enemy-ai.md, section T).
 *
 * Transitions are evaluated top-down in one fixed priority order and stop at the first
 * match, so the state after any tick is deterministic - there is no ordering ambiguity to
 * debug later. The goal is not a clever enemy but a *legible* one: the player has to be
 * able to reconstruct which of their own actions got them noticed, which means every
 * escalation has to come from one nameable cause.
 *
 * Detection accumulation lives here too, because "how long until it is sure" is the same
 * question as "when does the state change".
 */

import { floorMotionFor } from '@/generation/contamination-draw';
import { GAME_CONSTANTS } from '@/config/constants';
import { AIState, type Vector2 } from '@/types/game-types';
import type { AlertLevel, Perception } from '@/types/ai-types';
import type { Enemy } from '@/entities/enemy-factory';
import type { AIContext } from '@/systems/ai/context';
import { clearPath, nearestWaypointIndex } from '@/systems/ai/behaviors';
import { clamp, degToRad, lerp, shortestArc } from '@/utils/math';
import { hasLineOfSight } from '@/utils/grid-raycast';

/** How escalated a state reads to the outside world (contract E1). */
export function alertLevelOf(state: AIState): AlertLevel {
  switch (state) {
    case AIState.SUSPICIOUS:
      return 'suspicious';
    case AIState.ALERT:
      return 'alert';
    case AIState.CHASE:
      return 'chase';
    default:
      return 'none';
  }
}

const ALERT_RANK: Readonly<Record<AlertLevel, number>> = {
  none: 0,
  suspicious: 1,
  alert: 2,
  chase: 3,
};

export function alertRank(level: AlertLevel): number {
  return ALERT_RANK[level];
}

/**
 * Runs one perception tick's worth of state machine. `tickDtMs` is the real time since
 * this enemy's previous tick - timers and detection use real elapsed time, so the 10 Hz
 * perception cadence never changes how fast anything fills or expires (rule P1).
 */
export function stepFsm(enemy: Enemy, p: Perception, tickDtMs: number, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;

  // Suppress the hearing channel before either confidence or the rewriter's direct
  // escalation can consume it. Sight, damage and explicit noise reports stay authoritative.
  if (ctx.playerActionSilenced) p = { ...p, hearingHit: false, hearingRate: 0 };
  const calm = ai.state === AIState.PATROL || ai.state === AIState.RETURN;
  if (calm && !ai.pendingDamage && !ai.pendingNoiseLevel && !p.visible
    && (p.hearingHit || p.hearingRate > 0) && ctx.hearingSuppressed && ctx.onHearingAvoided(enemy)) {
    p = { ...p, hearingHit: false, hearingRate: 0 };
  }
  updateDetection(enemy, p, tickDtMs);

  // --- priority 1: it was hit. Being attacked needs no confidence. ---
  if (ai.pendingDamage) {
    const wasLure = ai.targetingDecoy || ai.investigatingLure === true;
    ai.pendingDamage = false;
    ai.targetingDecoy = false;
    ai.investigatingLure = false;
    ai.detection = 1;
    setLastSeen(enemy, ai.pendingDamagePos.x, ai.pendingDamagePos.y, ctx.playerVel);
    ai.losGraceMs = 0;
    if (ai.state !== AIState.CHASE) transitionTo(enemy, AIState.CHASE, ctx);
    else if (wasLure) emitRealChaseTarget(enemy, ctx);
    return;
  }

  // --- priority 2: certain and looking right at them ---
  // Suppressed perception escalation cannot bypass ALERT by filling suspicion first.
  // Damage (priority 1) remains authoritative even while escalation is suppressed.
  if (ai.detection >= 1 && p.visible && !ai.escalationSuppressed) {
    const target = sightTargetPos(enemy, ctx);
    setLastSeen(enemy, target.x, target.y, target === ctx.playerPos ? ctx.playerVel : null);
    ai.losGraceMs = 0;
    if (ai.state !== AIState.CHASE) transitionTo(enemy, AIState.CHASE, ctx);
    return;
  }

  // --- priority 3: already searching, so the bar to re-lock is lower ---
  if (
    ai.state === AIState.ALERT &&
    ai.detection >= config.REACQUIRE_THRESHOLD &&
    p.visible &&
    !ai.escalationSuppressed
  ) {
    const target = sightTargetPos(enemy, ctx);
    setLastSeen(enemy, target.x, target.y, target === ctx.playerPos ? ctx.playerVel : null);
    transitionTo(enemy, AIState.CHASE, ctx);
    return;
  }

  // --- priority 4: an "alert" grade noise (combat) ---
  if (ai.pendingNoiseLevel === 'alert') {
    ai.investigatingLure = ai.pendingNoiseIsLure === true;
    ai.pendingNoiseIsLure = false;
    ai.pendingNoiseLevel = null;
    // A noise says "something happened over there", not "the player is moving that way":
    // no velocity to extrapolate from.
    setLastSeen(enemy, ai.pendingNoisePos.x, ai.pendingNoisePos.y, null);
    if (ai.state === AIState.CHASE) {
      ai.losGraceMs = 0;
    } else if (ai.state === AIState.ALERT) {
      ai.searchTimerMs = 0;
      ai.searchHoldMs = 0;
      buildSearchPoints(enemy, ctx, ai.pendingNoisePos.x, ai.pendingNoisePos.y);
      clearPath(enemy);
    } else if (ai.state === AIState.SUSPICIOUS && ai.escalationSuppressed) {
      // delay: "不会从怀疑升级为警戒" - stays wary in place instead of starting a search.
      ai.suspicionTimerMs = 0;
    } else {
      transitionTo(enemy, AIState.ALERT, ctx);
    }
    return;
  }

  // --- priority 4b: rewriter hearing fill can push to ALERT, never CHASE ---
  if (applyHearingAlertPush(enemy, p, ctx)) return;

  // --- priority 5: something is off. Vision below certainty, hearing, or a noise report ---
  const hearingFill = p.hearingRate > 0;
  const seenEnough =
    ai.detection >= config.SUSPICION_THRESHOLD && (p.visible || hearingFill);
  const noiseStimulus = ai.pendingNoiseLevel === 'suspicious';

  const entering = ai.state === AIState.PATROL || ai.state === AIState.RETURN;

  if (seenEnough || p.hearingHit || noiseStimulus) {
    ai.pendingNoiseLevel = null;

    // Where to look. Sight gives an exact position; hearing must not - a through-wall
    // exact locator reads as cheating, so it is fuzzed and sampled only once per episode
    // (rule P7). A reported noise always refreshes the point (rule P8).
    if (noiseStimulus) {
      ai.investigatingLure = ai.pendingNoiseIsLure === true;
      ai.pendingNoiseIsLure = false;
      setInvestigatePos(enemy, ctx, ai.pendingNoisePos.x, ai.pendingNoisePos.y, enemy.config.hearing.posJitter);
    } else if (seenEnough) {
      const target = sightTargetPos(enemy, ctx);
      setInvestigatePos(enemy, ctx, target.x, target.y, 0);
    } else if (entering) {
      ai.investigatingLure = false;
      setHearingInvestigatePos(enemy, ctx);
    }

    if (entering) {
      transitionTo(enemy, AIState.SUSPICIOUS, ctx);
    } else {
      // Already wary: same state, timer back to zero (rule 5). Escalating from suspicion
      // to a full search on its own would let it frighten itself into a loop (rule T-C3).
      switch (ai.state) {
        case AIState.SUSPICIOUS:
          ai.suspicionTimerMs = 0;
          break;
        case AIState.ALERT:
          ai.searchTimerMs = 0;
          break;
        case AIState.CHASE:
          ai.losGraceMs = 0;
          break;
        default:
          break;
      }
    }
    return;
  }

  applyDowngrades(enemy, p, tickDtMs, ctx);
}

/**
 * Timer and distance driven de-escalation (priority 6). The full ladder takes about
 * 8.4 s plus the walk home, which is what makes being spotted an actual cost rather than
 * an inconvenience - long enough to hurt, short enough not to abandon the map over.
 */
function applyDowngrades(enemy: Enemy, p: Perception, tickDtMs: number, ctx: AIContext): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;

  switch (ai.state) {
    case AIState.CHASE: {
      if (p.visible) {
        ai.losGraceMs = 0;
        const target = sightTargetPos(enemy, ctx);
        setLastSeen(enemy, target.x, target.y, target === ctx.playerPos ? ctx.playerVel : null);
        return;
      }
      ai.losGraceMs += tickDtMs;
      if (ai.losGraceMs >= config.LOS_GRACE_MS || p.distance > config.CHASE_ABANDON_RANGE) {
        transitionTo(enemy, AIState.ALERT, ctx);
      }
      return;
    }
    case AIState.ALERT: {
      if (ai.searchTimerMs >= config.LOST_PLAYER_DURATION) {
        // Nothing left to investigate: it stands where it is and stays wary.
        ai.investigatePos = null;
        transitionTo(enemy, AIState.SUSPICIOUS, ctx);
      }
      return;
    }
    case AIState.SUSPICIOUS: {
      if (
        ai.suspicionTimerMs >= config.ALERT_DURATION &&
        ai.detection < config.SUSPICION_THRESHOLD
      ) {
        transitionTo(enemy, AIState.RETURN, ctx);
      }
      return;
    }
    default:
      // PATROL has nothing below it; RETURN ends on arrival, which the behaviour detects.
      return;
  }
}

/**
 * Applies a state change: entry actions, then the outward-facing events.
 *
 * Escalations emit `ENEMY_ALERT`; de-escalations stay silent, and the single
 * `ENEMY_LOST_PLAYER` that closes an episode is emitted when the enemy drops back to a
 * calm state. That pairing is what lets consumers keep a "how many enemies are alerted"
 * count without leaking (contract E1/E2).
 */
export function transitionTo(enemy: Enemy, next: AIState, ctx: AIContext): void {
  const ai = enemy.ai;
  if (ai.state === next) return;

  const fromLevel = alertLevelOf(ai.state);
  const toLevel = alertLevelOf(next);
  ai.state = next;

  clearPath(enemy);
  ai.repathCooldownMs = 0;
  ai.pathFailCount = 0;
  ai.scanPhaseMs = 0;
  ai.scanIndex = 0;

  switch (next) {
    case AIState.PATROL:
      // Arriving home counts as reaching a waypoint: dwell and scan before moving on.
      ai.waypointPauseMs = enemy.spawnData.patrol.pauseMs ?? GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS;
      ai.engaged = false;
      ai.investigatePos = null;
      ai.searchPointCount = 0;
      break;
    case AIState.SUSPICIOUS:
      ai.suspicionTimerMs = 0;
      ai.suspiciousTurnHoldMs = suspiciousTurnHoldFor(enemy);
      ai.engaged = false;
      break;
    case AIState.ALERT:
      ai.searchTimerMs = 0;
      ai.searchHoldMs = 0;
      ai.engaged = false;
      buildSearchPoints(
        enemy,
        ctx,
        ai.lastSeenPlayerPos?.x ?? ai.position.x,
        ai.lastSeenPlayerPos?.y ?? ai.position.y
      );
      break;
    case AIState.CHASE:
      ai.losGraceMs = 0;
      ai.searchPointCount = 0;
      break;
    case AIState.RETURN:
      ai.engaged = false;
      ai.investigatePos = null;
      ai.searchPointCount = 0;
      ai.patrolIndex = nearestWaypointIndex(enemy);
      ai.waypointPauseMs = 0;
      break;
  }

  if (alertRank(toLevel) > alertRank(fromLevel)) {
    ai.alertEpisodeActive = true;
    ctx.emitAlert(enemy, toLevel as Exclude<AlertLevel, 'none'>);
    ctx.cue(enemy, toLevel === 'chase' ? 'ai.cue.chase' : toLevel === 'alert' ? 'ai.cue.alert' : 'ai.cue.suspicious');
  } else if (toLevel === 'none' && ai.alertEpisodeActive) {
    closeAlertEpisode(enemy, ctx);
  }
}

function applyHearingAlertPush(enemy: Enemy, p: Perception, ctx: AIContext): boolean {
  const ai = enemy.ai;
  const profile = enemy.config.profile;
  const config = GAME_CONSTANTS.AI;
  if (profile.hearingMaxPush !== 'alert') return false;
  if (p.hearingRate <= 0) return false;
  if (ai.detection < config.HEAR_ALERT_THRESHOLD) return false;
  if (p.visible) return false;

  ai.investigatingLure = false;

  if (ai.state === AIState.ALERT || ai.state === AIState.CHASE) {
    ai.searchTimerMs = 0;
    setHearingInvestigatePos(enemy, ctx);
    if (ai.state === AIState.ALERT && ai.investigatePos) {
      buildSearchPoints(enemy, ctx, ai.investigatePos.x, ai.investigatePos.y);
    }
    return true;
  }

  if (ai.state === AIState.SUSPICIOUS && ai.escalationSuppressed) {
    ai.suspicionTimerMs = 0;
    return true;
  }

  setHearingInvestigatePos(enemy, ctx);
  if (ai.investigatePos) {
    setLastSeen(enemy, ai.investigatePos.x, ai.investigatePos.y, null);
  }
  transitionTo(enemy, AIState.ALERT, ctx);
  return true;
}

function setHearingInvestigatePos(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  if (ai.hearingJitterLocked && ai.investigatePos) return;
  setInvestigatePos(enemy, ctx, ctx.playerPos.x, ctx.playerPos.y, enemy.config.hearing.posJitter);
  ai.hearingJitterLocked = true;
}

/** Emits the episode-closing `ENEMY_LOST_PLAYER` exactly once. */
export function closeAlertEpisode(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  if (!ai.alertEpisodeActive) return;
  ai.alertEpisodeActive = false;
  ai.hearingJitterLocked = false;
  ai.investigatingLure = false;
  ai.targetingDecoy = false;
  ctx.emitLost(enemy);
  ctx.cue(enemy, 'ai.cue.lost');
}

/**
 * Builds the ALERT search queue around `originX/originY` (rule B3): where the player was
 * last seen, where they would be if they kept running, and one spot nearby. The
 * extrapolated point is what makes fleeing in a straight line a bad idea.
 */
export function buildSearchPoints(
  enemy: Enemy,
  ctx: AIContext,
  originX: number,
  originY: number
): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  const points = ai.searchPoints;
  if (floorMotionFor(enemy.getForm()) !== 'motion_patrol') {
    ai.searchPointCount = 0;
    ai.searchIndex = 0;
    return;
  }
  let count = 0;

  if (ctx.pathfinder.findNearestWalkable(originX, originY, points[count]!)) count++;

  const velocity = ai.lastSeenPlayerVel;
  if (velocity && (velocity.x !== 0 || velocity.y !== 0)) {
    const aheadX = originX + velocity.x * config.EXTRAPOLATE_SEC;
    const aheadY = originY + velocity.y * config.EXTRAPOLATE_SEC;
    if (ctx.pathfinder.findNearestWalkable(aheadX, aheadY, points[count]!)) {
      const first = points[0]!;
      const spread = Math.hypot(points[count]!.x - first.x, points[count]!.y - first.y);
      if (count === 0 || spread > config.ARRIVE_EPSILON) count++;
    }
  }

  const angle = (ctx.random ?? Math.random)() * Math.PI * 2;
  const radius = config.SEARCH_SPREAD * (0.5 + (ctx.random ?? Math.random)() * 0.5);
  if (
    count < points.length &&
    ctx.pathfinder.findNearestWalkable(
      originX + Math.cos(angle) * radius,
      originY + Math.sin(angle) * radius,
      points[count]!
    )
  ) {
    count++;
  }

  ai.searchPointCount = count;
  ai.searchIndex = 0;
}

/**
 * Records a sighting: where, and how fast they were going. The velocity is what the
 * search later extrapolates from, so passing `null` (a noise, not a sighting) correctly
 * leaves the search with nothing to guess with.
 *
 * Allocates on the very first sighting only - these two vectors then live for the
 * lifetime of the enemy.
 */
function setLastSeen(enemy: Enemy, x: number, y: number, velocity: Readonly<Vector2> | null): void {
  const ai = enemy.ai;
  if (!ai.lastSeenPlayerPos) ai.lastSeenPlayerPos = { x, y };
  else {
    ai.lastSeenPlayerPos.x = x;
    ai.lastSeenPlayerPos.y = y;
  }

  const velocityX = velocity?.x ?? 0;
  const velocityY = velocity?.y ?? 0;
  if (!ai.lastSeenPlayerVel) ai.lastSeenPlayerVel = { x: velocityX, y: velocityY };
  else {
    ai.lastSeenPlayerVel.x = velocityX;
    ai.lastSeenPlayerVel.y = velocityY;
  }
}

/**
 * Slice 5 mirror tool (T1): redirects a *visual* sighting to the decoy's position when
 * one is active and within this enemy's core sight range - "视野内敌人优先对镜像产生
 * 怀疑,忽略真身方向" (`data/contaminants.csv`, mirror). Deliberately not used by the
 * hearing- or noise-driven branches above: a silent decoy cannot fool an ear.
 */
function sightTargetPos(enemy: Enemy, ctx: AIContext): Readonly<Vector2> {
  const decoy = ctx.decoyPos;
  if (decoy && !(enemy.ai.state === AIState.CHASE && !enemy.ai.targetingDecoy) && enemy.config.profile.visionWeight > 0) {
    const range = enemy.config.sight.rangeCore * enemy.ai.perceptionRangeMult;
    const dx = decoy.x - enemy.ai.position.x;
    const dy = decoy.y - enemy.ai.position.y;
    const insideCone = Math.abs(shortestArc(Math.atan2(dy, dx) - enemy.ai.facingAngle)) <= enemy.config.sight.halfAngleCore;
    if (dx * dx + dy * dy <= range * range && insideCone && hasLineOfSight(ctx.occluders, enemy.ai.position, decoy)) {
      enemy.ai.targetingDecoy = true;
      enemy.ai.investigatingLure = true;
      return decoy;
    }
  }
  const wasLure = enemy.ai.targetingDecoy || enemy.ai.investigatingLure === true;
  enemy.ai.targetingDecoy = false;
  enemy.ai.investigatingLure = false;
  if (wasLure && enemy.ai.state === AIState.CHASE) emitRealChaseTarget(enemy, ctx);
  return ctx.playerPos;
}

/** A real player newly replaces a false target even if the FSM state remains CHASE. */
function emitRealChaseTarget(enemy: Enemy, ctx: AIContext): void {
  enemy.ai.alertEmitCooldownMs = 0;
  ctx.emitAlert(enemy, 'chase');
}

function setInvestigatePos(enemy: Enemy, ctx: AIContext, x: number, y: number, jitter: number): void {
  const ai = enemy.ai;
  let targetX = x;
  let targetY = y;
  if (jitter > 0) {
    const angle = (ctx.random ?? Math.random)() * Math.PI * 2;
    const radius = (ctx.random ?? Math.random)() * jitter;
    targetX += Math.cos(angle) * radius;
    targetY += Math.sin(angle) * radius;
  }
  if (!ai.investigatePos) ai.investigatePos = { x: targetX, y: targetY };
  else {
    ai.investigatePos.x = targetX;
    ai.investigatePos.y = targetY;
  }
}

/**
 * How long the enemy stands still while turning to look. Rule B2 requires this pause to
 * last long enough to be *seen* - it is the player's only advance warning, so a target
 * that happens to be dead ahead must not skip it.
 */
function suspiciousTurnHoldFor(enemy: Enemy): number {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  if (!ai.investigatePos) return config.SUSPICIOUS_TURN_HOLD_MS;

  const target = Math.atan2(
    ai.investigatePos.y - ai.position.y,
    ai.investigatePos.x - ai.position.x
  );
  const sweep = Math.abs(Math.atan2(Math.sin(target - ai.facingAngle), Math.cos(target - ai.facingAngle)));
  const turnMs = (sweep / degToRad(config.TURN_RATE)) * 1000;
  return Math.max(config.SUSPICIOUS_TURN_HOLD_MS, turnMs);
}

/** Detection fill and decay (rules P5 / P5b / P5c / P6). */
function updateDetection(enemy: Enemy, p: Perception, tickDtMs: number): void {
  const ai = enemy.ai;
  const config = GAME_CONSTANTS.AI;
  const profile = enemy.config.profile;
  const dt = tickDtMs / 1000;

  if (ai.state === AIState.CHASE) {
    if (p.visible) ai.detection = 1;
    return;
  }

  let rateVision = 0;
  if (p.visible) {
    const distFactor = lerp(
      config.DETECT_DIST_FACTOR_NEAR,
      config.DETECT_DIST_FACTOR_FAR,
      clamp(p.distance / profile.sightRange, 0, 1)
    );
    const zoneFactor = p.zone === 'peripheral' ? config.DETECT_ZONE_FACTOR_PERIPH : 1;
    rateVision =
      (1 / config.DETECT_FILL_TIME) *
      distFactor *
      zoneFactor *
      profile.visionWeight *
      ai.detectionFillRateMult;
  }

  const rateHear = p.hearingRate * ai.detectionFillRateMult;
  if (rateVision > 0 || rateHear > 0) {
    const before = ai.detection;
    const next = Math.min(1, before + (rateVision + rateHear) * dt);
    if (p.hearingStill && rateHear > 0 && rateVision <= 0) {
      ai.detection = before >= config.HEARING_STILL_CAP ? before : Math.min(next, config.HEARING_STILL_CAP);
    } else {
      ai.detection = next;
    }
    return;
  }

  const decayScale = ai.state === AIState.ALERT ? config.DETECT_DECAY_ALERT_SCALE : 1;
  ai.detection = Math.max(0, ai.detection - config.DETECT_DECAY_RATE * decayScale * dt);
}
