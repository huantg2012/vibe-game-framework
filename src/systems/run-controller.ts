/**
 * RunController - the single `endRun` exit and restart logic.
 *
 * Owns the run lifecycle: when a run ends (by death or extraction), it pauses chaos,
 * disables player input, waits a settle delay and emits `RIFT_EXITED`. On restart it
 * resets everything and emits `RIFT_ENTERED`.
 *
 * The `runEnded` flag is the gate that prevents double-fires (a death event arriving
 * while the settle delay from extraction is still running, or vice versa).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { eventBus } from '@/core/event-bus';
import { GameEvent } from '@/types/events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EndRunReason = 'extract' | 'player_died';

export interface RunControllerDeps {
  pauseChaos: (paused: boolean) => void;
  setPlayerInput: (enabled: boolean) => void;
  getCarriedKindling: () => number;
  resetAll: () => void;
}

// ---------------------------------------------------------------------------
// RunController
// ---------------------------------------------------------------------------

export class RunController {
  private runEnded = false;
  private deps!: RunControllerDeps;
  private scene!: Phaser.Scene;
  private runCycle = 1;
  private startTimeMs = 0;
  /** Set to true when R is pressed to cancel the pending scene transition. */
  private restarted = false;
  /** Tracks the last endRun reason for quick-retry eligibility. */
  private lastEndReason: EndRunReason | null = null;
  /** Kindling carried at end of run (captured before any reset). */
  private lastKindling = 0;

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
   * R key handler. After death: quick-retry in place. After extraction: skip
   * the auto-transition delay and go to purification immediately.
   */
  restart(): void {
    console.log('[RunController.restart] called. runEnded:', this.runEnded, 'lastEndReason:', this.lastEndReason, 'restarted:', this.restarted);
    if (!this.runEnded) return;

    if (this.lastEndReason === 'player_died') {
      this.restarted = true;
      this.runEnded = false;
      this.runCycle++;
      this.startTimeMs = this.scene.time.now;
      this.deps.resetAll();
      this.deps.pauseChaos(false);
      this.deps.setPlayerInput(true);
      eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: this.runCycle });
    } else {
      this.transitionToPurification();
    }
  }

  destroy(): void {
    eventBus.off(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  // ------------------------------------------------------------------ internal

  private endRun(reason: EndRunReason): void {
    console.log('[RunController.endRun] reason:', reason, 'already ended:', this.runEnded);
    if (this.runEnded) return;
    this.runEnded = true;
    this.restarted = false;
    this.lastEndReason = reason;
    this.lastKindling = reason === 'extract' ? this.deps.getCarriedKindling() : 0;
    console.log('[RunController.endRun] set runEnded=true, lastKindling:', this.lastKindling);

    this.deps.pauseChaos(true);
    this.deps.setPlayerInput(false);

    const survived = reason === 'extract';

    this.scene.time.delayedCall(GAME_CONSTANTS.EXTRACTION.SETTLE_DELAY_MS, () => {
      if (this.restarted) return;

      eventBus.emit(GameEvent.RIFT_EXITED, {
        kindlingGained: this.lastKindling,
        survived,
      });

      // No auto-transition: wait for R key press (handled by restart())
    });
  }

  private transitionToPurification(): void {
    console.log('[RunController.transitionToPurification] calling scene.start("PurificationScene"). lastKindling:', this.lastKindling);
    this.restarted = true;
    try {
      this.scene.scene.start('PurificationScene', {
        kindlingGained: this.lastKindling,
        survived: this.lastEndReason === 'extract',
      });
      console.log('[RunController.transitionToPurification] scene.start called successfully');
    } catch (err) {
      console.error('[RunController.transitionToPurification] ERROR:', err);
    }
  }
}
