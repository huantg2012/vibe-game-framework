/**
 * Enemy entity and factory. One class, two perception profiles.
 *
 * The entity owns what the player sees and carries the mutable `ai` state block.
 * Role is frozen from the CSV row at spawn. Both roles paint upright
 * procedural pixels (DEC-066 — not a temporary sheet). facingAngle is for
 * perception only; the GameObject never rotates.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { ENEMY_DATA, type EnemyRole } from '@/generated/enemy-data';
import { BEHAVIOR_PROFILE_DATA } from '@/generated/contamination-capability-data';
import { BODY_PROFILE_DATA } from '@/generated/contamination-body-data';
import { ActivityClock, type ActivityVisualState } from '@/systems/ai/activity-state';
import { INFILTRATOR_FORM, REWRITER_FORM, type ContaminationForm } from '@/generation/contamination-draw';
import { AIState, type Facing4, type Vector2 } from '@/types/game-types';
import type { EnemySpawnData } from '@/types/map-types';
import type { EnemyAIState, EnemyTypeConfig, EnemyView } from '@/types/ai-types';
import {
  INFILTRATOR_TEXTURE,
  INFILTRATOR_TEXTURE_DEFAULT,
  infiltratorMotionTexture,
} from '@/entities/infiltrator-sprite';
import { FacingLagGhost, isActorWalking, pingPongFrame } from '@/entities/actor-motion';
import {
  ContamFlakes,
  ContamStain,
  INFILTRATOR_FLAKE_TUNE,
  REWRITER_FLAKE_TUNE,
} from '@/entities/contam-flakes';
import { INFILTRATOR_FLAKE_LOCAL } from '@/entities/infiltrator-sprite';
import {
  REWRITER_CANVAS_H,
  REWRITER_CANVAS_W,
  REWRITER_ORIGIN_X,
  REWRITER_ORIGIN_Y,
  REWRITER_RIGHT,
  rewriterTextureFor,
  rewriterFlakeLocals,
} from '@/entities/rewriter-sprite';
import { clamp, degToRad, lerp, quantizeFacing4 } from '@/utils/math';

/**
 * Body silhouette texture. Exported because combat draws its white hit/death flashes as
 * tint-filled copies of this same sprite, which is the only way the flash covers exactly
 * the shape the player is looking at.
 */
export const ENEMY_BODY_TEXTURE = INFILTRATOR_TEXTURE_DEFAULT;

const TEXTURE_DOT = 'placeholder-enemy-dot';
const TEXTURE_LOCK = 'placeholder-enemy-lock';

const INFILTRATOR_INDICATOR_Y = -22;
const REWRITER_INDICATOR_Y = -24;
// I17's upright sprite extends 37px above its foot anchor; leave clear space above it.
const HUMAN_INDICATOR_Y = -44;
const INDICATOR_DOT_SPREAD = 5;

const REWRITER_AFTERIMAGE_INTERVAL_MS = 55;
const REWRITER_AFTERIMAGE_LIFETIME_MS = 240;
const REWRITER_AFTERIMAGE_ALPHA = 0.28;
const REWRITER_AFTERIMAGE_SLOTS = 5;
const REWRITER_PATROL_PULSE_MS = 2000;
const REWRITER_CHASE_JITTER_FRAMES = 8;
const INFILTRATOR_HITCH_PLANT_MS = 220;
const INFILTRATOR_HITCH_LUNGE_MS = 220;
const REWRITER_HITCH_PLANT_MS = 280;
const REWRITER_HITCH_LUNGE_MS = 240;
const HITCH_PLANT_MULT = 0.2;
const HITCH_LUNGE_MULT = 1.8;

export interface EnemyFactoryConfig {
  /** Render depth of the body. Indicators sit one above, afterimages one below. */
  readonly depth: number;
}

export function createEnemyTypeConfig(role: EnemyRole, form?: ContaminationForm): EnemyTypeConfig {
  const profile = ENEMY_DATA[role];
  const narrow = form?.lexemes.sense === 'sense_narrow' ? BEHAVIOR_PROFILE_DATA.sense_narrow : undefined;
  const moveScale = form ? BODY_PROFILE_DATA[form.substrate]?.moveScale ?? 1 : 1;
  const ai = GAME_CONSTANTS.AI;
  return {
    role,
    profile,
    bodySize: ai.BODY_SIZE,
    speeds: {
      [AIState.PATROL]: profile.patrolSpeed * moveScale,
      [AIState.SUSPICIOUS]: profile.suspiciousSpeed * moveScale,
      [AIState.ALERT]: profile.alertSpeed * moveScale,
      [AIState.CHASE]: profile.chaseSpeed * moveScale,
      [AIState.RETURN]: profile.returnSpeed * moveScale,
    },
    sight: {
      rangeCore: profile.sightRange * (narrow?.rangeScale ?? 1),
      halfAngleCore: degToRad(narrow ? narrow.coneDeg / 2 : profile.sightHalfAngleCore),
      rangePeripheral: narrow ? 0 : profile.sightRangePeriph,
      halfAnglePeripheral: narrow ? 0 : degToRad(profile.sightHalfAnglePeriph),
      chaseRange: profile.chaseSightRange * (narrow?.rangeScale ?? 1),
    },
    hearing: {
      range: profile.hearingRange,
      wallFactor: profile.hearingWallFactor,
      posJitter: ai.HEARING_JITTER,
    },
  };
}

/** @deprecated Use createEnemyTypeConfig('infiltrator'). */
export function createInfiltratorConfig(): EnemyTypeConfig {
  return createEnemyTypeConfig('infiltrator');
}

export class Enemy implements EnemyView {
  readonly id: string;
  readonly spawnData: EnemySpawnData;
  readonly config: EnemyTypeConfig;
  readonly ai: EnemyAIState;
  private readonly form: ContaminationForm;

  private readonly body: Phaser.Physics.Arcade.Image;
  private readonly dots: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private readonly lock: Phaser.GameObjects.Image;
  private readonly afterimages: Phaser.GameObjects.Image[] = [];
  private readonly afterimageLifeMs: number[] = [];
  private afterimageSlot = 0;
  private afterimageTimerMs = 0;
  private indicatorPhase = 0;
  private rewriterPulseMs = 0;
  private chaseFrame = 0;
  private motionElapsedMs = 0;
  private hitchMs = 0;
  private hitchDeltaMs = 16;
  private hitchWasLunge = false;
  private pendingFlakeBurst = false;
  private shownFacing: Facing4 = 'right';
  private readonly lag: FacingLagGhost;
  private readonly flakes: ContamFlakes;
  private readonly stain: ContamStain | null;
  /** Hide stand-in body when scheme D (or a gym candidate) is attached. Arcade + AI stay. */
  private visualSuppressed = false;
  private locomotionMode: 'legacy-hitch' | 'continuous' = 'legacy-hitch';
  private readonly actualVelocity: Vector2 = { x: 0, y: 0 };
  private readonly activity: ActivityClock;
  private attackCommitted = false;
  activityHearingAccumMs = 0;

  getActivityVisualState(): Readonly<ActivityVisualState> { return this.activity.visual; }
  isAttackAvailable(): boolean { return this.activity.visual.phase === 'active'; }
  setAttackCommitted(committed: boolean): void { this.attackCommitted = committed; }
  canAct(): boolean { return this.isAttackAvailable() || this.attackCommitted; }
  tickActivity(deltaMs: number, stimulus: boolean): void {
    this.activity.tick(deltaMs, stimulus, this.ai.state === AIState.PATROL);
  }

  /** Renderer attachment selects whether its gait still depends on the old stop/lunge carrier. */
  setLocomotionMode(mode: 'legacy-hitch' | 'continuous'): void {
    this.locomotionMode = mode;
    this.hitchMs = 0;
    this.hitchWasLunge = false;
  }

  /** Achieved physics motion; excludes contact correction and blocked movement intent. */
  getActualVelocity(): Readonly<Vector2> {
    return this.actualVelocity;
  }

  measureActualVelocity(deltaMs: number): void {
    const scale = deltaMs > 0 ? 1000 / deltaMs : 0;
    this.actualVelocity.x = (this.body.x - this.ai.position.x) * scale;
    this.actualVelocity.y = (this.body.y - this.ai.position.y) * scale;
  }

  constructor(
    scene: Phaser.Scene,
    spawnData: EnemySpawnData,
    config: EnemyTypeConfig,
    spawnPosition: Readonly<Vector2>,
    factoryConfig: EnemyFactoryConfig
  ) {
    this.id = spawnData.id;
    this.spawnData = spawnData;
    this.config = config;
    this.form =
      spawnData.form ?? (config.role === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM);
    this.activity = new ActivityClock(this.form.lexemes.rhythm, `${spawnData.id}:${spawnPosition.x}:${spawnPosition.y}`);
    this.ai = createEnemyAIState(spawnPosition, degToRad(spawnData.facing), config.role);

    const ai = GAME_CONSTANTS.AI;
    const depth = factoryConfig.depth;
    const rewriter = config.role === 'rewriter';
    const startKey = rewriter
      ? rewriterTextureFor(this.ai.facing4, 'patrol')
      : INFILTRATOR_TEXTURE[this.ai.facing4];

    this.body = scene.physics.add.image(spawnPosition.x, spawnPosition.y, startKey);
    this.body.setDepth(depth);
    this.body.setName(spawnData.id);
    if (rewriter) {
      this.body.setOrigin(REWRITER_ORIGIN_X / REWRITER_CANVAS_W, REWRITER_ORIGIN_Y / REWRITER_CANVAS_H);
    }
    freezeActorRotation(this.body);

    const originX = rewriter ? REWRITER_ORIGIN_X / REWRITER_CANVAS_W : 0.5;
    const originY = rewriter ? REWRITER_ORIGIN_Y / REWRITER_CANVAS_H : 0.5;
    this.shownFacing = this.ai.facing4;
    this.lag = new FacingLagGhost(scene, startKey, depth - 1, originX, originY);
    this.flakes = new ContamFlakes(
      scene,
      (facing) => (rewriter ? rewriterFlakeLocals(facing) : INFILTRATOR_FLAKE_LOCAL[facing]!),
      {
        ...(rewriter ? REWRITER_FLAKE_TUNE : INFILTRATOR_FLAKE_TUNE),
        depth: depth + 2,
      }
    );
    this.stain = rewriter ? new ContamStain(scene, depth - 2) : null;

    const physicsBody = this.body.body as Phaser.Physics.Arcade.Body;
    physicsBody.setSize(config.bodySize, config.bodySize, false);
    if (rewriter) {
      physicsBody.setOffset(REWRITER_ORIGIN_X - config.bodySize / 2, REWRITER_ORIGIN_Y - config.bodySize / 2);
    } else {
      physicsBody.setOffset(ai.BODY_OFFSET.x, ai.BODY_OFFSET.y);
    }
    physicsBody.setCollideWorldBounds(true);
    physicsBody.setImmovable(this.isStaticObstacle());

    this.dots = [
      scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_DOT).setDepth(depth + 1),
      scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_DOT).setDepth(depth + 1),
    ];
    this.lock = scene.add.image(spawnPosition.x, spawnPosition.y, TEXTURE_LOCK).setDepth(depth + 1);

    const slots = rewriter ? REWRITER_AFTERIMAGE_SLOTS : ai.AFTERIMAGE_SLOTS;
    for (let i = 0; i < slots; i++) {
      const trail = scene.add.image(spawnPosition.x, spawnPosition.y, startKey);
      trail.setDepth(depth - 1).setVisible(false);
      if (rewriter) {
        trail.setOrigin(REWRITER_ORIGIN_X / REWRITER_CANVAS_W, REWRITER_ORIGIN_Y / REWRITER_CANVAS_H);
      }
      trail.setRotation(0);
      this.afterimages.push(trail);
      this.afterimageLifeMs.push(0);
    }

    this.hideIndicators();
  }

  getId(): string {
    return this.id;
  }

  getRole(): EnemyRole {
    return this.config.role;
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

  /** Only zero-speed physical substrates block the player; mobile enemies remain soft contacts. */
  isStaticObstacle(): boolean {
    return this.form.occupancy === 'floor' && BODY_PROFILE_DATA[this.form.substrate]?.moveScale === 0;
  }

  /** Detection indicators remain above ground-sorted bodies and below fog. */
  setReadoutDepth(depth: number): void {
    for (const dot of this.dots) dot.setDepth(depth);
    this.lock.setDepth(depth);
  }

  getForm(): ContaminationForm {
    return this.form;
  }

  /**
   * Hide the stand-in body (image / afterimages / flakes / stain).
   * Keeps Arcade collision, AI, and teal state indicators.
   */
  setVisualSuppressed(suppressed: boolean): void {
    this.visualSuppressed = suppressed;
    if (!suppressed) return;
    this.hideStandInBody();
  }

  isTargetingDecoy(): boolean {
    return this.ai.targetingDecoy;
  }

  getSprite(): Phaser.Physics.Arcade.Image {
    return this.body;
  }

  syncPositionFromBody(): void {
    this.ai.position.x = this.body.x;
    this.ai.position.y = this.body.y;
  }

  /** Call once per AI tick before setVelocity so puppet hitch uses this frame's delta. */
  tickGait(deltaMs: number): void {
    this.hitchDeltaMs = deltaMs;
  }

  setVelocity(x: number, y: number): void {
    this.ai.velocity.x = x;
    this.ai.velocity.y = y;
    const moving = Math.hypot(x, y) >= GAME_CONSTANTS.ACTOR_MOTION.MOVE_SPEED_FLOOR;
    const chase = this.ai.state === AIState.CHASE;
    if (!moving || chase || this.locomotionMode === 'continuous') {
      this.hitchMs = 0;
      this.hitchWasLunge = false;
      (this.body.body as Phaser.Physics.Arcade.Body).velocity.set(x, y);
      return;
    }

    this.hitchMs += this.hitchDeltaMs;
    const lunge = this.hitchIsLunge();
    if (lunge && !this.hitchWasLunge) this.pendingFlakeBurst = true;
    this.hitchWasLunge = lunge;
    const mult = lunge ? HITCH_LUNGE_MULT : HITCH_PLANT_MULT;
    (this.body.body as Phaser.Physics.Arcade.Body).velocity.set(x * mult, y * mult);
  }

  measureDisplacement(): number {
    const deltaX = this.body.x - this.ai.position.x;
    const deltaY = this.body.y - this.ai.position.y;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  syncVisuals(deltaMs: number, visibility: number): void {
    const ai = GAME_CONSTANTS.AI;
    const dt = deltaMs / 1000;
    const rewriter = this.config.role === 'rewriter';

    this.body.setPosition(this.ai.position.x, this.ai.position.y);
    this.stepGait(deltaMs);
    freezeActorRotation(this.body);

    if (this.visualSuppressed) {
      this.hideStandInBody();
    } else {
      if (rewriter) {
        this.applyRewriterBody(deltaMs, visibility);
      } else {
        this.applyInfiltratorBody();
      }
      this.lag.sync(this.body.x, this.body.y, visibility > 0, deltaMs);

      this.stepAfterimages(deltaMs, visibility);
      this.flakes.sync(
        this.body.x,
        this.body.y,
        this.ai.facing4,
        this.ai.state,
        visibility,
        deltaMs
      );
      if (this.pendingFlakeBurst) {
        this.pendingFlakeBurst = false;
        this.flakes.burst(
          this.body.x,
          this.body.y,
          this.ai.facing4,
          visibility,
          rewriter ? 2 : 3
        );
      }
      this.stain?.sync(this.body.x, this.body.y, visibility, deltaMs);
    }

    if (visibility <= 0) {
      if (!this.visualSuppressed) this.body.setVisible(false);
      this.hideIndicators();
      return;
    }

    if (!this.visualSuppressed) {
      this.body.setVisible(true);
      if (!rewriter) this.body.setAlpha(visibility);
    }

    const indicatorY = this.ai.position.y + (this.visualSuppressed && this.form.substrate === 'human_remnant'
      ? HUMAN_INDICATOR_Y : rewriter ? REWRITER_INDICATOR_Y : INFILTRATOR_INDICATOR_Y);
    switch (this.ai.state) {
      case AIState.SUSPICIOUS: {
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
    this.lag.destroy();
    this.flakes.destroy();
    this.stain?.destroy();
    this.body.destroy();
  }

  private stepGait(deltaMs: number): void {
    this.motionElapsedMs += deltaMs;
    if (this.ai.facing4 !== this.shownFacing) {
      this.lag.trigger(this.shownFacing, this.body.texture.key);
      this.shownFacing = this.ai.facing4;
    }
  }

  private currentGait(): { gait: 'idle' | 'walk'; frame: number } {
    const speed = Math.hypot(this.ai.velocity.x, this.ai.velocity.y);
    const walking = isActorWalking(speed);
    const turning = this.lag.isTurning;
    const gait = walking || turning ? 'walk' : 'idle';
    const rewriter = this.config.role === 'rewriter';
    const fps = rewriter
      ? gait === 'walk'
        ? GAME_CONSTANTS.ACTOR_MOTION.REWRITER_WALK_FPS
        : GAME_CONSTANTS.ACTOR_MOTION.REWRITER_IDLE_FPS
      : gait === 'walk'
        ? GAME_CONSTANTS.ACTOR_MOTION.INFILTRATOR_WALK_FPS
        : GAME_CONSTANTS.ACTOR_MOTION.INFILTRATOR_IDLE_FPS;
    let frame = pingPongFrame(this.motionElapsedMs, fps);
    if (turning) frame = GAME_CONSTANTS.ACTOR_MOTION.FRAME_COUNT - 1;
    else if (walking && this.ai.state !== AIState.CHASE) {
      frame = this.hitchIsLunge() ? 1 : 3;
    }
    return { gait, frame };
  }

  private hitchIsLunge(): boolean {
    const rewriter = this.config.role === 'rewriter';
    const plant = rewriter ? REWRITER_HITCH_PLANT_MS : INFILTRATOR_HITCH_PLANT_MS;
    const lunge = rewriter ? REWRITER_HITCH_LUNGE_MS : INFILTRATOR_HITCH_LUNGE_MS;
    const cycle = plant + lunge;
    if (cycle <= 0) return false;
    return this.hitchMs % cycle >= plant;
  }

  private applyInfiltratorBody(): void {
    const { gait, frame } = this.currentGait();
    const key = infiltratorMotionTexture(this.ai.facing4, gait, frame);
    if (this.body.texture.key !== key) this.body.setTexture(key);
  }

  private applyRewriterBody(deltaMs: number, visibility: number): void {
    const facing = this.ai.facing4;
    const { gait, frame } = this.currentGait();
    let variant: 'patrol' | 'suspicious' | 'search' | 'chase' = 'patrol';
    if (this.ai.state === AIState.CHASE) variant = 'chase';
    else if (this.ai.state === AIState.ALERT) variant = 'search';
    else if (this.ai.state === AIState.SUSPICIOUS) variant = 'suspicious';

    let key = rewriterTextureFor(facing, variant, gait, frame);
    if (variant === 'search') {
      // Phase advances once, in the ALERT indicator branch (ALERT_BLINK_HZ = 3).
      // Do not add another 3 Hz here — that stacked to ~6 Hz.
      const bright = this.indicatorPhase % 1 < 0.5;
      if (!bright) key = rewriterTextureFor(facing, 'patrol', gait, frame);
    }

    if (this.body.texture.key !== key) this.body.setTexture(key);

    let alpha = visibility;
    if (this.ai.state === AIState.PATROL || this.ai.state === AIState.RETURN) {
      this.rewriterPulseMs = (this.rewriterPulseMs + deltaMs) % REWRITER_PATROL_PULSE_MS;
      const wave = 0.5 + 0.5 * Math.sin((this.rewriterPulseMs / REWRITER_PATROL_PULSE_MS) * Math.PI * 2);
      alpha *= lerp(0.8, 1, wave);
    } else if (this.ai.state === AIState.ALERT) {
      const bright = this.indicatorPhase % 1 < 0.5;
      alpha *= bright ? 1 : 0.55;
    }

    this.body.setAlpha(visibility <= 0 ? 0 : alpha);

    if (this.ai.state === AIState.CHASE && visibility > 0) {
      this.chaseFrame += 1;
      const jitter = this.chaseFrame % REWRITER_CHASE_JITTER_FRAMES === 0;
      const right = REWRITER_RIGHT[facing];
      this.body.setPosition(
        this.ai.position.x + (jitter ? right.x : 0),
        this.ai.position.y + (jitter ? right.y : 0)
      );
    } else {
      this.chaseFrame = 0;
    }
  }

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

  private hideStandInBody(): void {
    this.body.setVisible(false);
    this.lag.sync(this.body.x, this.body.y, false, 0);
    this.pendingFlakeBurst = false;
    this.flakes.sync(this.body.x, this.body.y, this.ai.facing4, this.ai.state, 0, 0);
    this.stain?.sync(this.body.x, this.body.y, 0, 0);
    for (let i = 0; i < this.afterimages.length; i++) {
      this.afterimages[i]!.setVisible(false);
      this.afterimageLifeMs[i] = 0;
    }
  }

  private stepAfterimages(deltaMs: number, visibility: number): void {
    const ai = GAME_CONSTANTS.AI;
    const rewriter = this.config.role === 'rewriter';
    const interval = rewriter ? REWRITER_AFTERIMAGE_INTERVAL_MS : ai.AFTERIMAGE_INTERVAL_MS;
    const lifetime = rewriter ? REWRITER_AFTERIMAGE_LIFETIME_MS : ai.AFTERIMAGE_LIFETIME_MS;
    const trailAlpha = rewriter ? REWRITER_AFTERIMAGE_ALPHA : ai.AFTERIMAGE_ALPHA;

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
      const fade = remaining / lifetime;
      trail.setAlpha(trailAlpha * fade * visibility);
    }

    if (this.ai.state !== AIState.CHASE || visibility <= 0) {
      this.afterimageTimerMs = 0;
      return;
    }

    this.afterimageTimerMs += deltaMs;
    if (this.afterimageTimerMs < interval) return;
    this.afterimageTimerMs = 0;

    const slot = this.afterimageSlot;
    this.afterimageSlot = (slot + 1) % this.afterimages.length;
    const trail = this.afterimages[slot]!;
    const key = rewriter
      ? rewriterTextureFor(this.ai.facing4, 'chase')
      : INFILTRATOR_TEXTURE[this.ai.facing4];
    if (trail.texture.key !== key) trail.setTexture(key);
    trail
      .setPosition(this.ai.position.x, this.ai.position.y)
      .setRotation(0)
      .setAlpha(trailAlpha * visibility)
      .setVisible(true);
    this.afterimageLifeMs[slot] = lifetime;
  }
}

export function createEnemy(
  scene: Phaser.Scene,
  spawnData: EnemySpawnData,
  config: EnemyTypeConfig,
  spawnPosition: Readonly<Vector2>,
  factoryConfig: EnemyFactoryConfig
): Enemy {
  return new Enemy(scene, spawnData, config, spawnPosition, factoryConfig);
}

export function createInfiltrator(
  scene: Phaser.Scene,
  spawnData: EnemySpawnData,
  config: EnemyTypeConfig,
  spawnPosition: Readonly<Vector2>,
  factoryConfig: EnemyFactoryConfig
): Enemy {
  return createEnemy(scene, spawnData, config, spawnPosition, factoryConfig);
}

function createEnemyAIState(
  spawnPosition: Readonly<Vector2>,
  facingAngle: number,
  role: EnemyRole
): EnemyAIState {
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
    role,
    perceptionAccumMs: 0,
    hearingJitterLocked: false,

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

    externalSpeedMult: 1,
    movementDirLocked: false,
    lockedDir: { x: 0, y: 0 },
    perceptionRangeMult: 1,

    escalationSuppressed: false,
    detectionFillRateMult: 1,

    targetingDecoy: false,
  };
}

/** Facing is texture-only. Perception still uses the continuous facingAngle. */
function freezeActorRotation(image: Phaser.Physics.Arcade.Image): void {
  image.setRotation(0);
  const body = image.body as Phaser.Physics.Arcade.Body | null;
  if (body) body.allowRotation = false;
}
