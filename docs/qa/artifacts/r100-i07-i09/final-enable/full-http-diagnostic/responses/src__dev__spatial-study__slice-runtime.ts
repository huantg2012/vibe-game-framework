import type { RiftDevRuntime, RiftDevRuntimeContext } from '@/scenes/rift-scene';
import { SpatialSliceWorld, type SlicePresentation, type SpatialSliceMode } from './slice-world';
import { StagePresentation } from './stage/presentation';
import { VistaPresentation } from './vista/presentation';

export class SpatialSliceRuntime implements RiftDevRuntime {
  private readonly presentation: SlicePresentation;
  private phase = '';
  constructor(private readonly context: RiftDevRuntimeContext, readonly world: SpatialSliceWorld,
    readonly mode: SpatialSliceMode, private readonly recordEvent: (event: string, payload: unknown) => void,
    options: { readonly camera?: 'fixed' | 'follow' } = {}) {
    this.presentation = mode === 'stage' ? new StagePresentation(context, world, options) : new VistaPresentation(context, world);
    this.afterUpdate(0);
  }

  update(elapsedMs: number, ended: boolean): void {
    const before = this.world.hits, attempts = this.world.attempts;
    this.world.advance(elapsedMs, this.context.player.getPosition(), ended, this.context.applyHazardHit);
    const key = `${this.world.water.cycle}:${this.world.water.phase}:${this.world.water.active}`;
    if (key !== this.phase) { this.phase = key; this.recordEvent('slice:water-phase', { elapsedMs, ...this.world.water }); }
    if (attempts !== this.world.attempts) this.recordEvent('slice:water-contact', { elapsedMs,
      applied: this.world.hits > before, position: { ...this.context.player.getPosition() },
      outline: this.world.waterOutline.map(p => ({ ...p })), ...this.world.water });
  }

  afterUpdate(elapsedMs: number): void { this.presentation.update(elapsedMs); }

  snapshot() {
    const p = this.context.player.getPosition(), camera = this.context.scene.cameras.main;
    return { mode: this.mode, elapsedMs: this.world.elapsedMs, fixture: this.world.signature(),
      player: { ...p, groundY: this.context.player.getGroundY() }, footprint: { ...this.context.getFootprint() },
      water: { ...this.world.water, definition: this.world.waterDefinition,
        outline: this.world.waterOutline.map(p => ({ ...p })), inside: this.world.isInsideWater(p),
        attempts: this.world.attempts, committedHits: this.world.hits },
      sea: { underFootprint: this.world.seaField(p.x, p.y) > 0, openingCount: this.world.openings.length },
      camera: { zoomX: camera.zoomX, zoomY: camera.zoomY, scrollX: camera.scrollX, scrollY: camera.scrollY },
      presentation: this.presentation.snapshot(),
      targets: this.context.enemies.map(a => ({ id: a.id, position: { ...a.getPosition() }, visibility: this.context.visibilityAt(a.getPosition()) })) };
  }

  destroy(): void { this.presentation.destroy(); }
}
