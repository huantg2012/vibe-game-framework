/** I14 continuous stability sample. Derived from immutable I13 B14 bounded policy; no economic qualification or early recovery stop. Parent SHA256 6855b51dd82d9ef9fcb308f0293c893f55dff2e6a6f7856db55167826dcbec10. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createJourneyDriver } from '../qa/i27-journey-driver.mjs';
import { installI14BrowserObservations, armI14EntryObservation, readI14EntryObservation, probeI14Lifecycle, startI14Capture, stopI14Capture } from '../qa/r100-i14-lifecycle.mjs';
import { createVisibleEncounterPolicy, newlyCollectedNodeIds } from './r100-i13-continuation-encounters.mjs';
import {chooseOwnedPreparation,publicAbility,sameRoute,relevantRemembered} from './r100-i13-functional-policy.mjs';
import {retryAdmission,recordDeferred,secondGeometryGoal} from './r100-i13-retry-policy.mjs';
import { activeToolSlots, planOwnedToolEquipment } from '../qa/r100-i09-tool-slots.mjs';
import { createLastLightMovementState, stepLastLightMovement, lastLightProjectedWalkingSpeed,
  canInteractLastLight, getLastLightInteractionDistance } from '../../src/systems/last-light-locomotion.ts';
import { LAST_LIGHT_STATIONS, LAST_LIGHT_WORLD_WALK_SPEED } from '../../src/systems/last-light-layout.ts';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i09/journeys');
const grades = ['i14'];
const rounds = Number(process.env.QA_RUNS ?? 12), limit = 6;
assert(Number.isSafeInteger(rounds) && rounds > 0 && rounds <= 12, 'A frozen batch has at most12 departures');
const ordinalStart=Number(process.env.QA_ORDINAL_START??1);
const fixedIdentity=process.env.QA_REPRO_IDENTITY_FILE?JSON.parse(fs.readFileSync(process.env.QA_REPRO_IDENTITY_FILE,'utf8')):null;
const controlledBuild=process.env.QA_CONTROLLED_BUILD??null,controlledWorld=process.env.QA_WORLD_ID??null;
assert(!controlledBuild && !fixedIdentity && !process.env.QA_REPLAY_INPUTS, 'I14 forbids resources/gear/identity-replay fixtures');
const schedule=JSON.parse(process.env.QA_I14_SCHEDULE??'[]');
assert.equal(schedule.length,rounds);for(const grade of schedule)assert(['low','medium','severe'].includes(grade));
let preparation=JSON.parse(process.env.QA_I14_PREPARATION??'{}');
const continuation=JSON.parse(process.env.QA_I14_CONTINUATION??'{}');
assert.equal(continuation.steps.length,rounds,'Frozen continuation steps required');
assert(Array.isArray(preparation.active)&&preparation.active.length===2);
assert(!controlledWorld && !continuation.fixedFirstWorld && !continuation.stopAtService && !continuation.stopAfterRecovery);
assert(continuation.steps.every(step=>!step.requiredUses&&!step.requiresPreviousExtract), 'No I13 grade downgrade or outcome/preparation admission');
const initialStorage=JSON.parse(fs.readFileSync(process.env.QA_STORAGE_STATE,'utf8'));
const initialSave=JSON.parse(initialStorage.origins[0].localStorage.find(entry=>entry.name==='coh-save-v1').value);
const naturalPreparation=true;
const offeringPreference='contaminant-first';
const observedWindows=true;
const normalManagement=true;
const postReturnManagement=process.env.QA_POST_RETURN_MANAGEMENT!=='0';
const searchChaosLimit=120, searchHealthLimit=30, returnChaosBudget=145;
const tacticalEnabled=true;
const RETURN_EVASION = Object.freeze({ maxCount: 4, stepMs: 280, totalInputMs: 1120, maxElapsedMs: 4000 });
/** Return only responds to presently seen threats on the next short leg. It never
 * moves toward an opponent to obtain a melee/search window. */
function returnThreats(facts, point) {
 const dx=point.x-facts.position.x,dy=point.y-facts.position.y,length=Math.hypot(dx,dy);
 if(length<1)return[];
 const ux=dx/length,uy=dy/length,step=Math.min(28,length);
 return facts.enemies.filter(enemy=>{
  const ex=enemy.position.x-facts.position.x,ey=enemy.position.y-facts.position.y;
  const distance=Math.hypot(ex,ey),along=ex*ux+ey*uy,t=Math.max(0,Math.min(step,along));
  const corridorDistance=Math.hypot(ex-ux*t,ey-uy*t);
  const facing=Math.cos(Math.atan2(-ey,-ex)-enemy.facing)>.35;
  return ((enemy.attack==='windup'||enemy.attack==='active')&&distance<110)
    ||(along>0&&corridorDistance<75&&facing);
 });
}
function returnCanEvade(budget) {
 return budget.count<RETURN_EVASION.maxCount&&budget.inputMs+RETURN_EVASION.stepMs<=RETURN_EVASION.totalInputMs
  &&budget.elapsedMs<RETURN_EVASION.maxElapsedMs;
}
if(process.argv.includes('--check-return-policy')){
 const facts={position:{x:100,y:100},enemies:[]},point={x:200,y:100};
 const enemy=(x,y,facing,attack='idle')=>({id:'visible',position:{x,y},facing,attack});
 assert.equal(returnThreats({...facts,enemies:[enemy(150,100,Math.PI)]},point).length,1);
 assert.equal(returnThreats({...facts,enemies:[enemy(70,100,0)]},point).length,0,'a pursuer behind must not provoke a voluntary approach');
 assert.equal(returnThreats({...facts,enemies:[enemy(150,100,0)]},point).length,0,'back-facing observed opponent does not block retreat');
 assert.equal(returnThreats({...facts,enemies:[enemy(100,270,-Math.PI/2,'windup')]},point).length,0,'distant windup does not stop retreat');
 assert.equal(returnThreats({...facts,enemies:[enemy(70,100,0,'windup')]},point).length,1,'near observed attack can cause short evasion');
 assert.equal(returnCanEvade({count:0,inputMs:0,elapsedMs:0}),true);
 for(const budget of [{count:4,inputMs:1120,elapsedMs:1000},{count:1,inputMs:280,elapsedMs:4000}])assert.equal(returnCanEvade(budget),false);
 console.log('PASS return policy: current short-leg threats only, no voluntary pursuit, bounded evasion');process.exit(0);
}
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { continuation, method: 'Actual keyboard movement, E search/extraction, R return and E/arrow/Enter repair. Full geometry is read for diagnostic routing. Preparation opens through the normal scene method. No field reward, HP, chaos, clock or position injection. Natural runs use normal world selection and owned gear; controlled build/world and fixed defect identity are explicit fixtures recorded below.',
  i14:{revision:'I14-continuous-b14-bounded-v1',caseId:continuation.id,samplingLimit:rounds,schedule,preparation,resourceInjection:false,sourceControllerSha256:createHash('sha256').update(fs.readFileSync('tools/world-study/r100-i13-bounded-journey.mjs')).digest('hex'),ancestorRevision6Sha256:'1386811f4b10785803315d795240dddb3b288fa350db728cbb8fde2b325a1277'},
  harnessSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  rawSaveDirectory:'i14', harnessDependencies:['tools/qa/r100-i14-lifecycle.mjs','tools/world-study/r100-i13-retry-policy.mjs','tools/world-study/r100-i13-functional-policy.mjs','tools/world-study/r100-i13-continuation-encounters.mjs','tools/world-study/r100-i13-continuation-policy.mjs','tools/qa/r100-i09-tool-slots.mjs','tools/qa/i27-journey-driver.mjs','src/systems/last-light-locomotion.ts','src/systems/last-light-layout.ts'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
  encounters:tacticalEnabled?'Current visible opponents/hosts and 5s last-seen memory; observed positions/facing, no hidden detection or patrol futures. Contextual known tools, evasion and guarded search.':'Original straight nearest-node policy with on-arrival tool keys',
  offeringPreference,normalManagement,postReturnManagement, policyRevision:'I14-continuous-b14-bounded-v1', slotPolicy:'Runtime public slot count and last passive index; active keys from GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS. Never press a passive slot.', returnEvasion:RETURN_EVASION, strategy:'At most2 approaches per normally seen object with five-second, movement/other-success and changed normal threat observation admission; no deliberate waiting. At most2 body-reachable geometry goals, second at least128px from actual footprints. At most18 outer decisions, unchanged risk and six-pickup budgets. Select only owned publicly revealed function/power/single-item uses eligible tools, then prefer actual branch acquisition FIFO. Observe before exploring; all normal observed uncollected targets are eligible. Public static geometry supports routing. Survey requires a recent lost observation within the actual128px path range and a changed planned path when that stale threat is removed. Paid static coordinates then replace covered stale threat memory; actual revised movement is logged. Per-slot normal budget1, only a current close attack may justify emergency dash. New earned items enter the disclosed FIFO offering queue. Real service repair precedes original reserve-constrained growth.', surveyKnowledge: 'Only paid, currently displayed six-second position snapshots; no enemy identity, facing or live positions beyond visibility.', searchChaosLimit, searchHealthLimit, returnChaosBudget,
  managementPolicy:'Pay actual repairs toward earned entry service targets CORE51/PURIFIER51/STORAGE100 before growth. Only then invest publicly available growth with actual maintenance reserve. Funds or tools are never granted.',
  observedWindowPolicy:observedWindows?'Permit a 28px body-supported short approach behind currently observed non-approaching enemies; reobserve every350ms. No AI state or future patrol access.':'No back-facing approach permission; original conservative rerouting retained.',
  status: 'running', fixedDefectIdentity:fixedIdentity,controlledBuild,controlledWorld:continuation.fixedFirstWorld?'first-only:'+continuation.fixedFirstWorld:controlledWorld,
  diagnosticDisclosure:fixedIdentity||controlledWorld||controlledBuild||continuation.fixedFirstWorld?'The declared first world/seed is controlled for entry comparison; subsequent trips use normal world selection and genuine preceding inventory. No resource fixtures; not unrestricted natural-world evidence.':null, realJourneyAttempts: [], fullI03BuildMatrixComplete: false, i06NaturalSupplyComplete: false };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
function basePlan(worldPosition, route, key) {
  const initial = createLastLightMovementState(worldPosition, route), destination = LAST_LIGHT_STATIONS.find(s => s.key === key);
  assert(destination, `unknown station ${key}`);
  const hash = s => `${s.route}:${Math.round(s.x / .18)}:${Math.round(s.z / .18)}`;
  const goal = s => s.route === destination.floor && canInteractLastLight(s, key) && getLastLightInteractionDistance(s, key) < .65;
  const heuristic = s => Math.hypot(s.x - destination.approach[0], s.z - destination.approach[2]) + Math.abs(s.y - destination.approach[1]);
  const queue = [{ s: initial, cost: 0, score: heuristic(initial), path: [] }], best = new Map([[hash(initial), 0]]);
  const push=value=>{queue.push(value);let i=queue.length-1;while(i>0){const p=(i-1)>>1;if(queue[p].score<=value.score)break;queue[i]=queue[p];i=p;}queue[i]=value;};
  const pop=()=>{const result=queue[0],last=queue.pop();if(queue.length){let i=0;while(true){let child=i*2+1;if(child>=queue.length)break;if(child+1<queue.length&&queue[child+1].score<queue[child].score)child++;if(queue[child].score>=last.score)break;queue[i]=queue[child];i=child;}queue[i]=last;}return result;};
  const inputs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (let count = 0; queue.length && count < 24000; count++) {
    const current=pop();if(current.cost>(best.get(hash(current.s))??Infinity)+1e-9)continue;
    if (goal(current.s)) return current.path;
    for (const [x,y] of inputs) {
      const next = { ...current.s }, input = { x, y };
      for(let i=0;i<3;i++) stepLastLightMovement(next,input,100,lastLightProjectedWalkingSpeed(next,input,LAST_LIGHT_WORLD_WALK_SPEED));
      const moved = Math.hypot(next.x-current.s.x,next.z-current.s.z); if(moved<.15) continue;
      const cost=current.cost + moved, id=hash(next); if((best.get(id)??Infinity)<=cost)continue;
      best.set(id,cost);push({s:next,cost,score:cost+heuristic(next)*1.15,path:[...current.path,next]});
    }
  }
  throw Error(`No body-supported base route to ${key}`);
}
async function runPolicy(grade) {
 const context=await browser.newContext({viewport:{width:1440,height:960},...(process.env.QA_STORAGE_STATE?{storageState:process.env.QA_STORAGE_STATE}:{})}),page=await context.newPage();
 await installI14BrowserObservations(page);
 const policy=grade;let previousTerminal=initialSave;let activeStep=null,pendingSurveyDecision=null;
 const freshOrder=new Map((continuation.freshItemIds??[]).map((id,index)=>[id,index]));
 const branchRuns=new Set(continuation.ancestorRunIds??[]);
 function registerFresh(saved){for(const item of saved.inventory.items){if(branchRuns.has(item.source?.runId)&&!freshOrder.has(item.id))freshOrder.set(item.id,freshOrder.size);}}let expeditionStart=null, expeditionEntry=null, retryRecords=new Map(),lastNormalObservation=null,actualFootprints=[], lastReturnBudget=null;
 const folder=path.join(out,grade);fs.mkdirSync(folder,{recursive:true}); const driver=createJourneyDriver(page,folder);
 const tactical=createVisibleEncounterPolicy(page,driver,ownedForPreparation,{observedWindows,visiblePollution:normalManagement});
 async function observePolicy(){const facts=await tactical.observe();lastNormalObservation=facts;if(facts.position)rememberFootprint(facts.position);return facts;}
 function rememberFootprint(position){if(!actualFootprints.length||Math.hypot(position.x-actualFootprints.at(-1).x,position.y-actualFootprints.at(-1).y)>=4)actualFootprints.push({...position});}
 function retryFacts(state){return{position:state.pos,elapsedMs:state.elapsedMs,successes:newlyCollectedNodeIds(expeditionEntry,state).length,remembered:lastNormalObservation?.remembered??[],lastNormalObservation};}
 async function deferObserved(target,reason){const facts=await observePolicy(),state=await driver.state();const record=recordDeferred(retryRecords.get(target.id),retryFacts(state),target,reason);retryRecords.set(target.id,record);driver.log({event:'bounded-target-deferred',record,normalObservation:facts});}
 async function nextGeometryGoal(firstGoal){
  const grid=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,b=s.player.getSprite().body;return{cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()},halfX:b.width/2+1,halfY:b.height/2+1};});
  const goal=secondGeometryGoal(grid,actualFootprints,firstGoal);driver.log({event:'bounded-second-geometry-choice',goal,actualFootprints,disclosure:'Pure static support and actual walked positions only; zero object, loot or enemy inputs'});return goal;
 }
 const errors=[],consoleMessages=[];page.on('pageerror',error=>errors.push(String(error)));
 page.on('console',message=>{consoleMessages.push({type:message.type(),text:message.text()});fs.writeFileSync(path.join(folder,'console.json'),JSON.stringify(consoleMessages,null,2));});
 async function captureRejected(label){
  const diagnostic=await page.evaluate(async()=>{
   const s=window.__game?.scene.getScene('RiftScene');if(!s)return{error:'RiftScene missing'};
   let checkpoint=null,captureError=null;try{checkpoint=s.captureRuntimeCheckpoint((s.frameCommit?.sequence??0)+1);}catch(error){captureError=String(error?.stack??error);}
   let inventory=null,inventoryError=null;try{const module=await import('/src/systems/inventory-store.ts');inventory=module.inventoryStore.getState();}catch(error){inventoryError=String(error);}
   return{checkpoint,captureError,inventory,inventoryError,frameCommitKeys:Object.keys(s.frameCommit??{}),lastCompleteRaw:localStorage.getItem('coh-save-v1'),text:document.body.innerText};
  }).catch(error=>({error:String(error)}));
  fs.writeFileSync(path.join(folder,`${label}-rejected-state.json`),JSON.stringify(diagnostic,null,2));
 }
 async function startPerformance(){
  await page.evaluate(()=>{
   window.__r100JourneyPerf?.dispose?.();const game=window.__game;
   const values={intervals:[],cpu:[],render:[],startedSimulationMs:null,endedSimulationMs:null},run={values,lastPre:null,start:null};
   const active=()=>{const s=game.scene.getScene('RiftScene');return s?.scene.isActive()&&!s.scene.isPaused()&&!s.runController.isRunEnded()?s:null;};
   const pre=()=>{const s=active();if(!s){run.lastPre=null;run.start=null;return;}const now=performance.now();if(run.lastPre!==null)values.intervals.push(now-run.lastPre);run.lastPre=now;run.start=now;values.startedSimulationMs??=s.runController.getElapsedMs();values.endedSimulationMs=s.runController.getElapsedMs();};
   const post=()=>{const s=active();if(!s||run.start===null)return;values.cpu.push(performance.now()-run.start);const ms=s.devRuntime?.snapshot?.().lastRenderMs;if(Number.isFinite(ms))values.render.push(ms);};
   game.events.on('prestep',pre);game.events.on('poststep',post);
   window.__r100JourneyPerf={values,dispose:()=>{game.events.off('prestep',pre);game.events.off('poststep',post);}};
  });
 }
 async function endPerformance(label){
  const result=await page.evaluate(()=>{const p=window.__r100JourneyPerf;if(!p)return null;p.dispose();const v=p.values;
   const percentile=(list,p)=>{if(!list.length)return null;const a=[...list].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.ceil(a.length*p)-1)];};
   return {activeSimulationMs:(v.endedSimulationMs??0)-(v.startedSimulationMs??0),frames:v.cpu.length,intervalCount:v.intervals.length,frameIntervalP95:percentile(v.intervals,.95),frameIntervalP99:percentile(v.intervals,.99),over50Count:v.intervals.filter(n=>n>50).length,over50Fraction:v.intervals.length?v.intervals.filter(n=>n>50).length/v.intervals.length:null,cpuDispatchP95:percentile(v.cpu,.95),lastRenderMsP95:percentile(v.render,.95),samples:v};
  });
  if(!result)return null;result.referenceContext='I14 single continuous context, logical960x640. First3 have actual audio/video capture overhead. These descriptive journey timings are not the separately frozen exclusive61.2second runtime-budget qualification. Pause/lifecycle precedes measurement. CPU dispatch and queued submission are not GPU execution.';
  result.meets60SecondDuration=result.activeSimulationMs>=60000;fs.writeFileSync(path.join(folder,`${label}-performance.json`),JSON.stringify(result,null,2));
  const{samples,...summary}=result;return summary;
 }
 async function logState(label){const value=await driver.snap(label);return value.state;}
 async function storage(label){const raw=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));fs.writeFileSync(path.join(folder,`${label}.save.json`),raw??'null');return {sha256:createHash('sha256').update(raw??'').digest('hex'),state:JSON.parse(raw??'null')};}
 async function riftPlan(targets,avoid=[]){
  const planStarted=performance.now();
  const data=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,b=s.player.getSprite().body;return{cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols))),start:{...s.player.getPosition()},halfX:b.width/2+1,halfY:b.height/2+1,paidResistance:s.toolSystem.getPollutionResistanceBonus()>0}});
  const planReadFinished=performance.now();
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
  if(end===null)throw Error('No full-body path to requested interaction');const raw=[];for(let i=end;i!==-1;i=prev.get(i))raw.push(center(i));raw.reverse();const points=[raw[Math.min(1,raw.length-1)]];for(let i=1;i<raw.length-1;i++)if((raw[i-1].x===raw[i].x)!==(raw[i].x===raw[i+1].x))points.push(raw[i]);points.push(raw.at(-1));driver.log({event:'read-only-body-route',target:chosen,points,greenCellExtraCost:data.paidResistance?3:4,planningMs:performance.now()-planStarted,geometryReadMs:planReadFinished-planStarted,nodePlanningMs:performance.now()-planReadFinished});return{target:chosen,points};
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
 function eligibleObservedTargets(state){
  const observedIds=new Set(tactical.knownSearches().map(node=>node.id));
  return state.nodes.filter(node=>!node.collected&&observedIds.has(node.id)&&retryAdmission(retryRecords.get(node.id),retryFacts(state)).allowed&&(!continuation.entryOnly||Math.hypot(node.pos.x-expeditionStart.x,node.pos.y-expeditionStart.y)<=320));
 }
 async function returnBudget(state,force=false){
  if(!expeditionEntry)return {stop:false};
  if(!force&&lastReturnBudget&&state.elapsedMs-lastReturnBudget.elapsedMs<750)return lastReturnBudget;
  const retreat=await riftPlan([{id:'exit',pos:state.exit.position}]);
  let routeLength=0,previousPoint=state.pos;for(const point of retreat.points){routeLength+=Math.hypot(point.x-previousPoint.x,point.y-previousPoint.y);previousPoint=point;}
  const actualSpeed=await page.evaluate(()=>window.__game.scene.getScene('RiftScene').player.getEffectiveSpeed());
  assert(Number.isFinite(actualSpeed)&&actualSpeed>0,'current observed movement speed must remain finite');const budgetSpeed=Math.min(60,actualSpeed);
  const observedRate=Math.max(grade==='severe'?.64:grade==='medium'?.42:.24,(state.chaos-expeditionEntry.chaos)/Math.max(1,(state.elapsedMs-expeditionEntry.elapsedMs)/1000));
  const reservedChaos=10+(routeLength/budgetSpeed+4)*observedRate;
  lastReturnBudget={event:'known-return-budget',elapsedMs:state.elapsedMs,chaos:state.chaos,routeLength,actualSpeed,budgetSpeed,observedRate,reservedChaos,stop:state.chaos+reservedChaos>=returnChaosBudget};
  driver.log(lastReturnBudget);return lastReturnBudget;
 }
 async function goRift(targets){
  if(tacticalEnabled){
   const travel=await goRiftAware(targets);
   if(targets[0]?.id!=='exit'||travel.ended||!travel.abandoned)return travel;
   driver.log({event:'return-visible-policy-cap-fallback',reason:travel.reason,disclosure:'After at most60s visible rerouting, commit the current body-supported exit path; this is a driver limit, not a game fail.'});
  }
  if(normalManagement)await observePolicy();
  const planned=await riftPlan(targets),started=Date.now();let last=null,stuck=0;
  for(const p of planned.points)for(let step=0;step<90;step++){
   const s=await driver.state();if(s.scene!=='rift'||s.ended)return{ended:true,state:s};assert(s.active,'scene must keep simulating during travel');assert(Date.now()-started<60000,'route diagnostic exceeded 60s');
   const dx=p.x-s.pos.x,dy=p.y-s.pos.y;if(Math.hypot(dx,dy)<3)break;stuck=last&&Math.hypot(last.x-s.pos.x,last.y-s.pos.y)<.35?stuck+1:0;last=s.pos;assert(stuck<9,`actual movement blocked near ${JSON.stringify(p)}`);
   const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');await driver.hold(keys,Math.max(35,Math.min(160,Math.hypot(dx,dy)/80*1000)));
  }
  return{target:planned.target,state:await driver.state()};
 }
 async function goRiftAware(targets){
  const started=Date.now(),returning=targets[0]?.id==='exit';let rememberedTarget=targets[0],lastObserve=0,stuck=0,lastPosition=null;
  const evasion={count:0,inputMs:0,elapsedMs:0};
  async function observeApproach(point){
   if(!returning){const result=await tactical.caution(rememberedTarget);if(result.facts)lastNormalObservation=result.facts;return result;}
   const facts=await observePolicy();if(facts.ended)return{ended:true};
   if(!point||!returnThreats(facts,point).length||!returnCanEvade(evasion))return{reroute:false,facts};
   const evadeStarted=performance.now(),opponents=facts.enemies;
   const nearest=p=>Math.min(...opponents.map(enemy=>Math.hypot(enemy.position.x-p.x,enemy.position.y-p.y)));
   const beforeDistance=nearest(facts.position),candidates=[];
   for(let index=0;index<8;index++){
    const angle=index*Math.PI/4,p={x:facts.position.x+Math.cos(angle)*24,y:facts.position.y+Math.sin(angle)*24};
    const gain=nearest(p)-beforeDistance;
    if(gain>2)candidates.push({point:p,score:gain*3-Math.hypot(p.x-point.x,p.y-point.y)*.04});
   }
   // Static floor is already disclosed for routing. Only candidate support is
   // queried here; no hidden enemy, loot, hazard timer or future patrol read.
   const supported=await page.evaluate(({start,candidates})=>{
    const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid,b=s.player.getSprite().body;
    const halfX=b.width/2+1,halfY=b.height/2+1;
    const clear=p=>{for(let y=Math.floor((p.y-halfY)/g.tileSize);y<=Math.floor((p.y+halfY-.01)/g.tileSize);y++)for(let x=Math.floor((p.x-halfX)/g.tileSize);x<=Math.floor((p.x+halfX-.01)/g.tileSize);x++)if(x<0||y<0||x>=g.cols||y>=g.rows||!g.isWalkable(x,y))return false;return true;};
    return candidates.map(candidate=>{const n=Math.ceil(Math.hypot(candidate.point.x-start.x,candidate.point.y-start.y)/2);
     for(let step=0;step<=n;step++)if(!clear({x:start.x+(candidate.point.x-start.x)*step/(n||1),y:start.y+(candidate.point.y-start.y)*step/(n||1)}))return false;return true;});
   },{start:facts.position,candidates});
   const chosen=candidates.filter((_,index)=>supported[index]).sort((a,b)=>b.score-a.score)[0];
   if(!chosen){evasion.elapsedMs+=performance.now()-evadeStarted;return{reroute:false,facts};}
   const dx=chosen.point.x-facts.position.x,dy=chosen.point.y-facts.position.y,keys=[];
   if(Math.abs(dx)>.42*Math.abs(dy))keys.push(dx>0?'d':'a');if(Math.abs(dy)>.42*Math.abs(dx))keys.push(dy>0?'s':'w');
   evasion.count++;evasion.inputMs+=RETURN_EVASION.stepMs;
   await driver.hold(keys,RETURN_EVASION.stepMs);evasion.elapsedMs+=performance.now()-evadeStarted;
   driver.log({event:'bounded-visible-return-evasion',target:'exit',from:facts.position,toward:chosen.point,keys,...evasion,
    threatIds:returnThreats(facts,point).map(enemy=>enemy.id),policy:RETURN_EVASION});
   return{reroute:true,facts:await observePolicy()};
  }
  for(let revision=0;revision<90;revision++){
   const current=await driver.state();if(current.pos)rememberFootprint(current.pos);if(current.ended)return{ended:true,state:current};
   if(!returning&&(current.hp<=searchHealthLimit||current.chaos>=searchChaosLimit||(continuation.maxFieldMs&&current.elapsedMs>=continuation.maxFieldMs)||(await returnBudget(current)).stop))return{abandoned:true,reason:'return-reserve-threshold',state:current,target:rememberedTarget};
   if(Date.now()-started>(returning?60000:rememberedTarget.id==='geometry-exploration'?42000:25000))return{abandoned:true,reason:'approach-kept-dangerous',state:current,target:rememberedTarget};
   const observed=await observeApproach();if(observed.ended)return{ended:true,state:await driver.state()};const afterObservation=await driver.state();lastObserve=afterObservation.elapsedMs;
   if(!returning&&(afterObservation.hp<=searchHealthLimit||afterObservation.chaos>=searchChaosLimit||(continuation.maxFieldMs&&afterObservation.elapsedMs>=continuation.maxFieldMs)||(await returnBudget(afterObservation)).stop))return{abandoned:true,reason:'return-reserve-threshold',state:afterObservation,target:rememberedTarget};
   let planned=await riftPlan(targets,tactical.remembered());rememberedTarget=planned.target;
   if(!returning&&activeStep.surveyDecision){
    const observed=await tactical.surveyCandidates(),candidates=relevantRemembered(observed.candidates,planned);
    if(candidates.length){
     const candidateIds=new Set(candidates.map(candidate=>candidate.id));
     const alternative=await riftPlan(targets,tactical.remembered().filter(row=>!candidateIds.has(row.id)));
     if(!sameRoute(planned,alternative)){
      const before=planned,answer=await tactical.useSurvey(candidates,{before,withoutUncertainMemory:alternative});
      if(answer){planned=await riftPlan(targets,tactical.remembered());rememberedTarget=planned.target;pendingSurveyDecision={before,withoutUncertainMemory:alternative,after:planned,answer,changed:!sameRoute(before,planned)};driver.log({event:'survey-actual-replanning',...pendingSurveyDecision});}
     }
    }
   }
   const knownPollution=new Set(tactical.pollution().map(c=>`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}`));
   let replan=false;
   for(const point of planned.points){for(let step=0;step<90;step++){
    const state=await driver.state();if(state.pos)rememberFootprint(state.pos);if(state.ended)return{ended:true,state};assert(state.active,'visible policy must preserve active simulation');
    if(Date.now()-started>(returning?60000:rememberedTarget.id==='geometry-exploration'?42000:25000))return{abandoned:true,reason:'approach-kept-dangerous',state,target:rememberedTarget};
    if(!returning&&(state.hp<=searchHealthLimit||state.chaos>=searchChaosLimit||(continuation.maxFieldMs&&state.elapsedMs>=continuation.maxFieldMs)||(await returnBudget(state)).stop))return{abandoned:true,reason:'return-reserve-threshold',state,target:rememberedTarget};
    if(rememberedTarget.id==='geometry-exploration'&&expeditionStart){
     const found=eligibleObservedTargets(state);
     if(found.length){driver.log({event:'stop-exploration-at-observed-remains',position:state.pos,observed:found.map(({id,pos})=>({id,pos}))});return{discovered:true,state,target:rememberedTarget};}
    }
    if(rememberedTarget.id!=='exit'&&(state.hp<=searchHealthLimit||state.chaos>=searchChaosLimit))return{abandoned:true,reason:'return-reserve-threshold',state,target:rememberedTarget};
    const dx=point.x-state.pos.x,dy=point.y-state.pos.y;if(Math.hypot(dx,dy)<3)break;
    if(state.elapsedMs-lastObserve>(observedWindows?350:700)){lastObserve=state.elapsedMs;const result=await observeApproach(point);if(result.ended)return{ended:true,state:await driver.state()};if(result.reroute||(normalManagement&&tactical.pollution().some(c=>!knownPollution.has(`${Math.floor(c.x/16)}:${Math.floor(c.y/16)}`)))){replan=true;break;}}
    stuck=lastPosition&&Math.hypot(lastPosition.x-state.pos.x,lastPosition.y-state.pos.y)<.35?stuck+1:0;lastPosition=state.pos;assert(stuck<12,'visible-policy movement failed at body edge');
    if(!returning)await tactical.beforeMove(point,rememberedTarget);const keys=[];if(Math.abs(dx)>2)keys.push(dx>0?'d':'a');if(Math.abs(dy)>2)keys.push(dy>0?'s':'w');if(pendingSurveyDecision){driver.log({event:'survey-replanned-actual-input',keys,toward:point,from:state.pos,elapsedMs:state.elapsedMs,changed:pendingSurveyDecision.changed,cast:pendingSurveyDecision.answer.shown.cast,expiresMs:pendingSurveyDecision.answer.elapsedMs+pendingSurveyDecision.answer.shown.remainingMs});pendingSurveyDecision=null;}
    await driver.hold(keys,Math.max(35,Math.min(140,Math.hypot(dx,dy)/80*1000)));
   }if(replan)break;}
   if(!replan)return{target:planned.target,state:await driver.state()};
  }
  return{abandoned:true,reason:'no-quiet-approach-found',state:await driver.state(),target:rememberedTarget};
 }
 async function baseTo(key){
  for(let retry=0;retry<4;retry++){
   const state=await driver.state();assert(state.scene==='base'&&state.worldPlayer,'expected Last Light base');
   if(state.nearTarget===key||(key==='offering'&&state.nearTarget==='defense'))return;
   const route=basePlan(state.worldPlayer,state.route,key);driver.log({event:'read-only-native-base-route',key,retry,points:route});
   let stalled=false;
   for(const target of route){for(let i=0;i<20;i++){
     const s=await driver.state();if(s.nearTarget===key||(key==='offering'&&s.nearTarget==='defense'))return;
     const world=s.worldPlayer;assert(world,'base player required');const dist=Math.hypot(target.x-world.x,target.z-world.z);if(dist<.18&&Math.abs(target.y-world.y)<.2)break;
     // Heights change the screen projection on ramps. Choose real key pressure
     // by the same pure locomotion prediction, never by a screen-space shortcut.
     const duration=Math.max(45,Math.min(130,dist/1.8*1000));
     const choices=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]].map(([x,y])=>{
       const next=createLastLightMovementState(world,s.route),input={x,y};
       stepLastLightMovement(next,input,duration,lastLightProjectedWalkingSpeed(next,input,LAST_LIGHT_WORLD_WALK_SPEED));
       return{x,y,score:Math.hypot(target.x-next.x,target.z-next.z)+Math.abs(target.y-next.y)*.2,moved:Math.hypot(next.x-world.x,next.z-world.z)};
     }).filter(choice=>choice.moved>.005).sort((a,b)=>a.score-b.score);
     if(!choices.length){stalled=true;break;}const best=choices[0],keys=[];
     if(best.x)keys.push(best.x>0?'d':'a');if(best.y)keys.push(best.y>0?'s':'w');await driver.hold(keys,duration);
     if(i===19)stalled=true;
   }if(stalled)break;}
  }
  const final=await driver.state();assert(final.nearTarget===key||(key==='offering'&&final.nearTarget==='defense'),`base interaction ${key} not reached`);
 }
 async function ownedForPreparation(){return page.evaluate(async()=>{
   const{inventoryStore}=await import('/src/systems/inventory-store.ts'),{projectInventoryItem}=await import('/src/ui/inventory-presenter.ts');
   const{contaminantSystem}=await import('/src/systems/contaminant-system.ts'),{GAME_CONSTANTS}=await import('/src/config/constants.ts');
   const count=contaminantSystem.getSortieSlotCount(),passive=contaminantSystem.getSortiePassiveSlotIndex();
   const toolSlots=Array.from({length:count},(_,index)=>({index,id:String(index),key:index===passive?null:GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[index],label:index===passive?'被动':`工具 ${GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS[index]}`}));
   return{toolSlots,equipment:inventoryStore.getEquipment(),items:inventoryStore.getItems().map(item=>{const{icon,...facts}=projectInventoryItem(item,'prepare');return facts;})};
 });}
 async function equipOwned(){
   let owned=await ownedForPreparation();const changes=[];
   const weapon=owned.items.filter(item=>item.kind==='weapon'&&item.canEquip).sort((a,b)=>(b.qualityRank??0)-(a.qualityRank??0))[0];
   if(weapon&&weapon.id!==owned.equipment.weaponId){await page.locator('[role="option"][data-item-id="'+weapon.id+'"]').click();await page.getByRole('button',{name:'换到在手',exact:true}).click();changes.push({slot:'weapon',id:weapon.id});}
   const used=new Set();
   for(const slot of owned.toolSlots){
    const desired=chooseOwnedPreparation(owned,slot,preparation,freshOrder);
    const previous=owned.equipment.toolIds[slot.index]??null;
    if(desired)used.add(desired.id);
    if(previous===(desired?.id??null))continue;
    if(desired){await page.locator('[role="option"][data-item-id="'+desired.id+'"]').click();await page.getByRole('button',{name:'装到 '+slot.label,exact:true}).click();}
    else if(previous){await page.locator('[role="option"][data-item-id="'+previous+'"]').click();await page.getByRole('button',{name:'卸下 '+slot.label,exact:true}).click();}
    changes.push({slot:slot.id,before:previous,id:desired?.id??null,publicName:desired?.name??null,reason:desired?'Owned revealed preparation':'No currently owned usable declared preparation; no grant'});
    owned=await ownedForPreparation();
   }
   driver.log({event:'actual-owned-equipment-inputs',changes,preparation});return changes;
 }
 function publicOfferingReduction(item){return Number((item.description+' '+JSON.stringify(item.explanations??[])).match(/(?:减少|减免|减伤)[^0-9]{0,4}(\d+)%/)?.[1]??0);}
 async function manageBase(receipt,ordinal){
  let current=receipt.afterReturn.state;const actions=[];
  const paidBill=receipt.before.state.modules.reduce((sum,m)=>sum+Math.ceil(Math.max(0,m.hp-current.modules.find(n=>n.id===m.id).hp)/4),0);
  async function repair(module,target){
   const amount=Math.min(current.kindlingReserve,Math.ceil((target-module.hp)/4));if(amount<=0)return;
   await baseTo(module.type.toLowerCase());await driver.press('e');await page.locator('#allocation-panel').waitFor({timeout:3000});
   await driver.press('Home');for(let k=0;k<amount;k++)await driver.press('ArrowRight',15);
   const before=current;await driver.press('Enter');await page.waitForTimeout(850);
   const saved=await storage(`${ordinal}-managed-repair-${actions.length+1}`);current=saved.state;
   actions.push({kind:'repair',module:module.id,target,spent:before.kindlingReserve-current.kindlingReserve,beforeHp:module.hp,afterHp:current.modules.find(m=>m.id===module.id).hp});receipt.afterRepair=saved;
  }
  // These are public survival readings, not hidden next-impact forecasts.
  const serviceTargets={"CORE":51,"STORAGE":100,"PURIFIER":51};
  for(const type of ['PURIFIER','CORE','STORAGE']){const m=current.modules.find(m=>m.type===type);if(m.hp<serviceTargets[type])await repair(m,serviceTargets[type]);}
  const completedBefore=Object.values(current.growth.upgrades).reduce((sum,level)=>sum+level,0)+(current.moduleMaxHpTier??0);
  receipt.management={paidBill,investmentReserve:completedBefore<2?2:Math.max(4,paidBill),actions};
  if(current.modules.every(m=>m.hp>=serviceTargets[m.type])&&current.kindlingReserve>receipt.management.investmentReserve){
   await baseTo('growth');await driver.press('e');await page.locator('#growth-panel').waitFor({timeout:3000});
   for(let attempt=0;attempt<3;attempt++){
    const card=page.locator('#growth-panel [data-growth-next="true"]');if(!await card.count())break;
    const id=await card.getAttribute('data-id'),text=await card.innerText(),cost=Number((await card.locator('.card-cost').innerText()).match(/\d+/)?.[0]);
    const completed=Object.values(current.growth.upgrades).reduce((sum,level)=>sum+level,0)+(current.moduleMaxHpTier??0);
    const reserve=completed<2?2:Math.max(4,paidBill);
    if(!text.includes('可刻入')||!Number.isSafeInteger(cost)||current.kindlingReserve-cost<reserve)break;
    await page.screenshot({path:path.join(folder,`${ordinal}-growth-${attempt+1}-public-before.png`)});
    const before=current;await driver.press('Enter');await page.waitForTimeout(500);const saved=await storage(`${ordinal}-growth-${attempt+1}`);current=saved.state;
    assert.equal(before.kindlingReserve-current.kindlingReserve,cost,'visible growth price must match actual reserve payment');
    if(id==='thicken')assert.equal(current.moduleMaxHpTier,before.moduleMaxHpTier+1);else assert.equal(current.growth.upgrades[id],before.growth.upgrades[id]+1,'genuine next growth node must advance');
    actions.push({kind:'growth',id,publicText:text,cost,level:id==='thicken'?current.moduleMaxHpTier:current.growth.upgrades[id],retainedReserve:reserve});
    await page.screenshot({path:path.join(folder,`${ordinal}-growth-${attempt+1}-public-after.png`)});
   }
   await driver.press('Escape');await page.waitForTimeout(250);
  }
  const remainingBuffer=Math.max(2,paidBill);
  const storageModule=current.modules.find(m=>m.type==='STORAGE');
  if(storageModule.hp<100&&current.kindlingReserve>=Math.ceil((100-storageModule.hp)/4)+remainingBuffer)await repair(storageModule,100);
  driver.log({event:'normal-management-actual-actions',...receipt.management});
 }
 async function offerOwned(){
   const owned=await ownedForPreparation();if(!owned.items.some(item=>item.canOffer))return[];
   const empty=await page.evaluate(async()=>{const{inventoryStore}=await import('/src/systems/inventory-store.ts');return inventoryStore.getOfferingItems().filter(item=>!item).length;});if(!empty)return[];
   await baseTo('offering');await driver.press('e');await page.locator('#defense-panel').waitFor({timeout:3000});
   const offered=[];for(let i=0;i<empty;i++){
    const fresh=owned.items.filter(item=>item.canOffer&&!offered.includes(item.id)&&freshOrder.has(item.id)).sort((a,b)=>freshOrder.get(a.id)-freshOrder.get(b.id))[0];
    const knownContaminant=fresh??(offeringPreference==='contaminant-first'?owned.items.filter(item=>item.kind==='contaminant'&&item.canOffer&&!offered.includes(item.id)).sort((a,b)=>normalManagement?publicOfferingReduction(b)-publicOfferingReduction(a):0)[0]:null);
    const tile=knownContaminant?page.locator(`#defense-panel .defense-equip-tile:not(.tile-disabled)[data-id="${knownContaminant.id}"]`):page.locator('#defense-panel .defense-equip-tile:not(.tile-disabled)').first();if(!await tile.count())break;
    offered.push(await tile.getAttribute('data-id'));await tile.click();await page.waitForTimeout(80);
   }
   await driver.press('Escape');await page.waitForTimeout(250);driver.log({event:'actual-offering-inputs',ids:offered});return offered;
 }
 async function useOwnedTools(label){
   const before=await ownedForPreparation(),slots=activeToolSlots(before);const ids=slots.map(slot=>before.equipment.toolIds[slot.index]);
   for(const slot of slots)if(before.equipment.toolIds[slot.index])await driver.press(slot.key.toLowerCase());
   const after=await ownedForPreparation();driver.log({event:'actual-tool-keys',label,before:before.items.filter(item=>ids.includes(item.id)),after:after.items.filter(item=>ids.includes(item.id))});
 }
 try{
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:3043/');await page.waitForFunction(()=>window.__game?.scene.getScene('MainMenuScene')?.interactive());await driver.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(2200);
  for(let ordinal=ordinalStart;ordinal<ordinalStart+rounds;ordinal++){
   activeStep=continuation.steps[ordinal-ordinalStart];preparation=activeStep.preparation;
   grade=schedule[ordinal-ordinalStart];
   const receipt={policy,grade,ordinal,gradeDecision:{plannedGrade:grade,actualGrade:grade,reason:'I14预登记低→中→重稳定性抽样，固定选级；目的地正常随机，工具不足不改级'},entry:'production-prepare-scene-method',loadout:controlledBuild??'naturally-owned-baseline',status:'running',searches:[],errors};report.realJourneyAttempts.push(receipt);save();
   try{
    receipt.before=await storage(`${ordinal}-before`);
    assert.deepEqual(receipt.before.state,previousTerminal,'I14 preserves complete preceding earned terminal save');
    receipt.timing={preparationStartedAt:new Date().toISOString(),preparationStartedMs:Date.now()};
    await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());if(naturalPreparation)receipt.equipmentChanges=await equipOwned();
    await page.locator(`[data-departure-grade="${grade}"]`).click();
    const caseWorld=null;receipt.controlledWorld=null;
    await armI14EntryObservation(page,'formal-departure');
    receipt.timing.departureStartedMs=Date.now();await driver.press('Shift+Enter');
    await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&!s.stagedEntry?.isActive()&&!s.nativeEntryFence?.isActive()&&s.nativeWorldPresentation&&s.devRuntime&&s.player&&s.search&&s.chaos&&s.runController},{timeout:45000});tactical.reset();tactical.setBudget(activeStep.budget);receipt.timing.departureReadyMs=Date.now()-receipt.timing.departureStartedMs;await page.waitForTimeout(Number(process.env.QA_ENTRY_WAIT??600));
    receipt.timing.preparationAndEntryWallMs=Date.now()-receipt.timing.preparationStartedMs;
    const entry=await logState(`${ordinal}-entry`);expeditionStart={...entry.pos};expeditionEntry=entry;lastReturnBudget=null;receipt.entryState=entry;receipt.entrySave=await storage(`${ordinal}-entry`);
    branchRuns.add(receipt.entrySave.state.inventory.run.id);receipt.continuationStep=activeStep;
    receipt.identity=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('coh-save-v1'));return s.riftCheckpoint?.identity??s.riftDeparture?.identity;});
    assert.equal(receipt.identity.generation.package.grade,grade,'actual frozen grade matches the chosen grade');
    assert.equal(receipt.identity.generation.package.algorithmRevision,6,'I10-I12 real journeys require frozen revision6');
    assert.equal(receipt.identity.generation.contentDefinition.version,2,'P13 content definition must be current frozen v2');
    receipt.entryObservation=await readI14EntryObservation(page);
    if(ordinal<=3){receipt.lifecycle=await probeI14Lifecycle(page,driver,folder,ordinal,receipt);receipt.capture={...(await startI14Capture(page)),startState:await driver.state()};}
    await startPerformance();
    let failedNavigation=null,outerDecisions=0;retryRecords=new Map();lastNormalObservation=null;actualFootprints=[];rememberFootprint(entry.pos);
    const firstExplorationGoal=await farGeometryGoal();let explorationGoal=firstExplorationGoal,geometryFinished=false,geometryCount=1;receipt.explorationGoal=explorationGoal;receipt.geometryGoals=[explorationGoal];
    receipt.exploration={reason:'Observe first; geometry goal is used only while no observed targets remain'};
    await observePolicy();await logState(`${ordinal}-entry-observation`);
    for(let n=0;!failedNavigation&&n<18;n++){outerDecisions++;
     const s=await driver.state();if(s.ended||s.chaos>=searchChaosLimit||s.hp<=searchHealthLimit||(continuation.maxFieldMs&&s.elapsedMs>=continuation.maxFieldMs)||newlyCollectedNodeIds(receipt.entryState,s).length>=limit)break;
     if((await returnBudget(s,true)).stop){driver.log({event:'return-with-reserve',reason:'observed-chaos-and-known-return-distance'});break;}
     await observePolicy();
     const targets=eligibleObservedTargets(await driver.state());
     if(!targets.length&&continuation.entryOnly){receipt.explorationStop='no-currently-observed-entry-target';break;}
     if(!targets.length){
      try{
       if(geometryFinished){
        if(geometryCount>=2){receipt.explorationStop='two-geometry-goals-exhausted-with-no-currently-admitted-target';break;}
        explorationGoal=await nextGeometryGoal(firstExplorationGoal);geometryCount=2;geometryFinished=false;
        if(!explorationGoal){receipt.explorationStop='no-unvisited-body-supported-second-goal';break;}receipt.geometryGoals.push(explorationGoal);
       }
       const continued=await goRift([explorationGoal]);
       (receipt.continuedExploration??=[]).push({discovered:continued.discovered??false,ended:continued.ended??false,abandoned:continued.abandoned??false,reason:continued.reason??null,state:continued.state});
       await observePolicy();const arrived=await logState(`${ordinal}-continued-exploration-${n+1}`);rememberFootprint(arrived.pos);
       if(arrived.ended||continued.ended||arrived.hp<=searchHealthLimit||arrived.chaos>=searchChaosLimit||(await returnBudget(arrived,true)).stop){receipt.explorationStop=continued.reason??'run-ended-or-return-budget';break;}
       if(!continued.discovered)geometryFinished=true;
       if(eligibleObservedTargets(arrived).length)continue;
       driver.log({event:'bounded-geometry-progress',goal:explorationGoal,geometryCount,finished:geometryFinished,reason:continued.reason??'arrived-with-no-currently-admitted-target'});
       continue;
      }catch(error){failedNavigation=String(error);receipt.explorationStop='exploration-navigation-warning';break;}
     }
     try{const approachState=await driver.state();driver.log({event:'bounded-admitted-targets',targets:targets.map(target=>({id:target.id,admission:retryAdmission(retryRecords.get(target.id),retryFacts(approachState))}))});const travel=await goRift(targets);if(travel.ended)break;if(travel.abandoned){driver.log({event:'abandoned-observed-approach',reason:travel.reason,target:travel.target});if(travel.target?.id&&travel.reason!=='return-reserve-threshold')await deferObserved(travel.target,travel.reason);if(travel.reason==='return-reserve-threshold')break;continue;}
      const beforeSearch=await driver.state();if(retryRecords.has(travel.target.id))driver.log({event:'bounded-target-retry-arrival',target:travel.target,admission:retryAdmission(retryRecords.get(travel.target.id),retryFacts(beforeSearch)),originalCaution:'Original live approach and search danger checks remain in force'});if(newlyCollectedNodeIds(receipt.entryState,beforeSearch).length>=limit)break;
      let searchDecision=null;if(tacticalEnabled)searchDecision=await tactical.search(travel.target,{entryState:receipt.entryState,limit,maxFieldMs:continuation.maxFieldMs??null});else{if(naturalPreparation&&travel.target.tier!=='safe')await useOwnedTools(`before-${travel.target.id}`);await driver.hold(['e'],1450);}
      const after=await driver.state();const collected=after.nodes.find(x=>x.id===travel.target.id)?.collected;
      const actualCollectedNodeIds=newlyCollectedNodeIds(beforeSearch,after);
      receipt.searches.push({searchDecision,id:travel.target.id,kind:travel.target.kind,tier:travel.target.tier,collected,actualCollectedNodeIds,hp:after.hp,chaos:after.chaos,carried:after.carried,elapsedMs:after.elapsedMs});await logState(`${ordinal}-search-${n+1}`);if(!actualCollectedNodeIds.length){if(tacticalEnabled){await deferObserved(travel.target,searchDecision?.reason??'no-actual-pickup');await tactical.evade(travel.target,await observePolicy());continue;}break;}
     }catch(e){failedNavigation=String(e);break;}
    }
    let s=await driver.state();if(!s.ended){const travel=await goRift([{id:'exit',pos:s.exit.position}]);if(!travel.ended){await driver.press('e');await page.waitForTimeout(650);}}
    s=await driver.state();assert(s.ended,'real extraction/death must end the run');receipt.performance=await endPerformance(String(ordinal));receipt.fieldResult=s;receipt.navigationWarning=failedNavigation;await logState(`${ordinal}-field-result`);
    receipt.timing.returnAndManagementStartedMs=Date.now();
    await driver.press('r');await page.locator('#impact-result-panel').waitFor({timeout:12000});await page.waitForTimeout(400);receipt.afterReturn=await storage(`${ordinal}-returned`);await logState(`${ordinal}-return`);await driver.press('Escape');await page.waitForTimeout(350);
    const base=receipt.afterReturn.state;registerFresh(base);receipt.toolBudget=tactical.budgetStatus();receipt.freshAcquisitionOrder=[...freshOrder].map(([id,ordinal])=>({id,ordinal}));assert(base.inventory.run.baseSettled,'actual return must settle once');
    // Repair by genuine E/End/Enter. Choose most damaged visible-value module; input route uses native geometry.
    if(postReturnManagement&&normalManagement)await manageBase(receipt,ordinal);
    let repairState=base;for(let n=0;n<(normalManagement?0:naturalPreparation?3:1)&&repairState.kindlingReserve>0;n++){
      const module=[...repairState.modules].filter(m=>m.hp<(naturalPreparation?70:m.maxHp)).sort((a,b)=>a.hp-b.hp)[0];if(!module)break;
      const key=module.type.toLowerCase();await baseTo(key);await driver.press('e');await page.locator('#allocation-panel').waitFor({timeout:3000});
      if(naturalPreparation){const amount=Math.min(repairState.kindlingReserve,Math.ceil((70-module.hp)/4));await driver.press('Home');for(let k=0;k<amount;k++)await driver.press('ArrowRight',15);}else await driver.press('End');
      await driver.press('Enter');await page.waitForTimeout(850);receipt.afterRepair=await storage(`${ordinal}-repaired-${n+1}`);repairState=receipt.afterRepair.state;await logState(`${ordinal}-repair-${n+1}`);
    }
    if(postReturnManagement&&naturalPreparation){receipt.offered=await offerOwned();receipt.afterPreparation=await storage(`${ordinal}-after-preparation`);}
    previousTerminal=receipt.afterPreparation.state;receipt.boundedRoute={maxOuterDecisions:18,actualOuterDecisions:outerDecisions,geometryGoals:receipt.geometryGoals,deferred:[...retryRecords.values()]};
    receipt.timing.returnAndManagementWallMs=Date.now()-receipt.timing.returnAndManagementStartedMs;
    if(receipt.capture?.started)receipt.capture={...receipt.capture,...(await stopI14Capture(page,folder,ordinal)),endState:await driver.state()};
    receipt.status='completed-real-input';receipt.outcome=base.inventory.run.outcome;receipt.noStateInjection=!(fixedIdentity||caseWorld||controlledBuild);receipt.fixedDefectIdentity=!!fixedIdentity;receipt.consoleErrors=consoleMessages.filter(row=>row.type==='error');assert.deepEqual(errors,[]);assert.deepEqual(receipt.consoleErrors,[]);console.log(grade,ordinal,receipt.outcome,'searches',newlyCollectedNodeIds(receipt.entryState,receipt.fieldResult).length,'reserve',base.kindlingReserve);

   }catch(error){if(receipt.capture?.started)receipt.capture={...receipt.capture,partial:await stopI14Capture(page,folder,ordinal).catch(()=>null)};receipt.status='failed';receipt.failure=String(error);receipt.performance=await endPerformance(String(ordinal)).catch(()=>null);await captureRejected(String(ordinal));await page.screenshot({path:path.join(folder,`${ordinal}-failure.png`)}).catch(()=>{});console.error(grade,ordinal,error);process.exitCode=1;break;}finally{save();}
  }
 }finally{await context.storageState({path:path.join(folder,'browser-storage.json')});await context.close();}
}
try{for(const grade of grades)await runPolicy(grade);report.status=report.realJourneyAttempts.every(r=>r.status==='defect-not-reproduced')?'defect-not-reproduced':report.realJourneyAttempts.every(r=>r.status==='completed-real-input')?'completed-limited-real-input':'failed';}finally{save();await browser.close();}
