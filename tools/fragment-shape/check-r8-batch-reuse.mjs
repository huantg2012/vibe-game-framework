/** Bind already tested unchanged worlds to a later author-data-only batch. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createR100ProductionRecipe, validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
const mode = process.argv[2];
assert(['capture', 'verify'].includes(mode), 'Usage: check-r8-batch-reuse.mjs capture|verify');
const matrixPath = process.env.QA_MATRIX_REPORT;
const sourcePath = process.env.QA_REUSE_INPUTS;
const reportPath = process.env.QA_REPORT;
assert(matrixPath && sourcePath && (mode === 'capture' || reportPath));
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
assert.equal(matrix.status, 'passed');
const hash = value => createHash('sha256').update(value).digest('hex');
const generatedSources = ['src/generated/r100-fragment-data.ts', 'src/generated/r100-spatial-data.ts'];
const runtimeHashes = Object.fromEntries(Object.entries(matrix.sourceHashes).filter(([file]) => file.startsWith('src/')));
for (const [file, expected] of Object.entries(runtimeHashes)) {
  if (mode === 'verify' && generatedSources.includes(file)) continue;
  assert.equal(hash(fs.readFileSync(file)), expected, `Runtime input no longer matches original admission matrix: ${file}`);
}
function withoutGlobalReceipts(recipe) {
  const normalized = structuredClone(recipe);
  delete normalized.spatialPolicy.sourceHash;
  delete normalized.spatialPolicy.fragmentShape.sourceHash;
  delete normalized.package.dependencyHash;
  return normalized;
}
if (mode === 'capture') {
  assert(!fs.existsSync(sourcePath), 'Never overwrite captured source inputs');
  const worlds = (process.env.QA_WORLDS ?? 'ash-strata,shell-chain,pale-sail').split(',');
  const selected = matrix.cases.filter(item => worlds.includes(item.worldId));
  assert.equal(selected.length, worlds.length * matrix.selectedSeeds.length * matrix.selectedGrades.length);
  const cases = selected.map(item => {
    const recipe = createR100ProductionRecipe(item.worldId, item.seed, item.grade);
    assert(validR100ProductionRecipe(recipe));
    return {worldId: item.worldId, seed: item.seed, grade: item.grade, priorShapeHash: item.shapeHash, priorSupportHash: item.supportHash, priorRgbaHashes: item.rgbaHashes, recipe};
  });
  const snapshot = {status: 'captured', createdAt: new Date().toISOString(), matrixPath, matrixFileHash: hash(fs.readFileSync(matrixPath)), runtimeHashes, cases};
  fs.mkdirSync(path.dirname(sourcePath), {recursive: true});
  fs.writeFileSync(sourcePath, JSON.stringify(snapshot, null, 2) + '\n', {flag: 'wx'});
  console.log(`Captured ${cases.length} actual recipes from the exact runtime source of the existing matrix`);
} else {
  assert(!fs.existsSync(reportPath), 'Never overwrite reuse evidence');
  const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  assert.equal(snapshot.matrixFileHash, hash(fs.readFileSync(matrixPath)), 'Prior matrix was changed');
  assert.deepEqual(snapshot.runtimeHashes, runtimeHashes, 'Prior runtime binding changed');
  const cases = snapshot.cases.map(item => {
    assert(validR100ProductionRecipe(item.recipe), 'Saved stage-one recipe no longer validates');
    const current = createR100ProductionRecipe(item.worldId, item.seed, item.grade);
    assert(validR100ProductionRecipe(current));
    assert.deepEqual(withoutGlobalReceipts(current), withoutGlobalReceipts(item.recipe), `${item.worldId}/${item.seed}/${item.grade}: tested runtime inputs changed`);
    return {worldId: item.worldId, seed: item.seed, grade: item.grade, allInputsEqualExceptGlobalSourceReceipts: true, priorShapeHash: item.priorShapeHash, priorSupportHash: item.priorSupportHash, priorRgbaHashes: item.priorRgbaHashes};
  });
  const currentGeneratedHashes = Object.fromEntries(generatedSources.map(file => [file, hash(fs.readFileSync(file))]));
  const report = {status: 'passed', createdAt: new Date().toISOString(), matrixPath, matrixFileHash: snapshot.matrixFileHash, sourcePath, sourceFileHash: hash(fs.readFileSync(sourcePath)), unchangedRuntimeHashes: Object.fromEntries(Object.entries(runtimeHashes).filter(([file]) => !generatedSources.includes(file))), currentGeneratedHashes, excludedFields: ['spatialPolicy.sourceHash', 'spatialPolicy.fragmentShape.sourceHash', 'package.dependencyHash'], cases, scope: 'The existing complete-map/material matrix is reusable for these exact world+seed+grade inputs because all generation/render execution sources and complete recipes are unchanged except three global provenance receipts. This comparison does not relabel the prior run date or claim a new rendering run.'};
  fs.mkdirSync(path.dirname(reportPath), {recursive: true});
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(`PASS ${cases.length} prior admissions bound to unchanged current world inputs`);
}
