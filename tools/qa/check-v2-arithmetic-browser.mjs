/** Genuine historical generation identities; controlled runtime fixture is separate. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-p05/browser-arithmetic');fs.mkdirSync(out,{recursive:true});
const records=JSON.parse(fs.readFileSync('tools/recovery/fixtures/legacy-generation-gold.json')).records.filter(r=>r.identity.generation?.version===2);
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),page=await browser.newPage();
const report={status:'running',base:process.env.GAME_URL??'http://127.0.0.1:3080/',browser:await browser.version(),cases:[],errors:[]};page.on('pageerror',e=>report.errors.push(String(e)));
try{
 await page.goto(report.base);await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 report.atan2=await page.evaluate(async()=>{const m=await import('/src/generation/legacy-rift-v2/fdlibm-atan2.ts');return{native:Math.atan2(-1,7),historicalSse2:m.v8FdlibmAtan2(-1,7),historicalArm64:m.v8Arm64Atan2(-1,7)};});
 for(const row of records){const result=await page.evaluate(async identity=>{
  const {RiftGenerationClient}=await import('/src/generation/rift-generation-client.ts');const {generatedRiftIdentity}=await import('/src/generation/rift-generation-identity.ts');const {hydrateRiftGeneration}=await import('/src/generation/rift-generation-protocol.ts');
  const c=new RiftGenerationClient(),start=performance.now(),wire=await c.generate({kind:'recovery',identity}),{layout,world}=hydrateRiftGeneration(wire);
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))).map(n=>n.toString(16).padStart(2,'0')).join('');const{walkableMask,...content}=layout;
  const gold={layoutSha256:await hash(content),tileMapSha256:await hash(layout.tileMap),hostMapSha256:await hash(world.hostTileMap),sampleSha256:await hash(world.sample),metadataSha256:await hash(world.metadata)};
  return{identity:generatedRiftIdentity(layout,identity.generation,world),gold,generationMs:wire.generationMs,elapsedMs:performance.now()-start,facing:layout.enemySpawns.map(e=>e.facing)};
 },row.identity);assert.deepEqual(result.identity,row.identity);const{id,identity:expectedIdentity,...gold}=row;const{sampleSha256,...contractGold}=gold;const{sampleSha256:sampleActual,...actualContract}=result.gold;assert.deepEqual(actualContract,contractGold);result.unhashedSampleByteEqual=sampleActual===sampleSha256;report.cases.push({id:row.id,...result});}
 const bad=structuredClone(records[0].identity);bad.signature='ffffffff';
 report.negative=await page.evaluate(async identity=>{const{RiftGenerationClient}=await import('/src/generation/rift-generation-client.ts');try{await new RiftGenerationClient().generate({kind:'recovery',identity});return'accepted';}catch(e){return String(e);}},bad);
 assert.match(report.negative,/match|signature/i);assert.notEqual(report.negative,'accepted');assert.deepEqual(report.errors,[]);report.status='pass';report.scope='Exact historical identity, layout, tile/Host maps, metadata and strict rejection. Unhashed material sample equality is reported separately, never relaxed into the save signature.';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}console.log(JSON.stringify(report,null,2));
