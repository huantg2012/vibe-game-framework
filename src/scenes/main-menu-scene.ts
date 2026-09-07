/**
 * Title scene: stable left-aligned actions beside the locked refuge key art.
 * Iteration 13 composition lives in ui-art-overhaul.md §A. Session operations
 * remain shared with the in-game record menu; overwrite defaults to keeping
 * the existing expedition and Escape returns to the root menu.
 */

import Phaser from 'phaser';
import { MainMenuAtmosphere } from './main-menu-atmosphere';
import { MainMenuActor } from './main-menu-actor';
import { MenuEntryTransition } from './menu-entry-transition';
import type { ExpeditionEntryMode } from '@/managers/session';
import { t } from '@/i18n';
import { audioManager } from '@/managers/audio-manager';
import { saveManager } from '@/managers/save-manager';
import { beginNewExpedition, hasReadableSave, loadExpedition } from '@/managers/session';

const COLOR_TEXT_BRIGHT = '#c8cdd4';
const COLOR_TEXT = '#8a8f96';
const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", sans-serif';

/** Authored 960×640 title composition; every menu state shares this axis. */
const TEXT_X = 176;
const TITLE_Y = 212;
const SUBTITLE_Y = 250;
const ACTION_Y = 326;
const ACTION_STEP = 40;
const SUMMARY_Y = 424;
const SUMMARY_STEP = 20;

/** CJK ascent exceeds Courier canvas metrics. Top-only; sizes from clip + visual contracts. */
function padMenuText(
  text: Phaser.GameObjects.Text,
  fontSizePx: number,
  paddingLeft = 0,
): Phaser.GameObjects.Text {
  const top = fontSizePx >= 28 ? 8 : 4;
  return text.setPadding({ top, right: 0, bottom: 0, left: paddingLeft });
}

interface MenuItem {
  label: string;
  action: () => void;
}

type MenuMode = 'root' | 'confirmOverwrite';

export class MainMenuScene extends Phaser.Scene {
  private items: MenuItem[] = [];
  private itemTexts: Phaser.GameObjects.Text[] = [];
  private summaryTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private mode: MenuMode = 'root';
  private canContinue = false;
  private focusMark!: Phaser.GameObjects.Rectangle;
  private subtitleText!: Phaser.GameObjects.Text;
  private backHint!: Phaser.GameObjects.Text;
  private atmosphere: MainMenuAtmosphere | null = null;
  private actor: MainMenuActor | null = null;
  private warningText!: Phaser.GameObjects.Text;
  private entryTransition: MenuEntryTransition | null = null;
  private entryHandoff = false;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  private onSelectNewSave(): void {
    if (this.canContinue) {
      this.renderConfirmOverwrite();
      return;
    }
    beginNewExpedition(this, this.startEntry);
  }

  create(): void {
    this.entryTransition = null;
    this.entryHandoff = false;
    this.input.enabled = true;
    // The title illustration has subpixel idle motion. World cameras retain
    // their pixel snapping; rounding here quantizes a 2px breath into jumps.
    this.cameras.main.setRoundPixels(false);
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Authored key art: one last industrial refuge against rewritten space.
    this.add.image(0, 0, 'menu-last-light').setOrigin(0).setDisplaySize(width, height);
    this.actor = new MainMenuActor(this);
    this.atmosphere = new MainMenuAtmosphere(this);

    this.canContinue = hasReadableSave();

    padMenuText(this.add.text(TEXT_X, TITLE_Y, t('menu.title'), {
      fontSize: '36px',
      fontStyle: 'normal',
      color: COLOR_TEXT_BRIGHT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5), 36);

    this.subtitleText = padMenuText(this.add.text(TEXT_X, SUBTITLE_Y, t('menu.subtitle'), {
      fontSize: '13px',
      color: COLOR_TEXT,
      fontFamily: FONT_FAMILY,
      wordWrap: { width: 260, useAdvancedWrap: true },
      lineSpacing: 5,
    }).setOrigin(0, 0.5), 13);

    this.warningText = padMenuText(this.add.text(TEXT_X, 268, '', {
      fontSize: '12px',
      color: COLOR_TEXT,
      fontFamily: FONT_FAMILY,
      wordWrap: { width: 260, useAdvancedWrap: true },
      lineSpacing: 6,
    }).setOrigin(0, 0).setVisible(false), 13);

    this.backHint = padMenuText(this.add.text(TEXT_X, SUMMARY_Y, t('menu.backHint'), {
      fontSize: '11px', color: COLOR_TEXT, fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5).setVisible(false), 11);

    this.focusMark = this.add.rectangle(TEXT_X - 20, ACTION_Y, 7, 1, 0xc8cdd4).setOrigin(0, 0.5);

    this.renderRoot();

    audioManager.unlock();
    audioManager.playBGM('bgm-menu-void-pad');

    this.input.keyboard?.on('keydown-UP', () => this.moveCursor(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveCursor(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelection());
    this.input.keyboard?.on('keydown-ESC', () => this.handleEscape());

    this.events.once('shutdown', () => {
      this.input.keyboard?.removeAllListeners();
      this.atmosphere?.destroy();
      this.atmosphere = null;
      this.actor?.destroy();
      this.actor = null;
      if (!this.entryHandoff) {
        this.entryTransition?.destroy();
        audioManager.haltNonBgm();
      }
      this.entryTransition = null;
    });
  }

  update(_time: number, delta: number): void {
    this.actor?.update(delta);
    if (this.actor) this.atmosphere?.setActorOffset(this.actor.lampOffset.x, this.actor.lampOffset.y);
    this.atmosphere?.update(delta);
  }

  private readonly startEntry = (mode: ExpeditionEntryMode): void => {
    if (this.entryTransition) return;
    this.input.enabled = false;
    const transition = new MenuEntryTransition(mode);
    this.entryTransition = transition;
    const text: Phaser.GameObjects.GameObject[] = this.children.list.filter(child => child instanceof Phaser.GameObjects.Text);
    text.push(this.focusMark);
    transition.depart(this, text, () => {
      this.entryHandoff = true;
      this.scene.start('PurificationScene', { fromMenu: true, menuEntry: transition });
    });
  };

  private moveCursor(delta: number): void {
    if (this.entryTransition) return;
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    audioManager.playSFX('sfx-ui-hover');
    this.refreshItemVisuals();
  }

  private activateSelection(): void {
    if (this.entryTransition) return;
    audioManager.playSFX('sfx-ui-click');
    this.items[this.selectedIndex]?.action();
  }

  private handleEscape(): void {
    if (this.entryTransition) return;
    if (this.mode === 'confirmOverwrite') this.renderRoot();
  }

  private clearSummary(): void {
    for (const text of this.summaryTexts) text.destroy();
    this.summaryTexts = [];
  }

  private phaseLabel(phase: 'rise' | 'crest' | 'ebb'): string {
    if (phase === 'rise') return t('menu.phaseRise');
    if (phase === 'crest') return t('menu.phaseCrest');
    return t('menu.phaseEbb');
  }

  private renderSummary(): void {
    this.clearSummary();
    const summary = saveManager.peekRecordSummary();
    if (!summary) return;

    const rows: { label: string; value: string; extra?: string }[] = [
      {
        label: t('menu.summaryTide'),
        value: t('menu.tideNth', { n: summary.tideNumber }),
        extra: this.phaseLabel(summary.phase),
      },
      {
        label: t('menu.summaryCycle'),
        value: String(summary.cycle),
      },
      {
        label: t('menu.summaryStability'),
        value: `${Math.round(summary.progress)}%`,
        extra: summary.reached ? t('menu.stabilityComplete') : t('menu.stabilityIncomplete'),
      },
    ];

    rows.forEach((row, index) => {
      const y = SUMMARY_Y + index * SUMMARY_STEP;
      const addNode = (x: number, text: string): void => {
        this.summaryTexts.push(padMenuText(this.add.text(x, y, text, {
          fontSize: '11px',
          color: COLOR_TEXT,
          fontFamily: FONT_FAMILY,
        }).setOrigin(0, 0.5), 11));
      };
      addNode(TEXT_X, row.label);
      addNode(224, row.value);
      if (row.extra) addNode(280, row.extra);
    });
  }

  private renderRoot(): void {
    this.mode = 'root';
    this.warningText.setVisible(false);
    this.backHint.setVisible(false);
    this.subtitleText.setVisible(true);

    const items: MenuItem[] = [];
    let defaultIndex = 0;

    if (this.canContinue) {
      this.renderSummary();
      items.push({ label: t('menu.continue'), action: () => loadExpedition(this, this.startEntry) });
      items.push({ label: t('menu.newSave'), action: () => this.onSelectNewSave() });
      defaultIndex = 0;
    } else {
      this.clearSummary();
      items.push({ label: t('menu.newGame'), action: () => this.onSelectNewSave() });
    }

    this.items = items;
    this.selectedIndex = defaultIndex;
    this.layoutItems();
  }

  private renderConfirmOverwrite(): void {
    this.mode = 'confirmOverwrite';
    this.clearSummary();
    const tideNumber = saveManager.peekTideNumber() ?? 1;
    this.warningText.setText(t('menu.overwriteWarning', { tideNumber }));
    this.warningText.setY(268);
    this.backHint.setVisible(true);
    this.subtitleText.setVisible(false);
    this.warningText.setVisible(true);

    this.items = [
      { label: t('menu.continue'), action: () => loadExpedition(this, this.startEntry) },
      { label: t('menu.overwriteClear'), action: () => beginNewExpedition(this, this.startEntry) },
    ];
    this.selectedIndex = 0;
    this.layoutItems();
  }

  private layoutItems(): void {
    for (const text of this.itemTexts) text.destroy();
    this.itemTexts = [];

    this.items.forEach((item, index) => {
      const itemText = padMenuText(this.add.text(TEXT_X, ACTION_Y + index * ACTION_STEP, item.label, {
        fontSize: '13px',
        color: COLOR_TEXT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5), 13);
      // Stable generous target; changing focus never moves text or its hit area.
      itemText.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-12, -8, Math.max(180, itemText.width + 24), 36),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
      // A confirmation can replace the row under a stationary pointer; only
      // deliberate movement may override its safe default keyboard selection.
      itemText.on('pointermove', () => {
        if (this.entryTransition) return;
        if (this.selectedIndex !== index) audioManager.playSFX('sfx-ui-hover');
        this.selectedIndex = index;
        this.refreshItemVisuals();
      });
      itemText.on('pointerdown', () => {
        if (this.entryTransition) return;
        this.selectedIndex = index;
        audioManager.playSFX('sfx-ui-click');
        item.action();
      });
      this.itemTexts.push(itemText);
    });
    this.refreshItemVisuals();
  }

  private refreshItemVisuals(): void {
    this.itemTexts.forEach((text, index) => {
      text.setColor(index === this.selectedIndex ? COLOR_TEXT_BRIGHT : COLOR_TEXT);
    });
    this.focusMark.setY(ACTION_Y + this.selectedIndex * ACTION_STEP);
  }
}
