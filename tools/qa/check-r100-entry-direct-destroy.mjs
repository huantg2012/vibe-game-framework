/** Direct SceneManager.remove at the two actual entry boundaries, before POST_RENDER. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i06/final-runtime/direct-destroy');fs.mkdirSync(out,{recursive:true});
const raw=fs.readFileSync('docs/qa/artifacts/r100-i03/native-body-fix/legacy-dash-save/actual-old-save.json','utf8');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const report={status:'running',base:process.env.GAME_URL??'http://127.0.0.1:3074/',method:'Load genuine old save into isolated context. Fault-inject public SceneManager.remove immediately before actual POST_RENDER, once at construction and once after first complete picture/checkpoint. No synthetic game frames or altered gameplay state.',cases:[]};
try{for(const mode of ['construction','prepared']){
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.addInitScript(v=>localStorage.setItem('coh-save-v1',v),raw);
 await page.goto(report.base);await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 await page.evaluate(async mode=>{const{RiftScene}=await import('/src/scenes/rift-scene.ts');const game=window.__game,create=RiftScene.prototype.createRun,post=RiftScene.prototype.onPostUpdate,emit=game.events.emit;let armed=null;
 const read=s=>({fenceActive:s.nativeEntryFence?.isActive()??false,prepared:s.nativeEntryFence?.preparedFrame??null,raw:localStorage.getItem('coh-save-v1'),nativeTextures:game.textures.getTextureKeys().filter(k=>k.startsWith('r100-native-'))});
 RiftScene.prototype.createRun=function(...args){const result=create.apply(this,args);if(mode==='construction'&&this.nativeEntryFence?.isActive())armed=this;return result;};
 RiftScene.prototype.onPostUpdate=function(...args){const result=post.apply(this,args);if(mode==='prepared'&&this.nativeEntryFence?.isActive()&&this.nativeEntryFence.preparedFrame!==null)armed=this;return result;};
 game.events.emit=function(event,...args){if(event==='postrender'&&armed){const s=armed,fence=s.nativeEntryFence;armed=null;const before=read(s);game.scene.remove('RiftScene');window.__destroyResult={before,after:read(s),fenceActive:fence.isActive(),fenceListenerRemaining:game.events.listeners('postrender').includes(fence.onRendered),frameCommit:s.frameCommit,shutdownComplete:s.shutdownComplete,runtime:s.devRuntime,unconsumed:s.nativeWorldPresentation,sceneRemoved:!game.scene.keys.RiftScene};}return emit.call(this,event,...args);};
 },mode);
 await page.getByRole('button',{name:'继续',exact:true}).click();await page.waitForFunction(()=>window.__destroyResult,null,{timeout:60000});await page.waitForTimeout(220);
 const result=await page.evaluate(()=>window.__destroyResult);assert(result.before.fenceActive);assert.equal(result.before.prepared===null,mode==='construction');assert(result.sceneRemoved&&result.shutdownComplete);assert(!result.fenceActive&&!result.fenceListenerRemaining);assert.equal(result.frameCommit,null);assert.equal(result.runtime,null);assert.equal(result.unconsumed,null);assert.deepEqual(result.after.nativeTextures,[]);assert.equal(result.after.raw,result.before.raw);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,`${mode}.json`),JSON.stringify({result,errors},null,2));report.cases.push({mode,status:'pass',removedBeforeRelease:true,savedBytesUnchanged:true});await context.close();}
 report.status='pass';
}catch(e){report.status='failed';report.error=String(e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}console.log(JSON.stringify(report,null,2));
