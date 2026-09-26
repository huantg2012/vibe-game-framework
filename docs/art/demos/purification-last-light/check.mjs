import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import {buildHaven} from './scene.ts';
import {WALK_SURFACES,FURNACE_BOUNDS} from './environment.ts';
import {ACTOR_OBJECT_ID,actorLampAnchor,seatedActorLampAnchor} from './actor.ts';
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
const triangles=WALK_SURFACES.flatMap(surface=>ShapeUtils.triangulateShape(surface.points.map(p=>new Vector2(p[0],p[2])),[]).map(face=>({points:face.map(i=>surface.points[i]),id:surface.id})));
function elevation(x,z){
  let height=-Infinity,id='';
  for(const t of triangles){const [a,b,c]=t.points,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
    if(u<0||v<0||w<0)continue;const y=u*a[1]+v*b[1]+w*c[1];if(y>height){height=y;id=t.id;}
  }return {height,id};
}
// Conservative foot clearance includes the seat itself and the moved furnace,
// not just the old station layout. This is still an art-layout check.
const obstacles=[...stations.filter(s=>s.key!=='rift'),{id:REST_OBJECT_ID,position:REST_POSITION}].map(s=>{
 const ts=model.triangles.filter(t=>t.object===s.id&&Math.min(t.a[1],t.b[1],t.c[1])<s.position[1]+.65);
 const ps=ts.flatMap(t=>[t.a,t.b,t.c]);
 return {x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),z0:Math.min(...ps.map(p=>p[2])),z1:Math.max(...ps.map(p=>p[2])),y:s.position[1]};
});
obstacles.push(FURNACE_BOUNDS);
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
const step=.16,radius=.22,x0=-5.2,z0=-8.2,nx=128,nz=104,nodes=new Map();
for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
 const x=x0+ix*step,z=z0+iz*step,h=elevation(x,z);if(!Number.isFinite(h.height))continue;
 let clear=true;for(let k=0;k<8;k++){const a=k*Math.PI/4,q=elevation(x+Math.cos(a)*radius,z+Math.sin(a)*radius);if(!Number.isFinite(q.height)||Math.abs(q.height-h.height)>.27){clear=false;break;}}
 if(!clear||obstacles.some(b=>Math.abs(h.height-b.y)<.3&&x>b.x0-radius&&x<b.x1+radius&&z>b.z0-radius&&z<b.z1+radius))continue;
 nodes.set(iz*nx+ix,{x,z,y:h.height,id:h.id});
}
function nearest(p){let best,dist=Infinity;for(const [i,n]of nodes){const d=(n.x-p[0])**2+(n.z-p[2])**2+(n.y-p[1])**2*3;if(d<dist){best=i;dist=d;}}assert(dist<.2,`No clear standing location near ${p}; squared distance ${dist}`);return best;}
const start=nearest([3.8,0,3.8]),queue=[start],seen=new Set(queue);
for(let q=0;q<queue.length;q++){
 const i=queue[q],a=nodes.get(i);for(const d of [-nx,nx,-1,1]){const next=i+d,b=nodes.get(next);if(!b||seen.has(next)||Math.hypot(a.x-b.x,a.z-b.z)>step*1.1||Math.abs(a.y-b.y)>.25)continue;seen.add(next);queue.push(next);}
}
const reached=stations.map(s=>{const i=nearest(s.approach);assert(seen.has(i),`${s.key}: disconnected approach`);return s.key;});
const restNode=nearest(rest.approach);
assert(seen.has(restNode),'The rest approach must remain connected to the actor and six stations');
for(const id of ['west-ramp','east-ramp'])assert([...seen].some(i=>nodes.get(i).id===id),`${id}: unreachable`);
assert.equal(seen.size,nodes.size,'Standable samples contain a disconnected floor island');
const riftSourceHashes=Object.fromEntries(['player-sprite-dense.ts','player-sprite.ts'].map(name=>{
 const source=`src/entities/${name}`,filename=path.resolve(here,'../../../..',source);
 return [source,createHash('sha256').update(fs.readFileSync(filename)).digest('hex')];
}));
const result={strictModules:files.length,finiteTriangles:model.triangles.length,stations:reached,reachableSamples:seen.size,totalStandableSamples:nodes.size,allStandableSamplesConnected:true,footRadius:radius,samplingStep:step,ramps:['west-ramp','east-ramp'],rest:{...restGeometryChecks,approach:rest.approach,reachable:true,supportSamples,bootFloorSamples,exports:restExportChecks},coreFacing:facingRegression,sourceChecks:{families,uniqueSourceIds:model.lights.length,actorShoulderSources:shoulder.length,fields:fieldChecks,coreField:coreFieldChecks,rendererRegression,coreContributionRegression,omniRegression,riftSourceHashes},motionMasks:{dimensions:[W,H],visibleSources,stationPollution,outsidePollution,energyAtlas:energyAtlasChecks},scope:'Source definitions, exported masks, finite source support and independent receiver/occluder and omnidirectional fixtures; art layout with conservative station, rest-remnant and furnace footprints, seated geometry and light anchors. Pixel counts record presence, not artistic quality. Does not claim production collision or gameplay integration.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--write'))fs.writeFileSync(path.join(here,'assets','layout-check.json'),JSON.stringify(result,null,2)+'\n');
