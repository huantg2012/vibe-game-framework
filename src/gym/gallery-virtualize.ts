/**
 * Gallery hall layout + attach keep selection. Pure: no Phaser, no attach.
 * Scene and `check:gallery-catalog` must call this. Do not re-slice in the scene.
 *
 * Invariant: every cell whose AABB intersects the camera view is in keep,
 * unless it is the inspect specimen (inspect visual occupies that cell).
 * Eviction is only allowed outside the view. Contract: iteration-4 §4 / DEC-086.
 */

import type { CoverageId, PortfolioId } from '@/generated/contamination-lexicon-data';
import type { GallerySpecimen } from '@/gym/lexicon-gallery-catalog';

/** Logical resolution. Must stay aligned with `src/config/game-config.ts`. */
export const GALLERY_VIEW_WIDTH = 960;
export const GALLERY_VIEW_HEIGHT = 640;

export const GALLERY_CELL_SIZE: Record<PortfolioId, number> = {
  jia: 96,
  yi: 96,
  bing: 120,
  ding: 192,
};

/** Browse-state attach cap. Sole copy — do not duplicate 8/12/12/8. */
export const GALLERY_ATTACH_CAP: Record<PortfolioId, number> = {
  jia: 48,
  yi: 48,
  bing: 40,
  ding: 24,
};

/** Per-hall wheel floor for the gallery lesson only. Map lesson keeps 0.12. */
export const GALLERY_ZOOM_MIN: Record<PortfolioId, number> = {
  jia: 1.1,
  yi: 0.12,
  bing: 0.7,
  ding: 0.55,
};

export const GALLERY_START_ZOOM: Record<PortfolioId, number> = {
  jia: 1.25,
  yi: 1.25,
  bing: 1,
  ding: 0.7,
};

const COVERAGES: readonly CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];

export interface GalleryRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface GalleryHallBounds {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GalleryLayoutCell {
  readonly specimen: GallerySpecimen;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

export interface GalleryHallBand {
  readonly coverage: CoverageId;
  readonly x: number;
  readonly y: number;
}

export interface GalleryHallLayout {
  readonly cells: readonly GalleryLayoutCell[];
  readonly bands: readonly GalleryHallBand[];
  readonly bounds: GalleryHallBounds;
}

export interface GalleryKeepInput {
  readonly cells: readonly GalleryLayoutCell[];
  readonly view: GalleryRect;
  readonly portfolio: PortfolioId;
  readonly prevKeepKeys: ReadonlySet<string>;
  readonly inspectKey?: string | null;
}

export interface GalleryKeepResult {
  /** Hall-visual keys to attach. Never includes `inspectKey`. May exceed cap if overCap. */
  readonly keepKeys: readonly string[];
  /** Keys whose AABB intersects `view`, including the inspect cell. */
  readonly intersectingKeys: readonly string[];
  /** True when intersecting-minus-inspect is already larger than the cap. */
  readonly overCap: boolean;
}

export function galleryViewFromScroll(scrollX: number, scrollY: number, zoom: number): GalleryRect {
  return {
    x: scrollX,
    y: scrollY,
    width: GALLERY_VIEW_WIDTH / zoom,
    height: GALLERY_VIEW_HEIGHT / zoom,
  };
}

export function clampGalleryScroll(
  scrollX: number,
  scrollY: number,
  zoom: number,
  bounds: GalleryHallBounds,
): { readonly scrollX: number; readonly scrollY: number } {
  const viewW = GALLERY_VIEW_WIDTH / zoom;
  const viewH = GALLERY_VIEW_HEIGHT / zoom;
  const minX = bounds.x;
  const minY = bounds.y;
  const maxX = bounds.x + bounds.w - viewW;
  const maxY = bounds.y + bounds.h - viewH;
  return {
    scrollX: maxX < minX ? minX : Math.min(maxX, Math.max(minX, scrollX)),
    scrollY: maxY < minY ? minY : Math.min(maxY, Math.max(minY, scrollY)),
  };
}

export function galleryViewFromCenter(
  centerX: number,
  centerY: number,
  zoom: number,
  bounds?: GalleryHallBounds,
): GalleryRect {
  const viewW = GALLERY_VIEW_WIDTH / zoom;
  const viewH = GALLERY_VIEW_HEIGHT / zoom;
  let scrollX = centerX - viewW * 0.5;
  let scrollY = centerY - viewH * 0.5;
  if (bounds) {
    const clamped = clampGalleryScroll(scrollX, scrollY, zoom, bounds);
    scrollX = clamped.scrollX;
    scrollY = clamped.scrollY;
  }
  return galleryViewFromScroll(scrollX, scrollY, zoom);
}

export function shiftGalleryView(view: GalleryRect, dx: number, dy: number): GalleryRect {
  return { x: view.x + dx, y: view.y + dy, width: view.width, height: view.height };
}

export function cellAabb(cell: { readonly x: number; readonly y: number; readonly size: number }): GalleryRect {
  const half = cell.size * 0.5;
  return { x: cell.x - half, y: cell.y - half, width: cell.size, height: cell.size };
}

/** Inclusive edge contact counts as intersecting (matches the old hall filter). */
export function rectsIntersect(a: GalleryRect, b: GalleryRect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

export function rectContains(outer: GalleryRect, inner: GalleryRect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function cellIntersectsView(
  cell: { readonly x: number; readonly y: number; readonly size: number },
  view: GalleryRect,
): boolean {
  return rectsIntersect(cellAabb(cell), view);
}

export function layoutGalleryHall(
  specimens: readonly GallerySpecimen[],
  portfolio: PortfolioId,
): GalleryHallLayout {
  const cellSize = GALLERY_CELL_SIZE[portfolio];
  const cols = Math.max(4, Math.min(10, Math.round(GALLERY_VIEW_WIDTH / cellSize)));
  const rowGap = cellSize * 0.85;
  const bandGap = cellSize * 1.45;
  const originX = cellSize;
  const originY = cellSize * 0.7;
  const cells: GalleryLayoutCell[] = [];
  const bands: GalleryHallBand[] = [];
  let y = originY;
  let maxX = originX + cellSize;
  let maxY = originY + cellSize;
  for (const coverage of COVERAGES) {
    const rows = specimens.filter((row) => row.form.coverage === coverage);
    if (rows.length === 0) continue;
    bands.push({ coverage, x: originX, y: y - cellSize * 0.42 });
    let col = 0;
    let x = originX;
    for (const specimen of rows) {
      if (col >= cols) {
        col = 0;
        x = originX;
        y += cellSize + rowGap;
      }
      const cx = x + cellSize * 0.5;
      const cy = y + cellSize * 0.5;
      cells.push({ specimen, x: cx, y: cy, size: cellSize });
      maxX = Math.max(maxX, x + cellSize);
      maxY = Math.max(maxY, y + cellSize);
      x += cellSize;
      col += 1;
    }
    y += cellSize + bandGap;
  }
  const pad = cellSize * 1.5;
  const captionPad = cellSize * 0.95;
  return {
    cells,
    bands,
    bounds: { x: 0, y: 0, w: maxX + pad, h: maxY + pad + captionPad },
  };
}

export function selectGalleryKeep(input: GalleryKeepInput): GalleryKeepResult {
  const { cells, view, portfolio, prevKeepKeys } = input;
  const inspectKey = input.inspectKey ?? null;
  const cap = GALLERY_ATTACH_CAP[portfolio];
  const pad = GALLERY_CELL_SIZE[portfolio];
  const padded: GalleryRect = {
    x: view.x - pad,
    y: view.y - pad,
    width: view.width + pad * 2,
    height: view.height + pad * 2,
  };
  const midX = view.x + view.width * 0.5;
  const midY = view.y + view.height * 0.5;

  const intersecting: GalleryLayoutCell[] = [];
  const band: GalleryLayoutCell[] = [];
  for (const cell of cells) {
    const key = cell.specimen.visualKey;
    if (cellIntersectsView(cell, view)) intersecting.push(cell);
    else if (key !== inspectKey && cellIntersectsView(cell, padded)) band.push(cell);
  }

  const intersectingKeys = intersecting.map((cell) => cell.specimen.visualKey);
  const keepCells = intersecting.filter((cell) => cell.specimen.visualKey !== inspectKey);
  const overCap = keepCells.length > cap;

  if (!overCap) {
    const remaining = cap - keepCells.length;
    band.sort((a, b) => {
      const aPrev = prevKeepKeys.has(a.specimen.visualKey) ? 0 : 1;
      const bPrev = prevKeepKeys.has(b.specimen.visualKey) ? 0 : 1;
      if (aPrev !== bPrev) return aPrev - bPrev;
      return dist2(a.x, a.y, midX, midY) - dist2(b.x, b.y, midX, midY);
    });
    for (let i = 0; i < remaining && i < band.length; i += 1) {
      const extra = band[i];
      if (extra) keepCells.push(extra);
    }
  }

  return {
    keepKeys: keepCells.map((cell) => cell.specimen.visualKey),
    intersectingKeys,
    overCap,
  };
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
