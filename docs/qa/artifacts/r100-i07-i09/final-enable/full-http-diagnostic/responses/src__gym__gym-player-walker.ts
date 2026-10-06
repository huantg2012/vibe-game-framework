/**
 * Gym-only mannequin: walks a rectangle to show the dense player look.
 * Same pixels as sortie Player; no WASD, no vision cone.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { FacingLagGhost, pingPongFrame } from '@/entities/actor-motion';
import { PlayerLampAura } from '@/entities/player-lamp-aura';
import { DENSE_PLAYER_LAMP_LOCAL, densePlayerMotionTexture } from '@/entities/player-sprite-dense';
import type { Facing4 } from '@/types/game-types';

export interface GymWalkRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

type Edge = 'east' | 'south' | 'west' | 'north';

const EDGE_FACING: Record<Edge, Facing4> = {
  east: 'right',
  south: 'down',
  west: 'left',
  north: 'up',
};

const CORNER_PAUSE_MS = 240;
const BODY_DEPTH = 30;

export class GymPlayerWalker {
  private readonly image: Phaser.GameObjects.Image;
  private readonly lag: FacingLagGhost;
  private readonly aura: PlayerLampAura;
  private readonly rect: GymWalkRect;
  private edge: Edge = 'east';
  private facing4: Facing4 = 'right';
  private shownFacing: Facing4 = 'right';
  private pauseMs = 0;
  private motionElapsedMs = 0;

  constructor(scene: Phaser.Scene, rect: GymWalkRect) {
    this.rect = rect;
    const texture = densePlayerMotionTexture(this.facing4, 'idle', 0);
    this.image = scene.add.image(rect.left, rect.top, texture);
    this.image.setDepth(BODY_DEPTH);
    this.image.setRotation(0);

    this.lag = new FacingLagGhost(scene, texture, BODY_DEPTH - 1, 0.5, 0.5);
    this.aura = new PlayerLampAura(scene, BODY_DEPTH, DENSE_PLAYER_LAMP_LOCAL);
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    const speed = GAME_CONSTANTS.PLAYER.SPEED;
    let walking = false;

    if (this.pauseMs > 0) {
      this.pauseMs -= deltaMs;
    } else {
      walking = true;
      switch (this.edge) {
        case 'east':
          this.image.x += speed * dt;
          if (this.image.x >= this.rect.right) this.arrive(this.rect.right, this.rect.top, 'south');
          break;
        case 'south':
          this.image.y += speed * dt;
          if (this.image.y >= this.rect.bottom) this.arrive(this.rect.right, this.rect.bottom, 'west');
          break;
        case 'west':
          this.image.x -= speed * dt;
          if (this.image.x <= this.rect.left) this.arrive(this.rect.left, this.rect.bottom, 'north');
          break;
        case 'north':
          this.image.y -= speed * dt;
          if (this.image.y <= this.rect.top) this.arrive(this.rect.left, this.rect.top, 'east');
          break;
      }
    }

    this.syncVisuals(deltaMs, walking);
  }

  get rotation(): number {
    return this.image.rotation;
  }

  destroy(): void {
    this.lag.destroy();
    this.aura.destroy();
    this.image.destroy();
  }

  private arrive(x: number, y: number, next: Edge): void {
    this.image.x = x;
    this.image.y = y;
    this.edge = next;
    this.facing4 = EDGE_FACING[next];
    this.pauseMs = CORNER_PAUSE_MS;
  }

  private syncVisuals(deltaMs: number, walking: boolean): void {
    this.motionElapsedMs += deltaMs;
    if (this.facing4 !== this.shownFacing) {
      this.lag.trigger(this.shownFacing, this.image.texture.key);
      this.shownFacing = this.facing4;
    }

    const turning = this.lag.isTurning;
    const gait = walking || turning ? 'walk' : 'idle';
    const fps =
      gait === 'walk'
        ? GAME_CONSTANTS.ACTOR_MOTION.PLAYER_WALK_FPS
        : GAME_CONSTANTS.ACTOR_MOTION.PLAYER_IDLE_FPS;
    let frame = pingPongFrame(this.motionElapsedMs, fps);
    if (turning) frame = GAME_CONSTANTS.ACTOR_MOTION.FRAME_COUNT - 1;
    const key = densePlayerMotionTexture(this.facing4, gait, frame);
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setRotation(0);

    this.lag.sync(this.image.x, this.image.y, true, deltaMs);
    this.aura.sync(this.image.x, this.image.y, this.facing4, walking, deltaMs);
  }
}
