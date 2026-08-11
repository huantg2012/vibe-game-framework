/**
 * StatusPanel - Combined status overview + inventory panel.
 * Opens on Tab at the purification point. ESC or Tab closes.
 *
 * Game-style layout: multi-column stat grid with mini progress bars,
 * upgrade badges, inventory as compact colored tiles grouped by stage.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { contaminantSystem } from '@/systems/contaminant-system';
import { CONTAMINANT_DESCRIPTIONS } from '@/config/contaminant-descriptions';
import type { ContaminantType, GrowthUpgradeId } from '@/types/game-types';
import { injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Display name mappings
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<ContaminantType, string> = {
  solidify: '固化',
  ruminate: '反刍',
  scatter: '散射',
  retrograde: '逆行',
  delay: '延时',
  siphon: '虹吸',
  expand: '膨胀',
  resonate: '共鸣',
  overwrite: '覆写',
  erode: '侵蛀',
  muffle: '消声',
  kindle: '燃尽',
  stitch: '缝合',
  compress: '致密',
  mirror: '镜映',
  echo: '回响',
  abyss: '深渊',
  combust: '灰烬',
};

const TOOL_NAMES: Record<ContaminantType, string> = {
  solidify: '凝锁',
  ruminate: '反刍之口',
  scatter: '碎影',
  retrograde: '残响标记',
  delay: '时裂',
  siphon: '寄生引流',
  expand: '虚化步',
  resonate: '共振链接',
  overwrite: '规则覆写',
  erode: '侵蚀领域',
  muffle: '消声步',
  kindle: '燃素弹',
  stitch: '缝合线',
  compress: '重力锚',
  mirror: '镜像诱饵',
  echo: '回响脉冲',
  abyss: '深渊之眼',
  combust: '焚天',
};

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  fine: '#5599ff',
  rare: '#cc66ff',
};

const UPGRADE_NAMES: Record<GrowthUpgradeId, string> = {
  growth_chaos_resist: '渗透抗性',
  growth_kindling_affinity: '薪柴亲和',
  growth_vitality: '生命强化',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let onCloseCallback: (() => void) | null = null;

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
  injectPanelStyles();

  panel = document.createElement('div');
  panel.id = 'status-panel';
  panel.className = 'game-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:0',
    'right:0',
    'height:100vh',
    'width:440px',
    'z-index:1001',
    'display:flex',
    'flex-direction:column',
    'overflow-y:auto',
  ].join(';');

  const backdrop = document.createElement('div');
  backdrop.className = 'game-panel-backdrop';
  backdrop.id = 'status-backdrop';
  document.body.appendChild(backdrop);

  render();
  document.body.appendChild(panel);
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
  }
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
  const growthReduction = Math.round(mods.chaosResist * 100);
  const totalResist = coreReduction + growthReduction;

  const storageEffect = gameState.getModuleEffect('STORAGE');
  const storageBonus = Math.round((storageEffect - 1) * 100);
  const kindlingAffinity = mods.kindlingAffinity;

  const tideState = tideSystem.getState();
  const phaseLabels: Record<string, string> = { rise: '涨潮', crest: '潮峰', ebb: '退潮' };
  const phaseColors: Record<string, string> = { rise: '#cc3333', crest: '#cc3333', ebb: '#4a9e5a' };

  // Module HP data
  const coreMod = gameState.getModule('CORE');
  const storageMod = gameState.getModule('STORAGE');

  let html = `<div class="panel-title">存续报告</div>`;
  html += `<div style="flex:1;overflow-y:auto;">`;

  // === Module status with bars ===
  html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">`;

  // Core module
  if (coreMod) {
    const coreHpPct = Math.round((coreMod.hp / coreMod.maxHp) * 100);
    html += `<div style="padding:6px;border:1px solid #2a2d32;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;color:#4d9a6b;font-weight:bold;">核心</span>
        <span style="font-size:12px;color:#5a5f66;">${coreMod.hp}/${coreMod.maxHp}</span>
      </div>
      <div class="stat-bar" style="width:100%;">
        <div class="stat-bar-fill" style="width:${coreHpPct}%;background:#4d9a6b;"></div>
      </div>
      <div style="font-size:12px;color:#5a5f66;margin-top:2px;">混乱 -${coreReduction}%</div>
    </div>`;
  }

  // Storage module
  if (storageMod) {
    const storHpPct = Math.round((storageMod.hp / storageMod.maxHp) * 100);
    html += `<div style="padding:6px;border:1px solid #2a2d32;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:13px;color:#c4873a;font-weight:bold;">储藏</span>
        <span style="font-size:12px;color:#5a5f66;">${storageMod.hp}/${storageMod.maxHp}</span>
      </div>
      <div class="stat-bar" style="width:100%;">
        <div class="stat-bar-fill" style="width:${storHpPct}%;background:#c4873a;"></div>
      </div>
      <div style="font-size:12px;color:#5a5f66;margin-top:2px;">薪柴 +${storageBonus}%</div>
    </div>`;
  }

  html += `</div>`;

  // === Stats grid ===
  html += `<div class="stat-grid" style="margin-bottom:8px;">
    <div class="stat-row">
      <span class="stat-label">完整度</span>
      <span class="stat-value">${totalHp}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">混乱抗</span>
      <span class="stat-value" style="color:${totalResist > 0 ? '#4a9e5a' : '#c8ccd0'};">${totalResist}%</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">薪柴值</span>
      <span class="stat-value" style="color:${storageEffect > 1 ? '#c4873a' : '#c8ccd0'};">x${storageEffect.toFixed(2)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">潮汐</span>
      <span class="stat-value" style="color:${phaseColors[tideState.phase] ?? '#c8ccd0'};">第${tideState.tideNumber}潮 ${phaseLabels[tideState.phase]}</span>
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
  const upgradeIds: GrowthUpgradeId[] = ['growth_chaos_resist', 'growth_kindling_affinity', 'growth_vitality'];
  const purchasedUpgrades = upgradeIds.filter((id) => growthSystem.getLevel(id) > 0);
  if (purchasedUpgrades.length > 0) {
    html += `<div style="margin:6px 0;">`;
    for (const id of purchasedUpgrades) {
      html += `<span class="pill" style="border-color:#aa6622;color:#aa6622;">${UPGRADE_NAMES[id]} ${growthSystem.getLevel(id)}</span> `;
    }
    html += `</div>`;
  }

  // === Inventory section ===
  html += `<div class="separator"></div>`;
  html += `<div style="font-size:14px;color:#8a8f96;margin-bottom:6px;font-weight:bold;">库存</div>`;

  const allContaminants = contaminantSystem.getAll();
  const defenseItems = allContaminants.filter((c) => c.stage === 'defense');
  const toolItems = allContaminants.filter((c) => c.stage === 'tool');
  const brokenItems = allContaminants.filter((c) => c.stage === 'broken');

  if (defenseItems.length > 0) {
    const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;
    html += `<div style="font-size:13px;color:#6644aa;margin-bottom:4px;">防御</div>`;
    html += `<div class="tile-grid">`;
    for (const c of defenseItems) {
      const name = TYPE_NAMES[c.type];
      const color = RARITY_COLORS[c.rarity] ?? '#8a8f96';
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.defense ?? '';
      html += `<div class="item-tile" style="border-color:${color};cursor:default;" title="${desc}">
        <span style="color:${color};">${name}</span> <span style="color:#5a5f66;">${c.impactCharges}/${threshold}</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (toolItems.length > 0) {
    html += `<div style="font-size:13px;color:#1aad96;margin:6px 0 4px;">工具</div>`;
    html += `<div class="tile-grid">`;
    for (const c of toolItems) {
      const name = TOOL_NAMES[c.type];
      const color = RARITY_COLORS[c.rarity] ?? '#8a8f96';
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      html += `<div class="item-tile" style="border-color:${color};cursor:default;" title="${desc}">
        <span style="color:${color};">${name}</span> <span style="color:#8a8f96;">x${c.usesRemaining}</span>
      </div>`;
    }
    html += `</div>`;
  }

  if (brokenItems.length > 0) {
    html += `<div style="font-size:13px;color:#2a2d32;margin:6px 0 4px;">已碎</div>`;
    html += `<div class="tile-grid">`;
    for (const c of brokenItems) {
      const name = TYPE_NAMES[c.type];
      html += `<span class="pill" style="color:#2a2d32;border-color:#1a1c1f;">${name}</span>`;
    }
    html += `</div>`;
  }

  if (defenseItems.length === 0 && toolItems.length === 0 && brokenItems.length === 0) {
    html += `<div style="font-size:13px;color:#2a2d32;text-align:center;padding:8px;">尚无污染物</div>`;
  }

  html += `</div>`; // end flex:1 content wrapper
  html += `<div class="action-bar">
    <span id="status-close-btn" class="action-btn btn-muted" style="cursor:pointer;">合上</span>
  </div>`;

  panel.innerHTML = html;

  panel.querySelector('#status-close-btn')?.addEventListener('click', () => {
    statusPanel.close();
  });
}
