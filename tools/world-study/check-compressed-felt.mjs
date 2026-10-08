/** P34 isolated same-body/light geometry study; never a normal-world approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildSync } from 'esbuild';
import sharp from 'sharp';
const root=process.cwd(),out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i10-i12/p34-short-fibre/geometry-v3');fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourceFile='docs/qa/artifacts/r100-i10-i12/p34-short-fibre/candidate-tools/compressed-felt-v3/native-volume-compressed-felt.ts';
const geometryFile='src/generation/world-study/native-volume-geometry.ts';
const geometry=fs.readFileSync(geometryFile,'utf8');
buildSync({stdin:{contents:geometry+'\nexport { MeshBuilder };',resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:out+'/builder.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
buildSync({stdin:{contents:"export { buildCompressedFelt } from '../../../docs/qa/artifacts/r100-i10-i12/p34-short-fibre/candidate-tools/compressed-felt-v3/native-volume-compressed-felt.ts'; export { buildCompressedWedge,smoothOrganizedSurface } from './native-volume-organization';export { compileNativeVolumeRaster,NativeVolumeLighting } from './native-volume-raster';export { NativeBodyCollision } from './native-body-collision';export { mapWorldPigment,paintedToneRange } from './world-material-pigment';export { R100_WORLD_APPEARANCES } from '../../generated/r100-world-appearance'; export { ORGANIZATION_MATERIALS } from '../../generated/r100-material-organizations'; export { prepareOrganizationSurfaceWindows,organizationSampleIndex } from '../../systems/r100-world/organization-sampling';",resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:out+'/study.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {MeshBuilder}=await import(out+'/builder.mjs');
const {buildCompressedFelt,buildCompressedWedge,smoothOrganizedSurface,compileNativeVolumeRaster,NativeVolumeLighting,NativeBodyCollision,mapWorldPigment,paintedToneRange,R100_WORLD_APPEARANCES,ORGANIZATION_MATERIALS,prepareOrganizationSurfaceWindows,organizationSampleIndex}=await import(out+'/study.mjs');
const source='docs/qa/artifacts/r100-i10-i12/p34-short-fibre/source-v4/short-fibre-solid.png';
const definition=ORGANIZATION_MATERIALS.find(r=>r.organization==='short-fibre').solid;
const painting={width:512,height:512,pixels:new Uint8ClampedArray(await sharp(source).resize(512,512).ensureAlpha().raw().toBuffer()),worldSize:900,source,regions:definition.regions};
const range=paintedToneRange(painting),width=360,height=320;
const palette={base:[140,130,115],dark:[70,70,70],light:[190,190,180],roughness:.86,structure:0};
const map={cols:45,rows:40,tileSize:8,tiles:Array.from({length:40},()=>Array(45).fill(0))};
const results=[];
for(const [worldId,rotation] of [['short-fibre-mat',0],['felt-wedges',Math.PI/2]]){
 const spec={id:1,family:'membrane-rim',constructionVersion:4,shapeProfile:'compressed-wedge',blocking:1,seed:20261005,x:180,y:158,length:220,width:160,height:55,thickness:10,fold:.6,branches:3,opening:.7,distortion:.3,rotation};
 let structure;
 const meshes=[buildCompressedWedge,buildCompressedFelt].map(fn=>{const b=new MeshBuilder(spec);const stats=fn(b);if(stats)structure=stats;return smoothOrganizedSurface(b.finish());});
 const [before,after]=meshes;
 assert(after.triangleCount<=600);const bundles=structure.groups;assert(bundles>=8&&bundles<=10);assert(structure.branches>=18&&structure.branches<=30);assert.equal(after.triangleCount-before.triangleCount,structure.branches*8,'six narrow skin triangles plus two real tip triangles per branch');
 assert.deepEqual(after.bounds,before.bounds);assert.deepEqual(after.joints,before.joints);
 assert.deepEqual(after.positions.slice(0,before.positions.length),before.positions,'whole base and its maximum height remain exact');
 assert.deepEqual(after.uv.slice(0,before.uv.length),before.uv);
 for(const m of meshes){assert([...m.positions,...m.normals,...m.uv].every(Number.isFinite));for(let i=0;i<m.normals.length;i+=3)assert(Math.abs(Math.hypot(...m.normals.slice(i,i+3))-1)<1e-5);}
 const rasters=meshes.map(m=>compileNativeVolumeRaster([m],{x:0,y:0,width,height,opticalHeight:16}));
 assert.deepEqual(rasters[1].occupiedPixels,rasters[0].occupiedPixels,'XY support must be pixel exact');
 const body=meshes.map(mesh=>new NativeBodyCollision({meshes:[mesh],definition:{instances:[{id:1,role:'solid'}]}},map));let bodyPoints=0;
 for(let y=20;y<height-20;y+=5)for(let x=20;x<width-20;x+=5){assert.equal(body[1].supports({x,y},10,10),body[0].supports({x,y},10,10));bodyPoints++;}
 let changedPixels=0,maxRise=0,beforeMarkers=0,afterMarkers=0,newCutPixels=0;
 for(const p of rasters[0].occupiedPixels){const rise=rasters[1].heightField[p]-rasters[0].heightField[p];if(rise>.05)changedPixels++;maxRise=Math.max(maxRise,rise);if(rasters[0].material[p]===3)beforeMarkers++;if(rasters[1].material[p]===3)afterMarkers++;if(rasters[1].material[p]===1&&rasters[0].material[p]!==1)newCutPixels++;}
 assert.equal(afterMarkers,beforeMarkers,'original visible fracture is not covered');assert(maxRise<=3.01&&maxRise>=2);assert(changedPixels>=300,'narrow branches retain visible native area while exposing parent skin between groups');assert(newCutPixels>=10,'small separated terminal slopes have native area; broad former patch-cut threshold is inapplicable to 3–5px branches');
 const appearance=R100_WORLD_APPEARANCES.find(r=>r.worldId===worldId),images=[];
 for(let i=0;i<meshes.length;i++){
  const mesh=meshes[i],r=rasters[i],windows=prepareOrganizationSurfaceWindows([mesh],'membrane-rim',painting).get(1).ground;
  const lighting=new NativeVolumeLighting(r,{outer:palette,cut:palette,inner:palette,joint:palette}),mapped=new Float32Array(3);
  for(const p of r.occupiedPixels){const cut=r.material[p]===1||r.region[p]===3;const at=organizationSampleIndex(windows[cut?'cleaved':'skin'],r.uv[p*2],r.uv[p*2+1]);mapWorldPigment(appearance,cut?'cleaved':'solid',painting.pixels[at],painting.pixels[at+1],painting.pixels[at+2],range,{secondary:0,tone:0,detail:1},0,mapped);for(let c=0;c<3;c++)lighting.albedo[p*3+c]=mapped[c];}
  const output=new Uint8ClampedArray(width*height*4);lighting.render([{x:100,y:278,z:105,radius:390,intensity:2.1,color:[1,.98,.95]}],output,{ambient:.25,emissionScale:0});
  for(let p=0;p<width*height;p++)if(!output[p*4+3])output.set([24,26,30,255],p*4);
  for(let y=278;y<298;y++)for(let x=22;x<42;x++)if(x===22||x===41||y===278||y===297)output.set([150,150,150,255],(y*width+x)*4);
  const name=`${worldId}-${rotation===0?'east':'south'}-${i?'after':'before'}.png`;await sharp(output,{raw:{width,height,channels:4}}).png().toFile(out+'/'+name);
  images.push({path:path.relative(root,out+'/'+name),sha256:sha(fs.readFileSync(out+'/'+name))});
 }
 results.push({worldId,rotation,beforeTriangles:before.triangleCount,afterTriangles:after.triangleCount,bodyPoints,bundles,branches:structure.branches,newCutPixels,changedPixels,maxRise,beforeMarkers,afterMarkers,footprintPixels:rasters[0].occupiedPixels.length,images});
}
const report={status:'isolated-contract-pass-art-pending',scope:'Unregistered module, actual MeshBuilder/raster/native lighting. Same old body retained with 8–10 uneven groups of 2–3 curved rope branches, 3.2–4.8px wide/12–24px long/2.25–2.85px high. Source-v4/world900, appearance and light identical in each pair; no runtime world or FOV claim.',module:{path:sourceFile,sha256:sha(fs.readFileSync(sourceFile))},source:{path:source,sha256:sha(fs.readFileSync(source))},results};
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
