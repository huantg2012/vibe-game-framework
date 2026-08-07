/**
 * TrailSystem - Afterimage Trail (余迹残光)
 *
 * Leaves a faint warm-coloured trace on tiles the player has walked over. The trace
 * is only visible within the player's field of view and fades with time; the fade
 * speed increases with chaos (at HARD_CAP the lifetime is about 20 s vs 90 s base).
 *
 * Performance: only the tiles inside the camera viewport are drawn each frame (~260),
 * regardless of how many tiles the player has visited total.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { Vector2 } from '@/types/game-types';

/** Base trail lifetime in ms (at chaos 0). */
const BASE_LIFETIME_MS = 90_000;

/** At chaos = HARD_CAP, lifetime shrinks by this fraction (0.78 = 78% shorter). */
const CHAOS_DECAY_FRACTION = 0.78;

/** Maximum alpha for the freshest trail marks. */
const MAX_ALPHA = 0.06;

export class TrailSystem {
  private scene!: Phaser.Scene;
  private graphics!: Phaser.GameObjects.Graphics;
  private mapWidth = 0;
  private tileSize = 0;
  private getVisibility!: (pos: Vector2) => number;

  /** tileKey -> timestamp of last visit (ms since system start). */
  private visited: Map<number, number> = new Map();

  /** Accumulated elapsed time in ms (used as the "clock" for visit timestamps). */
  private elapsedMs = 0;

  /** The warm lamp colour used for the trail overlay. */
  private readonly trailColor: number = GAME_CONSTANTS.VISIBILITY.PLAYER_LAMP_COLOR;

  /** Reusable vector to avoid per-tile allocation in the render loop. */
  private readonly queryPos: Vector2 = { x: 0, y: 0 };

  create(
    scene: Phaser.Scene,
    mapWidth: number,
    tileSize: number,
    getVisibility: (pos: Vector2) => number
  ): void {
    this.scene = scene;
    this.mapWidth = mapWidth;
    this.tileSize = tileSize;
    this.getVisibility = getVisibility;

    // Depth sits between the surface (0) and enemies (ENEMY_DEPTH = 20), so the trail
    // is visible on the floor but does not draw over sprites.
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(5);
  }

  /**
   * Called every frame. Records the player's current tile and redraws visible trail marks.
   */
  update(playerTileX: number, playerTileY: number, chaosValue: number, deltaMs: number): void {
    this.elapsedMs += deltaMs;

    // Record current tile visit.
    const key = playerTileY * this.mapWidth + playerTileX;
    this.visited.set(key, this.elapsedMs);

    // Compute effective lifetime based on chaos.
    const hardCap = GAME_CONSTANTS.CHAOS.HARD_CAP;
    const chaosFactor = Math.min(chaosValue / hardCap, 1);
    const lifetime = BASE_LIFETIME_MS * (1.0 - chaosFactor * CHAOS_DECAY_FRACTION);

    // Determine the camera viewport in tile coordinates.
    const camera = this.scene.cameras.main;
    const view = camera.worldView;
    const ts = this.tileSize;

    const startCol = Math.max(0, Math.floor(view.x / ts) - 1);
    const startRow = Math.max(0, Math.floor(view.y / ts) - 1);
    const endCol = Math.ceil((view.x + view.width) / ts) + 1;
    const endRow = Math.ceil((view.y + view.height) / ts) + 1;

    this.graphics.clear();

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const tileKey = row * this.mapWidth + col;
        const visitTime = this.visited.get(tileKey);
        if (visitTime === undefined) continue;

        // Compute age-based alpha.
        const age = this.elapsedMs - visitTime;
        if (age >= lifetime) {
          // Expired - remove to keep the map from growing unboundedly.
          this.visited.delete(tileKey);
          continue;
        }

        const decayAlpha = MAX_ALPHA * (1 - age / lifetime);

        // Visibility gate: multiply by the player's current visibility at this tile.
        this.queryPos.x = col * ts + ts * 0.5;
        this.queryPos.y = row * ts + ts * 0.5;
        const vis = this.getVisibility(this.queryPos);
        if (vis <= 0) continue;

        const finalAlpha = decayAlpha * vis;
        if (finalAlpha < 0.002) continue;

        this.graphics.fillStyle(this.trailColor, finalAlpha);
        this.graphics.fillRect(col * ts, row * ts, ts, ts);
      }
    }
  }

  /** Clears all trail data (e.g. on run restart). */
  reset(): void {
    this.visited.clear();
    this.elapsedMs = 0;
    this.graphics?.clear();
  }

  destroy(): void {
    this.graphics?.destroy();
    this.visited.clear();
  }
}
