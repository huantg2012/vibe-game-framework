/**
 * Placeholder textures shared by the production BootScene and the gym boot.
 * Enemy pixels generated here ARE the finished look (DEC-066), not stand-ins
 * waiting for a sprite sheet. Keep this the only paint site so gym cannot drift.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { generateContamFlakeTextures } from '@/entities/contam-flakes';
import { generateInfiltratorPlaceholders } from '@/entities/infiltrator-sprite';
import { generatePlayerLampAuraTextures } from '@/entities/player-lamp-aura';
import { generateDensePlayerPlaceholders } from '@/entities/player-sprite-dense';
import { generatePlayerPlaceholders } from '@/entities/player-sprite';
import { generateRewriterPlaceholders } from '@/entities/rewriter-sprite';

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const tile = GAME_CONSTANTS.TILE_SIZE;
  generatePlayerPlaceholders(scene);
  generateDensePlayerPlaceholders(scene);
  generatePlayerLampAuraTextures(scene);
  generateRewriterPlaceholders(scene);
  generateFacingMarker(scene);
  generateInfiltratorPlaceholders(scene);
  generateContamFlakeTextures(scene);
  generateEnemyIndicators(scene);
  generateKindlingPlaceholder(scene);
  generateRiftTileset(scene, tile);
}

function generateFacingMarker(scene: Phaser.Scene): void {
  const facingGfx = scene.make.graphics({ x: 0, y: 0 });
  facingGfx.fillStyle(0xffffff, 1);
  facingGfx.fillTriangle(10, 6, 0, 0, 0, 12);
  facingGfx.generateTexture('placeholder-player-facing', 10, 12);
  facingGfx.destroy();
}

function generateKindlingPlaceholder(scene: Phaser.Scene): void {
  const kindlingGfx = scene.make.graphics({ x: 0, y: 0 });
  kindlingGfx.fillStyle(0x8a6020, 1);
  kindlingGfx.fillPoints(
    [
      { x: 8, y: 0 },
      { x: 14, y: 3 },
      { x: 15, y: 9 },
      { x: 8, y: 16 },
      { x: 1, y: 9 },
    ],
    true,
  );
  kindlingGfx.fillStyle(0xb88030, 1);
  kindlingGfx.fillPoints(
    [
      { x: 8, y: 1 },
      { x: 12, y: 4 },
      { x: 10, y: 7 },
      { x: 6, y: 5 },
    ],
    true,
  );
  kindlingGfx.generateTexture('placeholder-kindling', 16, 16);
  kindlingGfx.destroy();
}

function generateEnemyIndicators(scene: Phaser.Scene): void {
  const ai = GAME_CONSTANTS.AI;

  const dotGfx = scene.make.graphics({ x: 0, y: 0 });
  dotGfx.fillStyle(ai.INDICATOR_COLOR, 1);
  dotGfx.fillRect(0, 0, 4, 4);
  dotGfx.generateTexture('placeholder-enemy-dot', 4, 4);
  dotGfx.destroy();

  const lockGfx = scene.make.graphics({ x: 0, y: 0 });
  lockGfx.fillStyle(ai.INDICATOR_COLOR, 1);
  lockGfx.fillTriangle(0, 0, 8, 0, 4, 6);
  lockGfx.generateTexture('placeholder-enemy-lock', 8, 6);
  lockGfx.destroy();
}

function generateRiftTileset(scene: Phaser.Scene, tile: number): void {
  const gfx = scene.make.graphics({ x: 0, y: 0 });

  gfx.fillStyle(0x000000, 1);
  gfx.fillRect(0, 0, tile, tile);
  gfx.lineStyle(1, 0x0a0a0a, 1);
  gfx.strokeRect(0.5, 0.5, tile - 1, tile - 1);

  gfx.fillStyle(0x1a1a1a, 1);
  gfx.fillRect(tile, 0, tile, tile);
  gfx.lineStyle(1, 0x232323, 1);
  gfx.strokeRect(tile + 0.5, 0.5, tile - 1, tile - 1);

  gfx.fillStyle(0x12141a, 1);
  gfx.fillRect(tile * 2, 0, tile, tile);
  gfx.lineStyle(1, 0x1a1e24, 1);
  gfx.strokeRect(tile * 2 + 0.5, 0.5, tile - 1, tile - 1);

  gfx.fillStyle(0x080a0c, 1);
  gfx.fillRect(tile * 3, 0, tile, tile);

  gfx.generateTexture('placeholder-rift-tileset', tile * 4, tile);
  gfx.destroy();
}
