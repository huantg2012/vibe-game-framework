/** Immutable dependency receipt for the v3 algorithm and its material assets. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { writeR100QualificationManifests } from './r100-qualification-manifests.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const paths = ['data/rift-spatial-policy.csv', 'data/rift-spatial-deployment.csv',
  'src/generated/rift-spatial-deployment-data.ts', 'src/generation/world-study/r100-spatial-deployment.ts', 'data/rift-spatial-layouts.csv', 'data/rift-spatial-erosion.csv',
  'data/rift-spatial-anchors.csv', 'data/rift-spatial-worlds.csv', 'data/rift-spatial-materials.csv',
  'data/rift-spatial-organizations.csv', 'data/rift-spatial-authored-groups.csv', 'data/rift-spatial-authored-erosion.csv',
  'data/rift-spatial-sectors.csv', 'data/rift-spatial-sector-layouts.csv', 'data/rift-spatial-sector-cuts.csv', 'data/rift-spatial-sector-anchors.csv',
  'data/rift-spatial-land-plates.csv', 'data/rift-spatial-land-outlines.csv',
  'tools/world-study/codegen-r100-spatial.mjs', 'tools/world-study/build-r100-authored-shores.py',
  'tools/world-study/generate-spatial-deployment.mjs',
  'src/generated/r100-spatial-data.ts', 'src/generation/world-study/r100-spatial-types.ts',
  'src/generation/world-study/r100-spatial-world.ts', 'src/generation/world-study/spatial-extraction-selection.ts',
  'src/systems/ai/physical-grid.ts', 'src/systems/tile-grid.ts', 'src/types/game-types.ts',
  'src/config/constants.ts', 'src/generation/seed-fork.ts', 'src/utils/random.ts',
  'src/generation/world-study/r100-production-map.ts', 'src/generation/world-study/production-recipe.ts',
  'data/rift-master-scenes.csv', 'data/rift-pollution-grades.csv', 'data/rift-expedition-grades.csv',
  'data/rift-world-appearance.csv', 'data/rift-master-materials.csv', 'data/rift-search-remains.csv', 'data/rift-native-worlds.csv',
  'src/generation/world-study/r100-world-appearance.ts', 'src/generation/world-study/world-material-pigment.ts',
  'src/systems/r100-world/surface-bake.ts', 'src/systems/r100-world/ground.ts',
  'src/systems/r100-world/surface-fields.ts',
  'src/systems/r100-world/organization-sampling.ts',
  'src/generation/world-study/r100-master-world.ts', 'src/generation/world-study/r100-pollution.ts',
  'src/generation/world-study/r100-expedition.ts', 'src/generation/world-study/r100-expedition-v1.ts',
  'src/generation/world-study/r100-patrol-windows.ts', 'src/generation/world-study/r100-package.ts', 'src/generation/world-study/native-volume-geometry.ts',
  'src/generation/world-study/native-volume-expansion.ts', 'src/generation/world-study/native-volume-cellular.ts',
  'src/generation/world-study/native-volume-pleated-tear.ts',
  'src/generation/world-study/native-volume-ground.ts', 'src/generation/world-study/native-volume-erosion.ts',
  'src/generation/world-study/native-volume-settled-sheet.ts',
  'src/generation/world-study/native-volume-settled-projection.ts',
  'src/generation/world-study/native-volume-ground-edge.ts',
  'src/generation/world-study/native-volume-organization.ts',
  'src/generation/world-study/native-volume-raster.ts', 'src/generation/world-study/pollution-grade.ts'];
for (const match of readFileSync('data/rift-master-materials.csv', 'utf8').matchAll(/\/assets\/[a-zA-Z0-9_./-]+\.png/g)) paths.push(`public${match[0]}`);
const organizationCsv = 'data/rift-material-organizations.csv';
if (existsSync(organizationCsv)) {
  paths.push(organizationCsv);
  for (const match of readFileSync(organizationCsv, 'utf8').matchAll(/\/assets\/[a-zA-Z0-9_./-]+\.png/g)) paths.push(`public${match[0]}`);
}
const dependencies = [...new Set(paths)].sort().map(path => ({ path, sha256: hash(readFileSync(path)) }));
const materialRows = readFileSync('data/rift-master-materials.csv', 'utf8').trim().split(/\r?\n/);
const columns = materialRows.shift().split(',');
const materials = Object.fromEntries(materialRows.map(line => {
  const row = Object.fromEntries(columns.map((key, index) => [key, line.split(',')[index]]));
  return [row.family, { definition: hash(line), surface: hash(readFileSync(`public${row.source}`)), solid: hash(readFileSync(`public${row.solid_source}`)) }];
}));
if (existsSync(organizationCsv)) {
  const rows = readFileSync(organizationCsv, 'utf8').trim().split(/\r?\n/);
  const header = rows.shift().split(',');
  if (header.join(',') !== ['organization', ...columns.slice(1)].join(',')) throw new Error('Invalid material organization columns');
  for (const line of rows) {
    const values = line.split(',');
    if (values.length !== header.length) throw new Error('Invalid material organization row');
    const row = Object.fromEntries(header.map((key, index) => [key, values[index]]));
    if (!['short-fibre', 'porous-marrow', 'short-fibre-loose'].includes(row.organization)) throw new Error('Unknown material organization');
    const key = `organization:${row.organization}`;
    if (materials[key]) throw new Error(`Duplicate material organization: ${key}`);
    for (const source of [row.source, row.solid_source]) if (!/^\/assets\/r100-materials\/[a-z0-9-]+-source\.png$/.test(source)) throw new Error('Invalid immutable organization asset path');
    materials[key] = { definition: hash(line), surface: hash(readFileSync(`public${row.source}`)), solid: hash(readFileSync(`public${row.solid_source}`)) };
  }
}
const manifest = { algorithm: 'r100-native', version: 3, dependencies, hash: hash(JSON.stringify(dependencies)) };
const output = `// GENERATED by tools/world-study/codegen-r100-packages.mjs. New incompatible rules require a new version.\nexport const R100_PACKAGE_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;\nexport const R100_MATERIAL_DEPENDENCIES: Readonly<Record<string, { readonly definition: string; readonly surface: string; readonly solid: string }>> = ${JSON.stringify(materials, null, 2)};\n`;
const target = 'src/generated/r100-package-manifest.ts';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Stale v3 package dependency receipt');
  console.log(`PASS v3 dependency receipt: ${dependencies.length} exact sources/assets`);
} else writeFileSync(target, output);
if (process.argv.includes('--qualification')) writeR100QualificationManifests({ check: process.argv.includes('--check') });
