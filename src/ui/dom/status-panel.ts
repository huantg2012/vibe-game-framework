/**
 * StatusPanel - Combined status overview + inventory panel.
 * Opens on Tab at the purification point. ESC or Tab closes.
 * Implements items A1 (player status summary) and B1 (inventory).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { contaminantSystem } from '@/systems/contaminant-system';
import { CONTAMINANT_DESCRIPTIONS } from '@/config/contaminant-descriptions';
import type { ContaminantType, GrowthUpgradeId } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Display name mappings
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<ContaminantType, string> = {
  solidify: '固化残渣',
  ruminate: '反刍残渣',
  scatter: '散射残渣',
  retrograde: '逆行残渣',
  delay: '延时残渣',
  siphon: '虹吸残渣',
  expand: '膨胀残渣',
  resonate: '共鸣残渣',
  overwrite: '覆写残渣',
  erode: '侵蛀残渣',
  muffle: '消声残渣',
  kindle: '燃尽残渣',
  stitch: '缝合残渣',
  compress: '致密残渣',
  mirror: '镜映残渣',
  echo: '回响残渣',
  abyss: '深渊残渣',
  combust: '灰烬残渣',
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
  panel = document.createElement('div');
  panel.id = 'status-panel';
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'z-index:1001',
    'background:rgba(16,16,20,0.95)',
    'border:1px solid #444',
    'padding:20px',
    'min-width:380px',
    'max-width:480px',
    'max-height:80vh',
    'overflow-y:auto',
    'font-family:monospace',
    'color:#ccc',
    'border-radius:4px',
    'box-shadow:0 4px 20px rgba(0,0,0,0.8)',
  ].join(';');

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
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'Tab') {
    e.preventDefault();
    statusPanel.close();
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  if (!panel) return;

  // --- Status section ---
  const baseHp = GAME_CONSTANTS.PLAYER.MAX_HEALTH;
  const mods = growthSystem.getModifiers();
  const totalHp = baseHp + mods.vitalityBonus;

  const barrierEffect = gameState.getModuleEffect('BARRIER');
  const barrierReduction = Math.round((1 - barrierEffect) * 100);
  const growthReduction = Math.round(mods.chaosResist * 100);
  const totalResist = barrierReduction + growthReduction;

  const storageEffect = gameState.getModuleEffect('STORAGE');
  const storageBonus = Math.round((storageEffect - 1) * 100);
  const kindlingAffinity = mods.kindlingAffinity;

  const tideState = tideSystem.getState();
  const phaseLabels: Record<string, string> = { rise: '涨潮', crest: '潮峰', ebb: '退潮' };

  let html = `<div style="font-size:14px;color:#88aacc;font-weight:bold;margin-bottom:12px;">状态概览</div>`;
  html += `<div style="font-size:11px;line-height:2;padding:8px;background:#1a1a2e;border-radius:4px;margin-bottom:14px;">`;
  html += `完整度上限: <span style="color:#fff;">${totalHp}</span> (基础${baseHp}${mods.vitalityBonus > 0 ? ` + 改造${mods.vitalityBonus}` : ''})<br>`;
  html += `混乱抗性: <span style="color:#fff;">${totalResist}%</span> (${barrierReduction > 0 ? `屏障${barrierReduction}%` : ''}${barrierReduction > 0 && growthReduction > 0 ? ' + ' : ''}${growthReduction > 0 ? `改造${growthReduction}%` : ''}${totalResist === 0 ? '无' : ''})<br>`;
  html += `薪柴价值: <span style="color:#fff;">x${storageEffect.toFixed(2)}</span> (储藏+${storageBonus}%${kindlingAffinity > 0 ? ` + 亲和+${kindlingAffinity}` : ''})<br>`;
  html += `潮汐: <span style="color:#fff;">第${tideState.tideNumber}潮 · ${phaseLabels[tideState.phase]} · 强度${tideState.currentIntensity.toFixed(2)}</span>`;
  html += `</div>`;

  // Upgrades list
  const upgradeIds: GrowthUpgradeId[] = ['growth_chaos_resist', 'growth_kindling_affinity', 'growth_vitality'];
  const purchasedUpgrades = upgradeIds.filter((id) => growthSystem.getLevel(id) > 0);
  if (purchasedUpgrades.length > 0) {
    html += `<div style="font-size:11px;color:#888;margin-bottom:4px;">已购改造:</div>`;
    html += `<div style="font-size:11px;padding:6px 8px;background:#1a1a2e;border-radius:4px;margin-bottom:14px;">`;
    for (const id of purchasedUpgrades) {
      html += `<div style="color:#cc8844;">${UPGRADE_NAMES[id]} Lv.${growthSystem.getLevel(id)}</div>`;
    }
    html += `</div>`;
  }

  // --- Inventory section ---
  html += `<div style="font-size:14px;color:#88aacc;font-weight:bold;margin-bottom:10px;border-top:1px solid #333;padding-top:14px;">库存</div>`;

  const allContaminants = contaminantSystem.getAll();
  const defenseItems = allContaminants.filter((c) => c.stage === 'defense');
  const toolItems = allContaminants.filter((c) => c.stage === 'tool');
  const brokenItems = allContaminants.filter((c) => c.stage === 'broken');

  if (defenseItems.length > 0) {
    const threshold = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;
    html += `<div style="font-size:11px;color:#8866cc;margin-bottom:4px;">防御中:</div>`;
    for (const c of defenseItems) {
      const name = TYPE_NAMES[c.type];
      const color = RARITY_COLORS[c.rarity] ?? '#aaa';
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.defense ?? '';
      html += `<div style="font-size:10px;padding:3px 8px;margin-bottom:3px;background:#111118;border-radius:3px;">
        <span style="color:${color};">${name}</span> <span style="color:#666;">充能 ${c.impactCharges}/${threshold}</span>
        <div style="color:#555;font-size:9px;">${desc}</div>
      </div>`;
    }
  }

  if (toolItems.length > 0) {
    html += `<div style="font-size:11px;color:#1aad96;margin-top:8px;margin-bottom:4px;">工具:</div>`;
    for (const c of toolItems) {
      const name = TOOL_NAMES[c.type];
      const color = RARITY_COLORS[c.rarity] ?? '#aaa';
      const desc = CONTAMINANT_DESCRIPTIONS[c.type]?.tool ?? '';
      html += `<div style="font-size:10px;padding:3px 8px;margin-bottom:3px;background:#111118;border-radius:3px;">
        <span style="color:${color};">${name}</span> <span style="color:#888;">x${c.usesRemaining}</span>
        <div style="color:#555;font-size:9px;">${desc}</div>
      </div>`;
    }
  }

  if (brokenItems.length > 0) {
    html += `<div style="font-size:11px;color:#555;margin-top:8px;margin-bottom:4px;">已碎:</div>`;
    for (const c of brokenItems) {
      const name = TYPE_NAMES[c.type];
      html += `<div style="font-size:10px;padding:2px 8px;color:#444;">${name}</div>`;
    }
  }

  if (defenseItems.length === 0 && toolItems.length === 0 && brokenItems.length === 0) {
    html += `<div style="font-size:11px;color:#555;padding:4px 0;">尚无污染物</div>`;
  }

  // Close hint
  html += `<div style="margin-top:14px;text-align:center;font-size:10px;color:#555;">Tab / ESC 关闭</div>`;

  panel.innerHTML = html;
}
