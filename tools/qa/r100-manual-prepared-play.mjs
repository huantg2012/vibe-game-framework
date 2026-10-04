/** Screenshot-directed formal RiftScene, explicit catalog preparation fixture.
 * JSON stdin: {keys:["w","q"],ms:300,label:"..."}, {snap:"..."}, {quit:true}.
 * No hidden map, reward contents, opponent state or paths are inspected in play.
 */
import fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i03/manual-prepared');fs.mkdirSync(out,{recursive:true});
const build=process.env.QA_CONTROLLED_BUILD??'survey-lure';if(!['survey-lure','resist-suppress','silence-lure','freeze-image'].includes(build))throw Error('Unknown catalog fixture');
const worldId=process.env.QA_WORLD??'ash-strata',seed=Number(process.env.QA_SEED??20261004),grade=process.env.QA_GRADE??'severe';
const log=v=>fs.appendFileSync(path.join(out,'inputs.jsonl'),JSON.stringify({at:new Date().toISOString(),...v})+'\n');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}),context=await browser.newContext({viewport:{width:1440,height:960},...(process.env.QA_STORAGE_STATE?{storageState:process.env.QA_STORAGE_STATE}:{})}),page=await context.newPage();
page.on('pageerror',e=>log({error:String(e)}));page.on('console',m=>{if(m.type()==='error')log({consoleError:m.text()});});
log({method:'Normal screenshots and actual keyboard. Formal base, optionally continued from the explicitly recorded earned browser-storage fixture; ordinary mature catalog tools are controlled preparation. Controlled world/seed. Normal frame captured with keys released before opening Escape menu, then paused between observations. Capture and pause timing retained. No hidden map/enemy/reward inspection during play; not continuous natural-supply or real-time reflex evidence.',build,worldId,seed,grade,earnedStorage:process.env.QA_STORAGE_STATE??null,earnedStorageHash:process.env.QA_STORAGE_STATE?createHash('sha256').update(fs.readFileSync(process.env.QA_STORAGE_STATE)).digest('hex'):null,gameUrl:process.env.GAME_URL??'http://127.0.0.1:3062/',harnessSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex')});
async function publicState(){return page.evaluate(async()=>{
 const s=window.__game.scene.getScene('RiftScene'),{inventoryStore}=await import('/src/systems/inventory-store.ts'),{projectInventoryItem}=await import('/src/ui/inventory-presenter.ts');const eq=inventoryStore.getEquipment();
 return {hp:s.combat.getHealth(),chaos:s.chaos.getValue(),kindling:s.search.getCarriedKindling(),elapsedMs:s.runController.getElapsedMs(),ended:s.runController.isRunEnded(),paused:s.scene.isPaused(),prompt:s.search.getPrompt(),tools:eq.toolIds.map((id,slot)=>{const item=id?inventoryStore.getItem(id):null;if(!item)return{slot,empty:true};const view=projectInventoryItem(item,'rift');return{slot,name:view.name,description:view.description,usesRemaining:view.usesRemaining};})};
 });}
async function pause(){for(let i=0;i<8;i++){const s=await publicState();if(s.paused||s.ended)return;await page.keyboard.press('Escape',{delay:40});await page.waitForTimeout(100);}throw Error('Normal pause did not open; keep failure evidence');}
let frame=0,lastElapsed=0,lastNormalFrame=null;
async function captureThenPause(label){
 const captureStartedState=await publicState();if(captureStartedState.paused)throw Error('Normal-frame capture requested while menu is open');
 const file=path.join(out,`${String(frame++).padStart(3,'0')}-${String(label).replace(/[^a-zA-Z0-9_\-]/g,'_')}.png`);
 await page.locator('canvas').first().screenshot({path:file});const captureEndedState=await publicState();
 if(captureEndedState.elapsedMs<lastElapsed)throw Error('Run clock restarted; preserve attempt');lastElapsed=captureEndedState.elapsedMs;
 await pause();const pausedState=await publicState();
 // Sealed post-play audit: never printed, returned to the operator, or used for decisions.
 // Existing production exporters are read-only; capture after ordinary pause freezes time.
 const audit=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');return{ai:s.ai.exportRuntimeState(),tools:s.toolSystem.exportRuntimeState()};});
 fs.appendFileSync(path.join(out,'after-play-audit.jsonl'),JSON.stringify({frame:file,label,elapsedMs:pausedState.elapsedMs,readOnlyAfterPlay:true,...audit})+'\n');
 lastNormalFrame={frame:file,state:captureEndedState,captureStartedState,captureEndedState,pausedState,extraSimulationMsAfterCapture:pausedState.elapsedMs-captureEndedState.elapsedMs};
 log(lastNormalFrame);console.log(JSON.stringify(lastNormalFrame));return lastNormalFrame;
}

try{
 await page.goto(process.env.GAME_URL??'http://127.0.0.1:3062/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
 if(process.env.QA_STORAGE_STATE){const raw=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));if(!raw)throw Error('Earned fixture origin does not match GAME_URL; refusing to silently create a new record');fs.writeFileSync(path.join(out,'earned-before-tools.save.json'),raw);}
 await page.waitForTimeout(350);await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene'));await page.waitForTimeout(2200);
 const fixture=await page.evaluate(async build=>{
  const {inventoryStore}=await import('/src/systems/inventory-store.ts'),{createCatalogContaminant}=await import('/src/systems/contaminant-catalog.ts');const definitions={ 'survey-lure':['blind_needle_compass','split_tongue_bell'], 'resist-suppress':['salted_vial','cold_ash_pipe'], 'silence-lure':['gray_felt_glove','split_tongue_bell'], 'freeze-image':['amber_beetle','silver_back_hand_mirror'] }[build];const ids=[];
  const oldOffering=inventoryStore.getEquipment().defenseIds[0]??null;
  if(oldOffering){const moved=inventoryStore.slotOffering(null,0);if(!moved.ok)throw Error(JSON.stringify(moved));}
  for(const definitionId of definitions){const item=createCatalogContaminant({id:`qa-manual-${definitionId}`,definitionId,appearanceId:'wax_parcel',offeringProfileId:'resist_35',quality:'ordinary',acquiredOrdinal:0});for(const result of[inventoryStore.addContaminant(item),inventoryStore.slotOffering(item.id,0),inventoryStore.finishOfferingImpact([item.id],3,{},`qa-manual:${definitionId}`)])if(!result.ok)throw Error(JSON.stringify(result));ids.push(item.id);}
  if(oldOffering){const restored=inventoryStore.slotOffering(oldOffering,0);if(!restored.ok)throw Error(JSON.stringify(restored));}
  return {definitions,ids,inventory:inventoryStore.getState()};
 },build);fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify(fixture,null,2));
 await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());
 for(let slot=0;slot<2;slot++){await page.locator(`[role="option"][data-item-id="${fixture.ids[slot]}"]`).click();await page.getByRole('button',{name:`装到 工具 ${slot?'F':'Q'}`,exact:true}).click();}
 await page.locator(`[data-departure-grade="${grade}"]`).click();
 const identity=await page.evaluate(async({worldId,seed,grade})=>{const{createR100ProductionRecipe}=await import('/src/generation/world-study/r100-package.ts'),{RiftGenerationClient}=await import('/src/generation/rift-generation-client.ts');const result=await new RiftGenerationClient().generate({kind:'departure',generation:createR100ProductionRecipe(worldId,seed,grade)});return{...result.identity,catalogVersion:'contaminant-v1',lootAlgorithmVersion:1,combatRulesVersion:2};},{worldId,seed,grade});
 fs.writeFileSync(path.join(out,'controlled-identity.json'),JSON.stringify(identity,null,2));
 await page.evaluate(async identity=>{const recovery=await import('/src/managers/rift-recovery.ts'),presentation=await import('/src/systems/r100-world-presentation.ts');recovery.installProceduralRiftRecovery();await recovery.prepareProceduralRecovery(identity);await presentation.prepareR100Presentation(identity.generation,{world:recovery.restoreProceduralWorld(identity)});const scene=window.__game.scene.getScene('PurificationScene');scene.productionDeparture=identity;recovery.withPreparedProceduralRecovery(identity,()=>scene.commitRiftDeparture());},identity);
 await page.waitForFunction(()=>{const s=window.__game.scene.getScene('RiftScene');return s?.scene.isActive()&&!s.stagedEntry?.isActive()&&!s.nativeEntryFence?.isActive()&&s.nativeWorldPresentation&&s.devRuntime&&s.player&&s.search&&s.chaos;},null,{timeout:60000});await captureThenPause('entry');
 const rl=readline.createInterface({input:process.stdin});
 for await(const raw of rl){let c;try{c=JSON.parse(raw);}catch{console.log('Invalid JSON');continue;}if(c.quit)break;if(c.snap){console.log(JSON.stringify({label:c.snap,reusedMostRecentNormalFrame:true,...lastNormalFrame}));continue;}
  if(c.return){
   const state=await publicState();if(!state.ended)throw Error('Return requires the actual run to have ended');
   await page.keyboard.press('r',{delay:70});await page.waitForFunction(()=>window.__game.scene.isActive('PurificationScene'),null,{timeout:15000});
   await page.waitForTimeout(500);const saved=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));
   fs.writeFileSync(path.join(out,'returned-save.json'),saved);await page.screenshot({path:path.join(out,'returned.png')});
   log({event:'real-return',save:'returned-save.json',priorPublicState:state});console.log(JSON.stringify({returned:true,state}));break;
  }
  const ms=Number(c.ms??100),keys=c.keys??[];if(!Number.isFinite(ms)||ms<0||ms>30000||!Array.isArray(keys)||!keys.every(k=>['w','a','s','d','e','q','f','Space','r'].includes(k)))throw Error('Only normal play keys and 0–30000ms');
  const before=await publicState();if(before.ended){console.log(JSON.stringify({alreadyEnded:true,...lastNormalFrame}));continue;}if(before.paused){await page.keyboard.press('Escape',{delay:40});await page.waitForFunction(()=>window.__game.scene.getScene('RiftScene').scene.isActive());}
  try{for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(ms);}finally{for(const key of keys)await page.keyboard.up(key);}
  const captured=await captureThenPause(c.label??'step');log({keys,requestedInputMs:ms,actualSimulationMs:captured.pausedState.elapsedMs-before.elapsedMs,label:c.label,pauseNote:'Keys released, normal active canvas captured first, then ordinary Escape pause. Screenshot and pause latency advance real simulation; both capture states and paused state are recorded.'});
 }
}catch(error){log({failure:String(error?.stack??error)});await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
finally{await page.context().storageState({path:path.join(out,'browser-storage.json')});await browser.close();}
