/** Single inventory owner. Pure and Phaser-free; all field mutations persist before publishing. */
import type { Contaminant, Vector2 } from '../types/game-types';
import type { InventoryEquipment, InventoryError, InventoryGroundValidation, InventoryItem, InventoryResult, InventoryRules, InventoryState, NewInventoryItem, RunInventoryLedger } from '../types/inventory-types';

function emptyState(): InventoryState {
  return { version: 1, items: [], equipment: { weaponId: null, toolIds: [], defenseIds: [] }, run: null, starterGranted: false, firstWeaponDiscovered: false };
}
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function fail(error: InventoryError): InventoryResult<never> { return { ok: false, error }; }
function success<T>(value: T): InventoryResult<T> { return { ok: true, value }; }
function clearReferences(state: InventoryState, id: string): void {
  if (state.equipment.weaponId === id) state.equipment.weaponId = null;
  state.equipment.toolIds = state.equipment.toolIds.map(value => value === id ? null : value);
  state.equipment.defenseIds = state.equipment.defenseIds.map(value => value === id ? null : value);
}

export class InventoryStore {
  private state = emptyState();
  private rules: InventoryRules = { capacity: 160, contaminantWeight: 20, weaponDefinition: () => undefined, isPassiveTool: () => false, toolSlotCount: () => 3, defenseSlotCount: () => 3 };
  private persist: ((state: InventoryState) => void) | null = null;
  private readonly listeners = new Set<() => void>();
  configure(rules: Partial<InventoryRules>): void { this.rules = { ...this.rules, ...rules }; }
  setPersistence(persist: ((state: InventoryState) => void) | null): void { this.persist = persist; }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  getState(): InventoryState { return copy(this.state); }
  getItems(): readonly InventoryItem[] { return this.state.items; }
  getItem(id: string): InventoryItem | undefined { return this.state.items.find(item => item.id === id); }
  getEquipment(): Readonly<InventoryEquipment> { return this.state.equipment; }
  getRun(): Readonly<RunInventoryLedger> | null { return this.state.run; }
  getCapacity(): number { return this.rules.capacity; }
  getWeight(itemOrId: InventoryItem | string): number {
    const item = typeof itemOrId === 'string' ? this.getItem(itemOrId) : itemOrId;
    if (!item) return Infinity;
    const weight = item.kind === 'contaminant' ? this.rules.contaminantWeight : this.rules.weaponDefinition(item.weapon.definitionId)?.weight;
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
  private publish(next: InventoryState): void {
    // Keep legacy tool references live; callers retain contaminants throughout a sortie.
    for (const item of next.items) {
      const previous = this.getItem(item.id);
      if (item.kind === 'contaminant' && previous?.kind === 'contaminant') {
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
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('Inventory subscriber failed after commit', error); }
    }
  }
  private transaction<T>(mutate: (draft: InventoryState) => InventoryResult<T>): InventoryResult<T> {
    const draft = copy(this.state);
    const result = mutate(draft);
    if (!result.ok) return result;
    try { this.persist?.(copy(draft)); } catch { return fail('storage-failed'); }
    this.publish(draft);
    return result;
  }
  loadState(state: InventoryState): boolean {
    if (!state || state.version !== 1 || !Array.isArray(state.items) || !state.equipment || !Array.isArray(state.equipment.toolIds) || !Array.isArray(state.equipment.defenseIds)) return false;
    const ids = new Set<string>();
    for (const item of state.items) {
      if (!item || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !item.location || !['stash', 'carried', 'ground', 'defense'].includes(item.location.kind)) return false;
      if (item.kind === 'weapon') {
        if (item.weapon?.id !== item.id || typeof item.weapon.definitionId !== 'string') return false;
      } else if (item.kind === 'contaminant') {
        const c = item.contaminant;
        if (!c || c.id !== item.id || typeof c.type !== 'string' || !['common', 'fine', 'rare'].includes(c.rarity) || !['defense', 'tool'].includes(c.stage) || !Number.isFinite(c.impactCharges) || c.impactCharges < 0 || !Number.isSafeInteger(c.usesRemaining) || c.usesRemaining < 0) return false;
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
      if (weapon?.kind !== 'weapon' || weapon.location.kind !== 'carried') return false;
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
      if (item?.kind !== 'contaminant' || item.contaminant.stage !== 'defense' || item.location.kind !== 'defense' || item.location.slot !== slot) return false;
    }
    if (state.run && (typeof state.run.id !== 'string' || !['active', 'settled'].includes(state.run.status) || !Array.isArray(state.run.carriedOutIds) || !Array.isArray(state.run.destroyedIds) || !state.run.revealedNodes || typeof state.run.revealedNodes !== 'object')) return false;
    this.publish(copy(state));
    return true;
  }
  reset(): void { this.publish(emptyState()); }
  /** Explicit V1/dev import; supplies the sole canonical contaminant payloads. */
  importLegacy(contaminants: readonly Contaminant[], defenseIds: (string | null)[], toolIds: (string | null)[]): void {
    const state = emptyState();
    state.items = contaminants.map(contaminant => {
      const defense = defenseIds.indexOf(contaminant.id);
      return { kind: 'contaminant', id: contaminant.id, contaminant: { ...contaminant }, location: defense >= 0 ? { kind: 'defense', slot: defense } : toolIds.includes(contaminant.id) ? { kind: 'carried' } : { kind: 'stash' } };
    });
    const valid = new Set(contaminants.map(c => c.id));
    state.equipment.defenseIds = defenseIds.map(id => id && valid.has(id) ? id : null);
    state.equipment.toolIds = toolIds.map(id => id && valid.has(id) ? id : null);
    this.publish(state);
  }
  ensureStarter(): InventoryResult<string | null> {
    if (this.state.run?.status === 'active') return fail('run-active');
    const owned = this.state.items.find(item => item.kind === 'weapon');
    if (owned) return success(owned.id);
    const definitionId = this.rules.starterDefinitionId;
    if (!definitionId || !this.rules.weaponDefinition(definitionId)) return fail('missing-weapon');
    return this.transaction(state => {
      const id = `WPN_${crypto.randomUUID()}`;
      state.items.push({ kind: 'weapon', id, weapon: { id, definitionId }, location: { kind: 'carried' } });
      state.equipment.weaponId = id;
      state.starterGranted = true;
      return success(id);
    });
  }
  addContaminant(contaminant: Contaminant): InventoryResult<string> {
    return this.transaction(state => {
      if (state.items.some(item => item.id === contaminant.id)) return fail('duplicate-id');
      state.items.push({ kind: 'contaminant', id: contaminant.id, contaminant: { ...contaminant }, location: { kind: state.run?.status === 'active' ? 'carried' : 'stash' } });
      return this.weight(state) > this.rules.capacity ? fail('overweight') : success(contaminant.id);
    });
  }
  prepareWeapon(id: string): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      const item = state.items.find(value => value.id === id);
      if (item?.kind !== 'weapon' || !['stash', 'carried'].includes(item.location.kind)) return fail('invalid-item');
      const old = state.items.find(value => value.id === state.equipment.weaponId);
      if (old) old.location = { kind: 'stash' };
      item.location = { kind: 'carried' };
      state.equipment.weaponId = id;
      return this.weight(state) > this.rules.capacity ? fail('overweight') : success(undefined);
    });
  }
  prepareTool(id: string | null, slot: number): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      const count = this.rules.toolSlotCount();
      if (slot < 0 || slot >= count) return fail('incompatible');
      const item = id ? state.items.find(value => value.id === id) : undefined;
      if (id && (item?.kind !== 'contaminant' || item.contaminant.stage !== 'tool' || !['stash', 'carried'].includes(item.location.kind))) return fail('incompatible');
      if (item?.kind === 'contaminant' && this.rules.isPassiveTool(item.contaminant) !== (slot === count - 1)) return fail('incompatible');
      const old = state.items.find(value => value.id === state.equipment.toolIds[slot]);
      if (old) old.location = { kind: 'stash' };
      if (id) state.equipment.toolIds = state.equipment.toolIds.map(value => value === id ? null : value);
      state.equipment.toolIds[slot] = id;
      if (item) item.location = { kind: 'carried' };
      return this.weight(state) > this.rules.capacity ? fail('overweight') : success(undefined);
    });
  }
  slotDefense(id: string | null, slot: number): InventoryResult {
    return this.transaction(state => {
      if (state.run?.status === 'active') return fail('run-active');
      if (slot < 0 || slot >= this.rules.defenseSlotCount()) return fail('incompatible');
      const item = id ? state.items.find(value => value.id === id) : undefined;
      if (id && (item?.kind !== 'contaminant' || item.contaminant.stage !== 'defense' || item.location.kind !== 'stash')) return fail('incompatible');
      const old = state.items.find(value => value.id === state.equipment.defenseIds[slot]);
      if (old) old.location = { kind: 'stash' };
      state.equipment.defenseIds[slot] = id;
      if (item) item.location = { kind: 'defense', slot };
      return success(undefined);
    });
  }
  beginRun(runId: string): InventoryResult {
    return this.transaction(state => {
      if (state.run?.id === runId) return fail('run-active');
      if (state.run?.status === 'active') return fail('run-active');
      if (!state.equipment.weaponId || !state.items.some(item => item.id === state.equipment.weaponId && item.kind === 'weapon')) return fail('missing-weapon');
      if (this.weight(state) > this.rules.capacity) return fail('overweight');
      const equipped = new Set([state.equipment.weaponId, ...state.equipment.toolIds]);
      if (state.items.some(item => item.location.kind === 'carried' && !equipped.has(item.id))) return fail('wrong-location');
      state.run = { id: runId, status: 'active', carriedOutIds: state.items.filter(item => item.location.kind === 'carried').map(item => item.id), revealedNodes: {}, destroyedIds: [] };
      return success(undefined);
    });
  }
  revealBatch(nodeId: string, items: readonly NewInventoryItem[], position: Vector2): InventoryResult<{ ids: string[]; taken: boolean }> {
    return this.transaction(state => {
      const run = state.run;
      if (!run || run.status !== 'active') return fail('no-active-run');
      const existing = run.revealedNodes[nodeId];
      if (existing) return success({ ids: [...existing], taken: existing.every(id => state.items.find(item => item.id === id)?.location.kind === 'carried') });
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return fail('invalid-ground');
      const ids = new Set(state.items.map(item => item.id));
      for (const item of items) {
        if (ids.has(item.id)) return fail('duplicate-id');
        if (item.id !== (item.kind === 'weapon' ? item.weapon.id : item.contaminant.id) || !Number.isFinite(this.getWeight({ ...item, location: { kind: 'stash' } }))) return fail('invalid-item');
        ids.add(item.id);
      }
      const revealed: InventoryItem[] = items.map(item => ({ ...copy(item), location: { kind: 'ground', runId: run.id, position: { ...position } }, source: { ...item.source, nodeId, runId: run.id } }));
      const taken = this.weight(state) + revealed.reduce((sum, item) => sum + this.getWeight(item), 0) <= this.rules.capacity;
      if (taken) for (const item of revealed) item.location = { kind: 'carried' };
      state.items.push(...revealed);
      run.revealedNodes[nodeId] = revealed.map(item => item.id);
      if (revealed.some(item => item.kind === 'weapon')) state.firstWeaponDiscovered = true;
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
      return this.weight(state) > this.rules.capacity ? fail('overweight') : success(undefined);
    });
  }
  consumeTool(id: string): InventoryResult<{ broken: boolean; usesLeft: number }> {
    return this.transaction(state => {
      const item = state.items.find(value => value.id === id);
      if (item?.kind !== 'contaminant' || item.contaminant.stage !== 'tool' || item.contaminant.usesRemaining <= 0) return fail('invalid-item');
      if (state.run?.status === 'active' && !state.equipment.toolIds.includes(id)) return fail('equipped');
      item.contaminant.usesRemaining--;
      const broken = item.contaminant.usesRemaining === 0;
      if (broken) {
        clearReferences(state, id);
        state.items = state.items.filter(value => value.id !== id);
        state.run?.destroyedIds.push(id);
      }
      return success({ broken, usesLeft: item.contaminant.usesRemaining });
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
  settleRun(runId: string, outcome: 'extract' | 'death' | 'abandon-keep', kindlingGained = 0): InventoryResult<{ returnedIds: string[] }> {
    return this.transaction(state => {
      const run = state.run;
      if (!run || run.id !== runId) return fail('no-active-run');
      if (run.status === 'settled') return success({ returnedIds: [...(run.returnedIds ?? [])] });
      const returnedIds: string[] = [];
      state.items = state.items.filter(item => {
        if (item.location.kind === 'ground') return false;
        if (item.location.kind !== 'carried') return true;
        if (outcome === 'death' || (outcome === 'abandon-keep' && !run.carriedOutIds.includes(item.id))) { clearReferences(state, item.id); return false; }
        if (!run.carriedOutIds.includes(item.id)) returnedIds.push(item.id);
        if (state.equipment.weaponId !== item.id && !state.equipment.toolIds.includes(item.id)) item.location = { kind: 'stash' };
        return true;
      });
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
