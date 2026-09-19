import { INVENTORY_RULES, CATALOG_ITEMS } from '@/generated/contaminant-catalog-data';
import { getCatalogDefinition,getCatalogItemWeight,getCatalogRuntimeAbility,getContaminantSlot,validateCatalogContaminant } from './contaminant-catalog';
import { validateContaminantDropPlan, type ContaminantDropPlan } from './contaminant-drop-plan';
import { migrateContaminant } from './contaminant-migration';
import { createWeaponInstance, equipmentLifecycleDefinition } from './equipment-lifecycle';
import { getEquipmentLifecycle, type OfferingTransformResult } from '../types/inventory-types';
import { CONTAMINANT_DATA } from '../generated/contaminant-data';
import { isContaminantQuality, supportsContaminantQuality } from './contaminant-quality';
/** Single inventory owner. Pure and Phaser-free; all field mutations persist before publishing. */
import type { Contaminant, Vector2 } from '../types/game-types';
import type { InventoryEquipment, InventoryError, InventoryGroundValidation, InventoryItem, InventoryResult, InventoryRules, InventoryState, NewInventoryItem, RunInventoryLedger } from '../types/inventory-types';

function emptyState(): InventoryState {
  return { version: 3, items: [], equipment: { weaponId: null, toolIds: [], defenseIds: [] }, run: null, starterGranted: false, firstWeaponDiscovered: false, catalogTutorialRevealed: false, discoveredCatalogIds: [], offeringReceipts: {}, nextAcquiredOrdinal: 1 };
}
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function fail(error: InventoryError): InventoryResult<never> { return { ok: false, error }; }
function success<T>(value: T): InventoryResult<T> { return { ok: true, value }; }
function validContaminant(contaminant: Contaminant | undefined): boolean {
  const c = contaminant;
  if(c?.type === 'catalog') return validateCatalogContaminant(c);
  return !!c && typeof c.id === 'string' && c.id.length > 0
    && Object.prototype.hasOwnProperty.call(CONTAMINANT_DATA, c.type)
    && c.catalog === undefined && ['common', 'fine', 'rare'].includes(c.rarity) && ['defense', 'tool'].includes(c.stage)
    && Number.isFinite(c.impactCharges) && c.impactCharges >= 0
    && Number.isSafeInteger(c.usesRemaining) && c.usesRemaining >= 0
    && (c.quality === undefined || (isContaminantQuality(c.quality) && supportsContaminantQuality(c.type)));
}
function clearReferences(state: InventoryState, id: string): void {
  if (state.equipment.weaponId === id) state.equipment.weaponId = null;
  state.equipment.toolIds = state.equipment.toolIds.map(value => value === id ? null : value);
  state.equipment.defenseIds = state.equipment.defenseIds.map(value => value === id ? null : value);
}

export class InventoryStore {
  private state = emptyState();
  private rules: InventoryRules = { capacity: INVENTORY_RULES.carry_capacity_tenths, contaminantWeight: INVENTORY_RULES.contaminant_weight_tenths, weaponDefinition: () => undefined, isPassiveTool: () => false, toolSlotCount: () => 3, defenseSlotCount: () => 3 };
  private persist: ((state: InventoryState) => void) | null = null;
  private readonly listeners = new Set<() => void>();
  private frame: { before: InventoryState; changed: boolean; locked: boolean } | null = null;
  configure(rules: Partial<InventoryRules>): void { this.rules = { ...this.rules, ...rules }; }
  setPersistence(persist: ((state: InventoryState) => void) | null): void { this.persist = persist; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getState(): InventoryState { return copy(this.state); }
  getItems(): readonly InventoryItem[] { return this.state.items; }
  getOfferingItems(): (InventoryItem | null)[] {
    return Array.from({ length: this.rules.defenseSlotCount() }, (_, slot) => {
      const id = this.state.equipment.defenseIds[slot];
      return id ? this.getItem(id) ?? null : null;
    });
  }
  getItem(id: string): InventoryItem | undefined { return this.state.items.find(item => item.id === id); }
  getEquipment(): Readonly<InventoryEquipment> { return this.state.equipment; }
  getRun(): Readonly<RunInventoryLedger> | null { return this.state.run; }
  isCatalogTutorialEligible():boolean { return !this.state.catalogTutorialRevealed; }
  getDiscoveredCatalogIds():readonly string[] { return this.state.discoveredCatalogIds??[]; }
  getCapacity(): number { return this.capacity(this.state); }
  private capacity(state: InventoryState): number {
    const item = state.items.find(item => item.kind === 'contaminant' && state.equipment.toolIds.includes(item.id) && getCatalogRuntimeAbility(item.contaminant)?.familyId === 'capacity');
    if(item?.kind !== 'contaminant')return this.rules.capacity;
    const c=item.contaminant, ability=getCatalogRuntimeAbility(c)!;
    if(state.run?.status === 'active')return this.rules.capacity + (c.catalog?.runBinding?.runId === state.run.id ? c.catalog.runBinding.benefit * 10 : 0);
    return this.rules.capacity + (c.usesRemaining > 0 ? ability.paramValue * 10 : 0);
  }
  getWeight(itemOrId: InventoryItem | string): number {
    const item = typeof itemOrId === 'string' ? this.getItem(itemOrId) : itemOrId;
    if (!item) return Infinity;
    const weight = item.kind === 'contaminant' ? (item.contaminant.type === 'catalog' ? getCatalogItemWeight(item.contaminant) : this.rules.contaminantWeight) : this.rules.weaponDefinition(item.weapon.definitionId)?.weight;
    return weight !== undefined && Number.isSafeInteger(weight) && weight > 0 ? weight : Infinity;
  }
  getCarryWeight(): number { return this.weight(this.state); }
  isEquipped(id: string): boolean { return this.state.equipment.weaponId === id || this.state.equipment.toolIds.includes(id); }
  /** Legacy lifecycle facade only: payload identity must remain stable for ToolSystem. */
  getContaminants(): Contaminant[] { return this.state.items.flatMap(item => item.kind === 'contaminant' ? [item.contaminant] : []); }
  /** These arrays are owned here; legacy lifecycle transforms mutate them at base only. */
  getLegacySlots(): { defenseSlots: (string | null)[]; sortieLoadout: (string | null)[] } {
    return { defenseSlots: this.state.equipment.defenseIds, sortieLoadout: this.state.equipment.toolIds };
  }
  private weight(state: InventoryState): number { return state.items.reduce((sum, item) => sum + (item.location.kind === 'carried' ? this.getWeight(item) : 0), 0); }
  private notify(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('Inventory subscriber failed after commit', error); }
    }
  }
  private publish(next: InventoryState, notify = true): void {
    // Keep legacy tool references live; callers retain contaminants throughout a sortie.
    for (const item of next.items) {
      const previous = this.getItem(item.id);
      if (item.kind === 'contaminant' && previous?.kind === 'contaminant') {
        if (item.contaminant.quality === undefined) delete previous.contaminant.quality;
        Object.assign(previous.contaminant, item.contaminant);
        item.contaminant = previous.contaminant;
      }
    }
    const remainingIds = new Set(next.items.map(item => item.id));
    for (const previous of this.state.items) {
      if (previous.kind === 'contaminant' && !remainingIds.has(previous.id)) {
        previous.contaminant.usesRemaining = 0;
        previous.contaminant.stage = 'broken';
      }
    }
    this.state = next;
    if (notify) this.notify();
  }
  private transaction<T>(mutate: (draft: InventoryState) => InventoryResult<T>): InventoryResult<T> {
    if (this.frame?.locked) return fail('storage-failed');
    const draft = copy(this.state);
    const result = mutate(draft);
    if (!result.ok) return result;
    if (this.frame) {
      // Mechanics in this frame must see the consumed item, including the
      // legacy tool payload. Observers only see it after the world is durable.
      this.frame.changed = true;
      this.publish(draft, false);
      return result;
    }
    try { this.persist?.(copy(draft)); } catch { return fail('storage-failed'); }
    this.publish(draft);
    return result;
  }
  /** Explicit opt-in for a scene that saves inventory and its resulting world
   * together. The ordinary inventory transaction path is unchanged. */
  beginFrameTransaction(): void {
    if (this.frame) throw new Error('Inventory frame is already open');
    this.frame = { before: this.getState(), changed: false, locked: false };
  }
  hasFrameTransaction(): boolean { return this.frame !== null; }
  hasFrameChanges(): boolean { return this.frame?.changed ?? false; }
  /** The caller captures an immutable whole-world candidate before calling
   * this, and retries those exact bytes on failure. Never re-run gameplay. */
  commitFrameTransaction(persistCompleteFrame: (inventory: InventoryState) => void): boolean {
    const frame = this.frame;
    if (!frame) throw new Error('No inventory frame to commit');
    frame.locked = true;
    try { persistCompleteFrame(this.getState()); } catch { return false; }
    this.frame = null;
    if (frame.changed) this.notify();
    return true;
  }
  /** Teardown only: the coordinator must also discard the matching uncommitted
   * world. This does not offer a user-selectable historical checkpoint. */
  cancelFrameTransaction(): void {
    const frame = this.frame;
    if (!frame) return;
    this.frame = null;
    this.publish(frame.before);
  }
  loadState(state: InventoryState): boolean {
    if (!state || ![1, 2, 3].includes(state.version) || !Array.isArray(state.items) || !state.equipment || !Array.isArray(state.equipment.toolIds) || !Array.isArray(state.equipment.defenseIds)) return false;
    state = copy(state);
    if (state.version === 1) {
      for (const item of state.items) if (item?.kind === 'weapon' && item.weapon && item.weapon.stage === undefined) {
        try { item.weapon = createWeaponInstance(item.weapon.definitionId, true, item.id); } catch { return false; }
      }
    }
    const legacySchema=state.version<3;
    state.version = 3;
    state.catalogTutorialRevealed ??= legacySchema;
    if(typeof state.catalogTutorialRevealed!=='boolean')return false;
    state.discoveredCatalogIds ??= []; state.offeringReceipts ??= {}; state.nextAcquiredOrdinal ??= 1;
    if(!Array.isArray(state.discoveredCatalogIds) || new Set(state.discoveredCatalogIds).size !== state.discoveredCatalogIds.length || state.discoveredCatalogIds.some(id=>!CATALOG_ITEMS[id])
      || !Number.isSafeInteger(state.nextAcquiredOrdinal) || state.nextAcquiredOrdinal < 1 || !state.offeringReceipts || typeof state.offeringReceipts !== 'object' || Array.isArray(state.offeringReceipts)) return false;
    const ids = new Set<string>();
    for (const item of state.items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !item.location || !['stash', 'carried', 'ground', 'defense'].includes(item.location.kind)) return false;
      if (item.kind === 'weapon') {
        if (item.weapon?.id !== item.id || typeof item.weapon.definitionId !== 'string') return false;
        const w = item.weapon;
        if (!['defense', 'tool'].includes(w.stage) || !Number.isFinite(w.impactCharges) || w.impactCharges < 0 || !Number.isSafeInteger(w.usesRemaining) || w.usesRemaining < 0 || (w.stage === 'tool' && w.usesRemaining === 0)) return false;
        try { equipmentLifecycleDefinition(item); } catch { return false; }
      } else if (item.kind === 'contaminant') {
        const c = item.contaminant;
        if (!validContaminant(c) || c.id !== item.id) return false;
        item.contaminant = migrateContaminant(c);
      } else return false;
      if (item.location.kind === 'ground' && (!item.location.position || !Number.isFinite(item.location.position.x) || !Number.isFinite(item.location.position.y) || item.location.runId !== state.run?.id)) return false;
      if (item.location.kind === 'defense' && (!Number.isInteger(item.location.slot) || item.location.slot < 0)) return false;
      ids.add(item.id);
    }
    const equipped = new Set<string>();
    const refs = [state.equipment.weaponId, ...state.equipment.toolIds, ...state.equipment.defenseIds];
    for (const id of refs) {
      if (id === null) continue;
      if (typeof id !== 'string' || !ids.has(id) || equipped.has(id)) return false;
      equipped.add(id);
    }
    if (state.equipment.weaponId) {
      const weapon = state.items.find(item => item.id === state.equipment.weaponId);
      if (weapon?.kind !== 'weapon' || weapon.weapon.stage !== 'tool' || weapon.weapon.usesRemaining <= 0 || weapon.location.kind !== 'carried') return false;
    }
    for (const id of state.equipment.toolIds) {
      if (!id) continue;
      const item = state.items.find(value => value.id === id);
      if (item?.kind !== 'contaminant' || item.contaminant.stage !== 'tool' || item.location.kind !== 'carried') return false;
    }
    for (let slot = 0; slot < state.equipment.defenseIds.length; slot++) {
      const id = state.equipment.defenseIds[slot];
      if (!id) continue;
      const item = state.items.find(value => value.id === id);
      if (!item || getEquipmentLifecycle(item).stage !== 'defense' || item.location.kind !== 'defense' || item.location.slot !== slot) return false;
    }
    if (state.run && (typeof state.run.id !== 'string' || !['active', 'settled'].includes(state.run.status) || !Array.isArray(state.run.carriedOutIds) || !Array.isArray(state.run.destroyedIds) || !state.run.revealedNodes || typeof state.run.revealedNodes !== 'object')) return false;
    if(state.run) {
      const run=state.run;
      if(run.catalogVersion!==undefined&&!['legacy-v1','contaminant-v1'].includes(run.catalogVersion))return false;
      if(run.lootAlgorithmVersion!==undefined&&run.lootAlgorithmVersion!==1)return false;
      if(run.combatRulesVersion!==undefined&&![1,2].includes(run.combatRulesVersion))return false;
      if(run.dropPlan&&(!validateContaminantDropPlan(run.dropPlan)||run.dropPlan.runId!==run.id||run.dropPlan.catalogVersion!==run.catalogVersion))return false;
      if(run.actionReceipts && (typeof run.actionReceipts!=='object'||Array.isArray(run.actionReceipts)||Object.entries(run.actionReceipts).some(([id,r])=>!id||!r||typeof r.itemId!=='string'||typeof r.broken!=='boolean'||!Number.isSafeInteger(r.usesLeft)||r.usesLeft<0||r.broken!==(r.usesLeft===0)||(r.definitionId!==undefined&&(!Object.prototype.hasOwnProperty.call(CATALOG_ITEMS,r.definitionId)||r.catalogVersion!=='contaminant-v1'))||(r.catalogVersion!==undefined&&r.definitionId===undefined))))return false;
    }
    const catalogOrdinals=new Set<number>();
    for(const item of state.items)if(item.kind==='contaminant'&&item.contaminant.catalog) {
      const c=item.contaminant,meta=c.catalog!;
      if(meta.acquiredOrdinal<1||meta.acquiredOrdinal>=state.nextAcquiredOrdinal!||catalogOrdinals.has(meta.acquiredOrdinal))return false;
      catalogOrdinals.add(meta.acquiredOrdinal);
      if(meta.identification==='revealed'&&!state.discoveredCatalogIds!.includes(meta.definitionId))return false;
      if(meta.runBinding&&(state.run?.status!=='active'||meta.runBinding.runId!==state.run.id||item.location.kind!=='carried'||!state.equipment.toolIds.includes(item.id)))return false;
    }
    for(const [key,receipts] of Object.entries(state.offeringReceipts!))if(!key||!Array.isArray(receipts)||receipts.some(r=>!r||typeof r.itemId!=='string'||!['weapon','contaminant'].includes(r.kind)||typeof r.definitionId!=='string'||!Number.isInteger(r.slotIndex)||r.slotIndex<0))return false;
    this.publish(copy(state));
    return true;
  }
  reset(): void { this.publish(emptyState()); }
  /** Explicit V1/dev import; supplies the sole canonical contaminant payloads. */
  importLegacy(contaminants: readonly Contaminant[], defenseIds: (string | null)[], toolIds: (string | null)[]): void {
    const state = emptyState();
    state.catalogTutorialRevealed=true;
    state.items = contaminants.map(contaminant => {
      const defense = defenseIds.indexOf(contaminant.id);
      return { kind: 'contaminant', id: contaminant.id, contaminant: { ...contaminant }, location: defense >= 0 ? { kind: 'defense', slot: defense } : toolIds.includes(contaminant.id) ? { kind: 'carried' } : { kind: 'stash' } };
    });
    const valid = new Set(contaminants.map(c => c.id));
    state.equipment.defenseIds = defenseIds.map(id => id && valid.has(id) ? id : null);
    state.equipment.toolIds = toolIds.map(id => id && valid.has(id) ? id : null);
    if (!this.loadState(state)) throw new Error('Invalid legacy inventory');
  }
  ensureStarter(replacementId?: string): InventoryResult<string | null> {
    if (this.state.run?.status === 'active') return fail('run-active');
    const owned = this.state.items.find(item => item.kind === 'weapon' && item.weapon.stage === 'tool' && item.weapon.usesRemaining > 0);
    if (owned) return success(owned.id);
    const definitionId = this.rules.starterDefinitionId;
    if (!definitionId || !this.rules.weaponDefinition(definitionId)) return fail('missing-weapon');
    return this.transaction(state => {
      const id = replacementId ?? `WPN_${crypto.randomUUID()}`;
      if (state.items.some(item => item.id === id)) return fail('duplicate-id');
      state.items.push({ kind: 'weapon', id, weapon: createWeaponInstance(definitionId, true, id), location: { kind: 'carried' } });
      state.equipment.weaponId = id;
      state.starterGranted = true;
      return success(id);
    });
  }
  addContaminant(contaminant: Contaminant): InventoryResult<string> {
    if (!validContaminant(contaminant)) return fail('invalid-item');
    contaminant = migrateContaminant(contaminant);
    return this.transaction(state => {
      if (state.items.some(item => item.id === contaminant.id)) return fail('duplicate-id');
      const payload=copy(contaminant);if(payload.catalog)payload.catalog.acquiredOrdinal=state.nextAcquiredOrdinal!++;
      state.items.push({ kind: 'contaminant', id: contaminant.id, contaminant: payload, location: { kind: state.run?.status === 'active' ? 'carried' : 'stash' } });
      return state.run?.status === 'active' && this.weight(state) > this.capacity(state) ? fail('overweight') : success(contaminant.id);
    });
  }
  prepareWeapon(id: string): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      const item = state.items.find(value => value.id === id);
      if (item?.kind !== 'weapon' || !['stash', 'carried'].includes(item.location.kind)) return fail('invalid-item');
      if (item.weapon.stage !== 'tool' || item.weapon.usesRemaining <= 0) return fail('not-ready');
      const old = state.items.find(value => value.id === state.equipment.weaponId);
      if (old) old.location = { kind: 'stash' };
      item.location = { kind: 'carried' };
      state.equipment.weaponId = id;
      return success(undefined);
    });
  }
  prepareTool(id: string | null, slot: number): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      const count = this.rules.toolSlotCount();
      if (slot < 0 || slot >= count) return fail('incompatible');
      const item = id ? state.items.find(value => value.id === id) : undefined;
      if (id && (item?.kind !== 'contaminant' || item.contaminant.stage !== 'tool' || item.contaminant.usesRemaining<=0 || !getContaminantSlot(item.contaminant) || !['stash', 'carried'].includes(item.location.kind))) return fail('incompatible');
      if (item?.kind === 'contaminant' && (getContaminantSlot(item.contaminant) === 'passive') !== (slot === count - 1)) return fail('incompatible');
      const old = state.items.find(value => value.id === state.equipment.toolIds[slot]);
      if (old) old.location = { kind: 'stash' };
      if (id) state.equipment.toolIds = state.equipment.toolIds.map(value => value === id ? null : value);
      state.equipment.toolIds[slot] = id;
      if (item) item.location = { kind: 'carried' };
      return success(undefined);
    });
  }
  slotDefense(id: string | null, slot: number): InventoryResult { return this.slotOffering(id, slot); }
  slotOffering(id: string | null, slot: number): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      if (slot < 0 || slot >= this.rules.defenseSlotCount()) return fail('incompatible');
      const item = id ? state.items.find(value => value.id === id) : undefined;
      if (id && (!item || getEquipmentLifecycle(item).stage !== 'defense' || item.location.kind !== 'stash')) return fail('incompatible');
      const old = state.items.find(value => value.id === state.equipment.defenseIds[slot]);
      if(id&&old&&old.id!==id)return fail('incompatible');
      if (old) old.location = { kind: 'stash' };
      state.equipment.defenseIds[slot] = id;
      if (item) item.location = { kind: 'defense', slot };
      return success(undefined);
    });
  }
  beginRun(runId: string, versions?: {catalogVersion:'legacy-v1'|'contaminant-v1';lootAlgorithmVersion:1;combatRulesVersion:1|2}): InventoryResult {
    return this.transaction(state => {
      if (state.run?.id === runId) return fail('run-active');
      if (state.run?.status === 'active') return fail('run-active');
      if (!state.equipment.weaponId || !state.items.some(item => item.id === state.equipment.weaponId && item.kind === 'weapon' && item.weapon.stage === 'tool' && item.weapon.usesRemaining > 0)) return fail('missing-weapon');
      if (this.weight(state) > this.capacity(state)) return fail('overweight');
      const toolSlotCount = this.rules.toolSlotCount();
      for (let slot = 0; slot < state.equipment.toolIds.length; slot++) {
        const id = state.equipment.toolIds[slot];
        if (!id) continue;
        const item = state.items.find(value => value.id === id);
        if (slot >= toolSlotCount || item?.kind !== 'contaminant' || item.contaminant.stage !== 'tool'
          || item.contaminant.usesRemaining <= 0
          || (getContaminantSlot(item.contaminant) === 'passive') !== (slot === toolSlotCount - 1)) return fail('incompatible');
      }
      const equipped = new Set([state.equipment.weaponId, ...state.equipment.toolIds]);
      if (state.items.some(item => item.location.kind === 'carried' && !equipped.has(item.id))) return fail('wrong-location');
      for(const id of state.equipment.toolIds) {
        const item=state.items.find(item=>item.id===id);if(item?.kind!=='contaminant'||item.contaminant.type!=='catalog')continue;
        const c=item.contaminant,ability=getCatalogRuntimeAbility(c);
        if(ability?.slot==='passive'&&(ability.familyId==='sight'||ability.familyId==='capacity')) {
          if(!c.catalog||c.catalog.runBinding||c.usesRemaining<=0)return fail('incompatible');
          c.usesRemaining--; c.catalog.runBinding={runId,consumed:true,familyId:ability.familyId,benefit:ability.paramValue};
        }
      }
      state.run = { id: runId, status: 'active', carriedOutIds: state.items.filter(item => item.location.kind === 'carried').map(item => item.id), revealedNodes: {}, destroyedIds: [], ...versions, actionReceipts: {} };
      return success(undefined);
    });
  }
  installDropPlan(plan:ContaminantDropPlan):InventoryResult {
    return this.transaction(state=>{
      const run=state.run;if(!run||run.status!=='active')return fail('no-active-run');
      if(!validateContaminantDropPlan(plan)||plan.runId!==run.id||run.catalogVersion!==plan.catalogVersion||run.lootAlgorithmVersion!==plan.lootAlgorithmVersion)return fail('invalid-item');
      if(run.dropPlan)return JSON.stringify(run.dropPlan)===JSON.stringify(plan)?success(undefined):fail('invalid-item');
      if(Object.keys(run.revealedNodes).length)return fail('invalid-item');
      run.dropPlan=copy(plan);return success(undefined);
    });
  }
  revealBatch(nodeId: string, items: readonly NewInventoryItem[], position: Vector2): InventoryResult<{ ids: string[]; taken: boolean }> {
    return this.transaction(state => {
      const run = state.run;
      if (!run || run.status !== 'active') return fail('no-active-run');
      const existing = run.revealedNodes[nodeId];
      if (existing) return success({ ids: [...existing], taken: existing.every(id => state.items.find(item => item.id === id)?.location.kind === 'carried') });
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return fail('invalid-ground');
      const expectedCatalog = run.dropPlan?.entries.find(entry => entry.nodeId === nodeId)?.contaminant;
      if (expectedCatalog && (items.length !== 1 || items[0]?.kind !== 'contaminant'
        || JSON.stringify(items[0].contaminant) !== JSON.stringify(expectedCatalog))) return fail('invalid-item');
      const ids = new Set(state.items.map(item => item.id));
      for (const item of items) {
        if (ids.has(item.id)) return fail('duplicate-id');
        if (item.id !== (item.kind === 'weapon' ? item.weapon.id : item.contaminant.id) || !Number.isFinite(this.getWeight({ ...item, location: { kind: 'stash' } }))) return fail('invalid-item');
        if (item.kind === 'weapon' && (!['defense', 'tool'].includes(item.weapon.stage) || !Number.isSafeInteger(item.weapon.usesRemaining) || item.weapon.usesRemaining < 0)) return fail('invalid-item');
        if (item.kind === 'contaminant' && !validContaminant(item.contaminant)) return fail('invalid-item');
        if(item.kind==='contaminant'&&item.contaminant.type==='catalog') {
          const planned=run.dropPlan?.entries.find(entry=>entry.nodeId===nodeId)?.contaminant;
          if(!planned||JSON.stringify(planned)!==JSON.stringify(item.contaminant))return fail('invalid-item');
        }
        ids.add(item.id);
      }
      const revealed: InventoryItem[] = items.map(item => ({ ...copy(item), location: { kind: 'ground', runId: run.id, position: { ...position } }, source: { ...item.source, nodeId, runId: run.id } }));
      for (const item of revealed) if (item.kind === 'contaminant') {
        item.contaminant = migrateContaminant(item.contaminant);
        if(item.contaminant.catalog)item.contaminant.catalog.acquiredOrdinal=state.nextAcquiredOrdinal!++;
      }
      const taken = this.weight(state) + revealed.reduce((sum, item) => sum + this.getWeight(item), 0) <= this.capacity(state);
      if (taken) for (const item of revealed) item.location = { kind: 'carried' };
      state.items.push(...revealed);
      run.revealedNodes[nodeId] = revealed.map(item => item.id);
      if (revealed.some(item => item.kind === 'weapon')) state.firstWeaponDiscovered = true;
      if(run.dropPlan?.tutorialNodeId===nodeId)state.catalogTutorialRevealed=true;
      return success({ ids: [...run.revealedNodes[nodeId]!], taken });
    });
  }
  take(ids: readonly string[], canTake: InventoryGroundValidation['canTake']): InventoryResult { return this.exchange(ids, [], { x: 0, y: 0 }, { canTake, canDrop: () => true }); }
  drop(ids: readonly string[], position: Vector2, canDrop: InventoryGroundValidation['canDrop']): InventoryResult { return this.exchange([], ids, position, { canTake: () => false, canDrop }); }
  exchange(takeIds: readonly string[], dropIds: readonly string[], position: Vector2, validation: InventoryGroundValidation): InventoryResult {
    return this.transaction(state => {
      const run = state.run;
      if (!run || run.status !== 'active') return fail('no-active-run');
      if (new Set([...takeIds, ...dropIds]).size !== takeIds.length + dropIds.length) return fail('duplicate-id');
      if (dropIds.length && (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !validation.canDrop(position))) return fail('invalid-ground');
      for (const id of takeIds) {
        const item = state.items.find(value => value.id === id);
        if (!item || item.location.kind !== 'ground' || item.location.runId !== run.id) return fail('wrong-location');
        if (!validation.canTake(item)) return fail('invalid-ground');
        item.location = { kind: 'carried' };
      }
      for (const id of dropIds) {
        const item = state.items.find(value => value.id === id);
        if (!item || item.location.kind !== 'carried') return fail('wrong-location');
        if (this.isEquipped(id)) return fail('equipped');
        item.location = { kind: 'ground', runId: run.id, position: { ...position } };
      }
      return this.weight(state) > this.capacity(state) ? fail('overweight') : success(undefined);
    });
  }
  consumeTool(id: string, actionId?: string): InventoryResult<{ broken: boolean; usesLeft: number }> {
    if(actionId && this.state.run?.actionReceipts?.[actionId])return fail('duplicate-action');
    if (this.getItem(id)?.kind !== 'contaminant') return fail('invalid-item');
    return this.consumeEquipmentUse(id, actionId);
  }
  consumeEquipmentUse(id: string, actionId?: string): InventoryResult<{ broken: boolean; usesLeft: number }> {
    return this.transaction(state => {
      if(actionId !== undefined && (!actionId || !state.run || state.run.status!=='active'))return fail('invalid-item');
      if(actionId && state.run?.actionReceipts?.[actionId])return fail('duplicate-action');
      const item = state.items.find(value => value.id === id);
      if (!item) return fail('invalid-item');
      if(item.kind==='contaminant' && getCatalogRuntimeAbility(item.contaminant)?.slot==='passive')return fail('incompatible');
      const lifecycle = getEquipmentLifecycle(item);
      if (lifecycle.stage !== 'tool' || lifecycle.usesRemaining <= 0) return fail('invalid-item');
      if (item.location.kind !== 'carried') return fail('wrong-location');
      const equipped = item.kind === 'weapon' ? state.equipment.weaponId === id : state.equipment.toolIds.includes(id);
      if (!equipped) return fail('equipped');
      lifecycle.usesRemaining--;
      const broken = lifecycle.usesRemaining === 0;
      if (broken) {
        clearReferences(state, id);
        state.items = state.items.filter(value => value.id !== id);
        state.run?.destroyedIds.push(id);
      }
      if(actionId&&state.run){state.run.actionReceipts??={};Object.defineProperty(state.run.actionReceipts,actionId,{value:{itemId:id,broken,usesLeft:lifecycle.usesRemaining,...(item.kind==='contaminant'&&item.contaminant.catalog?{definitionId:item.contaminant.catalog.definitionId,catalogVersion:item.contaminant.catalog.catalogVersion}:{})},enumerable:true,writable:true,configurable:true});}
      return success({ broken, usesLeft: lifecycle.usesRemaining });
    });
  }
  finishOfferingImpact(snapshotIds: readonly (string | null)[], normalCharges: number,
    bonusCharges: Readonly<Record<string, number>> = {}, impactId?: string): InventoryResult<OfferingTransformResult[]> {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      if (!Number.isFinite(normalCharges) || normalCharges < 0 || (impactId !== undefined && !impactId)) return fail('invalid-item');
      if(!impactId && snapshotIds.some(id=>state.items.some(item=>item.id===id&&item.kind==='contaminant'&&item.contaminant.type==='catalog')))return fail('invalid-item');
      if(impactId && Object.prototype.hasOwnProperty.call(state.offeringReceipts,impactId))return success([]);
      const results: OfferingTransformResult[] = [];
      const visited = new Set<string>();
      for (let slot = 0; slot < snapshotIds.length; slot++) {
        const id = snapshotIds[slot];
        if (!id || visited.has(id)) continue;
        visited.add(id);
        const item = state.items.find(value => value.id === id);
        if (!item || item.location.kind !== 'defense' || state.equipment.defenseIds[slot] !== id) continue;
        const lifecycle = getEquipmentLifecycle(item);
        if (lifecycle.stage !== 'defense') continue;
        const rule = equipmentLifecycleDefinition(item);
        const bonus = bonusCharges[id] ?? 0;
        if (!Number.isFinite(bonus) || bonus < 0) return fail('invalid-item');
        lifecycle.impactCharges += normalCharges * rule.chargeMultiplier + bonus;
        if (lifecycle.impactCharges < rule.offeringCharges) continue;
        lifecycle.stage = 'tool'; lifecycle.usesRemaining = rule.maxUses;
        if(item.kind === 'contaminant' && item.contaminant.type === 'catalog') {
          const c=item.contaminant, identity=c.catalog!;
          identity.identification='revealed'; identity.revealedAt=Date.now(); identity.revealReceiptId=`${impactId??'impact'}:${item.id}`;
          if(getCatalogDefinition(c)?.class==='inert')lifecycle.stage='inert';
          if(!state.discoveredCatalogIds!.includes(identity.definitionId))state.discoveredCatalogIds!.push(identity.definitionId);
        }
        item.location = { kind: 'stash' }; state.equipment.defenseIds[slot] = null;
        results.push({ itemId: id, kind: item.kind,
          definitionId: item.kind === 'weapon' ? item.weapon.definitionId : item.contaminant.catalog?.definitionId ?? item.contaminant.type, slotIndex: slot });
      }
      if(impactId)Object.defineProperty(state.offeringReceipts!,impactId,{value:copy(results),enumerable:true,writable:true,configurable:true});
      return success(results);
    });
  }
  discardAtBase(id: string): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      const item = state.items.find(value => value.id === id);
      if (!item || item.location.kind !== 'stash') return fail('wrong-location');
      clearReferences(state, id);
      state.items = state.items.filter(value => value.id !== id);
      return success(undefined);
    });
  }
  settleRun(runId: string, outcome: 'extract' | 'death' | 'abandon' | 'abandon-keep', kindlingGained = 0): InventoryResult<{ returnedIds: string[] }> {
    return this.transaction(state => {
      const run = state.run;
      if (!run || run.id !== runId) return fail('no-active-run');
      if (run.status === 'settled') return success({ returnedIds: [...(run.returnedIds ?? [])] });
      const returnedIds: string[] = [];
      state.items = state.items.filter(item => {
        if (item.location.kind === 'ground') return false;
        if (item.location.kind !== 'carried') return true;
        if (outcome === 'death' || outcome === 'abandon' || (outcome === 'abandon-keep' && !run.carriedOutIds.includes(item.id))) { clearReferences(state, item.id); return false; }
        if (!run.carriedOutIds.includes(item.id)) returnedIds.push(item.id);
        if (state.equipment.weaponId !== item.id && !state.equipment.toolIds.includes(item.id)) item.location = { kind: 'stash' };
        return true;
      });
      const expired:string[]=[];
      for(const item of state.items) {
        if(item.kind!=='contaminant'||item.contaminant.catalog?.runBinding?.runId!==run.id)continue;
        delete item.contaminant.catalog.runBinding;
        if(item.contaminant.usesRemaining===0)expired.push(item.id);
      }
      for(const id of expired){clearReferences(state,id);state.items=state.items.filter(item=>item.id!==id);if(!run.destroyedIds.includes(id))run.destroyedIds.push(id);}
      run.status = 'settled'; run.outcome = outcome; run.returnedIds = returnedIds; run.kindlingGained = outcome === 'extract' ? kindlingGained : 0;
      return success({ returnedIds });
    });
  }
  markBaseSettled(): InventoryResult {
    return this.transaction(state => {
      if (!state.run || state.run.status !== 'settled') return fail('no-active-run');
      state.run.baseSettled = true;
      return success(undefined);
    });
  }
  /** Caller must obtain an explicit interrupted-run policy; no implicit death. */
  recoverInterruptedRun(policy: 'lose-carried' | 'keep-carried-out'): InventoryResult<{ returnedIds: string[] }> {
    const run = this.state.run;
    if (!run) return fail('no-active-run');
    return this.settleRun(run.id, policy === 'lose-carried' ? 'death' : 'abandon-keep');
  }
}
export const inventoryStore = new InventoryStore();
