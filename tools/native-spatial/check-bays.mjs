/** Final B contracts over analytic 8px terrain masks; no search or tuning. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialBays} from '../../src/generation/world-study/native-spatial-bay-measure.ts';
import {NATIVE_SPATIAL_POLICY as policy,NATIVE_SPATIAL_BAY_PROFILES as profiles} from '../../src/generated/r100-native-spatial.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
let land=[[128,128,768,512]],rect=([x,y,w,h])=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],cases=[];
const bay=(id='b',y=256,h=128,x=64,w=256)=>({bayId:id,profileId:profiles[0].id,rects:[[x,y,w,h]],sourceShore:{points:[{x:128,y},{x:128,y:y+h}],outward:{x:-1,y:0}}});
function run(id,bays,cuts,check,extra={}){
 const cols=256,rows=256,inside=(rects,x,y)=>rects.some(([a,b,w,h])=>x>=a&&x<a+w&&y>=b&&y<b+h),matter=Uint8Array.from({length:cols*rows},(_,cell)=>Number(inside(land,(cell%cols+.5)*8,(Math.floor(cell/cols)+.5)*8)&&!inside(cuts,(cell%cols+.5)*8,(Math.floor(cell/cols)+.5)*8))),supportedCount=matter.reduce((a,b)=>a+b,0);
 const geometry={terrain:{cols,rows,matter,definition:{instances:[],erosion:[],terrainOutline:rect(land[0])},meshes:[]},solidPrimitives:[],supported:matter,reachable:matter,links8:new Uint8Array(cols*rows).fill(15),supportedCount,reachableCount:supportedCount,solidDistance:()=>Infinity,voidDistance:()=>Infinity},groups=identifyNativeSpatialStructures(geometry,[],policy),authoring={landRects:land,placements:bays,landJoins:[],profiles,allowedCounts:[0,1,2],minWideJoinPx:320,...extra},gate=evaluateNativeSpatialBays(geometry,groups,authoring);
 try{check(gate,geometry,groups,authoring);cases.push({id,passed:true,gate});}catch(error){cases.push({id,passed:false,error:error.message,gate});}console.log(JSON.stringify({id,passed:cases.at(-1).passed,reasons:gate.reasons}));
}
run('valid-thick-bay-cost-and-actual-ocean-route',[bay()],bay().rects,gate=>{assert(gate.accepted);assert.equal(gate.metrics.bayMeasurements[0].removedLandAreaPx2,192*128);assert.equal(gate.metrics.bayMeasurements[0].throatSquarePx,64);});
run('sealed-pocket-is-not-renamed-hole',[bay()],[[160,256,160,128]],gate=>{assert(gate.reasons.includes('bay-sealed'));assert(gate.reasons.includes('bay-mouth-too-thin'));});
run('eight-pixel-mouth-is-not-sixty-four',[bay()],[[160,256,160,128],[64,312,104,8]],gate=>{assert(gate.reasons.includes('bay-mouth-too-thin'));});
const upper=bay('a',176,96),lower=bay('b',448,96);
run('two-bays-share-ocean-but-not-positive-land',[upper,lower],[...upper.rects,...lower.rects],gate=>assert(gate.accepted));
const overlapping=bay('b',320,128);
run('two-bays-merged-inside-positive-land',[bay('a'),overlapping],[...bay('a').rects,...overlapping.rects],gate=>assert(gate.reasons.includes('bay-merged-inside-positive-land')));
const sea=bay('sea',256,128,32,64);
run('sea-only-cut-has-no-land-cost',[sea],sea.rects,gate=>{assert(gate.reasons.includes('bay-no-real-land-loss'));assert(gate.reasons.includes('bay-no-final-land-loss'));});
run('bay-cannot-cut-protected-wide-join',[bay()],bay().rects,gate=>assert(gate.reasons.includes('bay-cut-wide-join')),{landRects:[land[0],land[0]],landJoins:[{parentIndex:0,childIndex:1,rect:[128,160,320,320]}]});
const deep=bay('deep',256,96,64,544);
run('thin-backland-is-rejected',[deep],deep.rects,gate=>assert(gate.reasons.includes('bay-insufficient-backland')));
run('bay-is-excluded-from-HS-and-G1-credit',[bay()],bay().rects,(gate,g,groups,authoring)=>{assert(gate.accepted);const full=evaluateNativeSpatialGeometry(g,groups,policy,{targetWalkAreaPx2:g.supportedCount*64},undefined,authoring);assert.equal(full.metrics.holes,0);assert.equal(full.metrics.solids,0);assert(full.reasons.includes('G1-largest-empty-radius'));});
const reversed={...bay(),sourceShore:{...bay().sourceShore,outward:{x:1,y:0}}};
run('reversed-source-normal-is-invalid',[reversed],bay().rects,gate=>assert(gate.reasons.includes('bay-no-source-shore')));

// A remote natural eroded rim joins the global positive-land VOID labels, but
// the two local B influence envelopes do not touch and must remain independent.
land=[[128,128,1408,1536]];
const distantA=bay('far-a',256,128),distantB=bay('far-b',1408,128);
run('distant-bays-cannot-merge-through-remote-natural-eroded-rim',[distantA,distantB],[...distantA.rects,...distantB.rects,[128,128,8,1536]],gate=>assert(gate.accepted));

const sources=['tools/native-spatial/check-bays.mjs','src/generation/world-study/native-spatial-bay-measure.ts','src/generation/world-study/native-spatial-measure.ts'];
const report={status:cases.every(c=>c.passed)?'passed':'failed',createdAt:new Date().toISOString(),sourceHashes:Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),cases,scope:'Analytic 8px fixtures: final B identity, exact positive-land cost, 64px continuous square sweep, wide join/backland protection and no H/S coverage credit. No whole-map admission.'};fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
