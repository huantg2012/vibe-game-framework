// Capture current HEAD r10 identities and exact hashes only; no image/map/surface payloads.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createR100ProductionRecipe} from '../../../../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../../../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../../../../src/generation/world-study/r100-native-data.ts';
import {bakeMasterWorldSurface} from '../../../../../src/systems/r100-world/surface-bake.ts';
import {bakeSearchSitePatches} from '../../../../../src/systems/r100-world/search-site-bake.ts';
import {applySearchSitePatch} from '../../../../../src/systems/r100-world/search-site-patches.ts';
import {exactHash,sourceHashes,readPainting,sha256} from '../../../../../tools/stealth-obstacles/baseline.mjs';
const output=process.argv[2];assert(output&&!fs.existsSync(output));fs.mkdirSync(output,{recursive:true});
const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();assert.equal(head,'99998703743895da7486fdee552f7bed019e64b8');
const oldBase='docs/qa/artifacts/stealth-obstacles-2026-10-13/code/after-final';
const oldReceipt=JSON.parse(fs.readFileSync(`${oldBase}/baseline.json`));assert.equal(oldReceipt.status,'passed');
const sources=sourceHashes(),channels=['albedo','normal','response','emission'];
const report={status:'running',capturedAt:new Date().toISOString(),sourceCommit:head,node:process.version,sourceHashes:sources,materialHashes:{},cases:[],failures:[],
 limitations:['Current 3 representative medium-grade recipes at requested seed 20261012 only.',
 'Full map and intact/searched four-channel hashes; deliberately no serialized maps, surface buffers or preview images.',
 'Determinism receipt does not prove gameplay, aesthetics or all historical revision 10 saves.']};
const save=()=>fs.writeFileSync(path.join(output,'baseline.json'),JSON.stringify(report,null,2)+'\n');save();
for(const worldId of ['split-rib-causeway','gel-rafts','sloughed-court']) {
 try {
  const recipe=createR100ProductionRecipe(worldId,20261012,'medium');assert.equal(recipe.package.algorithmRevision,10);
  const id=`${worldId}-medium-20261012`,recipeFile=`${id}.recipe.json`;
  fs.writeFileSync(path.join(output,recipeFile),JSON.stringify(recipe,null,2)+'\n',{flag:'wx'});
  const expected=oldReceipt.cases.find(r=>r.worldId===worldId),recipeHash=exactHash(recipe);
  assert.equal(recipeHash,expected.recipeHash,'Current HEAD recipe must match finalized r10 authoring');
  const map=createR100ProductionMap(recipe),mapHash=exactHash(map);assert.equal(mapHash,expected.mapHash);
  const world=hydrateR100MasterWorld(map.native,map.layout),painting=await readPainting(recipe,report.materialHashes);
  const surface=bakeMasterWorldSurface(world,painting),patches=bakeSearchSitePatches(world,surface,painting);
  const material={patchHash:exactHash(patches),states:{}};
  for(const state of ['intact','searched']) {
   for(const patch of patches)applySearchSitePatch(surface,patch,patch[state]);
   material.states[state]=Object.fromEntries(channels.map(c=>[c,sha256(surface[c])]));
  }
  assert.deepEqual(material,expected.material);
  report.cases.push({worldId,grade:'medium',seed:20261012,recipeFile,recipeSha256:sha256(fs.readFileSync(path.join(output,recipeFile))),recipeHash,mapHash,
   effectiveSeed:map.metadata.effectiveSeed,attempt:map.metadata.attempt,rejected:map.metadata.rejected,material,matchedHistoricalFinalReceipt:true});
  console.log(`PASS ${id}: complete map + 4 channels × 2 states`);
 }catch(error){report.failures.push({worldId,error:String(error.stack??error)});console.error(error);}
 save();global.gc?.();
}
assert.deepEqual(sourceHashes(),sources,'Sources changed during baseline capture');
report.status=report.failures.length?'failed':'passed';save();if(report.failures.length)process.exitCode=1;
