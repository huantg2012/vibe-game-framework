/** Same-browser historical synchronous executor -> DEV Worker -> production Worker.
 * Keeps the separate Node-gold failure visible; does not relax identity verification. */
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const output='docs/qa/artifacts/rift-r100-i02-validation/async-review';
const development=process.env.DEV_URL??'http://127.0.0.1:3027/';
const production=process.env.GAME_URL??'http://127.0.0.1:3041/';
const sha=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>sha(JSON.stringify(value));
const gold=wire=>{
  const {walkableMask:_mask,...content}=wire.layout;
  return {layoutSha256:hash(content),tileMapSha256:hash(wire.layout.tileMap),
    hostMapSha256:wire.world?hash(wire.world.hostTileMap):null,sampleSha256:wire.world?hash(wire.world.sample):null,
    metadataSha256:wire.world?hash(wire.world.metadata):null};
};
const fixturePath='tools/recovery/fixtures/legacy-generation-gold.json';
const fixtureBytes=await readFile(fixturePath),records=JSON.parse(fixtureBytes).records;
const names=(await readdir('dist/assets')).filter(name=>/^rift-generation-worker-.*\.js$/.test(name));
assert.equal(names.length,1);
const workerName=names[0],artifact=`dist/assets/${workerName}`;
const protectedFiles=[artifact,'src/generation/legacy-rift-v2/executor.js',
  'src/generation/legacy-rift-generation.ts','src/generation/rift-generation-identity.ts',
  'src/generation/rift-generation-execute.ts','src/generation/rift-generation-worker.ts'];
const files=Object.fromEntries(await Promise.all(protectedFiles.map(async file=>[file,sha(await readFile(file))])));
const report={createdAt:new Date().toISOString(),revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  development,production,files,fixture:{file:fixturePath,sha256:sha(fixtureBytes)},
  scope:'Runtime-equivalent migration smoke: browser historical synchronous frozen executor, DEV module Worker, Vite production Worker, fresh-worker identity recovery. Node gold cross-V8 failure is recorded separately and is not waived.',checks:[]};
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??pathToFileURL(path.join(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[],consoleErrors=[];
try {
  const context=await browser.newContext(),devPage=await context.newPage(),prodPage=await context.newPage();
  for(const [name,page] of [['development',devPage],['production',prodPage]]) {
    page.on('pageerror',error=>errors.push({name,error:String(error)}));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push({name,error:message.text()});});
  }
  await devPage.goto(development);await prodPage.goto(production);
  await prodPage.waitForFunction(()=>document.querySelector('.joint-action')?.disabled===false,null,{timeout:60000});
  assert.equal(await prodPage.evaluate(()=>'__game' in window),false);
  const resource=await context.request.get(new URL(`assets/${workerName}`,production).href);
  assert.equal(resource.status(),200);assert.equal(sha(await resource.body()),files[artifact]);
  report.browser={version:browser.version(),userAgent:await prodPage.evaluate(()=>navigator.userAgent)};
  async function recover(page,url,identity,id) {
    return page.evaluate(async({url,identity,id})=>await new Promise((resolve,reject)=>{
      const started=performance.now(),worker=new Worker(url,{type:'module',name:'cold-identity-proof'});
      const timeout=setTimeout(()=>{worker.terminate();reject(new Error('Worker timeout'));},60000);
      const done=action=>{clearTimeout(timeout);worker.terminate();action();};
      worker.onerror=e=>done(()=>reject(new Error(e.message)));
      worker.onmessageerror=()=>done(()=>reject(new Error('Clone error')));
      worker.onmessage=({data})=>done(()=>{
        if(data.id!==id||data.error)return reject(new Error(data.error??'Request id mismatch'));
        resolve({wire:data.result,elapsedMs:performance.now()-started,terminated:true,
          sharedLayout:data.result.world===null||data.result.world.layout===data.result.layout});
      });
      worker.postMessage({id,input:{kind:'recovery',identity}});
    }),{url,identity,id});
  }
  for(const [index,record] of records.entries()) {
    const sync=await devPage.evaluate(async(identity)=>{
      const {restoreLegacyProductionWorld,restoreLegacyProceduralLayout}=await import('/src/generation/legacy-rift-generation.ts');
      const {generatedRiftIdentity}=await import('/src/generation/rift-generation-identity.ts');
      const generation=identity.generation,started=performance.now();
      const world=generation?restoreLegacyProductionWorld(generation):null;
      const layout=world?.layout??restoreLegacyProceduralLayout(identity.seed);
      const actualIdentity=generatedRiftIdentity(layout,generation,world),wire={...layout,walkableMask:null};
      return {layout:wire,world:world?{...world,layout:wire}:null,identity:actualIdentity,generationMs:performance.now()-started};
    },record.identity);
    const dev=await recover(devPage,new URL('src/generation/rift-generation-worker.ts',development).href,sync.identity,index+1);
    const prod=await recover(prodPage,new URL(`assets/${workerName}`,production).href,sync.identity,index+1);
    const expected=gold(sync);
    assert.deepEqual(gold(dev.wire),expected);assert.deepEqual(gold(prod.wire),expected);
    assert.deepEqual(dev.wire.identity,sync.identity);assert.deepEqual(prod.wire.identity,sync.identity);
    assert(dev.sharedLayout&&prod.sharedLayout);assert(dev.terminated&&prod.terminated);
    const nodeGoldDifferences=Object.entries(expected).filter(([key,value])=>record[key]!==value)
      .map(([field,actual])=>({field,nodeGold:record[field],browser:actual}));
    report.checks.push({id:record.id,status:'pass',generationVersion:sync.identity.generation?.version??'unversioned',
      browserSignature:sync.identity.signature,nodeGoldSignature:record.identity.signature,
      nodeGoldMatches:nodeGoldDifferences.length===0&&sync.identity.signature===record.identity.signature,nodeGoldDifferences,
      allGeneratedValuesEqual:true,devWorkerColdRecovery:true,productionWorkerColdRecovery:true,
      sharedReferencePreserved:true,workerTerminations:2,gold:expected,
      descriptiveOnlyTimingMs:{sync:sync.generationMs,devWorker:dev.wire.generationMs,productionWorker:prod.wire.generationMs}});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  assert.equal(await devPage.evaluate(()=>localStorage.getItem('coh-save-v1')),null);
  assert.equal(await prodPage.evaluate(()=>localStorage.getItem('coh-save-v1')),null);
  for(const [file,expected] of Object.entries(files))assert.equal(sha(await readFile(file)),expected);
  report.pageErrors=errors;report.consoleErrors=consoleErrors;report.protectedFilesUnchanged=true;
  report.status='pass';report.nodeCrossRuntimeStatus='not-compatible-for-all-gold-records; see original production-worker-report.json and diagnosis';
  await prodPage.screenshot({path:`${output}/production-title-worker-smoke.jpg`});
  await context.close();
} catch(error) {report.status='fail';report.failure=String(error);report.pageErrors=errors;report.consoleErrors=consoleErrors;process.exitCode=1;}
finally {
  report.finishedAt=new Date().toISOString();await writeFile(`${output}/browser-worker-equivalence-report.json`,JSON.stringify(report,null,2)+'\n');
  await browser.close();console.log(JSON.stringify({status:report.status,cases:report.checks.length,
    nodeGoldMismatches:report.checks.filter(check=>!check.nodeGoldMatches).map(check=>check.id),failure:report.failure}));
}
