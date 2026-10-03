import { readFile, writeFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root='docs/qa/artifacts/rift-r100-i02-validation/async-review';
const fixture=JSON.parse(await readFile('tools/recovery/fixtures/legacy-generation-gold.json','utf8')).records[0];
const worker=(await readdir('dist/assets')).find(name=>/^rift-generation-worker-.*\.js$/.test(name));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??pathToFileURL(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results={};
try {
  for(const [variant,origin,relative] of [['production','http://127.0.0.1:3041/',`assets/${worker}`],['development','http://127.0.0.1:3027/','src/generation/rift-generation-worker.ts']]) {
    const page=await browser.newPage();await page.goto(origin);
    results[variant]=await page.evaluate(async({url,generation})=>await new Promise((resolve,reject)=>{
      const worker=new Worker(url,{type:'module'}),timeout=setTimeout(()=>{worker.terminate();reject(new Error('timeout'))},60000);
      worker.onerror=e=>{clearTimeout(timeout);worker.terminate();reject(new Error(e.message))};
      worker.onmessage=({data})=>{clearTimeout(timeout);worker.terminate();data.error?reject(new Error(data.error)):resolve(data.result)};
      worker.postMessage({id:1,input:{kind:'departure',generation}});
    }),{url:new URL(relative,origin).href,generation:fixture.identity.generation});
    await page.close();
  }
} finally {await browser.close();}
results.node=JSON.parse(execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',`import {readFileSync} from 'node:fs';
import {executeRiftGeneration} from './src/generation/rift-generation-execute.ts';
const record=JSON.parse(readFileSync('tools/recovery/fixtures/legacy-generation-gold.json','utf8')).records[0];
console.log(JSON.stringify(executeRiftGeneration({kind:'departure',generation:record.identity.generation})));`],{encoding:'utf8',maxBuffer:20*1024*1024}));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const differences=[];
function compare(a,b,key='') {
  if(Object.is(a,b))return;
  if(a&&b&&typeof a==='object'&&typeof b==='object') {for(const k of new Set([...Object.keys(a),...Object.keys(b)]))compare(a[k],b[k],`${key}.${k}`);}
  else if(!key.endsWith('.generationMs')) differences.push({path:key,production:a,node:b});
}
compare(results.production,results.node);
const devDifferences=[];
for(const k of ['identity','layout','world'])if(hash(results.development[k])!==hash(results.node[k]))devDifferences.push(k);
const report={createdAt:new Date().toISOString(),worker,expectedIdentity:fixture.identity,
  summaries:Object.fromEntries(Object.entries(results).map(([key,value])=>[key,{identity:value.identity,generationMs:value.generationMs,layoutHash:hash(value.layout),hostHash:hash(value.world?.hostTileMap),sampleHash:hash(value.world?.sample)}])),
  developmentNodeDifferingKeys:devDifferences,productionNodeDifferenceCount:differences.length,productionNodeFirstDifferences:differences.slice(0,40)};
await writeFile(`${root}/production-worker-diagnosis.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({developmentNodeDifferingKeys:devDifferences,productionNodeDifferenceCount:differences.length,firstDifferences:differences.slice(0,8)}));
