/**
 * Shared per-frame context handed to the FSM and the behaviours.
 *
 * Everything the AI needs from the outside world arrives here, which is what keeps the
 * state machine and the behaviours free of Phaser and of any other system: they read
 * grids and the player's pose, and report outwards through callbacks the AI system
 * implements (docs/specs/system-enemy-ai.md, "为什么用这种耦合方式").
 */

import type { AIState, Vector2 } from '@/types/game-types';
import type { OccluderGrid } from '@/types/map-types';
import type { AICueId, AlertLevel } from '@/types/ai-types';
import type { Enemy } from '@/entities/enemy-factory';
import type { GridPathfinder } from '@/systems/pathfinding';

/**
 * Path request priority (rule N3). A chase must never queue behind an enemy strolling
 * home, and requests that are too far away to matter drop below everything.
 */
export const PathPriority = {
  FAR: 0,
  RETURN: 1,
  SUSPICIOUS: 2,
  ALERT: 3,
  CHASE: 4,
} as const;

export type PathPriorityValue = (typeof PathPriority)[keyof typeof PathPriority];

export interface AIContext {
  /** Line of sight. The only occlusion authority in the project (rule P3). */
  readonly occluders: OccluderGrid;
  readonly pathfinder: GridPathfinder;
  readonly enemies: readonly Enemy[];

  readonly playerPos: Readonly<Vector2>;
  /** Estimated from position deltas; used only to extrapolate a search point (rule B3). */
  readonly playerVel: Readonly<Vector2>;
  playerIsMoving: boolean;

  /** Frame delta in ms, already clamped by `AI.DT_CLAMP_MS`. */
  dtMs: number;

  /**
   * Slice 5 mirror tool (T1): while set, a sighting that would otherwise target the
   * player (visually, not by hearing or by being hit) targets this position instead, if
   * it is within the seeing enemy's core sight range - "视野内敌人优先对镜像产生怀疑,
   * 忽略真身方向" (`data/contaminants.csv`, mirror). Set/cleared by `AISystem.
   * setDecoyPosition()`, which `ToolSystem` calls; null when no decoy is active.
   */
  decoyPos: Vector2 | null;

  /**
   * Slice 4 muffle passive (T7 rewire): while true, a hearing-only signal that would
   * otherwise pull a calm (PATROL/RETURN) enemy into SUSPICIOUS is swallowed instead -
   * "360度近距检测对玩家无效仅保留视线锥检测" (`data/contaminants.csv`, muffle). Set by
   * `AISystem.setHearingSuppressed()`, which `ToolSystem` calls every frame from whether
   * muffle is equipped and still has charges.
   */
  hearingSuppressed: boolean;
  /**
   * Fires exactly when `hearingSuppressed` swallowed a would-be discovery (rule above),
   * so `ToolSystem.notifyProximityAvoid()` can spend one of muffle's charges. Never fires
   * for a sighting or a noise - only for the hearing-alone case muffle actually covers.
   */
  onHearingAvoided(enemy: Enemy): void;

  /**
   * muffle's *defense-slot* side effect (Slice 5 gap-fill, DEC-039), not to be confused
   * with `hearingSuppressed` above (muffle as an equipped *tool*, the opposite direction).
   * "下次出击敌人近距感知范围+15%" (`data/contaminants.csv`, muffle) - a flat global
   * multiplier on every enemy's `hearing.range`, applied for the whole sortie. 1 = no
   * effect. Set once at sortie start by `AISystem.setHearingRangeMultiplier()`, which
   * `RiftScene` calls from the consumed `proximity_sense_boost` pending side effect.
   */
  hearingRangeMult: number;

  /**
   * Requests a state change from a behaviour. Used for completions the perception tick
   * has no opinion about - reaching the waypoint you were walking home to, for instance,
   * which has to be noticed on the frame it happens rather than up to a tick later.
   */
  requestState(enemy: Enemy, next: AIState): void;

  /** Emits `ENEMY_ALERT` subject to the escalation and cooldown rules (contract E1). */
  emitAlert(enemy: Enemy, level: Exclude<AlertLevel, 'none'>): void;
  /** Emits `ENEMY_LOST_PLAYER` once per alert episode (contract E2). */
  emitLost(enemy: Enemy): void;
  /** Audio cue on a state change (rule R7). The AI never decides what it sounds like. */
  cue(enemy: Enemy, id: AICueId): void;
  /** Dev-only diagnostics, typically a map data problem surfacing at runtime. */
  warn(message: string): void;
}
