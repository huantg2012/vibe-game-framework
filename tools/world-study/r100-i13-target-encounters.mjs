// Independent target-aligned controller; frozen pursuit parent is preserved.
import assert from 'node:assert/strict';
import { activeToolSlots } from '../qa/r100-i09-tool-slots.mjs';
import {publicAbility,budgetPermission} from './r100-i13-continuation-policy.mjs';
import {shortLeg,blocksLeg} from './r100-i13-pursuit-policy.mjs';
import {nearestPredictedTarget,nearestBlockingTurnCandidate,selectedControlAdmission,liveOwnControls,controlRolePermission} from './r100-i13-target-policy.mjs';

/** Only completion flags and IDs are consumed, never unrevealed loot contents. */
export function newlyCollectedNodeIds(before, after) {
 const initial = new Map(before.nodes.map(node => [node.id, node.collected]));
 assert.equal(initial.size, before.nodes.length, 'Unique initial search nodes required');
 assert.equal(new Set(after.nodes.map(node => node.id)).size, after.nodes.length, 'Unique current search nodes required');
 return after.nodes.filter(node => initial.get(node.id) === false && node.collected === true).map(node => node.id);
}
/** QA input policy: observations expose only currently rendered opponents/hosts.
 * Full geometry may be used by caller for route planning; hidden AI state,
 * detection meters, patrol futures and unrevealed item identities are never read.
 */
export function createVisibleEncounterPolicy(page,driver,ownedForPreparation,options={}){
 const observedWindows=options.observedWindows===true,visiblePollution=options.visiblePollution===true;
 const ownControls=new Map(),controlRoles=new Map(),publicControlUnavailableUntil=new Map();let liveControls=[];
 const slotSpend=new Map(),dashWindows=[];let tripBudget={normalPerSlot:1},lastBudgetFacts=null;
 function setBudget(value){tripBudget=value;slotSpend.clear();}
 function budgetStatus(){return{policy:tripBudget,slots:[...slotSpend].map(([slot,used])=>({slot,used})),dashWindows:[...dashWindows],controlRoles:[...controlRoles].map(([role,used])=>({role,used}))};}
 async function refreshOwnControls(){
  if(!ownControls.size){liveControls=[];return;}
  const actual=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');if(s.runController.isRunEnded())return[];return(s.toolSystem.exportRuntimeState().catalog?.effects??[]).filter(e=>e.resolvedParams.familyId==='solidify').map(e=>({effectId:e.effectId,sourceInstanceId:e.sourceInstanceId,targetId:e.targetId,controlActive:e.controlActive,remainingTime:e.remainingTime,startTime:e.startTime}));});
  const before=liveControls;liveControls=liveOwnControls(ownControls,actual);
  for(const [id,record] of ownControls)if(!liveControls.some(effect=>effect.effectId===id)){ownControls.delete(id);publicControlUnavailableUntil.set(record.targetId,clockMs+2000);driver.log({event:'own-control-permit-revoked',record,actual,reason:'actual-control-expired-or-broken',publicProtectionUntil:clockMs+2000});}
  if(before.length!==liveControls.length)driver.log({event:'own-control-permit-state',actual:liveControls});
 }
 async function controlledMove(point,keys,requestedMs){
  if(!ownControls.size)return{handled:false};
  const facts=await observe();if(!liveControls.length)return{handled:false};
  const leg=shortLeg(facts.position,point,24);if(!leg)return{handled:true,moved:false};
  const visible=await page.evaluate(leg=>{const s=window.__game.scene.getScene('RiftScene');return[0,.5,1].every(t=>s.visibilityAt({x:leg.start.x+(leg.end.x-leg.start.x)*t,y:leg.start.y+(leg.end.y-leg.start.y)*t})>0);},leg);
  if(!visible||facts.enemies.some(enemy=>blocksLeg(enemy,leg)||((enemy.attack==='windup'||enemy.attack==='active')&&distance(enemy.position,facts.position)<110))){driver.log({event:'own-control-short-leg-rejected',leg,visible,otherVisibleEnemies:facts.enemies,actual:liveControls});return{handled:true,reroute:true};}
  const speed=await page.evaluate(()=>window.__game.scene.getScene('RiftScene').player.getEffectiveSpeed());
  const ms=Math.min(requestedMs,140,24/Math.max(1,speed)*1000,Math.min(...liveControls.map(effect=>effect.remainingTime))-20);if(ms<16)return{handled:true,reroute:true};const paid=structuredClone(liveControls),before=await driver.state();
  await driver.hold(keys,ms);const after=await driver.state();await observe();
  driver.log({event:'own-control-actual-short-leg',keys,ms,leg,before:{position:before.pos,hp:before.hp,elapsedMs:before.elapsedMs},after:{position:after.pos,hp:after.hp,elapsedMs:after.elapsedMs},distance:distance(before.pos,after.pos),paidAtInput:paid,paidAfter:liveControls,otherThreatsRetained:facts.enemies});
  return{handled:true,moved:true};
 }
 async function surveyCandidates(){
  const facts=await observe();
  if(facts.ended)return {facts,candidates:[]};
  const visibleIds=new Set(facts.enemies.map(enemy=>enemy.id));
  const lost=[...memory.values()].filter(enemy=>!visibleIds.has(enemy.id)&&facts.elapsedMs-enemy.seen<=5000);
  const admitted=lost.length?await page.evaluate(async({origin,candidates})=>{
   const scene=window.__game.scene.getScene('RiftScene');
   const {collectToolRevealSnapshot}=await import('/src/systems/tool-targeting.ts');
   return candidates.filter(candidate=>collectToolRevealSnapshot(origin,128,scene.formFloorGrid,[candidate.position],[],undefined,scene.nativeBody??undefined).enemyPositions.length>0).map(candidate=>candidate.id);
  },{origin:facts.position,candidates:lost}):[];
  return{facts,candidates:lost.filter(candidate=>admitted.includes(candidate.id))};
 }
 async function useSurvey(candidates,decision){
  driver.log({event:'survey-decision-before',candidates,decision,restriction:'Only previous normal observations, current visibility and disclosed static geometry'});
  if(!await useKnown(item=>publicAbility(item)?.family==='survey','memory-changes-next-route',null,20000))return null;
  const facts=await observe(),shown=facts.displayedSurvey;
  if(!shown?.snapshot)return null;
  const forgotten=[];
  for(const candidate of candidates){if(memory.delete(candidate.id))forgotten.push(candidate.id);}
  const novelty=await page.evaluate(snapshot=>{
   const scene=window.__game.scene.getScene('RiftScene');
   return Object.fromEntries(['enemyPositions','nodePositions','corePositions'].map(key=>[key,(snapshot[key]??[]).filter(position=>scene.visibilityAt(position)===0)]));
  },shown.snapshot);
  const result={shown,novelty,forgotten,negativeEnemyAnswer:shown.snapshot.enemyPositions.length===0,position:facts.position,elapsedMs:facts.elapsedMs};
  driver.log({event:'survey-public-output',...result,restriction:'Only static paid coordinates, no hidden identity/content or live follow-up'});
  return result;
 }
 const pollutionMemory=new Map(),surveyMemory=new Map(),knownSearches=new Map(),ownSuppressions=new Map();
 const memory=new Map(),toolTimes=new Map(),closeSince=new Map(),luredEnemies=new Map(),stoppedUntil=new Map(),windowPermits=new Map();let lastLook=0,lastSwing=-Infinity,clockMs=0,lastMoveCheck=-Infinity,lurePass=null;
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const facingPlayer=(enemy,position)=>Math.cos(Math.atan2(position.y-enemy.position.y,position.x-enemy.position.x)-enemy.facing)>.35;
 async function observe(){
  const facts=await page.evaluate(async ({visiblePollution,ownSuppressions})=>{
   const s=window.__game.scene.getScene('RiftScene');
   const enemies=s.ai.getEnemies().filter(e=>s.combat.isEnemyAlive(e.getId())&&s.visibilityAt(e.getPosition())>.03).map(e=>({id:e.getId(),position:{...e.getPosition()},facing:e.getFacingAngle(),attack:s.combat.getEnemyAttackVisualState(e.getId()).phase}));
   const hosts=s.hosts.getSubjects().filter(h=>s.visibilityAt(h.position)>.03).map(h=>({id:h.id,position:{...h.position},occupancy:h.form.occupancy}));
   const visibleCells=[];if(visiblePollution){
    const {sampleVolumeDensity}=await import('/src/systems/volume-presence.ts');
    const player=s.player.getPosition(),subjects=s.hosts.getSubjects();
    // Match only currently rendered green floor/air. Visibility is tested before
    // any surface sample; neither hazard timers nor future Host phases are read.
    const suppressed=new Set(ownSuppressions.filter(row=>row.until>s.runController.getElapsedMs()).map(row=>row.id));
    const volumes=subjects.filter(h=>!suppressed.has(h.id)).map(h=>s.hosts.getVolumePresenceFrame(h.id)).filter(f=>f?.hasPresence);
    for(let y=Math.floor((player.y-200)/16)*16+8;y<=player.y+200;y+=16)for(let x=Math.floor((player.x-200)/16)*16+8;x<=player.x+200;x+=16){
     if(s.visibilityAt({x,y})<=.03)continue;
     const paint=subjects.some(h=>!suppressed.has(h.id)&&s.hosts.isPaintFloorActive(h.id,Math.floor(x/32),Math.floor(y/32)));
     const air=volumes.some(f=>sampleVolumeDensity(f,x,y)>=.22);
     visibleCells.push({x,y,paint,air});
    }
   }
   return {visibleSearches:s.search.nodes.filter(n=>!n.collected&&s.visibilityAt(n.position)>.03).map(n=>({id:n.id,pos:{...n.position}})),visibleCells,position:{...s.player.getPosition()},facing:s.player.getFacingAngle(),hp:s.combat.getHealth(),chaos:s.chaos.getValue(),elapsedMs:s.runController.getElapsedMs(),ended:s.runController.isRunEnded(),enemies,hosts};
  },{visiblePollution,ownSuppressions:[...ownSuppressions].map(([id,until])=>({id,until}))});
  clockMs=facts.elapsedMs;lastBudgetFacts=facts;
  if(facts.ended){surveyMemory.clear();facts.remembered=[];driver.log({event:'visible-encounter-observation',...facts});return facts;}
  for(const node of facts.visibleSearches)knownSearches.set(node.id,node);
  // These are the positions actually displayed by a paid survey, fixed at cast
  // time. Never refresh them from hidden live subjects or inspect their IDs.
  const surveyRead=await page.evaluate(()=>{
   const s=window.__game.scene.getScene('RiftScene');
   // Settlement can happen between the preceding observation and this callback.
   // Ended runs intentionally no longer own recoverable active tool inventory.
   if(s.runController.isRunEnded())return {ended:true,shown:null};
   const effect=s.toolSystem.exportRuntimeState().catalog?.effects.find(e=>e.resolvedParams.familyId==='survey'&&e.remainingTime>0);
   return {ended:false,shown:effect?{cast:effect.startTime,remainingMs:effect.remainingTime,snapshot:effect.snapshot}:null};
  });
  surveyMemory.clear();
  if(surveyRead.ended){facts.ended=true;facts.remembered=[];driver.log({event:'visible-encounter-observation',...facts});return facts;}
  const shown=surveyRead.shown;
  if(shown?.snapshot){
   shown.snapshot.enemyPositions.forEach((position,index)=>surveyMemory.set(`shown-survey:${shown.cast}:${index}`,{id:`shown-survey:${shown.cast}:${index}`,position:{...position},facing:NaN,seen:clockMs,source:'paid-static-survey',expiresMs:clockMs+shown.remainingMs}));
   facts.displayedSurvey=shown;
  }
  if(visiblePollution){for(const cell of facts.visibleCells){const key=`${Math.floor(cell.x/16)}:${Math.floor(cell.y/16)}`;if(cell.paint||cell.air)pollutionMemory.set(key,{...cell,seen:clockMs});else pollutionMemory.delete(key);}
   for(const[key,cell]of pollutionMemory)if(clockMs-cell.seen>(cell.paint?30000:1200))pollutionMemory.delete(key);
   facts.visiblePollutionCells=facts.visibleCells.filter(c=>c.paint||c.air);delete facts.visibleCells;
  }
  for(const e of facts.enemies){
   const previous=memory.get(e.id);e.approaching=!!previous&&((e.position.x-previous.position.x)*(facts.position.x-e.position.x)+(e.position.y-previous.position.y)*(facts.position.y-e.position.y)>12);
   if(distance(e.position,facts.position)<100&&!closeSince.has(e.id))closeSince.set(e.id,facts.elapsedMs);
   if(distance(e.position,facts.position)>145)closeSince.delete(e.id);
   memory.set(e.id,{...e,seen: facts.elapsedMs});
  }
  for(const[id,e]of memory)if(facts.elapsedMs-e.seen>5000){memory.delete(id);closeSince.delete(id);}
  facts.remembered=[...memory.values()];await refreshOwnControls();facts.normalVisibleEnemies=facts.enemies;facts.ownPaidControls=structuredClone(liveControls);facts.enemies=facts.enemies.filter(enemy=>!liveControls.some(effect=>effect.targetId===enemy.id));driver.log({event:'visible-encounter-observation',...facts});return facts;
 }
 async function geometry(){return page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene'),g=s.formFloorGrid;return {cols:g.cols,rows:g.rows,size:g.tileSize,walk:Array.from({length:g.cols*g.rows},(_,i)=>g.isWalkable(i%g.cols,Math.floor(i/g.cols)))};});}
 function clearSegment(grid,a,b){const floor=(x,y)=>{const col=Math.floor(x/grid.size),row=Math.floor(y/grid.size);return col>=0&&row>=0&&col<grid.cols&&row<grid.rows&&grid.walk[row*grid.cols+col]};for(let t=0,n=Math.ceil(distance(a,b)/3);t<=n;t++){const p={x:a.x+(b.x-a.x)*t/(n||1),y:a.y+(b.y-a.y)*t/(n||1)};for(const dx of [-11,11])for(const dy of [-11,11])if(!floor(p.x+dx,p.y+dy))return false;}return true;}
 async function face(point,ms=65){const s=await driver.state(),dx=point.x-s.pos.x,dy=point.y-s.pos.y,keys=[];if(Math.abs(dx)>.42*Math.abs(dy))keys.push(dx>0?'d':'a');if(Math.abs(dy)>.42*Math.abs(dx))keys.push(dy>0?'s':'w');if(keys.length){const controlled=await controlledMove(point,keys,ms);if(!controlled.handled)await driver.hold(keys,ms);}}
 async function useKnown(predicate,label,facePoint,cooldownMs,controlIntent=null){
  const owned=await ownedForPreparation(),s=await driver.state();
  for(const slot of activeToolSlots(owned)){
   const item=owned.items.find(item=>item.id===owned.equipment.toolIds[slot.index]&&item.canEquip);if(!item||!predicate(item))continue;
   if(s.elapsedMs-(toolTimes.get(item.id)??-Infinity)<cooldownMs)continue;
   const family=publicAbility(item)?.family??'other',spent=slotSpend.get(slot.index)??0;
   if(family==='solidify'&&!controlRolePermission(controlRoles,controlIntent?.role)){driver.log({event:'control-role-budget-reserved',label,controlIntent,roles:[...controlRoles]});continue;}
   let currentFacts=await observe();
   const minimum=tripBudget.minimumPower?.[family]??0;
   const nextReady=(item.usesRemaining??0)-1>=2||owned.items.some(other=>other.id!==item.id&&other.canEquip&&(other.usesRemaining??0)>=2&&publicAbility(other)?.family===family&&(publicAbility(other)?.power??0)>=minimum);
   const permission=budgetPermission({used:spent,cap:family==='solidify'?(tripBudget.controlMaxPerTrip??2):(tripBudget.normalPerSlot??1),family,facts:currentFacts,nextReady:tripBudget.protectNextPreparation?nextReady:true});
   if(!permission.allowed){driver.log({event:'tool-budget-reserved',slot:slot.index,itemId:item.id,family,spent,permission,policy:tripBudget});continue;}
   if(family==='solidify'){
    const beforeTurn=currentFacts;
    if(facePoint)await face(facePoint);
    currentFacts=await observe();
    const visibility=await page.evaluate(async({origin,enemies})=>{
     const scene=window.__game.scene.getScene('RiftScene');
     const {hasLineOfSight}=await import('/src/utils/grid-raycast.ts');
     const sight=scene.nativeWorldPresentation?.world.sight;
     // Evaluate geometry only at coordinates from current normal observations.
     return enemies.map(enemy=>({id:enemy.id,visible:scene.visibilityAt(enemy.position)>0,lineOfSight:!!sight&&hasLineOfSight(sight,origin,enemy.position)}));
    },{origin:currentFacts.position,enemies:currentFacts.enemies});
    const selected=nearestPredictedTarget(currentFacts,visibility,publicControlUnavailableUntil);
    const admission=selectedControlAdmission(currentFacts,controlIntent.point,controlIntent.role,selected);
    if(admission.allowed&&controlIntent.role==='transit'){
     const leg=admission.leg;
     const shown=await page.evaluate(leg=>{const scene=window.__game.scene.getScene('RiftScene');return[0,.5,1].every(t=>scene.visibilityAt({x:leg.start.x+(leg.end.x-leg.start.x)*t,y:leg.start.y+(leg.end.y-leg.start.y)*t})>0);},leg);
     if(!shown||!clearSegment(await geometry(),leg.start,leg.end)){admission.allowed=false;admission.reason='turned-short-leg-not-currently-visible-and-body-clear';}
    }
    if(controlIntent.role==='search'&&distance(currentFacts.position,controlIntent.point)>65){admission.allowed=false;admission.reason='turned-outside-search-window';}
    driver.log({event:'formal-public-target-admission',label,beforeTurn,afterTurn:currentFacts,visibility,publicUnavailable:[...publicControlUnavailableUntil],requested:controlIntent,selected,admission,restriction:'Normal observations and static LOS only; alternate facing requires actual preceding input. Unknown control eligibility remains authoritative at cast.'});
    if(!admission.allowed)continue;
    controlIntent={...controlIntent,targetId:selected.id,leg:admission.leg};
   }else if(facePoint)await face(facePoint);
   const inputBefore=await driver.state();await driver.press(slot.key.toLowerCase());
   const after=await ownedForPreparation(),next=after.items.find(candidate=>candidate.id===item.id);
   const used=(item.usesRemaining??0)-(next?.usesRemaining??0);toolTimes.set(item.id,s.elapsedMs);
   if(used>0)slotSpend.set(slot.index,spent+used);
   if(used>0&&family==='solidify'){
    controlRoles.set(controlIntent.role,(controlRoles.get(controlIntent.role)??0)+used);
    const actual=await page.evaluate(sourceInstanceId=>{const s=window.__game.scene.getScene('RiftScene');return(s.toolSystem.exportRuntimeState().catalog?.effects??[]).filter(e=>e.sourceInstanceId===sourceInstanceId&&e.resolvedParams.familyId==='solidify').map(e=>({effectId:e.effectId,sourceInstanceId:e.sourceInstanceId,targetId:e.targetId,controlActive:e.controlActive,remainingTime:e.remainingTime,startTime:e.startTime}));},item.id);
    const valid=actual.filter(effect=>effect.targetId===controlIntent.targetId&&effect.controlActive&&effect.remainingTime>0&&(currentFacts.normalVisibleEnemies??currentFacts.enemies).some(enemy=>enemy.id===effect.targetId));
    for(const effect of valid)ownControls.set(effect.effectId,{...effect,role:controlIntent.role});
    await refreshOwnControls();driver.log({event:'paid-solidify-role-window',controlIntent,sourceInstanceId:item.id,actual,accepted:valid,roles:[...controlRoles],beforeObservation:currentFacts});
   }
   if(used>0&&family==='dash'){await page.waitForTimeout(220);const inputAfter=await driver.state();const window={itemId:item.id,family,from:inputBefore.pos,to:inputAfter.pos,distance:distance(inputBefore.pos,inputAfter.pos),beforeHp:inputBefore.hp,afterHp:inputAfter.hp,elapsedBefore:inputBefore.elapsedMs,elapsedAfter:inputAfter.elapsedMs,visiblePressure:currentFacts.enemies,permission};dashWindows.push(window);driver.log({event:'paid-dash-actual-window',...window});}
   driver.log({event:'tool-budget-actual',slot:slot.index,itemId:item.id,family,used,total:slotSpend.get(slot.index)??0,permission,policy:tripBudget});
   if(used>0&&/罗盘|探查/.test(item.name+' '+item.description))await driver.snap(`survey-${Math.round(s.elapsedMs)}`);
   driver.log({event:'known-tool-context-input',label,slot:slot.index,key:slot.key,item:{id:item.id,name:item.name,description:item.description,uses:item.usesRemaining},remaining:next?.usesRemaining??0,used,facePoint});return used>0;
  }return false;
 }
 async function prepare(target){
  const facts=await observe();if(facts.ended)return facts;
  if(target.id!=='exit'&&(distance(facts.position,target.pos)<190||target.id==='geometry-exploration')&&(facts.enemies.length||facts.hosts.length||facts.chaos>=35)){
   await useKnown(item=>/抗污|药瓶/.test(item.name+' '+item.description),'before-exposed-approach',null,30000);

  }
  return facts;
 }
 async function beforeMove(point,target){
  const state=await driver.state();if(state.elapsedMs-lastMoveCheck<400||target.id==='exit')return;lastMoveCheck=state.elapsedMs;
  const owned=await ownedForPreparation();if(!owned.items.some(item=>activeToolSlots(owned).some(slot=>owned.equipment.toolIds[slot.index]===item.id)&&item.canEquip&&/压制|烟斗|压住.*污染源/.test(item.name+' '+item.description)))return;
  const facts=await observe(),length=distance(facts.position,point);if(length<1)return;
  const end={x:facts.position.x+(point.x-facts.position.x)/length*Math.min(36,length),y:facts.position.y+(point.y-facts.position.y)/length*Math.min(36,length)};
  const green=facts.visiblePollutionCells?.filter(cell=>[0,.5,1].some(t=>distance(cell,{x:facts.position.x+(end.x-facts.position.x)*t,y:facts.position.y+(end.y-facts.position.y)*t})<20))??[];
  if(!green.length)return;
  const host=facts.hosts.filter(h=>distance(h.position,facts.position)<115&&green.some(c=>(h.occupancy==='paint'?c.paint:c.air)&&distance(h.position,c)<100)).sort((a,b)=>distance(a.position,facts.position)-distance(b.position,facts.position))[0];
  if(host&&await useKnown(item=>/压制|烟斗|压住.*污染源/.test(item.name+' '+item.description),'imminent-visible-green-crossing',host.position,3500)){
   const actualOwn=await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');if(s.runController.isRunEnded())return [];return s.toolSystem.exportRuntimeState().catalog?.effects.filter(e=>e.resolvedParams.familyId==='suppress').map(e=>({id:e.targetId,until:e.startTime+e.resolvedParams.durationMs}))??[];});
   for(const own of actualOwn)if(facts.hosts.some(h=>h.id===own.id))ownSuppressions.set(own.id,own.until);
   driver.log({event:'suppression-crossing-commit',host,from:facts.position,to:end,observedGreen:green,ownPaidSuppression:actualOwn});
   await observe();
  }
 }
 async function lure(target,facts){
  if(!facts.enemies.length||facts.enemies.some(e=>distance(e.position,facts.position)<80&&facingPlayer(e,facts.position)))return false;
  if(facts.enemies.every(e=>facts.elapsedMs-(luredEnemies.get(e.id)??-Infinity)<12000))return false;
  const owned=await ownedForPreparation();if(!owned.items.some(item=>activeToolSlots(owned).some(slot=>owned.equipment.toolIds[slot.index]===item.id)&&item.canEquip&&/声诱|铜铃|声音.*引|引.*声音/.test(item.name+' '+item.description)))return false;
  const grid=await geometry(),points=[];
  for(let i=0;i<8;i++){const a=i*Math.PI/4,p={x:facts.position.x+Math.cos(a)*88,y:facts.position.y+Math.sin(a)*88};if(!clearSegment(grid,facts.position,p))continue;
   const nearest=Math.min(...facts.enemies.map(e=>distance(e.position,p)));if(nearest>94||distance(p,target.pos)<75)continue;
   points.push({p,score:distance(p,target.pos)-nearest*.5});}
  points.sort((a,b)=>b.score-a.score);if(!points.length)return false;
  const used=await useKnown(item=>/声诱|铜铃|声音.*引|引.*声音/.test(item.name+' '+item.description),'throw-away-from-search-seat',points[0].p,4500);
  if(used){for(const enemy of facts.enemies)luredEnemies.set(enemy.id,facts.elapsedMs);lurePass={until:facts.elapsedMs+3300,point:points[0].p,targetId:target.id};await page.waitForTimeout(350);await observe();}return used;
 }
 async function evade(target,facts){
  const opponents=facts.enemies.length?facts.enemies:facts.remembered;if(!opponents.length)return false;
  const nearest=[...opponents].sort((a,b)=>distance(a.position,facts.position)-distance(b.position,facts.position))[0];
  const grid=await geometry(),candidates=[];
  for(let i=0;i<16;i++){const a=i*Math.PI/8,p={x:facts.position.x+Math.cos(a)*54,y:facts.position.y+Math.sin(a)*54};if(!clearSegment(grid,facts.position,p))continue;
   const min=Math.min(...opponents.map(e=>distance(e.position,p))),current=Math.min(...opponents.map(e=>distance(e.position,facts.position)));
   candidates.push({p,score:(min-current)*3-distance(p,target.pos)*.04});}
  candidates.sort((a,b)=>b.score-a.score);
  if(!candidates.length){
   if(!liveControls.length&&facts.enemies.some(e=>distance(e.position,facts.position)<40)){await face(nearest.position,40);await driver.press('Space',60);driver.log({event:'cornered-defensive-swing'});}
   return false;
  }
  const p=candidates[0].p;
  await useKnown(item=>/假身|敌移速|绊停/.test(item.description),'break-visible-pursuit',nearest.position,8000);
  await face(p,430);
  if(facts.enemies.some(e=>distance(e.position,facts.position)<65))await useKnown(item=>/短冲/.test(item.description),'leave-visible-attack-range',p,3000);
  const now=await driver.state();if(now.ended)return true;
  // Look back with a real short movement, not a facing or camera setter.
  await face(nearest.position,55);await observe();return true;
 }
 async function allowObservedWindow(target,facts){
  if(!observedWindows||target.id==='exit')return false;
  const close=facts.enemies.filter(e=>distance(e.position,facts.position)<175);
  if(!close.length||close.some(e=>e.approaching||e.attack==='windup'||e.attack==='active'||distance(e.position,facts.position)<66))return false;
  const length=distance(facts.position,target.pos);if(length<1)return false;
  const step=Math.min(28,length),end={x:facts.position.x+(target.pos.x-facts.position.x)/length*step,y:facts.position.y+(target.pos.y-facts.position.y)/length*step};
  if(!clearSegment(await geometry(),facts.position,end))return false;
  // Only a short presently visible back-facing corridor is trusted. This says
  // nothing about hidden patrol state or the direction of its next turn.
  for(const enemy of close)for(const t of [0,.5,1]){
   const p={x:facts.position.x+(end.x-facts.position.x)*t,y:facts.position.y+(end.y-facts.position.y)*t};
   if(distance(enemy.position,p)<66)return false;
   const angle=Math.atan2(p.y-enemy.position.y,p.x-enemy.position.x)-enemy.facing;
   if(distance(enemy.position,p)<165&&Math.cos(angle)>-.05)return false;
  }
  for(const enemy of close)windowPermits.set(enemy.id,facts.elapsedMs+450);
  driver.log({event:'observed-back-facing-window',position:facts.position,shortCorridorEnd:end,validMs:450,enemies:close.map(e=>({id:e.id,position:e.position,facing:e.facing,approaching:e.approaching,attack:e.attack}))});
  return true;
 }
 async function caution(target,nextPoint=null){
  let facts=await prepare(target);if(facts.ended)return {ended:true};
  if(nextPoint&&controlRolePermission(controlRoles,'transit')){
   const enemy=nearestBlockingTurnCandidate(facts,nextPoint),candidate=enemy?{enemy,leg:shortLeg(facts.position,nextPoint)}:null;
   if(candidate){
    const visible=await page.evaluate(leg=>{const s=window.__game.scene.getScene('RiftScene');return[0,.5,1].every(t=>s.visibilityAt({x:leg.start.x+(leg.end.x-leg.start.x)*t,y:leg.start.y+(leg.end.y-leg.start.y)*t})>0);},candidate.leg);
    if(visible&&clearSegment(await geometry(),candidate.leg.start,candidate.leg.end)){
     driver.log({event:'pursuit-control-decision-before',target:{id:target.id,pos:target.pos},candidate,otherVisibleEnemies:facts.enemies.filter(enemy=>enemy.id!==candidate.enemy.id)});
     await useKnown(item=>publicAbility(item)?.family==='solidify','pursuit-short-visible-leg',candidate.enemy.position,5000,{role:'transit',targetId:candidate.enemy.id,leg:candidate.leg,point:nextPoint});facts=await observe();
    }
   }
  }
  const close=facts.enemies.filter(e=>distance(e.position,facts.position)<175);
  if(!close.length)return {reroute:false,facts};
  if(lurePass&&lurePass.until>facts.elapsedMs&&lurePass.targetId===target.id){
   const dangerous=close.some(e=>e.attack==='windup'||e.attack==='active'||(distance(e.position,facts.position)<62&&facingPlayer(e,facts.position)));
   if(!dangerous){for(const e of close)windowPermits.set(e.id,facts.elapsedMs+420);driver.log({event:'lure-move-during-decoy',remainingMs:lurePass.until-facts.elapsedMs,target:target.id});return{reroute:false,facts};}
   lurePass=null;
  }
  if(knownSearches.has(target.id)&&distance(facts.position,target.pos)<65){const threatening=close.find(e=>distance(e.position,facts.position)<110);if(threatening){const paid=await useKnown(item=>/停住.*敌/.test(item.description),'hold-visible-guard-for-search',threatening.position,5000,{role:'search',targetId:threatening.id,point:target.pos});facts=await observe();if(paid)return{reroute:false,facts};}}
  const initial=close.map(e=>({id:e.id,position:e.position}));
  if(await allowObservedWindow(target,facts))return{reroute:false,facts};
  if(await lure(target,facts))return {reroute:false,facts:await observe()};
  // Observe movement before committing; do not turn a hidden AI state into knowledge.
  if(facts.elapsedMs-lastLook>1800&&close.every(e=>distance(e.position,facts.position)>90)){
   lastLook=facts.elapsedMs;await page.waitForTimeout(400);facts=await observe();
   const approaching=facts.enemies.some(e=>{const old=initial.find(x=>x.id===e.id);return old&&distance(e.position,facts.position)<distance(old.position,facts.position)-7;});
   if(!approaching)return {reroute:!(await allowObservedWindow(target,facts)),facts};
  }
  const nearest=[...facts.enemies].sort((a,b)=>distance(a.position,facts.position)-distance(b.position,facts.position))[0];
  if(nearest&&target.id!=='exit'&&facts.hp>=45&&distance(nearest.position,facts.position)<95&&facts.elapsedMs-(closeSince.get(nearest.id)??facts.elapsedMs)>2400){
   const owned=await ownedForPreparation(),weapon=owned.items.find(item=>item.id===owned.equipment.weaponId&&item.canEquip);
   if(weapon){
    if(nearest.attack==='windup'){await evade(target,facts);return{reroute:true,facts:await observe()};}
    if(distance(nearest.position,facts.position)>37){await face(nearest.position,170);return{reroute:true,facts:await observe()};}
    if(!liveControls.length&&facts.elapsedMs-lastSwing>550){await face(nearest.position,35);await driver.press('Space',60);lastSwing=facts.elapsedMs;driver.log({event:'visible-pursuer-defensive-swing',opponent:nearest.id,weapon:weapon.name});await page.waitForTimeout(110);}
    await evade(target,await observe());return{reroute:true,facts:await observe()};
   }
  }
  const danger=facts.enemies.some(e=>(distance(e.position,facts.position)<75&&facingPlayer(e,facts.position))||e.attack==='windup');
  if(danger){await evade(target,facts);return {reroute:true,facts:await observe()};}
  return {reroute:true,facts};
 }
 async function search(target,budget){
  await face(target.pos,65);let facts=await observe();
  const threats=()=>facts.enemies;
  const closeGuard=threats().find(e=>distance(e.position,facts.position)<110);
  if(closeGuard){const paid=await useKnown(item=>/停住.*敌/.test(item.description),'hold-visible-guard-for-channel',closeGuard.position,5000,{role:'search',targetId:closeGuard.id,point:target.pos});if(paid)await face(target.pos,50);facts=await observe();}
  if(threats().some(e=>distance(e.position,facts.position)<52||(distance(e.position,facts.position)<88&&facingPlayer(e,facts.position)))){
   if(!await lure(target,facts)){await evade(target,facts);return {attempted:false,reason:'visible-opponent-too-close'};}
  }
  if(facts.enemies.some(enemy=>distance(enemy.position,facts.position)<=96)){
   const used=await useKnown(item=>publicAbility(item)?.family==='silence','silence-before-visible-threat-search',null,6000);
   if(used)driver.log({event:'silence-search-window',target,elapsedMs:facts.elapsedMs,visibleThreats:facts.enemies,actual:await page.evaluate(()=>{const s=window.__game.scene.getScene('RiftScene');return{silenced:s.toolSystem.isActionSilenced(),runtime:s.toolSystem.exportRuntimeState().catalog?.effects.filter(e=>e.resolvedParams.familyId==='silence')??[]};})});
  }
  const started=Date.now();let before=await driver.state();
  if(budget&&newlyCollectedNodeIds(budget.entryState,before).length>=budget.limit)return{attempted:false,reason:'actual-search-limit'};
  try{await page.keyboard.down('e');driver.log({event:'key-down',key:'e',reason:'guarded-search'});
   while(Date.now()-started<5000){await page.waitForTimeout(150);const s=await driver.state();facts=await observe();
    if(budget?.maxFieldMs&&s.elapsedMs>=budget.maxFieldMs)return{attempted:true,reason:'preregistered-field-time-limit'};
    if(s.ended||s.hp<before.hp){driver.log({event:'search-cancelled-after-hit'});return {attempted:true,reason:'actual-hit'};}
    const completedNodeIds=newlyCollectedNodeIds(before,s);
    if(completedNodeIds.length)return {attempted:true,reason:'collected',completedNodeIds};
    if(s.elapsedMs-before.elapsedMs>=1600)return{attempted:true,reason:'channel-not-completed'};
    if(threats().some(e=>distance(e.position,facts.position)<48||e.attack==='windup')){driver.log({event:'search-cancelled-visible-approach'});return{attempted:true,reason:'visible-approach'};}
  }}finally{await page.keyboard.up('e');driver.log({event:'key-up',key:'e'});}
  return{attempted:true,reason:'channel-not-completed'};
 }
 return {observe,prepare,caution,search,evade,beforeMove,controlledMove,surveyCandidates,useSurvey,setBudget,budgetStatus,knownSearches:()=>[...knownSearches.values()],pollution:()=>[...pollutionMemory.values()],remembered:()=>[...memory.values()].filter(e=>!liveControls.some(effect=>effect.targetId===e.id)&&(stoppedUntil.get(e.id)??0)<=clockMs+500&&(windowPermits.get(e.id)??0)<=clockMs).concat([...surveyMemory.values()].filter(e=>e.expiresMs>clockMs)),reset:()=>{publicControlUnavailableUntil.clear();ownControls.clear();controlRoles.clear();liveControls=[];slotSpend.clear();dashWindows.length=0;ownSuppressions.clear();knownSearches.clear();surveyMemory.clear();pollutionMemory.clear();memory.clear();toolTimes.clear();closeSince.clear();luredEnemies.clear();stoppedUntil.clear();windowPermits.clear();lastLook=0;lastSwing=-Infinity;clockMs=0;lastMoveCheck=-Infinity;lurePass=null;}};
}
