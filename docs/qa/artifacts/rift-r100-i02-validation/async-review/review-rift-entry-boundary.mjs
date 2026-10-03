/** Native DEV deep-link compatibility and unprepared recovery rejection.
 * Isolated storage and explicit invalid-entry fault injection; no game saves touched. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = 'docs/qa/artifacts/rift-r100-i02-validation/async-review';
const origin = process.env.GAME_URL ?? 'http://127.0.0.1:3027/';
const hash = value => createHash('sha256').update(value).digest('hex');
const sources = Object.fromEntries(await Promise.all(['src/scenes/rift-scene.ts','src/managers/rift-recovery.ts','src/scenes/boot-scene.ts']
  .map(async file => [file, hash(await readFile(file))])));
const report = { createdAt: new Date().toISOString(), revision: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  sources, origin, scope: 'Real Chromium native entry branch checks. DEV direct entry is not a formal generation/performance qualification. Recovery injection deliberately omits async preparation.', checks: [] };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  {
    const context = await browser.newContext(), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    try {
      await page.goto(`${origin}#rift=17`);
      await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene')
        && window.__game.scene.getScene('RiftScene').probeEnemyReview()?.seed === 17, null, {timeout:60000});
      await page.keyboard.press('Escape'); await page.waitForTimeout(150);
      const facts = await page.evaluate(() => ({ state: window.__game.scene.getScene('RiftScene').probeEnemyReview(),
        saved: localStorage.getItem('coh-save-v1') }));
      assert.equal(facts.state.seed,17); assert.deepEqual(errors,[]);
      await page.screenshot({path:`${root}/dev-direct-rift.jpg`});
      report.checks.push({id:'legacy-dev-direct-deep-link',status:'pass',seed:facts.state.seed,
        sceneReached:'RiftScene',pageErrors:errors,savePresent:facts.saved!==null});
    } finally { await context.close(); }
  }
  {
    const context = await browser.newContext(), page = await context.newPage(), errors = [], consoleErrors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if(message.type()==='error')consoleErrors.push(message.text());});
    try {
      await page.goto(origin);
      await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene')
        && document.querySelector('.joint-action')?.disabled===false,null,{timeout:60000});
      const identity=JSON.parse(await readFile('tools/recovery/fixtures/legacy-generation-gold.json','utf8')).records[0].identity;
      await page.evaluate(identity => {
        window.__game.scene.stop('MainMenuScene');
        window.__game.scene.start('RiftScene',{recovery:{identity,externalTargetIds:[]}});
      },identity);
      await page.getByText('出行暂时无法恢复，原记录已保留。',{exact:true}).waitFor({timeout:10000});
      const facts=await page.evaluate(()=>({riftActive:window.__game.scene.isActive('RiftScene'),
        menuActive:window.__game.scene.isActive('MainMenuScene'),saved:localStorage.getItem('coh-save-v1')}));
      assert.equal(facts.riftActive,false);assert.equal(facts.menuActive,true);assert.equal(facts.saved,null);
      assert.deepEqual(errors,[]);assert(consoleErrors.some(error=>error.includes('Procedural world has not been prepared')));
      await page.screenshot({path:`${root}/unprepared-recovery-refused.jpg`});
      report.checks.push({id:'unprepared-formal-recovery',status:'pass',facts,pageErrors:errors,
        expectedConsoleErrors:consoleErrors,reason:'Failed closed at withPreparedProceduralRecovery; did not enter the no-identity DEV branch.'});
    } finally {await context.close();}
  }
  for(const [file,expected] of Object.entries(sources)) assert.equal(hash(await readFile(file)),expected);
  report.sourcesUnchanged=true;report.status='pass';
} catch(error) {report.status='fail';report.failure=String(error);process.exitCode=1;}
finally {report.finishedAt=new Date().toISOString();await writeFile(`${root}/rift-entry-boundary-report.json`,JSON.stringify(report,null,2)+'\n');
  await browser.close();console.log(JSON.stringify({status:report.status,checks:report.checks.map(check=>check.id),failure:report.failure}));}
