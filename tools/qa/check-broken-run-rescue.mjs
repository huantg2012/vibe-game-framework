/** Readable base rescue from a deliberately corrupted actual active checkpoint. */
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],out='docs/qa/artifacts/iteration-27/root';fs.mkdirSync(out,{recursive:true});page.on('pageerror',e=>errors.push(String(e)));
const source=JSON.parse(fs.readFileSync('docs/qa/artifacts/iteration-27/reliability/active-checkpoint.storage.json','utf8')),key='coh-save-v1';
const original=JSON.parse(source[key]),bad=structuredClone(original);bad.riftCheckpoint.identity.signature='deliberate-qa-corruption';const raw=JSON.stringify(bad);
const press=key=>page.keyboard.press(key,{delay:100});
const main=()=>page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
const load=async bytes=>{await page.evaluate(({key,bytes})=>{localStorage.clear();localStorage.setItem(key,bytes)},{key,bytes});await page.reload();await main();};
const mode=()=>page.evaluate(()=>window.__game.scene.getScene('MainMenuScene').mode);
const saved=()=>page.evaluate(key=>localStorage.getItem(key),key);
try{
 await page.goto((process.env.GAME_URL??'http://127.0.0.1:3016')+'/');await main();await load(raw);await press('Enter');await page.waitForTimeout(200);assert.equal(await mode(),'confirmAbandon');assert.equal(await saved(),raw);
 await press('Enter');assert.equal(await saved(),raw);await press('Enter');assert.equal(await mode(),'confirmAbandon');
 await page.screenshot({path:out+'/bad-world-rescue-choice.png'});
 await page.evaluate(key=>{const set=Storage.prototype.setItem;window.__qaReject=true;Storage.prototype.setItem=function(k,v){if(k===key&&window.__qaReject)throw new DOMException('QA quota','QuotaExceededError');return set.call(this,k,v)}},key);
 await press('ArrowDown');await press('Enter');await page.waitForTimeout(250);assert.equal(await saved(),raw);assert.equal(await mode(),'confirmAbandon');
 await page.evaluate(()=>window.__qaReject=false);await press('Enter');await page.waitForTimeout(2100);assert(await page.evaluate(()=>window.__game.scene.isActive('PurificationScene')));
 const rescued=JSON.parse(await saved());assert.equal(rescued.inventory.run.status,'settled');assert(rescued.inventory.run.baseSettled);assert.equal(rescued.inventory.run.outcome,'abandon');assert.deepEqual(rescued.growth,original.growth);
 assert.deepEqual(rescued.inventory.items.filter(i=>i.location.kind==='stash').map(i=>i.id).sort(),original.inventory.items.filter(i=>i.location.kind==='stash').map(i=>i.id).sort());
 assert(!rescued.riftCheckpoint);assert(!rescued.riftDeparture);await page.screenshot({path:out+'/bad-world-rescued-base.png'});
 const rescuedBytes=await saved();await page.reload();await main();await press('Enter');await page.waitForTimeout(2000);const reloaded=JSON.parse(await saved());assert.deepEqual(reloaded.modules,rescued.modules);assert.deepEqual(reloaded.tide,rescued.tide);assert.deepEqual(reloaded.stability,rescued.stability);
 const badBase=structuredClone(bad);badBase.modules[0].hp=-30;const unreadable=JSON.stringify(badBase);await load(unreadable);await press('Enter');await page.waitForTimeout(250);assert.equal(await saved(),unreadable);assert.notEqual(await mode(),'confirmAbandon');assert.deepEqual(errors,[]);
 fs.writeFileSync(out+'/bad-world-rescue.json',JSON.stringify({method:'Actual active checkpoint copied unchanged except explicit bad identity; additional bad-base counterexample. Confirmation and write refusal via real keyboard. Storage transport fault only.',checks:['cancel preserves exact bytes','rejected abandon write preserves exact bytes','explicit retry returns original base with growth/stash','settlement applies once across reload','invalid base not salvageable and original bytes retained'],rescued,rescuedBytes,errors},null,2));console.log('PASS actual corrupt run: cancel, rejected write, explicit rescue, once-only settlement, bad-base refusal');
}finally{fs.writeFileSync(out+'/bad-world-rescue-errors.json',JSON.stringify(errors));await browser.close();}
