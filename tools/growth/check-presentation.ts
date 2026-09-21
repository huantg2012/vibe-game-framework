import assert from 'node:assert/strict';
import { previewThickening } from '../../src/ui/growth-presentation';
import { gameState } from '../../src/managers/game-state';

for (const hps of [[100,100,100], [15,22,8], [0,0,0], [99,96,97]]) {
  for (const allowance of [0,8,40,1000]) {
    gameState.reset();
    const state = gameState.getState();
    state.kindlingReserve=1000;
    state.modules.forEach((module,i)=>{module.hp=hps[i]!;module.maxHp=100;});
    state.repairBonusHp=allowance;
    gameState.loadState(state);
    const before=gameState.getState();
    const preview=previewThickening(gameState.getModules(),allowance);
    assert.deepEqual(gameState.getState(),before,'preview is pure');
    assert(gameState.raiseModuleMaxHp());
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
    }
    assert.equal(preview.refillKindling,Math.min(...costs),'refill cost includes allowance once');
  }
}
console.log('Thickening preview: 16 states, pure output / actual purchase / all refill orders verified.');
