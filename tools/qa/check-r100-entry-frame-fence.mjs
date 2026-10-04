/** Actual browser lifecycle with read-only state sampling and explicitly injected
 * early input/pagehide events. This is lifecycle QA, not a natural expedition. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i06/entry-frame-fence/lifecycle');
fs.mkdirSync(out,{recursive:true});
const report={status:'running',method:'Real Chrome, normal departure and cold load. Probes read complete runtime state without advancing it. Early pause/pagehide/key events are deliberate lifecycle fault injection; no clocks, positions, inventories, or save payloads are modified.',errors:[],cases:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1440,height:960}});
page.on('pageerror',e=>report.errors.push(String(e)));
async function install(){await page.evaluate(async()=>{
 const {RiftScene}=await import('/src/scenes/rift-scene.ts');
 const rows=[];window.__entryFenceQA={rows,mode:'early-pause'};
 const read=s=>({frame:s.game.loop.frame,elapsed:s.devElapsedMs,physicsElapsed:s.physics.world._elapsed,
  player:s.player.exportRuntimeState(),combat:s.combat.exportRuntimeState(),ai:s.ai.exportRuntimeState(),
  chaos:s.chaos.exportRuntimeState(),tools:s.toolSystem.exportRuntimeState(),search:s.search.exportRuntimeState(),
  gate:s.nativeEntryFence?.isActive()??false,paused:s.physics.world.isPaused,saved:localStorage.getItem('coh-save-v1')});
 const create=RiftScene.prototype.createRun,post=RiftScene.prototype.onPostUpdate;
 RiftScene.prototype.createRun=function(...args){
  const result=create.apply(this,args);if(!this.nativeEntryFence?.isActive())return result;
  const row={constructed:read(this),phases:[],mode:window.__entryFenceQA.mode};rows.push(row);this.__entryQARow=row;
  window.dispatchEvent(new Event('pagehide'));row.afterEarlyPagehide=localStorage.getItem('coh-save-v1');
  // Exercise the real pause route while the scene has no complete native frame.
  if(row.mode==='early-pause')this.openRecoveredPauseMenu();
  if(!this.recovery?.checkpoint)window.dispatchEvent(new KeyboardEvent('keydown',{key:'d',code:'KeyD',keyCode:68,bubbles:true}));
  const scene=this;
  this.game.events.once('postrender',()=>{row.firstRender=read(scene);});
  return result;
 };
 RiftScene.prototype.onPostUpdate=function(...args){
  const active=this.nativeEntryFence?.isActive(),result=post.apply(this,args);
  if(active&&this.__entryQARow){
   this.__entryQARow.phases.push(read(this));
   if(this.nativeEntryFence.preparedFrame!==null){
    const row=this.__entryQARow,scene=this;
    this.game.events.once('postrender',()=>{row.released=read(scene);row.pausedScene=scene.scene.isPaused();});
   }
  }
  return result;
 };
 });}
function compareFrozen(row){
 assert(row.constructed.gate&&row.constructed.paused);
 assert.equal(row.afterEarlyPagehide,row.constructed.saved,'pagehide cannot capture partial native initialization');
 assert(row.released&&!row.released.gate,'completed picture must release the fence');
 assert(row.released.frame>row.constructed.frame,'actual later frame is mandatory');
 for(const s of row.phases){
  for(const field of ['elapsed','physicsElapsed','player','combat','ai','chaos','tools','search'])
   assert.deepEqual(s[field],row.constructed[field],`${field} advanced before first full render`);
 }
 assert(row.firstRender.gate,'construction render must remain fenced');
 assert(row.pausedSceneResolved,'queued early pause must land before another gameplay frame');
 const checkpoint=JSON.parse(row.released.saved).riftCheckpoint;
 assert(checkpoint&&checkpoint.elapsedMs===row.constructed.elapsed,'first zero-time checkpoint must be durable');
}
try{
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:3071/');
 await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await page.waitForTimeout(350);await install();
 report.stage='new-game';await page.keyboard.press('Enter',{delay:100});await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1700);
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());
 report.stage='departure';await page.locator('[data-departure-grade="low"]').click();await page.keyboard.press('Shift+Enter',{delay:50});
 await page.waitForFunction(()=>window.__entryFenceQA.rows[0]?.released);await page.waitForTimeout(260);
 const fresh=await page.evaluate(()=>({...window.__entryFenceQA.rows[0],pausedSceneResolved:window.__game.scene.isPaused('RiftScene')}));compareFrozen(fresh);report.cases.push({name:'fresh/pagehide/early-pause',result:'pass',frames:[fresh.constructed.frame,fresh.released.frame]});
 // Resume normally, then take a real moving/attacking checkpoint via the pause UI.
 await page.keyboard.press('Escape',{delay:50});await page.waitForFunction(()=>window.__game.scene.isActive('RiftScene'));
 await page.keyboard.down('d');await page.waitForTimeout(100);
 const held=await page.evaluate(()=>window.__game.scene.getScene('RiftScene').player.exportRuntimeState());
 assert.deepEqual(held.position,fresh.constructed.player.position,'held preparation key must remain latched until release');
 await page.keyboard.up('d');await page.waitForTimeout(30);await page.keyboard.down('d');
 await page.waitForFunction(()=>window.__game.scene.getScene('RiftScene').player.exportRuntimeState().velocity.x>0);
 await page.waitForTimeout(100);await page.keyboard.press('Space',{delay:15});await page.evaluate(()=>window.__game.scene.getScene('RiftScene').openRecoveredPauseMenu());
 await page.waitForFunction(()=>window.__game.scene.isPaused('RiftScene'));await page.keyboard.up('d');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('coh-save-v1')).riftCheckpoint);
 assert(saved.state.player.velocity.x!==0||saved.state.player.velocity.y!==0,'cold test must retain real velocity');
 await page.reload();await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await page.waitForTimeout(350);await install();
 report.stage='cold-continue';await page.keyboard.press('Enter',{delay:50});await page.waitForFunction(()=>window.__entryFenceQA.rows[0]?.released);await page.waitForTimeout(260);
 const cold=await page.evaluate(()=>({...window.__entryFenceQA.rows[0],pausedSceneResolved:window.__game.scene.isPaused('RiftScene')}));compareFrozen(cold);
 for(const field of ['player','combat','ai','chaos','tools','search'])assert.deepEqual(cold.constructed[field],saved.state[field],`cold ${field} hydration changed saved state`);
 assert.equal(cold.constructed.elapsed,saved.elapsedMs);
 report.cases.push({name:'cold/velocity/input/combat/physics/early-pause',result:'pass',frames:[cold.constructed.frame,cold.released.frame],attackPhase:saved.state.combat.playerAttack?.phase??saved.state.combat.player?.phase});
 fs.writeFileSync(path.join(out,'read-only-runtime-samples.json'),JSON.stringify({fresh,cold,saved},null,2));
 assert.deepEqual(report.errors,[]);report.status='passed';
}catch(e){report.status='failed';report.error=String(e);report.diagnostic=await page.evaluate(()=>({text:document.body.innerText,rows:window.__entryFenceQA?.rows,active:window.__game?.scene.getScenes(true).map(s=>s.sys.settings.key)}));await page.screenshot({path:path.join(out,'failure.png')});process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({status:report.status,stage:report.stage,cases:report.cases,errors:report.errors,error:report.error},null,2));
