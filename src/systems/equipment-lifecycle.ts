/** Definition-owned lifecycle rules, shared by inventory, migration and previews. */
import { GAME_CONSTANTS } from '@/config/constants';
import { CONTAMINANT_DATA } from '@/generated/contaminant-data';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { getContaminantMaxUses } from '@/systems/contaminant-quality';
import type { InventoryItem, WeaponInstance } from '@/types/inventory-types';

export function equipmentLifecycleDefinition(item: InventoryItem): { offeringCharges: number; maxUses: number; chargeMultiplier: number } {
  if (item.kind === 'weapon') {
    const definition = WEAPON_DATA[item.weapon.definitionId];
    if (!definition) throw new Error(`Unknown weapon definition: ${item.weapon.definitionId}`);
    return { offeringCharges: definition.offeringCharges, maxUses: definition.maxUses, chargeMultiplier: 1 };
  }
  const definition = CONTAMINANT_DATA[item.contaminant.type];
  return { offeringCharges: GAME_CONSTANTS.TIDE.TRANSFORM_THRESHOLD,
    maxUses: getContaminantMaxUses(item.contaminant), chargeMultiplier: definition.defenseChargeMult };
}

export function createWeaponInstance(definitionId: string, ready = false, id = `WPN_${crypto.randomUUID()}`): WeaponInstance {
  const definition = WEAPON_DATA[definitionId];
  if (!definition) throw new Error(`Unknown weapon definition: ${definitionId}`);
  return { id, definitionId, stage: ready ? 'tool' : 'defense',
    impactCharges: ready ? definition.offeringCharges : 0, usesRemaining: ready ? definition.maxUses : 0 };
}
