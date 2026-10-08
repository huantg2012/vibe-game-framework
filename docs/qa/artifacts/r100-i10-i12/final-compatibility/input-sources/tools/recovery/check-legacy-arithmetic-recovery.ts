/** Complete historical execution, never near-equal signature acceptance. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreLegacyProductionWorld} from '../../src/generation/legacy-rift-generation';
import {generatedRiftIdentity} from '../../src/generation/rift-generation-identity';
import {legacyGenerationGold} from './legacy-generation-gold';
const record=JSON.parse(readFileSync('tools/recovery/fixtures/legacy-generation-gold.json','utf8')).records[1];
const expected=record.identity,recipe=expected.generation,bytes=JSON.stringify(expected),nativeAtan2=Math.atan2;
try {
 Math.atan2=()=>{throw new Error('UNAVAILABLE_NATIVE_ARITHMETIC');};
 const world=restoreLegacyProductionWorld(recipe,expected);
 assert.deepEqual(generatedRiftIdentity(world.layout,recipe,world),expected);
 const{id,identity,...gold}=record;assert.deepEqual(legacyGenerationGold(world.layout,world),gold);
 assert.throws(()=>Math.atan2(-0,1),/UNAVAILABLE_NATIVE_ARITHMETIC/,'executor cannot mutate global Math');
} finally {Math.atan2=nativeAtan2;}
assert.equal(JSON.stringify(expected),bytes);
for(const changed of [
 {...expected,signature:'ffffffff'},
 {...expected,seed:(expected.seed+1)>>>0},
 {...expected,recipeId:'world-space:invalid'},
 {...expected,generation:{...recipe,requestedSeed:-1}},
 {...expected,generation:{...recipe,profile:{...recipe.profile,palette:{...recipe.profile.palette,floor:recipe.profile.palette.floor+1}}}},
])assert.throws(()=>restoreLegacyProductionWorld(changed.generation,changed));
console.log('PASS complete historical arithmetic fallback after native admission failure; full world SHA, immutable input/global Math, five strict identity/recipe counterexamples.');
