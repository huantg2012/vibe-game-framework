import Phaser from 'phaser';
import type { RiftDevRuntime, RiftDevRuntimeContext } from '@/scenes/rift-scene';
import { SPATIAL_SCENE, SPATIAL_WATER } from './fixture';
import { seaFrontYAt } from './sea-volume';
import { SuspendedSeaPresentation, type SeaPresentationConfig } from './presentation';
import { SpatialBillboardBridge, type SpatialProjection } from './projection';
import { isInsideWaterCurtain, WaterCurtainRuntime } from './water-curtain';

export class SpatialStudyRuntime implements RiftDevRuntime {
  private readonly water = new WaterCurtainRuntime(SPATIAL_WATER);
  private readonly billboard: SpatialBillboardBridge;
  private readonly presentation: SuspendedSeaPresentation;
  private readonly config: SeaPresentationConfig;
  private elapsedMs = 0;
  private phase = '';

  constructor(private readonly context: RiftDevRuntimeContext, readonly projection: Readonly<SpatialProjection>,
    private readonly recordEvent: (event: string, payload: unknown) => void) {
    this.config = { seed: context.layout.seed, compression: projection.compression, heightProjection: projection.heightProjection,
      seaFrontY: SPATIAL_SCENE.seaFrontY, seaBottomHeight: SPATIAL_SCENE.seaBottomHeight, seaTopHeight: SPATIAL_SCENE.seaTopHeight,
      curtain: { x: SPATIAL_WATER.x, y: SPATIAL_WATER.y, width: SPATIAL_WATER.width, depth: SPATIAL_WATER.depth },
      reef: { x: (SPATIAL_SCENE.reefCol + .5) * context.layout.tileMap.tileSize,
        y: (SPATIAL_SCENE.reefRow + .5) * context.layout.tileMap.tileSize, height: SPATIAL_SCENE.reefHeight } };
    this.billboard = new SpatialBillboardBridge(projection.compression);
    this.billboard.attachActor(context.player);
    for (const actor of context.enemies) this.billboard.attachActor(actor);
    // These copies are actual successful-hit/death feedback created by CombatSystem.
    // The pool's position is the struck entity's foot. Never render a stale copy through fog.
    for (const object of context.scene.children.list) {
      if (!(object instanceof Phaser.GameObjects.Image) || !object.texture.key.startsWith('combat-flash-')) continue;
      this.billboard.attach(object, () => object.y, () => context.visibilityAt(object) > 0);
    }
    this.presentation = new SuspendedSeaPresentation(context.scene, context.layout, this.config, context.revealProjectedTerrain);
    this.afterUpdate(0);
  }

  update(elapsedMs: number, ended: boolean): void {
    this.elapsedMs = elapsedMs;
    const beforeAttempts = this.water.attempts, beforeHits = this.water.hits;
    this.water.update(elapsedMs, this.context.player.getPosition(), ended, this.context.applyHazardHit);
    const key = `${this.water.frame.cycle}:${this.water.frame.phase}:${this.water.frame.active}`;
    if (key !== this.phase) { this.phase = key; this.recordEvent('spatial:water-phase', { elapsedMs, ...this.water.frame }); }
    if (this.water.attempts !== beforeAttempts) this.recordEvent('spatial:water-contact', { elapsedMs,
      applied: this.water.hits !== beforeHits, amount: this.water.hits !== beforeHits ? SPATIAL_WATER.damage : 0,
      position: { ...this.context.player.getPosition() }, ...this.water.frame });
  }

  afterUpdate(elapsedMs: number): void {
    this.presentation.setReefDepth(this.context.getGroundVisualDepth(this.config.reef.y));
    const reef = this.config.reef;
    const reefVisibility = Math.max(...[[-20, -20], [20, -20], [-20, 20], [20, 20]].map(([dx, dy]) =>
      this.context.visibilityAt({ x: reef.x + dx!, y: reef.y + dy! })));
    this.presentation.update({ elapsedMs, player: { x: this.context.player.getPosition().x, y: this.context.player.getGroundY() },
      curtain: this.water.frame, reefVisibility });
  }

  snapshot() {
    const player = this.context.player.getPosition(), camera = this.context.scene.cameras.main;
    const front = seaFrontYAt(player.x, this.config.seed, this.config.seaFrontY, this.elapsedMs);
    return { elapsedMs: this.elapsedMs, projection: { ...this.projection },
      camera: { zoomX: camera.zoomX, zoomY: camera.zoomY, scrollX: camera.scrollX, scrollY: camera.scrollY,
        worldView: { x: camera.worldView.x, y: camera.worldView.y, width: camera.worldView.width, height: camera.worldView.height } },
      footprint: this.context.getFootprint(), player: { ...player, groundY: this.context.player.getGroundY() },
      sea: { frontY: front, bottomHeight: this.config.seaBottomHeight, topHeight: this.config.seaTopHeight,
        actualColumn: this.presentation.sampleColumn(player.x, player.y), volume: this.presentation.snapshot(), reef: { ...this.config.reef },
        underFootprint: this.presentation.sampleColumn(player.x, player.y).inside,
        underProjectedCover: this.presentation.coversProjectedPoint(player.x, this.context.player.getGroundY() - 19 / this.projection.compression),
        cutCenter: { x: player.x, y: this.context.player.getGroundY() - 19 / this.projection.compression } },
      water: { ...this.water.frame, definition: SPATIAL_WATER, phaseElapsedMs: this.water.frame.progress * (
        this.water.frame.phase === 'quiet' ? SPATIAL_WATER.quietMs : this.water.frame.phase === 'descending' ? SPATIAL_WATER.warningMs
          : this.water.frame.phase === 'falling' ? SPATIAL_WATER.activeMs : SPATIAL_WATER.retractMs),
        inside: isInsideWaterCurtain(player, SPATIAL_WATER), attempts: this.water.attempts, committedHits: this.water.hits },
      targets: this.context.enemies.map(actor => ({ id: actor.id, position: { ...actor.getPosition() }, visibility: this.context.visibilityAt(actor.getPosition()) })) };
  }

  destroy(): void { this.billboard.destroy(); this.presentation.destroy(); }
}
