import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'../..');
const runtime=process.env.CODEX_NODE_MODULES || resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=await import(pathToFileURL(resolve(runtime,'playwright/index.mjs')).href);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const out=resolve(root,'docs/qa/artifacts/report-reader-2026-09-21');
await mkdir(out,{recursive:true});
const reports=JSON.parse(await readFile(resolve(here,'reports.json'),'utf8'));
const checks=[];
async function assertGrowthChartFits(page) {
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.report-chart-scroll')).every(element=>element.scrollWidth<=element.clientWidth+2));
  assert.equal(await page.locator('.report-chart-hit').count(),22,'All 22 growth steps must remain present');
  const last=page.locator('.report-chart-hit').last();
  const bounds=await last.boundingBox();
  const plot=await page.locator('.report-chart-scroll').boundingBox();
  assert(bounds&&plot&&bounds.x+bounds.width<=plot.x+plot.width+2,'Last growth step must fit the visible chart');
}
try {
  const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:'light'});
  await context.setOffline(true);
  for(const report of reports){
    const page=await context.newPage(), errors=[], network=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
    await page.goto(pathToFileURL(resolve(root,`docs/qa/reports/${report.id}.html`)).href);
    await page.locator('#root h1').waitFor();
    assert.equal(await page.locator('[role="alert"]').count(),0,report.id+' render failed');
    assert((await page.locator('#root').innerText()).length>100);
    assert.equal(await page.locator('.report-banner').count(),1);
    const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.alt));
    assert.deepEqual(broken,[],report.id+' broken images');
    if(report.id==='growth-sample-review-2026-09-21')await assertGrowthChartFits(page);
    await page.screenshot({path:resolve(out,`${report.id}.png`)});
    const interactions=[];
    for(const select of await page.locator('select').all()){
      const before=await page.locator('#root').innerText();
      const option=await select.locator('option').evaluateAll(opts=>opts.find(o=>!o.disabled&&!o.selected)?.value);
      if(option===undefined)continue;
      await select.selectOption(option);
      assert.equal(await select.inputValue(),option);
      await page.waitForFunction(text=>document.getElementById('root').innerText!==text,before);
      interactions.push({kind:'select',value:option});
    }
    const tabChecks={
      'purification-growth-review-2026-09-20':['成长池与价值','分批建议与边界','场景与六物'],
      'contaminant-catalog':['未知外壳 · 8','供奉与品质','旧存档兼容 · 18','当前掉落 · 48'],
      'game-wide-review-2026-09-18':['成长','玩法','美术','运行','全部'],
      'rift-world-space':['世界对照','生成与排除','现状与验证','维度空间'],
      'contaminant-system-review':['十八项逐条审查','品质与落地顺序','核心判断'],
    };
    for(const name of tabChecks[report.id] || []){
      const before=await page.locator('#root').innerText();
      await page.getByRole('button',{name,exact:true}).click();
      await page.waitForFunction(text=>document.getElementById('root').innerText!==text,before);
      for(const select of await page.locator('select').all()){
        const option=await select.locator('option').evaluateAll(opts=>opts.find(o=>!o.disabled&&!o.selected)?.value);
        if(option!==undefined){await select.selectOption(option);assert.equal(await select.inputValue(),option);}
      }
      const broken=await page.locator('img').evaluateAll(images=>images.filter(i=>!i.complete||!i.naturalWidth).map(i=>i.alt));
      assert.deepEqual(broken,[],report.id+' broken tab images');
      assert.equal(await page.locator('[role="alert"]').count(),0);
      interactions.push({kind:'tab',name});
    }
    if(report.id==='rift-visual-directions'){
      const buttons=page.locator('button[aria-pressed="false"]');
      for(const index of [0,-1]){
        const before=await page.locator('#root').innerText();
        await buttons.nth(index).click();
        await page.waitForFunction(text=>document.getElementById('root').innerText!==text,before);
      }
      interactions.push({kind:'world and camera choices'});
    }
    const disclosure=page.locator('button.report-disclosure').first();
    if(await disclosure.count()){
      const before=await disclosure.getAttribute('aria-expanded');
      await disclosure.click();
      assert.notEqual(await disclosure.getAttribute('aria-expanded'),before);
      interactions.push({kind:'disclosure'});
    }
    if(report.id==='growth-sample-review-2026-09-21'){
      await page.getByRole('button',{name:'累计成本',exact:true}).click();
      assert((await page.locator('#root').innerText()).includes('沿路线累计投入'));
      await page.locator('select').selectOption('12');
      assert((await page.locator('#root').innerText()).includes('第 12 步 · 出击扩容'));
      await page.getByRole('button',{name:/GR-01 ·/}).click();
      assert((await page.locator('#root').innerText()).includes('洞察 0 级时，远端预告仍写'));
      await page.screenshot({path:resolve(out,'growth-interactions.png')});
      const popupPromise=page.waitForEvent('popup');
      await page.getByRole('button',{name:'入口倍率实景',exact:true}).click();
      const popup=await popupPromise;
      await popup.waitForLoadState();
      assert.equal(popup.url(),pathToFileURL(resolve(root,'docs/qa/artifacts/growth-sample-review-2026-09-21/runtime/body/06-entrance-no-forecast.png')).href);
      await popup.close();
      interactions.push({kind:'chart-toggle, route-step, finding, file-link'});
    }
    await page.setViewportSize({width:900,height:900});
    if(report.id==='growth-sample-review-2026-09-21')await assertGrowthChartFits(page);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),report.id+' page overflows at 900px');
    await page.emulateMedia({colorScheme:'dark'});
    assert.equal(await page.locator('[role="alert"]').count(),0);
    if(report.id==='growth-sample-review-2026-09-21')await page.screenshot({path:resolve(out,'growth-dark-900.png')});
    assert.deepEqual(network,[],report.id+' should be offline');
    assert.deepEqual(errors,[],report.id+' console errors');
    checks.push({id:report.id,ok:true,images:await page.locator('img').count(),interactions,networkRequests:network,errors});
    await page.close();
  }
  await context.close();
  const httpChecks=[];
  if(process.env.REPORT_TEST_BASE){
    const online=await browser.newContext({viewport:{width:1280,height:900},colorScheme:'light'});
    const page=await online.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push({message:message.text(),location:message.location()});});
    const base=new URL('docs/qa/reports/',process.env.REPORT_TEST_BASE);
    await page.goto(new URL('index.html',base).href);
    assert.equal(await page.locator('.report-index li > div > a').count(),8);
    await page.screenshot({path:resolve(out,'report-index-http.png')});
    for(const report of reports){
      const response=await page.goto(new URL(`${report.id}.html`,base).href);
      assert.equal(response.status(),200);
      await page.locator('#root h1').waitFor();
      assert.equal(await page.locator('[role="alert"]').count(),0);
      httpChecks.push({id:report.id,url:page.url(),ok:true});
    }
    await page.goto(new URL('growth-sample-review-2026-09-21.html',base).href);
    await page.getByRole('button',{name:'累计成本',exact:true}).click();
    assert((await page.locator('#root').innerText()).includes('沿路线累计投入'));
    await assertGrowthChartFits(page);
    await page.screenshot({path:resolve(out,'growth-http.png')});
    assert.deepEqual(errors,[],'HTTP browser errors');
    await online.close();
  }
  const exportManifestSha256=createHash('sha256').update(await readFile(resolve(root,'docs/qa/reports/manifest.json'))).digest('hex');
  const manifest={method:'All eight standalone file:// reports in real Chromium with network offline; UI selections, disclosure, core growth controls and file navigation; 1280px light and 900px dark; optional HTTP server smoke',exportManifestSha256,checks,httpChecks};
  await writeFile(resolve(out,'browser-check.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,checks:checks.map(c=>({id:c.id,interactions:c.interactions.length}))},null,2));
} finally {await browser.close();}
