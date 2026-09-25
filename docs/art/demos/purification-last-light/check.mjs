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
import {Model} from './model.ts';
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
if(process.argv.includes('--renderer-only')){console.log(JSON.stringify({rendererRegression},null,2));process.exit(0);}
const {model,stations}=buildHaven();
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
 const energy=model.triangles.filter(t=>t.object===s.id&&t.material==='energy').length,visible=visiblePollution.get(s.id)??0;
 assert(pollutant+energy>0,`${s.key}: missing contained pollutant/energy geometry`);
 assert(visible>0,`${s.key}: its pollution is absent from the exported source mask`);
 return {key:s.key,id:s.id,pollutantTriangles:pollutant,energyTriangles:energy,emittingPixels:visible};
});
assert(model.triangles.some(t=>(t.material==='pollutant'||t.material==='energy')&&t.layer!=='haven'),'Missing exterior contamination geometry');
assert(Object.values(outsidePollution).some(n=>n>0),'Exterior contamination is absent from the source mask');

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
const result={strictModules:files.length,finiteTriangles:model.triangles.length,stations:reached,reachableSamples:seen.size,totalStandableSamples:nodes.size,allStandableSamplesConnected:true,footRadius:radius,samplingStep:step,ramps:['west-ramp','east-ramp'],sourceChecks:{families,uniqueSourceIds:model.lights.length,actorShoulderSources:shoulder.length,fields:fieldChecks,rendererRegression,riftSourceHashes},motionMasks:{dimensions:[W,H],visibleSources,stationPollution,outsidePollution},scope:'Source definitions, exported masks, finite source support and an independent receiver/occluder fixture; art layout with conservative station/furnace footprints. Pixel counts record presence, not artistic quality. Does not claim production collision or gameplay integration.'};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--write'))fs.writeFileSync(path.join(here,'assets','layout-check.json'),JSON.stringify(result,null,2)+'\n');
