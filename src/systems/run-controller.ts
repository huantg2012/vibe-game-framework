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
import { afterStateCommit } from '@/core/commit-effects';
import { eventBus } from '@/core/event-bus';
import { runtimeInteger, runtimeNumber, runtimeRecord } from '@/systems/ai/runtime-validation';
import { GameEvent } from '@/types/events';
import { getDomUiRoot } from '@/ui/dom/panel-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EndRunReason = 'extract' | 'player_died' | 'abandon';

/** The clock is rebased on restore; offline wall time never advances a run. */
export interface RunRuntimeStateV1 {
  version: 1;
  runEnded: boolean;
  /** A return has been requested; its presentation waits for the same commit. */
  restarted: boolean;
  lastEndReason: EndRunReason | null;
  lastKindling: number;
  settlementSaved: boolean;
  /** Reserves the one event before commit. A committed reservation is never replayed. */
  settlementEmitted: boolean;
  clockSource: 'scene' | 'external';
  elapsedMs: number;
  settlementDelayRemainingMs: number | null;
}

/** Pure JSON guard. Inventory/run identity belongs to the whole-frame validator. */
export function validateRunRuntimeState(value: unknown): value is RunRuntimeStateV1 {
  if (!runtimeRecord(value) || value.version !== 1
    || typeof value.runEnded !== 'boolean' || typeof value.restarted !== 'boolean'
    || typeof value.settlementSaved !== 'boolean' || typeof value.settlementEmitted !== 'boolean'
    || !runtimeInteger(value.lastKindling) || !runtimeNumber(value.elapsedMs, 0, Number.MAX_SAFE_INTEGER)
    || (value.clockSource !== 'scene' && value.clockSource !== 'external')) return false;
  if (!value.runEnded) return value.lastEndReason === null && value.lastKindling === 0
    && !value.restarted && !value.settlementSaved && !value.settlementEmitted
    && value.settlementDelayRemainingMs === null;
  if (value.lastEndReason !== 'extract' && value.lastEndReason !== 'player_died' && value.lastEndReason !== 'abandon') return false;
  if (value.lastEndReason !== 'extract' && value.lastKindling !== 0) return false;
  if (value.restarted || value.settlementEmitted) return value.settlementSaved && value.settlementDelayRemainingMs === null;
  return runtimeNumber(value.settlementDelayRemainingMs, 0, GAME_CONSTANTS.EXTRACTION.SETTLE_DELAY_MS);
}

export interface RunControllerDeps {
  pauseChaos: (paused: boolean) => void;
  setPlayerInput: (enabled: boolean) => void;
  getCarriedKindling: () => number;
  onSettlementFailure?: (message: string, retry: () => void) => void;
  /** Alternate development destination, after the normal saved settlement and event. */
  onReturn?: () => void;
  /** Optional authoritative play clock (for preparation that precedes simulation). */
  getElapsedMs?: () => number;
  /** Recovery scenes mark the current frame dirty even when only lifecycle flags change. */
  onRuntimeStateChanged?: () => void;
}

// ---------------------------------------------------------------------------
// RunController
// ---------------------------------------------------------------------------

export class RunController {
  private runEnded = false;
  private deps!: RunControllerDeps;
  private scene!: Phaser.Scene;
  private startTimeMs = 0;
  private elapsedOffsetMs = 0;
  /** Set to true when R is pressed to cancel the pending scene transition. */
  private restarted = false;
  /** Tracks the last endRun reason so purification gets the right survived flag. */
  private lastEndReason: EndRunReason | null = null;
  /** Kindling carried at end of run (captured before any reset). */
  private lastKindling = 0;
  private settlementSaved = false;
  private settlementEmitted = false;
  private settlementDelayRemainingMs: number | null = null;
  private settlementDeadlineMs: number | null = null;
  private settlementSchedulingQueued = false;
  private returnPresented = false;
  private created = false;
  private restorePending = false;
  /** Invalidates callbacks retained by a previous scene or pre-restore timer. */
  private lifecycleRevision = 0;

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
    this.lifecycleRevision++;
    this.created = true;
    this.restorePending = false;
    this.scene = scene;
    this.deps = deps;
    this.startTimeMs = scene.time.now;
    this.elapsedOffsetMs = 0;
    this.runEnded = false;
    this.restarted = false;
    this.lastEndReason = null;
    this.lastKindling = 0;
    this.settlementSaved = false;
    this.settlementEmitted = false;
    this.settlementDelayRemainingMs = null;
    this.settlementDeadlineMs = null;
    this.settlementSchedulingQueued = false;
    this.returnPresented = false;

    eventBus.on(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.on(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  isRunEnded(): boolean {
    return this.runEnded;
  }

  getElapsedMs(): number {
    return this.deps.getElapsedMs
      ? this.deps.getElapsedMs() + this.elapsedOffsetMs
      : this.scene.time.now - this.startTimeMs;
  }

  exportRuntimeState(): RunRuntimeStateV1 {
    const state: RunRuntimeStateV1 = {
      version: 1, runEnded: this.runEnded, restarted: this.restarted,
      lastEndReason: this.lastEndReason, lastKindling: this.lastKindling,
      settlementSaved: this.settlementSaved, settlementEmitted: this.settlementEmitted,
      clockSource: this.deps.getElapsedMs ? 'external' : 'scene', elapsedMs: this.getElapsedMs(),
      settlementDelayRemainingMs: this.settlementDeadlineMs === null ? this.settlementDelayRemainingMs
        : Math.max(0, this.settlementDeadlineMs - this.scene.time.now),
    };
    if (!this.validateRuntimeState(state)) throw new Error('Unsupported run runtime state');
    return state;
  }

  validateRuntimeState(value: unknown): value is RunRuntimeStateV1 {
    return this.created && validateRunRuntimeState(value)
      && value.clockSource === (this.deps.getElapsedMs ? 'external' : 'scene');
  }

  /** Hydrates facts only. Restore the external clock before calling this method. */
  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid run runtime state');
    const clock = this.deps.getElapsedMs?.() ?? this.scene.time.now;
    if (!runtimeNumber(clock, 0, Number.MAX_SAFE_INTEGER)) throw new Error('Invalid live run clock');
    this.lifecycleRevision++;
    this.restorePending = true;
    this.runEnded = value.runEnded;
    this.restarted = value.restarted;
    this.lastEndReason = value.lastEndReason;
    this.lastKindling = value.lastKindling;
    this.settlementSaved = value.settlementSaved;
    this.settlementEmitted = value.settlementEmitted;
    this.startTimeMs = this.scene.time.now - value.elapsedMs;
    this.elapsedOffsetMs = this.deps.getElapsedMs ? value.elapsedMs - clock : 0;
    this.settlementDelayRemainingMs = value.settlementDelayRemainingMs;
    this.settlementDeadlineMs = null;
    this.settlementSchedulingQueued = false;
    this.returnPresented = false;
  }

  /** Call once after the entire committed world and its result projection are restored.
   * An already reserved RIFT_EXITED is represented by that projection, never emitted again.
   * This method does not settle inventory, pause systems, or reconstruct an endRun event. */
  finishRuntimeRestore(): void {
    if (!this.created || !this.restorePending) return;
    this.restorePending = false;
    if (!this.runEnded || !this.settlementSaved) return;
    if (this.restarted) this.queueReturn();
    else if (!this.settlementEmitted) this.scheduleSettlement();
  }

  /** Explicit loss of this trip. Closing or refreshing a page must not call this. */
  abandon(): void {
    this.endRun('abandon');
  }

  /**
   * R key handler. After death or extraction: skip any remaining delay and go
   * to purification (DEC-056). Survived is still decided by endRun reason.
   */
  restart(): void {
    if (!this.created || this.restorePending || !this.runEnded || this.restarted) return;
    if (!this.saveSettlement()) return;
    this.restarted = true;
    this.settlementDelayRemainingMs = null;
    this.settlementDeadlineMs = null;
    this.deps.onRuntimeStateChanged?.();
    if (this.deps.onReturn) this.emitSettlement();
    this.queueReturn();
  }

  destroy(): void {
    this.lifecycleRevision++;
    this.created = false;
    this.restorePending = false;
    eventBus.off(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  // ------------------------------------------------------------------ internal

  private endRun(reason: EndRunReason): void {
    if (!this.created || this.restorePending || this.runEnded) return;
    this.runEnded = true;
    this.restarted = false;
    this.lastEndReason = reason;
    this.lastKindling = reason === 'extract' ? this.deps.getCarriedKindling() : 0;
    this.settlementDelayRemainingMs = GAME_CONSTANTS.EXTRACTION.SETTLE_DELAY_MS;

    this.deps.pauseChaos(true);
    this.deps.setPlayerInput(false);

    this.saveSettlement();
    this.deps.onRuntimeStateChanged?.();
    this.scheduleSettlement();
  }

  private saveSettlement(): boolean {
    if (this.settlementSaved) return true;
    const run = inventoryStore.getRun();
    if (run?.status === 'active') {
      const result = inventoryStore.settleRun(run.id, this.lastEndReason === 'extract' ? 'extract'
        : this.lastEndReason === 'abandon' ? 'abandon' : 'death', this.lastKindling);
      if (!result.ok) {
        const revision = this.lifecycleRevision;
        this.deps.onSettlementFailure?.(inventoryError(result.error), () => {
          if (!this.created || this.restorePending || revision !== this.lifecycleRevision) return;
          if (this.saveSettlement()) this.emitSettlement();
        });
        return false;
      }
    }
    this.settlementSaved = true;
    return true;
  }

  private emitSettlement(): void {
    if (this.settlementEmitted || !this.settlementSaved) return;
    // Persist the reservation with the frame that publishes the event. A reload
    // after commit but before its callback projects the result without replaying it.
    this.settlementEmitted = true;
    this.settlementDelayRemainingMs = null;
    this.settlementDeadlineMs = null;
    this.deps.onRuntimeStateChanged?.();
    this.afterCommit(() => eventBus.emit(GameEvent.RIFT_EXITED,
      { kindlingGained: this.lastKindling, survived: this.lastEndReason === 'extract' }));
  }

  private scheduleSettlement(): void {
    if (this.settlementSchedulingQueued || this.settlementDeadlineMs !== null
      || this.settlementEmitted || this.restarted || this.settlementDelayRemainingMs === null) return;
    this.settlementSchedulingQueued = true;
    this.afterCommit(() => {
      this.settlementSchedulingQueued = false;
      if (this.settlementEmitted || this.restarted || this.settlementDelayRemainingMs === null) return;
      const delay = this.settlementDelayRemainingMs, revision = this.lifecycleRevision;
      this.settlementDeadlineMs = this.scene.time.now + delay;
      this.scene.time.delayedCall(delay, () => {
        if (!this.created || this.restorePending || revision !== this.lifecycleRevision || this.restarted || this.settlementEmitted) return;
        this.settlementDeadlineMs = null;
        this.settlementDelayRemainingMs = 0;
        if (this.settlementSaved) this.emitSettlement();
      });
    });
  }

  private queueReturn(): void {
    this.afterCommit(() => {
      if (this.returnPresented) return;
      this.returnPresented = true;
      if (this.deps.onReturn) this.deps.onReturn();
      else this.transitionToPurification();
    });
  }

  private afterCommit(effect: () => void): void {
    const revision = this.lifecycleRevision;
    afterStateCommit(() => {
      if (this.created && !this.restorePending && revision === this.lifecycleRevision) effect();
    });
  }

  private transitionToPurification(): void {
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
