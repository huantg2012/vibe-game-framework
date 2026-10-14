/** One fixed proposal only; CPU evidence must not be described as gameplay FPS. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Session} from 'node:inspector';
import {promisify} from 'node:util';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createNativeSpatialLayout} from '../../src/generation/world-study/native-spatial-layout.ts';
const output=process.argv[2],baseline=process.argv[3]?JSON.parse(fs.readFileSync(process.argv[3],'utf8')):null;
assert(output,'Usage: profile-layout.mjs NEW_REPORT.json [BASELINE_REPORT.json]');assert(!fs.existsSync(output),'Preserve previous evidence');
const hash=value=>createHash('sha256').update(value).digest('hex');
const recipe=createR100NativeSpatialDevelopmentRecipe('gel-rafts',20261012,'medium'),recipeHash=hash(JSON.stringify(recipe));
const layoutSourceHash=hash(fs.readFileSync('src/generation/world-study/native-spatial-layout.ts'));
const inspector=new Session();inspector.connect();const post=promisify(inspector.post.bind(inspector));
await post('Profiler.enable');await post('Profiler.setSamplingInterval',{interval:500});await post('Profiler.start');
const started=performance.now(),layout=createNativeSpatialLayout(recipe.nativeDefinition,recipe.nativeSpatial,20261012,20261012,0),elapsedMs=performance.now()-started;
const {profile}=await post('Profiler.stop');inspector.disconnect();
const byId=new Map(profile.nodes.map(n=>[n.id,n])),cost=new Map();
for(let i=0;i<profile.samples.length;i++){const f=byId.get(profile.samples[i]).callFrame,label=`${f.functionName||'(anonymous)'} ${f.url}`;cost.set(label,(cost.get(label)||0)+profile.timeDeltas[i]/1000);}
const layoutHash=hash(JSON.stringify(layout)),report={status:'passed',createdAt:new Date().toISOString(),worldId:'gel-rafts',grade:'medium',seed:20261012,candidate:0,recipeHash,layoutSourceHash,layoutHash,elapsedMs,geometrySourceHash:hash(fs.readFileSync('src/generation/world-study/native-spatial-geometry.ts')),topSelfMs:[...cost.entries()].sort((a,b)=>b[1]-a[1]).slice(0,24),scope:'One fixed native proposal; CPU profile under Node/tsx, not generation admission or browser FPS.'};
if(baseline){assert.equal(recipeHash,baseline.recipeHash);assert.equal(layoutSourceHash,baseline.layoutSourceHash,'Do not compare different samplers');assert.equal(layoutHash,baseline.layoutHash,'Optimization changed exact proposal');report.baselineElapsedMs=baseline.elapsedMs;report.exactLayoutMatch=true;}
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
