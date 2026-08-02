/**
 * Enemy entity and factory (Slice 1: the infiltrator only).
 *
 * The entity owns what the player sees - body sprite, physics collider, state indicator,
 * chase afterimages - and carries the mutable `ai` state block that the AI system, its
 * FSM and its behaviours write. Splitting it that way keeps presentation decisions out of
 * the state machine while leaving exactly one object per enemy to create and destroy.
 *
 * Readability is a gameplay requirement here, not decoration (docs/specs/system-enemy-ai.md
 * rule R0): if the player cannot tell patrolling from searching from locked-on, the
 * "sneak around or risk it" decision has nothing to stand on. Hence the placeholder body
 * is a pentagon rather than a blob (facing must be readable at 24 px), state is carried by
 * teal indicators rather than by body colour (dark red encodes the *tier*, art-direction
 * 12), and the indicator language is "blinking = looking for you / steady = it has you".
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { AIState, type Facing4, type Vector2 } from '@/types/game-types';
import type { EnemySpawnData } from '@/types/map-types';
import type { EnemyAIState, EnemyView, InfiltratorConfig } from '@/types/ai-types';
import { clamp, degToRad, lerp, quantizeFacing4 } from '@/utils/math';

/**
 * Body silhouette texture. Exported because combat draws its white hit/death flashes as
 * tint-filled copies of this same sprite, which is the only way the flash covers exactly
 * the shape the player is looking at.
 */
export const ENEMY_BODY_TEXTURE = 'placeholder-enemy';

const TEXTURE_BODY = ENEMY_BODY_TEXTURE;
const TEXTURE_DOT = 'placeholder-enemy-dot';
const TEXTURE_LOCK = 'placeholder-enemy-lock';

/** Height (px) of the indicator above the body centre. */
const INDICATOR_OFFSET_Y = -18;
/** Horizontal spread of the two ALERT dots. */
const INDICATOR_DOT_SPREAD = 5;

export interface EnemyFactoryConfig {
  /** Render depth of the body. Indicators sit one above, afterimages one below. */
  readonly depth: number;
}

/** Slice 1 has one enemy type; its numbers come straight from the tuning table. */
export function createInfiltratorConfig(): InfiltratorConfig {
  const ai = GAME_CONSTANTS.AI;
  return {
    type: 'infiltrator',
    bodySize: ai.BODY_SIZE,
    speeds: {
      [AIState.PATROL]: ai.PATROL_SPEED,
      [AIState.SUSPICIOUS]: ai.SUSPICIOUS_SPEED,
      [AIState.ALERT]: ai.ALERT_SPEED,
      [AIState.CHASE]: ai.CHASE_SPEED,
      [AIState.RETURN]: ai.RETURN_SPEED,
    },
    sight: {
      rangeCore: ai.SIGHT_RANGE,
      halfAngleCore: degToRad(ai.SIGHT_HALF_ANGLE_CORE),
      rangePeripheral: ai.SIGHT_RANGE_PERIPH,
      halfAnglePeripheral: degToRad(ai.SIGHT_HALF_ANGLE_PERIPH),
      chaseRange: ai.CHASE_SIGHT_RANGE,
    },
    hearing: {
      range: ai.HEARING_RANGE,
      wallFactor: ai.HEARING_WALL_FACTOR,
      posJitter: ai.HEARING_JITTER,
    },
  };
}

export class Enemy implements EnemyView {
  readonly id: string;
  readonly spawnData: EnemySpawnData;
  readonly config: InfiltratorConfig;
  readonly ai: EnemyAIState;

  private readonly body: Phaser.Physics.Arcade.Image;
  private readonly dots: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private readonly lock: Phaser.GameObjects.Image;
  /** Ring buffer of chase trails; sized so it never has to grow (rule R2). */
  private readonly afterimages: Phaser.GameObjects.Image[] = [];
  private readonly afterimageLifeMs: number[] = [];
  private afterimageSlot = 0;
  private afterimageTimerMs = 0;

  /** Integrated indicator animation phase, so a frequency change never jumps the alpha. */
  private indicatorPhase = 0;

  constructor(
    scene: Phaser.Scene,
    spawnData: EnemySpawnData,
    config: InfiltratorConfig,
    spawnPosition: Readonly<Vector2>,
    factoryConfig: EnemyFactoryConfig
  ) {
    this.id = spawnData.id;
    this.spawnData = spawnData;
    this.config = config;
    this.ai = createEnemyAIState(spawnPosition, degToRad(spawnData.facing));

    const ai = GAME_CONSTANTS.AI;
    const depth = factoryConfig.depth;

    this.body = scene.physics.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_BODY);
    this.body.setDepth(depth);
    this.body.setRotation(this.ai.facingAngle);
    this.body.setName(spawnData.id);

    const physicsBody = this.body.body as Phaser.Physics.Arcade.Body;
    physicsBody.setSize(config.bodySize, config.bodySize, false);
    physicsBody.setOffset(ai.BODY_OFFSET.x, ai.BODY_OFFSET.y);
    physicsBody.setCollideWorldBounds(true);

    this.dots = [
      scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_DOT).setDepth(depth + 1),
      scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_DOT).setDepth(depth + 1),
    ];
    this.lock = scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_LOCK).setDepth(depth + 1);

    for (let i = 0; i < ai.AFTERIMAGE_SLOTS; i++) {
      const trail = scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_BODY);
      trail.setDepth(depth - 1).setVisible(false).setAlpha(ai.AFTERIMAGE_ALPHA);
      this.afterimages.push(trail);
      this.afterimageLifeMs.push(0);
    }

    this.hideIndicators();
  }

  // ------------------------------------------------------------------ EnemyView

  getId(): string {
    return this.id;
  }

  getPosition(): Readonly<Vector2> {
    return this.ai.position;
  }

  getFacingAngle(): number {
    return this.ai.facingAngle;
  }

  getFacing4(): Facing4 {
    return this.ai.facing4;
  }

  getState(): AIState {
    return this.ai.state;
  }

  isEngaged(): boolean {
    return this.ai.engaged;
  }

  getDetection(): number {
    return this.ai.detection;
  }

  // ------------------------------------------------------------------ physics

  getSprite(): Phaser.Physics.Arcade.Image {
    return this.body;
  }

  /** Copies the resolved body position into the AI state. Call before reading it. */
  syncPositionFromBody(): void {
    this.ai.position.x = this.body.x;
    this.ai.position.y = this.body.y;
  }

  setVelocity(x: number, y: number): void {
    this.ai.velocity.x = x;
    this.ai.velocity.y = y;
    (this.body.body as Phaser.Physics.Arcade.Body).velocity.set(x, y);
  }

  /** Distance actually covered since the last call - the input to the stuck watchdog. */
  measureDisplacement(): number {
    const deltaX = this.body.x - this.ai.position.x;
    const deltaY = this.body.y - this.ai.position.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  // ------------------------------------------------------------------ presentation

  /**
   * Updates everything the player sees. `visibility` is the alpha the field of view allows
   * at this position: 0 means the enemy is not drawn at all, indicators included (rule R4).
   * Knowing where an enemy is stays something the player has to pay attention to earn.
   */
  syncVisuals(deltaMs: number, visibility: number): void {
    const ai = GAME_CONSTANTS.AI;
    const dt = deltaMs / 1000;

    this.body.setPosition(this.ai.position.x, this.ai.position.y);
    this.body.setRotation(this.ai.facingAngle);

    this.stepAfterimages(deltaMs, visibility);

    if (visibility <= 0) {
      this.body.setVisible(false);
      this.hideIndicators();
      return;
    }

    this.body.setVisible(true);
    this.body.setAlpha(visibility);

    const indicatorY = this.ai.position.y + INDICATOR_OFFSET_Y;
    switch (this.ai.state) {
      case AIState.SUSPICIOUS: {
        // Breathing faster as it grows more certain: the player can see the warning window
        // closing and judge whether there is still time to duck back (rule R3).
        const certainty = clamp(
          (this.ai.detection - ai.SUSPICION_THRESHOLD) / (1 - ai.SUSPICION_THRESHOLD),
          0,
          1
        );
        const hz = lerp(ai.SUSPICIOUS_BREATH_HZ_MIN, ai.SUSPICIOUS_BREATH_HZ_MAX, certainty);
        this.indicatorPhase += hz * dt;
        const breath = 0.75 + 0.25 * Math.sin(this.indicatorPhase * Math.PI * 2);
        this.showDots(1, this.ai.position.x, indicatorY, breath * visibility);
        this.lock.setVisible(false);
        break;
      }
      case AIState.ALERT: {
        this.indicatorPhase += ai.ALERT_BLINK_HZ * dt;
        const on = this.indicatorPhase % 1 < 0.5;
        this.showDots(2, this.ai.position.x, indicatorY, (on ? 1 : 0.1) * visibility);
        this.lock.setVisible(false);
        break;
      }
      case AIState.CHASE: {
        this.indicatorPhase = 0;
        this.dots[0].setVisible(false);
        this.dots[1].setVisible(false);
        this.lock.setVisible(true).setPosition(this.ai.position.x, indicatorY).setAlpha(visibility);
        break;
      }
      default:
        this.indicatorPhase = 0;
        this.hideIndicators();
        break;
    }
  }

  destroy(): void {
    for (const trail of this.afterimages) trail.destroy();
    this.afterimages.length = 0;
    this.afterimageLifeMs.length = 0;
    this.dots[0].destroy();
    this.dots[1].destroy();
    this.lock.destroy();
    this.body.destroy();
  }

  // ------------------------------------------------------------------ internals

  private showDots(count: number, x: number, y: number, alpha: number): void {
    const spread = count > 1 ? INDICATOR_DOT_SPREAD : 0;
    this.dots[0].setVisible(true).setPosition(x - spread, y).setAlpha(alpha);
    this.dots[1].setVisible(count > 1).setPosition(x + spread, y).setAlpha(alpha);
  }

  private hideIndicators(): void {
    this.dots[0].setVisible(false);
    this.dots[1].setVisible(false);
    this.lock.setVisible(false);
  }

  /**
   * Chase leaves a short trail: motion the player can read from the corner of the screen
   * without having to resolve the sprite. Fixed ring buffer, so nothing is allocated.
   */
  private stepAfterimages(deltaMs: number, visibility: number): void {
    const ai = GAME_CONSTANTS.AI;

    for (let i = 0; i < this.afterimages.length; i++) {
      const life = this.afterimageLifeMs[i]!;
      if (life <= 0) continue;
      const remaining = life - deltaMs;
      this.afterimageLifeMs[i] = remaining;
      const trail = this.afterimages[i]!;
      if (remaining <= 0 || visibility <= 0) {
        trail.setVisible(false);
        this.afterimageLifeMs[i] = 0;
        continue;
      }
      const fade = remaining / ai.AFTERIMAGE_LIFETIME_MS;
      trail.setAlpha(ai.AFTERIMAGE_ALPHA * fade * visibility);
    }

    if (this.ai.state !== AIState.CHASE || visibility <= 0) {
      this.afterimageTimerMs = 0;
      return;
    }

    this.afterimageTimerMs += deltaMs;
    if (this.afterimageTimerMs < ai.AFTERIMAGE_INTERVAL_MS) return;
    this.afterimageTimerMs = 0;

    const slot = this.afterimageSlot;
    this.afterimageSlot = (slot + 1) % this.afterimages.length;
    this.afterimages[slot]!
      .setPosition(this.ai.position.x, this.ai.position.y)
      .setRotation(this.ai.facingAngle)
      .setAlpha(ai.AFTERIMAGE_ALPHA * visibility)
      .setVisible(true);
    this.afterimageLifeMs[slot] = ai.AFTERIMAGE_LIFETIME_MS;
  }
}

/**
 * Creates one infiltrator at `spawnPosition` (already validated as walkable by the
 * caller, which also owns the "spawn is inside a wall" recovery).
 */
export function createInfiltrator(
  scene: Phaser.Scene,
  spawnData: EnemySpawnData,
  config: InfiltratorConfig,
  spawnPosition: Readonly<Vector2>,
  factoryConfig: EnemyFactoryConfig
): Enemy {
  return new Enemy(scene, spawnData, config, spawnPosition, factoryConfig);
}

/** All runtime fields at their patrol-from-scratch values, with buffers pre-allocated. */
function createEnemyAIState(spawnPosition: Readonly<Vector2>, facingAngle: number): EnemyAIState {
  const searchPoints: Vector2[] = [];
  for (let i = 0; i < 3; i++) searchPoints.push({ x: 0, y: 0 });

  const dynamicPath: Vector2[] = [];
  for (let i = 0; i < GAME_CONSTANTS.AI.MAX_PATH_POINTS; i++) dynamicPath.push({ x: 0, y: 0 });

  return {
    state: AIState.PATROL,
    position: { x: spawnPosition.x, y: spawnPosition.y },
    velocity: { x: 0, y: 0 },
    facingAngle,
    facing4: quantizeFacing4(facingAngle, 'right', 0),

    detection: 0,
    lastSeenPlayerPos: null,
    lastSeenPlayerVel: null,
    losGraceMs: 0,
    perceptionAccumMs: 0,

    suspicionTimerMs: 0,
    searchTimerMs: 0,
    waypointPauseMs: 0,
    suspiciousTurnHoldMs: 0,
    searchHoldMs: 0,
    scanPhaseMs: 0,
    scanIndex: 0,
    scanBaseAngle: facingAngle,

    investigatePos: null,
    searchPoints,
    searchPointCount: 0,
    searchIndex: 0,
    patrolIndex: 0,
    patrolDir: 1,
    patrolMode: 'static',

    pathPoints: null,
    pathLength: 0,
    pathCursor: 0,
    dynamicPath,
    patrolWaypoints: [],
    patrolPaths: [],
    currentPatrolLeg: null,
    repathCooldownMs: 0,
    pathRequestPending: false,
    pathRequestTarget: { x: 0, y: 0 },
    pathTargetAtRequest: { x: 0, y: 0 },
    pathRequestAgeMs: 0,
    pathFailCount: 0,
    preferPathMs: 0,
    stuckMs: 0,

    engaged: false,
    alertEmitCooldownMs: 0,
    lastEmittedLevel: 'none',
    alertEpisodeActive: false,

    pendingDamage: false,
    pendingDamagePos: { x: 0, y: 0 },
    pendingNoiseLevel: null,
    pendingNoisePos: { x: 0, y: 0 },
  };
}