/** Independent opening master bake. Never writes the production Last Light pack.
 * Run: node --import tsx tools/last-light/export-opening.mjs [--out DIR] [--skip-energy]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);
let output=path.join(root,'docs/art/demos/opening-master/assets'),skipEnergy=false;
for(let i=0;i<args.length;i++){
  if(args[i]==='--help'||args[i]==='-h'){
    console.log('Usage: node --import tsx tools/last-light/export-opening.mjs [--out DIR] [--skip-energy]\n'
      +'Default: docs/art/demos/opening-master/assets\n'
      +'--skip-energy is composition research only; writes master-preview-no-energy.png, never master.png.');
    process.exit(0);
  }else if(args[i]==='--skip-energy')skipEnergy=true;
  else if(args[i]==='--out'){
    if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('--out requires a directory.');
    output=path.resolve(process.cwd(),args[++i]);
  }else throw new Error(`Unknown argument: ${args[i]}`);
}
// Resolve existing ancestors too, so a symlink cannot redirect this author bake
// into the production resource directory.
async function realDestination(p){
  try{return await fs.realpath(p);}catch(error){
    if(error.code!=='ENOENT')throw error;
    const parent=path.dirname(p);
    if(parent===p)throw error;
    return path.join(await realDestination(parent),path.basename(p));
  }
}
output=await realDestination(output);
const production=await realDestination(path.join(root,'public/assets/last-light'));
if(output===production||output.startsWith(production+path.sep))throw new Error('Opening export cannot write production Last Light assets.');
const {default:sharp}=await import('sharp');
const {render,project}=await import('../../docs/art/demos/purification-last-light/render.ts');
const {ENERGY_FRAMES,ENERGY_PERIOD}=await import('../../docs/art/demos/purification-last-light/energy.ts');
const {ACTOR_OBJECT_ID}=await import('../../docs/art/demos/purification-last-light/actor.ts');
const entry='tools/last-light/opening-shot.ts';
const {buildOpeningShot}=await import(pathToFileURL(path.join(root,entry)).href);
const {model,camera,meta={}}=buildOpeningShot();
const initialHealth=meta.initialHealth;
for(const key of ['core','storage','purifier']){
  if(!Number.isFinite(initialHealth?.[key])||initialHealth[key]<0||initialHealth[key]>1)throw new Error(`Opening shot meta.initialHealth.${key} must be within 0..1.`);
}
const healthGain=health=>Math.round((.25+.75*health)*1e12)/1e12;
const sourceLightGains=Object.fromEntries(Object.entries(initialHealth).map(([key,value])=>[key,healthGain(value)]));
// The shot has already applied health to core/storage/purifier light powers.
// The independent volume integrator does not read those lights, so only its
// emitted RGB still needs the runtime multiplier. At frame zero the production
// coreExpansion(0) is 0: 1 + .22 * coreExpansion(0) = 1 (not 1.22).
const frameSeconds=0,coreExpansion=0,coreCycleGain=1+.22*coreExpansion;
const energyRadianceGain=sourceLightGains.core*coreCycleGain;
if(camera.width!==960||camera.height!==640)throw new Error('Opening master requires a native 960 × 640 camera.');
if(!Number.isFinite(camera.scale)||camera.scale<=0)throw new Error('Invalid opening camera scale.');
for(const [name,value,size] of [['origin',camera.origin,2],['target',camera.target,3],['direction',camera.direction,3]]){
  if(!Array.isArray(value)||value.length!==size||!value.every(Number.isFinite))throw new Error(`Invalid camera ${name}.`);
}
if(Math.hypot(camera.direction[0],camera.direction[2])<1e-8)throw new Error('Opening camera direction needs a nonvertical viewing basis.');
const actorTriangles=model.triangles.filter(t=>t.object===ACTOR_OBJECT_ID).length;
const shoulderLights=model.lights.filter(l=>l.kind==='shoulder').length;
if(!actorTriangles||!shoulderLights)throw new Error('Opening shot must include the authored actor and shoulder lamp.');
if(!model.volumes.some(v=>v.object===1))throw new Error('Opening shot must retain the real core energy volume.');

// Follow local author imports instead of keeping a manually incomplete list.
// External library versions are covered by the package manifests below.
const sourceHashes={};
async function hashSource(filename){
  const full=path.resolve(root,filename),relative=path.relative(root,full).split(path.sep).join('/');
  if(relative.startsWith('../')||path.isAbsolute(relative))throw new Error(`Source outside project: ${filename}`);
  if(sourceHashes[relative])return;
  const bytes=await fs.readFile(full);
  sourceHashes[relative]=createHash('sha256').update(bytes).digest('hex');
  if(!/\.(?:[cm]?js|tsx?)$/.test(relative))return;
  const text=bytes.toString('utf8');
  const imports=/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]|\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for(const match of text.matchAll(imports)){
    const target=path.resolve(path.dirname(full),match[1]??match[2]);
    let resolved;
    for(const candidate of [target,target+'.ts',target+'.tsx',target+'.mjs',target+'.js',path.join(target,'index.ts')]){
      try{if((await fs.stat(candidate)).isFile()){resolved=candidate;break;}}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    if(!resolved)throw new Error(`Cannot fingerprint local import ${match[1]??match[2]} from ${relative}`);
    await hashSource(path.relative(root,resolved));
  }
}
await hashSource(entry);
await hashSource('tools/last-light/export-opening.mjs');
await hashSource('src/art/last-light-renderer.ts');
await hashSource('package.json');
try{await hashSource('package-lock.json');}catch(error){if(error.code!=='ENOENT')throw error;}
const hashes=Object.fromEntries(Object.entries(sourceHashes).sort(([a],[b])=>a.localeCompare(b)));
const sourceHash=createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
const anchors={};
for(const [name,value] of Object.entries(meta.anchors??{})){
  const world=Array.isArray(value)?value:value?.world;
  if(!Array.isArray(world)||world.length!==3||!world.every(Number.isFinite))throw new Error(`Anchor ${name} needs a finite world XYZ point.`);
  anchors[name]={...(Array.isArray(value)?{}:value),world,screen:project(world,camera)};
}
if(!Object.keys(anchors).length)throw new Error('Opening shot meta.anchors must describe its world-space matching anchors.');

console.log(`Opening ${skipEnergy?'composition preview':'complete master'}: ${model.triangles.length} triangles including ${actorTriangles} actor triangles; ${model.lights.length} lights. Full model casts shadows.`);
const frame=render(model,camera,message=>console.log(`[opening] ${message}`),{shadowModel:model,skipEnergy});
const W=camera.width,H=camera.height,N=W*H;
const energy=frame.energyFrames[0];
if(!energy||frame.energyFrames.length!==ENERGY_FRAMES)throw new Error('Unexpected core energy frame contract.');
// render().rgba ALREADY contains frame zero: base * (1 - energy.a) + energy.rgb.
// energy RGB is integrated radiance, including halo at alpha=0, not straight
// alpha colour. Ordinary PNG source-over or another alpha multiply is wrong.
let compositeMismatches=0;
const expected=new Uint8ClampedArray(1);
for(let i=0;i<N;i++){
  if(frame.rgba[i*4+3]!==255)throw new Error('Opening master must be opaque.');
  for(let k=0;k<3;k++){
    expected[0]=frame.energyBase[i*4+k]*(skipEnergy?1:1-energy[i*4+3]/255)+(skipEnergy?0:energy[i*4+k]);
    if(frame.rgba[i*4+k]!==expected[0])compositeMismatches++;
  }
}
if(compositeMismatches)throw new Error(`Core compositing differs from render contract at ${compositeMismatches} channels.`);
// Validate the untouched author output first, then rebuild the final master
// from the pre-volume base. Scaling already-composited RGB would dim the room
// twice; scaling volume alpha would incorrectly change its optical density.
const master=frame.rgba.slice();
if(!skipEnergy)for(let i=0;i<N;i++)for(let k=0;k<3;k++){
  master[i*4+k]=frame.energyBase[i*4+k]*(1-energy[i*4+3]/255)+energy[i*4+k]*energyRadianceGain;
}
const actorPixels=frame.objects.reduce((n,id)=>n+(id===ACTOR_OBJECT_ID),0);
if(!actorPixels)throw new Error('Opening shot crops or fully occludes its actor.');
// Refuse to stamp metadata over a source edited during a long synchronous bake.
for(const [filename,hash] of Object.entries(hashes)){
  const current=createHash('sha256').update(await fs.readFile(path.join(root,filename))).digest('hex');
  if(current!==hash)throw new Error(`Source changed during render: ${filename}. Rerun the shot.`);
}
await fs.mkdir(output,{recursive:true});
const images={
  [skipEnergy?'master-preview-no-energy.png':'master.png']:master,
  'base.png':frame.energyBase,
  'light-pollution.png':frame.lightFields.pollution,
  'light-furnace.png':frame.lightFields.furnace,
  'light-shoulder.png':frame.lightFields.shoulder,
  'light-core.png':frame.coreLight,
};
if(!skipEnergy)images['energy-frame-0.png']=energy;
const outputs={};
for(const [filename,rgba] of Object.entries(images)){
  const bytes=await sharp(Buffer.from(rgba),{raw:{width:W,height:H,channels:4}}).png().toBuffer();
  await fs.writeFile(path.join(output,filename),bytes);
  outputs[filename]={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,width:W,height:H};
}
const manifest={
  version:1,status:skipEnergy?'composition-draft-energy-omitted':'review-pending',humanReview:'pending',productionIntegrated:false,
  canvas:{width:W,height:H},camera,anchors,meta,
  textures:{master:skipEnergy?'master-preview-no-energy.png':'master.png',base:'base.png',energyFrame0:skipEnergy?null:'energy-frame-0.png',
    pollution:'light-pollution.png',furnace:'light-furnace.png',shoulder:'light-shoulder.png',coreLight:'light-core.png'},
  energy:{included:!skipEnergy,renderedFrames:skipEnergy?0:frame.energyFrames.length,exportedFrameIndices:skipEnergy?[]:[0],periodSeconds:ENERGY_PERIOD,
    seconds:frameSeconds,coreExpansion,coreCycleGain,radianceGain:energyRadianceGain,
    composite:'master.rgb = base.rgb * (1 - energy.a/255) + energy.rgb * radianceGain; Uint8ClampedArray rounding only at final composition; master alpha = 255. Energy PNG stores unscaled raw radiance and unchanged absorption alpha.',
    encoding:'Raw integrated radiance RGB and absorption alpha. RGB may be nonzero at alpha zero. Do not premultiply, flatten, or composite with ordinary source-over.',
    lighting:'The authored shot already applies sourceLightGains to actual core/storage/purifier light powers before rendering base and lightfields. Exporter applies no further base/field gain. Only volume radiance receives coreCycleGain * (.25 + .75 * initialHealth.core). Alpha is never health-scaled; coreLight is a subset of pollution, not a fourth additive light.'},
  lighting:{initialHealth,sourceLightGains,sourceLightGainsAppliedBy:'tools/last-light/opening-shot.ts',baseGainReappliedByExporter:false,
    productionReference:'src/art/last-light-renderer.ts: coreExpansion(0)=0; fire(0)=pulse(0)=0; uCoreGain=.25+.75*health[0].'},
  shadow:{mode:'full-authored-model',includesActor:true,triangles:model.triangles.length},
  statistics:{triangles:model.triangles.length,actorTriangles,actorPixels,lights:model.lights.length,shoulderLights,volumes:model.volumes.length,compositeMismatches},
  source:{entry,sha256:sourceHash,hashes},outputs,
  limitations:skipEnergy?['Internal composition search only: the core volume is omitted; this preview is not a deliverable master.']:['Static frame zero only; motion, continuous transition, audio and human acceptance are not validated.'],
};
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Opening ${manifest.status}: ${output}`);
