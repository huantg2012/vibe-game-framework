import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const root='/Users/yilungao/coh',require=createRequire(root+'/package.json'),{buildSync}=require('esbuild'),sharp=require('sharp');
const out=path.join(root,'docs/qa/artifacts/r100-i10-i12/i11-geometry-preparation/eight-directions-v4');fs.mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const protect=['src/generation/world-study/native-volume-ground.ts','src/generation/world-study/native-volume-geometry.ts','src/generated/r100-native-worlds.ts','data/rift-native-worlds.csv'];
const sourceBefore=Object.fromEntries(protect.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));
const geometry=fs.readFileSync(path.join(root,protect[1]),'utf8');
buildSync({stdin:{contents:geometry+'\nexport { MeshBuilder };',resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:out+'/builder.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
buildSync({entryPoints:[root+'/src/generation/world-study/native-volume-organization.ts'],outfile:out+'/organized.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
buildSync({stdin:{contents:"export { compileNativeVolumeRaster, NativeVolumeLighting } from './native-volume-raster';export { NativeBodyCollision } from './native-body-collision';export { mapWorldPigment, paintedToneRange } from './world-material-pigment';export { R100_WORLD_APPEARANCES } from '../../generated/r100-world-appearance';export { ORGANIZATION_MATERIALS } from '../../generated/r100-material-organizations';",resolveDir:root+'/src/generation/world-study',loader:'ts'},outfile:out+'/sampling.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent'});
const {MeshBuilder}=await import(out+'/builder.mjs'),profiles=await import(out+'/organized.mjs');
const {compileNativeVolumeRaster,NativeVolumeLighting,NativeBodyCollision,mapWorldPigment,paintedToneRange,R100_WORLD_APPEARANCES,ORGANIZATION_MATERIALS}=await import(out+'/sampling.mjs');
const directions=['east','southeast','south','southwest','west','northwest','north','northeast'];
const width=360,height=360,results=[],images=[],palette={base:[140,130,115],dark:[70,70,70],light:[190,190,180],roughness:.88,structure:0};
const map={cols:45,rows:45,tileSize:8,tiles:Array.from({length:45},()=>Array(45).fill(0))};
const components=r=>{const visited=new Set(),list=[];for(const pixel of r.occupiedPixels)if(r.material[pixel]===2&&!visited.has(pixel)){
 const pixels=[pixel];visited.add(pixel);let minX=width,maxX=0,minY=height,maxY=0,bottomPixels=0,minBottom=Infinity;
 for(let at=0;at<pixels.length;at++){const p=pixels[at],x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  if(r.region[p]===0){bottomPixels++;minBottom=Math.min(minBottom,r.heightField[p]);}
  for(const d of[-1,1,-width,width]){const q=p+d;if(q>=0&&q<width*height&&r.material[q]===2&&!visited.has(q)){visited.add(q);pixels.push(q);}}
 }
 list.push({pixels,width:maxX-minX+1,height:maxY-minY+1,bottomPixels,minBottom});
}return list;};
const validatePores=r=>{const groups=components(r);assert.equal(groups.length,6,'sealed pore bottoms must preserve six connected cavity surfaces');for(const g of groups){assert(g.width<20&&g.height<20);assert(g.bottomPixels>=1,'every cavity needs native opaque bottom pixels, not only triangles');assert(g.minBottom>0);}return groups;};
let negativeBottomRejected=false;
for(const [name,build]of Object.entries(profiles)){
 const organization=name==='buildPorousBreak'?'porous-marrow':'short-fibre',family=name==='buildPorousBreak'?'granular-ridge':'membrane-rim';
 const definition=ORGANIZATION_MATERIALS.find(row=>row.organization===organization).solid;
 const source='public'+definition.source,rawSource=fs.readFileSync(path.join(root,source)),sourceHash=sha(rawSource);
 assert.equal(sourceHash,sha(fs.readFileSync(path.join(root,'docs/qa/artifacts/r100-i10-i12/material-organization/source-v3/'+organization+'-solid.png'))),'current candidate must match reviewed source-v3');
 const pixels=new Uint8ClampedArray(await sharp(rawSource).resize(definition.logical_pixels,definition.logical_pixels).ensureAlpha().raw().toBuffer()),range=paintedToneRange({pixels}),pixelHash=sha(pixels);
 const appearance=R100_WORLD_APPEARANCES.find(row=>row.worldId===(organization==='porous-marrow'?'cinder-ridge':'pallid-membrane'));
 for(const [length,breadth,tall,blocking]of [[90,90,35,1],[160,120,54,1],[240,170,68,1],[180,140,5,0]])for(let direction=0;direction<8;direction++){
  const started=performance.now(),rotation=direction*Math.PI/4,spec={id:1,family,seed:20261005,x:180,y:180,rotation,length,width:breadth,height:tall,thickness:10,fold:.6,branches:3,opening:.7,distortion:.3,blocking};
  const b=new MeshBuilder(spec);build(b);const mesh=b.finish();assert([...mesh.positions,...mesh.normals,...mesh.uv].every(Number.isFinite));assert(mesh.triangleCount<=600);assert.equal(mesh.joints.length,blocking);
  for(let i=0;i<mesh.normals.length;i+=3)assert(Math.abs(Math.hypot(...mesh.normals.slice(i,i+3))-1)<1e-5);
  const raster=compileNativeVolumeRaster([mesh],{x:0,y:0,width,height,opticalHeight:16}),body=new NativeBodyCollision({meshes:[mesh],definition:{instances:[{id:1,role:blocking?'solid':'relief'}]}},map);
  let pores=[],bodySamples=0,stoppedSweeps=0;
  if(name==='buildPorousBreak'){
   pores=validatePores(raster);
   for(const g of pores){const bottom=g.pixels.find(p=>raster.region[p]===0),target={x:bottom%width+.5,y:Math.floor(bottom/width)+.5};
    for(const p of g.pixels){assert.equal(body.supports({x:p%width+.5,y:Math.floor(p/width)+.5},10,10),!blocking);bodySamples++;}
    const dx=target.x-spec.x,dy=target.y-spec.y,localX=dx*Math.cos(rotation)+dy*Math.sin(rotation),localY=breadth*.56+22;
    const start={x:spec.x+localX*Math.cos(rotation)-localY*Math.sin(rotation),y:spec.y+localX*Math.sin(rotation)+localY*Math.cos(rotation)};
    assert(body.supports(start,10,10));const fraction=body.displacementFraction(start,10,10,target.x-start.x,target.y-start.y);
    if(blocking){assert(fraction<1,'pore cannot act as a body opening');stoppedSweeps++;}else assert.equal(fraction,1,'same sealed surface as relief remains walkable');
   }
   if(!negativeBottomRejected&&blocking&&length===160&&direction===0){
    const broken=new MeshBuilder(spec),proxy={spec,quad:(a,c,d,e,slot,uv,wanted,region=0)=>{if(!(slot===2&&region===0))broken.quad(a,c,d,e,slot,uv,wanted,region);},joint:p=>broken.joint(p)};build(proxy);
    assert.throws(()=>validatePores(compileNativeVolumeRaster([broken.finish()],{x:0,y:0,width,height,opticalHeight:16})),/bottom/);negativeBottomRejected=true;
   }
  }
  let imageFile;
  if(length===160&&blocking){
   const lighting=new NativeVolumeLighting(raster,{outer:palette,cut:palette,inner:palette,joint:palette});
   const mapped=new Float32Array(3),field={secondary:0,tone:0,detail:1},mirror=(v,n)=>{const a=((Math.floor(v)%(n*2))+n*2)%(n*2);return a<n?a:n*2-a-1;};
   const uvMinX=Math.min(...mesh.uv.filter((_,i)=>i%2===0)),uvMaxX=Math.max(...mesh.uv.filter((_,i)=>i%2===0)),uvMinY=Math.min(...mesh.uv.filter((_,i)=>i%2===1)),uvMaxY=Math.max(...mesh.uv.filter((_,i)=>i%2===1));
   for(const p of raster.occupiedPixels){const slot=raster.material[p],cut=slot!==0,patch=definition.regions[cut?'cleaved':'skin'],left=Math.round(patch.x*512),top=Math.round(patch.y*512),pw=Math.round(patch.width*512),ph=Math.round(patch.height*512);
    lighting.roughness[p]=cut?definition.cutRoughness:definition.skinRoughness;
    const density=Math.min(512/definition.world_size,(pw-2)/(uvMaxX-uvMinX),(ph-2)/(uvMaxY-uvMinY));
    const usedW=(uvMaxX-uvMinX)*density,usedH=(uvMaxY-uvMinY)*density;
    const offsetX=1+(pw-2-usedW)*((spec.seed%83)/82),offsetY=1+(ph-2-usedH)*(((spec.seed>>>8)%97)/96);
    const sx=left+Math.floor(offsetX+(raster.uv[p*2]-uvMinX)*density),sy=top+Math.floor(offsetY+(raster.uv[p*2+1]-uvMinY)*density);
    assert(sx>=left&&sx<left+pw&&sy>=top&&sy<top+ph,'one contiguous patch window, no reflection or wrap inside a piece');
    const at=(sy*512+sx)*4;
    mapWorldPigment(appearance,cut?'cleaved':'solid',pixels[at],pixels[at+1],pixels[at+2],range,field,0,mapped);
    for(let c=0;c<3;c++)lighting.albedo[p*3+c]=mapped[c];
   }
   const output=new Uint8ClampedArray(width*height*4);lighting.render([{x:105,y:310,z:105,radius:440,intensity:2.1,color:[1,.98,.95]}],output,{ambient:.25,emissionScale:0});
   for(let i=0;i<width*height;i++)if(!output[i*4+3]){output.set([24,26,30,255],i*4);}
   // An axis-aligned20px square is a scale reference, not an actor/HUD.
   for(let y=318;y<338;y++)for(let x=22;x<42;x++)if(x===22||x===41||y===318||y===337)output.set([150,150,150,255],(y*width+x)*4);
   imageFile=organization+'-'+direction+'-'+directions[direction]+'.png';await sharp(output,{raw:{width,height,channels:4}}).png().toFile(out+'/'+imageFile);
   images.push({organization,direction,angleRadians:rotation,file:imageFile,sha256:sha(fs.readFileSync(out+'/'+imageFile)),source,sourceSha256:sourceHash,definition,nativePixelSize:1});
  }
  results.push({profile:name,direction:directions[direction],angleRadians:rotation,length,width:breadth,height:tall,blocking,triangles:mesh.triangleCount,bodySamples,stoppedSweeps,pores:pores.map(g=>({pixels:g.pixels.length,width:g.width,height:g.height,bottomPixels:g.bottomPixels,minBottom:g.minBottom})),image:imageFile,durationMs:performance.now()-started});
 }
 assert.equal(sha(pixels),pixelHash);assert.equal(sha(fs.readFileSync(path.join(root,source))),sourceHash);
 const cards=images.filter(i=>i.organization===organization);await sharp({create:{width:width*4,height:height*2,channels:4,background:{r:24,g:26,b:30,alpha:1}}}).composite(cards.map(i=>({input:out+'/'+i.file,left:(i.direction%4)*width,top:Math.floor(i.direction/4)*height}))).png().toFile(out+'/'+organization+'-eight-directions.png');
}
assert(negativeBottomRejected);const sourceAfter=Object.fromEntries(protect.map(p=>[p,sha(fs.readFileSync(path.join(root,p)))]));assert.deepEqual(sourceAfter,sourceBefore);
const report={status:'isolated-geometry-contract-pass-not-world-or-art-pass',materialDefinitionCsv:{path:'data/rift-material-organizations.csv',sha256:sha(fs.readFileSync(path.join(root,'data/rift-material-organizations.csv')))},createdAt:new Date().toISOString(),moduleSha256:sha(fs.readFileSync(root+'/src/generation/world-study/native-volume-organization.ts')),currentRuntimeUntouched:sourceAfter,negativeBottomRejected,results,images,scope:'Unregistered functions through actual MeshBuilder, native raster and body. Source-v3 pigment uses one continuous source window fitted to actual localUV/skin-cleaved patches, equal texel scale on both axes; no reflection or wrapping within a mesh and existing pigment mapping with a neutral appearance field; actual native lighting/geometry shadows, fixed isolated lamp, no grade infection/tactical FOV/HUD/world admission. Axis-aligned20px reference square at lower left.'};
fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2)+'\n');fs.copyFileSync(root+'/src/generation/world-study/native-volume-organization.ts',out+'/native-volume-organized.ts');fs.copyFileSync('/tmp/coh-check-native-organized-v4.mjs',out+'/check-isolated.mjs');console.log(JSON.stringify({status:report.status,cases:results.length,images:images.length,negativeBottomRejected,maxTriangles:Math.max(...results.map(r=>r.triangles)),minBottomPixels:Math.min(...results.flatMap(r=>r.pores.map(p=>p.bottomPixels)))}));
