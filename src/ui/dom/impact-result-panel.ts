/**
 * ImpactResultPanel - DOM overlay showing impact damage results.
 *
 * Displays module damage + defense slot charge progress.
 * Pure HTML/CSS overlay, no Phaser UI.
 */

import type { ImpactDamageEntry } from '@/systems/impact-system';
import type { ContaminantType } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Charge change data for a single defense slot. */
export interface ChargeChangeEntry {
  slotIndex: number;
  type: ContaminantType;
  name: string;
  before: number;
  after: number;
  threshold: number;
  transformed: boolean;
}

// ---------------------------------------------------------------------------
// Display name mapping (defense stage names)
// ---------------------------------------------------------------------------

const TYPE_NAMES: Record<ContaminantType, string> = {
  solidify: '固化残渣',
  ruminate: '反刍残渣',
  scatter: '散射残渣',
  retrograde: '逆行残渣',
  delay: '延时残渣',
  siphon: '虹吸残渣',
  expand: '膨胀残渣',
  resonate: '共鸣残渣',
  overwrite: '覆写残渣',
  erode: '侵蛀残渣',
  muffle: '消声残渣',
  kindle: '燃尽残渣',
  stitch: '缝合残渣',
  compress: '致密残渣',
  mirror: '镜映残渣',
  echo: '回响残渣',
  abyss: '深渊残渣',
  combust: '灰烬残渣',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const impactResultPanel = {
  isOpen(): boolean {
    return panel !== null;
  },

  /**
   * Show the impact result. Calls onDone when the user dismisses the panel.
   * @param chargeChanges Optional defense slot charge progress data.
   */
  show(
    damages: readonly ImpactDamageEntry[],
    intensity: number,
    onDone: () => void,
    chargeChanges?: readonly ChargeChangeEntry[],
  ): void {
    if (panel) destroyPanel();

    panel = document.createElement('div');
    panel.id = 'impact-result-panel';
    panel.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:1001',
      'background:rgba(15,17,20,0.92)',
      'border:2px solid #cc4444',
      'padding:12px',
      'font-family:"Courier New",monospace',
      'color:#cc4444',
      'text-align:center',
      'animation:impact-shake 0.3s ease-out',
      'cursor:pointer',
    ].join(';');

    // Inject keyframe if not already present
    if (!document.getElementById('impact-shake-style')) {
      const style = document.createElement('style');
      style.id = 'impact-shake-style';
      style.textContent = `
        @keyframes impact-shake {
          0%, 100% { transform: translate(-50%, -50%); }
          20% { transform: translate(-52%, -48%); }
          40% { transform: translate(-48%, -52%); }
          60% { transform: translate(-51%, -49%); }
          80% { transform: translate(-49%, -51%); }
        }
      `;
      document.head.appendChild(style);
    }

    const moduleLabels: Record<string, string> = {
      BARRIER: '屏障',
      STORAGE: '储藏',
    };

    const lines = damages.map((d) => {
      const color = d.moduleId === 'BARRIER' ? '#4d9a6b' : '#c4873a';
      const label = moduleLabels[d.moduleId] ?? d.moduleId;
      return `<span style="color:${color}">${label}</span> <span style="color:#cc4444">-${d.damage}</span> 完整度`;
    });

    // Build charge progress section
    let chargeHtml = '';
    if (chargeChanges && chargeChanges.length > 0) {
      const chargeLines = chargeChanges.map((c) => {
        const name = TYPE_NAMES[c.type] ?? c.name;
        if (c.transformed) {
          return `<div style="color:#1aad96;font-size:10px;">${name} ${c.before}/${c.threshold} → ${c.threshold}/${c.threshold} <span style="color:#1aad96;font-weight:bold;">[已转化]</span></div>`;
        }
        return `<div style="color:#8a8f96;font-size:10px;">${name} ${c.before}/${c.threshold} → ${c.after}/${c.threshold}</div>`;
      });
      chargeHtml = `
        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #2a2d32;">
          <div style="font-size:9px;color:#8a8f96;margin-bottom:4px;">防御充能:</div>
          ${chargeLines.join('')}
        </div>
      `;
    }

    panel.innerHTML = `
      <div style="font-size:14px;font-weight:bold;margin-bottom:10px;color:#cc4444;">
        冲击! (x${intensity.toFixed(2)})
      </div>
      <div style="font-size:11px;line-height:1.8;">
        ${lines.join('<br>')}
      </div>
      ${chargeHtml}
      <div style="font-size:9px;color:#5a5f66;margin-top:12px;">
        点击或按任意键关闭
      </div>
    `;

    document.body.appendChild(panel);

    // Close on click or any keypress
    const dismiss = (): void => {
      panel?.removeEventListener('click', dismiss);
      document.removeEventListener('keydown', onKey);
      destroyPanel();
      onDone();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (!e.repeat) dismiss();
    };
    panel.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
  },

  destroy(): void {
    destroyPanel();
  },
};

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function destroyPanel(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (panel) {
    panel.remove();
    panel = null;
  }
}
