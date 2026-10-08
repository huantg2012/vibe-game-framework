import type { Contaminant, Vector2 } from './game-types';

export type ItemLocation =
  | { kind: 'stash' }
  | { kind: 'carried' }
  | { kind: 'defense'; slot: number }
  | { kind: 'ground'; runId: string; position: Vector2 };
export interface ItemSource { nodeId?: string; runId?: string; fragmentId?: string }
export interface EquipmentLifecycle { stage: 'defense' | 'tool' | 'broken' | 'inert'; impactCharges: number; usesRemaining: number }
export interface WeaponInstance extends EquipmentLifecycle { id: string; definitionId: string }
export interface OfferingTransformResult { itemId: string; kind: 'weapon' | 'contaminant'; definitionId: string; slotIndex: number }
export type InventoryItem = (
  | { kind: 'weapon'; weapon: WeaponInstance }
  | { kind: 'contaminant'; contaminant: Contaminant }
) & { id: string; location: ItemLocation; source?: ItemSource };
export interface InventoryEquipment { weaponId: string | null; toolIds: (string | null)[]; defenseIds: (string | null)[] }
/** Durable facts paid at departure; these are not event trigger counts. */
export interface RunPassiveReceipt {
  itemId: string;
  catalogVersion: 'contaminant-v1';
  definitionId: string;
  publicName: string;
  familyId: 'sight' | 'capacity';
  benefit: number;
  usesConsumed: 1;
  usesRemaining: number;
}
export interface RunInventoryLedger {
  id: string;
  status: 'active' | 'settled';
  carriedOutIds: string[];
  revealedNodes: Record<string, string[]>;
  destroyedIds: string[];
  catalogVersion?: 'legacy-v1' | 'contaminant-v1';
  lootAlgorithmVersion?: 1;
  combatRulesVersion?: 1 | 2;
  dropPlan?: import('@/systems/contaminant-drop-plan').ContaminantDropPlan;
  actionReceipts?: Record<string,{itemId:string;broken:boolean;usesLeft:number;definitionId?:string;catalogVersion?:'contaminant-v1'}>;
  /** Missing on historical settled records means unknown, not an empty receipt. */
  passiveReceipts?: RunPassiveReceipt[];
  outcome?: 'extract' | 'death' | 'abandon' | 'abandon-keep';
  returnedIds?: string[];
  kindlingGained?: number;
  baseSettled?: boolean;
}
export interface InventoryState {
  version: 1 | 2 | 3;
  items: InventoryItem[];
  equipment: InventoryEquipment;
  run: RunInventoryLedger | null;
  starterGranted: boolean;
  firstWeaponDiscovered: boolean;
  discoveredCatalogIds?: string[];
  catalogTutorialRevealed?: boolean;
  offeringReceipts?: Record<string,OfferingTransformResult[]>;
  nextAcquiredOrdinal?: number;
}
export type InventoryError = 'invalid-item' | 'duplicate-id' | 'duplicate-action' | 'wrong-location' | 'equipped' | 'incompatible' | 'overweight' | 'run-active' | 'no-active-run' | 'invalid-ground' | 'storage-failed' | 'missing-weapon' | 'not-ready';
export type InventoryResult<T = undefined> = { ok: true; value: T } | { ok: false; error: InventoryError };
export interface InventoryRules {
  capacity: number;
  contaminantWeight: number;
  weaponDefinition: (id: string) => { id: string; weight: number } | undefined;
  isPassiveTool: (contaminant: Contaminant) => boolean;
  toolSlotCount: () => number;
  defenseSlotCount: () => number;
  starterDefinitionId?: string;
}
export type NewInventoryItem = Omit<Extract<InventoryItem, { kind: 'weapon' }>, 'location'> | Omit<Extract<InventoryItem, { kind: 'contaminant' }>, 'location'>;
export interface InventoryGroundValidation {
  canTake: (item: Readonly<InventoryItem>) => boolean;
  canDrop: (position: Readonly<Vector2>) => boolean;
}

/** One lifecycle payload per item; never a parallel mutable inventory field. */
export function getEquipmentLifecycle(item: InventoryItem): EquipmentLifecycle {
  return item.kind === 'weapon' ? item.weapon : item.contaminant;
}
