import type { GeneratedRiftLayout } from '@/generation/types';

/** The shared stage consumes supported world coordinates, not a particular sea.
 * A world prepares its authoritative surface before simulation/presentation.
 */
export interface StageWorldGeometry {
  readonly layout: GeneratedRiftLayout;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  isFloor(x: number, y: number): boolean;
  groundHeightAt(x: number, y: number): number;
  signature(): string;
}
