import assert from 'node:assert/strict';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { isPollutionGradeDefinition } from '../../src/generation/world-study/pollution-grade';
import { createMasterPollution } from '../../src/generation/world-study/r100-pollution';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { TileGrid } from '../../src/systems/tile-grid';
import { TileType } from '../../src/types/game-types';
const grid = new TileGrid({cols:32,rows:24,tileSize:32,tiles:Array.from({length:24},()=>Array(32).fill(TileType.FLOOR))});
const reachable = new Uint8Array(32*24).fill(1);
let cases = 0;
for (const grade of POLLUTION_GRADE_DEFINITIONS) {
  assert(isPollutionGradeDefinition(grade));
  assert(!isPollutionGradeDefinition({...grade,volumePool:[]}));
  assert(!isPollutionGradeDefinition({...grade,volumePool:['human_remnant']}));
  const {volumePool, ...rest} = grade;
  const legacy = {...rest,version:1 as const};
  assert(isPollutionGradeDefinition(legacy));
  const seen = new Set<string>();
  for(let seed=1;seed<=16;seed++) {
    const current = createMasterPollution(grade,seed,grid,reachable,33,[{x:944,y:688}]);
    const old = createMasterPollution(legacy,seed,grid,reachable,33,[{x:944,y:688}]);
    assert.deepEqual(current.pins,old.pins,'Species selection must not move Hosts or change routes');
    assert.deepEqual(current.safeRoute,old.safeRoute);
    const forms = current.forms.filter(f=>f.occupancy==='volume');
    assert.equal(forms.length,grade.volumeCount);
    assert.equal(new Set(forms.map(f=>f.substrate)).size,forms.length);
    forms.forEach(f=>seen.add(f.substrate));
    assert(old.forms.filter(f=>f.occupancy==='volume').every(f=>f.substrate==='gas_mass'));
    assert.deepEqual(current,createMasterPollution(JSON.parse(JSON.stringify(grade)),seed,grid,reachable,33,[{x:944,y:688}]));
    cases++;
  }
  assert.deepEqual([...seen].sort(),[...volumePool!].sort());
  for(const world of ['crystal-fibre','ruptured-film','cinder-ridge']) {
    const recipe=createR100ProductionRecipe(world,20261023,grade.id);
    assert(validR100ProductionRecipe(recipe));
    assert.deepEqual(recipe.gradeDefinition.volumePool,volumePool);
    assert(validR100ProductionRecipe(JSON.parse(JSON.stringify(recipe))));
  }
}
console.log(JSON.stringify({cases,productionRecipes:9,legacyGasOnly:true,hostSeatsUnchanged:true,replay:true}));
