import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { WORLD_PACKAGES } from '../../src/generated/rift-world-package-data';
import { isPollutionGrade, validatePollutionGradeDefinitions } from '../../src/generation/world-study/pollution-grade';
import { validateWorldPackage, validateWorldPackageManifest, worldPackageMatchesInstalled } from '../../src/generation/world-study/world-package';
import { collectWorldPackageManifest, generateWorldPackages, parsePollutionGradeCsv, parseWorldPackageCsv,
  readWorldPackageCompilerContext, sha256, verifyWorldPackageManifest, WORLD_PACKAGE_MANIFEST_PATH } from './codegen-world-packages';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const csv = readFileSync(resolve(ROOT, 'data/rift-world-packages.csv'), 'utf8');
const gradeCsv = readFileSync(resolve(ROOT, 'data/rift-pollution-grades.csv'), 'utf8');
const manifest = collectWorldPackageManifest(ROOT);
const context = { ...readWorldPackageCompilerContext(ROOT), dependencyHash: manifest.hash };
const checks: string[] = [];
function check(name: string, body: () => void): void { body(); checks.push(name); }

check('CSV compiles to installed DEV descriptors and canonical dependency manifest', () => {
  const result = generateWorldPackages({ root: ROOT, check: true });
  assert.equal(result.packages, WORLD_PACKAGES.length);
  assert.deepEqual(parseWorldPackageCsv(csv, context), WORLD_PACKAGES);
  assert.deepEqual(parsePollutionGradeCsv(gradeCsv), POLLUTION_GRADE_DEFINITIONS);
  assert.deepEqual(JSON.parse(readFileSync(resolve(ROOT, WORLD_PACKAGE_MANIFEST_PATH), 'utf8')), manifest);
  verifyWorldPackageManifest(manifest, ROOT);
});
check('Three map grades are distinct from age, entity coverage and personal chaos', () => {
  for (const grade of ['low', 'medium', 'severe']) assert.ok(isPollutionGrade(grade));
  for (const grade of ['new', 'standard', 'ancient', 'intact', 'broken', 0, 100, undefined, null])
    assert.equal(isPollutionGrade(grade), false);
  assert.throws(() => parsePollutionGradeCsv(gradeCsv.replace('severe,1,', 'ancient,1,')));
  assert.throws(() => parsePollutionGradeCsv(gradeCsv.replace(/severe,1,[^\n]+\n?/, '')));
  assert.throws(() => parsePollutionGradeCsv(`${gradeCsv.trim()}\n${gradeCsv.split('\n')[1]}\n`));
  assert.throws(() => parsePollutionGradeCsv(gradeCsv.replace('severe,1,', 'severe,2,')));
  assert.throws(() => parsePollutionGradeCsv(gradeCsv.replace('contract-only', 'production')));
  assert.throws(() => validatePollutionGradeDefinitions([{ ...POLLUTION_GRADE_DEFINITIONS[0], chaos: 10 },
    ...POLLUTION_GRADE_DEFINITIONS.slice(1)]));
});
check('Legacy demos cannot claim new-world eligibility, active grades or production scope', () => {
  for (const entry of WORLD_PACKAGES) {
    validateWorldPackage(entry);
    assert.equal(entry.origin, 'legacy-demo');
    assert.equal(entry.scope, 'dev-contract');
    assert.deepEqual(Object.keys(entry.grades), ['low', 'medium', 'severe']);
    for (const grade of Object.values(entry.grades)) assert.equal(grade.implementation, 'unimplemented');
  }
  assert.throws(() => parseWorldPackageCsv(csv.replace('dev-contract', 'production'), context));
  assert.throws(() => parseWorldPackageCsv(csv.replace('legacy-demo', 'qualified'), context));
  const baseline = WORLD_PACKAGES[0]!;
  assert.throws(() => validateWorldPackage({ ...baseline, grades: { ...baseline.grades, severe: {
    definitionVersion: 1, implementation: 'implemented' } } }));
  assert.throws(() => validateWorldPackage({ ...baseline, eligible: true }));
});
check('Unknown, duplicate, incompatible and unavailable capability versions reject', () => {
  assert.throws(() => parseWorldPackageCsv(csv.replace('surface:strata@1', 'water:refraction@1'), context));
  assert.throws(() => parseWorldPackageCsv(csv.replace('surface:strata@1', 'surface:strata@2'), context));
  assert.throws(() => parseWorldPackageCsv(csv.replace('surface:strata@1', 'surface:strata@1;surface:strata@1'), context));
  assert.throws(() => parseWorldPackageCsv(csv.replace('surface:strata@1', 'surface:glaze@1'), context));
  assert.throws(() => parseWorldPackageCsv(csv.replace('field:direction@1;', ''), context));
  assert.throws(() => parseWorldPackageCsv(csv, { ...context, programs: context.programs.map(program => ({ ...program,
    requires: ['space:multilevel'] })) }));
  assert.throws(() => parseWorldPackageCsv(csv, { ...context, programs: context.programs.map(program => ({ ...program,
    excludes: ['support:single-plane'] })) }));
});
check('Missing grades, unknown references, duplicate world identities and malformed CSV reject', () => {
  for (const [before, after] of [
    ['low;medium;severe', 'low;medium'], ['low;medium;severe', 'low;medium;medium'],
    ['open-scars;fracture-fields', 'nonexistent-space'], ['layered-deposition;', 'nonexistent-process;'],
    ['frag-library', 'nonexistent-fragment'], ['world-production,2', 'world-production,3'],
    ['world-production,2', 'unknown-executor,2'], ['profile_id', 'profile'],
  ]) assert.throws(() => parseWorldPackageCsv(csv.replace(before!, after!), context));
  assert.throws(() => parseWorldPackageCsv(`${csv.trim()}\n${csv.split('\n')[1]}\n`, context));
  assert.throws(() => parseWorldPackageCsv(csv.replace('legacy-crystal-fibre,crystal-fibre,crystal-fibre',
    'legacy-crystal-fibre,ash-strata,ash-strata'), context));
  assert.throws(() => parseWorldPackageCsv(csv, { ...context, profiles: [] }));
});
check('Exact installed version identity survives serialization but rejects tampering and substitution', () => {
  const baseline = WORLD_PACKAGES[0]!;
  assert.ok(worldPackageMatchesInstalled(clone(baseline), baseline));
  assert.ok(worldPackageMatchesInstalled(Object.fromEntries(Object.entries(baseline).reverse()), baseline));
  for (const changed of [
    { ...baseline, schemaVersion: 2 }, { ...baseline, algorithm: { ...baseline.algorithm, version: 3 } },
    { ...baseline, sourceHash: '0'.repeat(64) }, { ...baseline, gradeSourceHash: '0'.repeat(64) },
    { ...baseline, dependencyHash: '0'.repeat(64) }, { ...baseline, id: 'replacement-package' },
    { ...baseline, grades: { low: baseline.grades.low, medium: baseline.grades.medium } },
    { ...baseline, grades: { ...baseline.grades, severe: { definitionVersion: 2, implementation: 'unimplemented' } } },
    { ...baseline, sourceHash: '../escape' }, null, [],
  ]) assert.equal(worldPackageMatchesInstalled(changed, baseline), false);
  assert.equal(worldPackageMatchesInstalled(WORLD_PACKAGES[1], baseline), false);
});
check('Dependency manifest rejects scope escalation, hash tampering, traversal and duplicate paths', () => {
  assert.throws(() => verifyWorldPackageManifest({ ...manifest, hash: '0'.repeat(64) }, ROOT));
  assert.throws(() => validateWorldPackageManifest({ ...manifest, scope: 'all-art-approved' }));
  assert.throws(() => validateWorldPackageManifest({ ...manifest, dependencies: [{ path: 'data/../escape', sha256: '0'.repeat(64) }] }));
  assert.throws(() => validateWorldPackageManifest({ ...manifest, dependencies: [{ path: '/tmp/escape', sha256: '0'.repeat(64) }] }));
  assert.throws(() => validateWorldPackageManifest({ ...manifest, dependencies: [manifest.dependencies[0], manifest.dependencies[0]] }));
});
check('Real source mutation and newly imported dependency invalidate a previously compiled package', () => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), 'coh-r100-package-'));
  try {
    for (const dependency of manifest.dependencies) {
      const destination = resolve(temporaryRoot, dependency.path);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(ROOT, dependency.path), destination);
    }
    assert.equal(collectWorldPackageManifest(temporaryRoot).hash, manifest.hash);
    const dialectsPath = resolve(temporaryRoot, 'data/contamination-dialects.csv');
    const dialects = readFileSync(dialectsPath, 'utf8');
    const libraryRow = dialects.split('\n').find(row => row.startsWith('frag-library,'))!;
    writeFileSync(dialectsPath, `${dialects.trim()}\n${libraryRow.replace('frag-library,', 'frag-uncompiled,')}\n`);
    assert.throws(() => readWorldPackageCompilerContext(temporaryRoot), /Dialect CSV and installed/);
    writeFileSync(dialectsPath, dialects.replace(libraryRow, libraryRow.replace(/,([0-9]+),/, ',999,')));
    assert.throws(() => readWorldPackageCompilerContext(temporaryRoot), /Dialect CSV and installed|Inconsistent/);
    writeFileSync(dialectsPath, dialects);
    assert.deepEqual(readWorldPackageCompilerContext(temporaryRoot).fragmentIds, context.fragmentIds);
    const gradesPath = resolve(temporaryRoot, 'data/rift-pollution-grades.csv');
    writeFileSync(gradesPath, gradeCsv.replace('近崩溃', '完全崩溃'));
    assert.throws(() => verifyWorldPackageManifest(manifest, temporaryRoot), /changed/);
    writeFileSync(gradesPath, gradeCsv);
    const productionPath = resolve(temporaryRoot, 'src/generation/world-study/production-map.ts');
    const changedSource = `import './added-dependency';\n${readFileSync(productionPath, 'utf8')}`;
    writeFileSync(productionPath, changedSource);
    writeFileSync(resolve(dirname(productionPath), 'added-dependency.ts'), 'export const version = 1;\n');
    const forged = { ...manifest, dependencies: manifest.dependencies.map(dependency => dependency.path.endsWith('/production-map.ts')
      ? { ...dependency, sha256: sha256(changedSource) } : dependency) };
    forged.hash = sha256(JSON.stringify(forged.dependencies));
    assert.throws(() => verifyWorldPackageManifest(forged, temporaryRoot), /changed/);
    assert.ok(collectWorldPackageManifest(temporaryRoot).dependencies.some(dependency => dependency.path.endsWith('/added-dependency.ts')));
  } finally { rmSync(temporaryRoot, { recursive: true, force: true }); }
});

console.log(JSON.stringify({ result: 'pass', checks, packages: WORLD_PACKAGES.length, activeGradedWorlds: 0,
  dependencyHash: manifest.hash, dependencyFiles: manifest.dependencies.length,
  limitations: ['DEV contract only; no grade gameplay, art approval or production selection enabled.',
    'Source closure is conservative; an unchanged fingerprint is not a gameplay/art qualification.',
    'Exact package comparison does not supply a frozen old-version executor or migrate saves.'] }, null, 2));
