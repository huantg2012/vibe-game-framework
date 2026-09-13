import { suspendedSeaIdentity } from './recovery';
/** One native scene adapter shared by the isolated training and base-journey pages. */
import type { RiftDevFixture } from '@/scenes/rift-scene';
import { createStageSightGrid } from '../spatial-study/stage/sight-grid';
import { createSuspendedSeaPresentation } from './presentation';
import { createSuspendedSeaSearchVisual } from './search-visual';
import { SuspendedSeaRuntime } from './runtime';
import type { SuspendedSeaWorld } from './world';

export interface SuspendedSeaFixtureOptions {
  readonly recovery?: { checkpoint?: import('@/types/rift-checkpoint').RiftCheckpoint<import('@/systems/rift-recovery-state').RiftRecoveryState> };
  readonly onReturn: () => void;
  readonly onPause: () => void;
  readonly onRuntime: (runtime: SuspendedSeaRuntime) => void;
  readonly recordEvent: (event: string, payload: unknown) => void;
}
export function createSuspendedSeaFixture(world: SuspendedSeaWorld, options: SuspendedSeaFixtureOptions): RiftDevFixture {
  return {
    ...(options.recovery ? { recovery: { identity: suspendedSeaIdentity(world), externalTargetIds: [world.shellDefinition.id], checkpoint: options.recovery.checkpoint } } : {}),
    createLayout: () => world.base.layout, onReturn: options.onReturn, onPause: options.onPause,
    extractionGlowRadius: 8, createSightGrid: createStageSightGrid, entryDurationMs: world.entryDurationMs, freezeAfterEnd: true,
    atmosphereKey: 'amb-suspended-sea-pressure', worldSurface: 'runtime', footstepMaterial: 'soil',
    createSearchObjectVisual: createSuspendedSeaSearchVisual,
    configureCamera: camera => camera.setZoom(1.35),
    createRuntime: context => {
      const runtime = new SuspendedSeaRuntime(context, world.base, world.shellDefinition, options.recordEvent,
        (ctx, base, readShell) => createSuspendedSeaPresentation(ctx, base, readShell, { shellBody: world.shellBody }));
      options.onRuntime(runtime);
      return runtime;
    },
  };
}
