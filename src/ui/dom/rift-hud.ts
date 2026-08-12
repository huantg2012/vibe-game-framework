/**
 * RiftHud - DOM overlay for the rift scene (A-class world-in-device readout,
 * ui-art-overhaul.md v2 §A0 #2/#3/#4).
 *
 * Slice 5.5 playtest fix (人反馈 #1, "rift 场景看不到 HUD"): this used to be Phaser
 * Graphics/Text with `setScrollFactor(0)`, anchored in the `cam.width/zoomX`
 * (640x427) coordinate space. scrollFactor(0) does not exempt a game object from
 * the camera's zoom transform - zoom scales around the viewport centre, so at
 * ZOOM=1.5 every corner-anchored element (HP top-left, kindling top-right, tool
 * slots bottom-left, extract prompt bottom-centre) rendered outside the visible
 * viewport entirely (rift-scene.ts's own dev-overlay comment already documented
 * this exact Phaser behaviour for a different element - this HUD just hadn't been
 * moved onto the same fix yet). Moving the HUD into the DOM under `#dom-ui-root`
 * sidesteps the whole bug class: that root tracks the canvas's actual on-screen CSS
 * box directly (`panel-styles.ts` `bindDomUiRootToGame`), independent of whatever
 * the Phaser camera's zoom is doing - 1 declared px here is always 1 on-screen px.
 *
 * Content parity with the old Phaser HUD is intentional (IA S10 P1 set): HP
 * (label+bar+value), chaos (bar+50/75 ticks+value+tier word), kindling, tool slots
 * (key+name+uses), active-effect lines, extract prompt, pickup/passive toasts. Same
 * layout, same information - technology only.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import type { ContaminantType } from '@/types/game-types';
import { GameEvent } from '@/types/events';
import { getDomUiRoot, showToastInline } from './panel-styles';

// ---------------------------------------------------------------------------
// Layout constants (DOM px, 960x640 logical canvas - ui-art-overhaul.md §A1
// "对齐规则": 1 DOM CSS px (声明值) ⇔ 1 Phaser 逻辑画布 px. The old Phaser HUD's
// coordinates were declared in the pre-zoom `cam.width/zoomX` space (640x427 at
// ZOOM=1.5), so every position/size below is the old value x1.5 to land on the
// same on-screen spot the design already specified.
// ---------------------------------------------------------------------------

const MARGIN = 12; // was BAR_MARGIN 8
const CHAOS_ROW_TOP = 30; // was hpY(8) + 12, i.e. (8+12)*1.5
const EFFECTS_ROW_TOP = 48; // was hpY(8) + 12 + 12, i.e. (8+24)*1.5
const HEALTH_BAR_WIDTH = 75; // was 50
const CHAOS_BAR_WIDTH = 135; // was 90
const BAR_HEIGHT = 6; // was 4

const CHAOS_COLOR = '#1aad96';
const HEALTH_COLOR = '#8a8f96';
const HEALTH_LOW_COLOR = '#cc3333';
const HEALTH_LOW_THRESHOLD = 0.25;
const KINDLING_COLOR = '#c4873a';
const TEXT_BRIGHT = '#c8cdd4';
const TEXT_DIM = '#8a8f96';
const TEXT_EXHAUSTED = '#5a5f66'; // A1: exhausted-state is the one text use this colour permits
const TEXT_SHADOW = '0 0 2px rgba(0,0,0,0.8)';
const FONT = "'Courier New', monospace";

const PULSE_STYLE_ID = 'rift-hud-pulse-style';

/** Idempotent - same critical-pulse idiom as purification-hud.ts's
 *  `hud-critical-pulse` (alpha 0.6-1.0, 300ms cycle, ui-art-overhaul.md A6). Moving
 *  the pulse into CSS (vs. the old per-frame JS alpha write) means low-HP / chaos-
 *  overflow no longer need a per-frame update - they're driven by their own change
 *  events, same as every other readout here. */
function ensurePulseKeyframes(): void {
  if (document.getElementById(PULSE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PULSE_STYLE_ID;
  style.textContent = `@keyframes rift-hud-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }`;
  document.head.appendChild(style);
}

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
// RiftHud class
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

export class RiftHud {
  private config!: HUDConfig;
  private active = false;

  // Root + status cluster (top-left): HP row, chaos row, active-effects lines
  private root: HTMLDivElement | null = null;
  private hpFill!: HTMLDivElement;
  private hpValue!: HTMLSpanElement;
  private chaosFill!: HTMLDivElement;
  private chaosValueEl!: HTMLSpanElement;
  private effectsEl!: HTMLDivElement;
  private lastEffectsString = '';

  private kindlingEl!: HTMLDivElement;
  private extractPromptEl!: HTMLDivElement;
  private extractPromptVisible = false;

  // Tool slot display (bottom left)
  private toolSlotEl: HTMLDivElement | null = null;
  private toolSlotData: ToolSlotInfo[] = [];

  // State
  private chaosValue = 0;
  private healthCurrent = 0;
  private healthMax = 1;
  private healthFrac = 1;
  private kindling = 0;
  private activeEffects: ActiveEffectInfo[] = [];

  // Event references for cleanup
  private readonly onChaosChanged = (payload: { value: number; rate: number }): void => {
    this.chaosValue = payload.value;
    this.updateChaosBar();
  };
  private readonly onHealthChanged = (payload: { current: number; max: number }): void => {
    this.healthCurrent = payload.current;
    this.healthMax = payload.max;
    this.healthFrac = payload.max > 0 ? payload.current / payload.max : 0;
    this.updateHealthBar();
  };
  private readonly onKindlingCollected = (payload: { amount: number; total: number }): void => {
    if (!this.active) return;
    this.kindling = payload.total;
    this.updateKindlingText();
    this.showPickupFlash(payload.amount);
  };
  private readonly onToolUsed = (payload: { contaminantId: string; toolType: ContaminantType; usesLeft: number }): void => {
    const slot = this.toolSlotData.find((s) => s.type === payload.toolType && s.usesRemaining > payload.usesLeft);
    if (slot) {
      slot.usesRemaining = payload.usesLeft;
      if (slot.isPassive) this.showPassiveFlash(slot.name);
    }
    this.updateToolSlotText();
  };

  create(config: HUDConfig): void {
    ensurePulseKeyframes();
    this.config = config;
    this.active = true;
    this.chaosValue = 0;
    this.healthFrac = 1;
    this.healthCurrent = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.healthMax = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.kindling = 0;
    this.activeEffects = [];
    this.lastEffectsString = '';
    this.extractPromptVisible = false;
    this.toolSlotData = config.toolSlots ? config.toolSlots.map((s) => ({ ...s })) : [];

    this.buildDom();
    this.updateHealthBar();
    this.updateChaosBar();
    this.updateKindlingText();
    this.updateToolSlotText();

    eventBus.on(GameEvent.CHAOS_CHANGED, this.onChaosChanged);
    eventBus.on(GameEvent.PLAYER_HEALTH_CHANGED, this.onHealthChanged);
    eventBus.on(GameEvent.KINDLING_COLLECTED, this.onKindlingCollected);
    eventBus.on(GameEvent.TOOL_USED, this.onToolUsed);
  }

  /**
   * Sets the sortie-duration status effects (defense side-effects carried into this
   * sortie). Renders as a persistent HUD line for as long as they are active, not a
   * transient notification.
   */
  setActiveEffects(effects: ActiveEffectInfo[]): void {
    this.activeEffects = effects.map((e) => ({ ...e }));
    this.renderEffectsText();
  }

  /** Called from scene update for effect countdowns and extract-prompt visibility.
   *  Low-HP / chaos-overflow pulsing is a CSS animation now (toggled from the two
   *  event handlers above), so there is nothing per-frame to do for those anymore. */
  update(deltaMs: number): void {
    if (this.activeEffects.length > 0) {
      let changed = false;
      for (const e of this.activeEffects) {
        if (e.remainingMs === undefined) continue;
        e.remainingMs -= deltaMs;
        changed = true;
      }
      if (changed) {
        this.activeEffects = this.activeEffects.filter((e) => e.remainingMs === undefined || e.remainingMs > 0);
        this.renderEffectsText();
      }
    }

    const shouldShow = !this.config.isRunEnded() && this.config.canExtract();
    if (shouldShow !== this.extractPromptVisible) {
      this.extractPromptVisible = shouldShow;
      this.extractPromptEl.style.display = shouldShow ? 'block' : 'none';
    }
  }

  reset(): void {
    this.chaosValue = 0;
    this.healthFrac = 1;
    this.healthCurrent = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.healthMax = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
    this.kindling = 0;
    this.activeEffects = [];
    this.lastEffectsString = '';
    this.updateChaosBar();
    this.updateHealthBar();
    this.updateKindlingText();
    this.renderEffectsText();
    this.extractPromptVisible = false;
    this.extractPromptEl.style.display = 'none';
  }

  destroy(): void {
    this.active = false;
    eventBus.off(GameEvent.CHAOS_CHANGED, this.onChaosChanged);
    eventBus.off(GameEvent.PLAYER_HEALTH_CHANGED, this.onHealthChanged);
    eventBus.off(GameEvent.KINDLING_COLLECTED, this.onKindlingCollected);
    eventBus.off(GameEvent.TOOL_USED, this.onToolUsed);

    this.root?.remove();
    this.root = null;
    this.toolSlotEl = null;
  }

  // ------------------------------------------------------------------ internal

  private buildDom(): void {
    document.getElementById('rift-hud')?.remove();

    const root = document.createElement('div');
    root.id = 'rift-hud';
    root.style.cssText = [
      'position:absolute', 'top:0', 'left:0', 'width:960px', 'height:640px',
      'pointer-events:none',
      `font-family:${FONT}`,
    ].join(';');

    // --- HP row (top-left) ---
    const hpRow = document.createElement('div');
    hpRow.style.cssText = `position:absolute;left:${MARGIN}px;top:${MARGIN}px;display:flex;align-items:center;gap:4px;`;

    const hpLabel = document.createElement('span');
    hpLabel.textContent = 'HP';
    hpLabel.style.cssText = `font-size:12px;color:${TEXT_DIM};text-shadow:${TEXT_SHADOW};`;

    const hpBarWrap = document.createElement('div');
    hpBarWrap.style.cssText = `width:${HEALTH_BAR_WIDTH}px;height:${BAR_HEIGHT}px;background:rgba(0,0,0,0.4);border:1px solid #0f1114;position:relative;overflow:hidden;`;
    this.hpFill = document.createElement('div');
    this.hpFill.style.cssText = `height:100%;width:100%;background:${HEALTH_COLOR};`;
    hpBarWrap.appendChild(this.hpFill);

    this.hpValue = document.createElement('span');
    this.hpValue.style.cssText = `font-size:13px;color:${TEXT_BRIGHT};text-shadow:${TEXT_SHADOW};`;

    hpRow.appendChild(hpLabel);
    hpRow.appendChild(hpBarWrap);
    hpRow.appendChild(this.hpValue);

    // --- Chaos row (below HP, top-left) ---
    const chaosRow = document.createElement('div');
    chaosRow.style.cssText = `position:absolute;left:${MARGIN}px;top:${CHAOS_ROW_TOP}px;display:flex;align-items:center;gap:4px;`;

    const chaosBarWrap = document.createElement('div');
    chaosBarWrap.style.cssText = `width:${CHAOS_BAR_WIDTH}px;height:${BAR_HEIGHT}px;background:rgba(0,0,0,0.4);border:1px solid #0f1114;position:relative;overflow:hidden;`;
    this.chaosFill = document.createElement('div');
    this.chaosFill.style.cssText = `height:100%;width:0%;background:${CHAOS_COLOR};`;
    chaosBarWrap.appendChild(this.chaosFill);
    // Tick marks at 50%/75% - second encoding beyond the tier word (A1 "第二重编码").
    for (const pct of [50, 75]) {
      const tick = document.createElement('div');
      tick.style.cssText = `position:absolute;top:0;bottom:0;left:${pct}%;width:1px;background:rgba(255,255,255,0.3);`;
      chaosBarWrap.appendChild(tick);
    }

    this.chaosValueEl = document.createElement('span');
    this.chaosValueEl.style.cssText = `font-size:13px;color:${TEXT_BRIGHT};text-shadow:${TEXT_SHADOW};`;

    chaosRow.appendChild(chaosBarWrap);
    chaosRow.appendChild(this.chaosValueEl);

    // --- Active-effects lines (below chaos, top-left) ---
    this.effectsEl = document.createElement('div');
    this.effectsEl.style.cssText = `position:absolute;left:${MARGIN}px;top:${EFFECTS_ROW_TOP}px;font-size:12px;line-height:1.5;color:${TEXT_DIM};white-space:pre-line;text-shadow:${TEXT_SHADOW};`;

    // --- Kindling count (top-right) ---
    this.kindlingEl = document.createElement('div');
    this.kindlingEl.style.cssText = `position:absolute;right:${MARGIN}px;top:${MARGIN}px;font-size:14px;font-weight:bold;color:${KINDLING_COLOR};text-shadow:${TEXT_SHADOW};`;

    // --- Extract prompt (bottom-center) ---
    this.extractPromptEl = document.createElement('div');
    this.extractPromptEl.textContent = '按 E 撤离';
    this.extractPromptEl.style.cssText = `position:absolute;left:50%;bottom:36px;transform:translateX(-50%);font-size:13px;color:${TEXT_BRIGHT};text-shadow:${TEXT_SHADOW};display:none;`;

    root.appendChild(hpRow);
    root.appendChild(chaosRow);
    root.appendChild(this.effectsEl);
    root.appendChild(this.kindlingEl);
    root.appendChild(this.extractPromptEl);

    // --- Tool slot display (bottom-left) ---
    if (this.toolSlotData.length > 0) {
      this.toolSlotEl = document.createElement('div');
      this.toolSlotEl.style.cssText = `position:absolute;left:${MARGIN}px;bottom:${MARGIN}px;font-size:13px;color:${TEXT_BRIGHT};white-space:pre;text-shadow:${TEXT_SHADOW};`;
      root.appendChild(this.toolSlotEl);
    } else {
      this.toolSlotEl = null;
    }

    getDomUiRoot().appendChild(root);
    this.root = root;
  }

  private updateChaosBar(): void {
    const frac = Math.min(this.chaosValue / GAME_CONSTANTS.CHAOS.MAX_VALUE, 1.0);
    this.chaosFill.style.width = `${CHAOS_BAR_WIDTH * frac}px`;
    this.chaosValueEl.textContent = `${Math.round(this.chaosValue)} 混乱 · ${chaosTierLabel(this.chaosValue)}`;

    const overflowing = this.chaosValue > GAME_CONSTANTS.CHAOS.MAX_VALUE;
    this.chaosFill.style.animation = overflowing ? 'rift-hud-pulse 300ms ease-in-out infinite' : '';
  }

  private updateHealthBar(): void {
    this.hpFill.style.width = `${HEALTH_BAR_WIDTH * this.healthFrac}px`;
    this.hpValue.textContent = `${Math.round(this.healthCurrent)}/${Math.round(this.healthMax)}`;

    const low = this.healthFrac < HEALTH_LOW_THRESHOLD;
    this.hpFill.style.background = low ? HEALTH_LOW_COLOR : HEALTH_COLOR;
    this.hpFill.style.animation = low ? 'rift-hud-pulse 300ms ease-in-out infinite' : '';
  }

  private updateKindlingText(): void {
    this.kindlingEl.textContent = `◇ ${this.kindling}`;
  }

  private renderEffectsText(): void {
    const lines = this.activeEffects.map((e) =>
      e.remainingMs !== undefined ? `${e.label} · ${Math.ceil(e.remainingMs / 1000)}s` : e.label,
    );
    const next = lines.join('\n');
    if (next === this.lastEffectsString) return;
    this.lastEffectsString = next;
    this.effectsEl.textContent = next;
  }

  /** toast-inline near the kindling counter (ui-art-overhaul.md §A4/A6). */
  private showPickupFlash(amount: number): void {
    if (!this.active) return;
    showToastInline(`+${amount}`, {
      position: `top:${MARGIN}px;right:70px;`,
      color: KINDLING_COLOR,
      extraStyle: 'font-size:13px;font-weight:bold;',
      durationMs: 800,
    });
  }

  /**
   * toast-inline over the passive slot (ui-art-overhaul.md §A4/A6 "toast-inline"
   * variant). Gives the three passive tools (碎影/消声步/寄生引流) a perceptible
   * trigger instead of a silently-shrinking dot.
   */
  private showPassiveFlash(name: string): void {
    if (!this.active || !this.toolSlotEl) return;
    showToastInline(`${name} · 生效`, {
      position: `left:${MARGIN}px;bottom:30px;`,
      color: CHAOS_COLOR,
      extraStyle: 'font-size:13px;',
      durationMs: 800,
    });
  }

  private updateToolSlotText(): void {
    if (!this.toolSlotEl) return;

    const parts: string[] = [];
    for (const slot of this.toolSlotData) {
      const dots = '●'.repeat(slot.usesRemaining);
      const key = slot.isPassive ? '被动' : slot.label;
      parts.push(`[${key}] ${slot.name}${dots || '—'}`);
    }
    this.toolSlotEl.textContent = parts.join('  ');

    const anyActive = this.toolSlotData.some((s) => s.usesRemaining > 0);
    this.toolSlotEl.style.color = anyActive ? TEXT_BRIGHT : TEXT_EXHAUSTED;
  }
}
