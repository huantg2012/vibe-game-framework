/** Selected F title, shared with the isolated art review. Scene clocks own
 * motion; the existing session and transition own all persistent game actions. */
import Phaser from 'phaser';
import { JointTitleMotion } from '@/art/title-motion';
import { MenuEntryTransition } from './menu-entry-transition';
import { abandonInterruptedExpedition, beginNewExpedition, hasReadableSave, loadExpedition,
  type ExpeditionEntryMode } from '@/managers/session';
import { saveManager } from '@/managers/save-manager';
import { audioManager } from '@/managers/audio-manager';
import { getDomUiRoot } from '@/ui/dom/panel-styles';
import { t } from '@/i18n';
import '@/ui/dom/main-menu.css';

export const TITLE_ART_URL = '/assets/art/menu-refuge-f.png';
type MenuMode = 'root' | 'overwrite' | 'abandon';
interface MenuAction { label: string; run: () => void; }
/** Review hooks never change the production storage or session implementation. */
interface TitlePresentation {
  artUrl?: string;
  animate?: boolean;
  canInteract?: () => boolean;
  onTitle?: () => void;
  onStatus?: (message?: string) => void;
  onEnter?: () => void;
  createTransition?: (mode: ExpeditionEntryMode) => MenuEntryTransition;
}

export class MainMenuScene extends Phaser.Scene {
  private titleRoot: HTMLDivElement | null = null;
  private transition: MenuEntryTransition | null = null;
  private handedOff = false;
  private generation = 0;
  private ready = false;
  private mode: MenuMode = 'root';
  private actions: MenuAction[] = [];
  private selected = 0;
  private abort: AbortController | null = null;
  private motion: JointTitleMotion | null = null;

  constructor(private readonly presentation: TitlePresentation = {}) { super({ key: 'MainMenuScene' }); }

  create(data?: { recoveryError?: string }): void {
    this.transition = null; this.handedOff = false; this.ready = false;
    this.mode = 'root'; this.input.enabled = true;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    const generation = ++this.generation;
    this.presentation.onTitle?.(); this.presentation.onStatus?.('画面载入中');
    const root = document.createElement('div');
    root.className = 'joint-title'; root.dataset.titleVariant = this.presentation.animate === false ? 'historical' : 'f';
    root.innerHTML = '<img class="joint-art" alt="" draggable="false">'
      + '<div class="joint-copy"><h1>那天之后</h1><p class="joint-english">AFTER THAT DAY</p>'
      + '<p class="joint-warning" hidden></p><div class="joint-actions" aria-label="游戏菜单"></div>'
      + '<div class="joint-summary" hidden></div><p class="joint-back-hint" hidden>Esc 返回</p></div><div class="joint-load-note" role="status"></div>';
    this.titleRoot = root;
    getDomUiRoot().appendChild(root);
    this.renderMenu();
    if (data?.recoveryError) {
      if (saveManager.canAbandonInterruptedRun()) this.renderMenu('abandon');
      else this.warn(data.recoveryError);
    }
    root.addEventListener('pointerdown', () => audioManager.unlock(), { signal });
    document.addEventListener('keydown', event => this.keyDown(event), { signal });
    const art = root.querySelector<HTMLImageElement>('.joint-art')!;
    const note = root.querySelector<HTMLDivElement>('.joint-load-note')!;
    const loadArt = async (): Promise<void> => {
      this.ready = false; this.refreshActions(); note.textContent = '画面载入中';
      art.src = this.presentation.artUrl ?? TITLE_ART_URL;
      try {
        await art.decode();
        if (signal.aborted || generation !== this.generation) return;
        if (art.naturalWidth < 960 || Math.abs(art.naturalWidth / art.naturalHeight - 1.5) > .002) {
          throw new Error('Expected a 3:2 title image at least 960 pixels wide.');
        }
        art.classList.add('is-ready'); note.textContent = '';
        this.motion?.destroy();
        // Motion is authored for F's exact emitters and silhouettes. Historical
        // images stay static rather than inheriting another image's masks.
        this.motion = this.presentation.animate !== false ? new JointTitleMotion(art) : null;
        if (this.motion) art.after(this.motion.canvas);
        this.ready = true; this.refreshActions(); this.presentation.onStatus?.();
      } catch {
        if (signal.aborted || generation !== this.generation) return;
        note.textContent = '画面未能载入。';
        const retry = document.createElement('button');
        retry.type = 'button'; retry.className = 'joint-retry'; retry.textContent = '重新载入';
        retry.addEventListener('click', () => { art.removeAttribute('src'); void loadArt(); }, { once: true, signal });
        note.append(document.createElement('br'), retry); this.presentation.onStatus?.('等待画面');
      }
    };
    void loadArt();
    audioManager.unlock(); audioManager.playBGM('bgm-menu-void-pad');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.generation++; this.abort?.abort(); this.abort = null;
      this.motion?.destroy(); this.motion = null;
      this.titleRoot?.remove(); this.titleRoot = null;
      if (!this.handedOff) { this.transition?.destroy(); audioManager.haltNonBgm(); }
      this.transition = null; this.ready = false;
    });
  }

  update(_time: number, delta: number): void { this.motion?.update(delta); }

  private renderMenu(mode: MenuMode = 'root'): void {
    if (!this.titleRoot) return;
    this.mode = mode; this.selected = 0; this.titleRoot.dataset.menuMode = mode;
    const warning = this.titleRoot.querySelector<HTMLParagraphElement>('.joint-warning')!;
    warning.hidden = mode === 'root';
    this.titleRoot.querySelector<HTMLParagraphElement>('.joint-back-hint')!.hidden = mode === 'root';
    this.titleRoot.querySelector<HTMLParagraphElement>('.joint-english')!.hidden = mode !== 'root';
    if (mode === 'overwrite') {
      const tideNumber = saveManager.peekTideNumber();
      warning.textContent = tideNumber === null
        ? '已有记录暂时无法读取。清除后将永久替换这份记录。'
        : t('menu.overwriteWarning', { tideNumber });
      this.actions = [hasReadableSave()
        ? { label: '继续已保存的记录', run: () => this.continueRecord() }
        : { label: '保留记录，返回', run: () => this.renderMenu() },
        { label: t('menu.overwriteClear'), run: () => this.startNew(true) }];
    } else if (mode === 'abandon') {
      warning.textContent = '这趟出行暂时无法恢复。可保留原记录，或明确放弃随身物后回到原净化点。基地收存与成长保留，归来冲击结算一次。';
      this.actions = [{ label: '保留记录，返回', run: () => this.renderMenu() },
        { label: '确认放弃本趟，返回净化点', run: () => abandonInterruptedExpedition(this, this.enter) }];
    } else {
      this.actions = [];
      if (hasReadableSave()) this.actions.push({ label: '继续', run: () => this.continueRecord() });
      this.actions.push({ label: this.actions.length ? '重新开始' : '开始', run: () => {
        if (saveManager.getRecordPresence() === 'present') this.renderMenu('overwrite');
        else this.startNew();
      } });
    }
    this.renderSummary(mode === 'root');
    const container = this.titleRoot.querySelector<HTMLDivElement>('.joint-actions')!;
    container.replaceChildren();
    this.actions.forEach((action, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'joint-action'; button.textContent = action.label;
      // A replaced confirmation under a stationary pointer keeps its safe default.
      button.addEventListener('pointermove', () => { if (this.interactive()) { this.selected = index; this.refreshActions(); } });
      button.addEventListener('focus', () => { if (this.interactive()) { this.selected = index; this.refreshActions(); } });
      button.addEventListener('click', () => { this.selected = index; this.activate(); });
      container.appendChild(button);
    });
    this.refreshActions();
  }


  private interactive(): boolean {
    return this.ready && !this.transition && this.input.enabled && this.scene.isActive()
      && !this.scene.isPaused() && this.presentation.canInteract?.() !== false;
  }

  private renderSummary(visible: boolean): void {
    const container = this.titleRoot!.querySelector<HTMLDivElement>('.joint-summary')!;
    container.replaceChildren();
    const summary = visible && hasReadableSave() ? saveManager.peekRecordSummary() : null;
    container.hidden = !summary;
    if (!summary) return;
    const phaseKey = summary.phase === 'rise' ? 'menu.phaseRise'
      : summary.phase === 'crest' ? 'menu.phaseCrest' : 'menu.phaseEbb';
    const rows = [
      [t('menu.summaryTide'), t('menu.tideNth', { n: summary.tideNumber }), t(phaseKey)],
      [t('menu.summaryCycle'), String(summary.cycle)],
      [t('menu.summaryStability'), `${Math.round(summary.progress)}%`,
        t(summary.reached ? 'menu.stabilityComplete' : 'menu.stabilityIncomplete')],
    ];
    for (const fields of rows) {
      const row = document.createElement('div'); row.className = 'joint-summary-row';
      for (const text of fields) { const span = document.createElement('span'); span.textContent = text; row.appendChild(span); }
      container.appendChild(row);
    }
  }

  private refreshActions(): void {
    this.titleRoot?.querySelectorAll<HTMLButtonElement>('.joint-action').forEach((button, index) => {
      button.disabled = !this.ready || !!this.transition;
      button.setAttribute('aria-current', index === this.selected ? 'true' : 'false');
      button.classList.toggle('is-selected', index === this.selected);
    });
  }

  private warn(message: string): void {
    const warning = this.titleRoot?.querySelector<HTMLParagraphElement>('.joint-warning');
    if (warning) { warning.hidden = false; warning.textContent = message; }
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('.joint-controls, .joint-retry')) return;
    const menuKey = ['Escape', 'ArrowUp', 'ArrowDown', 'Enter'].includes(event.key) || event.code === 'Space';
    if (!menuKey) return;
    // Suppress native focused-button activation even for repeats or while the
    // scene is paused: held Enter must not turn a resume into a new action.
    event.preventDefault();
    if (!this.interactive() || event.repeat) return;
    if (event.key === 'Escape' && this.mode !== 'root') { event.preventDefault(); this.renderMenu(); }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); this.selected = (this.selected + (event.key === 'ArrowDown' ? 1 : -1) + this.actions.length) % this.actions.length;
      this.refreshActions(); audioManager.playSFX('sfx-ui-hover');
    }
    if (event.key === 'Enter' || event.code === 'Space') { event.preventDefault(); this.activate(); }
  }

  private activate(): void {
    if (!this.interactive()) return;
    audioManager.unlock(); audioManager.playSFX('sfx-ui-click'); this.actions[this.selected]?.run();
  }

  private startNew(confirmedReplacement = false): void {
    if (!beginNewExpedition(this, this.enter, confirmedReplacement)) this.warn('无法安全创建记录。当前进度未重置，请重试。');
  }

  private continueRecord(): void {
    // Native Rift recovery queues a scene directly without the haven entry
    // callback. Lock repeated clicks until that queued operation completes.
    this.ready = false; this.refreshActions();
    loadExpedition(this, this.enter, () => this.renderMenu('abandon'));
    if (!this.transition) this.time.delayedCall(0, () => {
      if (!this.titleRoot || !this.scene.isActive()) return;
      this.ready = true; this.refreshActions();
    });
  }

  private readonly enter = (mode: ExpeditionEntryMode): void => {
    if (this.transition || !this.scene.isActive()) return;
    this.ready = false; this.input.enabled = false;
    this.presentation.onEnter?.();
    const copy = this.titleRoot?.querySelector<HTMLElement>('.joint-copy');
    if (copy) copy.style.opacity = '0';
    const transition = this.presentation.createTransition?.(mode) ?? new MenuEntryTransition(mode);
    this.transition = transition; this.refreshActions();
    transition.depart(this, [], () => {
      this.handedOff = true;
      this.scene.start('PurificationScene', { fromMenu: true, menuEntry: transition });
    });
  };
}
