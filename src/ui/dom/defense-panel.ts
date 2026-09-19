import { getContaminantQuality, getContaminantQualityName, getContaminantQualityRank, supportsContaminantQuality } from '@/systems/contaminant-quality';
/**
 * 供奉：已装填槽和库存为主区、单项检视为从区；键鼠共享选择状态。
 * 迭代 11 DEC-119；共享终端样式，挂 #dom-ui-root。
 */

import { contaminantSystem } from '@/systems/contaminant-system';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { inventoryStore } from '@/systems/inventory-store';
import { getEquipmentLifecycle, type InventoryItem } from '@/types/inventory-types';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { contaminantIconUrl } from '@/art/contaminant-icons';
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { getDefenseName, getRarityStars } from '@/ui/contaminant-names';
import { buildDefenseInspectHtml, INSPECT_EMPTY_HTML } from './inspect-dock';
import { renderPanelContent } from './panel-render-state';
import { bindWorldInteraction, type WorldInteractionContext } from './world-interaction';
import { createCrtPanel, getDomUiRoot, scrollFocusedIntoView } from './panel-styles';
import { ensureOfferingPanelStyles } from './offering-panel-styles';

// Rarity is "Degree not Kind": escalating contam brightness instead of unrelated hues
// per tier (ui-art-overhaul.md A2 maps common -> contam-mid #1a6b5c, but that value is
// ~3:1 against this panel's background — under the 4.5:1 text floor (A1) whenever it
// lands on name text rather than a border. Resolved per the "可读性优先" tie-break rule:
// common stays plain readable text (no color escalation earned yet), fine/rare use the
// two contam tones that do clear 4.5:1. Star count remains the redundant rarity signal
// at every tier (unaffected by this).
const RARITY_COLORS: Record<string, string> = {
  common: '#8a8f96',
  fine: '#729887',
  rare: '#9bb3a2',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let cleanupWorldInteraction: (() => void) | null = null;
let onCloseCallback: (() => void) | null = null;
let actionError = '';
const escape = (value: string): string => value.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
function offeringMeta(item: InventoryItem) {
  if (item.kind === 'weapon') {
    const def = WEAPON_DATA[item.weapon.definitionId]!;
    return { name: def.name, rank: def.qualityRank, badge: def.qualityName, color: '#a3b3a0', threshold: def.offeringCharges, icon: `/assets/weapons/crowbars/${def.id}-icon.png`, summary: '承受冲击' };
  }
  const c = item.contaminant, def = CONTAMINANT_DATA[c.type];
  return { name: getDefenseName(c.type), rank: getContaminantQualityRank(c), badge: supportsContaminantQuality(c.type) ? getContaminantQualityName(c) : getRarityStars(c.rarity), color: supportsContaminantQuality(c.type) ? '#a3b3a0' : RARITY_COLORS[c.rarity], threshold: GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD, icon: contaminantIconUrl(c.type, getContaminantQuality(c)), summary: def.summaryDefense };
}
function offeringIcon(item: InventoryItem, size = 28): string { return `<img src="${escape(offeringMeta(item).icon)}" alt="" width="${size}" height="${size}" style="object-fit:contain;image-rendering:pixelated;flex:none;vertical-align:middle">`; }
function changeSlot(id: string | null, slot: number): void {
  const result = inventoryStore.slotOffering(id, slot);
  actionError = result.ok ? '' : result.error === 'storage-failed' ? '未能保存，物件位置未改变。请重试。' : '物件或槽位已变化，请重新选择。';
  if (result.ok) contaminantSystem.syncInventoryDerivedState();
  render();
}

// Keyboard cursor (IA §0.4 "键盘是第一公民"): three focus regions, cycled with Tab.
type CursorRegion = 'slots' | 'inventory' | 'actions';
const REGION_ORDER: CursorRegion[] = ['slots', 'inventory', 'actions'];
const ACTION_COUNT = 1; // 0 = 离开 (leave)

let cursorRegion: CursorRegion = 'slots';
let cursorSlot = 0;
let cursorInv = 0;
let cursorAction = 0;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const defensePanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  open(onClose?: () => void, context?: WorldInteractionContext): void {
    if (panel) return;
    onCloseCallback = onClose ?? null;
    cursorRegion = 'slots';
    cursorSlot = 0;
    cursorInv = 0;
    cursorAction = 0;
    actionError = '';
    createPanel(context);
    audioManager.playSFX('sfx-ui-open');
  },

  close(): void {
    if (!panel) return;
    audioManager.playSFX('sfx-ui-close');
    destroyPanel();
    onCloseCallback?.();
    onCloseCallback = null;
  },
};

// ---------------------------------------------------------------------------
// Panel creation
// ---------------------------------------------------------------------------

function createPanel(context?: WorldInteractionContext): void {
  ensureOfferingPanelStyles();
  panel = createCrtPanel('defense-panel');

  const root = getDomUiRoot();
  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'defense-backdrop';
  root.appendChild(backdrop);

  render();
  root.appendChild(panel);
  if (context) {
    cleanupWorldInteraction = bindWorldInteraction(panel, backdrop, context, '供奉台', 'inventory');
  }
  document.addEventListener('keydown', onKeyDown);
}

function destroyPanel(): void {
  cleanupWorldInteraction?.();
  cleanupWorldInteraction = null;
  document.removeEventListener('keydown', onKeyDown);
  if (panel) {
    panel.remove();
    panel = null;
  }
  document.getElementById('defense-backdrop')?.remove();
}

// ---------------------------------------------------------------------------
// Keyboard cursor navigation
// ---------------------------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    defensePanel.close();
    return;
  }

  const slots = inventoryStore.getOfferingItems();
  const inventory = getInventory();

  if (e.key === 'Tab') {
    e.stopPropagation();
    e.preventDefault();
    cycleRegion(e.shiftKey ? -1 : 1, slots.length, inventory.length);
    render(true, true);
    return;
  }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.stopPropagation();
    e.preventDefault();
    const dir = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
    moveCursor(dir, slots.length, inventory.length, e.key === 'ArrowUp' || e.key === 'ArrowDown');
    render(true, true);
    return;
  }

  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
    e.preventDefault();
    activateFocused(slots, inventory);
  }
}

function clampCursor(slotCount: number, invCount: number): void {
  cursorSlot = slotCount > 0 ? Math.min(cursorSlot, slotCount - 1) : 0;
  cursorInv = invCount > 0 ? Math.min(cursorInv, invCount - 1) : 0;
  if (cursorRegion === 'slots' && slotCount === 0) {
    cursorRegion = invCount > 0 ? 'inventory' : 'actions';
  }
  if (cursorRegion === 'inventory' && invCount === 0) {
    cursorRegion = slotCount > 0 ? 'slots' : 'actions';
  }
}

function cycleRegion(dir: 1 | -1, slotCount: number, invCount: number): void {
  let idx = REGION_ORDER.indexOf(cursorRegion);
  for (let attempts = 0; attempts < REGION_ORDER.length; attempts++) {
    idx = (idx + dir + REGION_ORDER.length) % REGION_ORDER.length;
    const region = REGION_ORDER[idx] ?? 'actions';
    if (region === 'slots' && slotCount === 0) continue;
    if (region === 'inventory' && invCount === 0) continue;
    cursorRegion = region;
    return;
  }
}

function moveCursor(dir: 1 | -1, slotCount: number, invCount: number, vertical: boolean): void {
  if (cursorRegion === 'slots' && slotCount > 0) {
    cursorSlot = (cursorSlot + dir + slotCount) % slotCount;
  } else if (cursorRegion === 'inventory' && invCount > 0) {
    cursorInv = Math.max(0, Math.min(invCount - 1, cursorInv + dir * (vertical ? 2 : 1)));
  } else if (cursorRegion === 'actions') {
    cursorAction = (cursorAction + dir + ACTION_COUNT) % ACTION_COUNT;
  }
}

function activateFocused(slots: (InventoryItem | null)[], inventory: InventoryItem[]): void {
  if (cursorRegion === 'slots') {
    const c = slots[cursorSlot];
    if (c) {
      changeSlot(null, cursorSlot);
    }
  } else if (cursorRegion === 'inventory') {
    const c = inventory[cursorInv];
    if (c) equipDefense(c, slots);
  } else if (cursorRegion === 'actions') {
    defensePanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getInventory(): InventoryItem[] {
  return inventoryStore.getItems().filter(item => item.location.kind === 'stash' && getEquipmentLifecycle(item).stage === 'defense')
    .sort((a,b) => offeringMeta(b).rank - offeringMeta(a).rank || a.id.localeCompare(b.id));
}

function render(selectionOnly = false, revealSelection = false): void {
  if (!panel) return;

  const slots = inventoryStore.getOfferingItems();
  const inventory = getInventory();
  clampCursor(slots.length, inventory.length);


  // Defense stage = "charging/dormant" reading of the same substance the tool stage is
  // the "active" reading of — same contam-core tone as the loadout panel's title
  // (ui-art-overhaul.md A2's "no separate purple class"), not the darker contam-deep
  // tone: that fails the 4.5:1 text floor (A1), so it's reserved for the charge bar
  // fill below (a decorative fill, not text).
  let html = `<div class="panel-heading"><div class="panel-title">供奉</div><div class="panel-reserve"><span>薪柴</span><strong>${gameState.getKindlingReserve()}</strong></div></div>`;

  html += `<div class="decision-layout"><div class="decision-main scroll-area"><div class="panel-fixed">`;
  html += `<div class="slot-grid" style="grid-template-columns:repeat(${slots.length},minmax(0,1fr));">`;
  for (let i = 0; i < slots.length; i++) {
    const c = slots[i];
    const selected = cursorRegion === 'slots' && cursorSlot === i;
    if (c) {
      const meta = offeringMeta(c);
      const { name, badge: stars, color } = meta;
      html += `<div class="slot-cell slot-filled defense-unslot-btn${selected ? ' slot-selected' : ''}" data-index="${i}">
        <div class="offering-identity">${offeringIcon(c)}<span class="offering-copy"><span class="slot-name" style="color:${color};">${escape(name)}</span><span class="offering-quality">${escape(stars)}</span></span></div>
        <div class="slot-info">供奉 ${getEquipmentLifecycle(c).impactCharges} / ${meta.threshold}</div>
      </div>`;
    } else {
      html += `<div class="slot-cell${selected ? ' slot-selected' : ''}" data-index="${i}">
        <div><span class="slot-label">供奉槽 ${i + 1}</span></div><span class="slot-info">未供奉</span>
      </div>`;
    }
  }
  html += `</div>`;
  html += `</div>`;

  html += `<div class="readout-section">库存</div><div class="tile-grid">`;
  if (inventory.length === 0) {
    html += inventoryEmptyHtml(slots);
  } else {
    const canEquip = slots.some((s) => s === null);
    inventory.forEach((c, idx) => {
      const meta = offeringMeta(c);
      const { name, badge: stars, color } = meta;

      const selected = cursorRegion === 'inventory' && cursorInv === idx;
        html += `<div class="item-tile defense-equip-tile${canEquip ? '' : ' tile-disabled'}${selected ? ' tile-selected' : ''}" data-id="${escape(c.id)}" data-inv-index="${idx}" >
        <span class="offering-identity">${offeringIcon(c)}<span class="offering-copy"><span class="offering-name" style="color:${color};">${escape(name)}</span><span class="offering-quality">${escape(stars)} · ${getEquipmentLifecycle(c).impactCharges}/${meta.threshold}</span></span></span>
      </div>`;
    });
  }
  html += `</div>`;
  html += `</div><div class="decision-aside readout-detail inspect-dock" id="defense-inspect-dock">${computeInspectHtml(slots, inventory)}</div></div>`;
  if (actionError) html += `<p class="readout-note" role="alert">${actionError}</p>`;
  html += buildKeyHintBar(slots, inventory);

  renderPanelContent(panel, html, selectionOnly);
  if (revealSelection) scrollFocusedIntoView(panel);
  wireEvents(selectionOnly);
}

function inventoryEmptyHtml(slots: (InventoryItem | null)[]): string {
  const hasSlotted = slots.some((s) => s !== null);
  return `<div class="readout-empty"><div class="readout-section">${hasSlotted ? '待供奉物件已全部装填' : '尚无待供奉物件'}</div>
    <p class="readout-copy">${hasSlotted ? '物件在归来冲击中完成供奉。选择槽位可取下，已有进度保留。' : '裂隙中拾获的武器与污染物，都在这里完成供奉后用于出击。'}</p>
    ${hasSlotted ? '' : '<p class="readout-note">关闭供奉，前往裂隙入口。</p>'}</div>`;
}

function buildKeyHintBar(slots: (InventoryItem | null)[], inventory: InventoryItem[]): string {
  if (cursorRegion === 'actions') {
    return `<div class="key-hint-bar">
    <span><span class="key">Tab</span> 切区</span>
    <span id="defense-close-btn"><span class="key">Enter</span> / <span class="key">Esc</span> 离开</span>
  </div>`;
  }

  const parts: string[] = [
    `<span><span class="key">Tab</span> 切区</span>`,
    `<span><span class="key">↑↓←→</span> 移动</span>`,
  ];
  if (cursorRegion === 'slots' && slots[cursorSlot]) {
    parts.push(`<span><span class="key">Enter</span> 取下</span>`);
  } else if (cursorRegion === 'inventory' && inventory[cursorInv] && slots.some((s) => s === null)) {
    parts.push(`<span><span class="key">Enter</span> 装填</span>`);
  }
  parts.push(`<span id="defense-close-btn"><span class="key">Esc</span> 离开</span>`);
  return `<div class="key-hint-bar">
    ${parts.join('\n    ')}
  </div>`;
}

function wireEvents(selectionOnly = false): void {
  if (!panel) return;

  panel.querySelector('#defense-close-btn')?.addEventListener('click', () => {
    defensePanel.close();
  });

  if (selectionOnly) return;

  // Unslot by clicking filled slots (mouse = equal-citizen shortcut for the same
  // action Enter performs on a keyboard-focused slot).
  panel.querySelectorAll('.defense-unslot-btn').forEach((btn) => {
    const el = btn as HTMLElement;
    btn.addEventListener('click', () => {
      const index = parseInt(el.dataset.index!, 10);
      cursorRegion = 'slots';
      cursorSlot = index;
      changeSlot(null, index);
    });
  });

  panel.querySelectorAll<HTMLElement>('.slot-cell[data-index]').forEach((el) => {
    el.addEventListener('pointermove', () => {
      const index = parseInt(el.dataset.index!, 10);
      if (Number.isNaN(index)) return;
      if (cursorRegion === 'slots' && cursorSlot === index) return;
      cursorRegion = 'slots';
      cursorSlot = index;
      render(true);
    });
  });

  // Equip by clicking inventory tiles (auto-assign to first empty slot)
  panel.querySelectorAll('.defense-equip-tile').forEach((btn) => {
    const el = btn as HTMLElement;
    btn.addEventListener('click', () => {
      cursorRegion = 'inventory';
      cursorInv = Number(el.dataset.invIndex);
      if (el.classList.contains('tile-disabled')) {
        render(true);
        return;
      }
      const id = el.dataset.id!;
      const c = inventoryStore.getItem(id);
      if (c) equipDefense(c, inventoryStore.getOfferingItems());
    });
    el.addEventListener('pointermove', () => {
      const idx = parseInt(el.dataset.invIndex!, 10);
      if (Number.isNaN(idx)) return;
      if (cursorRegion === 'inventory' && cursorInv === idx) return;
      cursorRegion = 'inventory';
      cursorInv = idx;
      render(true);
    });
  });
}

function equipDefense(c: InventoryItem, currentSlots: (InventoryItem | null)[]): void {
  const firstEmpty = currentSlots.findIndex((s) => s === null);
  if (firstEmpty >= 0) {
    changeSlot(c.id, firstEmpty);
  }
}

function computeInspectHtml(
  slots: (InventoryItem | null)[],
  inventory: InventoryItem[],
): string {
  const target = cursorRegion === 'slots' ? { kind: 'slot' as const, index: cursorSlot }
    : cursorRegion === 'inventory' ? { kind: 'inventory' as const, index: cursorInv }
      : null;
  if (!target) return INSPECT_EMPTY_HTML;

  if (target.kind === 'slot') {
    const c = slots[target.index];
    if (!c) return `<div class="readout-section">供奉槽 ${target.index + 1}</div><p class="readout-copy">未供奉。</p><p class="readout-note">${inventory.length > 0 ? "用 Tab 切到库存，选择物件后供奉。" : "取得武器或污染物后，在此承受归来冲击，完成供奉。"}</p>`;
    return inspectOffering(c, true, true);
  }

  const c = inventory[target.index];
  if (!c) return INSPECT_EMPTY_HTML;
  const canEquip = slots.some((s) => s === null);
  return inspectOffering(c, false, canEquip);
}

function inspectOffering(item: InventoryItem, slotted: boolean, canEquip: boolean): string {
  const meta = offeringMeta(item), life = getEquipmentLifecycle(item);
  const art = `<div style="margin-bottom:12px">${offeringIcon(item, 48)}</div>`;
  if (item.kind === 'contaminant') return art + buildDefenseInspectHtml(item.contaminant, {
    chargeThreshold: meta.threshold, slotState: slotted ? 'slotted' : 'unslotted', canEquip,
  });
  const def = WEAPON_DATA[item.weapon.definitionId]!;
  return art + `<div class="readout-section">${escape(meta.name)}</div>
    <p class="readout-copy">${escape(meta.badge)} · 武器</p>
    <p class="readout-copy">供奉进度 ${life.impactCharges} / ${meta.threshold}</p>
    <p class="readout-note">在此承受冲击，完成后才可放入出击武器位。供奉期间不提供装置防护。</p>
    <div class="readout-section">供奉完成后</div>
    <p class="readout-copy">伤害 ${def.damageMin}–${def.damageMax} · 耐久度 ${def.maxUses} / ${def.maxUses}</p>
    <p class="readout-note">${slotted ? '已在供奉中。取下保留进度。' : canEquip ? 'Enter 供奉到空槽。' : '供奉槽已满，先取下一件。'}</p>`;
}
