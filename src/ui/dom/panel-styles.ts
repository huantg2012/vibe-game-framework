/**
 * Panel Styles - Rimworld/Dwarf Fortress inspired data panels for all DOM overlays.
 *
 * Injects a single <style> element (idempotent). All panels use `.game-panel`
 * as their root class, `.section-title` for section headers with dash decorations,
 * `.option` for clickable rows, and `.option.disabled` for unavailable actions.
 *
 * Visual reference: Rimworld info panels / Dwarf Fortress menus - dense information,
 * visible borders, functional layout over cinematic aesthetics.
 */

const STYLE_ID = 'game-panel-styles';

const CSS = `
.game-panel {
  background: #0f1114;
  border: 2px solid #3a3f44;
  padding: 10px 12px;
  font: 11px 'Courier New', monospace;
  color: #c8cdd4;
  line-height: 1.5;
}
.game-panel .panel-title {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.game-panel .section-title {
  color: #8a8f96;
  margin: 8px 0 4px;
  font-size: 10px;
  letter-spacing: 1px;
}
.game-panel .section-title::before { content: '\\2500\\2500 '; }
.game-panel .section-title::after { content: ' \\2500\\2500'; }
.game-panel .panel-section {
  margin-bottom: 8px;
  padding: 4px 8px;
}
.game-panel .option {
  padding: 2px 0;
  cursor: pointer;
  color: #8a8f96;
}
.game-panel .option:hover {
  color: #c8cdd4;
  text-decoration: underline;
}
.game-panel .option:active {
  color: #ffffff;
}
.game-panel .option.disabled {
  color: #3a3f44;
  cursor: default;
  text-decoration: none;
}
.game-panel .option.disabled:hover {
  color: #3a3f44;
  text-decoration: none;
}
.game-panel .separator {
  border-top: 1px solid #3a3f44;
  margin: 8px 0;
}
.game-panel .info-line {
  font-size: 10px;
  color: #8a8f96;
  padding: 2px 0;
}
.game-panel .hint {
  font-size: 9px;
  color: #5a5f66;
  text-align: center;
  margin-top: 8px;
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
