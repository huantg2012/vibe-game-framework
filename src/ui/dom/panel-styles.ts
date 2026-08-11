/**
 * Panel Styles - In-world terminal/CRT panels for all DOM overlays.
 *
 * Injects a single <style> element (idempotent). All panels use `.game-panel`
 * as their root class. Game-style layouts: cards, progress bars, slot grids,
 * pill badges, compact action buttons.
 *
 * Visual reference: Hades skill screens / Darkest Dungeon equipment /
 * FTL resource bars / Dwarf Fortress menus — devices IN the game world.
 *
 * Art direction source: docs/design-notes/ui-art-overhaul.md section A3.
 */

const STYLE_ID = 'game-panel-styles';

const CSS = `
/* === Base panel === */
.game-panel {
  background: rgba(15, 17, 20, 0.92);
  background-image: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.06) 2px,
    rgba(0, 0, 0, 0.06) 4px
  );
  border: 1px solid #2a2d32;
  padding: 20px;
  font: 14px 'Courier New', monospace;
  color: #c8ccd0;
  line-height: 1.6;
  box-shadow: 0 0 12px rgba(0, 0, 0, 0.6);
  image-rendering: pixelated;
}
.game-panel .panel-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.game-panel .panel-title::before {
  content: '\\25b8 ';
  color: #2a2d32;
}
.game-panel .section-title {
  color: #8a8f96;
  margin: 10px 0 6px;
  font-size: 12px;
  letter-spacing: 1px;
}
.game-panel .section-title::before { content: '\\2500\\2500 '; color: #2a2d32; }
.game-panel .section-title::after { content: ' \\2500\\2500'; color: #2a2d32; }
.game-panel .separator {
  border: none;
  border-top: 1px solid #2a2d32;
  margin: 10px 0;
}
.game-panel .hint {
  font-size: 12px;
  color: #5a5f66;
  text-align: center;
  margin-top: 10px;
}

/* === Legacy compat (for any leftover uses) === */
.game-panel .panel-section {
  margin-bottom: 8px;
  padding: 4px 8px;
}
.game-panel .option {
  padding: 3px 0;
  cursor: pointer;
  color: #8a8f96;
  transition: color 0.1s ease-out;
}
.game-panel .option:hover {
  color: #c8cdd4;
  background: rgba(42, 45, 50, 0.3);
}
.game-panel .option:active { color: #ffffff; }
.game-panel .option.disabled {
  color: #2a2d32;
  cursor: default;
}
.game-panel .option.disabled:hover {
  color: #2a2d32;
  background: transparent;
}
.game-panel .info-line {
  font-size: 13px;
  color: #8a8f96;
  padding: 3px 0;
}

/* === Card grid (growth/upgrade panels) === */
.game-panel .card-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.game-panel .upgrade-card {
  border: 1px solid #2a2d32;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
  position: relative;
}
.game-panel .upgrade-card:hover {
  border-color: #5a5f66;
  background: rgba(42, 45, 50, 0.25);
}
.game-panel .upgrade-card.card-maxed {
  border-color: #aa6622;
  cursor: default;
}
.game-panel .upgrade-card.card-maxed::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(170, 102, 34, 0.3);
  pointer-events: none;
}
.game-panel .upgrade-card.card-locked {
  opacity: 0.4;
  cursor: default;
}
.game-panel .upgrade-card.card-locked:hover {
  border-color: #2a2d32;
  background: transparent;
}
.game-panel .card-icon {
  width: 34px;
  height: 34px;
  border: 1px solid #5a5f66;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  flex-shrink: 0;
}
.game-panel .card-body {
  flex: 1;
  min-width: 0;
}
.game-panel .card-name {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 3px;
}
.game-panel .card-dots {
  font-size: 13px;
  letter-spacing: 2px;
}
.game-panel .card-dots .dot-filled { color: #c4873a; }
.game-panel .card-dots .dot-empty { color: #2a2d32; }
.game-panel .card-cost {
  font-size: 12px;
  color: #5a5f66;
  margin-top: 2px;
}
.game-panel .card-cost .affordable { color: #c4873a; }

/* === Progress bars === */
.game-panel .pbar-wrap {
  width: 100%;
  height: 10px;
  background: #0a0c0e;
  border: 1px solid #2a2d32;
  position: relative;
  overflow: hidden;
}
.game-panel .pbar-fill {
  height: 100%;
  transition: width 0.3s ease-out;
}
.game-panel .pbar-preview {
  position: absolute;
  top: 0;
  height: 100%;
  opacity: 0.4;
  transition: width 0.2s ease-out, left 0.2s ease-out;
}
.game-panel .pbar-label {
  font-size: 12px;
  color: #8a8f96;
  margin-top: 2px;
  display: flex;
  justify-content: space-between;
}

/* === Slot grid (defense / loadout) === */
.game-panel .slot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 8px 0;
}
.game-panel .slot-cell {
  border: 1px dashed #2a2d32;
  padding: 8px 6px;
  min-height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
  position: relative;
}
.game-panel .slot-cell:hover {
  border-color: #5a5f66;
  background: rgba(42, 45, 50, 0.2);
}
.game-panel .slot-cell.slot-filled {
  border-style: solid;
}
.game-panel .slot-cell .slot-label {
  font-size: 12px;
  color: #5a5f66;
  position: absolute;
  top: 2px;
  left: 4px;
}
.game-panel .slot-cell .slot-name {
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 2px;
}
.game-panel .slot-cell .slot-info {
  font-size: 12px;
  color: #5a5f66;
}

/* === Tile inventory (compact items) === */
.game-panel .tile-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}
.game-panel .item-tile {
  border: 1px solid #2a2d32;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}
.game-panel .item-tile:hover {
  border-color: #5a5f66;
  background: rgba(42, 45, 50, 0.3);
}
.game-panel .item-tile.tile-selected {
  border-color: #1aad96;
  background: rgba(26, 173, 150, 0.1);
}
.game-panel .item-tile.tile-disabled {
  opacity: 0.35;
  cursor: default;
}
.game-panel .item-tile.tile-disabled:hover {
  border-color: #2a2d32;
  background: transparent;
}

/* === Compact action button === */
.game-panel .action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border: 1px solid #2a2d32;
  font: 13px 'Courier New', monospace;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.game-panel .action-btn:hover {
  background: rgba(42, 45, 50, 0.4);
}
.game-panel .action-btn:active {
  color: #ffffff;
}
.game-panel .action-btn.btn-primary {
  border-color: #1aad96;
  color: #1aad96;
}
.game-panel .action-btn.btn-primary:hover {
  background: rgba(26, 173, 150, 0.12);
}
.game-panel .action-btn.btn-danger {
  border-color: #cc3333;
  color: #cc3333;
}
.game-panel .action-btn.btn-muted {
  border-color: #2a2d32;
  color: #5a5f66;
}
.game-panel .action-btn.btn-muted:hover {
  color: #8a8f96;
}

/* === Stat row (multi-col status) === */
.game-panel .stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.game-panel .stat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  font-size: 13px;
}
.game-panel .stat-label {
  color: #5a5f66;
  min-width: 50px;
}
.game-panel .stat-value {
  color: #c8ccd0;
  font-weight: bold;
}
.game-panel .stat-bar {
  flex: 1;
  height: 6px;
  background: #0a0c0e;
  border: 1px solid #2a2d32;
  position: relative;
  overflow: hidden;
  min-width: 40px;
}
.game-panel .stat-bar-fill {
  height: 100%;
}

/* === Pill badge (compact tags) === */
.game-panel .pill {
  display: inline-block;
  padding: 2px 6px;
  border: 1px solid #2a2d32;
  font-size: 12px;
  margin: 1px;
}

/* === Damage bar (impact reports) === */
.game-panel .dmg-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.game-panel .dmg-label {
  min-width: 36px;
  font-size: 13px;
  font-weight: bold;
}
.game-panel .dmg-bar-wrap {
  flex: 1;
  height: 12px;
  background: #0a0c0e;
  border: 1px solid #2a2d32;
  position: relative;
  overflow: hidden;
}
.game-panel .dmg-bar-fill {
  height: 100%;
  transition: width 0.4s ease-out;
}
.game-panel .dmg-value {
  font-size: 13px;
  min-width: 32px;
  text-align: right;
}

/* === Action bar (bottom of panel) === */
.game-panel .action-bar {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
}

/* === Backdrop overlay === */
.game-panel-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

/* === Scrollbar === */
.game-panel::-webkit-scrollbar { width: 4px; }
.game-panel::-webkit-scrollbar-track { background: #0f1114; }
.game-panel::-webkit-scrollbar-thumb { background: #2a2d32; }
`;

let injected = false;

/** Inject panel styles into the document head (idempotent). */
export function injectPanelStyles(): void {
  if (injected) return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  injected = true;
}
