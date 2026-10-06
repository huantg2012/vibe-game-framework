import Phaser from 'phaser';
import type { RiftDevActorVisuals } from '@/scenes/rift-scene';

export type SpatialView = 'a' | 'b';
export interface SpatialProjection { view: SpatialView; compression: number; zoomX: number; zoomY: number; heightProjection: number }
export function spatialProjection(view: SpatialView): SpatialProjection {
  const compression = view === 'b' ? .52 : 1;
  return { view, compression, zoomX: 1.5, zoomY: 1.5 * compression,
    // The same 3D volume is projected in both views. A is truly overhead: no invented side lip.
    heightProjection: view === 'b' ? Math.sqrt(1 - compression * compression) / compression : 0 };
}
export function projectElevatedY(y: number, z: number, projection: Readonly<SpatialProjection>): number {
  return y - z * projection.heightProjection;
}

type Matrix = Phaser.GameObjects.Components.TransformMatrix;
type Camera = Phaser.Cameras.Scene2D.Camera;
type Object = Phaser.GameObjects.GameObject;
type Render = (this: Object, renderer: unknown, source: Object, camera: Camera, parent?: Matrix) => void;
interface Renderable extends Object { renderWebGL?: Render; renderCanvas?: Render }

/** A render-only parent transform: no body position, scale, crop, or camera-follow state changes.
 * The sole is fixed while the production pose and all its attached pieces stay together.
 * Ground lights, danger marks and actual hit tests keep the compressed ground plane.
 */
export class SpatialBillboardBridge {
  private readonly cleanups: (() => void)[] = [];
  private readonly registered = new Set<Object>();
  constructor(private readonly compression: number) {}

  attachActor(actor: RiftDevActorVisuals): void {
    for (const object of actor.objects) {
      if (object instanceof Phaser.GameObjects.Image && object.texture.key === 'player-aura-pool') continue;
      this.attach(object, actor.getGroundY);
    }
  }

  attach(object: Object, groundY: () => number, canRender: () => boolean = () => true): void {
    if (this.registered.has(object)) return;
    this.registered.add(object);
    const subject = object as Renderable, compression = this.compression;
    for (const method of ['renderWebGL', 'renderCanvas'] as const) {
      const original = subject[method];
      if (!original) continue;
      const matrix = new Phaser.GameObjects.Components.TransformMatrix();
      const composed = new Phaser.GameObjects.Components.TransformMatrix();
      const wrapped: Render = function(renderer, source, camera, parent) {
        if (!canRender()) return;
        const reciprocal = 1 / compression;
        matrix.setTransform(1, 0, 0, reciprocal, 0, groundY() * (1 - reciprocal));
        if (parent) matrix.multiply(parent, composed);
        original.call(this, renderer, source, camera, parent ? composed : matrix);
      };
      subject[method] = wrapped;
      this.cleanups.push(() => { if (subject[method] === wrapped) subject[method] = original; matrix.destroy(); composed.destroy(); });
    }
  }

  destroy(): void { for (const cleanup of this.cleanups.splice(0)) cleanup(); this.registered.clear(); }
}
