/** Promote the human-selected joint haven without rendering it again.
 * The source pack and its bake provenance remain immutable. Production uses
 * only public assets; this tool's docs/Git references are offline provenance.
 * node tools/last-light/promote-joint.mjs --write | --check */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sourceRoot='docs/art/demos/opening-joint/assets/haven';
const targetRoot='public/assets/last-light';
const acceptedRevision='48b700c';
const navigation='src/generated/last-light-layout.ts';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const encode=value=>JSON.stringify(value,null,2)+'\n';
const historicalTools=new Set(['src/art/last-light-exterior.ts','tools/last-light/export-joint.mjs','tools/last-light/export.mjs']);

async function selectedPack(){
  const directory=path.join(root,sourceRoot);
  const sourceChecksumBytes=await fs.readFile(path.join(directory,'checksums.json'));
  const selectedBytes=execFileSync('git',['show',`${acceptedRevision}:${sourceRoot}/checksums.json`],{cwd:root});
  assert.equal(hash(sourceChecksumBytes),hash(selectedBytes),'The candidate pack changed after the accepted checkpoint; do not silently promote a new picture.');
  const manifest=await json(path.join(directory,'manifest.json'));
  const checksums=JSON.parse(sourceChecksumBytes);
  assert.equal(manifest.status,'complete');
  assert.equal(manifest.source.entry,'tools/last-light/joint-scene.ts');
  assert.deepEqual(checksums.sources,manifest.source.hashes);
  for(const [name,expected] of Object.entries(checksums.outputs)){
    assert.equal(path.basename(name),name,'Asset filenames must be local to the pack');
    assert.equal(hash(await fs.readFile(path.join(directory,name))),expected,`Changed selected asset: ${name}`);
  }
  assert.equal(hash(await fs.readFile(path.join(root,navigation))),checksums.reusedInputs[navigation],'The selected pack may not silently change navigation.');
  // Rendered pixels retain the original bake hashes. Runtime shader changes or
  // adding a safety guard to the exporter do not claim a new image bake.
  for(const [file,expected] of Object.entries({...checksums.sources,...manifest.actor.sourceHashes})){
    if(historicalTools.has(file))continue;
    assert.equal(hash(await fs.readFile(path.join(root,file))),expected,`Changed selected geometry/actor source: ${file}`);
  }
  return {directory,manifest,checksums,sourceChecksumsSha256:hash(sourceChecksumBytes)};
}

export async function verifyPromotedJointPack(directory=path.join(root,targetRoot)){
  const selected=await selectedPack();
  const manifest=await json(path.join(directory,'manifest.json'));
  const checksums=await json(path.join(directory,'checksums.json'));
  assert.equal(manifest.status,'complete');
  assert.equal(manifest.delivery,'production');
  assert.equal(manifest.promotion?.acceptedRevision,acceptedRevision);
  assert.equal(manifest.promotion.sourceChecksumsSha256,selected.sourceChecksumsSha256);
  assert.equal(manifest.promotion.sourceManifestSha256,selected.checksums.outputs['manifest.json']);
  assert.equal(manifest.promotion.navigationSha256,selected.checksums.reusedInputs[navigation]);
  assert.equal(manifest.promotion.rebaked,false);
  assert.equal(manifest.promotion.runtimeExterior,'joint-depth');
  for(const key of ['camera','canvas','actor','stations','rest','textures','lights','exteriorLayers','exteriorAir']){
    assert.deepEqual(manifest[key],selected.manifest[key],`Promotion changed ${key}`);
  }
  assert.deepEqual(checksums.sources,selected.checksums.sources,'Historical bake provenance was rewritten');
  assert.deepEqual(manifest.source.hashes,checksums.sources);
  assert.deepEqual(checksums.reusedInputs,selected.checksums.reusedInputs);
  assert.deepEqual(checksums.imageDimensions,selected.checksums.imageDimensions);
  assert.deepEqual(checksums.actorSources,manifest.actor.sourceHashes);
  assert.deepEqual(checksums.exteriorSources,manifest.exteriorFields.sourceHashes);
  for(const [file,expected] of Object.entries(checksums.outputs)){
    assert.equal(hash(await fs.readFile(path.join(directory,file))),expected,`Corrupt production output: ${file}`);
    if(file!=='manifest.json')assert.equal(expected,selected.checksums.outputs[file],`Promotion changed asset: ${file}`);
  }
  assert.deepEqual(Object.keys(checksums.outputs).sort(),Object.keys(selected.checksums.outputs).sort());
  for(const [file,expected] of Object.entries(selected.checksums.imageDimensions)){
    const dimensions=await sharp(path.join(directory,file)).metadata();
    assert.equal(dimensions.width,expected.width,file);assert.equal(dimensions.height,expected.height,file);
    assert.equal(dimensions.channels,4,`${file} must retain raw RGBA`);
  }
  const stats={status:'PASS',acceptedRevision,source:sourceRoot,destination:path.relative(root,directory),
    copiedFiles:Object.keys(checksums.outputs).filter(file=>file!=='manifest.json').length,
    images:Object.keys(selected.checksums.imageDimensions).length,actorFrames:manifest.actor.frames.length,
    actorAtlasesUnchanged:Object.values(manifest.actor.textures).length,navigationSha256:manifest.promotion.navigationSha256,
    unchanged:['camera','canvas','actor metadata and atlases','all stations and rest','navigation','selected image and light/depth bytes'],
    runtimeExterior:'joint-depth',rebaked:false,sourceChecksumsSha256:selected.sourceChecksumsSha256};
  return stats;
}

async function promote(){
  const selected=await selectedPack(),target=path.join(root,targetRoot);
  const previous=await json(path.join(target,'manifest.json'));
  for(const key of ['camera','actor','stations','rest'])assert.deepEqual(previous[key],selected.manifest[key],`Selected pack would change ${key}`);
  for(const file of Object.values(previous.actor.textures)){
    assert.equal(hash(await fs.readFile(path.join(target,file))),selected.checksums.outputs[file],`Selected pack would change actor atlas ${file}`);
  }
  const manifest=structuredClone(selected.manifest);
  manifest.delivery='production';
  manifest.review={status:'HUMAN-SELECTED-CHECKPOINT',scope:'Accepted F joint opening and matching haven, including the revised distant presence',
    note:'Promotion installs the selected resource pack without rebaking. Integration/runtime verification is recorded separately.'};
  manifest.promotion={acceptedRevision,sourceRoot,sourceManifestSha256:selected.checksums.outputs['manifest.json'],
    sourceChecksumsSha256:selected.sourceChecksumsSha256,navigationSha256:selected.checksums.reusedInputs[navigation],
    runtimeExterior:'joint-depth',rebaked:false,
    note:'Copied accepted assets exactly. Original source hashes describe the historical bake, not a fresh render.'};
  manifest.source.scope='Accepted joint scene promoted to the production asset root; original bake provenance and unchanged actor/navigation retained.';
  const checksums=structuredClone(selected.checksums);
  checksums.actorSources=manifest.actor.sourceHashes;checksums.exteriorSources=manifest.exteriorFields.sourceHashes;
  checksums.outputs['manifest.json']=hash(encode(manifest));
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'coh-joint-promote-'));
  try{
    for(const file of Object.keys(selected.checksums.outputs)){
      if(file!=='manifest.json')await fs.copyFile(path.join(selected.directory,file),path.join(temp,file));
    }
    await fs.writeFile(path.join(temp,'manifest.json'),encode(manifest));
    await fs.writeFile(path.join(temp,'checksums.json'),encode(checksums));
    await verifyPromotedJointPack(temp);
    for(const file of Object.keys(selected.checksums.outputs)){
      if(file!=='manifest.json')await fs.copyFile(path.join(temp,file),path.join(target,file));
    }
    await fs.copyFile(path.join(temp,'manifest.json'),path.join(target,'manifest.json'));
    await fs.copyFile(path.join(temp,'checksums.json'),path.join(target,'checksums.json'));
  }finally{await fs.rm(temp,{recursive:true,force:true});}
  return verifyPromotedJointPack(target);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  assert(args.length===1&&['--write','--check'].includes(args[0]),'Use --write to promote, or --check to validate the installed pack.');
  console.log(JSON.stringify(args[0]==='--write'?await promote():await verifyPromotedJointPack(),null,2));
}
