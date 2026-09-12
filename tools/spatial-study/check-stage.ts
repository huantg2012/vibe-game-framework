import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPresentationFrame, type RiftPresentationEnemy, type RiftPresentationEvent } from '../../src/dev/spatial-study/stage/bridge';
import { createStageCamera, projectStagePoint } from '../../src/dev/spatial-study/stage/camera';
import { StageInsect, StagePlayer } from '../../src/dev/spatial-study/stage/actors';
import { ACTOR_HEIGHT, disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { WEAPON_ATTACK_PROFILES } from '../../src/generated/weapon-data';
import { StageSea } from '../../src/dev/spatial-study/stage/sea';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { StageVisibility } from '../../src/dev/spatial-study/stage/terrain';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';

let passed=0;
const filter=process.env.QA_CHECK_FILTER?new RegExp(process.env.QA_CHECK_FILTER):null;
function check(name:string,run:()=>void):void{if(filter&&!filter.test(name)){console.log(`SKIP ${name}`);return;}run();passed++;console.log(`PASS ${name}`);}
function near(actual:number,expected:number,tolerance=1e-6):void{assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}
const stage=new THREE.Scene();
const groundWorld=new SpatialSliceWorld(7);
const heightAt=(x:number,y:number)=>groundWorld.groundHeightAt(x,y);

check('presentation frames never share mutable run state',()=>{
  const a=createPresentationFrame(),b=createPresentationFrame();a.player.position.x=99;a.player.attack.elapsedMs=10;
  a.events.push({sequence:1,elapsedMs:2,kind:'player-hit',id:'player',source:'fixture',amount:12,
    position:{x:0,y:0},direction:{x:1,y:0}});
  assert.equal(b.player.position.x,0);assert.equal(b.player.attack.elapsedMs,0);assert.equal(b.events.length,0);
});

check('the fixed camera preserves screen WASD directions, plant height and a common projection',()=>{
  const camera=createStageCamera(992,864),base={x:0,y:0},right={x:0,y:0},up={x:0,y:0},head={x:0,y:0};
  for(const point of [{x:496,y:752},{x:784,y:592},{x:272,y:272}]){
    projectStagePoint(camera,point,base);projectStagePoint(camera,{x:point.x+10,y:point.y},right);
    projectStagePoint(camera,{x:point.x,y:point.y-10},up);projectStagePoint(camera,point,head,ACTOR_HEIGHT);
    assert.ok(right.x>base.x);near(right.y,base.y);assert.ok(up.y<base.y);near(up.x,base.x);
    near(head.x,base.x);assert.ok(head.y<base.y);
    near((base.y-up.y)/(right.x-base.x),Math.sin(35*Math.PI/180));
  }
});

check('the pixel player borrows production XY and pose and the actual shared ground elevation',()=>{
  const model=new StagePlayer();stage.add(model.root);const f=createPresentationFrame();
  f.player.hp=100;f.player.maxHp=100;f.player.weaponDefinitionId='crowbar_plain';f.player.position={x:496,y:752};
  model.setGroundSampler(heightAt);model.setGroundHeight(heightAt(496,752));
  const source=JSON.stringify(f.player);model.update(f.player,1200);assert.equal(JSON.stringify(f.player),source);
  near(model.root.position.x,496);near(model.root.position.y,heightAt(496,752));near(model.root.position.z,752);
  near(model.root.rotation.y,Math.PI/2-f.player.facing);
  const snap=model.snapshot();near(Number(snap.attackArc),.4);assert.equal(snap.hitAt,-10000);
  model.update(f.player,15000);assert.equal(model.snapshot().hitAt,-10000);near(Number(model.snapshot().attackArc),.4);
});

check('actual travel advances a planted gait, while elapsed idle time never creates a hit or swing',()=>{
  const model=new StagePlayer();stage.add(model.root);const f=createPresentationFrame();f.player.hp=100;
  model.setGroundSampler(heightAt);
  f.player.moving=true;f.player.velocity={x:0,y:-80};
  for(let i=0;i<80;i++){
    f.player.position={x:300,y:600-i*.9};model.setGroundHeight(heightAt(f.player.position.x,f.player.position.y));model.update(f.player,i*16);
    const feet=model.snapshot().feet as number[][];
    near(Math.min(...feet.map(p=>p[1]!-heightAt(p[0]!,p[2]!))),1.5);
    assert.ok(feet.every(p=>p.every(Number.isFinite)));assert.equal(model.snapshot().hitAt,-10000);
  }
});

check('actors submit authored opaque pixel drawings with nearest sampling, not a downscaled lit solid',()=>{
  const player=new StagePlayer(),bug=new StageInsect('pixels');stage.add(player.root,bug.root);
  const f=createPresentationFrame();f.player.hp=100;player.update(f.player,0);bug.update(enemy(1),0);
  for(const model of [player,bug]){
    assert.equal(model.snapshot().rendering,'authored-pixel-card');
    const pixels=model.copyPixels();let opaque=0;
    for(let i=3;i<pixels.length;i+=4){assert(pixels[i]===0||pixels[i]===255);if(pixels[i]===255)opaque++;}
    assert(opaque>100);let drawings=0;
    model.root.traverse(object=>{
      if(!object.userData.pixelDrawing)return;drawings++;
      const material=(object as THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>).material;
      assert(material.isMeshBasicMaterial);assert.equal(material.map?.magFilter,THREE.NearestFilter);
      assert.equal(material.map?.minFilter,THREE.NearestFilter);assert.equal(material.map?.generateMipmaps,false);
      assert.equal(material.depthWrite,true);assert.equal(material.alphaTest,.5);
    });
    assert.equal(drawings,1);
  }
});

check('crowbar motion follows formal phases, locked direction and contact hold instead of another animation timer',()=>{
  const model=new StagePlayer();stage.add(model.root);const f=createPresentationFrame(),profile=WEAPON_ATTACK_PROFILES.crowbar!;
  f.player.hp=100;f.player.weaponDefinitionId='crowbar_plain';f.player.facing=2;
  Object.assign(f.player.attack,{phase:'active',elapsedMs:22,contactRemainingMs:12,contactElapsedMs:15,
    windupMs:profile.windupMs,activeMs:profile.activeMs,recoveryMs:profile.recoveryMs,facing:.3});
  model.update(f.player,1000);const held=model.snapshot();model.update(f.player,8000);
  near(Number(model.snapshot().attackArc),Number(held.attackArc));
  near(model.root.rotation.y,Math.PI/2-.3);
  const half=profile.arcDeg*Math.PI/360;near(Number(held.attackArc),-half+2*half*15/profile.activeMs);
  f.player.attack.contactRemainingMs=0;f.player.attack.elapsedMs=45;model.update(f.player,8016);
  assert.ok(Number(model.snapshot().attackArc)>Number(held.attackArc));
  const tip=model.snapshot().weaponTip as number[];
  assert.ok(Math.hypot(tip[0]!-f.player.position.x,tip[2]!-f.player.position.y)<=profile.reachPx+1,
    'the physical crowbar end must not imply a second larger attack range');
});

function enemy(visibility:number):RiftPresentationEnemy{return {id:'test',substrate:'insect',coverage:'medium',position:{x:260,y:380},
  velocity:{x:0,y:0},facing:0,hp:75,visibility,state:'patrol',activity:{phase:'active',progress:0},attack:{phase:'idle',progress:0}};}
check('zero perception hides the entire enemy subtree, including potential shadow casters',()=>{
  const model=new StageInsect('test');stage.add(model.root);model.update(enemy(0),100);assert.equal(model.root.visible,false);
  let drawn=0;model.root.traverseVisible(()=>drawn++);assert.equal(drawn,0);
  model.update(enemy(.2),200);assert.equal(model.root.visible,true);
  model.update(enemy(0),250);assert.equal(model.root.visible,false);
});

check('roster removal without a real death event never creates a death animation; true death has a bounded lifetime',()=>{
  const model=new StageInsect('test');stage.add(model.root);model.update(enemy(1),100);
  model.update(undefined,200);assert.equal(model.root.visible,false);
  model.update(enemy(1),300);
  const event:RiftPresentationEvent={sequence:1,elapsedMs:350,kind:'enemy-death',id:'test',source:'player',amount:0,
    position:{x:260,y:380},direction:{x:1,y:0}};
  model.hit(event);model.update(undefined,400);assert.equal(model.root.visible,true);
  model.update(undefined,1350);assert.equal(model.root.visible,false);
});

check('a real hit drives recoil without moving the enemy gameplay origin',()=>{
  const model=new StageInsect('test');stage.add(model.root);const state=enemy(1),copy=JSON.stringify(state);
  model.update(state,100);model.hit({sequence:1,elapsedMs:100,kind:'enemy-hit',id:'test',source:'player',amount:25,
    position:{x:260,y:380},direction:{x:1,y:0}});model.update(state,130);
  near(model.root.position.x,260);near(model.root.position.z,380);assert.equal(JSON.stringify(state),copy);
  model.root.traverse(object=>assert.ok(object.position.toArray().every(Number.isFinite)));
});

check('moving water caps and rolled sides share watertight endpoints, including diagonal contour cells',()=>{
  const context={scene:{textures:{get:()=>({getSourceImage:()=>({width:2,height:2,data:new Uint8Array(16)})})}}} as unknown as RiftDevRuntimeContext;
  for(const seed of [0,7,42]){
    const world=new SpatialSliceWorld(seed),camera=createStageCamera(world.width,world.height),sea=new StageSea(context,world);
    for(const elapsed of [0,1780,5340,8360]){
      world.advance(elapsed,world.layout.spawnPoint,true,()=>false);
      sea.update(elapsed,world.layout.spawnPoint,camera);
      const {positions,normals}=sea.copyBodyGeometry(),edges=new Map<string,number>();
      const vertex=(offset:number)=>`${Math.round(positions[offset]!*1000)},${Math.round(positions[offset+1]!*1000)},${Math.round(positions[offset+2]!*1000)}`;
      assert.ok(positions.length>1000);assert.ok(positions.every(Number.isFinite));assert.ok(normals.every(Number.isFinite));
      for(let at=0;at<positions.length;at+=9){
        const points=[vertex(at),vertex(at+3),vertex(at+6)];
        for(let i=0;i<3;i++){
          const a=points[i]!,b=points[(i+1)%3]!;if(a===b)continue;
          const key=a<b?`${a}|${b}`:`${b}|${a}`;edges.set(key,(edges.get(key)??0)+1);
        }
      }
      const open=[...edges].filter(([,count])=>count!==2);
      assert.equal(open.length,0,`seed=${seed}, t=${elapsed}, unpaired edges=${open.slice(0,5).map(e=>e.join(':')).join(';')}`);
      const source=sea.snapshot(camera);assert.equal(source.sourceLineOfSight,true,`source blocked at ${seed}/${elapsed}`);
    }
    sea.destroy();disposeTree(sea.group);
  }
});

check('terrain memory records only seen samples, never raises live perception, and cannot survive a new stage',()=>{
  let region=0;
  const context={visibilityAt:(point:{x:number})=>region===0&&point.x<8?1:region===2&&point.x>=8?.6:0} as unknown as RiftDevRuntimeContext;
  const field=new StageVisibility(context,16,8);field.update(0);
  const bytes=(field.texture.image as {data:Uint8Array}).data;
  assert.deepEqual([...bytes],[255,255,255,255,0,0,255,255]);
  region=1;field.update(100);assert.deepEqual([...bytes],[0,255,255,255,0,0,255,255]);
  assert.equal(context.visibilityAt({x:4,y:4}),0);
  region=2;field.update(200);assert.deepEqual([...bytes],[0,255,255,255,153,255,255,255]);
  field.destroy();const next=new StageVisibility(context,16,8);
  assert.deepEqual([...(next.texture.image as {data:Uint8Array}).data],[0,0,255,255,0,0,255,255]);next.destroy();
});

check('visible empty space opens the sea without remembering a nonexistent floor after turning away',()=>{
  let looking=true;
  const context={visibilityAt:()=>looking?1:0} as unknown as RiftDevRuntimeContext;
  const field=new StageVisibility(context,16,8,x=>x<8);
  field.update(0);
  const pixels=(field.texture.image as {data:Uint8Array}).data;
  assert.equal(pixels[0],255);assert.equal(pixels[4],255,'authoritative sight reaches air as well as land');
  assert.equal(pixels[1],255);assert.equal(pixels[5],0,'air has no terrain memory');
  assert.equal(pixels[2],255);assert.equal(pixels[6],0,'surface membership is independent of current sight');
  assert.equal(field.snapshot().visibleAirCells,1);
  looking=false;field.update(100);
  assert.equal(pixels[0],0);assert.equal(pixels[4],0);
  assert.equal(pixels[1],255);assert.equal(pixels[5],0,'turning away remembers only real rock');
  assert.equal(context.visibilityAt({x:4,y:4}),0,'presentation never changes authoritative sight');
  field.destroy();
});

disposeTree(stage);
console.log(`Stage bridge / camera / animation: ${passed} checks passed. GPU material, actual production event wiring and playability still require the browser checks.`);
