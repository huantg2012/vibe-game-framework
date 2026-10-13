import { bakeSearchSitePatches as bakeRevision10SearchSites } from '@/generation/legacy-r100-v10/executor-recovery.js';
import { bakeSearchSitePatches as bakeRevision9SearchSites } from '@/generation/legacy-r100-v9/executor-recovery.js';
/** Preparation-worker material patches. A node replaces only its disjoint native
 * upload rectangle; both states retain the exact receiver everywhere else. */
import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import type { R100SearchSitePlacement } from '@/generation/world-study/search-site-types';
import { mapWorldPigment, paintedToneRange, sampleWorldAppearance, type PaintedToneRange } from '@/generation/world-study/world-material-pigment';
import type { PaintedMaterial, PaintedSurface } from './painted-material';
import type { MasterSurfaceBake } from './surface-bake';
import { bakeSearchSiteGeometry, type SearchSiteGeometry } from './search-site-shapes';

export interface SearchSiteSurfaceChannels {
  readonly albedo: Uint8Array;
  readonly normal: Uint8Array;
  readonly response: Uint8Array;
  readonly emission: Uint8Array;
}
export interface SearchSiteMaterialPatch {
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly intact: SearchSiteSurfaceChannels;
  readonly searched: SearchSiteSurfaceChannels;
}
interface Bounds { x: number; y: number; right: number; bottom: number }
const CHANNELS = ['albedo', 'normal', 'response', 'emission'] as const;
const decodeHeight = (response: Uint8Array, q: number): number => (response[q + 1]! * 256 + response[q + 2]!) / 128;
const mirror = (value: number, extent: number): number => {
  const n = ((Math.floor(value) % (extent * 2)) + extent * 2) % (extent * 2);
  return n < extent ? n : extent * 2 - n - 1;
};

/** Keep GPU upload rectangles disjoint, not merely their visible alpha masks.
 * Restoring a searched neighbour must never erase the other node's state. */
function siteBounds(sites: readonly R100SearchSitePlacement[], width: number, height: number): Bounds[] {
  const boxes = sites.map(site => ({ x: Math.max(0, Math.floor(site.position.x) - 40),
    y: Math.max(0, Math.floor(site.position.y) - 32), right: Math.min(width, Math.floor(site.position.x) + 40),
    bottom: Math.min(height, Math.floor(site.position.y) + 32) }));
  for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
    const p = boxes[a]!, q = boxes[b]!;
    if (p.right <= q.x || q.right <= p.x || p.bottom <= q.y || q.bottom <= p.y) continue;
    const u = sites[a]!.position, v = sites[b]!.position;
    const dx = Math.abs(u.x - v.x), dy = Math.abs(u.y - v.y);
    if (dx >= dy && dx >= 42) {
      const cut = Math.floor((u.x + v.x) / 2);
      if (u.x < v.x) { p.right = Math.min(p.right, cut); q.x = Math.max(q.x, cut); }
      else { q.right = Math.min(q.right, cut); p.x = Math.max(p.x, cut); }
    } else if (dy >= 42) {
      const cut = Math.floor((u.y + v.y) / 2);
      if (u.y < v.y) { p.bottom = Math.min(p.bottom, cut); q.y = Math.max(q.y, cut); }
      else { q.bottom = Math.min(q.bottom, cut); p.y = Math.max(p.y, cut); }
    } else throw new Error('Grounded search site cores overlap');
  }
  return boxes;
}

function copyReceiver(base: MasterSurfaceBake, bounds: Bounds): SearchSiteSurfaceChannels {
  const width = bounds.right - bounds.x, height = bounds.bottom - bounds.y;
  const target: SearchSiteSurfaceChannels = { albedo: new Uint8Array(width * height * 4), normal: new Uint8Array(width * height * 4),
    response: new Uint8Array(width * height * 4), emission: new Uint8Array(width * height * 4) };
  for (const channel of CHANNELS) for (let y = 0; y < height; y++) {
    const start = ((bounds.y + y) * base.width + bounds.x) * 4;
    target[channel].set(base[channel].subarray(start, start + width * 4), y * width * 4);
  }
  return target;
}

function materialPixel(paint: PaintedSurface, region: SearchSiteGeometry['face'][number],
  u: number, v: number, seed: number): number {
  const patch = paint.regions?.[region];
  const left = patch ? Math.round(patch.x * paint.width) : 0, top = patch ? Math.round(patch.y * paint.height) : 0;
  const width = patch ? Math.min(paint.width - left, Math.max(1, Math.round(patch.width * paint.width))) : paint.width;
  const height = patch ? Math.min(paint.height - top, Math.max(1, Math.round(patch.height * paint.height))) : paint.height;
  const scale = paint.width / paint.worldSize;
  const x = left + mirror(u * scale + seed % 83, width), y = top + mirror(v * scale + (seed >>> 8) % 97, height);
  return (y * paint.width + x) * 4;
}

function bakeState(world: MasterWorld, base: MasterSurfaceBake, painting: PaintedMaterial | undefined,
  site: R100SearchSitePlacement, bounds: Bounds, searched: boolean, ranges: Map<PaintedSurface, PaintedToneRange>): SearchSiteSurfaceChannels {
  const width = bounds.right - bounds.x, height = bounds.bottom - bounds.y, size = width * height;
  const channels = copyReceiver(base, bounds), geometry = bakeSearchSiteGeometry(site, bounds.x, bounds.y, width, height, searched);
  const anchorX = Math.max(0, Math.min(base.width - 1, Math.floor(site.position.x)));
  const anchorY = Math.max(0, Math.min(base.height - 1, Math.floor(site.position.y)));
  const anchorHeight = decodeHeight(base.response, (anchorY * base.width + anchorX) * 4);
  const allowed = new Uint8Array(size), pigment = new Float32Array(3);
  const identity = { secondary: 0, tone: 0, detail: 1 }, ca = Math.cos(site.axis), sa = Math.sin(site.axis);
  const worldCa = Math.cos(world.definition.axis), worldSa = Math.sin(world.definition.axis);
  for (let i = 0; i < size; i++) {
    const x = bounds.x + i % width, y = bounds.y + Math.floor(i / width), q = i * 4;
    // Native foreground and absent terrain are authoritative. Thin residue
    // never fills a hole, climbs an exposed face or writes over its ownership.
    if (geometry.coverage[i]! <= 0 || !world.matterAt(x + .5, y + .5) || world.roleAt(x + .5, y + .5) === 'solid'
      || channels.albedo[q + 3] !== 255 || decodeHeight(channels.response, q) > anchorHeight + 2) {
      geometry.height[i] = 0; continue;
    }
    allowed[i] = 1;
  }
  const relief = (x: number, y: number): number => x < 0 || y < 0 || x >= width || y >= height ? 0 : geometry.height[y * width + x]!;
  for (let i = 0; i < size; i++) {
    if (!allowed[i]) continue;
    const px = i % width, py = Math.floor(i / width), x = bounds.x + px, y = bounds.y + py, q = i * 4;
    const family = geometry.family[i]!, face = geometry.face[i]!, paint = painting?.families?.[family] ?? painting;
    const dx = x - site.position.x, dy = y - site.position.y, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
    const appearance = world.appearance;
    if (paint) {
      const source = materialPixel(paint, face, u, v, site.visualSeed);
      if (appearance) {
        let range = ranges.get(paint);
        if (!range) { range = paintedToneRange(paint); ranges.set(paint, range); }
        sampleWorldAppearance(appearance, x * worldCa + y * worldSa, -x * worldSa + y * worldCa, world.sample.seed, identity);
        // Material identity comes from the actual selected family, not a world
        // label, reward, grade or whichever pigment happened to be brightest.
        const secondary = family === world.definition.family ? 0 : 1;
        mapWorldPigment(appearance, face === 'cleaved' ? 'cleaved' : 'solid', paint.pixels[source]!, paint.pixels[source + 1]!,
          paint.pixels[source + 2]!, range, identity, secondary, pigment);
      } else for (let c = 0; c < 3; c++) pigment[c] = paint.pixels[source + c]!;
    } else {
      // Pure bake fixtures may omit decoded source atoms. This uses the same
      // frozen world palette; production always supplies its prepared atoms.
      const color = face === 'cleaved' ? world.sample.profile.palette.faceLight : world.sample.profile.palette.materialMid;
      pigment[0] = color >>> 16 & 255; pigment[1] = color >>> 8 & 255; pigment[2] = color & 255;
    }
    const coverage = geometry.coverage[i]!;
    for (let c = 0; c < 3; c++) channels.albedo[q + c] = Math.round(channels.albedo[q + c]! * (1 - coverage) + pigment[c]! * coverage);
    const nz = Math.max(.18, channels.normal[q + 2]! / 255 * 2 - 1);
    const sx = (channels.normal[q]! / 255 * 2 - 1) / nz - (relief(px + 1, py) - relief(px - 1, py)) * .5;
    const sy = (channels.normal[q + 1]! / 255 * 2 - 1) / nz - (relief(px, py + 1) - relief(px, py - 1)) * .5;
    const length = Math.hypot(sx, sy, 1);
    channels.normal[q] = Math.round((sx / length * .5 + .5) * 255);
    channels.normal[q + 1] = Math.round((sy / length * .5 + .5) * 255);
    channels.normal[q + 2] = Math.round((1 / length * .5 + .5) * 255);
    // Contact loss is localized to overlapped material; no black perimeter.
    channels.normal[q + 3] = Math.round(channels.normal[q + 3]! * (geometry.overlap[i]! > 1 && !searched ? .92 : .99));
    const encoded = Math.max(0, Math.min(65535, Math.round((decodeHeight(channels.response, q) + geometry.height[i]!) * 128)));
    channels.response[q] = Math.round(channels.response[q]! * (1 - coverage) + geometry.roughness[i]! * 255 * coverage);
    channels.response[q + 1] = encoded >>> 8; channels.response[q + 2] = encoded & 255;
    // It is a shallow receiver, not an added tall native volume.
    for (let c = 0; c < 4; c++) channels.emission[q + c] = 0;
  }
  return channels;
}

export function bakeSearchSitePatches(world: MasterWorld, baseSurface: MasterSurfaceBake,
  painting?: PaintedMaterial): SearchSiteMaterialPatch[] {
  if (world.algorithmRevision === 9) return bakeRevision9SearchSites(world, baseSurface, painting);
  if (world.algorithmRevision === 10) return bakeRevision10SearchSites(world, baseSurface, painting);
  if (world.algorithmRevision !== 11) return [];
  const sites = world.searchSites;
  if (!sites) throw new Error('Revision 11 native world has no frozen search sites');
  if (baseSurface.width !== world.raster.width || baseSurface.height !== world.raster.height) throw new Error('Search-site receiver dimensions differ from native world');
  if (new Set(sites.map(site => site.nodeId)).size !== sites.length) throw new Error('Duplicate grounded search-site node');
  const boxes = siteBounds(sites, baseSurface.width, baseSurface.height), ranges = new Map<PaintedSurface, PaintedToneRange>();
  return sites.map((site, index) => {
    const bounds = boxes[index]!;
    return { nodeId: site.nodeId, x: bounds.x, y: bounds.y, width: bounds.right - bounds.x, height: bounds.bottom - bounds.y,
      intact: bakeState(world, baseSurface, painting, site, bounds, false, ranges),
      searched: bakeState(world, baseSurface, painting, site, bounds, true, ranges) };
  });
}
