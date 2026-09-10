import assert from 'node:assert/strict';
import { inventoryStore as store } from '../../src/systems/inventory-store';
import { FieldLootInventory, notifyFieldAcquisition } from '../../src/systems/field-loot-inventory';
import { audioManager } from '../../src/managers/audio-manager';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';

// Production transactions/input/visibility; only drawing and uninitialized audio adapted.
const draws = new Set<Draw>();
class Draw {
  visible = true;
  constructor() { draws.add(this); }
  setDepth() { return this; } fillStyle() { return this; } fillRect() { return this; }
  setPosition() { return this; } setAlpha() { return this; }
  setVisible(value: boolean) { this.visible = value; return this; }
  destroy() { draws.delete(this); }
}
let acquired = 0;
eventBus.on(GameEvent.CONTAMINANT_ACQUIRED, () => acquired++);
store.reset();
store.configure({ capacity: 30, contaminantWeight: 20, starterDefinitionId: 'crowbar_plain', weaponDefinition: id => ({ id, weight: 30 }) });
assert(store.ensureStarter().ok); assert(store.beginRun('field-test').ok);
const player = { x: 0, y: 0 };
let visible = 1, legal = true, opened = 0;
const field = new FieldLootInventory();
field.create({ add: { graphics: () => new Draw() } } as never, () => player, () => visible, () => legal, () => opened++, () => {});
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => 'zh-CN' }, configurable: true });
const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
store.configure({ capacity: 30, weaponDefinition: id => ({ id, weight: 30 }) });
const search = new LootSearchSystem();
const node = { id: 'node-one', kind: 'contaminant', position: { x: 8, y: 0 }, collected: false,
  visual: { setRummaging() {}, playReveal() {} }, revealedItem: undefined };
const mutable = search as unknown as { inventoryEnabled: boolean; channel: unknown; complete: (p: typeof player) => void };
mutable.inventoryEnabled = true;
const originalAudio = audioManager.playSFX;
audioManager.playSFX = () => {};
const finish = () => { mutable.channel = { node, elapsedMs: 1200 }; mutable.complete(player); };

store.setPersistence(() => { throw new Error('quota'); });
finish();
assert.equal(node.collected, false); assert.equal(acquired, 0); assert.equal(store.getItems().length, 1);
const cached = node.revealedItem;
assert(cached, 'failed durable reveal retains exact rolled instance');
store.setPersistence(null);
finish();
assert.equal(node.revealedItem, cached); assert.equal(node.collected, true);
assert.equal(store.getItems().length, 2); assert.equal(acquired, 0);
field.update(16, { interactHeld: true, extractPriority: false });
assert.equal(field.getNearby().length, 1); assert.equal(draws.size, 1); assert.equal(opened, 0);
field.update(16, { interactHeld: false, extractPriority: false });
field.update(16, { interactHeld: true, extractPriority: false });
assert.equal(opened, 1); assert.equal(acquired, 0);

store.configure({ capacity: 100 });
field.update(16, { interactHeld: true, extractPriority: false });
assert.equal(acquired, 0, 'held key cannot auto-take after burden changes');
field.update(16, { interactHeld: false, extractPriority: false });
field.update(16, { interactHeld: true, extractPriority: true });
assert.equal(acquired, 0, 'extraction wins E');
field.update(16, { interactHeld: false, extractPriority: false });
field.update(16, { interactHeld: true, extractPriority: false, blocked: true });
assert.equal(acquired, 0);
field.update(16, { interactHeld: false, extractPriority: false });
field.update(16, { interactHeld: true, extractPriority: false });
assert.equal(acquired, 1); assert.equal(draws.size, 0);
const item = store.getItems().find(value => value.kind === 'contaminant')!;
assert.equal(item.location.kind, 'carried');
assert(store.drop([item.id], player, field.canDrop).ok);
visible = 0;
field.update(16, { interactHeld: false, extractPriority: false });
assert.equal(field.getNearby().length, 0); assert([...draws].every(draw => !draw.visible));
visible = 1; legal = false;
assert.equal(field.getNearby().length, 0); assert.equal(field.canDrop(player), false);
legal = true; player.x = 100;
assert.equal(field.getNearby().length, 0);
player.x = 0;
store.setPersistence(() => { throw new Error('quota'); });
assert.equal(field.take([item.id]).ok, false); assert.equal(store.getItem(item.id)?.location.kind, 'ground');
store.setPersistence(null);
assert(field.take([item.id]).ok); notifyFieldAcquisition([item.id]);
assert.equal(acquired, 1, 'drop/retrieve and repeated notifications never duplicate acquisition');
field.destroy(); assert.equal(draws.size, 0);
store.reset(); store.configure({ capacity: 30 }); assert(store.ensureStarter().ok);
const legacy = new LootSearchSystem();
const legacyNode = { ...node, id: 'legacy-node', collected: false, revealedItem: undefined };
const legacyState = legacy as unknown as { preview: boolean; channel: unknown; complete: (p: typeof player) => void };
const beforeLegacy = store.getState();
store.setPersistence(() => { throw new Error('quota'); });
legacyState.channel = { node: legacyNode, elapsedMs: 1200 };
assert.doesNotThrow(() => legacyState.complete(player));
assert.equal(legacyNode.collected, false); assert.equal(acquired, 1);
assert.deepEqual(store.getState(), beforeLegacy);
const cachedLegacy = legacyNode.revealedItem;
assert(cachedLegacy);
store.setPersistence(null);
legacyState.channel = { node: legacyNode, elapsedMs: 1200 };
legacyState.complete(player);
assert.equal(legacyNode.collected, true);
assert.equal(legacyNode.revealedItem, cachedLegacy, 'default durable retry must keep identity, rarity and type');
assert.equal(store.getItems().find(value => value.kind === 'contaminant')?.location.kind, 'stash');
assert.equal(store.getCarryWeight(), 30, 'legacy direct acquisition does not introduce field burden');
assert.equal(store.getRun()?.revealedNodes['legacy-node'], undefined, 'default caller remains on old acquire route');
assert.equal(acquired, 2);
const beforePreview = store.getState();
legacyState.preview = true;
legacyState.channel = { node: { ...legacyNode, id: 'preview', collected: false }, elapsedMs: 1200 };
legacyState.complete(player);
assert.deepEqual(store.getState(), beforePreview); assert.equal(acquired, 2);
audioManager.playSFX = originalAudio;
console.log('PASS field loot: durable reveal rollback/cache, overweight ground, release gating, extraction/blocked input, visibility/distance/legal ground, take rollback, acquisition once, drawing cleanup, opt-in isolation, preview isolation');
