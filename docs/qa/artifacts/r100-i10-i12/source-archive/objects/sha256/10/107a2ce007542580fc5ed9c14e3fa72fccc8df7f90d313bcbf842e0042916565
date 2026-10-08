/**
 * Contamination flakes: 1px teal dust shedding off enemy silhouettes.
 * Drifts out and down (broken sprite data), not up like the player's lamp dust.
 * No warm colour, no additive bloom pool.
 */

import Phaser from 'phaser';
import { AIState, type Facing4 } from '@/types/game-types';

export const CONTAM_FLAKE_KEY = 'contam-flake-1';
export const CONTAM_FLAKE_WIDE_KEY = 'contam-flake-2';
export const CONTAM_STAIN_KEY = 'contam-stain';

export interface FlakeLocal {
  readonly x: number;
  readonly y: number;
}

export interface ContamFlakeTune {
  readonly slots: number;
  readonly patrolIntervalMs: number;
  readonly alertIntervalMs: number;
  readonly chaseIntervalMs: number;
  readonly patrolLifeMs: number;
  readonly alertLifeMs: number;
  readonly chaseLifeMs: number;
  readonly wideChance: number;
  readonly depth: number;
}

export const INFILTRATOR_FLAKE_TUNE: Omit<ContamFlakeTune, 'depth'> = {
  slots: 5,
  patrolIntervalMs: 140,
  alertIntervalMs: 80,
  chaseIntervalMs: 50,
  patrolLifeMs: 420,
  alertLifeMs: 280,
  chaseLifeMs: 220,
  wideChance: 0,
};

export const REWRITER_FLAKE_TUNE: Omit<ContamFlakeTune, 'depth'> = {
  slots: 10,
  patrolIntervalMs: 120,
  alertIntervalMs: 24,
  chaseIntervalMs: 12,
  patrolLifeMs: 240,
  alertLifeMs: 140,
  chaseLifeMs: 110,
  wideChance: 0.28,
};

export function generateContamFlakeTextures(scene: Phaser.Scene): void {
  const one = scene.make.graphics({ x: 0, y: 0 });
  one.fillStyle(0x1a6b5c, 1);
  one.fillRect(0, 0, 1, 1);
  if (scene.textures.exists(CONTAM_FLAKE_KEY)) scene.textures.remove(CONTAM_FLAKE_KEY);
  one.generateTexture(CONTAM_FLAKE_KEY, 1, 1);
  one.destroy();

  const wide = scene.make.graphics({ x: 0, y: 0 });
  wide.fillStyle(0x1aad96, 1);
  wide.fillRect(0, 0, 2, 1);
  if (scene.textures.exists(CONTAM_FLAKE_WIDE_KEY)) scene.textures.remove(CONTAM_FLAKE_WIDE_KEY);
  wide.generateTexture(CONTAM_FLAKE_WIDE_KEY, 2, 1);
  wide.destroy();

  const stain = scene.make.graphics({ x: 0, y: 0 });
  stain.fillStyle(0x0e4a3f, 0.45);
  stain.fillRect(3, 3, 14, 4);
  stain.fillStyle(0x1a6b5c, 0.55);
  stain.fillRect(6, 4, 8, 3);
  stain.fillStyle(0x1aad96, 0.35);
  stain.fillRect(8, 4, 4, 2);
  if (scene.textures.exists(CONTAM_STAIN_KEY)) scene.textures.remove(CONTAM_STAIN_KEY);
  stain.generateTexture(CONTAM_STAIN_KEY, 20, 10);
  stain.destroy();
}

interface Slot {
  readonly image: Phaser.GameObjects.Image;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
}

export class ContamFlakes {
  private readonly slots: Slot[] = [];
  private readonly localsFor: (facing: Facing4) => readonly FlakeLocal[];
  private readonly tune: ContamFlakeTune;
  private spawnMs = 0;
  private spawnIndex = 0;

  constructor(
    scene: Phaser.Scene,
    localsFor: (facing: Facing4) => readonly FlakeLocal[],
    tune: ContamFlakeTune
  ) {
    this.localsFor = localsFor;
    this.tune = tune;
    for (let i = 0; i < tune.slots; i++) {
      const image = scene.add.image(0, 0, CONTAM_FLAKE_KEY);
      image.setDepth(tune.depth);
      image.setOrigin(0.5, 0.5);
      image.setVisible(false);
      image.setRotation(0);
      this.slots.push({ image, life: 0, maxLife: 1, vx: 0, vy: 0 });
    }
  }

  sync(
    x: number,
    y: number,
    facing: Facing4,
    state: AIState,
    visibility: number,
    deltaMs: number
  ): void {
    if (visibility <= 0) {
      this.hideAll();
      return;
    }

    const dt = deltaMs / 1000;
    for (const slot of this.slots) {
      if (slot.life <= 0) continue;
      slot.life -= deltaMs;
      if (slot.life <= 0) {
        slot.image.setVisible(false);
        continue;
      }
      slot.image.x += slot.vx * dt;
      slot.image.y += slot.vy * dt;
      slot.image.setAlpha(visibility * (slot.life / slot.maxLife));
      slot.image.setRotation(0);
      slot.image.setVisible(true);
    }

    const { interval, life } = rateFor(state, this.tune);
    this.spawnMs += deltaMs;
    let spawned = 0;
    while (this.spawnMs >= interval && spawned < 3) {
      this.spawnMs -= interval;
      this.spawn(x, y, facing, life, visibility);
      spawned += 1;
    }
  }

  destroy(): void {
    for (const slot of this.slots) slot.image.destroy();
    this.slots.length = 0;
  }

  private spawn(x: number, y: number, facing: Facing4, life: number, visibility: number): void {
    const locals = this.localsFor(facing);
    const slot = this.slots.find((s) => s.life <= 0);
    if (!slot || locals.length === 0) return;
    const local = locals[this.spawnIndex % locals.length]!;
    this.spawnIndex += 1;

    const outward = facingUnit(facing);
    const wide = this.tune.wideChance > 0 && (this.spawnIndex % 7) / 7 < this.tune.wideChance;
    const key = wide ? CONTAM_FLAKE_WIDE_KEY : CONTAM_FLAKE_KEY;
    if (slot.image.texture.key !== key) slot.image.setTexture(key);

    slot.life = life;
    slot.maxLife = life;
    slot.vx = outward.x * 10 + ((this.spawnIndex % 5) - 2) * 3;
    slot.vy = 12 + (this.spawnIndex % 4) * 2;
    slot.image.setPosition(x + local.x, y + local.y);
    slot.image.setAlpha(visibility);
    slot.image.setRotation(0);
    slot.image.setVisible(true);
  }

  burst(x: number, y: number, facing: Facing4, visibility: number, count: number): void {
    if (visibility <= 0) return;
    for (let i = 0; i < count; i++) {
      this.spawn(x, y, facing, Math.min(this.tune.patrolLifeMs, 180), visibility);
    }
  }

  private hideAll(): void {
    this.spawnMs = 0;
    for (const slot of this.slots) {
      slot.life = 0;
      slot.image.setVisible(false);
    }
  }
}

function rateFor(
  state: AIState,
  tune: ContamFlakeTune
): { interval: number; life: number } {
  if (state === AIState.CHASE) {
    return { interval: tune.chaseIntervalMs, life: tune.chaseLifeMs };
  }
  if (state === AIState.ALERT || state === AIState.SUSPICIOUS) {
    return { interval: tune.alertIntervalMs, life: tune.alertLifeMs };
  }
  return { interval: tune.patrolIntervalMs, life: tune.patrolLifeMs };
}

function facingUnit(facing: Facing4): { x: number; y: number } {
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

/** Small teal ground stain under the rewriter. Not a lamp, not additive bloom. */
export class ContamStain {
  private readonly image: Phaser.GameObjects.Image;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.image = scene.add.image(0, 0, CONTAM_STAIN_KEY);
    this.image.setDepth(depth);
    this.image.setOrigin(0.5, 0.3);
    this.image.setRotation(0);
  }

  sync(x: number, y: number, visibility: number, deltaMs: number): void {
    this.elapsedMs += deltaMs;
    if (visibility <= 0) {
      this.image.setVisible(false);
      return;
    }
    const pulse = 0.22 + 0.1 * Math.sin(this.elapsedMs / 320);
    this.image.setPosition(x, y + 11);
    this.image.setAlpha(pulse * visibility);
    this.image.setRotation(0);
    this.image.setVisible(true);
  }

  destroy(): void {
    this.image.destroy();
  }
}
