/** Compare opposing affordability states through real production UI and a purchase. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';
const root = process.env.GROWTH_STATE_OUT ?? 'docs/qa/artifacts/growth-resource-states-2026-09-21';
const seed = JSON.parse(JSON.parse(fs.readFileSync('docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json'))['coh-save-v1']);
const route = fs.readFileSync('data/growth-route.csv','utf8').trim().split('\n').slice(1).map(line => { const [order,id,level,,,,cost]=line.split(',');return {order:+order,id,level:+level,cost:+cost}; });
const cases = [{name:'short',reserve:7},{name:'exact',reserve:8},{name:'enough',reserve:100},{name:'experience-funded',reserve:100,owned:4},{name:'experience-short',reserve:0,owned:4},{name:'thicken',reserve:12,owned:6}];
const manifest = { method:'Isolated controlled saves, real walking/E/Enter; explicit color and text semantics across list, payment and footer; no player save access.',cases:[] };
fs.mkdirSync(root,{recursive:true});
const browser = await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try { for (const spec of cases) {
 const out=path.join(root,spec.name);fs.mkdirSync(out,{recursive:true});
 const save=structuredClone(seed); save.kindlingReserve=spec.reserve;save.growth.schemaVersion=2;save.moduleMaxHpTier=0;save.cycle=1;
 save.growth.progression={version:1,impactExperienced:false,offeringCompleted:false,toolRevealed:false,crestExperienced:false};
 for(const id in save.growth.upgrades)save.growth.upgrades[id]=0;
 for(const step of route.slice(0,spec.owned??0))save.growth.upgrades[step.id]=step.level;
 delete save.impactForecast;delete save.checkpointChecksum;
 const ctx=await browser.newContext({viewport:{width:1440,height:960}});
 await ctx.addInitScript(s=>{if(!localStorage.getItem('coh-save-v1'))localStorage.setItem('coh-save-v1',JSON.stringify(s));},save);
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:''}));
 const d=createJourneyDriver(page,out),c=createCycleInputs(page,d);
 const read=()=>page.evaluate(()=>localStorage.getItem('coh-save-v1'));
 const inspect=()=>page.locator('#growth-panel').evaluate(el=>{
  const item=sel=>{const node=el.querySelector(sel);return node?{text:node.textContent.trim(),color:getComputedStyle(node).color}:null;};
  return {list:item('[data-growth-next="true"] .growth-card-state'),funds:item('[data-growth-funds]'),footer:item('[data-growth-action-state]'),confirm:!!el.querySelector('#growth-confirm-btn')};
 });
 try {
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:3025/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  await d.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1500);
  for(const pt of [{x:160,y:238},{x:112,y:216}])assert((await c.baseTo(pt)).ok);
  await d.press('e');await page.waitForTimeout(450);
  const before=await inspect(),bytes=await read();await d.snap('01-state');
  const funded=spec.reserve>=route[spec.owned??0].cost,unlocked=spec.owned!==4;
  assert.equal(before.confirm,funded&&unlocked);
  assert(before.funds.text.includes(funded?'薪柴充足':'薪柴不足'));
  if(unlocked){assert.equal(before.list.color,before.funds.color);assert.equal(before.footer.color,before.funds.color);}
  else {assert(before.list.text.includes('尚待经历'));assert.equal(before.list.color,before.footer.color);assert.notEqual(before.list.color,before.funds.color);}
  if(spec.name==='thicken')assert(await page.locator('.decision-aside .stat-row').last().evaluate(el=>el.getBoundingClientRect().bottom<=el.closest('.decision-aside').getBoundingClientRect().bottom),'funding line preserves all three module consequences in first view');
  let after;
  await d.press('Enter');
  if(!funded||!unlocked)assert.equal(await read(),bytes,'unavailable action never charges');
  if(spec.name==='exact'){
   after=await inspect();assert.equal(JSON.parse(await read()).kindlingReserve,0);
   assert(after.funds.text.includes('薪柴不足'));assert.notEqual(after.funds.color,before.funds.color,'purchase switches ready to shortage');
   assert.equal(after.list.color,after.funds.color);assert.equal(after.footer.color,after.funds.color);
   assert(!after.confirm);await d.snap('02-after-purchase');
  }
  assert.deepEqual(errors,[]);manifest.cases.push({name:spec.name,ok:true,before,after,errors});
 } catch(e){manifest.cases.push({name:spec.name,ok:false,error:String(e),errors});throw e;}
 finally {await ctx.close();}
 }
 const short=manifest.cases.find(c=>c.name==='short').before.funds.color;
 const enough=manifest.cases.find(c=>c.name==='enough').before.funds.color;
 assert.notEqual(short,enough,'opposite resource states must not share a color');
 // Game semantic colors must differ in hue, not just be two near-neutral grays.
 const rgb=s=>s.match(/\d+/g).map(Number),[sr,sg,sb]=rgb(short),[gr,gg,gb]=rgb(enough);
 assert(sr>sg+20&&sg>sb+30,'shortage reads as warning amber');assert(gg>gr&&gg>gb,'funded reads as gray-green');
 assert(Math.hypot(sr-gr,sg-gg,sb-gb)>80,'opposing states differ visibly in chroma, not just neighboring neutral values');
} finally {fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));await browser.close();}
console.log('PASS six resource/experience states and ready-to-short purchase transition');
