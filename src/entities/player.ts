/**
 * Player - movement, facing and collision.
 *
 * Shared between the rift and the purification point (architecture DEC-ARCH-008), so it
 * holds no scene-specific logic. Health, attacking and hit flashes belong to the combat
 * system; this entity owns position, velocity, facing, the collider and the speed
 * modifier stack (docs/specs/system-movement-vision.md, section M).
 *
 * Facing follows the last movement direction - keyboard only, no mouse-aimed flashlight
 * (DEC-008). Turning to look therefore costs a change of movement direction, which is
 * what keeps the darkness behind the player threatening. `resolveFacingTarget()` is the
 * single place that decides where the player looks.
 */

import Phaser from 'phaser';
import { copyRuntimeVector, runtimeFacing, runtimeNumber, runtimeRecord, runtimeVector } from '@/systems/ai/runtime-validation';
import { PlayerWeaponRig } from '@/entities/player-weapon-rig';
import type { CrowbarQuality, CrowbarVariant } from '@/art/crowbar-pixels';
import type { WeaponAttackPose } from '@/systems/weapon-swing';
import { GAME_CONSTANTS } from '@/config/constants';
import { FacingLagGhost, pingPongFrame } from '@/entities/actor-motion';
import { PlayerLampAura } from '@/entities/player-lamp-aura';
import { DENSE_PLAYER_LAMP_LOCAL, DENSE_PLAYER_GROUND_OFFSET_Y, densePlayerMotionTexture } from '@/entities/player-sprite-dense';
import type { Facing4, Vector2 } from '@/types/game-types';
import { degToRad, FACING4_ANGLES, quantizeFacing4, stepAngleToward } from '@/utils/math';

export interface PlayerBodyConfig {
  readonly width: number;
  readonly height: number;
  /** Unscaled offset from the texture's top-left corner. */
  readonly offsetX: number;
  readonly offsetY: number;
}

export interface PlayerConfig {
  /** World position (px) to spawn at. */
  readonly spawn: Vector2;
  /** Texture keys; defaults are the dense pixels generated in BootScene. */
  readonly bodyTexture?: string;
  readonly facingTexture?: string;
  readonly depth?: number;
  /** Overrides `PLAYER.SPEED`. */
  readonly baseSpeed?: number;
  /** Initial facing. Defaults to 'right'. */
  readonly facing?: Facing4;
  /** Optional scene footprint. Omitted: the shared centered 20px rift body. */
  readonly body?: PlayerBodyConfig;
}


/** Frame-boundary movement facts; combat and inventory keep their own state. */
export interface PlayerRuntimeState {
  readonly version: 1;
  readonly position: Vector2;
  readonly bodyPosition: Vector2;
  readonly velocity: Vector2;
  readonly facingAngle: number;
  readonly facing4: Facing4;
  readonly inputVector: Vector2;
  readonly moving: boolean;
  readonly inputEnabled: boolean;
  readonly baseSpeed: number;
  readonly burdenSpeedFactor: number;
  readonly speedModifiers: readonly (readonly [string, number])[];
  readonly motionElapsedMs: number;
  readonly lastDeltaMs: number;
}

export function validatePlayerRuntimeState(value: unknown): value is PlayerRuntimeState {
  if (!runtimeRecord(value) || value.version !== 1 || !runtimeVector(value.position)
    || !runtimeVector(value.bodyPosition) || !runtimeVector(value.velocity) || !runtimeVector(value.inputVector)
    || !runtimeNumber(value.facingAngle) || !runtimeFacing(value.facing4)
    || typeof value.moving !== 'boolean' || typeof value.inputEnabled !== 'boolean'
    || !runtimeNumber(value.baseSpeed, 0) || !runtimeNumber(value.burdenSpeedFactor, .84, 1)
    || !runtimeNumber(value.motionElapsedMs, 0) || !runtimeNumber(value.lastDeltaMs, 0)
    || !Array.isArray(value.speedModifiers) || value.speedModifiers.length > 32) return false;
  const sources = new Set<string>();
  let product = 1;
  for (const entry of value.speedModifiers) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !entry[0]
      || sources.has(entry[0]) || !runtimeNumber(entry[1], 0)) return false;
    sources.add(entry[0]);
    product *= entry[1];
  }
  return Number.isFinite(product * value.baseSpeed) && Math.hypot(value.inputVector.x, value.inputVector.y) <= 1.000001;
}

export class Player {
  private scene!: Phaser.Scene;
  private image!: Phaser.Physics.Arcade.Image;

  private keys: Phaser.Input.Keyboard.Key[] = [];
  private keyUp: Phaser.Input.Keyboard.Key[] = [];
  private keyDown: Phaser.Input.Keyboard.Key[] = [];
  private keyLeft: Phaser.Input.Keyboard.Key[] = [];
  private keyRight: Phaser.Input.Keyboard.Key[] = [];

  /** Live view of the player position. Callers may read it every frame; never mutate it. */
  private readonly position: Vector2 = { x: 0, y: 0 };
  private readonly inputVector: Vector2 = { x: 0, y: 0 };

  private baseSpeed: number = GAME_CONSTANTS.PLAYER.SPEED;
  private readonly speedModifiers = new Map<string, number>();
  private speedMultiplier = 1;
  private burdenSpeedFactor = 1;
  private weaponRig!: PlayerWeaponRig;
  private weaponPose: Readonly<WeaponAttackPose> | null = null;

  private facingAngle = 0;
  private facing4: Facing4 = 'right';
  private moving = false;
  private inputEnabled = true;
  private lastDeltaMs = 16;
  private motionElapsedMs = 0;
  private shownFacing: Facing4 = 'right';
  private lag!: FacingLagGhost;
  private aura!: PlayerLampAura;
  private readonly lampLocal = {
    up: { ...DENSE_PLAYER_LAMP_LOCAL.up }, down: { ...DENSE_PLAYER_LAMP_LOCAL.down },
    left: { ...DENSE_PLAYER_LAMP_LOCAL.left }, right: { ...DENSE_PLAYER_LAMP_LOCAL.right },
  };

  create(scene: Phaser.Scene, config: PlayerConfig): void {
    this.scene = scene;
    this.inputEnabled = true;
    this.moving = false;
    this.speedModifiers.clear();
    this.speedMultiplier = 1;
    this.burdenSpeedFactor = 1;
    this.weaponPose = null;
    this.baseSpeed = config.baseSpeed ?? GAME_CONSTANTS.PLAYER.SPEED;
    this.facing4 = config.facing ?? 'right';
    this.facingAngle = FACING4_ANGLES[this.facing4];

    const depth = config.depth ?? 30;
    const idleKey = densePlayerMotionTexture(this.facing4, 'idle', 0);
    this.image = scene.physics.add.image(
      config.spawn.x,
      config.spawn.y,
      config.bodyTexture ?? idleKey
    );
    this.image.setDepth(depth);
    // Direction is indicated by texture swap, not rotation

    const body = this.image.body as Phaser.Physics.Arcade.Body;
    body.setSize(
      config.body?.width ?? GAME_CONSTANTS.PLAYER.BODY_SIZE,
      config.body?.height ?? GAME_CONSTANTS.PLAYER.BODY_SIZE,
      false,
    );
    body.setOffset(
      config.body?.offsetX ?? GAME_CONSTANTS.PLAYER.BODY_OFFSET.x,
      config.body?.offsetY ?? GAME_CONSTANTS.PLAYER.BODY_OFFSET.y,
    );
    body.setCollideWorldBounds(true);
    body.allowRotation = false;

    this.lag = new FacingLagGhost(scene, idleKey, depth - 1, 0.5, 0.5);
    this.aura = new PlayerLampAura(scene, depth, this.lampLocal);
    this.shownFacing = this.facing4;
    this.weaponRig = new PlayerWeaponRig(scene, this.image);

    this.bindKeys(scene);
    this.position.x = config.spawn.x;
    this.position.y = config.spawn.y;
    this.syncVisuals();
  }

  /** Reads input, updates facing and drives the body velocity. Call from `Scene.update`. */
  update(deltaMs: number): void {
    this.lastDeltaMs = deltaMs;
    const dt = deltaMs / 1000;
    this.readInput();

    const targetFacing = this.resolveFacingTarget();
    if (this.weaponPose && this.weaponPose.phase !== 'idle') this.facingAngle = this.weaponPose.facing;
    else if (targetFacing !== null) this.stepFacing(targetFacing, dt);
    this.updateFacing4();

    this.stepVelocity(dt);
  }

  /**
   * Syncs the visual marker with the resolved body position.
   * Call after the physics step (scene POST_UPDATE) so visuals and collision agree.
   */
  postUpdate(): void {
    this.position.x = this.image.x;
    this.position.y = this.image.y;
    this.syncVisuals();
  }

  /** Capture after the physics POST_UPDATE checkpoint, never from the cached read view. */
  exportRuntimeState(): PlayerRuntimeState {
    const body = this.image.body as Phaser.Physics.Arcade.Body;
    const state: PlayerRuntimeState = {
      version: 1, position: { x: this.image.x, y: this.image.y },
      bodyPosition: copyRuntimeVector(body.position), velocity: copyRuntimeVector(body.velocity),
      facingAngle: this.facingAngle, facing4: this.facing4, inputVector: copyRuntimeVector(this.inputVector),
      moving: this.moving, inputEnabled: this.inputEnabled, baseSpeed: this.baseSpeed,
      burdenSpeedFactor: this.burdenSpeedFactor, speedModifiers: [...this.speedModifiers],
      motionElapsedMs: this.motionElapsedMs, lastDeltaMs: this.lastDeltaMs,
    };
    if (!validatePlayerRuntimeState(state)) throw new Error('Player cannot export invalid runtime state');
    return state;
  }

  /** Silent hydration; this never synthesizes input, combat events, or a teleport probe. */
  restoreRuntimeState(value: unknown): void {
    if (!validatePlayerRuntimeState(value)) throw new Error('Invalid player runtime state');
    const body = this.image.body as Phaser.Physics.Arcade.Body;
    body.reset(value.position.x, value.position.y);
    body.position.set(value.bodyPosition.x, value.bodyPosition.y);
    body.prev.copy(body.position);
    body.prevFrame.copy(body.position);
    body.updateCenter();
    body.velocity.set(value.velocity.x, value.velocity.y);
    Object.assign(this.position, value.position);
    Object.assign(this.inputVector, value.inputVector);
    this.facingAngle = value.facingAngle;
    this.facing4 = value.facing4;
    this.shownFacing = value.facing4;
    this.moving = value.moving;
    this.inputEnabled = value.inputEnabled;
    this.baseSpeed = value.baseSpeed;
    this.burdenSpeedFactor = value.burdenSpeedFactor;
    this.speedModifiers.clear();
    for (const [source, multiplier] of value.speedModifiers) this.speedModifiers.set(source, multiplier);
    this.recomputeSpeedMultiplier();
    this.motionElapsedMs = value.motionElapsedMs;
    this.lastDeltaMs = value.lastDeltaMs;
    this.syncVisuals(0);
  }

  // ------------------------------------------------------------------ queries

  getPosition(): Readonly<Vector2> {
    return this.position;
  }

  getFacingAngle(): number {
    return this.facingAngle;
  }

  getFacing4(): Facing4 {
    return this.facing4;
  }

  isMoving(): boolean {
    return this.moving;
  }

  /** Current speed in px/s after the modifier stack. */
  getEffectiveSpeed(): number {
    return this.baseSpeed * this.speedMultiplier * this.burdenSpeedFactor;
  }

  /** Stable sole position in the 32px model, independent of walking/breathing frames. */
  getGroundY(): number {
    return this.image.y + DENSE_PLAYER_GROUND_OFFSET_Y;
  }

  /** Opt-in painter order shared by purification and ground-sorted rift bodies. */
  setGroundDepth(base: number, floorDepth: number): void {
    this.lag.setDepth(base);
    this.image.setDepth(base + 0.1);
    this.aura.setGroundDepth(base, floorDepth);
  }

  /** The physics image, for colliders and camera follow. */
  getSprite(): Phaser.Physics.Arcade.Image {
    return this.image;
  }

  // ------------------------------------------------------------------ setters

  setWeaponVisual(quality: CrowbarQuality | null, variant: CrowbarVariant = 'standard'): void {
    this.weaponRig?.equip(quality, variant);
  }

  setWeaponAttackPose(pose: Readonly<WeaponAttackPose>): void {
    this.weaponPose = pose;
    if (pose.phase !== 'idle') { this.facingAngle = pose.facing; this.updateFacing4(); }
  }

  setBurdenSpeedFactor(factor: number): void {
    this.burdenSpeedFactor = Number.isFinite(factor) ? Math.max(.84, Math.min(1, factor)) : 1;
  }

  /** Multiplicative speed modifier keyed by source ('chaos', 'debug', ...). */
  setSpeedModifier(source: string, multiplier: number): void {
    this.speedModifiers.set(source, multiplier);
    this.recomputeSpeedMultiplier();
  }

  clearSpeedModifier(source: string): void {
    if (this.speedModifiers.delete(source)) this.recomputeSpeedMultiplier();
  }

  /** Freezes input (DOM panels, run settlement). The body still decelerates normally. */
  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.inputVector.x = 0;
      this.inputVector.y = 0;
      this.moving = false;
    }
  }

  destroy(): void {
    const keyboard = this.scene?.input?.keyboard;
    if (keyboard) {
      for (const key of this.keys) keyboard.removeKey(key, true);
    }
    this.keys.length = 0;
    this.keyUp.length = 0;
    this.keyDown.length = 0;
    this.keyLeft.length = 0;
    this.keyRight.length = 0;
    this.speedModifiers.clear();
    this.weaponRig?.destroy();
    this.aura?.destroy();
    this.lag?.destroy();
    this.image?.destroy();
  }

  // ------------------------------------------------------------------ internals

  private bindKeys(scene: Phaser.Scene): void {
    const keyboard = scene.input.keyboard;
    if (!keyboard) return;
    const codes = Phaser.Input.Keyboard.KeyCodes;

    const add = (code: number): Phaser.Input.Keyboard.Key => {
      const key = keyboard.addKey(code, true, false);
      this.keys.push(key);
      return key;
    };

    this.keyUp = [add(codes.W), add(codes.UP)];
    this.keyDown = [add(codes.S), add(codes.DOWN)];
    this.keyLeft = [add(codes.A), add(codes.LEFT)];
    this.keyRight = [add(codes.D), add(codes.RIGHT)];
  }

  private readInput(): void {
    if (!this.inputEnabled) return;

    const up = isDown(this.keyUp);
    const down = isDown(this.keyDown);
    const left = isDown(this.keyLeft);
    const right = isDown(this.keyRight);

    // Opposing keys on the same axis cancel out.
    let x = (right ? 1 : 0) - (left ? 1 : 0);
    let y = (down ? 1 : 0) - (up ? 1 : 0);

    if (x !== 0 && y !== 0) {
      // Diagonals are normalised: moving diagonally is not faster.
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }

    this.inputVector.x = x;
    this.inputVector.y = y;
    this.moving = x !== 0 || y !== 0;
  }

  /**
   * The one and only source of facing (DEC-008): the latest non-zero input direction,
   * held when the player stands still. Returns null to keep the current facing.
   *
   * A future "hold to strafe with locked facing" is a single early return here.
   */
  private resolveFacingTarget(): number | null {
    if (!this.moving) return null;
    return Math.atan2(this.inputVector.y, this.inputVector.x);
  }

  /** Rotates toward `target` along the shortest arc at `FACING_TURN_RATE`. */
  private stepFacing(target: number, dt: number): void {
    const maxStep = degToRad(GAME_CONSTANTS.PLAYER.FACING_TURN_RATE) * dt;
    this.facingAngle = stepAngleToward(this.facingAngle, target, maxStep);
  }

  /** Quantises to four directions with hysteresis, so 45 degree inputs do not flip frames. */
  private updateFacing4(): void {
    this.facing4 = quantizeFacing4(
      this.facingAngle,
      this.facing4,
      degToRad(GAME_CONSTANTS.PLAYER.FACING_QUANT_HYSTERESIS)
    );
  }

  /** Linear approach to the target velocity: a little weight, no perceptible sliding. */
  private stepVelocity(dt: number): void {
    const body = this.image.body as Phaser.Physics.Arcade.Body;
    const speed = this.getEffectiveSpeed();
    const targetX = this.inputVector.x * speed;
    const targetY = this.inputVector.y * speed;

    const rampTime = this.moving
      ? GAME_CONSTANTS.PLAYER.MOVE_ACCEL_TIME
      : GAME_CONSTANTS.PLAYER.MOVE_DECEL_TIME;

    if (rampTime <= 0) {
      body.velocity.set(targetX, targetY);
      return;
    }

    const maxDelta = (speed / rampTime) * dt;
    const deltaX = targetX - body.velocity.x;
    const deltaY = targetY - body.velocity.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance <= maxDelta || distance === 0) {
      body.velocity.set(targetX, targetY);
    } else {
      const scale = maxDelta / distance;
      body.velocity.set(body.velocity.x + deltaX * scale, body.velocity.y + deltaY * scale);
    }
  }

  private recomputeSpeedMultiplier(): void {
    let product = 1;
    for (const multiplier of this.speedModifiers.values()) product *= multiplier;
    this.speedMultiplier = Math.max(GAME_CONSTANTS.PLAYER.SPEED_MOD_MIN, product);
  }

  private syncVisuals(deltaMs = this.lastDeltaMs): void {
    this.motionElapsedMs += deltaMs;
    if (this.facing4 !== this.shownFacing) {
      this.lag.trigger(this.shownFacing, this.image.texture.key);
      this.shownFacing = this.facing4;
    }

    const turning = this.lag.isTurning;
    const gait = this.moving || turning ? 'walk' : 'idle';
    const fps =
      gait === 'walk'
        ? GAME_CONSTANTS.ACTOR_MOTION.PLAYER_WALK_FPS
        : GAME_CONSTANTS.ACTOR_MOTION.PLAYER_IDLE_FPS;
    let frame = pingPongFrame(this.motionElapsedMs, fps);
    if (turning) frame = GAME_CONSTANTS.ACTOR_MOTION.FRAME_COUNT - 1;
    const textureKey = densePlayerMotionTexture(this.facing4, gait, frame);
    if (this.image.texture.key !== textureKey) {
      this.image.setTexture(textureKey);
    }
    this.image.setRotation(0);
    this.weaponRig?.sync(this.facing4, this.facingAngle, this.weaponPose, this.motionElapsedMs, this.moving, deltaMs);
    this.lag.sync(this.image.x, this.image.y, true, deltaMs);
    const torso = this.weaponRig?.getTorsoOffset();
    const originalLamp = DENSE_PLAYER_LAMP_LOCAL[this.facing4];
    const lamp = this.lampLocal[this.facing4];
    const rotation = torso?.rotation ?? 0;
    lamp.x = (torso?.x ?? 0) + originalLamp.x * Math.cos(rotation) - (originalLamp.y - 6) * Math.sin(rotation);
    lamp.y = 6 + (torso?.y ?? 0) + originalLamp.x * Math.sin(rotation) + (originalLamp.y - 6) * Math.cos(rotation);
    this.aura.sync(
      this.image.x,
      this.image.y,
      this.facing4,
      this.moving || turning,
      deltaMs
    );
  }
}

function isDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
  for (const key of keys) {
    if (key.isDown) return true;
  }
  return false;
}
