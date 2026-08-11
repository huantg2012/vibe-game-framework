/**
 * ImpactResultPanel - DOM overlay showing impact damage results.
 *
 * Game-style compact damage report: colored bars per module showing damage,
 * inline charge progress mini-bars. Click/key to dismiss.
 */

import type { ImpactDamageEntry } from '@/systems/impact-system';
import type { ContaminantType } from '@/types/game-types';
import { injectPanelStyles } from './panel-styles';

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
  solidify: '固化',
  ruminate: '反刍',
  scatter: '散射',
  retrograde: '逆行',
  delay: '延时',
  siphon: '虹吸',
  expand: '膨胀',
  resonate: '共鸣',
  overwrite: '覆写',
  erode: '侵蛀',
  muffle: '消声',
  kindle: '燃尽',
  stitch: '缝合',
  compress: '致密',
  mirror: '镜映',
  echo: '回响',
  abyss: '深渊',
  combust: '灰烬',
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let panel: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let onDoneCallback: (() => void) | null = null;

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

    onDoneCallback = onDone;
    injectPanelStyles();

    panel = document.createElement('div');
    panel.id = 'impact-result-panel';
    panel.className = 'game-panel';
    panel.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:1001',
      'min-width:380px',
      'max-width:520px',
      'border-color:#cc3333',
      'animation:impact-shake 0.3s ease-out',
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
      CORE: '核心',
      STORAGE: '储藏',
    };
    const moduleColors: Record<string, string> = {
      CORE: '#4d9a6b',
      STORAGE: '#c4873a',
    };

    // Title
    let html = `<div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:18px;font-weight:bold;color:#cc3333;">冲击 x${intensity.toFixed(2)}</div>
    </div>`;

    // Damage bars
    const maxDmg = Math.max(...damages.map((d) => d.damage), 1);
    for (const d of damages) {
      const color = moduleColors[d.moduleId] ?? '#c8ccd0';
      const label = moduleLabels[d.moduleId] ?? d.moduleId;
      const barPct = Math.round((d.damage / maxDmg) * 100);
      html += `<div class="dmg-row">
        <span class="dmg-label" style="color:${color};">${label}</span>
        <div class="dmg-bar-wrap">
          <div class="dmg-bar-fill" style="width:${barPct}%;background:#cc3333;"></div>
        </div>
        <span class="dmg-value" style="color:#cc3333;">-${d.damage}</span>
      </div>`;
    }

    // Charge progress
    if (chargeChanges && chargeChanges.length > 0) {
      html += `<div class="separator"></div>`;
      html += `<div style="font-size:12px;color:#5a5f66;margin-bottom:4px;">防御充能</div>`;
      for (const c of chargeChanges) {
        const name = TYPE_NAMES[c.type] ?? c.name;
        const afterPct = Math.round((c.after / c.threshold) * 100);
        const barColor = c.transformed ? '#1aad96' : '#6644aa';
        html += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
          <span style="font-size:12px;color:#8a8f96;min-width:32px;">${name}</span>
          <div class="stat-bar" style="flex:1;">
            <div class="stat-bar-fill" style="width:${afterPct}%;background:${barColor};"></div>
          </div>
          <span style="font-size:12px;color:${c.transformed ? '#1aad96' : '#5a5f66'};">${c.transformed ? '转化!' : `${c.after}/${c.threshold}`}</span>
        </div>`;
      }
    }

    html += `<div id="impact-close-btn" class="action-btn btn-muted" style="text-align:center;margin-top:12px;cursor:pointer;">…知道了</div>`;

    panel.innerHTML = html;
    document.body.appendChild(panel);

    // Wire close button click
    panel.querySelector('#impact-close-btn')?.addEventListener('click', () => {
      dismiss();
    });

    // ESC only
    document.addEventListener('keydown', onKeyDown);
  },

  close(): void {
    dismiss();
  },

  destroy(): void {
    destroyPanel();
  },
};

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    dismiss();
  }
}

function dismiss(): void {
  document.removeEventListener('keydown', onKeyDown);
  const cb = onDoneCallback;
  onDoneCallback = null;
  destroyPanel();
  cb?.();
}

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
