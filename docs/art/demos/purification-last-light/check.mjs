import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import {buildHaven} from './scene.ts';
import {WALK_SURFACES,LAYOUT_OBSTACLES,FURNACE_POSITION,FURNACE_YAW} from './environment.ts';
import {ACTOR_OBJECT_ID,ACTOR_POSITION,actorLampAnchor,seatedActorLampAnchor} from './actor.ts';
import {REST_OBJECT_ID,REST_POSITION,REST_YAW,REST_SEAT_HEIGHT,buildRestRemnant} from './rest.ts';
import {CORE_FACING_TARGET,CORE_YAW} from './devices.ts';
import {renderEnergy} from './energy.ts';
import {project,render} from './render.ts';
import {Model,add,cross,dot,mul,sub,unit} from './model.ts';
import {ShapeUtils,Vector2} from 'three';

const here=path.dirname(fileURLToPath(import.meta.url));
const files=fs.readdirSync(here).filter(x=>x.endsWith('.ts')).map(x=>path.join(here,x));
const program=ts.createProgram(files,{strict:true,noEmit:true,noUnusedLocals:true,noUnusedParameters:true,noUncheckedIndexedAccess:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,lib:['lib.es2022.d.ts','lib.dom.d.ts'],skipLibCheck:true});
const diagnostics=ts.getPreEmitDiagnostics(program);
if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));process.exit(1);}
// A small physical fixture catches a broken source/receiver or shadow path
// without depending on this scene's artistic brightness or its exported PNGs.
function verifySourceAndShadow(){
 const camera={width:128,height:112,origin:[64,56],scale:13,target:[0,0,0],direction:[0,10,.001]};
 const fixture=(blocked,lit)=>{
  const m=new Model();m.layer='haven';m.object=1;
  m.slab([[-4,-4],[4,-4],[4,4],[-4,4]],0,-.1,'cutstone');
  if(blocked){m.object=2;m.box([0,.8,0],[.7,1.6,1.2],'iron');}
  if(lit)m.light([-2,3,0],[.42,.62,.49],2,8,{kind:'pollution',id:'fixture-source'});
  return render(m,camera);
 };
 const off=fixture(true,false),on=fixture(true,true),unblocked=fixture(false,true);
 const sample=(result,point,field)=>{
  const p=project(point,camera),x=Math.floor(p[0]),y=Math.floor(p[1]);let sum=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const i=(y+dy)*camera.width+x+dx;
   assert.equal(result.objects[i],1,'Regression sample must hit the receiving floor, never the blocker');
   sum+=(field?result.lightFields.pollution:result.rgba)[i*4+1];
  }return sum/9;
 };
 const receivingPoint=[1.3,0,1.9],shadowPoint=[1.3,0,0];
 const litGain=sample(on,receivingPoint,false)-sample(off,receivingPoint,false);
 const clearContribution=sample(unblocked,shadowPoint,true),blockedContribution=sample(on,shadowPoint,true);
 const clearValue=sample(unblocked,shadowPoint,false),shadowValue=sample(on,shadowPoint,false);
 assert(litGain>0,'Switching on a real source must brighten a visible receiving face');
 assert(clearContribution>0,'Removing the blocker must expose the formerly shadowed receiver to the source');
 assert(blockedContribution<clearContribution*.15,'An opaque blocker must suppress direct light in its umbra');
 assert(clearValue-shadowValue>clearContribution*.5,'The source occlusion must produce a visible cast shadow in the final render');
 for(const result of [off,on,unblocked])for(const family of ['furnace','shoulder']){
  const data=result.lightFields[family];
  for(let i=0;i<data.length;i+=4)assert.equal(data[i]+data[i+1]+data[i+2],0,`Fixture leaked light into ${family}`);
 }
 for(let i=0;i<off.lightFields.pollution.length;i+=4)assert.equal(off.lightFields.pollution[i]+off.lightFields.pollution[i+1]+off.lightFields.pollution[i+2],0,'A source-free fixture must have no direct light contribution');
 return {camera:[camera.width,camera.height],sourceFamily:'pollution',receivingFaceGain:litGain,unblockedContribution:clearContribution,blockedContribution,castShadowDifference:clearValue-shadowValue};
}
const rendererRegression=verifySourceAndShadow();
// The core field is the visible LDR difference made by just the core sources,
// not their unclamped radiance or a duplicate of the whole pollution family.
// Keep a second pollution source present in both renders to detect that mix-up.
function verifyCoreContribution(){
 const camera={width:128,height:112,origin:[64,56],scale:13,target:[0,0,0],direction:[0,10,.001]};
 const fixture=(blocked,corePower)=>{
  const m=new Model();m.layer='haven';m.object=1;
  m.slab([[-4,-4],[4,-4],[4,4],[-4,4]],0,-.1,'cutstone');
  if(blocked){m.object=2;m.box([0,.8,0],[.7,1.6,1.2],'iron');}
  m.light([2.8,2.4,2.5],[.28,.42,.36],.8,6,{kind:'pollution',id:'fixture-other-pollution'});
  if(corePower)m.light([-2,3,0],[.32,.49,.43],corePower,8,{kind:'pollution',id:'core-heart'});
  return render(m,camera);
 };
 const off=fixture(true,0),on=fixture(true,3),unblocked=fixture(false,3),saturated=fixture(true,70);
 let maximumDifferenceError=0,clippedChannels=0,otherPollutionPixels=0;
 for(const result of [on,saturated]){
  assert(result.coreLight instanceof Uint8ClampedArray,'Renderer must expose the separate core contribution');
  assert.equal(result.coreLight.length,result.energyBase.length,'Core contribution dimensions differ from its base');
  for(let i=0;i<result.coreLight.length;i+=4){
   assert.equal(result.coreLight[i+3],255,'Core contribution must be opaque RGBA data');
   for(let k=0;k<3;k++){
    const expected=Math.max(0,result.energyBase[i+k]-off.energyBase[i+k]);
    const error=Math.abs(result.coreLight[i+k]-expected);
    maximumDifferenceError=Math.max(maximumDifferenceError,error);
    assert(error<=2,`Core field differs from its actual on/off base difference at ${i/4}, channel ${k}: ${error}`);
    assert(result.coreLight[i+k]<=result.lightFields.pollution[i+k]+2,'Core contribution escaped its pollution-family parent');
    if(result===saturated&&result.energyBase[i+k]>=250&&expected>0)clippedChannels++;
   }
  }
 }
 for(let i=0;i<off.coreLight.length;i+=4){
  assert.equal(off.coreLight[i]+off.coreLight[i+1]+off.coreLight[i+2],0,'Removing core sources must remove their entire field');
  if(off.lightFields.pollution[i]+off.lightFields.pollution[i+1]+off.lightFields.pollution[i+2]>0)otherPollutionPixels++;
 }
 assert(otherPollutionPixels>0,'The independence fixture must retain non-core pollution');
 assert(clippedChannels>0,'The core subtraction fixture must exercise LDR clipping');
 const sample=(result,point)=>{
  const p=project(point,camera),x=Math.floor(p[0]),y=Math.floor(p[1]);let sum=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const i=(y+dy)*camera.width+x+dx;
   assert.equal(result.objects[i],1,'Core fixture probe must sample its non-emitting receiver');
   sum+=result.coreLight[i*4+1];
  }return sum/9;
 };
 const receivingValue=sample(on,[1.3,0,1.9]),shadowValue=sample(on,[1.3,0,0]),unblockedValue=sample(unblocked,[1.3,0,0]);
 assert(receivingValue>0,'Core field must contain actual reflected light on a non-emitting face');
 assert(unblockedValue>0,'Removing the blocker must expose the core to the receiver');
 assert(shadowValue<unblockedValue*.3,'Core-specific extraction must preserve an opaque blocker\'s umbra');
 return {camera:[camera.width,camera.height],maximumDifferenceError,clippedChannels,otherPollutionPixels,receivingValue,shadowValue,unblockedValue,onOffDifferenceMatches:true};
}
const coreContributionRegression=verifyCoreContribution();
const {model,stations,rest}=buildHaven();
if(process.argv.includes('--layout-only')){console.log(JSON.stringify({strictModules:files.length,...verifyLayout()},null,2));process.exit(0);}
function verifyCoreFacing(){
 const core=stations.find(s=>s.key==='core');assert(core,'Missing core station');
 const floors=WALK_SURFACES.filter(s=>s.id==='main'||s.id==='upper');
 assert.equal(floors.length,2,'Facing target requires the two inhabited floor polygons');
 let weightedCenter=[0,0,0],areaSum=0;
 // Integrate triangulated floor areas independently of the authored target's
 // polygon-moment calculation. Neither actor nor camera enters this target.
 for(const floor of floors){
  const faces=ShapeUtils.triangulateShape(floor.points.map(p=>new Vector2(p[0],p[2])),[]);
  for(const face of faces){
   const [a,b,c]=face.map(i=>floor.points[i]);
   const area=Math.abs((b[0]-a[0])*(c[2]-a[2])-(c[0]-a[0])*(b[2]-a[2]))/2;
   weightedCenter=add(weightedCenter,mul(add(add(a,b),c),area/3));areaSum+=area;
  }
 }
 const expected=mul(weightedCenter,1/areaSum);
 assert(Math.hypot(...sub(expected,CORE_FACING_TARGET))<1e-7,'Core target must be the area-weighted center of the inhabited floors');
 const toward=unit([expected[0]-core.position[0],0,expected[2]-core.position[2]]);
 const facing=[Math.sin(CORE_YAW),0,Math.cos(CORE_YAW)],alignment=dot(toward,facing);
 assert(alignment>1-1e-9,'The core opening must face the floor center');
 const front=model.lights.find(l=>l.id==='core-front-seal'),rear=model.lights.find(l=>l.id==='core-rear-seal');
 assert(front&&rear,'Core facing requires its real front and rear anchors');
 const actual=unit([front.position[0]-rear.position[0],0,front.position[2]-rear.position[2]]);
 assert(dot(actual,toward)>1-1e-9,'The built core did not use the intended floor-facing transform');
 assert(model.volumes.filter(v=>v.object===core.id).every(v=>Math.abs(v.yaw-CORE_YAW)<1e-9),'The volume must use the housing orientation');
 const approach=unit([core.approach[0]-core.position[0],0,core.approach[2]-core.position[2]]);
 assert(dot(approach,toward)>.99,'The interaction approach must remain in front of the opening');
 return {target:CORE_FACING_TARGET,yaw:CORE_YAW,alignment,builtAlignment:dot(actual,toward),approach:core.approach};
}
const facingRegression=verifyCoreFacing();
function verifyEnergyDeformation(){
 const volume=model.volumes.find(v=>v.object===1);
 assert(volume,'A core volume is required for the isolated deformation fixture');
 const camera={width:128,height:128,origin:[64,64],scale:32,target:volume.center,direction:[19,24,30]};
 const result=renderEnergy([volume],camera,new Float32Array(128*128).fill(-Infinity));
 const densityAreas=[],densityHashes=[],bounds=[];
 for(const frame of result.frames){
  const mask=Buffer.alloc(128*128);let area=0,x0=128,y0=128,x1=-1,y1=-1;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++){
   const i=y*128+x;if(frame[i*4+3]===0)continue;
   mask[i]=1;area++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
  }
  assert(area>0,'Every phase must retain a visible energy density');
  assert(x0>0&&y0>0&&x1<127&&y1<127,'The deformation fixture clips its density at an image edge');
  densityAreas.push(area);bounds.push([x0,y0,x1,y1]);densityHashes.push(createHash('sha256').update(mask).digest('hex'));
 }
 const minArea=Math.min(...densityAreas),maxArea=Math.max(...densityAreas),relativeAreaChange=(maxArea-minArea)/minArea;
 // This is the authored expansion/compression contract, measured on density
 // with no housing, colour or halo. It is not a visual-quality score.
 assert(relativeAreaChange>.15,'Energy density must expand/compress by more than raster noise, not merely change RGB inside a fixed silhouette');
 assert(new Set(densityHashes).size>1,'Energy phases must change spatial occupancy');
 return {camera:[128,128],densityAreas,relativeAreaChange,bounds,unclipped:true};
}
const deformationRegression=verifyEnergyDeformation();
function verifyOmniCore(){
 const volumes=model.volumes.filter(v=>v.object===1),sources=model.lights.filter(l=>l.id.startsWith('core-'));
 assert(volumes.length>0,'The core must contain a real energy volume');
 for(const v of model.volumes){
  for(const n of [...v.center,...v.radii,v.yaw,v.seed])assert(Number.isFinite(n),'Invalid energy volume parameter');
  assert(v.radii.every(n=>n>0),'Energy radii must define a nonzero three-dimensional region');
 }
 assert.equal(model.triangles.filter(t=>t.object===1&&t.material==='energy').length,0,'Core energy must not regress to emissive mesh ribbons');
 assert(sources.length>0,'Missing core illumination');
 const center=volumes[0].center,weights=[.2126,.7152,.0722];
 const corePower=sources.reduce((s,l)=>s+l.power*dot(l.color,weights),0);
 const otherPower=Math.max(...model.lights.filter(l=>!l.id.startsWith('core-')).map(l=>l.power*dot(l.color,weights)));
 const coreReach=Math.max(...sources.map(l=>l.radius)),otherReach=Math.max(...model.lights.filter(l=>!l.id.startsWith('core-')).map(l=>l.radius));
 assert(corePower>otherPower,'Core radiance budget must exceed every other individual source');
 assert(coreReach>otherReach,'The core must have the largest illumination reach');
 const receiverValues=[];
 for(const direction of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
  const point=mul(direction,4),normal=mul(direction,-1),u=unit(cross(normal,Math.abs(normal[1])>.9?[1,0,0]:[0,1,0])),v=unit(cross(normal,u));
  const m=new Model();m.object=1;m.quad(add(point,add(mul(u,-.55),mul(v,-.55))),add(point,add(mul(u,.55),mul(v,-.55))),add(point,add(mul(u,.55),mul(v,.55))),add(point,add(mul(u,-.55),mul(v,.55))),'cutstone');
  m.lights.push(...sources.map(l=>({...l,position:sub(l.position,center)})));
  const camera={width:48,height:48,origin:[24,24],scale:20,target:point,direction:Math.abs(normal[1])>.9?[.001,normal[1],.001]:normal};
  const output=render(m,camera);let value=0;
  for(let y=23;y<=24;y++)for(let x=23;x<=24;x++){const i=y*48+x;assert.equal(output.objects[i],1,'Omni probe must hit its receiving face');value+=output.lightFields.pollution[i*4+1]/4;}
  assert(value>0,`Core failed to illuminate canonical direction ${direction}`);receiverValues.push(value);
 }
 return {canonicalDirections:['+X','-X','+Y','-Y','+Z','-Z'],receiverValues,coreRadianceBudget:corePower,strongestOtherBudget:otherPower,coreReach,strongestOtherReach:otherReach,volumeCount:volumes.length};
}
const omniRegression=verifyOmniCore();
if(process.argv.includes('--renderer-only')){console.log(JSON.stringify({rendererRegression,coreContributionRegression,omniRegression,facingRegression,deformationRegression},null,2));process.exit(0);}
assert.deepEqual(stations.map(s=>s.key),['core','storage','purifier','offering','growth','rift']);
for(const t of model.triangles)for(const v of [...t.a,...t.b,...t.c,...t.normal,t.tint])assert(Number.isFinite(v));
const assetDir=path.join(here,'assets'),manifest=JSON.parse(fs.readFileSync(path.join(assetDir,'manifest.json'),'utf8'));
const families=['pollution','furnace','shoulder'],sourceCode={pollution:1,furnace:2,shoulder:3};
assert.deepEqual([...new Set(model.lights.map(l=>l.kind))].sort(),[...families].sort(),'Only the three authored source families may emit direct light');
assert.equal(new Set(model.lights.map(l=>l.id)).size,model.lights.length,'Light ids must be unique');
for(const light of model.lights){
 assert.equal(typeof light.id,'string');assert(light.id.length>0,'A light needs an authored id');
 assert.equal(light.position.length,3);assert.equal(light.color.length,3);
 for(const n of [...light.position,...light.color,light.power,light.radius])assert(Number.isFinite(n),`${light.id}: non-finite source parameter`);
 assert(light.power>0&&light.radius>0,`${light.id}: nonpositive light strength or reach`);
 assert(light.color.every(n=>n>=0&&n<=1)&&light.color.some(n=>n>0),`${light.id}: invalid light colour`);
}
const shoulder=model.lights.filter(l=>l.kind==='shoulder');
assert.equal(shoulder.length,1,'The actor carries exactly one shoulder light');
assert.equal(shoulder[0].id,'actor-shoulder');
assert.deepEqual(shoulder[0].position,actorLampAnchor(),'The shoulder source must follow the actual actor anchor');
const lamps=model.triangles.filter(t=>t.material==='lamp');
assert(lamps.length>0&&lamps.every(t=>t.object===ACTOR_OBJECT_ID),'Shoulder emission belongs only to the actor lantern');
assert.deepEqual(manifest.lights.map(({screen,...light})=>light),model.lights,'Exported light definitions are stale');
assert.deepEqual(manifest.walkSurfaces,WALK_SURFACES,'Exported walking surfaces are stale');
assert.equal(manifest.triangles,model.triangles.length,'Exported geometry is stale');

// The seat is ordinary surviving architecture. Sitting replaces the actor,
// never adds a seventh station, a new emitter or a second hidden character.
const resting=buildHaven({resting:true}),restOnly=new Model();
buildRestRemnant(restOnly);
assert(restOnly.triangles.length>0,'Missing architectural rest remnant');
assert(restOnly.triangles.every(t=>t.object===REST_OBJECT_ID),'Rest geometry needs its own stable object id');
assert(restOnly.triangles.every(t=>!['pollutant','energy','ember','lamp'].includes(t.material)),'The rest remnant must not emit or contain pollution');
assert.equal(restOnly.lights.length,0,'The rest remnant must not introduce a light');
assert.equal(restOnly.volumes.length,0,'The rest remnant must not contain an energy volume');
assert.deepEqual(resting.stations,stations,'Sitting must leave all six interaction stations unchanged');
assert.deepEqual(resting.model.triangles.filter(t=>t.object!==ACTOR_OBJECT_ID),model.triangles.filter(t=>t.object!==ACTOR_OBJECT_ID),'Sitting must not move, erase or replace the surrounding architecture');
assert.deepEqual(resting.model.lights.filter(l=>l.kind!=='shoulder'),model.lights.filter(l=>l.kind!=='shoulder'),'Sitting must not alter unrelated sources');
assert.deepEqual(resting.model.volumes,model.volumes,'Sitting must leave the core volume unchanged');
const sittingActor=resting.model.triangles.filter(t=>t.object===ACTOR_OBJECT_ID).flatMap(t=>[t.a,t.b,t.c]);
const standingActor=model.triangles.filter(t=>t.object===ACTOR_OBJECT_ID).flatMap(t=>[t.a,t.b,t.c]);
assert(sittingActor.length>0&&standingActor.length>0,'Both poses need actual actor geometry');
assert(sittingActor.every(p=>Math.hypot(p[0]-REST_POSITION[0],p[2]-REST_POSITION[2])<1.6),'The seated model still contains actor geometry away from the seat');
const standingTop=Math.max(...standingActor.map(p=>p[1])),sittingTop=Math.max(...sittingActor.map(p=>p[1]));
assert(sittingTop<standingTop-.15,'Sitting must lower the body instead of placing an unchanged standing sprite on the seat');
const restingShoulder=resting.model.lights.filter(l=>l.kind==='shoulder');
assert.equal(restingShoulder.length,1,'The sitting actor must carry exactly one shoulder light');
assert.equal(restingShoulder[0].id,'actor-shoulder','Sitting must retain the same shoulder emitter identity');
assert(Math.hypot(...sub(restingShoulder[0].position,seatedActorLampAnchor(REST_POSITION,REST_YAW,REST_SEAT_HEIGHT)))<1e-9,'The shoulder source must follow the seated actor anchor');
assert(Math.hypot(...sub(restingShoulder[0].position,shoulder[0].position))>1,'The shoulder source was left at the standing position');
const sittingLampVertices=resting.model.triangles.filter(t=>t.material==='lamp').flatMap(t=>[t.a,t.b,t.c]);
assert(sittingLampVertices.length>0,'Sitting removed the visible lamp');
assert(Math.min(...sittingLampVertices.map(p=>Math.hypot(...sub(p,restingShoulder[0].position))))<.25,'The seated shoulder source is detached from the actual lamp mesh');
assert(resting.model.triangles.filter(t=>t.material==='lamp').every(t=>t.object===ACTOR_OBJECT_ID),'Sitting created a second luminous object');
const seatLocal=p=>{const dx=p[0]-REST_POSITION[0],dz=p[2]-REST_POSITION[2];return [dx*Math.cos(REST_YAW)-dz*Math.sin(REST_YAW),p[1]-REST_POSITION[1],dx*Math.sin(REST_YAW)+dz*Math.cos(REST_YAW)];};
const cloth=resting.model.triangles.filter(t=>t.object===ACTOR_OBJECT_ID&&t.material==='cloth').flatMap(t=>[t.a,t.b,t.c]).map(seatLocal);
const thighBand=cloth.filter(p=>p[1]>=REST_SEAT_HEIGHT-.04&&p[1]<=REST_SEAT_HEIGHT+.18);
assert(thighBand.some(p=>p[2]>.3)&&thighBand.some(p=>Math.abs(p[2])<.12),'The seated legs need horizontal thighs connecting the seat to the bent knees');
assert(cloth.some(p=>p[1]>=REST_SEAT_HEIGHT&&p[1]<REST_SEAT_HEIGHT+.07&&Math.abs(p[0])<.24&&Math.abs(p[2])<.19),'The pelvis must reach the seat instead of floating above it');
const bootVertices=resting.model.triangles.filter(t=>t.object===ACTOR_OBJECT_ID&&t.material==='black').flatMap(t=>[t.a,t.b,t.c]).filter(p=>p[1]<REST_POSITION[1]+.12);
assert(bootVertices.length>0,'The seated actor needs visible floor-level boot geometry');
assert(bootVertices.map(seatLocal).every(p=>p[2]>.3),'The feet must project forward of the pelvis instead of hanging underneath an unchanged standing body');
const restGeometryChecks={objectId:REST_OBJECT_ID,emittingMaterials:0,addedLightSources:0,standingTop,sittingTop,standingLamp:shoulder[0].position,sittingLamp:restingShoulder[0].position,bentKnees:true,pelvisMeetsSeat:true,staticGeometryUnchanged:true};

async function pixels(filename){
 const {data,info}=await sharp(path.join(assetDir,filename)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,manifest.camera.width,`${filename}: wrong width`);
 assert.equal(info.height,manifest.camera.height,`${filename}: wrong height`);
 assert.equal(info.channels,4,`${filename}: not RGBA`);
 return data;
}
const [motion,objects,depth,...contributions]=await Promise.all(['motion-map.png','object-ids.png','depth-layers.png',...families.map(k=>`light-${k}.png`)].map(pixels));
const coreContribution=await pixels('light-core.png');
const W=manifest.camera.width,H=manifest.camera.height,N=W*H;
const visibleSources={pollution:0,furnace:0,shoulder:0},visiblePollution=new Map(),outsidePollution={far:0,middle:0,near:0};
for(let i=0;i<N;i++){
 const o=i*4,layer=motion[o],object=motion[o+1],source=motion[o+2];
 assert(layer<=4&&object<=Math.max(ACTOR_OBJECT_ID,REST_OBJECT_ID)&&source<=3,`Invalid motion code at ${i}`);
 assert.equal(object,objects[o],`Motion/object masks disagree at ${i}`);
 assert.equal(layer,depth[o+2],`Motion/depth layers disagree at ${i}`);
 if(!source)continue;
 assert(layer>0,`A material emitter cannot exist in empty sky at ${i}`);
 visibleSources[families[source-1]]++;
 if(source===1){
  assert(object<=6,`Pollution emitter assigned to the player or rest remnant at ${i}`);
  visiblePollution.set(object,(visiblePollution.get(object)??0)+1);
  if(layer<4)outsidePollution[['far','middle','near'][layer-1]]++;
 }
 if(source===2)assert.equal(object,0,'Furnace emission must belong to the environment hearth');
 if(source===3)assert.equal(object,ACTOR_OBJECT_ID,'Shoulder emission escaped the actor');
}
for(const family of families)assert(visibleSources[family]>0,`${family}: no visible emitting material`);
const stationPollution=stations.map(s=>{
 const pollutant=model.triangles.filter(t=>t.object===s.id&&t.material==='pollutant').length;
 const energy=model.triangles.filter(t=>t.object===s.id&&t.material==='energy').length,volumes=model.volumes.filter(v=>v.object===s.id).length,visible=visiblePollution.get(s.id)??0;
 assert(pollutant+energy+volumes>0,`${s.key}: missing contained pollutant/energy geometry or volume`);
 assert(visible>0,`${s.key}: its pollution is absent from the exported source mask`);
 return {key:s.key,id:s.id,pollutantTriangles:pollutant,energyTriangles:energy,volumes,emittingPixels:visible};
});
assert(model.triangles.some(t=>(t.material==='pollutant'||t.material==='energy')&&t.layer!=='haven'),'Missing exterior contamination geometry');
assert(Object.values(outsidePollution).some(n=>n>0),'Exterior contamination is absent from the source mask');

const atlas=await sharp(path.join(assetDir,'core-energy-atlas.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(atlas.info.width,W*4,'Energy atlas must hold four full-resolution columns');
assert.equal(atlas.info.height,H*2,'Energy atlas must hold two full-resolution rows');
const frames=Array.from({length:8},()=>Buffer.alloc(N*4));
for(let frame=0;frame<8;frame++)for(let y=0;y<H;y++){
 const from=((Math.floor(frame/4)*H+y)*W*4+(frame%4)*W)*4;
 atlas.data.copy(frames[frame],y*W*4,from,from+W*4);
}
const frameHashes=frames.map(f=>createHash('sha256').update(f).digest('hex'));
assert.equal(new Set(frameHashes).size,8,'Energy atlas must contain eight distinct internal states');
let coreBodyPixels=0,changingInteriorPixels=0,activeAtlasPixels=0,densityPixels=0,transparentHaloPixels=0;
const [energyBase,staticComposite]=await Promise.all(['haven-energy-base.png','haven.png'].map(pixels));
const volumeBounds=model.volumes.map(v=>{const p=project(v.center,manifest.camera);return {x:p[0],y:p[1],r:Math.max(...v.radii)*manifest.camera.scale+12};});
for(let i=0;i<N;i++){
 const o=i*4,x=i%W,y=Math.floor(i/W),isCore=motion[o+1]===1&&motion[o+2]===1;
 const values=frames.map(f=>f[o+1]),maximum=Math.max(...values),minimum=Math.min(...values);
 const maximumAlpha=Math.max(...frames.map(f=>f[o+3]));
 if(maximumAlpha>0)densityPixels++;
 if(frames.some(f=>f[o+3]===0&&f[o]+f[o+1]+f[o+2]>0))transparentHaloPixels++;
 if(maximum>0||maximumAlpha>0){activeAtlasPixels++;assert(volumeBounds.some(b=>Math.abs(x+.5-b.x)<=b.r&&Math.abs(y+.5-b.y)<=b.r),'Energy animation paints outside its volume/scatter support');}
 for(let k=0;k<3;k++){
  const expected=Math.min(255,Math.max(0,energyBase[o+k]*(1-frames[0][o+3]/255)+frames[0][o+k]));
  assert(Math.abs(staticComposite[o+k]-expected)<=.51,'Static energy composite disagrees with radiance plus density opacity');
 }
 if(isCore){
  coreBodyPixels++;assert(maximum>=12&&maximumAlpha>0,'The union source mask has a core pixel absent from all volume density states');
  const interior=x>0&&x<W-1&&y>0&&y<H-1&&[-1,1,-W,W].every(d=>motion[(i+d)*4+1]===1&&motion[(i+d)*4+2]===1);
  if(interior&&maximum>minimum)changingInteriorPixels++;
 }
}
assert(coreBodyPixels>0&&changingInteriorPixels>0,'The volume must animate its visible interior, not only an outline or whole-scene tint');
assert(densityPixels>0&&densityPixels<N,'Density opacity must be spatially bounded, not opaque across the full frame');
assert(activeAtlasPixels<N,'Energy animation must leave pixels outside its bounded volume unchanged');
const energyAtlasChecks={dimensions:[atlas.info.width,atlas.info.height],frames:8,distinctFrames:new Set(frameHashes).size,coreBodyPixels,changingInteriorPixels,densityPixels,transparentHaloPixels,boundedSupport:true,staticCompositeMatches:true,deformationRegression};

// Sitting is a separately lit scene state. Its masks and base must replace the
// old actor together; changing only the object id would leave a painted ghost.
const [restMotion,restObjects,restDepth,restBase,restComposite,...restFields]=await Promise.all([
 'motion-map.png','object-ids.png','depth-layers.png','haven-energy-base.png','haven.png',
 ...families.map(k=>`light-${k}.png`),'light-core.png',
].map(name=>pixels(`rest/${name}`)));
const projectedSittingActor=sittingActor.map(p=>project(p,manifest.camera));
const seatedBounds={x0:Math.floor(Math.min(...projectedSittingActor.map(p=>p[0])))-1,x1:Math.ceil(Math.max(...projectedSittingActor.map(p=>p[0])))+1,y0:Math.floor(Math.min(...projectedSittingActor.map(p=>p[1])))-1,y1:Math.ceil(Math.max(...projectedSittingActor.map(p=>p[1])))+1};
let restActorPixels=0,restSeatPixels=0,standingSeatPixels=0,restLampPixels=0,vacatedActorPixels=0,clearedActorPixels=0,changedVacatedPixels=0,changedShoulderPixels=0;
const restReceiverPixels={pollution:0,furnace:0,shoulder:0};
for(let i=0;i<N;i++){
 const o=i*4,object=restMotion[o+1],source=restMotion[o+2],x=i%W,y=Math.floor(i/W);
 assert(restMotion[o]<=4&&object<=Math.max(ACTOR_OBJECT_ID,REST_OBJECT_ID)&&source<=3,`Invalid seated motion code at ${i}`);
 assert.equal(object,restObjects[o],`Seated motion/object masks disagree at ${i}`);
 assert.equal(restMotion[o],restDepth[o+2],`Seated motion/depth layers disagree at ${i}`);
 if(objects[o]===REST_OBJECT_ID)standingSeatPixels++;
 if(object===REST_OBJECT_ID){restSeatPixels++;assert.equal(source,0,'The seat must remain non-emitting while occupied');}
 if(object===ACTOR_OBJECT_ID){
  restActorPixels++;
  assert(x>=seatedBounds.x0&&x<=seatedBounds.x1&&y>=seatedBounds.y0&&y<=seatedBounds.y1,'The seated export contains actor pixels outside its actual geometry');
 }
 if(source===1)assert(object<=6,'Sitting assigns pollution to the actor or architectural seat');
 if(source===2)assert.equal(object,0,'Sitting reassigns the furnace to a device');
 if(source===3){restLampPixels++;assert.equal(object,ACTOR_OBJECT_ID,'Seated shoulder emission escaped the actor');}
 if(objects[o]===ACTOR_OBJECT_ID){
  vacatedActorPixels++;
  if(object!==ACTOR_OBJECT_ID)clearedActorPixels++;
  if([0,1,2].some(k=>Math.abs(restBase[o+k]-energyBase[o+k])>2))changedVacatedPixels++;
 }
 if([0,1,2].some(k=>restFields[2][o+k]!==contributions[2][o+k]))changedShoulderPixels++;
 for(const [j,family]of families.entries()){
  assert.equal(restFields[j][o+3],255,`${family}: seated light field must be opaque data`);
  if(restMotion[o]>0&&source!==sourceCode[family]&&(family!=='shoulder'||object!==ACTOR_OBJECT_ID)&&Math.max(restFields[j][o],restFields[j][o+1],restFields[j][o+2])>0)restReceiverPixels[family]++;
 }
 assert.equal(restFields[3][o+3],255,'Seated core field must be opaque data');
 for(let k=0;k<3;k++){
  assert(restFields[3][o+k]<=restFields[0][o+k]+2,'Seated core field escaped the pollution family');
  const expected=Math.min(255,Math.max(0,restBase[o+k]*(1-frames[0][o+3]/255)+frames[0][o+k]));
  assert(Math.abs(restComposite[o+k]-expected)<=.51,'The seated frame must composite its own base with the shared core atlas');
 }
}
assert(standingSeatPixels>0&&restSeatPixels>0,'The architectural seat must be visible in both scene states');
assert(restActorPixels>0,'The seated export must include the actor body');
// A physical lamp can face away or be occluded by its housing/owner. Preserve
// its geometry/anchor checks and require real world receivers below; do not
// turn the lens toward the camera solely to manufacture an emissive pixel.
assert(vacatedActorPixels>0&&clearedActorPixels===vacatedActorPixels,'The seated mask retains the old standing actor');
assert(changedVacatedPixels>vacatedActorPixels*.65,'The seated base retains the painted standing actor after its mask changed');
assert(changedShoulderPixels>0,'The seated light field still uses the standing shoulder source');
for(const family of families)assert(restReceiverPixels[family]>0,`${family}: sitting removed its light from all receiving surfaces`);
const restExportChecks={dimensions:[W,H],actorPixels:restActorPixels,seatPixels:restSeatPixels,shoulderEmissionPixels:restLampPixels,shoulderLensVisible:restLampPixels>0,shoulderWorldReceiversRequired:true,vacatedActorPixels,clearedActorPixels,changedVacatedPixels,changedShoulderPixels,receivingPixels:restReceiverPixels,sharedCoreCompositeMatches:true};

// A necessary spatial bound, independent of the shader's attenuation and ray
// tests: a contribution must be near a finite source sphere or an emitting
// material's small scatter footprint. This catches an accidental screen wash
// without setting a brightness or artistic-quality threshold.
const fieldChecks={};
for(const [familyIndex,family] of families.entries()){
 const data=contributions[familyIndex],support=new Uint8Array(N),code=sourceCode[family];
 const circle=(x,y,r)=>{
  const xx0=Math.max(0,Math.floor(x-r)),xx1=Math.min(W-1,Math.ceil(x+r)),yy0=Math.max(0,Math.floor(y-r)),yy1=Math.min(H-1,Math.ceil(y+r));
  for(let yy=yy0;yy<=yy1;yy++)for(let xx=xx0;xx<=xx1;xx++)if((xx+.5-x)**2+(yy+.5-y)**2<=r*r)support[yy*W+xx]=1;
 };
 for(const light of model.lights.filter(l=>l.kind===family)){const p=project(light.position,manifest.camera);circle(p[0],p[1],light.radius*manifest.camera.scale+12);}
 for(let i=0;i<N;i++)if(motion[i*4+2]===code)circle(i%W+.5,Math.floor(i/W)+.5,12);
 let active=0,receivers=0,maximum=0,outsideSupport=0,unaffected=0,recordedReceivers=0;
 const receiverObjects=new Set();
 for(let i=0;i<N;i++){
  const o=i*4,value=Math.max(data[o],data[o+1],data[o+2]);
  assert.equal(data[o+3],255,`${family}: contribution alpha must be opaque data`);
  if(!value){unaffected++;continue;}
  active++;maximum=Math.max(maximum,value);
  // Manifest statistics omit one-byte rounding remnants; support validation
  // above zero still includes those remnants.
  if(value>1){recordedReceivers++;receiverObjects.add(objects[o]);}
  if(motion[o]>0&&motion[o+2]!==code)receivers++;
  if(!support[i])outsideSupport++;
 }
 assert(receivers>0,`${family}: source has no receiving surface`);
 assert(unaffected>0,`${family}: contribution has become a full-screen wash`);
 assert.equal(outsideSupport,0,`${family}: light appears beyond every corresponding source`);
 assert.equal(recordedReceivers,manifest.lightStats[family].receivingPixels,`${family}: exported light stats are stale`);
 assert.equal(maximum,manifest.lightStats[family].maximum,`${family}: exported light maximum is stale`);
 assert.deepEqual([...receiverObjects].sort((a,b)=>a-b),manifest.lightStats[family].objects,`${family}: exported receiver ids are stale`);
 fieldChecks[family]={sourceCount:model.lights.filter(l=>l.kind===family).length,contributingPixels:active,nonEmitterReceivingPixels:receivers,maximum,outsideSupport};
}
// Core illumination remains a bounded subset of pollution. This presence /
// support check is structural evidence, not a score for artistic brightness.
const coreSources=model.lights.filter(l=>l.id.startsWith('core-'));
const coreSupport=coreSources.map(l=>{const p=project(l.position,manifest.camera);return {x:p[0],y:p[1],r:l.radius*manifest.camera.scale+12};});
let coreActive=0,coreReceivers=0,coreUnchanged=0,coreMaximum=0,coreOutsideSupport=0;
const coreReceiverObjects=new Set();
for(let i=0;i<N;i++){
 const o=i*4,value=Math.max(coreContribution[o],coreContribution[o+1],coreContribution[o+2]);
 assert.equal(coreContribution[o+3],255,'Core contribution alpha must be opaque data');
 for(let k=0;k<3;k++)assert(coreContribution[o+k]<=contributions[0][o+k]+2,`Core light is not a pollution subset at ${i}, channel ${k}`);
 if(!value){coreUnchanged++;continue;}
 coreActive++;coreMaximum=Math.max(coreMaximum,value);
 const x=i%W+.5,y=Math.floor(i/W)+.5;
 if(!coreSupport.some(s=>(x-s.x)**2+(y-s.y)**2<=s.r*s.r))coreOutsideSupport++;
 if(motion[o]>0&&motion[o+2]===0){coreReceivers++;coreReceiverObjects.add(objects[o]);}
}
assert(coreSources.length>0&&coreActive>0,'Exported core illumination is empty');
assert(coreReceivers>0,'Core export must illuminate non-emitting geometry, not merely its energy body');
assert(coreUnchanged>0,'Core contribution must not become a full-screen wash');
assert.equal(coreOutsideSupport,0,'Core illumination escaped every core source support');
const coreFieldChecks={sourceCount:coreSources.length,contributingPixels:coreActive,nonEmitterReceivingPixels:coreReceivers,receiverObjects:[...coreReceiverObjects].sort((a,b)=>a-b),maximum:coreMaximum,outsideSupport:coreOutsideSupport,pollutionSubset:true};
const elevation=createElevationQuery(WALK_SURFACES);
const restTriangles=model.triangles.filter(t=>t.object===REST_OBJECT_ID);
const restBottom=Math.min(...restTriangles.flatMap(t=>[t.a[1],t.b[1],t.c[1]]));
// Slabs omit the invisible buried underside. Their actual bottom perimeter,
// rather than a nonexistent cap, defines the foundation's support footprint.
const restContacts=restTriangles.map(t=>[t.a,t.b,t.c].filter(p=>Math.abs(p[1]-restBottom)<1e-7)).filter(points=>points.length>=2);
assert(restContacts.length>0,'The architectural seat needs an actual foundation footprint');
let supportSamples=0;
for(const [a,b] of restContacts){
 for(let step=0;step<=8;step++){
  const p=a.map((n,k)=>n+(b[k]-n)*step/8),ground=elevation(p[0],p[2]);
  assert(Number.isFinite(ground.height)&&p[1]-ground.height>=-.25&&p[1]-ground.height<=.10,'A rest-remnant foundation is unsupported by the actual floor');
  supportSamples++;
 }
}
const bootBottom=Math.min(...bootVertices.map(p=>p[1]));
let bootFloorSamples=0;
for(const p of bootVertices.filter(p=>Math.abs(p[1]-bootBottom)<1e-7)){
 const ground=elevation(p[0],p[2]);
 assert(Number.isFinite(ground.height)&&Math.abs(p[1]-ground.height)<.10,'A seated boot floats above or clips deeply into the floor');
 bootFloorSamples++;
}
assert(bootFloorSamples>0,'Missing seated sole/floor checks');
const layoutChecks=verifyLayout();
const riftSourceHashes=Object.fromEntries(['player-sprite-dense.ts','player-sprite.ts'].map(name=>{
 const source=`src/entities/${name}`,filename=path.resolve(here,'../../../..',source);
 return [source,createHash('sha256').update(fs.readFileSync(filename)).digest('hex')];
}));
const result={strictModules:files.length,finiteTriangles:model.triangles.length,stations:layoutChecks.stations,reachableSamples:layoutChecks.reachableSamples,totalStandableSamples:layoutChecks.totalStandableSamples,allStandableSamplesConnected:layoutChecks.allStandableSamplesConnected,footRadius:layoutChecks.footRadius,samplingStep:layoutChecks.samplingStep,ramps:layoutChecks.ramps,layout:layoutChecks,rest:{...restGeometryChecks,approach:rest.approach,reachable:true,supportSamples,bootFloorSamples,exports:restExportChecks},coreFacing:facingRegression,sourceChecks:{families,uniqueSourceIds:model.lights.length,actorShoulderSources:shoulder.length,fields:fieldChecks,coreField:coreFieldChecks,rendererRegression,coreContributionRegression,omniRegression,riftSourceHashes},motionMasks:{dimensions:[W,H],visibleSources,stationPollution,outsidePollution,energyAtlas:energyAtlasChecks},scope:'Source definitions, exported masks, finite source support and independent receiver/occluder and omnidirectional fixtures; art layout with oriented station/remnant and authored environment footprints, exact operation anchors, sole west-ramp transitions and routes outside the seat/fire space, seated geometry and light anchors. Pixel counts record presence, not artistic quality. Does not claim production collision or gameplay integration.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--write'))fs.writeFileSync(path.join(here,'assets','layout-check.json'),JSON.stringify(result,null,2)+'\n');

function createElevationQuery(surfaces){
 const faces=surfaces.flatMap(surface=>ShapeUtils.triangulateShape(surface.points.map(p=>new Vector2(p[0],p[2])),[]).map(face=>({points:face.map(i=>surface.points[i]),id:surface.id})));
 return (x,z)=>{
  let height=-Infinity,id='';
  for(const t of faces){
   const [a,b,c]=t.points,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
   if(Math.abs(det)<1e-9)continue;
   const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;
   const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
   if(u<0||v<0||w<0)continue;
   const y=u*a[1]+v*b[1]+w*c[1];if(y>height){height=y;id=t.id;}
  }
  return {height,id};
 };
}

/** Art-layout checks only. Footprints and routes do not implement gameplay. */
function verifyLayout(){
 const elevation=createElevationQuery(WALK_SURFACES),step=.16,radius=.22,maxSnap=step/Math.SQRT2+.02;
 const rampIds=WALK_SURFACES.filter(s=>s.id.endsWith('-ramp')).map(s=>s.id);
 assert.deepEqual(rampIds,['west-ramp'],'The authored layout must contain only the west ramp');
 const local=(p,origin,yaw)=>{const dx=p[0]-origin[0],dz=p[2]-origin[2];return [dx*Math.cos(yaw)-dz*Math.sin(yaw),dx*Math.sin(yaw)+dz*Math.cos(yaw)];};
 // Work in each object's authored orientation. World AABBs wrongly occupied
 // the empty corners beside rotated devices and hid that error by snapping.
 function clipHeight(points,height,above){
  const clipped=[];
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],insideA=above?a[1]>=height:a[1]<=height,insideB=above?b[1]>=height:b[1]<=height;
   if(insideA)clipped.push(a);
   if(insideA!==insideB){const t=(height-a[1])/(b[1]-a[1]);clipped.push(a.map((v,k)=>v+(b[k]-v)*t));}
  }
  return clipped;
 }
 const deviceObstacles=[...stations.filter(s=>s.key!=='rift'),rest].map(s=>{
  // Flush traces below 12cm remain floor details; crop taller triangles to
  // the actual low body band so a high leaning brace cannot enlarge its foot.
  const vertices=model.triangles.filter(t=>t.object===s.id).flatMap(t=>clipHeight(clipHeight([t.a,t.b,t.c],s.position[1]+.12,true),s.position[1]+.65,false));
  assert(vertices.length>0,`${s.key}: no low assembly geometry`);
  const ps=vertices.map(p=>local(p,s.position,s.yaw));
  return {id:s.key,kind:'obb',position:s.position,yaw:s.yaw,x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),z0:Math.min(...ps.map(p=>p[1])),z1:Math.max(...ps.map(p=>p[1])),height:.65};
 });
 // The environment owns placement and footprint data, including the furnace.
 const environmentObstacles=LAYOUT_OBSTACLES.map(o=>{
  assert(['box','circle'].includes(o.kind),`${o.id}: unknown footprint shape`);
  assert(o.position.every(Number.isFinite),`${o.id}: invalid footprint position`);
  if(o.kind==='circle'){assert(o.radius>0,`${o.id}: invalid footprint radius`);return {...o,height:.65};}
  assert(o.half.every(n=>Number.isFinite(n)&&n>0)&&Number.isFinite(o.yaw),`${o.id}: invalid oriented footprint`);
  return {...o,kind:'obb',x0:-o.half[0],x1:o.half[0],z0:-o.half[1],z1:o.half[1],height:.65};
 });
 assert(new Set(environmentObstacles.map(o=>o.id)).size===environmentObstacles.length,'Environment obstacle ids must be unique');
 for(const id of ['furnace','supply-crate','supply-can','shelf-west','shelf-middle','shelf-east','pier-east','pier-middle','pier-under-west','pier-under-middle','pier-under-east'])assert(environmentObstacles.some(o=>o.id===id),`Layout missing the ${id} footprint`);
 const obstacles=[...deviceObstacles,...environmentObstacles];
 function clearance(p,o){
  if(p[1]<o.position[1]-.1||p[1]>o.position[1]+o.height+.1)return Infinity;
  const [x,z]=local(p,o.position,o.yaw??0);
  if(o.kind==='circle')return Math.hypot(x,z)-o.radius;
  const dx=Math.max(o.x0-x,0,x-o.x1),dz=Math.max(o.z0-z,0,z-o.z1);
  return dx||dz?Math.hypot(dx,dz):-Math.min(x-o.x0,o.x1-x,z-o.z0,o.z1-z);
 }
 function standing(x,z){
  const h=elevation(x,z);if(!Number.isFinite(h.height))return {clear:false,reason:'outside floor'};
  for(let k=0;k<16;k++){
   const a=k*Math.PI/8,q=elevation(x+Math.cos(a)*radius,z+Math.sin(a)*radius);
   if(!Number.isFinite(q.height)||Math.abs(q.height-h.height)>.27)return {clear:false,reason:'foot crosses edge or excessive height change'};
  }
  const p=[x,h.height,z],hit=obstacles.find(o=>clearance(p,o)<radius-1e-8);
  return hit?{clear:false,reason:`foot overlaps ${hit.id}`}:{clear:true,x,z,y:h.height,id:h.id};
 }
 const vertices=WALK_SURFACES.flatMap(s=>s.points);
 const x0=Math.floor(Math.min(...vertices.map(p=>p[0]))/step)*step,z0=Math.floor(Math.min(...vertices.map(p=>p[2]))/step)*step;
 const nx=Math.ceil((Math.max(...vertices.map(p=>p[0]))-x0)/step)+1,nz=Math.ceil((Math.max(...vertices.map(p=>p[2]))-z0)/step)+1,nodes=new Map();
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){const n=standing(x0+ix*step,z0+iz*step);if(n.clear)nodes.set(iz*nx+ix,n);}
 const links=new Map([...nodes.keys()].map(i=>[i,[]]));
 function clearSegment(a,b){
  const count=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.04);
  for(let j=1;j<count;j++)if(!standing(a.x+(b.x-a.x)*j/count,a.z+(b.z-a.z)*j/count).clear)return false;
  return true;
 }
 for(const [i,a]of nodes)for(const [dx,dz]of [[1,0],[0,1],[1,1],[-1,1]]){
  const j=i+dx+dz*nx,b=nodes.get(j);
  if(!b||Math.hypot(a.x-b.x,a.z-b.z)>step*1.5||Math.abs(a.y-b.y)>.25)continue;
  if(dx&&dz&&(!nodes.has(i+dx)||!nodes.has(i+dz*nx)))continue;
  if(!clearSegment(a,b))continue;
  const length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  links.get(i).push([j,length]);links.get(j).push([i,length]);
 }
 const anchors={actor:ACTOR_POSITION,...Object.fromEntries(stations.map(s=>[s.key,s.approach])),rest:rest.approach};
 const anchorNodes={},anchorChecks={};
 for(const [key,p]of Object.entries(anchors)){
  const actual=standing(p[0],p[2]);
  assert(actual.clear,`${key}: authored anchor is not clear: ${actual.reason}`);
  assert(Math.abs(actual.y-p[1])<=.10,`${key}: anchor is not on its authored floor`);
  let nearest,minimum=Infinity;
  for(const [i,n]of nodes){const d=Math.hypot(n.x-p[0],n.z-p[2]);if(Math.abs(n.y-p[1])<=.10&&d<minimum&&clearSegment(actual,n)){nearest=i;minimum=d;}}
  assert(minimum<=maxSnap,`${key}: needs ${minimum.toFixed(3)}m snap; maximum ${maxSnap.toFixed(3)}m`);
  anchorNodes[key]=nearest;
  anchorChecks[key]={position:p,sampled:[nodes.get(nearest).x,nodes.get(nearest).y,nodes.get(nearest).z],snap:minimum,nearestObstacle:Math.min(...obstacles.map(o=>clearance(p,o))),exactFootClear:true};
 }
 function flood(start,allowed=()=>true){
  const seen=new Set(allowed(start)?[start]:[]),queue=[...seen];
  for(let q=0;q<queue.length;q++)for(const [next]of links.get(queue[q]))if(allowed(next)&&!seen.has(next)){seen.add(next);queue.push(next);}
  return seen;
 }
 const seen=flood(anchorNodes.actor);
 for(const [key,node]of Object.entries(anchorNodes))assert(seen.has(node),`${key}: disconnected authored anchor`);
 // Reserve actual journeys, not a large empty central polygon. Width here
 // is plan-view room for a person to pass comfortably; the separate movement
 // graph still checks the real foot heights. The descending ramp itself is
 // not an obstacle to its own landing's turning space.
 const mainSurface=WALK_SURFACES.find(surface=>surface.id==='main');
 const rampSurface=WALK_SURFACES.find(surface=>surface.id==='west-ramp');
 const bottomY=Math.min(...rampSurface.points.map(p=>p[1]));
 const lowerEdge=rampSurface.points.filter(p=>Math.abs(p[1]-bottomY)<1e-7);
 assert.equal(lowerEdge.length,2,'The ramp needs a two-corner lower edge');
 const stairFoot=lowerEdge[0].map((v,k)=>(v+lowerEdge[1][k])/2);
 const stairStanding=standing(stairFoot[0],stairFoot[2]);
 assert(stairStanding.clear,'The exact ramp foot must be standable');
 let stairNode,stairSnap=Infinity;
 for(const [i,n]of nodes){const d=Math.hypot(n.x-stairFoot[0],n.z-stairFoot[2]);if(Math.abs(n.y-stairFoot[1])<=.1&&d<stairSnap&&clearSegment(stairStanding,n)){stairNode=i;stairSnap=d;}}
 assert(stairSnap<=maxSnap&&seen.has(stairNode),'The ramp-foot route origin must be reachable without a large snap');
 anchorNodes.stair=stairNode;
 function pointEdgeDistance(x,z,a,b){
  const dx=b[0]-a[0],dz=b[2]-a[2],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz)));
  return Math.hypot(x-a[0]-dx*t,z-a[2]-dz*t);
 }
 function mainEdgeDistance(x,z){return Math.min(...mainSurface.points.map((a,i)=>pointEdgeDistance(x,z,a,mainSurface.points[(i+1)%mainSurface.points.length])));}
 function insideMain(x,z){
  if(mainEdgeDistance(x,z)<1e-8)return true;
  let inside=false;
  for(let i=0,j=mainSurface.points.length-1;i<mainSurface.points.length;j=i++){
   const a=mainSurface.points[i],b=mainSurface.points[j];
   if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
  }
  return inside;
 }
 function mainPlanClearance(p){
  if(!insideMain(p[0],p[2]))return -Infinity;
  const edgeDistance=mainEdgeDistance(p[0],p[2]);
  return Math.min(edgeDistance,...obstacles.map(o=>clearance([p[0],0,p[2]],o)));
 }
 const directCorridors=[];
 for(const key of ['offering','purifier']){
  const to=anchors[key],length=Math.hypot(to[0]-stairFoot[0],to[2]-stairFoot[2]),samples=Math.ceil(length/.04);
  let minimum=Infinity,tightest;
  for(let j=0;j<=samples;j++){
   const p=stairFoot.map((v,k)=>v+(to[k]-v)*j/samples),d=mainPlanClearance(p);
   if(d<minimum){minimum=d;tightest=p;}
  }
  assert(minimum>=.75,`Ramp foot → ${key}: 1.50m direct corridor narrows to ${(minimum*2).toFixed(3)}m at ${tightest}`);
  directCorridors.push({from:'stair',to:key,centerline:[stairFoot,to],length,requiredWidth:1.5,minimumClearWidth:minimum*2,tightest,samples:samples+1});
 }
 const turningClearance=mainPlanClearance(stairFoot);
 assert(turningClearance>=.9,`Ramp-foot turning area needs a clear 1.80m diameter; current ${(turningClearance*2).toFixed(3)}m`);
 // Include every low remnant polygon, including the shallow buried return.
 // The old lowest-course check alone missed a floating tail at another depth.
 let lowRestSupportSamples=0;
 for(const triangle of model.triangles.filter(t=>t.object===rest.id)){
  const polygon=clipHeight([triangle.a,triangle.b,triangle.c],rest.position[1]+.1,false);
  if(!polygon.length)continue;
  const probes=[polygon.reduce((sum,p)=>sum.map((v,k)=>v+p[k]/polygon.length),[0,0,0])];
  for(let i=0;i<polygon.length;i++){
   const a=polygon[i],b=polygon[(i+1)%polygon.length],count=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[2]-b[2])/.08));
   for(let j=0;j<=count;j++)probes.push(a.map((v,k)=>v+(b[k]-v)*j/count));
  }
  for(const p of probes){assert(insideMain(p[0],p[2]),`Low rest remnant extends beyond the actual main slab at ${p.map(n=>n.toFixed(3))}`);lowRestSupportSamples++;}
 }
 assert(lowRestSupportSamples>0,'Missing low remnant support coverage');
 const unreachable=[...nodes].filter(([i])=>!seen.has(i));
 const unreachableBySurface=Object.fromEntries([...new Set(unreachable.map(([,n])=>n.id))].map(id=>{
  const ns=unreachable.filter(([,n])=>n.id===id).map(([,n])=>n);
  return [id,{count:ns.length,x:[Math.min(...ns.map(n=>n.x)),Math.max(...ns.map(n=>n.x))],z:[Math.min(...ns.map(n=>n.z)),Math.max(...ns.map(n=>n.z))]}];
 }));
 // Prop backs and torn slab tips may have standable but inaccessible samples.
 // Report them explicitly; only actual operation anchors and the authored
 // crossing are required to belong to the player's connected floor component.
 const rampNodes=[...nodes.keys()].filter(i=>nodes.get(i).id==='west-ramp');
 assert(rampNodes.length>0,'Missing west ramp samples');
 const rampStart=rampNodes.find(i=>seen.has(i));
 assert(rampStart!==undefined,'The west ramp must be accessible from the actor');
 const rampComponent=flood(rampStart,i=>nodes.get(i).id==='west-ramp');
 const boundary={main:[],upper:[]};
 for(const i of rampComponent)for(const [j]of links.get(i)){
  const layer=nodes.get(j).id;if(layer==='main'||layer==='upper')boundary[layer].push({ramp:[nodes.get(i).x,nodes.get(i).y,nodes.get(i).z],floor:[nodes.get(j).x,nodes.get(j).y,nodes.get(j).z]});
 }
 assert(boundary.main.length>0&&boundary.upper.length>0,'One connected west ramp component must join both main and upper floors');
 const withoutRamp=flood(anchorNodes.actor,i=>nodes.get(i).id!=='west-ramp');
 assert(![...withoutRamp].some(i=>nodes.get(i).id==='upper'),'Upper floor remains reachable without the sole west ramp');
 for(const key of ['growth','storage'])assert(!withoutRamp.has(anchorNodes[key]),`${key}: upper station bypasses the sole ramp`);

 const hearthVector=[FURNACE_POSITION[0]-rest.position[0],FURNACE_POSITION[2]-rest.position[2]],hearthDistance=Math.hypot(...hearthVector),hearthHalfWidth=.55;
 assert(hearthDistance>0,'Seat and furnace must have distinct positions');
 const forward=[Math.sin(rest.yaw),Math.cos(rest.yaw)],seatAlignment=(forward[0]*hearthVector[0]+forward[1]*hearthVector[1])/hearthDistance;
 const fireAlignment=-(Math.sin(FURNACE_YAW)*hearthVector[0]+Math.cos(FURNACE_YAW)*hearthVector[1])/hearthDistance;
 assert(seatAlignment>.98,'The seated actor must face the furnace');
 assert(fireAlignment>.98,'The furnace opening must face the seat');
 function alongExtents(o){
  assert(o.kind==='obb',`${o.id}: hearth bounds require an oriented box`);
  const values=[];
  for(const x of [o.x0,o.x1])for(const z of [o.z0,o.z1]){
   const wx=o.position[0]+x*Math.cos(o.yaw)+z*Math.sin(o.yaw)-rest.position[0];
   const wz=o.position[2]-x*Math.sin(o.yaw)+z*Math.cos(o.yaw)-rest.position[2];
   values.push((wx*hearthVector[0]+wz*hearthVector[1])/hearthDistance);
  }
  return [Math.min(...values),Math.max(...values)];
 }
 const furnaceObstacle=environmentObstacles.find(o=>o.id==='furnace');
 assert(furnaceObstacle,'The furnace footprint needs its stable id');
 const hearthRange=[alongExtents(deviceObstacles.find(o=>o.id==='rest'))[1],alongExtents(furnaceObstacle)[0]];
 assert(hearthRange[1]-hearthRange[0]>radius*2,'The seat/fire gap must leave room for seated feet');
 function inHearth(p){
  if(Math.abs(p.y-rest.position[1])>.3)return false;
  const x=p.x-rest.position[0],z=p.z-rest.position[2],along=(x*hearthVector[0]+z*hearthVector[1])/hearthDistance;
  const across=Math.abs(x*hearthVector[1]-z*hearthVector[0])/hearthDistance;
  return along>hearthRange[0]&&along<hearthRange[1]&&across<hearthHalfWidth;
 }
 const protectedNodes=new Set([...nodes.keys()].filter(i=>inHearth(nodes.get(i))));
 assert(protectedNodes.size>0,'The seated feet/fire space must include usable floor, not overlapping solid footprints');
 class MinHeap{
  values=[];
  push(value){this.values.push(value);let i=this.values.length-1;while(i){const p=(i-1)>>1;if(this.values[p][0]<=value[0])break;this.values[i]=this.values[p];i=p;}this.values[i]=value;}
  pop(){const first=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(i*2+1<this.values.length){let j=i*2+1;if(j+1<this.values.length&&this.values[j+1][0]<this.values[j][0])j++;if(this.values[j][0]>=last[0])break;this.values[i]=this.values[j];i=j;}this.values[i]=last;}return first;}
 }
 const comfortableEdges=new Map();
 function hasComfortWidth(a,b){
  const key=a<b?`${a}:${b}`:`${b}:${a}`;
  if(comfortableEdges.has(key))return comfortableEdges.get(key);
  const from=nodes.get(a),to=nodes.get(b),count=Math.ceil(Math.hypot(from.x-to.x,from.z-to.z)/.04);
  let clear=true;
  for(let j=0;j<=count;j++){
   const x=from.x+(to.x-from.x)*j/count,z=from.z+(to.z-from.z)*j/count,h=elevation(x,z).height;
   if(h>.15||mainPlanClearance([x,0,z])<.6){clear=false;break;}
  }
  comfortableEdges.set(key,clear);return clear;
 }
 function shortest(start,avoidHearth=false,comfortable=false){
  const queue=new MinHeap(),distances=new Map([[start,0]]),previous=new Map();queue.push([0,start]);
  while(queue.values.length){
   const [distance,node]=queue.pop();if(distance!==distances.get(node))continue;
   for(const [next,length]of links.get(node)){
    if(comfortable&&!hasComfortWidth(node,next))continue;
    if(avoidHearth&&(protectedNodes.has(next)||inHearth({x:(nodes.get(node).x+nodes.get(next).x)/2,y:(nodes.get(node).y+nodes.get(next).y)/2,z:(nodes.get(node).z+nodes.get(next).z)/2})))continue;
    const d=distance+length;if(d<(distances.get(next)??Infinity)){distances.set(next,d);previous.set(next,node);queue.push([d,next]);}
   }
  }
  return {distances,previous};
 }
 const upperPairs=['actor','core','rift','offering','purifier'].flatMap(from=>['growth','storage'].map(to=>({from,to,upper:true})));
 const mainPairs=[...['actor','purifier','offering','stair'].flatMap(from=>['core','rift'].map(to=>({from,to,upper:false}))),...['offering','purifier'].map(to=>({from:'stair',to,upper:false}))];
 const routePairs=[...upperPairs,...mainPairs],routeKeys=[...new Set(routePairs.flatMap(p=>[p.from,p.to]))];
 const routeCache=new Map(routeKeys.map(key=>[key,shortest(anchorNodes[key])]));
 const outsideCache=new Map(routeKeys.map(key=>[key,shortest(anchorNodes[key],true)]));
 const comfortableCache=new Map([...new Set(mainPairs.map(p=>p.from))].map(key=>[key,shortest(anchorNodes[key],true,true)]));
 const routeChecks=[];
 for(const {from,to,upper} of routePairs){
  const normal=routeCache.get(from),outside=outsideCache.get(from),goal=anchorNodes[to];
  const length=normal.distances.get(goal),outsideLength=outside.distances.get(goal);
  assert(Number.isFinite(length)&&Number.isFinite(outsideLength),`${from} → ${to}: needs a route outside the seat/fire space`);
  let bestViaHearth=Infinity;
  for(const i of protectedNodes)bestViaHearth=Math.min(bestViaHearth,(normal.distances.get(i)??Infinity)+(routeCache.get(to).distances.get(i)??Infinity));
  const hearthDetour=bestViaHearth-length;
  assert(hearthDetour>=step*2,`${from} → ${to}: hearth bypass wins by only ${hearthDetour.toFixed(3)}m; require a two-grid-step margin, not a sampling tie`);
  assert(Math.abs(outsideLength-length)<1e-6,`${from} → ${to}: normal shortest route requires the seat/fire space`);
  const route=[];for(let i=goal;i!==undefined;i=normal.previous.get(i))route.push(i);route.reverse();
  if(upper)assert(route.some(i=>nodes.get(i).id==='west-ramp'),`${from} → ${to}: route skipped the only ramp`);
  const record={from,to,length,outsideLength,bestViaHearth,hearthDetour,minimumHearthDetour:step*2,ramps:upper?['west-ramp']:[]};
  if(!upper){
   const comfortableLength=comfortableCache.get(from).distances.get(goal);
   assert(Number.isFinite(comfortableLength),`${from} → ${to}: no 1.20m corridor outside the hearth`);
   assert(comfortableLength<=length*1.35,`${from} → ${to}: keeping a 1.20m corridor adds more than 35% detour`);
   Object.assign(record,{requiredCorridorWidth:1.2,comfortableLength,comfortableDetourRatio:comfortableLength/length});
  }
  routeChecks.push(record);
 }
 return {stations:stations.map(s=>s.key),reachableSamples:seen.size,totalStandableSamples:nodes.size,allStandableSamplesConnected:seen.size===nodes.size,unreachableBySurface,footRadius:radius,samplingStep:step,maxAnchorSnap:maxSnap,anchorChecks,publicRoutes:{stairFoot,snap:stairSnap,directCorridors,turning:{center:stairFoot,requiredDiameter:1.8,clearDiameter:turningClearance*2},mainCorridorWidth:1.2},lowRestSupportSamples,obstacles,ramps:rampIds,westRamp:{samples:rampNodes.length,connectedCrossingSamples:rampComponent.size,isolatedTipSamples:rampNodes.length-rampComponent.size,mainConnections:boundary.main.length,upperConnections:boundary.upper.length,mainExample:boundary.main[0],upperExample:boundary.upper[0],removalDisconnectsUpper:true},hearth:{seat:rest.position,furnace:FURNACE_POSITION,halfWidth:hearthHalfWidth,alongRange:hearthRange,protectedSamples:protectedNodes.size,seatAlignment,fireAlignment},routes:routeChecks,scope:'Art-layout geometry with oriented conservative device/remnant footprints and authored environment footprints; exact anchor foot clearance, 1.50m direct western work corridors, a 1.80m landing turn, 1.20m common-route alternatives, robust hearth detour margins, complete low remnant support and sole-ramp connectivity. Not production movement or collision.'};
}
