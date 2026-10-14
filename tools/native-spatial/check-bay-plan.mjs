/** Raw L-B authoring counterexamples; final VOID checks are separate. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {performance} from 'node:perf_hooks';
import {mix32} from '../../src/generation/seed-fork.ts';
import {nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {nativeRectUnionArea} from '../../src/generation/world-study/native-spatial-land.ts';
import {createNativeSpatialPlanningGround,nativeSpatialRemovedLand,nativeSpatialLandJoins,createNativeSpatialBays} from '../../src/generation/world-study/native-spatial-bay-layout.ts';
import {NATIVE_SPATIAL_BAY_PROFILES} from '../../src/generated/r100-native-spatial.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'fresh report required');const cases=[];const check=(name,fn)=>{fn();cases.push({name,passed:true});};
const triangle=points=>nativePrimitive(points,1),offset={x:0,y:0};
check('bay-is-removed-from-planning-support-and-coast-distance',()=>{const ground=createNativeSpatialPlanningGround([[0,0,800,800]],[[600,300,300,120]]);assert.equal(ground.margin({x:650,y:350}),-1);assert.equal(ground.margin({x:580,y:350}),20);assert.equal(ground.contains({x:300,y:300}),true);});
check('supported-vertices-cannot-hide-a-bay-crossing-footprint',()=>{const ground=createNativeSpatialPlanningGround([[0,0,800,800]],[[500,300,400,100]]),shape=triangle([100,100,700,100,700,700]);assert(ground.contains({x:100,y:100}));assert(ground.contains({x:700,y:100}));assert(ground.contains({x:700,y:700}));assert.equal(ground.supportsFootprint([shape],offset),false);});
check('void-wholly-inside-footprint-is-detected',()=>{const ground=createNativeSpatialPlanningGround([[0,0,800,800]],[[340,340,40,40]]);assert.equal(ground.supportsFootprint([triangle([100,100,700,100,400,700])],offset),false);});
check('supported-footprint-and-zero-land-loss-are-distinct',()=>{const ground=createNativeSpatialPlanningGround([[0,0,800,800]],[[900,300,120,120]]);assert.equal(ground.supportsFootprint([triangle([100,100,400,100,100,400])],offset),true);assert.equal(nativeRectUnionArea(nativeSpatialRemovedLand([[0,0,800,800]],[[900,300,120,120]])),0);});
check('wide-joins-are-real-overlap-cores',()=>{const joins=nativeSpatialLandJoins([[0,0,800,600],[400,200,800,600]],320);assert.equal(joins.length,1);assert.deepEqual(joins[0].rect,[440,240,320,320]);});
class Stream{at=0;next(){return mix32(20261012,`bay-test-${this.at++}`)/2**32}range(a,b){return a+(b-a)*this.next()}integer(a,b){return a+Math.floor(this.next()*(b-a+1))}choose(items){return items[this.integer(0,items.length-1)]}}
const start=performance.now(),proposals=[];
for(const count of [0,1,2]){const land=[[128,128,1800,1400]],bays=createNativeSpatialBays(land,[],Array(count).fill(NATIVE_SPATIAL_BAY_PROFILES[0]),new Stream(),{width:2304,height:1792});assert.equal(bays.length,count);for(const bay of bays){const area=nativeRectUnionArea(nativeSpatialRemovedLand(land,bay.rects));assert(area>=8192&&area<=61440);}proposals.push({count,bays});}
const report={status:'passed',scope:'Authoring proposal/support only, not actual final VOID admission or Art acceptance.',cases,proposalMs:performance.now()-start,proposals};fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:cases.length,proposalMs:report.proposalMs,counts:proposals.map(p=>p.bays.length)},null,2));
