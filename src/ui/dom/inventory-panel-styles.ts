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
#inventory-panel.is-rift .inventory-physiology{flex:none;color:#7e8a7e}
#inventory-panel.is-rift .inventory-physiology-title{margin:0 0 4px;font:11px/18px var(--ui-font);font-weight:400}
#inventory-panel.is-rift .inventory-physiology-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 24px;margin:0}
#inventory-panel.is-rift .inventory-physiology-fact{display:flex;align-items:baseline;justify-content:space-between;gap:8px;min-width:0;min-height:21px}
#inventory-panel.is-rift .inventory-physiology-fact dt{font:11px/18px var(--ui-font);white-space:nowrap}
#inventory-panel.is-rift .inventory-physiology-fact dd{display:flex;align-items:baseline;gap:5px;margin:0;white-space:nowrap}
#inventory-panel.is-rift .inventory-physiology-baseline{font:11px/18px var(--ui-font)}
#inventory-panel.is-rift .inventory-physiology-value{font:12px/21px var(--ui-mono);color:var(--ui-text);text-align:right}
.inventory-wrap *{box-sizing:border-box}.inventory-wrap [hidden]{display:none!important}.inventory-wrap button,.inventory-wrap select{font:inherit;color:inherit;border-radius:0}.inventory-wrap button{background:none;border:0;padding:0;cursor:pointer;text-align:left}.inventory-wrap button:disabled{color:#657260;cursor:default}.inventory-wrap button:focus-visible,.inventory-wrap select:focus-visible{outline:1px solid #748367;outline-offset:3px}
.inventory-header{display:flex;align-items:baseline;gap:16px;flex:none;margin-bottom:8px}.inventory-title{font:16px/24px var(--ui-font);letter-spacing:1px;color:#b2b5a6;margin:0}.inventory-context{font-size:10px;color:#75816f}.inventory-close{margin-left:auto!important;font-size:10px!important;color:#82907b!important;white-space:nowrap}.inventory-weight{margin-left:auto;white-space:nowrap;font-size:10px;position:relative}.inventory-weight strong{font:11px/18px var(--ui-mono);font-weight:400;margin-left:8px;color:#a7b19b}.inventory-weight.is-over strong{color:#b69671}.inventory-survival{display:block;font-size:9px;color:#7e8b72}.inventory-weight+.inventory-close{margin-left:0!important}


.inventory-filters{display:flex;align-items:center;gap:20px;flex:none;height:24px}.inventory-filter{font-size:11px!important;color:#788773!important}.inventory-filter.is-current{color:#bdc2ac!important}.inventory-sort{margin-left:auto;border:0;background:#101810;font-size:10px!important;max-width:92px}.inventory-body{display:grid;grid-template-columns:minmax(0,1fr) 186px;gap:22px;flex:1;min-height:0;overflow:hidden}#inventory-panel > .inventory-body{flex:1 1 0;min-height:0}.inventory-list-column{display:flex;flex-direction:column;min-width:0;min-height:0}.inventory-column-heading{display:flex;justify-content:space-between;color:#72836b;font-size:10px;min-height:24px;flex:none}.inventory-column-heading strong{font-weight:400;font-size:10px}.inventory-list{overflow:auto;flex:1;min-height:0;scrollbar-width:thin;scrollbar-color:#3c503b transparent;overscroll-behavior:contain;padding-right:4px}.inventory-item{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px;width:100%;height:52px;align-items:center;padding:4px 0!important}.is-rift .inventory-item{grid-template-columns:38px minmax(0,1fr) 30px}.inventory-item-image{width:40px;height:40px;display:block;opacity:.85}.inventory-item-copy{min-width:0;display:flex;flex-direction:column;gap:2px}.inventory-item-name{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#9da991}.inventory-item-caption{font-size:9px;color:#657b62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.inventory-item-weight{font:10px/16px var(--ui-mono);text-align:right;color:#8a997e}.inventory-item.is-looking .inventory-item-name{color:#c0c6ac}.inventory-item.is-looking .inventory-item-image{filter:brightness(1.15)}.inventory-item.is-picked .inventory-item-name::before{content:'✓ ';color:#b2b79a}.inventory-position{font-size:9px;color:#63775b;min-height:18px;flex:none}.inventory-empty{padding:20px 0;font-size:11px;color:#748367}
.inventory-detail-column{display:flex;flex-direction:column;min-height:0;overflow:hidden}.inventory-detail-hint{flex:0 0 15px;font-size:9px;line-height:15px;text-align:right;color:#78866d}.inventory-detail{flex:1 1 0;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#3c503b transparent;border-left:1px solid #263525;padding-left:18px}.inventory-art{height:74px;width:88px;margin:0 auto 9px}.inventory-wrap img,.inventory-wrap svg{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}.inventory-detail h3{font-size:12px;line-height:18px;font-weight:400;margin:0 0 5px;color:#bcc0ab}.inventory-detail-meta{font-size:9px;color:#74836b}.inventory-detail p{font-size:10px;line-height:17px;color:#84927a;margin:7px 0}.inventory-stat{display:flex;justify-content:space-between;gap:7px;font-size:10px;line-height:19px}.inventory-stat span{color:#718468}.inventory-stat strong{font-weight:400;text-align:right;color:#a8b195}.inventory-explanation{margin-top:10px;font-size:10px;line-height:17px;color:#84927a}.inventory-explanation summary{cursor:pointer;color:#a5b291}.inventory-explanation summary:focus-visible{outline:1px solid #748367;outline-offset:3px}.inventory-detail-uses{margin-top:4px}.inventory-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.inventory-action{font-size:10px!important;padding:4px 0!important;border-bottom:1px solid #435438!important;color:#a5b291!important}.inventory-action:disabled{color:#566c50!important}.inventory-discard{position:relative;color:#9b8d70!important;overflow:hidden}.inventory-discard::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:#b19774;transform:scaleX(0);transform-origin:left;pointer-events:none}.inventory-discard.is-holding::after{transform:scaleX(1);transition:transform var(--discard-hold-duration) linear}
.inventory-bottom{flex:none;margin-top:4px;min-height:47px}.inventory-message{font-size:10px;line-height:16px;color:#8a987e;min-height:16px;margin-bottom:6px}.inventory-bottom-row{display:flex;align-items:center;gap:15px}.inventory-key-help{font-size:9px;color:#677e5e;flex:1}.inventory-primary{font-size:11px!important;color:#b8b99e!important;border-bottom:1px solid #4c5c42!important;padding:4px 0!important;white-space:nowrap}.inventory-primary:disabled{color:#637657!important}.inventory-catalog .inventory-item{height:48px}.inventory-catalog .inventory-bottom{min-height:16px;margin-top:0}.inventory-catalog .inventory-message{margin-bottom:0}.inventory-catalog .inventory-bottom-row{display:none}.inventory-exchange-inspect{display:none;flex:none;font-size:10px;line-height:17px;max-height:54px;overflow:auto;color:#879c7f}.is-exchange .inventory-exchange-inspect{display:block}.is-exchange .inventory-body{grid-template-columns:1fr 1fr;gap:24px}.is-exchange .inventory-detail-column{display:none}.is-exchange .inventory-item{grid-template-columns:32px minmax(0,1fr) 28px;gap:7px}.is-exchange .inventory-item-image{width:30px;height:30px}.inventory-wrap.is-busy button:not(.inventory-close){pointer-events:none;opacity:.65}
/* Preparation shares the inventory browser with the base catalogue. Only its
   two sequential decisions and scene composition differ. */
#inventory-panel.is-prepare{left:344px;top:124px;width:584px;height:464px;display:block;font:12px/21px var(--ui-font);color:var(--ui-text,#b3baae)}
#inventory-panel.is-prepare .inventory-header{height:24px;margin:0;gap:14px}
#inventory-panel.is-prepare .inventory-title{font-size:16px;line-height:24px;color:#b3baae}
#inventory-panel.is-prepare .inventory-context{font-size:11px;line-height:18px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-close{font-size:11px!important;color:#a7afa2!important}
#inventory-panel.is-prepare .inventory-prepare-viewport{position:absolute;top:40px;bottom:70px;left:0;right:0}
#inventory-panel.is-prepare .inventory-prepare-pollution,#inventory-panel.is-prepare .inventory-prepare-editor{position:relative;height:100%;animation:prepare-content-in 160ms ease-out}
#inventory-panel.is-prepare .inventory-grade-choice{position:absolute;left:0;right:0;top:26px;height:244px;padding:0;margin:0;display:grid;grid-template-columns:146px 1fr;gap:44px;background:none}
#inventory-panel.is-prepare .inventory-grade-options{display:flex;flex-direction:column;align-items:stretch;padding-top:16px;gap:0}
#inventory-panel.is-prepare .inventory-grade-option{position:relative;height:64px;flex:none;padding:0 0 0 18px!important;border:0!important;font-size:12px!important;line-height:21px;color:#939f90!important;transition:color 100ms}
#inventory-panel.is-prepare .inventory-grade-option:focus-visible{outline:none;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:5px}
#inventory-panel.is-prepare .inventory-grade-option[aria-pressed="true"]{font-size:18px!important;line-height:26px;font-weight:500;color:#b3baae!important}
#inventory-panel.is-prepare .inventory-grade-option[aria-pressed="true"]::before{content:'';position:absolute;left:0;top:31px;width:8px;height:2px;background:#b3baae}
#inventory-panel.is-prepare .inventory-grade-facts{display:flex;flex-direction:column;gap:20px;animation:prepare-content-in 120ms ease-out}
#inventory-panel.is-prepare .inventory-grade-fact-label{display:block;font-size:11px;line-height:18px;color:#7e8a7e;margin-bottom:5px}
#inventory-panel.is-prepare .inventory-grade-choice p{margin:0;font-size:12px;line-height:21px;color:#afb3ad}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-reward{color:#b39b75}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-legacy{grid-column:1/-1;align-self:center;color:#939f90}
#inventory-panel.is-prepare .inventory-equipment{height:66px;display:flex;align-items:stretch;gap:12px;margin:0}
#inventory-panel.is-prepare .inventory-slot{position:relative;flex:1;min-width:0;margin:0;padding:0 0 0 28px;display:grid;grid-template-columns:1fr;grid-template-rows:18px minmax(18px,1fr) 18px;gap:0;justify-content:start;align-items:start;border:0!important;text-align:left}
#inventory-panel.is-prepare .inventory-slot .inventory-slot-icon{position:absolute;left:0;top:20px;width:24px;height:24px}
#inventory-panel.is-prepare .inventory-slot-label{font:11px/18px var(--ui-font);color:#7e8a7e}
#inventory-panel.is-prepare .inventory-slot-name{font-size:12px;line-height:18px;color:#a7b29e;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block;max-width:100%;min-width:0}
#inventory-panel.is-prepare .inventory-slot-uses{font-size:11px;line-height:18px;color:#8f9b8b;white-space:nowrap}
#inventory-panel.is-prepare .inventory-slot.is-looking .inventory-slot-name{color:#b3baae}
#inventory-panel.is-prepare .inventory-slot.is-locked{opacity:.5}
#inventory-panel.is-prepare .inventory-prepare-editor>.inventory-prepare-equipment-host{position:absolute;top:8px;left:0;right:0;height:66px}
#inventory-panel.is-prepare .inventory-prepare-editor>.inventory-filters{position:absolute;top:90px;left:0;right:0;height:28px;gap:20px}
#inventory-panel.is-prepare .inventory-filter{font-size:12px!important;color:#8f9b8b!important}
#inventory-panel.is-prepare .inventory-filter.is-current{color:#b3baae!important}
#inventory-panel.is-prepare .inventory-prepare-editor>.inventory-body{position:absolute;top:128px;bottom:12px;left:0;right:0;grid-template-columns:310px 248px;gap:26px}
#inventory-panel.is-prepare .inventory-item{position:relative;height:48px;padding-left:14px!important}
#inventory-panel.is-prepare .inventory-item.is-looking::before{content:'';position:absolute;left:0;top:23px;width:6px;height:1px;background:#b3baae}
#inventory-panel.is-prepare .inventory-item-name{font-size:12px;line-height:20px;color:#a7b29e}
#inventory-panel.is-prepare .inventory-item.is-looking .inventory-item-name{font-weight:500;color:#c0c6ac}
#inventory-panel.is-prepare .inventory-item-caption{font-size:11px;line-height:18px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-column-heading,#inventory-panel.is-prepare .inventory-position{font-size:11px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-detail-column{background:none;text-shadow:none}
#inventory-panel.is-prepare .inventory-detail{padding-left:16px;border-left-color:var(--ui-edge,#263525)}
#inventory-panel.is-prepare .inventory-detail p,#inventory-panel.is-prepare .inventory-stat,#inventory-panel.is-prepare .inventory-explanation{font-size:12px;line-height:21px;color:#afb3ad}
#inventory-panel.is-prepare .inventory-detail-meta,#inventory-panel.is-prepare .inventory-stat span{font-size:11px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-detail .inventory-art{display:none}
#inventory-panel.is-prepare .inventory-detail h3{font-size:18px;line-height:26px;font-weight:500;color:#b3baae}
#inventory-panel.is-prepare .inventory-detail-uses strong{font:16px/24px var(--ui-mono);color:#b3baae}
#inventory-panel.is-prepare .inventory-detail-hint{font-size:10px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-detail-column>.inventory-actions{padding-left:16px;border-left-color:var(--ui-edge,#263525);gap:4px 10px}
#inventory-panel.is-prepare .inventory-action{font-size:12px!important;line-height:21px}
#inventory-panel.is-prepare .inventory-action:not(:disabled){font-weight:500}
#inventory-panel.is-prepare .inventory-bottom{position:absolute;bottom:0;left:0;right:0;height:62px;min-height:0;margin:0;display:flex;flex-direction:column;justify-content:end}
#inventory-panel.is-prepare .inventory-message{font-size:11px;line-height:18px;min-height:18px;max-height:36px;overflow:auto;margin:0 0 6px;color:#9eaa98}
#inventory-panel.is-prepare .inventory-bottom-row{gap:14px;min-height:30px}
#inventory-panel.is-prepare .inventory-key-help{font-size:10px;line-height:18px;color:#7e8a7e}
#inventory-panel.is-prepare .inventory-primary{display:flex;align-items:baseline;gap:12px;font-size:16px!important;line-height:24px;color:#b3baae!important;padding:0!important}
#inventory-panel.is-prepare .inventory-primary small{font-size:10px;line-height:18px;color:#8f9b8b}
#inventory-panel.is-prepare .inventory-primary:disabled{color:#8f8069!important}
#inventory-panel.is-prepare .inventory-prepare-back{flex:none;font-size:11px;line-height:18px;color:#a7afa2;white-space:nowrap}
.inventory-prepare-veil{position:absolute;inset:0;width:960px;height:640px;z-index:1090;pointer-events:none}
.inventory-prepare-backdrop.has-actor-region{mask-image:radial-gradient(ellipse var(--actor-rx) var(--actor-ry) at var(--actor-cx) var(--actor-cy),transparent 65%,#000 150%)}
#inventory-panel.is-prepare .inventory-grade-facts{position:relative;display:block;height:270px}
#inventory-panel.is-prepare .inventory-grade-danger{position:absolute;top:0;width:100%}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-risk{font-size:16px;line-height:24px;color:#a7afa2;margin-top:6px}
#inventory-panel.is-prepare .inventory-grade-choice .inventory-grade-description{white-space:pre-line;margin-top:13px}
#inventory-panel.is-prepare .inventory-grade-response{position:absolute;top:134px;width:100%}
#inventory-panel.is-prepare .inventory-grade-resources{position:absolute;top:190px;display:flex;align-items:baseline;gap:19px}
#inventory-panel.is-prepare .inventory-prepare-narration{position:absolute;left:190px;right:0;top:298px;margin:0;min-height:44px;font:13px/22px "Songti SC","Noto Serif CJK SC","SimSun",serif;font-weight:400;letter-spacing:.3px;color:#b0b4a5}
@keyframes prepare-content-in{from{opacity:.45}to{opacity:1}}
@media(prefers-reduced-motion:reduce){#inventory-panel.is-prepare .inventory-prepare-pollution,#inventory-panel.is-prepare .inventory-prepare-editor,#inventory-panel.is-prepare .inventory-grade-facts{animation:none}}

`;
export function ensureInventoryPanelStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID; style.textContent = CSS; document.head.appendChild(style);
}
