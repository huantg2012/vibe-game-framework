/**
 * AISystem - owns the rift's enemies: their perception, their state machine, their
 * movement and their pathfinding budget (docs/specs/system-enemy-ai.md).
 *
 * Three structural commitments worth knowing before changing anything here:
 *
 * 1. Line of sight always goes through `utils/grid-raycast.hasLineOfSight()`. The AI has
 *    no occlusion code of its own and must never grow any (rule P3). The player reasons
 *    about stealth by inferring "it cannot see me" from "I cannot see it"; a second
 *    implementation would turn that inference into a lie.
 * 2. One raycast per enemy per perception tick, 10 Hz, phases staggered (rules P1/P2).
 *    A single ray answers both "can it see the player" and "is a wall muffling them".
 * 3. At most one A* per frame, globally, highest-priority requester first (rule N3), and
 *    an enemy waiting for a path keeps moving rather than standing still.
 *
 * What this system does not own: enemy health, hits, attacks and death, which belong to
 * `system-combat` and reach the AI only as `reportDamage()` / `reportNoise()` /
 * `despawn()` calls made by the scene layer. The AI imports no other system.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { AIState, type Vector2 } from '@/types/game-types';
import { GameEvent } from '@/types/events';
import type { EnemySpawnData, OccluderGrid, WalkGrid } from '@/types/map-types';
import type { AICueId, AlertLevel, EnemyView, InfiltratorConfig, Perception } from '@/types/ai-types';
import { createInfiltrator, createInfiltratorConfig, type Enemy } from '@/entities/enemy-factory';
import { GridPathfinder } from '@/systems/pathfinding';
import { PathPriority, type AIContext, type PathPriorityValue } from '@/systems/ai/context';
import {
  assignDynamicPath,
  clearPath,
  patrolLegIndex,
  resolveNextWaypoint,
  setPatrolLeg,
  updateBehavior,
} from '@/systems/ai/behaviors';
import { closeAlertEpisode, stepFsm, transitionTo } from '@/systems/ai/state-machine';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { shortestArc } from '@/utils/math';

/** How the player's field of view rates a world position: 0 means "not drawn" (rule R4). */
export type VisibilityProvider = (point: Readonly<Vector2>) => number;

/** Audio hook (rule R7). The AI names the moment; the scene decides what it sounds like. */
export type CueListener = (enemyId: string, cue: AICueId) => void;

/**
 * Enemy render depth: just under the player, so the player sprite wins any overlap.
 * Exported so the scene's depth map can name it rather than repeat the number.
 */
export const ENEMY_DEPTH = 25;

export interface AIStats {
  readonly enemyCount: number;
  readonly pendingPathRequests: number;
  readonly pathCalls: number;
  readonly pathFailures: number;
  readonly lastPathMs: number;
  readonly avgPathMs: number;
  readonly lastPathNodes: number;
  readonly pathsThisFrame: number;
  readonly raysThisFrame: number;
  /**
   * How many times the stuck watchdog had to intervene. Should stay at 0: anything else
   * means an enemy was grinding against geometry, which the spec calls out as a failure
   * signal rather than a difficulty setting.
   */
  readonly unstickEvents: number;
  readonly lastMs: number;
  readonly avgMs: number;
  readonly lastCue: string;
}

/** The contract combat (T4) and the scene layer are written against. */
export interface AISystemAPI {
  create(
    scene: Phaser.Scene,
    spawns: readonly EnemySpawnData[],
    occluders: OccluderGrid,
    walk: WalkGrid
  ): void;
  update(deltaMs: number, playerPos: Readonly<Vector2>, playerIsMoving: boolean): void;
  getEnemies(): readonly EnemyView[];
  getEnemyById(id: string): EnemyView | undefined;
  reportNoise(pos: Readonly<Vector2>, radius: number, level: 'suspicious' | 'alert'): void;
  reportDamage(enemyId: string, sourcePos: Readonly<Vector2>): void;
  despawn(enemyId: string): void;
  onPlayerLost(): void;
  destroy(): void;
}

export class AISystem implements AISystemAPI {
  private scene!: Phaser.Scene;
  private occluders!: OccluderGrid;
  private walk!: WalkGrid;
  private pathfinder!: GridPathfinder;
  private enemyConfig: InfiltratorConfig = createInfiltratorConfig();

  private readonly enemies: Enemy[] = [];
  /** Live array handed to the scene's wall collider; despawn splices it. */
  private readonly sprites: Phaser.Physics.Arcade.Image[] = [];

  private visibilityProvider: VisibilityProvider | null = null;
  private cueListener: CueListener | null = null;

  // --- per-frame inputs, copied so nothing outside can mutate them mid-update ---
  private readonly playerPos: Vector2 = { x: 0, y: 0 };
  private readonly previousPlayerPos: Vector2 = { x: 0, y: 0 };
  private readonly playerVel: Vector2 = { x: 0, y: 0 };
  private playerIsMoving = false;
  private hasPreviousPlayerPos = false;

  /** Reused perception result; recomputed per enemy per tick, never retained. */
  private readonly perception: Perception = {
    distance: 0,
    rayCast: false,
    hasLineOfSight: false,
    zone: 'blind',
    visible: false,
    hearingHit: false,
  };

  private readonly scratch: Vector2 = { x: 0, y: 0 };

  private context!: AIContext;

  // --- instrumentation (dev overlay / QA) ---
  private pathCalls = 0;
  private pathFailures = 0;
  private pathsThisFrame = 0;
  private raysThisFrame = 0;
  private lastMs = 0;
  private totalMs = 0;
  private frames = 0;
  private lastPathNodes = 0;
  private unstickEvents = 0;
  private lastCue = '-';

  // ------------------------------------------------------------------ lifecycle

  create(
    scene: Phaser.Scene,
    spawns: readonly EnemySpawnData[],
    occluders: OccluderGrid,
    walk: WalkGrid
  ): void {
    this.scene = scene;
    this.occluders = occluders;
    this.walk = walk;
    this.hasPreviousPlayerPos = false;
    this.playerIsMoving = false;
    // Smoothing has to keep a body's width of room, not just a sight line: a shortcut
    // that only a point could take leaves the enemy grinding against a corner.
    this.pathfinder = new GridPathfinder(walk, occluders, GAME_CONSTANTS.AI.BODY_SIZE);
    this.enemyConfig = createInfiltratorConfig();
    this.context = this.createContext();

    if (import.meta.env.DEV && spawns.length > GAME_CONSTANTS.AI.MAX_ACTIVE_ENEMIES) {
      console.warn(
        `[AISystem] ${spawns.length} spawns exceeds MAX_ACTIVE_ENEMIES ` +
          `(${GAME_CONSTANTS.AI.MAX_ACTIVE_ENEMIES}); the map data is probably wrong`
      );
    }

    for (let i = 0; i < spawns.length; i++) {
      const enemy = this.spawnEnemy(spawns[i]!, i, spawns.length);
      this.enemies.push(enemy);
      this.sprites.push(enemy.getSprite());
    }
  }

  /**
   * Supplies the field-of-view lookup used to decide whether an enemy is drawn at all
   * (rule R4). Injected rather than imported: the AI does not depend on the visibility
   * system, it just needs one number from whoever owns the darkness.
   */
  setVisibilityProvider(provider: VisibilityProvider | null): void {
    this.visibilityProvider = provider;
  }

  setCueListener(listener: CueListener | null): void {
    this.cueListener = listener;
  }

  /**
   * Makes the enemies collide with the wall layer - the only physics collision they take
   * part in (rule B6). They do not push the player (that would wedge them into corners
   * and fight combat's own contact test) and they do not collide with each other (two
   * bodies jam a corridor); separation steers them apart instead.
   *
   * The live sprite array stays private so `despawn()` can keep it in step with the
   * collider without anything outside holding a stale reference.
   */
  addWallCollider(layer: Phaser.Tilemaps.TilemapLayer): Phaser.Physics.Arcade.Collider {
    return this.scene.physics.add.collider(this.sprites, layer);
  }

  /** Enemy bodies, for combat's hit tests. Never mutate the returned array. */
  getSprites(): readonly Phaser.Physics.Arcade.Image[] {
    return this.sprites;
  }

  destroy(): void {
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies.length = 0;
    this.sprites.length = 0;
    this.visibilityProvider = null;
    this.cueListener = null;
  }

  // ------------------------------------------------------------------ update

  update(deltaMs: number, playerPos: Readonly<Vector2>, playerIsMoving: boolean): void {
    if (this.enemies.length === 0) return;

    const startedAt = performance.now();
    const config = GAME_CONSTANTS.AI;
    // Coming back from a background tab hands us a huge delta; without clamping, enemies
    // would teleport through walls on the first frame back.
    const dtMs = Math.min(deltaMs, config.DT_CLAMP_MS);

    this.updatePlayerMotion(playerPos, playerIsMoving, dtMs);
    this.context.dtMs = dtMs;
    this.context.playerIsMoving = playerIsMoving;

    this.pathsThisFrame = 0;
    this.raysThisFrame = 0;

    for (const enemy of this.enemies) {
      this.advanceTimers(enemy, dtMs);
      this.runPerceptionTick(enemy, dtMs);
      updateBehavior(enemy, this.context);
    }

    for (let i = 0; i < config.MAX_PATHS_PER_FRAME; i++) {
      if (!this.servicePathRequest()) break;
    }

    this.lastMs = performance.now() - startedAt;
    this.totalMs += this.lastMs;
    this.frames++;
  }

  /**
   * Syncs sprites and indicators, and measures what the physics step actually achieved.
   *
   * This has to run here rather than in `update()`: Arcade integrates bodies on the
   * scene's UPDATE event but only writes the result back onto the sprites on POST_UPDATE,
   * so during `update()` a sprite still reports last frame's position and any movement
   * measured there would always be zero.
   */
  postUpdate(deltaMs: number): void {
    const dtMs = Math.min(deltaMs, GAME_CONSTANTS.AI.DT_CLAMP_MS);
    for (const enemy of this.enemies) {
      this.updateStuckWatchdog(enemy, dtMs);
      enemy.syncPositionFromBody();
      const visibility = this.visibilityProvider
        ? this.visibilityProvider(enemy.ai.position)
        : 1;
      enemy.syncVisuals(dtMs, visibility);
    }
  }

  // ------------------------------------------------------------------ queries

  getEnemies(): readonly EnemyView[] {
    return this.enemies;
  }

  getEnemyById(id: string): EnemyView | undefined {
    return this.findEnemy(id);
  }

  getStats(): AIStats {
    const pathStats = this.pathfinder?.getStats();
    let pending = 0;
    for (const enemy of this.enemies) {
      if (enemy.ai.pathRequestPending) pending++;
    }

    return {
      enemyCount: this.enemies.length,
      pendingPathRequests: pending,
      pathCalls: this.pathCalls,
      pathFailures: this.pathFailures,
      lastPathMs: pathStats?.lastMs ?? 0,
      avgPathMs: pathStats?.avgMs ?? 0,
      lastPathNodes: this.lastPathNodes,
      pathsThisFrame: this.pathsThisFrame,
      raysThisFrame: this.raysThisFrame,
      unstickEvents: this.unstickEvents,
      lastMs: this.lastMs,
      avgMs: this.frames > 0 ? this.totalMs / this.frames : 0,
      lastCue: this.lastCue,
    };
  }

  // ------------------------------------------------------------------ external stimuli

  /**
   * A noise everyone within `radius` reacts to (rule P8). Noise does not check walls -
   * a fight is loud in every direction - and it is the only way an enemy reaches ALERT
   * without ever having seen anything.
   */
  reportNoise(pos: Readonly<Vector2>, radius: number, level: 'suspicious' | 'alert'): void {
    for (const enemy of this.enemies) {
      const ai = enemy.ai;
      const distance = Math.hypot(pos.x - ai.position.x, pos.y - ai.position.y);
      if (distance > radius) continue;

      // Never downgrade a pending stimulus: an alert-grade noise outranks a suspicious one.
      if (level === 'alert' || ai.pendingNoiseLevel === null) ai.pendingNoiseLevel = level;
      ai.pendingNoisePos.x = pos.x;
      ai.pendingNoisePos.y = pos.y;
      this.forceNextTick(enemy);
    }
  }

  /** Being hit is proof enough: this enemy chases immediately, no confidence needed. */
  reportDamage(enemyId: string, sourcePos: Readonly<Vector2>): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    enemy.ai.pendingDamage = true;
    enemy.ai.pendingDamagePos.x = sourcePos.x;
    enemy.ai.pendingDamagePos.y = sourcePos.y;
    this.forceNextTick(enemy);
  }

  /**
   * Removes a dead enemy (combat decides death, the scene layer forwards it here).
   * An enemy that dies mid-hunt still owes its `ENEMY_LOST_PLAYER`, or consumers stay
   * stuck believing something is chasing the player forever (contract E2).
   */
  despawn(enemyId: string): void {
    const index = this.enemies.findIndex((enemy) => enemy.id === enemyId);
    if (index < 0) return;

    const enemy = this.enemies[index]!;
    closeAlertEpisode(enemy, this.context);
    enemy.ai.pathRequestPending = false;
    clearPath(enemy);

    const spriteIndex = this.sprites.indexOf(enemy.getSprite());
    if (spriteIndex >= 0) this.sprites.splice(spriteIndex, 1);
    this.enemies.splice(index, 1);
    enemy.destroy();
  }

  /** The player is gone (dead, or extracted): everybody stands down and walks home. */
  onPlayerLost(): void {
    for (const enemy of this.enemies) {
      const ai = enemy.ai;
      ai.pendingDamage = false;
      ai.pendingNoiseLevel = null;
      ai.detection = 0;
      ai.engaged = false;

      if (ai.state === AIState.PATROL) continue;
      if (ai.state === AIState.RETURN) {
        closeAlertEpisode(enemy, this.context);
        continue;
      }
      transitionTo(enemy, AIState.RETURN, this.context);
    }
  }

  // ------------------------------------------------------------------ perception

  /**
   * Advances this enemy's perception clock and, when a tick is due, does the whole
   * perception-and-transition pass. Ticks carry the real elapsed time, so a slower
   * cadence (rule N8, far from the player) changes cost but never behaviour.
   */
  private runPerceptionTick(enemy: Enemy, dtMs: number): void {
    const ai = enemy.ai;
    const config = GAME_CONSTANTS.AI;
    const distanceToPlayer = Math.hypot(
      this.playerPos.x - ai.position.x,
      this.playerPos.y - ai.position.y
    );
    const interval =
      distanceToPlayer > config.ACTIVE_RANGE
        ? config.PERCEPTION_TICK_MS_FAR
        : config.PERCEPTION_TICK_MS;

    ai.perceptionAccumMs += dtMs;
    if (ai.perceptionAccumMs < interval) return;

    const elapsed = ai.perceptionAccumMs;
    ai.perceptionAccumMs = 0;

    this.perceive(enemy, distanceToPlayer);
    stepFsm(enemy, this.perception, elapsed, this.context);
  }

  /**
   * Fills `this.perception` for one enemy. Exactly one raycast, and only when the player
   * is close enough for either sense to possibly reach (rule P2).
   *
   * The enemy's senses are deliberately not limited by the player's field of view: it can
   * notice a player who cannot see it. That asymmetry is the source of tension, and it is
   * paid for by invariants I1 and I3 - the player sees further and runs faster.
   */
  private perceive(enemy: Enemy, distance: number): void {
    const ai = enemy.ai;
    const config = GAME_CONSTANTS.AI;
    const sight = enemy.config.sight;
    const hearing = enemy.config.hearing;
    const out = this.perception;

    out.distance = distance;

    const chasing = ai.state === AIState.CHASE;
    const sightRange = chasing ? sight.chaseRange : sight.rangeCore;
    const rayRange = Math.max(sightRange, hearing.range);

    out.rayCast = distance <= rayRange;
    out.hasLineOfSight = out.rayCast
      ? hasLineOfSight(this.occluders, ai.position, this.playerPos, rayRange)
      : false;
    if (out.rayCast) this.raysThisFrame++;

    if (distance <= config.ARRIVE_EPSILON) {
      // Standing on top of each other: the angle is meaningless, call it a core hit.
      out.zone = 'core';
    } else {
      const bearing = Math.atan2(
        this.playerPos.y - ai.position.y,
        this.playerPos.x - ai.position.x
      );
      const offset = Math.abs(shortestArc(bearing - ai.facingAngle));
      if (offset <= sight.halfAngleCore && distance <= sight.rangeCore) out.zone = 'core';
      else if (offset <= sight.halfAnglePeripheral && distance <= sight.rangePeripheral) {
        out.zone = 'peripheral';
      } else out.zone = 'blind';
    }

    // Once locked on it is looking straight at the player: the cone stops applying, or a
    // chase would keep "going blind" every time it turned a corner (rule T-C1).
    out.visible = chasing
      ? out.hasLineOfSight && distance <= sight.chaseRange
      : out.hasLineOfSight && out.zone !== 'blind';

    // Hearing carries through walls at a reduced radius - that is the whole reason it
    // exists rather than being a shorter second pair of eyes. Standing still defeats it.
    const hearingRadius = hearing.range * (out.hasLineOfSight ? 1 : hearing.wallFactor);
    out.hearingHit = this.playerIsMoving && out.rayCast && distance <= hearingRadius;
  }

  /** Makes the next frame a perception tick for this enemy, for "immediate" stimuli. */
  private forceNextTick(enemy: Enemy): void {
    enemy.ai.perceptionAccumMs = GAME_CONSTANTS.AI.PERCEPTION_TICK_MS_FAR;
  }

  // ------------------------------------------------------------------ pathfinding budget

  /**
   * Runs at most one A* for the highest-priority waiting enemy (rule N3). Returns false
   * when nobody is waiting.
   *
   * Note on rule N8 ("enemies beyond ACTIVE_RANGE never ask for a path"): patrolling
   * enemies never ask in the first place, since their legs are precomputed, so the rule
   * is satisfied without a distance gate here. A distant enemy walking home *does* need
   * one - refusing it would leave it pressed against a wall forever - so it is served at
   * the lowest priority instead, where it can never delay a chase.
   */
  private servicePathRequest(): boolean {
    let chosen: Enemy | null = null;
    let chosenPriority: PathPriorityValue | -1 = -1;
    let chosenAge = -1;

    for (const enemy of this.enemies) {
      const ai = enemy.ai;
      if (!ai.pathRequestPending || ai.repathCooldownMs > 0) continue;

      const priority = this.priorityOf(enemy);
      if (priority > chosenPriority || (priority === chosenPriority && ai.pathRequestAgeMs > chosenAge)) {
        chosen = enemy;
        chosenPriority = priority;
        chosenAge = ai.pathRequestAgeMs;
      }
    }

    if (!chosen) return false;
    this.runSearch(chosen);
    return true;
  }

  private priorityOf(enemy: Enemy): PathPriorityValue {
    const ai = enemy.ai;
    const targetDistance = Math.hypot(
      ai.pathRequestTarget.x - ai.position.x,
      ai.pathRequestTarget.y - ai.position.y
    );
    if (targetDistance > GAME_CONSTANTS.AI.SIMPLE_PATH_RANGE) return PathPriority.FAR;

    switch (ai.state) {
      case AIState.CHASE:
        return PathPriority.CHASE;
      case AIState.ALERT:
        return PathPriority.ALERT;
      case AIState.SUSPICIOUS:
        return PathPriority.SUSPICIOUS;
      default:
        return PathPriority.RETURN;
    }
  }

  private runSearch(enemy: Enemy): void {
    const ai = enemy.ai;
    const config = GAME_CONSTANTS.AI;

    ai.pathRequestPending = false;
    ai.pathRequestAgeMs = 0;

    const far =
      Math.hypot(
        ai.pathRequestTarget.x - ai.position.x,
        ai.pathRequestTarget.y - ai.position.y
      ) > config.SIMPLE_PATH_RANGE;
    ai.repathCooldownMs = far ? config.REPATH_INTERVAL_MS_FAR : config.REPATH_INTERVAL_MS;

    const written = this.pathfinder.findPath(
      ai.position,
      ai.pathRequestTarget,
      ai.dynamicPath,
      config.ASTAR_MAX_NODES
    );

    this.pathCalls++;
    this.pathsThisFrame++;
    this.lastPathNodes = this.pathfinder.getStats().nodesExpanded;

    if (written > 0) {
      assignDynamicPath(enemy, written);
      ai.pathTargetAtRequest.x = ai.pathRequestTarget.x;
      ai.pathTargetAtRequest.y = ai.pathRequestTarget.y;
      ai.pathFailCount = 0;
      return;
    }

    this.pathFailures++;
    ai.pathFailCount++;
    this.handlePathFailure(enemy);
  }

  /**
   * Failure means the goal is unreachable - usually the player standing somewhere the
   * enemy cannot follow. Whatever happens next, it must not be "vibrate against the wall
   * indefinitely" (rule N6).
   */
  private handlePathFailure(enemy: Enemy): void {
    const ai = enemy.ai;
    clearPath(enemy);

    if (import.meta.env.DEV && ai.pathFailCount === 1) {
      console.warn(
        `[AISystem] ${enemy.id} (${ai.state}) found no path to ` +
          `${Math.round(ai.pathRequestTarget.x)},${Math.round(ai.pathRequestTarget.y)}`
      );
    }

    switch (ai.state) {
      case AIState.CHASE:
        // Give up on the direct pursuit and search instead; the normal ladder takes over.
        transitionTo(enemy, AIState.ALERT, this.context);
        break;
      case AIState.ALERT:
        ai.searchIndex++;
        ai.searchHoldMs = 0;
        ai.scanPhaseMs = 0;
        break;
      case AIState.SUSPICIOUS:
        // Cannot get to the noise: stay where it is and look around instead.
        ai.investigatePos = null;
        break;
      default:
        // RETURN gives up after PATH_FAIL_LIMIT tries, which its behaviour checks.
        break;
    }
  }

  // ------------------------------------------------------------------ internals

  private createContext(): AIContext {
    return {
      occluders: this.occluders,
      pathfinder: this.pathfinder,
      enemies: this.enemies,
      playerPos: this.playerPos,
      playerVel: this.playerVel,
      playerIsMoving: false,
      dtMs: 0,
      requestState: (enemy, next) => transitionTo(enemy, next, this.context),
      emitAlert: (enemy, level) => this.emitAlert(enemy, level),
      emitLost: (enemy) => this.emitLost(enemy),
      cue: (enemy, id) => this.emitCue(enemy, id),
      warn: (message) => {
        if (import.meta.env.DEV) console.warn(`[AISystem] ${message}`);
      },
    };
  }

  private spawnEnemy(spawn: EnemySpawnData, index: number, total: number): Enemy {
    const tileSize = this.walk.tileSize;
    this.scratch.x = (spawn.spawn.col + 0.5) * tileSize;
    this.scratch.y = (spawn.spawn.row + 0.5) * tileSize;

    if (!this.walk.isWalkable(spawn.spawn.col, spawn.spawn.row)) {
      const recovered = this.pathfinder.findNearestWalkable(
        this.scratch.x,
        this.scratch.y,
        this.scratch
      );
      this.context.warn(
        `${spawn.id} spawns inside a wall at (${spawn.spawn.col},${spawn.spawn.row})` +
          (recovered ? '; moved to the nearest walkable tile' : '; no walkable tile nearby')
      );
    }

    const enemy = createInfiltrator(this.scene, spawn, this.enemyConfig, this.scratch, {
      depth: ENEMY_DEPTH,
    });

    // Stagger the perception phase so several enemies never raycast on the same frame.
    enemy.ai.perceptionAccumMs = total > 0 ? (index * GAME_CONSTANTS.AI.PERCEPTION_TICK_MS) / total : 0;
    enemy.ai.patrolMode = spawn.patrol.mode;

    for (const waypoint of spawn.patrol.waypoints) {
      enemy.ai.patrolWaypoints.push({
        x: (waypoint.col + 0.5) * tileSize,
        y: (waypoint.row + 0.5) * tileSize,
      });
    }

    this.precomputePatrolPaths(enemy);
    this.startPatrolLeg(enemy);
    return enemy;
  }

  /**
   * Precomputes every patrol leg at create time (rule B1). A fixed map with fixed
   * waypoints means these paths can never change, so patrolling - which is what enemies
   * spend almost all of their time doing - costs no pathfinding at all.
   */
  private precomputePatrolPaths(enemy: Enemy): void {
    const ai = enemy.ai;
    const waypoints = ai.patrolWaypoints;
    const count = waypoints.length;

    ai.patrolPaths = new Array<Vector2[] | null>(count * 2).fill(null);
    if (ai.patrolMode === 'static' || count <= 1) return;

    for (let from = 0; from < count; from++) {
      for (const direction of [1, -1] as const) {
        // A loop only ever travels one way; only pingpong needs the reverse legs.
        if (ai.patrolMode === 'loop' && direction === -1) continue;

        const next = resolveNextWaypoint(ai.patrolMode, count, from, direction);
        if (next.index === from) continue;

        const legIndex = patrolLegIndex(from, next.direction);
        if (ai.patrolPaths[legIndex]) continue;

        const buffer: Vector2[] = [];
        for (let i = 0; i < GAME_CONSTANTS.AI.MAX_PATH_POINTS; i++) buffer.push({ x: 0, y: 0 });
        const written = this.pathfinder.findPath(
          waypoints[from]!,
          waypoints[next.index]!,
          buffer,
          GAME_CONSTANTS.AI.ASTAR_MAX_NODES
        );

        if (written === 0) {
          // Bad map data, and it must not be silent: the enemy stays put and guards
          // instead of walking into a wall for the rest of the run.
          this.context.warn(
            `${enemy.id} has no path from waypoint ${from} to ${next.index}; ` +
              'the route degrades to a static guard post'
          );
          ai.patrolMode = 'static';
          ai.patrolPaths.fill(null);
          return;
        }

        buffer.length = written;
        ai.patrolPaths[legIndex] = buffer;
      }
    }
  }

  /** Puts a freshly spawned enemy on the leg toward its next waypoint. */
  private startPatrolLeg(enemy: Enemy): void {
    const ai = enemy.ai;
    if (ai.patrolMode === 'static' || ai.patrolWaypoints.length <= 1) {
      ai.waypointPauseMs = enemy.spawnData.patrol.pauseMs ?? GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS;
      return;
    }

    const next = resolveNextWaypoint(ai.patrolMode, ai.patrolWaypoints.length, 0, 1);
    ai.patrolIndex = next.index;
    ai.patrolDir = next.direction;
    setPatrolLeg(enemy, ai.patrolPaths[patrolLegIndex(0, next.direction)] ?? null);
  }

  private advanceTimers(enemy: Enemy, dtMs: number): void {
    const ai = enemy.ai;
    if (ai.alertEmitCooldownMs > 0) ai.alertEmitCooldownMs = Math.max(0, ai.alertEmitCooldownMs - dtMs);
    if (ai.repathCooldownMs > 0) ai.repathCooldownMs = Math.max(0, ai.repathCooldownMs - dtMs);
    if (ai.preferPathMs > 0) ai.preferPathMs = Math.max(0, ai.preferPathMs - dtMs);
    if (ai.pathRequestPending) ai.pathRequestAgeMs += dtMs;
  }

  /**
   * Catches an enemy that wants to move but is not moving, and makes it ask for a real
   * path instead of pressing on with the straight line it chose.
   *
   * A safety net rather than a routine mechanism: smoothing and the straight-line
   * shortcut both keep a body's width of clearance, so a healthy enemy should never trip
   * it. It exists because the alternative failure mode - grinding against a corner for
   * the rest of the run - is one the spec explicitly forbids (rule N6).
   */
  private updateStuckWatchdog(enemy: Enemy, dtMs: number): void {
    const ai = enemy.ai;
    const config = GAME_CONSTANTS.AI;
    const desired = Math.hypot(ai.velocity.x, ai.velocity.y);

    if (desired <= 1 || dtMs <= 0) {
      ai.stuckMs = 0;
      return;
    }

    const actual = (enemy.measureDisplacement() / dtMs) * 1000;
    if (actual >= desired * config.STUCK_PROGRESS_FRACTION) {
      ai.stuckMs = 0;
      return;
    }

    ai.stuckMs += dtMs;
    if (ai.stuckMs < config.STUCK_REPATH_MS) return;

    ai.stuckMs = 0;
    ai.preferPathMs = config.STUCK_PATH_PREFERENCE_MS;
    ai.repathCooldownMs = 0;
    this.unstickEvents++;

    if (ai.state === AIState.PATROL) {
      // A patrol has no A* to fall back on, so dropping its path would strand it against
      // the wall permanently. Skip the point it cannot reach and keep walking the leg.
      ai.pathCursor++;
      return;
    }
    clearPath(enemy);
  }

  private updatePlayerMotion(
    playerPos: Readonly<Vector2>,
    playerIsMoving: boolean,
    dtMs: number
  ): void {
    if (this.hasPreviousPlayerPos && dtMs > 0) {
      const inverseDt = 1000 / dtMs;
      this.playerVel.x = (playerPos.x - this.previousPlayerPos.x) * inverseDt;
      this.playerVel.y = (playerPos.y - this.previousPlayerPos.y) * inverseDt;
    }
    this.previousPlayerPos.x = playerPos.x;
    this.previousPlayerPos.y = playerPos.y;
    this.hasPreviousPlayerPos = true;

    this.playerPos.x = playerPos.x;
    this.playerPos.y = playerPos.y;
    this.playerIsMoving = playerIsMoving;
  }

  private findEnemy(id: string): Enemy | undefined {
    for (const enemy of this.enemies) {
      if (enemy.id === id) return enemy;
    }
    return undefined;
  }

  /**
   * `ENEMY_ALERT` on escalation only, with a per-level cooldown (contract E1). Without
   * the cooldown, detection hovering on a threshold would bill the chaos meter over and
   * over for one continuous moment.
   */
  private emitAlert(enemy: Enemy, level: Exclude<AlertLevel, 'none'>): void {
    const ai = enemy.ai;
    if (ai.lastEmittedLevel === level && ai.alertEmitCooldownMs > 0) return;

    ai.lastEmittedLevel = level;
    ai.alertEmitCooldownMs = GAME_CONSTANTS.AI.ALERT_EMIT_COOLDOWN_MS;
    // A handful of these per encounter, never per frame; consumers may retain the payload.
    eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: enemy.id, alertLevel: level });
  }

  private emitLost(enemy: Enemy): void {
    eventBus.emit(GameEvent.ENEMY_LOST_PLAYER, { enemyId: enemy.id });
  }

  private emitCue(enemy: Enemy, cue: AICueId): void {
    this.lastCue = `${enemy.id} ${cue}`;
    this.cueListener?.(enemy.id, cue);
  }
}
