import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StageLoot } from '../../src/dev/spatial-study/stage/loot';
import { createPresentationFrame } from '../../src/dev/spatial-study/stage/bridge';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { createLivingLandmassWorld } from '../../src/dev/living-landmass/world';
import { LivingLandmassTerrain } from '../../src/dev/living-landmass/terrain';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';

// A revealed weapon stays in place while the underlying surface changes slope.
// Its per-pixel footprint must follow, without allocating a new mesh/geometry.
let pressure=0;
const height=(x:number,y:number)=>8+pressure*(x*.031+y*.006+x*y*.0001);
const loot=new StageLoot(height,()=>true,undefined,true),frame=createPresentationFrame();
frame.groundItems.push({id:'actual-revealed-crowbar',kind:'weapon',definitionId:Object.keys(WEAPON_DATA)[0]!,position:{x:72,y:88},visibility:1});
loot.update(frame,0);
const group=loot.group.children[0]! as THREE.Group;
const mesh=group.children[0]! as THREE.Mesh<THREE.BufferGeometry>;
const geometry=mesh.geometry,position=geometry.getAttribute('position');
const zero=Array.from(position.array);
pressure=1;loot.update(frame,1000);
assert.equal(mesh.geometry,geometry,'Surface motion must preserve geometry identity');
let changed=0;
for(let i=0;i<position.count;i++){
  const actual=group.position.y+position.getY(i);
  const expected=height(group.position.x+position.getX(i),group.position.z+position.getZ(i))+.8;
  assert(Math.abs(actual-expected)<1e-5,'A revealed item pixel floats or cuts through a changed slope');
  if(Math.abs(position.getY(i)-zero[i*3+1]!)>.0001)changed++;
}
assert(changed>0,'Only moving the root would fail this sloping-ground case');
pressure=0;loot.update(frame,2000);
assert.equal(mesh.geometry,geometry);
for(let i=0;i<position.count;i++)assert(Math.abs(position.getY(i)-zero[i*3+1]!)<1e-5);
disposeTree(loot.group);
console.log('PASS revealed-item pixels follow changing support slope without rebuilding geometry');

// Inspect the actual rendered lattice, not a duplicated height formula.
const world=createLivingLandmassWorld(7);
const terrain=new LivingLandmassTerrain({visibilityAt:()=>1} as unknown as RiftDevRuntimeContext,world);
const skin=terrain.group.getObjectByName('actual-supported-fin-surface') as THREE.Mesh<THREE.BufferGeometry>;
const topology=skin.geometry.index!,vertices=skin.geometry.getAttribute('position');
const originalGeometry=skin.geometry;
for(const elapsed of [0,6400,7600,10500,12000]){
  world.prepare(elapsed);terrain.update(elapsed,false);
  assert.equal(skin.geometry,originalGeometry);
  for(let i=0;i<vertices.count;i++)assert(Math.abs(vertices.getY(i)-world.groundHeightAt(vertices.getX(i),vertices.getZ(i)))<1e-4);
  for(let i=0;i<topology.count;i+=3){
    const a=topology.getX(i),b=topology.getX(i+1),c=topology.getX(i+2);
    const x=(vertices.getX(a)+vertices.getX(b)+vertices.getX(c))/3,z=(vertices.getZ(a)+vertices.getZ(b)+vertices.getZ(c))/3;
    assert(world.isFloor(x,z),'Visible supported skin cannot bridge the cavity');
    const rendered=(vertices.getY(a)+vertices.getY(b)+vertices.getY(c))/3;
    assert(Math.abs(rendered-world.groundHeightAt(x,z))<1e-4,'Rendered triangle and sampled support disagree');
  }
}
terrain.destroy();disposeTree(terrain.group);world.tension.destroy();
console.log('PASS actual dynamic terrain triangles match support and never cover the cavity');
