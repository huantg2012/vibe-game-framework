/** Small scoring fields only: no terrain candidate, search or game runtime. */
import assert from 'node:assert/strict';
import {refineNativeAutoPlan,nativeAutoScoreImproves} from '../../src/generation/world-study/native-auto-refinement.ts';
import {nativePrimitive,nativePrimitiveTree} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {NATIVE_SPATIAL_POLICY} from '../../src/generated/r100-native-spatial.ts';
import {NATIVE_AUTO_CONSTRUCTION_POLICIES} from '../../src/generated/r100-native-auto-construction.ts';
const score=(penalty,qualityPenalty)=>({penalty,qualityPenalty});
assert(nativeAutoScoreImproves(score(0,100),score(.01,0)),'Hard improvement wins despite worse quality');
assert(!nativeAutoScoreImproves(score(.01,0),score(0,100)),'Quality cannot buy a hard regression');
assert(nativeAutoScoreImproves(score(0,.01),score(0,.02)),'Quality breaks equal hard costs');
assert(!nativeAutoScoreImproves(score(0,.02),score(0,.01)));
assert(!nativeAutoScoreImproves(score(.5e-9,0),score(0,100)),'Even a sub-epsilon hard regression cannot be purchased');
assert(!nativeAutoScoreImproves(score(0,.5e-9),score(0,1e-9)),'Improvement precision is retained');
const source=nativePrimitiveTree([nativePrimitive([5000,5000,5010,5000,5000,5010],1)]);
function fieldScore(wideFraction,targetWidePercent,hardWideRatio=.5){
  const planning={...NATIVE_AUTO_CONSTRUCTION_POLICIES[0],targetWidePercent,refinementPasses:0};
  // Exactly 100 fixed body sample centres. Only their declared ground margin
  // changes, so the fixture isolates hard-wide and quality-wide contributions.
  const ground={margin:p=>p.x<800*wideFraction?100:30,supportsBody:()=>true};
  return refineNativeAutoPlan([{kind:'hole',bounds:[-5000,-5000,8,8],rects:[[-5000,-5000,8,8]]}],
    [{x:0,y:0}],[[0]],new Map([[0,0]]),[[0,0,800,8]],source,
    {...NATIVE_SPATIAL_POLICY,minWideRatio:hardWideRatio},planning,()=>{},[],8,ground).after;
}
const hardBoundary=fieldScore(.5,55),higherQualityTarget=fieldScore(.5,65),oldCombined=fieldScore(.5,55,.55);
assert.equal(hardBoundary.wideRatio,.5);
assert.equal(hardBoundary.penalty,higherQualityTarget.penalty,'Quality target does not enter hard cost');
assert(higherQualityTarget.qualityPenalty>hardBoundary.qualityPenalty);
assert(Math.abs(oldCombined.penalty-hardBoundary.penalty-(1-.5/.55)**2)<1e-10,'The actual .50 hard boundary is used');
const exactQuality=fieldScore(.55,55),lowerTarget=fieldScore(.55,50);
assert.equal(exactQuality.penalty,lowerTarget.penalty);
assert.equal(exactQuality.qualityPenalty,lowerTarget.qualityPenalty,'Quality deficit vanishes at .55');
console.log(JSON.stringify({status:'passed',cases:12,scope:'hard-first exact ties, unchanged precision, .50 hard versus .55 quality scoring'}));
