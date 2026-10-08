/** DEV-only complete suspended-sea sortie. Formal simulation and isolated recording. */
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
import { createSuspendedSeaWorld, resolveSuspendedSeaOptions, SUSPENDED_SEA_LOADOUT_IDS, type SuspendedSeaWorld } from './suspended-sea/world';
import { SuspendedSeaRuntime } from './suspended-sea/runtime';
import { createSuspendedSeaFixture } from './suspended-sea/fixture';
import seaMaterialUrl from './spatial-study/assets/sea-water-r1.png';

if (import.meta.env.DEV) {
  saveManager.setStorage(new BuildLabMemoryStorage());
  const sceneChoice = document.querySelector<HTMLSelectElement>('#scene')!, seed = document.querySelector<HTMLInputElement>('#seed')!;
  const loadout = document.querySelector<HTMLSelectElement>('#loadout')!;
  const start = document.querySelector<HTMLButtonElement>('#start')!, abort = document.querySelector<HTMLButtonElement>('#abort')!;
  const pause = document.querySelector<HTMLButtonElement>('#pause')!, status = document.querySelector<HTMLElement>('#status')!;
  const state = document.querySelector<HTMLElement>('#state')!, error = document.querySelector<HTMLElement>('#error')!;
  const params = new URLSearchParams(location.search);
  for (const definition of BUILD_LAB_LOADOUTS) {
    if (SUSPENDED_SEA_LOADOUT_IDS.some(id => id === definition.id)) {
      loadout.add(new Option(definition.name, definition.id));
    }
  }
  let admissionError: unknown = null;
  try {
    const initial = resolveSuspendedSeaOptions({ scene: params.get('scene'),
      loadout: params.get('loadout'), seed: params.get('seed') });
    sceneChoice.value = initial.scene; loadout.value = initial.loadout; seed.value = String(initial.seed);
  } catch (reason) {
    admissionError = reason;
    error.textContent = reason instanceof Error ? reason.message : String(reason);
  }
  let ready = false, running = false, starting = false, sceneCreated = false;
  let recorder: BuildLabRecorder | null = null, runtime: SuspendedSeaRuntime | null = null;
  type SpaceSample = ReturnType<SuspendedSeaRuntime['snapshot']>;
  let spaceSamples: SpaceSample[] = [];
  let activeWorld: SuspendedSeaWorld | null = null;
  const records: { gameplay: BuildLabRecord; space: SpaceSample[] }[] = [];
  const cleanups: (() => void)[] = [];
  const scene = () => game.scene.getScene('RiftScene') as RiftScene;
  const showError = (reason: unknown) => { error.textContent = reason instanceof Error ? reason.stack ?? reason.message : String(reason); };
  class SuspendedSeaBoot extends BootScene {
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
  const game = new Phaser.Game(gameConfigWithScenes([SuspendedSeaBoot, RiftScene]));
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
    runtime = null; activeWorld = null; running = false; starting = false; sceneCreated = false;
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
    recorder?.event('sea:create-failed', { message });
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
    recorder?.event('sea:pause', { paused: game.scene.isPaused('RiftScene') });
  }
  function subscribe<T extends GameEvent>(event: T, callback: (payload: EventPayloads[T]) => void): void {
    eventBus.on(event, callback); cleanups.push(() => eventBus.off(event, callback));
  }
  function startRun(): void {
    if (!ready) return;
    let initialized = false;
    try {
      if (admissionError) throw admissionError;
      const options = resolveSuspendedSeaOptions({ scene: sceneChoice.value, loadout: loadout.value, seed: seed.value });
      const seedValue = options.seed;
      const world = createSuspendedSeaWorld(seedValue, options.scene);
      stopRun(); error.textContent = ''; initialized = true; activeWorld = world;
      const runId = prepareBuildLabRun(options.loadout);
      recorder = new BuildLabRecorder({ runId, ...world.metadata, mode: 'stage',
        cameraMode: 'follow', presentationRevision: 'i22-suspended-sea-native-world', fixtureSignature: world.metadata.signature,
        codeBaseline: '2ee0b2b + iteration-22 working tree', startedAt: new Date().toISOString(),
        sightPolicy: 'Internal chasms transmit sight; walls and exterior void block. Movement remains on real floor.',
        trainingInventory: true, supplyValidation: false, loadout: options.loadout,
        firstWeaponDiscovered: inventoryStore.getState().firstWeaponDiscovered,
        entryDurationMs: world.entryDurationMs,
        presentationLimits: 'Two authored suspended-sea layouts, one local water/shell relation, actual source-based loot and four supported ordinary training loadouts. The only simulation is RiftScene. This isolated run is not a long-term-save or base-offering-loop validation.',
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
        status.textContent = `悬海 · ${world.metadata.sceneName} · 种子 ${seedValue}`;
        history.replaceState(null, '', `${location.pathname}?scene=${options.scene}&loadout=${options.loadout}&seed=${seedValue}`);
        document.querySelector<HTMLElement>('#game-container')!.focus();
      };
      scene().events.once(Phaser.Scenes.Events.CREATE, onCreated);
      cleanups.push(() => scene().events.off(Phaser.Scenes.Events.CREATE, onCreated));
      game.scene.start('RiftScene', { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle(), loadout: contaminantSystem.getSortieLoadout(),
        devFixture: createSuspendedSeaFixture(world, { onReturn: () => stopRun(), onPause: togglePause,
          onRuntime: value => { runtime = value; }, recordEvent: (event, payload) => recorder?.event(event, payload) }) });
    } catch (reason) { if (initialized) reportStartFailure(reason); else showError(reason); }
  }
  function describe(): void {
    document.querySelector<HTMLElement>('#description')!.textContent = sceneChoice.value === 'sea-open-channel'
      ? '开阔潮沟：西南入岸，沿观察面接近侧水；等待、敲偏壳片或绕北岸抵达远岸。'
      : '折返岸脊：绕过深井抵达远岸，携物返回时重新判断低鞍部与长岸。';
    const definition = BUILD_LAB_LOADOUTS.find(row => row.id === loadout.value);
    document.querySelector<HTMLElement>('#route-description')!.textContent = definition?.description ?? '';
  }
  for (const control of [sceneChoice, loadout, seed]) {
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
    const blob = new Blob([JSON.stringify({ study: 'iteration-22-suspended-sea-native-world', trainingInventory: true, supplyValidation: false, records: getRecords() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url;
    link.download = `suspended-sea-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const timer = window.setInterval(() => {
    if (!running || !sceneCreated || !recorder || !runtime || game.scene.isPaused('RiftScene')) return;
    const sample = scene().probeBuildLabState(); if (!sample) return;
    recorder.sample(sample); const space = runtime.snapshot();
    if (recorder.record.outcome === 'running' && spaceSamples.length < 36000) spaceSamples.push(space);
    state.textContent = JSON.stringify({ world: activeWorld?.metadata, seconds: Math.round(sample.elapsedMs / 1000),
      hp: sample.hp, chaos: Number(sample.chaos.toFixed(1)), entry: space.entry, water: space.water, shell: space.shell,
      returnedItems: inventoryStore.getRun()?.returnedIds?.length ?? 0, records: records.length }, null, 2);
  }, 100);
  window.addEventListener('error', event => {
    if (starting) reportStartFailure(event.error ?? event.message); else showError(event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', event => {
    if (starting) reportStartFailure(event.reason); else showError(event.reason);
  });
  window.addEventListener('pagehide', () => { clearInterval(timer); clearListeners(); game.destroy(true); }, { once: true });
  Object.assign(window, { __suspendedSea: { game,
    getState: () => ({ ready, running, starting, sceneCreated, paused: game.scene.isPaused('RiftScene'), snapshot: running && sceneCreated ? scene().probeBuildLabState() : null,
      metadata: activeWorld ? structuredClone(activeWorld.metadata) : null,
      layout: activeWorld ? structuredClone({ tileMap: activeWorld.base.layout.tileMap, spawnPoint: activeWorld.base.layout.spawnPoint,
        extractionPoint: activeWorld.base.layout.extractionPoint, kindlingNodes: activeWorld.base.layout.kindlingNodes,
        contaminantNodes: activeWorld.base.layout.contaminantNodes, enemySpawns: activeWorld.base.layout.enemySpawns }) : null,
      spatial: sceneCreated ? runtime?.snapshot() ?? null : null, inventory: inventoryStore.getState(), error: error.textContent }),
    getRecords: () => structuredClone(getRecords()) } });
} else document.body.textContent = '悬海完整关卡仅在开发服务器启用。';
