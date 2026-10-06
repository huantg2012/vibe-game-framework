/**
 * Enemy-movement gym. Uses production AISystem + Enemy + GridPathfinder.
 * Contract: docs/dev/gym.md.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { TileType, type Vector2 } from '@/types/game-types';
import type { EnemySpawnData } from '@/types/map-types';
import { AISystem, ENEMY_DEPTH } from '@/systems/ai';
import { TileGrid } from '@/systems/tile-grid';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import {
  createGymEnemySpawns,
  createGymTileMap,
  gymRosterLines,
} from '@/gym/arena';

const MOVE_SPEED_FLOOR = 8;
const DUMMY_PLAYER: Vector2 = { x: -10000, y: -10000 };

export const GYM_HEADINGS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'] as const;
export type GymHeading = (typeof GYM_HEADINGS)[number];

export class GymScene extends Phaser.Scene {
  private readonly ai = new AISystem();
  private readonly tiles = new TilemapRenderer();
  private lastDelta = 16;
  private spawns: readonly EnemySpawnData[] = [];
  private readonly seen = new Set<GymHeading>();

  constructor() {
    super({ key: 'GymScene' });
  }

  create(): void {
    const tileMap = createGymTileMap();
    const grid = new TileGrid(tileMap);

    const layer = this.tiles.create(this, tileMap, {
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

    this.spawns = createGymEnemySpawns();
    this.ai.create(this, this.spawns, grid, grid);
    this.ai.setVisibilityProvider(() => 1);
    this.ai.addWallCollider(layer);

    this.paintWaypoints(tileMap.tileSize);
    this.fillRoster();
    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 敌人移动';
    const status = document.getElementById('gym-status');
    if (status) status.textContent = '巡逻中（诱饵在场外，不追击）。顿步是木偶步；青绿污斑只在改写体脚下。';

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(_time: number, delta: number): void {
    this.lastDelta = delta;
    this.ai.update(delta, DUMMY_PLAYER, false);
  }

  private onPostUpdate(): void {
    this.ai.postUpdate(this.lastDelta);
    this.sampleHeadings();
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.ai.destroy();
    this.tiles.destroy();
  }

  private paintWaypoints(tileSize: number): void {
    const g = this.add.graphics();
    g.setDepth(ENEMY_DEPTH - 1);
    g.fillStyle(0x1a6b5c, 0.45);
    for (const spawn of this.spawns) {
      for (const tile of spawn.patrol.waypoints) {
        g.fillRect(tile.col * tileSize + 12, tile.row * tileSize + 12, 8, 8);
      }
    }
  }

  private fillRoster(): void {
    const el = document.getElementById('gym-roster');
    if (!el) return;
    el.textContent = [...gymRosterLines(), '木偶步 + 青绿脱落尘；改写体脚下有污斑'].join('\n');
  }

  private sampleHeadings(): void {
    for (const sprite of this.ai.getSprites()) {
      if (Math.abs(sprite.rotation) > 1e-4) {
        const status = document.getElementById('gym-status');
        if (status) {
          status.textContent = `错误：actor.rotation=${sprite.rotation.toFixed(3)}（朝向必须只换贴图）`;
        }
      }
      const body = sprite.body;
      if (!body) continue;
      const heading = headingFromVelocity(body.velocity.x, body.velocity.y);
      if (!heading || this.seen.has(heading)) continue;
      this.seen.add(heading);
      document.getElementById(`gym-dir-${heading}`)?.setAttribute('data-seen', '1');
    }
  }
}

function headingFromVelocity(vx: number, vy: number): GymHeading | null {
  const mag = Math.hypot(vx, vy);
  if (mag < MOVE_SPEED_FLOOR) return null;
  const deg = ((Math.atan2(vy, vx) * 180) / Math.PI + 360) % 360;
  const bin = Math.round(deg / 45) % 8;
  return GYM_HEADINGS[bin] ?? null;
}
