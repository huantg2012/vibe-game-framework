/** DEV-only host for an admitted production map. No browser-save reads or writes. */
import Phaser from 'phaser';
import { RiftGymPerformance } from './rift-gym-performance';
import { gameConfigWithScenes } from '@/config/game-config';
import { eventBus } from '@/core/event-bus';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import type { WorldProductionMap } from '@/generation/world-study/production-map';
import type { GeneratedRiftLayout } from '@/generation/types';
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
  readonly performance: ReturnType<RiftGymPerformance['snapshot']>;
  /** Registry/DOM counts sampled on demand, not a GPU or garbage-collection measurement. */
  readonly resources: RiftGymResourceSnapshot | null;
  readonly ready: boolean;
  readonly running: boolean;
  readonly starting: boolean;
  readonly paused: boolean;
  readonly probe: ReturnType<RiftScene['probeBuildLabState']>;
}

export interface RiftGymResourceSnapshot {
  readonly method: string;
  readonly textureKeys: number;
  readonly registeredTextureCanvases: number;
  readonly domCanvases: number;
  readonly sharedCanvasPoolUsed: number;
  readonly sharedCanvasPoolFree: number;
  readonly displayListEntries: number;
  readonly scenes: readonly {
    readonly key: string;
    readonly active: boolean;
    readonly paused: boolean;
    readonly displayListEntries: number;
  }[];
  readonly soundsRegistered: number;
  readonly soundsPlaying: number;
  readonly soundsPaused: number;
  readonly soundsPendingRemoval: number;
  readonly limitations: string;
}

export interface RiftGymRuntimeOptions {
  readonly performance?: { readonly sampleMs?: number };
  readonly onReady: () => void;
  readonly onState: (state: RiftGymRuntimeState) => void;
  /** A native result/return action; explicit stop() does not recursively call this. */
  readonly onReturn: () => void;
  readonly onError: (reason: unknown) => void;
}

export type RiftGymFixtureOverrides = Partial<Omit<RiftDevFixture,
  'createLayout' | 'productionWorld' | 'onCreateError' | 'onReturn' | 'onPause'>>;

export interface RiftGymRuntime {
  start(map: WorldProductionMap | GeneratedRiftLayout, loadoutId: string, fixtureOverrides?: RiftGymFixtureOverrides): void;
  stop(): void;
  togglePause(): void;
  pause(): void;
  destroy(): void;
  getState(): RiftGymRuntimeState;
  restartPerformanceSample(): void;
}

export function createRiftGymRuntime(options: RiftGymRuntimeOptions): RiftGymRuntime {
  if (!import.meta.env.DEV) throw new Error('The Rift gym is available only in development');
  // Must precede Phaser boot and every inventory/session initialization.
  saveManager.setStorage(new BuildLabMemoryStorage());
  let ready = false, running = false, starting = false, created = false, disposed = false;
  const frameProbe = new RiftGymPerformance(options.performance);
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
  game.events.on(Phaser.Core.Events.PRE_STEP, () => frameProbe.before(running && created && !game.scene.isPaused('RiftScene')));
  game.events.on(Phaser.Core.Events.POST_RENDER, () => frameProbe.after());
  const scene = (): RiftScene => game.scene.getScene('RiftScene') as RiftScene;
  function snapshotResources(): RiftGymResourceSnapshot | null {
    if (disposed || !game.isBooted) return null;
    const keys = game.textures.getTextureKeys();
    const textureCanvases = new Set<HTMLCanvasElement>();
    for (const key of keys) {
      const texture = game.textures.get(key);
      for (const source of texture.source) {
        if (source.image instanceof HTMLCanvasElement) textureCanvases.add(source.image);
      }
      for (const source of texture.dataSource) {
        if (source.image instanceof HTMLCanvasElement) textureCanvases.add(source.image);
      }
    }
    const scenes = game.scene.getScenes(false).map(value => ({
      key: value.sys.settings.key,
      active: value.sys.isActive(),
      paused: value.sys.isPaused(),
      displayListEntries: value.sys.displayList?.length ?? 0,
    }));
    const sounds = game.sound.getAll('');
    let soundsPlaying = 0, soundsPaused = 0, soundsPendingRemoval = 0;
    for (const sound of sounds) {
      if (sound.isPlaying) soundsPlaying++;
      if (sound.isPaused) soundsPaused++;
      if (sound.pendingRemove) soundsPendingRemoval++;
    }
    return {
      method: 'Phaser public texture/scene/sound registries and CanvasPool; current document canvas elements; sampled on getState',
      textureKeys: keys.length,
      registeredTextureCanvases: textureCanvases.size,
      domCanvases: document.querySelectorAll('canvas').length,
      sharedCanvasPoolUsed: Phaser.Display.Canvas.CanvasPool.total(),
      sharedCanvasPoolFree: Phaser.Display.Canvas.CanvasPool.free(),
      displayListEntries: scenes.reduce((sum, value) => sum + value.displayListEntries, 0),
      scenes,
      soundsRegistered: sounds.length, soundsPlaying, soundsPaused, soundsPendingRemoval,
      limitations: 'Counts, not bytes, GPU allocation, decoded audio memory, or GC/leak proof. Texture keys exclude Phaser built-ins; texture canvases are unique registered HTMLCanvasElements, not all detached/offscreen canvases. DOM/CanvasPool counts cover the page, and the pool covers 2D canvases only; free entries remain pooled. Display lists include inactive scenes but count top-level entries, not nested Container children or arbitrary retained objects. Sound counts include pending removal until the manager next updates.',
    };
  }
  function getState(): RiftGymRuntimeState {
    return {
      ready, running, starting, performance: frameProbe.snapshot(),
      resources: snapshotResources(),
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

  function start(map: WorldProductionMap | GeneratedRiftLayout, loadoutId: string, fixtureOverrides?: RiftGymFixtureOverrides): void {
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
        if (disposed || runEpoch !== epoch || !starting) return;
        // Phaser CREATE means the first construction stage returned. The real
        // playable picture may complete over later frames behind the entry fence.
        if (!scene().probeBuildLabState()) return;
        detachCreate?.(); detachCreate = null;
        starting = false; running = true; created = true;
        frameProbe.reset();
        if (game.input.keyboard) game.input.keyboard.enabled = true;
        eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: gameState.getCycle() });
        game.scale.refresh();
        document.querySelector<HTMLElement>('#game-container')?.focus({ preventScroll: true });
        publish();
      };
      scene().events.once(Phaser.Scenes.Events.CREATE, onCreated);
      game.events.on(Phaser.Core.Events.POST_RENDER, onCreated);
      detachCreate = () => { scene().events.off(Phaser.Scenes.Events.CREATE, onCreated); game.events.off(Phaser.Core.Events.POST_RENDER, onCreated); };
      const fixture: RiftDevFixture = {
        ...fixtureOverrides,
        createLayout: () => 'sample' in map ? map.layout : map,
        ...('sample' in map ? { productionWorld: map } : {}),
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
  return { start, stop, pause, togglePause, destroy, getState, restartPerformanceSample: () => frameProbe.reset() };
}
