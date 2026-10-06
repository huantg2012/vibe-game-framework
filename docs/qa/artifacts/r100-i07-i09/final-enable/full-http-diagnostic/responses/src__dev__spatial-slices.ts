/** DEV-only spatial presentation comparison. Actual input, encounters, inventory and settlement. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
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
import { SpatialSliceWorld } from './spatial-study/slice-world';
import { assertStageVisualSupport, createStageGameplayWorld, resolveSpatialSliceOptions } from './spatial-study/stage-gameplay-fixture';
import { SpatialSliceRuntime } from './spatial-study/slice-runtime';
import { createStageSightGrid } from './spatial-study/stage/sight-grid';
import seaMaterialUrl from './spatial-study/assets/sea-water-r1.png';

if (import.meta.env.DEV) {
  saveManager.setStorage(new BuildLabMemoryStorage());
  const view = document.querySelector<HTMLSelectElement>('#view')!, seed = document.querySelector<HTMLInputElement>('#seed')!;
  const route = document.querySelector<HTMLSelectElement>('#route')!, loadout = document.querySelector<HTMLSelectElement>('#loadout')!;
  const start = document.querySelector<HTMLButtonElement>('#start')!, abort = document.querySelector<HTMLButtonElement>('#abort')!;
  const pause = document.querySelector<HTMLButtonElement>('#pause')!, status = document.querySelector<HTMLElement>('#status')!;
  const state = document.querySelector<HTMLElement>('#state')!, error = document.querySelector<HTMLElement>('#error')!;
  const params = new URLSearchParams(location.search);
  for (const definition of BUILD_LAB_LOADOUTS) {
    if (definition.id === 'bare' || definition.id === 'melee' || definition.id === 'light') {
      loadout.add(new Option(definition.name, definition.id));
    }
  }
  let admissionError: unknown = null;
  try {
    const initial = resolveSpatialSliceOptions({ view: params.get('view'), route: params.get('route'),
      loadout: params.get('loadout'), seed: params.get('seed') });
    view.value = initial.view; route.value = initial.route; loadout.value = initial.loadout; seed.value = String(initial.seed);
  } catch (reason) {
    admissionError = reason;
    error.textContent = reason instanceof Error ? reason.message : String(reason);
  }
  let ready = false, running = false, starting = false, sceneCreated = false;
  let recorder: BuildLabRecorder | null = null, runtime: SpatialSliceRuntime | null = null;
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
      if (!admissionError && params.get('autostart') !== '0') setTimeout(startRun, 0);
    }
  }
  const game = new Phaser.Game(gameConfigWithScenes([SpatialBoot, RiftScene]));
  bindDomUiRootToGame(game);
  function clearListeners(): void {
    let firstFailure: unknown = null;
    for (const cleanup of cleanups.splice(0)) {
      try { cleanup(); } catch (reason) { firstFailure ??= reason; }
    }
    if (firstFailure) throw firstFailure;
  }
  function archive(outcome: Exclude<BuildLabRecord['outcome'], 'running'>, sampleFinal = true): void {
    if (!recorder || recorder.record.outcome !== 'running') return;
    if (sampleFinal && sceneCreated) {
      const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
      if (runtime) spaceSamples.push(runtime.snapshot());
    }
    recorder.finish(outcome, inventoryStore.getState()); records.push({ gameplay: recorder.record, space: spaceSamples }); clearListeners();
  }
  function stopRun(sampleFinal = true): void {
    if (!ready) return;
    const failures: unknown[] = [];
    const attempt = (action: () => void): void => { try { action(); } catch (reason) { failures.push(reason); } };
    attempt(() => { if (recorder?.record.outcome === 'running') archive('aborted', sampleFinal); });
    // A partial create must never become observable through the timer, keyboard
    // handlers or read-only probe, even when its own shutdown reports an error.
    runtime = null; running = false; starting = false; sceneCreated = false;
    attempt(clearListeners);
    attempt(() => game.scene.stop('RiftScene'));
    attempt(() => audioManager.resumeAll());
    start.disabled = false;
    abort.disabled = true; pause.disabled = true; status.textContent = '已停止，记录保留在本页。';
    if (failures.length) throw failures[0];
  }
  function reportStartFailure(reason: unknown): void {
    // Preserve the cause before touching a partially initialized scene. The
    // cleanup path deliberately skips final samples and cannot replace it.
    const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    recorder?.event('spatial:create-failed', { message });
    showError(reason);
    try { stopRun(false); }
    catch (cleanupReason) {
      const detail = cleanupReason instanceof Error ? cleanupReason.stack ?? cleanupReason.message : String(cleanupReason);
      error.textContent = `${message}\n\n清理未完成场景时另有异常：\n${detail}`;
    }
    status.textContent = '场景创建失败；原始错误已保留。';
  }
  function togglePause(): void {
    if (!running || !sceneCreated || scene().probeBuildLabState()?.ended) return;
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
      if (admissionError) throw admissionError;
      const options = resolveSpatialSliceOptions({ view: view.value, route: route.value, loadout: loadout.value, seed: seed.value });
      const choice = options.view, seedValue = options.seed;
      const world = options.route === 'long' ? createStageGameplayWorld(seedValue) : new SpatialSliceWorld(seedValue);
      if (choice === 'stage') assertStageVisualSupport(world.layout);
      stopRun(); error.textContent = ''; initialized = true;
      const runId = prepareBuildLabRun(options.loadout);
      recorder = new BuildLabRecorder({ runId, seed: seedValue, mode: choice, route: options.route,
        cameraMode: options.route === 'long' ? 'follow' : 'fixed',
        presentationRevision: choice === 'stage' ? 'r8-stage-gameplay-foundation' : 'r4-pixel-space-polish', fixtureSignature: world.signature(),
        codeBaseline: 'a96fed3 + iteration-21 M working tree', startedAt: new Date().toISOString(),
        sightPolicy: choice === 'stage' ? 'Internal chasms transmit sight; walls and exterior void block. Movement remains on real floor.' : 'R4 opaque VOID; unchanged.',
        trainingInventory: true, supplyValidation: false, loadout: options.loadout,
        presentationLimits: 'One authoritative RiftScene simulation. Stage long route: fixed angle and pixel scale with translated camera; two supported infiltrated insect remnants and three selected formal loadouts. The original local route remains selectable. Vista is frozen to its local route and bare loadout. No multi-floor navigation. Native target visibility and isolated inventory remain authoritative. Not a complete production world or supply validation.',
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
      starting = true; sceneCreated = false; start.disabled = true;
      const activeRecorder = recorder;
      const onCreated = (): void => {
        if (recorder !== activeRecorder) return;
        sceneCreated = true; starting = false; running = true;
        start.disabled = false; abort.disabled = false; pause.disabled = false;
        const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
        eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: gameState.getCycle() });
        status.textContent = `试验进行中 · ${choice.toUpperCase()} · ${options.route === 'long' ? '两岸路线' : '原局部'} · 种子 ${seedValue}`;
        history.replaceState(null, '', `${location.pathname}?view=${choice}&route=${options.route}&loadout=${options.loadout}&seed=${seedValue}`);
        document.querySelector<HTMLElement>('#game-container')!.focus();
      };
      scene().events.once(Phaser.Scenes.Events.CREATE, onCreated);
      cleanups.push(() => scene().events.off(Phaser.Scenes.Events.CREATE, onCreated));
      game.scene.start('RiftScene', { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle(), loadout: contaminantSystem.getSortieLoadout(),
        devFixture: { createLayout: () => world.layout, onReturn: () => stopRun(), onPause: togglePause, extractionGlowRadius: 8,
          createSightGrid: choice === 'stage' ? createStageSightGrid : undefined,
          configureCamera: (camera: Phaser.Cameras.Scene2D.Camera) => camera.setZoom(1.35),
          createRuntime: (context: ConstructorParameters<typeof SpatialSliceRuntime>[0]) => {
            runtime = new SpatialSliceRuntime(context, world, choice, (event, payload) => recorder?.event(event, payload),
              { camera: options.route === 'long' ? 'follow' : 'fixed' }); return runtime;
          } } });
    } catch (reason) { if (initialized) reportStartFailure(reason); else showError(reason); }
  }
  function describe(): void {
    const frozen = view.value === 'vista';
    route.disabled = frozen; loadout.disabled = frozen;
    if (frozen) { route.value = 'local'; loadout.value = 'bare'; }
    document.querySelector<HTMLElement>('#description')!.textContent = view.value === 'stage'
      ? route.value === 'long'
        ? '固定角度与人物尺度，镜头随行走平移。穿过两处断口的岸线，实际接战、使用物件并携回。空洞可望、不可跨越。'
        : '原局部与固定镜头。沿近岸转身与横移，观察海体显露、两岸厚度和落水；保留短距离回归入口。'
      : '正俯视。中央黑区保持不可探知；远处景观留在地图外缘，大面积悬水保持自然镂空，脚边光影回应远处的运动。';
    document.querySelector<HTMLElement>('#route-description')!.textContent = route.value === 'long'
      ? '从西南岸出发 → 向北翻找西岸残堆 → 绕北岸接敌 → 可前往东北深处翻找 → 沿东岸南下 → 观察落水、绕行或等待 → 返回西南起点。三处残堆可自行取舍。'
      : '向东绕过中央裂口 → 观察落水并翻找东侧残堆 → 沿北侧接敌 → 翻找西北残堆 → 折返南侧起点。可以自由探索。';
  }
  for (const control of [view, route, loadout, seed]) {
    control.addEventListener('focus', () => { if (running && !game.scene.isPaused('RiftScene')) togglePause(); });
    control.addEventListener('change', () => { admissionError = null; error.textContent = ''; describe(); });
  }
  describe(); start.onclick = () => { startRun(); start.blur(); };
  abort.onclick = () => { stopRun(); abort.blur(); }; pause.onclick = () => { togglePause(); pause.blur(); };
  document.addEventListener('keydown', event => {
    if (event.code === 'Escape' && running && game.scene.isPaused('RiftScene')) { event.preventDefault(); event.stopImmediatePropagation(); togglePause(); }
  }, true);
  const getRecords = () => [...records, ...(recorder?.record.outcome === 'running' ? [{ gameplay: recorder.record, space: spaceSamples }] : [])];
  document.querySelector<HTMLButtonElement>('#download')!.onclick = () => {
    const blob = new Blob([JSON.stringify({ study: 'iteration-21-M-stage-gameplay-foundation', trainingInventory: true, supplyValidation: false, records: getRecords() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
    link.download = `spatial-slices-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const timer = window.setInterval(() => {
    if (!running || !sceneCreated || !recorder || !runtime || game.scene.isPaused('RiftScene')) return;
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
  window.addEventListener('error', event => {
    if (starting) reportStartFailure(event.error ?? event.message); else showError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', event => {
    if (starting) reportStartFailure(event.reason); else showError(event.reason);
  });
  window.addEventListener('pagehide', () => { clearInterval(timer); clearListeners(); game.destroy(true); }, { once: true });
  Object.assign(window, { __spatialSlices: { game,
    getState: () => ({ ready, running, starting, sceneCreated, paused: game.scene.isPaused('RiftScene'), snapshot: running && sceneCreated ? scene().probeBuildLabState() : null,
      spatial: sceneCreated ? runtime?.snapshot() ?? null : null, inventory: inventoryStore.getState(), error: error.textContent }),
    getRecords: () => structuredClone(getRecords()) } });
} else document.body.textContent = '悬海局部样板仅在开发服务器启用。';
