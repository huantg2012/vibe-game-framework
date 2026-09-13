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
import { AIRuntimeRandom, copyRuntimeVector, runtimeEnemyForm, runtimeInteger } from '@/systems/ai/runtime-validation';
import { exportEnemyAIState, restoreEnemyAIState, validateAIRuntimeState, validateEnemyAIBindings, type AIRuntimeState, type AIRuntimeRecoveryOptions } from '@/systems/ai/runtime-state';
export { validateAIRuntimeState } from '@/systems/ai/runtime-state';
export type { AIRuntimeState, AIRuntimeRecoveryOptions } from '@/systems/ai/runtime-state';
import { floorMotionFor, INFILTRATOR_FORM, REWRITER_FORM } from '@/generation/contamination-draw';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { AIState, type Vector2 } from '@/types/game-types';
import { GameEvent } from '@/types/events';
import type { EnemySpawnData, OccluderGrid, WalkGrid } from '@/types/map-types';
import { ENEMY_DATA } from '@/generated/enemy-data';
import type { AICueId, AlertLevel, EnemyTypeConfig, EnemyView, Perception } from '@/types/ai-types';
import { createEnemy, createEnemyTypeConfig, type Enemy } from '@/entities/enemy-factory';
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
import { clamp, lerp, shortestArc } from '@/utils/math';
import { separateContacts, type ContactBody } from '@/systems/ai/contact-separation';
import { bodyDisplacementFraction, createMovementOccluders } from '@/systems/ai/physical-grid';
import type { EnemyControlEffect, EnemyControlSnapshot } from '@/systems/enemy-control-state';

/** How the player's field of view rates a world position: 0 means "not drawn" (rule R4). */
export type VisibilityProvider = (point: Readonly<Vector2>) => number;

/** Audio hook (rule R7). The AI names the moment; the scene decides what it sounds like. */
export type CueListener = (enemyId: string, cue: AICueId) => void;

/**
 * Enemy render depth: just under the player, so the player sprite wins any overlap.
 * Exported so the scene's depth map can name it rather than repeat the number.
 */
export const ENEMY_DEPTH = 25;

interface PatrolConfiguration {
  patrolMode: EnemySpawnData['patrol']['mode'];
  patrolWaypoints: Vector2[];
  patrolPaths: (Vector2[] | null)[];
}

export interface AIRuntimeConfiguration {
  readonly rosterSignature: string;
  readonly enemies: readonly {
    readonly id: string;
    readonly config: EnemyTypeConfig;
    readonly patrolMode: EnemySpawnData['patrol']['mode'];
    readonly patrolWaypoints: readonly Readonly<Vector2>[];
    readonly patrolPaths: readonly (readonly Readonly<Vector2>[] | null)[];
  }[];
}

/** The same create-time route computation serves live enemies and pre-load admission. */
function createPatrolConfiguration(spawn: EnemySpawnData, position: Readonly<Vector2>, tileSize: number,
  pathfinder: GridPathfinder, warn: (message: string) => void): PatrolConfiguration {
  if (floorMotionFor(spawn.form ?? (spawn.type === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM)) !== 'motion_patrol') {
    return { patrolMode: 'static', patrolWaypoints: [{ ...position }], patrolPaths: [] };
  }
  const route: PatrolConfiguration = { patrolMode: spawn.patrol.mode,
    patrolWaypoints: spawn.patrol.waypoints.map(point => ({ x: (point.col + .5) * tileSize, y: (point.row + .5) * tileSize })),
    patrolPaths: new Array<Vector2[] | null>(spawn.patrol.waypoints.length * 2).fill(null) };
  const count = route.patrolWaypoints.length;
  if (route.patrolMode === 'static' || count <= 1) return route;
  for (let from = 0; from < count; from++) {
    for (const direction of [1, -1] as const) {
      if (route.patrolMode === 'loop' && direction === -1) continue;
      const next = resolveNextWaypoint(route.patrolMode, count, from, direction);
      if (next.index === from) continue;
      const legIndex = patrolLegIndex(from, next.direction);
      if (route.patrolPaths[legIndex]) continue;
      const buffer: Vector2[] = [];
      for (let index = 0; index < GAME_CONSTANTS.AI.MAX_PATH_POINTS; index++) buffer.push({ x: 0, y: 0 });
      const written = pathfinder.findPath(route.patrolWaypoints[from]!, route.patrolWaypoints[next.index]!, buffer, GAME_CONSTANTS.AI.ASTAR_MAX_NODES);
      if (written === 0) {
        warn(`${spawn.id} has no path from waypoint ${from} to ${next.index}; the route degrades to a static guard post`);
        route.patrolMode = 'static'; route.patrolPaths.fill(null); return route;
      }
      buffer.length = written; route.patrolPaths[legIndex] = buffer;
    }
  }
  return route;
}

function runtimeRosterSignature(spawns: readonly EnemySpawnData[], walk: WalkGrid,
  enemies: AIRuntimeConfiguration['enemies']): string {
  return JSON.stringify({ spawns, grid: { cols: walk.cols, rows: walk.rows, tileSize: walk.tileSize },
    routes: enemies.map(enemy => ({ id: enemy.id, config: enemy.config,
      waypoints: enemy.patrolWaypoints, paths: enemy.patrolPaths })) });
}

/** Pure current-content recipe. No entities, state transitions, events or random draws. */
export function createAIRuntimeConfiguration(spawns: readonly EnemySpawnData[], walk: WalkGrid): AIRuntimeConfiguration {
  if (spawns.length !== 2 || new Set(spawns.map(spawn => spawn.id)).size !== 2
    || spawns.filter(spawn => spawn.type === 'rewriter').length !== 1
    || spawns.some(spawn => !runtimeEnemyForm(spawn.form, spawn.type))) {
    throw new Error('Unsupported suspended sea AI recovery configuration');
  }
  const pathfinder = new GridPathfinder(walk, createMovementOccluders(walk), GAME_CONSTANTS.AI.BODY_SIZE);
  const enemies = spawns.map(spawn => {
    const position = { x: (spawn.spawn.col + .5) * walk.tileSize, y: (spawn.spawn.row + .5) * walk.tileSize };
    if (!walk.isWalkable(spawn.spawn.col, spawn.spawn.row)) pathfinder.findNearestWalkable(position.x, position.y, position);
    return { id: spawn.id, config: createEnemyTypeConfig(spawn.type, spawn.form),
      ...createPatrolConfiguration(spawn, position, walk.tileSize, pathfinder, () => {}) };
  });
  return { rosterSignature: runtimeRosterSignature(spawns, walk, enemies), enemies };
}

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
    walk: WalkGrid,
    options?: { requireExactlyOneRewriter?: boolean; recovery?: AIRuntimeRecoveryOptions },
  ): void;
  update(deltaMs: number, playerPos: Readonly<Vector2>, playerIsMoving: boolean): void;
  exportRuntimeState(): AIRuntimeState;
  validateRuntimeState(value: unknown): value is AIRuntimeState;
  restoreRuntimeState(value: unknown): void;
  finishRuntimeRestore(): void;
  getEnemies(): readonly EnemyView[];
  getEnemyById(id: string): EnemyView | undefined;
  reportNoise(pos: Readonly<Vector2>, radius: number, level: 'suspicious' | 'alert'): void;
  reportDamage(enemyId: string, sourcePos: Readonly<Vector2>): void;
  despawn(enemyId: string): void;
  onPlayerLost(): void;
  destroy(): void;
  setEnemyControl(enemyId: string, sourceId: string, effect: EnemyControlEffect): void;
  clearEnemyControl(enemyId: string, sourceId: string): void;
  hasEnemyControl(enemyId: string, sourceId: string): boolean;
  getEnemyControlState(enemyId: string): EnemyControlSnapshot | undefined;
  breakEnemyControlsOnDamage(enemyId: string): void;

  // --- Slice 5 tool overrides (T1), called by ToolSystem through the scene's wiring. ---
  /** compress / echo / resonate's post-knockback stun: 1 = no effect. */
  setEnemySpeedMultiplier(enemyId: string, mult: number): void;
  /** compress: "无法改变移动方向". Captures the current heading the first time it engages. */
  setEnemyMovementLocked(enemyId: string, locked: boolean): void;
  /** overwrite / combust: "感知范围-50%". 1 = no effect. */
  setEnemyPerceptionMultiplier(enemyId: string, mult: number): void;
  /** overwrite: "巡逻路线反转"; echo: "巡逻方向立刻反转". No-op if the enemy has < 2 waypoints. */
  reverseEnemyPatrol(enemyId: string): void;
  /** overwrite: "若目标正在追击则立刻降级为返回状态". No-op unless the enemy is CHASE right now. */
  forceEnemyReturn(enemyId: string): void;
  /** mirror's decoy position, or null while no decoy is active. */
  setDecoyPosition(pos: Readonly<Vector2> | null): void;
  setVisualDecoy(sourceId: string, pos: Readonly<Vector2> | null): void;
  reportSoundLure(pos: Readonly<Vector2>, radius: number): void;
  /** Tool displacement, swept against physical support so walls and chasms stop it. */
  knockbackEnemy(enemyId: string, dx: number, dy: number): void;

  // --- Slice 4 tool overrides (T7 rewire), same shape as the Slice 5 block above. ---
  /** delay: blocks SUSPICIOUS→ALERT and ALERT→CHASE only (see `EnemyAIState`). */
  setEnemyEscalationSuppressed(enemyId: string, suppressed: boolean): void;
  /** solidify: "解冻后立即进入警戒状态"; kindle: "追击者失去目标锁定". Transitions
   * unconditionally to ALERT, searching around the enemy's last known sighting (or its
   * own position if it never had one). */
  forceEnemyAlert(enemyId: string): void;
  /** stitch: "感知状态强制降一级(chase→alert→suspicious→patrol)". No-op on an enemy
   * already at PATROL/RETURN - there is nothing lower to drop to. */
  demoteEnemyAlertLevel(enemyId: string): void;
  /** scatter: "感知填充速度降低30%". 1 = no effect. */
  setEnemyDetectionFillRateMult(enemyId: string, mult: number): void;
  /** muffle: "360度近距检测对玩家无效". Global (muffle is a player loadout passive, not
   * tied to a single enemy), unlike every other override above. */
  setHearingSuppressed(active: boolean): void;
  /** Fires once per hearing signal muffle actually swallowed, so `ToolSystem` can spend
   * a charge. Pass `null` to stop listening (scene shutdown / reset). */
  setHearingAvoidedListener(listener: ((enemyId: string) => boolean) | null): void;
  /** muffle's defense-slot side effect: "下次出击敌人近距感知范围+15%". Global (every
   * enemy, for the whole sortie), unlike every per-enemy override above. 1 = no effect.
   * Distinct from `setHearingSuppressed()` - that one is muffle as an equipped tool. */
  setHearingRangeMultiplier(mult: number): void;
}

export class AISystem implements AISystemAPI {
  private readonly visualDecoys = new Map<string, Vector2>();
  private recoveryOptions: AIRuntimeRecoveryOptions | null = null;
  private recoveryRandom: AIRuntimeRandom | null = null;
  private recoveryRosterSignature = '';
  private pendingRuntimeRestore: AIRuntimeState | null = null;
  private scene!: Phaser.Scene;
  private occluders!: OccluderGrid;
  private walk!: WalkGrid;
  private movementOccluders!: OccluderGrid;
  private pathfinder!: GridPathfinder;
  private readonly enemies: Enemy[] = [];
  /** Live array handed to the scene's wall collider; despawn splices it. */
  private readonly sprites: Phaser.Physics.Arcade.Image[] = [];
  private readonly contacts: ContactBody[] = [];
  private wallLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private staticPlayerCollider: Phaser.Physics.Arcade.Collider | null = null;
  private physicsElapsedMs = 0;
  /** Plugin shutdown can null scene.physics.world before Scene.SHUTDOWN reaches us. */
  private observedWorld: Phaser.Physics.Arcade.World | null = null;

  private detachPhysicsHandles(): void {
    this.observedWorld?.off('worldstep', this.onWorldStep, this);
    this.observedWorld = null;
    // Collider.destroy is not idempotent: Phaser sets its world to null on destruction.
    if (this.staticPlayerCollider?.world) this.staticPlayerCollider.destroy();
    this.staticPlayerCollider = null;
    this.physicsElapsedMs = 0;
  }

  private onWorldStep(deltaSeconds: number): void {
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) this.physicsElapsedMs += deltaSeconds * 1000;
  }

  private visibilityProvider: VisibilityProvider | null = null;
  private cueListener: CueListener | null = null;
  /** muffle (T7 rewire): fires once per hearing signal actually swallowed. */
  private hearingAvoidedListener: ((enemyId: string) => boolean) | null = null;

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
    hearingRate: 0,
    hearingRadius: 0,
    hearingStill: false,
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
    walk: WalkGrid,
    options?: { requireExactlyOneRewriter?: boolean; recovery?: AIRuntimeRecoveryOptions },
  ): void {
    const recovery = options?.recovery;
    if (recovery && (!runtimeInteger(recovery.runSeed, 0, 0xffffffff) || !recovery.signature
      || spawns.length !== 2 || new Set(spawns.map(spawn => spawn.id)).size !== 2
      || spawns.filter(spawn => spawn.type === 'rewriter').length !== 1
      || spawns.some(spawn => !runtimeEnemyForm(spawn.form, spawn.type)))) {
      throw new Error('Unsupported suspended sea AI recovery configuration');
    }
    this.recoveryOptions = recovery ? { ...recovery } : null;
    this.recoveryRandom = recovery ? new AIRuntimeRandom(recovery.runSeed) : null;
    this.pendingRuntimeRestore = null;
    this.detachPhysicsHandles();
    this.scene = scene;
    this.observedWorld = scene.physics.world;
    this.observedWorld.on('worldstep', this.onWorldStep, this);
    this.occluders = occluders;
    this.walk = walk;
    this.movementOccluders = createMovementOccluders(walk);
    this.hasPreviousPlayerPos = false;
    this.playerIsMoving = false;
    // Smoothing has to keep a body's width of room, not just a sight line: a shortcut
    // that only a point could take leaves the enemy grinding against a corner.
    this.pathfinder = new GridPathfinder(walk, this.movementOccluders, GAME_CONSTANTS.AI.BODY_SIZE);
    this.context = this.createContext();

    if (import.meta.env?.DEV && spawns.length > GAME_CONSTANTS.AI.MAX_ACTIVE_ENEMIES) {
      console.warn(
        `[AISystem] ${spawns.length} spawns exceeds MAX_ACTIVE_ENEMIES ` +
          `(${GAME_CONSTANTS.AI.MAX_ACTIVE_ENEMIES}); the map data is probably wrong`
      );
    }

    let rewriterCount = 0;
    for (const spawn of spawns) {
      if (!(spawn.type in ENEMY_DATA)) {
        throw new Error(`[AISystem] unknown enemy type '${spawn.type}' on ${spawn.id}`);
      }
      if (spawn.type === 'rewriter') rewriterCount += 1;
    }
    if (options?.requireExactlyOneRewriter !== false) {
      if (rewriterCount !== 1) {
        throw new Error(
          `[AISystem] spawn table must contain exactly 1 rewriter (got ${rewriterCount}); ` +
            'refusing to silently treat every patrol as an infiltrator'
        );
      }
    }

    for (let i = 0; i < spawns.length; i++) {
      const enemy = this.spawnEnemy(spawns[i]!, i, spawns.length);
      this.enemies.push(enemy);
      this.sprites.push(enemy.getSprite());
      this.registerContact(enemy);
      if (recovery) enemy.setLocomotionMode('continuous');
    }
    this.recoveryRosterSignature = recovery ? runtimeRosterSignature(spawns, walk,
      this.enemies.map(enemy => ({ id: enemy.id, config: enemy.config, patrolMode: enemy.ai.patrolMode,
        patrolWaypoints: enemy.ai.patrolWaypoints, patrolPaths: enemy.ai.patrolPaths }))) : '';
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
   * part in while mobile (rule B6). They do not push the player (that would wedge them into corners
   * and fight combat's own contact test) and they do not collide with each other (two
   * bodies jam a corridor); separation steers them apart instead.
   *
   * The live sprite array stays private so `despawn()` can keep it in step with the
   * collider without anything outside holding a stale reference.
   */
  addWallCollider(layer: Phaser.Tilemaps.TilemapLayer): Phaser.Physics.Arcade.Collider {
    this.wallLayer = layer;
    return this.scene.physics.add.collider(this.sprites, layer);
  }

  /** The live roster also includes later gym spawns; only static 20px bases collide. */
  addStaticPlayerCollider(player: Phaser.Physics.Arcade.Image): void {
    if (this.staticPlayerCollider?.world) this.staticPlayerCollider.destroy();
    this.staticPlayerCollider = this.scene.physics.add.collider(player, this.sprites, undefined,
      (_player, candidate) => this.findEnemy((candidate as Phaser.GameObjects.GameObject).name)?.isStaticObstacle() === true);
  }

  /**
   * Practice-field spawn after `create`. Does not re-check the sortie rewriter quota.
   * Caller must `CombatSystem.noteRosterChanged()` afterwards.
   */
  spawnOne(spawn: EnemySpawnData): string {
    if (this.recoveryOptions) throw new Error('Recovery roster is immutable');
    if (!(spawn.type in ENEMY_DATA)) {
      throw new Error(`[AISystem] unknown enemy type '${spawn.type}' on ${spawn.id}`);
    }
    const enemy = this.spawnEnemy(spawn, this.enemies.length, this.enemies.length + 1);
    this.enemies.push(enemy);
    const sprite = enemy.getSprite();
    this.sprites.push(sprite);
    this.registerContact(enemy);
    if (this.wallLayer) this.scene.physics.add.collider(sprite, this.wallLayer);
    return enemy.getId();
  }

  /** Enemy bodies, for combat's hit tests. Never mutate the returned array. */
  getSprites(): readonly Phaser.Physics.Arcade.Image[] {
    return this.sprites;
  }

  destroy(): void {
    this.detachPhysicsHandles();
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies.length = 0;
    this.sprites.length = 0;
    this.contacts.length = 0;
    this.wallLayer = null;
    this.visibilityProvider = null;
    this.cueListener = null;
    this.hearingAvoidedListener = null;
    this.visualDecoys.clear();
    this.recoveryOptions = null;
    this.recoveryRandom = null;
    this.pendingRuntimeRestore = null;
    this.recoveryRosterSignature = '';
  }

  // ------------------------------------------------------------------ update

  update(deltaMs: number, playerPos: Readonly<Vector2>, playerIsMoving: boolean): void {
    if (this.pendingRuntimeRestore) throw new Error('AI restore requires ToolSystem source hydration and finishRuntimeRestore');
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
      this.context.decoyPos = this.visibleDecoyFor(enemy);
      if (enemy.ai.targetingDecoy && !this.context.decoyPos && enemy.ai.losGraceMs === 0) {
        enemy.ai.losGraceMs = 1;
      }
      this.updateActivity(enemy, dtMs);
      enemy.tickGait(dtMs);
      if (!enemy.canAct()) {
        enemy.setVelocity(0, 0);
        enemy.ai.engaged = false;
        enemy.ai.pathRequestPending = false;
        enemy.ai.perceptionAccumMs = 0;
        continue;
      }
      this.advanceTimers(enemy, dtMs);
      if (enemy.isAttackAvailable()) this.runPerceptionTick(enemy, dtMs);
      updateBehavior(enemy, this.context);
    }

    for (let i = 0; i < config.MAX_PATHS_PER_FRAME; i++) {
      if (!this.servicePathRequest()) break;
    }

    this.lastMs = performance.now() - startedAt;
    this.totalMs += this.lastMs;
    this.frames++;
  }

  private updateActivity(enemy: Enemy, dtMs: number): void {
    const ai = enemy.ai;
    const asleep = enemy.getForm().lexemes.rhythm === 'rhythm_sleep' &&
      enemy.getActivityVisualState().phase === 'rest';
    enemy.activityHearingAccumMs = asleep ? enemy.activityHearingAccumMs + dtMs : 0;
    if (asleep && enemy.activityHearingAccumMs >= GAME_CONSTANTS.AI.PERCEPTION_TICK_MS) {
      enemy.activityHearingAccumMs = 0;
      // Explicit noise and damage are already authoritative stimuli, never muffle charges.
      if (this.playerIsMoving && !ai.pendingDamage && ai.pendingNoiseLevel === null) {
        const range = enemy.config.profile.hearingRange * ai.perceptionRangeMult * this.context.hearingRangeMult;
        const distance = Math.hypot(this.playerPos.x - ai.position.x, this.playerPos.y - ai.position.y);
        if (distance <= range) {
          const clear = hasLineOfSight(this.occluders, ai.position, this.playerPos);
          this.raysThisFrame++;
          if (distance <= range * (clear ? 1 : enemy.config.hearing.wallFactor) &&
              !this.trySuppressHearingDiscovery(enemy.id)) {
            ai.pendingNoiseLevel = 'suspicious';
            ai.pendingNoisePos.x = this.playerPos.x;
            ai.pendingNoisePos.y = this.playerPos.y;
          }
        }
      }
    }
    enemy.tickActivity(dtMs, ai.pendingDamage || ai.pendingNoiseLevel !== null);
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
    if (this.pendingRuntimeRestore) throw new Error('AI restore is not finished');
    const dtMs = Math.min(deltaMs, GAME_CONSTANTS.AI.DT_CLAMP_MS);
    // WORLD_STEP runs at Arcade's fixed cadence, often half the display rate. Sprite
    // positions have now been resolved by Arcade POST_UPDATE. Frames with no physics
    // step retain the last resolved speed instead of alternating walk/idle at 120Hz.
    if (this.physicsElapsedMs > 0) {
      for (const enemy of this.enemies) enemy.measureActualVelocity(this.physicsElapsedMs);
      this.physicsElapsedMs = 0;
    }
    separateContacts(this.contacts, this.walk, dtMs);
    for (const enemy of this.enemies) {
      this.updateStuckWatchdog(enemy, dtMs);
      enemy.syncPositionFromBody();
      const visibility = this.visibilityProvider
        ? this.visibilityProvider(enemy.ai.position)
        : 1;
      enemy.syncVisuals(dtMs, visibility);
    }
  }

  private registerContact(enemy: Enemy): void {
    const sprite = enemy.getSprite();
    this.contacts.push({
      id: enemy.id, position: sprite, size: enemy.config.bodySize,
      immovable: floorMotionFor(enemy.getForm()) !== 'motion_patrol', remaining: 0,
      moveTo(x, y) {
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        body.reset(x, y);
        body.velocity.set(vx, vy);
      },
    });
  }

  /** Captured only after all actors reached the same frame boundary. */
  exportRuntimeState(): AIRuntimeState {
    if (!this.recoveryOptions || !this.recoveryRandom || this.pendingRuntimeRestore) {
      throw new Error('AI recovery was not enabled, or hydration is incomplete');
    }
    if (this.visualDecoys.size > 0) throw new Error('Visual decoys are outside suspended sea recovery support');
    const value: AIRuntimeState = { version: 1, signature: this.recoveryOptions.signature,
      rosterSignature: this.recoveryRosterSignature, runSeed: this.recoveryOptions.runSeed,
      randomState: this.recoveryRandom.exportState(), playerPos: copyRuntimeVector(this.playerPos),
      previousPlayerPos: copyRuntimeVector(this.previousPlayerPos), playerVel: copyRuntimeVector(this.playerVel),
      playerIsMoving: this.playerIsMoving, hasPreviousPlayerPos: this.hasPreviousPlayerPos,
      physicsElapsedMs: this.physicsElapsedMs, hearingRangeMult: this.context.hearingRangeMult,
      hearingSuppressed: this.context.hearingSuppressed,
      enemies: this.enemies.map(enemy => ({ id: enemy.id, entity: enemy.exportRuntimeState(),
        state: exportEnemyAIState(enemy), attackInterruptRevision: enemy.controls.attackInterruptRevision })) };
    if (!this.validateRuntimeState(value)) throw new Error('Invalid live AI recovery state');
    return value;
  }

  /** Includes content and live binding checks, without mutating any state. */
  validateRuntimeState(value: unknown): value is AIRuntimeState {
    if (!validateAIRuntimeState(value) || !this.recoveryOptions || !this.recoveryRandom
      || value.signature !== this.recoveryOptions.signature || value.runSeed !== this.recoveryOptions.runSeed
      || value.rosterSignature !== this.recoveryRosterSignature) return false;
    return value.enemies.every(entry => {
      const enemy = this.findEnemy(entry.id);
      return !!enemy && enemy.supportsRuntimeRecovery() && validateEnemyAIBindings(enemy.ai, entry.state);
    });
  }

  /** Restore actors/AI first; ToolSystem rebuilds sources before finishRuntimeRestore. */
  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid or incompatible AI runtime state');
    // Retain detached JSON data so a caller cannot alter the pending interruption latch.
    const state: AIRuntimeState = structuredClone(value);
    const liveIds = new Set(state.enemies.map(enemy => enemy.id));
    for (let index = this.enemies.length - 1; index >= 0; index--) {
      const enemy = this.enemies[index]!;
      if (liveIds.has(enemy.id)) continue;
      const spriteIndex = this.sprites.indexOf(enemy.getSprite());
      if (spriteIndex >= 0) this.sprites.splice(spriteIndex, 1);
      const contactIndex = this.contacts.findIndex(contact => contact.id === enemy.id);
      if (contactIndex >= 0) this.contacts.splice(contactIndex, 1);
      this.enemies.splice(index, 1);
      enemy.destroy();
    }
    // Preserve roster iteration order: perception, path budgets, and control interactions use it.
    this.enemies.sort((a, b) => state.enemies.findIndex(entry => entry.id === a.id)
      - state.enemies.findIndex(entry => entry.id === b.id));
    this.sprites.splice(0, this.sprites.length, ...this.enemies.map(enemy => enemy.getSprite()));
    this.contacts.sort((a, b) => state.enemies.findIndex(entry => entry.id === a.id)
      - state.enemies.findIndex(entry => entry.id === b.id));
    for (const entry of state.enemies) {
      const enemy = this.findEnemy(entry.id)!;
      restoreEnemyAIState(enemy, entry.state);
      enemy.restoreRuntimeState(entry.entity);
      enemy.controls.beginRuntimeRestore();
      enemy.ai.externalSpeedMult = 1;
      enemy.ai.perceptionRangeMult = 1;
    }
    Object.assign(this.playerPos, state.playerPos);
    Object.assign(this.previousPlayerPos, state.previousPlayerPos);
    Object.assign(this.playerVel, state.playerVel);
    this.playerIsMoving = state.playerIsMoving;
    this.hasPreviousPlayerPos = state.hasPreviousPlayerPos;
    this.physicsElapsedMs = state.physicsElapsedMs;
    this.context.playerIsMoving = state.playerIsMoving;
    this.context.hearingRangeMult = state.hearingRangeMult;
    this.context.hearingSuppressed = state.hearingSuppressed;
    this.context.decoyPos = null;
    this.visualDecoys.clear();
    this.recoveryRandom!.restoreState(state.randomState);
    this.pendingRuntimeRestore = state;
  }

  /** Tool sources are the sole multiplier truth; rebinding must not count as new control. */
  finishRuntimeRestore(): void {
    const state = this.pendingRuntimeRestore;
    if (!state) throw new Error('No pending AI runtime restore');
    for (const entry of state.enemies) {
      const enemy = this.findEnemy(entry.id)!;
      enemy.controls.restoreInterruptRevision(entry.attackInterruptRevision);
      this.syncControlMultipliers(enemy);
    }
    this.pendingRuntimeRestore = null;
  }

  // ------------------------------------------------------------------ queries

  getEnemies(): readonly EnemyView[] {
    return this.enemies;
  }

  getEnemyById(id: string): EnemyView | undefined {
    return this.findEnemy(id);
  }

  // ------------------------------------------------------------------ Slice 5 tool overrides (T1)

  setEnemySpeedMultiplier(enemyId: string, mult: number): void {
    if (mult === 1) this.clearEnemyControl(enemyId, 'legacy:movement');
    else this.setEnemyControl(enemyId, 'legacy:movement', { movementMultiplier: mult });
  }

  setEnemyControl(enemyId: string, sourceId: string, effect: EnemyControlEffect): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    enemy.controls.set(sourceId, effect);
    this.syncControlMultipliers(enemy);
  }

  clearEnemyControl(enemyId: string, sourceId: string): void {
    const enemy = this.findEnemy(enemyId);
    if (enemy?.controls.clear(sourceId)) this.syncControlMultipliers(enemy);
  }

  hasEnemyControl(enemyId: string, sourceId: string): boolean {
    return this.findEnemy(enemyId)?.controls.has(sourceId) ?? false;
  }

  getEnemyControlState(enemyId: string): EnemyControlSnapshot | undefined {
    return this.findEnemy(enemyId)?.controls;
  }

  breakEnemyControlsOnDamage(enemyId: string): void {
    const enemy = this.findEnemy(enemyId);
    if (enemy?.controls.breakOnDamage()) this.syncControlMultipliers(enemy);
  }

  private syncControlMultipliers(enemy: Enemy): void {
    enemy.ai.externalSpeedMult = enemy.controls.movementMultiplier;
    enemy.ai.perceptionRangeMult = enemy.controls.perceptionMultiplier;
    if (enemy.ai.externalSpeedMult === 0) enemy.setVelocity(0, 0);
  }

  setEnemyMovementLocked(enemyId: string, locked: boolean): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    const ai = enemy.ai;
    if (locked === ai.movementDirLocked) return;

    if (locked) {
      const speed = Math.hypot(ai.velocity.x, ai.velocity.y);
      if (speed > 0.01) {
        ai.lockedDir.x = ai.velocity.x / speed;
        ai.lockedDir.y = ai.velocity.y / speed;
      } else {
        ai.lockedDir.x = Math.cos(ai.facingAngle);
        ai.lockedDir.y = Math.sin(ai.facingAngle);
      }
    }
    ai.movementDirLocked = locked;
  }

  setEnemyPerceptionMultiplier(enemyId: string, mult: number): void {
    if (mult === 1) this.clearEnemyControl(enemyId, 'legacy:perception');
    else this.setEnemyControl(enemyId, 'legacy:perception', { perceptionMultiplier: mult });
  }

  reverseEnemyPatrol(enemyId: string): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    const ai = enemy.ai;
    const count = ai.patrolWaypoints.length;
    if (count <= 1) return;

    // Mirrors `advancePatrol()` (behaviors.ts) but starting from the flipped direction,
    // so a reversed pingpong route picks up its precomputed leg exactly the same way.
    const newDir: 1 | -1 = ai.patrolDir === 1 ? -1 : 1;
    const from = ai.patrolIndex;
    const next = resolveNextWaypoint(ai.patrolMode, count, from, newDir);
    ai.patrolDir = next.direction;
    ai.patrolIndex = next.index;
    setPatrolLeg(enemy, ai.patrolPaths[patrolLegIndex(from, next.direction)] ?? null);
  }

  forceEnemyReturn(enemyId: string): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    if (enemy.ai.state === AIState.CHASE) transitionTo(enemy, AIState.RETURN, this.context);
  }

  setDecoyPosition(pos: Readonly<Vector2> | null): void {
    this.setVisualDecoy('legacy:mirror', pos);
  }

  setVisualDecoy(sourceId: string, pos: Readonly<Vector2> | null): void {
    if (!pos) {
      this.visualDecoys.delete(sourceId);
      return;
    }
    const existing = this.visualDecoys.get(sourceId);
    if (existing) { existing.x = pos.x; existing.y = pos.y; }
    else this.visualDecoys.set(sourceId, { x: pos.x, y: pos.y });
  }

  private visibleDecoyFor(enemy: Enemy): Vector2 | null {
    const ai = enemy.ai;
    if ((ai.state === AIState.CHASE && !ai.targetingDecoy) || enemy.config.profile.visionWeight <= 0) return null;
    let nearest: Vector2 | null = null;
    let nearestSq = (enemy.config.sight.rangeCore * ai.perceptionRangeMult) ** 2;
    if (nearestSq <= 0) return null;
    for (const pos of this.visualDecoys.values()) {
      const dx = pos.x - ai.position.x;
      const dy = pos.y - ai.position.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > nearestSq) continue;
      if (Math.abs(shortestArc(Math.atan2(dy, dx) - ai.facingAngle)) > enemy.config.sight.halfAngleCore) continue;
      if (!hasLineOfSight(this.occluders, ai.position, pos)) continue;
      nearest = pos;
      nearestSq = distanceSq;
    }
    return nearest;
  }

  /** A physical sound source: hearing range and wall attenuation apply, not player coordinates. */
  reportSoundLure(pos: Readonly<Vector2>, radius: number): void {
    for (const enemy of this.enemies) {
      const ai = enemy.ai;
      // A lure never erases a confirmed chase, damage, or a higher-priority combat sound.
      if (ai.state === AIState.CHASE || ai.pendingDamage || ai.pendingNoiseLevel === 'alert') continue;
      const range = Math.min(radius, enemy.config.hearing.range * ai.perceptionRangeMult);
      if (range <= 0) continue;
      const distance = Math.hypot(pos.x - ai.position.x, pos.y - ai.position.y);
      if (distance > range) continue;
      const audibleRange = range * (hasLineOfSight(this.occluders, ai.position, pos) ? 1 : enemy.config.hearing.wallFactor);
      if (distance > audibleRange) continue;
      ai.pendingNoiseLevel = 'suspicious';
      ai.pendingNoiseIsLure = true;
      ai.pendingNoisePos.x = pos.x;
      ai.pendingNoisePos.y = pos.y;
      this.forceNextTick(enemy);
    }
  }

  knockbackEnemy(enemyId: string, dx: number, dy: number): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy || floorMotionFor(enemy.getForm()) === 'motion_anchor') return;
    const ai = enemy.ai;
    const sprite = enemy.getSprite();
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    const fraction = bodyDisplacementFraction(this.walk, body.center, body.halfWidth, body.halfHeight, dx, dy);
    const newX = sprite.x + (fraction > 0 ? dx * fraction : 0);
    const newY = sprite.y + (fraction > 0 ? dy * fraction : 0);

    // `Body.reset()` moves both the physics body and its Game Object in one call and
    // zeroes velocity - a plain `sprite.setPosition()` would leave the Arcade body where
    // it was, and the two would fight on the next physics step.
    body.reset(newX, newY);
    ai.position.x = newX;
    ai.position.y = newY;
  }

  // ------------------------------------------------------------------ Slice 4 tool overrides (T7 rewire)

  setEnemyEscalationSuppressed(enemyId: string, suppressed: boolean): void {
    const enemy = this.findEnemy(enemyId);
    if (enemy) enemy.ai.escalationSuppressed = suppressed;
  }

  forceEnemyAlert(enemyId: string): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    if (enemy.ai.state !== AIState.ALERT) transitionTo(enemy, AIState.ALERT, this.context);
  }

  demoteEnemyAlertLevel(enemyId: string): void {
    const enemy = this.findEnemy(enemyId);
    if (!enemy) return;
    switch (enemy.ai.state) {
      case AIState.CHASE:
        transitionTo(enemy, AIState.ALERT, this.context);
        break;
      case AIState.ALERT:
        transitionTo(enemy, AIState.SUSPICIOUS, this.context);
        break;
      case AIState.SUSPICIOUS:
        transitionTo(enemy, AIState.PATROL, this.context);
        break;
      default:
        // PATROL/RETURN: already at the bottom of the ladder.
        break;
    }
  }

  setEnemyDetectionFillRateMult(enemyId: string, mult: number): void {
    const enemy = this.findEnemy(enemyId);
    if (enemy) enemy.ai.detectionFillRateMult = mult;
  }

  setHearingSuppressed(active: boolean): void {
    this.context.hearingSuppressed = active;
  }

  setHearingAvoidedListener(listener: ((enemyId: string) => boolean) | null): void {
    this.hearingAvoidedListener = listener;
  }

  setHearingRangeMultiplier(mult: number): void {
    this.context.hearingRangeMult = mult;
  }

  getHearingRangeMultiplier(): number { return this.context.hearingRangeMult; }

  /** Shared proximity-only muffle policy for sleeping bodies and wall hosts. */
  trySuppressHearingDiscovery(id: string): boolean {
    if (!this.context.hearingSuppressed) return false;
    return this.hearingAvoidedListener?.(id) === true;
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
      ai.pendingNoiseIsLure = false;
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
    const contactIndex = this.contacts.findIndex((contact) => contact.id === enemyId);
    if (contactIndex >= 0) this.contacts.splice(contactIndex, 1);
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
    // A real visible decoy can be noticed even when the player is outside the cone.
    const decoy = this.context.decoyPos;
    if (decoy) {
      this.perception.visible = true;
      this.perception.zone = 'core';
      this.perception.distance = Math.hypot(decoy.x - ai.position.x, decoy.y - ai.position.y);
    }
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
    const profile = enemy.config.profile;
    const sight = enemy.config.sight;
    const hearing = enemy.config.hearing;
    const out = this.perception;

    out.distance = distance;
    out.hearingRate = 0;
    out.hearingRadius = 0;
    out.hearingStill = false;
    out.hearingHit = false;

    const rangeMult = ai.perceptionRangeMult;
    const hearingMult = rangeMult * this.context.hearingRangeMult;
    const chasing = ai.state === AIState.CHASE;
    const sightRange = (chasing ? sight.chaseRange : sight.rangeCore) * rangeMult;
    const hearingBase = (this.playerIsMoving ? profile.hearingRange : profile.hearingStillRange) * hearingMult;
    const rayRange = Math.max(sightRange, hearingBase);

    out.rayCast = rangeMult > 0 && distance <= rayRange;
    out.hasLineOfSight = out.rayCast
      ? hasLineOfSight(this.occluders, ai.position, this.playerPos, rayRange)
      : false;
    if (out.rayCast) this.raysThisFrame++;

    if (distance <= config.ARRIVE_EPSILON) {
      out.zone = 'core';
    } else {
      const bearing = Math.atan2(
        this.playerPos.y - ai.position.y,
        this.playerPos.x - ai.position.x
      );
      const offset = Math.abs(shortestArc(bearing - ai.facingAngle));
      if (offset <= sight.halfAngleCore && distance <= sight.rangeCore * rangeMult) out.zone = 'core';
      else if (offset <= sight.halfAnglePeripheral && distance <= sight.rangePeripheral * rangeMult) {
        out.zone = 'peripheral';
      } else out.zone = 'blind';
    }

    out.visible = chasing
      ? out.hasLineOfSight && distance <= sight.chaseRange * rangeMult
      : out.hasLineOfSight && out.zone !== 'blind';

    const hearingRadius = hearingBase * (out.hasLineOfSight ? 1 : hearing.wallFactor);
    out.hearingRadius = hearingRadius;
    out.hearingStill = !this.playerIsMoving;

    if (hearingBase <= 0 || !out.rayCast || distance > hearingRadius) {
      return;
    }

    if (profile.hearingWeight <= 0) {
      // Infiltrator: binary nominate only. Standing still never hits.
      out.hearingHit = this.playerIsMoving;
      return;
    }

    const loudness = this.playerIsMoving ? profile.hearingMoveMult : 1;
    const distFactorHear = lerp(
      config.DETECT_DIST_FACTOR_NEAR,
      config.DETECT_DIST_FACTOR_FAR,
      clamp(distance / Math.max(hearingRadius, 1), 0, 1)
    );
    out.hearingRate = (1 / config.HEAR_FILL_TIME) * distFactorHear * profile.hearingWeight * loudness;
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
      random: this.recoveryRandom ? () => this.recoveryRandom!.next() : undefined,
      occluders: this.occluders,
      movementOccluders: this.movementOccluders,
      pathfinder: this.pathfinder,
      enemies: this.enemies,
      playerPos: this.playerPos,
      playerVel: this.playerVel,
      playerIsMoving: false,
      dtMs: 0,
      decoyPos: null,
      hearingSuppressed: false,
      hearingRangeMult: 1.0,
      onHearingAvoided: (enemy) => this.hearingAvoidedListener?.(enemy.id) === true,
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

    const enemy = createEnemy(this.scene, spawn, createEnemyTypeConfig(spawn.type, spawn.form), this.scratch, {
      depth: ENEMY_DEPTH,
    });

    // Stagger the perception phase so several enemies never raycast on the same frame.
    enemy.ai.perceptionAccumMs = total > 0 ? (index * GAME_CONSTANTS.AI.PERCEPTION_TICK_MS) / total : 0;
    Object.assign(enemy.ai, createPatrolConfiguration(spawn, this.scratch, tileSize, this.pathfinder, this.context.warn));
    if (floorMotionFor(enemy.getForm()) !== 'motion_patrol') return enemy;
    this.startPatrolLeg(enemy);
    return enemy;
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
