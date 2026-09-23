import { INTERIOR_FACES } from './interior';
import { EXTERIOR_FACES } from './exterior';
export { MATERIAL } from './schema';
export type { Point, Layer, Plane, Face } from './schema';
export const ENVIRONMENT_FACES = [...EXTERIOR_FACES, ...INTERIOR_FACES] as const;
export const ENVIRONMENT_SIZE = { width: 640, height: 400 } as const;
export const ENVIRONMENT_REVISION = 'r9-offset-01';
