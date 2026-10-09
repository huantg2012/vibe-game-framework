/** Inventory uses the accepted report's shared scene material and typography. */
const STYLE_ID = 'inventory-panel-styles';
const CSS = `
.inventory-wrap .inventory-native-item{width:24px;height:24px;display:block;margin:auto}
.inventory-wrap .inventory-art .inventory-native-item{width:48px;height:48px}
.inventory-wrap .inventory-slot-icon .inventory-native-item{width:24px;height:24px}
.inventory-item-image:has(.inventory-native-item),.inventory-slot-icon:has(.inventory-native-item),.inventory-art:has(.inventory-native-item){display:flex;align-items:center;justify-content:center}

.inventory-detail-column > .inventory-actions{flex:none;margin-top:0;padding:7px 0 0 18px;border-left:1px solid #263525;min-height:26px;gap:5px 12px}
.inventory-detail-column > .inventory-actions:empty{display:none}
.inventory-detail-meta{overflow-wrap:normal;word-break:keep-all}
.inventory-wrap{box-sizing:border-box;display:flex;flex-direction:column;gap:12px;font:11px/18px var(--ui-font);color:#9eaa98;pointer-events:auto;outline:none}
#inventory-panel.game-panel{left:330px;top:102px;width:598px;height:490px;padding:0;z-index:1100}
.inventory-catalog{position:relative;min-height:0;flex:1;width:100%;height:100%}
.inventory-wrap *{box-sizing:border-box}.inventory-wrap [hidden]{display:none!important}.inventory-wrap button,.inventory-wrap select{font:inherit;color:inherit;border-radius:0}.inventory-wrap button{background:none;border:0;padding:0;cursor:pointer;text-align:left}.inventory-wrap button:disabled{color:#657260;cursor:default}.inventory-wrap button:focus-visible,.inventory-wrap select:focus-visible{outline:1px solid #748367;outline-offset:3px}
.inventory-header{display:flex;align-items:baseline;gap:16px;flex:none;margin-bottom:8px}.inventory-title{font:16px/24px var(--ui-font);letter-spacing:1px;color:#b2b5a6;margin:0}.inventory-context{font-size:10px;color:#75816f}.inventory-close{margin-left:auto!important;font-size:10px!important;color:#82907b!important;white-space:nowrap}.inventory-weight{margin-left:auto;white-space:nowrap;font-size:10px;position:relative}.inventory-weight strong{font:11px/18px var(--ui-mono);font-weight:400;margin-left:8px;color:#a7b19b}.inventory-weight.is-over strong{color:#b69671}.inventory-survival{display:block;font-size:9px;color:#7e8b72}.inventory-weight+.inventory-close{margin-left:0!important}
.inventory-departure-conditions{display:grid;grid-template-columns:1fr 1.7fr 1fr;gap:14px;flex:none;min-height:48px;margin-bottom:5px}.inventory-departure-conditions[hidden]{display:none}.inventory-departure-conditions>div{display:flex;flex-direction:column;gap:2px}.inventory-departure-conditions span,.inventory-departure-conditions small{font-size:9px;line-height:13px;color:#748568}.inventory-departure-conditions strong{font:11px/17px var(--ui-mono);font-weight:400;color:#a8b195}

.inventory-filters{display:flex;align-items:center;gap:20px;flex:none;height:24px}.inventory-filter{font-size:11px!important;color:#788773!important}.inventory-filter.is-current{color:#bdc2ac!important}.inventory-sort{margin-left:auto;border:0;background:#101810;font-size:10px!important;max-width:92px}.inventory-body{display:grid;grid-template-columns:minmax(0,1fr) 186px;gap:22px;flex:1;min-height:0;overflow:hidden}#inventory-panel > .inventory-body{flex:1 1 0;min-height:0}.inventory-list-column{display:flex;flex-direction:column;min-width:0;min-height:0}.inventory-column-heading{display:flex;justify-content:space-between;color:#72836b;font-size:10px;min-height:24px;flex:none}.inventory-column-heading strong{font-weight:400;font-size:10px}.inventory-list{overflow:auto;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#3c503b transparent;overscroll-behavior:contain;padding-right:4px}.inventory-item{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;width:100%;height:52px;align-items:center;padding:4px 0!important}.is-rift .inventory-item{grid-template-columns:38px minmax(0,1fr) 30px}.inventory-item-image{width:40px;height:40px;display:block;opacity:.85}.inventory-item-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.inventory-item-name{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#9da991}.inventory-item-caption{font-size:9px;color:#657b62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.inventory-item-weight{font:10px/16px var(--ui-mono);text-align:right;color:#8a997e}.inventory-item.is-looking .inventory-item-name{color:#c0c6ac}.inventory-item.is-looking .inventory-item-image{filter:brightness(1.15)}.inventory-item.is-picked .inventory-item-name::before{content:'✓ ';color:#b2b79a}.inventory-position{font-size:9px;color:#63775b;min-height:18px;flex:none}.inventory-empty{padding:20px 0;font-size:11px;color:#748367}
.inventory-detail-column{display:flex;flex-direction:column;min-height:0;overflow:hidden}.inventory-detail-hint{flex:0 0 15px;font-size:9px;line-height:15px;text-align:right;color:#78866d}.inventory-detail{flex:1 1 0;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#3c503b transparent;border-left:1px solid #263525;padding-left:18px}.inventory-art{height:74px;width:88px;margin:0 auto 9px}.inventory-wrap img,.inventory-wrap svg{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}.inventory-detail h3{font-size:12px;line-height:18px;font-weight:400;margin:0 0 5px;color:#bcc0ab}.inventory-detail-meta{font-size:9px;color:#74836b}.inventory-detail p{font-size:10px;line-height:17px;color:#84927a;margin:7px 0}.inventory-stat{display:flex;justify-content:space-between;gap:7px;font-size:10px;line-height:19px}.inventory-stat span{color:#718468}.inventory-stat strong{font-weight:400;text-align:right;color:#a8b195}.inventory-explanation{margin-top:10px;font-size:10px;line-height:17px;color:#84927a}.inventory-explanation summary{cursor:pointer;color:#a5b291}.inventory-explanation summary:focus-visible{outline:1px solid #748367;outline-offset:3px}.inventory-detail-uses{margin-top:4px}.inventory-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.inventory-action{font-size:10px!important;padding:4px 0!important;border-bottom:1px solid #435438!important;color:#a5b291!important}.inventory-action:disabled{color:#566c50!important}.inventory-discard{position:relative;color:#9b8d70!important;overflow:hidden}.inventory-discard::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:#b19774;transform:scaleX(0);transform-origin:left;pointer-events:none}.inventory-discard.is-holding::after{transform:scaleX(1);transition:transform var(--discard-hold-duration) linear}
.inventory-bottom{flex:none;margin-top:4px;min-height:47px}.inventory-message{font-size:10px;line-height:16px;color:#8a987e;min-height:16px;margin-bottom:6px}.inventory-bottom-row{display:flex;align-items:center;gap:15px}.inventory-key-help{font-size:9px;color:#677e5e;flex:1}.inventory-primary{font-size:11px!important;color:#b8b99e!important;border-bottom:1px solid #4c5c42!important;padding:4px 0!important;white-space:nowrap}.inventory-primary:disabled{color:#637657!important}.inventory-catalog .inventory-item{height:48px}.inventory-catalog .inventory-bottom{min-height:16px;margin-top:0}.inventory-catalog .inventory-message{margin-bottom:0}.inventory-catalog .inventory-bottom-row{display:none}.inventory-exchange-inspect{display:none;flex:none;font-size:10px;line-height:17px;max-height:54px;overflow:auto;color:#879c7f}.is-exchange .inventory-exchange-inspect{display:block}.is-exchange .inventory-body{grid-template-columns:1fr 1fr;gap:24px}.is-exchange .inventory-detail-column{display:none}.is-exchange .inventory-item{grid-template-columns:32px minmax(0,1fr) 28px;gap:7px}.is-exchange .inventory-item-image{width:30px;height:30px}.inventory-wrap.is-busy button:not(.inventory-close){pointer-events:none;opacity:.65}
/* Preparation has its own decision structure; catalog and field collection retain
   their established layout and interaction surfaces above. */
#inventory-panel.is-prepare{left:344px;top:124px;width:584px;height:464px;display:block;font:12px/21px var(--ui-font);color:var(--ui-text,#b3baae)}
#inventory-panel.is-prepare .inventory-header{height:24px;margin:0;gap:14px}
#inventory-panel.is-prepare .inventory-context{font-size:11px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-close{font-size:11px!important;color:#a7afa2!important}
#inventory-panel.is-prepare .inventory-prepare-viewport{position:absolute;top:40px;bottom:70px;left:0;right:0}
#inventory-panel.is-prepare .inventory-prepare-overview,#inventory-panel.is-prepare .inventory-prepare-editor{position:relative;height:100%;animation:prepare-content-in 160ms ease-out}
#inventory-panel.is-prepare .inventory-grade-choice{position:absolute;left:0;right:0;top:10px;height:158px;padding:0;margin:0;display:grid;grid-template-columns:134px 1fr;grid-template-rows:1fr;gap:30px;background:none}
#inventory-panel.is-prepare .inventory-grade-heading{position:absolute;top:-18px;left:0;font-size:11px;line-height:18px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-grade-options{grid-column:1;grid-row:1;display:flex;flex-direction:column;align-items:stretch;gap:0}
#inventory-panel.is-prepare .inventory-grade-option{position:relative;height:52px;flex:none;padding:0 0 0 18px!important;border:0!important;font-size:12px!important;line-height:21px;color:#939f90!important;transition:color 100ms}
#inventory-panel.is-prepare .inventory-grade-option:focus-visible{outline:none;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px}
#inventory-panel.is-prepare .inventory-grade-option[aria-pressed="true"]{font-size:16px!important;color:#b3baae!important}
#inventory-panel.is-prepare .inventory-grade-option[aria-pressed="true"]::before{content:'';position:absolute;left:0;top:25px;width:8px;height:2px;background:#b3baae}
#inventory-panel.is-prepare .inventory-grade-facts{grid-column:2;grid-row:1;align-self:center;display:flex;flex-direction:column;gap:14px;animation:prepare-content-in 120ms ease-out}
#inventory-panel.is-prepare .inventory-grade-choice p{margin:0;font-size:12px;line-height:21px;color:#b3baae;grid-row:auto;grid-column:auto}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-reward{color:#b39b75}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-preparation{font-size:11px;line-height:18px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-legacy{grid-column:1/-1;align-self:center;color:#939f90}
#inventory-panel.is-prepare .inventory-prepare-loadout{position:absolute;top:194px;left:0;right:0;height:80px}
#inventory-panel.is-prepare .inventory-prepare-section-heading{display:flex;justify-content:space-between;align-items:baseline;height:20px;font-size:11px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-prepare-edit,#inventory-panel.is-prepare .inventory-prepare-back{font-size:12px;color:#b3baae;border-bottom:1px solid var(--ui-edge,#435438);line-height:21px}
#inventory-panel.is-prepare .inventory-equipment{height:66px;display:flex;align-items:stretch;gap:12px;margin:0}
#inventory-panel.is-prepare .inventory-prepare-loadout .inventory-equipment{height:60px}
#inventory-panel.is-prepare .inventory-slot,#inventory-panel.is-prepare .inventory-slot[data-slot-id=weapon]{position:relative;flex:1;min-width:0;margin:0;padding:0 0 0 28px;display:grid;grid-template-columns:1fr;grid-template-rows:18px minmax(18px,1fr) 18px;gap:0;justify-content:start;align-items:start;border:0!important;text-align:left}
#inventory-panel.is-prepare .inventory-slot .inventory-slot-icon,#inventory-panel.is-prepare .inventory-slot[data-slot-id=weapon] .inventory-slot-icon{position:absolute;left:0;top:20px;width:24px;height:24px}
#inventory-panel.is-prepare .inventory-slot-label{font:11px/18px var(--ui-font);color:#7e8a7e}
#inventory-panel.is-prepare .inventory-slot-name{font-size:12px;line-height:18px;color:#a7b29e;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block;max-width:100%;min-width:0}
#inventory-panel.is-prepare .inventory-slot-uses{font-size:11px;line-height:18px;color:#8f9b8b;white-space:nowrap}
#inventory-panel.is-prepare .inventory-slot.is-looking .inventory-slot-name{color:#c0c6ac}
#inventory-panel.is-prepare .inventory-slot.is-locked{opacity:.5}
#inventory-panel.is-prepare .inventory-prepare-conditions{position:absolute;top:282px;left:0;right:0;height:72px;color:#7e8a7e;font-size:11px;line-height:18px}
#inventory-panel.is-prepare .inventory-prepare-conditions>summary{width:max-content;cursor:pointer;color:#9aa694}
#inventory-panel.is-prepare .inventory-departure-conditions{min-height:0;height:50px;gap:16px;margin:4px 0 0;grid-template-columns:1fr 1.7fr 1fr}
#inventory-panel.is-prepare .inventory-departure-conditions span,#inventory-panel.is-prepare .inventory-departure-conditions small{font-size:11px;line-height:15px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-departure-conditions strong{font-size:12px;line-height:18px;color:#b3baae}
#inventory-panel.is-prepare .inventory-prepare-editor>.inventory-prepare-equipment-host{position:absolute;top:0;left:0;right:0;height:66px}
#inventory-panel.is-prepare .inventory-prepare-editor>.inventory-filters{position:absolute;top:80px;left:0;right:0;height:28px;gap:20px}
#inventory-panel.is-prepare .inventory-filter{font-size:12px!important;color:#8f9b8b!important}
#inventory-panel.is-prepare .inventory-filter.is-current{color:#b3baae!important}
#inventory-panel.is-prepare .inventory-prepare-editor>.inventory-body{position:absolute;top:116px;bottom:10px;left:0;right:0;grid-template-columns:minmax(0,1fr) 198px;gap:24px}
#inventory-panel.is-prepare .inventory-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:52px;gap:0 12px;align-content:start}
#inventory-panel.is-prepare .inventory-item{grid-template-columns:24px minmax(0,1fr);gap:7px;height:52px}
#inventory-panel.is-prepare .inventory-item-image{width:24px;height:24px}
#inventory-panel.is-prepare .inventory-item-name{font-size:12px;line-height:20px;color:#a7b29e}
#inventory-panel.is-prepare .inventory-item-caption{font-size:11px;line-height:18px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-column-heading,#inventory-panel.is-prepare .inventory-position{font-size:11px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-detail-column{background:none!important;text-shadow:none}
#inventory-panel.is-prepare .inventory-detail{padding-left:16px;border-left-color:var(--ui-edge,#263525)}
#inventory-panel.is-prepare .inventory-detail p,#inventory-panel.is-prepare .inventory-stat,#inventory-panel.is-prepare .inventory-explanation{font-size:12px;line-height:21px;color:#a7b29e}
#inventory-panel.is-prepare .inventory-detail-meta,#inventory-panel.is-prepare .inventory-stat span{font-size:11px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-detail .inventory-art{display:none}
#inventory-panel.is-prepare .inventory-detail h3{font-size:16px;line-height:21px;color:#b3baae}
#inventory-panel.is-prepare .inventory-detail-column>.inventory-actions{padding-left:16px;border-left-color:var(--ui-edge,#263525);gap:4px 10px}
#inventory-panel.is-prepare .inventory-action{font-size:11px!important;line-height:18px}
#inventory-panel.is-prepare .inventory-bottom{position:absolute;bottom:0;left:0;right:0;height:62px;min-height:0;margin:0;display:flex;flex-direction:column;justify-content:end}
#inventory-panel.is-prepare .inventory-message{font-size:11px;line-height:18px;min-height:18px;max-height:36px;overflow:auto;margin:0 0 6px;color:#9eaa98}
#inventory-panel.is-prepare .inventory-bottom-row{gap:14px;min-height:24px}
#inventory-panel.is-prepare .inventory-key-help{font-size:10px;line-height:18px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-primary{font-size:12px!important;line-height:21px;color:#b3baae!important;padding:0!important}
#inventory-panel.is-prepare .inventory-primary:disabled{color:#8f8069!important}
#inventory-panel.is-prepare .inventory-prepare-back{flex:none;font-size:11px;white-space:nowrap}
@keyframes prepare-content-in{from{opacity:.45}to{opacity:1}}
@media(prefers-reduced-motion:reduce){#inventory-panel.is-prepare .inventory-prepare-overview,#inventory-panel.is-prepare .inventory-prepare-editor,#inventory-panel.is-prepare .inventory-grade-facts{animation:none}}
`;
export function ensureInventoryPanelStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.appendChild(style);
}
