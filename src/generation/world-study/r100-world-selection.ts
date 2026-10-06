import { R100_NATIVE_WORLDS, type R100NativeWorldEntry } from '@/generated/r100-native-worlds';
import { R100_WORLD_SELECTION_POLICY as policy } from '@/generated/r100-world-selection';
import { mix32 } from '@/generation/seed-fork';
import { emptyRiftWorldHistory, validRiftWorldHistory, type RiftWorldHistory } from '@/types/rift-world-history';

/** Selection operates on the catalog once per departure, never in an update loop. */
export interface R100SelectionDescriptor {
  readonly id: string;
  readonly primaryMaterial: string;
  readonly materials: readonly string[];
  readonly shapes: readonly string[];
  readonly organization: string;
  readonly solidCount: number;
  readonly meanHeight: number;
  readonly aspectRatio: number;
}
export interface R100WorldSelectionWeight {
  readonly worldId: string;
  readonly weight: number;
}

export function describeR100World(world: R100NativeWorldEntry): R100SelectionDescriptor {
  const definition = world.definitions.find(row => row.grade === 'low');
  if (!definition) throw new Error(`Native world has no low-grade identity: ${world.id}`);
  const solids = definition.instances.filter(instance => instance.role === 'solid');
  const sum = (read: (instance: typeof solids[number]) => number): number => solids.reduce((total, row) => total + read(row), 0);
  const area = sum(instance => instance.length * instance.width);
  return { id: world.id, primaryMaterial: definition.family,
    materials: [...new Set(definition.instances.map(instance => instance.family ?? definition.family))].sort(),
    shapes: [...new Set(solids.map(instance => instance.shapeProfile ?? instance.family ?? definition.family))].sort(),
    organization: world.profile.surface.organization ?? 'unspecified', solidCount: solids.length,
    meanHeight: area > 0 ? sum(instance => instance.height * instance.length * instance.width) / area : 0,
    aspectRatio: area > 0 ? sum(instance => Math.max(instance.length, instance.width) / Math.min(instance.length, instance.width)
      * instance.length * instance.width) / area : 1 };
}

const relativeDifference = (a: number, b: number): number => Math.abs(a - b) / Math.max(1, a, b);
function setDifference(a: readonly string[], b: readonly string[]): number {
  const union = new Set([...a, ...b]);
  return union.size ? 1 - a.filter(value => b.includes(value)).length / union.size : 0;
}

/** A coarse selection hint, not an art-quality or whole-map equivalence claim. */
export function r100WorldNeighborDistance(a: R100SelectionDescriptor, b: R100SelectionDescriptor): number {
  return ((a.primaryMaterial === b.primaryMaterial ? 0 : 1) + setDifference(a.materials, b.materials)
    + setDifference(a.shapes, b.shapes)
    + (a.organization === b.organization ? 0 : 1) + relativeDifference(a.solidCount, b.solidCount)
    + relativeDifference(a.meanHeight, b.meanHeight) + relativeDifference(a.aspectRatio, b.aspectRatio)) / 7;
}

export function r100WorldSelectionWeights(
  history: RiftWorldHistory = emptyRiftWorldHistory(),
  catalog: readonly R100NativeWorldEntry[] = R100_NATIVE_WORLDS,
): readonly R100WorldSelectionWeight[] {
  if (!validRiftWorldHistory(history)) throw new Error('Invalid recent world history');
  const choices = catalog.filter(world => world.enabled).slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (!choices.length) throw new Error('No admitted native world is enabled');
  if (new Set(choices.map(world => world.id)).size !== choices.length) throw new Error('Duplicate native world identity');
  const descriptors = new Map(catalog.map(world => [world.id, describeR100World(world)]));
  return choices.map(world => {
    const descriptor = descriptors.get(world.id)!;
    let weight = 1;
    for (let index = history.visits.length - 1; index >= 0; index--) {
      const visit = history.visits[index]!, previous = descriptors.get(visit.worldId);
      const same = visit.worldId === world.id;
      const near = previous && r100WorldNeighborDistance(descriptor, previous) <= policy.neighborDistance;
      if (!same && !near) continue;
      const age = history.visits.length - 1 - index;
      const initial = same ? policy.repeatWeight : policy.neighborWeight;
      const recovered = initial + (1 - initial) * age / (policy.historyLimit - 1);
      weight = Math.min(weight, recovered);
    }
    return { worldId: world.id, weight };
  });
}

/** Same history and seed give the same result, regardless of CSV row order.
 * Every enabled identity retains positive probability. No retries/redraws. */
export function selectR100WorldId(
  seed: number, history: RiftWorldHistory = emptyRiftWorldHistory(),
  catalog: readonly R100NativeWorldEntry[] = R100_NATIVE_WORLDS,
): string {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Invalid world selection seed');
  const weights = r100WorldSelectionWeights(history, catalog);
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  let target = (mix32(seed, `r100-world-selection-${policy.version}`) / 0x100000000) * total;
  for (const item of weights) { target -= item.weight; if (target < 0) return item.worldId; }
  return weights[weights.length - 1]!.worldId;
}
