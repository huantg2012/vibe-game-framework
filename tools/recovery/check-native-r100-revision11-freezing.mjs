/** Capture an unmodified fixed-Git r11 oracle; replay frozen/public boundaries.
 * node --expose-gc --import tsx tools/recovery/check-native-r100-revision11-freezing.mjs --capture|--frozen|--public
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json is needed only for --public.
 * QA_REPORT may select a new recovery report path; oracle inputs remain fixed.
 * The temporary oracle includes original historical routing; it is NOT shipped.
 * The retained recovery closure must contain neither imports nor prior closures. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {build,version as esbuildVersion} from 'esbuild';
import sharp from 'sharp';
const revision='ef50f137413284d2e1d796adb8d3a358f1e7df59';
const directory='docs/qa/artifacts/native-generation-2026-10-14/recovery';
const baselinePath=`${directory}/r11-original-oracle.json`;
const capture=process.argv.includes('--capture'),publicMode=process.argv.includes('--public');
assert.equal(Number(capture)+Number(publicMode)+Number(process.argv.includes('--frozen')),1,'Select exactly one mode');
const reportPath=capture?baselinePath:process.env.QA_REPORT??`${directory}/r11-${publicMode?'public':'closure'}-recovery.json`;
assert(!fs.existsSync(reportPath),'Never overwrite prior evidence');
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function exactHash(value){const digest=createHash('sha256');function visit(item){
  if(ArrayBuffer.isView(item)){digest.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer,item.byteOffset,item.byteLength));return;}
  if(Array.isArray(item)){digest.update(`array:${item.length}[`);for(const child of item)visit(child);digest.update(']');return;}
  if(item&&typeof item==='object'){digest.update('{');for(const key of Object.keys(item)){visit(key);visit(item[key]);}digest.update('}');return;}
  assert.notEqual(typeof item,'function');const text=item===undefined?'undefined':JSON.stringify(item);digest.update(`${typeof item}:${text.length}:${text}`);
}visit(value);return digest.digest('hex');}
const temporary=fs.mkdtempSync(path.join(tmpdir(),'coh-r11-independent-oracle-'));
const baseline=capture?null:JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const report={status:'running',mode:capture?'unmodified-fixed-Git-oracle':publicMode?'public-routing':'frozen-recovery',sourceRevision:revision,node:process.version,createdAt:new Date().toISOString(),cases:[],failures:[],materialHashes:{},limits:['Three medium-grade fixed departures: no augmentation / added VOID / added solid plus admitted seed retry; not a whole-library verdict.','Full serializable map hash, every hydrated support cell plus exterior probes, base and intact/searched four-channel bytes, full search patches.','Original Git source and asset bytes are the oracle. Sharp material decoding is deterministic in this environment, not browser visual QA.']};
try{
  let executor,materials,originalPatch;
  if(capture){
    const archive=spawnSync('git',['archive',revision,'src','tsconfig.json'],{maxBuffer:128*1024*1024});assert.equal(archive.status,0,archive.stderr.toString());
    const extract=spawnSync('tar',['-x','-C',temporary],{input:archive.stdout});assert.equal(extract.status,0,extract.stderr.toString());
    const entry=`export { createR100ProductionMap } from './src/generation/world-study/r100-production-map';\nexport { createR100ProductionRecipe, validR100ProductionRecipe } from './src/generation/world-study/r100-package';\nexport { hydrateR100MasterWorld } from './src/generation/world-study/r100-native-data';\nexport { bakeMasterWorldSurface } from './src/systems/r100-world/surface-bake';\nexport { bakeSearchSitePatches } from './src/systems/r100-world/search-site-bake';\nexport { validateSearchSites } from './src/generation/world-study/search-site-placement';\nexport { applySearchSitePatch } from './src/systems/r100-world/search-site-patches';\nexport { PAINTED_MATERIALS } from './src/generated/r100-materials';\nexport { ORGANIZATION_MATERIALS } from './src/generated/r100-material-organizations';\n`;
    const result=await build({absWorkingDir:temporary,stdin:{contents:entry,resolveDir:temporary,sourcefile:'original-r11-entry.ts'},bundle:true,format:'esm',platform:'browser',target:'es2020',write:false,metafile:true,tsconfig:path.join(temporary,'tsconfig.json'),treeShaking:true,legalComments:'none'});
    assert.deepEqual(Object.values(result.metafile.outputs).flatMap(x=>x.imports),[]);
    const bytes=result.outputFiles[0].contents,file=path.join(temporary,'original-r11.mjs');fs.writeFileSync(file,bytes);
    report.oracle={sourceRevision:revision,executorSha256:hash(bytes),executorBytes:bytes.length,entrySha256:hash(entry),esbuildVersion,derivation:'None: unmodified source extracted from fixed Git revision, including its public historical dispatch. Temporary module deleted after capture; not the retained recovery closure.',dependencies:Object.keys(result.metafile.inputs).filter(p=>!p.endsWith('original-r11-entry.ts')).sort().map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(temporary,p)))}))};
    executor=await import(pathToFileURL(file).href);materials={painted:executor.PAINTED_MATERIALS,organizations:executor.ORGANIZATION_MATERIALS};originalPatch=executor.applySearchSitePatch;
  }else{
    assert.equal(baseline.status,'passed');assert.equal(baseline.sourceRevision,revision);report.baselineSha256=hash(fs.readFileSync(baselinePath));materials=baseline.materialDefinitions;
    executor=publicMode?{...await import('../../src/generation/world-study/r100-package.ts'),...await import('../../src/generation/world-study/r100-production-map.ts'),...await import('../../src/generation/world-study/r100-native-data.ts'),...await import('../../src/systems/r100-world/surface-bake.ts'),...await import('../../src/systems/r100-world/search-site-bake.ts'),...await import('../../src/generation/world-study/search-site-placement.ts')}:await import('../../src/generation/legacy-r100-v11/executor-recovery.js');
    const manifest=JSON.parse(fs.readFileSync('src/generation/legacy-r100-v11/manifest-recovery.json','utf8')),full=JSON.parse(fs.readFileSync('src/generation/legacy-r100-v11/manifest-revision11.json','utf8'));
    assert.equal(hash(fs.readFileSync('src/generation/legacy-r100-v11/executor-recovery.js')),manifest.executorSha256);assert.deepEqual(manifest.imports,[]);assert(full.dependencies.every(p=>!p.path.includes('legacy-r100-v')));report.frozenClosure={sha256:manifest.executorSha256,bytes:manifest.executorBytes,imports:manifest.imports,priorClosureDependencies:0};
  }
  report.materialDefinitions=materials;
  async function decode(d){assert(d);const file=`public${d.source}`;let bytes;
    if(capture){const result=spawnSync('git',['show',`${revision}:${file}`],{maxBuffer:16*1024*1024});assert.equal(result.status,0);bytes=result.stdout;assert.equal(hash(fs.readFileSync(file)),hash(bytes),'Live path must still preserve original asset');}
    else{bytes=fs.readFileSync(file);assert.equal(hash(bytes),baseline.materialHashes[file],`Historical asset overwritten: ${file}`);}
    report.materialHashes[file]=hash(bytes);return{width:d.logical_pixels,height:d.logical_pixels,worldSize:d.world_size,source:d.source,regions:d.regions,pixels:new Uint8ClampedArray(await sharp(bytes).resize(d.logical_pixels,d.logical_pixels).ensureAlpha().raw().toBuffer())};}
  async function painting(recipe){const read=async d=>({...await decode(d),solid:{...await decode(d.solid),skinRoughness:d.solid.skinRoughness,cutRoughness:d.solid.cutRoughness,gain:d.solid.gain,cutGain:d.solid.cutGain}});const family=recipe.nativeDefinition.family,d=recipe.appearance.materialOrganization?materials.organizations.find(r=>r.organization===recipe.appearance.materialOrganization):materials.painted.find(r=>r.family===family);const primary=await read(d),families={};for(const f of new Set([family,...recipe.nativeDefinition.instances.map(r=>r.family??family)]))families[f]=f===family?primary:await read(materials.painted.find(r=>r.family===f));return{...primary,families,appearance:recipe.appearance};}
  function hydration(world){const grid=world.layout.tileMap,states=new Uint8Array((grid.cols+2)*(grid.rows+2)*4);let n=0;
    for(let r=-1;r<=grid.rows;r++)for(let c=-1;c<=grid.cols;c++){const x=(c+.5)*grid.tileSize,y=(r+.5)*grid.tileSize;states[n++]=Number(world.matterAt(x,y));states[n++]=Number(world.sight.isOpaque(c,r));states[n++]=Number(world.combat.isOpaque(c,r));states[n++]=world.roleAt(x,y)==='solid'?1:world.roleAt(x,y)==='relief'?2:0;}
    executor.validateSearchSites(world);return{cols:grid.cols,rows:grid.rows,cellAndExteriorProbeHash:hash(states),searchSitesHash:exactHash(world.searchSites),cells:(grid.cols+2)*(grid.rows+2)};}
  const channels=['albedo','normal','response','emission'];
  function apply(surface,patch,state){for(const name of channels)for(let row=0;row<patch.height;row++){const offset=row*patch.width*4;surface[name].set(patch[state][name].subarray(offset,offset+patch.width*4),((patch.y+row)*surface.width+patch.x)*4);}}
  const earlierPath='docs/qa/artifacts/spatial-augmentation-2026-10-13/code/final-v4-medium.json',earlier=JSON.parse(fs.readFileSync(earlierPath,'utf8'));report.earlierReceipt={path:earlierPath,sha256:hash(fs.readFileSync(earlierPath))};
  const rows=baseline?.cases??['split-rib-causeway','sloughed-court','gel-rafts'].map(worldId=>({worldId,grade:'medium',requestedSeed:20261012}));
  for(const row of rows){const id=`${row.worldId}-${row.grade}-${row.requestedSeed}`,recipeFile=`${id}.recipe.json`;
    try{
      const recipe=capture?executor.createR100ProductionRecipe(row.worldId,row.requestedSeed,row.grade):JSON.parse(fs.readFileSync(`${directory}/${recipeFile}`,'utf8'));
      assert.equal(recipe.package.algorithmRevision,11);assert(executor.validR100ProductionRecipe(recipe));const before=exactHash(recipe);
      if(capture)fs.writeFileSync(`${directory}/${recipeFile}`,JSON.stringify(recipe,null,2)+'\n',{flag:'wx'});
      else assert.equal(hash(fs.readFileSync(`${directory}/${recipeFile}`)),row.recipeSha256);
      const map=executor.createR100ProductionMap(recipe);assert.equal(exactHash(recipe),before,'Generator must not mutate saved recipe');const mapHash=exactHash(map);
      assert.equal(mapHash,earlier.cases.find(r=>r.worldId===row.worldId).mapHash,'Unmodified r11 must match independently captured final-v4 full map');
      const world=executor.hydrateR100MasterWorld(map.native,map.layout),hydrated=hydration(world),surface=executor.bakeMasterWorldSurface(world,await painting(recipe));
      const material={width:surface.width,height:surface.height,base:Object.fromEntries(channels.map(c=>[c,hash(surface[c])])),patchHash:null,states:{}};
      const patches=executor.bakeSearchSitePatches(world,surface,await painting(recipe));material.patchHash=exactHash(patches);
      for(const state of ['intact','searched']){for(const patch of patches)capture?originalPatch(surface,patch,patch[state]):apply(surface,patch,state);material.states[state]=Object.fromEntries(channels.map(c=>[c,hash(surface[c])]))}
      const item={worldId:row.worldId,grade:row.grade,requestedSeed:row.requestedSeed,effectiveSeed:map.metadata.effectiveSeed,attempt:map.metadata.attempt,recipeFile,recipeSha256:hash(fs.readFileSync(`${directory}/${recipeFile}`)),recipeHash:before,mapHash,hydrated,material};
      if(!capture){assert.deepEqual(item,row,`${id}: original Git oracle differs`);
        for(const revision of [10,12]){const invalid=structuredClone(recipe);invalid.package.algorithmRevision=revision;if(!publicMode){assert.equal(executor.validR100ProductionRecipe(invalid),false);assert.throws(()=>executor.createR100ProductionMap(invalid));assert.throws(()=>executor.bakeMasterWorldSurface({...world,algorithmRevision:revision}));}}
      }
      report.cases.push(item);console.log(`PASS ${report.mode} ${id}`);
    }catch(error){report.failures.push({id,error:error.stack??String(error)});console.error(error);}
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');global.gc?.();
  }
  if(!capture)assert.deepEqual(report.materialHashes,baseline.materialHashes);
  report.status=report.failures.length?'failed':'passed';report.completedAt=new Date().toISOString();fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:report.cases.length,reportPath}));if(report.failures.length)process.exitCode=1;
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
