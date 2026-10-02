/** Isolated training inventory. This is explicitly not a continuous-supply validation. */
import { GAME_CONSTANTS } from '@/config/constants';
import { BUILD_LAB_LOADOUTS, type BuildLabLoadoutId } from '@/generated/build-lab-data';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { gameState } from '@/managers/game-state';
import { saveManager, type SaveStorage } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { getContaminantMaxUses } from '@/systems/contaminant-quality';
import { resetDefenseEngine } from '@/systems/defense-engine';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { inventoryStore } from '@/systems/inventory-store';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';
import type { LegacyContaminantType } from '@/types/game-types';
import type { InventoryResult } from '@/types/inventory-types';

export class BuildLabMemoryStorage implements SaveStorage {
  private readonly records = new Map<string, string>();
  getItem(key: string): string | null { return this.records.get(key) ?? null; }
  setItem(key: string, value: string): void { this.records.set(key, value); }
  removeItem(key: string): void { this.records.delete(key); }
}

function requireSuccess<T>(result: InventoryResult<T>): T {
  if (!result.ok) throw new Error(`Build-lab inventory transaction failed: ${result.error}`);
  return result.value;
}

/** Scene must be stopped first, so old listeners cannot consume the next run's items. */
export function prepareBuildLabRun(
  loadoutId: BuildLabLoadoutId,
  versions?: Parameters<typeof inventoryStore.beginRun>[1],
): string {
  const definition = BUILD_LAB_LOADOUTS.find(row => row.id === loadoutId);
  if (!definition) throw new Error(`Unknown build-lab loadout: ${loadoutId}`);
  // Caller installs the memory backend before boot. Never restore browser storage here.
  saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); resetDefenseEngine();
  impactSystem.resetForecastState(); contaminantSystem.reset();
  const weaponId = inventoryStore.getEquipment().weaponId;
  const weapon = weaponId ? inventoryStore.getItem(weaponId) : undefined;
  if (weapon?.kind !== 'weapon' || weapon.weapon.definitionId !== definition.weapon) throw new Error('Build-lab requires the production starter weapon');
  for (const [slot, type] of [definition.activeA, definition.activeB, definition.passive].entries()) {
    if (!type) continue;
    const family = type as LegacyContaminantType;
    const item = contaminantSystem.createUnowned(family, CONTAMINANT_DATA[family].rarity, 'ordinary');
    // A clearly declared training grant. Uses/threshold still come from their actual definitions.
    item.stage = 'tool'; item.impactCharges = GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD;
    item.usesRemaining = getContaminantMaxUses(item);
    requireSuccess(inventoryStore.addContaminant(item));
    requireSuccess(inventoryStore.prepareTool(item.id, slot));
  }
  contaminantSystem.syncInventoryDerivedState();
  saveManager.save();
  const runId = `build-lab-${crypto.randomUUID()}`;
  requireSuccess(inventoryStore.beginRun(runId, versions));
  return runId;
}
