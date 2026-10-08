import type { NativeVolumeFamily, NativeVolumeMesh } from '@/generation/world-study/native-volume-geometry';
import type { PaintedMaterial, PaintedSurface } from './painted-material';

type Region = 'skin' | 'cleaved' | 'loose';

/** One contiguous source window. A single piece never crosses a repeat seam. */
export interface OrganizationSampleWindow {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly sourceWidth: number;
  readonly minU: number;
  readonly minV: number;
  readonly scale: number;
  readonly offsetU: number;
  readonly offsetV: number;
}

export interface OrganizationSurfaceWindows {
  readonly ground: Readonly<Record<Region, OrganizationSampleWindow>>;
  readonly solid?: Readonly<Record<Region, OrganizationSampleWindow>>;
}

/** Preparation-worker work only; callers opt in through materialOrganization. */
export function prepareOrganizationSurfaceWindows(
  meshes: readonly NativeVolumeMesh[],
  primaryFamily: NativeVolumeFamily,
  painting: PaintedMaterial,
): ReadonlyMap<number, OrganizationSurfaceWindows> {
  const result = new Map<number, OrganizationSurfaceWindows>();
  for (const mesh of meshes) {
    if (mesh.spec.family !== primaryFamily) continue;
    let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
    for (let i = 0; i < mesh.uv.length; i += 2) {
      minU = Math.min(minU, mesh.uv[i]!); maxU = Math.max(maxU, mesh.uv[i]!);
      minV = Math.min(minV, mesh.uv[i + 1]!); maxV = Math.max(maxV, mesh.uv[i + 1]!);
    }
    if (![minU, minV, maxU, maxV].every(Number.isFinite)) throw new Error('Organization sampling requires finite material coordinates');
    const windows = (surface: PaintedSurface): Readonly<Record<Region, OrganizationSampleWindow>> => {
      const create = (region: Region): OrganizationSampleWindow => {
        const patch = surface.regions?.[region];
        if (!patch) throw new Error(`Organization material lacks its ${region} source region`);
        const left = Math.round(patch.x * surface.width), top = Math.round(patch.y * surface.height);
        const width = Math.min(surface.width - left, Math.max(1, Math.round(patch.width * surface.width)));
        const height = Math.min(surface.height - top, Math.max(1, Math.round(patch.height * surface.height)));
        if (width < 3 || height < 3) throw new Error('Organization source region is too small for a continuous window');
        const spanU = maxU - minU, spanV = maxV - minV;
        // Preserve physical cluster size when it fits. If a piece is larger,
        // shrink the source window uniformly: never stretch one axis, reflect
        // a torn layer, or introduce a seam across the middle of a surface.
        const scale = Math.min(surface.width / surface.worldSize,
          spanU > 0 ? (width - 2) / spanU : Infinity,
          spanV > 0 ? (height - 2) / spanV : Infinity);
        const seed = mesh.spec.seed >>> 0;
        return { left, top, width, height, sourceWidth: surface.width, minU, minV, scale,
          offsetU: 1 + (width - 2 - spanU * scale) * ((seed % 83) / 82),
          offsetV: 1 + (height - 2 - spanV * scale) * (((seed >>> 8) % 97) / 96) };
      };
      return { skin: create('skin'), cleaved: create('cleaved'), loose: create('loose') };
    };
    result.set(mesh.spec.id, { ground: windows(painting), ...(painting.solid ? { solid: windows(painting.solid) } : {}) });
  }
  return result;
}

/** No allocations; the inclusive clamp only absorbs interpolation roundoff. */
export function organizationSampleIndex(window: OrganizationSampleWindow, u: number, v: number): number {
  const x = Math.max(0, Math.min(window.width - 1, Math.floor(window.offsetU + (u - window.minU) * window.scale)));
  const y = Math.max(0, Math.min(window.height - 1, Math.floor(window.offsetV + (v - window.minV) * window.scale)));
  return ((window.top + y) * window.sourceWidth + window.left + x) * 4;
}
