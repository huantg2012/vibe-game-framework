/** Offline recovery of committed r13 maps; never consult the new-trip factory. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {deserialize,serialize} from 'node:v8';
import {isDeepStrictEqual} from 'node:util';
import {validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';

const results=[];
for(const world of ['cinder-ridge','crystal-fibre','ruptured-film']){
  const root=new URL(`../../docs/qa/artifacts/low-rift-compact-2026-10-20/${world}/`,import.meta.url);
  const recipe=JSON.parse(readFileSync(new URL('recipe.json',root),'utf8'));
  const expected=deserialize(gunzipSync(readFileSync(new URL('map.v8.gz',root))));
  assert.equal(recipe.package.algorithmRevision,13);
  assert(validR100ProductionRecipe(recipe),`${world}: frozen recipe remains valid`);
  const started=performance.now(),actual=createR100ProductionMap(recipe);
  assert.equal(actual.metadata.signature,expected.metadata.signature,`${world}: original map signature`);
  // v8 snapshots retain data/typed arrays, not a TileGrid class prototype.
  const normalized=deserialize(serialize(actual.layout));
  const changedKeys=Object.keys(expected.layout).filter(key=>!isDeepStrictEqual(normalized[key],expected.layout[key]));
  assert.deepEqual(Object.keys(normalized),Object.keys(expected.layout));
  assert.deepEqual(changedKeys,[],`${world}: original layout fields changed`);
  results.push({world,grade:recipe.package.grade,seed:recipe.requestedSeed,revision:13,
    signature:actual.metadata.signature,elapsedMs:performance.now()-started});
}
console.log(JSON.stringify({status:'passed',scope:'three committed frozen r13 complete maps; no gameplay',results}));
