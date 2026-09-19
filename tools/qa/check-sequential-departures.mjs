/** Real sequential transition regression, isolated historical fixture; no natural economy claim. */
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
import fs from 'node:fs';import assert from 'node:assert/strict';
const out='docs/qa/artifacts/iteration-27/reliability';
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[],consoleErrors=[],runs=[];
const bundles=[];page.on('request',r=>{if(r.url().endsWith('.js'))bundles.push(r.url())});
page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
const press=k=>page.keyboard.press(k,{delay:100});const wait=ms=>page.waitForTimeout(ms);const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')));
const active=key=>page.waitForFunction(key=>window.__game?.scene.isActive(key),key,{timeout:10000});
try{
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:3090');await active('MainMenuScene');
 const fixture=JSON.parse(fs.readFileSync('docs/qa/artifacts/game-wide-review-2026-09-18/tech/advanced-24.storage.json','utf8'));
 await page.evaluate(data=>{localStorage.clear();for(const[k,v]of Object.entries(data))localStorage.setItem(k,v)},fixture);await page.reload();await active('MainMenuScene');await wait(200);await press('Enter');await active('PurificationScene');await wait(1400);
 for(let i=0;i<6;i++){
  await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').openWorldInteraction('growth'));await wait(450);await press('Escape');await wait(450);
  await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').openWorldInteraction('rift'));await wait(450);if(!(await stored()).inventory.equipment.weaponId){await page.getByRole('button',{name:'武器',exact:true}).click();await page.locator('.inventory-item').filter({hasText:'已成熟'}).first().click();await page.getByRole('button',{name:'换到在手',exact:true}).click();}await press('Shift+Enter');await active('RiftScene');await wait(1000);
  const before=await stored();assert(before.riftCheckpoint?.state.phase==='active',`trip ${i+1} checkpoint`);assert.equal(before.inventory.run.status,'active');
  await press('Escape');await wait(200);
  if(i===0){const p=before.riftCheckpoint.state.player.position;await page.reload();await active('MainMenuScene');await wait(200);await press('Enter');await active('RiftScene');await wait(300);if(await page.locator('#impact-close-btn').count()){await page.locator('#impact-close-btn').click();await wait(300);}const after=await stored();assert.equal(after.inventory.run.id,before.inventory.run.id);assert.deepEqual(after.riftCheckpoint.state.player.position,p);await press('Escape');await wait(200);}
  await press('ArrowDown');await press('Enter');await press('ArrowDown');await press('Enter');await wait(800);await press('r');await active('PurificationScene');await wait(1400);
  if(await page.locator('#impact-close-btn').count()){await page.locator('#impact-close-btn').click();await wait(300);}const after=await stored();assert.equal(after.inventory.run.id,before.inventory.run.id);assert.equal(after.inventory.run.outcome,'abandon');assert(after.inventory.run.baseSettled);
  runs.push({trip:i+1,seed:before.riftCheckpoint.identity.seed,cycle:after.cycle,runId:after.inventory.run.id,modules:after.modules,checkpointSequence:before.riftCheckpoint.sequence,ledger:after.inventory.run});
  await page.screenshot({path:`${out}/roundtrip-${i+1}-base.png`});console.log('trip',i+1,'returned',after.cycle);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
}catch(e){fs.writeFileSync(out+'/roundtrip-final-failed-frame.json',JSON.stringify(await page.evaluate(()=>({snapshot:window.__game.scene.getScene('RiftScene').captureRuntimeCheckpoint(0),record:JSON.parse(localStorage.getItem('coh-save-v1'))})),null,2));await page.screenshot({path:out+'/roundtrip-final-failure.png'});console.log('failure-body',await page.locator('body').innerText());throw e;}finally{fs.writeFileSync(out+'/roundtrips-final.json',JSON.stringify({method:'Advanced-24 historical review fixture, no extra items/resources injected. Real keyboard preparation and explicit abandon; panel opening via production scene interaction API. Six sequential random departures; first refresh continues same position/ID.',runs,bundles,errors,consoleErrors},null,2));await browser.close();}
