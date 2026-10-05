/** Construction v2: finite material volumes and physically real negative space.
 * These checks do not qualify world aesthetics or normal-light readability. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildNativeVolume, NATIVE_VOLUME_FAMILY_SEQUENCE, type NativeVolumeMesh, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import { TileType } from '../../src/types/game-types';

const spec: NativeVolumeSpec = { id: 1, family: 'folded-slab', seed: 20261005, x: 240, y: 200,
  rotation: 0, length: 360, width: 260, height: 62, thickness: 12, fold: .68, branches: 5, opening: .88,
  distortion: .72, blocking: 1, constructionVersion: 2 };
const map = { cols: 60, rows: 50, tileSize: 8, tiles: Array.from({ length: 50 }, () => Array.from({ length: 60 }, () => TileType.FLOOR)) };
function body(mesh: NativeVolumeMesh): NativeBodyCollision {
  const native = { definition: { instances: [{ id: 1, role: 'solid' }] }, meshes: [mesh] } as unknown as R100NativeWorldData;
  return new NativeBodyCollision(native, map);
}
function checkNormals(mesh: NativeVolumeMesh): void {
  const p = mesh.positions, n = mesh.normals;
  for (let face = 0; face < mesh.triangleCount; face++) {
    const a=mesh.indices[face*3]!*3,b=mesh.indices[face*3+1]!*3,c=mesh.indices[face*3+2]!*3;
    const ux=p[b]!-p[a]!,uy=p[b+1]!-p[a+1]!,uz=p[b+2]!-p[a+2]!;
    const vx=p[c]!-p[a]!,vy=p[c+1]!-p[a+1]!,vz=p[c+2]!-p[a+2]!;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
    if(length<1e-4)continue;
    assert(Math.abs((nx*n[a]!+ny*n[a+1]!+nz*n[a+2]!)/length)>1-3e-4,`${mesh.spec.family}: normal ${face}`);
  }
}
let cases=0;
const tiles: Uint8Array[]=[];
const metrics: object[]=[];
for (const family of NATIVE_VOLUME_FAMILY_SEQUENCE) {
  for (const seed of [20261005, 20261217]) for (const blocking of [0, 1]) {
    const input={...spec,family,seed,blocking,height:blocking?62:6},mesh=buildNativeVolume(input),repeat=buildNativeVolume(input);
    assert.deepEqual(mesh.positions,repeat.positions,`${family}: deterministic`);
    assert(mesh.positions.every(Number.isFinite)&&mesh.normals.every(Number.isFinite),`${family}: finite`);
    assert.equal(mesh.bounds.maxZ,input.height,`${family}: authored maximum`);
    assert(new Set(mesh.materials).has(0)&&new Set(mesh.materials).has(1)&&new Set(mesh.materials).has(2),`${family}: outer/cut/inner`);
    checkNormals(mesh);
    cases++;
  }
  const mesh=buildNativeVolume({...spec,family}),collision=body(mesh);
  const raster=compileNativeVolumeRaster([mesh],{x:0,y:0,width:480,height:400,opticalHeight:24});
  const pixels=new Uint8Array(480*400*4);
  let sidePixels=0,jointPixels=0,nearestSource=Infinity;
  for(let i=0;i<raster.matter.length;i++){
    const at=i*4,z=raster.heightField[i]!,normal=raster.normals[i*3+2]!;
    const value=raster.matter[i]?Math.round(55+z/spec.height*125+normal*32):23;
    pixels[at]=pixels[at+1]=pixels[at+2]=value;pixels[at+3]=255;
    if(raster.matter[i]&&normal<.8)sidePixels++;
    if(raster.matter[i]&&raster.material[i]===3){
      jointPixels++;
      for(const joint of mesh.joints)nearestSource=Math.min(nearestSource,Math.hypot(i%480+.5-joint.x,Math.floor(i/480)+.5-joint.y));
    }
  }
  assert(sidePixels>80,`${family}: visible projected section area`);
  assert(jointPixels>=6&&nearestSource<3,`${family}: material-light source is on an exposed construction face`);
  if(family==='broken-shell'){
    assert.equal(raster.matter[200*480+240],0,'Shell cavity has no hidden triangulated floor');
    assert(collision.supports({x:240,y:200},10,10),'Shell cavity supports the complete body');
    assert.equal(collision.displacementFraction({x:240,y:200},10,10,210,0),1,'Shell open mouth is traversable');
    assert(!collision.supports({x:95,y:200},10,10),'Shell back wall remains solid');
  }
  if(family==='folded-slab'){
    for(let x=70;x<=420;x+=10)assert(collision.supports({x,y:200},10,10),`Shear lane admits a complete body at ${x}`);
    assert(!collision.supports({x:240,y:135},10,10),'Shear lane has a solid upper bed');
  }
  if(family==='membrane-rim'){
    let supported=0,blocked=0;
    for(let x=120;x<=380;x+=8){if(collision.supports({x,y:270},10,10))supported++;else blocked++;}
    assert(supported>=3&&blocked>=3,'Membrane torn front includes real body-width ground and surviving sheet');
  }
  if(family==='fibre-knot'){
    const sparse=buildNativeVolume({...spec,family,branches:2});
    assert(sparse.triangleCount<mesh.triangleCount*.6,'Authored branches make sparse tensile bundles rather than a fixed knot');
  }
  tiles.push(pixels);metrics.push({family,triangles:mesh.triangleCount,matterPixels:raster.occupiedPixels.length,sidePixels,jointPixels,nearestSource});
}
const outputAt=process.argv.indexOf('--output');
if(outputAt>=0){
  const output=process.argv[outputAt+1];if(!output)throw new Error('--output requires a path');
  await mkdir(path.dirname(output),{recursive:true});
  await sharp({create:{width:1440,height:800,channels:4,background:'#171717'}})
    .composite(tiles.map((input,i)=>({input:Buffer.from(input),raw:{width:480,height:400,channels:4 as const},left:i%3*480,top:Math.floor(i/3)*400})))
    .png().toFile(output);
}
console.log(JSON.stringify({status:'pass',cases,metrics,limits:'Same-mesh finite geometry and body-space tests; grayscale construction diagnostic only, not gameplay/art qualification.'},null,2));
