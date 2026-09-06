/**
 * Shared 三模块身份带 (Kit §A8.3 / I11-B4a).
 *
 * Shared name, hp / maxHp and bar with explicit selected and actionable states.
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
  CORE: '#b5bbaf',
  STORAGE: '#b29a73',
  PURIFIER: '#b5bbaf',
};

/** A5-5 条旁数字。 */
export const NUM_ACTIVE: Record<ModuleType, string> = {
  CORE: '#b5bbaf',
  STORAGE: '#b29a73',
  PURIFIER: '#729887',
};

export const BAR_COLOR: Record<ModuleType, string> = {
  CORE: '#b5bbaf',
  STORAGE: '#b29a73',
  PURIFIER: '#729887',
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
  return `<div class="panel-fixed module-identity-band">${cells}</div>`;
}

function identityCellHtml(id: ModuleType, opts: IdentityStripOpts): string {
  const mod = gameState.getModule(id);
  if (!mod) return `<div style="flex:1;min-width:0;"></div>`;
  const pct = Math.round((mod.hp / mod.maxHp) * 100);
  const active = opts.activeId === id;
  const selected = opts.selectedId === id;
  const nameColor = active ? NAME_ACTIVE[id] : DIM;
  const numColor = active ? NUM_ACTIVE[id] : DIM;
  const tag = opts.clickable ? 'button' : 'div';
  const dataAttr = opts.clickable ? ` type="button" data-module-id="${id}" aria-pressed="${selected}"` : '';
  const stateClass = active ? ' is-active' : selected ? ' is-selected' : '';
  return `<${tag}${dataAttr} class="module-identity-cell${stateClass}" style="--module-color:${BAR_COLOR[id]};">
    <div class="module-identity-heading">
      <span class="module-identity-name" style="color:${nameColor};">${MODULE_LABEL[id]}${opts.clickable ? '<span class="module-identity-affordance" aria-hidden="true">›</span>' : ''}</span>
      <span class="module-identity-number" style="color:${numColor};">${mod.hp}<span style="color:${DIM};"> / </span>${mod.maxHp}</span>
    </div>
    <div class="stat-bar" style="width:100%;">
      <div class="stat-bar-fill" style="width:${pct}%;background:${BAR_COLOR[id]};"></div>
    </div>
  </${tag}>`;
}
