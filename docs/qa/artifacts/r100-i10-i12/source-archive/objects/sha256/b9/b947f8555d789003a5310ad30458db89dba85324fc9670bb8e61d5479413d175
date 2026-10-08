/** Conservative recovery of progression facts from existing, validated records.
 * This does not infer a successful sortie from money, stability or cycle count. */
import { CATALOG_ITEMS } from '@/generated/contaminant-catalog-data';
import { getContaminantSlot } from '@/systems/contaminant-catalog';
import type { InventoryState } from '@/types/inventory-types';
import type { TideState } from '@/types/game-types';

export function recoverGrowthFacts(inventory: InventoryState, tide: TideState, cycle: number) {
  const revealedCatalog = (inventory.discoveredCatalogIds ?? []).some(id => {
    const slot = CATALOG_ITEMS[id]?.slot;
    return slot === 'active' || slot === 'passive';
  });
  const knownLegacyTool = inventory.items.some(item => item.kind === 'contaminant'
    && item.contaminant.type !== 'catalog' && item.contaminant.stage === 'tool'
    && getContaminantSlot(item.contaminant) !== null);
  const completedReceipt = Object.values(inventory.offeringReceipts ?? {}).some(items => items.length > 0);
  return {
    impactOccurred: inventory.run?.status === 'settled' && inventory.run.baseSettled === true && cycle >= 2,
    offeringCompleted: completedReceipt || revealedCatalog,
    toolRevealed: revealedCatalog || knownLegacyTool,
    leftFiniteCrest: tide.phase === 'ebb' || tide.tideNumber > 1,
  };
}
