/** Exact old-trip recovery plus unchanged approved twenty-world rendering under
 * revision 6. Identity receipts may change, geometry and rendered bytes may not. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {createR100ProductionRecipe as oldRecipe,createR100ProductionMap as oldMap,bakeMasterWorldSurface as oldBake} from '../../src/generation/legacy-r100-v4/executor.js';
import {createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data';
import {bakeMasterWorldSurface} from '../../src/systems/r100-world/surface-bake';
import {PAINTED_MATERIALS} from '../../src/generated/r100-materials';
import type {PaintedMaterial,PaintedSurface} from '../../src/systems/r100-world/painted-material';
import type {WorldProductionMap} from '../../src/generation/world-study/production-map';
const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const snapshot=JSON.parse(fs.readFileSync('docs/qa/artifacts/r100-world-identity/packages/index.json','utf8'));
const worlds=snapshot.worlds.map((row:{worldId:string})=>row.worldId) as string[];
assert.equal(worlds.length,20);
const paintings=new Map<string,PaintedMaterial>();
for(const row of PAINTED_MATERIALS){
 const decode=async(source:typeof row|typeof row.solid):Promise<PaintedSurface>=>({width:source.logical_pixels,height:source.logical_pixels,source:source.source,worldSize:source.world_size,regions:source.regions,pixels:new Uint8ClampedArray(await sharp(`public${source.source}`).resize(source.logical_pixels,source.logical_pixels).ensureAlpha().raw().toBuffer())});
 paintings.set(row.family,{...await decode(row),solid:{...await decode(row.solid),skinRoughness:row.solid.skinRoughness,cutRoughness:row.solid.cutRoughness,gain:row.solid.gain,cutGain:row.solid.cutGain}});
}
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?{type:item.constructor.name,bytes:Buffer.from(item.buffer,item.byteOffset,item.byteLength).toString('base64')}:item instanceof Map?[...item.entries()]:item);
const comparable=(world:WorldProductionMap)=>({...world,native:{...world.native,packageHash:'identity-only',algorithmRevision:undefined},metadata:{...world.metadata,signature:'identity-only'}});
const cases=[];
for(const worldId of worlds)for(const grade of ['low','medium','severe'] as const){
 const seed=20261005,previous=oldRecipe(worldId,seed,grade),current=createR100ProductionRecipe(worldId,seed,grade);
 assert.equal(previous.package.algorithmRevision,4);assert.equal(current.package.algorithmRevision,6);
 assert(validR100ProductionRecipe(previous));assert(validR100ProductionRecipe(current));
 const {package:oldPackage,...oldFields}=previous,{package:currentPackage,...currentFields}=current;
 assert.deepEqual(currentFields,oldFields,`${worldId}/${grade}: approved authored recipe unchanged`);
 const before=oldMap(previous),recovered=createR100ProductionMap(structuredClone(previous)),after=createR100ProductionMap(current);
 assert.equal(canonical(recovered),canonical(before),`${worldId}/${grade}: old transfer payload exact`);
 assert.equal(canonical(comparable(after)),canonical(comparable(before)),`${worldId}/${grade}: approved geometry, pollution and content unchanged`);
 const families=Object.fromEntries([...new Set([previous.nativeDefinition.family,...previous.nativeDefinition.instances.map(row=>row.family??previous.nativeDefinition.family)])].map(family=>[family,paintings.get(family)!]));
 const painting={...paintings.get(previous.nativeDefinition.family)!,families};
 const a=oldBake(hydrateR100MasterWorld(before.native!,before.layout),painting),b=bakeMasterWorldSurface(hydrateR100MasterWorld(recovered.native!,recovered.layout),painting),c=bakeMasterWorldSurface(hydrateR100MasterWorld(after.native!,after.layout),painting);
 const hashes:Record<string,string>={};
 for(const key of ['albedo','normal','response','emission'] as const){assert.deepEqual(b[key],a[key],`${worldId}/${grade}: old ${key} bytes`);assert.deepEqual(c[key],a[key],`${worldId}/${grade}: new ${key} preserves approved material`);hashes[key]=sha(a[key]);}
 cases.push({worldId,grade,seed,oldPackage:oldPackage.dependencyHash,newPackage:currentPackage.dependencyHash,payloadExact:true,newGeometryAndContentExact:true,surface:hashes});
 console.log(`PASS ${worldId}/${grade}: old payload, current approved geometry, four RGBA maps`);
}
const flag=process.argv.indexOf('--report');if(flag>=0){const out=process.argv[flag+1]!;fs.mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});fs.writeFileSync(out,JSON.stringify({status:'pass',scope:'20 approved worlds, one fixed seed per grade; old revision4 full transfer and four surfaces exact, revision6 geometry/material/content equivalent except identity receipts. Not full-seed gameplay approval.',cases},null,2)+'\n');}
