/**
 * StatusPanel - Combined status overview + inventory panel.
 * Opens on Tab at the purification point. ESC or Tab closes.
 *
 * Game-style layout: multi-column stat grid with mini progress bars,
 * upgrade badges, inventory as compact colored tiles grouped by stage.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { GROWTH_UPGRADE_NAMES } from '@/config/growth-upgrade-display';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { contaminantSystem } from '@/systems/contaminant-system';
import { getDefenseName, getRarityStars, getToolName, sortContaminants } from '@/ui/contaminant-names';
import { buildDefenseInspectHtml, buildToolInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import { formatChaosRateDelta } from '@/ui/side-effect-labels';
import type { Contaminant } from '@/types/game-types';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';

// Rarity is "Degree not Kind": same contam color family, rising brightness
// (ui-art-overhaul.md A2) instead of unrelated hues per tier.
// C4 readability scan: this panel's own copy still had `common: '#1a6b5c'`
// (~3:1 against the panel background, under the 4.5:1 text floor per A1) —
// defense-panel.ts / loadout-panel.ts already carry the corrected value.
// Brought into line here rather than left to drift.
const RARITY_COLORS: Record<string, string> = {
  common: '#8a8f96',
  fine: '#1aad96',
  rare: '#3cffd4',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

// Keyboard cursor over the combined defense+tool inventory list (IA §S6
// "↑↓←→ 在库存中移动（检视区随之刷新）"; broken items are inert pills, not
// inspectable — they have no live numeric state left to show). Tab/Escape keep
// their existing "close the panel" behavior (S6 interaction contract), so this
// panel doesn't need a separate region cursor like loadout/defense do.
let cursorIndex = 0;
let hoverIndex: number | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const statusPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(onClose?: () => void): void {
    if (panel) return;
    onCloseCallback = onClose ?? null;
    cursorIndex = 0;
    hoverIndex = null;
    createPanel();
  },

  close(): void {
    destroyPanel();
    onCloseCallback?.();
    onCloseCallback = null;
  },
};

// ---------------------------------------------------------------------------
// Panel creation
// ---------------------------------------------------------------------------

function createPanel(): void {
  panel = createCrtPanel('status-panel');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'status-backdrop';
  root.appendChild(backdrop);

  render();
  root.appendChild(panel);
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('status-backdrop')?.remove();
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'Tab') {
    e.stopPropagation();
    e.preventDefault();
    statusPanel.close();
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const count = getInspectableCount();
    if (count === 0) return;
    e.stopPropagation();
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    cursorIndex = (cursorIndex + dir + count) % count;
    hoverIndex = null;
    render();
  }
}

function getInspectableCount(): number {
  const all = contaminantSystem.getAll();
  const defenseCount = all.filter((c) => c.stage === 'defense').length;
  const toolCount = all.filter((c) => c.stage === 'tool').length;
  return defenseCount + toolCount;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  const baseHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
  const mods = growthSystem.getModifiers();
  const totalHp = baseHp + mods.vitalityBonus;

  const coreEffect = gameState.getModuleEffect('CORE');
  const coreReduction = Math.round((1 - coreEffect) * 100);

  const storageEffect = gameState.getModuleEffect('STORAGE');
  const kindlingAffinity = mods.kindlingAffinity;

  const tideState = tideSystem.getState();
  const phaseLabels: Record<string, string> = { rise: '涨潮', crest: '潮峰', ebb: '退潮' };
  // ebb = pressure easing, expressed as "fading to neutral" rather than "turning green"
  // (ui-art-overhaul.md A2 — green-as-safe has no place in this palette).
  const phaseColors: Record<string, string> = { rise: '#1aad96', crest: '#cc3333', ebb: '#8a8f96' };

  // Slice 5.5 D7: moved here from the always-visible purification HUD (was a 10-block
  // progress bar). A state statement, not a progress bar — there is no end-state
  // content yet to promise a finish line toward (IA §R6), and this value never changes
  // moment-to-moment while walking around the purification point, so it doesn't earn
  // P1 常驻 real estate either way.
  const stabilityReached = stabilityTracker.isReached();
  const stabilityStateText = stabilityReached ? '已完成' : '未完成';
  const stabilityPct = `${Math.round(stabilityTracker.getProgress())}%`;

  // Module HP data
  const coreMod = gameState.getModule('CORE');
  const storageMod = gameState.getModule('STORAGE');
  const purifierMod = gameState.getModule('PURIFIER');
  const startingChaos = gameState.getStartingChaos();

  let html = `<div class="panel-title">存续报告</div>`;

  html += `<div class="panel-fixed">`;
  html += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">`;

  // Core module
  if (coreMod) {
    const coreHpPct = Math.round((coreMod.hp / coreMod.maxHp) * 100);
    html += `<div style="padding:6px;border:1px solid #2a2d32;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;color:#c8cdd4;font-weight:bold;">核心</span>
        <span style="font-size:12px;color:#8a8f96;">${coreMod.hp}/${coreMod.maxHp}</span>
      </div>
      <div class="stat-bar" style="width:100%;">
        <div class="stat-bar-fill" style="width:${coreHpPct}%;background:#c8cdd4;"></div>
      </div>
      <div style="font-size:12px;color:#8a8f96;margin-top:2px;">混乱增速 <span style="color:#1aad96;font-weight:bold;">-${coreReduction}%</span></div>
    </div>`;
  }

  // Storage module
  if (storageMod) {
    const storHpPct = Math.round((storageMod.hp / storageMod.maxHp) * 100);
    html += `<div style="padding:6px;border:1px solid #2a2d32;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;color:#c4873a;font-weight:bold;">储藏</span>
        <span style="font-size:12px;color:#8a8f96;">${storageMod.hp}/${storageMod.maxHp}</span>
      </div>
      <div class="stat-bar" style="width:100%;">
        <div class="stat-bar-fill" style="width:${storHpPct}%;background:#c4873a;"></div>
      </div>
      <div style="font-size:12px;color:#8a8f96;margin-top:2px;">薪柴价值 <span style="color:#c4873a;font-weight:bold;">x${storageEffect.toFixed(2)}</span></div>
    </div>`;
  }

  if (purifierMod) {
    const purifHpPct = Math.round((purifierMod.hp / purifierMod.maxHp) * 100);
    html += `<div style="padding:6px;border:1px solid #2a2d32;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;color:#1aad96;font-weight:bold;">净化器</span>
        <span style="font-size:12px;color:#8a8f96;"><span style="color:#1aad96;font-weight:bold;">${purifierMod.hp}</span> / <span style="color:#1aad96;font-weight:bold;">${purifierMod.maxHp}</span></span>
      </div>
      <div class="stat-bar" style="width:100%;">
        <div class="stat-bar-fill" style="width:${purifHpPct}%;background:#1aad96;"></div>
      </div>
      <div style="font-size:12px;color:#8a8f96;margin-top:2px;">起始混乱 <span style="color:#1aad96;font-weight:bold;">${startingChaos}</span></div>
    </div>`;
  }

  html += `</div>`;
  html += `</div>`;

  html += `<div class="panel-fixed">`;
  // === Stats grid ===
  html += `<div class="stat-grid" style="margin-bottom:8px;">
    <div class="stat-row">
      <span class="stat-label">完整度</span>
      <span class="stat-value">${totalHp}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">混乱增速</span>
      <span class="stat-value" style="color:#1aad96;">${formatChaosRateDelta(Math.max(0, coreEffect - mods.chaosResist))}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">薪柴值</span>
      <span class="stat-value" style="color:${storageEffect > 1 ? '#c4873a' : '#c8cdd4'};">x${storageEffect.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">起始混乱</span>
      <span class="stat-value" style="color:#1aad96;">${startingChaos}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">潮汐</span>
      <span class="stat-value" style="color:#1aad96;">第 ${tideState.tideNumber} 潮</span>
      <span style="font-size:12px;color:${phaseColors[tideState.phase] ?? '#8a8f96'};">${phaseLabels[tideState.phase]}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">稳定度</span>
      <span class="stat-value" style="color:${stabilityReached ? '#c8cdd4' : '#b89040'};">${stabilityStateText}</span>
      <span style="font-size:16px;font-weight:bold;color:#c8cdd4;">${stabilityPct}</span>
    </div>
  </div>`;

  // Kindling affinity
  if (kindlingAffinity > 0) {
    html += `<div class="stat-row" style="margin-bottom:4px;">
      <span class="stat-label">亲和</span>
      <span class="stat-value" style="color:#c4873a;">+${kindlingAffinity}</span>
    </div>`;
  }

  // === Upgrades as pills ===
  const upgradeIds = growthSystem.getAllUpgradeIds();
  const purchasedUpgrades = upgradeIds.filter((id) => growthSystem.getLevel(id) > 0);
  if (purchasedUpgrades.length > 0) {
    html += `<div style="margin:6px 0;">`;
    for (const id of purchasedUpgrades) {
      html += `<span class="pill" style="border-color:#8a5c2a;color:#8a5c2a;">${GROWTH_UPGRADE_NAMES[id]} ${growthSystem.getLevel(id)}</span> `;
    }
    html += `</div>`;
  }
  html += `</div>`;

  html += `<div class="scroll-area">`;
  // === Inventory section ===

  const allContaminants = contaminantSystem.getAll();
  const defenseItems = sortContaminants(allContaminants.filter((c) => c.stage === 'defense'));
  const toolItems = sortContaminants(allContaminants.filter((c) => c.stage === 'tool'));
  const brokenItems = sortContaminants(allContaminants.filter((c) => c.stage === 'broken'));
  // Flat cursor space: defense first, then tool (matches the fixed 阶段 sort order
  // and the section rendering order below) — broken items are inert, not inspectable.
  const inspectable: Contaminant[] = [...defenseItems, ...toolItems];
  if (cursorIndex >= inspectable.length) cursorIndex = Math.max(0, inspectable.length - 1);

  const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;

  if (defenseItems.length > 0) {
    // contam-deep (#0e4a3f) is reserved for decorative fills (charge bars), not
    // text — same reasoning defense-panel.ts's title already documents. Section
    // labels use the readable contam-core tone, same as "工具" below.
    html += `<div style="font-size:13px;color:#1aad96;margin-bottom:4px;">残渣</div>`;
    html += `<div class="tile-grid">`;
    defenseItems.forEach((c, i) => {
      const name = getDefenseName(c.type);
      const color = RARITY_COLORS[c.rarity] ?? '#8a8f96';
      const selected = inspectable[cursorIndex] === c;
      html += `<div class="item-tile${selected ? ' tile-selected' : ''}" data-inspect-index="${i}" style="cursor:default;">
        <span style="color:${color};">${name}</span> <span style="color:${color};">${getRarityStars(c.rarity)}</span> <span style="color:#8a8f96;">${c.impactCharges}/${threshold}</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (toolItems.length > 0) {
    html += `<div style="font-size:13px;color:#1aad96;margin:6px 0 4px;">工具</div>`;
    html += `<div class="tile-grid">`;
    toolItems.forEach((c, i) => {
      const name = getToolName(c.type);
      const color = RARITY_COLORS[c.rarity] ?? '#8a8f96';
      const selected = inspectable[cursorIndex] === c;
      html += `<div class="item-tile${selected ? ' tile-selected' : ''}" data-inspect-index="${defenseItems.length + i}" style="cursor:default;">
        <span style="color:${color};">${name}</span> <span style="color:${color};">${getRarityStars(c.rarity)}</span> <span style="color:#8a8f96;">${c.usesRemaining}</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (brokenItems.length > 0) {
    // #2a2d32 is border/divider-only (A2) — it was landing on text here at
    // ~1:1 contrast, unreadable regardless of the intentionally de-emphasized
    // "broken" semantics. #8a8f96 keeps the muted read without disappearing.
    html += `<div style="font-size:13px;color:#8a8f96;margin:6px 0 4px;">已碎</div>`;
    html += `<div class="tile-grid">`;
    for (const c of brokenItems) {
      const name = getDefenseName(c.type);
      html += `<span class="pill" style="color:#8a8f96;border-color:#1a1c1f;">${name}</span>`;
    }
    html += `</div>`;
  }

  if (defenseItems.length === 0 && toolItems.length === 0 && brokenItems.length === 0) {
    html += `<div style="font-size:13px;color:#8a8f96;text-align:center;padding:8px;">尚无残渣</div>`;
  }

  // Inspect dock (选中即检视 — IA §S13 / ui-art-overhaul.md A5-13). Only wired for
  // the defense/tool tiles above; broken items have no live numeric state to show.
  html += `</div>`;
  html += `<div class="inspect-dock" id="status-inspect-dock">${computeInspectHtml(inspectable, threshold)}</div>`;
  html += `<div class="key-hint-bar">
    <span><span class="key">↑↓←→</span> 浏览</span>
    <span id="status-close-btn"><span class="key">Tab</span> / <span class="key">Esc</span> 合上</span>
  </div>`;

  panel.innerHTML = html;
  scrollFocusedIntoView(panel);

  panel.querySelector('#status-close-btn')?.addEventListener('click', () => {
    statusPanel.close();
  });

  panel.querySelectorAll<HTMLElement>('.item-tile[data-inspect-index]').forEach((el) => {
    const idx = parseInt(el.dataset.inspectIndex!, 10);
    el.addEventListener('mouseenter', () => {
      hoverIndex = idx;
      refreshInspectDock(inspectable, threshold);
    });
    el.addEventListener('mouseleave', () => {
      hoverIndex = null;
      refreshInspectDock(inspectable, threshold);
    });
  });
}

function refreshInspectDock(inspectable: Contaminant[], threshold: number): void {
  const dock = panel?.querySelector('#status-inspect-dock');
  if (!dock) return;
  dock.innerHTML = computeInspectHtml(inspectable, threshold);
}

/** Whether `id` currently occupies one of the defense slots (vs. sitting unequipped
 *  in inventory) — both read as `stage === 'defense'`, so this is the only way to
 *  tell them apart for an accurate L4 "与我的关系" reading. */
function isDefenseSlotted(id: string): boolean {
  return contaminantSystem.getDefenseSlotted().some((c) => c?.id === id);
}

function computeInspectHtml(inspectable: Contaminant[], threshold: number): string {
  const index = hoverIndex ?? cursorIndex;
  const c = inspectable[index];
  if (!c) return INSPECT_EMPTY_HTML;

  if (c.stage === 'defense') {
    const slotted = isDefenseSlotted(c.id);
    return buildDefenseInspectHtml(c, { chargeThreshold: threshold, slotState: slotted ? 'slotted' : 'unslotted', canEquip: true });
  }

  const sortieSlots = contaminantSystem.getSortieLoadout();
  const slotIndex = sortieSlots.findIndex((s) => s?.id === c.id);
  if (slotIndex >= 0) {
    const passiveIndex = contaminantSystem.getSortiePassiveSlotIndex();
    const isPassiveSlot = slotIndex === passiveIndex;
    const hotkeyLabel = isPassiveSlot ? undefined : GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[slotIndex];
    return buildToolInspectHtml(c, { slotState: 'slotted', hotkeyLabel, canEquip: true });
  }
  return buildToolInspectHtml(c, { slotState: 'unslotted', canEquip: true });
}
