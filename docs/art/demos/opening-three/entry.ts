/** DEV comparison: independent key art, shared title, real new-game entry.
 * Storage is isolated before imports in index.html, including direct UI flags.
 */
import Phaser from 'phaser';
import { gameConfigWithScenes } from '@/config/game-config';
import { BootScene } from '@/scenes/boot-scene';
import { PurificationScene } from '@/scenes/purification-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { MenuEntryTransition } from '@/scenes/menu-entry-transition';
import { beginNewExpedition } from '@/managers/session';
import { saveManager } from '@/managers/save-manager';
import { audioManager } from '@/managers/audio-manager';
import { inventoryStore } from '@/systems/inventory-store';
import { bindDomUiRootToGame, getDomUiRoot } from '@/ui/dom/panel-styles';
import { pauseMenu } from '@/ui/dom/pause-menu';

declare global { interface Window { __openingStorageReady?: boolean; } }
type Variant = 'a' | 'b' | 'c';
type Phase = 'loading' | 'title' | 'entering' | 'playing' | 'returning' | 'error';
const names: Record<Variant, string> = { a: 'A · 停留', b: 'B · 维持', c: 'C · 出发' };
const variants: readonly Variant[] = ['a', 'b', 'c'];
const status = document.querySelector<HTMLSpanElement>('#comparison-status')!;
const returnButton = document.querySelector<HTMLButtonElement>('#return-title')!;
const variantButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-variant]')];
const requested = new URLSearchParams(location.search).get('variant');
let selected: Variant = variants.includes(requested as Variant) ? requested as Variant : 'a';
let phase: Phase = 'loading';
let game: Phaser.Game;
let focusPaused = false;
let disposed = false;
let failure = '';
const pausedKeys: string[] = [];
const focusOverlay = document.createElement('div');
focusOverlay.className = 'opening-focus-pause';
focusOverlay.innerHTML = '已暂停<small>点击画面或按任意键继续</small>';

function refreshControls(message?: string): void {
  document.body.dataset.openingPhase = phase;
  document.body.dataset.openingVariant = selected;
  variantButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.variant === selected));
    button.disabled = phase === 'entering' || phase === 'returning' || phase === 'error';
  });
  returnButton.disabled = phase !== 'playing';
  status.textContent = message ?? `${names[selected]}${phase === 'playing' ? ' · 净化点' : phase === 'entering' ? ' · 进入中' : ''}`;
}

function silence(): void {
  for (const voice of [...audioManager.getState().voices]) audioManager.stopInstance(voice.instanceId, 0);
  audioManager.haltNonBgm(0);
  audioManager.stopBGM(0);
  audioManager.resumeAll();
}

/** Preserve the production veil, scene clock and input release, including
 * reduced motion. All three concepts use the same timing for a fair comparison.
 */
class ComparisonEntry extends MenuEntryTransition {
  override arrive(...[scene, revealHud, onReady]: Parameters<MenuEntryTransition['arrive']>): void {
    super.arrive(scene, revealHud, () => {
      onReady();
      if (disposed) return;
      phase = 'playing';
      refreshControls();
    });
  }
}

class OpeningTitleScene extends Phaser.Scene {
  private titleRoot: HTMLDivElement | null = null;
  private transition: MenuEntryTransition | null = null;
  private handedOff = false;
  private generation = 0;
  private ready = false;
  private abort: AbortController | null = null;

  constructor() { super({ key: 'MainMenuScene' }); }

  create(): void {
    this.transition = null;
    this.handedOff = false;
    this.ready = false;
    this.input.enabled = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const generation = ++this.generation;
    const id = selected;
    phase = 'title';
    refreshControls(`${names[id]} · 画面载入中`);
    const root = document.createElement('div');
    root.className = 'opening-title';
    root.dataset.variant = id;
    root.innerHTML = '<img class="opening-art" alt="" draggable="false">'
      + '<div class="opening-copy"><h1>那天之后</h1><p class="opening-english">AFTER THAT DAY</p>'
      + '<button class="opening-start" type="button" disabled>开始</button></div>'
      + '<div class="opening-load-note" role="status">画面载入中</div>';
    this.titleRoot = root;
    getDomUiRoot().appendChild(root);
    const start = root.querySelector<HTMLButtonElement>('.opening-start')!;
    const art = root.querySelector<HTMLImageElement>('.opening-art')!;
    const note = root.querySelector<HTMLDivElement>('.opening-load-note')!;
    start.addEventListener('click', () => this.start(), { signal });
    root.addEventListener('pointerdown', () => audioManager.unlock(), { signal });
    document.addEventListener('keydown', event => {
      if (phase !== 'title' || focusPaused || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest('.comparison-controls')) return;
      if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); this.start(); }
    }, { signal });
    const loadArt = async (): Promise<void> => {
      note.textContent = '画面载入中';
      start.disabled = true;
      this.ready = false;
      // A runtime URL permits the independent art assets to arrive after this
      // fixture has been built; no placeholder is substituted for missing art.
      art.src = `/docs/art/demos/opening-three/assets/${id}.png`;
      try {
        await art.decode();
        if (signal.aborted || generation !== this.generation) return;
        if (art.naturalWidth !== 1536 || art.naturalHeight !== 1024) throw new Error('画面尺寸应为 1536 × 1024');
        art.classList.add('is-ready');
        note.textContent = '';
        this.ready = true;
        start.disabled = false;
        refreshControls();
      } catch {
        if (signal.aborted || generation !== this.generation) return;
        note.textContent = '这一版画面尚未就绪。';
        const retry = document.createElement('button');
        retry.type = 'button'; retry.className = 'opening-retry'; retry.textContent = '重新载入';
        retry.addEventListener('click', () => { art.removeAttribute('src'); void loadArt(); }, { once: true, signal });
        note.append(document.createElement('br'), retry);
        refreshControls(`${names[id]} · 等待画面`);
      }
    };
    void loadArt();
    audioManager.unlock();
    audioManager.playBGM('bgm-menu-void-pad');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++;
      this.abort?.abort(); this.abort = null;
      this.titleRoot?.remove(); this.titleRoot = null;
      if (!this.handedOff) this.transition?.destroy();
      this.transition = null;
      this.ready = false;
    });
  }

  private start(): void {
    if (!this.ready || this.transition || phase !== 'title' || focusPaused) return;
    this.ready = false;
    this.titleRoot?.querySelector<HTMLButtonElement>('.opening-start')?.setAttribute('disabled', '');
    audioManager.unlock();
    const entered = beginNewExpedition(this, () => {
      phase = 'entering'; refreshControls();
      audioManager.playSFX('sfx-ui-click');
      this.input.enabled = false;
      const copy = this.titleRoot?.querySelector<HTMLElement>('.opening-copy');
      if (copy) copy.style.opacity = '0';
      const transition = new ComparisonEntry('new');
      this.transition = transition;
      transition.depart(this, [], () => {
        this.handedOff = true;
        this.scene.start('PurificationScene', { fromMenu: true, menuEntry: transition });
      });
    }, true);
    if (!entered) {
      this.ready = true;
      this.titleRoot?.querySelector<HTMLButtonElement>('.opening-start')?.removeAttribute('disabled');
      refreshControls('临时记录未就绪，请返回后重试。');
    }
  }
}

function returnToTitle(id: Variant): void {
  if (disposed || phase === 'entering' || phase === 'returning' || phase === 'error') return;
  if (phase === 'loading') { selected = id; refreshControls('载入中'); return; }
  if (saveManager.hasPendingSave() || saveManager.hasUncommittedNewRecord() || inventoryStore.hasFrameTransaction()) {
    refreshControls('请先完成场内保存，再返回首页。'); return;
  }
  phase = 'returning'; refreshControls();
  pauseMenu.discard();
  focusPaused = false;
  pausedKeys.length = 0;
  focusOverlay.style.display = 'none';
  // Direct SceneManager operations avoid queued ScenePlugin stops from a
  // closing scene accidentally stopping its newly restarted replacement.
  for (const scene of [...game.scene.scenes]) {
    if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.scene.key);
  }
  silence();
  selected = id;
  localStorage.clear();
  localStorage.setItem('coh_locale', 'zh-CN');
  game.scene.start('MainMenuScene');
}

function pauseForFocus(): void {
  if (disposed || phase === 'loading' || focusPaused || pauseMenu.isOpen()) return;
  focusPaused = true;
  pausedKeys.length = 0;
  for (const scene of game.scene.scenes) if (scene.scene.isActive()) {
    pausedKeys.push(scene.scene.key); game.scene.pause(scene.scene.key);
  }
  audioManager.pauseAll();
  focusOverlay.style.display = 'flex';
}
function resumeFocus(): void {
  if (!focusPaused || disposed) return;
  focusPaused = false;
  for (const key of pausedKeys) if (game.scene.isPaused(key)) game.scene.resume(key);
  pausedKeys.length = 0;
  audioManager.resumeAll();
  focusOverlay.style.display = 'none';
}
function onKeys(event: KeyboardEvent): void {
  if (focusPaused) { if (!event.repeat) { event.preventDefault(); event.stopImmediatePropagation(); resumeFocus(); } return; }
  if (phase !== 'title' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
  if (index >= 0) { event.preventDefault(); returnToTitle(variants[index]!); }
}

if (!import.meta.env.DEV || !window.__openingStorageReady) {
  phase = 'error'; refreshControls('此独立体验仅在开发服务器中可用。');
} else {
  saveManager.setStorage(localStorage);
  // Never allow an inherited dev deep link to bypass the title being compared.
  history.replaceState(null, '', location.pathname + location.search);
  game = new Phaser.Game(gameConfigWithScenes([BootScene, OpeningTitleScene, RiftScene, PurificationScene]));
  bindDomUiRootToGame(game);
  getDomUiRoot().appendChild(focusOverlay);
  variantButtons.forEach(button => button.addEventListener('click', () => {
    button.blur(); returnToTitle(button.dataset.variant as Variant);
  }));
  returnButton.addEventListener('click', () => { returnButton.blur(); returnToTitle(selected); });
  focusOverlay.addEventListener('click', resumeFocus);
  document.addEventListener('keydown', onKeys, true);
  window.addEventListener('blur', pauseForFocus);
  const onError = (event: ErrorEvent): void => {
    failure = event.message;
    document.body.dataset.openingError = failure;
    refreshControls('体验遇到错误，请重新载入本页。');
  };
  window.addEventListener('error', onError);
  // pagehide also covers the back/forward cache. A restored page must create a
  // fresh game and memory record instead of resuming the destroyed instance.
  window.addEventListener('pageshow', event => {
    if (event.persisted) location.reload();
  });
  window.addEventListener('pagehide', () => {
    if (disposed) return;
    disposed = true;
    pauseMenu.discard();
    for (const scene of [...game.scene.scenes]) if (scene.scene.isActive() || scene.scene.isPaused()) game.scene.stop(scene.scene.key);
    silence();
    focusOverlay.remove();
    window.removeEventListener('blur', pauseForFocus);
    window.removeEventListener('error', onError);
    document.removeEventListener('keydown', onKeys, true);
    game.destroy(true);
  }, { once: true });
  refreshControls('载入中');
}
