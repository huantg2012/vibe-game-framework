import type { CombatCueId } from '@/systems/combat-system';
import type { RiftDevRuntime, RiftDevRuntimeContext } from '@/scenes/rift-scene';
import { SuspendedSeaShellSystem } from '@/worlds/suspended-sea/shell-system';
import type { ShellRuntimeStateV1 } from '@/worlds/suspended-sea/shell-system';
import { checkpointChecksum } from '@/types/rift-checkpoint';
import type { SeaPoint, ShellDefinition, ShellView } from '@/worlds/suspended-sea/types';
import type { SlicePresentation, SpatialSliceWorld } from '../spatial-study/slice-world';
import { WaterFlowCycle } from '../spatial-study/water-flow';

export type SuspendedSeaPresentationFactory = (context: RiftDevRuntimeContext, world: SpatialSliceWorld,
  readShell: () => ShellView) => SlicePresentation;

export interface SuspendedSeaRuntimeStateV1 {
  version: 1; signature: string; elapsedMs: number; shell: ShellRuntimeStateV1; presentation: unknown;
}

/** Composes the existing world and real RiftScene; it owns no player, inventory,
 * AI, weapon transaction, or alternate water clock. The old studies keep their
 * original runtime and contact implementation.
 */
export class SuspendedSeaRuntime implements RiftDevRuntime {
  readonly shell: SuspendedSeaShellSystem;
  private readonly presentation: SlicePresentation;
  private readonly unregister: () => void;
  private destroyed = false;
  private recordedPhase = '';
  private recordedHit = 0;
  private recordedContact = 0;
  private recordedCommitted = 0;
  private materialCueSequence = 0;

  constructor(private readonly context: RiftDevRuntimeContext, readonly world: SpatialSliceWorld,
    definition: ShellDefinition, private readonly recordEvent: (event: string, payload: unknown) => void,
    createPresentation: SuspendedSeaPresentationFactory) {
    const flow = new WaterFlowCycle(world.waterDefinition);
    if (definition.damage !== world.waterDefinition.damage || definition.hitIntervalMs !== world.waterDefinition.hitIntervalMs) {
      throw new Error('Core and spill must share their authored source damage and contact interval');
    }
    this.shell = new SuspendedSeaShellSystem(definition, { periodMs: flow.period,
      warningStartMs: world.waterDefinition.quietMs, contactStartMs: flow.contactStart, contactEndMs: flow.contactEnd },
    (x, y) => world.isFloor(x, y));
    this.unregister = context.registerMeleeTargets(this.shell);
    try {
      this.presentation = createPresentation(context, world, this.shell.readView);
    } catch (error) {
      this.unregister();
      this.shell.destroy();
      throw error;
    }
  }

  beforeCombat(elapsedMs: number, ended: boolean): void {
    if (this.destroyed) return;
    const complete = ended || this.context.isRunEnded();
    if (!complete) {
      if (!Number.isFinite(elapsedMs) || elapsedMs < this.world.elapsedMs) throw new Error('Suspended-sea play time must be finite and monotonic');
      this.world.prepare(elapsedMs);
    }
    this.shell.prepare(this.world.elapsedMs, complete);
  }

  update(elapsedMs: number, ended: boolean): void {
    if (this.destroyed) return;
    if (ended || this.context.isRunEnded()) {
      this.shell.prepare(this.world.elapsedMs, true);
      return;
    }
    if (elapsedMs !== this.world.elapsedMs) throw new Error('Suspended sea requires same-frame beforeCombat preparation');
    const position = this.context.player.getPosition();
    // The union is attempted once. No separate baseWorld.resolveContact call:
    // invulnerability must not be used to conceal duplicate water attempts.
    this.shell.resolveContact(position, this.world.isInsideWater(position), this.context.applyHazardHit);
    if (this.context.isRunEnded()) this.shell.prepare(this.world.elapsedMs, true);
  }

  handleCombatCue(cue: CombatCueId, position: SeaPoint): boolean {
    const view = this.shell.readView();
    if (this.destroyed || cue !== 'combat.cue.hit' || view.hitSequence <= this.materialCueSequence
      || view.hitAtMs !== this.world.elapsedMs || position.x !== view.position.x || position.y !== view.position.y) return false;
    this.materialCueSequence = view.hitSequence;
    // Only replace this precise contact's generic enemy pain sound. Its real
    // noise stimulus, shared target budget and contact pause have already run.
    // The local audio adapter consumes the monotonic shell hit sequence.
    return true;
  }

  afterUpdate(elapsedMs: number): void {
    if (this.destroyed) return;
    this.recordChanges();
    this.presentation.update(elapsedMs);
  }

  prepareCheckpoint(elapsedMs: number): void { this.presentation.prepareFrame?.(elapsedMs); }

  exportRuntimeState(): SuspendedSeaRuntimeStateV1 {
    if (!this.presentation.exportRuntimeState) throw new Error('Stage cannot save its exploration memory');
    return { version: 1, signature: checkpointChecksum(this.world.signature()), elapsedMs: this.world.elapsedMs,
      shell: this.shell.exportRuntimeState(), presentation: this.presentation.exportRuntimeState() };
  }

  validateRuntimeState(value: unknown): value is SuspendedSeaRuntimeStateV1 {
    if (this.destroyed || !value || typeof value !== 'object') return false;
    const state = value as SuspendedSeaRuntimeStateV1;
    return state.version === 1 && state.signature === checkpointChecksum(this.world.signature())
      && Number.isFinite(state.elapsedMs) && state.elapsedMs >= 0
      && this.shell.validateRuntimeState(state.shell) && state.shell.elapsedMs === state.elapsedMs
      && this.presentation.validateRuntimeState?.(state.presentation) === true;
  }

  restoreRuntimeState(value: unknown): void {
    if (!this.validateRuntimeState(value)) throw new Error('Invalid suspended-sea runtime checkpoint');
    this.world.prepare(value.elapsedMs);
    this.shell.restoreRuntimeState(value.shell);
    this.presentation.restoreRuntimeState!(value.presentation);
    const shell = this.shell.readView();
    this.recordedPhase = `${shell.cycle}:${this.world.water.phase}:${shell.mode}:${shell.canHit}:${shell.coreActive}:${shell.spillActive}`;
    this.recordedHit = shell.hitSequence; this.recordedContact = shell.contactAttempts;
    this.recordedCommitted = shell.committedHits; this.materialCueSequence = shell.hitSequence;
  }

  snapshot(): Record<string, unknown> {
    const shell = this.shell.readView(), position = this.context.player.getPosition();
    return { worldId: 'suspended-sea', elapsedMs: this.world.elapsedMs, fixture: this.world.signature(),
      ended: this.context.isRunEnded(), entry: { ...this.context.readEntryView() },
      player: { ...position }, footprint: { ...this.context.getFootprint() },
      water: { ...this.world.water, active: shell.coreActive, definition: this.world.waterDefinition,
        outline: this.world.waterOutline.map(point => ({ ...point })), inside: this.world.isInsideWater(position),
        attempts: shell.contactAttempts, committedHits: shell.committedHits },
      shell: this.copyShell(), presentation: this.presentation.snapshot(),
      targets: this.context.enemies.map(actor => ({ id: actor.id, position: { ...actor.getPosition() },
        visibility: this.context.visibilityAt(actor.getPosition()) })) };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unregister();
    this.shell.destroy();
    this.presentation.destroy();
  }

  private copyShell(): ShellView {
    const shell = this.shell.readView();
    return { ...shell, position: { ...shell.position }, spillOutline: shell.spillOutline.map(point => ({ ...point })),
      drainPath: shell.drainPath.map(point => ({ ...point })) };
  }

  private recordChanges(): void {
    const shell = this.shell.readView();
    if (shell.hitSequence !== this.recordedHit) {
      this.recordedHit = shell.hitSequence;
      this.recordEvent('sea:shell-hit', { elapsedMs: shell.hitAtMs, shell: this.copyShell() });
    }
    const phase = `${shell.cycle}:${this.world.water.phase}:${shell.mode}:${shell.canHit}:${shell.coreActive}:${shell.spillActive}`;
    if (phase !== this.recordedPhase) {
      this.recordedPhase = phase;
      this.recordEvent('sea:water-phase', { elapsedMs: shell.elapsedMs, water: { ...this.world.water }, shell: this.copyShell() });
    }
    if (shell.contactAttempts !== this.recordedContact) {
      this.recordedContact = shell.contactAttempts;
      this.recordEvent('sea:water-contact', { elapsedMs: shell.lastContactAtMs,
        applied: shell.committedHits > this.recordedCommitted,
        position: { ...this.context.player.getPosition() }, coreOutline: this.world.waterOutline.map(point => ({ ...point })),
        shell: this.copyShell() });
      this.recordedCommitted = shell.committedHits;
    }
  }
}
