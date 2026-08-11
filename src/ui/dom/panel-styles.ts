/**
 * Panel Styles - shared CRT terminal aesthetic for all DOM panels.
 *
 * Injects a single <style> element (idempotent). All panels use `.game-panel`
 * as their root class, `.option` for clickable rows, and `.option.disabled`
 * for unavailable actions.
 *
 * Visual reference: Fallout terminal / Signalis menu - no buttons, only text rows
 * with hover highlight and click flash.
 */

const STYLE_ID = 'game-panel-styles';

const CSS = `
.game-panel {
  background: #0f1114;
  border: 1px solid #2a2d32;
  padding: 12px 16px;
  font: 11px 'Courier New', monospace;
  color: #c8cdd4;
  background-image: repeating-linear-gradient(
    0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
  );
}
.game-panel .panel-title {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
}
.game-panel .panel-section {
  margin-bottom: 10px;
  padding: 6px 8px;
  background: #151a1e;
}
.game-panel .option {
  padding: 4px 8px;
  cursor: pointer;
  color: #8a8f96;
  transition: background 0.08s ease-out;
}
.game-panel .option:hover {
  background: #1a1d22;
  color: #c8cdd4;
}
.game-panel .option:active {
  background: #2a3035;
}
.game-panel .option.disabled {
  color: #3a3f44;
  cursor: default;
}
.game-panel .option.disabled:hover {
  background: transparent;
  color: #3a3f44;
}
.game-panel .separator {
  border-top: 1px solid #2a2d32;
  margin: 10px 0;
}
.game-panel .info-line {
  font-size: 10px;
  color: #8a8f96;
  padding: 2px 8px;
}
.game-panel .hint {
  font-size: 9px;
  color: #5a5f66;
  text-align: center;
  margin-top: 12px;
}
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
