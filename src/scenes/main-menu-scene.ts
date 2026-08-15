/**
 * Main Menu Scene.
 *
 * The only surface in the game allowed to "feel like software" (meta-interface,
 * ui-art-overhaul.md v2 §A0 #1) — but its copy and colors are still bound by
 * world.md's terminology and the locked palette (§A2). Empty-field title type,
 * no glass / scan (art visual pass). Keyboard-first cursor + overwrite guard
 * per ux-copy-lock-slice-55.md / DEC-050.
 *
 * In-game Esc is a separate overlay (`pause-menu.ts`) that can be dismissed.
 * This scene is the title: you are not inside a run, so there is no "remain".
 */

import Phaser from 'phaser';
import { t } from '@/i18n';
import { saveManager } from '@/managers/save-manager';
import { beginNewExpedition, hasReadableSave, loadExpedition } from '@/managers/session';

const COLOR_TEXT_BRIGHT = '#c8cdd4';
const COLOR_TEXT = '#8a8f96';
const FONT_FAMILY = '"Courier New", monospace';

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
  private warningText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  private onSelectNewSave(): void {
    if (this.canContinue) {
      this.renderConfirmOverwrite();
      return;
    }
    beginNewExpedition(this);
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.canContinue = hasReadableSave();

    this.add.text(width / 2, height / 3, t('menu.title'), {
      fontSize: '28px',
      fontStyle: 'bold',
      color: COLOR_TEXT_BRIGHT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 3 + 40, t('menu.subtitle'), {
      fontSize: '13px',
      color: COLOR_TEXT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);

    this.warningText = this.add.text(width / 2, height / 2 + 24, '', {
      fontSize: '13px',
      color: COLOR_TEXT_BRIGHT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0.5).setVisible(false);

    this.renderRoot();

    this.input.keyboard?.on('keydown-UP', () => this.moveCursor(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.moveCursor(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.activateSelection());
    this.input.keyboard?.on('keydown-SPACE', () => this.activateSelection());
    this.input.keyboard?.on('keydown-ESC', () => this.handleEscape());

    this.events.once('shutdown', () => this.input.keyboard?.removeAllListeners());
  }

  private moveCursor(delta: number): void {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    this.refreshItemVisuals();
  }

  private activateSelection(): void {
    this.items[this.selectedIndex]?.action();
  }

  private handleEscape(): void {
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

  private renderSummary(startY: number): number {
    this.clearSummary();
    const summary = saveManager.peekRecordSummary();
    if (!summary) return startY;

    const centerX = this.cameras.main.width / 2;
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

    let y = startY;
    for (const row of rows) {
      const label = this.add.text(0, y, row.label, {
        fontSize: '13px',
        color: COLOR_TEXT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5);
      const value = this.add.text(0, y, row.value, {
        fontSize: '16px',
        color: COLOR_TEXT_BRIGHT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5);
      const extra = row.extra
        ? this.add.text(0, y, row.extra, {
          fontSize: '13px',
          color: COLOR_TEXT,
          fontFamily: FONT_FAMILY,
        }).setOrigin(0, 0.5)
        : null;

      const gap = 12;
      const extraW = extra ? extra.width + gap : 0;
      const total = label.width + gap + value.width + extraW;
      let x = centerX - total / 2;
      label.setX(x);
      x += label.width + gap;
      value.setX(x);
      x += value.width + gap;
      if (extra) extra.setX(x);

      this.summaryTexts.push(label, value);
      if (extra) this.summaryTexts.push(extra);
      y += 22;
    }
    return y + 8;
  }

  private renderRoot(): void {
    this.mode = 'root';
    this.warningText.setVisible(false);

    const items: MenuItem[] = [];
    let defaultIndex = 0;
    let itemsY = this.cameras.main.height / 2 + 40;

    if (this.canContinue) {
      itemsY = this.renderSummary(this.cameras.main.height / 2 - 8);
      items.push({ label: t('menu.continue'), action: () => loadExpedition(this) });
      items.push({ label: t('menu.newSave'), action: () => this.onSelectNewSave() });
      defaultIndex = 0;
    } else {
      this.clearSummary();
      items.push({ label: t('menu.newGame'), action: () => this.onSelectNewSave() });
    }

    this.items = items;
    this.selectedIndex = defaultIndex;
    this.layoutItems(itemsY, 34);
  }

  private renderConfirmOverwrite(): void {
    this.mode = 'confirmOverwrite';
    this.clearSummary();
    const tideNumber = saveManager.peekTideNumber() ?? 1;
    this.warningText.setText(t('menu.overwriteWarning', { tideNumber }));
    this.warningText.setVisible(true);

    this.items = [
      { label: t('menu.overwriteClear'), action: () => beginNewExpedition(this) },
      { label: t('menu.continue'), action: () => loadExpedition(this) },
    ];
    this.selectedIndex = 1;
    this.layoutItems(this.cameras.main.height / 2 + 60, 34);
  }

  private layoutItems(startY: number, spacing: number): void {
    for (const text of this.itemTexts) text.destroy();
    this.itemTexts = [];

    const centerX = this.cameras.main.width / 2;
    this.items.forEach((item, index) => {
      const itemText = this.add.text(centerX, startY + index * spacing, '', {
        fontSize: '16px',
        color: COLOR_TEXT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      itemText.on('pointerover', () => {
        this.selectedIndex = index;
        this.refreshItemVisuals();
      });
      itemText.on('pointerdown', () => {
        this.selectedIndex = index;
        item.action();
      });

      this.itemTexts.push(itemText);
    });

    this.refreshItemVisuals();
  }

  private refreshItemVisuals(): void {
    this.items.forEach((item, index) => {
      const itemText = this.itemTexts[index];
      if (!itemText) return;
      const selected = index === this.selectedIndex;
      const glyph = selected ? '\u25b8' : '>';
      const color = selected ? COLOR_TEXT_BRIGHT : COLOR_TEXT;
      itemText.setText(`${glyph} ${item.label}`);
      itemText.setColor(color);
    });
  }
}
