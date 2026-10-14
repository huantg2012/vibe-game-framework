/** One bounded continuation of saved candidate 37; never a fresh request. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createNativeSpatialLayout} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialVisibility} from '../../src/generation/world-study/native-spatial-visibility.ts';
const [source,out]=process.argv.slice(2);assert(source&&out&&!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const receipt=JSON.parse(fs.readFileSync(source)),input=receipt.input,seed=20261012,native=createR100ProductionRecipe('gel-rafts',seed,'medium').nativeDefinition;
const files=['native-spatial-layout.ts','native-spatial-land.ts','native-spatial-bay-layout.ts','native-spatial-geometry.ts','native-spatial-measure.ts','native-spatial-bay-measure.ts'].map(name=>'src/generation/world-study/'+name);
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={scope:'Saved candidate37 continuation only, 4 refinements, not fresh production or deployment admission',source,sourceHashes:hashes(),cases:[]};
let previous={layout:receipt.proposal,gate:receipt.gate},raw=receipt.diagnostic.raw16.ratio;
for(let candidate=38;candidate<=41;candidate++){
 const start=performance.now(),proposal=createNativeSpatialLayout(native,input,seed,seed,candidate,previous),layoutMs=performance.now()-start;
 assert(Math.abs(proposal.plan.wideEstimate.correction-(previous.gate.metrics.wideRatio-raw))<1e-12,'Correction must derive from the actual same-plan residual');
 assert.equal(proposal.plan.wideEstimate.feedbackCandidate,previous.layout.candidate);
 assert.deepEqual(proposal.plan.land,receipt.proposal.plan.land);assert.deepEqual(proposal.bays,receipt.proposal.bays);assert.deepEqual(proposal.requestedCounts,receipt.proposal.requestedCounts);
 const geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy),gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
 const visibility=gate.accepted?evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy):undefined;
 const row={candidate,layoutMs,totalMs:performance.now()-start,wideEstimate:proposal.plan.wideEstimate,actualWide:gate.metrics.wideRatio,rawBias:proposal.plan.wideEstimate.rawRatio-gate.metrics.wideRatio,correctedResidual:proposal.plan.wideEstimate.correctedRatio-gate.metrics.wideRatio,gate,visibility};report.cases.push(row);
 fs.writeFileSync(path.join(out,`candidate-${candidate}.json`),JSON.stringify({input,proposal,gate,visibility},null,2)+'\n');fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({candidate,ms:row.totalMs,wide:row.actualWide,estimate:row.wideEstimate,max:gate.metrics.maxEmptyUpperPx,deep:gate.metrics.maxDeepSpanPx,reasons:gate.reasons}));previous={layout:proposal,gate};raw=proposal.plan.wideEstimate.rawRatio;
}
report.status='bounded-continuation-complete';report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
