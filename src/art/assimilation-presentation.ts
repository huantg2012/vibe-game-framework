import { gameState } from '@/managers/game-state';
import { AssimilationStatePresentation } from './assimilation-state-presentation';
import { createAssimilationModelClient } from './assimilation-model/client';
import type { AssimilationLookState } from './assimilation-appearance';
import type { AssimilationModelFrameSource } from './assimilation-model/protocol';

interface AssimilationRenderer {
  setAssimilationLook(state: AssimilationLookState | null): void;
  setAssimilationModelSource(source: AssimilationModelFrameSource | null): void;
}
interface Options {
  profile: 'rift' | 'haven';
  yaws: readonly number[];
  havenYaws?: readonly number[];
}

/** Scene-owned visual projection. Game state owns A and its source history;
 * this owner advances only the material clock and bounded geometry preparation.
 * Background completion never advances gameplay or renders an obsolete pose. */
export class AssimilationPresentation {
  private readonly projection = new AssimilationStatePresentation();
  private readonly client;
  private seconds = 0;
  private disposed = false;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor(private readonly renderer: AssimilationRenderer, private readonly options: Options) {
    this.client = createAssimilationModelClient({ profile: options.profile, yaws: options.yaws });
    renderer.setAssimilationModelSource(this.client);
    this.update(0);
    if (options.profile === 'rift' && options.havenYaws?.length) {
      this.client.prewarm({ profile: 'haven', yaws: options.havenYaws, priority: 'background' });
    }
  }

  update(deltaMs: number): void {
    if (this.disposed) return;
    if (!this.reducedMotion.matches) this.seconds += Math.max(0, Math.min(100, deltaMs)) / 1000;
    const amount = gameState.getAssimilation();
    this.projection.update(amount, gameState.getAssimilationSources(), this.seconds,
      !this.reducedMotion.matches, this.options.profile === 'haven');
    this.renderer.setAssimilationLook(this.projection.look);
    this.client.update({ amount: amount / 100, fibre: this.projection.look.fibre,
      structure: this.projection.typedFraction });
  }

  /** Diagnostics only; no loading percentages or mechanism prose in the HUD. */
  get status() { return this.client.status; }
  get metrics() { return this.client.metrics; }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAssimilationModelSource(null);
    this.renderer.setAssimilationLook(null);
    this.client.destroy();
  }
}
