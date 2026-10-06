import assert from 'node:assert/strict';
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire('/Users/yilungao/coh/package.json');const {buildSync}=require('esbuild');
const root='/Users/yilungao/coh', dir='/tmp/r100-i11-geometry-fixture';fs.mkdirSync(dir,{recursive:true});
const geometry=fs.readFileSync(root+'/src/generation/world-study/native-volume-geometry.ts','utf8');
buildSync({stdin:{contents:geometry+'\nexport { MeshBuilder };',resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:dir+'/builder.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
buildSync({entryPoints:['/tmp/native-volume-organized.ts'],outfile:dir+'/organized.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
buildSync({stdin:{contents:"export { compileNativeVolumeRaster } from './native-volume-raster'; export { NativeBodyCollision } from './native-body-collision';",resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:dir+'/sampling.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {MeshBuilder}=await import(dir+'/builder.mjs'), built=await import(dir+'/organized.mjs');const {compileNativeVolumeRaster,NativeBodyCollision}=await import(dir+'/sampling.mjs');
const results=[];
for(const [name,build]of Object.entries(built)){
 for(const [length,width,height,blocking]of [[90,90,35,1],[160,120,54,1],[240,170,68,1],[180,140,5,0]]){
  const spec={id:1,family:name==='buildPorousBreak'?'granular-ridge':'membrane-rim',seed:20261005,x:240,y:240,rotation:0,length,width,height,thickness:10,fold:.6,branches:3,opening:.7,distortion:.3,blocking};
  const builder=new MeshBuilder(spec);build(builder);const mesh=builder.finish();
  assert([...mesh.positions,...mesh.normals,...mesh.uv].every(Number.isFinite));assert(mesh.triangleCount<600);
  assert.equal(mesh.joints.length,blocking);assert.equal(mesh.materials.includes(3),!!blocking);
  const raster=compileNativeVolumeRaster([mesh],{x:0,y:0,width:480,height:480,opticalHeight:16});
  const floor={cols:60,rows:60,tileSize:8,tiles:Array.from({length:60},()=>Array(60).fill(0))};
  const body=new NativeBodyCollision({meshes:[mesh],definition:{instances:[{id:1,role:blocking?'solid':'relief'}]}},floor);
  let innerFaces=0,minInnerHeight=Infinity,innerPixels=0;
  for(let i=0;i<mesh.triangleCount;i++)if(mesh.materials[i]===2){innerFaces++;for(let j=0;j<3;j++)minInnerHeight=Math.min(minInnerHeight,mesh.positions[mesh.indices[i*3+j]*3+2]);}
  const visited=new Set(),components=[];
  for(const pixel of raster.occupiedPixels)if(raster.material[pixel]===2){innerPixels++; if(!visited.has(pixel)){
    const list=[pixel];visited.add(pixel);let minX=480,maxX=0,minY=480,maxY=0;
    for(let at=0;at<list.length;at++){const p=list[at],x=p%480,y=Math.floor(p/480);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      for(const d of[-1,1,-480,480]){const q=p+d;if(q>=0&&q<480*480&&raster.material[q]===2&&!visited.has(q)){visited.add(q);list.push(q);}}
    }
    components.push({pixels:list.length,width:maxX-minX+1,height:maxY-minY+1});
  }}
  if(name==='buildPorousBreak'){
    assert.equal(components.length,6,'six sealed cavities, no repeated open cells');assert(minInnerHeight>0,'pore floors remain material above ground');
    for(const p of components){assert(p.width<20&&p.height<20,'small pore cannot read as whole-body opening');assert(p.pixels>0);}
    assert(raster.occupiedPixels.filter(p=>raster.material[p]===0).length/raster.occupiedPixels.length>.55,'intact skin owns the quiet majority');
    for(const p of raster.occupiedPixels)if(raster.material[p]===2)assert.equal(body.supports({x:p%480+.5,y:Math.floor(p/480)+.5},10,10),!blocking,'sealed pore belongs to its solid/relief body');
  }
  results.push({name,length,width,height,blocking,triangles:mesh.triangleCount,innerFaces,minInnerHeight:Number.isFinite(minInnerHeight)?minInnerHeight:null,innerPixels,pores:components});
 }
}
const report={status:'PASS',scope:'Unregistered isolated geometry fixture using the existing MeshBuilder exported only in the temporary QA bundle. No world, recipe, normal visual, material or runtime-admission claim.',sourceSha256:createHash('sha256').update(fs.readFileSync('/tmp/native-volume-organized.ts')).digest('hex'),results};fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
