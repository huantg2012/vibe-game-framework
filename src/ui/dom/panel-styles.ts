/**
 * Panel Styles — 净化点墙机 CRT（载体 B）。
 *
 * `.game-panel` 默认是 680×468 磷光屏：无金属面框、无 1px 外框，边缘靠扫描线与发暗。
 * 挂 `#dom-ui-root`。Esc 记录菜单 / 裂隙结算用内联尺寸覆盖，不走这套占位。
 *
 * 参考：Signalis 设备读出（不学曲面畸变）/ FTL 名+条+量（不学供电格）/
 * Barotrauma 键印在屏上（不学指针仪表）。
 * 色：docs/design-notes/ui-art-overhaul.md §A2。
 */

const STYLE_ID = 'game-panel-styles';

const CSS = `
/* === CRT 磷光屏（Slice 5.5 · 人锁方案 1，无金属圈、无 1px 外框） === */
.game-panel {
  position: absolute;
  top: 52px;
  left: 140px;
  width: 680px;
  height: 468px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: rgba(15, 17, 20, 0.88);
  background-image:
    linear-gradient(to bottom, #080a0c 0%, transparent 8px),
    linear-gradient(to top,    #080a0c 0%, transparent 8px),
    linear-gradient(to right,  #080a0c 0%, transparent 8px),
    linear-gradient(to left,   #080a0c 0%, transparent 8px);
  background-repeat: no-repeat;
  border: none;
  padding: 14px 16px 4px;
  font: 13px 'Courier New', Courier, monospace;
  color: #8a8f96;
  line-height: 1.3;
  image-rendering: pixelated;
  pointer-events: auto;
  z-index: 1000;
}
.game-panel > * {
  position: relative;
  z-index: 1;
}
.game-panel.crt-stack > *:not(.scroll-area) {
  flex: 0 0 auto;
}
.game-panel.crt-stack > .scroll-area {
  flex: 1 1 auto;
  min-height: 0;
}
.game-panel .panel-fixed {
  flex: 0 0 auto;
}
.game-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 86% 82% at 50% 46%, transparent 28%, #080a0c 100%);
  opacity: 0.58;
  pointer-events: none;
  z-index: 2;
}
.game-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 2px,
    rgba(26, 173, 150, 0.08) 2px,
    rgba(8, 10, 12, 0.34) 3px
  );
  pointer-events: none;
  z-index: 3;
}
.game-panel .panel-title {
  font-size: 12px;
  font-weight: normal;
  margin: 0 0 4px;
  letter-spacing: 0;
  text-transform: none;
  color: #8a8f96;
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
  flex: 0 0 auto;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  font-size: 12px;
  color: #8a8f96;
  text-align: left;
  border-top: 1px solid #2a2d32;
  padding: 6px 0 8px;
  margin: 4px 0 0;
}
.game-panel .key-hint-bar .key {
  display: inline-block;
  border: 1px solid #2a2d32;
  padding: 0 4px;
  color: #c8cdd4;
  font-size: 12px;
  line-height: 16px;
}
.game-panel .key-hint-bar [id] {
  cursor: pointer;
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
  grid-template-columns: 1fr 1fr 1fr;
  gap: 6px;
}
.game-panel .upgrade-card {
  border: 1px solid #2a2d32;
  padding: 6px 8px;
  display: flex;
  align-items: stretch;
  gap: 8px;
  cursor: pointer;
  position: relative;
  min-height: 0;
}
.game-panel .upgrade-card:hover,
.game-panel .upgrade-card.card-selected {
  border-color: #c4873a;
  background: transparent;
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
  height: 6px;
  background: #080a0c;
  border: 1px solid #2a2d32;
  position: relative;
  overflow: hidden;
}
.game-panel .pbar-fill {
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}
.game-panel .pbar-preview {
  position: absolute;
  top: 0;
  height: 100%;
  background: repeating-linear-gradient(-45deg, #c8cdd4 0 2px, #080a0c 2px 5px);
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
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  margin: 4px 0;
  border: 1px solid #2a2d32;
}
.game-panel .slot-cell {
  border: none;
  border-right: 1px solid #2a2d32;
  padding: 6px 6px 6px 4px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;
  gap: 2px;
  cursor: pointer;
  position: relative;
}
.game-panel .slot-cell:last-child { border-right: 0; }
.game-panel .slot-cell:hover {
  background: transparent;
}
.game-panel .slot-cell.slot-filled {
  border-style: none;
  border-right: 1px solid #2a2d32;
}
.game-panel .slot-cell.slot-selected {
  border-left: 2px solid #c4873a;
  background: transparent;
}
.game-panel .slot-cell .slot-label {
  font-size: 12px;
  color: #8a8f96;
  position: static;
}
.game-panel .slot-cell .slot-name {
  font-size: 13px;
  font-weight: normal;
  margin: 0;
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
  border-color: #c4873a;
  background: transparent;
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
  border: none;
  border-top: 1px solid #2a2d32;
  padding: 6px 0 4px;
  min-height: 110px;
  margin: 4px 0 0;
  font-size: 13px;
  color: #8a8f96;
  line-height: 1.3;
  flex: 0 0 auto;
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
  display: none;
}
/* Equal-width buttons (Slice 5.5 playtest fix #3): width used to follow label
   length ("算了" vs "踏入"), reading as unfinished. flex:1 makes every direct
   .action-btn child of an .action-bar share the row equally; :only-child reverts
   to the natural compact/centered width for single-button bars (defense/growth/
   status/impact-result "离开"/"…不了"/"合上"/"知道了"), where there is nothing to
   be unequal with and stretching to the full row width would be a regression, not
   a fix. Direct-child selector only, so this never reaches the allocation panel's
   separate +/- stepper row, which is not an .action-bar. */
.game-panel .action-bar > .action-btn {
  flex: 1 1 0;
  min-width: 0;
}
.game-panel .action-bar > .action-btn:only-child {
  flex: 0 1 auto;
}

/* === Backdrop overlay === */
.game-panel-backdrop {
  position: absolute;
  inset: 0;
  background: transparent;
  z-index: 998;
  pointer-events: auto;
}

/* === In-game Esc record menu (pause-menu.ts) === */
.game-panel.pause-menu-panel .pause-menu-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 4px 0 8px;
}
.game-panel.pause-menu-panel .pause-menu-row {
  font-size: 13px;
  color: #8a8f96;
  padding: 4px 6px;
  cursor: pointer;
}
.game-panel.pause-menu-panel .pause-menu-row.is-selected {
  color: #c8cdd4;
}

/* Esc 记录菜单 / 裂隙结算：覆盖 CRT 默认 680×468 占位，居中小读出。 */
.game-panel.pause-menu-panel,
#rift-result-panel.game-panel {
  top: 50%;
  left: 50%;
  height: auto;
  transform: translate(-50%, -50%);
  background-image:
    linear-gradient(to bottom, #080a0c 0%, transparent 5px),
    linear-gradient(to top,    #080a0c 0%, transparent 5px),
    linear-gradient(to right,  #080a0c 0%, transparent 5px),
    linear-gradient(to left,   #080a0c 0%, transparent 5px);
  padding: 12px 14px 8px;
}
.game-panel.pause-menu-panel { width: 320px; }
#rift-result-panel.game-panel { width: 360px; }

/* 裂隙随身读出 / 小地图：同一族更薄的罩，暗扫描、无金属线。 */
.device-plate {
  position: absolute;
  background: rgba(15, 17, 20, 0.72);
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 6px 8px;
  pointer-events: none;
}
.device-plate::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 2px,
    rgba(8, 10, 12, 0.14) 2px,
    rgba(8, 10, 12, 0.14) 3px
  );
  z-index: 0;
}
.device-plate .device-effect {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
}
.device-plate .device-effect-name {
  font-size: 12px;
  color: #8a8f96;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}
.device-plate .device-effect-time {
  font-size: 13px;
  color: #c8cdd4;
  text-shadow: 0 0 2px rgba(0, 0, 0, 0.8);
}

#rift-minimap.device-plate {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 1000;
  pointer-events: none;
  box-sizing: content-box;
  padding: 4px;
  border: none;
  border-radius: 0;
  box-shadow: none;
  outline: none;
  overflow: hidden;
  background-color: rgba(15, 17, 20, 0.72);
  /* 凹槽暗边：径向，色与墙机凹槽相同 #080a0c，宽约 5px（暂停小窗那一档，不是墙机 8px） */
  background-image: radial-gradient(
    circle at 50% 50%,
    transparent 0px,
    transparent 48px,
    #080a0c 53px
  );
  clip-path: circle(50% at 50% 50%);
}
#rift-minimap.device-plate::after {
  z-index: 1; /* 暗扫描压在圆画布上，与左上同一条 repeating 暗线，不要另写 teal */
}
#rift-minimap canvas {
  display: block;
  width: 99px;
  height: 99px;
  border: none;
  clip-path: circle(50% at 50% 50%);
  image-rendering: pixelated;
}

/* Encounter identification log (DEC-074): rift wearable recorder, not a toast. */
#rift-encounter-log {
  position: absolute;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  width: 480px;
  max-width: 480px;
  pointer-events: none;
  display: none;
  font: 12px 'Courier New', monospace;
  color: #c8cdd4;
  text-shadow: 0 0 2px #080a0c;
  text-align: center;
  letter-spacing: 0.5px;
  z-index: 40;
}
#rift-encounter-log.is-recording {
  display: block;
}
#rift-encounter-log .encounter-log {
  display: inline-block;
  max-width: 480px;
  padding: 2px 8px;
  background: rgba(8, 10, 12, 0.35);
}
#rift-encounter-log .encounter-prefix,
#rift-encounter-log .encounter-node {
  display: inline;
  margin-right: 0.55em;
}
#rift-encounter-log .encounter-node:last-child {
  margin-right: 0;
}
#rift-encounter-log .encounter-mark {
  color: #2ae6c8;
  display: inline-block;
  transform: translateY(1px);
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
#toast-inline-queue {
  position: absolute;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  z-index: 1500;
}
#toast-inline-queue .toast-inline {
  position: static;
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

/* === Scroll area (Slice 5.5 playtest fix #2) ===
   Single primitive for every panel's internal scrolling content region, replacing
   the 6 files that each hand-rolled their own inline "flex:1;overflow-y:auto;" div
   with zero scrollbar styling — that inline div (not the .game-panel root, which
   never actually overflows once its flex:1 middle absorbs the extra height) is
   where the un-skinned native browser scrollbar was showing through. Scrollbar is
   hidden (not just re-skinned) in both engines — scroll capability is unaffected,
   only the browser-native chrome is removed. Top/bottom 1px borders (existing
   .separator colour) mark the scrollable region using a primitive already in the
   vocabulary rather than inventing a new affordance (fade/▲▼ etc. were considered
   and explicitly not used — see director's brief). */
.game-panel .scroll-area {
  flex: 1;
  overflow-y: auto;
  border-top: 1px solid #2a2d32;
  border-bottom: 1px solid #2a2d32;
  scrollbar-width: none; /* Firefox */
}
.game-panel .scroll-area::-webkit-scrollbar { display: none; width: 0; height: 0; } /* Chrome/Safari/Edge */
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

/** Shared CRT shell: 680×468 phosphor, position from `.game-panel` CSS. */
export function createCrtPanel(id: string): HTMLDivElement {
  injectPanelStyles();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'game-panel crt-stack';
  el.style.pointerEvents = 'auto';
  return el;
}

/**
 * Scrolls the panel's current keyboard-cursor element into view (Slice 5.5 playtest
 * fix #2, second half): hiding the native scrollbar via `.scroll-area` above removes
 * the one browser-native affordance keyboard-only navigation used to lean on for
 * "scroll me there yourself". Every panel's re-render call site should call this
 * right after setting `panel.innerHTML`, so the keyboard cursor's own "已选中" class
 * (shared across all panels — `.slot-selected` / `.tile-selected` / `.card-selected`)
 * is the single source of truth this reads, rather than each panel tracking its own
 * scroll offset. `{ block: 'nearest' }` means it only moves the scroll position when
 * the element is actually out of view - already-visible selections don't jump.
 */
export function scrollFocusedIntoView(panel: HTMLElement): void {
  const area = panel.querySelector('.scroll-area');
  if (!area) return;
  area
    .querySelector('.slot-selected, .tile-selected, .card-selected')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
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

// ---------------------------------------------------------------------------
// Toast primitives (C6 — ui-art-overhaul.md §A4/A6 "toast-inline"/"toast-stamp")
//
// Before this, `showSideEffectToasts` (rift-scene.ts), `showNewToolToast` and
// `showStabilityMilestone` (purification-scene.ts) each re-implemented the same
// "fixed-position banner, fade out, mount on document.body" boilerplate with their
// own keyframe-injection guard and their own (sometimes sub-12px, IA §A1 floor)
// font size. Both callers now funnel through these two functions so duration,
// mount point (#dom-ui-root, not document.body) and the minimum font size can't
// drift per call site again.
// ---------------------------------------------------------------------------

export interface ToastInlineOptions {
  /** CSS position/placement. Used when `skipQueue` is true (Channel A local flash).
   *  Queued Channel B toasts ignore this — they live in `#toast-inline-queue`. */
  position?: string;
  /** Text colour. Defaults to the standard bright text colour. */
  color?: string;
  /** Extra CSS merged in after the shared base (background/border/padding for the
   *  "banner" look already established at the three migrated call sites). */
  extraStyle?: string;
  durationMs?: number;
  /** Pickup `+N` / passive short flash: mount on `#dom-ui-root` at `position`,
   *  do not occupy the 2-slot Channel B queue. */
  skipQueue?: boolean;
}

const TOAST_INLINE_FADE_STYLE_ID = 'toast-inline-fade-style';

function ensureToastInlineFadeKeyframes(): void {
  if (document.getElementById(TOAST_INLINE_FADE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = TOAST_INLINE_FADE_STYLE_ID;
  style.textContent = `@keyframes toast-inline-fade { 0%{opacity:1;} 70%{opacity:1;} 100%{opacity:0;} }`;
  document.head.appendChild(style);
}

const TOAST_QUEUE_ID = 'toast-inline-queue';
const TOAST_QUEUE_MAX_VISIBLE = 2;

interface QueuedToast {
  html: string;
  color: string;
  extraStyle: string;
  durationMs: number;
}

const toastInlinePending: QueuedToast[] = [];

function getToastInlineQueueHost(): HTMLDivElement {
  injectPanelStyles();
  const root = getDomUiRoot();
  let host = document.getElementById(TOAST_QUEUE_ID) as HTMLDivElement | null;
  if (!host) {
    host = document.createElement('div');
    host.id = TOAST_QUEUE_ID;
    root.appendChild(host);
  }
  return host;
}

function flushToastInlineQueue(): void {
  const host = getToastInlineQueueHost();
  while (
    toastInlinePending.length > 0
    && host.querySelectorAll('.toast-inline').length < TOAST_QUEUE_MAX_VISIBLE
  ) {
    const next = toastInlinePending.shift();
    if (!next) break;
    mountQueuedToastInline(host, next);
  }
}

function mountQueuedToastInline(host: HTMLDivElement, item: QueuedToast): void {
  const toast = document.createElement('div');
  toast.className = 'toast-inline';
  toast.style.cssText = [
    'position:static',
    `color:${item.color}`,
    `animation:toast-inline-fade ${item.durationMs}ms ease-out forwards`,
    item.extraStyle,
  ].join(';');
  toast.innerHTML = item.html;
  host.appendChild(toast);
  setTimeout(() => {
    toast.remove();
    flushToastInlineQueue();
  }, item.durationMs);
}

/** Channel B banner (ux-information-architecture.md §S14): one line, non-blocking.
 *  Default: queued in `#toast-inline-queue`, at most 2 visible, later calls wait.
 *  `skipQueue` mounts on `#dom-ui-root` at the caller's `position` (pickup / passive). */
export function showToastInline(html: string, opts: ToastInlineOptions): void {
  injectPanelStyles();
  ensureToastInlineFadeKeyframes();
  const durationMs = opts.durationMs ?? 2000;
  const color = opts.color ?? '#c8cdd4';
  const extraStyle = opts.extraStyle ?? '';

  if (opts.skipQueue) {
    const toast = document.createElement('div');
    toast.className = 'toast-inline';
    toast.style.cssText = [
      opts.position ?? '',
      `color:${color}`,
      `animation:toast-inline-fade ${durationMs}ms ease-out forwards`,
      extraStyle,
    ].join(';');
    toast.innerHTML = html;
    getDomUiRoot().appendChild(toast);
    setTimeout(() => toast.remove(), durationMs);
    return;
  }

  toastInlinePending.push({ html, color, extraStyle, durationMs });
  flushToastInlineQueue();
}

/** Channel C stamp (ux-information-architecture.md §S14): rare, one-shot, full-screen,
 *  dismissed by click / any key / timeout — whichever comes first. */
export function showToastStamp(text: string, opts: { durationMs?: number } = {}): void {
  const durationMs = opts.durationMs ?? 1500;

  const overlay = document.createElement('div');
  overlay.className = 'toast-stamp';
  overlay.style.pointerEvents = 'auto';
  overlay.textContent = text;
  getDomUiRoot().appendChild(overlay);

  const dismiss = (): void => {
    overlay.removeEventListener('click', dismiss);
    document.removeEventListener('keydown', keyDismiss);
    clearTimeout(tmr);
    overlay.remove();
  };
  const keyDismiss = (e: KeyboardEvent): void => {
    if (!e.repeat) dismiss();
  };
  overlay.addEventListener('click', dismiss);
  document.addEventListener('keydown', keyDismiss);
  const tmr = setTimeout(dismiss, durationMs);
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
