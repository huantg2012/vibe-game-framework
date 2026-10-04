/** Deliberate diagnostic placement + actual browser physics/keys. Not natural play. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const{chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve('docs/qa/artifacts/r100-i03/native-body-fix/browser');fs.mkdirSync(out,{recursive:true});
const base=process.env.GAME_URL??'http://127.0.0.1:3073';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const report={base,method:'Four exact former contact points placed explicitly by QA while paused, then ordinary keyboard input and actual Arcade WORLD_STEP. No geometry/collision/body size/rule changes. Additional diagonal walking and an explicitly injected immovable 20px enemy-sized collider pressure fixture; every actual physics step checked. This is a focused regression, not natural gameplay.',cases:[],errors};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
async function setup(){await page.goto(base+'/r100-gym.html?world=ash-strata&grade=severe&seed=20261004&loadout=quiet');await page.waitForFunction(()=>window.__r100Gym?.getState().runtime.running,null,{timeout:60000});await page.waitForTimeout(100);await page.locator('#pause').click();await page.evaluate(async()=>{
 const{audioManager}=await import('/src/managers/audio-manager.ts');const s=audioManager.game.scene.getScene('RiftScene');window.__bodyScene=s;
 const data={steps:0,invalid:[],mismatches:[],timings:[]};const original=s.nativeBody.resolveMotion.bind(s.nativeBody);s.nativeBody.resolveMotion=function(...a){const t=performance.now();const result=original(...a);data.timings.push(performance.now()-t);return result;};
 s.physics.world.on('worldstep',()=>{const b=s.player.getSprite().body;if(!b.enable)return;data.steps++;if(!s.nativeBody.supports(b.center,b.halfWidth,b.halfHeight))data.invalid.push({x:b.center.x,y:b.center.y});});
 s.events.on('postupdate',()=>{const b=s.player.getSprite().body,p=s.player.getPosition();if(Math.hypot(p.x-b.center.x,p.y-b.center.y)>1e-6)data.mismatches.push({p:{...p},b:{x:b.center.x,y:b.center.y}});});window.__bodyAudit=data;
 });}
async function pause(){if(!await page.evaluate(()=>window.__r100Gym.getState().runtime.paused))await page.locator('#pause').click();await page.waitForTimeout(40);}
async function read(){return page.evaluate(()=>{const s=window.__bodyScene,b=s.player.getSprite().body,a=window.__bodyAudit;return{position:{x:b.center.x,y:b.center.y},sprite:{...s.player.getPosition()},supported:s.nativeBody.supports(b.center,b.halfWidth,b.halfHeight),steps:a.steps,invalid:a.invalid,mismatches:a.mismatches};});}
async function move(keys,ms){await page.locator('#pause').click();await page.locator('#game-container').focus();for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);for(const key of keys)await page.keyboard.up(key);await pause();return read();}
try{
 await setup();
 const cases=[{id:'008-up',x:580.5722793894035,y:306,keys:['w']},{id:'013-left',x:538,y:334,keys:['a']},{id:'016-up',x:341.60328455516486,y:354,keys:['w']},{id:'018-up',x:264.9192628084076,y:330,keys:['w']}];
 for(const test of cases){await page.evaluate(t=>{const s=window.__bodyScene,b=s.player.getSprite().body;s.resetPlayerBody(b,t.x,t.y);s.player.postUpdate();},test);const before=await read();assert(before.supported);assert.deepEqual(before.position,before.sprite);const after=await move(test.keys,500);assert(after.supported);assert(Math.hypot(after.position.x-before.position.x,after.position.y-before.position.y)>1.5,test.id+' must move beyond coarse phantom contact');report.cases.push({id:test.id,before,after});await page.locator('#game-container canvas').screenshot({path:path.join(out,test.id+'.png')});save();}
 for(const keys of [['a','w'],['d','w'],['a','s'],['d','s']]){await page.evaluate(()=>{const s=window.__bodyScene;s.resetPlayerBody(s.player.getSprite().body,538,334);s.player.postUpdate();});const result=await move(keys,1800);assert(result.supported);report.cases.push({id:'diagonal-'+keys.join(''),after:result});}
 // Unavoidable actor overlap in a crushing fixture is not resolved by walking through terrain.
 await page.evaluate(()=>{const s=window.__bodyScene,b=s.player.getSprite().body;s.resetPlayerBody(b,530.346,334);s.player.postUpdate();const box=s.add.rectangle(545.346,334,20,20,0x555555);s.physics.add.existing(box);box.body.setSize(20,20).setImmovable(true);box.body.moves=false;const collider=s.physics.add.collider(s.player.getSprite(),box);window.__pressure={box,collider};});
 const pressure=await move(['a'],1000);assert(pressure.supported);report.cases.push({id:'immovable-enemy-pressure',after:pressure});
 await page.evaluate(()=>{window.__pressure.collider.destroy();window.__pressure.box.destroy();});
 report.physics=await page.evaluate(()=>{const a=window.__bodyAudit,t=a.timings.slice().sort((a,b)=>a-b);return{steps:a.steps,invalid:a.invalid,mismatches:a.mismatches,queryMs:{p50:t[Math.floor(t.length*.5)],p95:t[Math.floor(t.length*.95)],max:t.at(-1)}};});
 assert.equal(report.physics.invalid.length,0);assert.equal(report.physics.mismatches.length,0);assert.equal(errors.length,0);report.status='pass';save();console.log(JSON.stringify({status:report.status,physics:report.physics}));
}catch(e){report.status='failed';report.failure=String(e);save();throw e;}finally{await browser.close();}
