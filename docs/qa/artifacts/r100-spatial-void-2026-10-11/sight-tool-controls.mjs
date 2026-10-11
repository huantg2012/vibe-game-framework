import assert from 'node:assert/strict';
import { measureSightObstructions } from '../../../../tools/spatial-rollout/sight-obstruction.mjs';
import { TileType } from '../../../../src/types/game-types.ts';
const width=1280,height=768,cols=width/8,rows=height/8;
function fixture(type){
 const polygons=[300,650,1000].map(x=>[{x,y:240},{x:x+64,y:240},{x:x+64,y:488},{x,y:488}]);
 const tiles=Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>polygons.some(p=>(col+.5)*8>=p[0].x&&(col+.5)*8<p[1].x&&(row+.5)*8>=240&&(row+.5)*8<488)?type:TileType.FLOOR));
 const tileMap={cols,rows,tileSize:8,tiles};
 return {layout:{tileMap,spawnPoint:{x:100,y:100},seed:1},native:{definition:{instances:[],erosion:polygons},meshes:[],raster:{width,height,objectId:new Uint16Array(width*height)},hostTileMap:{tileSize:32},diagnostics:{geometryFingerprint:'synthetic'}},metadata:{attempt:0}};
}
const recipe={package:{id:'synthetic-control',grade:'medium',algorithmRevision:7},requestedSeed:1};
for(const type of [TileType.FLOOR,TileType.WALL,TileType.VOID]){
 const r=measureSightObstructions(fixture(type),recipe);
 assert.equal(r.status,type===TileType.VOID?'passed':'failed');
 assert.equal(r.witnessCount,type===TileType.VOID?3:0);
 console.log(JSON.stringify({type,status:r.status,witnesses:r.witnessCount,displacements:r.witnesses.map(w=>w.revealDisplacement)}));
}
