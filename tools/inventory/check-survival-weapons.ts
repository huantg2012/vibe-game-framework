import assert from 'node:assert/strict';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { getBurdenSpeedFactor, sumPollutionResistance, getSurvivalAttributes } from '../../src/systems/survival-attributes';
import { ChaosSystem } from '../../src/systems/chaos-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { rollWeaponDrop, createWeaponInstance } from '../../src/systems/weapon-loot';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, a + ' != ' + b);
assert.equal(Object.keys(WEAPON_DATA).length, 10);
near(getBurdenSpeedFactor(80, 160), 1);
near(getBurdenSpeedFactor(120, 160), .92);
near(getBurdenSpeedFactor(160, 160), .84);
near(getBurdenSpeedFactor(1600, 160), .84);
near(sumPollutionResistance([8, 4, 5]), 17);
near(sumPollutionResistance([50, 50]), 60);
near(sumPollutionResistance([-10]), 0);

inventoryStore.reset();
inventoryStore.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain' });
assert.ok(inventoryStore.ensureStarter().ok);
inventoryStore.beginRun('attributes');
inventoryStore.revealBatch('weapons', [
  {kind:'weapon',id:'resistant',weapon:createWeaponInstance('crowbar_excellent_resistant',true,'resistant')},
], {x:0,y:0});
assert.equal(getSurvivalAttributes().resistancePercent,0,'Un-equipped loot grants no resistance');
inventoryStore.settleRun('attributes','extract');
inventoryStore.prepareWeapon('resistant');
assert.equal(getSurvivalAttributes().resistancePercent,4,'Equipped contribution counted once');

let resistance = 20;
const chaos = new ChaosSystem({startingValue:10,getPollutionResistance:()=>resistance});
chaos.addChaos('field',10);near(chaos.getValue(),18);
chaos.addChaos('cleanse',-5);near(chaos.getValue(),13);
eventBus.emit(GameEvent.ENEMY_DAMAGED,{enemyId:'target',amount:25,source:'player'});
near(chaos.getValue(),17);
const before = chaos.getValue(), rate = chaos.getRate();
chaos.update(100);near(chaos.getValue()-before,rate*.1);
chaos.setTemporaryRateReduction(.5,1000);near(chaos.getRate(),rate*.5);
resistance = 100;const capped = chaos.getValue();chaos.addChaos('field',10);near(chaos.getValue()-capped,4);
chaos.reset(30);near(chaos.getValue(),30);
chaos.destroy();

for (const tier of ['contested','deep'] as const) {
  assert.equal(rollWeaponDrop({runSeed:7,nodeId:'intro',tier,firstWeaponDiscovered:false}),'crowbar_good_standard');
}
const reachable = new Set<string>();
for (const tier of ['safe','contested','deep'] as const) {
  for(let seed=0;seed<4000;seed++) {
    const request={runSeed:seed,nodeId:'stable-pile',tier,firstWeaponDiscovered:true};
    const id=rollWeaponDrop(request);assert.equal(rollWeaponDrop(request),id);
    if(id){assert.ok(WEAPON_DATA[id]);reachable.add(id);}
  }
}
assert.equal(reachable.size,10,'Every production definition is reachable');
inventoryStore.reset();
console.log('PASS: equipped-only resistance, positive/negative/opening chaos channels, rate modifiers, burden boundaries, seeded loot, first discovery and all ten definitions.');
