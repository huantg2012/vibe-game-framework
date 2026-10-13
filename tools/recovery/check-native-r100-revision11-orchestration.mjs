/** Exercise the real production controller under forced content rejection.
 * Dependencies are virtual test modules; no runtime test hooks or production rules are added. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
const output=process.env.QA_REPORT??'docs/qa/artifacts/spatial-augmentation-2026-10-13/code/r11-orchestration.json';
assert(!fs.existsSync(output),'Refusing to overwrite evidence');
const stateSource=`export const state={scenario:'',seeds:[],requestedSeeds:[],constructed:[],deployed:[],closed:0};
export function reset(scenario){state.scenario=scenario;state.seeds=[];state.requestedSeeds=[];state.constructed=[];state.deployed=[];state.closed=0;}`;
const modules={
  state:stateSource,
  './r100-spatial-world':`import {state} from 'test:state';export function* createR100SpatialWorldCandidates(native,policy,seed,frozen){state.seeds.push(seed);state.requestedSeeds.push(frozen.requestedSeed);try{for(let index=0;index<3;index++){state.constructed.push({seed,index});yield{seed,index,sample:{seed},hostTileMap:{},diagnostics:{geometryFingerprint:'geometry-'+seed+'-'+index,spatialAugmentation:{status:'fixture'}}};}}finally{state.closed++;}}`,
  './r100-expedition':`import {state} from 'test:state';export function deployR100Expedition(master){state.deployed.push({seed:master.seed,index:master.index});if(state.scenario==='all-fail'||state.scenario==='first-fails'&&master.index===0||state.scenario==='both-fail-on-first-seed'&&master.seed===100)throw new Error('forced complete Host quota rejection');return{layout:{seed:master.seed},searchSites:[],diagnostics:{reachableBodySeats:42,extractionRoutePx:512}};}`,
  './r100-native-data':`export function serializeR100MasterWorld(world,grade,hash){return {...world,gradeDefinition:grade,packageHash:hash};}`,
  './r100-package':`export const validR100ProductionRecipe=recipe=>recipe.package.algorithmRevision===11;`,
  '@/generation/seed-fork':`export function mix32(seed,label){return seed+Number(label.slice(label.lastIndexOf('-')+1));}`,
  '@/types/rift-checkpoint':`export function checkpointChecksum(value){return JSON.stringify(value);}`,
};
const result=await build({stdin:{contents:`export {createR100ProductionMap} from './src/generation/world-study/r100-production-map.ts';export {state,reset} from 'test:state';`,resolveDir:process.cwd(),sourcefile:'controller-test-entry.ts'},bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'controlled-dependency-failures',setup(builder){builder.onResolve({filter:/.*/},args=>{if(args.path==='test:state')return{path:'state',namespace:'test'};if(modules[args.path])return{path:args.path,namespace:'test'};if(/legacy-r100-v\d+\/executor(?:-recovery)?\.js$/.test(args.path))return{path:'legacy',namespace:'test'};});builder.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='legacy'?`export function createR100ProductionMap(){throw new Error('Unexpected legacy route');}`:modules[args.path],loader:'js'}));}}]});
const {createR100ProductionMap,state,reset}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const recipe={version:3,requestedSeed:100,nativeDefinition:{id:'fixture',grade:'medium'},spatialPolicy:{},gradeDefinition:{},profile:{},augmentationPolicy:{},contentDefinition:{},package:{algorithmRevision:11,id:'r100-fixture',dependencyHash:'fixture'},contentFragmentTypeId:'frag-outdoor',appearance:{}};
const cases=[];
reset('first-fails');let map=createR100ProductionMap(recipe);
assert.equal(map.metadata.attempt,0);assert.equal(map.native.diagnostics.spatialAugmentationDeployment.selectedCandidate,1);assert.equal(map.metadata.rejected.length,1);assert.equal(state.constructed.length,2);assert.equal(state.closed,1);assert.deepEqual(state.seeds,[100]);assert.deepEqual(state.requestedSeeds,[100]);cases.push({name:state.scenario,generated:state.constructed.length,closed:state.closed,selected:1,rejections:map.metadata.rejected});
reset('both-fail-on-first-seed');map=createR100ProductionMap(recipe);
assert.equal(map.metadata.attempt,1);assert.equal(map.native.diagnostics.spatialAugmentationDeployment.selectedCandidate,0);assert.equal(map.metadata.rejected.length,2);assert.equal(state.constructed.length,3);assert.equal(state.closed,2);assert.deepEqual(state.seeds,[100,101]);assert.deepEqual(state.requestedSeeds,[100,100]);cases.push({name:state.scenario,generated:state.constructed.length,closed:state.closed,selected:0,seeds:state.seeds,rejections:map.metadata.rejected});
reset('all-fail');assert.throws(()=>createR100ProductionMap(recipe),/after 8 attempts/);
assert.equal(state.constructed.length,16);assert.equal(state.deployed.length,16);assert.equal(state.closed,8);assert.deepEqual(state.seeds,[100,101,102,103,104,105,106,107]);assert.deepEqual(state.requestedSeeds,Array(8).fill(100));assert(state.constructed.every(row=>row.index<2));cases.push({name:state.scenario,generated:state.constructed.length,deployed:state.deployed.length,closed:state.closed,seeds:state.seeds,thirdCandidateNeverConstructed:true});
const report={status:'passed',createdAt:new Date().toISOString(),cases,limits:['The real r11 controller runs with stubbed geometry/content dependencies to force failures. This is not a substitute for actual content-admission and saved-map replay tests.','Test seed function preserves attempt labels but is a controlled stub; production mix32 implementation is unchanged.']};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:cases.length,output}));
