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

    eventBus.on(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.on(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  isRunEnded(): boolean {
    return this.runEnded;
  }

  getElapsedMs(): number {
    return this.scene.time.now - this.startTimeMs;
  }

  restart(): void {
    this.runEnded = false;
    this.runCycle++;
    this.startTimeMs = this.scene.time.now;
    this.deps.resetAll();
    this.deps.pauseChaos(false);
    this.deps.setPlayerInput(true);
    eventBus.emit(GameEvent.RIFT_ENTERED, { cycle: this.runCycle });
  }

  destroy(): void {
    eventBus.off(GameEvent.PLAYER_DIED, this.onPlayerDied);
    eventBus.off(GameEvent.RIFT_EXIT_REACHED, this.onRiftExitReached);
  }

  // ------------------------------------------------------------------ internal

  private endRun(reason: EndRunReason): void {
    if (this.runEnded) return;
    this.runEnded = true;

    this.deps.pauseChaos(true);
    this.deps.setPlayerInput(false);

    const survived = reason === 'extract';
    const kindling = survived ? this.deps.getCarriedKindling() : 0;

    this.scene.time.delayedCall(GAME_CONSTANTS.EXTRACTION.SETTLE_DELAY_MS, () => {
      eventBus.emit(GameEvent.RIFT_EXITED, {
        kindlingGained: kindling,
        survived,
      });
    });
  }
}
