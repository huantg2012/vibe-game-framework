import Phaser from 'phaser';
import type { GeneratedRiftLayout } from '@/generation/types';
import { TileType } from '@/types/game-types';
import { grain, makeSeabed } from './ground';
import { makeDatumReef } from './datum-reef';
import { SeaVolumeRenderer } from './sea-volume';
import { compositeSeaVolume } from './volume-composite';
import type { WaterCurtainFrame } from './water-curtain';

export interface SeaPresentationConfig {
  seed: number; compression: number; heightProjection: number;
  seaFrontY: number; seaBottomHeight: number; seaTopHeight: number;
  curtain: { x: number; y: number; width: number; depth: number };
  reef: { x: number; y: number; height: number };
}
export interface SeaPresentationSample {
  elapsedMs: number;
  player: { x: number; y: number };
  curtain: Readonly<WaterCurtainFrame>;
  reefVisibility: number;
}
let sequence = 0;

/** R2: projected, moving water geometry. No baked side band and no edge waterfall. */
export class SuspendedSeaPresentation {
  private readonly id = `spatial-sea-${sequence++}`;
  private readonly images: Phaser.GameObjects.Image[] = [];
  private readonly keys: string[] = [];
  private readonly ocean: Phaser.Textures.CanvasTexture;
  private readonly floorLight: Phaser.Textures.CanvasTexture;
  private readonly volume: SeaVolumeRenderer;
  private readonly oceanPixels: ImageData;
  private readonly reefImage: Phaser.GameObjects.Image;
  private readonly width: number;
  private readonly height: number;
  private lastPaint = -Infinity;
  private disposed = false;

  constructor(private readonly scene: Phaser.Scene, private readonly layout: GeneratedRiftLayout, private readonly config: SeaPresentationConfig,
    private readonly revealTerrain: (image: Phaser.GameObjects.Image, visibility: number) => void) {
    this.width = layout.tileMap.cols * layout.tileMap.tileSize;
    this.height = layout.tileMap.rows * layout.tileMap.tileSize + 64;
    const bed = makeSeabed(layout.tileMap, config.seed, config.heightProjection);
    const groundKey = `${this.id}-ground`;
    scene.textures.addCanvas(groundKey, bed); this.keys.push(groundKey);
    this.images.push(scene.add.image(0, 0, groundKey).setOrigin(0).setDepth(.4));
    const reef = makeDatumReef(config.heightProjection, config.compression, config.reef);
    const reefKey = `${this.id}-reef`;
    scene.textures.addCanvas(reefKey, reef.canvas); this.keys.push(reefKey);
    this.reefImage = scene.add.image(reef.footX - reef.originX, reef.footY - reef.originY, reefKey).setOrigin(0).setDepth(24);
    this.images.push(this.reefImage);
    const surface = scene.textures.exists('spatial-sea-material')
      ? scene.textures.get('spatial-sea-material').getSourceImage() as HTMLImageElement : undefined;
    this.volume = new SeaVolumeRenderer({ seed: config.seed, width: this.width, height: this.height,
      compression: config.compression, heightProjection: config.heightProjection,
      frontY: config.seaFrontY, bottomHeight: config.seaBottomHeight, topHeight: config.seaTopHeight,
      source: config.curtain, pixelStep: 2, surface });
    this.floorLight = this.layer('floor-light', 4);
    // It owns water only. All floor/actor/loot pixels underneath still use the original fog at 50.
    this.ocean = this.layer('ocean', 51);
    this.oceanPixels = this.ocean.getContext().createImageData(this.ocean.width, this.ocean.height);
  }

  private layer(name: string, depth: number): Phaser.Textures.CanvasTexture {
    const key = `${this.id}-${name}`;
    const texture = this.scene.textures.createCanvas(key, Math.ceil(this.width / 2), Math.ceil(this.height / 2));
    if (!texture) throw new Error(`Cannot allocate ${key}`);
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.images.push(this.scene.add.image(0, 0, key).setOrigin(0).setScale(2).setDepth(depth));
    this.keys.push(key); return texture;
  }

  setReefDepth(depth: number): void { this.reefImage.setDepth(depth); }
  sampleColumn(x: number, y: number) { return this.volume.sampleColumn(x, y); }
  snapshot() { return this.volume.getSnapshot(); }
  coversProjectedPoint(x: number, y: number): boolean {
    const layer = this.volume.getLayers();
    const col = Math.floor(x / layer.pixelStep), row = Math.floor(y / layer.pixelStep);
    return col >= 0 && row >= 0 && col < layer.width && row < layer.height && (layer.bodyPixels[row * layer.width + col]! >>> 24) > 0;
  }

  update(sample: SeaPresentationSample): void {
    if (this.disposed) return;
    this.revealTerrain(this.reefImage, sample.reefVisibility);
    if (sample.elapsedMs - this.lastPaint < 16) return;
    this.lastPaint = sample.elapsedMs;
    this.volume.render({ elapsedMs: sample.elapsedMs, curtain: sample.curtain });
    compositeSeaVolume(this.volume.getLayers(), this.oceanPixels, {
      x: sample.player.x, groundY: sample.player.y, compression: this.config.compression,
      elapsedMs: sample.elapsedMs, enabled: true,
    });
    this.ocean.getContext().putImageData(this.oceanPixels, 0, 0); this.ocean.refresh();
    this.paintFloor(sample);
  }

  private paintFloor(sample: SeaPresentationSample): void {
    const ctx = this.floorLight.getContext(), time = sample.elapsedMs / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.floorLight.width, this.floorLight.height);
    ctx.imageSmoothingEnabled = false; ctx.setTransform(.5, 0, 0, .5, 0, 0);
    const { tileMap: map } = this.layout, tile = map.tileSize;
    const onFloor = (x: number, y: number) => {
      const col = Math.floor(x / tile), row = Math.floor(y / tile);
      return col >= 0 && row >= 0 && col < map.cols && row < map.rows && map.tiles[row]![col] === TileType.FLOOR;
    };
    // Coherent refracted ribbons drift across the bed. They remain below the real vision mask.
    for (let strand = 0; strand < 26; strand++) {
      const baseX = grain(strand, 7, this.config.seed) * this.width;
      const baseY = grain(strand, 17, this.config.seed) * this.config.seaFrontY;
      const reach = 24 + grain(strand, 31, this.config.seed) * 70;
      for (let piece = 0; piece < 14; piece++) {
        const u = piece / 13, x = baseX + u * reach + Math.sin(time * .37 + strand) * 12;
        const y = baseY + Math.sin(u * 2.5 + strand * .8 + time * .45) * 10;
        if (!onFloor(x, y)) continue;
        const light = Math.max(0, Math.sin(time * .8 + strand * 1.7)) * .16;
        ctx.fillStyle = `rgba(91,150,146,${light})`;
        ctx.fillRect(Math.floor(x / 2) * 2, Math.floor(y / 2) * 2, 6, 2);
      }
    }
    const c = this.config.curtain, extension = sample.curtain.extension;
    // The source's pressure gathers a ground shadow before it descends; this is not damage yet.
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, c.depth / c.width);
    const radius = c.width * (.34 + extension * .16);
    const shadow = ctx.createRadialGradient(0, 0, radius * .2, 0, 0, radius + 15);
    shadow.addColorStop(0, `rgba(3,14,18,${.22 + extension * .36})`); shadow.addColorStop(1, 'rgba(3,14,18,0)');
    ctx.fillStyle = shadow; ctx.fillRect(-radius - 16, -radius - 16, radius * 2 + 32, radius * 2 + 32);
    ctx.restore();
    if (sample.curtain.active) {
      // The ellipse matches the CSV contact rule. Foam is restricted to actual contact.
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, c.depth / c.width);
      ctx.beginPath(); ctx.ellipse(0, 0, c.width / 2, c.width / 2, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(42,91,100,.38)'; ctx.fillRect(-c.width / 2, -c.width / 2, c.width, c.width);
      for (let i = 0; i < 120; i++) {
        const angle = grain(i, 79, this.config.seed) * Math.PI * 2;
        const progress = (time * 1.4 + grain(i, 13, this.config.seed)) % 1;
        const r = c.width / 2 * Math.sqrt(progress);
        ctx.fillStyle = `rgba(168,187,169,${(1 - progress) * .65})`;
        ctx.fillRect(Math.floor(Math.cos(angle) * r / 2) * 2, Math.floor(Math.sin(angle) * r / 2) * 2, 3 + i % 3, 2);
      }
      ctx.restore();
    }
    // A broken cast shadow connects the tall remnant to its actual ground anchor.
    const reef = this.config.reef;
    ctx.fillStyle = 'rgba(3,11,14,.23)'; ctx.beginPath();
    ctx.moveTo(reef.x - 13, reef.y + 8); ctx.lineTo(reef.x + 9, reef.y + 10);
    ctx.lineTo(reef.x + 94, reef.y + 28); ctx.lineTo(reef.x + 58, reef.y + 31); ctx.closePath(); ctx.fill();
    this.floorLight.refresh();
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true; this.volume.destroy();
    for (const image of this.images) image.destroy();
    for (const key of this.keys) if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }
}
