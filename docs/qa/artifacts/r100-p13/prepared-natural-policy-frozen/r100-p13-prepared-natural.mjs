/** Native-input journey diagnostic. Full-map read-only routing; no game state/clock setters.
 * Preparation alone is opened by its scene method (integration exception). Other actions are actual keys.
 * Ordinary mature fixtures exist only under QA_CONTROLLED_BUILD; natural policies never grant gear.
 * Run: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/world-study/r100-real-journeys.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createJourneyDriver } from '../qa/i27-journey-driver.mjs';
import { createVisibleEncounterPolicy } from './r100-p13-costed-encounters.mjs';
import { createLastLightMovementState, stepLastLightMovement, lastLightProjectedWalkingSpeed,
  canInteractLastLight, getLastLightInteractionDistance } from '../../src/systems/last-light-locomotion.ts';
import { LAST_LIGHT_STATIONS, LAST_LIGHT_WORLD_WALK_SPEED } from '../../src/systems/last-light-layout.ts';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-p13/natural');
const grades = (process.env.QA_GRADES ?? 'prepared-natural').split(',');
const rounds = Number(process.env.QA_RUNS ?? 30), limit = Number(process.env.QA_SEARCH_LIMIT ?? 12);
const ordinalStart=Number(process.env.QA_ORDINAL_START??1);
const fixedIdentity=process.env.QA_REPRO_IDENTITY_FILE?JSON.parse(fs.readFileSync(process.env.QA_REPRO_IDENTITY_FILE,'utf8')):null;
const controlledBuild=process.env.QA_CONTROLLED_BUILD??null,controlledWorld=process.env.QA_WORLD_ID??null;
assert(!controlledBuild&&!controlledWorld&&!fixedIdentity,'Prepared natural supply must not use controlled item, world or identity fixtures');
const branchSourcePath=process.env.QA_BASELINE_REPORT;
assert(branchSourcePath&&process.env.QA_STORAGE_STATE,'Prepared natural supply requires its actual mature source report and storage');
const branchSource=JSON.parse(fs.readFileSync(branchSourcePath,'utf8'));
const branchLast=branchSource.realJourneyAttempts.filter(row=>row.status==='completed-real-input').at(-1);
assert(branchLast?.afterPreparation?.state,'Mature branch source must have a completed actual preparation');
const naturalPreparation=true;
const offeringPreference='contaminant-first';
const observedWindows=true;
const normalManagement=true;
const searchChaosLimit=120, searchHealthLimit=30, returnChaosBudget=145;
const tacticalEnabled=true;
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { method: 'Actual keyboard movement, E search/extraction, R return and E/arrow/Enter repair. Full geometry is read for diagnostic routing. Preparation opens through the normal scene method. No field reward, HP, chaos, clock or position injection. Natural runs use normal world selection and owned gear; controlled build/world and fixed defect identity are explicit fixtures recorded below.',
  harnessSha256:createHash('sha256').update(fs.readFileSync(new URL(import.meta.url))).digest('hex'),
  harnessDependencies:['tools/world-study/r100-p13-costed-encounters.mjs','tools/qa/i27-journey-driver.mjs','src/systems/last-light-locomotion.ts','src/systems/last-light-layout.ts'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
  encounters:tacticalEnabled?'Current visible opponents/hosts and 5s last-seen memory; observed positions/facing, no hidden detection or patrol futures. Contextual known tools, evasion and guarded search.':'Original straight nearest-node policy with on-arrival tool keys',
  offeringPreference,normalManagement, policyRevision:6, strategy:'When entering severe, commit to one far physical region before search and choose only observed remains; low/medium use the disclosed full-map macro routing. Never inspect hidden content kind/tier/value to choose a route.', surveyKnowledge: 'Only paid, currently displayed six-second position snapshots; no enemy identity, facing or live positions beyond visibility.', searchChaosLimit, searchHealthLimit, returnChaosBudget,
  managementPolicy:'Keep core/purifier/storage at least 50, pay currently public growth with 2 kindling retained before storage100; afterward keep a recent actual maintenance reserve and invest current nodes. No unseen future item or growth reads.',
  observedWindowPolicy:observedWindows?'Permit a 28px body-supported short approach behind currently observed non-approaching enemies; reobserve every350ms. No AI state or future patrol access.':'No back-facing approach permission; original conservative rerouting retained.',
  branchSource:{report:branchSourcePath,sha256:createHash('sha256').update(fs.readFileSync(branchSourcePath)).digest('hex'),ordinal:branchLast.ordinal,cycle:branchLast.afterPreparation.state.cycle,sharedOrigin:true}, status: 'running', fixedDefectIdentity:fixedIdentity,controlledBuild,controlledWorld,
  diagnosticDisclosure:fixedIdentity||controlledWorld||controlledBuild?'Controlled world and/or ordinary mature two-tool fixture selected before departure; no field HP, loot, clock or position edits. Does not count as natural supply.':null, realJourneyAttempts: [], fullI03BuildMatrixComplete: false, i06NaturalSupplyComplete: false };
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
function selectNaturalGrade(policy, state, owned, prior) {
  const equipped = new Set(owned.equipment.toolIds.filter(Boolean));
  const usable = owned.items.filter(item => item.kind === 'contaminant' && item.canEquip && equipped.has(item.id));
  const active = usable.filter(item => item.toolSlots?.some(slot => slot === '0' || slot === '1'));
  const minHp = Math.min(...state.modules.map(module => module.hp));
  const lastDeath = prior.findLastIndex(run => run.outcome === 'death');
  const sinceDeath = lastDeath < 0 ? Infinity : prior.length - lastDeath - 1;
  const facts = { reserve: state.kindlingReserve, minimumModuleHp: minHp, equippedUsableTools: usable.length,
    equippedUsableActiveTools: active.length, turnsSinceDeath: Number.isFinite(sinceDeath) ? sinceDeath : null,
    tools: usable.map(item => ({ id:item.id, name:item.name, usesRemaining:item.usesRemaining })) };
  let grade = 'low', reason = '补充薪柴并等待真实供奉成熟';
  if(policy === 'prepared-natural'){
    if(sinceDeath>=2&&minHp>=50&&facts.reserve>=6&&active.length>=2){grade='severe';reason='真实成长及两件互补工具就绪，单向深入并留归途';}
    else if(sinceDeath>=1&&minHp>=45&&usable.length>=1){grade='medium';reason='先以现有工具补充收入和供给';}
  } else if(policy === 'low-growth'){ grade='low'; reason='低污染连续投入与补给';
  } else if(policy === 'medium-growth'){
    if(prior.length>=2&&minHp>=50&&usable.length>=1&&sinceDeath>=1){grade='medium';reason='已有真实成熟准备和可用据点，进入中污染积累';}
  } else if (policy === 'conservative') {
    if (sinceDeath >= 3 && minHp >= 50 && facts.reserve >= 8 && usable.length >= 1 && prior.length % 3 === 2) {
      grade='medium'; reason='维护和工具有余量，间隔尝试中污染';
    }
  } else if (policy === 'gradual') {
    if (sinceDeath >= 2 && minHp >= 50 && facts.reserve >= 6 && usable.length >= 2 && active.length >= 1) {
      grade='severe'; reason='维护有余量且已自然备妥两件可用工具';
    } else if (sinceDeath >= 2 && minHp >= 40 && facts.reserve >= 2 && usable.length >= 1) {
      grade='medium'; reason='已有成熟工具，先在中污染积累';
    }
  } else if (policy === 'repeat-risk') {
    if (sinceDeath >= 1 && minHp >= 35 && active.length >= 1) {
      grade='severe'; reason='已有可用主动工具，接受更高风险和较小维护余量';
    } else if (sinceDeath >= 1 && minHp >= 40 && (usable.length >= 1 || (prior.length >= 3 && facts.reserve >= 3))) {
      grade='medium'; reason='先进入中污染寻找下一份准备';
    }
  }
  return {grade,reason,facts};
}

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
 const policy=grade;
 const folder=path.join(out,grade);fs.mkdirSync(folder,{recursive:true}); const driver=createJourneyDriver(page,folder);
 const tactical=createVisibleEncounterPolicy(page,driver,ownedForPreparation,{observedWindows,visiblePollution:normalManagement});
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
   const active=()=>{const s=game.scene.getScene('RiftScene');return s?.scene.isActive()&&!s.runController.isRunEnded()?s:null;};
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
  if(!result)return null;result.referenceContext='Local macOS Chrome headless 1440x960, game logical 960x640; other QA browser/CPU tasks may run concurrently. CPU dispatch and queued render time are not GPU timing. Active scene/non-ended only; read-only scene snapshot after CPU timestamp.';
  result.meets60SecondDuration=result.activeSimulationMs>=60000;fs.writeFileSync(path.join(folder,`${label}-performance.json`),JSON.stringify(result,null,2));
  const{samples,...summary}=result;return summary;
 }
 async function logState(label){const value=await driver.snap(label);return value.state;}
 async function storage(label){const raw=await page.evaluate(()=>localStorage.getItem('coh-save-v1'));fs.writeFileSync(path.join(folder,`${label}.save.json`),raw??'null');return {sha256:createHash('sha256').update(raw??'').digest('hex'),state:JSON.parse(raw??'null')};}
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
   return{equipment:inventoryStore.getEquipment(),items:inventoryStore.getItems().map(item=>{const{icon,...facts}=projectInventoryItem(item,'prepare');return facts;})};
 });}
 async function equipOwned(){
   const owned=await ownedForPreparation(),changes=[];
   const weapon=owned.items.filter(item=>item.kind==='weapon'&&item.canEquip).sort((a,b)=>(b.qualityRank??0)-(a.qualityRank??0))[0];
   if(weapon&&weapon.id!==owned.equipment.weaponId){await page.locator(`[role="option"][data-item-id="${weapon.id}"]`).click();await page.getByRole('button',{name:'换到在手',exact:true}).click();changes.push({slot:'weapon',id:weapon.id});}
   if(controlledBuild){
    const definitions=controlledBuild==='resist-suppress'?['salted_vial','cold_ash_pipe']:['blind_needle_compass','split_tongue_bell'];
    for(let slot=0;slot<2;slot++){
     const id=`qa-build-${definitions[slot]}`;
     if(owned.equipment.toolIds[slot]===id)continue;
     await page.locator(`[role="option"][data-item-id="${id}"]`).click();
     await page.getByRole('button',{name:`装到 工具 ${slot===0?'Q':'F'}`,exact:true}).click();changes.push({slot:String(slot),id,controlledOrdinaryFixture:true});
    }
    const equipped=await ownedForPreparation();assert.deepEqual(equipped.equipment.toolIds.slice(0,2),definitions.map(id=>`qa-build-${id}`));
    driver.log({event:'actual-owned-equipment-inputs',changes});return changes;
   }
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
  for(const type of ['PURIFIER','CORE','STORAGE']){const m=current.modules.find(m=>m.type===type);if(m.hp<50)await repair(m,50);}
  const completedBefore=Object.values(current.growth.upgrades).reduce((sum,level)=>sum+level,0)+(current.moduleMaxHpTier??0);
  receipt.management={paidBill,investmentReserve:completedBefore<2?2:Math.max(4,paidBill),actions};
  if(current.modules.every(m=>m.hp>=50)&&current.kindlingReserve>receipt.management.investmentReserve){
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
    const knownContaminant=offeringPreference==='contaminant-first'?owned.items.filter(item=>item.kind==='contaminant'&&item.canOffer&&!offered.includes(item.id)).sort((a,b)=>normalManagement?publicOfferingReduction(b)-publicOfferingReduction(a):0)[0]:null;
    const tile=knownContaminant?page.locator(`#defense-panel .defense-equip-tile:not(.tile-disabled)[data-id="${knownContaminant.id}"]`):page.locator('#defense-panel .defense-equip-tile:not(.tile-disabled)').first();if(!await tile.count())break;
    offered.push(await tile.getAttribute('data-id'));await tile.click();await page.waitForTimeout(80);
   }
   await driver.press('Escape');await page.waitForTimeout(250);driver.log({event:'actual-offering-inputs',ids:offered});return offered;
 }
 async function useOwnedTools(label){
   const before=await ownedForPreparation();const ids=before.equipment.toolIds.slice(0,2);
   for(let i=0;i<ids.length;i++)if(ids[i])await driver.press(i===0?'q':'f');
   const after=await ownedForPreparation();driver.log({event:'actual-tool-keys',label,before:before.items.filter(item=>ids.includes(item.id)),after:after.items.filter(item=>ids.includes(item.id))});
 }
 try{
  await page.goto(process.env.GAME_URL??'http://127.0.0.1:3043/');await page.waitForFunction(()=>window.__game?.scene.isActive('MainMenuScene'));await page.waitForTimeout(350);await driver.press('Enter');await page.waitForFunction(()=>window.__game?.scene.isActive('PurificationScene'));await page.waitForTimeout(2200);
  if(controlledBuild){
   report.controlledBaseline=await storage('controlled-baseline-before-grants');save();
   assert(['resist-suppress','survey-lure'].includes(controlledBuild));
   const fixture=await page.evaluate(async build=>{
    const{inventoryStore}=await import('/src/systems/inventory-store.ts'),{createCatalogContaminant}=await import('/src/systems/contaminant-catalog.ts');
    const definitions=build==='resist-suppress'?['salted_vial','cold_ash_pipe']:['blind_needle_compass','split_tongue_bell'];
    const originalOffering=inventoryStore.getEquipment().defenseIds[0];
    const originalItem=originalOffering?inventoryStore.getItem(originalOffering):null;
    if(originalOffering){const result=inventoryStore.slotOffering(null,0);if(!result.ok)throw Error(JSON.stringify(result));}
    for(const definitionId of definitions){
     const item=createCatalogContaminant({id:`qa-build-${definitionId}`,definitionId,appearanceId:'wax_parcel',offeringProfileId:'resist_35',quality:'ordinary',acquiredOrdinal:0});
     for(const result of [inventoryStore.addContaminant(item),inventoryStore.slotOffering(item.id,0),inventoryStore.finishOfferingImpact([item.id],3,{},`qa-build:${definitionId}`)])if(!result.ok)throw Error(JSON.stringify(result));
    }
    if(originalOffering){const result=inventoryStore.slotOffering(originalOffering,0);if(!result.ok)throw Error(JSON.stringify(result));if(JSON.stringify(inventoryStore.getItem(originalOffering))!==JSON.stringify(originalItem))throw Error('Ordinary comparison fixture changed the original offering');}
    return inventoryStore.getState();
   },controlledBuild);fs.writeFileSync(path.join(folder,'controlled-build-fixture.json'),JSON.stringify(fixture,null,2));
  }
  for(let ordinal=ordinalStart;ordinal<ordinalStart+rounds;ordinal++){
   grade=['conservative','gradual','repeat-risk','low-growth','medium-growth','prepared-natural'].includes(policy)?'low':policy;
   const receipt={policy,grade,ordinal,entry:'production-prepare-scene-method',loadout:controlledBuild??'naturally-owned-baseline',status:'running',searches:[],errors};report.realJourneyAttempts.push(receipt);save();
   try{
    receipt.before=await storage(`${ordinal}-before`);
    if(ordinal===ordinalStart){
     for(const key of ['cycle','kindlingReserve','modules','growth','inventory','moduleMaxHpTier'])assert.deepEqual(receipt.before.state[key],branchLast.afterPreparation.state[key],`prepared natural branch preserves actual ${key}`);
     receipt.branchBaselineVerified=true;
    }
    await page.evaluate(()=>window.__game.scene.getScene('PurificationScene').enterRift());if(naturalPreparation)receipt.equipmentChanges=await equipOwned();
    if(['conservative','gradual','repeat-risk','low-growth','medium-growth','prepared-natural'].includes(policy)){
      receipt.gradeDecision=selectNaturalGrade(policy,receipt.before.state,await ownedForPreparation(),report.realJourneyAttempts.filter(run=>run!==receipt&&run.status==='completed-real-input'));
      grade=receipt.gradeDecision.grade;receipt.grade=grade;
    }
    await page.locator(`[data-departure-grade="${grade}"]`).click();
    const selectedIdentity=controlledWorld?await page.evaluate(async({worldId,seed,grade})=>{
      const{createR100ProductionRecipe}=await import('/src/generation/world-study/r100-package.ts'),{RiftGenerationClient}=await import('/src/generation/rift-generation-client.ts');
      const result=await new RiftGenerationClient().generate({kind:'departure',generation:createR100ProductionRecipe(worldId,seed,grade)});
      return{...result.identity,catalogVersion:'contaminant-v1',lootAlgorithmVersion:1,combatRulesVersion:2};
    },{worldId:controlledWorld,seed:Number(process.env.QA_SEED??20261004),grade}):fixedIdentity;
    if(selectedIdentity){await page.evaluate(async identity=>{
     const recovery=await import('/src/managers/rift-recovery.ts'),presentation=await import('/src/systems/r100-world-presentation.ts');
     recovery.installProceduralRiftRecovery();await recovery.prepareProceduralRecovery(identity);await presentation.prepareR100Presentation(identity.generation,{world:recovery.restoreProceduralWorld(identity)});
     const scene=window.__game.scene.getScene('PurificationScene');scene.productionDeparture=identity;recovery.withPreparedProceduralRecovery(identity,()=>scene.commitRiftDeparture());
    },selectedIdentity);}else await driver.press('Shift+Enter');
    await page.waitForFunction(()=>{const s=window.__game?.scene.getScene('RiftScene');return s?.scene.isActive()&&s.nativeWorldPresentation&&s.devRuntime&&s.player},{timeout:30000});tactical.reset();await startPerformance();await page.waitForTimeout(Number(process.env.QA_ENTRY_WAIT??600));
    const entry=await logState(`${ordinal}-entry`);receipt.entryState=entry;receipt.entrySave=await storage(`${ordinal}-entry`);
    receipt.identity=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('coh-save-v1'));return s.riftCheckpoint?.identity??s.riftDeparture?.identity;});
    assert.equal(receipt.identity.generation.package.grade,grade,'actual frozen grade matches the chosen grade');
    assert.equal(receipt.identity.generation.package.algorithmRevision,3,'P13 real journeys require new revision3');
    assert.equal(receipt.identity.generation.contentDefinition.version,2,'P13 content definition must be current frozen v2');
    if(controlledWorld)assert.equal(receipt.identity.generation.package.id,`r100-${controlledWorld}`,'actual frozen world matches the controlled case');
    if(process.env.QA_REPLAY_INPUTS){
      assert(fixedIdentity,'input replay is a separately disclosed fixed defect case');
      const records=fs.readFileSync(process.env.QA_REPLAY_INPUTS,'utf8').trim().split('\n').map(line=>JSON.parse(line));
      const start=records.findIndex(row=>row.label==='1-entry');assert(start>=0);
      for(const row of records.slice(start+1)){
       if(row.event==='hold')await driver.hold(row.keys,row.ms);
       else if(row.event==='key')await driver.press(row.key,row.delay);
       else if(row.event==='snapshot')await logState(`replay-${row.label}`);
       const current=await driver.state();if(current.paused)throw Error('Replayed real inputs reached the blocked runtime');
      }
      await captureRejected(`${ordinal}-final-readonly`);receipt.status='defect-not-reproduced';receipt.finalState=await driver.state();
      continue;
    }
    let failedNavigation=null;const deferredTargets=new Set();
    if(grade==='severe'){
     const explorationGoal=await farGeometryGoal();receipt.explorationGoal=explorationGoal;
     const exploration=await goRift([explorationGoal]);receipt.exploration={ended:exploration.ended,abandoned:exploration.abandoned,reason:exploration.reason,state:exploration.state};
     await tactical.observe();await logState(`${ordinal}-far-exploration`);
    }
    for(let n=0;n<(tacticalEnabled?limit+6:limit);n++){
     const s=await driver.state();if(s.ended||s.chaos>=searchChaosLimit||s.hp<=searchHealthLimit)break;
     if(tacticalEnabled){
      const retreat=await riftPlan([{id:'exit',pos:s.exit.position}]);let routeLength=0;for(let i=1;i<retreat.points.length;i++)routeLength+=Math.hypot(retreat.points[i].x-retreat.points[i-1].x,retreat.points[i].y-retreat.points[i-1].y);
      const observedRate=Math.max(grade==='severe'?.64:grade==='medium'?.42:.24,(s.chaos-entry.chaos)/Math.max(1,(s.elapsedMs-entry.elapsedMs)/1000));
      const reserve=10+(routeLength/60+4)*observedRate;
      driver.log({event:'known-return-budget',chaos:s.chaos,routeLength,observedRate,reservedChaos:reserve});
      if(s.chaos+reserve>=returnChaosBudget){driver.log({event:'return-with-reserve',reason:'observed-chaos-and-known-return-distance'});break;}
     }
     await tactical.observe();
     const observed=new Map(tactical.knownSearches().map(n=>[n.id,n]));
     const targets=s.nodes.filter(x=>!x.collected&&!deferredTargets.has(x.id)&&(grade!=='severe'||(observed.has(x.id)&&Math.hypot(x.pos.x-entry.pos.x,x.pos.y-entry.pos.y)>240)));
     if(!targets.length)break;
     try{const travel=await goRift(targets);if(travel.ended)break;if(travel.abandoned){driver.log({event:'abandoned-observed-approach',reason:travel.reason,target:travel.target});if(travel.target?.id)deferredTargets.add(travel.target.id);if(travel.reason==='return-reserve-threshold')break;continue;}
      let searchDecision=null;if(tacticalEnabled)searchDecision=await tactical.search(travel.target);else{if(naturalPreparation&&travel.target.tier!=='safe')await useOwnedTools(`before-${travel.target.id}`);await driver.hold(['e'],1450);}
      const after=await driver.state();const collected=after.nodes.find(x=>x.id===travel.target.id)?.collected;
      receipt.searches.push({searchDecision,id:travel.target.id,kind:travel.target.kind,tier:travel.target.tier,collected,hp:after.hp,chaos:after.chaos,carried:after.carried,elapsedMs:after.elapsedMs});await logState(`${ordinal}-search-${n+1}`);if(!collected){if(tacticalEnabled){deferredTargets.add(travel.target.id);await tactical.evade(travel.target,await tactical.observe());continue;}break;}
     }catch(e){failedNavigation=String(e);break;}
    }
    let s=await driver.state();if(!s.ended){const travel=await goRift([{id:'exit',pos:s.exit.position}]);if(!travel.ended){await driver.press('e');await page.waitForTimeout(650);}}
    s=await driver.state();assert(s.ended,'real extraction/death must end the run');receipt.performance=await endPerformance(String(ordinal));receipt.fieldResult=s;receipt.navigationWarning=failedNavigation;await logState(`${ordinal}-field-result`);
    await driver.press('r');await page.locator('#impact-result-panel').waitFor({timeout:12000});await page.waitForTimeout(400);receipt.afterReturn=await storage(`${ordinal}-returned`);await logState(`${ordinal}-return`);await driver.press('Escape');await page.waitForTimeout(350);
    const base=receipt.afterReturn.state;assert(base.inventory.run.baseSettled,'actual return must settle once');
    // Repair by genuine E/End/Enter. Choose most damaged visible-value module; input route uses native geometry.
    if(normalManagement)await manageBase(receipt,ordinal);
    let repairState=base;for(let n=0;n<(normalManagement?0:naturalPreparation?3:1)&&repairState.kindlingReserve>0;n++){
      const module=[...repairState.modules].filter(m=>m.hp<(naturalPreparation?70:m.maxHp)).sort((a,b)=>a.hp-b.hp)[0];if(!module)break;
      const key=module.type.toLowerCase();await baseTo(key);await driver.press('e');await page.locator('#allocation-panel').waitFor({timeout:3000});
      if(naturalPreparation){const amount=Math.min(repairState.kindlingReserve,Math.ceil((70-module.hp)/4));await driver.press('Home');for(let k=0;k<amount;k++)await driver.press('ArrowRight',15);}else await driver.press('End');
      await driver.press('Enter');await page.waitForTimeout(850);receipt.afterRepair=await storage(`${ordinal}-repaired-${n+1}`);repairState=receipt.afterRepair.state;await logState(`${ordinal}-repair-${n+1}`);
    }
    if(naturalPreparation){receipt.offered=await offerOwned();receipt.afterPreparation=await storage(`${ordinal}-after-preparation`);}
    receipt.status='completed-real-input';receipt.outcome=base.inventory.run.outcome;receipt.noStateInjection=!(fixedIdentity||controlledWorld||controlledBuild);receipt.fixedDefectIdentity=!!fixedIdentity;receipt.consoleErrors=consoleMessages.filter(row=>row.type==='error');assert.deepEqual(errors,[]);assert.deepEqual(receipt.consoleErrors,[]);console.log(grade,ordinal,receipt.outcome,'searches',receipt.searches.filter(x=>x.collected).length,'reserve',base.kindlingReserve);
   }catch(error){receipt.status='failed';receipt.failure=String(error);receipt.performance=await endPerformance(String(ordinal)).catch(()=>null);await captureRejected(String(ordinal));await page.screenshot({path:path.join(folder,`${ordinal}-failure.png`)}).catch(()=>{});console.error(grade,ordinal,error);process.exitCode=1;break;}finally{save();}
  }
 }finally{await context.storageState({path:path.join(folder,'browser-storage.json')});await context.close();}
}
try{for(const grade of grades)await runPolicy(grade);report.status=report.realJourneyAttempts.every(r=>r.status==='defect-not-reproduced')?'defect-not-reproduced':report.realJourneyAttempts.every(r=>r.status==='completed-real-input')?'completed-limited-real-input':'failed';}finally{save();await browser.close();}
