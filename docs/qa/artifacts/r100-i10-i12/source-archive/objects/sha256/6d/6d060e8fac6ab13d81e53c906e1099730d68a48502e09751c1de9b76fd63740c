/**
 * Shared gait / turn presentation. Gameplay facing is unchanged:
 * facing4 still snaps, vision cones still lerp. These helpers only pick
 * upright frames and a fading lag ghost so the snap does not read as a pop.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { Facing4 } from '@/types/game-types';

export type MotionGait = 'idle' | 'walk';

export function facingUnit(facing: Facing4): { x: number; y: number } {
  switch (facing) {
    case 'left':
      return { x: -1, y: 0 };
    case 'right':
      return { x: 1, y: 0 };
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
  }
}

/** Ping-pong 0,1,2,3,2,1 so idle/walk loops have no hitch frame. */
export function pingPongFrame(elapsedMs: number, fps: number): number {
  const count = GAME_CONSTANTS.ACTOR_MOTION.FRAME_COUNT;
  if (fps <= 0) return 0;
  const step = Math.floor((elapsedMs * fps) / 1000);
  const cycle = count * 2 - 2;
  const i = ((step % cycle) + cycle) % cycle;
  return i < count ? i : cycle - i;
}

export function isActorWalking(speedPxPerSec: number): boolean {
  return speedPxPerSec >= GAME_CONSTANTS.ACTOR_MOTION.MOVE_SPEED_FLOOR;
}

/**
 * Previous-facing ghost used only during a facing4 change. Not a physics body.
 * Never rotate it.
 */
export interface FacingLagTune {
  readonly turnMs: number;
  readonly lagPx: number;
  readonly lagAlpha: number;
}

export class FacingLagGhost {
  private readonly image: Phaser.GameObjects.Image;
  private remainingMs = 0;
  private fromFacing: Facing4 = 'down';
  private readonly tune: FacingLagTune;

  constructor(
    scene: Phaser.Scene,
    textureKey: string,
    depth: number,
    originX: number,
    originY: number,
    tune?: Partial<FacingLagTune>
  ) {
    const motion = GAME_CONSTANTS.ACTOR_MOTION;
    this.tune = {
      turnMs: tune?.turnMs ?? motion.TURN_MS,
      lagPx: tune?.lagPx ?? motion.LAG_PX,
      lagAlpha: tune?.lagAlpha ?? motion.LAG_ALPHA,
    };
    this.image = scene.add.image(0, 0, textureKey);
    this.image.setDepth(depth);
    this.image.setOrigin(originX, originY);
    this.image.setRotation(0);
    this.image.setVisible(false);
  }

  setDepth(depth: number): void {
    this.image.setDepth(depth);
  }

  get isTurning(): boolean {
    return this.remainingMs > 0;
  }

  trigger(fromFacing: Facing4, textureKey: string): void {
    this.fromFacing = fromFacing;
    this.remainingMs = this.tune.turnMs;
    if (this.image.texture.key !== textureKey) this.image.setTexture(textureKey);
    this.image.setRotation(0);
  }

  sync(x: number, y: number, visible: boolean, deltaMs: number): void {
    if (!visible || this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.image.setVisible(false);
      return;
    }

    this.remainingMs -= deltaMs;
    const fade = Math.max(this.remainingMs, 0) / this.tune.turnMs;
    const unit = facingUnit(this.fromFacing);
    this.image.setPosition(x + unit.x * this.tune.lagPx * fade, y + unit.y * this.tune.lagPx * fade);
    this.image.setAlpha(this.tune.lagAlpha * fade);
    this.image.setRotation(0);
    this.image.setVisible(true);
  }

  destroy(): void {
    this.image.destroy();
  }
}
