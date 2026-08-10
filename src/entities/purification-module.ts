/**
 * PurificationModule entity - visual representation of a module in the purification scene.
 *
 * Each module is a coloured geometric shape (BARRIER=blue hexagon, STORAGE=orange square)
 * with an hp bar and proximity-based interaction prompt.
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
const BARRIER_COLOR = 0x4488cc;
const STORAGE_COLOR = 0xcc8844;
const HP_BAR_WIDTH = 32;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = -24;

// ---------------------------------------------------------------------------
// PurificationModuleEntity
// ---------------------------------------------------------------------------

export class PurificationModuleEntity {
  private graphics!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private promptText!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private effectText!: Phaser.GameObjects.Text;

  private readonly config: ModuleEntityConfig;
  private inRange = false;

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
    const { x, y, type } = this.config;
    const color = type === 'BARRIER' ? BARRIER_COLOR : STORAGE_COLOR;
    const depth = 20;

    // Module shape
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(depth);
    if (type === 'BARRIER') {
      this.drawHexagon(x, y, 14, color);
    } else {
      this.graphics.fillStyle(color, 1);
      this.graphics.fillRect(x - 12, y - 12, 24, 24);
      this.graphics.lineStyle(1, 0xffffff, 0.3);
      this.graphics.strokeRect(x - 12, y - 12, 24, 24);
    }

    // Label
    const label = type === 'BARRIER' ? '屏障' : '储藏';
    this.labelText = scene.add.text(x, y + 20, label, {
      fontSize: '9px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth + 1);

    // A3: Effect value text below the label
    this.effectText = scene.add.text(x, y + 30, '', {
      fontSize: '9px',
      color: '#888888',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5).setDepth(depth + 1);
    this.updateEffectText();

    // HP bar background
    this.hpBarBg = scene.add.graphics();
    this.hpBarBg.setDepth(depth + 1);
    this.hpBarBg.fillStyle(0x222222, 0.8);
    this.hpBarBg.fillRect(x - HP_BAR_WIDTH / 2, y + HP_BAR_OFFSET_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT);

    // HP bar fill
    this.hpBarFill = scene.add.graphics();
    this.hpBarFill.setDepth(depth + 2);

    // Interaction prompt (hidden by default)
    this.promptText = scene.add.text(x, y - 34, 'E - 分配薪柴', {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'monospace',
      align: 'center',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(depth + 3).setVisible(false);

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
    const wasInRange = this.inRange;
    this.inRange = dist <= INTERACTION_RADIUS;

    if (this.inRange !== wasInRange) {
      this.promptText.setVisible(this.inRange);
    }

    this.updateHpBar();
    return this.inRange;
  }

  isInRange(): boolean {
    return this.inRange;
  }

  destroy(): void {
    this.graphics?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFill?.destroy();
    this.promptText?.destroy();
    this.labelText?.destroy();
    this.effectText?.destroy();
  }

  // ------------------------------------------------------------------ internal

  private updateHpBar(): void {
    const mod = gameState.getModule(this.config.id);
    if (!mod) return;

    const { x, y } = this.config;
    const ratio = mod.hp / mod.maxHp;
    const color = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xcccc44 : 0xcc4444;

    this.hpBarFill.clear();
    this.hpBarFill.fillStyle(color, 1);
    this.hpBarFill.fillRect(
      x - HP_BAR_WIDTH / 2,
      y + HP_BAR_OFFSET_Y,
      HP_BAR_WIDTH * ratio,
      HP_BAR_HEIGHT,
    );

    this.updateEffectText();
  }

  /** A3: Show current effect value below the module label. */
  private updateEffectText(): void {
    if (!this.effectText) return;
    const mod = gameState.getModule(this.config.id);
    if (!mod) return;
    const P = GAME_CONSTANTS.PURIFICATION;
    if (this.config.type === 'BARRIER') {
      const pct = Math.round((mod.hp / 100) * P.MAX_BARRIER_REDUCTION * 100);
      this.effectText.setText(`混乱抑制 -${pct}%`);
    } else {
      const pct = Math.round((mod.hp / 100) * P.MAX_STORAGE_BONUS * 100);
      this.effectText.setText(`薪柴增幅 +${pct}%`);
    }
  }

  private drawHexagon(cx: number, cy: number, radius: number, color: number): void {
    this.graphics.fillStyle(color, 1);
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push(new Phaser.Geom.Point(
        cx + radius * Math.cos(angle),
        cy + radius * Math.sin(angle),
      ));
    }
    this.graphics.fillPoints(points, true);
    this.graphics.lineStyle(1, 0xffffff, 0.3);
    this.graphics.strokePoints(points, true);
  }
}
