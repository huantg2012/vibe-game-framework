/** Limited generation and compatibility gates; never an aesthetic acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {R100_SEARCH_SITE_POLICIES} from '../../src/generated/r100-search-sites.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {SearchSitePlanner,validateSearchSites} from '../../src/generation/world-study/search-site-placement.ts';
import {createR100ProductionRecipe as oldRecipe,createR100ProductionMap as oldMap} from '../../src/generation/legacy-r100-v8/executor-revision8.js';
const arg=process.argv.indexOf('--report'),destination=arg>=0?process.argv[arg+1]:undefined;
if(destination)assert(!fs.existsSync(destination),'Never overwrite historical evidence');
function exactHash(value){
 const h=createHash('sha256');
 function visit(item){
  if(ArrayBuffer.isView(item)){h.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer,item.byteOffset,item.byteLength));return;}
  if(Array.isArray(item)){h.update(`array:${item.length}[`);for(const child of item)visit(child);h.update(']');return;}
  if(item&&typeof item==='object'){h.update('{');for(const key of Object.keys(item)){visit(key);visit(item[key]);}h.update('}');return;}
  assert.notEqual(typeof item,'function');const s=typeof item==='undefined'?'undefined':JSON.stringify(item);h.update(`${typeof item}:${s.length}:${s}`);
 }
 visit(value);return h.digest('hex');
}
const worlds=new Set(R100_SEARCH_SITE_POLICIES.map(row=>row.worldId));
assert(worlds.size > 0);
const selected=(process.env.QA_WORLDS??[...worlds].join(',')).split(',');
assert(new Set(selected).size===selected.length && selected.every(id=>worlds.has(id)));
const report={status:'running',cases:[],untouchedRecipes:0,legacyMaps:[],sourceKinds:{},limitations:['Finite authored seeds and generation checks, not visual or natural-player qualification.','Old six-world medium-grade full-map/material replay is independently captured in legacy-r8/replay-r9.json.']};
const grades=(process.env.QA_GRADES??'low,medium,severe').split(','),seeds=(process.env.QA_SEEDS??'20261012,20261019').split(',').map(Number);
try{
 for(const world of R100_NATIVE_WORLDS)if(!worlds.has(world.id))for(const grade of ['low','medium','severe']){
  const current=createR100ProductionRecipe(world.id,20261012,grade),old=oldRecipe(world.id,20261012,grade);
  assert.deepEqual(current,old,`${world.id}: unaffected recipe changed`);assert(validR100ProductionRecipe(old));report.untouchedRecipes++;
 }
 for(const worldId of ['woven-quarters','monolith-sill']){
  const recipe=oldRecipe(worldId,20261012,'medium'),expected=exactHash(oldMap(recipe));global.gc?.();
  const actual=exactHash(createR100ProductionMap(recipe));assert.equal(actual,expected);global.gc?.();
  report.legacyMaps.push({worldId,grade:'medium',seed:20261012,fullMapHash:actual});
 }
 for(const worldId of selected)for(const grade of grades)for(const seed of seeds){
  const recipe=createR100ProductionRecipe(worldId,seed,grade);assert.equal(recipe.package.algorithmRevision,10);assert(validR100ProductionRecipe(recipe));
  const receipt=JSON.stringify(recipe),map=createR100ProductionMap(recipe),world=hydrateR100MasterWorld(map.native,map.layout);
  validateSearchSites(world);
  const sites=world.searchSites,nodes=[...map.layout.kindlingNodes,...map.layout.contaminantNodes];
  assert.equal(sites.length,grade==='low'?6:grade==='medium'?8:9);
  assert.equal(world.algorithmRevision,10);
  const cd=recipe.contentDefinition;
  for(const tier of ['safe','contested','deep']){
   assert.equal(map.layout.kindlingNodes.filter(row=>row.tier===tier).length,cd[`kindling_${tier}_count`]);
   assert.equal(map.layout.contaminantNodes.filter(row=>row.tier===tier).length,cd[`contaminant_${tier}_count`]);
   for(const node of map.layout.kindlingNodes.filter(row=>row.tier===tier))assert.equal(node.value,cd[`kindling_${tier}_value`]);
  }
  for(let i=0;i<nodes.length;i++)for(let j=0;j<i;j++)assert(Math.hypot(nodes[i].position.x-nodes[j].position.x,nodes[i].position.y-nodes[j].position.y)>=96);
  const diagnostics=map.native.diagnostics.expedition;
  assert.equal(diagnostics.guaranteedSafeReturn,true);assert.equal(diagnostics.costBasis,'all-body-safe-48px-interaction-seats');
  assert.equal(diagnostics.patrolWindows.length,nodes.filter(node=>node.tier!=='safe').length);
  for(const node of diagnostics.nodes){
   const tier=node.id.split('/')[1],policy=world.spatialDeployment;
   assert(node.interactionSeats>0&&node.pollutionDistancePx>=(tier==='safe'?34:16));
   assert(node.approachRoutePx<=(tier==='safe'?policy.safe_max_approach_px:policy.max_search_approach_px));
   assert(node.minimumExtraTravelPx>=(tier==='safe'?0:policy[`${tier}_min_extra_travel_px`]));
   assert(node.minimumExtraTravelPx<=policy[`${tier}_max_extra_travel_px`]);
   if(tier==='deep')assert(node.pollutionDistancePx<=100);
  }
  const altered={...world,layout:{...map.layout,kindlingNodes:map.layout.kindlingNodes.map(node=>({...node,value:99999,tier:'deep',lootPoolId:'hidden-reward-replaced'})),contaminantNodes:map.layout.contaminantNodes.map(node=>({...node,tier:'safe',lootPoolId:'different-hidden-pool'}))}};
  const planner=new SearchSitePlanner(altered,recipe.searchSitePolicy);
  assert.deepEqual(sites,nodes.map(node=>planner.placement(node.id,node.position)),'Hidden reward/tier altered visual provenance');
  for(const site of sites){
   report.sourceKinds[site.sourceKind]=(report.sourceKinds[site.sourceKind]??0)+1;
   assert(!['tier','kind','value','rarity','reward','dropPlan'].some(key=>Object.hasOwn(site,key)));
   assert(planner.score(site.position)<=recipe.searchSitePolicy.environmentScoreCap);
  }
  const bad=[{...sites[0],nodeId:'missing'},{...sites[0],sourceDomain:'formation',sourceObjectId:99999},{...sites[0],position:{x:-1,y:-1}}];
  for(const first of bad)assert.throws(()=>validateSearchSites({...world,searchSites:[first,...sites.slice(1)]}));
  assert.throws(()=>validateSearchSites({...world,searchSites:sites.slice(1)}));
  assert.throws(()=>validateSearchSites({...world,algorithmRevision:8}));
  const hash=exactHash(map);let replay;
  if(grade==='medium'&&seed===20261012){
   const row=R100_SEARCH_SITE_POLICIES.find(row=>row.worldId===worldId),saved=row.peelPreference;
   try{row.peelPreference=NaN;assert(validR100ProductionRecipe(recipe));replay=exactHash(createR100ProductionMap(recipe));assert.equal(replay,hash,'Saved r10 consulted changed current authoring');}
   finally{row.peelPreference=saved;}
  }
  assert.equal(JSON.stringify(recipe),receipt);
  report.cases.push({worldId,grade,seed,effectiveSeed:map.layout.seed,attempt:map.metadata.attempt,mapHash:hash,frozenReplayHash:replay??null,nodes:sites.map(site=>({nodeId:site.nodeId,position:site.position,sourceKind:site.sourceKind,family:site.family,sourceDomain:site.sourceDomain,sourceObjectId:site.sourceObjectId,sourceAnchor:site.sourceAnchor})),riskChecks:diagnostics.nodes});
  console.log(`PASS r10 generation ${worldId}/${grade}/${seed}: ${sites.length} sites, attempt ${map.metadata.attempt}`);global.gc?.();
 }
 for(const kind of ['detached','surface-peel','ground-accumulation'])assert(report.sourceKinds[kind]>0,`No covered ${kind} case`);
 report.status='passed';
}catch(error){report.status='failed';report.error=error.stack??String(error);process.exitCode=1;console.error(error);}
finally{if(destination){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}console.log(JSON.stringify({status:report.status,cases:report.cases.length,untouchedRecipes:report.untouchedRecipes,sourceKinds:report.sourceKinds}));}
