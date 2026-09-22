/**
 * Warm lamp dust (motes + foot pool). Wired to sortie Player (DEC-068) and the gym dummy.
 */

import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';

export const PLAYER_AURA_GLOW_KEY = 'player-aura-glow';
export const PLAYER_AURA_MOTE_KEY = 'player-aura-mote';
export const PLAYER_AURA_POOL_KEY = 'player-aura-pool';

export type LampLocal = Record<Facing4, { x: number; y: number }>;

const MOTE_COUNT = 5;

export function generatePlayerLampAuraTextures(scene: Phaser.Scene): void {
  const glow = scene.make.graphics({ x: 0, y: 0 });
  glow.fillStyle(0x8a5c2a, 0.35);
  glow.fillRect(6, 4, 4, 8);
  glow.fillRect(4, 6, 8, 4);
  glow.fillStyle(0xc4873a, 0.7);
  glow.fillRect(7, 6, 2, 4);
  glow.fillRect(6, 7, 4, 2);
  glow.fillStyle(0xe0a848, 1);
  glow.fillRect(7, 7, 2, 2);
  if (scene.textures.exists(PLAYER_AURA_GLOW_KEY)) scene.textures.remove(PLAYER_AURA_GLOW_KEY);
  glow.generateTexture(PLAYER_AURA_GLOW_KEY, 16, 16);
  glow.destroy();

  const mote = scene.make.graphics({ x: 0, y: 0 });
  mote.fillStyle(0xc4873a, 1);
  mote.fillRect(0, 0, 1, 1);
  if (scene.textures.exists(PLAYER_AURA_MOTE_KEY)) scene.textures.remove(PLAYER_AURA_MOTE_KEY);
  mote.generateTexture(PLAYER_AURA_MOTE_KEY, 1, 1);
  mote.destroy();

  const pool = scene.make.graphics({ x: 0, y: 0 });
  pool.fillStyle(0x8a5c2a, 0.28);
  pool.fillRect(4, 5, 8, 3);
  pool.fillStyle(0xc4873a, 0.4);
  pool.fillRect(6, 5, 4, 2);
  if (scene.textures.exists(PLAYER_AURA_POOL_KEY)) scene.textures.remove(PLAYER_AURA_POOL_KEY);
  pool.generateTexture(PLAYER_AURA_POOL_KEY, 16, 12);
  pool.destroy();
}

export class PlayerLampAura {
  private readonly glow: Phaser.GameObjects.Image;
  private readonly pool: Phaser.GameObjects.Image;
  private readonly motes: Phaser.GameObjects.Image[] = [];
  private readonly lampLocal: LampLocal;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, depth: number, lampLocal: LampLocal, private readonly externalGround = false) {
    this.lampLocal = lampLocal;
    this.pool = scene.add.image(0, 0, PLAYER_AURA_POOL_KEY);
    this.pool.setDepth(depth - 2);
    this.pool.setOrigin(0.5, 0.2);

    this.glow = scene.add.image(0, 0, PLAYER_AURA_GLOW_KEY);
    this.glow.setDepth(depth + 1);
    this.glow.setOrigin(0.5, 0.5);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);

    for (let i = 0; i < MOTE_COUNT; i++) {
      const mote = scene.add.image(0, 0, PLAYER_AURA_MOTE_KEY);
      mote.setDepth(depth + 2);
      mote.setOrigin(0.5, 0.5);
      this.motes.push(mote);
    }
  }

  /** Ground light stays below all bodies; lamp and dust belong to the actor. */
  setGroundDepth(base: number, floorDepth: number): void {
    this.pool.setDepth(floorDepth);
    this.glow.setDepth(base + 0.2);
    for (const mote of this.motes) mote.setDepth(base + 0.3);
  }

  sync(x: number, y: number, facing: Facing4, walking: boolean, deltaMs: number): void {
    this.elapsedMs += deltaMs;
    const lamp = this.lampLocal[facing];
    const lx = x + lamp.x;
    const ly = y + lamp.y;
    const pulse = 0.45 + 0.25 * Math.sin(this.elapsedMs / 140);
    this.glow.setPosition(lx, ly);
    this.glow.setAlpha(pulse);
    this.glow.setVisible(true);

    this.pool.setPosition(x, y + 10);
    this.pool.setAlpha(walking ? 0.55 : 0.4);
    this.pool.setVisible(!this.externalGround);

    const rise = walking ? 16 : 11;
    for (let i = 0; i < this.motes.length; i++) {
      const mote = this.motes[i]!;
      const t = (this.elapsedMs * 0.018 + i * 13) % 40;
      const drift = Math.sin(this.elapsedMs / 180 + i) * 2;
      mote.setPosition(lx + drift, ly - (t / 40) * rise);
      mote.setAlpha(0.15 + 0.45 * (1 - t / 40));
      mote.setVisible(true);
    }
  }

  destroy(): void {
    this.glow.destroy();
    this.pool.destroy();
    for (const mote of this.motes) mote.destroy();
    this.motes.length = 0;
  }
}
