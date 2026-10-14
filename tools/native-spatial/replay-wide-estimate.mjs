/** Fixed production ancestry replay. Diagnostics only, never a fresh admission. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import * as data from '../../src/generated/r100-native-spatial.ts';
import {createNativeSpatialLayout} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry,nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {createNativeSpatialPlanningGround} from '../../src/generation/world-study/native-spatial-bay-layout.ts';
import {mix32} from '../../src/generation/seed-fork.ts';
const [source,out]=process.argv.slice(2);assert(source&&out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const production=JSON.parse(fs.readFileSync(source)),trace=production.failures[0].diagnostics.attempts[0],seed=20261012,worldId='gel-rafts',grade='medium';
const native=createR100NativeSpatialDevelopmentRecipe(worldId,seed,grade).nativeDefinition,input={policy:data.NATIVE_SPATIAL_POLICY,world:data.NATIVE_SPATIAL_WORLDS.find(w=>w.worldId===worldId),holeProfiles:data.NATIVE_SPATIAL_HOLE_PROFILES,bayProfiles:data.NATIVE_SPATIAL_BAY_PROFILES,assemblies:data.NATIVE_SPATIAL_ASSEMBLIES.filter(a=>a.worldId===worldId&&(a.grade==='all'||a.grade===grade)),subordinateProfiles:data.NATIVE_SPATIAL_SUBORDINATE_PROFILES.filter(p=>p.family===native.family)};
const ancestry=new Set();function visit(candidate){if(ancestry.has(candidate))return;const row=trace.candidates.find(r=>r.candidate===candidate);assert(row);if(row.feedbackBaseCandidate!==undefined)visit(row.feedbackBaseCandidate);ancestry.add(candidate);}for(const target of [27,36,37])visit(target);
const report={scope:'Exact ancestry replay for wide-estimate bias, not a fresh production pass',source,sourceHashes:{},cases:[]},receipts=new Map();
for(const name of ['native-spatial-layout.ts','native-spatial-land.ts','native-spatial-bay-layout.ts','native-spatial-geometry.ts']){const p='src/generation/world-study/'+name;report.sourceHashes[p]=createHash('sha256').update(fs.readFileSync(p)).digest('hex');}
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
for(const candidate of ancestry){
 const row=trace.candidates.find(r=>r.candidate===candidate),prior=receipts.get(row.feedbackBaseCandidate),start=performance.now();
 const proposal=createNativeSpatialLayout(native,input,seed,trace.geometrySeed,candidate,prior?{layout:prior,gate:trace.candidates.find(r=>r.candidate===row.feedbackBaseCandidate).gates.geometry}:undefined,row.countPairIndex,row.bayCountIndex);
 const geometry=buildNativeSpatialGeometry(proposal.definition,trace.geometrySeed),fingerprint=nativeSpatialGeometryFingerprint(geometry,proposal);assert.equal(fingerprint.hash,row.geometryHash,`Replay diverged at ${candidate}`);receipts.set(candidate,proposal);
 const ground=createNativeSpatialPlanningGround(proposal.plan.land,proposal.bays.flatMap(b=>b.rects)),hole=proposal.holes.flatMap(h=>h.rects.flatMap(([x,y,w,h])=>[nativePrimitive([x,y,x+w,y,x+w,y+h],-1),nativePrimitive([x,y,x+w,y+h,x,y+h],-1)])),structure=nativePrimitiveTree([...geometry.solidPrimitives,...hole]);
 const base=[];for(let y=0;y<input.world.frameHeightPx;y+=16)for(let x=0;x<input.world.frameWidthPx;x+=16){const phase=mix32(trace.geometrySeed,`${worldId}:native-plan:${x}:${y}`),p={x:x+4+8*(phase&1),y:y+4+8*((phase>>>1)&1)};if(ground.margin(p)>=12)base.push(p);}
 const count=(points,raw)=>{let walk=0,wide=0;for(const p of points){if(raw){const d=nativePrimitiveDistance(structure,p.x,p.y);if(d<10)continue;walk++;wide+=Math.min(d,ground.margin(p))>=48?1:0;}else if(geometry.collision.supports(p,10,10)){walk++;wide+=Math.min(geometry.solidDistance(p),geometry.voidDistance(p))>=48?1:0;}}return{walk,wide,ratio:wide/walk};};
 const allPhases=[];for(let y=4;y<input.world.frameHeightPx;y+=8)for(let x=4;x<input.world.frameWidthPx;x+=8)allPhases.push({x,y});
 const raw16=count(base,true),raw16WithHotspots=count([...base,...proposal.plan.assessmentPoints??[]],true),final16=count(base,false),raw8=count(allPhases.filter(p=>ground.margin(p)>=12),true),final8=count(allPhases,false);
 const result={candidate,feedbackBaseCandidate:row.feedbackBaseCandidate,geometryHash:fingerprint.hash,ms:performance.now()-start,actualGate:row.gates.geometry,raw16,raw16WithHotspots,final16,raw8,final8,bias:raw16.ratio-final8.ratio,geometryBias:raw8.ratio-final8.ratio,samplingBias:raw16.ratio-raw8.ratio};report.cases.push(result);
 if([27,36,37].includes(candidate))fs.writeFileSync(path.join(out,`candidate-${candidate}.json`),JSON.stringify({input,proposal,gate:row.gates.geometry,diagnostic:result},null,2)+'\n');
 save();console.log(JSON.stringify({candidate,raw:raw16.ratio,actual:final8.ratio,bias:result.bias,geometryBias:result.geometryBias,samplingBias:result.samplingBias}));
}
report.status='exact-replay-complete';save();
