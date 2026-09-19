/** Current thirteen-family offering contracts, real impact/repair/save boundaries. */
import assert from 'node:assert/strict';
import { applyDefenseEffects, type DefenseContext } from '../../src/systems/defense-engine';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { impactSystem } from '../../src/systems/impact-system';
import { tideSystem } from '../../src/systems/tide-system';
import { growthSystem } from '../../src/systems/growth-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { GAME_CONSTANTS } from '../../src/config/constants';
import type { Contaminant, ContaminantType, SaveDataV2 } from '../../src/types/game-types';

let checks = 0;
function check(name: string, fn: () => void): void { fn(); console.log(`PASS ${name}`); checks++; }
const context: DefenseContext = { forecastTargetId: 'CORE', actualPrimaryId: 'CORE', stabilityProgress: 20,
  moduleHps: { CORE: 70, STORAGE: 80, PURIFIER: 90 }, moduleMaxHps: { CORE: 100, STORAGE: 100, PURIFIER: 100 } };
const base = { CORE: 20, STORAGE: 8, PURIFIER: 8 };
function raw(type: ContaminantType, id: string = type): Contaminant {
  return { id, type, rarity: 'common', quality: 'ordinary', stage: 'defense', impactCharges: 0, usesRemaining: 0 };
}
const localBytes = new Map<string, string>();
let failWrites = false;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalRandom = Math.random;
const key = GAME_CONSTANTS.SAVE.KEY;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (id: string) => localBytes.get(id) ?? null,
  setItem: (id: string, value: string) => { if (failWrites) throw Error('quota'); localBytes.set(id, value); },
  removeItem: (id: string) => localBytes.delete(id),
} });
function reset(): void {
  failWrites = false; inventoryStore.setPersistence(null); saveManager.deleteSave();
  gameState.reset(); contaminantSystem.reset(); tideSystem.reset(); growthSystem.reset(); stabilityTracker.reset();
  // Offering defense is tested on a real impact after the teaching sortie.
  impactSystem.resetForecastState(); gameState.incrementCycle(); gameState.incrementCycle(); gameState.setImpactIntensity(1);
}
try {
  check('thirteen current families use CSV base values and no retired penalties/rewards', () => {
    const families: ContaminantType[] = ['solidify','scatter','retrograde','muffle','expand','mirror','kindle','combust','delay','siphon','stitch','compress','abyss'];
    for (const type of families) for (const random of [0, .999]) {
      Math.random = () => random;
      const result = applyDefenseEffects(base, [raw(type)], context);
      assert.deepEqual(result.sideEffects, [], type); assert.equal(result.kindlingGain, 0, type);
      assert.equal(result.stabilityChange, 0, type); assert.equal(result.upgradeDiscount, 0, type);
      assert.deepEqual(result.stitchEqualization, {}, type); assert.deepEqual(result.bonusCharges, {}, type);
      assert.equal(result.toolUseGrants, 0, type); assert.equal(result.moduleSwapTriggered, false, type);
      assert.equal(result.slotDisclosures[0]!.damageReductionPct, CONTAMINANT_DATA[type].defenseReduction);
    }
  });
  check('delay is fixed 30 percent; compress halves primary only', () => {
    assert.deepEqual(applyDefenseEffects(base,[raw('delay')],context).finalDamagePerModule,{CORE:14,STORAGE:6,PURIFIER:6});
    assert.deepEqual(applyDefenseEffects(base,[raw('compress')],context).finalDamagePerModule,{CORE:10,STORAGE:8,PURIFIER:8});
  });
  check('abyss evaluates each module at pre-impact <=40 percent, no rounding double penalty', () => {
    const ctx = { ...context, moduleHps: { CORE: 40, STORAGE: 41, PURIFIER: 39 } };
    const result = applyDefenseEffects({CORE:13,STORAGE:13,PURIFIER:13},[raw('abyss')],ctx);
    assert.deepEqual(result.finalDamagePerModule,{CORE:7,STORAGE:10,PURIFIER:7});
    const above = applyDefenseEffects({CORE:80,STORAGE:0,PURIFIER:0},[raw('abyss')],{...ctx,moduleHps:{...ctx.moduleHps,CORE:41}});
    assert.equal(above.finalDamagePerModule.CORE,64,'crossing threshold from this impact does not retroactively protect');
  });
  check('stitch moves at most four primary damage to healthiest remaining module without killing it', () => {
    const result = applyDefenseEffects(base,[raw('stitch')],context);
    assert.deepEqual(result.finalDamagePerModule,{CORE:12,STORAGE:6,PURIFIER:10});
    assert.equal(result.slotDisclosures[0]!.transferredDamage,4);
    assert.equal(result.slotDisclosures[0]!.transferModuleId,'PURIFIER');
    const weak = applyDefenseEffects({CORE:20,STORAGE:8,PURIFIER:8},[raw('stitch')],{...context,moduleHps:{CORE:70,STORAGE:7,PURIFIER:8}});
    assert.equal(weak.finalDamagePerModule.PURIFIER,7);
    assert.equal(weak.finalDamagePerModule.CORE,15);
    const none = applyDefenseEffects(base,[raw('stitch')],{...context,moduleHps:{CORE:70,STORAGE:6,PURIFIER:6}});
    assert.equal(none.finalDamagePerModule.CORE,16);
    const multiple = applyDefenseEffects(base,[raw('stitch','stitch-a'),raw('stitch','stitch-b')],context);
    assert.equal(Object.values(multiple.finalDamagePerModule).reduce((sum,n)=>sum+n,0),23,'transfer conserves reduced integer damage');
    assert(multiple.slotDisclosures.every(slot=>slot.transferredDamage===4));
  });
  check('scatter retains integer damage; first-eight freeze and ember remain actual-damage based', () => {
    assert.equal(Object.values(applyDefenseEffects({CORE:9,STORAGE:2,PURIFIER:2},[raw('scatter')],context).finalDamagePerModule).reduce((sum,n)=>sum+n,0),13);
    assert.deepEqual(applyDefenseEffects(base,[raw('solidify')],context).finalDamagePerModule,{CORE:13,STORAGE:5,PURIFIER:5});
    const empty = applyDefenseEffects({CORE:0,STORAGE:0,PURIFIER:0},[raw('siphon'),raw('combust')],context);
    assert.equal(empty.repairBonusHp,0); assert.deepEqual(empty.healOut,{});
    const struck = applyDefenseEffects(base,[raw('siphon'),raw('siphon','siphon-b')],context);
    assert.equal(struck.repairBonusHp,6,'multiple items grant max allowance, not additive bank');
  });
  check('per-slot integer mitigation exactly matches final damage, excluding safe transfers', () => {
    const combinations: ContaminantType[][] = [ ['solidify','solidify'], ['stitch','stitch'], ['mirror','compress','abyss'],
      ['scatter','abyss','mirror'], ['siphon','combust','delay','solidify'] ];
    for (const types of combinations) for (let primary = 0; primary <= 40; primary++) {
      const damages = { CORE: primary, STORAGE: 8, PURIFIER: 8 };
      const ctx = { ...context, moduleHps: { CORE: 39, STORAGE: 80, PURIFIER: 39 } };
      const result = applyDefenseEffects(damages, types.map((type, i) => raw(type, `${type}-${i}`)), ctx);
      const blocked = primary + 16 - Object.values(result.finalDamagePerModule).reduce((sum, n) => sum + n, 0);
      assert.equal(result.slotDisclosures.reduce((sum, slot) => sum + slot.damageBlocked, 0), blocked, types.join(','));
      assert(result.slotDisclosures.every(slot => Number.isInteger(slot.damageBlocked) && slot.damageBlocked >= 0));
    }
    const cold = applyDefenseEffects(base, [raw('solidify','cold-a'), raw('solidify','cold-b')], context);
    assert.equal(cold.slotDisclosures.reduce((sum, slot) => sum + slot.damageBlocked, 0), 22);
  });
  check('siphon earns finite repair only after a real impact, including final offering', () => {
    reset(); Math.random=()=>.5;
    const item=contaminantSystem.acquire('siphon','fine'); assert(contaminantSystem.slotDefense(item.id,0));
    assert.equal(gameState.getRepairBonusHp(),0); assert.equal(gameState.getEffectiveRepairPerKindling(),GAME_CONSTANTS.PURIFICATION.REPAIR_PER_KINDLING);
    const ids=inventoryStore.getOfferingItems().map(item=>item?.id??null);
    const result=impactSystem.run(contaminantSystem.getDefenseSlotted(),ids);
    assert.equal(gameState.getRepairBonusHp(),6);
    assert(inventoryStore.finishOfferingImpact(ids,999,result.defenseResult?.bonusCharges??{}).ok);
    assert.equal(contaminantSystem.getDefenseSlotted()[0],null);
    assert.equal(gameState.getRepairBonusHp(),6,'maturation does not retract earned bonus');
    gameState.grantRepairBonus(6); gameState.grantRepairBonus(4); assert.equal(gameState.getRepairBonusHp(),6);
  });
  check('one useful injection uses entire allowance; preview and resource ceiling agree', () => {
    gameState.addKindling(20); const before=gameState.getModule('CORE')!.hp;
    const preview=gameState.previewModuleRepair(before,100,1);
    assert.equal(gameState.allocateToModule('CORE',1),1);
    assert.equal(gameState.getModule('CORE')!.hp,preview); assert.equal(gameState.getRepairBonusHp(),0);
    gameState.grantRepairBonus(6); gameState.healModule('CORE',100);
    assert.equal(gameState.allocateToModule('CORE',1),0); assert.equal(gameState.getRepairBonusHp(),6);
    assert.equal(gameState.allocateToModule('CORE',0),0); assert.equal(gameState.allocateToModule('missing',1),0);
    assert.equal(gameState.getRepairBonusHp(),6);
    gameState.applyDamage('CORE',3);
    assert.equal(gameState.getMaxUsefulRepairKindling(97,100),1);
    assert.equal(gameState.allocateToModule('CORE',20),1); assert.equal(gameState.getRepairBonusHp(),0,'unused fractional repair is not banked');
  });
  check('repair allowance persists across save/load; failed injection restores HP, kindling, allowance', () => {
    gameState.applyDamage('CORE',20); gameState.grantRepairBonus(6); saveManager.save();
    const before=gameState.getState(); const saved=localBytes.get(key);
    gameState.reset(); assert(saveManager.load()); assert.equal(gameState.getRepairBonusHp(),6);
    failWrites=true; assert.equal(saveManager.allocateToModule('CORE',1),0);
    assert.deepEqual(gameState.getState(),before); assert.equal(localBytes.get(key),saved);
    failWrites=false; assert.equal(saveManager.allocateToModule('CORE',1),1); assert.equal(gameState.getRepairBonusHp(),0);
    assert(saveManager.load()); assert.equal(gameState.getRepairBonusHp(),0);
    assert.equal(gameState.getModule('CORE')!.hp,Math.min(100,before.modules[0]!.hp+GAME_CONSTANTS.PURIFICATION.REPAIR_PER_KINDLING+6));
  });
  check('legacy missing allowance is zero; malformed allowance refuses atomic load', () => {
    const data=JSON.parse(localBytes.get(key)!) as SaveDataV2;
    delete data.repairBonusHp; localBytes.set(key,JSON.stringify(data)); assert(saveManager.load()); assert.equal(gameState.getRepairBonusHp(),0);
    const before=gameState.getState(); data.repairBonusHp=-6; localBytes.set(key,JSON.stringify(data));
    assert.equal(saveManager.load(),false); assert.deepEqual(gameState.getState(),before);
  });
  console.log(`${checks} offering family and finite repair checks passed`);
} finally {
  Math.random=originalRandom; inventoryStore.setPersistence(null);
  if(originalStorage) Object.defineProperty(globalThis,'localStorage',originalStorage); else Reflect.deleteProperty(globalThis,'localStorage');
}
