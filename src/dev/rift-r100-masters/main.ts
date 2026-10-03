import { createRiftGymRuntime, type RiftGymRuntime, type RiftGymRuntimeState } from '../rift-gym-runtime';
import { MASTER_SCENES } from './generated-scenes';
import { createMasterWorld, type MasterFamily, type MasterGrade, type MasterWorld } from './world';
import { MasterPresentation, type MasterViewMode } from './presentation';
import { loadPaintedMaterial } from './painted-material';
import { createMasterPatrolRoute, createMasterLightPatrolRoute, MasterPatrol } from './patrol';

if (!import.meta.env.DEV) throw new Error('R100 art masters are available only in development');
const $ = <T extends HTMLElement>(id:string):T=>{const node=document.getElementById(id);if(!node)throw new Error(`Missing ${id}`);return node as T;};
const params=new URLSearchParams(location.search);
let family:MasterFamily=MASTER_SCENES.find(value=>value.family===params.get('family'))?.family??'folded-slab';
let grade:MasterGrade=MASTER_SCENES.find(value=>value.grade===params.get('grade'))?.grade??'low';
let world:MasterWorld|null=null,presentation:MasterPresentation|null=null,runtime:RiftGymRuntime;
let mode:MasterViewMode='normal',motion=true,serial=0;
let patrolMode:'five-station'|'lighting-return'|null=null,queuedLightPatrol:number|null=null;
const patrol=new MasterPatrol();
const seedInput=$<HTMLInputElement>('seed');seedInput.value=params.get('seed')??'20261002';
const familyNames:Record<MasterFamily,string>={'folded-slab':'01　折叠板','fibre-knot':'02　纤维结','broken-shell':'03　厚壳腔'};
const gradeNames:Record<MasterGrade,string>={low:'低污染',medium:'中污染',severe:'重污染'};
function reportError(reason:unknown):void{queuedLightPatrol=null;const error=$('error');error.textContent=reason instanceof Error?reason.message:String(reason);error.hidden=false;$('loading').hidden=true;}
function updateSelections():void{
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-family]'))button.setAttribute('aria-current',String(button.dataset.family===family));
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-grade]'))button.setAttribute('aria-current',String(button.dataset.grade===grade));
}
for(const value of ['folded-slab','fibre-knot','broken-shell'] as const){const button=document.createElement('button');button.textContent=familyNames[value];button.dataset.family=value;button.addEventListener('click',()=>{family=value;void build();});$('families').append(button);}
for(const value of ['low','medium','severe'] as const){const button=document.createElement('button');button.textContent=gradeNames[value];button.dataset.grade=value;button.addEventListener('click',()=>{grade=value;void build();});$('grades').append(button);}
function report(state:RiftGymRuntimeState):void{
  if(queuedLightPatrol===serial&&world&&state.running&&!state.starting&&!state.paused&&!state.probe?.ended&&state.probe?.player){
    queuedLightPatrol=null;
    try{
      const position=state.probe.player;
      if(Math.hypot(position.x-world.layout.spawnPoint.x,position.y-world.layout.spawnPoint.y)>2.3)throw new Error('灯光往返必须从本次重建的入口开始');
      const route=createMasterLightPatrolRoute(world);runtime.restartPerformanceSample();
      patrolMode='lighting-return';patrol.start(route,position,{minimumDurationMs:65000,stationDwellMs:0});state=runtime.getState();
      $('game-container').focus({preventScroll:true});
    }catch(reason){reportError(reason);}
  }
  if(patrol.active&&(state.paused||!state.running||state.probe?.ended))patrol.stop(state.paused?'暂停停止巡查':'场景或出行结束');
  const snapshot=presentation?.snapshot();
  const patrolButton=$<HTMLButtonElement>('patrol'),fiveStationActive=patrol.active&&patrolMode==='five-station';
  patrolButton.textContent=fiveStationActive?'停止巡查':'沿边巡查';patrolButton.setAttribute('aria-pressed',String(fiveStationActive));patrolButton.disabled=!state.running||state.paused||!!state.probe?.ended||queuedLightPatrol!==null||(patrol.active&&!fiveStationActive);
  const lightButton=$<HTMLButtonElement>('light-patrol'),lightActive=patrol.active&&patrolMode==='lighting-return';
  lightButton.textContent=lightActive?'停止灯光往返':queuedLightPatrol!==null?'正在回到入口…':'60秒灯光往返';lightButton.setAttribute('aria-pressed',String(lightActive));lightButton.disabled=!state.ready||state.starting||queuedLightPatrol!==null||(patrol.active&&!lightActive);
  $('status').textContent=state.starting?'正在接入原生场景…':state.probe?.ended?'本次出行已结束 · 点「回到入口」重建':state.running?(state.paused?'暂停 · Esc 继续':'WASD 移动与转向 · E 交互'):'母版尚未运行';
  $('phase').textContent=snapshot?`${snapshot.phase}　·　${motion?'动态':'静止'}　·　${mode==='normal'?'正常受光':'诊断视图'}`:'';
  $('diagnostics').textContent=JSON.stringify({world:world?.diagnostics,presentation:snapshot,patrol:{mode:patrolMode,...patrol.snapshot()},runtime:state},null,2);
  $<HTMLButtonElement>('pause').disabled=!state.running;
}
async function build(lightPatrol=false):Promise<void>{
  const token=++serial;queuedLightPatrol=lightPatrol?token:null;patrolMode=null;patrol.stop('场景重建');runtime?.stop();presentation=null;$('error').hidden=true;$('loading').hidden=false;updateSelections();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(token!==serial)return;
  try{
    const seed=Number(seedInput.value);const definition=MASTER_SCENES.find(value=>value.family===family&&value.grade===grade)!;
    const painting=await loadPaintedMaterial(family);if(token!==serial)return;
    world=createMasterWorld(definition,seed);$('title').textContent=definition.label;$('identity').textContent=`${gradeNames[grade]} / ${seed}`;
    const url=new URL(location.href);url.searchParams.set('family',family);url.searchParams.set('grade',grade);url.searchParams.set('seed',String(seed));history.replaceState(null,'',url);
    const current=world;
    runtime.start(world.layout,'bare',{worldSurface:'runtime',materialLighting:true,footstepMaterial:'soil',suppressVoidNoise:true,extractionGlowRadius:8,
      hostTileMap:current.hostTileMap,pollutionGrade:current.definition.grade,
      createSightGrid:()=>current.sight,createCombatGrid:()=>current.combat,readMovementInput:patrol.readInput,
      createRuntime:context=>{presentation=new MasterPresentation(context,current,painting);presentation.setMode(mode);presentation.setMotion(motion);$('loading').hidden=true;return presentation;}});
  }catch(reason){if(token===serial)reportError(reason);}
}
runtime=createRiftGymRuntime({performance:{sampleMs:60000},onReady:()=>{void build();},onState:report,onReturn:()=>{presentation=null;$('status').textContent='原生出行已结束；点「回到入口」继续审查';},onError:reportError});
$('rebuild').addEventListener('click',()=>{void build();});$('restart').addEventListener('click',()=>{void build();});
$('paired').addEventListener('click',()=>{seedInput.value=seedInput.value==='20261002'?'20261003':'20261002';void build();});
$('heldout').addEventListener('click',()=>{const values=new Uint32Array(1);crypto.getRandomValues(values);seedInput.value=String(values[0]);void build();});
$('mode').addEventListener('change',event=>{mode=(event.target as HTMLSelectElement).value as MasterViewMode;presentation?.setMode(mode);});
$('motion').addEventListener('click',()=>{motion=!motion;presentation?.setMotion(motion);$('motion').textContent=motion?'动态开':'动态关';$('motion').setAttribute('aria-pressed',String(motion));});
$('pause').addEventListener('click',()=>{patrol.stop('暂停停止巡查');runtime.togglePause();});
$('patrol').addEventListener('click',()=>{
  if(patrol.active){patrol.stop();report(runtime.getState());return;}
  const state=runtime.getState(),position=state.probe?.player;if(!world||!state.running||state.paused||state.probe?.ended||!position)return;
  try{const route=createMasterPatrolRoute(world,position);runtime.restartPerformanceSample();patrolMode='five-station';patrol.start(route,position);report(runtime.getState());$('game-container').focus({preventScroll:true});}catch(reason){reportError(reason);}
});
$('light-patrol').addEventListener('click',()=>{
  if(patrol.active&&patrolMode==='lighting-return'){patrol.stop('手动停止灯光往返');report(runtime.getState());return;}
  if(queuedLightPatrol!==null||patrol.active)return;
  void build(true);
});
$('pixel').addEventListener('click',()=>{const native=document.body.classList.toggle('native');$('pixel').setAttribute('aria-pressed',String(native));window.dispatchEvent(new Event('resize'));});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({world:world?.diagnostics,presentation:presentation?.snapshot(),patrol:{mode:patrolMode,...patrol.snapshot()},runtime:runtime.getState()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`r100-${family}-${grade}-${seedInput.value}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
// Native keys must not move the actor while a review control owns focus.
document.querySelector('aside')!.addEventListener('keydown',event=>event.stopPropagation());
updateSelections();

function stopPatrolForKeyboard(event:KeyboardEvent):void{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)&&patrol.active)patrol.stop('真实键盘接管');}
document.addEventListener('keydown',stopPatrolForKeyboard,true);
window.addEventListener('pagehide',()=>{patrol.stop('页面关闭');document.removeEventListener('keydown',stopPatrolForKeyboard,true);},{once:true});
