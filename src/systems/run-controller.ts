import { inventoryStore } from '@/systems/inventory-store';
import { inventoryError } from '@/ui/inventory-presenter';
/**
 * RunController - the single `endRun` exit and restart logic.
 *
 * Owns the run lifecycle: when a run ends (by death or extraction), it pauses chaos,
 * disables player input, waits a settle delay and emits `RIFT_EXITED`. On restart
 * (R) both death and extraction return to the purification scene (DEC-056).
 *
 * The `runEnded` flag is the gate that prevents double-fires (a death event arriving
 * while the settle delay from extraction is still running, or vice versa).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';
import { getDomUiRoot } from '@/ui/dom/panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EndRunReason = 'extract' | 'player_died';

export interface RunControllerDeps {
  pauseChaos: (paused: boolean) => void;
  setPlayerInput: (enabled: boolean) => void;
  getCarriedKindling: () => number;
  onSettlementFailure?: (message: string, retry: () => void) => void;
  /** Alternate development destination, after the normal saved settlement and event. */
  onReturn?: () => void;
}

// ---------------------------------------------------------------------------
// RunController
// ---------------------------------------------------------------------------

export class RunController {
  private runEnded = false;
  private deps!: RunControllerDeps;
  private scene!: Phaser.Scene;
  private startTimeMs = 0;
  /** Set to true when R is pressed to cancel the pending scene transition. */
  private restarted = false;
  /** Tracks the last endRun reason so purification gets the right survived flag. */
  private lastEndReason: EndRunReason | null = null;
  /** Kindling carried at end of run (captured before any reset). */
  private lastKindling = 0;
  private settlementSaved = false;
  private settlementEmitted = false;

  /** Stored for cleanup. */
  private readonly onPlayerDied: (payload: { cause: string }) => void;
  private readonly onRiftExitReached: () => void;

  constructor() {
    this.onPlayerDied = (_payload) => {
      this.endRun('player_died');
    };
    this.onRiftExitReached = () => {
      this.endRun('extract');
    };
  }

  create(scene: Phaser.Scene, deps: RunControllerDeps): void {
    this.scene = scene;
    this.deps = deps;
    this.startTimeMs = scene.time.now;
    this.runEnded = false;
    this.restarted = false;
    this.lastEndReason = null;
    this.lastKindling = 0;
    this.settlementSaved = false;
    this.settlementEmitted = false;

    eventBus.on(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.on(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  isRunEnded(): boolean {
    return this.runEnded;
  }

  getElapsedMs(): number {
    return this.scene.time.now - this.startTimeMs;
  }

  /**
   * R key handler. After death or extraction: skip any remaining delay and go
   * to purification (DEC-056). Survived is still decided by endRun reason.
   */
  restart(): void {
    if (!this.runEnded || this.restarted) return;
    if (!this.saveSettlement()) return;
    if (this.deps.onReturn) {
      this.restarted = true;
      this.emitSettlement();
      this.deps.onReturn();
      return;
    }
    this.transitionToPurification();
  }

  destroy(): void {
    eventBus.off(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  // ------------------------------------------------------------------ internal

  private endRun(reason: EndRunReason): void {
    if (this.runEnded) return;
    this.runEnded = true;
    this.restarted = false;
    this.lastEndReason = reason;
    this.lastKindling = reason === 'extract' ? this.deps.getCarriedKindling() : 0;

    this.deps.pauseChaos(true);
    this.deps.setPlayerInput(false);

    this.saveSettlement();
    this.scene.time.delayedCall(GAME_CONSTANTS.EXTRACTION.SETTLE_DELAY_MS, () => {
      if (this.restarted || !this.settlementSaved) return;
      this.emitSettlement();
    });
  }

  private saveSettlement(): boolean {
    if (this.settlementSaved) return true;
    const run = inventoryStore.getRun();
    if (run?.status === 'active') {
      const result = inventoryStore.settleRun(run.id, this.lastEndReason === 'extract' ? 'extract' : 'death', this.lastKindling);
      if (!result.ok) {
        this.deps.onSettlementFailure?.(inventoryError(result.error), () => {
          if (this.saveSettlement()) this.emitSettlement();
        });
        return false;
      }
    }
    this.settlementSaved = true;
    return true;
  }

  private emitSettlement(): void {
    if (this.settlementEmitted) return;
    this.settlementEmitted = true;
    eventBus.emit(GameEvent.RIFT_EXITED, { kindlingGained: this.lastKindling, survived: this.lastEndReason === 'extract' });
  }

  private transitionToPurification(): void {
    this.restarted = true;

    // Inject transition animation styles once
    this.injectTransitionStyles();

    // Phase 1: 0.3s shrink + teal glow effect on game canvas
    const glowOverlay = document.createElement('div');
    glowOverlay.id = 'scene-transition-glow';
    glowOverlay.style.cssText = [
      'position:absolute', 'inset:0',
      'z-index:1999', 'pointer-events:none',
      'animation:rift-collapse-glow 0.3s ease-in forwards',
    ].join(';');
    getDomUiRoot().appendChild(glowOverlay);

    // Apply shrink to the game canvas
    const canvas = document.querySelector('#game-container canvas') as HTMLElement | null;
    if (canvas) {
      canvas.style.transition = 'transform 0.3s ease-in';
      canvas.style.transform = 'scale(0.95)';
    }

    // Phase 2: After 0.3s, show black screen with text
    setTimeout(() => {
      glowOverlay.remove();
      if (canvas) {
        canvas.style.transition = '';
        canvas.style.transform = '';
      }

      const overlay = document.createElement('div');
      overlay.id = 'scene-transition-overlay';
      overlay.style.cssText = [
        'position:absolute', 'inset:0',
        'z-index:2000', 'background:#000', 'display:flex',
        'align-items:center', 'justify-content:center',
        // C6: was #5a5f66 (metal-light, border/divider-only per A1 V1/V2 - unreadable
        // as text on black). Same bright text colour the chaos-threshold narration uses.
        "font:14px 'Courier New',monospace", 'color:#c8cdd4',
      ].join(';');
      overlay.textContent = '裂隙坍缩。回到净化点。';
      getDomUiRoot().appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
        this.scene.scene.start('PurificationScene', {
          kindlingGained: this.lastKindling,
          survived: this.lastEndReason === 'extract',
        });
      }, 500);
    }, 300);
  }

  /** Inject CSS keyframes for scene transition animations (idempotent). */
  private injectTransitionStyles(): void {
    if (document.getElementById('scene-transition-styles')) return;
    const style = document.createElement('style');
    style.id = 'scene-transition-styles';
    style.textContent = `
      @keyframes rift-collapse-glow {
        from {
          box-shadow: inset 0 0 0px rgba(0, 180, 160, 0);
          background: transparent;
        }
        to {
          box-shadow: inset 0 0 60px rgba(0, 180, 160, 0.3);
          background: rgba(0, 0, 0, 0.3);
        }
      }
      @keyframes rift-enter-glow {
        from {
          background: radial-gradient(ellipse at center, transparent 60%, rgba(0, 180, 160, 0) 100%);
        }
        to {
          background: radial-gradient(ellipse at center, transparent 30%, rgba(0, 180, 160, 0.25) 100%);
        }
      }
    `;
    document.head.appendChild(style);
  }
}
