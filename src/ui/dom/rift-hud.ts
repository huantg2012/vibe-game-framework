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
 * Content: HP (label+bar+value), chaos (label + 0–150 bar with 50/75/100 ticks +
 * number + separate stage caption), kindling, tool slots (key+name+uses),
 * active-effect lines, extract prompt, pickup/passive toasts, overflow veil.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { t } from '@/i18n';
import type { ContaminantType } from '@/types/game-types';
import { GameEvent } from '@/types/events';
import { getDomUiRoot, injectPanelStyles, showToastInline } from './panel-styles';

// ---------------------------------------------------------------------------
// Layout constants (DOM px, 960x640 logical canvas - ui-art-overhaul.md §A1
// "对齐规则": 1 DOM CSS px (声明值) ⇔ 1 Phaser 逻辑画布 px. The old Phaser HUD's
// coordinates were declared in the pre-zoom `cam.width/zoomX` space (640x427 at
// ZOOM=1.5), so every position/size below is the old value x1.5 to land on the
// same on-screen spot the design already specified.
// ---------------------------------------------------------------------------

const MARGIN = 12; // was BAR_MARGIN 8
const HEALTH_BAR_WIDTH = 75; // was 50
const CHAOS_BAR_WIDTH = 135; // was 90
const BAR_HEIGHT = 6; // was 4
const LABEL_MIN_WIDTH = 56;

const CHAOS_COLOR = '#1aad96';
const CHAOS_OVERFLOW_COLOR = '#2ae6c8';
const CHAOS_GAIN_PEAK = '#2ae6c8';
const CHAOS_OVERFLOW_GAIN_PEAK = '#3cffd4';
const CHAOS_GAIN_HOLD_MS = 80;
const CHAOS_GAIN_TOTAL_MS = 180;
const HEALTH_COLOR = '#8a8f96';
const HEALTH_LOW_COLOR = '#cc3333';
const HEALTH_LOW_THRESHOLD = 0.25;
const KINDLING_COLOR = '#c4873a';
const TEXT_BRIGHT = '#c8cdd4';
const TEXT_DIM = '#8a8f96';
const TEXT_EXHAUSTED = '#5a5f66'; // A1: exhausted-state is the one text use this colour permits
const TEXT_SHADOW = '0 0 2px rgba(0,0,0,0.8)';
const FONT = "'Courier New', monospace";
const NOISE_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.10  0 0 0 0 0.68  0 0 0 0 0.59  0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

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
  style.textContent = [
    '@keyframes rift-hud-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }',
    '@keyframes rift-overflow-jump {',
    '  0%, 76%, 100% { opacity: 0; }',
    '  80% { opacity: 1; }',
    '  84% { opacity: 0.12; }',
    '  88% { opacity: 0.55; }',
    '  93% { opacity: 0; }',
    '}',
  ].join('\n');
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

/** Mix two locked teal hexes for the 80–180ms ease-out. No white. */
function lerpChaosHex(from: string, to: string, t: number): string {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
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
  /** When true, [E] prompt is owned by LootSearchHud (search / extract). */
  suppressExtractPrompt?: boolean;
}

export class RiftHud {
  private config!: HUDConfig;
  private active = false;

  // Root + status cluster (top-left): HP row, chaos row, active-effects lines
  private root: HTMLDivElement | null = null;
  private hpFill!: HTMLDivElement;
  private hpValue!: HTMLSpanElement;
  private chaosFill!: HTMLDivElement;
  private chaosOverflowFill!: HTMLDivElement;
  private chaosValueEl!: HTMLSpanElement;
  private chaosStageEl!: HTMLSpanElement;
  private overflowVeil!: HTMLDivElement;
  private overflowJump!: HTMLDivElement;
  private overflowGrain!: HTMLDivElement;
  private effectsEl!: HTMLDivElement;
  private lastEffectsString = '';

  private kindlingEl!: HTMLDivElement;
  private extractPromptEl!: HTMLDivElement;
  private extractPromptVisible = false;
  private extractPromptSuppressed = false;

  // Tool slot display (bottom left)
  private toolSlotEl: HTMLDivElement | null = null;
  private toolSlotData: ToolSlotInfo[] = [];

  // State
  private chaosValue = 0;
  private chaosOverflowing = false;
  private chaosGainGen = 0;
  private chaosGainRaf = 0;
  private healthCurrent = 0;
  private healthMax = 1;
  private healthFrac = 1;
  private kindling = 0;
  private activeEffects: ActiveEffectInfo[] = [];

  // Event references for cleanup
  private readonly onChaosChanged = (payload: { value: number; delta: number; rate: number }): void => {
    this.chaosValue = payload.value;
    this.updateChaosBar();
    if (payload.delta > 0) this.playChaosGainAccent();
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
    this.stopChaosGainAccent(false);
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
    this.extractPromptSuppressed = config.suppressExtractPrompt === true;
    this.toolSlotData = config.toolSlots ? config.toolSlots.map((s) => ({ ...s })) : [];

    injectPanelStyles();
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

  /** Called from scene update for extract-prompt visibility.
   *  Effect remainingMs is authoritative from `setActiveEffects` each frame
   *  (rift-scene merges defense residue + tool-system remaining). Do not tick
   *  remaining here — that would double-count against per-frame set. */
  update(_deltaMs: number): void {
    if (this.extractPromptSuppressed) {
      if (this.extractPromptVisible) {
        this.extractPromptVisible = false;
        this.extractPromptEl.style.display = 'none';
      }
      return;
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
    this.stopChaosGainAccent(true);
  }

  destroy(): void {
    this.active = false;
    this.stopChaosGainAccent(false);
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

    const statusPlate = document.createElement('div');
    statusPlate.id = 'rift-hud-status';
    statusPlate.className = 'device-plate';
    statusPlate.style.cssText = `left:${MARGIN}px;top:${MARGIN}px;display:flex;flex-direction:column;gap:2px;`;

    const hpRow = document.createElement('div');
    hpRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

    const hpLabel = document.createElement('span');
    hpLabel.textContent = t('hud.health.label');
    hpLabel.style.cssText = `font-size:12px;color:${TEXT_DIM};text-shadow:${TEXT_SHADOW};min-width:${LABEL_MIN_WIDTH}px;flex-shrink:0;`;

    const hpBarWrap = document.createElement('div');
    hpBarWrap.style.cssText = `width:${HEALTH_BAR_WIDTH}px;height:${BAR_HEIGHT}px;background:#080a0c;border:1px solid #151a1e;position:relative;overflow:hidden;`;
    this.hpFill = document.createElement('div');
    this.hpFill.style.cssText = `height:100%;width:100%;background:${HEALTH_COLOR};`;
    hpBarWrap.appendChild(this.hpFill);

    this.hpValue = document.createElement('span');
    this.hpValue.style.cssText = `font-size:13px;color:${TEXT_BRIGHT};text-shadow:${TEXT_SHADOW};`;

    hpRow.appendChild(hpLabel);
    hpRow.appendChild(hpBarWrap);
    hpRow.appendChild(this.hpValue);

    const chaosCluster = document.createElement('div');
    chaosCluster.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    const chaosRow = document.createElement('div');
    chaosRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

    const chaosLabel = document.createElement('span');
    chaosLabel.textContent = '混乱';
    chaosLabel.style.cssText = `font-size:12px;color:${TEXT_DIM};text-shadow:${TEXT_SHADOW};min-width:${LABEL_MIN_WIDTH}px;flex-shrink:0;`;

    const chaosBarWrap = document.createElement('div');
    chaosBarWrap.style.cssText = `width:${CHAOS_BAR_WIDTH}px;height:${BAR_HEIGHT}px;background:#080a0c;border:1px solid #151a1e;position:relative;overflow:hidden;`;
    this.chaosFill = document.createElement('div');
    this.chaosFill.style.cssText = `position:absolute;left:0;top:0;height:100%;width:0;background:${CHAOS_COLOR};`;
    this.chaosOverflowFill = document.createElement('div');
    this.chaosOverflowFill.style.cssText = `position:absolute;top:0;height:100%;width:0;background:${CHAOS_OVERFLOW_COLOR};`;
    chaosBarWrap.appendChild(this.chaosFill);
    chaosBarWrap.appendChild(this.chaosOverflowFill);
    const cap = GAME_CONSTANTS.CHAOS.HARD_CAP;
    for (const mark of [GAME_CONSTANTS.CHAOS.THRESHOLD_1, GAME_CONSTANTS.CHAOS.THRESHOLD_2, GAME_CONSTANTS.CHAOS.THRESHOLD_3]) {
      const gate = mark === GAME_CONSTANTS.CHAOS.THRESHOLD_3;
      const tick = document.createElement('div');
      tick.style.cssText = [
        'position:absolute', 'top:0', 'bottom:0',
        `left:${(mark / cap) * 100}%`,
        `width:${gate ? 2 : 1}px`,
        `background:${gate ? '#8a8f96' : '#5a5f66'}`,
      ].join(';');
      chaosBarWrap.appendChild(tick);
    }

    this.chaosValueEl = document.createElement('span');
    this.chaosValueEl.style.cssText = `font-size:13px;color:${TEXT_BRIGHT};text-shadow:${TEXT_SHADOW};`;

    chaosRow.appendChild(chaosLabel);
    chaosRow.appendChild(chaosBarWrap);
    chaosRow.appendChild(this.chaosValueEl);

    this.chaosStageEl = document.createElement('span');
    this.chaosStageEl.style.cssText = `font-size:12px;color:${TEXT_DIM};text-shadow:${TEXT_SHADOW};padding-left:${LABEL_MIN_WIDTH + 4}px;`;
    chaosCluster.appendChild(chaosRow);
    chaosCluster.appendChild(this.chaosStageEl);

    this.effectsEl = document.createElement('div');
    this.effectsEl.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    statusPlate.appendChild(hpRow);
    statusPlate.appendChild(chaosCluster);
    statusPlate.appendChild(this.effectsEl);

    this.kindlingEl = document.createElement('div');
    this.kindlingEl.style.cssText = `position:absolute;right:${MARGIN}px;top:${MARGIN}px;display:flex;align-items:baseline;gap:6px;text-shadow:${TEXT_SHADOW};`;
    const kindlingLabel = document.createElement('span');
    kindlingLabel.textContent = t('hud.kindling.label');
    kindlingLabel.style.cssText = `font-size:12px;color:${TEXT_DIM};`;
    const kindlingValue = document.createElement('span');
    kindlingValue.style.cssText = `font-size:13px;color:${KINDLING_COLOR};`;
    this.kindlingEl.appendChild(kindlingLabel);
    this.kindlingEl.appendChild(kindlingValue);

    // --- Extract prompt (bottom-center) ---
    this.extractPromptEl = document.createElement('div');
    this.extractPromptEl.textContent = '[E] 撤离';
    this.extractPromptEl.style.cssText = `position:absolute;left:50%;bottom:36px;transform:translateX(-50%);font-size:13px;color:${TEXT_BRIGHT};text-shadow:${TEXT_SHADOW};display:none;`;

    this.overflowVeil = document.createElement('div');
    this.overflowVeil.style.cssText = [
      'position:absolute', 'inset:0', 'pointer-events:none', 'opacity:0',
      'background:rgba(8,12,14,0.55)',
    ].join(';');
    this.overflowGrain = document.createElement('div');
    this.overflowGrain.style.cssText = [
      'position:absolute', 'inset:0', 'pointer-events:none', 'opacity:0',
      `background-image:${NOISE_SVG}`,
      'background-size:80px 80px',
    ].join(';');
    this.overflowJump = document.createElement('div');
    this.overflowJump.style.cssText = [
      'position:absolute', 'inset:0', 'pointer-events:none', 'opacity:0',
      'background:rgba(26,173,150,0.22)',
    ].join(';');

    root.appendChild(this.overflowVeil);
    root.appendChild(this.overflowGrain);
    root.appendChild(this.overflowJump);
    root.appendChild(statusPlate);
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
    const C = GAME_CONSTANTS.CHAOS;
    const cap = C.HARD_CAP;
    const gate = C.MAX_VALUE;
    const value = Math.max(0, this.chaosValue);
    const overflowing = value > gate;
    const overflowFrac = overflowing ? Math.min((value - gate) / (cap - gate), 1) : 0;

    this.chaosFill.style.width = `${CHAOS_BAR_WIDTH * Math.min(value, gate) / cap}px`;
    this.chaosOverflowFill.style.left = `${CHAOS_BAR_WIDTH * gate / cap}px`;
    this.chaosOverflowFill.style.width = `${CHAOS_BAR_WIDTH * Math.max(0, Math.min(value, cap) - gate) / cap}px`;

    this.chaosValueEl.textContent = `${Math.round(value)}`;
    this.chaosValueEl.style.color = overflowing ? HEALTH_LOW_COLOR : TEXT_BRIGHT;

    this.chaosStageEl.textContent = chaosTierLabel(value);
    this.chaosStageEl.style.color = overflowing ? HEALTH_LOW_COLOR : TEXT_DIM;

    this.overflowVeil.style.opacity = overflowing ? String(0.10 + overflowFrac * 0.22) : '0';
    this.overflowGrain.style.opacity = overflowing ? String(0.12 + overflowFrac * 0.28) : '0';
    this.overflowJump.style.background = `rgba(26,173,150,${0.12 + overflowFrac * 0.20})`;
    if (overflowing !== this.chaosOverflowing) {
      this.chaosOverflowing = overflowing;
      this.chaosOverflowFill.style.animation = overflowing ? 'rift-hud-pulse 300ms ease-in-out infinite' : '';
      this.overflowJump.style.animation = overflowing
        ? `rift-overflow-jump ${GAME_CONSTANTS.VISIBILITY.FLICKER_JUMP_PERIOD_MS}ms ease-in-out infinite`
        : 'none';
      if (!overflowing) this.overflowJump.style.opacity = '0';
    }
  }

  /**
   * Discrete positive-delta readout (chaos spec 32a / CH-HUD-2): only the bar-head
   * fill background, 180ms, no rift-hud-pulse, no animation restart on overflow.
   * Re-entry interrupts and restarts; does not stack a second brightness layer.
   */
  private playChaosGainAccent(): void {
    this.chaosGainGen += 1;
    const gen = this.chaosGainGen;
    if (this.chaosGainRaf !== 0) {
      cancelAnimationFrame(this.chaosGainRaf);
      this.chaosGainRaf = 0;
    }
    this.chaosFill.style.background = CHAOS_COLOR;
    this.chaosOverflowFill.style.background = CHAOS_OVERFLOW_COLOR;

    const overflowing = this.chaosValue > GAME_CONSTANTS.CHAOS.MAX_VALUE;
    const fill = overflowing ? this.chaosOverflowFill : this.chaosFill;
    const rest = overflowing ? CHAOS_OVERFLOW_COLOR : CHAOS_COLOR;
    const peak = overflowing ? CHAOS_OVERFLOW_GAIN_PEAK : CHAOS_GAIN_PEAK;
    fill.style.background = peak;

    const startedAt = performance.now();
    const tick = (now: number): void => {
      if (gen !== this.chaosGainGen || !this.active) return;
      const elapsed = now - startedAt;
      if (elapsed >= CHAOS_GAIN_TOTAL_MS) {
        fill.style.background = rest;
        this.chaosGainRaf = 0;
        return;
      }
      if (elapsed < CHAOS_GAIN_HOLD_MS) {
        fill.style.background = peak;
        this.chaosGainRaf = requestAnimationFrame(tick);
        return;
      }
      const t = (elapsed - CHAOS_GAIN_HOLD_MS) / (CHAOS_GAIN_TOTAL_MS - CHAOS_GAIN_HOLD_MS);
      const eased = 1 - (1 - t) ** 3;
      fill.style.background = lerpChaosHex(peak, rest, eased);
      this.chaosGainRaf = requestAnimationFrame(tick);
    };
    this.chaosGainRaf = requestAnimationFrame(tick);
  }

  private stopChaosGainAccent(restore: boolean): void {
    this.chaosGainGen += 1;
    if (this.chaosGainRaf !== 0) {
      cancelAnimationFrame(this.chaosGainRaf);
      this.chaosGainRaf = 0;
    }
    if (restore) {
      this.chaosFill.style.background = CHAOS_COLOR;
      this.chaosOverflowFill.style.background = CHAOS_OVERFLOW_COLOR;
    }
  }

  private updateHealthBar(): void {
    this.hpFill.style.width = `${HEALTH_BAR_WIDTH * this.healthFrac}px`;
    this.hpValue.textContent = `${Math.round(this.healthCurrent)}/${Math.round(this.healthMax)}`;

    const low = this.healthFrac < HEALTH_LOW_THRESHOLD;
    this.hpFill.style.background = low ? HEALTH_LOW_COLOR : HEALTH_COLOR;
    this.hpFill.style.animation = low ? 'rift-hud-pulse 300ms ease-in-out infinite' : '';
    this.hpValue.style.color = low ? HEALTH_LOW_COLOR : TEXT_BRIGHT;
  }

  private updateKindlingText(): void {
    const valueEl = this.kindlingEl.lastElementChild;
    if (valueEl) valueEl.textContent = String(this.kindling);
  }

  private renderEffectsText(): void {
    const next = this.activeEffects
      .map((e) => (e.remainingMs !== undefined ? `${e.label}\t${Math.ceil(e.remainingMs / 1000)}s` : e.label))
      .join('\n');
    if (next === this.lastEffectsString) return;
    this.lastEffectsString = next;
    this.effectsEl.replaceChildren();
    for (const e of this.activeEffects) {
      const line = document.createElement('div');
      line.className = 'device-effect';
      const name = document.createElement('span');
      name.className = 'device-effect-name';
      name.textContent = e.label;
      line.appendChild(name);
      if (e.remainingMs !== undefined) {
        const time = document.createElement('span');
        time.className = 'device-effect-time';
        time.textContent = `${Math.ceil(e.remainingMs / 1000)}s`;
        line.appendChild(time);
      }
      this.effectsEl.appendChild(line);
    }
  }

  /** toast-inline near the kindling counter (ui-art-overhaul.md §A4/A6). */
  private showPickupFlash(amount: number): void {
    if (!this.active) return;
    showToastInline(`+${amount}`, {
      position: `top:${MARGIN}px;right:70px;`,
      color: KINDLING_COLOR,
      extraStyle: 'font-size:13px;font-weight:bold;',
      durationMs: 800,
      skipQueue: true,
    });
  }

  /**
   * toast-inline over the passive slot (ui-art-overhaul.md §A4/A6 "toast-inline"
   * variant). Gives the three passive tools (碎影/消声步/寄生引流) a perceptible
   * trigger instead of a silently-shrinking dot.
   */
  private showPassiveFlash(name: string): void {
    if (!this.active || !this.toolSlotEl) return;
    showToastInline(`<span>${name}</span> <span>生效</span>`, {
      position: `left:${MARGIN}px;bottom:30px;`,
      color: CHAOS_COLOR,
      extraStyle: 'font-size:13px;',
      durationMs: 800,
      skipQueue: true,
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
