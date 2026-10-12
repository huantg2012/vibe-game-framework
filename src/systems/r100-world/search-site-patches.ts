/** Transfer validation and bounded CPU composition. The transport rectangle
 * includes untouched ground, so two rectangles must never overwrite each other. */
import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import type { MasterSurfaceBake } from './surface-bake';
import type { SearchSiteMaterialPatch, SearchSiteSurfaceChannels } from './search-site-bake';

export const SEARCH_SITE_CHANNELS = ['albedo', 'normal', 'response', 'emission'] as const;

export function applySearchSitePatch(surface: MasterSurfaceBake, patch: SearchSiteMaterialPatch,
  channels: SearchSiteSurfaceChannels): void {
  for (const name of SEARCH_SITE_CHANNELS) for (let row = 0; row < patch.height; row++) {
    const offset = row * patch.width * 4;
    surface[name].set(channels[name].subarray(offset, offset + patch.width * 4),
      ((patch.y + row) * surface.width + patch.x) * 4);
  }
}

export function validateSearchSitePatches(world: MasterWorld, patches: readonly SearchSiteMaterialPatch[] | undefined): void {
  const sites = world.searchSites;
  if (!sites) {
    if (patches !== undefined) throw new Error('Legacy world cannot acquire grounded search patches');
    return;
  }
  if (!Array.isArray(patches) || patches.length !== sites.length) throw new Error('Prepared search site count differs');
  const nodes = new Map(sites.map(site => [site.nodeId, site]));
  if (nodes.size !== sites.length) throw new Error('Duplicate frozen search site identity');
  for (let index = 0; index < patches.length; index++) {
    const patch = patches[index]!, site = nodes.get(patch.nodeId);
    if (!site || ![patch.x, patch.y, patch.width, patch.height].every(Number.isSafeInteger)
      || patch.width < 1 || patch.width > 80 || patch.height < 1 || patch.height > 64
      || patch.x < 0 || patch.y < 0 || patch.x + patch.width > world.raster.width
      || patch.y + patch.height > world.raster.height
      || site.position.x < patch.x || site.position.x >= patch.x + patch.width
      || site.position.y < patch.y || site.position.y >= patch.y + patch.height)
      throw new Error('Prepared search site bounds or identity differ');
    nodes.delete(patch.nodeId);
    for (let other = 0; other < index; other++) {
      const b = patches[other]!;
      if (patch.x < b.x + b.width && b.x < patch.x + patch.width
        && patch.y < b.y + b.height && b.y < patch.y + patch.height)
        throw new Error('Prepared search site transport rectangles overlap');
    }
    const size = patch.width * patch.height * 4;
    for (const state of [patch.intact, patch.searched]) {
      if (!state || !SEARCH_SITE_CHANNELS.every(name => state[name] instanceof Uint8Array && state[name].length === size))
        throw new Error('Prepared search material channels differ');
      for (let y = 0; y < patch.height; y++) for (let x = 0; x < patch.width; x++) {
        const q = (y * patch.width + x) * 4;
        if (!world.matterAt(patch.x + x, patch.y + y)
          && SEARCH_SITE_CHANNELS.some(name => state[name][q] || state[name][q + 1] || state[name][q + 2] || state[name][q + 3]))
          throw new Error('Prepared search material crosses absent terrain');
      }
    }
  }
}
