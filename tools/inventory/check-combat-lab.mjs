/** Isolated real-browser exercise: never touches a user's storage context. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage({viewport:{width:1440,height:960}});
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
const url=(process.env.GAME_URL??'http://127.0.0.1:3000').replace(/\/$/,'')+'/combat-lab.html';
await page.addInitScript(()=>{localStorage.setItem('coh-save-v1','combat-lab-save-sentinel');});
const state=()=>page.evaluate(()=>window.__combatLab.getState());
const scene=()=>page.evaluate(()=>window.__combatLab.game.scene.getScene('CombatLabScene').sys.settings.status);
const resume=async()=>{if(await page.locator('#pause-veil').isVisible())await page.locator('#resume').click();else await page.locator('#game-container canvas').click();await page.waitForTimeout(80);};
const choose=async(id,value)=>{await page.locator('#'+id).selectOption(value);await page.waitForTimeout(130);await page.waitForFunction(()=>window.__combatLab?.getState().ready);};
try{
 await page.goto(url+'?auto-reset=0');await page.waitForFunction(()=>window.__combatLab?.getState().ready);
 assert.equal(await page.locator('#weapon option').count(),10);assert.ok(await page.locator('#enemy option').count()>=13);
 assert.equal((await state()).health,100);console.log('PASS real arena boot, production weapon/enemy catalogs');
 await choose('exercise','empty');await choose('weapon','crowbar_excellent_resistant');
 assert.equal(await scene(),6); // Phaser PAUSED; configured field stops simulation.
 const before=await state();await page.waitForTimeout(300);assert.deepEqual(await state(),before);
 await resume();await page.keyboard.press('Space',{delay:60});
 let s=await state();assert.ok(s.lastSwingDamage>=46&&s.lastSwingDamage<=56);assert.equal(s.resistancePercent,4);assert.equal(s.weight,33);
 await page.locator('#pause').click();await page.keyboard.press('Escape',{delay:60});assert.equal(await page.locator('#pause-veil').isVisible(),false);
 console.log('PASS equipment drives real damage/resistance/weight; config pauses; button-focused Esc resumes');
 const weapons=await page.locator('#weapon option').evaluateAll(opts=>opts.map(o=>o.value));
 for(const id of weapons){await choose('weapon',id);await resume();await page.keyboard.press('Space',{delay:45});const now=await state();assert.equal(now.swingCount,1);assert.ok(now.lastSwingDamage>0);}
 console.log('PASS all ten weapon configurations attack after repeated scene teardown');
 // Real enemy/player contacts, without directly applying artificial damage.
 await choose('weapon','crowbar_plain');await choose('exercise','duel');
 await resume();await page.locator('#approach').click();await page.waitForTimeout(30);
 await page.keyboard.press('Space',{delay:70});
 await page.waitForFunction(()=>window.__combatLab.getState().hitsDealt>0,{},{timeout:7000});
 await page.waitForFunction(()=>window.__combatLab.getState().hitsTaken>0,{},{timeout:15000});
 s=await state();assert.ok(s.health<100);assert.ok(s.subjects[0].health<75);
 console.log('PASS actual Space damages an enemy; enemy AI attacks reduce player HP');
 await choose('tool-q','solidify');await resume();await page.locator('#approach').click();await page.waitForTimeout(30);
 const uses=(await state()).tools.find(t=>t.id==='solidify').remaining;await page.keyboard.press('q',{delay:70});
 await page.waitForFunction(u=>window.__combatLab.getState().tools.find(t=>t.id==='solidify')?.remaining===u-1,uses);
 console.log('PASS real active tool consumption');
 await choose('tool-q','');
 const enemies=await page.locator('#enemy option').evaluateAll(opts=>opts.map(o=>o.value));
 for(const id of enemies){await choose('enemy',id);for(const coverage of ['infiltrate','rewrite','overwrite']){await choose('coverage',coverage);await resume();await page.waitForTimeout(120);assert.ok((await state()).subjects.length>0);}}
 console.log('PASS every production enemy family in all three contamination tiers has a live legal placement');
 await choose('enemy',enemies[0]);await choose('count','3');assert.equal((await state()).subjects.length,3);
 await choose('count','1');await choose('coverage','infiltrate');
 await resume();await page.locator('#approach').click();
 await page.waitForFunction(()=>window.__combatLab.getState().roundEnded,null,{timeout:45000});
 assert.equal((await state()).health,0);await page.waitForTimeout(550);
 const fx=await page.evaluate(()=>window.__combatLab.game.scene.getScene('CombatLabScene').combat.fx.filter(f=>f.remainingMs>0).length);assert.equal(fx,0);
 await page.keyboard.press('r',{delay:80});await page.waitForFunction(()=>window.__combatLab.getState().health===100&&!window.__combatLab.getState().roundEnded);
 console.log('PASS death preserves final result, effects expire, and R restores a fresh live round');
 const counts=[];for(let i=0;i<6;i++){await page.locator('#restart').click();await page.waitForTimeout(160);counts.push((await state()).textureCount);}
 assert.ok(Math.max(...counts)-Math.min(...counts)<=2,`texture growth ${counts}`);
 assert.equal(await page.evaluate(()=>localStorage.getItem('coh-save-v1')),'combat-lab-save-sentinel');assert.deepEqual(errors,[]);
 await page.screenshot({path:process.env.LAB_SCREENSHOT??'/tmp/combat-lab-verified.png'});
 console.log('PASS repeated restarts have bounded textures, no browser errors, and preserve formal save bytes');
}finally{await browser.close();}
