/** Reuse one frozen r13 raster; never search geometry, seeds or run a browser. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { deserialize } from 'node:v8';
import { createHash } from 'node:crypto';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { deployR100Expedition } from '../../src/generation/world-study/r100-expedition';
import { createAutomaticSupplyPolicy } from '../../src/generation/world-study/automatic-supply-policy';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import type { WorldProductionMap } from '../../src/generation/world-study/production-map';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure';
import {evaluateNativeSpatialRoutes} from '../../src/generation/world-study/native-spatial-routes';
import type {NativeSpatialAssemblyPlacement} from '../../src/generation/world-study/native-spatial-structures';

const fixture = process.argv[2], output = process.argv[3];
if (!fixture || !output) throw new Error('Usage: check-automatic-supply-fixture.ts FROZEN_FIXTURE_DIRECTORY NEW_REPORT_JSON');
const started = performance.now();
const report: Record<string, unknown> = { status:'running',fixture,scope:'One cached r13 physical world, reused for legacy equivalence and shared supply; no new geometry, seed search, game or browser execution' };
const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  const recipe: WorldProductionRecipeV3 = JSON.parse(readFileSync(join(fixture,'recipe.json'),'utf8'));
  const map = deserialize(gunzipSync(readFileSync(join(fixture,'map.v8.gz')))) as WorldProductionMap;
  if (recipe.package.algorithmRevision !== 13 || !map.native) throw new Error('Fixture must contain one frozen r13 native map');
  const world = hydrateR100MasterWorld(map.native,map.layout);
  const legacy = deployR100Expedition(world,recipe.contentDefinition,recipe.searchSitePolicy);
  report.legacy = { exactLayout:hash(legacy.layout)===hash(map.layout),actualHash:hash(legacy.layout),frozenHash:hash(map.layout) };
  if (hash(legacy.layout)!==hash(map.layout)) throw new Error('No-policy branch changed frozen r13 layout');
  if (performance.now()-started>=60000) throw new Error('Cached fixture check exceeded 60 second deadline before supply');
  // Shared grade content prevents historical per-world low overrides from
  // accidentally becoming an input to the new automatic budget.
  const definition = R100_EXPEDITION_GRADES.find(row=>row.grade_id===recipe.gradeDefinition.id)!;
  const deployed=deployR100Expedition(world,definition,recipe.searchSitePolicy,createAutomaticSupplyPolicy(recipe.gradeDefinition.id));
  if (performance.now()-started>=60000) throw new Error('Cached fixture check exceeded 60 second deadline');
  report.supply=deployed.diagnostics;
  const originalSpatial=map.native.diagnostics.nativeSpatial as {assemblies:NativeSpatialAssemblyPlacement[]};
  const geometry=buildNativeSpatialGeometry(world.definition,recipe.nativeConstruction!.geometrySeed);
  const groups=identifyNativeSpatialStructures(geometry,originalSpatial.assemblies,recipe.nativeSpatial!.policy);
  const routes=evaluateNativeSpatialRoutes(geometry,groups.structures,recipe.nativeSpatial!.policy,deployed.layout);
  report.routes=routes;
  if(!routes.accepted)throw new Error(`Automatic supply route rejection: ${routes.reasons.join('; ')}`);
  report.status='pass';
} catch(error) {
  report.status='failed'; report.error=error instanceof Error?error.message:String(error);
  if(error&&typeof error==='object'&&'diagnostics' in error)report.diagnostics=error.diagnostics;
  process.exitCode=1;
}
report.elapsedMs=performance.now()-started;
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,error:report.error,elapsedMs:report.elapsedMs,output}));
