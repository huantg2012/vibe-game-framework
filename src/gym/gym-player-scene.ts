/**
 * Player-look gym: dense industrial pixels + lamp dust.
 * Same look as sortie Player (DEC-068). Contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { TileType } from '@/types/game-types';
import { INFILTRATOR_TEXTURE } from '@/entities/infiltrator-sprite';
import {
  REWRITER_CANVAS_H,
  REWRITER_CANVAS_W,
  REWRITER_ORIGIN_X,
  REWRITER_ORIGIN_Y,
  REWRITER_TEXTURE,
} from '@/entities/rewriter-sprite';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { createGymTileMap } from '@/gym/arena';
import { GymPlayerWalker } from '@/gym/gym-player-walker';

const TILE = GAME_CONSTANTS.TILE_SIZE;

export class GymPlayerScene extends Phaser.Scene {
  private readonly tiles = new TilemapRenderer();
  private walker: GymPlayerWalker | null = null;

  constructor() {
    super({ key: 'GymPlayerScene' });
  }

  create(): void {
    const tileMap = createGymTileMap();
    const grid = new TileGrid(tileMap);
    this.tiles.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL, TileType.VOID],
      depth: 0,
    });

    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);
    const camera = this.cameras.main;
    camera.setBounds(0, 0, grid.widthPx, grid.heightPx);
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);
    camera.centerOn(grid.widthPx / 2, grid.heightPx / 2);

    this.add.image(TILE * 2.5, TILE * 2, INFILTRATOR_TEXTURE.down).setDepth(25);
    this.add
      .image(TILE * 5, TILE * 2.4, REWRITER_TEXTURE.down)
      .setOrigin(REWRITER_ORIGIN_X / REWRITER_CANVAS_W, REWRITER_ORIGIN_Y / REWRITER_CANVAS_H)
      .setDepth(25);

    this.walker = new GymPlayerWalker(this, {
      left: TILE * 3.5,
      top: TILE * 3.6,
      right: TILE * 14.5,
      bottom: TILE * 9.6,
    });

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 玩家外形';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        '方案 1：加厚程序像素 + 灯尘（侧影已加厚、配色略暖）',
        '北墙站住的是出击同一套渗透体 / 改写体，只作尺寸对照',
        '出击 Player 已接同一套外形',
      ].join('\n');
    }
    const status = document.getElementById('gym-status');
    if (status) status.textContent = '绕圈；角上短停是为了看侧影和转向。无玩家输入。';

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    this.walker?.update(delta);
    if (this.walker && Math.abs(this.walker.rotation) > 1e-4) {
      const status = document.getElementById('gym-status');
      if (status) {
        status.textContent = `错误：actor.rotation=${this.walker.rotation.toFixed(3)}（朝向必须只换贴图）`;
      }
    }
  }

  private onShutdown(): void {
    this.walker?.destroy();
    this.walker = null;
    this.tiles.destroy();
  }
}
