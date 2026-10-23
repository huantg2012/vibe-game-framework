/** Offline contract/art checks. No browser, gameplay session or save writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { ENEMY_WORLD_MATERIAL_RULES, ENEMY_WORLD_MATERIAL_ROUTING } from '../../src/generated/enemy-world-materials';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { withEnemyAppearance } from '../../src/generation/world-study/enemy-appearance-contract';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { resolveRuntimeEnemyWorldAppearance } from '../../src/entities/form-renderers/d/world-runtime';
import { productionModelFor } from '../../src/entities/form-renderers/d/production-models';
import { bakeHumanModel, type HumanPhase } from '../../src/entities/form-renderers/d/human-model';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintSurfaceMaterial } from '../../src/entities/form-renderers/d/paint-genome/material';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data';
import { AssimilationStatePresentation } from '../../src/art/assimilation-state-presentation';

const hash = (data: Uint8Array | Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
const tiers: CoverageId[] = ['infiltrate','rewrite','overwrite'];
const facings = ['up','down','left','right'] as const;
const phases: HumanPhase[] = ['idle','walk','alert','windup','strike','recover'];
let contracts=0, frames=0, paints=0, minimumMargin=64;
const bakeTimes:number[]=[];
for(const world of R100_NATIVE_WORLDS) for(const grade of ['low','medium','severe'] as const) {
  const recipe=createR100ProductionRecipe(world.id,20261023,grade);
  assert(recipe.enemyAppearance,world.id);
  assert(validR100ProductionRecipe(JSON.parse(JSON.stringify(recipe))),`${world.id}/${grade}`);
  const {enemyAppearance,...geometry}=recipe;
  assert(validR100ProductionRecipe(geometry));
  assert.deepEqual(withEnemyAppearance(geometry),recipe);
  for(const tamper of [
    (r:typeof recipe)=>{(r.enemyAppearance!.material.mid as number[])[0]! ^= 1;},
    (r:typeof recipe)=>{(r.enemyAppearance!.material as {kind:string}).kind='unknown';},
    (r:typeof recipe)=>{(r.enemyAppearance!.material as {fibreCount:number}).fibreCount=200;},
    (r:typeof recipe)=>{(r.enemyAppearance as {version:number}).version=99;},
    (r:typeof recipe)=>{(r as {requestedSeed:number}).requestedSeed++;},
  ]) {const bad=structuredClone(recipe);tamper(bad);assert(!validR100ProductionRecipe(bad),`tamper: ${world.id}`);}
  const material=enemyAppearance.material;
  const formBefore=JSON.stringify(recipe.enemyDeployment);
  for(const substrate of ['human_remnant','organic_remnant','oil_film','fungal_mat','ash_veil'])
    assert.equal(resolveRuntimeEnemyWorldAppearance(material,substrate,undefined,2).worldAdaptation,material);
  assert.deepEqual(resolveRuntimeEnemyWorldAppearance(material,'gas_mass',undefined,2),{});
  assert.equal(JSON.stringify(recipe.enemyDeployment),formBefore);
  const baked=bakeHumanModel({seed:37,coverage:tiers[contracts%3]!,facing4:'down',phase:'walk',phase01:.35,worldAdaptation:material});
  assert(baked.buf.data.some((v,i)=>i%4===3&&v===255));
  contracts++;
}
assert.equal(contracts,R100_NATIVE_WORLDS.length*3);
assert.deepEqual(R100_NATIVE_WORLDS.filter(w=>w.enabled).map(w=>w.id).sort(),['cinder-ridge','crystal-fibre','ruptured-film']);
for(const recipe of JSON.parse(fs.readFileSync('tools/enemy-world-pilot/fixtures/legacy-recipes.json','utf8')))
  assert(validR100ProductionRecipe(recipe),'old receipt independent of current CSV');

// Accepted pilot body bytes remain exact, including animated material folds.
for(const [worldId,expected] of JSON.parse(fs.readFileSync('tools/enemy-world-pilot/fixtures/pilot-pixel-hashes.json','utf8'))) {
  const digest=createHash('sha256');
  for(const coverage of tiers)for(const facing4 of facings)for(const phase of phases)for(const phase01 of [0,.5,1])
    digest.update(bakeHumanModel({seed:37,coverage,facing4,phase,phase01,worldAdaptation:resolveEnemyWorldAdaptation(worldId)}).buf.data);
  assert.equal(digest.digest('hex'),expected,worldId);
}
const families=[];
for(const rule of ENEMY_WORLD_MATERIAL_RULES) {
  const worldId=ENEMY_WORLD_MATERIAL_ROUTING.find(row=>row.family===rule.family)!.worldId;
  const material=resolveEnemyWorldAdaptation(worldId)!;
  const silhouettes=new Set<string>();
  for(const seed of [37,192])for(const coverage of tiers)for(const facing4 of facings)for(const phase of phases)for(const phase01 of [0,.5,1]) {
    const request={seed,coverage,facing4,phase,phase01};
    const t=performance.now(),body=bakeHumanModel({...request,worldAdaptation:material});bakeTimes.push(performance.now()-t);
    assert.equal(hash(body.buf.data),hash(bakeHumanModel({...request,worldAdaptation:material}).buf.data));
    assert.deepEqual(body.contacts,bakeHumanModel(request).contacts,'material cannot move bearing feet');
    const palette=new Set([material.dark,material.mid,material.light,material.secondary].map(c=>c.join(',')));
    for(let i=0;i<body.buf.data.length;i+=4) {
      const alpha=body.buf.data[i+3];assert(alpha===0||alpha===255);
      if(!alpha)continue;
      const x=i/4%64,y=Math.floor(i/4/64);minimumMargin=Math.min(minimumMargin,x,y,63-x,63-y);
      assert(palette.has(Array.from(body.buf.data.slice(i,i+3)).join(',')));
    }
    if(seed===37&&coverage==='rewrite'&&phase==='idle'&&phase01===0)silhouettes.add(hash(body.buf.data.filter((_,i)=>i%4===3)));
    frames++;
  }
  families.push({family:rule.family,worldId,silhouettes:[...silhouettes]});
  for(const substrate of ['fungal_mat','oil_film','ash_veil'])for(const coverage of tiers) {
    const baked=bakePaintGenome({substrate,coverage,seed:77,continuity:substrate==='fungal_mat'?'colony':'monolith',sense:'sense_touch',rhythm:'rhythm_open',geometryVersion:2});
    const {field,canvasW:w,canvasH:h,growth}=baked,prior=field.slice();
    const a=new Uint8ClampedArray(w*h*4),b=a.slice();
    paintSurfaceMaterial(a,field,w,h,substrate,coverage,77,420);
    paintSurfaceMaterial(b,field,w,h,substrate,coverage,77,420,undefined,material,growth);
    assert.deepEqual(a.filter((_,i)=>i%4===3),b.filter((_,i)=>i%4===3),'identical paint footprint');
    assert.deepEqual(field,prior,'authoritative density remains untouched');
    assert.deepEqual(collectPaintGenomeFloorTiles(field,w,h,256,256,32),collectPaintGenomeFloorTiles(prior,w,h,256,256,32));
    paints++;
  }
}
assert(minimumMargin>=2,'silhouette is clipped');
assert.equal(new Set(families.map(f=>f.silhouettes.join(','))).size,6,'families require distinct silhouettes');
assert.equal(productionModelFor('organic_remnant',true),productionModelFor('human_remnant'));
assert.notEqual(productionModelFor('organic_remnant'),productionModelFor('human_remnant'));
// New enemy kinds must not silently masquerade as membranes on the player.
const look=new AssimilationStatePresentation();
look.update(50,{version:1,worlds:{'cinder-ridge':50},unattributed:0},0,false,false);
assert.equal(look.typedFraction,0);
bakeTimes.sort((a,b)=>a-b);
const result={contracts,tamperCases:contracts*5,legacyReceipts:4,pilotFrames:432,frames,paints,minimumMargin,families,
  bakeMs:{median:bakeTimes[Math.floor(bakeTimes.length*.5)],p95:bakeTimes[Math.floor(bakeTimes.length*.95)],max:bakeTimes.at(-1)},
  scope:'Offline CPU bakers/contracts only; not gameplay, GPU or art approval'};
fs.mkdirSync('docs/qa/artifacts/enemy-world-automation-2026-10-23',{recursive:true});
fs.writeFileSync('docs/qa/artifacts/enemy-world-automation-2026-10-23/checks.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,families:families.map(f=>f.family)}));
