import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { resolvePlayerMovementInput } from '../../src/entities/player-movement-input';
import { MasterPatrol, createMasterPatrolRoute } from '../../src/dev/rift-r100-masters/patrol';
import { createMasterWorld } from '../../src/dev/rift-r100-masters/world';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyHasSupport,bodyDisplacementFraction } from '../../src/systems/ai/physical-grid';
const output={x:0,y:0},position={x:4,y:4},keyboard={x:1,y:1};
const frame={position,keyboard,keyboardActive:true,deltaMs:1000/60};
resolvePlayerMovementInput(frame,undefined,true,output);
assert.equal(output.x,Math.SQRT1_2);assert.equal(output.y,Math.SQRT1_2);
let calls=0;const reader=()=>{calls++;return{x:10,y:0};};
resolvePlayerMovementInput(frame,reader,false,output);assert.deepEqual(output,{x:0,y:0});assert.equal(calls,0,'frozen Player never consults external inputs');
resolvePlayerMovementInput(frame,reader,true,output);assert.equal(output.x,Math.SQRT1_2,'keyboard remains authoritative');
frame.keyboardActive=false;keyboard.x=0;keyboard.y=0;resolvePlayerMovementInput(frame,reader,true,output);assert.deepEqual(output,{x:1,y:0});
resolvePlayerMovementInput(frame,()=>({x:Infinity,y:0}),true,output);assert.deepEqual(output,{x:0,y:0});
resolvePlayerMovementInput(frame,undefined,true,output);assert.deepEqual(output,{x:0,y:0},'cleared callback returns to keyboard');
const patrol=new MasterPatrol(),route={points:[{x:4,y:4},{x:84,y:4}],stations:[],distance:80};
patrol.start(route,position);let velocity=0;
for(let i=0;i<300&&patrol.active;i++){
  resolvePlayerMovementInput(frame,patrol.readInput,true,output);
  const speed=GAME_CONSTANTS.PLAYER.SPEED,target=output.x*speed;
  const ramp=output.x===0?GAME_CONSTANTS.PLAYER.MOVE_DECEL_TIME:GAME_CONSTANTS.PLAYER.MOVE_ACCEL_TIME;
  const step=speed/ramp/60;velocity+=Math.sign(target-velocity)*Math.min(Math.abs(target-velocity),step);position.x+=velocity/60;
}
assert.equal(patrol.active,false,'input-controller simulation completes using native movement constants');assert(position.x>80&&position.x<88);
patrol.start(route,{x:4,y:4});frame.keyboardActive=true;patrol.readInput(frame);assert.equal(patrol.active,false,'real input cancels tour');frame.keyboardActive=false;
patrol.start(route,position);patrol.stop('暂停');assert.equal(patrol.readInput(frame),null,'paused tour no longer feeds directions');
position.x=4;patrol.start(route,position);for(let i=0;i<180;i++)patrol.readInput(frame);assert.equal(patrol.active,false,'blocked tour exits');
const results=[];
for(const definition of MASTER_SCENES.filter(value=>value.family==='folded-slab')){
  const world=createMasterWorld(definition,definition.seed),grid=new TileGrid(world.layout.tileMap),path=createMasterPatrolRoute(world,world.layout.spawnPoint);
  assert.equal(path.stations.length,5);
  for(let i=0;i<path.points.length;i++){
    const point=path.points[i]!;assert(bodyHasSupport(grid,point,10,10));if(i){const prev=path.points[i-1]!;assert.equal(bodyDisplacementFraction(grid,prev,10,10,point.x-prev.x,point.y-prev.y),1);}
  }
  results.push({id:definition.id,distance:path.distance,points:path.points.length,stations:path.stations});
}
console.log(JSON.stringify({status:'pass',checks:['native-keyboard-default','diagonal-normalization','external-normalization','keyboard-priority','freeze','invalid-intent','callback-clear','route-follow','manual-cancel','pause-stop','blocked-exit','3-folded-body-safe-routes'],results},null,2));
