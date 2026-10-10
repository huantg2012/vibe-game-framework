import assert from 'node:assert/strict';
import { PreparationNarrationJourney, type PreparationNarrationFact } from '../../src/narrative/preparation-narration';
import { PreparationNarrationAdapter, improvedPreparationWeapon } from '../../src/narrative/preparation-narration-adapter';
import { InventoryStore } from '../../src/systems/inventory-store';
import { createWeaponInstance } from '../../src/systems/equipment-lifecycle';
import { NarrationMemory } from '../../src/narrative/narration-memory';
import { PREPARATION_NARRATION_POOLS } from '../../src/generated/preparation-narration-data';
import { CATALOG_ITEMS, CATALOG_OFFERINGS } from '../../src/generated/contaminant-catalog-data';
import { createCatalogContaminant } from '../../src/systems/contaminant-catalog';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
const memory = new NarrationMemory(null, () => 0);
let facts: PreparationNarrationFact[] = [], picks = 0;
const journey = new PreparationNarrationJourney(() => facts, (scope, rows) => { picks++; return memory.choose(scope, rows); });
const low = { grade: 'low' as const, visible: true, paused: false };
assert.equal(journey.update(249, low), ''); assert.equal(picks, 0);
assert.equal(journey.update(250, { ...low, paused: true }), ''); assert.equal(picks, 0);
const text = journey.update(250, low); assert(text); assert.equal(picks, 1);
assert.equal(journey.update(10000, { ...low, paused: true }), '');
assert.equal(journey.update(1000, low), text);
journey.update(0, { ...low, visible: false }); assert.equal(journey.update(500, low), '');
facts = [{ pool: 'prepare.body_growth', key: 'growth:1', recent: true }];
assert(journey.update(250, low)); assert.equal(picks, 2);
journey.update(6000, low); facts = [{ pool: 'prepare.body_growth', key: 'growth:2', recent: true }];
assert.equal(journey.update(500, low), ''); assert.equal(picks, 2);
assert(journey.update(250, { ...low, grade: 'medium' })); assert.equal(picks, 3);
journey.destroy(); assert.equal(journey.update(500, low), '');

function fixture() {
 const store = new InventoryStore(); const state = store.getState();
 const old = createWeaponInstance('crowbar_plain', true, 'old');
 const strong = createWeaponInstance('crowbar_good_standard', true, 'strong');
 state.items = [{ id: 'old', kind: 'weapon', weapon: old, location: { kind: 'carried' } }, { id: 'strong', kind: 'weapon', weapon: strong, location: { kind: 'stash' } }];
 state.equipment.weaponId = 'old'; assert(store.loadState(state));
 return store;
}
const store = fixture(), adapter = new PreparationNarrationAdapter(store);
let beforeAfter = 0; store.subscribeCommitted(() => beforeAfter++);
const session = adapter.createJourney();
store.setPersistence(() => { throw Error('refuse'); });
assert.equal(store.prepareWeapon('strong').ok, false); assert.equal(beforeAfter, 0);
store.setPersistence(null); assert(store.prepareWeapon('strong').ok); assert.equal(beforeAfter, 1);
const enhanced = session.update(250, { ...low, grade: 'severe' });
assert(enhanced); // verify public damage enhancement selects its pool, not a baseline
assert(PREPARATION_NARRATION_POOLS['prepare.new_weapon.severe'].lines.some(row => row.text === enhanced));
store.beginFrameTransaction(); store.prepareWeapon('old');
assert.equal(beforeAfter, 1); assert.equal(store.commitFrameTransaction(() => { throw Error('refuse'); }), false);
assert.equal(beforeAfter, 1); store.cancelFrameTransaction(); assert.equal(beforeAfter, 1);
const state = store.getState(); state.run = { id: 'run', status: 'active', carriedOutIds: ['strong'], destroyedIds: [], revealedNodes: {} };
assert(store.loadState(state));
store.beginFrameTransaction(); assert(store.settleRun('run', 'death').ok);
assert.equal(store.commitFrameTransaction(() => { throw Error('refuse'); }), false);
store.cancelFrameTransaction(); assert.equal(store.getRun()?.status, 'active');
assert(store.settleRun('run', 'death').ok); assert(store.markBaseSettled().ok);
const loss = adapter.createJourney(); const line = loss.update(250, low); assert(PREPARATION_NARRATION_POOLS['prepare.return_loss'].lines.some(row => row.text === line));
assert.equal(store.getItem('strong'), undefined);
eventBus.emit(GameEvent.GROWTH_PURCHASED, { upgradeId: 'growth_vitality', newLevel: 1 });
loss.update(0, { ...low, visible: false }); assert(loss.update(250, low));
loss.destroy(); session.destroy(); adapter.destroy();
console.log('PASS preparation narration: visible debounce, pause freeze, per-grade + single-extra budget, committed-only inventory, weapon upgrade and real loss adapters');

// Matured weapons are eligible only while still unassigned; damage and wear remain public facts.
{
 const store = fixture(); const state = store.getState();
 const item = state.items.find(item => item.id === 'strong')!;
 if (item.kind !== 'weapon') throw Error('fixture');
 item.weapon = createWeaponInstance('crowbar_good_standard', false, 'strong');
 item.location = { kind: 'defense', slot: 0 }; state.equipment.defenseIds = ['strong'];
 assert(store.loadState(state)); const adapter = new PreparationNarrationAdapter(store);
 assert(store.finishOfferingImpact(['strong'], 3, {}, 'impact:test').ok);
 const journey = adapter.createJourney(); const text = journey.update(250, low);
 assert(PREPARATION_NARRATION_POOLS['prepare.ready_item'].lines.some(row => row.text === text));
 journey.update(0, { ...low, visible: false }); assert(store.prepareWeapon('strong').ok);
 const equipped = journey.update(250, low);
 assert(PREPARATION_NARRATION_POOLS['prepare.new_weapon.low'].lines.some(row => row.text === equipped));
 assert(store.loadState(store.getState())); const fresh = adapter.createJourney();
 assert(PREPARATION_NARRATION_POOLS['prepare.baseline.low'].lines.some(row => row.text === fresh.update(250, low)));
 fresh.destroy(); journey.destroy(); adapter.destroy();
}
// A newly found, unripe item is real death loss despite zero tool uses.
{
 const store = new InventoryStore(); const state = store.getState();
 state.items = [{ id: 'unripe', kind: 'weapon', weapon: createWeaponInstance('crowbar_plain', false, 'unripe'), location: {kind:'carried'} }];
 state.run = { id:'loss-unripe', status:'active', carriedOutIds:[], destroyedIds:[], revealedNodes:{} };
 assert(store.loadState(state)); const adapter = new PreparationNarrationAdapter(store);
 assert(store.settleRun('loss-unripe', 'death').ok); assert(store.markBaseSettled().ok);
 const journey = adapter.createJourney(); const text = journey.update(250, low);
 assert(PREPARATION_NARRATION_POOLS['prepare.return_loss'].lines.some(row => row.text === text));
 journey.destroy(); adapter.destroy();
}
console.log('PASS maturation/unassigned/equipped transition, explicit reload amnesia, unripe real loss');
// No inventory lost means death is not evidence for the loss pool.
{
 const store = new InventoryStore(); const state = store.getState();
 state.run = {id:'empty', status:'active', carriedOutIds:[], destroyedIds:['normally-used-up'], revealedNodes:{}};
 assert(store.loadState(state)); const adapter = new PreparationNarrationAdapter(store);
 assert(store.settleRun('empty','death').ok); assert(store.markBaseSettled().ok);
 const journey = adapter.createJourney(); const text = journey.update(250,low);
 assert(PREPARATION_NARRATION_POOLS['prepare.baseline.low'].lines.some(row=>row.text===text));
 journey.destroy(); adapter.destroy();
}
// Worn public weapon cannot trigger new-strength boasting; same damage variants are not upgrades.
{
 for (const [definition,uses] of [['crowbar_good_standard',18],['crowbar_plain',60]] as const) {
  const store=fixture(); const state=store.getState(); const item=state.items.find(row=>row.id==='strong')!;
  if(item.kind!=='weapon')throw Error('fixture'); item.weapon=createWeaponInstance(definition,true,'strong'); item.weapon.usesRemaining=uses;
  assert(store.loadState(state)); const adapter=new PreparationNarrationAdapter(store); assert(store.prepareWeapon('strong').ok);
  const journey=adapter.createJourney(); const text=journey.update(250,low);
  const expected=uses===18?'prepare.worn_weapon':'prepare.baseline.low';
  assert(PREPARATION_NARRATION_POOLS[expected].lines.some(row=>row.text===text)); journey.destroy(); adapter.destroy();
 }
}
{
 const store=fixture(); const adapter=new PreparationNarrationAdapter(store);
 eventBus.emit(GameEvent.GROWTH_PURCHASED,{upgradeId:'growth_kindling_affinity',newLevel:1});
 eventBus.emit(GameEvent.GROWTH_PURCHASED,{upgradeId:'thicken',newLevel:1});
 const journey=adapter.createJourney(); const text=journey.update(250,low);
 assert(PREPARATION_NARRATION_POOLS['prepare.baseline.low'].lines.some(row=>row.text===text));
 eventBus.emit(GameEvent.GROWTH_PURCHASED,{upgradeId:'growth_chaos_resist',newLevel:1});
 journey.update(0,{...low,visible:false}); const growth=journey.update(250,low);
 assert(PREPARATION_NARRATION_POOLS['prepare.body_growth'].lines.some(row=>row.text===growth));
 journey.destroy(); adapter.destroy();
}
{
 let picks=0; const journey=new PreparationNarrationJourney(()=>[],(scope,rows)=>{picks++;return memory.choose(scope,rows)});
 assert.equal(journey.update(100,low),''); assert.equal(journey.update(100,{...low,grade:'medium'}),'');
 assert.equal(journey.update(100,{...low,grade:'severe'}),''); assert.equal(picks,0);
 assert(journey.update(150,{...low,grade:'severe'})); assert.equal(picks,1); journey.destroy();
}
console.log('PASS empty death/normal expiry, worn-vs-upgrade, identical damage, excluded growth types, fast grade cancellation');

{
 const store=fixture(); const state=store.getState();
 state.items.push({id:'reserve',kind:'weapon',weapon:createWeaponInstance('crowbar_plain',true,'reserve'),location:{kind:'stash'}});
 state.run={id:'combo',status:'active',carriedOutIds:['old'],destroyedIds:[],revealedNodes:{}};
 assert(store.loadState(state)); const adapter=new PreparationNarrationAdapter(store);
 assert(store.settleRun('combo','death').ok); assert(store.markBaseSettled().ok);
 assert(store.prepareWeapon('reserve').ok); assert(store.prepareWeapon('strong').ok);
 const journey=adapter.createJourney(); const text=journey.update(250,low);
 assert(PREPARATION_NARRATION_POOLS['prepare.loss_new_weapon'].lines.some(row=>row.text===text));
 const next=journey.update(250,{...low,grade:'medium'});
 assert(PREPARATION_NARRATION_POOLS['prepare.baseline.medium'].lines.some(row=>row.text===next),'Combined utterance consumes both events');
 journey.destroy(); adapter.destroy();
}
{
 const store=new InventoryStore(); const adapter=new PreparationNarrationAdapter(store);
 const inert=Object.values(CATALOG_ITEMS).find(item=>item.class==='inert')!;
 const unknown=createCatalogContaminant({id:'unknown',definitionId:inert.id,appearanceId:'wax_parcel',offeringProfileId:Object.keys(CATALOG_OFFERINGS)[0]!,quality:'excellent',acquiredOrdinal:0});
 assert(store.addContaminant(unknown).ok);
 const journey=adapter.createJourney(); const text=journey.update(250,low);
 assert(PREPARATION_NARRATION_POOLS['prepare.baseline.low'].lines.some(row=>row.text===text));
 assert(store.slotOffering('unknown',0).ok);
 assert(store.finishOfferingImpact(['unknown'],99,{},'inert-reveal').ok);
 const next=journey.update(250,{...low,grade:'medium'});
 assert(PREPARATION_NARRATION_POOLS['prepare.baseline.medium'].lines.some(row=>row.text===next));
 journey.destroy(); adapter.destroy();
}
console.log('PASS combined loss + new weapon consumption; unknown excellent shell and revealed inert exclusion');

assert.equal(improvedPreparationWeapon(
 {id:'standard',kind:'weapon',weapon:createWeaponInstance('crowbar_good_standard',true,'standard'),location:{kind:'carried'}},
 {id:'light',kind:'weapon',weapon:createWeaponInstance('crowbar_good_light',true,'light'),location:{kind:'carried'}}),false,
 'Same quality lighter variant does not imply melee strength');
