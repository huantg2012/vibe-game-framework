/**
 * Main Menu Scene.
 *
 * The only surface in the game allowed to "feel like software" (meta-interface,
 * ui-art-overhaul.md v2 §A0 #1) — but its copy and colors are still bound by
 * world.md's terminology and the locked palette (§A2). Empty-field title type,
 * no glass / scan (art visual pass). Keyboard-first cursor + overwrite guard
 * per ux-copy-lock-slice-55.md / DEC-050.
 *
 * Layout + cursor: ux-menu-structure-slice-55.md +
 * ux-menu-structure-visual-slice-55.md. Clip padding: ux-menu-text-clip-slice-55.md.
 *
 * In-game Esc is a separate overlay (`pause-menu.ts`) that can be dismissed.
 * This scene is the title: you are not inside a run, so there is no "remain".
 */

import Phaser from 'phaser';
import { t } from '@/i18n';
import { audioManager } from '@/managers/audio-manager';
import { saveManager } from '@/managers/save-manager';
import { beginNewExpedition, hasReadableSave, loadExpedition } from '@/managers/session';

const COLOR_TEXT_BRIGHT = '#c8cdd4';
const COLOR_TEXT = '#8a8f96';
const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", sans-serif';

/** Center-to-center Y steps (origin.y = 0.5). From ux-menu-structure-visual-slice-55. */
const ID_INTRA = 48;
const READ_INTRA = 28;
const ACT_INTRA = 44;
const GAP_ID_READ = 48;
const GAP_READ_ACT = 52;
const GAP_ID_ACT = 60;
const PREFIX_SLOT_PX = 20;
const READ_NODE_GAP = 12;

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
  private titleY = 0;
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
    this.titleY = Math.round(height * 0.23);

    // Authored key art: one last industrial refuge against rewritten space.
    this.add.image(0, 0, 'menu-last-light').setOrigin(0).setDisplaySize(width, height);

    this.canContinue = hasReadableSave();

    padMenuText(this.add.text(192, this.titleY, t('menu.title'), {
      fontSize: '36px',
      fontStyle: 'normal',
      color: COLOR_TEXT_BRIGHT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5), 36);

    padMenuText(this.add.text(192, this.titleY + ID_INTRA, t('menu.subtitle'), {
      fontSize: '13px',
      color: COLOR_TEXT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5), 16);

    this.warningText = padMenuText(this.add.text(192, this.readGroupY(), '', {
      fontSize: '13px',
      color: COLOR_TEXT,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0, 0.5).setVisible(false), 16);

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
      audioManager.haltNonBgm();
    });
  }

  private readGroupY(): number {
    return this.titleY + ID_INTRA + GAP_ID_READ;
  }

  private moveCursor(delta: number): void {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    audioManager.playSFX('sfx-ui-hover');
    this.refreshItemVisuals();
  }

  private activateSelection(): void {
    audioManager.playSFX('sfx-ui-click');
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

  private renderSummary(): void {
    this.clearSummary();
    const summary = saveManager.peekRecordSummary();
    if (!summary) return;

    const centerX = 284;
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

    const startY = this.readGroupY();
    rows.forEach((row, index) => {
      const y = startY + index * READ_INTRA;
      const label = padMenuText(this.add.text(0, y, row.label, {
        fontSize: '13px',
        color: COLOR_TEXT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5), 16);
      const value = padMenuText(this.add.text(0, y, row.value, {
        fontSize: '13px',
        color: COLOR_TEXT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5), 16);
      const extra = row.extra
        ? padMenuText(this.add.text(0, y, row.extra, {
          fontSize: '13px',
          color: COLOR_TEXT,
          fontFamily: FONT_FAMILY,
        }).setOrigin(0, 0.5), 12)
        : null;

      const extraW = extra ? extra.width + READ_NODE_GAP : 0;
      const total = label.width + READ_NODE_GAP + value.width + extraW;
      let x = centerX - total / 2;
      label.setX(x);
      x += label.width + READ_NODE_GAP;
      value.setX(x);
      x += value.width + READ_NODE_GAP;
      if (extra) extra.setX(x);

      this.summaryTexts.push(label, value);
      if (extra) this.summaryTexts.push(extra);
    });
  }

  private renderRoot(): void {
    this.mode = 'root';
    this.warningText.setVisible(false);

    const items: MenuItem[] = [];
    let defaultIndex = 0;
    let itemsY = this.titleY + ID_INTRA + GAP_ID_ACT;

    if (this.canContinue) {
      this.renderSummary();
      items.push({ label: t('menu.continue'), action: () => loadExpedition(this) });
      items.push({ label: t('menu.newSave'), action: () => this.onSelectNewSave() });
      defaultIndex = 0;
      itemsY = this.readGroupY() + 2 * READ_INTRA + GAP_READ_ACT;
    } else {
      this.clearSummary();
      items.push({ label: t('menu.newGame'), action: () => this.onSelectNewSave() });
    }

    this.items = items;
    this.selectedIndex = defaultIndex;
    this.layoutItems(itemsY);
  }

  private renderConfirmOverwrite(): void {
    this.mode = 'confirmOverwrite';
    this.clearSummary();
    const tideNumber = saveManager.peekTideNumber() ?? 1;
    this.warningText.setText(t('menu.overwriteWarning', { tideNumber }));
    this.warningText.setY(this.readGroupY());
    this.warningText.setVisible(true);

    this.items = [
      { label: t('menu.overwriteClear'), action: () => beginNewExpedition(this) },
      { label: t('menu.continue'), action: () => loadExpedition(this) },
    ];
    this.selectedIndex = 1;
    this.layoutItems(this.readGroupY() + GAP_READ_ACT);
  }

  private measureActionLabelWidth(label: string): number {
    const probe = padMenuText(this.add.text(0, 0, label, {
      fontSize: '13px',
      fontFamily: FONT_FAMILY,
    }).setVisible(false), 16);
    const width = probe.width;
    probe.destroy();
    return width;
  }

  private layoutItems(startY: number): void {
    for (const text of this.itemTexts) text.destroy();
    this.itemTexts = [];

    const maxLabelWidth = this.items.reduce(
      (max, item) => Math.max(max, this.measureActionLabelWidth(item.label)),
      0,
    );
    const actionLeftX = 284 - (PREFIX_SLOT_PX + maxLabelWidth) / 2;

    this.items.forEach((item, index) => {
      const itemText = padMenuText(this.add.text(actionLeftX, startY + index * ACT_INTRA, '', {
        fontSize: '13px',
        color: COLOR_TEXT,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }), 16);

      itemText.on('pointerover', () => {
        if (this.selectedIndex !== index) audioManager.playSFX('sfx-ui-hover');
        this.selectedIndex = index;
        this.refreshItemVisuals();
      });
      itemText.on('pointerdown', () => {
        this.selectedIndex = index;
        audioManager.playSFX('sfx-ui-click');
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
      if (selected) {
        itemText.setText(`\u25b8 ${item.label}`);
        padMenuText(itemText, 16, 0);
        itemText.setColor(COLOR_TEXT_BRIGHT);
      } else {
        itemText.setText(item.label);
        padMenuText(itemText, 16, PREFIX_SLOT_PX);
        itemText.setColor(COLOR_TEXT);
      }
    });
  }
}
