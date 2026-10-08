/** Exact five frozen compatibility commands, in an isolated final-source cwd.
 * Execution requires the already assigned root CPU window. No browser or retry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
assert(process.argv.includes('--execute-after-root-cpu-window'),'Explicit assigned CPU window required');
const repository=process.cwd();
const sourceFile='docs/qa/artifacts/r100-i10-i12/final-source/source-snapshot.json';
const sourceSha='e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af';
const preparationFile='docs/qa/artifacts/r100-i10-i12/closeout-independent-review/final-compatibility-preparation.json';
const preparationSha='6928c47f461dda37bb9777aac5b4992a418ed362e8f92075b805a5bae9ce4dee';
const output=path.resolve('docs/qa/artifacts/r100-i10-i12/final-compatibility');
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref=file=>({path:path.relative(repository,path.resolve(file)),sha256:hash(file)});
const read=file=>JSON.parse(fs.readFileSync(file));
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
assert(!fs.existsSync(output),'Preserve earlier compatibility/preflight attempts');fs.mkdirSync(output,{recursive:true});
const receipt={schema:'coh.qa.final-compatibility-execution.v1',status:'preflight',startedAt:new Date().toISOString(),
  authorization:'Root explicitly assigned final-source SHA e4477ea3 and an exclusive single CPU window; no concurrent Chrome/heavy CPU. Stop on first technical failure without retry.',
  source:{path:sourceFile,sha256:sourceSha},preparation:{path:preparationFile,sha256:preparationSha},
  runner:ref(fileURLToPath(import.meta.url)),node:{executable:process.execPath,version:process.version,platform:process.platform,arch:process.arch},checks:[],errors:[]};
const executionFile=path.join(output,'execution.json');write(executionFile,receipt);
let source,plan,stage,inputRecords=[],binding;
const save=()=>write(executionFile,receipt);
function verifySource(){
  assert.equal(hash(sourceFile),sourceSha,'Final source manifest changed');const actual={};
  for(const[file,expected]of Object.entries(source.sources)){
    actual[file]=hash(path.join(source.temporaryRoot,file));assert.equal(actual[file],expected,`Final source changed: ${file}`);
    assert.equal(hash(path.join(stage,file)),expected,`Execution runtime differs from final source: ${file}`);
  }return actual;
}
function verifyInputs(){
  const rows=[];
  for(const input of inputRecords){const original=hash(input.original),staged=hash(input.staged),archived=hash(input.archived);
    assert.equal(original,input.sha256,`Original harness/fixture changed: ${input.original}`);
    assert.equal(staged,input.sha256,`Staged harness/fixture changed: ${input.staged}`);
    assert.equal(archived,input.sha256,`Archived harness/fixture changed: ${input.archived}`);
    rows.push({...input,originalSha256:original,stagedSha256:staged,archivedSha256:archived});
  }
  const protectedHistoricalOutputs=plan.historicalOutputsToProtect.map(row=>{const actualSha256=hash(row.path);assert.equal(actualSha256,row.sha256,`Historical QA output changed: ${row.path}`);return{...row,actualSha256};});
  assert.equal(hash(receipt.runner.path),receipt.runner.sha256);return{files:rows,protectedHistoricalOutputs};
}
function auditBoundary(name){
  const actualRuntime=verifySource(),actualInputs=verifyInputs();
  const value={status:'pass',at:new Date().toISOString(),source:{path:sourceFile,sha256:sourceSha},runtimeFiles:actualRuntime,
    runtimeFileCount:Object.keys(actualRuntime).length,inputs:actualInputs};
  const file=path.join(output,`${name}-sha.json`);assert(!fs.existsSync(file));write(file,value);return ref(file);
}
try{
  assert.equal(hash(sourceFile),sourceSha);assert.equal(hash(preparationFile),preparationSha);
  source=read(sourceFile);plan=read(preparationFile);assert.equal(source.verifiedCopyHashes,true);assert.deepEqual(source.patches,[]);
  assert.equal(source.port,3122);assert.equal(Object.keys(source.sources).length,1397);
  const library=fs.readFileSync(path.join(source.temporaryRoot,'src/generated/r100-native-worlds.ts'),'utf8');
  const catalog=JSON.parse(library.split('R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].trim().replace(/;$/,''));
  assert.equal(catalog.length,108);assert.equal(catalog.filter(world=>world.enabled===true).length,108);
  receipt.enabledWorldCount=catalog.filter(world=>world.enabled).length;
  stage=fs.mkdtempSync(path.join(os.tmpdir(),'coh-r100-final-compatibility-'));receipt.executionRoot=stage;
  for(const name of['src','data','public'])fs.symlinkSync(path.join(source.temporaryRoot,name),path.join(stage,name),'dir');
  for(const file of Object.keys(source.sources).filter(file=>!file.includes('/')))fs.copyFileSync(path.join(source.temporaryRoot,file),path.join(stage,file),fs.constants.COPYFILE_EXCL);
  const dependencyRoot=fs.realpathSync(path.join(source.temporaryRoot,'node_modules'));
  fs.symlinkSync(dependencyRoot,path.join(stage,'node_modules'),'dir');
  receipt.dependencyRuntime={path:dependencyRoot,kind:'existing installed node_modules, external to frozen source manifest',
    packageLock:fs.existsSync('package-lock.json')?ref('package-lock.json'):null,
    packages:Object.fromEntries(['tsx','esbuild','typescript'].map(name=>{const file=path.join(dependencyRoot,name,'package.json');return[name,{version:read(file).version,sha256:hash(file)}];}))};
  const packageJson=read(path.join(stage,'package.json'));assert.equal(packageJson.scripts['check:rift-recovery'],'node tools/recovery/check.mjs');
  const inputs=[...plan.harnessAndSupport.map(row=>({...row,kind:'harness-or-support'})),...plan.fixtures.map(row=>({...row,kind:'historical-read-fixture'}))];
  for(const input of inputs){
    assert.equal(hash(input.path),input.sha256);const staged=path.join(stage,input.path),archived=path.join(output,'input-sources',input.path);
    fs.mkdirSync(path.dirname(staged),{recursive:true});fs.mkdirSync(path.dirname(archived),{recursive:true});
    fs.copyFileSync(input.path,staged,fs.constants.COPYFILE_EXCL);fs.copyFileSync(input.path,archived,fs.constants.COPYFILE_EXCL);
    inputRecords.push({original:input.path,staged,archived:path.relative(repository,archived),sha256:input.sha256,kind:input.kind});
  }
  const env={...process.env,BROWSER:'none',TSX_TSCONFIG_PATH:'tools/contam-preview/tsconfig.json',NODE_OPTIONS:''};
  const unset=[];for(const key of Object.keys(env))if(key.startsWith('QA_')||['GAME_URL','SOURCE_ROOT'].includes(key)){unset.push(key);delete env[key];}
  receipt.environment={BROWSER:'none',TSX_TSCONFIG_PATH:env.TSX_TSCONFIG_PATH,NODE_OPTIONS:'',removedAmbientOverrides:unset.sort()};
  const npm=spawnSync('npm',['--version'],{cwd:stage,env,encoding:'utf8'});assert.equal(npm.status,0,npm.stderr);receipt.npmVersion=npm.stdout.trim();
  receipt.inputFileCount=inputRecords.length;receipt.recoveryRunnerDeclaredSequence=plan.recoverySequentialChecks;
  assert.equal(receipt.recoveryRunnerDeclaredSequence.length,31);
  receipt.before=auditBoundary('before');receipt.status='running';save();
  binding={schema:'coh.qa.final-compatibility-source-binding.v1',status:'running',source:{path:sourceFile,sha256:sourceSha},
    executionRoot:stage,sourceRoot:source.temporaryRoot,method:'Exact final runtime via src/data/public symlinks; root manifest files copied. Tool/support/fixture bytes separately copied into QA cwd and archived. docs is isolated and writable only inside QA cwd.',
    enabledWorldCount:108,before:receipt.before,inputs:inputRecords,protectedHistoricalOutputs:plan.historicalOutputsToProtect,
    dependencyRuntime:receipt.dependencyRuntime};write(path.join(output,'source-binding.json'),binding);
  for(const check of plan.checks){
    const expectedLog=path.resolve(check.log);assert.equal(path.dirname(expectedLog),output);assert(!fs.existsSync(expectedLog));
    const item={id:check.id,command:check.command,cwd:stage,environment:check.env,status:'running',startedAt:new Date().toISOString(),
      before:auditBoundary(`${check.id}-before`),log:{path:check.log}};receipt.checks.push(item);save();
    console.log(`START ${check.id}: ${check.command.join(' ')}`);
    const fd=fs.openSync(expectedLog,'wx'),started=Date.now();
    const result=await new Promise(resolve=>{
      const child=spawn(check.command[0],check.command.slice(1),{cwd:stage,env,stdio:['ignore',fd,fd]});
      child.on('error',error=>{item.spawnError=String(error);});
      child.on('close',(code,signal)=>resolve({code,signal}));
    });fs.closeSync(fd);
    item.exitCode=result.code;item.signal=result.signal;item.endedAt=new Date().toISOString();item.elapsedMs=Date.now()-started;
    item.log=ref(expectedLog);item.after=auditBoundary(`${check.id}-after`);item.status=item.exitCode===0?'pass':'failed';save();
    console.log(`END ${check.id}: exit=${item.exitCode} elapsedMs=${item.elapsedMs}`);
    assert.equal(item.exitCode,0,`Compatibility command failed: ${check.id}; preserve this original attempt and stop`);
  }
  receipt.after=auditBoundary('after');receipt.status='pass';receipt.endedAt=new Date().toISOString();
  const produced='docs/qa/artifacts/iteration-28/reveal-persistence/authoritative-plan.json',generated=path.join(stage,produced);
  assert(fs.existsSync(generated),'Actual recovery checker must produce its isolated authoritative-plan receipt');
  const preserved=path.join(output,'generated-output',produced);fs.mkdirSync(path.dirname(preserved),{recursive:true});fs.copyFileSync(generated,preserved,fs.constants.COPYFILE_EXCL);
  receipt.isolatedProducedOutputs=[ref(preserved)];
  receipt.recoveryCompletionEvidence='Unchanged SHA-verified recovery runner has31 fixed sequential children and exits immediately on nonzero; command exit0 plus the preserved actual child stdout/stderr establishes complete sequence. No separate per-child exit telemetry was introduced.';
  receipt.limitations='CPU recovery/contract checks only; not actual browser recovery, GPU behavior, gameplay, audio or complete I10-I12 acceptance.';
  binding.status='pass';binding.after=receipt.after;binding.commandBoundaries=receipt.checks.map(r=>({id:r.id,before:r.before,after:r.after,log:r.log,exitCode:r.exitCode}));
  binding.isolatedProducedOutputs=receipt.isolatedProducedOutputs;write(path.join(output,'source-binding.json'),binding);
  receipt.sourceBinding=ref(path.join(output,'source-binding.json'));save();
  console.log(JSON.stringify({status:receipt.status,execution:ref(executionFile),sourceBinding:receipt.sourceBinding,checks:receipt.checks.map(r=>({id:r.id,exitCode:r.exitCode,elapsedMs:r.elapsedMs}))}));
}catch(error){
  receipt.status='failed-preserved-no-retry';receipt.endedAt=new Date().toISOString();receipt.errors.push(String(error.stack??error));
  if(binding){binding.status='failed-preserved-no-retry';binding.errors=receipt.errors;write(path.join(output,'source-binding.json'),binding);}
  save();console.error(String(error.stack??error));process.exitCode=1;
}
