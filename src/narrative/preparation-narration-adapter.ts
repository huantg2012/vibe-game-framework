import { inventoryStore, type InventoryStore } from '../systems/inventory-store';
import { eventBus } from '../core/event-bus';
import { GameEvent } from '../types/events';
import { WEAPON_DATA } from '../generated/weapon-data';
import { projectItemForPlayer } from '../systems/contaminant-catalog';
import { getEquipmentLifecycle, type InventoryItem, type InventoryState } from '../types/inventory-types';
import { PreparationNarrationJourney, type PreparationNarrationFact } from './preparation-narration';

type WeaponItem = Extract<InventoryItem, { kind: 'weapon' }>;
export const PREPARATION_WORN_WEAPON_RATIO = 0.25;
function usable(item: InventoryItem | undefined): item is InventoryItem {
  if (!item) return false;
  const lifecycle = getEquipmentLifecycle(item);
  if (lifecycle.stage !== 'tool' || lifecycle.usesRemaining <= 0) return false;
  if (item.kind === 'contaminant') {
    const view = projectItemForPlayer(item.contaminant);
    if (view.identification === 'unidentified' || view.inert) return false;
  }
  return true;
}
function weapon(state: InventoryState): WeaponItem | undefined {
  const item = state.items.find(value => value.id === state.equipment.weaponId);
  return usable(item) && item.kind === 'weapon' && item.location.kind === 'carried' ? item : undefined;
}
function worn(item: WeaponItem): boolean {
  const max = WEAPON_DATA[item.weapon.definitionId]?.maxUses;
  return !!max && item.weapon.usesRemaining < max && item.weapon.usesRemaining / max <= PREPARATION_WORN_WEAPON_RATIO;
}
/** Conservative public damage dominance, not quality/newness or a hidden power score. */
export function improvedPreparationWeapon(before: WeaponItem | undefined, after: WeaponItem | undefined): boolean {
  if (!before || !after || before.id === after.id || worn(after)) return false;
  const a = WEAPON_DATA[before.weapon.definitionId], b = WEAPON_DATA[after.weapon.definitionId];
  return !!a && !!b && a.profileId === b.profileId && b.damageMin >= a.damageMin && b.damageMax >= a.damageMax
    && (b.damageMin > a.damageMin || b.damageMax > a.damageMax);
}
/** Installed before any settlement. Transient facts are never reconstructed after reload. */
export class PreparationNarrationAdapter {
  private cachedFacts: readonly PreparationNarrationFact[] | null = null;
  private readonly recent = new Map<string, PreparationNarrationFact>();
  private readonly mature = new Set<string>();
  private newWeapon: string | null = null;
  private lossRun: string | null = null;
  private sequence = 0;
  private readonly order = new Map<string, number>();
  private remember(key: string): void { if (!this.order.has(key)) this.order.set(key, ++this.sequence); }
  private readonly unsubscribe: () => void;
  private readonly unsubscribeReplacement: () => void;
  constructor(private readonly store: InventoryStore = inventoryStore) {
    this.unsubscribeReplacement = store.subscribeReplacement(() => this.clearRecent());
    this.unsubscribe = store.subscribeCommitted((before, after) => this.committed(before, after),
      (before, after) => before.run?.status !== 'active' || after.run?.status !== 'active');
    eventBus.on(GameEvent.GROWTH_PURCHASED, this.growth);
  }
  private readonly growth = ({ upgradeId }: { upgradeId: string }): void => {
    if (upgradeId !== 'growth_vitality' && upgradeId !== 'growth_chaos_resist') return;
    this.cachedFacts = null;
    const key = `growth:${++this.sequence}`;
    this.remember(key);
    this.recent.set(key, { pool: 'prepare.body_growth', key, recent: true });
  };
  /** Call when loading/replacing a record; absence of event receipts is conservative. */
  clearRecent(): void { this.cachedFacts = null; this.recent.clear(); this.mature.clear(); this.newWeapon = null; this.lossRun = null; this.order.clear(); }
  private committed(before: InventoryState, after: InventoryState): void {
    this.cachedFacts = null;
    if (after.run?.status === 'active') {
      // Starting a sortie ends all haven opportunities. Active gameplay cannot manufacture them.
      this.clearRecent(); return;
    }
    const run = after.run;
    if (before.run?.status === 'active' && run?.status === 'settled' && before.run.id === run.id) {
      if (run.outcome === 'death' || run.outcome === 'abandon' || run.outcome === 'abandon-keep') {
        const lost = before.items.some(item => item.location.kind === 'carried'
          && !after.items.some(next => next.id === item.id)
          && (run.outcome !== 'abandon-keep' || !before.run!.carriedOutIds.includes(item.id))
          && (getEquipmentLifecycle(item).stage !== 'tool' || getEquipmentLifecycle(item).usesRemaining > 0));
        if (lost) { this.lossRun = run.id; const key = `loss:${run.id}`; this.remember(key); this.recent.set(key, { pool: 'prepare.return_loss', key, recent: true }); }
      } else if (run.outcome === 'extract' && ((run.kindlingGained ?? 0) > 0 || (run.returnedIds?.length ?? 0) > 0)) {
        const key = `gain:${run.id}`; this.remember(key); this.recent.set(key, { pool: 'prepare.return_gain', key, recent: true });
      }
    }
    for (const item of after.items) {
      const previous = before.items.find(value => value.id === item.id);
      if (previous && !usable(previous) && usable(item)) { this.mature.add(item.id); this.remember(`ready:${item.id}`); }
    }
    const next = weapon(after);
    if (improvedPreparationWeapon(weapon(before), next)) { this.newWeapon = next!.id; this.remember(`weapon:${next!.id}`); }
  }
  private facts = (): readonly PreparationNarrationFact[] => {
    if (this.cachedFacts) return this.cachedFacts;
    const state = this.store.getState();
    if (state.run?.status === 'active' || (state.run?.status === 'settled' && !state.run.baseSettled)) return this.cachedFacts = [];
    const result: PreparationNarrationFact[] = [];
    const held = weapon(state);
    if (held && held.id === this.newWeapon && !worn(held)) {
      const key = `weapon:${held.id}`;
      if (this.lossRun) result.push({ pool: 'prepare.loss_new_weapon', key, recent: true, eventKeys: [key, `loss:${this.lossRun}`] });
      for (const grade of ['low', 'medium', 'severe'] as const) result.push({ pool: `prepare.new_weapon.${grade}`, key, recent: true });
    }
    for (const item of state.items) if (this.mature.has(item.id) && item.location.kind === 'stash' && usable(item)) {
      result.push({ pool: 'prepare.ready_item', key: `ready:${item.id}`, recent: true });
    }
    result.push(...[...this.recent.values()].reverse());
    if (held && worn(held)) result.push({ pool: 'prepare.worn_weapon', key: `worn:${held.id}`, recent: false });
    return this.cachedFacts = result.sort((a, b) => (this.order.get(b.key) ?? -1) - (this.order.get(a.key) ?? -1));
  };
  createJourney(): PreparationNarrationJourney { return new PreparationNarrationJourney(this.facts); }
  destroy(): void { this.unsubscribe(); this.unsubscribeReplacement(); eventBus.off(GameEvent.GROWTH_PURCHASED, this.growth); this.recent.clear(); this.mature.clear(); }
}
let shared: PreparationNarrationAdapter | null = null;
export function installPreparationNarration(): PreparationNarrationAdapter { return shared ??= new PreparationNarrationAdapter(); }
