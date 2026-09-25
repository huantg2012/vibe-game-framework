import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import sharp from 'sharp';
import {buildHaven} from './scene.ts';
import {WALK_SURFACES} from './environment.ts';
import {ACTOR_OBJECT_ID,actorLampAnchor} from './actor.ts';
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
const {model,stations}=buildHaven();
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
if(process.argv.includes('--renderer-only')){console.log(JSON.stringify({rendererRegression,omniRegression},null,2));process.exit(0);}
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

async function pixels(filename){
 const {data,info}=await sharp(path.join(assetDir,filename)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,manifest.camera.width,`${filename}: wrong width`);
 assert.equal(info.height,manifest.camera.height,`${filename}: wrong height`);
 assert.equal(info.channels,4,`${filename}: not RGBA`);
 return data;
}
const [motion,objects,depth,...contributions]=await Promise.all(['motion-map.png','object-ids.png','depth-layers.png',...families.map(k=>`light-${k}.png`)].map(pixels));
const W=manifest.camera.width,H=manifest.camera.height,N=W*H;
const visibleSources={pollution:0,furnace:0,shoulder:0},visiblePollution=new Map(),outsidePollution={far:0,middle:0,near:0};
for(let i=0;i<N;i++){
 const o=i*4,layer=motion[o],object=motion[o+1],source=motion[o+2];
 assert(layer<=4&&object<=ACTOR_OBJECT_ID&&source<=3,`Invalid motion code at ${i}`);
 assert.equal(object,objects[o],`Motion/object masks disagree at ${i}`);
 assert.equal(layer,depth[o+2],`Motion/depth layers disagree at ${i}`);
 if(!source)continue;
 assert(layer>0,`A material emitter cannot exist in empty sky at ${i}`);
 visibleSources[families[source-1]]++;
 if(source===1){
  assert(object<=6,`Pollution emitter assigned to the player at ${i}`);
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
const energyAtlasChecks={dimensions:[atlas.info.width,atlas.info.height],frames:8,distinctFrames:new Set(frameHashes).size,coreBodyPixels,changingInteriorPixels,densityPixels,transparentHaloPixels,boundedSupport:true,staticCompositeMatches:true};

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
const triangles=WALK_SURFACES.flatMap(surface=>ShapeUtils.triangulateShape(surface.points.map(p=>new Vector2(p[0],p[2])),[]).map(face=>({points:face.map(i=>surface.points[i]),id:surface.id})));
function elevation(x,z){
  let height=-Infinity,id='';
  for(const t of triangles){const [a,b,c]=t.points,det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(det)<1e-9)continue;
    const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det,w=1-u-v;
    if(u<0||v<0||w<0)continue;const y=u*a[1]+v*b[1]+w*c[1];if(y>height){height=y;id=t.id;}
  }return {height,id};
}
// Conservative foot clearance against six station mounting footprints, the
// furnace and the shelf returns. This checks this art layout, not game physics.
const obstacles=stations.filter(s=>s.key!=='rift').map(s=>{
 const ts=model.triangles.filter(t=>t.object===s.id&&Math.min(t.a[1],t.b[1],t.c[1])<s.position[1]+.65);
 const ps=ts.flatMap(t=>[t.a,t.b,t.c]);
 return {x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),z0:Math.min(...ps.map(p=>p[2])),z1:Math.max(...ps.map(p=>p[2])),y:s.position[1]};
});
obstacles.push({x0:7.15,x1:8.85,z0:5.35,z1:6.65,y:0});
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
for(const id of ['west-ramp','east-ramp'])assert([...seen].some(i=>nodes.get(i).id===id),`${id}: unreachable`);
assert.equal(seen.size,nodes.size,'Standable samples contain a disconnected floor island');
const riftSourceHashes=Object.fromEntries(['player-sprite-dense.ts','player-sprite.ts'].map(name=>{
 const source=`src/entities/${name}`,filename=path.resolve(here,'../../../..',source);
 return [source,createHash('sha256').update(fs.readFileSync(filename)).digest('hex')];
}));
const result={strictModules:files.length,finiteTriangles:model.triangles.length,stations:reached,reachableSamples:seen.size,totalStandableSamples:nodes.size,allStandableSamplesConnected:true,footRadius:radius,samplingStep:step,ramps:['west-ramp','east-ramp'],sourceChecks:{families,uniqueSourceIds:model.lights.length,actorShoulderSources:shoulder.length,fields:fieldChecks,rendererRegression,omniRegression,riftSourceHashes},motionMasks:{dimensions:[W,H],visibleSources,stationPollution,outsidePollution,energyAtlas:energyAtlasChecks},scope:'Source definitions, exported masks, finite source support and independent receiver/occluder and omnidirectional fixtures; art layout with conservative station/furnace footprints. Pixel counts record presence, not artistic quality. Does not claim production collision or gameplay integration.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--write'))fs.writeFileSync(path.join(here,'assets','layout-check.json'),JSON.stringify(result,null,2)+'\n');
