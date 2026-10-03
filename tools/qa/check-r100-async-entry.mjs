/** Browser integration test. Fresh isolated storage, real menu actions; invokes
 * the ordinary Rift interaction to isolate async preparation from walking. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/rift-r100-i02-validation/async-entry');
await mkdir(out,{recursive:true});
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??pathToFileURL(path.join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
const page=await context.newPage();
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),date:new Date().toISOString(),
  scope:'Isolated empty browser; actual title/prepare/cancel/pause/continue. Opens the existing Rift interaction by its scene method; not navigation or natural supply validation. Stale-record negative mutates only isolated storage bytes. Worker timings and long tasks separately recorded.',checks:[],errors:[],consoleErrors:[],metrics:[]};
page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
await context.addInitScript(()=>{
  window.__asyncEntryProbe={tasks:[],frames:[],workers:[],started:performance.now()};
  new PerformanceObserver(list=>{for(const e of list.getEntries())window.__asyncEntryProbe.tasks.push({start:e.startTime,duration:e.duration,name:e.name});}).observe({entryTypes:['longtask']});
  const Original=window.Worker;
  window.Worker=class extends Original{
    constructor(...args){super(...args);const record={url:String(args[0]),start:performance.now(),messages:[],end:null};window.__asyncEntryProbe.workers.push(record);
      this.addEventListener('message',()=>record.messages.push(performance.now()));const terminate=this.terminate.bind(this);this.terminate=()=>{record.end=performance.now();terminate();};}
  };
  let last=0;function tick(now){if(last)window.__asyncEntryProbe.frames.push({at:now,ms:now-last});last=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
});
const save=()=>page.evaluate(()=>localStorage.getItem('coh-save-v1'));
const press=key=>page.keyboard.press(key,{delay:65});
const ready=()=>page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene')&&document.querySelector('.joint-action')?.disabled===false,null,{timeout:60000});
const scene=key=>page.waitForFunction(key=>window.__game?.scene.isActive(key),key,{timeout:65000});
async function snap(name){await page.screenshot({path:path.join(out,`${name}.jpg`)});}
async function openPrepare(){
  await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').openWorldInteraction('rift'));
  await page.getByRole('button',{name:/踏入裂隙/}).waitFor({state:'visible'});await page.waitForTimeout(350);
}
async function prepare(){await openPrepare();await press('Shift+Enter');}
async function timing(label){
  const p=await page.evaluate(async()=>({probe:window.__asyncEntryProbe,preparation:(await import('/src/managers/rift-recovery.ts')).getProceduralPreparationMetrics?.()}));
  const workers=p.probe.workers.map(w=>({...w,longTasks:p.probe.tasks.filter(t=>t.start>=w.start&&t.start<(w.messages[0]??w.end??Infinity)),
    frameCount:p.probe.frames.filter(t=>t.at>=w.start&&t.at<(w.messages[0]??w.end??Infinity)).length}));
  report.metrics.push({label,workers,preparation:p.preparation,longTasks:p.probe.tasks});
}
try{
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:3027/');await ready();await press('Enter');await scene('PurificationScene');await page.waitForTimeout(1800);
  const base=await save();assert(base,'fresh base was saved');
  await prepare();await page.getByRole('button',{name:'取消准备',exact:true}).waitFor({state:'visible'});await snap('01-cancellable-departure');
  await page.getByRole('button',{name:'取消准备',exact:true}).click();await page.waitForTimeout(500);
  assert((await save())===base,'cancelled generation does not begin or consume a run');
  assert.equal(await page.evaluate(()=>window.__game.scene.isActive('PurificationScene')),true);report.checks.push('departure cancellation preserves exact save and haven');
  await prepare();await scene('RiftScene');await page.waitForTimeout(200);await press('Escape');await page.waitForTimeout(250);
  const departed=JSON.parse(await save());assert.equal(departed.inventory.run.status,'active');assert(departed.riftCheckpoint);await timing('new departure');await snap('02-rift-paused');
  report.checks.push('background generation enters a real saved Rift');
  await page.reload();await ready();
  // pagehide/visibility flush the last complete frame before navigation. The
  // cancellation contract starts at the record now visible on the cold title.
  const checkpointRaw=await save();
  await press('Enter');await page.getByRole('button',{name:'取消载入',exact:true}).waitFor({state:'visible'});await snap('03-cancellable-continue');
  await press('Escape');await page.waitForTimeout(300);
  assert((await save())===checkpointRaw,'cancelled cold recovery preserves exact saved bytes');report.checks.push('cold-recovery cancellation preserves exact checkpoint');
  // Alter valid JSON whitespace while preparation is outstanding. This is a
  // storage concurrency fault, not a change to any gameplay value.
  await press('Enter');await page.getByRole('button',{name:'取消载入',exact:true}).waitFor({state:'visible'});
  await page.evaluate(raw=>localStorage.setItem('coh-save-v1',raw+' '),checkpointRaw);
  await page.getByText('等待期间记录发生了变化，请重新选择继续。原记录已保留。',{exact:true}).waitFor({timeout:65000});
  assert((await save())===checkpointRaw+' ');assert.equal(await page.evaluate(()=>window.__game.scene.isActive('MainMenuScene')),true);
  report.checks.push('changed record refused without replacing bytes or entering the Rift');await snap('04-record-changed');
  await press('Enter');await scene('RiftScene');await page.waitForTimeout(150);await press('Escape');await page.waitForTimeout(200);
  const recovered=JSON.parse(await save());
  assert.equal(recovered.inventory.run.id,departed.inventory.run.id);assert.deepEqual(recovered.riftCheckpoint.identity,departed.riftCheckpoint.identity);
  assert.equal(recovered.riftCheckpoint.state.combat.health,departed.riftCheckpoint.state.combat.health);
  assert.deepEqual(recovered.riftCheckpoint.state.player.position,departed.riftCheckpoint.state.player.position);
  await timing('cold continue');await snap('05-recovered');report.checks.push('same run, world signature, position and health after resume');
  assert.deepEqual(report.errors,[]);report.status='passed';
}catch(error){report.status='failed';report.failure=String(error);await snap('failure').catch(()=>{});throw error;}
finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks,failure:report.failure}));}
