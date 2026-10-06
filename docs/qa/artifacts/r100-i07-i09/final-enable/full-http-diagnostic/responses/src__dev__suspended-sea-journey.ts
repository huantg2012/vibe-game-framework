import { SeaJourneyStorage } from './suspended-sea/recovery';
import { pauseMenu } from '@/ui/dom/pause-menu';
import type { RiftCheckpoint } from '@/types/rift-checkpoint';
import type { RiftRecoveryState } from '@/systems/rift-recovery-state';
/** DEV-only base ↔ native Rift expedition. All player actions use the original scenes. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { eventBus } from '@/core/event-bus';
import { audioManager } from '@/managers/audio-manager';
import { BootScene } from '@/scenes/boot-scene';
import { PurificationScene, type PurificationDevSession, type PurificationDepartureData } from '@/scenes/purification-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { inventoryStore } from '@/systems/inventory-store';
import { GameEvent, type EventPayloads } from '@/types/events';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { BuildLabRecorder, type BuildLabRecord } from './build-lab-recorder';
import { createSuspendedSeaFixture } from './suspended-sea/fixture';
import { SuspendedSeaJourneySession } from './suspended-sea/journey-session';
import type { SuspendedSeaRuntime } from './suspended-sea/runtime';
import { resolveSuspendedSeaOptions, type SuspendedSeaWorld } from './suspended-sea/world';
import seaMaterialUrl from './spatial-study/assets/sea-water-r1.png';

if (import.meta.env.DEV) {
  const controls = document.querySelector<HTMLElement>('#journey-controls')!;
  const sceneChoice = controls.querySelector<HTMLSelectElement>('#scene')!;
  const seed = controls.querySelector<HTMLInputElement>('#seed')!;
  const pause = controls.querySelector<HTMLButtonElement>('#pause')!;
  const status = controls.querySelector<HTMLElement>('#status')!;
  const error = controls.querySelector<HTMLElement>('#error')!;
  const summary = controls.querySelector<HTMLElement>('#state')!;
  const container = document.querySelector<HTMLElement>('#game-container')!;
  const params = new URLSearchParams(location.search);
  const persistent = params.get('resume') === '1';
  if (persistent) {
    controls.querySelector('h1')!.textContent = '悬海 · 连续旅程';
    status.textContent = '自动保存完整行程 · 刷新后继续原局。';
    controls.querySelector('p')!.textContent = '从正式初始撬棍出发，亲自带回、供奉并装配物件。本页使用独立的悬海记录，退出或刷新后继续同一趟；只有暂停菜单中明确放弃才结损。原游戏记录保留。';
  }
  try {
    const selection = resolveSuspendedSeaOptions({ scene: params.get('scene'), seed: params.get('seed') ?? '19' });
    sceneChoice.value = selection.scene; seed.value = String(selection.seed);
  } catch (reason) { error.textContent = String(reason); }
  let runtime: SuspendedSeaRuntime | null = null;
  let recorder: BuildLabRecorder | null = null;
  let sceneReady = false, closed = false;
  let currentScene: 'PurificationScene' | 'RiftScene' | null = null;
  const records: { gameplay: BuildLabRecord; space: Record<string, unknown>[] }[] = [];
  let space: Record<string, unknown>[] = [];
  const cleanups: (() => void)[] = [];
  const session = new SuspendedSeaJourneySession({ enterBase, enterRift }, persistent ? new SeaJourneyStorage(localStorage) : undefined, persistent);
  const devSession: PurificationDevSession = {
    prepareDeparture: () => session.prepareDeparture({ scene: sceneChoice.value, seed: seed.value }),
    onPause: togglePause,
  };
  class JourneyBoot extends BootScene {
    override preload(): void { super.preload(); this.load.image('spatial-sea-material', seaMaterialUrl); }
    override create(): void {
      generatePlaceholderTextures(this); audioManager.bind(this.game); audioManager.unlock();
      this.scene.stop();
      session.initialize(this);
    }
  }
  const game = new Phaser.Game(gameConfigWithScenes([JourneyBoot, PurificationScene, RiftScene]));
  bindDomUiRootToGame(game);
  const base = () => game.scene.getScene('PurificationScene') as PurificationScene;
  const rift = () => game.scene.getScene('RiftScene') as RiftScene;

  function created(key: 'PurificationScene' | 'RiftScene', callback: () => void): void {
    const scene = game.scene.getScene(key);
    const onCreated = () => {
      if (closed || currentScene !== key) return;
      sceneReady = true; callback(); container.focus();
    };
    scene.events.once(Phaser.Scenes.Events.CREATE, onCreated);
    cleanups.push(() => scene.events.off(Phaser.Scenes.Events.CREATE, onCreated));
  }
  function enterBase(initial: boolean): void {
    if (closed) return;
    // Settlement has already been committed and emitted by RunController.
    // PurificationScene reads that same ledger and performs the real impact once.
    sceneReady = false; currentScene = 'PurificationScene'; runtime = null;
    game.scene.stop('RiftScene'); audioManager.resumeAll();
    created('PurificationScene', () => { status.textContent = '净化点 · 在入口备行出发。'; });
    game.scene.start('PurificationScene', { fromMenu: initial, devSession });
  }
  function enterRift(world: SuspendedSeaWorld, data: PurificationDepartureData, checkpoint?: RiftCheckpoint<RiftRecoveryState>): void {
    if (closed) return;
    sceneReady = false; currentScene = 'RiftScene';
    recorder = new BuildLabRecorder({ ...world.metadata, runId: inventoryStore.getRun()!.id,
      startedAt: new Date().toISOString(), trainingInventory: false, temporaryMemorySession: !persistent,
      supplyValidation: false, presentationRevision: 'i22-base-journey', cameraMode: 'follow',
      entryDurationMs: world.entryDurationMs,
      measurement: 'Formal scenes, original inventory IDs and charges; real input only. No grants or synthetic impacts.' }, inventoryStore.getState());
    space = []; records.push({ gameplay: recorder.record, space });
    game.scene.stop('PurificationScene');
    created('RiftScene', () => { session.markRiftReady(); status.textContent = `悬海 · ${world.metadata.sceneName} · 种子 ${world.metadata.seed}`; });
    game.scene.start('RiftScene', { ...data, devFixture: createSuspendedSeaFixture(world, {
      recovery: persistent ? { checkpoint } : undefined,
      onReturn: () => { session.returnToBase(); }, onPause: togglePause,
      onRuntime: value => { runtime = value; }, recordEvent: (event, payload) => recorder?.event(event, payload),
    }) });
  }
  function togglePause(): void {
    if (!currentScene || !sceneReady || closed || (currentScene === 'RiftScene' && rift().probeBuildLabState()?.ended)) return;
    if (persistent && currentScene === 'RiftScene') {
      if (pauseMenu.isOpen()) pauseMenu.close();
      else if (rift().flushRuntimeCheckpoint()) rift().openRecoveredPauseMenu();
      return;
    }
    if (game.scene.isPaused(currentScene)) { game.scene.resume(currentScene); audioManager.resumeAll(); }
    else { game.scene.pause(currentScene); audioManager.pauseAll(); }
    recorder?.event('journey:pause', { scene: currentScene, paused: game.scene.isPaused(currentScene) });
    pause.blur(); container.focus();
  }
  function subscribe<T extends GameEvent>(event: T, callback: (payload: EventPayloads[T]) => void): void {
    eventBus.on(event, callback); cleanups.push(() => eventBus.off(event, callback));
  }
  cleanups.push(inventoryStore.subscribe(() => recorder?.inventory(inventoryStore.getState())));
  for (const event of [GameEvent.PLAYER_DAMAGED, GameEvent.ENEMY_DAMAGED, GameEvent.ENEMY_KILLED, GameEvent.ENEMY_ALERT,
    GameEvent.ENEMY_LOST_PLAYER, GameEvent.TOOL_USED, GameEvent.KINDLING_COLLECTED, GameEvent.ITEM_COLLECTED,
    GameEvent.CONTAMINANT_ACQUIRED, GameEvent.PLAYER_DIED]) subscribe(event, payload => recorder?.event(event, payload));
  subscribe(GameEvent.RIFT_EXITED, payload => {
    const record = recorder; record?.event(GameEvent.RIFT_EXITED, payload);
    queueMicrotask(() => {
      if (record !== recorder || !record || closed) return;
      if (sceneReady && currentScene === 'RiftScene') {
        const sample = rift().probeBuildLabState(); if (sample) record.sample(sample);
        if (runtime) space.push(runtime.snapshot());
      }
      record.finish(payload.survived ? 'extract' : 'death', inventoryStore.getState());
      status.textContent = '本趟已真实结算 · 按 R 返回原净化点。';
    });
  });
  const onEsc = (event: KeyboardEvent) => {
    if (persistent && currentScene === 'RiftScene') return;
    if (event.code === 'Escape' && currentScene && game.scene.isPaused(currentScene)) {
      event.preventDefault(); event.stopImmediatePropagation(); togglePause();
    }
  };
  document.addEventListener('keydown', onEsc, true);
  cleanups.push(() => document.removeEventListener('keydown', onEsc, true));
  const onError = (event: ErrorEvent) => {
    error.textContent = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message;
    if (!sceneReady) { session.fail(event.error ?? event.message); if (currentScene) game.scene.stop(currentScene); }
  };
  window.addEventListener('error', onError); cleanups.push(() => window.removeEventListener('error', onError));
  pause.onclick = togglePause;
  for (const control of [sceneChoice, seed]) control.addEventListener('change', () => { error.textContent = ''; control.blur(); container.focus(); });
  const exportRecord = () => structuredClone({ schemaVersion: 1, study: 'iteration-22-suspended-sea-base-journey',
    temporaryMemorySession: !persistent, trainingInventory: false, supplyValidation: false,
    session: session.snapshot(), ledger: session.exportLedger(), records });
  controls.querySelector<HTMLButtonElement>('#download')!.onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportRecord(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `sea-journey-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const readFrame = () => ({ session: session.snapshot(), activeScene: currentScene, ready: sceneReady,
    paused: !!currentScene && game.scene.isPaused(currentScene),
    base: sceneReady && currentScene === 'PurificationScene' ? base().probeJourneyState() : null,
    rift: sceneReady && currentScene === 'RiftScene' ? rift().probeBuildLabState() : null,
    space: sceneReady && currentScene === 'RiftScene' ? runtime?.snapshot() ?? null : null });
  Object.defineProperty(window, '__suspendedSeaJourney', { configurable: true, value: Object.freeze({ read: readFrame, export: exportRecord }) });
  const timer = window.setInterval(() => {
    if (closed) return;
    const snapshot = session.snapshot();
    const canChoose = sceneReady && currentScene === 'PurificationScene' && snapshot.phase === 'base' && !snapshot.pendingSave;
    sceneChoice.disabled = !canChoose; seed.disabled = !canChoose;
    pause.disabled = !sceneReady || !currentScene || snapshot.phase === 'faulted';
    pause.textContent = currentScene && game.scene.isPaused(currentScene) ? '继续（Esc）' : '暂停（Esc）';
    summary.textContent = JSON.stringify({ phase: snapshot.phase, cycle: snapshot.game.cycle, tide: snapshot.tide,
      runId: snapshot.runId, boundaries: snapshot.boundaries, pendingSave: snapshot.pendingSave }, null, 2);
    if (snapshot.fault) error.textContent = snapshot.fault;
    if (!sceneReady || currentScene !== 'RiftScene' || game.scene.isPaused('RiftScene') || !runtime || !recorder) return;
    const sample = rift().probeBuildLabState(); if (!sample) return;
    recorder.sample(sample);
    if (recorder.record.outcome === 'running' && space.length < 36000) space.push(runtime.snapshot());
  }, 100);
  window.addEventListener('pagehide', () => {
    if (closed) return;
    if (persistent && sceneReady && currentScene === 'RiftScene') rift().flushRuntimeCheckpoint();
    closed = true; sceneReady = false; session.close(); window.clearInterval(timer);
    for (const cleanup of cleanups.splice(0)) cleanup();
    game.destroy(true);
  }, { once: true });
}
