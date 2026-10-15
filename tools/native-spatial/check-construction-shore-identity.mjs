import assert from 'node:assert/strict';
import {constructNativeMacroShore} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
import {nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';

// An untouched distant bank keeps its old random stream when a new arm adds
// earlier entries to the perimeter enumeration. No terrain is compiled here.
const land=[[400,400,1200,1000]],arm=[600,80,480,640];
const policy={referenceId:'identity-test',algorithm:'macro-shore-step-v1',sourceHash:'0'.repeat(64),segmentMinPx:64,segmentMaxPx:128,depthMinPx:16,depthMaxPx:40,protectedGapPx:16,maxCleanRunPx:384};
const cover=rects=>rects.flatMap(([x,y,w,h])=>[nativePrimitive([x,y,x+w,y,x+w,y+h],-1),nativePrimitive([x,y,x+w,y+h,x,y+h],-1)]);
const input={land,protectedRects:[],supportBounds:[],coverPrimitives:cover([...land,arm]),maxAddedCoverDistancePx:160,frame:[2304,1792],seed:20261012};
const base=constructNativeMacroShore(input,policy);
const extended=constructNativeMacroShore({...input,land:[...land,arm],seedLand:land,seedTranslation:{x:0,y:0}},policy);
const bank=(result,shift={x:0,y:0})=>{
  const index=result.originalShore.findIndex(edge=>edge.direction===3&&edge.y1===1400+shift.y);
  assert(index>=0);
  return result.trials.filter(trial=>trial.sourceEdge===index).map(({sourceEdge,startPx,rect,addedCoverage,...trial})=>({...trial,startPx:startPx-shift.x,...(rect?{rect:[rect[0]-shift.x,rect[1]-shift.y,rect[2],rect[3]]}:{}),...(addedCoverage?{addedCoverage:{...addedCoverage,worstPoint:addedCoverage.worstPoint?{x:addedCoverage.worstPoint.x-shift.x,y:addedCoverage.worstPoint.y-shift.y}:null}}:{})}));
};
assert.deepEqual(bank(extended),bank(base));
const translation={x:192,y:64},shift=([x,y,w,h])=>[x+translation.x,y+translation.y,w,h];
const shifted=constructNativeMacroShore({...input,land:[...land,arm].map(shift),coverPrimitives:cover([...land,arm].map(shift)),seedLand:land.map(shift),seedTranslation:translation},policy);
assert.deepEqual(bank(shifted,translation),bank(base));
assert.deepEqual(constructNativeMacroShore(input,policy),base);
console.log(JSON.stringify({passed:true,scope:'pure shore construction; zero fragment/terrain compiles',checks:['unchanged-bank-random-identity','global-translation-keeps-bank','legacy-no-extension-determinism']},null,2));
