import { SeaVolumeGeometry, type SeaVolumeGeometryConfig, type SeaVolumeFrame } from './sea-geometry';
import { SeaRaster, type SeaMaterialPixels } from './sea-raster';

export { seaFrontYAt, SEA_SURFACE } from './sea-geometry';
export type { SeaColumn, SeaVolumeFrame } from './sea-geometry';

export interface SeaVolumeConfig extends SeaVolumeGeometryConfig {
  pixelStep?: number;
  surface?: HTMLImageElement;
}
export interface SeaVolumeLayers {
  readonly width: number; readonly height: number; readonly pixelStep: number;
  /** ImageData-compatible RGBA words; 0 means no fragment. */
  readonly bodyPixels: Uint32Array;
  /** q = sqrt(1-k*k)*worldY + k*worldZ; larger means nearer, empty = -Infinity. */
  readonly bodyDepth: Float32Array;
  /** 0 empty, 1 top, 2 rolled side/abdomen, 3 underside. */
  readonly bodySurface: Uint8Array;
  readonly fallPixels: Uint32Array;
  readonly fallDepth: Float32Array;
}
export interface SeaVolumeSnapshot {
  geometryRevision: number; elapsedMs: number; renderMs: number;
  projection: { compression: number; heightProjection: number; depthNear: 'larger' };
  raster: { width: number; height: number; pixelStep: number; bodyCoveredPixels: number; fallCoveredPixels: number };
  body: { vertices: number; triangles: number; frontMin: number; frontMax: number;
    topMin: number; topMax: number; bottomMin: number; bottomMax: number; thicknessMin: number; thicknessMax: number };
  source: { x: number; y: number; bottom: number; top: number; frontDistance: number;
    projectedY: number; collarPenetration: number; sheetCount: number };
  contact: { shape: 'ellipse'; x: number; y: number; width: number; depth: number; lowestZ: number; active: boolean };
  curtain: { extension: number; active: boolean; phase: string; vertices: number; triangles: number };
}

/** DEV-only CPU geometry renderer. It has no Phaser/actor/visibility dependencies.
 * The returned layer buffers are reused. Consumers must read them synchronously
 * before the next render; keep a copy if they need a historic frame. */
export class SeaVolumeRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly image: ImageData;
  private readonly imageWords: Uint32Array;
  private readonly geometry: SeaVolumeGeometry;
  private readonly raster: SeaRaster;
  private readonly layers: SeaVolumeLayers;
  private readonly frame: SeaVolumeFrame = { elapsedMs: 0, curtain: { extension: 0, active: false, phase: 'quiet' } };
  private renderMs = 0;
  private disposed = false;

  constructor(private readonly config: Readonly<SeaVolumeConfig>) {
    const pixelStep = config.pixelStep ?? 2;
    if (!Number.isFinite(pixelStep) || pixelStep < 1 || pixelStep > 4) throw new Error('Sea pixelStep must be between 1 and 4 world pixels');
    this.geometry = new SeaVolumeGeometry(config);
    this.raster = new SeaRaster({ width: config.width, height: config.height, compression: config.compression,
      heightProjection: config.heightProjection, pixelStep }, config.surface ? readMaterial(config.surface) : undefined);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.raster.width; this.canvas.height = this.raster.height;
    const context = this.canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Cannot create the sea volume output canvas');
    this.context = context; this.image = context.createImageData(this.canvas.width, this.canvas.height);
    this.imageWords = new Uint32Array(this.image.data.buffer);
    this.layers = { width: this.raster.width, height: this.raster.height, pixelStep,
      bodyPixels: this.raster.body.pixels, bodyDepth: this.raster.body.depth, bodySurface: this.raster.body.surface,
      fallPixels: this.raster.fall.pixels, fallDepth: this.raster.fall.depth };
    this.render(this.frame);
  }

  render(frame: Readonly<SeaVolumeFrame>): void {
    if (this.disposed) return;
    const begin = performance.now();
    this.frame.elapsedMs = frame.elapsedMs;
    this.frame.curtain.extension = Math.max(0, Math.min(1, frame.curtain.extension));
    this.frame.curtain.active = frame.curtain.active; this.frame.curtain.phase = frame.curtain.phase;
    this.geometry.build(this.frame); this.raster.render(this.geometry.body, this.geometry.fall, frame.elapsedMs, frame.curtain.phase === 'retracting');
    const { bodyPixels, bodyDepth, fallPixels, fallDepth } = this.layers;
    for (let i = 0; i < this.imageWords.length; i++) {
      this.imageWords[i] = fallDepth[i]! > bodyDepth[i]! ? fallPixels[i]! : bodyPixels[i]!;
    }
    this.context.putImageData(this.image, 0, 0);
    this.renderMs = performance.now() - begin;
  }

  getLayers(): SeaVolumeLayers { return this.layers; }
  sampleColumn(x: number, y: number) { return this.geometry.sampleColumn(x, y); }

  getSnapshot(): SeaVolumeSnapshot {
    const g = this.geometry, c = this.config, s = c.source;
    let bodyCoveredPixels = 0, fallCoveredPixels = 0;
    for (let i = 0; i < this.layers.bodyPixels.length; i++) {
      if (this.layers.bodyPixels[i]) bodyCoveredPixels++;
      if (this.layers.fallPixels[i]) fallCoveredPixels++;
    }
    return {
      geometryRevision: g.revision, elapsedMs: this.frame.elapsedMs, renderMs: this.renderMs,
      projection: { compression: c.compression, heightProjection: c.heightProjection, depthNear: 'larger' },
      raster: { width: this.layers.width, height: this.layers.height, pixelStep: this.layers.pixelStep, bodyCoveredPixels, fallCoveredPixels },
      body: { vertices: g.body.vertexCount, triangles: g.body.triangleCount, frontMin: g.frontMin, frontMax: g.frontMax,
        topMin: g.topMin, topMax: g.topMax, bottomMin: g.bottomMin, bottomMax: g.bottomMax, thicknessMin: g.thicknessMin, thicknessMax: g.thicknessMax },
      source: { x: s.x, y: s.y, bottom: g.sourceBottom, top: g.sourceTop, frontDistance: g.frontAt(s.x) - s.y,
        projectedY: s.y - g.sourceBottom * c.heightProjection, collarPenetration: 13, sheetCount: g.fall.vertexCount ? 1 : 0 },
      contact: { shape: 'ellipse', x: s.x, y: s.y, width: s.width, depth: s.depth, lowestZ: g.fallLowestZ, active: this.frame.curtain.active },
      curtain: { ...this.frame.curtain, vertices: g.fall.vertexCount, triangles: g.fall.triangleCount },
    };
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true; this.raster.destroy();
    this.canvas.width = 1; this.canvas.height = 1;
  }
}

function readMaterial(surface: HTMLImageElement): SeaMaterialPixels {
  const width = Math.min(512, surface.naturalWidth || surface.width);
  const height = Math.max(1, Math.round((surface.naturalHeight || surface.height) * width / (surface.naturalWidth || surface.width)));
  if (!width || !height) throw new Error('Sea material must be loaded before creating the volume');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Cannot read the sea material');
  context.imageSmoothingEnabled = false;
  context.drawImage(surface, 0, 0, width, height);
  return { width, height, data: context.getImageData(0, 0, width, height).data };
}
