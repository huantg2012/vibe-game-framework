/**
 * Enemy AI contracts (docs/specs/system-enemy-ai.md, "Schema").
 *
 * These live in `types/` rather than inside `systems/ai/` because the enemy entity
 * implements `EnemyView` while the AI system owns the mutable state - putting the
 * contract in one of them would make the two import each other.
 *
 * Ownership boundary worth keeping in mind while reading: this file describes position,
 * facing, perception and the state machine. Health, hits, attacks and death belong to
 * `system-combat`, which never writes AI state - it pushes stimuli through
 * `reportDamage()` instead.
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import type { EnemyRole, PerceptionProfile } from '@/generated/enemy-data';
import type { AIState, Facing4, Vector2 } from '@/types/game-types';
import type { PatrolMode } from '@/types/map-types';

export type { EnemyRole, HearingMaxPush, PerceptionProfile } from '@/generated/enemy-data';

/** Escalation ladder used by the `ENEMY_ALERT` contract. `none` = patrolling or returning. */
export type AlertLevel = 'none' | 'suspicious' | 'alert' | 'chase';

/** Which part of the sight model a target falls in this tick (rule P4). */
export type SightZone = 'core' | 'peripheral' | 'blind';

/** Audio cue ids handed to the scene layer on state changes (rule R7). */
export type AICueId = 'ai.cue.suspicious' | 'ai.cue.alert' | 'ai.cue.chase' | 'ai.cue.lost';

/** Read-only view of one enemy, for the renderer, chaos (T3), combat (T4) and the rim pulse. */
export interface EnemyView {
  getId(): string;
  getRole(): EnemyRole;
  getPosition(): Readonly<Vector2>;
  getFacingAngle(): number;
  getFacing4(): Facing4;
  getState(): AIState;
  /** Chasing and already standing at attack distance. Combat uses it to decide to swing. */
  isEngaged(): boolean;
  isAttackAvailable?(): boolean;
  setAttackCommitted?(committed: boolean): void;
  /** 0..1. Play input for the rim pulse; debug overlay may also read it. */
  getDetection(): number;
  /** Contamination lexicon form (DEC-076). T2: infiltrator/rewriter fixtures. */
  getForm(): ContaminationForm;
  /**
   * mirror (Slice 5 T4 gap-fill): true on exactly the frames this enemy's most recent
   * sighting was redirected to the decoy instead of the real player position (see
   * `state-machine.ts`'s `sightTargetPos()`). The read-side counterpart to `AISystem.
   * setDecoyPosition()` - lets `ToolSystem`/`tool-vfx.ts` draw the "被诱饵吸引" bracket
   * marker on the right enemy without AISystem needing to know anything about VFX.
   */
  isTargetingDecoy(): boolean;
}

/**
 * Runtime type config = CSV perception profile + shared body/turn constants.
 * Speeds and cone numbers are copied from the profile so the FSM never reads
 * a second copy of infiltrator tuning from GAME_CONSTANTS.AI.
 */
export interface EnemyTypeConfig {
  readonly role: EnemyRole;
  readonly profile: PerceptionProfile;
  readonly bodySize: number;
  readonly speeds: Readonly<Record<AIState, number>>;
  readonly sight: {
    readonly rangeCore: number;
    readonly halfAngleCore: number;
    readonly rangePeripheral: number;
    readonly halfAnglePeripheral: number;
    readonly chaseRange: number;
  };
  readonly hearing: {
    readonly range: number;
    readonly wallFactor: number;
    readonly posJitter: number;
  };
}

/** @deprecated Use EnemyTypeConfig. Kept as an alias so older comments still resolve. */
export type InfiltratorConfig = EnemyTypeConfig;

/** What one perception tick concluded. Recomputed in place every tick; never stored. */
export interface Perception {
  /** Distance to the player (px). */
  distance: number;
  /** Whether a ray was cast at all this tick (rule P2: at most one, often none). */
  rayCast: boolean;
  hasLineOfSight: boolean;
  zone: SightZone;
  /** Sight that counts: unobstructed and not blind. In CHASE this is the 360 degree rule. */
  visible: boolean;
  /** Infiltrator binary nominate (hearingWeight === 0). Rewriter fill uses hearingRate. */
  hearingHit: boolean;
  /** Continuous hearing fill this tick (rewriter). 0 when the channel is silent. */
  hearingRate: number;
  /** Effective hearing radius used for distFactorHear this tick. */
  hearingRadius: number;
  /** True when this tick's hearing channel is the still-standing one (cap applies). */
  hearingStill: boolean;
}

/**
 * Mutable runtime state of one enemy. Written by the AI system, its FSM and its
 * behaviours, and by nothing else.
 */
export interface EnemyAIState {
  state: AIState;
  /** World position, mirrored from the physics body each frame. */
  readonly position: Vector2;
  readonly velocity: Vector2;
  /** Continuous heading (radians). The perception cone uses this. */
  facingAngle: number;
  /** Quantised heading for sprite frames; same rule as the player's. */
  facing4: Facing4;

  // --- perception ---
  detection: number;
  lastSeenPlayerPos: Vector2 | null;
  lastSeenPlayerVel: Vector2 | null;
  losGraceMs: number;
  /** Frozen at spawn from the CSV row. Never changes at runtime. */
  role: EnemyRole;
  /** Accumulates real time between perception ticks (rule P1's staggered phase). */
  perceptionAccumMs: number;
  /**
   * Hearing investigate-point jitter is sampled once per alert episode (rule P5b / T0-4b).
   * Cleared when the episode closes.
   */
  hearingJitterLocked: boolean;

  // --- timers (ms; each only advances in the state that owns it) ---
  suspicionTimerMs: number;
  searchTimerMs: number;
  waypointPauseMs: number;
  /** Standstill remaining while turning to look at a suspicion (rule B2 step 1). */
  suspiciousTurnHoldMs: number;
  /** Dwell remaining at the current ALERT search point. */
  searchHoldMs: number;
  /** Drives both the patrol scan-angle sequence and in-place left/right sweeps. */
  scanPhaseMs: number;
  scanIndex: number;
  /** Heading an in-place sweep is centred on, captured when the sweep starts. */
  scanBaseAngle: number;

  // --- goals ---
  investigatePos: Vector2 | null;
  /** Pre-allocated, at most 3 used (rule B3). */
  readonly searchPoints: Vector2[];
  searchPointCount: number;
  searchIndex: number;
  patrolIndex: number;
  patrolDir: 1 | -1;
  /**
   * The route mode actually in force. Starts as the authored mode and degrades to
   * `static` if a leg turns out to be impossible, so bad map data produces a stationary
   * guard with a warning rather than an enemy walking into a wall all run.
   */
  patrolMode: PatrolMode;

  // --- paths ---
  /**
   * Points of the path being followed. Either a reference to a precomputed patrol path
   * or this enemy's own `dynamicPath` buffer - never a freshly built array.
   */
  pathPoints: Vector2[] | null;
  pathLength: number;
  pathCursor: number;
  /** Buffer A* results are written into. Capacity `AI.MAX_PATH_POINTS`. */
  readonly dynamicPath: Vector2[];
  /** World positions of this enemy's patrol waypoints. Constant after create. */
  patrolWaypoints: Vector2[];
  /**
   * Patrol legs, precomputed once at scene create because a fixed map plus fixed
   * waypoints means these paths can never change (rule B1). Indexed by
   * `patrolLegIndex(fromWaypoint, direction)`. This is what keeps A* out of patrolling
   * entirely, which is most of the pathfinding budget.
   */
  patrolPaths: (Vector2[] | null)[];
  /** The leg currently being walked, kept so an interrupted patrol can rejoin it. */
  currentPatrolLeg: Vector2[] | null;
  repathCooldownMs: number;
  pathRequestPending: boolean;
  /** Where the pending request wants to go, and where the last one went. */
  readonly pathRequestTarget: Vector2;
  readonly pathTargetAtRequest: Vector2;
  pathRequestAgeMs: number;
  pathFailCount: number;
  /** Set while the straight-line shortcut (rule N4) has proven to not fit the body. */
  preferPathMs: number;
  stuckMs: number;

  // --- derived, read by other systems ---
  engaged: boolean;
  alertEmitCooldownMs: number;
  lastEmittedLevel: AlertLevel;
  /** True between the first escalation and the matching `ENEMY_LOST_PLAYER`. */
  alertEpisodeActive: boolean;

  // --- pending external stimuli, consumed by the next tick in priority order ---
  pendingDamage: boolean;
  readonly pendingDamagePos: Vector2;
  pendingNoiseLevel: 'suspicious' | 'alert' | null;
  readonly pendingNoisePos: Vector2;

  // --- Slice 5 tool overrides (T1), set/cleared by ToolSystem via AISystem's setters.
  // All default to "no effect" so an enemy nobody has ever used a tool on behaves exactly
  // as before; nothing in the FSM or behaviours reads these except the two application
  // points named alongside each field. ---
  /** Multiplies final movement speed (compress / echo / resonate's post-knockback stun). */
  externalSpeedMult: number;
  /** While true, `applyVelocity` (behaviors.ts) keeps moving along `lockedDir` instead of
   * whatever the state wanted this frame (compress: "无法改变移动方向"). */
  movementDirLocked: boolean;
  /** Captured once when the lock engages; stays put while `movementDirLocked` is true. */
  readonly lockedDir: Vector2;
  /** Multiplies sight/hearing range in `AISystem.perceive()` (overwrite / combust: "感知范围-50%"). */
  perceptionRangeMult: number;

  /** mirror (Slice 5 T4 gap-fill): set/cleared by `sightTargetPos()` every time it runs,
   * so it always reflects "was the last sighting redirected", never a stale sticky flag. */
  targetingDecoy: boolean;

  // --- Slice 4 tool overrides (T7 rewire), same "default = no effect" contract as above. ---
  /** delay: "感知状态被冻结". Blocks exactly SUSPICIOUS→ALERT and ALERT→CHASE in
   * `state-machine.ts`'s `stepFsm` - the two transitions the CSV names. Escalations that
   * are not a perception judgement call (being hit) are untouched. */
  escalationSuppressed: boolean;
  /** scatter: "感知填充速度降低30%". Multiplies the detection fill rate in
   * `updateDetection` (state-machine.ts). Set when this enemy enters SUSPICIOUS while
   * scatter has a charge, cleared when its alert episode closes (`ENEMY_LOST_PLAYER`). */
  detectionFillRateMult: number;
}
