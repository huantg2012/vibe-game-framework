/**
 * Main Menu Scene.
 *
 * The only surface in the game allowed to "feel like software" (meta-interface,
 * ui-art-overhaul.md v2 §A0 #1) — but its copy and colors are still bound by
 * world.md's terminology and the locked palette (§A2). Layout/copy per
 * ui-art-overhaul.md v2 §A5-1; keyboard-first cursor + overwrite guard per
 * ux-information-architecture.md S1 (Slice 5.5 C1).
 *
 * In-game Esc is a separate overlay (`pause-menu.ts`) that can be dismissed.
 * This scene is the title: you are not inside a run, so there is no "resume".
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

  private renderRoot(): void {
    this.mode = 'root';
    this.warningText.setVisible(false);

    const items: MenuItem[] = [
      { label: t('menu.newSave'), action: () => this.onSelectNewSave() },
    ];
    let defaultIndex = 0;
    if (this.canContinue) {
      items.push({ label: t('menu.loadSave'), action: () => loadExpedition(this) });
      defaultIndex = 1;
    }

    this.items = items;
    this.selectedIndex = defaultIndex;
    this.layoutItems(this.cameras.main.height / 2 + 40, 34);
  }

  private renderConfirmOverwrite(): void {
    this.mode = 'confirmOverwrite';
    const tideNumber = saveManager.peekTideNumber() ?? 1;
    this.warningText.setText(t('menu.overwriteWarning', { tideNumber }));
    this.warningText.setVisible(true);

    this.items = [
      { label: t('menu.overwriteClear'), action: () => beginNewExpedition(this) },
      { label: t('menu.loadSave'), action: () => loadExpedition(this) },
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
