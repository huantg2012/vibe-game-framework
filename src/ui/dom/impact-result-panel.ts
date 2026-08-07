/**
 * ImpactResultPanel - DOM overlay showing impact damage results.
 *
 * Displays for IMPACT_RESULT_DISPLAY_MS then auto-closes.
 * Pure HTML/CSS overlay, no Phaser UI.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import type { ImpactDamageEntry } from '@/systems/impact-system';

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
   * Show the impact result. Calls onDone after the display period.
   */
  show(damages: readonly ImpactDamageEntry[], intensity: number, onDone: () => void): void {
    if (panel) destroyPanel();

    panel = document.createElement('div');
    panel.id = 'impact-result-panel';
    panel.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'z-index:1001',
      'background:rgba(20,0,0,0.9)',
      'border:2px solid #cc4444',
      'padding:20px 28px',
      'font-family:monospace',
      'color:#ff6666',
      'border-radius:4px',
      'text-align:center',
      'box-shadow:0 0 30px rgba(200,0,0,0.4)',
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

    const lines = damages.map((d) => {
      const color = d.moduleId === 'BARRIER' ? '#4488cc' : '#cc8844';
      return `<span style="color:${color}">${d.moduleId}</span> <span style="color:#ff4444">-${d.damage}</span> hp`;
    });

    panel.innerHTML = `
      <div style="font-size:16px;font-weight:bold;margin-bottom:10px;color:#ff4444;">
        IMPACT! (x${intensity.toFixed(2)})
      </div>
      <div style="font-size:13px;line-height:1.8;">
        ${lines.join('<br>')}
      </div>
    `;

    document.body.appendChild(panel);

    timer = setTimeout(() => {
      destroyPanel();
      onDone();
    }, GAME_CONSTANTS.PURIFICATION.IMPACT_RESULT_DISPLAY_MS);
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
