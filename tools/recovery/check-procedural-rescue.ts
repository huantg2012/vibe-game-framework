import assert from 'node:assert/strict';
import fs from 'node:fs';
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });
const { saveManager } = await import('../../src/managers/save-manager');
const { inventoryStore } = await import('../../src/systems/inventory-store');
const { installProceduralRiftRecovery } = await import('../../src/managers/rift-recovery');
const { gameState } = await import('../../src/managers/game-state');
const { growthSystem } = await import('../../src/systems/growth-system');
const key='coh-save-v1', records=new Map<string,string>();let fail=false;
saveManager.setStorage({getItem:k=>records.get(k)??null,removeItem:k=>{records.delete(k)},setItem:(k,v)=>{if(fail)throw new Error('quota');records.set(k,v)}});
installProceduralRiftRecovery();
const initial=JSON.parse(fs.readFileSync('tools/recovery/fixtures/prepared-base.json','utf8'));
records.set(key,JSON.stringify(initial.record));assert(saveManager.load());
assert(inventoryStore.beginRun('rescue-real-domain-run').ok);gameState.incrementCycle();assert(saveManager.trySave());
const base=JSON.parse(records.get(key)!);base.riftCheckpoint={invalid:'broken world packet'};base.checkpointChecksum='broken';const broken=JSON.stringify(base);records.set(key,broken);
assert(!saveManager.load());assert(saveManager.canAbandonInterruptedRun());assert.equal(records.get(key),broken);
assert(saveManager.load('abandon-active'));const retained=inventoryStore.getState().items.filter(x=>x.location.kind!=='carried').map(x=>x.id);const growth=growthSystem.getState(),reserve=gameState.getKindlingReserve();
fail=true;assert(!inventoryStore.settleRun('rescue-real-domain-run','abandon',0).ok);assert.equal(records.get(key),broken);assert.equal(inventoryStore.getRun()?.status,'active');
fail=false;assert(inventoryStore.settleRun('rescue-real-domain-run','abandon',0).ok);const saved=JSON.parse(records.get(key)!);
assert(!saved.riftCheckpoint);assert.equal(saved.inventory.run.outcome,'abandon');assert.equal(saved.kindlingReserve,reserve);assert.deepEqual(saved.growth,growth);assert.deepEqual(saved.inventory.items.map((x:any)=>x.id).sort(),retained.sort());
assert(saveManager.load());assert.equal(inventoryStore.getRun()?.outcome,'abandon');
const invalidBases: [string, (record: any) => void][] = [
 ['unreadable HP', r => r.modules[0].hp='unreadable'], ['negative HP', r => r.modules[0].hp=-30],
 ['overfilled HP', r => r.modules[0].hp=r.modules[0].maxHp+1], ['wrong cap', r => r.modules[0].maxHp=999],
 ['duplicate module', r => r.modules[1]=r.modules[0]], ['missing module', r => r.modules.pop()],
 ['foreign module', r => r.modules[0].id='FOREIGN'], ['wrong module type', r => r.modules[0].type='STORAGE'],
 ['fractional tier', r => r.moduleMaxHpTier=1.5], ['negative reserve', r => r.kindlingReserve=-1],
 ['fractional cycle', r => r.cycle=.5], ['unknown upgrade', r => r.growth.upgrades.foreign=1],
 ['excessive upgrade', r => r.growth.upgrades.growth_vitality=5], ['negative upgrade', r => r.growth.upgrades.growth_vitality=-1],
 ['invalid tide', r => r.tide.tideNumber=6], ['invalid phase clock', r => r.tide.cycleInPhase=999],
 ['negative intensity', r => r.tide.currentIntensity=-1], ['invalid stability', r => r.stability.progress=101],
];
for (const [name, change] of invalidBases) {
 const corrupt=structuredClone(base);change(corrupt);const bytes=JSON.stringify(corrupt);records.set(key,bytes);
 const live=gameState.getState();assert(!saveManager.canAbandonInterruptedRun(),name);assert(!saveManager.load('abandon-active'),name);
 assert(!saveManager.load(),name);assert.equal(records.get(key),bytes,name);assert.deepEqual(gameState.getState(),live,name);
}
console.log('PASS explicit rescue: invalid world preserved; no automatic loss; rejection rollback; one abandon receipt keeps stash/growth/base; invalid base refused');
