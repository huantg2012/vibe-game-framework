/** Prepared material pixels only. World geometry, erosion and lighting remain native. */
import { PAINTED_MATERIALS, type PaintedMaterialFamily } from './generated-materials';

export interface PaintedMaterial {
  readonly width: number;
  readonly height: number;
  /** Shared cached pixels: consumers must only read this buffer. */
  readonly pixels: Uint8ClampedArray;
  readonly worldSize: number;
  readonly source: string;
  /** Artist-selected source patches, normalized to the unmodified source. */
  readonly regions?:Readonly<Record<'skin'|'cleaved'|'loose',Readonly<{x:number;y:number;width:number;height:number}>>>;
}

// The CSV admits exactly three unique sources. Pending requests occupy the same
// entry as completed pixels, so overlapping rebuilds never decode a source twice.
const materials = new Map<string, Promise<PaintedMaterial>>();

async function prepareMaterial(definition: typeof PAINTED_MATERIALS[number]): Promise<PaintedMaterial> {
  let image: HTMLImageElement | undefined, canvas: HTMLCanvasElement | undefined;
  let stage = 'decode';
  try {
    image = new Image();
    image.decoding = 'async';
    image.src = definition.source;
    await image.decode();
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
    throw new Error(`R100 painted material ${definition.family} (${definition.source}): ${stage} failed: ${reason}`);
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
  const request = prepareMaterial(definition).catch(error => {
    materials.delete(definition.source);
    throw error;
  });
  materials.set(definition.source, request);
  return request;
}
