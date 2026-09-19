/** Offering uses the existing scene readout. Identity and quality have separate
 * lines so a long production name cannot squeeze a two-character quality apart. */
export function ensureOfferingPanelStyles(): void {
  if (document.getElementById('offering-panel-styles')) return;
  const style = document.createElement('style');
  style.id = 'offering-panel-styles';
  style.textContent = `
    #defense-panel .offering-identity{display:flex;align-items:center;gap:7px;min-width:0;width:100%}
    #defense-panel .offering-copy{display:flex;flex-direction:column;min-width:0;gap:1px}
    #defense-panel .offering-name,#defense-panel .slot-name{overflow-wrap:anywhere;line-height:17px}
    #defense-panel .offering-quality{white-space:nowrap;font-size:10px;line-height:16px;color:#718574}
    #defense-panel .defense-equip-tile{padding:5px 4px;min-height:44px}
    #defense-panel .slot-cell{padding:6px 4px}
  `;
  document.head.appendChild(style);
}
