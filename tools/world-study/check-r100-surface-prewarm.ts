import { createRiftHostManifest } from '../../src/systems/rift-host-manifest';
import { createContaminantSourceRegions } from '../../src/generation/contaminant-source-regions';
import { selectMasterSourceCells } from '../../src/systems/r100-world/source-cells';
/** The frozen original GL-upload constructor is the pixel oracle. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { PAINTED_MATERIALS } from '../../src/generated/r100-materials';
import { NativeVolumeLighting } from '../../src/generation/world-study/native-volume-raster';
import { paintMasterGround } from '../../src/systems/r100-world/ground';
import { masterVolumePalette } from '../../src/systems/r100-world/surface-bake';
import { MasterSurfaceRenderer as OriginalRenderer } from './fixtures/r100-surface-before-prewarm';
import { executeR100SurfacePreparation, validateR100SurfacePreparation, type R100SurfacePreparationInput, type R100SurfacePreparationRequest, type R100SurfacePreparationResponse } from '../../src/systems/r100-world/surface-preparation';
import { R100SurfacePreparationClient, type R100SurfaceWorkerPort } from '../../src/systems/r100-world/surface-preparation-client';
import { bakePaintGenome } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { paintGenomePreparationKey } from '../../src/entities/form-renderers/d/paint-genome/prepared';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { mix32 } from '../../src/generation/seed-fork';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system';
import { TileGrid } from '../../src/systems/tile-grid';
import type { PaintedMaterial } from '../../src/systems/r100-world/painted-material';
const rows=[];let hostComparisons=0;
const paintByFamily=new Map<string,PaintedMaterial>();
for(const row of PAINTED_MATERIALS){
 const decode=async(def:{source:string;logical_pixels:number;world_size:number;regions:unknown})=>{
  const pixels=await sharp(`public${def.source}`).resize(def.logical_pixels,def.logical_pixels).ensureAlpha().raw().toBuffer();
  return {width:def.logical_pixels,height:def.logical_pixels,worldSize:def.world_size,source:def.source,regions:def.regions,pixels:new Uint8ClampedArray(pixels)};
 };
 const ground=await decode(row),solid=await decode(row.solid);
 paintByFamily.set(row.family,{...ground,solid:{...solid,skinRoughness:row.solid.skinRoughness,cutRoughness:row.solid.cutRoughness,gain:row.solid.gain,cutGain:row.solid.cutGain}} as PaintedMaterial);
}
let uploads:Uint8Array[]=[];
const gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),createTexture:()=>({}),getAttribLocation:()=>0,getUniformLocation:()=>({}),getExtension:()=>({loseContext(){}}),
 texImage2D(...args:unknown[]){uploads.push((args.at(-1) as Uint8Array).slice());},
},{get(target,key){return key in target?Reflect.get(target,key):/^[A-Z0-9_]+$/.test(String(key))?0:()=>{};}});
Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:()=>gl})}});
let sample:R100SurfacePreparationInput|undefined;
for(const id of ['ash-strata','crystal-fibre','ivory-basin','cinder-ridge','pallid-membrane','silt-gel','grain-laminate','tension-membrane','shell-gel-delta']){
 const recipe=createR100ProductionRecipe(id,3390232493,'severe'),map=createR100ProductionMap(recipe),native=map.native!;
 const world=hydrateR100MasterWorld(native,map.layout),families=[...new Set([native.definition.family,...native.definition.instances.map(i=>i.family??native.definition.family)])];
 const painting={...paintByFamily.get(native.definition.family)!,families:Object.fromEntries(families.map(f=>[f,paintByFamily.get(f)!]))};
 uploads=[];
 const old=new OriginalRenderer(world,paintMasterGround(world),new NativeVolumeLighting(world.raster,masterVolumePalette(world),{seed:world.sample.seed,axis:world.definition.axis}),painting);
 const input={native,layout:map.layout,painting};sample??=input;
 const prepared=executeR100SurfacePreparation(structuredClone(input)),actual=prepared.surface;
 validateR100SurfacePreparation(prepared,input);
 assert.deepEqual(prepared.gameplay.hostManifest,createRiftHostManifest(map.layout,map.hostTileMap),'prepared admission preserves original full-bake target traversal and nuclei');
 assert.deepEqual(prepared.gameplay.sourceCells,selectMasterSourceCells(world),'prepared source cells preserve original emitter choice');
 assert.deepEqual(prepared.gameplay.sourceRegions,createContaminantSourceRegions({grid:new TileGrid(map.layout.tileMap),spawn:map.layout.spawnPoint,nodes:[...map.layout.kindlingNodes,...map.layout.contaminantNodes],seed:map.layout.seed}),'prepared BFS preserves every source tag/hint');
 const wrongManifest=structuredClone(prepared);(wrongManifest.gameplay.hostManifest.targets as string[]).push('core:FOREIGN:0');
 assert.throws(()=>validateR100SurfacePreparation(wrongManifest,input),/manifest differs/);
 const missingEmitter=structuredClone(prepared);(missingEmitter.gameplay.sourceCells as unknown[]).pop();
 assert.throws(()=>validateR100SurfacePreparation(missingEmitter,input),/source cell differs/);
 const missingRegion=structuredClone(prepared);(missingRegion.gameplay.sourceRegions as Map<string,unknown>).delete(map.layout.kindlingNodes[0]!.id);
 assert.throws(()=>validateR100SurfacePreparation(missingRegion,input),/source region differs/);
 const wrongGameplay={...prepared,gameplay:{...prepared.gameplay,identity:'another-seed'}};
 assert.throws(()=>validateR100SurfacePreparation(wrongGameplay,input),/gameplay does not match/);

 // Use real Host identities, rather than repeating the preparer's slot loop.
 const graphic:unknown=new Proxy({},{get:()=>()=>graphic}),scene={add:{graphics:()=>graphic}};
 const hosts=new ContaminationHostSystem();
 hosts.create(scene as never,{...map.layout,tileMap:map.hostTileMap},null,null,()=>1,{liveMotion:true,occluders:new TileGrid(map.hostTileMap),sightGrid:world.sight});
 const actualHosts=hosts.getSubjects().filter(subject=>subject.form.portfolio==='bing');
 assert.equal(prepared.paintHosts.length,actualHosts.length);
 for(const subject of actualHosts){
  const form=subject.form,seed=mix32(map.layout.seed,subject.id);
  const request={substrate:form.substrate,coverage:form.coverage,seed,continuity:form.continuity,sense:form.lexemes.sense,rhythm:form.lexemes.rhythm,fragmentTypeId:map.layout.fragmentTypeId,veinVariant:resolvePaintVeinVariant(form.substrate,seed),geometryVersion:2 as const};
  const row=prepared.paintHosts.find(candidate=>candidate.key===paintGenomePreparationKey(request));assert(row,`actual Host ${subject.id} owns one prepared bake`);
  assert.deepEqual(row.baked,bakePaintGenome(request),'all pixels, growth axes, danger and full breathing footprint equal original Host bake');hostComparisons++;
  for(const field of Object.keys(request) as Array<keyof typeof request>){
   const altered={...request,[field]:String(request[field])+'-foreign'};
   assert.notEqual(paintGenomePreparationKey(altered as never),row.key,`Host key includes ${field}`);
  }
 }
 hosts.destroy();
 if(prepared.paintHosts.length>1){
  const changed={...prepared,paintHosts:[...prepared.paintHosts].reverse()};
  assert.throws(()=>validateR100SurfacePreparation(changed,input),/Host does not match/);
 }
 const foreignHost={...prepared,paintHosts:prepared.paintHosts.map((row,index)=>index?row:{...row,key:'another-host'})};
 assert.throws(()=>validateR100SurfacePreparation(foreignHost,input),/Host does not match/);
 assert.equal(uploads.length,4);
 const buffers=[actual.albedo,actual.normal,actual.response,actual.emission];
 buffers.forEach((pixels,index)=>assert.deepEqual(pixels,uploads[index],`${id} texture ${index}: prewarm must not change a byte`));
 const result=structuredClone(actual,{transfer:buffers.map(b=>b.buffer)});
 assert(buffers.every(b=>b.byteLength===0));assert(result.albedo.length>0);
 rows.push({world:id,seed:map.layout.seed,width:actual.width,height:actual.height,textureSHA256:uploads.map(b=>createHash('sha256').update(b).digest('hex'))});old.destroy();
}
class ControlledWorker implements R100SurfaceWorkerPort {
 onmessage:((event:MessageEvent<R100SurfacePreparationResponse>)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;onmessageerror:((event:MessageEvent)=>void)|null=null;
 request!:R100SurfacePreparationRequest;terminated=false;
 postMessage(request:R100SurfacePreparationRequest):void{this.request=request;}
 terminate():void{this.terminated=true;}
}
let worker:ControlledWorker;const factory=()=>worker=new ControlledWorker();
const client=new R100SurfacePreparationClient(factory,1000),controller=new AbortController();
const waiting=client.prepare(sample!,controller.signal),rejection=assert.rejects(waiting,{name:'AbortError'});controller.abort();await rejection;
assert(worker!.terminated);assert.equal(worker!.onmessage,null);
const timed=new R100SurfacePreparationClient(factory,1).prepare(sample!);await assert.rejects(timed,{name:'TimeoutError'});assert(worker!.terminated);
const malformed=client.prepare(sample!);const bad=assert.rejects(malformed,/does not match/);
worker!.onmessage!({data:{id:worker!.request.id,result:{identity:'foreign',surface:{}}}} as MessageEvent<R100SurfacePreparationResponse>);await bad;assert(worker!.terminated);
const failed=client.prepare(sample!),failure=assert.rejects(failed,/deliberate/);worker!.onerror!({message:'deliberate'} as ErrorEvent);await failure;assert(worker!.terminated);
const out='docs/qa/artifacts/r100-i03/surface-prewarm';mkdirSync(out,{recursive:true});
writeFileSync(`${out}/report.json`,JSON.stringify({status:'passed',scope:'Original constructor vs Worker pure bake, same decoded material input; does not substitute GPU rendered visual review.',rows,hostComparisons,checks:['9 admission manifests, emitter lists and source-region maps equal original functions','foreign manifest, missing emitter, missing source region and foreign gameplay identity rejected','exact real Host identity and complete original bake equality','Host keys cover every bake parameter','foreign and reordered Host preparations rejected','36 RGBA texture buffers byte-identical','transfer detaches only outgoing derived buffers','abort terminates Worker','timeout terminates Worker','foreign result rejected','Worker error cleanup']},null,2)+'\n');
console.log(`PASS 9 worlds / 36 original RGBA buffers byte-identical; ${hostComparisons} real Host identities + full bake equality; Worker abort/timeout/identity/error lifecycle`);
