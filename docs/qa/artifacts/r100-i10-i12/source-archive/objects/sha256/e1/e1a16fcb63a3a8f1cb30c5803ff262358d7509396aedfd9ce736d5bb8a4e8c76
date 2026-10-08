/** DEV-only entry: genuine RiftScene, independent memory save, reproducible comparisons. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { eventBus } from '@/core/event-bus';
import { BUILD_LAB_LOADOUTS, BUILD_LAB_SCENES, type BuildLabLoadoutId, type BuildLabSceneId } from '@/generated/build-lab-data';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { BootScene } from '@/scenes/boot-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { inventoryStore } from '@/systems/inventory-store';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { getSurvivalAttributes } from '@/systems/survival-attributes';
import { GameEvent, type EventPayloads } from '@/types/events';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { buildLabFixtureSignature, BUILD_LAB_VOLUMES, createBuildLabLayout, type BuildLabVolume } from './build-lab-fixtures';
import { BuildLabRecorder, type BuildLabRecord } from './build-lab-recorder';
import { BuildLabMemoryStorage, prepareBuildLabRun } from './build-lab-session';

if (import.meta.env.DEV) {
  saveManager.setStorage(new BuildLabMemoryStorage());
  const encounter = document.querySelector<HTMLSelectElement>('#encounter')!;
  const loadout = document.querySelector<HTMLSelectElement>('#loadout')!;
  const volume = document.querySelector<HTMLSelectElement>('#volume')!;
  const seed = document.querySelector<HTMLInputElement>('#seed')!;
  const start = document.querySelector<HTMLButtonElement>('#start')!;
  const abort = document.querySelector<HTMLButtonElement>('#abort')!;
  const pause = document.querySelector<HTMLButtonElement>('#pause')!;
  const status = document.querySelector<HTMLElement>('#status')!;
  const state = document.querySelector<HTMLElement>('#state')!;
  const error = document.querySelector<HTMLElement>('#error')!;
  const description = document.querySelector<HTMLElement>('#description')!;
  const params = new URLSearchParams(location.search);
  for (const row of BUILD_LAB_SCENES) encounter.add(new Option(row.name, row.id));
  for (const row of BUILD_LAB_LOADOUTS) loadout.add(new Option(row.name, row.id));
  if (BUILD_LAB_SCENES.some(row => row.id === params.get('scene'))) encounter.value = params.get('scene')!;
  if (BUILD_LAB_LOADOUTS.some(row => row.id === params.get('build'))) loadout.value = params.get('build')!;
  if (BUILD_LAB_VOLUMES.includes(params.get('volume') as BuildLabVolume)) volume.value = params.get('volume')!;
  if (params.has('seed')) seed.value = params.get('seed')!;
  let ready = false, running = false, recorder: BuildLabRecorder | null = null;
  const records: BuildLabRecord[] = [];
  const cleanups: (() => void)[] = [];
  const scene = () => game.scene.getScene('RiftScene') as RiftScene;
  const showError = (message: unknown) => { error.textContent = message instanceof Error ? message.stack ?? message.message : String(message); };

  class LabBoot extends BootScene {
    override create(): void {
      // Inherit production preload; only replace its destination.
      generatePlaceholderTextures(this); audioManager.bind(this.game); audioManager.unlock();
      ready = true; start.disabled = false; status.textContent = '资源就绪。选择配置开始。';
      this.scene.stop();
      if (params.get('autostart') !== '0') setTimeout(startRun, 0);
    }
  }
  const game = new Phaser.Game(gameConfigWithScenes([LabBoot, RiftScene]));
  bindDomUiRootToGame(game);

  function clearRecordListeners(): void { for (const cleanup of cleanups.splice(0)) cleanup(); }
  function archive(outcome: Exclude<BuildLabRecord['outcome'], 'running'>): void {
    if (!recorder || recorder.record.outcome !== 'running') return;
    if (game.scene.isActive('RiftScene') || game.scene.isPaused('RiftScene')) {
      const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
    }
    recorder.finish(outcome, inventoryStore.getState()); records.push(recorder.record);
    clearRecordListeners();
  }
  function stopRun(): void {
    if (!ready) return;
    if (recorder?.record.outcome === 'running') archive('aborted');
    game.scene.stop('RiftScene'); audioManager.resumeAll();
    running = false; abort.disabled = true; pause.disabled = true;
    status.textContent = '已停止。记录保留在本页，可下载或开始下一次。';
  }
  function togglePause(): void {
    if (!running || scene().probeBuildLabState()?.ended) return;
    if (game.scene.isPaused('RiftScene')) { game.scene.resume('RiftScene'); audioManager.resumeAll(); status.textContent = '试验进行中'; }
    else { game.scene.pause('RiftScene'); audioManager.pauseAll(); status.textContent = '试验已暂停；Tab 拾获界面仍遵循不暂停规则。'; }
    recorder?.event('lab:pause', { paused: game.scene.isPaused('RiftScene') });
  }
  function subscribe<T extends GameEvent>(event: T, callback: (payload: EventPayloads[T]) => void): void {
    eventBus.on(event, callback); cleanups.push(() => eventBus.off(event, callback));
  }
  function startRun(): void {
    if (!ready) return;
    let initializationStarted = false;
    try {
      const sceneId = encounter.value as BuildLabSceneId, loadoutId = loadout.value as BuildLabLoadoutId;
      const volumeId = volume.value as BuildLabVolume, seedValue = Number(seed.value);
      // Validate all inputs before stopping the current experiment.
      createBuildLabLayout(sceneId, seedValue, volumeId);
      if (!BUILD_LAB_LOADOUTS.some(row => row.id === loadoutId)) throw new Error('未知装配');
      stopRun(); error.textContent = '';
      initializationStarted = true;
      const runId = prepareBuildLabRun(loadoutId);
      recorder = new BuildLabRecorder({ runId, sceneId, loadoutId, seed: seedValue, volume: volumeId,
        fixtureSignature: buildLabFixtureSignature(sceneId, seedValue, volumeId), codeBaseline: '2d9725f + iteration-21 working tree',
        startedAt: new Date().toISOString(), trainingInventory: true, supplyValidation: false,
        description: BUILD_LAB_LOADOUTS.find(row => row.id === loadoutId)!.description,
        loadoutDefinition: BUILD_LAB_LOADOUTS.find(row => row.id === loadoutId),
        modules: gameState.getState(), growth: growthSystem.getState(), tide: tideSystem.getState(),
        initialAttributes: getSurvivalAttributes(),
        measurement: '100ms read-only simulation samples; stationary time includes observation; alert/engaged are AI states, not inferred player intent. Uses are committed inventory differences. Recorder does not inject inputs.' }, inventoryStore.getState());
      cleanups.push(inventoryStore.subscribe(() => recorder?.inventory(inventoryStore.getState())));
      for (const event of [GameEvent.PLAYER_DAMAGED, GameEvent.ENEMY_DAMAGED, GameEvent.ENEMY_KILLED,
        GameEvent.ENEMY_ALERT, GameEvent.ENEMY_LOST_PLAYER, GameEvent.TOOL_USED,
        GameEvent.KINDLING_COLLECTED, GameEvent.ITEM_COLLECTED, GameEvent.CONTAMINANT_ACQUIRED, GameEvent.PLAYER_DIED]) {
        subscribe(event, payload => recorder?.event(event, payload));
      }
      subscribe(GameEvent.RIFT_EXITED, payload => {
        recorder?.event(GameEvent.RIFT_EXITED, payload);
        archive(payload.survived ? 'extract' : 'death');
        status.textContent = payload.survived ? '真实撤离已结算；R 返回配置。' : '死亡全损已结算；R 返回配置。';
      });
      running = true; abort.disabled = false; pause.disabled = false;
      game.scene.start('RiftScene', { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle(),
        loadout: contaminantSystem.getSortieLoadout(),
        devFixture: { createLayout: () => createBuildLabLayout(sceneId, seedValue, volumeId), onReturn: stopRun, onPause: togglePause } });
      const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
      eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: gameState.getCycle() });
      status.textContent = `试验进行中 · ${sceneId} / ${loadoutId} / ${seedValue}`;
      const query = new URLSearchParams({ scene: sceneId, build: loadoutId, seed: String(seedValue), volume: volumeId });
      history.replaceState(null, '', `${location.pathname}?${query}`);
      document.querySelector<HTMLElement>('#game-container')!.focus();
    } catch (reason) { if (initializationStarted) stopRun(); showError(reason); }
  }
  function describe(): void {
    description.textContent = `${BUILD_LAB_SCENES.find(row => row.id === encounter.value)?.objective ?? ''}。${BUILD_LAB_LOADOUTS.find(row => row.id === loadout.value)?.description ?? ''}。配置变更只在重开后生效。`;
    volume.disabled = encounter.value !== 'periodic';
  }
  for (const control of [encounter, loadout, volume, seed]) {
    control.addEventListener('focus', () => {
      if (running && !game.scene.isPaused('RiftScene') && !scene().probeBuildLabState()?.ended) {
        togglePause(); status.textContent = '配置编辑：当前试验已暂停。新选择只在中止并重开后应用。';
      }
    });
    control.addEventListener('change', describe);
  }
  describe();
  start.onclick = () => { startRun(); start.blur(); };
  abort.onclick = () => { stopRun(); abort.blur(); };
  pause.onclick = () => { togglePause(); pause.blur(); };
  // A paused Phaser scene does not receive its keyboard listeners.
  document.addEventListener('keydown', event => {
    if (event.code === 'Escape' && running && game.scene.isPaused('RiftScene')) { event.preventDefault(); event.stopImmediatePropagation(); togglePause(); }
  }, true);
  document.querySelector<HTMLButtonElement>('#download')!.onclick = () => {
    const exported = [...records, ...(recorder?.record.outcome === 'running' ? [recorder.record] : [])];
    const blob = new Blob([JSON.stringify({ lab: 'iteration-21', trainingInventory: true, supplyValidation: false, records: exported }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `build-lab-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  window.addEventListener('error', event => showError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', event => showError(event.reason));
  const timer = window.setInterval(() => {
    if (!running || !recorder || game.scene.isPaused('RiftScene')) return;
    const sample = scene().probeBuildLabState(); if (!sample) return;
    recorder.sample(sample);
    const metrics = recorder.record.metrics;
    state.textContent = JSON.stringify({ outcome: recorder.record.outcome, elapsedSeconds: Math.round(sample.elapsedMs / 1000),
      hp: sample.hp, chaos: Number(sample.chaos.toFixed(1)), weight: getSurvivalAttributes().weight / 10,
      capacity: inventoryStore.getCapacity() / 10, speedFactor: getSurvivalAttributes().burdenSpeedFactor,
      distancePx: Math.round(metrics.distancePx), stationarySeconds: Math.round(metrics.stationaryMs / 1000),
      alertSeconds: Math.round(metrics.alertMs / 1000), engagedSeconds: Math.round(metrics.engagedMs / 1000),
      committedUses: metrics.consumedUses, revealedNodes: Object.keys(inventoryStore.getRun()?.revealedNodes ?? {}).length,
      returnedItems: inventoryStore.getRun()?.returnedIds?.length ?? 0, kindling: sample.kindling,
      completedRecords: records.length, fixture: recorder.record.metadata.fixtureSignature }, null, 2);
  }, 100);
  window.addEventListener('pagehide', () => { clearInterval(timer); clearRecordListeners(); game.destroy(true); }, { once: true });
  Object.assign(window, { __buildLab: { game,
    getState: () => ({ ready, running, paused: game.scene.isPaused('RiftScene'), snapshot: running ? scene().probeBuildLabState() : null,
      inventory: inventoryStore.getState(), attributes: getSurvivalAttributes(), records: records.length, error: error.textContent }),
    getRecords: () => structuredClone([...records, ...(recorder?.record.outcome === 'running' ? [recorder.record] : [])]),
  } });
} else document.body.textContent = '构筑对照场仅在开发服务器启用。';
