/**
 * PurificationModule entity - visual representation of a module in the purification scene.
 *
 * Each module is a coloured geometric shape (CORE=blue hexagon, STORAGE=orange square)
 * with an hp bar displayed as a same-colour thin bar below the module body.
 * No text is rendered in the game world; all readable info lives in DOM overlays.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { ModuleType } from '@/managers/game-state';
import { gameState } from '@/managers/game-state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModuleEntityConfig {
  readonly id: string;
  readonly type: ModuleType;
  readonly x: number;
  readonly y: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INTERACTION_RADIUS = GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS;

// Module colours
const CORE_MAIN = 0x4488cc;
const CORE_EDGE = 0x6699dd;
const STORAGE_MAIN = 0xcc8844;
const STORAGE_EDGE = 0xddaa66;
const DANGER_COLOR = 0xcc3333;

// Module sizes (spec B1)
const CORE_RADIUS = 16;
const STORAGE_HALF = 14; // half-side = 14 => 28px side

// HP bar (spec B2)
const HP_BAR_HEIGHT = 3;
const HP_BAR_GAP = 4; // px below module body
const HP_BAR_WIDTH = 28;
const HP_SHOW_DISTANCE = 80; // 2.5 tiles

// ---------------------------------------------------------------------------
// PurificationModuleEntity
// ---------------------------------------------------------------------------

export class PurificationModuleEntity {
  private graphics!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;

  private readonly config: ModuleEntityConfig;
  private inRange = false;
  private proximityGlow = false;
  private scene!: Phaser.Scene;

  constructor(config: ModuleEntityConfig) {
    this.config = config;
  }

  get id(): string {
    return this.config.id;
  }

  get type(): ModuleType {
    return this.config.type;
  }

  get x(): number {
    return this.config.x;
  }

  get y(): number {
    return this.config.y;
  }

  create(scene: Phaser.Scene): void {
    this.scene = scene;
    const depth = 20;

    // Module shape
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(depth);

    // HP bar background
    const barY = this.getHpBarY();
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.setDepth(depth + 1);
    this.hpBarBg.fillStyle(this.config.type === 'CORE' ? 0x222233 : 0x332222, 0.8);
    this.hpBarBg.fillRect(this.config.x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // HP bar fill
    this.hpBarFill = scene.add.graphics();
    this.hpBarFill.setDepth(depth + 2);

    // Initial draw
    this.drawModule();
    this.updateHpBar();
  }

  /**
   * Call each frame with the player's position.
   * Returns true if the player is within interaction range.
   */
  update(playerX: number, playerY: number): boolean {
    const dx = playerX - this.config.x;
    const dy = playerY - this.config.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.inRange = dist <= INTERACTION_RADIUS;

    // Proximity glow: within HP_SHOW_DISTANCE
    const newGlow = dist <= HP_SHOW_DISTANCE;
    if (newGlow !== this.proximityGlow) {
      this.proximityGlow = newGlow;
      this.drawModule();
    }

    this.updateHpBar(dist);
    return this.inRange;
  }

  isInRange(): boolean {
    return this.inRange;
  }

  /** Set proximity glow state (called by scene for edge glow boost). */
  setProximityGlow(inRange: boolean): void {
    if (inRange !== this.proximityGlow) {
      this.proximityGlow = inRange;
      this.drawModule();
    }
  }

  /** Get module effect percentage for display in prompt bar. */
  getEffectPct(): number {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return 0;
    const P = GAME_CONSTANTS.PURIFICATION;
    if (this.config.type === 'CORE') {
      return Math.round((mod.hp / 100) * P.MAX_CORE_REDUCTION * 100);
    }
    return Math.round((mod.hp / 100) * P.MAX_STORAGE_BONUS * 100);
  }

  /** Get module HP data for prompt display. */
  getHpData(): { hp: number; maxHp: number } | null {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return null;
    return { hp: mod.hp, maxHp: mod.maxHp };
  }

  destroy(): void {
    this.graphics?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
  }

  // ------------------------------------------------------------------ internal

  private drawModule(): void {
    const { x, y, type } = this.config;
    const mainColor = type === 'CORE' ? CORE_MAIN : STORAGE_MAIN;
    const edgeColor = type === 'CORE' ? CORE_EDGE : STORAGE_EDGE;

    const mod = gameState.getModule(this.config.id);
    const hpRatio = mod ? mod.hp / mod.maxHp : 1;

    // Calculate alpha based on HP (spec B1)
    let fillAlpha: number;
    let edgeAlpha: number;
    if (hpRatio >= 0.75) {
      fillAlpha = 0.9;
      edgeAlpha = 0.7;
    } else if (hpRatio >= 0.5) {
      fillAlpha = 0.7;
      edgeAlpha = 0.5;
    } else if (hpRatio >= 0.25) {
      fillAlpha = 0.5;
      edgeAlpha = 0.3;
    } else {
      fillAlpha = 0.3;
      edgeAlpha = 0.15;
    }

    // Proximity glow boost
    if (this.proximityGlow) {
      edgeAlpha = Math.min(1.0, edgeAlpha + 0.2);
    }

    this.graphics.clear();

    if (type === 'CORE') {
      // Hexagon
      const points: Phaser.Geom.Point[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push(new Phaser.Geom.Point(
          x + CORE_RADIUS * Math.cos(angle),
          y + CORE_RADIUS * Math.sin(angle),
        ));
      }
      this.graphics.fillStyle(mainColor, fillAlpha);
      this.graphics.fillPoints(points, true);
      this.graphics.lineStyle(2, edgeColor, edgeAlpha);
      this.graphics.strokePoints(points, true);

      // Danger overlay for critical HP
      if (hpRatio < 0.25) {
        const time = this.scene.time.now;
        const flickerAlpha = 0.1 + Math.abs(Math.sin(time * 0.008)) * 0.2;
        this.graphics.lineStyle(1, DANGER_COLOR, flickerAlpha);
        // Slightly larger hexagon for danger ring
        const dangerPoints: Phaser.Geom.Point[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          dangerPoints.push(new Phaser.Geom.Point(
            x + (CORE_RADIUS + 2) * Math.cos(angle),
            y + (CORE_RADIUS + 2) * Math.sin(angle),
          ));
        }
        this.graphics.strokePoints(dangerPoints, true);
      }
    } else {
      // Square
      this.graphics.fillStyle(mainColor, fillAlpha);
      this.graphics.fillRect(x - STORAGE_HALF, y - STORAGE_HALF, STORAGE_HALF * 2, STORAGE_HALF * 2);
      this.graphics.lineStyle(2, edgeColor, edgeAlpha);
      this.graphics.strokeRect(x - STORAGE_HALF, y - STORAGE_HALF, STORAGE_HALF * 2, STORAGE_HALF * 2);

      // Danger overlay for critical HP
      if (hpRatio < 0.25) {
        const time = this.scene.time.now;
        const flickerAlpha = 0.1 + Math.abs(Math.sin(time * 0.008)) * 0.2;
        this.graphics.lineStyle(1, DANGER_COLOR, flickerAlpha);
        this.graphics.strokeRect(
          x - STORAGE_HALF - 2, y - STORAGE_HALF - 2,
          (STORAGE_HALF + 2) * 2, (STORAGE_HALF + 2) * 2,
        );
      }
    }
  }

  private updateHpBar(distance?: number): void {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return;

    const { x } = this.config;
    const barY = this.getHpBarY();
    const ratio = mod.hp / mod.maxHp;

    // Visibility: show if close enough or HP is low
    const shouldShow = (distance !== undefined && distance <= HP_SHOW_DISTANCE) || ratio < 0.5;
    const barAlpha = shouldShow ? 1 : 0.15;

    // Background
    this.hpBarBg.clear();
    this.hpBarBg.fillStyle(this.config.type === 'CORE' ? 0x222233 : 0x332222, barAlpha * 0.8);
    this.hpBarBg.fillRect(x - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // Fill (same color as module, or danger red when critical)
    const fillColor = ratio < 0.25 ? DANGER_COLOR :
      (this.config.type === 'CORE' ? CORE_MAIN : STORAGE_MAIN);

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(fillColor, barAlpha);
    this.hpBarFill.fillRect(
      x - HP_BAR_WIDTH / 2,
      barY,
      HP_BAR_WIDTH * ratio,
      HP_BAR_HEIGHT,
    );

    // Redraw module shape (needed for flicker animation when HP < 25%)
    if (ratio < 0.25) {
      this.drawModule();
    }
  }

  private getHpBarY(): number {
    const { y, type } = this.config;
    // Position below module body
    if (type === 'CORE') {
      return y + CORE_RADIUS + HP_BAR_GAP;
    }
    return y + STORAGE_HALF + HP_BAR_GAP;
  }
}
