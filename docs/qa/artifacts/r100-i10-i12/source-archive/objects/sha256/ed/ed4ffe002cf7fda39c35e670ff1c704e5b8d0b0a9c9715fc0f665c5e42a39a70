/** Read-only investment previews. These never spend, repair or publish events. */
import { GAME_CONSTANTS } from '@/config/constants';
import { computeStartingChaos } from '@/managers/game-state';

interface ModuleIntegrity {
  readonly id: string;
  readonly hp: number;
  readonly maxHp: number;
}

export interface ThickeningPreview {
  readonly modules: readonly (ModuleIntegrity & { readonly nextMaxHp: number })[];
  readonly startingChaos: number;
  readonly nextStartingChaos: number;
  /** Cheapest total refill: the pending allowance is spent on just one useful repair. */
  readonly refillKindling: number;
}

export function previewThickening(
  modules: readonly ModuleIntegrity[],
  repairAllowanceHp: number,
): ThickeningPreview {
  const increment = GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER;
  const repair = GAME_CONSTANTS.PURIFICATION.REPAIR_PER_KINDLING;
  const rows = modules.map(module => ({ ...module, nextMaxHp: module.maxHp + increment }));
  const regularCosts = rows.map(module => Math.ceil(Math.max(0, module.nextMaxHp - module.hp) / repair));
  // The allowance requires an actual injection and cannot be split across modules.
  const allowance = Math.max(0, repairAllowanceHp);
  const saving = rows.reduce((best, module, index) => {
    const deficit = Math.max(0, module.nextMaxHp - module.hp);
    const withAllowance = deficit === 0 ? 0 : Math.max(1, Math.ceil((deficit - allowance) / repair));
    return Math.max(best, regularCosts[index]! - withAllowance);
  }, 0);
  const purifier = rows.find(module => module.id === 'PURIFIER');
  return {
    modules: rows,
    startingChaos: computeStartingChaos(purifier?.hp ?? 0, purifier?.maxHp ?? 0),
    nextStartingChaos: computeStartingChaos(purifier?.hp ?? 0, purifier?.nextMaxHp ?? 0),
    refillKindling: regularCosts.reduce((total, cost) => total + cost, 0) - saving,
  };
}
