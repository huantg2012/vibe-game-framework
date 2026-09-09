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

  updateDetection(enemy, p, tickDtMs);

  // --- priority 1: it was hit. Being attacked needs no confidence. ---
  if (ai.pendingDamage) {
    ai.pendingDamage = false;
    ai.targetingDecoy = false;
    ai.detection = 1;
    setLastSeen(enemy, ai.pendingDamagePos.x, ai.pendingDamagePos.y, ctx.playerVel);
    ai.losGraceMs = 0;
    if (ai.state !== AIState.CHASE) transitionTo(enemy, AIState.CHASE, ctx);
    return;
  }

  // --- priority 2: certain and looking right at them ---
  // delay (T7 rewire): "不会从警戒升级为追击" - only the ALERT→CHASE leg is named, so a
  // SUSPICIOUS enemy reaching full detection still completes its suspicion normally.
  if (ai.detection >= 1 && p.visible && !(ai.state === AIState.ALERT && ai.escalationSuppressed)) {
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

  // muffle (T7 rewire): a hearing-only signal pulling a calm enemy into SUSPICIOUS is
  // exactly "被近距发现" - the one case the CSV describes ("360度近距检测对玩家无效").
  // Sight and reported noises are never swallowed, only this.
  const hearingOnly = (p.hearingHit || hearingFill) && !p.visible && !noiseStimulus;
  const entering = ai.state === AIState.PATROL || ai.state === AIState.RETURN;
  if (hearingOnly && entering && ctx.hearingSuppressed && ctx.onHearingAvoided(enemy)) {
    // Stays calm (PATROL/RETURN have no downgrade of their own) - the whole point of
    // muffle is that this tick looks exactly like nothing happened.
    return;
  }

  if (seenEnough || p.hearingHit || noiseStimulus) {
    ai.pendingNoiseLevel = null;

    // Where to look. Sight gives an exact position; hearing must not - a through-wall
    // exact locator reads as cheating, so it is fuzzed and sampled only once per episode
    // (rule P7). A reported noise always refreshes the point (rule P8).
    if (noiseStimulus) {
      setInvestigatePos(enemy, ai.pendingNoisePos.x, ai.pendingNoisePos.y, enemy.config.hearing.posJitter);
    } else if (seenEnough) {
      const target = sightTargetPos(enemy, ctx);
      setInvestigatePos(enemy, target.x, target.y, 0);
    } else if (entering) {
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
  setInvestigatePos(enemy, ctx.playerPos.x, ctx.playerPos.y, enemy.config.hearing.posJitter);
  ai.hearingJitterLocked = true;
}

/** Emits the episode-closing `ENEMY_LOST_PLAYER` exactly once. */
export function closeAlertEpisode(enemy: Enemy, ctx: AIContext): void {
  const ai = enemy.ai;
  if (!ai.alertEpisodeActive) return;
  ai.alertEpisodeActive = false;
  ai.hearingJitterLocked = false;
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

  const angle = Math.random() * Math.PI * 2;
  const radius = config.SEARCH_SPREAD * (0.5 + Math.random() * 0.5);
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
  if (decoy) {
    const range = enemy.config.sight.rangeCore;
    const dx = decoy.x - enemy.ai.position.x;
    const dy = decoy.y - enemy.ai.position.y;
    const insideCone = Math.abs(shortestArc(Math.atan2(dy, dx) - enemy.ai.facingAngle)) <= enemy.config.sight.halfAngleCore;
    if (dx * dx + dy * dy <= range * range && insideCone && hasLineOfSight(ctx.occluders, enemy.ai.position, decoy)) {
      enemy.ai.targetingDecoy = true;
      return decoy;
    }
  }
  enemy.ai.targetingDecoy = false;
  return ctx.playerPos;
}

function setInvestigatePos(enemy: Enemy, x: number, y: number, jitter: number): void {
  const ai = enemy.ai;
  let targetX = x;
  let targetY = y;
  if (jitter > 0) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * jitter;
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

  const rateHear = p.hearingRate;
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
