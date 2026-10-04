/** COH-F052: fixed, finite actual-input world coverage. No production writes.
 * Routes/encounters reuse the explicit geometric QA method of r100-p13-costed.
 * Unlike the older diagnostic driver, unread remains never expose kind/tier/value;
 * only rendered positions are remembered, and contents are recorded after collection.
 * Default --plan is safe during performance-exclusive windows. --run requires
 * QA_WINDOW_RELEASED=1. Each matrix member is an independent branch of the same
 * real mature storage snapshot, not a continuous supply/economy experiment.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createVisibleEncounterPolicy} from '../world-study/r100-p13-costed-encounters.mjs';
const out=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-world-play-coverage');
const url=process.env.GAME_URL??'http://127.0.0.1:3086/';
const storageSource=path.resolve(process.env.QA_STORAGE_STATE??'docs/qa/artifacts/r100-p13/natural-low/low-growth/browser-storage.json');
const preparedPolicy=process.env.QA_PREPARED_POLICY==='1';
const minimumSearchDistance=preparedPolicy?320:240;
const sourceBytes=fs.readFileSync(storageSource), originalStorage=JSON.parse(sourceBytes);
const originalSave=JSON.parse(originalStorage.origins.flatMap(o=>o.localStorage).find(x=>x.name==='coh-save-v1').value);
const worlds=['cinder-ridge','pallid-membrane','schist-shear','tension-membrane','laminate-shell'];
const cases=worlds.flatMap(world=>[{world,grade:'medium',seed:20261004},{world,grade:'severe',seed:20261005}]);
const sha=data=>createHash('sha256').update(data).digest('hex');
const dependencies=['tools/world-study/r100-p13-costed-encounters.mjs'];
const write=(file,data)=>fs.writeFileSync(path.join(out,file),JSON.stringify(data,null,2));
fs.mkdirSync(out,{recursive:true});
const policy={feature:'COH-F052',frozenAt:new Date().toISOString(),cases,preparedPolicy,minimumSearchDistance,
 scope:'Five worlds missing current r3 search-and-return, 10 fixed attempts. Not a new 120-journey acceptance gate; not a novice navigation or continuous economy test.',
 storage:{path:path.relative(process.cwd(),storageSource),sha256:sha(sourceBytes),cycle:originalSave.cycle,kindlingReserve:originalSave.kindlingReserve,modules:originalSave.modules},
 routing:'Full static conservative terrain geometry for body-supported macro routes. Actual WASD; opponents/hosts sampled only if currently visible, with bounded last-seen memory. Prior policy seeks a far region then observed remains >240px; prepared policy stops exploration on observed remains >320px from departure; no hidden loot value/type, enemy state/patrol, teleport, health, time or immunity edits.',
 preparation:'Copy actual stored localStorage bytes to the final test origin; use known inventory and real UI equipment. Only selected world/grade/seed is a controlled departure fixture. Each case independently forks the identical original mature save; all outcomes retained.',
 success:'Real E search collects at least one observed non-entry remains; actual E extraction and R base return; real saved inventory.run.baseSettled. Empty exits, deaths, routing/runtime failures retained and do not count as successful world evidence.',
 limits:'No new skill/equipment grants. Not every grade or seed exhausted. Hidden identity/departure/save snapshots retained only as postmortem evidence, not route/loot decisions. No subjective art or hearing approval inferred.',
 preparedMethod:preparedPolicy?'A new declared branch after first real ready weapon >=30. Public UI chooses complementary stop/lure/vision gear. Explore along a geometry-only far route, stop on first actually observed remains >320px from spawn instead of running past it; at most two finds. No changes to fields, rewards or enemies. Earlier weak-preparation death/cancel remain separately recorded.':null,
 harnessSha256:sha(fs.readFileSync(new URL(import.meta.url))),dependencies:dependencies.map(file=>({file,sha256:sha(fs.readFileSync(file))}))};
const frozenFile=path.join(out,'policy-freeze.json');
if(fs.existsSync(frozenFile)){const old=JSON.parse(fs.readFileSync(frozenFile));assert.deepEqual(old.cases,cases,'fixed cases must not change');assert.equal(old.storage.sha256,policy.storage.sha256,'actual source save must not change');assert.equal(old.harnessSha256,policy.harnessSha256,'frozen harness must not change after declaration');assert.deepEqual(old.dependencies,policy.dependencies,'frozen encounter policy must not change');}
else write('policy-freeze.json',policy);
if(!process.argv.includes('--run')){console.log(`Prepared ${cases.length} fixed cases; no browser launched. ${frozenFile}`);process.exit(0);}
assert.equal(process.env.QA_WINDOW_RELEASED,'1','Wait for parent performance/GPU window release before running Chrome');
const selected=process.env.QA_CASES?process.env.QA_CASES.split(',').map(Number):cases.map((_,i)=>i);
assert(selected.every(i=>Number.isInteger(i)&&i>=0&&i<cases.length),'case subset uses fixed original indices');
const reportFile=path.join(out,'report.json');
const report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile)):{method:policy.routing,controlledWorld:true,controlledBuild:null,policyFile:'policy-freeze.json',realJourneyAttempts:[],status:'running',cases,url,sourceManifest:'docs/qa/artifacts/r100-i03-i06-completion/final-source/source-snapshot.json',sourceManifestSha256:sha(fs.readFileSync('docs/qa/artifacts/r100-i03-i06-completion/final-source/source-snapshot.json'))};
const save=()=>write('report.json',report);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
async function runCase(test,index){
 const {world,grade,seed}=test,folder=path.join(out,`${String(index+1).padStart(2,'0')}-${world}-${grade}-${seed}`);
 assert(!fs.existsSync(path.join(folder,'journey.jsonl')),'Never overwrite an earlier attempt; use a new output directory for disclosed reruns');
 fs.mkdirSync(folder,{recursive:true});
 const storage=structuredClone(originalStorage),origin=new URL(url).origin;
 for(const row of storage.origins)row.origin=origin;
 assert.deepEqual(storage.origins.map(o=>o.localStorage),originalStorage.origins.map(o=>o.localStorage),'origin rebind preserves every stored value byte');
 const rebound=JSON.stringify(storage);fs.writeFileSync(path.join(folder,'input-storage.json'),rebound);
 const context=await browser.newContext({viewport:{width:1440,height:960},storageState:storage}),page=await context.newPage();
 const errors=[],consoleErrors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
 const log=value=>fs.appendFileSync(path.join(folder,'journey.jsonl'),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
 const seen=new Map();let expeditionStart=null;
 async function state(){
  const current=await page.evaluate(knownIds=>{
   const game=window.__game;if(!game)return{scene:'menu'};
   const base=game.scene.getScene('PurificationScene'),s=game.scene.getScene('RiftScene');
   if(base?.scene.isActive()||base?.scene.isPaused())return{scene:'base',active:base.scene.isActive(),paused:base.scene.isPaused(),...base.probeJourneyState?.()};
   if(!s?.player||!s?.chaos||!s?.search)return{scene:'menu'};
   return{scene:'rift',active:s.scene.isActive(),paused:s.scene.isPaused(),ended:s.runController.isRunEnded(),pos:{...s.player.getPosition()},hp:s.combat.getHealth(),chaos:s.chaos.getValue(),carried:s.search.getCarriedKindling(),elapsedMs:s.runController.getElapsedMs(),exit:s.extraction.extractionPoint,
    nodes:s.search.nodes.filter(n=>s.visibilityAt(n.position)>.03||(knownIds.includes(n.id)&&n.collected)).map(n=>({id:n.id,pos:{...n.position},collected:n.collected,...(n.collected?{kind:n.kind,tier:n.tier}: {})}))};
  },[...seen.keys()]);
  if(current.scene==='rift'){for(const n of current.nodes)seen.set(n.id,n);current.nodes=[...seen.values()];}
  return current;
 }
 async function press(key,delay=90){log({event:'key',key,delay});await page.keyboard.press(key,{delay});}
 async function hold(keys,ms){log({event:'hold',keys,ms});try{for(const k of keys)await page.keyboard.down(k);await page.waitForTimeout(ms);}finally{for(const k of keys)await page.keyboard.up(k);}await page.waitForTimeout(35);}
 async function snap(label){const value=await state();await page.screenshot({path:path.join(folder,`${label}.png`)});log({event:'snapshot',label,state:value,text:await page.locator('body').innerText()});return{state:value};}
 const driver={state,press,hold,snap,log};
 const tacticalEnabled=true,normalManagement=true,observedWindows=true,searchChaosLimit=120,searchHealthLimit=30,returnChaosBudget=145;
 const tactical=createVisibleEncounterPolicy(page,driver,ownedForPreparation,{observedWindows,visiblePollution:true});
 async function saveState(label){const raw=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));fs.writeFileSync(path.join(folder,`${label}.save.json`),raw??'null');return{sha256:sha(raw??''),state:JSON.parse(raw??'null')};}
 const receipt={ordinal:index+1,...test,loadout:`real-cycle-${originalSave.cycle}-inventory${preparedPolicy?'-complementary-public-preparation':''}`,entry:'controlled-fixed-world-through-production-prepare',status:'running',searches:[],errors,sourceSaveSha256:sha(sourceBytes),reboundStorageSha256:sha(rebound),harnessSha256:policy.harnessSha256,dependencies:policy.dependencies};
 report.realJourneyAttempts.push(receipt);save();
 async function riftPlan(targets,avoid=[]){
  const data=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,b=s.player.getSprite().body;return{cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()},halfX:b.width/2+1,halfY:b.height/2+1,paidResistance:s.toolSystem.getPollutionResistanceBonus()>0}});
  const pollutionCells=new Set(normalManagement?tactical.pollution().map(c=>`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}`):[]);
  const{cols,rows,size,walk,start,halfX,halfY}=data,center=i=>({x:(i%cols+.5)*size,y:(Math.floor(i/cols)+.5)*size});
  const floor=(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&walk[y*cols+x];
  const clear=p=>{for(let y=Math.floor((p.y-halfY)/size);y<=Math.floor((p.y+halfY-.01)/size);y++)for(let x=Math.floor((p.x-halfX)/size);x<=Math.floor((p.x+halfX-.01)/size);x++)if(!floor(x,y))return false;return true;};
  const line=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/2);for(let j=0;j<=n;j++)if(!floor(Math.floor((a.x+(b.x-a.x)*j/(n||1))/size),Math.floor((a.y+(b.y-a.y)*j/(n||1))/size)))return false;return true;};
  const safe=walk.map((v,i)=>v&&clear(center(i))),begin=Math.floor(start.y/size)*cols+Math.floor(start.x/size),prev=new Map([[begin,-1]]);let end=null,chosen=null;
  const costs=new Map([[begin,0]]),heap=[{cell:begin,cost:0}];
  const push=v=>{heap.push(v);let i=heap.length-1;while(i>0){const parent=(i-1)>>1;if(heap[parent].cost<=v.cost)break;heap[i]=heap[parent];i=parent;}heap[i]=v;};
  const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let c=i*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[c].cost>=last.cost)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;};
  while(heap.length){const current=pop(),i=current.cell;if(current.cost>costs.get(i))continue;const p=center(i);
   chosen=targets.find(t=>Math.hypot(t.pos.x-p.x,t.pos.y-p.y)<=(tacticalEnabled?38:24)&&line(p,t.pos));if(chosen){end=i;break;}
   const x=i%cols,y=Math.floor(i/cols);for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,k=b*cols+a;if(!floor(a,b)||!safe[k])continue;
    const next=center(k);let risk=0;for(const enemy of avoid){const d=Math.hypot(next.x-enemy.position.x,next.y-enemy.position.y),facing=Math.atan2(next.y-enemy.position.y,next.x-enemy.position.x)-enemy.facing;
     risk+=Math.max(0,75-d)*.45+Math.max(0,170-d)*(Math.cos(facing)>.5?.18:.025);}
    if(pollutionCells.has(`${Math.floor(next.x/16)}:${Math.floor(next.y/16)}`))risk+=(data.paidResistance?3:4);
    const cost=current.cost+1+risk;if(cost>=(costs.get(k)??Infinity))continue;costs.set(k,cost);prev.set(k,i);push({cell:k,cost});
   }
  }
  if(end===null)throw Error('No full-body path to requested interaction');const raw=[];for(let i=end;i!==-1;i=prev.get(i))raw.push(center(i));raw.reverse();const points=[raw[Math.min(1,raw.length-1)]];for(let i=1;i<raw.length-1;i++)if((raw[i-1].x===raw[i].x)!==(raw[i].x===raw[i+1].x))points.push(raw[i]);points.push(raw.at(-1));driver.log({event:'read-only-body-route',target:chosen,points,greenCellExtraCost:data.paidResistance?3:4});return{target:chosen,points};
 }
 async function farGeometryGoal(){
  // Macro navigation is explicitly omniscient geometry QA, never loot/AI knowledge.
  const g=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,b=s.player.getSprite().body;return {cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()},halfX:b.width/2+1,halfY:b.height/2+1};});
  const center=i=>({x:(i%g.cols+.5)*g.size,y:(Math.floor(i/g.cols)+.5)*g.size}),floor=(x,y)=>x>=0&&y>=0&&x<g.cols&&y<g.rows&&g.walk[y*g.cols+x];
  const clear=i=>{const p=center(i);for(let y=Math.floor((p.y-g.halfY)/g.size);y<=Math.floor((p.y+g.halfY-.01)/g.size);y++)for(let x=Math.floor((p.x-g.halfX)/g.size);x<=Math.floor((p.x+g.halfX-.01)/g.size);x++)if(!floor(x,y))return false;return true;};
  const begin=Math.floor(g.start.y/g.size)*g.cols+Math.floor(g.start.x/g.size),queue=[begin],distances=new Map([[begin,0]]);
  for(let n=0;n<queue.length;n++){const i=queue[n],x=i%g.cols,y=Math.floor(i/g.cols);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy,j=b*g.cols+a;if(!floor(a,b)||distances.has(j)||!clear(j))continue;distances.set(j,distances.get(i)+g.size);queue.push(j);}}
  const far=[...distances].sort((a,b)=>b[1]-a[1]);assert(far.length,'physical exploration goal exists');
  // Choose an interior cell of the furthest region, rather than an object or a reward.
  const top=far.slice(0,Math.max(1,Math.floor(far.length*.04))),mean=top.reduce((a,[i])=>{const p=center(i);return{x:a.x+p.x/top.length,y:a.y+p.y/top.length};},{x:0,y:0});
  top.sort((a,b)=>Math.hypot(center(a[0]).x-mean.x,center(a[0]).y-mean.y)-Math.hypot(center(b[0]).x-mean.x,center(b[0]).y-mean.y));
  const goal={id:'geometry-exploration',pos:center(top[0][0])};driver.log({event:'precommitted-far-geometry-goal',start:g.start,goal,pathDistance:top[0][1],disclosure:'Pure full terrain support; no node list, hidden reward, guard or Host query.'});return goal;
 }
 async function goRift(targets){
  if(tacticalEnabled&&targets[0]?.id!=='exit')return goRiftAware(targets);
  if(normalManagement)await tactical.observe();
  const planned=await riftPlan(targets),started=Date.now();let last=null,stuck=0;
  for(const p of planned.points)for(let step=0;step<90;step++){
   const s=await driver.state();if(s.scene!=='rift'||s.ended)return{ended:true,state:s};assert(s.active,'scene must keep simulating during travel');assert(Date.now()-started<60000,'route diagnostic exceeded 60s');
   const dx=p.x-s.pos.x,dy=p.y-s.pos.y;if(Math.hypot(dx,dy)<3)break;stuck=last&&Math.hypot(last.x-s.pos.x,last.y-s.pos.y)<.35?stuck+1:0;last=s.pos;assert(stuck<9,`actual movement blocked near ${JSON.stringify(p)}`);
   const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');await driver.hold(keys,Math.max(35,Math.min(160,Math.hypot(dx,dy)/80*1000)));
  }
  return{target:planned.target,state:await driver.state()};
 }
 async function goRiftAware(targets){
  const started=Date.now();let rememberedTarget=targets[0],lastObserve=0,stuck=0,lastPosition=null;
  for(let revision=0;revision<90;revision++){
   const current=await driver.state();if(current.ended)return{ended:true,state:current};
   if(Date.now()-started>(rememberedTarget.id==='geometry-exploration'?42000:25000))return{abandoned:true,reason:'approach-kept-dangerous',state:current,target:rememberedTarget};
   const observed=await tactical.caution(rememberedTarget);if(observed.ended)return{ended:true,state:await driver.state()};lastObserve=(await driver.state()).elapsedMs;
   const planned=await riftPlan(targets,tactical.remembered());rememberedTarget=planned.target;
   const knownPollution=new Set(tactical.pollution().map(c=>`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}`));
   let replan=false;
   for(const point of planned.points){for(let step=0;step<90;step++){
    const state=await driver.state();if(state.ended)return{ended:true,state};assert(state.active,'visible policy must preserve active simulation');
    if(preparedPolicy&&rememberedTarget.id==='geometry-exploration'&&state.nodes.some(n=>!n.collected&&Math.hypot(n.pos.x-expeditionStart.x,n.pos.y-expeditionStart.y)>minimumSearchDistance)){driver.log({event:'stop-exploration-at-observed-remains',position:state.pos,observed:state.nodes.filter(n=>!n.collected&&Math.hypot(n.pos.x-expeditionStart.x,n.pos.y-expeditionStart.y)>minimumSearchDistance).map(({id,pos})=>({id,pos}))});return{discovered:true,state,target:rememberedTarget};}
    if(rememberedTarget.id!=='exit'&&(state.hp<=searchHealthLimit||state.chaos>=searchChaosLimit))return{abandoned:true,reason:'return-reserve-threshold',state,target:rememberedTarget};
    const dx=point.x-state.pos.x,dy=point.y-state.pos.y;if(Math.hypot(dx,dy)<3)break;
    if(state.elapsedMs-lastObserve>(observedWindows?350:700)){lastObserve=state.elapsedMs;const result=await tactical.caution(rememberedTarget);if(result.ended)return{ended:true,state:await driver.state()};if(result.reroute||(normalManagement&&tactical.pollution().some(c=>!knownPollution.has(`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}`)))){replan=true;break;}}
    stuck=lastPosition&&Math.hypot(lastPosition.x-state.pos.x,lastPosition.y-state.pos.y)<.35?stuck+1:0;lastPosition=state.pos;assert(stuck<12,'visible-policy movement failed at body edge');
    await tactical.beforeMove(point,rememberedTarget);const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');await driver.hold(keys,Math.max(35,Math.min(140,Math.hypot(dx,dy)/80*1000)));
   }if(replan)break;}
   if(!replan)return{target:planned.target,state:await driver.state()};
  }
  return{abandoned:true,reason:'no-quiet-approach-found',state:await driver.state(),target:rememberedTarget};
 }
 async function ownedForPreparation(){return page.evaluate(async()=>{
   const{inventoryStore}=await import('/src/systems/inventory-store.ts'),{projectInventoryItem}=await import('/src/ui/inventory-presenter.ts');
   return{equipment:inventoryStore.getEquipment(),items:inventoryStore.getItems().map(item=>{const{icon,...facts}=projectInventoryItem(item,'prepare');return facts;})};
 });}
 async function equipOwned(){
   const owned=await ownedForPreparation(),changes=[];
   const weapon=owned.items.filter(item=>item.kind==='weapon'&&item.canEquip).sort((a,b)=>(b.qualityRank??0)-(a.qualityRank??0)||(b.usesRemaining??0)-(a.usesRemaining??0))[0];
   if(preparedPolicy)assert(weapon&&(weapon.usesRemaining??0)>=30,'Prepared coverage requires the first actual >=30-durability checkpoint, never a grant');
   if(weapon&&weapon.id!==owned.equipment.weaponId){await page.locator(`[role="option"][data-item-id="${weapon.id}"]`).click();await page.getByRole('button',{name:'换到在手',exact:true}).click();changes.push({slot:'weapon',id:weapon.id});}
   const ready=owned.items.filter(item=>item.kind==='contaminant'&&item.canEquip),description=item=>item.name+' '+item.description;
   const primary=ready.filter(item=>item.toolSlots?.includes('0')).sort((a,b)=>{
    const score=item=>(/停住.*敌/.test(description(item))?100:/抗污/.test(description(item))?90:/消声/.test(description(item))?70:/敌移速|绊停/.test(description(item))?55:10)+(item.usesRemaining??0);
    return score(b)-score(a);
   })[0];
   const secondary=ready.filter(item=>item.id!==primary?.id&&item.toolSlots?.includes('1')).sort((a,b)=>{
    const score=item=>(/声诱|铜铃/.test(description(item))?100:/压制|烟斗/.test(description(item))?80:/消声/.test(description(item))?70:/罗盘|探查/.test(description(item))?60:/敌移速|绊停/.test(description(item))?45:/停住.*敌/.test(description(item))?30:10)+(item.usesRemaining??0);
    return score(b)-score(a);
   })[0];
   const passive=ready.filter(item=>item.toolSlots?.includes('2')).sort((a,b)=>(/视距/.test(description(b))?100:10)-(/视距/.test(description(a))?100:10)||(b.usesRemaining??0)-(a.usesRemaining??0))[0];
   for(const [slot,item]of [primary,secondary,passive].entries()){
    if(!item||owned.equipment.toolIds[slot]===item.id)continue;
    await page.locator(`[role="option"][data-item-id="${item.id}"]`).click();
    await page.getByRole('button',{name:`装到 ${slot===2?'被动':`工具 ${slot===0?'Q':'F'}`}`,exact:true}).click();
    changes.push({slot:String(slot),id:item.id,publicName:item.name,publicDescription:item.description,uses:item.usesRemaining});
   }
   driver.log({event:'actual-owned-equipment-inputs',changes});return changes;
 }

 try{
  await page.goto(url);await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));
  // Assert the ordinary save loaded at this origin, before any gameplay input.
  const loaded=await saveState('loaded-before-input');
  for(const key of ['cycle','modules','growth','inventory','kindlingReserve'])assert.deepEqual(loaded.state[key],originalSave[key],`mature save ${key} preserved`);
  await page.waitForTimeout(350);await press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(1600);
  receipt.before=await saveState('before');
  await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());receipt.equipmentChanges=await equipOwned();receipt.knownPreparation=await ownedForPreparation();
  await page.locator(`[data-departure-grade="${grade}"]`).click();
  const identity=await page.evaluate(async({world,grade,seed})=>{
   const {createR100ProductionRecipe}=await import('/src/generation/world-study/r100-package.ts'),{RiftGenerationClient}=await import('/src/generation/rift-generation-client.ts');
   const client=new RiftGenerationClient();const result=await client.generate({kind:'departure',generation:createR100ProductionRecipe(world,seed,grade)});
   return{...result.identity,catalogVersion:'contaminant-v1',lootAlgorithmVersion:1,combatRulesVersion:2};
  },test);
  await page.evaluate(async identity=>{
   const recovery=await import('/src/managers/rift-recovery.ts'),presentation=await import('/src/systems/r100-world-presentation.ts');
   recovery.installProceduralRiftRecovery();await recovery.prepareProceduralRecovery(identity);await presentation.prepareR100Presentation(identity.generation,{world:recovery.restoreProceduralWorld(identity)});
   const s=window.__game.scene.getScene('PurificationScene');s.productionDeparture=identity;recovery.withPreparedProceduralRecovery(identity,()=>s.commitRiftDeparture());
  },identity);
  await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&s.player&&s.devRuntime&&s.search&&s.chaos&&!s.stagedEntry?.isActive()&&!s.nativeEntryFence?.isActive();},{timeout:45000});
  await page.waitForTimeout(600);tactical.reset();const entry=(await snap('entry')).state;receipt.entryState=entry;expeditionStart=entry.pos;receipt.entrySave=await saveState('entry');receipt.identity=receipt.entrySave.state.riftCheckpoint?.identity??receipt.entrySave.state.riftDeparture?.identity;
  assert.equal(receipt.identity.generation.package.id,`r100-${world}`);assert.equal(receipt.identity.generation.package.grade,grade);assert.equal(receipt.identity.generation.package.algorithmRevision,3);assert.equal(receipt.identity.seed,seed);
  receipt.explorationGoal=await farGeometryGoal();const exploration=await goRift([receipt.explorationGoal]);receipt.exploration={ended:exploration.ended,abandoned:exploration.abandoned,reason:exploration.reason,state:exploration.state};await snap('far-exploration');
  const deferred=new Set();
  for(let n=0;n<12;n++){
   await tactical.observe();const s=await state();if(s.ended||s.chaos>=searchChaosLimit||s.hp<=searchHealthLimit)break;
   const retreat=await riftPlan([{id:'exit',pos:s.exit.position}]);let distance=0;for(let i=1;i<retreat.points.length;i++)distance+=Math.hypot(retreat.points[i].x-retreat.points[i-1].x,retreat.points[i].y-retreat.points[i-1].y);
   const rate=Math.max(grade==='severe'?.64:.42,(s.chaos-entry.chaos)/Math.max(1,(s.elapsedMs-entry.elapsedMs)/1000));
   if(s.chaos+10+(distance/60+4)*rate>=returnChaosBudget){log({event:'actual-return-reserve',distance,rate,chaos:s.chaos});break;}
   const targets=s.nodes.filter(x=>!x.collected&&!deferred.has(x.id)&&Math.hypot(x.pos.x-entry.pos.x,x.pos.y-entry.pos.y)>minimumSearchDistance).map(({id,pos})=>({id,pos}));
   if(!targets.length)break;
   try{const travel=await goRift(targets);if(travel.ended)break;if(travel.abandoned){if(travel.target?.id)deferred.add(travel.target.id);log({event:'abandoned-visible-approach',...travel});if(travel.reason==='return-reserve-threshold')break;continue;}
    const searchDecision=await tactical.search(travel.target),after=await state(),node=after.nodes.find(x=>x.id===travel.target.id),collected=!!node?.collected;
    receipt.searches.push({id:travel.target.id,pos:travel.target.pos,kind:collected?node.kind:null,tier:collected?node.tier:null,collected,searchDecision,hp:after.hp,chaos:after.chaos,carried:after.carried,elapsedMs:after.elapsedMs});await snap(`search-${n+1}`);save();
    if(!collected){deferred.add(travel.target.id);await tactical.evade(travel.target,await tactical.observe());}
    // Finite local exploration: two real finds suffice; never grind safe entry nodes.
    if(receipt.searches.filter(x=>x.collected).length>=2)break;
   }catch(error){receipt.navigationWarning=String(error);break;}
  }
  let s=await state();if(!s.ended){const travel=await goRift([{id:'exit',pos:s.exit.position}]);if(!travel.ended){await press('e');await page.waitForTimeout(650);}}
  s=await state();assert(s.ended,'actual extraction/death ends the run');receipt.fieldResult=s;await snap('field-result');
  await press('r');await page.locator('#impact-result-panel').waitFor({timeout:12000});await page.waitForTimeout(400);receipt.afterReturn=await saveState('returned');await snap('return');
  assert.equal(receipt.afterReturn.state.inventory.run.baseSettled,true,'real return is settled');receipt.outcome=receipt.afterReturn.state.inventory.run.outcome;receipt.status='completed-real-input';receipt.actualSearchAndExtract=receipt.outcome==='extract'&&receipt.searches.some(s=>s.collected);
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 }catch(error){receipt.status='failed';receipt.failure=String(error?.stack??error);await snap('failure').catch(()=>{});receipt.failureSave=await saveState('failure').catch(()=>null);}
 finally{receipt.consoleErrors=consoleErrors;receipt.finishedAt=new Date().toISOString();save();await context.storageState({path:path.join(folder,'browser-storage.json')});await context.close();console.log(`${index+1}/10 ${world} ${grade} ${receipt.status} ${receipt.outcome??''} collected=${receipt.searches.filter(s=>s.collected).length}`);}
}
try{for(const index of selected){assert(!report.realJourneyAttempts.some(r=>r.ordinal===index+1),'already attempted matrix cell; retain failures, do not silently retry');await runCase(cases[index],index);}}
finally{report.status=report.realJourneyAttempts.length===cases.length?'completed-finite-attempt-set':'partial-fixed-attempt-set';report.summary={attempts:report.realJourneyAttempts.length,completed:report.realJourneyAttempts.filter(r=>r.status==='completed-real-input').length,searchAndExtract:report.realJourneyAttempts.filter(r=>r.actualSearchAndExtract).length,deaths:report.realJourneyAttempts.filter(r=>r.outcome==='death').length,failures:report.realJourneyAttempts.filter(r=>r.status==='failed').length};save();await browser.close();}
