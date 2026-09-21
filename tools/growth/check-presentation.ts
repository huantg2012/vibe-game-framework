import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { previewThickening } from '../../src/ui/growth-presentation';
import { computeStartingChaos, gameState } from '../../src/managers/game-state';

const cases: { tier: number; hp: readonly number[]; allowance: number; startingChaos: number; nextStartingChaos: number; refillKindling: number }[] = [];
for (const [hp, expected] of [[-1, 50], [0, 50], [8, 46], [50, 25], [70, 15], [99, 1], [100, 0], [115, 0], [145, 0]] as const) {
  for (const maxHp of [100, 115, 130, 145]) assert.equal(computeStartingChaos(hp, maxHp), expected);
}
for (const maxHp of [0, -1, NaN, Infinity, -Infinity]) {
  assert.equal(computeStartingChaos(100, maxHp), GAME_CONSTANTS.PURIFICATION.CHAOS_HARD_START);
}
for (const tier of [0, 1, 2] as const) {
const maxHp = GAME_CONSTANTS.PURIFICATION.MODULE_BASE_MAX_HP + GAME_CONSTANTS.PURIFICATION.MODULE_MAX_HP_PER_TIER * tier;
for (const hps of [[100,100,100], [15,22,8], [0,0,0], [99,96,97], [maxHp,maxHp,maxHp]]) {
  for (const allowance of [0,8,40,1000]) {
    gameState.reset();
    const state = gameState.getState();
    state.kindlingReserve=1000;
    state.moduleMaxHpTier=tier;
    state.modules.forEach((module,i)=>{module.hp=hps[i]!;module.maxHp=maxHp;});
    state.repairBonusHp=allowance;
    gameState.loadState(state);
    const before=gameState.getState();
    const modifiersBefore=gameState.getSortieModifiers();
    const preview=previewThickening(gameState.getModules(),allowance);
    assert.deepEqual(gameState.getState(),before,'preview is pure');
    assert.equal(preview.startingChaos,modifiersBefore.startingChaos);
    assert.equal(preview.nextStartingChaos,preview.startingChaos,'extra capacity never worsens unchanged current HP');
    assert(gameState.raiseModuleMaxHp());
    assert.deepEqual(gameState.getSortieModifiers(),modifiersBefore,'actual purchase preserves all module effects');
    assert.deepEqual(gameState.getModules().map(m=>m.hp),before.modules.map(m=>m.hp),'purchase does not heal');
    assert.equal(preview.nextStartingChaos,gameState.getStartingChaos());
    assert.deepEqual(preview.modules.map(m=>[m.id,m.hp,m.nextMaxHp]),gameState.getModules().map(m=>[m.id,m.hp,m.maxHp]));
    const after=gameState.getState();
    const costs:number[]=[];
    for(const order of [['CORE','STORAGE','PURIFIER'],['STORAGE','PURIFIER','CORE'],['PURIFIER','CORE','STORAGE']]){
      gameState.loadState(after);
      let spent=0;
      for(const id of order)spent+=gameState.allocateToModule(id,1000);
      costs.push(spent);
      assert(gameState.getModules().every(m=>m.hp===m.maxHp));
      assert.equal(gameState.getStartingChaos(),0,'full repair at every capacity removes starting chaos');
    }
    assert.equal(preview.refillKindling,Math.min(...costs),'refill cost includes allowance once');
    cases.push({tier,hp:hps,allowance,startingChaos:preview.startingChaos,nextStartingChaos:preview.nextStartingChaos,refillKindling:preview.refillKindling});
  }
}
}
const out=process.argv[2]??'docs/qa/artifacts/iteration-29-r3/thicken-preview.json';
mkdirSync(dirname(out),{recursive:true});
writeFileSync(out,JSON.stringify({verifiedAt:new Date().toISOString(),result:'PASS',cases,
  checks:['Fixed current HP across all capacities and invalid maximum protection','60 states: pure preview, actual no-heal purchase, unchanged effects and cheapest actual refill'],
  limitations:['Domain and preview verification; no browser or natural economy claim.']},null,2)+'\n');
console.log(`Thickening preview: ${cases.length} states passed; ${out}`);
