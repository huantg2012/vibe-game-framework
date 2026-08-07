/**
 * HUD - minimal in-game overlay for the rift scene.
 *
 * Entirely event-driven: no per-frame setText calls. Each element updates only
 * when its backing event fires, which keeps the cost at zero on quiet frames.
 *
 * Uses Phaser Graphics + Text with scrollFactor 0, depth 100.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HUD_DEPTH = 100;
const BAR_HEIGHT = 6;
const BAR_MARGIN = 8;
const CHAOS_BAR_WIDTH = 120;
const HEALTH_BAR_WIDTH = 80;
const CHAOS_COLOR = 0x1aad96;
const HEALTH_COLOR = 0xffffff;
const KINDLING_COLOR = '#c89040';
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.4;
const PULSE_PERIOD_MS = 300;

// ---------------------------------------------------------------------------
// HUD class
// ---------------------------------------------------------------------------

export interface HUDConfig {
  canExtract: () => boolean;
  isRunEnded: () => boolean;
  getPeakChaos: () => number;
  getElapsedMs: () => number;
}

export class HUD {
  private config!: HUDConfig;

  // Graphics containers
  private chaosBarBg!: Phaser.GameObjects.Rectangle;
  private chaosBarFill!: Phaser.GameObjects.Rectangle;
  private chaosTick50!: Phaser.GameObjects.Rectangle;
  private chaosTick75!: Phaser.GameObjects.Rectangle;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private kindlingText!: Phaser.GameObjects.Text;
  private extractPrompt!: Phaser.GameObjects.Text;

  // Result panel
  private resultPanel!: Phaser.GameObjects.Container;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultBody!: Phaser.GameObjects.Text;

  // State
  private chaosValue = 0;
  private overflowPulseMs = 0;
  private healthFrac = 1;
  private kindling = 0;

  // Event references for cleanup
  private readonly onChaosChanged: (payload: { value: number; rate: number }) => void;
  private readonly onHealthChanged: (payload: { current: number; max: number }) => void;
  private readonly onKindlingCollected: (payload: { amount: number; total: number }) => void;
  private readonly onRiftExited: (payload: { kindlingGained: number; survived: boolean }) => void;

  constructor() {
    this.onChaosChanged = (payload) => {
      this.chaosValue = payload.value;
      this.updateChaosBar();
    };
    this.onHealthChanged = (payload) => {
      this.healthFrac = payload.max > 0 ? payload.current / payload.max : 0;
      this.updateHealthBar();
    };
    this.onKindlingCollected = (payload) => {
      this.kindling = payload.total;
      this.updateKindlingText();
    };
    this.onRiftExited = (payload) => {
      this.showResultPanel(payload.survived, payload.kindlingGained);
    };
  }

  create(scene: Phaser.Scene, config: HUDConfig): void {
    this.config = config;
    this.chaosValue = 0;
    this.healthFrac = 1;
    this.kindling = 0;
    this.overflowPulseMs = 0;

    const cam = scene.cameras.main;
    const w = cam.width / cam.zoomX;
    const h = cam.height / cam.zoomY;

    // --- Chaos bar (top center) ---
    const chaosX = (w - CHAOS_BAR_WIDTH) / 2;
    const chaosY = BAR_MARGIN;

    this.chaosBarBg = scene.add
      .rectangle(chaosX, chaosY, CHAOS_BAR_WIDTH, BAR_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.chaosBarFill = scene.add
      .rectangle(chaosX, chaosY, 0, BAR_HEIGHT, CHAOS_COLOR)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);

    // Tick marks at 50% and 75%
    const tick50X = chaosX + CHAOS_BAR_WIDTH * 0.5;
    const tick75X = chaosX + CHAOS_BAR_WIDTH * 0.75;
    this.chaosTick50 = scene.add
      .rectangle(tick50X, chaosY, 1, BAR_HEIGHT, 0xffffff, 0.4)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2);
    this.chaosTick75 = scene.add
      .rectangle(tick75X, chaosY, 1, BAR_HEIGHT, 0xffffff, 0.4)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2);

    // --- Health bar (top left) ---
    this.healthBarBg = scene.add
      .rectangle(BAR_MARGIN, BAR_MARGIN, HEALTH_BAR_WIDTH, BAR_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.healthBarFill = scene.add
      .rectangle(BAR_MARGIN, BAR_MARGIN, HEALTH_BAR_WIDTH, BAR_HEIGHT, HEALTH_COLOR)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);

    // --- Kindling count (top right) ---
    this.kindlingText = scene.add
      .text(w - BAR_MARGIN, BAR_MARGIN, '0', {
        fontSize: '12px',
        color: KINDLING_COLOR,
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    // --- Extract prompt (bottom center) ---
    this.extractPrompt = scene.add
      .text(w / 2, h - BAR_MARGIN * 3, '按 E 撤离', {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setVisible(false);

    // --- Result panel (center, hidden) ---
    this.resultTitle = scene.add
      .text(0, -30, '', {
        fontSize: '16px',
        color: '#ffffff',
        fontFamily: 'monospace',
        align: 'center',
      })
      .setOrigin(0.5, 0.5);

    this.resultBody = scene.add
      .text(0, 10, '', {
        fontSize: '11px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
        align: 'center',
      })
      .setOrigin(0.5, 0);

    this.resultPanel = scene.add
      .container(w / 2, h / 2, [this.resultTitle, this.resultBody])
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 10)
      .setVisible(false);

    // Subscribe to events
    eventBus.on(GameEvent.CHAOS_CHANGED, this.onChaosChanged);
    eventBus.on(GameEvent.PLAYER_HEALTH_CHANGED, this.onHealthChanged);
    eventBus.on(GameEvent.KINDLING_COLLECTED, this.onKindlingCollected);
    eventBus.on(GameEvent.RIFT_EXITED, this.onRiftExited);
  }

  /** Called from scene update for pulse animation and extract prompt visibility. */
  update(deltaMs: number): void {
    // Overflow pulse on chaos bar
    if (this.chaosValue > GAME_CONSTANTS.CHAOS.MAX_VALUE) {
      this.overflowPulseMs += deltaMs;
      const phase = (this.overflowPulseMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      const alpha = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      this.chaosBarFill.setAlpha(alpha);
    } else {
      this.overflowPulseMs = 0;
      this.chaosBarFill.setAlpha(1);
    }

    // Extract prompt visibility (only when near extraction and run not ended)
    if (!this.config.isRunEnded() && this.config.canExtract()) {
      this.extractPrompt.setVisible(true);
    } else {
      this.extractPrompt.setVisible(false);
    }
  }

  reset(): void {
    this.chaosValue = 0;
    this.healthFrac = 1;
    this.kindling = 0;
    this.overflowPulseMs = 0;
    this.updateChaosBar();
    this.updateHealthBar();
    this.updateKindlingText();
    this.resultPanel.setVisible(false);
    this.extractPrompt.setVisible(false);
  }

  destroy(): void {
    eventBus.off(GameEvent.CHAOS_CHANGED, this.onChaosChanged);
    eventBus.off(GameEvent.PLAYER_HEALTH_CHANGED, this.onHealthChanged);
    eventBus.off(GameEvent.KINDLING_COLLECTED, this.onKindlingCollected);
    eventBus.off(GameEvent.RIFT_EXITED, this.onRiftExited);

    this.chaosBarBg?.destroy();
    this.chaosBarFill?.destroy();
    this.chaosTick50?.destroy();
    this.chaosTick75?.destroy();
    this.healthBarBg?.destroy();
    this.healthBarFill?.destroy();
    this.kindlingText?.destroy();
    this.extractPrompt?.destroy();
    this.resultPanel?.destroy();
  }

  // ------------------------------------------------------------------ internal

  private updateChaosBar(): void {
    const frac = Math.min(this.chaosValue / GAME_CONSTANTS.CHAOS.MAX_VALUE, 1.0);
    this.chaosBarFill.width = CHAOS_BAR_WIDTH * frac;
  }

  private updateHealthBar(): void {
    this.healthBarFill.width = HEALTH_BAR_WIDTH * this.healthFrac;
  }

  private updateKindlingText(): void {
    this.kindlingText.setText(String(this.kindling));
  }

  private showResultPanel(survived: boolean, kindlingGained: number): void {
    this.extractPrompt.setVisible(false);
    this.resultPanel.setVisible(true);

    if (survived) {
      this.resultTitle.setText('撤离成功');
    } else {
      this.resultTitle.setText('阵亡');
    }

    const elapsed = Math.round(this.config.getElapsedMs() / 1000);
    const peak = Math.round(this.config.getPeakChaos());
    const lines = [
      `薪柴: ${kindlingGained}`,
      `峰值混乱: ${peak}`,
      `用时: ${elapsed}s`,
      '',
      survived ? '按 R 返回净化点' : '按 R 重新出击',
    ];
    this.resultBody.setText(lines.join('\n'));
  }
}
