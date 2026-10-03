/** Exercise the Vite production artifact in a real Chromium module Worker.
 * No source modules, DEV APIs, user storage, or alternate executor are involved. */
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const output = 'docs/qa/artifacts/rift-r100-i02-validation/async-review';
const origin = process.env.GAME_URL ?? 'http://127.0.0.1:3041/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashValue = value => sha(JSON.stringify(value));
const checksum = value => {
  let hash = 2166136261;
  const bytes=JSON.stringify(value);
  for (let index=0;index<bytes.length;index++) { hash ^= bytes.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
};
const names = await readdir('dist/assets');
const workers = names.filter(name => /^rift-generation-worker-.*\.js$/.test(name));
assert.equal(workers.length, 1, 'One current production Worker artifact must exist');
const workerName = workers[0], workerBytes = await readFile(`dist/assets/${workerName}`);
const references = [];
for (const name of names.filter(name => name.endsWith('.js') && name !== workerName)) {
  const bytes = await readFile(`dist/assets/${name}`);
  if (bytes.includes(workerName)) references.push({ file: `dist/assets/${name}`, sha256: sha(bytes) });
}
assert(references.length > 0, 'Production client bundle must reference the tested Worker artifact');
const fixturePaths = ['tools/recovery/fixtures/world-generation-v1.json', 'tools/recovery/fixtures/legacy-generation-gold.json'];
const fixtures = await Promise.all(fixturePaths.map(async file => ({ file, bytes: await readFile(file) })));
const records = fixtures.flatMap(({bytes}, family) => JSON.parse(bytes).records.map((record,index) => ({
  ...record, caseId: record.id ?? `v1-${index}-${record.identity.seed}`, family,
})));
const report = {
  createdAt: new Date().toISOString(), revision: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  origin, scope: 'Production Vite artifact and actual Chromium Worker compatibility smoke; fixed gold cases, not latency qualification or complete production entry QA.',
  worker: { file: `dist/assets/${workerName}`, bytes: workerBytes.length, sha256: sha(workerBytes), references },
  fixtures: fixtures.map(({file,bytes}) => ({file,sha256:sha(bytes)})), checks: [],
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors = [], consoleErrors = [];
try {
  const context = await browser.newContext(), page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const response = await page.goto(origin);
  assert.equal(response.status(),200);
  await page.waitForFunction(() => document.querySelector('.joint-action')?.disabled === false, null, {timeout:60000});
  const servedWorker = await context.request.get(new URL(`assets/${workerName}`,origin).href);
  assert.equal(servedWorker.status(),200);
  assert.equal(sha(await servedWorker.body()),report.worker.sha256,'Preview serves the exact hashed build artifact');
  report.page = await page.evaluate(() => ({ developmentApiPresent: '__game' in window,
    saved: localStorage.getItem('coh-save-v1'), titleReady: document.querySelector('.joint-action')?.disabled === false }));
  assert.equal(report.page.developmentApiPresent,false);
  assert.equal(report.page.saved,null);
  for (const [index,record] of records.entries()) {
    const actual = await page.evaluate(async ({url,identity,id}) => {
      const started = performance.now(), worker = new Worker(url,{type:'module',name:'production-gold-smoke'});
      return await new Promise((resolve,reject) => {
        const timeout = setTimeout(() => { worker.terminate(); reject(new Error('Production Worker timed out')); },60000);
        const done = action => {clearTimeout(timeout);worker.terminate();action();};
        worker.onerror = event => done(() => reject(new Error(event.message)));
        worker.onmessageerror = () => done(() => reject(new Error('Production Worker clone failure')));
        worker.onmessage = ({data}) => done(() => {
          if (data.id !== id || data.error) return reject(new Error(data.error ?? 'Request id mismatch'));
          resolve({wire:data.result,sharedLayout:data.result.world === null || data.result.layout === data.result.world.layout,
            elapsedMs:performance.now()-started,terminated:true});
        });
        worker.postMessage({id,input:{kind:'recovery',identity}});
      });
    },{url:new URL(`assets/${workerName}`,origin).href,identity:record.identity,id:index+1});
    const {layout,world,identity,generationMs} = actual.wire;
    assert(actual.sharedLayout,'Structured clone preserves shared world/layout reference');
    assert.equal(layout.walkableMask,null);
    const {catalogVersion:_catalog,lootAlgorithmVersion:_loot,combatRulesVersion:_combat,...expectedIdentity}=record.identity;
    assert.deepEqual(identity,expectedIdentity);
    const {walkableMask:_mask,...content}=layout;
    const gold = {layoutSha256:hashValue(content),tileMapSha256:hashValue(layout.tileMap),
      hostMapSha256:world?hashValue(world.hostTileMap):null,sampleSha256:world?hashValue(world.sample):null,
      metadataSha256:world?hashValue(world.metadata):null};
    const checked = record.layoutSha256 ? gold : {tileMapHash:checksum(layout.tileMap),hostMapHash:checksum(world.hostTileMap)};
    for(const [key,value] of Object.entries(checked)) assert.equal(value,record[key],`${record.caseId}: ${key}`);
    report.checks.push({id:record.caseId,status:'pass',signature:identity.signature,
      generationVersion:identity.generation?.version??'unversioned',generationMs,elapsedMs:actual.elapsedMs,
      sharedLayout:actual.sharedLayout,terminated:actual.terminated,gold:checked,cols:layout.tileMap.cols,rows:layout.tileMap.rows});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),null);
  assert.equal(sha(await readFile(report.worker.file)),report.worker.sha256);
  for(const reference of references) assert.equal(sha(await readFile(reference.file)),reference.sha256);
  report.pageErrors=errors;report.consoleErrors=consoleErrors;report.buildArtifactsUnchanged=true;
  report.status='pass';
  await page.screenshot({path:`${output}/production-title-worker-smoke.jpg`});
  await context.close();
} catch(error) {report.status='fail';report.failure=String(error);report.pageErrors=errors;report.consoleErrors=consoleErrors;process.exitCode=1;}
finally {
  report.finishedAt=new Date().toISOString();
  await writeFile(`${output}/production-worker-report.json`,JSON.stringify(report,null,2)+'\n');
  await browser.close();
  console.log(JSON.stringify({status:report.status,cases:report.checks.length,worker:workerName,failure:report.failure}));
}
