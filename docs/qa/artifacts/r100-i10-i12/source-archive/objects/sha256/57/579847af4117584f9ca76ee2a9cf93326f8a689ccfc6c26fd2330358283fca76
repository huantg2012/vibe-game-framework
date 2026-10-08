/** Small CPU facts derived from the same admitted world as the prepared surface.
 * Weak ownership never retains a departed world or trusts a saved runtime. */
import type { GeneratedRiftLayout } from '@/generation/types';
import type { R100NativeWorldData } from '@/generation/world-study/r100-native-data';
import type { SourceRegionAssignment } from '@/generation/contaminant-source-regions';
import type { RiftHostManifest } from '../rift-host-manifest';
import type { MasterSourceCell } from './source-cells';

export interface R100PreparedGameplay {
  readonly identity: string;
  readonly hostManifest: RiftHostManifest;
  readonly sourceCells: readonly MasterSourceCell[];
  readonly sourceRegions: ReadonlyMap<string, SourceRegionAssignment>;
}
const cache = new WeakMap<GeneratedRiftLayout, R100PreparedGameplay>();
const required = new WeakSet<GeneratedRiftLayout>();
export function r100NativePreparationIdentity(native: R100NativeWorldData): string {
  return `${native.packageHash}:${native.definition.id}:${native.sample.seed}:${native.raster.width}x${native.raster.height}`;
}
export function requireR100GameplayPreparation(layout: GeneratedRiftLayout): void { required.add(layout); }
export function readR100PreparedGameplay(layout: GeneratedRiftLayout, native: R100NativeWorldData): R100PreparedGameplay | undefined {
  const entry = cache.get(layout);
  if (entry && entry.identity !== r100NativePreparationIdentity(native)) throw new Error('Prepared gameplay identity differs');
  if (!entry && required.has(layout)) throw new Error('Native gameplay facts were not prepared before admission');
  return entry;
}
/** Returns a release closure that can never delete a replacement preparation. */
export function installR100PreparedGameplay(layout: GeneratedRiftLayout, native: R100NativeWorldData,
  data: R100PreparedGameplay): () => void {
  if (data.identity !== r100NativePreparationIdentity(native)) throw new Error('Prepared gameplay identity differs');
  const entry: R100PreparedGameplay = Object.freeze({ identity: data.identity,
    hostManifest: Object.freeze({ targets: Object.freeze([...data.hostManifest.targets]), nucleusCounts: new Map(data.hostManifest.nucleusCounts) }),
    sourceCells: Object.freeze(data.sourceCells.map(cell => Object.freeze({ ...cell }))),
    sourceRegions: new Map([...data.sourceRegions].map(([id, region]) => [id, Object.freeze({ ...region })])),
  });
  cache.set(layout, entry);
  return () => { if (cache.get(layout) === entry) cache.delete(layout); };
}
