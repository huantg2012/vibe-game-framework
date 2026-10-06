import type { RiftDevRuntime, RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SlicePresentation } from '../spatial-study/slice-world';
import type { TensionView } from '@/worlds/living-landmass/types';
import { copyLandmassPoints, type LivingLandmassWorld, type LivingLandmassWorldStateV1 } from './world';

export type LivingLandmassPresentationFactory = (context: RiftDevRuntimeContext, world: LivingLandmassWorld,
  readTension: () => TensionView) => SlicePresentation;

export interface LivingLandmassRuntimeStateV1 {
  readonly version: 1;
  readonly signature: string;
  readonly elapsedMs: number;
  readonly world: LivingLandmassWorldStateV1;
  readonly presentation: unknown;
}

/** Composes one native environment with the real Rift simulation. The world
 * owns vertical support and its single tension source; this adapter owns only
 * wiring, committed presentation, observation and reversible lifecycle. */
export class LivingLandmassRuntime implements RiftDevRuntime {
  private readonly presentation: SlicePresentation;
  private readonly unregister: () => void;
  private destroyed = false;
  private recordedPhase = -1;
  private recordedHit = 0;
  private recordedContact = 0;
  private recordedCommitted = 0;

  constructor(private readonly context: RiftDevRuntimeContext, readonly world: LivingLandmassWorld,
    private readonly recordEvent: (event: string, payload: unknown) => void,
    createPresentation: LivingLandmassPresentationFactory) {
    this.unregister = context.registerMeleeTargets(world.tension);
    try {
      this.presentation = createPresentation(context, world, world.readTensionView);
    } catch (error) {
      this.unregister();
      world.tension.destroy();
      throw error;
    }
  }

  beforeCombat(elapsedMs: number, ended: boolean): void {
    if (this.destroyed) return;
    if (ended || this.context.isRunEnded()) this.world.prepare(this.world.elapsedMs, true);
    else this.world.prepare(elapsedMs);
  }

  update(elapsedMs: number, ended: boolean): void {
    if (this.destroyed) return;
    if (ended || this.context.isRunEnded()) {
      this.world.prepare(this.world.elapsedMs, true);
      return;
    }
    if (elapsedMs !== this.world.elapsedMs) throw new Error('Living landmass requires beforeCombat preparation at the same play time');
    this.world.tension.resolveContact(this.context.player.getPosition(), this.context.applyHazardHit);
    if (this.context.isRunEnded()) this.world.prepare(this.world.elapsedMs, true);
  }

  afterUpdate(elapsedMs: number): void {
    if (this.destroyed) return;
    if (elapsedMs !== this.world.elapsedMs) throw new Error('Living-landmass presentation cannot use an independent clock');
    this.recordChanges();
    this.presentation.update(elapsedMs);
  }

  prepareCheckpoint(elapsedMs: number): void {
    if (this.destroyed) return;
    if (elapsedMs !== this.world.elapsedMs) throw new Error('Living-landmass checkpoint must capture the prepared frame');
    this.presentation.prepareFrame?.(elapsedMs);
  }

  exportRuntimeState(): LivingLandmassRuntimeStateV1 {
    if (!this.presentation.exportRuntimeState) throw new Error('Living-landmass presentation has no state export');
    return { version: 1, signature: this.world.signature(), elapsedMs: this.world.elapsedMs,
      world: this.world.exportRuntimeState(), presentation: this.presentation.exportRuntimeState() };
  }

  validateRuntimeState(value: unknown): value is LivingLandmassRuntimeStateV1 {
    if (this.destroyed || !value || typeof value !== 'object') return false;
    const state = value as LivingLandmassRuntimeStateV1;
    return state.version === 1 && state.signature === this.world.signature() && this.world.validateRuntimeState(state.world)
      && state.elapsedMs === state.world.elapsedMs && this.presentation.validateRuntimeState?.(state.presentation) === true;
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid living-landmass runtime checkpoint');
    this.world.restoreRuntimeState(value.world);
    this.presentation.restoreRuntimeState!(value.presentation);
    const view = this.world.readTensionView();
    this.recordedPhase = this.phaseKey();
    this.recordedHit = view.hitSequence;
    this.recordedContact = view.contactAttempts;
    this.recordedCommitted = view.committedHits;
  }

  snapshot(): Record<string, unknown> {
    const position = this.context.player.getPosition();
    return { ...this.world.snapshot(), metadata: this.world.metadata, ended: this.context.isRunEnded(),
      entry: { ...this.context.readEntryView() }, player: { ...position }, footprint: { ...this.context.getFootprint() },
      playerSupportHeight: this.world.groundHeightAt(position.x, position.y),
      presentation: this.presentation.snapshot(), targets: this.context.enemies.map(actor => ({ id: actor.id,
        position: { ...actor.getPosition() }, supportHeight: this.world.groundHeightAt(actor.getPosition().x, actor.getPosition().y),
        visibility: this.context.visibilityAt(actor.getPosition()) })) };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unregister();
    this.world.tension.destroy();
    this.presentation.destroy();
  }

  private copyTension(): TensionView {
    const view = this.world.readTensionView();
    return { ...view, position: { ...view.position }, outline: copyLandmassPoints(view.outline) };
  }

  private phaseKey(): number {
    const view = this.world.readTensionView();
    const phase = view.phase === 'rest' ? 0 : view.phase === 'strain' ? 1 : view.phase === 'pull' ? 2 : 3;
    return view.cycle * 32 + phase * 8 + Number(view.active) * 4 + Number(view.canHit) * 2 + Number(view.stopped);
  }

  private recordChanges(): void {
    const view = this.world.readTensionView();
    if (view.hitSequence !== this.recordedHit) {
      this.recordedHit = view.hitSequence;
      this.recordEvent('landmass:connection-hit', { elapsedMs: view.hitAtMs, tension: this.copyTension() });
    }
    const phase = this.phaseKey();
    if (phase !== this.recordedPhase) {
      this.recordedPhase = phase;
      this.recordEvent('landmass:tension-phase', { elapsedMs: view.elapsedMs, tension: this.copyTension() });
    }
    if (view.contactAttempts !== this.recordedContact) {
      this.recordedContact = view.contactAttempts;
      this.recordEvent('landmass:tension-contact', { elapsedMs: view.lastContactAtMs,
        applied: view.committedHits > this.recordedCommitted, position: { ...this.context.player.getPosition() },
        tension: this.copyTension() });
      this.recordedCommitted = view.committedHits;
    }
  }
}
