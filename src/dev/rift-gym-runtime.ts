/** DEV-only host for an admitted production map. No browser-save reads or writes. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { eventBus } from '@/core/event-bus';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import type { WorldProductionMap } from '@/generation/world-study/production-map';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { BootScene } from '@/scenes/boot-scene';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { RiftScene, type RiftDevFixture } from '@/scenes/rift-scene';
import { contaminantSystem } from '@/systems/contaminant-system';
import { GameEvent } from '@/types/events';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { BuildLabMemoryStorage, prepareBuildLabRun } from './build-lab-session';

export interface RiftGymRuntimeState {
  readonly ready: boolean;
  readonly running: boolean;
  readonly starting: boolean;
  readonly paused: boolean;
  readonly probe: ReturnType<RiftScene['probeBuildLabState']>;
}

export interface RiftGymRuntimeOptions {
  readonly onReady: () => void;
  readonly onState: (state: RiftGymRuntimeState) => void;
  /** A native result/return action; explicit stop() does not recursively call this. */
  readonly onReturn: () => void;
  readonly onError: (reason: unknown) => void;
}

export interface RiftGymRuntime {
  start(map: WorldProductionMap, loadoutId: string): void;
  stop(): void;
  togglePause(): void;
  pause(): void;
  destroy(): void;
  getState(): RiftGymRuntimeState;
}

export function createRiftGymRuntime(options: RiftGymRuntimeOptions): RiftGymRuntime {
  if (!import.meta.env.DEV) throw new Error('The Rift gym is available only in development');
  // Must precede Phaser boot and every inventory/session initialization.
  saveManager.setStorage(new BuildLabMemoryStorage());
  let ready = false, running = false, starting = false, created = false, disposed = false;
  let epoch = 0;
  let detachCreate: (() => void) | null = null;

  class RiftGymBoot extends BootScene {
    override create(): void {
      generatePlaceholderTextures(this);
      audioManager.bind(this.game);
      audioManager.unlock();
      if (this.game.input.keyboard) this.game.input.keyboard.enabled = false;
      this.scene.stop();
      ready = true;
      queueMicrotask(() => {
        if (disposed) return;
        publish();
        options.onReady();
      });
    }
  }

  const game = new Phaser.Game(gameConfigWithScenes([RiftGymBoot, RiftScene]));
  bindDomUiRootToGame(game);
  const scene = (): RiftScene => game.scene.getScene('RiftScene') as RiftScene;
  function getState(): RiftGymRuntimeState {
    return {
      ready, running, starting,
      paused: running && created && game.scene.isPaused('RiftScene'),
      probe: running && created ? scene().probeBuildLabState() : null,
    };
  }
  function publish(): void { if (!disposed) options.onState(getState()); }

  /** Run every cleanup even when a partially initialized system fails to shut down. */
  function stop(): void {
    epoch++;
    const stopEpoch = epoch;
    detachCreate?.(); detachCreate = null;
    const hadRun = running || starting || created;
    const creating = starting && !created;
    running = false; starting = false; created = false;
    if (game.input?.keyboard) game.input.keyboard.enabled = false;
    let failure: unknown;
    if (ready && hadRun) {
      if (creating) {
        // Phaser marks a Scene RUNNING after create() returns. Stopping inside a
        // failing create() would be overwritten, reviving a half-destroyed Scene.
        queueMicrotask(() => {
          if (epoch !== stopEpoch || disposed) return;
          try { game.scene.stop('RiftScene'); } catch (reason) { options.onError(reason); }
        });
      } else {
        try { game.scene.stop('RiftScene'); } catch (reason) { failure = reason; }
      }
    }
    try { audioManager.resumeAll(); } catch (reason) { failure ??= reason; }
    publish();
    if (failure !== undefined) options.onError(failure);
  }
  function fail(reason: unknown): void {
    stop();
    options.onError(reason);
  }
  function pause(): void {
    if (disposed || !running || !created || game.scene.isPaused('RiftScene')) return;
    scene().input.keyboard?.resetKeys();
    if (game.input.keyboard) game.input.keyboard.enabled = false;
    game.scene.pause('RiftScene');
    audioManager.pauseAll();
    publish();
  }
  function togglePause(): void {
    if (disposed || !running || !created) return;
    if (game.scene.isPaused('RiftScene')) {
      scene().input.keyboard?.resetKeys();
      if (game.input.keyboard) game.input.keyboard.enabled = true;
      game.scene.resume('RiftScene');
      audioManager.resumeAll();
      document.querySelector<HTMLElement>('#game-container')?.focus({ preventScroll: true });
      publish();
    } else pause();
  }

  function start(map: WorldProductionMap, loadoutId: string): void {
    if (disposed) throw new Error('This Rift gym runtime has been destroyed');
    if (!ready) { options.onError(new Error('试玩资源仍在载入')); return; }
    if (starting) return;
    const loadout = BUILD_LAB_LOADOUTS.find(row => row.id === loadoutId);
    if (!loadout) { options.onError(new Error(`Unknown gym loadout: ${loadoutId}`)); return; }
    stop();
    const runEpoch = epoch;
    try {
      prepareBuildLabRun(loadout.id, {
        catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2,
      });
      starting = true;
      publish();
      const onCreated = (): void => {
        detachCreate = null;
        if (disposed || runEpoch !== epoch || !starting) return;
        starting = false; running = true; created = true;
        if (game.input.keyboard) game.input.keyboard.enabled = true;
        eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: gameState.getCycle() });
        game.scale.refresh();
        document.querySelector<HTMLElement>('#game-container')?.focus({ preventScroll: true });
        publish();
      };
      scene().events.once(Phaser.Scenes.Events.CREATE, onCreated);
      detachCreate = () => scene().events.off(Phaser.Scenes.Events.CREATE, onCreated);
      const fixture: RiftDevFixture = {
        createLayout: () => map.layout,
        productionWorld: map,
        onCreateError: reason => { if (runEpoch === epoch) fail(reason); },
        onReturn: () => {
          if (runEpoch !== epoch) return;
          stop();
          options.onReturn();
        },
        returnLabel: '返回配置',
        onPause: togglePause,
        freezeAfterEnd: true,
      };
      game.scene.start('RiftScene', {
        modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle(),
        loadout: contaminantSystem.getSortieLoadout(), devFixture: fixture,
      });
    } catch (reason) { fail(reason); }
  }

  // A paused Scene does not receive Phaser keyboard events, so Esc resumes here.
  function onKeyDown(event: KeyboardEvent): void {
    if (event.code !== 'Escape' || event.repeat || !running || !game.scene.isPaused('RiftScene')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    togglePause();
  }
  function onVisibility(): void { if (document.visibilityState === 'hidden') pause(); }
  function onError(event: ErrorEvent): void { if (starting || running) fail(event.error ?? event.message); }
  function onRejection(event: PromiseRejectionEvent): void { if (starting || running) fail(event.reason); }
  function destroy(): void {
    if (disposed) return;
    stop(); disposed = true; ready = false;
    clearInterval(timer);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', pause);
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('pagehide', destroy);
    game.destroy(true);
  }
  const timer = window.setInterval(() => { if (running && created) publish(); }, 150);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', pause);
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('pagehide', destroy, { once: true });
  return { start, stop, pause, togglePause, destroy, getState };
}
