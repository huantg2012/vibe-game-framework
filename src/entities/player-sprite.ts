/**
 * Legacy blocky 32×32 player pixels. Sortie Player uses player-sprite-dense.ts (DEC-068).
 * Still painted at boot for alias keys (`placeholder-player`, `player-body`, `player-lamp`).
 */

import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';
import type { MotionGait } from '@/entities/actor-motion';

const FACINGS: Facing4[] = ['down', 'up', 'left', 'right'];
const CANVAS = 32;

interface Deform {
  readonly bodyDy: number;
  readonly dx: number;
  readonly headDy: number;
  readonly lampDx: number;
  readonly lampDy: number;
  readonly footExtra: number;
}

const ZERO: Deform = {
  bodyDy: 0,
  dx: 0,
  headDy: 0,
  lampDx: 0,
  lampDy: 0,
  footExtra: 0,
};

const IDLE: readonly Deform[] = [
  ZERO,
  { bodyDy: -1, dx: 0, headDy: -1, lampDx: 0, lampDy: -1, footExtra: 0 },
  ZERO,
  { bodyDy: 1, dx: 0, headDy: 1, lampDx: 0, lampDy: 0, footExtra: 1 },
];

const WALK: readonly Deform[] = [
  ZERO,
  { bodyDy: -1, dx: 0, headDy: -1, lampDx: 0, lampDy: -2, footExtra: -1 },
  ZERO,
  { bodyDy: 1, dx: 0, headDy: 1, lampDx: 0, lampDy: 2, footExtra: 1 },
];

function withStride(base: Deform, facing: Facing4, frame: number, gait: MotionGait): Deform {
  if (gait !== 'walk' || (frame !== 1 && frame !== 3)) return base;
  const sign = frame === 1 ? 1 : -1;
  if (facing === 'left') return { ...base, dx: base.dx - sign };
  if (facing === 'right') return { ...base, dx: base.dx + sign };
  return base;
}

export const PLAYER_IDLE_TEXTURE: Record<Facing4, readonly string[]> = {
  down: ['player-down', 'player-down-idle-1', 'player-down-idle-2', 'player-down-idle-3'],
  up: ['player-up', 'player-up-idle-1', 'player-up-idle-2', 'player-up-idle-3'],
  left: ['player-left', 'player-left-idle-1', 'player-left-idle-2', 'player-left-idle-3'],
  right: ['player-right', 'player-right-idle-1', 'player-right-idle-2', 'player-right-idle-3'],
};

export const PLAYER_WALK_TEXTURE: Record<Facing4, readonly string[]> = {
  down: ['player-down-walk-0', 'player-down-walk-1', 'player-down-walk-2', 'player-down-walk-3'],
  up: ['player-up-walk-0', 'player-up-walk-1', 'player-up-walk-2', 'player-up-walk-3'],
  left: ['player-left-walk-0', 'player-left-walk-1', 'player-left-walk-2', 'player-left-walk-3'],
  right: ['player-right-walk-0', 'player-right-walk-1', 'player-right-walk-2', 'player-right-walk-3'],
};

export function playerMotionTexture(facing: Facing4, gait: MotionGait, frame: number): string {
  const table = gait === 'walk' ? PLAYER_WALK_TEXTURE : PLAYER_IDLE_TEXTURE;
  return table[facing][frame] ?? table[facing][0]!;
}

function paintFacing(scene: Phaser.Scene, key: string, facing: Facing4, deform: Deform): void {
  const g = scene.make.graphics({ x: 0, y: 0 });
  const d = deform;
  if (facing === 'down') {
    g.fillStyle(0x5a3818);
    g.fillRect(12 + d.dx, 16 + d.bodyDy, 8 + d.footExtra, 6);
    g.fillStyle(0x6a4420);
    g.fillRect(10 + d.dx, 12 + d.bodyDy, 12, 4);
    g.fillStyle(0x8a5c2a);
    g.fillEllipse(16 + d.dx, 10 + d.headDy, 7, 5);
    g.fillStyle(0x3a2818);
    g.fillRect(14 + d.dx, 10 + d.headDy, 4, 3);
    g.fillStyle(0xc4873a);
    g.fillRect(21 + d.lampDx, 12 + d.lampDy, 2, 2);
  } else if (facing === 'left') {
    g.fillStyle(0x5a3818);
    g.fillRect(13 + d.dx, 16 + d.bodyDy, 7 + d.footExtra, 6);
    g.fillStyle(0x6a4420);
    g.fillRect(10 + d.dx, 12 + d.bodyDy, 11, 4);
    g.fillStyle(0x8a5c2a);
    g.fillEllipse(15 + d.dx, 10 + d.headDy, 6, 5);
    g.fillStyle(0xc4873a);
    g.fillRect(10 + d.lampDx, 12 + d.lampDy, 2, 2);
  } else if (facing === 'right') {
    g.fillStyle(0x5a3818);
    g.fillRect(12 + d.dx, 16 + d.bodyDy, 7 + d.footExtra, 6);
    g.fillStyle(0x6a4420);
    g.fillRect(11 + d.dx, 12 + d.bodyDy, 11, 4);
    g.fillStyle(0x8a5c2a);
    g.fillEllipse(17 + d.dx, 10 + d.headDy, 6, 5);
    g.fillStyle(0xc4873a);
    g.fillRect(20 + d.lampDx, 12 + d.lampDy, 2, 2);
  } else {
    g.fillStyle(0x2a2018);
    g.fillRect(13 + d.dx, 18 + d.bodyDy, 6, 4);
    g.fillStyle(0x5a3818);
    g.fillRect(12 + d.dx, 16 + d.bodyDy, 8 + d.footExtra, 6);
    g.fillStyle(0x6a4420);
    g.fillRect(10 + d.dx, 12 + d.bodyDy, 12, 4);
    g.fillStyle(0x7a4c22);
    g.fillEllipse(16 + d.dx, 10 + d.headDy, 7, 5);
    g.fillStyle(0xc4873a);
    g.fillRect(21 + d.lampDx, 12 + d.lampDy, 2, 2);
  }
  g.generateTexture(key, CANVAS, CANVAS);
  g.destroy();
}

export function generatePlayerPlaceholders(scene: Phaser.Scene): void {
  for (const facing of FACINGS) {
    for (let frame = 0; frame < 4; frame++) {
      const idleKey = PLAYER_IDLE_TEXTURE[facing][frame]!;
      paintFacing(scene, idleKey, facing, withStride(IDLE[frame]!, facing, frame, 'idle'));
      paintFacing(scene, PLAYER_WALK_TEXTURE[facing][frame]!, facing, withStride(WALK[frame]!, facing, frame, 'walk'));
    }
  }

  paintFacing(scene, 'player-body', 'down', ZERO);
  paintFacing(scene, 'placeholder-player', 'down', ZERO);

  const lamp = scene.make.graphics({ x: 0, y: 0 });
  lamp.fillStyle(0xc4873a);
  lamp.fillRect(0, 0, 2, 2);
  lamp.generateTexture('player-lamp', 2, 2);
  lamp.destroy();
}
