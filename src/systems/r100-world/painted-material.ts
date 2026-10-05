/** Prepared material pixels only. World geometry, erosion and lighting remain native. */
import { PAINTED_MATERIALS, type PaintedMaterialFamily } from '@/generated/r100-materials';
import type { NativeVolumeFamily } from '@/generation/world-study/native-volume-geometry';

export interface PaintedSurface {
  readonly width: number;
  readonly height: number;
  /** Shared cached pixels: consumers must only read this buffer. */
  readonly pixels: Uint8ClampedArray;
  readonly worldSize: number;
  readonly source: string;
  /** Artist-selected source patches, normalized to the unmodified source. */
  readonly regions?:Readonly<Record<'skin'|'cleaved'|'loose',Readonly<{x:number;y:number;width:number;height:number}>>>;
}

export interface PaintedMaterial extends PaintedSurface {
  /** Frozen world identity, attached only to prepared revision 4 material. */
  readonly appearance?: import('@/generation/world-study/r100-world-appearance').R100WorldAppearance;
  /** A separate compact skin/fracture atlas. Never used for walkable ground. */
  readonly solid?: PaintedSurface & {readonly skinRoughness:number;readonly cutRoughness:number;readonly gain:number;readonly cutGain:number};
  /** Mixed formations retain their own source. This is a finite dependency set
   * for the active world, never a palette substitution by world id. */
  readonly families?: Readonly<Partial<Record<NativeVolumeFamily, PaintedMaterial>>>;
}
// Three family requests each own two immutable 512px buffers. Overlapping
// rebuilds share one pending request; a failed pair can be retried as a pair.
const materials = new Map<string, Promise<PaintedMaterial>>();

type SurfaceDefinition={readonly source:string;readonly logical_pixels:number;readonly world_size:number;readonly regions:NonNullable<PaintedSurface['regions']>};
async function prepareMaterial(definition: SurfaceDefinition, family:string): Promise<PaintedSurface> {
  let image: HTMLImageElement | undefined, canvas: HTMLCanvasElement | undefined;
  let stage = 'decode';
  try {
    image = new Image();
    image.decoding = 'async';
    image.src = definition.source;
    await image.decode();
    // Mixed worlds decode several atoms together. Give each rasterization its
    // own task so concurrent image promises cannot combine into one long task.
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('decoded image has no pixels');
    stage = 'prepare native pixels';
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = definition.logical_pixels;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('2D canvas context is unavailable');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return { width: canvas.width, height: canvas.height, pixels, worldSize: definition.world_size, source: definition.source,regions:definition.regions };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`R100 painted material ${family} (${definition.source}): ${stage} failed: ${reason}`);
  } finally {
    // Retain only native CPU pixels, never the decoded original or scratch canvas.
    if (canvas) { canvas.width = 1; canvas.height = 1; }
    image?.removeAttribute('src');
  }
}

export function loadPaintedMaterial(family: PaintedMaterialFamily): Promise<PaintedMaterial> {
  const definition = PAINTED_MATERIALS.find(value => value.family === family);
  if (!definition) return Promise.reject(new Error(`Unknown R100 painted material family: ${family}`));
  const existing = materials.get(definition.source);
  if (existing) return existing;
  const request = Promise.all([prepareMaterial(definition,family),prepareMaterial(definition.solid,`${family} solid`)]).then(([ground,solid])=>({
    ...ground,solid:{...solid,skinRoughness:definition.solid.skinRoughness,cutRoughness:definition.solid.cutRoughness,gain:definition.solid.gain,cutGain:definition.solid.cutGain},
  })).catch(error => {
    materials.delete(definition.source);
    throw error;
  });
  materials.set(definition.source, request);
  return request;
}
