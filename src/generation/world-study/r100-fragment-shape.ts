/** Revision 8: authored CSV layout plus a frozen edge seed. Recovery never reads CSV. */
import { generateRectilinearFragment, fragmentContoursToWorld, RECTILINEAR_FRAGMENT_VERSION } from './fragment-shape';
import type { RectilinearFragmentLayout } from './fragment-shape';
import type { Vector2 } from '@/types/game-types';

export interface R100FrozenFragmentShape {
  readonly algorithmVersion: typeof RECTILINEAR_FRAGMENT_VERSION;
  readonly layoutId: string;
  readonly sourceHash: string;
  readonly seedMode: 'run-seed';
  readonly seedSalt: number;
  readonly edgeSeed: number;
  readonly layout: RectilinearFragmentLayout;
}
export interface R100FragmentAuthoring {
  readonly worldId: string;
  readonly layoutId: string;
  readonly algorithmVersion: typeof RECTILINEAR_FRAGMENT_VERSION;
  readonly seedMode: 'run-seed';
  readonly seedSalt: number;
  readonly layout: RectilinearFragmentLayout;
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value: object, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const seed = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff;

/** Fixed original departure seed; content/placement retry seeds never enter here. */
export function freezeR100FragmentShape(authoring: R100FragmentAuthoring, sourceHash: string, requestedSeed: number): R100FrozenFragmentShape {
  if (!seed(requestedSeed)) throw new Error('Fragment departure requires the original uint32 run seed');
  const frozen: R100FrozenFragmentShape = {
    algorithmVersion: authoring.algorithmVersion, layoutId: authoring.layoutId, sourceHash,
    seedMode: authoring.seedMode, seedSalt: authoring.seedSalt,
    edgeSeed: (requestedSeed + authoring.seedSalt) >>> 0,
    layout: structuredClone(authoring.layout),
  };
  compileR100FragmentShape(frozen, requestedSeed);
  return frozen;
}

/** Compile and validate the saved authoring source, not the current catalog. */
export function compileR100FragmentShape(value: unknown, requestedSeed?: number): {
  readonly snapshot: R100FrozenFragmentShape;
  readonly terrainOutline: readonly Readonly<Vector2>[];
  readonly erosion: readonly (readonly Readonly<Vector2>[])[];
} {
  if (!object(value) || !keysAre(value, ['algorithmVersion', 'layoutId', 'sourceHash', 'seedMode', 'seedSalt', 'edgeSeed', 'layout'])
    || value.algorithmVersion !== RECTILINEAR_FRAGMENT_VERSION || typeof value.layoutId !== 'string' || !/^[a-z][a-z0-9-]{0,95}$/.test(value.layoutId)
    || typeof value.sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(value.sourceHash)
    || value.seedMode !== 'run-seed' || !seed(value.seedSalt) || !seed(value.edgeSeed)
    || !object(value.layout) || !keysAre(value.layout, ['authoringFrame', 'worldScale', 'landRects', 'voidRects'])) throw new Error('Invalid frozen fragment authoring snapshot');
  if (requestedSeed !== undefined && (!seed(requestedSeed) || value.edgeSeed !== ((requestedSeed + value.seedSalt) >>> 0))) throw new Error('Fragment edge seed must remain tied to the original departure');
  const snapshot = value as unknown as R100FrozenFragmentShape;
  const result = generateRectilinearFragment({algorithmVersion: snapshot.algorithmVersion, layout: snapshot.layout, edgeSeed: snapshot.edgeSeed});
  const polygons = fragmentContoursToWorld(result).map(loop => loop.map(([x, y]) => ({x, y})));
  const outerIndex = result.contourKinds.indexOf('outer');
  if (outerIndex < 0 || result.contourKinds.filter(kind => kind === 'outer').length !== 1) throw new Error('Fragment compiler did not produce one ground body');
  return {snapshot, terrainOutline: polygons[outerIndex]!, erosion: polygons.filter((_, index) => result.contourKinds[index] === 'hole')};
}
