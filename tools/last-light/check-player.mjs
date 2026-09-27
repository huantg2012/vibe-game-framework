import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Exercise the shared Player with a minimal rendering host. Rendering is replaced
// only at the boundary: production movement/input/freeze logic remains real.
const state = { constructs: [], destroyed: [] };
globalThis.__lastLightPlayerTest = state;
const result = await build({ entryPoints:['src/entities/player.ts'], bundle:true, platform:'node', format:'esm', write:false,
  plugins:[{name:'headless-player-host', setup(b) {
    b.onResolve({filter:/^phaser$/},()=>({path:'phaser',namespace:'test-host'}));
    b.onLoad({filter:/.*/,namespace:'test-host'},()=>({contents:`
      class Vector2 { constructor(x=0,y=0){this.x=x;this.y=y} set(x,y){this.x=x;this.y=y;return this} }
      class Rectangle { constructor(x=0,y=0,w=0,h=0){this.setTo(x,y,w,h)} setTo(x,y,w,h){Object.assign(this,{x,y,width:w,height:h});return this} }
      export default {Math:{Vector2,Linear:(a,b,t)=>a+(b-a)*t,Clamp:(x,a,b)=>Math.max(a,Math.min(b,x))},Geom:{Rectangle},Input:{Keyboard:{KeyCodes:{W:87,UP:38,S:83,DOWN:40,A:65,LEFT:37,D:68,RIGHT:39}}}};
    `,loader:'js'}));
    b.onLoad({filter:/\/(player-weapon-rig|actor-motion|player-lamp-aura)\.ts$/},args=>{
      const kind=args.path.includes('weapon-rig')?'PlayerWeaponRig':args.path.includes('actor-motion')?'FacingLagGhost':'PlayerLampAura';
      return {contents:`export class ${kind} {constructor(){globalThis.__lastLightPlayerTest.constructs.push('${kind}')} isTurning=false; equip(){} sync(){} trigger(){} setDepth(){} setGroundDepth(){} getTorsoOffset(){return {x:0,y:0}} destroy(){globalThis.__lastLightPlayerTest.destroyed.push('${kind}')}} export const pingPongFrame=()=>0;`,loader:'js'};
    });
    b.onLoad({filter:/\/player-sprite-dense\.ts$/},()=>({contents:`export const DENSE_PLAYER_GROUND_OFFSET_Y=10,DENSE_PLAYER_LAMP_LOCAL={left:{x:0,y:0},right:{x:0,y:0},up:{x:0,y:0},down:{x:0,y:0}};export const densePlayerMotionTexture=()=> 'actor';`,loader:'js'}));
  }}] });
const work=await mkdtemp(join(tmpdir(),'coh-last-light-player-'));
const bundle=join(work,'player.mjs');await writeFile(bundle,result.outputFiles[0].text);
const {Player}=await import(pathToFileURL(bundle).href);
function host(){
  const keys=new Map();
  const body={velocity:{x:0,y:0},position:{x:0,y:0},setSize(){},setOffset(){},setCollideWorldBounds(){},stop(){this.velocity.x=this.velocity.y=0},reset(x,y){image.x=x;image.y=y},setVelocity(x,y){this.velocity.x=x;this.velocity.y=y}};
  const image={x:0,y:0,visible:true,body,texture:{key:'actor'},setDepth(){return this},setVisible(v){this.visible=v;return this},setTexture(){return this},setRotation(){return this},setPosition(x,y){this.x=x;this.y=y;return this},setVelocity(x,y){body.setVelocity(x,y);return this},destroy(){this.destroyed=true}};
  const scene={physics:{add:{image(x,y){image.x=x;image.y=y;return image}}},input:{keyboard:{addKey(code){const key={keyCode:code,isDown:false};keys.set(code,key);return key},removeKey(key){keys.delete(key.keyCode)}}},textures:{exists(){return true}}};
  return {scene,image,keys};
}
const p=new Player(), h=host();
p.create(h.scene,{spawn:{x:100,y:100},movementMode:'constrained',externalPresentation:true});
assert.equal(h.image.visible,false); assert.equal(h.image.body.moves,false); assert.equal(state.constructs.length,0);
h.keys.get(68).isDown=true; p.update(16); assert.deepEqual({...p.getMovementInput()},{x:1,y:0});
p.applyConstrainedMovement(108,100);p.postUpdate();assert.equal(p.getPosition().x,108);assert.equal(h.image.visible,false);
p.setInputEnabled(false);p.update(16);p.applyConstrainedMovement(130,100);assert.equal(p.getPosition().x,108);assert.deepEqual({...p.getMovementInput()},{x:0,y:0});
p.setWeaponVisual(null);p.setGroundDepth(20,1);p.destroy();assert.equal(h.keys.size,0);assert.equal(state.destroyed.length,0);
// A normal Rift player still constructs the established visual pipeline; reuse
// after shutdown must not touch disposed hub-only resources.
const r=host();p.create(r.scene,{spawn:{x:40,y:40}});assert.equal(r.image.body.moves,true);assert.equal(r.image.visible,true);
assert.deepEqual(state.constructs.sort(),['FacingLagGhost','PlayerLampAura','PlayerWeaponRig']);p.destroy();assert.equal(state.destroyed.length,3);
const again=host();p.create(again.scene,{spawn:{x:90,y:90},movementMode:'constrained',externalPresentation:true});p.setWeaponVisual(null);p.destroy();assert.equal(state.destroyed.length,3);
delete globalThis.__lastLightPlayerTest;
await rm(work,{recursive:true,force:true});
console.log('PASS shared Player: external visual ownership, input/freeze, shutdown/reentry, default Rift presentation');
