/**
 * FATAL connectivity + anti-maze silhouette + atmosphere/stump gates.
 *
 *   npx tsx --tsconfig tsconfig.json tools/map-preview/check-recipe-drafts.ts
 */
import { measureAtmosphere } from '../../src/generation/atmosphere.ts';
import { countWalkableComponents } from '../../src/generation/connectivity.ts';
import { countBoles, maxClearSightline } from '../../src/generation/cover.ts';
import { generateRecipeDraft } from '../../src/generation/draft-pipeline.ts';
import { maxOpenYard } from '../../src/generation/masses.ts';
import { PREVIEW_RECIPES } from '../../src/generation/recipes.ts';
import { measureSilhouette, silhouetteFails } from '../../src/generation/silhouette.ts';
import { coverReachFails, measureCoverReach } from '../../src/generation/stealth-density.ts';

const GALLERY_SEED = 101;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

for (const recipe of PREVIEW_RECIPES) {
  const mask = generateRecipeDraft(GALLERY_SEED, recipe);
  const n = countWalkableComponents(
    mask.outline.land,
    mask.walls,
    mask.outline.cols,
    mask.outline.rows,
  );
  assert(n === 1, `${recipe.id}: walkable components = ${n}`);
  assert(mask.metrics.leftoverConnected, `${recipe.id}: leftoverConnected false`);
  const yard = maxOpenYard(mask.outline.land, mask.walls, mask.outline.cols, mask.outline.rows);
  const sight = maxClearSightline(mask.outline.land, mask.walls, mask.outline.cols, mask.outline.rows);
  assert(mask.fragmentTypeId === recipe.fragmentTypeId, `${recipe.id}: fragment mismatch`);
  assert(
    !mask.features.some((f) =>
      (f.paint ?? []).some((c) => {
        const wall = mask.walls[c.row * mask.outline.cols + c.col];
        return wall && c.role !== 'stump' && c.role !== 'root';
      }),
    ),
    `${recipe.id}: non-wood paint on wall`,
  );
  const wood = (mask.features[0]?.paint ?? []).filter((c) => c.role === 'stump' || c.role === 'root');
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  for (const cell of wood) {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const col = cell.col + dx;
      const row = cell.row + dy;
      if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
      const i = row * cols + col;
      if (!mask.walls[i]) continue;
      const neighborWood = wood.some((c) => c.col === col && c.row === row);
      assert(neighborWood, `${recipe.id}: wood touches stone wall at ${col},${row}`);
    }
  }
  const boles = countBoles(mask.features[0]?.paint ?? [], mask.walls, mask.outline.cols);
  if (recipe.cover.trees >= 1) {
    assert(boles >= 1, `${recipe.id}: trees=${recipe.cover.trees} but bole count ${boles}`);
  } else {
    assert(boles === 0, `${recipe.id}: unexpected bole`);
  }

  const sil = measureSilhouette(
    mask.outline.land,
    mask.walls,
    mask.outline.cols,
    mask.outline.rows,
    mask.features[0]?.paint ?? [],
  );
  const silFail = silhouetteFails(sil);
  assert(!silFail, `${recipe.id}: silhouette ${silFail}`);
  const reach = measureCoverReach(
    mask.outline.land,
    mask.walls,
    mask.outline.cols,
    mask.outline.rows,
    mask.features[0]?.paint ?? [],
  );
  const reachFail = coverReachFails(reach, yard, recipe.id === 'rim-soil');
  assert(!reachFail, `${recipe.id}: ${reachFail}`);

  const atmo = mask.atmosphere;
  assert(atmo, `${recipe.id}: missing atmosphere field`);
  assert(atmo.fog.length === mask.outline.land.length, `${recipe.id}: fog size`);
  assert(Number.isFinite(atmo.windX) && Number.isFinite(atmo.windY), `${recipe.id}: wind`);
  const metrics = measureAtmosphere(
    mask.outline.land,
    mask.walls,
    mask.outline.cols,
    mask.outline.rows,
    atmo,
  );
  if (recipe.atmosphere.skyShadow > 0.04) {
    assert(metrics.occluderCount >= 1, `${recipe.id}: no sky occluder`);
    assert(metrics.shadeMeanLand >= 0.04, `${recipe.id}: shade mean ${metrics.shadeMeanLand} too low`);
    assert(metrics.shadeMeanLand <= 0.88, `${recipe.id}: shade mean ${metrics.shadeMeanLand} washes the island`);
  }
  if (recipe.atmosphere.fog > 0.35) {
    assert(metrics.fogSpread >= 0.06, `${recipe.id}: fog is flat (${metrics.fogSpread})`);
  }

  console.log(
    `${recipe.id}: yard ${yard} sight ${sight} walls ${(sil.wallRatio * 100).toFixed(1)}% thick ${(sil.thickRatio * 100).toFixed(0)}% thin ${sil.thinRun} alley ${sil.longAlley} cover p50 ${reach.median.toFixed(0)} p90 ${reach.p90.toFixed(0)} far ${reach.farBlob} bole ${boles} fogΔ ${metrics.fogSpread.toFixed(2)} shade ${metrics.shadeMeanLand.toFixed(2)}`,
  );
}

console.log(
  `check-recipe-drafts: ${PREVIEW_RECIPES.length} recipes, seed ${GALLERY_SEED}, connected, silhouette, cover-reach`,
);
