import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {caseInventory} from '../../../../../../tools/qa/check-r100-i10-i12-final-binding.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd(), tracked = new Map();
const sha = value => createHash('sha256').update(value).digest('hex');
const receipt = file => {const relative = path.relative(root, path.resolve(file)), value = fs.readFileSync(relative); tracked.set(relative, value); return {path: relative, sha256: sha(value)};};
const read = file => {receipt(file); return JSON.parse(fs.readFileSync(file));};
const checker = receipt('tools/qa/check-r100-i10-i12-final-binding.mjs');
const binder = receipt('tools/qa/r100-bind-i10-i12.mjs');
const preparedRef = receipt(path.join(here, 'prepared-only-v3.json')), prepared = read(preparedRef.path);
assert.equal(prepared.status, 'prepared-only'); assert.equal(prepared.baseline.status, 'not-run');
assert.deepEqual(prepared.checker, checker); assert.deepEqual(prepared.binder, binder);
assert.deepEqual(prepared.cases, caseInventory()); assert.equal(prepared.caseCount, 89);
assert.equal(prepared.checks.length, 10); assert(prepared.checks.every(row => row.status === 'pass'));
const oldVersions = [['prepared-only.json', 'checker-prepared-v1.mjs'], ['prepared-only-v2.json', 'checker-prepared-v2.mjs']]
  .map(([report, source]) => {
    const reportRef = receipt(path.join(here, report)), value = read(reportRef.path), sourceRef = receipt(path.join(here, source));
    assert.equal(value.checker.sha256, sourceRef.sha256);
    return {report: reportRef, exactArchivedChecker: sourceRef, disposition: 'Retained preparation revision; not the executable selected for final actual checks.'};
  });
const gapRef = receipt(path.join(here, 'harness-path-gap.json')), gap = read(gapRef.path);
assert.equal(gap.status, 'confirmed-validator-gap');
const fixRef = receipt(path.join(here, 'harness-path-fix-independent-review.json')), fix = read(fixRef.path);
assert.deepEqual(fix.binder, binder); assert.equal(fix.results.length, 4);
assert(fix.results.every(row => row.correctMetadata === 'accepted' && row.resealedWrongMethod === 'rejected'));
const contractRefs = ['final-artifact-contract.json', 'final-execution-order.json', 'final-readiness-supplement-review-shapes.json', 'final-compatibility-supplement.json']
  .map(file => receipt(`docs/qa/artifacts/r100-i10-i12/${file}`));
const source = read(checker.path.replace('tools/qa/check-r100-i10-i12-final-binding.mjs', 'docs/qa/artifacts/r100-i10-i12/final-source/source-snapshot.json'));
assert.equal(Object.keys(source.sources).length, 1397);
const report = {version: 1, status: 'prepared-only', at: new Date().toISOString(), featureIds: ['F052', 'F044', 'F005'],
  ownership: 'New QA checker and this independent-review directory only; no product data/source, frozen runtime harness, binder, source manifest, original evidence, progress ledger or approval file was written by this preparation.',
  checker, binder, contracts: contractRefs, preparation: preparedRef,
  actualFinalBaseline: {status: 'not-run', reason: 'Actual final runtime reports and independent final reviews must all exist before the first dry buildProposal baseline.'},
  actualSemanticNegativeMatrix: {status: 'not-run', requiredCases: 89,
    axes: Object.fromEntries([...new Set(prepared.cases.map(row => row.axis))].map(axis => [axis, prepared.cases.filter(row => row.axis === axis).length]))},
  completedLightChecks: {syntax: {command: ['node', '--check', checker.path], exitCode: 0},
    infrastructureFixtures: {count: 10, status: 'pass-small-fixtures-only'}, harnessMethodFix: {positive: 4, negative: 4, review: fixRef}},
  retainedFinding: {review: gapRef, resolution: 'Root added the four known method-to-harness path constraints before existing byte validation; independent fresh metadata checks reject each resealed wrong method.'},
  failClosedProperties: [
    'Unchanged real final108 buildProposal must first produce qualified108, production324, humanApproved0 and exact 7488/8064/2592/648 accounting.',
    'Every negative starts from original cached disk bytes and a separate cloned plan; only in-memory overlays of existing files are allowed.',
    'Changed report/source SHA references are resealed through runtime, Shader, technical and inheritance consumers to reach the intended semantic predicate.',
    'Setup errors, missing inputs, stale hashes, TypeErrors, accepted corruption and wrong innermost validator failures are never credited as passing negatives.',
    'The original ledger, all actually consumed repository files and frozen1397 source bytes are checked for preservation; a new output path is mandatory.',
    'No browser or gameplay execution and no ledger write is present in the checker. A dry proposal is not independent runtime or human/audio approval.',
  ],
  genuineDataBoundary: prepared.policy16Boundary,
  previousPreparationVersions: oldVersions,
  developmentChanges: [
    'v2 strengthened rejection classification so a buildProposal caller on an unrelated guard stack cannot masquerade as the intended failure; added a tenth infrastructure fixture.',
    'v3 calculates the deliberately short budget duration from its mutated start/end values, avoiding an incidental floating-point duration mismatch instead of the intended under60s rejection.',
    'These were checker preparation improvements. No actual final baseline or semantic negative matrix had run; v1/v2 reports and exact checker bytes remain archived.',
  ],
  suggestedActualCommand: ['node', checker.path, '--plan', 'docs/qa/artifacts/r100-i10-i12/final-binding/plan.json',
    '--output', 'docs/qa/artifacts/r100-i10-i12/closeout-independent-review/final-binding-actual/negative-check.json'],
  dispatchCondition: 'Root supplies the completed reviewed actual final plan and a suitable CPU window. If its path differs, use that explicit path. Do not fill missing runtime reports with fixtures.',
  limitation: 'Successful infrastructure preparation does not establish that all89 definitions will reject the final actual evidence correctly. The real baseline and each negative must still be run and reviewed.',
  inspectedInputs: [...tracked].map(([file, value]) => ({path: file, sha256: sha(value)})), inspectedInputsUnchanged: true};
for (const [file, value] of tracked) assert(fs.readFileSync(file).equals(value), `Preparation input changed: ${file}`);
const output = path.join(here, 'preparation-review.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, output: path.relative(root, output), sha256: sha(fs.readFileSync(output)), checker}));
