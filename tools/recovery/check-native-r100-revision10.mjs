/** Regression for r9's relief-owned shore mistaken for its distant parent. */
import assert from 'node:assert/strict';
import {SearchSitePlanner,validateSearchSites} from '../../src/generation/world-study/search-site-placement.ts';
const mesh={spec:{id:1,family:'membrane-rim',rotation:-.2},bounds:{minX:0,minY:0,maxX:120,maxY:120},
 positions:new Float32Array([10,10,0,30,10,0,10,30,0,80,80,0,110,80,0,80,110,0]),
 indices:new Uint32Array([0,1,2,3,4,5]),triangleCount:2,groundEdgeStart:{triangle:1}};
const world={algorithmRevision:10,sample:{seed:20261012},definition:{family:'membrane-rim',axis:0},
 meshes:[mesh],raster:{width:128,height:128,objectId:new Int32Array(128*128).fill(1)},
 matterAt:()=>true,roleAt:()=> 'relief',sight:{cols:16,rows:16,tileSize:8,isOpaque:()=>false}};
const policy={version:1,algorithm:'grounded-search-v1',worldId:'fixture',sourceHash:'0'.repeat(64),sourceReachPx:72,environmentScoreCap:12,peelPreference:.7,footprintProfile:'grounded-material-v1'};
const planner=new SearchSitePlanner(world,policy);
const shore=planner.placement('shore',{x:90,y:90});
assert.equal(shore.sourceDomain,'ground');assert.equal(shore.sourceObjectId,null);assert.equal(shore.sourceAnchor,null);
const body=planner.placement('body',{x:14,y:14});
assert.equal(body.sourceDomain,'formation');assert.equal(body.sourceKind,'surface-peel');assert.equal(body.sourceObjectId,1);assert.deepEqual(body.sourceAnchor,{x:14,y:14});
world.layout={kindlingNodes:[{id:'shore',position:shore.position},{id:'body',position:body.position}],contaminantNodes:[]};world.searchSites=[shore,body];validateSearchSites(world);
assert.throws(()=>validateSearchSites({...world,searchSites:[{...shore,sourceDomain:'formation',sourceKind:'surface-peel',sourceObjectId:1,sourceAnchor:shore.position,axis:body.axis},body]}),/claimed original surface/);
console.log(JSON.stringify({status:'pass',checks:['relief-owned appended shore does not imply parent provenance','real relief triangle retains formation peel','validator still rejects fictitious distant parent'],shore,body},null,2));
