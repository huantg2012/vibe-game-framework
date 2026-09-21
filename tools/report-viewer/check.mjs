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
const out=resolve(root,process.env.ARTIFACT_DIR || 'docs/qa/artifacts/review-archive-2026-09-21');
await mkdir(out,{recursive:true});
const reports=JSON.parse(await readFile(resolve(here,'reports.json'),'utf8'));
const catalog=JSON.parse(await readFile(resolve(root,'docs/reviews/catalog.json'),'utf8'));
const relocations=JSON.parse(await readFile(resolve(root,'docs/reviews/relocations.json'),'utf8')).paths;
const checks=[];
const indexChecks=[];
const redirectChecks=[];
const fileUrl=path=>pathToFileURL(resolve(root,path)).href;
async function assertIndex(page,path,url){
  const response=await page.goto(url);
  if(/^https?:/.test(url))assert.equal(response.status(),200);
  await page.locator('.report-index h1').waitFor();
  if(path==='docs/reading/index.html'){
    assert.equal(await page.locator('[data-report-id]').count(),reports.length);
    assert.equal(await page.locator('section').count(),3,'Reading materials should separate review/design/catalog');
    for(const report of reports){
      const actual=new URL(await page.locator(`[data-report-id="${report.id}"] > div > a`).getAttribute('href'),url);
      assert(actual.pathname.endsWith('/'+report.output),report.id+' reading entry points at wrong output');
    }
  }else{
    assert.equal(await page.locator('[data-review-id]').count(),catalog.reports.length,'Every formal review must be discoverable');
    for(const report of catalog.reports){
      const item=page.locator(`[data-review-id="${report.id}"]`);
      assert((await item.innerText()).includes(report.date),'Review date must remain visible');
      assert((await item.innerText()).includes(report.note),'Historical note must remain visible');
      for(const key of ['report','summary','followUp']){
        const links=item.locator(`[data-review-link="${key}"]`);
        if(!report[key]){assert.equal(await links.count(),0);continue;}
        assert(await links.count()>0);
        for(const link of await links.all()){
          const target=new URL(await link.getAttribute('href'),url);
          assert(target.pathname.endsWith('/'+report[key]),report.id+' '+key+' points at wrong entry');
        }
      }
    }
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+2),'Index overflows');
  indexChecks.push({path,url:page.url(),ok:true});
}
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
  const indexPage=await context.newPage();
  for(const path of ['docs/reviews/index.html','docs/reading/index.html']){
    await assertIndex(indexPage,path,fileUrl(path));
    await indexPage.screenshot({path:resolve(out,path.includes('/reviews/')?'review-index-offline.png':'reading-index-offline.png')});
  }
  await indexPage.goto(fileUrl('docs/qa/reports/index.html'));
  await indexPage.waitForURL(fileUrl('docs/reading/index.html'));
  redirectChecks.push({from:'docs/qa/reports/index.html',to:'docs/reading/index.html',protocol:'file',ok:true});
  await indexPage.close();
  for(const report of reports){
    const page=await context.newPage(), errors=[], network=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
    await page.goto(fileUrl(report.output));
    await page.locator('#root h1').waitFor();
    assert.equal(await page.locator('[role="alert"]').count(),0,report.id+' render failed');
    assert((await page.locator('#root').innerText()).length>100);
    assert.equal(await page.locator('.report-banner').count(),1);
    const home=await page.locator('.report-banner nav a').first().getAttribute('href');
    assert.equal(new URL(home,page.url()).href,fileUrl(report.kind==='review'?'docs/reviews/index.html':'docs/reading/index.html'));
    for(const [previous,current] of Object.entries(relocations)){
      assert.equal(await page.evaluate(path=>window.__reportFileUrl(path),previous),fileUrl(current),'Repository link relocation: '+previous);
      assert.equal(await page.evaluate(path=>window.__reportFileUrl(path),resolve(root,previous)),fileUrl(current),'Absolute link relocation: '+previous);
    }
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
    const legacy=`docs/qa/reports/${report.id}.html`;
    const images=await page.locator('img').count();
    await page.goto(fileUrl(legacy));
    await page.waitForURL(fileUrl(report.output));
    await page.locator('#root h1').waitFor();
    assert.deepEqual(errors,[],report.id+' redirect console errors');
    assert.deepEqual(network,[],report.id+' redirect should be offline');
    redirectChecks.push({from:legacy,to:report.output,protocol:'file',ok:true});
    checks.push({id:report.id,output:report.output,ok:true,images,interactions,networkRequests:network,errors});
    await page.close();
  }
  await context.close();
  const httpChecks=[];
  if(process.env.REPORT_TEST_BASE){
    const online=await browser.newContext({viewport:{width:1280,height:900},colorScheme:'light'});
    const page=await online.newPage(), errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push({message:message.text(),location:message.location()});});
    const base=new URL(process.env.REPORT_TEST_BASE);
    for(const path of ['docs/reviews/index.html','docs/reading/index.html']){
      await assertIndex(page,path,new URL(path,base).href);
      await page.screenshot({path:resolve(out,path.includes('/reviews/')?'review-index-http.png':'reading-index-http.png')});
    }
    for(const report of reports){
      const response=await page.goto(new URL(report.output,base).href);
      assert.equal(response.status(),200);
      await page.locator('#root h1').waitFor();
      assert.equal(await page.locator('[role="alert"]').count(),0);
      httpChecks.push({id:report.id,url:page.url(),ok:true});
      const legacy=`docs/qa/reports/${report.id}.html`;
      await page.goto(new URL(legacy,base).href);
      await page.waitForURL(new URL(report.output,base).href);
      await page.locator('#root h1').waitFor();
      redirectChecks.push({from:legacy,to:report.output,protocol:'http',ok:true});
    }
    await page.goto(new URL('docs/qa/reports/index.html',base).href);
    await page.waitForURL(new URL('docs/reading/index.html',base).href);
    redirectChecks.push({from:'docs/qa/reports/index.html',to:'docs/reading/index.html',protocol:'http',ok:true});
    await page.goto(new URL(reports.find(report=>report.id==='growth-sample-review-2026-09-21').output,base).href);
    await page.getByRole('button',{name:'累计成本',exact:true}).click();
    assert((await page.locator('#root').innerText()).includes('沿路线累计投入'));
    await assertGrowthChartFits(page);
    await page.screenshot({path:resolve(out,'growth-http.png')});
    assert.deepEqual(errors,[],'HTTP browser errors');
    await online.close();
  }
  const exportManifestSha256=createHash('sha256').update(await readFile(resolve(root,'docs/reading/manifest.json'))).digest('hex');
  const catalogSha256=createHash('sha256').update(await readFile(resolve(root,'docs/reviews/catalog.json'))).digest('hex');
  const manifest={method:'Eight offline file:// interactive reports at new paths; all formal reviews indexed; original UI interactions and 22-step chart retained; old HTML links redirect; repo file links relocate; 1280px light and 900px dark; optional HTTP indexes and reports',exportManifestSha256,catalogSha256,checks,indexChecks,redirectChecks,httpChecks};
  await writeFile(resolve(out,'browser-check.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(JSON.stringify({passed:checks.length,checks:checks.map(c=>({id:c.id,interactions:c.interactions.length}))},null,2));
} finally {await browser.close();}
