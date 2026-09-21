/** Shared UI primitives for fixed 960×640 device readouts.
 * Panels and HUDs mount under #dom-ui-root. Fonts, spacing and selection states
 * are defined here so individual surfaces can concentrate on information order.
 */

const STYLE_ID = 'game-panel-styles';

const CSS = `
/* Quiet marginalia: the world carries the image; interface carries only decisions. */
#dom-ui-root {
  --ui-font: "PingFang SC", "Microsoft YaHei", sans-serif;
  --ui-title: "Songti SC", "Noto Serif CJK SC", "SimSun", serif;
  --ui-mono: "SFMono-Regular", Consolas, monospace;
  --ui-body: 12px; --ui-label: 11px;
  --ui-text: #afb3ad; --ui-muted: #78847d; --ui-edge: rgba(147,160,146,.19);
  font-family: var(--ui-font); font-synthesis: none; color: var(--ui-text);
}
.game-panel {
  position: absolute; top: 104px; left: 256px; width: 680px; height: 468px;
  box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden;
  --ui-title: var(--ui-font);
  padding: 24px 26px 0;
  background:
    radial-gradient(ellipse at 17% 22%, rgba(94,95,69,.08), transparent 62%),
    radial-gradient(ellipse at 92% 86%, rgba(4,13,12,.22), transparent 66%),
    linear-gradient(112deg, rgba(15,20,18,.91), rgba(12,17,16,.86) 58%, rgba(8,13,12,.94));
  border: 0; border-top: 1px solid transparent; border-bottom: 1px solid transparent;
  box-shadow: 0 8px 28px rgba(0,5,4,.14);
  font: 12px/20px var(--ui-font); color: var(--ui-text); pointer-events: auto; z-index: 1000;
}
/* A static grain image is composited below the content; it never dims text or
 * catches input. No animated filter, scan lines, or per-frame texture work. */
.game-panel::before {
  content: ''; position:absolute; inset:0; z-index:0; pointer-events:none; opacity:.065;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='192'%3E%3Cfilter id='grain' x='0' y='0' width='100%25' height='100%25'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch' seed='19'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23grain)' d='M0 0h192v192H0z'/%3E%3C/svg%3E");
  background-size:192px 192px;
}
.game-panel::after {
  content: ''; position:absolute; inset:0; z-index:0; pointer-events:none;
  background:linear-gradient(90deg, transparent, rgba(147,156,137,.18) 19%, rgba(147,156,137,.05) 62%, transparent) top / 100% 1px no-repeat,
    linear-gradient(90deg, transparent 5%, rgba(147,156,137,.09) 57%, transparent) bottom / 100% 1px no-repeat;
}
.game-panel > * { position:relative; z-index:1; }
.game-panel button { font: inherit; }
.game-panel strong { font-weight:400; }
.game-panel :focus-visible { outline:1px solid #7d8c7f; outline-offset:2px; }
.game-panel.crt-stack > *:not(.scroll-area):not(.decision-layout):not(.module-report-layout) { flex:0 0 auto; }
.game-panel.crt-stack > .scroll-area, .game-panel.crt-stack > .decision-layout,
.game-panel.crt-stack > .module-report-layout { flex:1 1 auto; min-height:0; }
.panel-fixed { flex:0 0 auto; }
.panel-heading { display:flex; align-items:baseline; justify-content:space-between; gap:20px; padding-bottom:12px; margin-bottom:14px; border-bottom:1px solid var(--ui-edge); }
.game-panel .panel-title { font:20px/28px var(--ui-title); font-weight:400; letter-spacing:1px; color:#b5b9ae; margin:0 0 14px; }
.panel-heading .panel-title { margin:0; }
.panel-reserve { display:flex; align-items:baseline; gap:8px; font-size:11px; color:#78847d; white-space:nowrap; }
.panel-reserve strong { font:13px/20px var(--ui-mono); color:#b39b75; }
.game-panel .section-title, .readout-section { font-size:12px; font-weight:400; line-height:20px; color:#a7afa3; margin:14px 0 6px; }
.game-panel .separator { border:0; border-top:1px solid var(--ui-edge); margin:10px 0; }
.game-panel .hint { font-size:11px; color:#78847d; margin:8px 0; }
.game-panel .key-hint-bar { display:flex; flex:0 0 auto; align-items:center; flex-wrap:wrap; gap:4px 14px; min-height:44px; padding:8px 0; margin:12px 0 0; border-top:1px solid var(--ui-edge); font-size:10px; color:#78847d; box-sizing:border-box; }
.game-panel .key-hint-bar .key { display:inline-block; color:#9aa59a; font:10px/16px var(--ui-mono); border-bottom:1px solid #465047; padding:0 2px; margin-right:3px; }
.game-panel .key-hint-bar [id] { display:inline-flex; align-items:center; gap:5px; min-height:26px; cursor:pointer; }
.game-panel .action-btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:4px 10px; min-height:28px; background:rgba(129,148,123,.055); border:1px solid #384439; border-radius:0; color:#b6bfaf; font:12px/18px var(--ui-font); cursor:pointer; }
.game-panel .action-btn:hover, .game-panel .action-btn:focus-visible, .game-panel .action-btn.is-selected { background:rgba(129,148,123,.15); border-color:#687561; }
.game-panel .action-btn:disabled { color:#59675e; cursor:default; }
.game-panel .action-bar { display:none; }
.game-panel .stat-row { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px; padding:3px 0; font-size:12px; }
.game-panel .stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 16px; }
.game-panel .stat-label { color:#78847d; min-width:42px; }
.game-panel .stat-value { color:#adb6aa; font-weight:400; font-family:var(--ui-mono); }
.game-panel .stat-bar { flex:1; height:3px; min-width:40px; background:#19221c; overflow:hidden; }
.game-panel .stat-bar-fill { height:100%; }
.readout-copy { font-size:12px; line-height:21px; color:#969f93; }
.readout-note, .readout-label { font-size:11px; line-height:18px; color:#7e8a7e; }
.readout-note { margin:5px 0; }
.readout-value { font:16px/24px var(--ui-mono); color:#b3baae; }
.readout-hero { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px 12px; padding:8px 0; border-bottom:1px solid var(--ui-edge); }
.readout-hero strong { font:18px/26px var(--ui-mono); color:#b9baaa; }
.readout-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; padding:10px 0; }
.readout-metric { display:flex; flex-direction:column; gap:3px; min-width:0; }
.readout-metric .readout-value { font-size:13px; line-height:20px; }
.readout-empty { display:block; padding:16px 0; color:#929e90; }
.readout-list { display:flex; flex-direction:column; gap:3px; }
.readout-row { display:flex; align-items:baseline; justify-content:space-between; gap:12px; min-height:28px; }
.game-panel .scroll-area, .readout-detail { min-height:0; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; scrollbar-width:thin; scrollbar-color:#344238 transparent; }
.game-panel .scroll-area { flex:1; }
.game-panel .scroll-area::-webkit-scrollbar, .readout-detail::-webkit-scrollbar { width:3px; }
.game-panel .scroll-area::-webkit-scrollbar-thumb, .readout-detail::-webkit-scrollbar-thumb { background:#344238; }
.decision-layout { display:grid; grid-template-columns:minmax(0,1fr) 210px; gap:22px; min-height:0; flex:1; overflow:hidden; }
.decision-main, .decision-aside { min-width:0; min-height:0; }
.decision-aside { border-left:1px solid var(--ui-edge); padding-left:20px; }
.decision-main > .readout-section:first-child { margin-top:0; }
.game-panel .inspect-dock { font:12px/21px var(--ui-font); color:#879484; }
.game-panel .decision-aside.inspect-dock { overflow-y:auto; scrollbar-width:thin; scrollbar-color:#344238 transparent; }
.inspect-dock > div { margin-bottom:12px; }
.inspect-l1 { color:#b2bcab; font-family:var(--ui-title); font-size:14px; line-height:23px; }
.inspect-l2, .inspect-l3 { color:#8d9c8b; }
.inspect-l4 { color:#ab9676; }
.inspect-l5 { color:#6f9988; }
.game-panel .slot-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin:0 0 4px; }
.game-panel .slot-cell { box-sizing:border-box; border:0; border-bottom:1px solid #29372b; padding:6px 7px; min-width:0; min-height:52px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; cursor:pointer; position:relative; }
.game-panel .slot-cell.slot-selected { background:rgba(138,155,119,.08); border-bottom-color:#86937b; }
.slot-label, .slot-info { font-size:10px; color:#6e806f; }
.slot-name { font-size:12px; line-height:18px; font-weight:400; }
.decision-main > .readout-section { margin:6px 0 4px; }
.game-panel .tile-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:2px 6px; margin:4px 0; }
.game-panel .item-tile { min-width:0; min-height:24px; box-sizing:border-box; border:1px solid transparent; border-bottom-color:rgba(137,158,129,.1); padding:2px 6px; font-size:11px; line-height:18px; cursor:pointer; }
.game-panel .item-tile.tile-selected { background:rgba(138,155,119,.085); border-color:rgba(151,164,145,.25); }
.game-panel .item-tile.tile-disabled { color:#647363; cursor:default; }
.sortie-conditions { border-top:1px solid var(--ui-edge); margin-top:20px; padding-top:3px; }
.sortie-conditions .readout-section { margin:8px 0 4px; }
.sortie-conditions .readout-metrics { gap:8px; }
.sortie-conditions .readout-label { font-size:10px; }
.sortie-conditions .readout-value { font-size:11px; }
.loadout-navigation-hints { display:flex; gap:10px; }
.inventory-kind, .inventory-stars { color:#718574; font-size:10px; }
.inventory-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.inventory-count { margin-left:auto; font:10px/18px var(--ui-mono); color:#899582; }
.game-panel .card-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.game-panel .upgrade-card { display:flex; align-items:center; justify-content:space-between; min-height:40px; padding:5px 9px; border:0; border-bottom:1px solid rgba(137,158,129,.1); cursor:pointer; }
.game-panel .upgrade-card.card-selected { background:linear-gradient(90deg,rgba(138,155,119,.12),transparent); }
.card-body { flex:1; min-width:0; }
.card-name { font-size:12px; line-height:18px; color:#a7b49f; }
.card-body .readout-note { display:inline; font:10px/16px var(--ui-mono); }
.card-cost { font-size:11px; color:#8e927c; }
.game-panel .upgrade-card.card-locked, .game-panel .upgrade-card.card-maxed { cursor:default; }
#growth-panel .readout-list { gap:0; }
#growth-panel .readout-section { margin-top:0; }
#growth-panel .readout-hero { margin:12px 0; }
#growth-panel .readout-value { font-size:15px; }
#growth-panel .decision-layout { grid-template-columns:minmax(0,1fr) 245px; }
#growth-panel .growth-route-line { display:flex; align-items:baseline; justify-content:space-between; gap:10px; min-height:28px; }
#growth-panel [data-growth-feedback] { font-size:11px; color:#b39b75; }
#growth-panel .growth-category { font-size:11px; line-height:18px; color:#7e8a7e; }
#growth-panel .growth-name { font-size:16px; line-height:24px; color:#b5b9ae; }
#growth-panel .growth-level-line { display:flex; flex-wrap:wrap; justify-content:space-between; gap:2px 8px; margin:3px 0 10px; font-size:11px; color:#7e8a7e; }
#growth-panel .growth-level { font:11px/18px var(--ui-mono); color:#b3baae; white-space:nowrap; }
#growth-panel .growth-card-meta { display:flex; flex-wrap:wrap; gap:0 10px; }
#growth-panel .upgrade-card { flex:0 0 auto; gap:8px; }
#growth-panel .growth-card-state { font-size:11px; color:#7e8a7e; }
#growth-panel .card-cost, #growth-panel .growth-cost { color:#b39b75; }
#growth-panel .growth-gain { font-size:12px; line-height:24px; color:#b3baae; margin-bottom:5px; }
#growth-panel .growth-gain strong, #growth-panel .growth-cost strong { font:16px/24px var(--ui-mono); }
#growth-panel .growth-effect-total { display:flex; flex-wrap:wrap; gap:0 8px; font-size:12px; line-height:20px; }
#growth-panel .growth-before { color:#7e8a7e; }
#growth-panel .growth-after { color:#b3baae; }
#growth-panel .growth-term { white-space:nowrap; }
#growth-panel .growth-mechanic-note { margin:3px 0 0; }
#growth-panel .growth-flavor { margin:8px 0; }
#growth-panel .growth-condition { display:flex; flex-direction:column; margin:8px 0; font-size:12px; line-height:20px; color:#ab9676; }
#growth-panel .growth-condition > span { font-size:11px; }
#growth-panel .growth-payment { border-top:1px solid var(--ui-edge); padding-top:5px; margin-top:10px; }
#growth-panel .growth-payment .stat-row { justify-content:space-between; }
#growth-panel .growth-payment .readout-note { margin:0; }
#growth-panel .growth-state-ready { color:#b3baae; }
#growth-panel .growth-state-shortfall { color:#b89040; }
#growth-panel .growth-state-locked, #growth-panel .growth-state-owned { color:#7e8a7e; }
#growth-panel .key-hint-bar [data-growth-action-state] .key { color:inherit; border-bottom-color:currentColor; }
#growth-panel .growth-consequences { border-top:1px solid var(--ui-edge); margin-top:8px; padding-top:5px; }
#growth-panel .growth-consequences .readout-section { margin:0; }
#growth-panel .growth-consequences .stat-row { justify-content:space-between; padding:1px 0; font-size:11px; line-height:18px; }
#growth-panel .growth-consequences .readout-note { margin:3px 0; }
.game-panel .pill { display:inline-block; padding:1px 5px; margin:2px; font-size:11px; border-bottom:1px solid #354238; }
.game-panel .dmg-row { display:flex; align-items:center; gap:8px; padding:8px 0; }
.game-panel .dmg-bar-wrap { flex:1; max-width:130px; height:3px; margin-left:auto; background:#24241e; overflow:hidden; }
.game-panel .dmg-bar-fill { height:100%; opacity:.6; transition:width .4s ease-out; }
.game-panel .crt-tabs { display:flex; gap:22px; margin:0 0 16px; border-bottom:1px solid var(--ui-edge); }
.game-panel .crt-tab { padding:5px 0 9px; border:0; border-bottom:1px solid transparent; background:transparent; font:12px/18px var(--ui-font); color:#748473; cursor:pointer; }
.game-panel .crt-tab.is-selected { color:#b1bda6; border-bottom-color:#a4af98; }
.module-report-layout { display:grid; grid-template-columns:130px minmax(0,1fr); gap:26px; min-height:0; flex:1; overflow:hidden; }
.module-report-list { display:flex; flex-direction:column; gap:10px; }
.module-report-row { position:relative; padding:8px 10px; min-height:52px; border:0; border-left:1px solid transparent; background:transparent; font:12px/20px var(--ui-font); color:#94a28e; text-align:left; cursor:pointer; }
.module-report-row.is-selected { border-left-color:#92a282; background:linear-gradient(90deg,rgba(138,155,119,.07),transparent); }
.module-report-row .readout-value { font-size:11px; line-height:18px; }
.module-identity-band { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:12px; }
.module-identity-cell { background:transparent; border:0; border-bottom:1px solid #29382a; color:#81977f; padding:4px; text-align:left; font:11px/18px var(--ui-font); cursor:pointer; }
.module-identity-cell.is-selected, .module-identity-cell.is-active { border-bottom-color:#93a67f; }
.module-identity-top { display:flex; align-items:baseline; justify-content:space-between; gap:5px; }
.module-identity-name, .module-identity-number { font-size:11px; white-space:nowrap; }
.module-identity-track { height:2px; background:#19221a; margin-top:3px; }
.module-identity-fill { height:100%; }
.module-identity-affordance { color:#7f947b; margin-left:4px; }
#allocation-panel { top:108px; left:466px; width:450px; height:452px; }
.allocation-input { display:flex; align-items:center; gap:10px; margin:16px 0 4px; padding:10px 0; min-height:46px; border-bottom:1px solid var(--ui-edge); }
.allocation-input .readout-value { flex:1; font:20px/28px var(--ui-mono); color:#b39b75; text-align:center; }
.allocation-step { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; flex:0 0 26px; padding:0; border:1px solid #354438; background:transparent; color:#9eae96; font:16px/20px var(--ui-mono); cursor:pointer; }
.allocation-step:disabled { color:#405142; border-color:#203024; cursor:default; }
#allocation-panel .readout-hero { border:0; }
#allocation-panel .readout-value { font-size:15px; }
#allocation-panel .allocation-input .readout-value { font-size:20px; }
.game-panel .pbar-wrap { position:relative; width:100%; height:3px; background:#1d2820; overflow:hidden; }
.game-panel .pbar-fill { height:100%; position:absolute; top:0; left:0; opacity:.7; }
.game-panel .pbar-preview { position:absolute; top:0; height:100%; background:#748b6d; opacity:.45; }
.game-panel .pbar-label { display:flex; justify-content:space-between; font-size:10px; color:#6d816b; }
.game-panel-backdrop { position:absolute; inset:0; background:rgba(2,6,5,.16); z-index:998; pointer-events:auto; }
.game-panel.pause-menu-panel, #rift-result-panel.game-panel { top:50%; left:50%; height:auto; max-height:450px; transform:translate(-50%,-50%); }
.game-panel.pause-menu-panel { width:330px; }
#rift-result-panel.game-panel { width:450px; }
#rift-result-panel .tile-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
#rift-result-panel .pill { margin:0; padding:1px 0; line-height:18px; }
#impact-result-panel.game-panel { width:520px; left:360px; height:440px; }
.pause-menu-list { display:flex; flex-direction:column; gap:4px; margin:10px 0; }
.pause-menu-row { min-height:30px; padding:6px 10px; font-size:12px; cursor:pointer; color:#82917d; }
.pause-menu-row.is-selected { color:#b4bda7; background:linear-gradient(90deg,rgba(138,155,119,.1),transparent); }
.crt-empty { display:flex; align-items:center; gap:12px; min-height:80px; }
.crt-empty-why, .crt-empty-next { font-size:12px; line-height:21px; color:#82927c; }
.crt-empty-next { margin-top:8px; }
.option { min-height:28px; padding:5px 8px; cursor:pointer; }
.option.selected { background:rgba(138,155,119,.08); }
/* Core-only interaction sample: real device at left, decision in adjacent dark.
 * Other allocations and all approved HUD surfaces retain their existing rules. */
#allocation-panel.core-allocation {
  inset:0; width:960px; height:640px; padding:0; border:0; background:none; box-shadow:none;
  overflow:hidden; --core-x:480px; --core-y:320px;
}
#allocation-panel.core-allocation::before, #allocation-panel.core-allocation::after { display:none; }
.core-allocation-backdrop {
  position:absolute; inset:0; z-index:998; pointer-events:auto; --core-x:480px; --core-y:320px;
  background:
    linear-gradient(90deg, transparent calc(var(--core-x) + 50px), rgba(3,7,6,.7) calc(var(--core-x) + 180px), rgba(3,7,6,.88)),
    radial-gradient(ellipse 260px 255px at var(--core-x) calc(var(--core-y) - 28px), transparent 26%, rgba(3,7,6,.26) 65%, rgba(3,7,6,.68) 100%);
  animation:core-surround-in 260ms ease-out both;
}
#allocation-panel.core-allocation > * { position:absolute; opacity:0; transition:opacity 220ms ease-out; }
#allocation-panel.core-present > * { opacity:1; }
.core-identity { left:calc(var(--core-x) - 56px); top:calc(var(--core-y) - 144px); width:112px; text-align:center; font:16px/24px var(--ui-font); letter-spacing:4px; color:#aeb3a5; text-shadow:0 1px 5px #050907; }
.core-integrity { left:calc(var(--core-x) - 62px); top:calc(var(--core-y) + 34px); width:124px; font:11px/18px var(--ui-font); text-shadow:0 1px 4px #050907; }
.core-integrity-label { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; color:#788b7d; }
.core-integrity-label > span { font:13px/18px var(--ui-mono); color:#a7b19e; }
.core-integrity-label small { font-size:10px; color:#758072; }
.core-repair-preview { min-height:20px; margin-top:8px; font:11px/18px var(--ui-font); color:#9ba38c; }
.core-repair-preview span { float:right; font-family:var(--ui-mono); color:#b19c76; }
#allocation-panel .core-integrity .pbar-wrap { height:2px; background:rgba(92,113,91,.24); }
.core-work { left:clamp(400px, calc(var(--core-x) + 200px), 700px); top:calc(var(--core-y) - 118px); width:260px; color:#a0aa9c; text-shadow:0 1px 4px #050907; }
.core-work-heading { display:flex; justify-content:space-between; align-items:baseline; font:16px/24px var(--ui-font); color:#b2b5a6; }
.core-reserve { font:10px/18px var(--ui-font); color:#7c8677; }
.core-amount { display:flex; align-items:center; gap:12px; margin:26px 0 10px; padding:0 0 12px; border-bottom:1px solid rgba(157,163,136,.16); }
.core-amount strong { flex:1; font:22px/30px var(--ui-mono); text-align:right; color:#b9a580; }
.core-unit { flex:1; font:11px/18px var(--ui-font); color:#8b927f; }
.core-amount .allocation-step { border:0; background:transparent; color:#a0aa94; }
.core-amount .allocation-step:hover:not(:disabled) { color:#d0c3a6; background:rgba(139,145,117,.06); }
.core-efficiency { font:10px/18px var(--ui-font); color:#727f71; margin-bottom:24px; }
.core-outcome { display:flex; justify-content:space-between; align-items:baseline; padding:4px 0; font:12px/20px var(--ui-font); }
.core-outcome > span:first-child { color:#7e8c7e; }
.core-outcome > span:last-child { font-family:var(--ui-mono); }
.core-outcome i { font-style:normal; color:#647765; padding:0 5px; }
.core-outcome strong { color:#b1b99f; }
.core-remaining { font-size:11px; }
.core-remaining > span:last-child { color:#a69473; }
.core-reason { min-height:36px; margin-top:10px; font:10px/18px var(--ui-font); color:#7c8979; }
.core-actions { display:flex; align-items:center; gap:28px; margin-top:14px; }
.core-actions button { border:0; border-bottom:1px solid rgba(139,153,128,.26); padding:5px 0; background:transparent; color:#b4bba8; cursor:pointer; font:12px/18px var(--ui-font); }
.core-actions button span { margin-right:6px; font:10px/18px var(--ui-mono); color:#7b8878; }
.core-actions button:disabled { color:#4c5c4e; border-color:rgba(139,153,128,.1); cursor:default; }
.core-actions button:hover:not(:disabled) { color:#d0c3a6; border-color:#8e9b7f; }
.core-controls { margin-top:18px; font:10px/18px var(--ui-font); color:#667664; }
.core-committed .core-work { opacity:.45 !important; transition:opacity 400ms ease-out !important; }
.core-committed .core-repair-preview { color:#c1b38d; }
@keyframes core-surround-in { from {opacity:0;} to {opacity:1;} }
/* The purifier sits directly below the player's arrival position. Put its name
 * alongside the tank, and keep the figure above outside the local focus pool. */
.core-allocation-backdrop.allocation-purifier {
  background:linear-gradient(90deg, transparent calc(var(--core-x) + 50px), rgba(3,7,6,.7) calc(var(--core-x) + 180px), rgba(3,7,6,.88)),
    radial-gradient(ellipse 190px 148px at var(--core-x) calc(var(--core-y) - 38px), transparent 28%, rgba(3,7,6,.3) 60%, rgba(3,7,6,.86) 100%);
}
.allocation-purifier .core-identity { left:calc(var(--core-x) - 174px); top:calc(var(--core-y) - 78px); width:112px; text-align:right; letter-spacing:2px; }
/* Inventory decisions retain their tested information order, beside the device. */
.game-panel.world-interaction {
  left:344px; top:124px; width:584px; height:464px; padding:0;
  border:0; background:none; box-shadow:none; overflow:visible;
  animation:world-decision-in 260ms ease-out both;
}
.game-panel.world-interaction::before, .game-panel.world-interaction::after { display:none; }
.world-object-name {
  position:absolute; z-index:1000; left:calc(var(--core-x) - 64px); top:calc(var(--core-y) - 144px);
  width:128px; font:16px/24px var(--ui-font); text-align:center; letter-spacing:3px;
  color:#aeb3a5; text-shadow:0 1px 5px #050907; pointer-events:none;
  animation:world-decision-in 260ms ease-out both;
}
.world-interaction .panel-heading { border:0; padding:0; margin-bottom:20px; }
.world-interaction .panel-heading .panel-title { font-size:16px; line-height:24px; }
.world-interaction .panel-reserve { font-size:10px; color:#7c8677; }
.world-interaction .panel-reserve strong { font-size:11px; }
.world-interaction .decision-layout { grid-template-columns:minmax(0,1fr) 192px; gap:22px; }
.world-interaction .decision-aside { border-left-color:rgba(147,160,146,.09); padding-left:16px; }
.world-interaction .key-hint-bar { border:0; margin-top:16px; }
.world-interaction .action-btn { background:none; border:0; border-bottom:1px solid rgba(139,153,128,.26); padding:4px 0; }
.world-interaction .action-btn:hover, .world-interaction .action-btn:focus-visible { background:none; border-bottom-color:#8e9b7f; }
.world-interaction .slot-cell { border-bottom-color:rgba(147,160,146,.18); }
.world-interaction .slot-cell.slot-selected { border-bottom-color:#86937b; }
@keyframes world-decision-in { from {opacity:0;} to {opacity:1;} }
/* Scene menus share the device decisions' open composition, without a camera target. */
.scene-menu-backdrop {
  background:
    linear-gradient(90deg, rgba(3,7,6,.08), rgba(3,7,6,.32) 23%, rgba(3,7,6,.86) 45%, rgba(3,7,6,.94)),
    radial-gradient(ellipse at 23% 48%, transparent 12%, rgba(3,7,6,.48) 76%);
  animation:world-decision-in 220ms ease-out both;
}
.scene-menu-backdrop.scene-menu-compact-backdrop {
  background:
    linear-gradient(90deg, rgba(3,7,6,.12), rgba(3,7,6,.25) 32%, rgba(3,7,6,.86) 61%, rgba(3,7,6,.94)),
    radial-gradient(ellipse at 28% 48%, transparent 12%, rgba(3,7,6,.48) 76%);
}
.game-panel.scene-menu {
  padding:0; border:0; background:none; box-shadow:none;
  text-shadow:0 1px 4px #050907; animation:world-decision-in 220ms ease-out both;
}
.game-panel.scene-menu::before, .game-panel.scene-menu::after { display:none; }
.scene-menu .panel-heading { border:0; padding:0; margin-bottom:20px; }
.game-panel.scene-menu .panel-title { font:16px/24px var(--ui-font); letter-spacing:1px; color:#b2b5a6; }
.scene-menu .panel-heading .panel-title { margin:0; }
.scene-menu .panel-reserve { font-size:10px; color:#7c8677; }
.scene-menu .panel-reserve strong { font-size:11px; }
.scene-menu .key-hint-bar { border:0; margin-top:18px; }
.scene-menu .action-btn { background:none; border:0; border-bottom:1px solid rgba(139,153,128,.26); padding:4px 0; }
.scene-menu .action-btn:hover, .scene-menu .action-btn:focus-visible { background:none; border-bottom-color:#8e9b7f; color:#d0c3a6; }
.game-panel.scene-menu-report { left:344px; top:124px; width:584px; height:464px; }
.scene-menu-report .crt-tabs { border:0; gap:28px; margin-bottom:22px; }
.scene-menu-report .crt-tab { padding:3px 0 6px; }
.scene-menu-report .module-report-row { padding-left:12px; background:none; }
.scene-menu-report .module-report-row.is-selected { border-left-color:#7e8c70; background:none; color:#b1b99f; }
.game-panel.scene-menu-pause { left:536px; top:220px; width:304px; height:auto; max-height:368px; transform:none; }
.scene-menu-pause .pause-menu-list { gap:8px; margin:20px 0 12px; }
.scene-menu-pause .pause-menu-row { position:relative; padding:5px 0 5px 16px; min-height:28px; background:none; }
.scene-menu-pause .pause-menu-row::before { content:''; position:absolute; left:0; top:14px; width:5px; height:1px; background:transparent; }
.scene-menu-pause .pause-menu-row.is-selected { color:#b9bca9; background:none; }
.scene-menu-pause .pause-menu-row.is-selected::before { background:#a69e7d; }
#rift-result-panel.game-panel.scene-menu-result { left:504px; top:138px; width:392px; height:auto; max-height:464px; transform:none; }
.scene-menu-result .readout-hero { margin:10px 0; border-bottom-color:rgba(147,160,146,.12); }
.scene-menu-result .pill { border-bottom-color:rgba(147,160,146,.12); }
#impact-result-panel.game-panel.scene-menu-impact { left:400px; top:124px; width:496px; height:464px; }
.focus-pause-copy { position:absolute; left:536px; top:244px; width:304px; font:16px/24px var(--ui-font); color:#b2b5a6; letter-spacing:1px; text-shadow:0 1px 4px #050907; }
.focus-pause-copy span { display:block; margin-top:14px; font:11px/18px var(--ui-font); color:#7e8a7e; letter-spacing:0; }
/* HUD has no solid plate. Small stable readings sit in the margins. */
.device-plate { position:absolute; box-sizing:border-box; padding:0; border:0; background:transparent; font:11px/16px var(--ui-font); color:#8a9a88; pointer-events:none; text-shadow:0 1px 3px #000; }
.hud-report-entry{display:flex;align-items:baseline;justify-content:flex-end;gap:7px;padding:4px;border:0;background:transparent;color:#929e91;font:11px/18px var(--ui-font);text-shadow:0 1px 3px #000;pointer-events:auto;cursor:pointer;white-space:nowrap}
.hud-report-entry .hud-entry-key{font:11px/18px var(--ui-mono);color:#b0b7a7}.hud-report-entry .hud-entry-weight{font:10px/18px var(--ui-mono);color:#879581}
.hud-report-entry:hover,.hud-report-entry:focus-visible{color:#c0c3b0}.hud-report-entry:focus-visible{outline:1px solid #727e66;outline-offset:1px}.hud-report-entry.is-heavy .hud-entry-weight{color:#b0a689}
.hud-report-entry[hidden],#dom-ui-root:has(.game-panel,.inventory-wrap) .hud-report-entry{visibility:hidden;pointer-events:none}
#purif-report-entry{align-self:flex-end;margin-right:-4px}
#rift-hud-burden{opacity:.8}
.rift-equipment-row{display:grid;grid-template-columns:24px 25px minmax(0,1fr) max-content;gap:6px;align-items:center;min-height:28px}.rift-equipment-row img{width:24px;height:24px;image-rendering:pixelated;object-fit:contain}.rift-equipment-row .rift-equipment-name{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rift-equipment-row.is-empty{opacity:.45}.rift-equipment-key{font:9px/14px var(--ui-mono);color:#8e9e81}.rift-equipment-uses{font:10px/14px var(--ui-mono);text-align:right;color:#b1b49c}
#purif-hud { top:22px; right:24px; width:auto; min-width:162px; z-index:999; opacity:.68; }
.purif-hud-inner { display:flex; flex-direction:column; gap:5px; }
.purif-hud-kindling { display:flex; justify-content:flex-end; align-items:baseline; gap:8px; }
.purif-hud-details { display:flex; flex-direction:column; gap:2px; }
.purif-readout-slot { display:flex; align-items:baseline; gap:7px; white-space:nowrap; }
#purif-hud .purif-readout-slot { justify-content:flex-end; }
#purif-prompt { bottom:22px; left:50%; transform:translateX(-50%); max-width:480px; min-height:0; opacity:.8; z-index:999; transition:opacity .2s; }
.purif-prompt-hints { display:flex; align-items:baseline; gap:6px; opacity:.5; }
.purif-prompt-inner { text-align:center; }
.purif-prompt-inner .purif-readout-slot { justify-content:center; }
.purif-prompt-inner .purif-readout-slot + .purif-readout-slot { opacity:.6; margin-top:3px; }
#rift-hud { position:absolute; inset:0; pointer-events:none; font:11px/16px var(--ui-font); }
#rift-hud-status { top:24px; left:24px; width:144px; opacity:.8; }
#rift-hud-chaos { top:66px; left:24px; width:144px; opacity:.75; }
.rift-readout-header { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:5px; }
.rift-hud-label { font-size:10px; line-height:14px; color:#71816e; }
.rift-hud-value { font:11px/16px var(--ui-mono); color:#a5b09a; }
.rift-hud-state { display:block; margin-top:4px; font-size:10px; line-height:14px; color:#8e9b83; }
.rift-hud-state[hidden] { display:none; }
#rift-hud-kindling { top:24px; right:24px; display:flex; align-items:baseline; gap:8px; opacity:.7; }
#rift-hud-kindling .rift-hud-value { color:#b39b75; }
#rift-hud-effects { top:116px; left:24px; max-width:190px; display:flex; flex-direction:column; gap:3px; opacity:.7; }
.device-effect { display:flex; align-items:baseline; gap:8px; }
.device-effect-name, .device-effect-time { font-size:10px; line-height:15px; }
#rift-hud-effects:empty { display:none; }
#rift-hud-tools { left:24px; bottom:24px; width:180px; display:flex; flex-direction:column; gap:6px; opacity:.75; }
.rift-tool-row { display:grid; grid-template-columns:24px minmax(0,1fr) 20px; gap:6px; font-size:11px; line-height:16px; }
.rift-tool-key, .rift-tool-uses { font:10px/16px var(--ui-mono); color:#879a80; }
.rift-tool-uses { text-align:right; }
#rift-extract-prompt, #loot-search-prompt { left:50%; bottom:22px; transform:translateX(-50%); display:none; font:12px/18px var(--ui-font); z-index:1100; }
.prompt-key { color:#a7b19c; margin-right:8px; }
.prompt-action { color:#99a48d; }
#loot-search-channel { left:50%; bottom:49px; transform:translateX(-50%); width:120px; display:none; z-index:1100; }
.channel-track { height:2px; background:#29362a; overflow:hidden; }
.channel-fill { height:100%; width:0; background:#88a188; }
#loot-search-kindling { right:24px; top:24px; display:flex; align-items:baseline; gap:8px; font-size:11px; opacity:.7; z-index:1100; }
.kindling-label, .kindling-value { font-size:11px; }
.kindling-value { color:#b39b75; }
#rift-minimap.device-plate { right:20px; bottom:20px; padding:0; border:0; outline:none; opacity:.85; z-index:999; }
#rift-minimap canvas { display:block; width:66px; height:66px; border:0; clip-path:circle(50%); image-rendering:pixelated; }
.rift-minimap-legend { margin-top:5px; text-align:center; color:#8a9c92; font:10px/14px var(--ui-font); letter-spacing:1px; opacity:.8; }
#rift-hud-help { position:absolute; left:24px; top:182px; width:218px; color:#9ba696; font:11px/19px var(--ui-font); text-shadow:0 1px 3px #000; pointer-events:auto; }
#rift-hud-help summary { width:max-content; cursor:pointer; opacity:.7; list-style:none; }
#rift-hud-help summary:focus-visible { outline:1px solid #81917a; outline-offset:3px; }
#rift-hud-help[open] summary { opacity:.9; margin-bottom:4px; }
#rift-hud-help .rift-control-key { color:#c0b49a; }
#rift-encounter-log { position:absolute; left:50%; bottom:90px; transform:translateX(-50%); width:520px; max-width:520px; display:none; font:13px/23px var(--ui-title); letter-spacing:1px; color:#a1ac97; text-align:center; pointer-events:none; text-shadow:0 2px 5px #000; z-index:40; }
#rift-encounter-log.is-recording { display:block; }
.encounter-log { display:inline-block; max-width:100%; padding:3px 12px; }
.encounter-node { display:inline; margin-right:.5em; }
.encounter-mark { color:#8eaa94; }
.toast-inline { position:fixed; font:11px/18px var(--ui-font); color:#b2bca7; pointer-events:none; white-space:nowrap; text-shadow:0 1px 3px #000; z-index:1500; }
#toast-inline-queue { position:absolute; top:114px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; gap:4px; align-items:center; pointer-events:none; z-index:1500; }
#toast-inline-queue .toast-inline { position:static; }
.toast-stamp { position:fixed; inset:0; background:rgba(4,9,7,.7); display:flex; align-items:center; justify-content:center; font:20px/32px var(--ui-title); letter-spacing:2px; color:#b2aa90; text-align:center; cursor:pointer; z-index:2000; }
#dom-ui-root:has(.game-panel) #purif-hud, #dom-ui-root:has(.game-panel) #purif-prompt { visibility:hidden; }

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

/** Shared device shell: fixed 720×548, positioned by `.game-panel` CSS. */
export function createCrtPanel(id: string): HTMLDivElement {
  injectPanelStyles();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'game-panel crt-stack';
  el.style.pointerEvents = 'auto';
  return el;
}

/** Reveal keyboard navigation only; pointer selection preserves the viewport. */
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
  /** Cancel only this source's transient feedback when its owning context changes. */
  channel?: string;
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
  /** Override mount for skipQueue flashes. Gym passes the lesson overlay root. */
  host?: HTMLElement;
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
  channel?: string;
  html: string;
  color: string;
  extraStyle: string;
  durationMs: number;
}

const toastInlinePending: QueuedToast[] = [];
const toastInlineMounted = new Map<HTMLElement, { channel?: string; timer: ReturnType<typeof setTimeout> }>();

/** A pickup panel replaces its world toast, without discarding combat or save feedback. */
export function clearToastInline(channel: string): void {
  for (let index = toastInlinePending.length - 1; index >= 0; index--) {
    if (toastInlinePending[index]!.channel === channel) toastInlinePending.splice(index, 1);
  }
  for (const [element, item] of toastInlineMounted) {
    if (item.channel !== channel) continue;
    clearTimeout(item.timer); element.remove(); toastInlineMounted.delete(element);
  }
  if (document.getElementById(TOAST_QUEUE_ID)) flushToastInlineQueue();
}

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
  const timer = setTimeout(() => {
    toastInlineMounted.delete(toast); toast.remove();
    flushToastInlineQueue();
  }, item.durationMs);
  toastInlineMounted.set(toast, { channel: item.channel, timer });
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
    (opts.host ?? getDomUiRoot()).appendChild(toast);
    const timer = setTimeout(() => { toastInlineMounted.delete(toast); toast.remove(); }, durationMs);
    toastInlineMounted.set(toast, { channel: opts.channel, timer });
    return;
  }

  toastInlinePending.push({ html, color, extraStyle, durationMs, channel: opts.channel });
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
