/** Isolated dependency-projection fixtures. No production table, image or game
 * result is changed; mock atom bytes test SHA ownership, not raster quality. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { writeR100QualificationManifests } from './r100-qualification-manifests.mjs';

const root = process.cwd(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-organization-manifests-'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const table = (file, name, value) => write(file, `export const ${name} = ${JSON.stringify(value)} as const;\n`);
const results = [];
try {
  process.chdir(temporary);
  const entries = ['src/generation/world-study/r100-production-map.ts', 'src/systems/r100-world-presentation.ts',
    'src/systems/r100-world/surface-preparation-worker.ts', 'src/generation/rift-generation-worker.ts',
    'src/systems/contamination-host-system.ts', 'src/systems/ai/ai-system.ts', 'src/systems/loot-search-system.ts',
    'src/systems/chaos-system.ts', 'src/scenes/rift-scene.ts'];
  for (const file of entries) write(file, "import '@/generated/r100-material-organizations';\n");
  write('package-lock.json', '{}');
  write('src/generation/world-study/r100-package.ts', "export function createR100ProductionRecipe() { return {package:{algorithm:'r100-native',version:3,algorithmRevision:6}}; }\n");
  table('src/generated/r100-native-worlds.ts', 'R100_NATIVE_WORLDS', ['plain', 'selected'].map(id => ({
    id, profile: { id }, definitions: [{ grade: 'low', family: 'primary', instances: [{ family: 'secondary' }] }],
  })));
  const appearanceFile = 'src/generated/r100-world-appearance.ts';
  const appearances = [{ worldId: 'plain' }, { worldId: 'selected', materialOrganization: 'short-fibre' }];
  table(appearanceFile, 'R100_WORLD_APPEARANCES', appearances);
  table('src/generated/rift-pollution-grade-data.ts', 'POLLUTION_GRADE_DEFINITIONS', [{ id: 'low' }]);
  table('src/generated/rift-expedition-grade-data.ts', 'R100_EXPEDITION_GRADES', [{ grade_id: 'low' }]);
  table('src/generated/rift-search-remains.ts', 'SEARCH_REMAINS', ['plain', 'selected'].map(worldId => ({ worldId })));
  const material = (kind, id) => ({ [kind]: id, source: `/assets/${id}-ground.png`, solid: { source: `/assets/${id}-solid.png` } });
  const families = ['primary', 'secondary'].map(id => material('family', id));
  const organizations = ['short-fibre', 'porous-marrow'].map(id => material('organization', id));
  table('src/generated/r100-materials.ts', 'PAINTED_MATERIALS', families);
  const organizationFile = 'src/generated/r100-material-organizations.ts';
  table(organizationFile, 'ORGANIZATION_MATERIALS', organizations);
  for (const row of [...families, ...organizations]) for (const source of [row.source, row.solid.source]) write(`public${source}`, `fixture:${source}`);
  const manifest = (folder, id) => fs.readFileSync(`${folder}/${id}.json`);
  const generate = folder => writeR100QualificationManifests({ outputDirectory: folder, immutable: true });
  generate('original');
  const plain = JSON.parse(manifest('original', 'plain')), selected = JSON.parse(manifest('original', 'selected'));
  assert.deepEqual(plain.materials.map(row => row.definition.family), ['primary', 'secondary']);
  assert.equal(selected.materials.length, 3); assert.equal(selected.materials[2].definition.organization, 'short-fibre');
  for (const value of [plain, selected]) assert(!value.dependencies.some(row => row.path === organizationFile), 'Whole organization table must not bind every world');
  results.push('empty selection keeps family-only projection; selected organization adds exactly one atom pair');
  write('public/assets/porous-marrow-ground.png', 'changed unused atom'); generate('unused');
  for (const id of ['plain', 'selected']) assert.deepEqual(manifest('unused', id), manifest('original', id));
  results.push('unselected organization atom change leaves both world receipts exact');
  write('public/assets/short-fibre-ground.png', 'changed selected atom'); generate('selected-change');
  assert.deepEqual(manifest('selected-change', 'plain'), manifest('original', 'plain'));
  assert.notEqual(sha(manifest('selected-change', 'selected')), sha(manifest('original', 'selected')));
  assert.throws(() => generate('original'), /Refuse to overwrite/);
  results.push('selected atom change affects only its world and cannot overwrite a frozen receipt');
  const changedDefinition = structuredClone(organizations); changedDefinition[0].logical_pixels = 128;
  table(organizationFile, 'ORGANIZATION_MATERIALS', changedDefinition); generate('definition-change');
  assert.deepEqual(manifest('definition-change', 'plain'), manifest('original', 'plain'));
  assert.notEqual(sha(manifest('definition-change', 'selected')), sha(manifest('selected-change', 'selected')));
  results.push('selected organization definition changes only its world receipt');
  const subset = writeR100QualificationManifests({ outputDirectory: 'subset', immutable: true, worldIds: ['plain'] });
  assert.equal(subset.length, 1); assert.equal(subset[0].worldId, 'plain');
  assert.deepEqual(manifest('subset', 'plain'), manifest('original', 'plain'));
  assert(!fs.existsSync('subset/selected.json'));
  for (const worldIds of [[], ['plain', 'plain'], ['missing']])
    assert.throws(() => writeR100QualificationManifests({ outputDirectory: 'invalid-subset', worldIds }), /unique existing world IDs/);
  results.push('explicit world subset preserves exact payloads; empty, duplicate and unknown scopes rejected');
  table(appearanceFile, 'R100_WORLD_APPEARANCES', [{ worldId: 'plain' }, { worldId: 'selected', materialOrganization: 'missing' }]);
  assert.throws(() => generate('missing'), /Missing organization atoms/);
  results.push('missing selected organization rejected');
} finally { process.chdir(root); fs.rmSync(temporary, { recursive: true, force: true }); }
const report = { status: 'pass', scope: 'Synthetic dependency ownership only; no material art or runtime claim.', checks: results,
  harness: { path: 'tools/world-study/check-r100-organization-manifests.mjs', sha256: sha(fs.readFileSync(new URL(import.meta.url))) },
  compiler: { path: 'tools/world-study/r100-qualification-manifests.mjs', sha256: sha(fs.readFileSync('tools/world-study/r100-qualification-manifests.mjs')) } };
const at = process.argv.indexOf('--report');
if (at >= 0) { assert(process.argv[at + 1]); assert(!fs.existsSync(process.argv[at + 1])); write(process.argv[at + 1], JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify(report));
