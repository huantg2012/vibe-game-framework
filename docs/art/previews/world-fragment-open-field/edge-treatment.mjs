// Thin preview adapter. All union/edge policy lives in the versioned TS library.
// Node callers: node --import tsx <script>; browser preview is bundled by esbuild.
import { generateRectilinearFragment, RECTILINEAR_FRAGMENT_VERSION } from '../../../../src/generation/world-study/fragment-shape/index.ts';

export const PREVIEW_SEEDS = Object.freeze([20261011, 20261027, 20261109]);

/** Preserve the accepted preview data shape without duplicating its implementation. */
export function generateEdgeStudy(geometry, seed = PREVIEW_SEEDS[0]) {
  const result = generateRectilinearFragment({
    algorithmVersion: RECTILINEAR_FRAGMENT_VERSION,
    layout: geometry,
    edgeSeed: seed,
  });
  const { algorithmVersion, worldScale, ...study } = result;
  return study;
}
