import assert from 'node:assert/strict';
import {createNativeAutoConnectivity,createNativeAutoTraversalTemplate} from '../../src/generation/world-study/native-auto-traversal.ts';
import {nativePrimitive,NATIVE_SPATIAL_DIRECTIONS} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {createNativeBodyPrimitiveProbe} from '../../src/generation/world-study/native-body-collision.ts';
const shape=[[0,0],[38,8],[12,57]],primitives=[nativePrimitive(shape.flat(),1)];
const template=createNativeAutoTraversalTemplate(primitives),probe=createNativeBodyPrimitiveProbe([shape.map(([x,y])=>({x,y}))]);
let checked=0;
for(let y=-36;y<100;y+=8)for(let x=-36;x<100;x+=8){
  assert.equal(template.supported(x,y),probe.supports({x,y}));
  if(template.supported(x,y))for(let direction=0;direction<8;direction++){
    const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[direction];
    assert.equal(Boolean(template.links(x,y)&(1<<direction)),probe.displacementFraction({x,y},dx*8,dy*8)>=1-1e-9);
  }checked++;
}
const points=[];for(let gy=0;gy<7;gy++)for(let gx=0;gx<7;gx++)points.push({gx,gy});
const connected=createNativeAutoConnectivity(points,{x:4,y:4}),available=new Uint8Array(49).fill(1),links=new Uint8Array(49).fill(255);
assert(connected(available,links));
for(let y=0;y<7;y++)available[y*7+3]=0;
assert(!connected(available,links),'A cut separating two supported domains must be rejected');
available[6*7+3]=1;assert(connected(available,links),'One swept passage restores full connectivity');
available.fill(1);links.fill(0);assert(!connected(available,links),'Cell adjacency cannot replace exact swept links');
links.fill(255);available[0]=0;assert(!connected(available,links),'The reserved spawn must remain supported');
console.log(JSON.stringify({status:'passed',templateCenters:checked,connectivityCases:5,scope:'translated live SAT masks and constructive connectedness; no game'}));
