/** Compare real production payloads around a reviewed surface-only ground edge
 * correction. This is not a geometry-signature/RGBA equivalence assertion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const arg=name=>{const at=process.argv.indexOf(name);assert(at>=0&&process.argv[at+1],`${name} required`);return process.argv[at+1];};
const beforePath=arg('--before'),afterPath=arg('--after'),folder=path.resolve(arg('--output'));
assert(!fs.existsSync(folder),'Preserve previous attempts');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt=file=>({path:file,sha256:hash(fs.readFileSync(file))});
const frozen=file=>{const value=JSON.parse(fs.readFileSync(file));assert.equal(value.verifiedCopyHashes,true);assert.deepEqual(value.patches,[]);return value;};
const before=frozen(beforePath),after=frozen(afterPath);
const verify=source=>{for(const [file,sha]of Object.entries(source.sources))assert.equal(hash(fs.readFileSync(path.join(source.temporaryRoot,file))),sha,`Frozen file changed: ${file}`);};
const planPath='docs/qa/artifacts/r100-i10-i12/qualification-plan.json',plan=JSON.parse(fs.readFileSync(planPath));
assert.deepEqual(plan.actualPlay.seeds,[20261005,3075192741]);
const worlds=['cleft-tableland'],grades=['low','medium','severe'];
fs.mkdirSync(folder,{recursive:true});
const report={status:'running',purpose:'r100-ground-edge-production-behavior',before:receipt(beforePath),after:receipt(afterPath),
  qualificationPlan:receipt(planPath),harness:receipt('tools/qa/check-r100-ground-edge-behavior.mjs'),
  worlds,grades,seeds:plan.actualPlay.seeds,executors:[],cases:[],
  scope:'Six fixed production identities for already-qualified cleft only. Authored recipe, deployed content/support/Host/pollution and blocking meshes must remain exact. Ground-edge pixels, Z/normals and generation signatures are reported separately; no art or complete-source inheritance is granted here.'};
const entry=`import {createHash} from 'node:crypto';
import {createR100ProductionRecipe} from './src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from './src/generation/world-study/r100-production-map.ts';
const canonical=value=>JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?{type:item.constructor.name,bytes:Buffer.from(item.buffer,item.byteOffset,item.byteLength).toString('base64')}:item instanceof Map?[...item.entries()]:item);
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
export function capture(world,seed,grade){
 const recipe=createR100ProductionRecipe(world,seed,grade),map=createR100ProductionMap(recipe),native=map.native;
 if(recipe.package.algorithmRevision!==6)throw Error('Expected revision6');
 const holders=recipe.nativeDefinition.instances.filter(row=>row.groundEdgeWidth!==undefined);
 if(holders.length!==1||holders[0].role!=='relief'||holders[0].height>6)throw Error('Only one shallow ground-edge holder admitted');
 const {meshes,raster,diagnostics,packageHash,...nativeBehavior}=native;
 const {geometryFingerprint,sourceHash,triangles,...behaviorDiagnostics}=diagnostics;
 const physicalRaster=Object.fromEntries(['config','width','height','pixelSize','cellSize','columns','rows','occupancy','optical','matter'].map(key=>[key,raster[key]]));
 return {world,grade,seed,algorithmRevision:recipe.package.algorithmRevision,
  exact:{recipe:hash({...recipe,package:{...recipe.package,dependencyHash:'identity-only'}}),
   production:hash({...map,native:undefined,metadata:{...map.metadata,signature:'identity-only'}}),
   nativeBehavior:hash(nativeBehavior),behaviorDiagnostics:hash(behaviorDiagnostics),physicalRaster:hash(physicalRaster),
   blockingMeshes:hash(meshes.filter(mesh=>mesh.spec.blocking===1)),
   nonEdgeMeshes:hash(meshes.filter(mesh=>mesh.spec.id!==holders[0].id))},
  observed:{packageHash,signature:map.metadata.signature,geometryFingerprint,sourceHash,triangles,
   raster:Object.fromEntries(Object.keys(raster).map(key=>[key,hash(raster[key])])),
   edgeMesh:hash(meshes.find(mesh=>mesh.spec.id===holders[0].id))}};
}`;
async function executor(label,source){
 const result=await build({stdin:{contents:entry,resolveDir:source.temporaryRoot,sourcefile:'ground-edge-production-probe.ts',loader:'ts'},bundle:true,write:false,metafile:true,
  platform:'node',format:'esm',target:'node22',tsconfigRaw:{compilerOptions:{baseUrl:source.temporaryRoot,paths:{'@/*':['src/*']}}}});
 const entryFiles=Object.keys(result.metafile.inputs).filter(file=>path.basename(file)==='ground-edge-production-probe.ts');
 assert.equal(entryFiles.length,1,'Exactly one controlled probe entry required');
 const dependencies=Object.keys(result.metafile.inputs).filter(file=>file!==entryFiles[0]).map(file=>{
  const relative=path.relative(source.temporaryRoot,path.resolve(file));assert(source.sources[relative],`Unfrozen import: ${file}`);
  assert.equal(hash(fs.readFileSync(file)),source.sources[relative]);return {path:relative,sha256:source.sources[relative]};});
 const out=path.join(folder,`${label}.mjs`);fs.writeFileSync(out,result.outputFiles[0].contents,{flag:'wx'});
 report.executors.push({...receipt(out),dependencies});return import(pathToFileURL(out).href);
}
try{
 verify(before);verify(after);
 const old=await executor('before',before),current=await executor('after',after);
 for(const world of worlds)for(const grade of grades)for(const seed of plan.actualPlay.seeds){
  const left=old.capture(world,seed,grade),right=current.capture(world,seed,grade);
  const row={world,grade,seed,before:left,after:right};report.cases.push(row);
  assert.deepEqual(right.exact,left.exact,`${world}/${grade}/${seed}: production behavior changed`);
  row.behaviorExact=true;row.identityExact=right.observed.signature===left.observed.signature&&right.observed.packageHash===left.observed.packageHash;
  row.changedRasterFields=Object.keys(left.observed.raster).filter(key=>left.observed.raster[key]!==right.observed.raster[key]);
  console.log(`PASS production body/content: ${world}/${grade}/${seed}; signature exact=${row.identityExact}`);
 }
 verify(before);verify(after);report.sourceBeforeAndAfterExact=true;report.status='pass';
}catch(error){report.status='failed';report.failure=error.stack??String(error);process.exitCode=1;}
fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(`${report.status}: ${report.cases.filter(row=>row.behaviorExact).length}/6 bounded production cases`);
