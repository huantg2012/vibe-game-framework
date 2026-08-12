/**
 * HUD - in-game overlay for the rift scene (A-class world-in-device readout,
 * ui-art-overhaul.md v2 §A0 #2/#3/#4).
 *
 * Entirely event-driven where possible: most elements update only when their
 * backing event fires. The status-effect countdown and the chaos tier tag are the
 * two exceptions - they need per-frame decay, gated behind a "did the rendered
 * string actually change" check so `setText` only runs when content changes.
 *
 * Layout follows the P1 information set locked in `docs/design-notes/
 * ux-information-architecture.md` S10: HP + chaos + active-effects cluster
 * (top-left), kindling (top-right), tool slots (bottom-left), context prompt
 * (bottom-center). The screen-center ±120x80 exclusion zone and "no被发现指示 this
 * batch" (DEC-045 D8, deferred to Slice 6) are both honoured by construction - no
 * element in this file is placed inside that zone.
 *
 * Uses Phaser Graphics + Text with scrollFactor 0, depth 100.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import type { ContaminantType } from '@/types/game-types';
import { GameEvent } from '@/types/events';

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HUD_DEPTH = 100;
const BAR_HEIGHT = 4;
const BAR_MARGIN = 8;
const CHAOS_BAR_WIDTH = 90;
const HEALTH_BAR_WIDTH = 50;
const CHAOS_COLOR = 0x1aad96;
const HEALTH_COLOR = 0x8a8f96;
const HEALTH_LOW_COLOR = 0xcc3333;
const HEALTH_LOW_THRESHOLD = 0.25;
const KINDLING_COLOR = '#c4873a';
const TEXT_BRIGHT = '#c8cdd4';
const TEXT_DIM = '#8a8f96';
const TEXT_EXHAUSTED = '#5a5f66'; // A1: exhausted-state is the one text use this colour permits
const BG_COLOR = 0x000000;
const BG_ALPHA = 0.4;
const PULSE_PERIOD_MS = 300;

/** 混乱 tier tag — thematic escalation words (world.md "渗透/侵蚀/临界"), not admin
 *  severity words. Mirrors `ChaosSystem.getStage()`'s thresholds without importing it
 *  (HUD only receives CHAOS_CHANGED's raw value over the bus). */
function chaosTierLabel(value: number): string {
  const C = GAME_CONSTANTS.CHAOS;
  if (value < C.THRESHOLD_1) return '稳定';
  if (value < C.THRESHOLD_2) return '渗透';
  if (value < C.THRESHOLD_3) return '侵蚀';
  return '临界';
}

// ---------------------------------------------------------------------------
// HUD class
// ---------------------------------------------------------------------------

export interface ToolSlotInfo {
  /** Hotkey label ('Q'/'F'/'G') or '被动' for the passive slot. */
  label: string;
  /** Type id, used to match TOOL_USED payloads - never used for display. */
  type: ContaminantType;
  /** Display name, already resolved by the caller via `getToolName()`. */
  name: string;
  usesRemaining: number;
  isPassive: boolean;
}

/** A sortie-duration status effect line (IA S10 "生效中状态"). */
export interface ActiveEffectInfo {
  /** Pre-formatted line, e.g. "移速 -10%". Resolved by the caller, which owns the
   *  CSV source name and the effect-specific phrasing. */
  label: string;
  /** ms remaining; omitted = lasts the whole sortie (no countdown shown). */
  remainingMs?: number;
}

export interface HUDConfig {
  canExtract: () => boolean;
  isRunEnded: () => boolean;
  /** Sortie loadout slots (max 4: Q, F, G, Passive). Undefined if no loadout. */
  toolSlots?: ToolSlotInfo[];
}

export class HUD {
  private config!: HUDConfig;

  // Status cluster (top-left): HP + chaos + active effects
  private healthLabel!: Phaser.GameObjects.Text;
  private healthBarBg!: Phaser.GameObjects.Rectangle;
  private healthBarFill!: Phaser.GameObjects.Rectangle;
  private healthValueText!: Phaser.GameObjects.Text;
  private chaosBarBg!: Phaser.GameObjects.Rectangle;
  private chaosBarFill!: Phaser.GameObjects.Rectangle;
  private chaosTick50!: Phaser.GameObjects.Rectangle;
  private chaosTick75!: Phaser.GameObjects.Rectangle;
  private chaosValueText!: Phaser.GameObjects.Text;
  private effectsText!: Phaser.GameObjects.Text;
  private lastEffectsString = '';

  private kindlingText!: Phaser.GameObjects.Text;
  private pickupFlash: Phaser.GameObjects.Text | null = null;
  private pickupFlashTween: Phaser.Tweens.Tween | null = null;
  private extractPrompt!: Phaser.GameObjects.Text;

  // Tool slot display (bottom left)
  private toolSlotText: Phaser.GameObjects.Text | null = null;
  private toolSlotData: ToolSlotInfo[] = [];
  private passiveFlash: Phaser.GameObjects.Text | null = null;
  private passiveFlashTween: Phaser.Tweens.Tween | null = null;

  // State
  private scene!: Phaser.Scene;
  private chaosValue = 0;
  private overflowPulseMs = 0;
  private healthPulseMs = 0;
  private healthCurrent = 0;
  private healthMax = 1;
  private healthFrac = 1;
  private kindling = 0;
  private activeEffects: ActiveEffectInfo[] = [];

  // Event references for cleanup
  private readonly onChaosChanged: (payload: { value: number; rate: number }) => void;
  private readonly onHealthChanged: (payload: { current: number; max: number }) => void;
  private readonly onKindlingCollected: (payload: { amount: number; total: number }) => void;
  private readonly onToolUsed: (payload: { contaminantId: string; toolType: ContaminantType; usesLeft: number }) => void;

  constructor() {
    this.onChaosChanged = (payload) => {
      this.chaosValue = payload.value;
      this.updateChaosBar();
    };
    this.onHealthChanged = (payload) => {
      this.healthCurrent = payload.current;
      this.healthMax = payload.max;
      this.healthFrac = payload.max > 0 ? payload.current / payload.max : 0;
      this.updateHealthBar();
    };
    this.onKindlingCollected = (payload) => {
      if (!this.scene?.scene?.isActive()) return;
      this.kindling = payload.total;
      this.updateKindlingText();
      this.showPickupFlash(payload.amount);
    };
    this.onToolUsed = (payload) => {
      const slot = this.toolSlotData.find((s) => s.type === payload.toolType && s.usesRemaining > payload.usesLeft);
      if (slot) {
        slot.usesRemaining = payload.usesLeft;
        if (slot.isPassive) this.showPassiveFlash(slot.name);
      }
      this.updateToolSlotText();
    };
  }

  create(scene: Phaser.Scene, config: HUDConfig): void {
    this.scene = scene;
    this.config = config;
    this.chaosValue = 0;
    this.healthFrac = 1;
    this.healthCurrent = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.healthMax = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.kindling = 0;
    this.overflowPulseMs = 0;
    this.healthPulseMs = 0;
    this.activeEffects = [];
    this.lastEffectsString = '';
    this.pickupFlash = null;
    this.pickupFlashTween = null;
    this.passiveFlash = null;
    this.passiveFlashTween = null;

    const cam = scene.cameras.main;
    const w = cam.width / cam.zoomX;
    const h = cam.height / cam.zoomY;

    // --- Status cluster (top-left): HP row, chaos row, active-effects lines ---
    const clusterX = BAR_MARGIN;
    const hpY = BAR_MARGIN;
    const chaosY = hpY + 12;
    const effectsY = chaosY + 12;

    this.healthLabel = scene.add
      .text(clusterX, hpY, 'HP', { fontSize: '9px', color: TEXT_DIM, fontFamily: 'monospace' })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    const hpBarX = clusterX + 18;
    this.healthBarBg = scene.add
      .rectangle(hpBarX, hpY + 1, HEALTH_BAR_WIDTH, BAR_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setStrokeStyle(1, 0x0f1114);
    this.healthBarFill = scene.add
      .rectangle(hpBarX, hpY + 1, HEALTH_BAR_WIDTH, BAR_HEIGHT, HEALTH_COLOR)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);
    this.healthValueText = scene.add
      .text(hpBarX + HEALTH_BAR_WIDTH + 4, hpY, '', { fontSize: '9px', color: TEXT_BRIGHT, fontFamily: 'monospace' })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.chaosBarBg = scene.add
      .rectangle(clusterX, chaosY + 1, CHAOS_BAR_WIDTH, BAR_HEIGHT, BG_COLOR, BG_ALPHA)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setStrokeStyle(1, 0x0f1114);
    this.chaosBarFill = scene.add
      .rectangle(clusterX, chaosY + 1, 0, BAR_HEIGHT, CHAOS_COLOR)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 1);

    // Tick marks at 50% and 75% - kept as the visual encoding; the tier word in
    // chaosValueText is the textual second encoding (A1 "第二重编码").
    const tick50X = clusterX + CHAOS_BAR_WIDTH * 0.5;
    const tick75X = clusterX + CHAOS_BAR_WIDTH * 0.75;
    this.chaosTick50 = scene.add
      .rectangle(tick50X, chaosY + 1, 1, BAR_HEIGHT, 0xffffff, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2);
    this.chaosTick75 = scene.add
      .rectangle(tick75X, chaosY + 1, 1, BAR_HEIGHT, 0xffffff, 0.3)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH + 2);

    this.chaosValueText = scene.add
      .text(clusterX + CHAOS_BAR_WIDTH + 4, chaosY, '', { fontSize: '9px', color: TEXT_BRIGHT, fontFamily: 'monospace' })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    this.effectsText = scene.add
      .text(clusterX, effectsY, '', {
        fontSize: '9px',
        color: TEXT_DIM,
        fontFamily: 'monospace',
        lineSpacing: 2,
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    // --- Kindling count (top right) ---
    this.kindlingText = scene.add
      .text(w - BAR_MARGIN, BAR_MARGIN, '◇ 0', {
        fontSize: '10px',
        color: KINDLING_COLOR,
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    // --- Extract prompt (bottom center) ---
    this.extractPrompt = scene.add
      .text(w / 2, h - BAR_MARGIN * 3, '按 E 撤离', {
        fontSize: '10px',
        color: TEXT_BRIGHT,
        fontFamily: 'monospace',
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH)
      .setVisible(false);

    // --- Tool slot display (bottom left) ---
    this.toolSlotData = config.toolSlots ? config.toolSlots.map((s) => ({ ...s })) : [];
    if (this.toolSlotData.length > 0) {
      this.toolSlotText = scene.add
        .text(BAR_MARGIN, h - BAR_MARGIN, '', {
          fontSize: '10px', // H2 tier (A3): tool identity names, not mere labels
          color: TEXT_BRIGHT,
          fontFamily: 'monospace',
        })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH);
      this.updateToolSlotText();
    } else {
      this.toolSlotText = null;
    }

    this.updateHealthBar();
    this.updateChaosBar();

    // Subscribe to events
    eventBus.on(GameEvent.CHAOS_CHANGED, this.onChaosChanged);
    eventBus.on(GameEvent.PLAYER_HEALTH_CHANGED, this.onHealthChanged);
    eventBus.on(GameEvent.KINDLING_COLLECTED, this.onKindlingCollected);
    eventBus.on(GameEvent.TOOL_USED, this.onToolUsed);
  }

  /**
   * Sets the sortie-duration status effects (defense side-effects carried into this
   * sortie). Replaces the old "3s toast then gone" behaviour (ui-art-overhaul.md
   * §A5-2 "生效中状态"): these render as a persistent HUD line for as long as they
   * are active, not a transient notification.
   */
  setActiveEffects(effects: ActiveEffectInfo[]): void {
    this.activeEffects = effects.map((e) => ({ ...e }));
    this.renderEffectsText();
  }

  /** Called from scene update for pulse animation, effect countdowns and prompt visibility. */
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

    // Health bar low-HP pulse
    if (this.healthFrac < HEALTH_LOW_THRESHOLD) {
      this.healthPulseMs += deltaMs;
      const phase = (this.healthPulseMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
      const alpha = 0.6 + 0.4 * Math.sin(phase * Math.PI * 2);
      this.healthBarFill.setAlpha(alpha);
      this.healthBarFill.setFillStyle(HEALTH_LOW_COLOR);
    } else {
      this.healthPulseMs = 0;
      this.healthBarFill.setAlpha(1);
      this.healthBarFill.setFillStyle(HEALTH_COLOR);
    }

    // Active-effect countdowns
    if (this.activeEffects.length > 0) {
      let changed = false;
      for (const e of this.activeEffects) {
        if (e.remainingMs === undefined) continue;
        e.remainingMs -= deltaMs;
        changed = true;
      }
      if (changed) {
        const before = this.activeEffects.length;
        this.activeEffects = this.activeEffects.filter((e) => e.remainingMs === undefined || e.remainingMs > 0);
        if (this.activeEffects.length !== before || changed) this.renderEffectsText();
      }
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
    this.healthCurrent = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.healthMax = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.kindling = 0;
    this.overflowPulseMs = 0;
    this.healthPulseMs = 0;
    this.activeEffects = [];
    this.lastEffectsString = '';
    this.updateChaosBar();
    this.updateHealthBar();
    this.updateKindlingText();
    this.renderEffectsText();
    this.extractPrompt.setVisible(false);
    if (this.pickupFlashTween) {
      this.pickupFlashTween.stop();
      this.pickupFlashTween = null;
    }
    this.pickupFlash?.setVisible(false);
    if (this.passiveFlashTween) {
      this.passiveFlashTween.stop();
      this.passiveFlashTween = null;
    }
    this.passiveFlash?.setVisible(false);
  }

  destroy(): void {
    eventBus.off(GameEvent.CHAOS_CHANGED, this.onChaosChanged);
    eventBus.off(GameEvent.PLAYER_HEALTH_CHANGED, this.onHealthChanged);
    eventBus.off(GameEvent.KINDLING_COLLECTED, this.onKindlingCollected);
    eventBus.off(GameEvent.TOOL_USED, this.onToolUsed);

    if (this.pickupFlashTween) {
      this.pickupFlashTween.stop();
      this.pickupFlashTween = null;
    }
    if (this.passiveFlashTween) {
      this.passiveFlashTween.stop();
      this.passiveFlashTween = null;
    }

    this.healthLabel?.destroy();
    this.healthBarBg?.destroy();
    this.healthBarFill?.destroy();
    this.healthValueText?.destroy();
    this.chaosBarBg?.destroy();
    this.chaosBarFill?.destroy();
    this.chaosTick50?.destroy();
    this.chaosTick75?.destroy();
    this.chaosValueText?.destroy();
    this.effectsText?.destroy();
    this.kindlingText?.destroy();
    this.pickupFlash?.destroy();
    this.passiveFlash?.destroy();
    this.extractPrompt?.destroy();
    this.toolSlotText?.destroy();
  }

  // ------------------------------------------------------------------ internal

  private updateChaosBar(): void {
    const frac = Math.min(this.chaosValue / GAME_CONSTANTS.CHAOS.MAX_VALUE, 1.0);
    this.chaosBarFill.width = CHAOS_BAR_WIDTH * frac;
    this.chaosValueText.setText(`${Math.round(this.chaosValue)} 混乱 · ${chaosTierLabel(this.chaosValue)}`);
  }

  private updateHealthBar(): void {
    this.healthBarFill.width = HEALTH_BAR_WIDTH * this.healthFrac;
    this.healthValueText.setText(`${Math.round(this.healthCurrent)}/${Math.round(this.healthMax)}`);
  }

  private updateKindlingText(): void {
    this.kindlingText.setText(`◇ ${this.kindling}`);
  }

  private renderEffectsText(): void {
    const lines = this.activeEffects.map((e) =>
      e.remainingMs !== undefined ? `${e.label} · ${Math.ceil(e.remainingMs / 1000)}s` : e.label,
    );
    const next = lines.join('\n');
    if (next === this.lastEffectsString) return;
    this.lastEffectsString = next;
    this.effectsText.setText(next);
    // Reflow tool slot text vertical position is fixed (bottom-anchored), so the
    // effects block growing/shrinking never pushes into the centre exclusion zone
    // (IA S10 constraint) - it only ever grows downward from a fixed top anchor.
  }

  private showPickupFlash(amount: number): void {
    if (!this.scene.scene.isActive()) return;

    if (this.pickupFlashTween) {
      this.pickupFlashTween.stop();
      this.pickupFlashTween = null;
    }

    const cam = this.scene.cameras.main;
    const w = cam.width / cam.zoomX;
    const flashX = w - BAR_MARGIN - this.kindlingText.width - 4;

    if (this.pickupFlash) {
      this.pickupFlash.setText(`+${amount}`);
      this.pickupFlash.setPosition(flashX, BAR_MARGIN);
      this.pickupFlash.setAlpha(1);
      this.pickupFlash.setVisible(true);
    } else {
      this.pickupFlash = this.scene.add
        .text(flashX, BAR_MARGIN, `+${amount}`, {
          fontSize: '10px',
          color: KINDLING_COLOR,
          fontFamily: 'monospace',
        })
        .setOrigin(1, 0)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH);
    }

    this.pickupFlashTween = this.scene.tweens.add({
      targets: this.pickupFlash,
      alpha: 0,
      duration: 800,
      ease: 'Linear',
      onComplete: () => {
        this.pickupFlash?.setVisible(false);
        this.pickupFlashTween = null;
      },
    });
  }

  /**
   * toast-inline over the passive slot (ui-art-overhaul.md §A4/A6 "toast-inline"
   * variant, Phaser-side render since the HUD is an A-class device readout, not a
   * DOM terminal - "同类载体用同类语言" §A0). Gives the three passive tools
   * (碎影/消声步/寄生引流) a perceptible trigger instead of a silently-shrinking dot.
   */
  private showPassiveFlash(name: string): void {
    if (!this.scene.scene.isActive() || !this.toolSlotText) return;

    if (this.passiveFlashTween) {
      this.passiveFlashTween.stop();
      this.passiveFlashTween = null;
    }

    const cam = this.scene.cameras.main;
    const h = cam.height / cam.zoomY;
    const y = h - BAR_MARGIN - 12;

    if (this.passiveFlash) {
      this.passiveFlash.setText(`${name} · 生效`);
      this.passiveFlash.setPosition(BAR_MARGIN, y);
      this.passiveFlash.setAlpha(1);
      this.passiveFlash.setVisible(true);
    } else {
      this.passiveFlash = this.scene.add
        .text(BAR_MARGIN, y, `${name} · 生效`, {
          fontSize: '10px', // H2 tier (A3): carries a tool identity name
          color: '#1aad96',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(HUD_DEPTH);
    }

    this.passiveFlashTween = this.scene.tweens.add({
      targets: this.passiveFlash,
      alpha: 0,
      duration: 800,
      ease: 'Linear',
      onComplete: () => {
        this.passiveFlash?.setVisible(false);
        this.passiveFlashTween = null;
      },
    });
  }

  private updateToolSlotText(): void {
    if (!this.toolSlotText) return;

    const parts: string[] = [];
    for (const slot of this.toolSlotData) {
      const dots = '●'.repeat(slot.usesRemaining);
      const key = slot.isPassive ? '被动' : slot.label;
      parts.push(`[${key}] ${slot.name}${dots || '—'}`);
    }
    this.toolSlotText.setText(parts.join('  '));

    const anyActive = this.toolSlotData.some((s) => s.usesRemaining > 0);
    this.toolSlotText.setColor(anyActive ? TEXT_BRIGHT : TEXT_EXHAUSTED);
  }
}
