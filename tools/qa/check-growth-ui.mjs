/** Actual purchase UI and resume; isolated unchanged advanced base fixture. */
import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const page=await browser.newPage({viewport:{width:1440,height:960}});const errors=[],logs=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')logs.push(m.text())});const out='docs/qa/artifacts/iteration-27/root';fs.mkdirSync(out,{recursive:true});
const press=key=>page.keyboard.press(key,{delay:110});
try{
 await page.goto((process.env.GAME_URL??'http://127.0.0.1:3016')+'/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 const fixture=JSON.parse(fs.readFileSync('docs/qa/artifacts/game-wide-review-2026-09-18/tech/advanced-24.storage.json','utf8'));
 await page.evaluate(fixture=>{for(const[k,v]of Object.entries(fixture))localStorage.setItem(k,v)},fixture);await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await press('Enter');await page.waitForTimeout(2000);
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').openWorldInteraction('growth'));await page.waitForTimeout(500);
 await page.locator('[data-id="growth_vitality"]').click();await page.waitForTimeout(400);await page.locator('[data-id="growth_vitality"]').click();await page.waitForTimeout(600);
 await page.screenshot({path:out+'/growth-ui-2-levels.png'});const text=await page.locator('body').innerText();await press('Escape');await page.waitForTimeout(500);
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').openWorldInteraction('rift'));await page.waitForTimeout(450);await press('Shift+Enter');await page.waitForTimeout(2200);
 const first=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');return {active:s.scene.isActive(),hp:s.combat.getHealth(),max:s.combat.getMaxHealth(),chaos:s.chaos.getValue(),hud:document.querySelector('#rift-hud-status')?.textContent,chaosHud:document.querySelector('#rift-hud-chaos')?.textContent,pos:s.player.getPosition(),checkpoint:localStorage.getItem('coh-save-v1')}});
 assert.equal(first.max,130);assert.equal(first.hp,130);assert(first.hud.includes('130/130'));assert(first.chaosHud.includes(String(Math.floor(first.chaos))));await page.screenshot({path:out+'/growth-real-rift-130.png'});
 await press('Escape');await page.waitForTimeout(200);await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await press('Enter');await page.waitForTimeout(2000);
 const resumed=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');return {active:s.scene.isActive(),paused:s.scene.isPaused(),hp:s.combat.getHealth(),max:s.combat.getMaxHealth(),chaos:s.chaos.getValue(),pos:s.player.getPosition(),text:document.body.innerText}});
 assert.equal(resumed.max,130);assert.equal(resumed.hp,130);assert(resumed.active);await page.screenshot({path:out+'/growth-real-rift-reloaded.png'});
 delete first.checkpoint;assert.deepEqual(errors,[]);assert.deepEqual(logs,[]);fs.writeFileSync(out+'/growth-ui.json',JSON.stringify({method:'Isolated unchanged advanced24 base fixture. Purchases through actual UI, normal depart. Open panel via scene method, no combat/health/position edits.',text,first,resumed,errors,logs},null,2));console.log(JSON.stringify({first,resumed,errors,logs}));
}finally{fs.writeFileSync(out+'/growth-ui-errors.json',JSON.stringify({errors,logs},null,2));await browser.close();}
