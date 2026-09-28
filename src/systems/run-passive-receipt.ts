import { CATALOG_ITEMS, CATALOG_QUALITIES } from '@/generated/contaminant-catalog-data';
import type { Contaminant } from '@/types/game-types';
import type { InventoryState, RunPassiveReceipt } from '@/types/inventory-types';
import { getBoundCatalogPassive, getCatalogDefinition, projectItemForPlayer } from './contaminant-catalog';

/** Only a revealed, already-consumed binding may become a report fact. */
export function createRunPassiveReceipt(contaminant: Contaminant, runId: string): RunPassiveReceipt | null {
  const binding = getBoundCatalogPassive(contaminant, runId);
  const definition = getCatalogDefinition(contaminant);
  if (!binding?.consumed || !definition) return null;
  return {
    itemId: contaminant.id, catalogVersion: 'contaminant-v1', definitionId: definition.id,
    publicName: projectItemForPlayer(contaminant).name, familyId: binding.familyId,
    benefit: binding.benefit, usesConsumed: 1, usesRemaining: contaminant.usesRemaining,
  };
}

/** Validate on the inventory's private load candidate, before publishing it.
 * Old active saves still contain proof in their bindings; old settled saves do not. */
export function restoreRunPassiveReceipts(state: InventoryState): boolean {
  const run = state.run;
  if (!run) return true;
  const bound = run.status === 'active' ? state.items.flatMap(item => {
    const receipt = item.kind === 'contaminant' ? createRunPassiveReceipt(item.contaminant, run.id) : null;
    return receipt ? [receipt] : [];
  }) : [];
  if (run.passiveReceipts === undefined) {
    if (run.status !== 'active') return true;
    run.passiveReceipts = bound;
  }
  if (!Array.isArray(run.passiveReceipts)) return false;
  const seen = new Set<string>();
  for (const receipt of run.passiveReceipts) {
    if (!receipt || typeof receipt.itemId !== 'string' || !receipt.itemId || seen.has(receipt.itemId)
      || receipt.catalogVersion !== 'contaminant-v1' || typeof receipt.definitionId !== 'string'
      || !Object.prototype.hasOwnProperty.call(CATALOG_ITEMS, receipt.definitionId)) return false;
    const definition = CATALOG_ITEMS[receipt.definitionId]!;
    const maxUses = definition.baseUses + Math.max(...Object.values(CATALOG_QUALITIES).map(quality => quality.extraUses));
    if (definition.slot !== 'passive' || definition.scope !== 'run'
      || !['sight', 'capacity'].includes(receipt.familyId) || receipt.familyId !== definition.familyId
      || receipt.publicName !== definition.name || receipt.benefit !== definition.paramValue
      || receipt.usesConsumed !== 1 || !Number.isSafeInteger(receipt.usesRemaining)
      || receipt.usesRemaining < 0 || receipt.usesRemaining >= maxUses
      || !run.carriedOutIds.includes(receipt.itemId)
      || !state.discoveredCatalogIds?.includes(receipt.definitionId)) return false;
    const item = state.items.find(candidate => candidate.id === receipt.itemId);
    if (item && (item.kind !== 'contaminant' || item.contaminant.catalog?.definitionId !== receipt.definitionId
      || item.contaminant.catalog.identification !== 'revealed' || item.contaminant.usesRemaining !== receipt.usesRemaining)) return false;
    if (run.status === 'active') {
      const expected = bound.find(candidate => candidate.itemId === receipt.itemId);
      if (!expected || Object.entries(expected).some(([key, value]) => receipt[key as keyof RunPassiveReceipt] !== value)) return false;
    } else if (!item && !run.baseSettled && run.outcome !== 'death' && run.outcome !== 'abandon'
      && !run.destroyedIds.includes(receipt.itemId)) return false;
    seen.add(receipt.itemId);
  }
  return run.status !== 'active' || bound.every(receipt => seen.has(receipt.itemId));
}

export interface RunPassiveReceiptView {
  readonly name: string;
  readonly effect: string;
  readonly consumption: string;
}

/** The result does not imply survival, a triggered event or unspent charges. */
export function projectRunPassiveReceipts(receipts: readonly RunPassiveReceipt[] | undefined): RunPassiveReceiptView[] {
  return (receipts ?? []).map(receipt => ({
    name: receipt.publicName,
    effect: receipt.familyId === 'sight' ? `视距 ×${receipt.benefit}` : `负重上限 +${receipt.benefit}`,
    consumption: `消耗 ${receipt.usesConsumed} 趟`,
  }));
}
