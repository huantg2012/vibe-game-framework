import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GroundHeightField } from '../../src/dev/spatial-study/stage/ground-height';
import { createStageGroundGeometry } from '../../src/dev/spatial-study/stage/ground-mesh';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { StagePlayer, StageInsect } from '../../src/dev/spatial-study/stage/actors';
import { StageLoot } from '../../src/dev/spatial-study/stage/loot';
import { createPresentationFrame, type RiftPresentationEnemy } from '../../src/dev/spatial-study/stage/bridge';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { TileType } from '../../src/types/game-types';

let passed = 0, failed = 0;
function check(name: string, run: () => void): void {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (e) { failed++; console.error(`FAIL ${name}\n${String(e)}`); }
}
function near(a: number, b: number, tolerance = 1e-4): void { assert(Math.abs(a - b) <= tolerance, `${a} != ${b}`); }
const world = new SpatialSliceWorld(7), floor = (x: number, y: number) => world.groundHeightAt(x, y);

check('shared ground height and normal match the actual indexed mesh triangles, not a second interpolation', () => {
  const before = JSON.stringify(world.layout.tileMap), geometry = createStageGroundGeometry(world);
  const positions = geometry.surface.getAttribute('position'), index = geometry.surface.getIndex()!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), point = new THREE.Vector3();
  const triangle = new THREE.Triangle(a,b,c), normal = new THREE.Vector3();
  let faces = 0;
  try {
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(positions,index.getX(i)); b.fromBufferAttribute(positions,index.getX(i+1)); c.fromBufferAttribute(positions,index.getX(i+2));
      triangle.getNormal(normal); assert(normal.y > 0);
      for (const weights of [[1/3,1/3,1/3],[.17,.29,.54]]) {
        point.copy(a).multiplyScalar(weights[0]!).addScaledVector(b,weights[1]!).addScaledVector(c,weights[2]!);
        near(floor(point.x,point.z),point.y);
        const actual = world.ground.normalAt(point.x,point.z,{x:0,y:0,z:0});
        near(actual.x,normal.x); near(actual.y,normal.y); near(actual.z,normal.z);
        assert.notEqual(world.layout.tileMap.tiles[Math.floor(point.z/32)]![Math.floor(point.x/32)],TileType.VOID);
      }
      faces++;
    }
    const supportCells = world.layout.tileMap.tiles.flat().filter(tile => tile !== TileType.VOID).length;
    assert.equal(faces,supportCells*32); // 16 eight-pixel quads / authored tile, two mesh faces each.
    assert.equal(JSON.stringify(world.layout.tileMap),before);
    console.log(`MEASURE checked ${faces} real mesh faces and ${faces*2} off-grid support samples.`);
  } finally { geometry.surface.dispose(); geometry.edge.dispose(); }
});
check('all actual cliff-top vertices join the same surface and never create a disconnected flat skirt', () => {
  const geometry = createStageGroundGeometry(world), p = geometry.edge.getAttribute('position'), drop = geometry.edge.getAttribute('stageDrop');
  let joined = 0;
  try {
    for (let i=0;i<p.count;i++) {
      assert([p.getX(i),p.getY(i),p.getZ(i),drop.getX(i)].every(Number.isFinite));
      if (drop.getX(i)===0) { near(p.getY(i),floor(p.getX(i),p.getZ(i))); joined++; }
    }
    assert(joined>100);
  } finally { geometry.surface.dispose(); geometry.edge.dispose(); }
});
check('the surface is continuous at mesh seams; exported samples and outside-edge queries cannot mutate it', () => {
  const old = floor(256,512), copy = world.ground.copyHeights(); copy.fill(999); assert.equal(floor(256,512),old);
  for (let y=8;y<world.height;y+=32) for(let x=8;x<world.width;x+=32) {
    near(floor(x-1e-5,y+2.1),floor(x+1e-5,y+2.1));
    near(floor(x+2.1,y-1e-5),floor(x+2.1,y+1e-5));
    near(floor(x+3,y+5-1e-5),floor(x+3,y+5+1e-5));
  }
  near(floor(-10,400),floor(0,400)); near(floor(world.width+10,400),floor(world.width,400));
  near(floor(400,-10),floor(400,0)); near(floor(400,world.height+10),floor(400,world.height));
  for (const width of [0,31,NaN]) assert.throws(()=>new GroundHeightField(width,32,[]));
  assert.throws(()=>new GroundHeightField(32,32,[{id:'bad',kind:'ridge',x:16,y:16,radiusX:0,radiusY:5,angle:0,height:1}]));
});
check('player pixel feet follow their own slope samples while XY, support height and production pose remain authoritative', () => {
  const model = new StagePlayer(), f = createPresentationFrame(); f.player.hp=100; f.player.maxHp=100; f.player.weaponDefinitionId='crowbar_plain';
  model.setGroundSampler(floor);
  try {
    for(let i=0;i<90;i++) {
      f.player.position={x:220+i*.8,y:520+i*.23}; f.player.velocity={x:80,y:23}; f.player.moving=true; f.player.facing=.28;
      model.setGroundHeight(floor(f.player.position.x,f.player.position.y)); const before=JSON.stringify(f.player); model.update(f.player,i*16);
      assert.equal(JSON.stringify(f.player),before); near(model.root.position.x,f.player.position.x); near(model.root.position.z,f.player.position.y); near(model.root.position.y,floor(f.player.position.x,f.player.position.y));
      const feet=model.snapshot().feet as number[][], clearances=feet.map(p=>p[1]!-floor(p[0]!,p[2]!));
      near(Math.min(...clearances),1.5); assert(clearances.every(gap=>gap>=1.5-1e-5&&gap<=4.5+1e-5));
    }
    const pixels=model.copyPixels(), original=model.copyPixels(); assert(pixels.some(v=>v!==0)); pixels.fill(0); assert.deepEqual(model.copyPixels(),original);
    assert.equal(model.snapshot().rendering,'authored-pixel-card');
  } finally { disposeTree(model.root); }
});
check('enemy pixel contacts sample local relief; perception zero still hides the entire model on raised ground', () => {
  const model = new StageInsect('slope'), state:RiftPresentationEnemy={id:'slope',substrate:'insect',coverage:'medium',position:{x:780,y:380},velocity:{x:65,y:0},
    facing:0,hp:75,visibility:1,state:'patrol',activity:{phase:'active',progress:0},attack:{phase:'idle',progress:0}};
  model.setGroundSampler(floor);
  try {
    for(let i=0;i<50;i++) {
      state.position.x=760+i*.7; model.setGroundHeight(floor(state.position.x,state.position.y)); const before=JSON.stringify(state); model.update(state,i*16);
      assert.equal(JSON.stringify(state),before); near(model.root.position.y,floor(state.position.x,state.position.y));
      const feet=model.snapshot().feet as number[][]; assert(feet.length>=4);
      for(const p of feet) assert(p.every(Number.isFinite)&&p[1]!>=floor(p[0]!,p[2]!)-1e-4,'Enemy contact cannot penetrate the visual surface');
    }
    state.visibility=0;model.update(state,1000);assert(!model.root.visible);let rendered=0;model.root.traverseVisible(()=>rendered++);assert.equal(rendered,0);
  } finally { disposeTree(model.root); }
});
check('loot support uses the same height field without altering pickup locations or revealing hidden items', () => {
  const model=new StageLoot(floor), f=createPresentationFrame();
  f.piles.push({id:'pile',position:{x:272,y:272},collected:false,visibility:1,searching:false,targeted:false,progress:0});
  f.groundItems.push({id:'item',kind:'weapon',definitionId:'crowbar_plain',position:{x:784,y:464},visibility:1});
  try {
    const before=JSON.stringify(f); model.update(f,500);assert.equal(JSON.stringify(f),before);
    const s=model.snapshot() as {piles:{position:number[]}[];items:{position:number[];visible:boolean}[]};
    near(s.piles[0]!.position[1]!,floor(272,272));near(s.items[0]!.position[1]!,floor(784,464));
    f.groundItems[0]!.visibility=0;model.update(f,550);assert(!(model.snapshot() as typeof s).items[0]!.visible);
    f.groundItems.length=0;model.update(f,600);assert(!(model.snapshot() as typeof s).items[0]!.visible);
  } finally { disposeTree(model.group); }
});
console.log(`${passed} ground/attachment checks passed; ${failed} failed. Screen-space apparent contact and pixel art quality remain live visual checks.`);
if(failed)process.exitCode=1;
