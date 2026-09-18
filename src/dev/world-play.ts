/** Isolated native 2D sortie: map study terrain, unchanged production simulation. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { eventBus } from '@/core/event-bus';
import { BUILD_LAB_LOADOUTS } from '@/generated/build-lab-data';
import { createWorldPlayMap, findWorldPlayRoute, type WorldPlayMap } from '@/generation/world-study/play-map';
import { WORLD_PROFILES } from '@/generation/world-study/profiles';
import { SPACE_PROFILES } from '@/generation/world-study/space-profile';
import { audioManager } from '@/managers/audio-manager';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { BootScene } from '@/scenes/boot-scene';
import { RiftScene, type RiftDevFixture } from '@/scenes/rift-scene';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';
import { contaminantSystem } from '@/systems/contaminant-system';
import { inventoryStore } from '@/systems/inventory-store';
import { createSearchObjectVisual, ensureLootSearchTextures } from '@/systems/loot-search-presentation';
import { GameEvent, type EventPayloads } from '@/types/events';
import type { Vector2 } from '@/types/game-types';
import { bindDomUiRootToGame } from '@/ui/dom/panel-styles';
import { BuildLabRecorder, type BuildLabRecord } from './build-lab-recorder';
import { BuildLabMemoryStorage, prepareBuildLabRun } from './build-lab-session';
import { createWorldPlaySurface, type WorldPlaySurface } from './world-play-surface';

if (import.meta.env.DEV) {
  // Install before BootScene or any session initialization. Never restore browser storage.
  saveManager.setStorage(new BuildLabMemoryStorage());
  const select = (id: string) => document.querySelector<HTMLSelectElement>(`#${id}`)!;
  const button = (id: string) => document.querySelector<HTMLButtonElement>(`#${id}`)!;
  const world = select('world'), space = select('space'), loadout = select('loadout');
  const seed = document.querySelector<HTMLInputElement>('#seed')!;
  const start = button('start'), abort = button('abort'), pause = button('pause');
  const status = document.querySelector<HTMLElement>('#status')!, error = document.querySelector<HTMLElement>('#error')!;
  const state = document.querySelector<HTMLElement>('#state')!, params = new URLSearchParams(location.search);
  for (const row of WORLD_PROFILES) world.add(new Option(row.label, row.id));
  for (const row of SPACE_PROFILES) space.add(new Option(row.label, row.id));
  for (const row of BUILD_LAB_LOADOUTS) loadout.add(new Option(row.name, row.id));
  let admissionError: Error | null = null;
  for (const [control, key] of [[world, 'world'], [space, 'space'], [loadout, 'loadout']] as const) {
    const value = params.get(key);
    if (value !== null) {
      if ([...control.options].some(option => option.value === value)) control.value = value;
      else admissionError = new Error(`Unknown ${key}: ${value}`);
    }
  }
  if (params.has('seed')) seed.value = params.get('seed')!;
  let ready = false, running = false, starting = false, sceneCreated = false;
  let activeMap: WorldPlayMap | null = null, recorder: BuildLabRecorder | null = null;
  let surface: WorldPlaySurface | null = null;
  const records: BuildLabRecord[] = [], cleanups: (() => void)[] = [];
  const scene = () => game.scene.getScene('RiftScene') as RiftScene;
  const showError = (reason: unknown): void => { error.textContent = reason instanceof Error ? reason.stack ?? reason.message : String(reason); };
  if (admissionError) showError(admissionError);
  class WorldPlayBoot extends BootScene {
    override create(): void {
      generatePlaceholderTextures(this); audioManager.bind(this.game); audioManager.unlock();
      ready = true; start.disabled = false; status.textContent = '资源就绪。'; this.scene.stop();
      if (!admissionError && params.get('autostart') !== '0') setTimeout(startRun, 0);
    }
  }
  const game = new Phaser.Game(gameConfigWithScenes([WorldPlayBoot, RiftScene]));
  bindDomUiRootToGame(game);
  function clearListeners(): void {
    let failure: unknown;
    for (const cleanup of cleanups.splice(0)) try { cleanup(); } catch (reason) { failure ??= reason; }
    if (failure) throw failure;
  }
  function archive(outcome: Exclude<BuildLabRecord['outcome'], 'running'>, finalSample = true): void {
    if (!recorder || recorder.record.outcome !== 'running') return;
    if (finalSample && sceneCreated) { const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample); }
    recorder.finish(outcome, inventoryStore.getState()); records.push(recorder.record); clearListeners();
  }
  function stopRun(finalSample = true): void {
    if (!ready) return;
    let failure: unknown;
    const attempt = (action: () => void) => { try { action(); } catch (reason) { failure ??= reason; } };
    attempt(() => archive('aborted', finalSample));
    running = false; starting = false; sceneCreated = false; activeMap = null; surface = null;
    attempt(clearListeners); attempt(() => game.scene.stop('RiftScene')); attempt(() => audioManager.resumeAll());
    start.disabled = false; abort.disabled = true; pause.disabled = true;
    status.textContent = '已停止；本页记录保留。';
    if (failure) throw failure;
  }
  function failStart(reason: unknown): void {
    const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    recorder?.event('world-play:create-failed', { message }); showError(reason);
    try { stopRun(false); } catch (cleanup) { error.textContent = `${message}\n清理异常：${String(cleanup)}`; }
    status.textContent = '创建失败；错误与拒绝原因已保留。';
  }
  function togglePause(): void {
    if (!running || !sceneCreated || scene().probeBuildLabState()?.ended) return;
    if (game.scene.isPaused('RiftScene')) { game.scene.resume('RiftScene'); audioManager.resumeAll(); status.textContent = '出行继续'; }
    else { game.scene.pause('RiftScene'); audioManager.pauseAll(); status.textContent = '已暂停；新配置需重开后生效。'; }
    recorder?.event('world-play:pause', { paused: game.scene.isPaused('RiftScene') });
  }
  function subscribe<T extends GameEvent>(event: T, callback: (payload: EventPayloads[T]) => void): void {
    eventBus.on(event, callback); cleanups.push(() => eventBus.off(event, callback));
  }
  function startRun(): void {
    if (!ready || starting) return;
    let initialized = false;
    try {
      if (admissionError) throw admissionError;
      if (seed.value.trim() === '') throw new Error('Seed is required');
      const map = createWorldPlayMap(world.value, space.value, Number(seed.value));
      const build = BUILD_LAB_LOADOUTS.find(row => row.id === loadout.value);
      if (!build) throw new Error('Unknown loadout');
      stopRun(); initialized = true; error.textContent = ''; activeMap = map;
      const runId = prepareBuildLabRun(build.id);
      recorder = new BuildLabRecorder({ ...map.metadata, runId, startedAt: new Date().toISOString(),
        fixtureSignature: map.metadata.signature, presentationRevision: 'i26-native-2d', loadout: build.id,
        trainingInventory: true, supplyValidation: false, persistence: 'memory-only',
        borrowedNativePileAppearance: 'frag-outdoor; actual item source is the selected world-study profile',
        sightPolicy: 'All VOID is opaque and unlit; same 8px support for terrain, body physics, visibility and navigation.',
        presentationDifference: 'DEV-only unknown-space background is black with native void noise disabled; unseen floor and VOID share that background. Native vision rays, range, light, chaos and controls remain unchanged.',
        extractionGlowRadius: 8,
        extractionPresentation: 'Native marker retained; through-fog glow radius is 8px and wholly inside its 20px-supported seat. Native full-screen damage/chaos feedback is unchanged and is not material illumination.',
        scope: 'Native two-ground-enemy/four-search-node/single-extraction outing. Production map pool and base loop unchanged.',
        measurement: '100ms read-only production state, committed inventory and events. No input or result injection.' }, inventoryStore.getState());
      cleanups.push(inventoryStore.subscribe(() => recorder?.inventory(inventoryStore.getState())));
      for (const event of [GameEvent.PLAYER_DAMAGED, GameEvent.ENEMY_DAMAGED, GameEvent.ENEMY_KILLED, GameEvent.ENEMY_ALERT,
        GameEvent.ENEMY_LOST_PLAYER, GameEvent.TOOL_USED, GameEvent.KINDLING_COLLECTED, GameEvent.ITEM_COLLECTED,
        GameEvent.CONTAMINANT_ACQUIRED, GameEvent.PLAYER_DIED]) subscribe(event, payload => recorder?.event(event, payload));
      subscribe(GameEvent.RIFT_EXITED, payload => {
        recorder?.event(GameEvent.RIFT_EXITED, payload);
        const settled = recorder;
        queueMicrotask(() => {
          if (recorder !== settled) return;
          archive(payload.survived ? 'extract' : 'death');
          status.textContent = payload.survived ? '真实撤离已结算；R 返回配置。' : '死亡全损已结算；R 返回配置。';
        });
      });
      starting = true; start.disabled = true;
      const currentRecorder = recorder;
      const onCreated = (): void => {
        if (recorder !== currentRecorder) return;
        starting = false; sceneCreated = true; running = true;
        start.disabled = false; abort.disabled = false; pause.disabled = false;
        const sample = scene().probeBuildLabState(); if (sample) recorder.sample(sample);
        eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: gameState.getCycle() });
        status.textContent = `${map.sample.profile.label} · 种子 ${map.metadata.effectiveSeed}${map.metadata.attempt ? `（请求 ${map.metadata.requestedSeed}，第 ${map.metadata.attempt + 1} 个候选通过）` : ''}`;
        history.replaceState(null, '', `${location.pathname}?${new URLSearchParams({ world: world.value, space: space.value, loadout: build.id, seed: String(map.metadata.requestedSeed) })}`);
        document.querySelector<HTMLElement>('#game-container')!.focus();
      };
      scene().events.once(Phaser.Scenes.Events.CREATE, onCreated);
      cleanups.push(() => scene().events.off(Phaser.Scenes.Events.CREATE, onCreated));
      game.scene.start('RiftScene', { modifiers: gameState.getSortieModifiers(), cycle: gameState.getCycle(), loadout: contaminantSystem.getSortieLoadout(),
        devFixture: { createLayout: () => map.layout, onReturn: () => stopRun(), returnLabel: '返回配置', onPause: togglePause,
          freezeAfterEnd: true, worldSurface: 'runtime', footstepMaterial: 'soil', suppressVoidNoise: true, extractionGlowRadius: 8,
          createSearchObjectVisual: (targetScene, position, visualSeed, getPlayerPos) => {
            const slots = ensureLootSearchTextures(targetScene, 'frag-outdoor');
            return createSearchObjectVisual(targetScene, position.x, position.y, visualSeed, 'frag-outdoor', slots, getPlayerPos);
          },
          createRuntime: context => { surface = createWorldPlaySurface(context, map.sample); return surface; } } satisfies RiftDevFixture });
    } catch (reason) { if (initialized) failStart(reason); else showError(reason); }
  }
  const describe = () => { document.querySelector<HTMLElement>('#description')!.textContent = BUILD_LAB_LOADOUTS.find(row => row.id === loadout.value)?.description ?? ''; };
  for (const control of [world, space, loadout, seed]) {
    control.addEventListener('focus', () => { if (running && !game.scene.isPaused('RiftScene')) togglePause(); });
    control.addEventListener('change', () => { admissionError = null; error.textContent = ''; describe(); });
  }
  describe(); start.onclick = () => { startRun(); start.blur(); };
  abort.onclick = () => { stopRun(); abort.blur(); }; pause.onclick = () => { togglePause(); pause.blur(); };
  document.addEventListener('keydown', event => {
    if (event.code === 'Escape' && running && game.scene.isPaused('RiftScene')) { event.preventDefault(); event.stopImmediatePropagation(); togglePause(); }
  }, true);
  const getRecords = () => [...records, ...(recorder?.record.outcome === 'running' ? [recorder.record] : [])];
  button('download').onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ study: 'iteration-26-world-play', records: getRecords() }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `world-play-${Date.now()}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const timer = window.setInterval(() => {
    if (!running || !sceneCreated || !recorder || game.scene.isPaused('RiftScene')) return;
    const sample = scene().probeBuildLabState(); if (!sample) return;
    recorder.sample(sample);
    state.textContent = JSON.stringify({ ...activeMap?.metadata, seconds: Math.round(sample.elapsedMs / 1000),
      hp: sample.hp, chaos: Number(sample.chaos.toFixed(1)), remainingSearch: sample.search.remaining, records: records.length }, null, 2);
  }, 100);
  window.addEventListener('error', event => { if (starting) failStart(event.error ?? event.message); else showError(event.error ?? event.message); });
  window.addEventListener('unhandledrejection', event => { if (starting) failStart(event.reason); else showError(event.reason); });
  window.addEventListener('pagehide', () => { clearInterval(timer); clearListeners(); game.destroy(true); }, { once: true });
  Object.assign(window, { __worldPlay: Object.freeze({
    getState: () => structuredClone({ ready, running, starting, sceneCreated, paused: game.scene.isPaused('RiftScene'),
      snapshot: running && sceneCreated ? scene().probeBuildLabState() : null, metadata: activeMap?.metadata ?? null,
      layout: activeMap ? { tileMap: activeMap.layout.tileMap, spawnPoint: activeMap.layout.spawnPoint,
        extractionPoint: activeMap.layout.extractionPoint, kindlingNodes: activeMap.layout.kindlingNodes,
        contaminantNodes: activeMap.layout.contaminantNodes, enemySpawns: activeMap.layout.enemySpawns } : null,
      surface: sceneCreated ? surface?.snapshot() ?? null : null, inventory: inventoryStore.getState(), error: error.textContent }),
    getRecord: () => structuredClone(getRecords()),
    getRoutes: (from: Vector2, to: Vector2) => activeMap ? findWorldPlayRoute(activeMap, from, to) : [],
    inspectPoint: (point: Vector2) => sceneCreated ? surface?.inspectPoint(point) ?? null : null,
  }) });
} else document.body.textContent = '出行验证仅在开发服务器启用。';
