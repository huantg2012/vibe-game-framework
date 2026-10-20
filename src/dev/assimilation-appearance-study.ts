/** Art-only driver. Real renderers, one actual scene, memory-only sessions.
 * Narrow private access stays here; no game scene consumes this state. */
import Phaser from 'phaser';
import { gameConfig } from '@/config/game-config';
import { saveManager } from '@/managers/save-manager';
import { audioManager } from '@/managers/audio-manager';
import { beginNewExpedition } from '@/managers/session';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { createR100ProductionRecipe } from '@/generation/world-study/r100-package';
import { RiftGenerationClient } from '@/generation/rift-generation-client';
import { hydrateRiftGeneration } from '@/generation/rift-generation-protocol';
import { prepareR100Presentation } from '@/systems/r100-world-presentation';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { createRiftGymRuntime, type RiftGymRuntime } from './rift-gym-runtime';
import type { AssimilationLookState } from '@/art/assimilation-appearance';
import type { Player } from '@/entities/player';
import { lastLightScreenHeading } from '@/entities/player-last-light-math';
import { setArtStudyNarrationStorage } from '@/narrative/atmosphere';
import { AssimilationModelClient, type AssimilationModelConsumer } from './assimilation-model-client';
import type { LastLightRenderState } from '@/art/last-light-renderer';

interface LookRenderer extends AssimilationModelConsumer {
  setAssimilationLook(state: AssimilationLookState | null): void;
  getAssimilationLookMetrics(): { count:number;totalMs:number;lastMs:number;maxMs:number;maskBytes:number;preparedFrames:number;changedPixels:number };
  render?(): void;
  draw?(state: LastLightRenderState): void;
}
interface ArtScene extends Phaser.Scene {
  player: Player;
  lastLightPlayerPresentation?: LookRenderer | null;
  chamber?: { renderer: LookRenderer; image: Phaser.GameObjects.Image; renderState: LastLightRenderState } | null;
  locomotion?: { state: { facing: number } } | null;
}
if (import.meta.env.DEV) initialize();
else document.body.textContent = '此美术打版仅在开发服务器开放。';

function initialize(): void {
  const memory=new Map<string,string>();
  const storage={getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>{memory.set(key,value);},removeItem:(key:string)=>{memory.delete(key);}};
  setArtStudyNarrationStorage(storage);
  const el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  const params = new URLSearchParams(location.search);
  const worlds = ['crystal-fibre', 'ruptured-film', 'haven'];
  const selected = worlds.includes(params.get('world') ?? '') ? params.get('world')! : worlds[0]!;
  const readNumber = (key: string, fallback: number): number => {
    const n = Number(params.get(key)); return params.has(key) && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
  };
  const state = { amount: readNumber('amount', .6), fibre: readNumber('fibre', .5), membrane: 0, seconds: 0, motion: true, subjective: true };
  state.membrane = 1 - state.fibre;
  const zeroLook = { ...state, amount: 0 };
  const visionPreview = { pollution: 15, assimilation: 0, presentation: 'light-eater' as const };
  const target = { amount: state.amount, fibre: state.fibre };
  const world = el<HTMLSelectElement>('world'), amount = el<HTMLInputElement>('amount'), mix = el<HTMLInputElement>('mix');
  world.value = selected;
  el('subjective').hidden = selected !== 'haven';
  let game: Phaser.Game | null = null, gym: RiftGymRuntime | null = null;
  let active: ArtScene | null = null, renderer: LookRenderer | null = null;
  let automatic = !params.has('amount'), baseline = false, paused = false, disposed = false, bootstrapped = false;
  let frame = 0, last = 0, cycle = 0, refreshMs = 0, detailMs = 0;
  let inspector = true, detailRequested = false, hookedGame = false, failed = false, lastRender = 0;
  let preparationMs = 0;
  let geometry = true;
  let material = true;
  const model = new AssimilationModelClient(error, () => active?.chamber?.image.texture.source[0]?.update());
  const intervals: number[] = [], cpuSamples:number[]=[], controller = new AbortController();
  let lastMeasuredCount=0;
  const canvas = el<HTMLCanvasElement>('detail'), context = canvas.getContext('2d')!;
  context.imageSmoothingEnabled = false;
  const percent = (values: number[], quantile: number): number => {
    const sorted = values.slice().sort((a,b) => a-b); return sorted[Math.floor((sorted.length - 1)*quantile)] ?? 0;
  };
  function error(reason: unknown): void {
    failed=true; model.destroy(); renderer?.setAssimilationLook(null); active=null; renderer=null;
    game?.events.off(Phaser.Core.Events.POST_RENDER,postrender);
    if(gym)gym.destroy();else game?.destroy(true);
    el('error').hidden = false; el('error').textContent = String(reason); el('waiting').hidden = true;
  }
  function readouts(): void {
    amount.value = String(target.amount * 100); mix.value = String(target.fibre * 100);
    el('amount-value').textContent = `${Math.round(state.amount*100)}%`;
    el('mix-value').textContent = `${Math.round(state.fibre*100)}/${Math.round(state.membrane*100)}`;
    el('auto').textContent = automatic ? '停止演示' : '连续演示';
    el('auto').setAttribute('aria-pressed', String(automatic));
    el('baseline').setAttribute('aria-pressed', String(baseline));
    el('pause').textContent = paused ? '继续画面' : '暂停画面';
    el('status').textContent = `${world.selectedOptions[0]?.text} · ${paused ? '已冻结' : active ? '动态运行中' : '准备中'}`;
    el('description').textContent = automatic ? '连续演示：同化加深 → 混合残留 → 疗愈退去。拖动滑杆接管。' : '手动观察：参数平滑抵达；原角色对照保留相同光照与姿态。';
    el('metrics').textContent = JSON.stringify({ samples: intervals.length, frameIntervalMedianMs: +percent(intervals,.5).toFixed(2),
      frameIntervalP95Ms: +percent(intervals,.95).toFixed(2),cpuP95Ms:+percent(cpuSamples,.95).toFixed(3), renderer: renderer?.getAssimilationLookMetrics() ?? null,
      preparationMs,geometry:model.metrics,note: 'CPU提交与全场帧间隔；建模光栅耗时来自独立Worker；未测GPU执行时间。' }, null, 2);
  }
  function set(a: number, f: number, immediate = false): void {
    automatic = false; target.amount = Math.max(0,Math.min(1,a)); target.fibre = Math.max(0,Math.min(1,f));
    if (immediate) { state.amount=target.amount; state.fibre=target.fibre; state.membrane=1-state.fibre; apply(); }
    readouts();
  }
  function apply(): void {
    if (baseline || !material) { zeroLook.seconds=state.seconds; renderer?.setAssimilationLook(zeroLook); }
    else renderer?.setAssimilationLook(state);
    if (renderer) model.update(renderer, baseline || !geometry ? 0 : state.amount, state.fibre, state.seconds, state.motion);
    if (paused) {
      if (active?.chamber) { renderer?.draw?.(active.chamber.renderState); active.chamber.image.texture.source[0]?.update(); }
      else renderer?.render?.();
      detailRequested = true;
    }
  }
  function pause(value: boolean): void {
    if (paused === value) return;
    paused = value;
    if (gym) { if (value) gym.pause(); else if (gym.getState().paused) gym.togglePause(); }
    else if (active) { if (value) active.scene.pause(); else active.scene.resume(); }
    readouts();
  }
  function face(yaw:number):void{
    if(!active||paused)return;
    if(selected==='haven'&&active.locomotion)active.locomotion.state.facing=yaw;
    else{
      const saved=active.player.exportRuntimeState();
      active.player.restoreRuntimeState({...saved,facingAngle:lastLightScreenHeading(yaw),moving:false,velocity:{x:0,y:0},inputVector:{x:0,y:0}});
    }
  }
  function detail(): void {
    if (!game?.canvas || !active?.player) return;
    const camera = active.cameras.main;
    const position = active.player.getPosition(), groundY = active.player.getGroundY();
    const x = (position.x - camera.worldView.x)*camera.zoom;
    const y = (groundY - camera.worldView.y)*camera.zoom;
    context.clearRect(0,0,canvas.width,canvas.height);
    context.drawImage(game.canvas,Math.round(x-40),Math.round(y-73),80,88,0,0,240,264);
  }
  function postrender(): void {
    const now=performance.now();
    if(active&&!paused&&!document.hidden&&lastRender){intervals.push(now-lastRender);if(intervals.length>600)intervals.shift();}
    const metrics=renderer?.getAssimilationLookMetrics();
    if(metrics&&metrics.count!==lastMeasuredCount){lastMeasuredCount=metrics.count;cpuSamples.push(metrics.lastMs);if(cpuSamples.length>600)cpuSamples.shift();}
    lastRender=now;
    if(detailRequested&&inspector){detailRequested=false;detail();}
  }
  function tick(time: number): void {
    if (disposed || failed) return;
    const elapsed = Math.max(0,time-(last||time)); last=time;
    if (!game && gym) game = (audioManager as unknown as { game: Phaser.Game | null }).game;
    if(game&&!hookedGame){game.events.on(Phaser.Core.Events.POST_RENDER,postrender);hookedGame=true;}
    if (selected === 'haven' && game && !bootstrapped) {
      const title = game.scene.scenes.find(scene=>scene.scene.key==='MainMenuScene'&&scene.scene.isActive());
      if (title) { bootstrapped=true; if (!beginNewExpedition(title)) error('内存会话创建失败'); }
    }
    if (!active && game) {
      const found = game.scene.scenes.find(scene=>scene.scene.key===(selected==='haven'?'PurificationScene':'RiftScene')&&scene.scene.isActive()) as ArtScene | undefined;
      if (found?.player) {
        const candidate = selected==='haven' ? found.chamber?.renderer : found.lastLightPlayerPresentation;
        if (candidate) {
          if (typeof candidate.setAssimilationLook !== 'function') { error('此场景未提供材质打版接口；不能用退化渲染冒充。'); return; }
          active=found; renderer=candidate; el('waiting').hidden=true;
          const prepareStart=performance.now();apply();preparationMs=performance.now()-prepareStart;
          face(0);
          if(paused){if(gym)gym.pause();else active.scene.pause();}
          el('game-container').focus();
        }
      }
    }
    if (active && !paused && !document.hidden) {
      const dt = Math.min(80,elapsed);
      state.seconds+=dt/1000;
      if (automatic) {
        cycle=(cycle+dt)%48000;
        const marks=[[0,.1,1],[9000,.85,1],[17000,.85,0],[27000,.95,.5],[33000,.95,.5],[45000,0,.5],[48000,.1,1]];
        const i=marks.findIndex(mark=>mark[0]!>cycle), a=marks[i-1]!, b=marks[i]!;
        const p=(cycle-a[0]!)/(b[0]!-a[0]!), t=p*p*(3-2*p);
        target.amount=a[1]!+(b[1]!-a[1]!)*t; target.fibre=a[2]!+(b[2]!-a[2]!)*t;
      }
      const blend=1-Math.exp(-dt/350);
      state.amount+=(target.amount-state.amount)*blend; state.fibre+=(target.fibre-state.fibre)*blend; state.membrane=1-state.fibre;
      apply();
      detailMs+=dt; if (detailMs>66) { detailMs=0; detailRequested=true; }
      refreshMs+=dt; if (refreshMs>400) { refreshMs=0; readouts(); }
    }
    if (active && renderer && !document.hidden)
      model.update(renderer, baseline || !geometry ? 0 : state.amount, state.fibre, state.seconds, state.motion);
    frame=requestAnimationFrame(tick);
  }
  if (selected==='haven') {
    saveManager.setStorage(storage);
    game=new Phaser.Game(gameConfig); bindDomUiRootToGame(game);
  } else {
    gym=createRiftGymRuntime({ onReady:()=>void build(), onState:value=>{if(active&&value.running)paused=value.paused;}, onReturn:()=>error('已离开打版场景，请重载本页'), onError:error });
  }
  async function build(): Promise<void> {
    try {
      const recipe=createR100ProductionRecipe(selected,selected==='crystal-fibre'?156:82,'medium');
      const client=new RiftGenerationClient();
      const wire=await client.generate({kind:'departure',generation:recipe},controller.signal);
      const result=hydrateRiftGeneration(wire);
      if(!result.world?.native)throw new Error('真实世界缺失');
      await prepareR100Presentation(recipe,{signal:controller.signal,world:result.world});
    if(disposed||failed)return;
      gym!.start(result.world,BUILD_LAB_LOADOUTS[0]!.id,{productionRecipe:recipe,pollutionGrade:'medium',assimilationMode:'persistent-v1',visionArtStudy:true,
        readVisionPreview:()=>visionPreview});
    }catch(reason){if(!controller.signal.aborted)error(reason);}
  }
  world.onchange=()=>{
    const query=new URLSearchParams({world:world.value,amount:String(state.amount),fibre:String(state.fibre)});
    location.assign(`${location.pathname}?${query}`);
  };
  amount.oninput=mix.oninput=()=>set(Number(amount.value)/100,Number(mix.value)/100);
  el('baseline').onclick=()=>{baseline=!baseline;apply();readouts();};
  el('pause').onclick=()=>pause(!paused);
  el('auto').onclick=()=>{automatic=!automatic;cycle=0;readouts();};
  el('heal').onclick=()=>set(0,state.fibre);
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-fibre]'))button.onclick=()=>set(Math.max(.75,state.amount),Number(button.dataset.fibre));
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-yaw]'))button.onclick=()=>face(Number(button.dataset.yaw));
  el('motion').onclick=()=>{state.motion=!state.motion;el('motion').setAttribute('aria-pressed',String(state.motion));apply();};
  el('subjective').onclick=()=>{state.subjective=!state.subjective;el('subjective').setAttribute('aria-pressed',String(state.subjective));apply();};
  el('geometry').onclick=()=>{geometry=!geometry;el('geometry').setAttribute('aria-pressed',String(geometry));apply();};
  el('material').onclick=()=>{material=!material;el('material').setAttribute('aria-pressed',String(material));apply();};
  function setInspector(value:boolean):void{inspector=value;el('inspector').setAttribute('aria-pressed',String(value));el('inspector').textContent=value?'局部放大开':'局部放大关';}
  el('inspector').onclick=()=>setInspector(!inspector);
  const api={set,pause,face,auto:(value:boolean)=>{automatic=value;cycle=0;readouts();},baseline:(value:boolean)=>{baseline=value;apply();readouts();},
    geometry:(value:boolean)=>{geometry=value;apply();},
    material:(value:boolean)=>{material=value;apply();},
    snapshot:()=>({world:selected,state:{...state},target:{...target},automatic,baseline,paused,ready:!!renderer,
      geometry,material,modelSettled:model.settled,modelMetrics:{...model.metrics},
      frameP50:percent(intervals,.5),frameP95:percent(intervals,.95),cpuP95:percent(cpuSamples,.95),preparationMs,metrics:renderer?.getAssimilationLookMetrics(),player:active?.player.getPosition()}),
    clearSamples:()=>{intervals.length=0;cpuSamples.length=0;},inspector:setInspector,captureDetail:()=>{detailRequested=true;}};
  Object.assign(window,{__assimilationStudy:api});
  readouts();frame=requestAnimationFrame(tick);
  // This sample validates standing/walking deformation; combat and device
  // interactions require separate morphed action chains, so do not trigger them.
  window.addEventListener('keydown',event=>{
    if (['Space','KeyE','KeyQ','KeyF','Tab'].includes(event.code) && event.target === el('game-container')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);controller.abort();model.destroy();renderer?.setAssimilationLook(null);if(gym)gym.destroy();else game?.destroy(true);delete(window as unknown as Record<string,unknown>).__assimilationStudy;},{once:true});
}
