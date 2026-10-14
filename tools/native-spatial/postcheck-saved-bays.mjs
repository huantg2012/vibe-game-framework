/** Re-measure saved concrete proposals; this never invokes a layout sampler. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialBays} from '../../src/generation/world-study/native-spatial-bay-measure.ts';
const [directory,output]=process.argv.slice(2);assert(directory&&output&&!fs.existsSync(output),'existing proposal directory and fresh report path required');
const paths=['native-spatial-geometry.ts','native-spatial-measure.ts','native-spatial-bay-measure.ts','native-spatial-final-support.ts'].map(name=>'src/generation/world-study/'+name),hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={status:'running',scope:'Final B gate on exactly three prior saved proposals. No new sample, no overall admission, no Art pass.',sourceHashes:hashes(),cases:[]};
for(const name of ['gel-rafts-20261012-b0.json','gel-rafts-20261012-b1.json','gel-rafts-20261012-b2.json']){
 const source=path.join(directory,name),record=JSON.parse(fs.readFileSync(source)),{input,proposal}=record,start=performance.now();
 const geometry=buildNativeSpatialGeometry(proposal.definition,20261012),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy),gate=evaluateNativeSpatialBays(geometry,groups,{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
 report.cases.push({source,sourceHash:createHash('sha256').update(fs.readFileSync(source)).digest('hex'),bayCountIndex:proposal.bayCountIndex,totalMs:performance.now()-start,gate});
 console.log(name,gate.accepted?'B-CONTRACT':'B-REJECT',gate.reasons.join(','));
}
report.status='completed-posthoc';report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
