/** Finite score-source checks; no layout sampling or geometry compile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {nativeSpatialPlanningWideRatio} from '../../src/generation/world-study/native-spatial-layout.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
const paths=['src/generation/world-study/native-spatial-layout.ts','tools/native-spatial/check-wide-area-score.mjs'];
const snapshot=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes=snapshot(),cases=[];
function check(id,run){run();cases.push({id,passed:true});}
check('actual-numerator-replaces-raw-and-constant',()=>{
  const measurement={wideCount:10072,largestWideRatio:1};
  assert.equal(nativeSpatialPlanningWideRatio(.99,.5,measurement,18632),10072/18632);
  assert.equal(nativeSpatialPlanningWideRatio(.1,-.5,measurement,18632),10072/18632);
});
check('missing-cache-keeps-existing-coarse-estimate',()=>{
  assert.equal(nativeSpatialPlanningWideRatio(.51,.03),.54);
  assert.equal(nativeSpatialPlanningWideRatio(.1,-.5),Number.EPSILON);
});
check('fixed-denominator-is-explicit-not-invented-or-clamped',()=>{
  const measurement={wideCount:11,largestWideRatio:1};
  assert.equal(nativeSpatialPlanningWideRatio(0,0,measurement,10),1.1);
  assert.equal(nativeSpatialPlanningWideRatio(0,0,{...measurement,wideCount:0},10),0);
  for(const denominator of [undefined,0,-1,NaN,Infinity,3.5])assert.throws(()=>nativeSpatialPlanningWideRatio(0,0,measurement,denominator),/actual body count/);
});
const sourceHashesAfter=snapshot(),report={scope:'Pure score-source checks, no new maps.',sourceHashes,sourceHashesAfter,sourcesStable:JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter),cases};
assert(report.sourcesStable);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourcesStable:report.sourcesStable,cases}));
