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
 * Art direction source: docs/design-notes/ui-art-overhaul.md (UX Design Kit v2, §A2-A4).
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
  color: #c8cdd4;
  line-height: 1.6;
  image-rendering: pixelated;
  /* V4 (ui-art-overhaul.md A1): no box-shadow/glow — U2 "无后台管理气味" forbids
     drop-shadow panels. Separation from the background comes from the border color
     and the backdrop dim layer (.game-panel-backdrop) alone. */
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
  /* V1 (ui-art-overhaul.md A1): was #5a5f66 on #0f1114 (~2.9:1). #5a5f66 is now
     reserved for borders/dividers only — never text. */
  font-size: 12px;
  color: #8a8f96;
  text-align: center;
  margin-top: 10px;
}

/* === Key hint bar (IA §0.4 — reserved primitive, wired starting C4) === */
.game-panel .key-hint-bar {
  font-size: 12px;
  color: #8a8f96;
  text-align: center;
  border-top: 1px solid #2a2d32;
  padding-top: 6px;
  margin-top: 6px;
}
.game-panel .key-hint-bar .key {
  color: #c8cdd4;
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
.game-panel .option:hover,
.game-panel .option.selected {
  color: #c8cdd4;
  background: rgba(42, 45, 50, 0.3);
}
.game-panel .option:active { color: #c8cdd4; }
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
.game-panel .upgrade-card:hover,
.game-panel .upgrade-card.card-selected {
  border-color: #1aad96;
  background: rgba(26, 173, 150, 0.12);
}
.game-panel .upgrade-card.card-maxed {
  border-color: #8a5c2a;
  cursor: default;
}
.game-panel .upgrade-card.card-maxed::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 1px solid rgba(138, 92, 42, 0.3);
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
  color: #8a8f96;
  margin-top: 2px;
}
.game-panel .card-cost .affordable { color: #c4873a; }

/* === Progress bars ===
   Shared visual language across three size variants (compact HUD bar / standard
   panel bar / damage-report bar) — Degree not Kind. Every instance MUST render its
   numeric value beside the bar (V5, ui-art-overhaul.md A1 "第二重编码"); that text
   lives in each caller's markup, not here. */
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
.game-panel .slot-cell.slot-selected {
  /* Keyboard cursor — must be visually distinguishable from mere hover (IA §0.3). */
  border-color: #1aad96;
  background: rgba(26, 173, 150, 0.12);
}
.game-panel .slot-cell .slot-label {
  font-size: 12px;
  color: #8a8f96;
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
  color: #8a8f96;
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
  /* Doubles as "keyboard cursor here" (IA §0.3 "已选中") and "picked" — same teal
     language as .slot-cell.slot-selected / .upgrade-card.card-selected (U11). */
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
.game-panel .action-btn:hover,
.game-panel .action-btn:focus-visible,
.game-panel .action-btn.btn-focused {
  background: rgba(42, 45, 50, 0.4);
  outline: none;
}
.game-panel .action-btn:active { color: #c8cdd4; }
.game-panel .action-btn.btn-primary {
  border-color: #1aad96;
  color: #1aad96;
}
.game-panel .action-btn.btn-primary:hover,
.game-panel .action-btn.btn-primary:focus-visible,
.game-panel .action-btn.btn-primary.btn-focused {
  background: rgba(26, 173, 150, 0.12);
}
.game-panel .action-btn.btn-danger {
  border-color: #cc3333;
  color: #cc3333;
}
.game-panel .action-btn.btn-muted {
  border-color: #2a2d32;
  color: #8a8f96;
}
.game-panel .action-btn.btn-muted:hover,
.game-panel .action-btn.btn-muted:focus-visible,
.game-panel .action-btn.btn-muted.btn-focused {
  color: #c8cdd4;
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
  color: #8a8f96;
  min-width: 50px;
}
.game-panel .stat-value {
  color: #c8cdd4;
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

/* === Inspect dock (ui-art-overhaul.md A5-13) ===
   Fixed-height detail strip fed by keyboard/mouse focus on a list/grid item.
   Content swap must be instant (no fade-in) per A6 — the delay is the bug being
   fixed, not an effect to reproduce. C3 wires focus tracking + the five-layer
   content (IA §S13 L1-L5); layout is block (not the C0 flex-centered placeholder)
   because five stacked lines don't fit a single centered row. */
.game-panel .inspect-dock {
  border: 1px solid #2a2d32;
  padding: 8px 10px;
  min-height: 40px;
  margin: 8px 0;
  font-size: 13px;
  color: #8a8f96;
  line-height: 1.5;
}
.game-panel .inspect-dock .inspect-empty {
  color: #8a8f96;
}
.game-panel .inspect-dock .inspect-l1 {
  color: #c8cdd4;
  font-weight: bold;
}
.game-panel .inspect-dock .inspect-l2,
.game-panel .inspect-dock .inspect-l3 {
  color: #8a8f96;
}
.game-panel .inspect-dock .inspect-l4 {
  color: #b89040;
}
.game-panel .inspect-dock .inspect-l5 {
  color: #1aad96;
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

/* === Toast primitives (ui-art-overhaul.md A4/A6) ===
   Two variants for the unified feedback layer: "inline" (brief, non-blocking,
   appears at the source of the event) and "stamp" (rare, one-shot, full-screen,
   dismiss on key/click/timeout). Established here as shared primitives; the
   scattered existing implementations (hud.ts pickup flash, growth-panel purchase
   flash / first-milestone overlay, rift-scene side-effect toast, purification-scene
   toasts) get migrated onto these in C6 — not rewritten in this batch. */
.toast-inline {
  position: fixed;
  font: 12px 'Courier New', monospace;
  color: #c8cdd4;
  pointer-events: none;
  white-space: nowrap;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
  z-index: 1500;
}
.toast-stamp {
  position: fixed;
  inset: 0;
  background: rgba(13, 17, 20, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font: 16px 'Courier New', monospace;
  color: #c4873a;
  text-align: center;
  cursor: pointer;
  z-index: 2000;
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

// ---------------------------------------------------------------------------
// DOM ↔ Phaser scale alignment (ui-art-overhaul.md A1 "对齐规则", strict rule)
//
// Every DOM overlay (panels, HUD-adjacent DOM pieces, the minimap canvas) mounts
// under this single root instead of document.body directly. The root is sized to
// the game's logical 960x640 canvas and gets one CSS transform that tracks the
// canvas's actual on-screen box (position + scale), so 1 declared CSS px here
// always equals 1 Phaser logical canvas px, at any window size Scale.FIT produces.
// Without this, DOM panels drift out of alignment with the canvas whenever the
// window isn't exactly 960x640 (the reported "DOM 与 Phaser 视觉字号永远对不齐" root
// cause).
//
// pointer-events:none on the root (children opt back in with pointer-events:auto)
// is required — the root's box always spans the full canvas area, so if it kept
// the default `auto` it would silently swallow every click/hover meant for the
// game canvas underneath whenever no panel is open.
// ---------------------------------------------------------------------------

const DOM_UI_ROOT_ID = 'dom-ui-root';
const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 640;

let domUiRoot: HTMLDivElement | null = null;

/** Get (creating if needed) the shared DOM UI root. All overlay mount points use this
 *  instead of `document.body` directly. */
export function getDomUiRoot(): HTMLDivElement {
  if (domUiRoot && domUiRoot.isConnected) return domUiRoot;

  let root = document.getElementById(DOM_UI_ROOT_ID) as HTMLDivElement | null;
  if (!root) {
    root = document.createElement('div');
    root.id = DOM_UI_ROOT_ID;
    root.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      `width:${LOGICAL_WIDTH}px`,
      `height:${LOGICAL_HEIGHT}px`,
      'transform-origin:0 0',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(root);
  }
  domUiRoot = root;
  return root;
}

/**
 * Minimal shape of what's needed from the Phaser.Game instance — kept structural
 * (not `import type Phaser from 'phaser'`) so this style-layer module has no
 * runtime or type dependency on the game bootstrap.
 */
interface ScalableGame {
  canvas: HTMLCanvasElement;
  scale: { on(event: string, fn: () => void): unknown };
  events: { once(event: string, fn: () => void): unknown };
}

/**
 * Bind the DOM UI root's transform to the game canvas's actual on-screen box.
 * Call once, right after the Phaser.Game instance is created (see main.ts).
 */
export function bindDomUiRootToGame(game: ScalableGame): void {
  const root = getDomUiRoot();

  const sync = (): void => {
    const canvasEl = game.canvas;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scale = rect.width / LOGICAL_WIDTH;
    root.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(${scale})`;
  };

  sync();
  game.events.once('ready', sync);
  game.scale.on('resize', sync);
  window.addEventListener('resize', sync);
}
