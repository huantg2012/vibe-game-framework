/** One joint title / real-world direction. Production scenes and session logic;
 * independent artwork, texture cache and memory-only save storage. */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { BootScene } from '@/scenes/boot-scene';
import { PurificationScene } from '@/scenes/purification-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { MenuEntryTransition } from '@/scenes/menu-entry-transition';
import { saveManager } from '@/managers/save-manager';
import { audioManager } from '@/managers/audio-manager';
import { inventoryStore } from '@/systems/inventory-store';
import { bindDomUiRootToGame, getDomUiRoot } from '@/ui/dom/panel-styles';
import { pauseMenu } from '@/ui/dom/pause-menu';
import { MainMenuScene } from '@/scenes/main-menu-scene';

declare global { interface Window { __openingJointStorageReady?: boolean; } }
type Phase = 'loading' | 'title' | 'entering' | 'playing' | 'returning' | 'error';
// F is the selected DEV title. Keep the original at ?title=0 and the other
// candidates at ?title=a…e for review, without writing a production preference.
const requestedTitle = new URLSearchParams(location.search).get('title') ?? '';
const TITLE_CANDIDATE = !import.meta.env.DEV || requestedTitle === '0' ? null
  : /^[a-f]$/.test(requestedTitle) ? requestedTitle : 'f';
const TITLE_URL = TITLE_CANDIDATE
  ? `/docs/art/demos/opening-joint/assets/title/candidates/${TITLE_CANDIDATE}.png`
  : '/docs/art/demos/opening-joint/assets/title/master.png';
const ASSETS = { root: '/docs/art/demos/opening-joint/assets/haven/', cachePrefix: 'opening-joint:', exteriorMotion: 'joint-depth' as const };
const status = document.querySelector<HTMLSpanElement>('#joint-status')!;
const returnButton = document.querySelector<HTMLButtonElement>('#return-title')!;
const compareButton = document.querySelector<HTMLButtonElement>('#compare-frames')!;
let phase: Phase = 'loading';
let game: Phaser.Game;
let disposed = false;
let focusPaused = false;
let comparing = false;
let snapshotPending = false;
let capturedHaven: string | null = null;
const focusPausedKeys: string[] = [];
const comparisonPausedKeys: string[] = [];
const focusOverlay = document.createElement('div');
focusOverlay.className = 'joint-focus-pause';
focusOverlay.innerHTML = '已暂停<small>点击画面或按任意键继续</small>';
const comparison = document.createElement('div');
comparison.className = 'joint-compare';
comparison.hidden = true;
comparison.innerHTML = '<img class="joint-compare-image" alt="首页与真实游戏画面直接对照">'
  + '<div class="joint-compare-controls"><button type="button" data-frame="title">1 · 首页</button>'
  + '<button type="button" data-frame="haven">2 · 真实净化点</button><small>无转场对照 · Esc 返回</small></div>';

function refreshControls(message?: string): void {
  document.body.dataset.openingPhase = phase;
  document.body.dataset.titleVariant = TITLE_CANDIDATE ?? 'original';
  returnButton.disabled = phase !== 'playing' || comparing || focusPaused || snapshotPending;
  compareButton.disabled = focusPaused || snapshotPending || (!comparing && !((phase === 'playing' && !!game?.scene.isActive('PurificationScene')) || (phase === 'title' && !!capturedHaven)));
  compareButton.textContent = comparing ? '结束对照' : '直接对照';
  status.textContent = message ?? (comparing ? '首页 / 本次真实渲染截帧'
    : phase === 'playing' ? (game.scene.isActive('RiftScene') ? '裂隙' : '净化点')
    : phase === 'entering' ? '进入中' : phase === 'loading' ? '载入中'
    : TITLE_CANDIDATE === 'f' ? 'F · 手绘块面 · 动态首页'
    : TITLE_CANDIDATE ? `历史候选 ${TITLE_CANDIDATE.toUpperCase()} · 静态对照` : '原版 · 静态对照');
}

function silence(): void {
  for (const voice of [...audioManager.getState().voices]) audioManager.stopInstance(voice.instanceId, 0);
  audioManager.haltNonBgm(0); audioManager.stopBGM(0); audioManager.resumeAll();
}

class JointEntry extends MenuEntryTransition {
  override arrive(...[scene, revealHud, onReady]: Parameters<MenuEntryTransition['arrive']>): void {
    super.arrive(scene, revealHud, () => {
      onReady();
      if (!disposed) { phase = 'playing'; refreshControls(); }
    });
  }
}

/** Only observes the native recovery branch; never forces a Rift record into
 * the haven to fit the presentation. */
class JointRiftScene extends RiftScene {
  override create(data?: Parameters<RiftScene['create']>[0]): void {
    super.create(data);
    phase = 'playing'; refreshControls();
  }
}

class JointTitleScene extends MainMenuScene {
  constructor() {
    super({ artUrl: TITLE_URL, animate: TITLE_CANDIDATE === 'f',
      canInteract: () => phase === 'title' && !focusPaused && !comparing,
      onTitle: () => { phase = 'title'; }, onStatus: refreshControls,
      onEnter: () => { phase = 'entering'; refreshControls(); },
      createTransition: mode => new JointEntry(mode) });
  }
}

function returnToTitle(): void {
  if (disposed || phase !== 'playing' || focusPaused || comparing || snapshotPending) return;
  const rift = game.scene.isActive('RiftScene') || game.scene.isPaused('RiftScene')
    ? game.scene.getScene('RiftScene') as RiftScene : null;
  if (rift && !rift.flushRuntimeCheckpoint()) {
    refreshControls('本趟状态尚未保存，请先完成场内保存。'); return;
  }
  // Rift's successful flush opens its next empty frame transaction. Shutdown
  // discards that empty frame; it must not make the return action permanently
  // unavailable. Other in-flight transactions still prevent leaving.
  if (saveManager.hasPendingSave() || saveManager.hasUncommittedNewRecord() || (!rift && inventoryStore.hasFrameTransaction())) {
    refreshControls('请先完成场内保存，再返回首页。'); return;
  }
  phase = 'returning'; refreshControls(); pauseMenu.discard();
  for (const scene of [...game.scene.scenes]) if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.scene.key);
  silence();
  // Keep the isolated Map. Continue must restore this actual record, including
  // active procedural Rift expeditions, rather than silently creating a new one.
  game.scene.start('MainMenuScene');
}

function pauseScenes(keys: string[]): void {
  keys.length = 0;
  for (const scene of game.scene.scenes) if (scene.scene.isActive()) {
    keys.push(scene.scene.key); game.scene.pause(scene.scene.key);
    scene.input.keyboard?.resetKeys();
  }
}
function resumeScenes(keys: string[]): void {
  for (const key of keys) if (game.scene.isPaused(key)) game.scene.resume(key);
  keys.length = 0;
}
function pauseForFocus(): void {
  if (disposed || phase === 'loading' || focusPaused || pauseMenu.isOpen()) return;
  focusPaused = true; pauseScenes(focusPausedKeys);
  audioManager.pauseAll(); focusOverlay.style.display = 'flex'; refreshControls();
}
function resumeFocus(): void {
  if (!focusPaused || disposed) return;
  focusPaused = false; resumeScenes(focusPausedKeys);
  if (!comparing) audioManager.resumeAll();
  focusOverlay.style.display = 'none'; refreshControls();
}

function selectFrame(frame: 'title' | 'haven'): void {
  comparison.querySelector<HTMLImageElement>('.joint-compare-image')!.src = frame === 'title' ? TITLE_URL : capturedHaven!;
  comparison.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.frame === frame)));
  document.body.dataset.comparisonFrame = frame;
}
function openComparison(): void {
  if (disposed || focusPaused || !capturedHaven) return;
  comparing = true; pauseScenes(comparisonPausedKeys); audioManager.pauseAll();
  comparison.hidden = false; selectFrame('title'); refreshControls();
}
function closeComparison(): void {
  comparing = false; comparison.hidden = true; resumeScenes(comparisonPausedKeys);
  if (!focusPaused) audioManager.resumeAll();
  refreshControls();
}
function compareFrames(): void {
  if (comparing) { closeComparison(); return; }
  if (disposed || focusPaused || snapshotPending) return;
  if (phase === 'title') { openComparison(); return; }
  if (phase !== 'playing' || !game.scene.isActive('PurificationScene')) return;
  if (pauseMenu.isOpen()) { refreshControls('请先关闭场内菜单，再对照画面。'); return; }
  snapshotPending = true; refreshControls('取得当前真实画面');
  // Phaser schedules readback at render completion. Canvas.toDataURL on a
  // non-preserved WebGL buffer would falsely return an empty "actual" image.
  game.renderer.snapshot(snapshot => {
    snapshotPending = false;
    if (disposed) return;
    if (snapshot instanceof HTMLImageElement) {
      capturedHaven = snapshot.src; openComparison();
    } else refreshControls('未能取得画面，请重试。');
  });
}

function onKeys(event: KeyboardEvent): void {
  if (focusPaused) {
    if (!event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); resumeFocus(); }
    return;
  }
  if (!comparing) return;
  event.preventDefault(); event.stopImmediatePropagation();
  if (event.key === 'Escape') closeComparison();
  if (event.code === 'Digit1') selectFrame('title');
  if (event.code === 'Digit2') selectFrame('haven');
}

if (!import.meta.env.DEV || !window.__openingJointStorageReady) {
  phase = 'error'; refreshControls('此独立体验仅在开发服务器中可用。');
} else {
  saveManager.setStorage(localStorage);
  history.replaceState(null, '', location.pathname + location.search);
  game = new Phaser.Game({ ...gameConfigWithScenes([BootScene, JointTitleScene, JointRiftScene, PurificationScene]),
    callbacks: { preBoot: instance => instance.registry.set('lastLightAssetProfile', ASSETS) } });
  bindDomUiRootToGame(game);
  getDomUiRoot().append(focusOverlay, comparison);
  let activeWorld = '';
  game.events.on(Phaser.Core.Events.POST_STEP, () => {
    if (phase !== 'playing' || comparing || focusPaused) return;
    const current = game.scene.isActive('RiftScene') ? 'rift' : game.scene.isActive('PurificationScene') ? 'haven' : '';
    if (current !== activeWorld) { activeWorld = current; refreshControls(); }
  });
  returnButton.addEventListener('click', () => { returnButton.blur(); returnToTitle(); });
  compareButton.addEventListener('click', () => { compareButton.blur(); compareFrames(); });
  comparison.querySelectorAll<HTMLButtonElement>('[data-frame]').forEach(button => button.addEventListener('click', () => selectFrame(button.dataset.frame as 'title' | 'haven')));
  focusOverlay.addEventListener('click', resumeFocus);
  document.addEventListener('keydown', onKeys, true);
  window.addEventListener('blur', pauseForFocus);
  const onError = (event: ErrorEvent): void => {
    document.body.dataset.openingError = event.message;
    refreshControls('体验遇到错误，请重新载入本页。');
  };
  window.addEventListener('error', onError);
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  window.addEventListener('pagehide', () => {
    if (disposed) return;
    if (game.scene.isActive('RiftScene') || game.scene.isPaused('RiftScene')) {
      (game.scene.getScene('RiftScene') as RiftScene).flushRuntimeCheckpoint();
    }
    disposed = true; pauseMenu.discard();
    for (const scene of [...game.scene.scenes]) if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.scene.key);
    silence(); focusOverlay.remove(); comparison.remove();
    window.removeEventListener('blur', pauseForFocus); window.removeEventListener('error', onError);
    document.removeEventListener('keydown', onKeys, true); game.destroy(true);
  }, { once: true });
  refreshControls();
}
