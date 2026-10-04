/** Mutate actual copied dependency files, never the running game's inputs.
 * The review ledger consumes these receipts; this check never grants a pass. */
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { writeR100QualificationManifests } from './r100-qualification-manifests.mjs';

const root = process.cwd(), temporary = mkdtempSync(join(tmpdir(), 'coh-r100-qualification-'));
const manifestFlag = process.argv.indexOf('--manifest-dir');
const outputDirectory = manifestFlag >= 0 ? process.argv[manifestFlag + 1] : 'docs/qa/artifacts/r100-i03-i06/packages';
// The registered source receipts are read-only. All mutations happen in the isolated copy.
const original = writeR100QualificationManifests({ check: true, outputDirectory });
const paths = new Set(['src/generated/r100-native-worlds.ts', 'src/generated/r100-materials.ts',
  'src/generated/rift-pollution-grade-data.ts', 'src/generated/rift-expedition-grade-data.ts', 'src/generated/rift-search-remains.ts',
  'src/generated/r100-package-manifest.ts', 'src/generated/rift-world-profile-data.ts', 'src/generation/world-study/r100-generated-scenes.ts']);
for (const row of original) {
  const payload = JSON.parse(readFileSync(row.dependencyManifest.path, 'utf8'));
  for (const dependency of payload.dependencies) paths.add(dependency.path);
  for (const material of payload.materials) for (const asset of material.assets) paths.add(asset.path);
}
const outcomes = [];
try {
  for (const path of paths) { const destination = join(temporary, path); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(path, destination); }
  process.chdir(temporary);
  const baseline = writeR100QualificationManifests({ outputDirectory });
  assert.deepEqual(baseline, original, 'isolated copy retains exact evidence hashes');
  for (const scenario of [
    { name: 'shared slab atom asset', path: 'public/assets/r100-materials/slab-solid-source.png',
      expected: baseline.filter(row => row.families.includes('folded-slab')).map(row => row.worldId),
      mutate: bytes => Buffer.concat([bytes, Buffer.from('\nqualification-probe\n')]) },
    { name: 'shared geometry operator', path: 'src/generation/world-study/native-volume-geometry.ts',
      expected: baseline.map(row => row.worldId), mutate: bytes => Buffer.concat([bytes, Buffer.from('\n// qualification probe\n')]) },
    { name: 'pollution rule data', path: 'src/generated/rift-pollution-grade-data.ts',
      expected: baseline.map(row => row.worldId), mutate: bytes => Buffer.from(bytes.toString().replace(/("chaosStartRate":\s*)([0-9.]+)/, (_, key, number) => key + (Number(number) + .01))) },
  ]) {
    const previous = readFileSync(scenario.path), changedBytes = scenario.mutate(previous);
    assert.notDeepEqual(changedBytes, previous); writeFileSync(scenario.path, changedBytes);
    assert.throws(() => writeR100QualificationManifests({ check: true, outputDirectory }), /Stale qualification receipt/);
    const changed = writeR100QualificationManifests({ outputDirectory });
    const invalidated = changed.filter((row, index) => row.dependencyManifest.hash !== baseline[index].dependencyManifest.hash).map(row => row.worldId);
    assert.deepEqual(invalidated, scenario.expected, 'dependency closure determines the affected worlds');
    writeFileSync(scenario.path, previous);
    assert.deepEqual(writeR100QualificationManifests({ outputDirectory }), baseline);
    writeR100QualificationManifests({ check: true, outputDirectory });
    outcomes.push({ scenario: scenario.name, dependency: scenario.path, invalidated, unrelatedUnchanged: baseline.length - invalidated.length,
      staleReviewRejected: true, restoredSourceRechecked: true });
  }
} finally { process.chdir(root); rmSync(temporary, { recursive: true, force: true }); }
const report = { status: 'pass', dependencyManifests: original, scope: 'Actual isolated file changes invalidate exactly their current world dependency receipts. No automatic review or ledger reset.', outcomes };
const reportFlag = process.argv.indexOf('--report');
const output = resolve(reportFlag >= 0 ? process.argv[reportFlag + 1] : 'docs/qa/artifacts/r100-i05-qualification/dependency-invalidation.json');
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log('PASS native qualification invalidation: shared asset, geometry and grade rules; real files changed, stale evidence rejected, exact source restoration rechecked');
