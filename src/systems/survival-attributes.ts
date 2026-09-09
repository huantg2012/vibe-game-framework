/** One projection of committed inventory. No extra burden resource or item copies. */
import { SURVIVAL_RULES } from '@/generated/survival-data';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { inventoryStore } from '@/systems/inventory-store';

export function sumPollutionResistance(sources: readonly number[]): number {
  return Math.max(0, Math.min(SURVIVAL_RULES.resistance_cap_percent,
    sources.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)));
}

export function getBurdenSpeedFactor(weight: number, capacity: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(capacity) || capacity <= 0) return 1;
  const start = SURVIVAL_RULES.burden_slow_start_ratio;
  const burden = Math.max(0, Math.min(1, (weight / capacity - start) / (1 - start)));
  return 1 - SURVIVAL_RULES.burden_max_slow_ratio * burden;
}

export interface SurvivalAttributes {
  readonly resistancePercent: number;
  readonly burdenSpeedFactor: number;
  readonly weight: number;
  readonly capacity: number;
}

/** Only equipped, carried gear contributes. Reserved sources start at zero, not invented bonuses. */
export function getSurvivalAttributes(): SurvivalAttributes {
  const eq = inventoryStore.getEquipment();
  const item = eq.weaponId ? inventoryStore.getItem(eq.weaponId) : undefined;
  const resistance = item?.kind === 'weapon' && item.location.kind === 'carried'
    ? WEAPON_DATA[item.weapon.definitionId]?.pollutionResistance ?? 0 : 0;
  const weight = inventoryStore.getCarryWeight();
  const capacity = inventoryStore.getCapacity();
  return { resistancePercent: sumPollutionResistance([resistance]), burdenSpeedFactor: getBurdenSpeedFactor(weight, capacity), weight, capacity };
}
