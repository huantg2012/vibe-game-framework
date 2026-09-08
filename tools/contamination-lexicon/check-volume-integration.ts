/** I18 R4: production Host ↔ presence ↔ renderer contract, not a second simulator.
 * Run: tsx --tsconfig tools/contam-preview/tsconfig.json tools/contamination-lexicon/check-volume-integration.ts
 * Only Phaser drawing and damage sinks are adapted; state, placement, masks,
 * attack resolution and animation come from production modules.
 */
import assert from 'node:assert/strict';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system';
import { attachDingD } from '../../src/entities/form-renderers/d/ding';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import type { FormVisualPose } from '../../src/entities/form-renderers/form-renderer';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { findTerrainSafeVolumeSeat } from '../../src/generation/terrain-safe-volume-seat';
import { createVolumePresenceFrame, updateVolumePresenceFrame, volumeTimeAtPhase, getVolumeProfile,
  sampleVolumeDensity, isVolumeDangerousAt, type VolumePhase } from '../../src/systems/volume-presence';

type Point = {x:number;y:number};
function fixture(legal=(col:number,row:number)=>col>=1&&col<=10&&row>=1&&row<=10) {
  const objects=new Set<Draw>();
  const textures=new Map<string,{w:number;h:number;data:Uint8ClampedArray;refreshes:number}>();
  class Draw {
    key='';depth=0;alpha=1;visible=true;x=0;y=0;rects: {x:number;y:number;w:number;h:number}[]=[];
    constructor(){objects.add(this);}
    setDepth(n:number){this.depth=n;return this;}setOrigin(){return this;}setRotation(){return this;}
    setVisible(v:boolean){this.visible=v;return this;}setAlpha(v:number){this.alpha=v;return this;}
    setPosition(x:number,y:number){this.x=x;this.y=y;return this;}fillStyle(){return this;}
    lineStyle(){return this;}strokeRect(){return this;}clear(){this.rects=[];return this;}
    fillRect(x:number,y:number,w:number,h:number){this.rects.push({x,y,w,h});return this;}
    destroy(){objects.delete(this);}
  }
  let chaos=0;let swing=false;let angle=0;
  const host=new ContaminationHostSystem();
  const player={x:208,y:208};
  const scene={hosts:host,add:{image:(_x:number,_y:number,key:string)=>{const o=new Draw();o.key=key;return o;},graphics:()=>new Draw()},
    textures:{exists:(key:string)=>textures.has(key),remove:(key:string)=>textures.delete(key),createCanvas(key:string,w:number,h:number){
      const row={w,h,data:new Uint8ClampedArray(w*h*4),refreshes:0};textures.set(key,row);return {setFilter(){},refresh(){row.refreshes++;},
        getContext(){return {createImageData(){return {data:new Uint8ClampedArray(w*h*4)};},putImageData(p:{data:Uint8ClampedArray}){row.data=p.data.slice();}};}}}},
    cameras:{main:{midPoint:player}}};
  const grid={cols:12,rows:12,tileSize:32,version:0,isWalkable:legal,isOpaque:(col:number,row:number)=>!legal(col,row)};
  host.bindPractice(scene as never,{wallEdges:[],paintFloors:[],corridorAabbs:[{minCol:4,minRow:4,maxCol:8,maxRow:8,coreCol:6,coreRow:6}]} as never,
    {getAttackState:()=>({phase:swing?'active':'idle'}),getLockedAttackAngle:()=>angle,applyHazardHit(){throw new Error('volume cannot hit HP');}} as never,
    {addChaos(source:string,amount:number){assert.equal(source,'volume_field');chaos+=amount;}} as never,()=>1,{liveMotion:true,occluders:grid});
  host.setSkipPaint(true);
  const spawn=(form:ContaminationForm)=>{const id=host.spawnForm(form);assert(id,'valid volume must spawn');return id;};
  const draw=(form:ContaminationForm,id:string,namespace?:string)=>attachDingD({scene:scene as never,form,seed:7,depth:40,subjectId:id,
    textureNamespace:namespace,pin:host.getVisualPin(id)!,isWalkableFloor:legal,stainWorldPoint:player});
  const pose=(id:string,dt:number):FormVisualPose=>{
    const p=host.getVisualPin(id)!;
    return {x:p.x+(p.width??0)/2,y:p.y+(p.height??0)/2,facing4:'down',moving:host.getVisualMoving(id),visibility:1,
      signal:host.getVisualSignal(id),activity:host.getActivityVisualState(id),deltaMs:dt};
  };
  const step=(ms:number,p:Point=player,facing=0)=>{Object.assign(player,p);host.update(ms,player,false,facing);};
  return {host,scene,spawn,draw,pose,step,player,objects,textures,grid,legal,
    chaos:()=>chaos,swing:(v:boolean,a=0)=>{swing=v;angle=a;}};
}

const formOf=(substrate:string,continuity:'monolith'|'field'='monolith',sense='sense_domain',rhythm='rhythm_open'):ContaminationForm=>({
  substrate,occupancy:'volume',portfolio:'ding',continuity,coverage:'rewrite',
  lexemes:{motion:'motion_anchor',sense,rhythm,contact:'contact_volume_chaos'},
});

const families=['gas_mass','mist_bank','dust_swarm'] as const;
let masks=0;
const boundaryJumps: {family:string;phase:string;jump:number}[]=[];
for(const family of families)for(const phase of ['rest','gather','release','disperse'] as VolumePhase[]){
  const time=volumeTimeAtPhase(family,phase);
  const sample=(elapsedMs:number)=>updateVolumePresenceFrame(createVolumePresenceFrame(),{substrate:family,coverage:'rewrite',elapsedMs,rect:{x:0,y:0,w:160,h:160},active:true});
  const a=sample(time-1),b=sample(time+1);
  const jump=Math.max(...a.parts.slice(0,a.partCount).map((p,i)=>{
    const q=b.parts[i]!;return Math.hypot(p.cx-q.cx,p.cy-q.cy)+Math.abs(p.rx-q.rx)+Math.abs(p.ry-q.ry);
  }));
  boundaryJumps.push({family,phase,jump});
}
console.log('phase boundary displacement (2ms):',JSON.stringify(boundaryJumps));
assert(boundaryJumps.every(row=>row.jump<1),'phase boundaries cannot teleport model parts by ≥1px in 2ms');
// Geometry coverage is intentionally independent from visual pollution tier.
// The mist window is a physical traversable gap, including the player's body.
for(const family of families)for(const phase of ['rest','gather','release','disperse'] as VolumePhase[])
for(const progress of [0,.5,.999]){
  const input={substrate:family,coverage:'infiltrate',elapsedMs:volumeTimeAtPhase(family,phase,progress),
    rect:{x:128,y:128,w:160,h:160},active:true,isWalkableFloor:(col:number,row:number)=>col!==4&&row!==4};
  const f=updateVolumePresenceFrame(createVolumePresenceFrame(),input);
  assert.equal(f.phase,phase);assert.equal(f.hazardActive,phase==='release','new substrates only charge during release');
  assert(Math.abs(f.progress-progress)<.00001,'phase seek maps exact normalized time');
  let positive=0;
  const coverage=updateVolumePresenceFrame(createVolumePresenceFrame(),{...input,coverage:'overwrite'});
  for(let y=120;y<296;y+=2)for(let x=120;x<296;x+=2){
    const d=sampleVolumeDensity(f,x+.5,y+.5);
    assert(Number.isFinite(d)&&d>=0&&d<=1);
    assert.equal(d,sampleVolumeDensity(coverage,x+.5,y+.5),'tier does not silently alter invisible collision');
    if(x<128||y<128||x>=288||y>=288||Math.floor(x/32)===4||Math.floor(y/32)===4)assert.equal(d,0,'outside box/wall/VOID cannot carry presence');
    if(d>0)positive++;
  }
  assert(positive>0,'terrain fixture must retain real material, not trivially clear everything');
  if(family==='mist_bank')for(let x=128;x<288;x++)for(const dy of [-9,0,9])
    assert.equal(sampleVolumeDensity(f,x,208+dy),0,'20px player fits in the 24px mist window');
  f.active=false;f.hazardActive=false;
  for(let i=0;i<f.partCount;i++)assert.equal(isVolumeDangerousAt(f,f.parts[i]!.cx,f.parts[i]!.cy),false,'closed activity cannot charge');
  masks++;
}
let killed=0,damaged=0;
const onKill=()=>{killed++;},onDamage=()=>{damaged++;};
eventBus.on(GameEvent.ENEMY_KILLED,onKill);eventBus.on(GameEvent.ENEMY_DAMAGED,onDamage);
// Damage is actual Host combat resolution, including swing latch and 50 HP.
for(const family of families)for(const continuity of ['monolith','field'] as const){
  const f=fixture(),form=formOf(family,continuity),id=f.spawn(form);
  f.step(0);
  const core=f.host.getSubjects()[0]!.position;
  const p={x:core.x-12,y:core.y};
  const before={killed,damaged};
  f.swing(true);f.step(0,p);f.step(0,p);
  assert.equal(damaged-before.damaged,continuity==='monolith'?1:0,'one committed swing cannot hit the same core twice');
  assert.equal(f.host.getSubjects().length,1,'first 25 damage cannot kill a 50 HP core');
  f.swing(false);f.step(0,p);f.swing(true);f.step(0,p);
  assert.equal(killed-before.killed,continuity==='monolith'?1:0,'field never pretends to die; monolith dies on second swing');
  assert.equal(f.host.getLiveNucleusCount(id),0,'dead monolith and field expose no hittable nucleus');
  const cost=f.chaos();f.swing(false);f.step(100,p);
  if(continuity==='monolith')assert.equal(f.chaos(),cost,'dead body cannot charge after the killing frame');
  f.host.purgeDead();f.host.destroy();assert.equal(f.objects.size,0,'Host cleanup removes marks and stand-in graphics');
}
eventBus.off(GameEvent.ENEMY_KILLED,onKill);eventBus.off(GameEvent.ENEMY_DAMAGED,onDamage);

// Independent owners using identical family/seed are legal and must not share
// a mutable dynamic canvas, even without an inspector namespace.
for(const family of families){
  const f=fixture(),form=formOf(family),a=f.spawn(form),b=f.spawn(form);
  const va=f.draw(form,a),vb=f.draw(form,b);
  va.update(f.pose(a,0));vb.update(f.pose(b,0));
  assert.equal(f.textures.size,2,`${family}: same-seed hosts own separate dynamic canvases`);
  const keys=[...f.textures.keys()];va.destroy();assert.equal(f.textures.size,1);
  vb.update(f.pose(b,16));assert(keys.some(key=>f.textures.has(key)),'destroy A leaves B usable');
  vb.destroy();f.host.destroy();assert.equal(f.textures.size,0);assert.equal(f.objects.size,0);
}

let contactSamples=0,pixelSamples=0;
for(const family of families){
  // Obstacle strip crosses the actual material; it is not a fully clipped test.
  const f=fixture((col,row)=>col>=1&&col<=10&&row>=1&&row<=10&&col!==5),form=formOf(family),id=f.spawn(form);
  const visual=f.draw(form,id);
  for(const phase of ['rest','gather','release','disperse'] as VolumePhase[]){
    f.host.setVolumePreviewTime(id,volumeTimeAtPhase(family,phase,.5));
    for(let y=132;y<288;y+=12)for(let x=132;x<288;x+=12){
      const before=f.chaos();f.step(16,{x,y});
      const frame=f.host.getVolumePresenceFrame(id)!;
      const dangerous=isVolumeDangerousAt(frame,x,y);
      assert.equal(f.host.getVolumeSightMult(),dangerous?GAME_CONSTANTS.CONTAMINATION.VOLUME_SIGHT_MULT:1,
        `${family}/${phase}: sight penalty reads the actual material, not its bounding rectangle`);
      assert(Math.abs(f.chaos()-before-(dangerous?GAME_CONSTANTS.CONTAMINATION.VOLUME_CHAOS_PER_SEC*.016:0))<1e-8,
        `${family}/${phase}: billing must equal current authoritative presence`);
      contactSamples++;
    }
    visual.update(f.pose(id,10000));
    const frame=f.host.getVolumePresenceFrame(id)!;
    assert(frame.hasPresence);assert(f.legal(Math.floor(frame.coreX/32),Math.floor(frame.coreY/32)),'real core seats on reachable terrain');
    assert(sampleVolumeDensity(frame,frame.coreX,frame.coreY)>=frame.dangerThreshold,'real core sits inside material, never mist gap');
    const image=[...f.objects].find(o=>o.key)!;const tex=f.textures.get(image.key)!;
    let visible=0;
    for(let y=0;y<tex.h;y++)for(let x=0;x<tex.w;x++){
      const wx=image.x-tex.w/2+x+.5,wy=image.y-tex.h/2+y+.5;
      const alpha=tex.data[(y*tex.w+x)*4+3]!;
      if(isVolumeDangerousAt(frame,wx,wy))assert(alpha>0,'dangerous material cannot become a transparent texture hole');
      if(!alpha)continue;visible++;
      assert(f.legal(Math.floor(wx/32),Math.floor(wy/32)),'renderer cannot place visible material on clipped wall/VOID');
      // The separate exposed core may use a few pixels beyond the field, but
      // anatomy farther than 4px from it must belong to the actual density.
      if(Math.hypot(wx-frame.coreX,wy-frame.coreY)>4)assert(sampleVolumeDensity(frame,wx,wy)>0,
        `${family}/${phase}: body pixels cannot imply occupancy outside shared density`);
      pixelSamples++;
    }
    assert(visible>40,'real production renderer must retain nontrivial visible anatomy');
    const pixels=tex.data.slice();visual.update(f.pose(id,0));assert.deepEqual(tex.data,pixels,'pause is visually stable');
    visual.update({...f.pose(id,0),visibility:0});assert.equal(image.visible,false,'fog hides volume');
    visual.update(f.pose(id,0));assert.equal(image.visible,true,'showing again restores the same live frame');
    assert.deepEqual(tex.data,pixels,'hide/show cannot reset the phase');
    const stain=[...f.objects].find(o=>o.depth===35)!;
    for(const point of [{x:frame.coreX,y:frame.coreY},{x:frame.rect.x-4,y:frame.rect.y-4}]){
      Object.assign(f.player,point);visual.update(f.pose(id,0));
      assert.equal(stain.rects.length>0,isVolumeDangerousAt(frame,point.x,point.y),'foot stain and billed material share the exact stage/mask');
    }
  }
  f.host.setVolumePreviewTime(id,null);
  const before=f.host.getVolumePresenceFrame(id)!.elapsedMs;f.step(10000);
  assert.equal(f.host.getVolumePresenceFrame(id)!.elapsedMs-before,100,'background-sized dt advances the authoritative clock by at most 100ms');
  const frameTime=f.host.getVolumePresenceFrame(id)!.elapsedMs;visual.update(f.pose(id,10000));
  assert.equal(f.host.getVolumePresenceFrame(id)!.elapsedMs,frameTime,'renderer cannot mutate authoritative time');
  for(const dt of [0,-1,Number.NaN,Number.POSITIVE_INFINITY]){
    f.step(dt);assert.equal(f.host.getVolumePresenceFrame(id)!.elapsedMs,frameTime,'invalid or paused dt cannot advance hazard');
  }
  visual.destroy();f.host.destroy();assert.equal(f.textures.size,0);assert.equal(f.objects.size,0);
}
for(const family of families){
  const f=fixture(),form=formOf(family,'field','sense_reverse'),id=f.spawn(form);
  f.host.setVolumePreviewTime(id,volumeTimeAtPhase(family,'release',.5));
  const stand=(facing:number)=>{
    const p=f.host.getSubjects()[0]!.position;
    f.step(100,{x:p.x-6,y:p.y},facing);
  };
  for(let n=0;n<6;n++)stand(Math.PI);
  assert.equal(f.chaos(),0,`${family}: standing in material but looking away must not auto-wake a reverse field`);
  assert.equal(f.host.getActivityVisualState(id)!.phase,'rest');
  stand(0);stand(0);assert.equal(f.chaos(),0,'200ms view is still a real warning');
  stand(0);assert(f.chaos()>0,'300ms view arms the same material that is rendered');
  for(let n=0;n<5;n++)stand(Math.PI);
  assert.equal(f.host.getActivityVisualState(id)!.phase,'waking','release remains visible for the first 500ms');
  stand(Math.PI);assert.equal(f.host.getActivityVisualState(id)!.phase,'rest','600ms away closes reverse danger');
  const closed=f.chaos();stand(Math.PI);assert.equal(f.chaos(),closed);
  f.host.destroy();
}
let seeks=0;
for(const family of families)for(const coverage of ['infiltrate','rewrite','overwrite'] as const){
  const f=fixture(),form={...formOf(family),coverage};
  const make=()=>attachDingD({scene:f.scene as never,form,seed:7,depth:40,pin:{kind:'volume',x:128,y:128,width:160,height:160}});
  let v=make();
  const paint=(time:number)=>{
    v.update({x:208,y:208,facing4:'down',moving:false,visibility:1,signal:'awake',deltaMs:10000,volumeTimeMs:time,activity:{phase:'active',progress:1}});
    return [...f.textures.values()][0]!.data.slice();
  };
  for(const phase of ['gather','release'] as VolumePhase[]){
    const time=volumeTimeAtPhase(family,phase,.5),expected=paint(time);
    paint(time+713);assert.deepEqual(paint(time),expected,'backward seek uses absolute production geometry and material time');
    v.destroy();v=make();assert.deepEqual(paint(time),expected,'rebuild at same time cannot retain former frame phase');
    seeks++;
  }
  v.destroy();f.host.destroy();assert.equal(f.objects.size,0);assert.equal(f.textures.size,0);
}
// Irregular corridor bounds contain an L-shaped floor, not an all-floor box.
// The new Host must choose its local stage and keep that stage through several
// whole cycles; otherwise the mist's traversal axis can flip during old morph.
let localStageFrames=0;
const lFloor=(col:number,row:number)=>col>=4&&col<=8&&row>=4&&row<=8&&(col>=6||row<=5);
const sourceBox={minCol:4,minRow:4,maxCol:8,maxRow:8,coreCol:6,coreRow:6};
assert.deepEqual(findTerrainSafeVolumeSeat([sourceBox],lFloor),
  {minCol:6,minRow:4,maxCol:8,maxRow:8,coreCol:7,coreRow:6},'local deployment selects the actual 3x5 all-floor region');
assert.equal(findTerrainSafeVolumeSeat([sourceBox],(col,row)=>col===6&&row>=4&&row<=8),undefined,
  'one-tile strip cannot masquerade as a valid two-dimensional material stage');
for(const family of families){
  const f=fixture(lFloor),form=formOf(family),id=f.spawn(form),v=f.draw(form,id);
  const expected={x:192,y:128,w:96,h:160};
  for(let tick=0;tick<240;tick++){
    f.step(100,{x:16,y:16});
    const frame=f.host.getVolumePresenceFrame(id)!;
    assert.deepEqual(frame.rect,expected,'birth stage stays fixed despite old dingLiveRect time');
    assert(frame.hasPresence,'material cannot vanish for a phase after local stage selection');
    assert(lFloor(Math.floor(frame.coreX/32),Math.floor(frame.coreY/32)),'core remains on legal local floor');
    assert(sampleVolumeDensity(frame,frame.coreX,frame.coreY)>=frame.dangerThreshold,'core stays in material throughout cycle');
    if(family==='mist_bank')for(let y=128;y<288;y+=8)for(const dx of [-9,0,9])
      assert.equal(sampleVolumeDensity(frame,240+dx,y),0,'vertical 24px passage cannot flip to horizontal during a later cycle');
    if(tick%30===0){
      v.update(f.pose(id,100));
      const image=[...f.objects].find(o=>o.key)!;
      assert.deepEqual({x:image.x,y:image.y},{x:240,y:208},'renderer follows new local rect instead of the old enclosing corridor');
    }
    localStageFrames++;
  }
  v.destroy();f.host.destroy();assert.equal(f.objects.size,0);assert.equal(f.textures.size,0);
}
{
  const f=fixture(),id=f.spawn(formOf('mist_bank'));
  for(let tick=0;tick<240;tick++){
    f.step(100,{x:16,y:16});const frame=f.host.getVolumePresenceFrame(id)!;
    assert.deepEqual(frame.rect,{x:128,y:128,w:160,h:160},'square birth stage cannot become a near-square alternating aspect ratio');
    for(let x=128;x<288;x+=8)for(const dy of [-9,0,9])
      assert.equal(sampleVolumeDensity(frame,x,208+dy),0,'square stage preserves its chosen horizontal passage for multiple cycles');
    localStageFrames++;
  }
  f.host.destroy();assert.equal(f.objects.size,0);
}
// Reusing a preallocated frame must be equivalent to a fresh frame when the
// rectangle or terrain query changes, including cached dust travel clearance.
let cacheComparisons=0;
{
  const reused=createVolumePresenceFrame();
  const open=()=>true,restricted=(col:number,row:number)=>col>=6&&col<=8&&row>=4&&row<=8;
  for(const [rect,terrain] of [
    [{x:128,y:128,w:160,h:160},open],
    [{x:160,y:128,w:128,h:160},open],
    [{x:160,y:128,w:128,h:160},restricted],
    [{x:192,y:128,w:96,h:160},restricted],
    [{x:128,y:128,w:160,h:160},open],
  ] as const){
    const input={substrate:'dust_swarm',coverage:'rewrite',elapsedMs:volumeTimeAtPhase('dust_swarm','release',.8),rect,active:true,isWalkableFloor:terrain};
    const fresh=updateVolumePresenceFrame(createVolumePresenceFrame(),input);updateVolumePresenceFrame(reused,input);
    assert.equal(reused.hasPresence,fresh.hasPresence);assert.equal(reused.travelScale,fresh.travelScale,'cached clearance invalidates on rect/terrain replacement');
    assert.deepEqual(reused.parts,fresh.parts,'reused frame cannot retain stale geometry');
    for(let y=120;y<296;y+=8)for(let x=120;x<296;x+=8)
      assert.equal(sampleVolumeDensity(reused,x,y),sampleVolumeDensity(fresh,x,y),'cached mask and fresh mask must agree');
    cacheComparisons++;
  }
}
// A ray entirely through the mist's real empty passage must not wake a field
// simply because it crosses the mathematical outer box.
{
  const f=fixture(),form=formOf('mist_bank','field','sense_reverse'),id=f.spawn(form);
  f.host.setVolumePreviewTime(id,volumeTimeAtPhase('mist_bank','release',.5));
  for(let n=0;n<10;n++){
    const r=f.host.getVolumePresenceFrame(id)!.rect;
    f.step(100,r.w>=r.h?{x:r.x-20,y:r.y+r.h/2}:{x:r.x+r.w/2,y:r.y-20},r.w>=r.h?0:Math.PI/2);
  }
  assert.equal(f.host.getActivityVisualState(id)!.phase,'rest','mist gap is not an invisible reverse-sense trigger');
  assert.equal(f.chaos(),0);f.host.destroy();
}
console.log(JSON.stringify({masks,contactSamples,pixelSamples,killed,damaged,seeks,localStageFrames,cacheComparisons,textureLeaks:0,reverseFamilies:3}));
console.log('check-volume-integration OK');
