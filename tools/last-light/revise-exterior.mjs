/** Revise only the remote architecture of the selected haven.
 * node --import tsx tools/last-light/revise-exterior.mjs --write | --check
 * The accepted opening-joint pack is read-only. Shared depth/material sheets
 * retain the near/haven tiles exactly; every other surface and actor is copied.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {readAcceptedJointPack} from './promote-joint.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=path.join(root,'public/assets/last-light');
const entry='tools/last-light/joint-scene.ts',self='tools/last-light/revise-exterior.mjs';
const navigation='src/generated/last-light-layout.ts';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const encode=value=>JSON.stringify(value,null,2)+'\n';
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const revisedFiles=new Set(['manifest.json','exterior-far.png','exterior-middle.png','exterior-depth.png','exterior-fields.png','exterior-fields.json','occluders.json']);
const protectedLayers=['near','haven'];
const columns=['far','middle','near','haven'];
const rows=['otherPollution','core','storage','purifier','furnace','motion','normal'];
const loadRgba=async file=>{
  const {data,info}=await sharp(file).raw().toBuffer({resolveWithObject:true});
  assert.equal(info.channels,4,`${file}: raw four-channel data required`);
  return {data,info};
};
const tileHash=(pixels,width,x,y,w,h)=>{
  const digest=createHash('sha256');
  for(let row=0;row<h;row++)digest.update(pixels.subarray(((y+row)*width+x)*4,((y+row)*width+x+w)*4));
  return digest.digest('hex');
};

export async function verifyExteriorRevisionPack(directory=target){
  const baseline=await readAcceptedJointPack({verifyCurrentSources:false});
  const manifest=await json(path.join(directory,'manifest.json'));
  const checksums=await json(path.join(directory,'checksums.json'));
  const revision=manifest.exteriorRevision;
  assert.equal(manifest.status,'complete');assert.equal(manifest.delivery,'production');
  assert.equal(revision?.version,1);assert.equal(revision.review,'REVIEW-PENDING');
  assert.equal(revision.baseline.acceptedRevision,baseline.acceptedRevision);
  assert.equal(revision.baseline.sourceChecksumsSha256,baseline.sourceChecksumsSha256);
  assert.equal(manifest.promotion.acceptedRevision,baseline.acceptedRevision);
  assert.equal(manifest.promotion.sourceChecksumsSha256,baseline.sourceChecksumsSha256);
  assert.equal(manifest.promotion.sourceManifestSha256,baseline.checksums.outputs['manifest.json']);
  assert.equal(manifest.promotion.rebaked,false,'Promotion provenance describes the historical promotion, not the exterior revision');
  assert.equal(manifest.promotion.runtimeExterior,'joint-depth');
  for(const key of ['camera','canvas','actor','stations','rest','textures','lights','exteriorLayers'])assert.deepEqual(manifest[key],baseline.manifest[key],`Exterior revision changed protected ${key}`);
  assert.deepEqual(manifest.source.hashes,baseline.manifest.source.hashes,'Historical whole-scene bake hashes were rewritten');
  assert.deepEqual(checksums.sources,baseline.checksums.sources);
  assert.deepEqual(checksums.reusedInputs,baseline.checksums.reusedInputs);
  assert.deepEqual(checksums.actorSources,manifest.actor.sourceHashes);
  assert.deepEqual(checksums.exteriorSources,revision.sourceHashes);
  assert.deepEqual(manifest.exteriorFields.sourceHashes,revision.sourceHashes);
  for(const [file,expected] of Object.entries(revision.sourceHashes))assert.equal(hash(await fs.readFile(path.join(root,file))),expected,`Stale exterior author: ${file}`);
  assert.equal(hash(await fs.readFile(path.join(root,navigation))),revision.navigationSha256);
  assert.equal(revision.navigationSha256,baseline.checksums.reusedInputs[navigation]);
  assert.deepEqual(Object.keys(checksums.outputs).sort(),Object.keys(baseline.checksums.outputs).sort());
  for(const [file,expected] of Object.entries(checksums.outputs)){
    assert.equal(hash(await fs.readFile(path.join(directory,file))),expected,`Corrupt output: ${file}`);
    if(!revisedFiles.has(file))assert.equal(expected,baseline.checksums.outputs[file],`Exterior revision altered protected asset: ${file}`);
  }
  assert.deepEqual(checksums.imageDimensions,baseline.checksums.imageDimensions);
  for(const [file,expected] of Object.entries(checksums.imageDimensions)){
    const meta=await sharp(path.join(directory,file)).metadata();
    assert.equal(meta.width,expected.width,file);assert.equal(meta.height,expected.height,file);assert.equal(meta.channels,4,file);
  }
  const metadata=await json(path.join(directory,'exterior-fields.json'));
  assert.deepEqual(metadata.sourceHashes,revision.sourceHashes);
  assert.equal(metadata.textureHash,checksums.outputs['exterior-fields.png']);
  assert.deepEqual(metadata.columns,columns);assert.deepEqual(metadata.rows,rows);
  assert.deepEqual(metadata.inheritedColumns,protectedLayers);
  assert.equal(metadata.baselineChecksumsSha256,baseline.sourceChecksumsSha256);
  const {width:PW,height:PH}=metadata.tile;
  for(const name of ['exterior-depth.png','exterior-fields.png']){
    const current=await loadRgba(path.join(directory,name));
    const previous=await loadRgba(path.join(baseline.directory,name));
    for(const layer of [2,3]){
      const tiles=name==='exterior-depth.png'?[[0,layer*PH,PW,PH]]:rows.map((_,row)=>[layer*PW,row*PH,PW,PH]);
      for(const rect of tiles)assert.equal(tileHash(current.data,current.info.width,...rect),tileHash(previous.data,previous.info.width,...rect),`${name}: protected ${columns[layer]} tile changed`);
    }
  }
  assert.deepEqual(revision.protectedGeometry.current,revision.protectedGeometry.baseline,'Local geometry changed');
  assert.equal(manifest.exteriorAir.textureHash,checksums.outputs['exterior-far.png']);
  const air=manifest.exteriorAir.statistics;
  assert(air.additivePixels>1000&&air.surfacePixels>100,'Far atmosphere lost its depth-clipped volume');
  assert(air.truncatedRays>100&&air.fullyOccludedRays>100,'Far air lost geometric clipping');
  for(let c=0;c<3;c++)assert(air.maxIncrement[c]<=manifest.exteriorAir.parameters.maxIncrement[c],'Far air exceeded its radiance budget');
  const far=await loadRgba(path.join(directory,'exterior-far.png'));
  let zeroAlphaRadiance=0;
  for(let i=0;i<far.data.length;i+=4)if(!far.data[i+3]&&(far.data[i]||far.data[i+1]||far.data[i+2]))zeroAlphaRadiance++;
  assert(zeroAlphaRadiance>=air.additivePixels,'PNG discarded additive RGB at zero alpha');
  const occluders=await json(path.join(directory,'occluders.json'));
  assert.equal(occluders.count*9,occluders.triangles.length);
  assert.equal(occluders.count,revision.occluders.count);
  assert(occluders.triangles.every(Number.isFinite),'Invalid shadow geometry');
  return {status:'PASS',destination:path.relative(root,directory),baseline:baseline.acceptedRevision,
    revision:revision.id,rebakedLayers:['far','middle'],protectedLayers,protectedFiles:Object.keys(checksums.outputs).filter(name=>!revisedFiles.has(name)).length,
    protectedGeometry:revision.protectedGeometry.current,actorFrames:manifest.actor.frames.length,
    navigationSha256:revision.navigationSha256,occluders:occluders.count,air:manifest.exteriorAir.statistics,
    unchanged:['camera','stations','rest','lights','navigation','actor atlases','near/haven colour, depth and material fields','core/foreground render resources'],review:revision.review};
}

async function fingerprint(file,hashes){
  const absolute=path.resolve(root,file),relative=path.relative(root,absolute).split(path.sep).join('/');
  assert(!relative.startsWith('../')&&!path.isAbsolute(relative));
  if(hashes[relative])return;
  const bytes=await fs.readFile(absolute);hashes[relative]=hash(bytes);
  if(!/\.(?:[cm]?js|tsx?)$/.test(relative))return;
  const imports=/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]|\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for(const match of bytes.toString('utf8').matchAll(imports)){
    const imported=path.resolve(path.dirname(absolute),match[1]??match[2]);let resolved;
    for(const candidate of [imported,imported+'.ts',imported+'.mjs',imported+'.js',path.join(imported,'index.ts')]){
      try{if((await fs.stat(candidate)).isFile()){resolved=candidate;break;}}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    assert(resolved,`Cannot resolve ${imported}`);await fingerprint(resolved,hashes);
  }
}

async function revise(){
  const baseline=await readAcceptedJointPack({verifyCurrentSources:false});
  const installed=await json(path.join(target,'manifest.json'));
  assert.equal(installed.promotion?.acceptedRevision,baseline.acceptedRevision,'Only the selected production baseline can receive this bounded revision');
  for(const key of ['camera','canvas','actor','stations','rest','textures','lights','exteriorLayers'])assert.deepEqual(installed[key],baseline.manifest[key],`Installed protected ${key} has diverged`);
  for(const [file,expected] of Object.entries(baseline.checksums.outputs)){
    if(!revisedFiles.has(file))assert.equal(hash(await fs.readFile(path.join(target,file))),expected,`Installed protected asset changed: ${file}`);
  }
  // Only the exterior entry/air and delivery tools may differ from the selected
  // recipe. The dependency graph beneath devices, actor and terrain stays fixed.
  const allowed=new Set([entry,'tools/last-light/joint-air.ts','tools/last-light/export-joint.mjs','tools/last-light/export.mjs','src/art/last-light-exterior.ts']);
  for(const [file,expected] of Object.entries({...baseline.checksums.sources,...baseline.manifest.actor.sourceHashes})){
    if(!allowed.has(file))assert.equal(hash(await fs.readFile(path.join(root,file))),expected,`Protected author changed: ${file}`);
  }
  const sourceHashes={};
  for(const file of [entry,self,'tools/last-light/joint-air.ts','docs/art/demos/purification-last-light/render.ts','package.json','package-lock.json'])await fingerprint(file,sourceHashes);
  const hashes=Object.fromEntries(Object.entries(sourceHashes).sort(([a],[b])=>a.localeCompare(b)));
  const {buildJointScene}=await import(pathToFileURL(path.join(root,entry)).href);
  const {Model}=await import('../../docs/art/demos/purification-last-light/model.ts');
  const {CAMERA,render,project}=await import('../../docs/art/demos/purification-last-light/render.ts');
  const {JOINT_AIR,applyJointAir}=await import('./joint-air.ts');
  const author=buildJointScene(),world=new Model();
  for(const triangle of author.model.triangles)if(triangle.object!==7)world.triangles.push(triangle);
  world.lights.push(...author.model.lights.filter(l=>l.kind!=='shoulder'));
  world.volumes.push(...author.model.volumes);
  assert.deepEqual(CAMERA,baseline.manifest.camera);
  assert.deepEqual(world.lights.map(light=>({...light,screen:project(light.position)})),baseline.manifest.lights,'Exterior-only revision must not move or brighten any fixed light');
  const identity=station=>({id:station.id,key:station.key,position:station.position,yaw:station.yaw,approach:station.approach});
  assert.deepEqual(author.stations.map(identity),baseline.manifest.stations.map(identity));
  const baselineEntry=path.join(root,'tools/last-light',`.accepted-joint-${randomUUID()}.ts`);
  let previous;
  try{
    await fs.writeFile(baselineEntry,execFileSync('git',['show',`${baseline.acceptedRevision}:${entry}`],{cwd:root}),{flag:'wx'});
    previous=(await import(pathToFileURL(baselineEntry).href)).buildJointScene().model;
  }finally{await fs.rm(baselineEntry,{force:true});}
  const geometry=model=>Object.fromEntries(protectedLayers.map(layer=>[layer,hash(encode(model.triangles.filter(t=>t.layer===layer&&t.object!==7)))]));
  const protectedGeometry={baseline:geometry(previous),current:geometry(world)};
  assert.deepEqual(protectedGeometry.current,protectedGeometry.baseline,'New exterior changed attached/playable geometry');
  assert.deepEqual(world.volumes,previous.volumes,'Core volume changed');
  const manifest=structuredClone(installed),checksums=structuredClone(baseline.checksums);
  const metadata=await json(path.join(baseline.directory,'exterior-fields.json'));
  const {width:PW,height:PH,padding}=metadata.tile;
  const paddedCamera={...CAMERA,width:PW,height:PH,origin:[CAMERA.origin[0]+padding,CAMERA.origin[1]+padding]};
  const depth=(await loadRgba(path.join(baseline.directory,'exterior-depth.png'))).data;
  const fields=(await loadRgba(path.join(baseline.directory,'exterior-fields.png'))).data;
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'coh-exterior-revision-'));
  const timing={},started=performance.now();let airStatistics;
  const saveJson=async(name,value)=>{const bytes=Buffer.from(encode(value));await fs.writeFile(path.join(temp,name),bytes);checksums.outputs[name]=hash(bytes);};
  const save=async(name,data,width,height)=>{
    const bytes=await sharp(Buffer.from(data),{raw:{width,height,channels:4}}).png().toBuffer();
    await fs.writeFile(path.join(temp,name),bytes);checksums.outputs[name]=hash(bytes);
  };
  try{
    for(const name of Object.keys(checksums.outputs))await fs.copyFile(path.join(baseline.directory,name),path.join(temp,name));
    for(let column=0;column<2;column++){
      const layer=columns[column],plate=new Model(),begin=performance.now();
      for(const triangle of world.triangles)if(triangle.layer===layer)plate.triangles.push(triangle);
      plate.lights.push(...world.lights);
      console.log(`[exterior revision] ${layer}: ${plate.triangles.length} triangles; near/haven are retained.`);
      const frame=render(plate,paddedCamera,undefined,{shadowModel:world,transparentBackground:true,skipEnergy:true,sampleOffset:[padding,padding]});
      if(layer==='far'){
        const alpha=frame.energyBase.filter((_,i)=>i%4===3),beforeDepth=hash(new Uint8Array(frame.depth.buffer));
        airStatistics=applyJointAir(frame.energyBase,frame.depth,paddedCamera);
        assert.deepEqual(frame.energyBase.filter((_,i)=>i%4===3),alpha);assert.equal(hash(new Uint8Array(frame.depth.buffer)),beforeDepth);
      }
      await save(`exterior-${layer}.png`,frame.energyBase,PW,PH);
      const encoded=new Uint8ClampedArray(PW*PH*4);
      for(let i=0;i<frame.opaqueDepth.length;i++)if(Number.isFinite(frame.opaqueDepth[i])){
        const value=Math.max(1,Math.min(65535,Math.round((frame.opaqueDepth[i]+80)*256)));
        encoded.set([value>>8,value&255,frame.layers[i],255],i*4);
      }
      depth.set(encoded,column*PW*PH*4);
      const other=new Uint8ClampedArray(frame.lightFields.pollution.length);
      for(let i=0;i<other.length;i+=4){
        for(let c=0;c<3;c++)other[i+c]=Math.max(0,frame.lightFields.pollution[i+c]-frame.coreLight[i+c]-frame.storageLight[i+c]-frame.purifierLight[i+c]);
        other[i+3]=255;
      }
      const samples=[other,frame.coreLight,frame.storageLight,frame.purifierLight,frame.lightFields.furnace,frame.motion,frame.normal];
      for(let row=0;row<rows.length;row++)for(let y=0;y<PH;y++)fields.set(samples[row].subarray(y*PW*4,(y+1)*PW*4),((row*PH+y)*PW*4+column*PW)*4);
      timing[layer]=Math.round(performance.now()-begin);
    }
    await save('exterior-depth.png',depth,PW,PH*4);
    await save('exterior-fields.png',fields,PW*4,PH*rows.length);
    Object.assign(metadata,{sourceHashes:hashes,textureHash:checksums.outputs['exterior-fields.png'],inheritedColumns:protectedLayers,
      baselineChecksumsSha256:baseline.sourceChecksumsSha256,revisionTiming:timing,
      encoding:'Far/middle rebaked with full-world shadows. Near/haven raw tiles copied from accepted baseline. Additive RGB at zero alpha preserved.'});
    await saveJson('exterior-fields.json',metadata);
    const occluders=world.triangles.filter(t=>!['glass','liquid','energy'].includes(t.material));
    await saveJson('occluders.json',{version:1,count:occluders.length,triangles:occluders.flatMap(t=>[...t.a,...t.b,...t.c].map(v=>Math.round(v*1e5)/1e5))});
    manifest.review={status:'REVIEW-PENDING',scope:'Revised far/middle exterior; accepted foreground remains unchanged',note:'Runtime and asset validation do not imply human art approval.'};
    manifest.exteriorRevision={version:1,id:`haven-exterior-${hash(encode(hashes)).slice(0,12)}`,review:'REVIEW-PENDING',
      baseline:{acceptedRevision:baseline.acceptedRevision,sourceChecksumsSha256:baseline.sourceChecksumsSha256},
      source:entry,sourceHashes:hashes,rebakedLayers:['far','middle'],protectedGeometry,
      navigationSha256:baseline.checksums.reusedInputs[navigation],
      layerTriangles:Object.fromEntries(columns.map(layer=>[layer,world.triangles.filter(t=>t.layer===layer).length])),
      occluders:{count:occluders.length,note:'Remote shadow casters updated with the geometry; protected local triangles remain identical. Runtime uses full-world cubemap geometry with per-light radius clipping.'},
      timing:{...timing,total:Math.round(performance.now()-started)},
      note:'Original source/promotion/statistics describe the accepted full bake. This record describes only the subsequent far/middle revision; reference.png remains the accepted historical reference.'};
    manifest.exteriorFields={...manifest.exteriorFields,sourceHashes:hashes};
    manifest.exteriorAir={...manifest.exteriorAir,parameters:JOINT_AIR,statistics:airStatistics,textureHash:checksums.outputs['exterior-far.png']};
    checksums.actorSources=manifest.actor.sourceHashes;checksums.exteriorSources=hashes;
    await saveJson('manifest.json',manifest);
    await fs.writeFile(path.join(temp,'checksums.json'),encode(checksums));
    console.log(JSON.stringify(await verifyExteriorRevisionPack(temp),null,2));
    // Check author fingerprints immediately before publishing; never label a
    // render made before a concurrent edit with hashes from after that edit.
    for(const [file,expected] of Object.entries(hashes))assert.equal(hash(await fs.readFile(path.join(root,file))),expected,`Author changed during export: ${file}`);
    for(const name of revisedFiles)if(name!=='manifest.json')await fs.copyFile(path.join(temp,name),path.join(target,name));
    await fs.copyFile(path.join(temp,'manifest.json'),path.join(target,'manifest.json'));
    await fs.copyFile(path.join(temp,'checksums.json'),path.join(target,'checksums.json'));
    return await verifyExteriorRevisionPack(target);
  }finally{await fs.rm(temp,{recursive:true,force:true});}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  assert(args.length===1&&['--write','--check'].includes(args[0]),'Use --write to bake the bounded production revision, or --check to validate it.');
  console.log(JSON.stringify(args[0]==='--write'?await revise():await verifyExteriorRevisionPack(),null,2));
}
