/**
 * ImpactResultPanel - DOM overlay showing impact damage results.
 *
 * Game-style compact damage report: colored bars per module showing damage,
 * inline charge progress mini-bars. Click/key to dismiss.
 */

import type { ImpactDamageEntry } from '@/systems/impact-system';
import type { ContaminantType } from '@/types/game-types';
import { getDefenseName } from '@/ui/contaminant-names';
import { getDomUiRoot, injectPanelStyles } from './panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Charge change data for a single defense slot. Display name is derived from
 *  `type` via `getDefenseName` (CLAUDE.md 策划数据源规则) — not carried here, so
 *  there is no local copy that can drift from the CSV. */
export interface ChargeChangeEntry {
  slotIndex: number;
  type: ContaminantType;
  before: number;
  after: number;
  threshold: number;
  transformed: boolean;
}

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
      'position:absolute',
      'top:0',
      'right:0',
      'height:640px',
      'width:440px',
      'z-index:1001',
      'display:flex',
      'flex-direction:column',
      'overflow-y:auto',
      'border-color:#cc3333',
      'animation:impact-shake 0.3s ease-out',
      'pointer-events:auto',
    ].join(';');

    // Inject keyframe if not already present
    if (!document.getElementById('impact-shake-style')) {
      const style = document.createElement('style');
      style.id = 'impact-shake-style';
      style.textContent = `
        @keyframes impact-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `;
      document.head.appendChild(style);
    }

    const root = getDomUiRoot();
    const backdrop = document.createElement('div');
    backdrop.className = 'game-panel-backdrop';
    backdrop.id = 'impact-backdrop';
    root.appendChild(backdrop);

    const moduleLabels: Record<string, string> = {
      CORE: '核心',
      STORAGE: '储藏',
    };
    // A2 mapping: CORE green #4d9a6b → ui-text-bright; STORAGE stays warm-glow.
    const moduleColors: Record<string, string> = {
      CORE: '#c8cdd4',
      STORAGE: '#c4873a',
    };

    // Title
    let html = `<div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:18px;font-weight:bold;color:#cc3333;">冲击 x${intensity.toFixed(2)}</div>
    </div>`;
    html += `<div style="flex:1;overflow-y:auto;">`;

    // Damage bars
    const maxDmg = Math.max(...damages.map((d) => d.damage), 1);
    for (const d of damages) {
      const color = moduleColors[d.moduleId] ?? '#c8cdd4';
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
      html += `<div style="font-size:13px;color:#8a8f96;margin-bottom:4px;">防御充能</div>`;
      for (const c of chargeChanges) {
        const name = getDefenseName(c.type);
        const afterPct = Math.round((c.after / c.threshold) * 100);
        // A2: #6644aa → contam-deep (charging dark state)
        const barColor = c.transformed ? '#1aad96' : '#0e4a3f';
        html += `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">
          <span style="font-size:12px;color:#8a8f96;min-width:32px;">${name}</span>
          <div class="stat-bar" style="flex:1;">
            <div class="stat-bar-fill" style="width:${afterPct}%;background:${barColor};"></div>
          </div>
          <span style="font-size:12px;color:${c.transformed ? '#1aad96' : '#8a8f96'};">${c.transformed ? '转化!' : `${c.after}/${c.threshold}`}</span>
        </div>`;
      }
    }

    html += `</div>`; // end flex:1 content wrapper
    html += `<div class="action-bar">
      <span id="impact-close-btn" class="action-btn btn-muted" style="cursor:pointer;">…知道了</span>
    </div>`;

    panel.innerHTML = html;
    root.appendChild(panel);

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
  document.getElementById('impact-backdrop')?.remove();
}
