/**
 * Main Menu Scene.
 *
 * The only surface in the game allowed to "feel like software" (meta-interface,
 * ui-art-overhaul.md v2 §A0 #1) — but its copy and colors are still bound by
 * world.md's terminology and the locked palette (§A2). Layout/copy per
 * ui-art-overhaul.md v2 §A5-1; keyboard-first cursor + overwrite guard per
 * ux-information-architecture.md S1 (Slice 5.5 C1).
 */

import Phaser from 'phaser';
import { t } from '@/i18n';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { resetDefenseEngine } from '@/systems/defense-engine';
import { growthSystem } from '@/systems/growth-system';
import { impactSystem } from '@/systems/impact-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';

// Locked palette (ui-art-overhaul.md v2 §A2) — text-bright / text. This scene
// must not invent new color values even though it's the one "software-like"
// surface in the game. `#cc3333` (danger) is deliberately NOT used as a text
// color here: on this scene's near-black background it measures ~3.6-3.9:1,
// under the §A1 4.5:1 floor — same gap the shared danger-button text already
// has in panel-styles.ts, just not yet registered as a V-item there. The
// overwrite warning below carries its "this is destructive" weight through
// plain factual wording (world.md tone) instead of color, per §A1's own
// second-encoding principle.
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

  private startNewExpedition(): void {
    saveManager.deleteSave();
    gameState.reset();
    tideSystem.reset();
    contaminantSystem.reset();
    growthSystem.reset();
    stabilityTracker.reset();
    // D3/DEC-032: defense-engine's per-contaminant runtime state (solidify/combust)
    // was never reset anywhere before Slice 5 T3 — a latent gap now that it matters
    // for save/load correctness.
    resetDefenseEngine();
    // muffle lookahead's pendingTargetQueue would otherwise leak a stale pre-committed
    // target across playthroughs (harmless since module ids are stable, but incorrect).
    impactSystem.resetForecastState();
    this.scene.start('PurificationScene', { fromMenu: true });
  }

  private continueExpedition(): void {
    const loaded = saveManager.load();
    if (loaded) {
      this.scene.start('PurificationScene', { fromMenu: true });
    } else {
      // Save existed but failed to parse/load — nothing left to preserve.
      this.startNewExpedition();
    }
  }

  /**
   * "进入净化点" from the root menu. A save that exists and is readable is a
   * real thing the player could lose, so it routes through the overwrite guard
   * (ux-information-architecture.md S1 "覆盖确认") instead of deleting on the
   * spot — the bug that state exists to fix.
   */
  private onSelectNewGame(): void {
    if (this.canContinue) {
      this.renderConfirmOverwrite();
      return;
    }
    this.startNewExpedition();
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // A save that exists but can't be read is treated as "nothing to continue"
    // rather than surfaced as its own state (see save-manager.ts peekTideNumber doc).
    this.canContinue = saveManager.hasSave() && saveManager.peekTideNumber() !== null;

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

    // Keyboard is the first-class input (ux-information-architecture.md §0.4);
    // mouse hover/click is wired below as a secondary path, not the only one.
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
    // Root menu: Esc is a no-op (ux-information-architecture.md S1 interaction).
    // The overwrite guard is the one added state, and Esc dismisses it without
    // side effects — distinct from the "沿旧路返回" item, which actually loads
    // the save.
    if (this.mode === 'confirmOverwrite') this.renderRoot();
  }

  private renderRoot(): void {
    this.mode = 'root';
    this.warningText.setVisible(false);

    const items: MenuItem[] = [
      { label: t('menu.newGame'), action: () => this.onSelectNewGame() },
    ];
    let defaultIndex = 0;
    if (this.canContinue) {
      items.push({ label: t('menu.continue'), action: () => this.continueExpedition() });
      defaultIndex = 1; // "有记录：继续为默认游标位置" (IA S1)
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
      { label: t('menu.overwriteClear'), action: () => this.startNewExpedition() },
      { label: t('menu.continue'), action: () => this.continueExpedition() },
    ];
    this.selectedIndex = 1; // default cursor on the non-destructive option
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
      const glyph = selected ? '\u25b8' : '>'; // ▸ selected / > silent — same language as .panel-title
      const color = selected ? COLOR_TEXT_BRIGHT : COLOR_TEXT;
      itemText.setText(`${glyph} ${item.label}`);
      itemText.setColor(color);
    });
  }
}
