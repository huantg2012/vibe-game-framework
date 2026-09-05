/**
 * Shared 三模块身份带 (Kit §A8.3 / I11-B4a).
 *
 * Visual must match the live status/allocation strip: name + bar + hp / maxHp.
 * No effect percentages. No new skin.
 */

import { gameState } from '@/managers/game-state';
import type { ModuleType } from '@/managers/game-state';

export const MODULE_ORDER: readonly ModuleType[] = ['CORE', 'STORAGE', 'PURIFIER'];

export const MODULE_LABEL: Record<ModuleType, string> = {
  CORE: '核心',
  STORAGE: '储藏',
  PURIFIER: '净化器',
};

/** 走近亮：名。净化器名走结构亮字，不跟条色抢 teal。 */
export const NAME_ACTIVE: Record<ModuleType, string> = {
  CORE: '#c8cdd4',
  STORAGE: '#c4873a',
  PURIFIER: '#c8cdd4',
};

/** A5-5 条旁数字。 */
export const NUM_ACTIVE: Record<ModuleType, string> = {
  CORE: '#c8cdd4',
  STORAGE: '#c4873a',
  PURIFIER: '#1aad96',
};

export const BAR_COLOR: Record<ModuleType, string> = {
  CORE: '#c8cdd4',
  STORAGE: '#c4873a',
  PURIFIER: '#1aad96',
};

export const DIM = '#8a8f96';

export interface IdentityStripOpts {
  /** Current-operation module (bright). null = all dim ("只是看"). */
  activeId: ModuleType | null;
  /** Detail cursor underline when selected and not active (status "只是看"). */
  selectedId?: ModuleType | null;
  /** Status identity cells are clickable; allocation / B4c strips are not. */
  clickable?: boolean;
}

export function identityBandHtml(opts: IdentityStripOpts): string {
  const cells = MODULE_ORDER.map((id) => identityCellHtml(id, opts)).join('');
  return `<div class="panel-fixed"><div style="display:flex;flex-direction:row;gap:8px;margin-bottom:8px;">${cells}</div></div>`;
}

function identityCellHtml(id: ModuleType, opts: IdentityStripOpts): string {
  const mod = gameState.getModule(id);
  if (!mod) return `<div style="flex:1;min-width:0;"></div>`;
  const pct = Math.round((mod.hp / mod.maxHp) * 100);
  const active = opts.activeId === id;
  const selected = opts.selectedId === id;
  const nameColor = active ? NAME_ACTIVE[id] : DIM;
  const nameSize = active ? '13px' : '12px';
  const numColor = active ? NUM_ACTIVE[id] : DIM;
  const barAlpha = active ? '1' : '0.45';
  const underline = selected && !active
    ? 'border-bottom:1px solid #5a5f66;'
    : 'border-bottom:1px solid transparent;';
  const dataAttr = opts.clickable ? ` data-module-id="${id}"` : '';
  return `<div${dataAttr} style="flex:1;min-width:0;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
      <span style="font-size:${nameSize};color:${nameColor};${underline}">${MODULE_LABEL[id]}</span>
      <span style="font-size:12px;">
        <span style="color:${numColor};">${mod.hp}</span>
        <span style="color:${DIM};"> / </span>
        <span style="color:${numColor};">${mod.maxHp}</span>
      </span>
    </div>
    <div class="stat-bar" style="width:100%;">
      <div class="stat-bar-fill" style="width:${pct}%;background:${BAR_COLOR[id]};opacity:${barAlpha};"></div>
    </div>
  </div>`;
}
