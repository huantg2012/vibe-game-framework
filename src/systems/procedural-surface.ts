/**
 * Live rift surface. Each sortie bakes a newly generated island once
 * (anchor + seed + neighborhood jitter). Sky capsules and dust motes are a
 * low-res overlay that only changes `phase` (same wind axis). Fog stays baked.
 * Gallery PNGs are samples, not a tileset to copy.
 *
 * The tilemap layer still exists for physics; it is hidden. This texture is
 * what the player sees, revealed by the visibility mask.
 */

import Phaser from 'phaser';
import {
  SKY_REPAINT_MS,
  SKY_SLIDE_PERIOD_MS,
  SKY_TRAVEL_SCALE,
} from '@/generation/atmosphere';
import {
  LIVE_PAINT_PX_PER_TILE,
  bakeGround,
  compositeStaticPaint,
  paintSkyShade,
  skyOverlaySize,
  type ClusterPulseField,
  type ContaminationDrawStyle,
} from '@/generation/preview-paint';
import { paintClusterBreath } from '@/systems/cluster-pulse';
import type { AtmosphereField, RuinedMask } from '@/generation/types';

export class RiftSurfacePainter {
  private scene: Phaser.Scene | null = null;
  private field: AtmosphereField | null = null;
  private worldWidth = 0;
  private worldHeight = 0;
  private paintWidth = 0;
  private paintHeight = 0;
  private paintTile = LIVE_PAINT_PX_PER_TILE;

  private groundCanvas: Phaser.Textures.CanvasTexture | null = null;
  private dimCanvas: Phaser.Textures.CanvasTexture | null = null;
  private rimCanvas: Phaser.Textures.CanvasTexture | null = null;
  private dimImage: ImageData | null = null;
  private rimImage: ImageData | null = null;
  private dimRgba: Uint8Array | null = null;
  private rimRgba: Uint8Array | null = null;

  private sprites: Phaser.GameObjects.Image[] = [];
  private textureKeys: string[] = [];
  private lastPaintAt = Number.NEGATIVE_INFINITY;
  private elapsedMs = 0;

  private clusterBreathCanvas: Phaser.Textures.CanvasTexture | null = null;
  private clusterBreathImage: ImageData | null = null;
  private pulseField: ClusterPulseField | null = null;

  mount(
    scene: Phaser.Scene,
    ruins: RuinedMask,
    key: string,
    depth: number,
    opts?: { contaminationDraw?: ContaminationDrawStyle; liveClusterBreath?: boolean },
  ): void {
    this.release();
    this.scene = scene;

    const worldTile = ruins.tileMap.tileSize;
    this.worldWidth = ruins.outline.cols * worldTile;
    this.worldHeight = ruins.outline.rows * worldTile;
    this.field = ruins.atmosphere ?? null;
    this.paintTile = LIVE_PAINT_PX_PER_TILE;

    const draw = opts?.contaminationDraw ?? 'cluster';
    const liveBreath = opts?.liveClusterBreath === true && draw === 'cluster';
    const ground = bakeGround(ruins, this.paintTile, draw, liveBreath);
    this.paintWidth = ground.width;
    this.paintHeight = ground.height;
    const work = new Float32Array(ground.raw.length);
    const rgba = new Uint8Array(ground.width * ground.height * 4);
    compositeStaticPaint(ground, work, rgba);

    this.groundCanvas = this.makeCanvas(scene, key, ground.width, ground.height);
    const groundImage = this.groundCanvas.getContext().createImageData(ground.width, ground.height);
    groundImage.data.set(rgba);
    this.groundCanvas.getContext().putImageData(groundImage, 0, 0);
    this.groundCanvas.refresh();

    const groundSprite = scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(depth);
    groundSprite.setDisplaySize(this.worldWidth, this.worldHeight);
    this.sprites.push(groundSprite);

    this.elapsedMs = 0;
    this.lastPaintAt = Number.NEGATIVE_INFINITY;
    this.pulseField = null;
    this.clusterBreathCanvas = null;
    this.clusterBreathImage = null;

    if (liveBreath && ground.clusterPulse && ground.clusterPulse.organisms.length > 0) {
      this.pulseField = ground.clusterPulse;
      const breathKey = `${key}-cluster-breath`;
      this.clusterBreathCanvas = this.makeCanvas(scene, breathKey, ground.width, ground.height);
      this.clusterBreathCanvas.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.clusterBreathImage = this.clusterBreathCanvas
        .getContext()
        .createImageData(ground.width, ground.height);
      const breathSprite = scene.add.image(0, 0, breathKey).setOrigin(0, 0).setDepth(depth + 0.05);
      breathSprite.setDisplaySize(this.worldWidth, this.worldHeight);
      this.sprites.push(breathSprite);
    }

    if (this.field) {
      this.elapsedMs = (((this.field.phase % 1) + 1) % 1) * SKY_SLIDE_PERIOD_MS;
      const overlay = skyOverlaySize(this.paintWidth, this.paintHeight, this.paintTile);
      const dimKey = `${key}-sky-dim`;
      const rimKey = `${key}-sky-rim`;
      this.dimCanvas = this.makeCanvas(scene, dimKey, overlay.width, overlay.height);
      this.rimCanvas = this.makeCanvas(scene, rimKey, overlay.width, overlay.height);
      this.linearFilter(this.dimCanvas);
      this.linearFilter(this.rimCanvas);
      this.dimImage = this.dimCanvas.getContext().createImageData(overlay.width, overlay.height);
      this.rimImage = this.rimCanvas.getContext().createImageData(overlay.width, overlay.height);
      this.dimRgba = new Uint8Array(overlay.width * overlay.height * 4);
      this.rimRgba = new Uint8Array(overlay.width * overlay.height * 4);

      const dimSprite = scene.add.image(0, 0, dimKey).setOrigin(0, 0).setDepth(depth + 0.1);
      dimSprite.setDisplaySize(this.worldWidth, this.worldHeight);
      dimSprite.setBlendMode(Phaser.BlendModes.MULTIPLY);
      this.sprites.push(dimSprite);

      const rimSprite = scene.add.image(0, 0, rimKey).setOrigin(0, 0).setDepth(depth + 0.2);
      rimSprite.setDisplaySize(this.worldWidth, this.worldHeight);
      rimSprite.setBlendMode(Phaser.BlendModes.ADD);
      this.sprites.push(rimSprite);

      this.paintSky(this.field.phase ?? 0.5, true);
    }
    this.paintPulse();
  }

  update(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.paintPulse();
    if (!this.field) return;
    const phase = (this.elapsedMs / SKY_SLIDE_PERIOD_MS) % 1;
    this.paintSky(phase, false);
  }

  destroy(): void {
    this.release();
  }

  private paintPulse(): void {
    if (!this.clusterBreathCanvas || !this.clusterBreathImage || !this.pulseField) return;
    paintClusterBreath(
      this.clusterBreathImage.data,
      this.clusterBreathImage.width,
      this.clusterBreathImage.height,
      this.pulseField,
      this.elapsedMs,
    );
    this.clusterBreathCanvas.getContext().putImageData(this.clusterBreathImage, 0, 0);
    this.clusterBreathCanvas.refresh();
  }

  private paintSky(phase: number, force: boolean): void {
    if (!this.field || !this.dimCanvas || !this.rimCanvas || !this.dimImage || !this.rimImage) return;
    if (!this.dimRgba || !this.rimRgba) return;
    if (!force && this.elapsedMs - this.lastPaintAt < SKY_REPAINT_MS) return;
    this.lastPaintAt = this.elapsedMs;
    paintSkyShade(
      this.field,
      this.paintWidth,
      this.paintHeight,
      this.paintTile,
      phase,
      SKY_TRAVEL_SCALE,
      this.dimRgba,
      this.rimRgba,
    );
    this.dimImage.data.set(this.dimRgba);
    this.rimImage.data.set(this.rimRgba);
    this.dimCanvas.getContext().putImageData(this.dimImage, 0, 0);
    this.rimCanvas.getContext().putImageData(this.rimImage, 0, 0);
    this.dimCanvas.refresh();
    this.rimCanvas.refresh();
  }

  private makeCanvas(
    scene: Phaser.Scene,
    key: string,
    width: number,
    height: number,
  ): Phaser.Textures.CanvasTexture {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const canvas = scene.textures.createCanvas(key, width, height);
    if (!canvas) throw new Error(`ProceduralSurface: could not create canvas texture '${key}'`);
    this.textureKeys.push(key);
    return canvas;
  }

  private linearFilter(canvas: Phaser.Textures.CanvasTexture): void {
    canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  private release(): void {
    for (const sprite of this.sprites) sprite.destroy();
    this.sprites = [];
    const scene = this.scene;
    if (scene) {
      for (const key of this.textureKeys) {
        if (scene.textures.exists(key)) scene.textures.remove(key);
      }
    }
    this.textureKeys = [];
    this.scene = null;
    this.field = null;
    this.pulseField = null;
    this.clusterBreathCanvas = null;
    this.clusterBreathImage = null;
    this.groundCanvas = null;
    this.dimCanvas = null;
    this.rimCanvas = null;
    this.dimImage = null;
    this.rimImage = null;
    this.dimRgba = null;
    this.rimRgba = null;
  }
}
