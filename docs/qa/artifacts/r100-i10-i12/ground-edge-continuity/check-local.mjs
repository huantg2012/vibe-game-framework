import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import sharp from 'sharp';
const root=process.cwd(),baseOut=path.dirname(new URL(import.meta.url).pathname),out=process.argv[2]?path.resolve(process.argv[2]):baseOut,edge='src/generation/world-study/native-volume-ground-edge.ts';
fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>JSON.stringify(v,(_k,x)=>ArrayBuffer.isView(x)?{type:x.constructor.name,bytes:Buffer.from(x.buffer,x.byteOffset,x.byteLength).toString('base64')}:x instanceof Map?[...x.entries()]:typeof x==='function'?undefined:x);
const inputs=['data/rift-native-worlds.csv','src/generated/r100-native-worlds.ts',edge,'src/generation/world-study/native-volume-geometry.ts','src/generation/world-study/native-volume-ground.ts','src/systems/r100-world/surface-bake.ts'];
const inputHashes=Object.fromEntries(inputs.map(p=>[p,sha(fs.readFileSync(p))]));
const entry=`export {createMasterWorld} from './r100-master-world';export {NativeBodyCollision} from './native-body-collision';export {buildNativeVolume} from './native-volume-geometry';export {compileNativeVolumeRaster,NativeVolumeLighting} from './native-volume-raster';export {R100_NATIVE_WORLDS} from '../../generated/r100-native-worlds';export {POLLUTION_GRADE_DEFINITIONS} from '../../generated/rift-pollution-grade-data';export {R100_WORLD_APPEARANCES} from '../../generated/r100-world-appearance';export {PAINTED_MATERIALS} from '../../generated/r100-materials';export {bakeMasterSurface,masterVolumePalette} from '../../systems/r100-world/surface-bake';export {paintMasterGround} from '../../systems/r100-world/ground';`;
for(const tag of ['before','after'])await build({stdin:{contents:entry,resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:out+'/'+tag+'.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent',tsconfig:root+'/tsconfig.json',plugins:tag==='before'?[{name:'previous-edge-only',setup(b){b.onLoad({filter:/native-volume-ground-edge\.ts$/},()=>({contents:fs.readFileSync(baseOut+'/before.ts.txt','utf8'),loader:'ts',resolveDir:root+'/src/generation/world-study'}));}}]:[]});
const before=await import(out+'/before.mjs'),after=await import(out+'/after.mjs');
const rows=after.R100_NATIVE_WORLDS,selected=rows.filter(w=>w.definitions.some(d=>d.instances.some(i=>i.groundEdgeWidth)));
const unaffected=[];
for(const row of rows.filter(w=>!selected.includes(w)))for(const d of row.definitions){for(const i of d.instances){const {role,...spec}=i,params={...spec,family:i.family??d.family,blocking:role==='solid'?1:0,seed:20261005^Math.imul(i.id,104729)};assert.equal(canonical(before.buildNativeVolume(params)),canonical(after.buildNativeVolume(params)));}unaffected.push(row.id+'/'+d.grade);}
const paintings=new Map();
for(const p of after.PAINTED_MATERIALS){const decode=async s=>({width:s.logical_pixels,height:s.logical_pixels,pixels:new Uint8ClampedArray(await sharp('public'+s.source).resize(s.logical_pixels,s.logical_pixels).ensureAlpha().raw().toBuffer()),worldSize:s.world_size,source:s.source,regions:s.regions});paintings.set(p.family,{...await decode(p),solid:{...await decode(p.solid),skinRoughness:p.solid.skinRoughness,cutRoughness:p.solid.cutRoughness,gain:p.solid.gain,cutGain:p.solid.cutGain}});}
const light={x:500,y:700,z:110,radius:1100,intensity:2.1,color:[1,.98,.95],castsShadow:false};
async function picture(api,world,row,tag){
 const painting={...paintings.get(world.definition.family),families:Object.fromEntries(paintings)},volume=new api.NativeVolumeLighting(world.raster,api.masterVolumePalette(world),{seed:world.sample.seed,axis:world.definition.axis}),ground=api.paintMasterGround(world),bake=api.bakeMasterSurface(world,ground,volume,painting);
 for(const p of world.raster.occupiedPixels){for(let c=0;c<3;c++){volume.albedo[p*3+c]=bake.albedo[p*4+c];volume.shadingNormals[p*3+c]=bake.normal[p*4+c]/255*2-1;volume.emission[p*3+c]=bake.emission[p*4+c];}volume.roughness[p]=bake.response[p*4]/255;}
 const pixels=new Uint8ClampedArray(1024*768*4);volume.render([light],pixels,{ambient:.18,emissionScale:.6});
 // Fill only unoccupied substrate using the same fixed diagnostic lamp. These
 // CPU figures intentionally omit tactical FOV, actors/HUD and postprocessing.
 for(let p=0;p<1024*768;p++){if(!world.matterAt(p%1024,Math.floor(p/1024))){pixels.set([9,9,9,255],p*4);continue;}if(pixels[p*4+3])continue;const x=p%1024+.5,y=Math.floor(p/1024)+.5,dx=light.x-x,dy=light.y-y,dz=light.z-ground.heightField[p],len=Math.hypot(dx,dy,dz);const n=[0,1,2].map(c=>bake.normal[p*4+c]/255*2-1),gain=.18+Math.max(0,(n[0]*dx+n[1]*dy+n[2]*dz)/len)*light.intensity*Math.max(0,1-len/light.radius)**2;for(let c=0;c<3;c++)pixels[p*4+c]=Math.min(255,bake.albedo[p*4+c]*gain+bake.emission[p*4+c]*.6);pixels[p*4+3]=255;}
 const name=row.id+'-'+tag+'.png';await sharp(pixels,{raw:{width:1024,height:768,channels:4}}).png().toFile(out+'/'+name);
 return {image:name,sha256:sha(fs.readFileSync(out+'/'+name)),surface:Object.fromEntries(['albedo','normal','response','emission'].map(k=>[k,sha(bake[k])]))};
}
const cases=[];
for(const row of selected)for(const d of row.definitions){const start=performance.now(),frozen={profile:row.profile,grade:after.POLLUTION_GRADE_DEFINITIONS.find(g=>g.id===d.grade)},A=before.createMasterWorld(d,20261005,frozen),B=after.createMasterWorld(d,20261005,frozen);
 assert.equal(canonical(A.layout),canonical(B.layout));assert.equal(canonical(A.hostTileMap),canonical(B.hostTileMap));assert.equal(canonical(A.pollution),canonical(B.pollution));
 const owner=d.instances.find(i=>i.groundEdgeWidth).id;
 const am=A.meshes.find(m=>m.spec.id===owner),bm=B.meshes.find(m=>m.spec.id===owner),{groundEdgeWidth,...bare}=am.spec,base=after.buildNativeVolume(bare);
 assert.deepEqual(am.positions.subarray(0,base.positions.length),bm.positions.subarray(0,base.positions.length),'owner base position XYZ must not rescale');
 assert.deepEqual(am.normals.subarray(0,base.normals.length),bm.normals.subarray(0,base.normals.length),'owner base normals exact');assert.equal(canonical(A.meshes.filter(m=>m.spec.id!==owner)),canonical(B.meshes.filter(m=>m.spec.id!==owner)));
 const AB=new before.NativeBodyCollision(A,A.layout.tileMap),BB=new after.NativeBodyCollision(B,B.layout.tileMap);let centers=0,sweeps=0;
 for(let y=4;y<768;y+=8)for(let x=4;x<1024;x+=8){const p={x,y};assert.equal(AB.supports(p,10,10),BB.supports(p,10,10));centers++;for(const [dx,dy]of[[8,0],[0,8]]){assert.equal(AB.displacementFraction(p,10,10,dx,dy),BB.displacementFraction(p,10,10,dx,dy));sweeps++;}}
 let changedHeightPixels=0,changedNormalPixels=0,changedVisualOccupancyPixels=0;for(let p=0;p<1024*768;p++){if(A.raster.heightField[p]!==B.raster.heightField[p])changedHeightPixels++;if([0,1,2].some(c=>A.raster.normals[p*3+c]!==B.raster.normals[p*3+c]))changedNormalPixels++;if(A.raster.matter[p]!==B.raster.matter[p])changedVisualOccupancyPixels++;}
 let pictures;if(d.grade==='medium'){for(const w of[A,B]){w.appearance=after.R100_WORLD_APPEARANCES.find(a=>a.worldId===row.id);w.algorithmRevision=6;}pictures={before:await picture(before,A,row,'before'),after:await picture(after,B,row,'after')};}
 const result={world:row.id,grade:d.grade,seed:20261005,fullBodyCentersExact:centers,fullBody8pxSweepsExact:sweeps,terrainLayoutHostPollutionExact:true,nonOwnerMeshesExact:true,ownerFormationPositionsNormalsExact:true,groundEdgeOwner:owner,changedHeightPixels,changedNormalPixels,changedVisualOccupancyPixels,pictures,durationMs:performance.now()-start};cases.push(result);console.log('PASS',row.id,d.grade,Math.round(result.durationMs)+'ms');
}
// The explicit regression actually fails on the original centre-fan geometry.
const spec={id:1,family:'folded-slab',seed:1,x:80,y:80,rotation:.67,length:32,width:24,height:6,thickness:2,fold:.5,opening:.5,branches:3,distortion:.2,blocking:0,constructionVersion:4,shapeProfile:'fracture-fan',groundEdgeWidth:8};
const context={polygons:[[{x:240,y:64},{x:320,y:64},{x:320,y:192},{x:240,y:192}]],width:400,height:256,matterAt:(x,y)=>!(x>=240&&x<320&&y>=64&&y<192)};
const ranges={};for(const[tag,api]of[['before',before],['after',after]]){const raster=api.compileNativeVolumeRaster([api.buildNativeVolume(spec,context)],{x:0,y:0,width:400,height:256,opticalHeight:24}),v=Array.from({length:96},(_,i)=>raster.heightField[(i+80)*400+236]);ranges[tag]=Math.max(...v)-Math.min(...v);}assert(ranges.before>.5&&ranges.after<1e-4,'regression must reject the original repeated pyramid ridge');
const sourceAfter=Object.fromEntries(inputs.map(p=>[p,sha(fs.readFileSync(p))]));assert.deepEqual(sourceAfter,inputHashes,'source mutated during controlled comparison');
const report={status:'focused-geometry-body-and-cpu-sample-pass',scope:'Current catalog on both executors; only old vs new ground-edge implementation differs. Includes art offset author repair in both, so no conflation. Author-local seed, not production gameplay nor normal FOV art approval.',source:inputHashes,oldEdgeSha256:sha(fs.readFileSync(baseOut+'/before.ts.txt')),unaffectedWorldGradeMeshExact:unaffected.length,unaffectedWorlds:[...new Set(unaffected.map(v=>v.split('/')[0]))],oldPyramidRegression:ranges,cases,cpuImageMethod:'Current original source PNG ->512 preparation using sharp, current material regions and appearance via production surface bake, same native lighting/fixed lamp; no FOV/HUD/actors, shadow disabled in diagnostic lamp. Not an actual game screenshot.',light};
fs.writeFileSync(out+'/local-report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log('PASS',cases.length,'affected author cases;',unaffected.length,'unaffected grade geometry; original pyramid regression rejected');
