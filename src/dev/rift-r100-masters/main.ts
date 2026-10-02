import { createRiftGymRuntime, type RiftGymRuntime, type RiftGymRuntimeState } from '../rift-gym-runtime';
import { MASTER_SCENES } from './generated-scenes';
import { createMasterWorld, type MasterFamily, type MasterGrade, type MasterWorld } from './world';
import { MasterPresentation, type MasterViewMode } from './presentation';
import { createMasterPatrolRoute, MasterPatrol } from './patrol';

if (!import.meta.env.DEV) throw new Error('R100 art masters are available only in development');
const $ = <T extends HTMLElement>(id:string):T=>{const node=document.getElementById(id);if(!node)throw new Error(`Missing ${id}`);return node as T;};
const params=new URLSearchParams(location.search);
let family:MasterFamily=MASTER_SCENES.find(value=>value.family===params.get('family'))?.family??'folded-slab';
let grade:MasterGrade=MASTER_SCENES.find(value=>value.grade===params.get('grade'))?.grade??'low';
let world:MasterWorld|null=null,presentation:MasterPresentation|null=null,runtime:RiftGymRuntime;
let mode:MasterViewMode='normal',motion=true,serial=0;
const patrol=new MasterPatrol();
const seedInput=$<HTMLInputElement>('seed');seedInput.value=params.get('seed')??'20261002';
const familyNames:Record<MasterFamily,string>={'folded-slab':'01　折叠板','fibre-knot':'02　纤维结','broken-shell':'03　厚壳腔'};
const gradeNames:Record<MasterGrade,string>={low:'低污染',medium:'中污染',severe:'重污染'};
function reportError(reason:unknown):void{const error=$('error');error.textContent=reason instanceof Error?reason.message:String(reason);error.hidden=false;$('loading').hidden=true;}
function updateSelections():void{
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-family]'))button.setAttribute('aria-current',String(button.dataset.family===family));
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-grade]'))button.setAttribute('aria-current',String(button.dataset.grade===grade));
}
for(const value of ['folded-slab','fibre-knot','broken-shell'] as const){const button=document.createElement('button');button.textContent=familyNames[value];button.dataset.family=value;button.addEventListener('click',()=>{family=value;void build();});$('families').append(button);}
for(const value of ['low','medium','severe'] as const){const button=document.createElement('button');button.textContent=gradeNames[value];button.dataset.grade=value;button.addEventListener('click',()=>{grade=value;void build();});$('grades').append(button);}
function report(state:RiftGymRuntimeState):void{
  if(patrol.active&&(state.paused||!state.running||state.probe?.ended))patrol.stop(state.paused?'暂停停止巡查':'场景或出行结束');
  const snapshot=presentation?.snapshot();
  const patrolButton=$<HTMLButtonElement>('patrol');patrolButton.textContent=patrol.active?'停止巡查':'沿边巡查';patrolButton.setAttribute('aria-pressed',String(patrol.active));patrolButton.disabled=!state.running||state.paused||!!state.probe?.ended;
  $('status').textContent=state.starting?'正在接入原生场景…':state.probe?.ended?'本次出行已结束 · 点「回到入口」重建':state.running?(state.paused?'暂停 · Esc 继续':'WASD 移动与转向 · E 交互'):'母版尚未运行';
  $('phase').textContent=snapshot?`${snapshot.phase}　·　${motion?'动态':'静止'}　·　${mode==='normal'?'正常受光':'诊断视图'}`:'';
  $('diagnostics').textContent=JSON.stringify({world:world?.diagnostics,presentation:snapshot,patrol:patrol.snapshot(),runtime:state},null,2);
  $<HTMLButtonElement>('pause').disabled=!state.running;
}
async function build():Promise<void>{
  const token=++serial;patrol.stop('场景重建');runtime?.stop();presentation=null;$('error').hidden=true;$('loading').hidden=false;updateSelections();
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));if(token!==serial)return;
  try{
    const seed=Number(seedInput.value);const definition=MASTER_SCENES.find(value=>value.family===family&&value.grade===grade)!;
    world=createMasterWorld(definition,seed);$('title').textContent=definition.label;$('identity').textContent=`${gradeNames[grade]} / ${seed}`;
    const url=new URL(location.href);url.searchParams.set('family',family);url.searchParams.set('grade',grade);url.searchParams.set('seed',String(seed));history.replaceState(null,'',url);
    const current=world;
    runtime.start(world.layout,'bare',{worldSurface:'runtime',footstepMaterial:'soil',suppressVoidNoise:true,extractionGlowRadius:8,
      createSightGrid:()=>current.sight,readMovementInput:patrol.readInput,
      createRuntime:context=>{presentation=new MasterPresentation(context,current);presentation.setMode(mode);presentation.setMotion(motion);$('loading').hidden=true;return presentation;}});
  }catch(reason){reportError(reason);}
}
runtime=createRiftGymRuntime({onReady:()=>{void build();},onState:report,onReturn:()=>{presentation=null;$('status').textContent='原生出行已结束；点「回到入口」继续审查';},onError:reportError});
$('rebuild').addEventListener('click',()=>{void build();});$('restart').addEventListener('click',()=>{void build();});
$('paired').addEventListener('click',()=>{seedInput.value=seedInput.value==='20261002'?'20261003':'20261002';void build();});
$('heldout').addEventListener('click',()=>{const values=new Uint32Array(1);crypto.getRandomValues(values);seedInput.value=String(values[0]);void build();});
$('mode').addEventListener('change',event=>{mode=(event.target as HTMLSelectElement).value as MasterViewMode;presentation?.setMode(mode);});
$('motion').addEventListener('click',()=>{motion=!motion;presentation?.setMotion(motion);$('motion').textContent=motion?'动态开':'动态关';$('motion').setAttribute('aria-pressed',String(motion));});
$('pause').addEventListener('click',()=>{patrol.stop('暂停停止巡查');runtime.togglePause();});
$('patrol').addEventListener('click',()=>{
  if(patrol.active){patrol.stop();report(runtime.getState());return;}
  const state=runtime.getState(),position=state.probe?.player;if(!world||!state.running||state.paused||state.probe?.ended||!position)return;
  try{patrol.start(createMasterPatrolRoute(world,position),position);report(runtime.getState());$('game-container').focus({preventScroll:true});}catch(reason){reportError(reason);}
});
$('pixel').addEventListener('click',()=>{const native=document.body.classList.toggle('native');$('pixel').setAttribute('aria-pressed',String(native));window.dispatchEvent(new Event('resize'));});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({world:world?.diagnostics,presentation:presentation?.snapshot(),patrol:patrol.snapshot(),runtime:runtime.getState()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`r100-${family}-${grade}-${seedInput.value}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
// Native keys must not move the actor while a review control owns focus.
document.querySelector('aside')!.addEventListener('keydown',event=>event.stopPropagation());
updateSelections();

function stopPatrolForKeyboard(event:KeyboardEvent):void{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)&&patrol.active)patrol.stop('真实键盘接管');}
document.addEventListener('keydown',stopPatrolForKeyboard,true);
window.addEventListener('pagehide',()=>{patrol.stop('页面关闭');document.removeEventListener('keydown',stopPatrolForKeyboard,true);},{once:true});
