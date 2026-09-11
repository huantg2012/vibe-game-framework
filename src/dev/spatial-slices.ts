/** DEV-only spatial presentation comparison. Actual input, encounters, inventory and settlement. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { eventBus } from '@/core/event-bus';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { BootScene } from '@/scenes/boot-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { contaminantSystem } from '@/systems/contaminant-system';
import { inventoryStore } from '@/systems/inventory-store';
import { GameEvent, type EventPayloads } from '@/types/events';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { BuildLabRecorder, type BuildLabRecord } from './build-lab-recorder';
import { BuildLabMemoryStorage, prepareBuildLabRun } from './build-lab-session';
import { SpatialSliceWorld, SLICE_SCENE, type SpatialSliceMode } from './spatial-study/slice-world';
import { SpatialSliceRuntime } from './spatial-study/slice-runtime';
import seaMaterialUrl from './spatial-study/assets/sea-water-r1.png';

if (import.meta.env.DEV) {
  saveManager.setStorage(new BuildLabMemoryStorage());
  const view = document.querySelector<HTMLSelectElement>('#view')!, seed = document.querySelector<HTMLInputElement>('#seed')!;
  const start = document.querySelector<HTMLButtonElement>('#start')!, abort = document.querySelector<HTMLButtonElement>('#abort')!;
  const pause = document.querySelector<HTMLButtonElement>('#pause')!, status = document.querySelector<HTMLElement>('#status')!;
  const state = document.querySelector<HTMLElement>('#state')!, error = document.querySelector<HTMLElement>('#error')!;
  const params = new URLSearchParams(location.search);
  if (['stage','vista'].includes(params.get('view') ?? '')) view.value = params.get('view')!;
  if (params.has('seed')) seed.value = params.get('seed')!;
  let ready = false, running = false, recorder: BuildLabRecorder | null = null, runtime: SpatialSliceRuntime | null = null;
  type SpaceSample = ReturnType<SpatialSliceRuntime['snapshot']>;
  let spaceSamples: SpaceSample[] = [];
  const records: { gameplay: BuildLabRecord; space: SpaceSample[] }[] = [];
  const cleanups: (() => void)[] = [];
  const scene = () => game.scene.getScene('RiftScene') as RiftScene;
  const showError = (reason: unknown) => { error.textContent = reason instanceof Error ? reason.stack ?? reason.message : String(reason); };
  class SpatialBoot extends BootScene {
    override preload(): void {
      super.preload();
      this.load.image('spatial-sea-material', seaMaterialUrl);
    }
    override create(): void {
      generatePlaceholderTextures(this); audioManager.bind(this.game); audioManager.unlock();
      ready = true; start.disabled = false; status.textContent = '资源就绪。'; this.scene.stop();
      if (params.get('autostart') !== '0') setTimeout(startRun, 0);
    }
  }
  const game = new Phaser.Game(gameConfigWithScenes([SpatialBoot, RiftScene]));
  bindDomUiRootToGame(game);
  function clearListeners(): void { for (const cleanup of cleanups.splice(0)) cleanup(); }
  function archive(outcome: Exclude<BuildLabRecord['outcome'], 'running'>): void {
    if (!recorder || recorder.record.outcome !== 'running') return;
    const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
    if (runtime) spaceSamples.push(runtime.snapshot());
    recorder.finish(outcome, inventoryStore.getState()); records.push({ gameplay: recorder.record, space: spaceSamples }); clearListeners();
  }
  function stopRun(): void {
    if (!ready) return;
    if (recorder?.record.outcome === 'running') archive('aborted');
    game.scene.stop('RiftScene'); runtime = null; running = false; audioManager.resumeAll();
    abort.disabled = true; pause.disabled = true; status.textContent = '已停止，记录保留在本页。';
  }
  function togglePause(): void {
    if (!running || scene().probeBuildLabState()?.ended) return;
    if (game.scene.isPaused('RiftScene')) { game.scene.resume('RiftScene'); audioManager.resumeAll(); status.textContent = '试验进行中'; }
    else { game.scene.pause('RiftScene'); audioManager.pauseAll(); status.textContent = '试验暂停。改变方案或种子后需中止并重开。'; }
    recorder?.event('spatial:pause', { paused: game.scene.isPaused('RiftScene') });
  }
  function subscribe<T extends GameEvent>(event: T, callback: (payload: EventPayloads[T]) => void): void {
    eventBus.on(event, callback); cleanups.push(() => eventBus.off(event, callback));
  }
  function startRun(): void {
    if (!ready) return;
    let initialized = false;
    try {
      const choice = view.value as SpatialSliceMode, seedValue = Number(seed.value);
      if (!['stage','vista'].includes(choice)) throw new Error('未知显示方案');
      const world = new SpatialSliceWorld(seedValue);
      stopRun(); error.textContent = ''; initialized = true;
      const runId = prepareBuildLabRun(SLICE_SCENE.loadout);
      recorder = new BuildLabRecorder({ runId, seed: seedValue, mode: choice, presentationRevision: 'r4-pixel-space-polish', fixtureSignature: world.signature(),
        codeBaseline: '3c1bc7c + iteration-21 I working tree', startedAt: new Date().toISOString(),
        trainingInventory: true, supplyValidation: false, loadout: SLICE_SCENE.loadout,
        presentationLimits: 'Two complete local studies, one authoritative RiftScene simulation. Stage: pixel-painted actors in a fixed 3D camera, a shared relief field, and falling/draining water. Vista: overhead floor, opaque internal absence, exterior scenery and independent upper openings. No multi-floor navigation. Native target visibility and isolated inventory remain authoritative. Not a complete production world or supply validation.',
        measurement: '100ms real simulation samples, committed inventory changes and production events; no synthetic inputs or results.' }, inventoryStore.getState());
      spaceSamples = [];
      cleanups.push(inventoryStore.subscribe(() => recorder?.inventory(inventoryStore.getState())));
      for (const event of [GameEvent.PLAYER_DAMAGED, GameEvent.ENEMY_DAMAGED, GameEvent.ENEMY_KILLED, GameEvent.ENEMY_ALERT,
        GameEvent.ENEMY_LOST_PLAYER, GameEvent.TOOL_USED, GameEvent.KINDLING_COLLECTED, GameEvent.ITEM_COLLECTED,
        GameEvent.CONTAMINANT_ACQUIRED, GameEvent.PLAYER_DIED]) subscribe(event, payload => recorder?.event(event, payload));
      subscribe(GameEvent.RIFT_EXITED, payload => {
        recorder?.event(GameEvent.RIFT_EXITED, payload);
        const settledRecorder = recorder;
        // A lethal environmental hit settles synchronously inside applyHazardHit.
        // Archive after that call returns so its committed-hit counter is included, too.
        queueMicrotask(() => {
          if (recorder !== settledRecorder) return;
          archive(payload.survived ? 'extract' : 'death');
          status.textContent = payload.survived ? '真实撤离已结算；R 返回配置。' : '死亡全损已结算；R 返回配置。';
        });
      });
      running = true; abort.disabled = false; pause.disabled = false;
      game.scene.start('RiftScene', { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle(), loadout: contaminantSystem.getSortieLoadout(),
        devFixture: { createLayout: () => world.layout, onReturn: stopRun, onPause: togglePause, extractionGlowRadius: 8,
          configureCamera: (camera: Phaser.Cameras.Scene2D.Camera) => camera.setZoom(1.35),
          createRuntime: (context: ConstructorParameters<typeof SpatialSliceRuntime>[0]) => {
            runtime = new SpatialSliceRuntime(context, world, choice, (event, payload) => recorder?.event(event, payload)); return runtime;
          } } });
      const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
      eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: gameState.getCycle() });
      status.textContent = `试验进行中 · ${choice.toUpperCase()} · 种子 ${seedValue}`;
      history.replaceState(null, '', `${location.pathname}?view=${choice}&seed=${seedValue}`);
      document.querySelector<HTMLElement>('#game-container')!.focus();
    } catch (reason) { if (initialized) stopRun(); showError(reason); }
  }
  function describe(): void {
    document.querySelector<HTMLElement>('#description')!.textContent = view.value === 'stage'
      ? '固定机位、像素角色与有起伏的海床。观察脚底贴坡、海腹透光，以及汇流、下落、断流和余水落尽。'
      : '正俯视。中央黑区保持不可探知；远处景观留在地图外缘，大面积悬水保持自然镂空，脚边光影回应远处的运动。';
  }
  for (const control of [view, seed]) {
    control.addEventListener('focus', () => { if (running && !game.scene.isPaused('RiftScene')) togglePause(); });
    control.addEventListener('change', describe);
  }
  describe(); start.onclick = () => { startRun(); start.blur(); };
  abort.onclick = () => { stopRun(); abort.blur(); }; pause.onclick = () => { togglePause(); pause.blur(); };
  document.addEventListener('keydown', event => {
    if (event.code === 'Escape' && running && game.scene.isPaused('RiftScene')) { event.preventDefault(); event.stopImmediatePropagation(); togglePause(); }
  }, true);
  const getRecords = () => [...records, ...(recorder?.record.outcome === 'running' ? [{ gameplay: recorder.record, space: spaceSamples }] : [])];
  document.querySelector<HTMLButtonElement>('#download')!.onclick = () => {
    const blob = new Blob([JSON.stringify({ study: 'iteration-21-I-pixel-space-polish', trainingInventory: true, supplyValidation: false, records: getRecords() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
    link.download = `spatial-slices-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const timer = window.setInterval(() => {
    if (!running || !recorder || !runtime || game.scene.isPaused('RiftScene')) return;
    const sample = scene().probeBuildLabState(); if (!sample) return;
    recorder.sample(sample); const space = runtime.snapshot();
    if (recorder.record.outcome === 'running' && spaceSamples.length < 36000) spaceSamples.push(space);
    state.textContent = JSON.stringify({ view: space.mode, seconds: Math.round(sample.elapsedMs / 1000), hp: sample.hp,
      chaos: Number(sample.chaos.toFixed(1)), water: space.water.phase, extension: Number(space.water.extension.toFixed(2)),
      hazardActive: space.water.active, waterHits: space.water.committedHits, beneathSea: space.sea.underFootprint,
      naturalOpenings: space.sea.openingCount, footprint: space.footprint,
      returnedItems: inventoryStore.getRun()?.returnedIds?.length ?? 0, records: records.length,
      fixture: recorder.record.metadata.fixtureSignature }, null, 2);
  }, 100);
  window.addEventListener('error', event => showError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => showError(event.reason));
  window.addEventListener('pagehide', () => { clearInterval(timer); clearListeners(); game.destroy(true); }, { once: true });
  Object.assign(window, { __spatialSlices: { game,
    getState: () => ({ ready, running, paused: game.scene.isPaused('RiftScene'), snapshot: running ? scene().probeBuildLabState() : null,
      spatial: runtime?.snapshot() ?? null, inventory: inventoryStore.getState(), error: error.textContent }),
    getRecords: () => structuredClone(getRecords()) } });
} else document.body.textContent = '悬海局部样板仅在开发服务器启用。';
