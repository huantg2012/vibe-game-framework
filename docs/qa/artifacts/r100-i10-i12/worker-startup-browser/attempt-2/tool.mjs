/** Controlled transport fault only. Real default clients/Workers and immutable
 * frozen runtime; never a natural-gameplay or final-matrix admission result.
 * --source <frozen manifest> --output <new directory> --url <frozen origin>
 * --self-check runs only small summary guards, without Chrome or generation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyServedSourceFile} from './r100-i09-final-probe.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const INPUT=Object.freeze({worldId:'ash-strata',grade:'medium',seed:20261005});
const WORKERS={generation:'/src/generation/rift-generation-worker.ts',surface:'/src/systems/r100-world/surface-preparation-worker.ts'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const sha=p=>hash(fs.readFileSync(p));
const receipt=p=>({path:path.relative(ROOT,p),sha256:sha(p)});
const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
export function assertContextEvidence(row,target){
 assert.equal(row.status,'pass');assert.equal(row.controlledTransport,true);assert.equal(row.workersClosedBeforeContext,true);
 for(const stage of row.stages){assert.deepEqual(stage.inputBefore,stage.inputAfter,'request inputs must remain attached and byte-identical');assert(stage.output.digest,'complete output digest missing');}
 const failures=row.events.filter(e=>e.event==='requestfailed');
 assert.equal(failures.length,target?1:0,'unexpected or missing transport failure');
 assert(!row.events.some(e=>e.event==='crash'||e.event==='http-error'),'unexpected crash/HTTP error');
 const expected=target==='generation'?{generation:2,surface:0}:target==='surface'?{generation:1,surface:2}:{generation:1,surface:1};
 for(const[k,n]of Object.entries(expected)){
  const req=row.events.filter(e=>e.event==='worker-script-request'&&e.kind===k);
  assert.equal(req.length,n,`${k}: initial script attempt count`);
  if(n){assert.equal(new Set(req.map(e=>e.url)).size,1,'retry changed script URL');}
  const created=row.events.filter(e=>e.event==='worker-created'&&e.kind===k),closed=row.events.filter(e=>e.event==='worker-closed'&&e.kind===k);
  const exposed=n-(target===k?1:0);
  assert.equal(created.length,exposed,`${k}: successfully exposed Worker contexts (aborted module has none)`);assert.deepEqual(closed.map(e=>e.workerId).sort(),created.map(e=>e.workerId).sort(),`${k}: worker termination pairing`);
 }
 if(target){const req=row.events.filter(e=>e.event==='worker-script-request'&&e.kind===target);assert.equal(req[0].injected,true);assert.equal(req[1].injected,false);assert.equal(failures[0].url,req[0].url);assert.equal(failures[0].injectedRequest,true);}
 else assert.equal(row.events.filter(e=>e.event==='pageerror'||e.event==='console-error').length,0,'baseline browser errors');
}

// Runs in an otherwise empty same-origin page. All calls use default production
// client factories; no Worker/postMessage/input/result/clock wrappers are used.
async function initializePage(input){
 const[{RiftGenerationClient},{hydrateRiftGeneration},{createR100ProductionRecipe},{R100SurfacePreparationClient},{loadPaintedMaterial}]=await Promise.all([
  import('/src/generation/rift-generation-client.ts'),import('/src/generation/rift-generation-protocol.ts'),import('/src/generation/world-study/r100-package.ts'),
  import('/src/systems/r100-world/surface-preparation-client.ts'),import('/src/systems/r100-world/painted-material.ts')]);
 const recipe=createR100ProductionRecipe(input.worldId,input.seed,input.grade);
 if(recipe.package.algorithmRevision!==6)throw Error('Expected current revision6 recipe');
 const generationInput={kind:'departure',generation:recipe};
 const digestBytes=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');
 // Hash complete values, type/length/bytes of every array, and shared-reference
 // graph. Only generationMs at the outer result is intentionally omitted.
 async function fingerprint(value){
  const seen=new Map(),buffers=[],views=[];
  async function visit(v,at){
   if(v===null)return null;
   if(typeof v==='number')return Number.isFinite(v)?(Object.is(v,-0)?{$number:'-0'}:v):{$number:String(v)};
   if(typeof v==='undefined')return {$undefined:true};
   if(typeof v!=='object'){if(['function','symbol','bigint'].includes(typeof v))throw Error(`Unsupported fingerprint value ${at}`);return v;}
   if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,at);
   if(v instanceof ArrayBuffer){const entry={path:at,byteLength:v.byteLength,sha256:await digestBytes(v)};buffers.push(entry);return {$buffer:entry};}
   if(ArrayBuffer.isView(v)){const entry={path:at,type:v.constructor.name,byteOffset:v.byteOffset,byteLength:v.byteLength,length:v.length??null,sha256:await digestBytes(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))};views.push(entry);return {$view:entry,buffer:await visit(v.buffer,at+'#buffer')};}
   if(v instanceof Map){const a=[];let i=0;for(const[k,x]of v)a.push([await visit(k,at+`.mapKey${i}`),await visit(x,at+`.mapValue${i++}`)]);return {$map:a};}
   if(v instanceof Set){const a=[];let i=0;for(const x of v)a.push(await visit(x,at+`.set${i++}`));return {$set:a};}
   if(Array.isArray(v)){const a=[];for(let i=0;i<v.length;i++)a.push(await visit(v[i],at+`[${i}]`));return a;}
   const obj={};for(const key of Object.keys(v).sort())obj[key]=await visit(v[key],at+'.'+key);return obj;
  }
  const canonical=await visit(value,'$');return {digest:await digestBytes(new TextEncoder().encode(JSON.stringify(canonical))),buffers,views};
 }
 window.__controlledWorkerStudy={recipe,generationInput,fingerprint,async generate(){
  const before=await fingerprint(generationInput),start=performance.now();
  const wire=await new RiftGenerationClient().generate(generationInput);const after=await fingerprint(generationInput);
  const {generationMs,...deterministic}=wire;
  this.wire=wire;return{kind:'generation',elapsedMs:performance.now()-start,generationMs,inputBefore:before,inputAfter:after,output:await fingerprint(deterministic),identity:wire.identity,requestedSeed:recipe.requestedSeed,effectiveSeed:wire.layout.seed,excludedOutputFields:['$.generationMs']};
 },async prepare(){
  if(!this.wire)throw Error('Surface input requires the preceding actual Worker generation');
  const {world}=hydrateRiftGeneration(this.wire);if(!world?.native)throw Error('Missing admitted native world');
  const families=[...new Set([recipe.nativeDefinition.family,...recipe.nativeDefinition.instances.map(i=>i.family??recipe.nativeDefinition.family)])];
  const sources=await Promise.all(families.map(f=>loadPaintedMaterial(f,f===recipe.nativeDefinition.family?recipe.appearance?.materialOrganization:undefined)));
  const painting=Object.freeze({...sources[0],...(world.native.appearance?{appearance:world.native.appearance}:{}),...(families.length>1?{families:Object.freeze(Object.fromEntries(families.map((f,i)=>[f,sources[i]])))}:{})});
  const surfaceInput={native:world.native,layout:world.layout,painting},before=await fingerprint(surfaceInput),start=performance.now();
  const result=await new R100SurfacePreparationClient().prepare(surfaceInput);
  return{kind:'surface',elapsedMs:performance.now()-start,inputBefore:before,inputAfter:await fingerprint(surfaceInput),output:await fingerprint(result),identity:result.identity,excludedOutputFields:[],inputOrigin:'real preceding generation Worker + production hydrate/painted material loader; native constructor and cached material inputs are never transferred away'};
 }};
 return {recipe,recipeDigest:(await fingerprint(recipe)).digest};
}

async function main(){
 const sourcePath=path.resolve(ROOT,arg('--source')??''),out=path.resolve(ROOT,arg('--output')??''),base=arg('--url');
 assert(arg('--source')&&arg('--output')&&base,'Require --source, --output and --url');assert(!fs.existsSync(out),'Preserve each prior run; output must be new');
 const source=JSON.parse(fs.readFileSync(sourcePath));assert.equal(source.verifiedCopyHashes,true);assert.deepEqual(source.patches,[]);assert.equal(Number(new URL(base).port),source.port);assert(Object.keys(source.sources).length>1000);
 for(const required of ['src/utils/worker-request.ts','src/generation/rift-generation-client.ts','src/generation/rift-generation-worker.ts','src/systems/r100-world/surface-preparation-client.ts','src/systems/r100-world/surface-preparation-worker.ts'])assert(source.sources[required],`Missing frozen ${required}`);
 fs.mkdirSync(out,{recursive:true});const log=fs.openSync(path.join(out,'events.jsonl'),'wx');
 const report={status:'running',scope:'Controlled initial-script transport abort, not naturally occurring gameplay, final324 coverage, or performance measurement.',source:receipt(sourcePath),tool:receipt(fileURLToPath(import.meta.url)),sourceVerifier:receipt(path.join(ROOT,'tools/qa/r100-i09-final-probe.mjs')),input:INPUT,base,contexts:[],startedAt:new Date().toISOString(),notBrowserTestedHere:['persistent failure capped at2','abort during120ms delay','explicit compute error no retry'],pureContract:receipt(path.join(ROOT,'tools/recovery/check-worker-startup-retry.ts'))};
 const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 const verifyDisk=()=>{assert.equal(sha(sourcePath),report.source.sha256);for(const[file,expected]of Object.entries(source.sources)){assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));assert.equal(sha(path.join(source.temporaryRoot,file)),expected,`Frozen input changed ${file}`);}return{files:Object.keys(source.sources).length,manifestSha256:sha(sourcePath)};};
 let browser;const loaded=new Set();
 try{
  report.diskBefore=verifyDisk();
  const{chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const launchOptions={headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'};report.launchOptions=launchOptions;
  browser=await chromium.launch(launchOptions);report.browser=await browser.version();
  for(const target of [null,'generation','surface']){
   const row={name:target?`${target}-initial-script-once`:'same-source-no-fault',controlledTransport:true,status:'running',target,events:[],stages:[],observationBoundary:'Initial script requests count startup attempts. page.worker observes exposed execution contexts; the once-aborted initial module produces none. Termination of that unexposed object is not directly observed here; only the successful replacement is paired before teardown.'};report.contexts.push(row);
   const record=e=>{const event={at:new Date().toISOString(),...e};row.events.push(event);fs.writeSync(log,JSON.stringify({context:row.name,...event})+'\n');};
   const context=await browser.newContext(),injectedRequests=new WeakSet();let injected=0,nextWorker=0;
   context.on('request',request=>{const url=new URL(request.url());const file=url.pathname.slice(1);if(source.sources[file])loaded.add(file);else if(source.sources['public/'+file])loaded.add('public/'+file);});
   context.on('requestfailed',request=>record({event:'requestfailed',url:request.url(),failure:request.failure(),injectedRequest:injectedRequests.has(request)}));
   context.on('response',response=>{if(response.status()>=400)record({event:'http-error',url:response.url(),status:response.status()});});
   const htmlUrl=new URL('/__r100_worker_startup_control__.html',base).href;
   await context.route(htmlUrl,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Controlled Worker transport probe</title>'}));
   await context.route(url=>Object.values(WORKERS).includes(url.pathname),async route=>{
    const request=route.request(),url=new URL(request.url()),kind=Object.keys(WORKERS).find(k=>WORKERS[k]===url.pathname);
    assert(url.searchParams.has('worker_file'),'Only Vite initial Worker module requests may be injected');
    const fail=kind===target&&injected===0;
    record({event:'worker-script-request',kind,url:request.url(),injected:fail});
    if(fail){injected++;injectedRequests.add(request);await route.abort('failed');}else await route.continue();
   });
   const page=await context.newPage();page.on('pageerror',error=>record({event:'pageerror',message:String(error),stack:error.stack}));page.on('crash',()=>record({event:'crash'}));page.on('console',message=>{if(message.type()==='error')record({event:'console-error',text:message.text(),location:message.location()});});
   page.on('worker',worker=>{const workerId=++nextWorker,kind=Object.keys(WORKERS).find(k=>new URL(worker.url()).pathname===WORKERS[k]);record({event:'worker-created',workerId,kind,url:worker.url()});worker.on('close',()=>record({event:'worker-closed',workerId,kind,url:worker.url()}));});
   try{
    await page.goto(htmlUrl);row.setup=await page.evaluate(initializePage,INPUT);
    row.stages.push(await page.evaluate(()=>window.__controlledWorkerStudy.generate()));save();
    if(target!=='generation'){row.stages.push(await page.evaluate(()=>window.__controlledWorkerStudy.prepare()));save();}
    // The production helper terminates on resolution; allow event delivery, not
    // another test attempt. Count pairing only after the context fully closes.
    const closeDeadline=Date.now()+2000;
    while(row.events.filter(e=>e.event==='worker-closed').length<row.events.filter(e=>e.event==='worker-created').length && Date.now()<closeDeadline)await page.waitForTimeout(10);
    row.workersClosedBeforeContext=row.events.filter(e=>e.event==='worker-closed').length===row.events.filter(e=>e.event==='worker-created').length;
    assert.equal(row.workersClosedBeforeContext,true,'production clients must terminate Workers before context teardown');
    row.status='pass';
   }finally{record({event:'context-close-start'});await context.close();}
   assert.equal(injected,target?1:0);assertContextEvidence(row,target);save();
  }
  const[baseline,generation,surface]=report.contexts;
  for(const row of report.contexts)assert.deepEqual(row.setup,baseline.setup,'same exact recipe in every context');
  const bg=baseline.stages[0],bs=baseline.stages[1],rg=generation.stages[0],sg=surface.stages[0],ss=surface.stages[1];
  for(const g of [rg,sg]){assert.deepEqual(g.inputBefore,bg.inputBefore);assert.deepEqual(g.identity,bg.identity);assert.deepEqual(g.output,bg.output,'all generation fields except $.generationMs');}
  assert(bs.inputBefore.buffers.reduce((n,b)=>n+b.byteLength,0)>1000000,'Real native/material buffers are required');
  assert.deepEqual(ss.inputBefore,bs.inputBefore,'surface native/layout/painting bytes and graph');assert.deepEqual(ss.output,bs.output,'all RGBA, paintHosts, gameplay fields');assert.equal(ss.identity,bs.identity);
  report.comparison={generationExactExceptGenerationMs:true,surfaceWholeResultExact:true,sameOriginalRecipe:true,allInputBuffersRetained:true,transportRequestId:'Default clients called once per stage. Internal retry request.id equality is covered by the separate pure contract; this browser test does not intercept postMessage.'};
  await browser.close();browser=undefined;
  report.diskAfter=verifyDisk();report.servedSources={};
  for(const file of [...loaded].sort()){
   const publicFile=file.startsWith('public/'),url=new URL(publicFile?'/'+file.slice(7):'/'+file+'?raw&import',base);
   report.servedSources[file]=await verifyServedSourceFile({file,expected:source.sources[file],url,literalModule:!publicFile,failureDirectory:path.join(out,'source-failures')});
  }
  assert(loaded.has('src/utils/worker-request.ts'));for(const value of Object.values(WORKERS))assert(loaded.has(value.slice(1)));
  report.status='pass-controlled-worker-startup-recovery';
 }catch(error){report.status='failed-controlled-worker-startup-recovery';report.error=String(error);report.stack=error.stack;process.exitCode=1;}
 finally{if(browser)await browser.close();report.endedAt=new Date().toISOString();save();fs.closeSync(log);}
 console.log(JSON.stringify({status:report.status,report:path.relative(ROOT,path.join(out,'report.json')),contexts:report.contexts.length}));
}

function selfCheck(){
 const digest={digest:'abc',buffers:[{byteLength:8,sha256:'def'}],views:[]};
 const base={status:'pass',controlledTransport:true,workersClosedBeforeContext:true,stages:[{inputBefore:digest,inputAfter:structuredClone(digest),output:digest}],events:[]};
 const make=target=>{const row=structuredClone(base);for(const[k,n]of Object.entries(target==='generation'?{generation:2}:target==='surface'?{generation:1,surface:2}:{generation:1,surface:1}))for(let i=0;i<n;i++){const url='http://localhost'+WORKERS[k]+'?worker_file&type=module',workerId=k+i;row.events.push({event:'worker-script-request',kind:k,url,injected:k===target&&i===0});if(k===target&&i===0)row.events.push({event:'requestfailed',url,injectedRequest:true});else row.events.push({event:'worker-created',kind:k,workerId},{event:'worker-closed',kind:k,workerId});}return row;};
 for(const t of [null,'generation','surface'])assertContextEvidence(make(t),t);
 const bad=(change)=>{const r=make('generation');change(r);assert.throws(()=>assertContextEvidence(r,'generation'));};
 bad(r=>r.stages[0].inputAfter.buffers[0].byteLength=0);
 bad(r=>r.workersClosedBeforeContext=false);
 bad(r=>r.events.push({event:'requestfailed',url:'other',injectedRequest:false}));
 bad(r=>r.events=r.events.filter(e=>e.event!=='worker-closed'));
 bad(r=>r.events.find(e=>e.event==='worker-script-request'&&!e.injected).url+='different');
 bad(r=>r.events.find(e=>e.event==='worker-script-request'&&!e.injected).injected=true);
 console.log('PASS 3 synthetic summaries / 6 rejection guards; no browser or generation executed');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(process.argv.includes('--self-check'))selfCheck();else await main();}
