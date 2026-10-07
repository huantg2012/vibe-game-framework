/** Pure report validation against immutable, real prior52 evidence. No game or browser.
 * Mutations are in-memory negatives, never replacement runtime qualifications. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateFinalReport } from './r100-i09-final-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sha = file => createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex');
const files = {
  budget: 'docs/qa/artifacts/r100-i09/runtime-budget-final52/report.json',
  lifecycle: 'docs/qa/artifacts/r100-i09/lifecycle-final52/report.json',
};
const inputs = Object.entries(files).map(([kind, file]) => ({ kind, path: file, sha256: sha(file) }));
const originals = Object.fromEntries(Object.entries(files).map(([kind, file]) => [kind, JSON.parse(fs.readFileSync(path.resolve(ROOT, file)))]));
const validate = (kind, report) => validateFinalReport(kind, report,
  kind === 'budget' ? originals.budget.worlds : originals.lifecycle.catalogWorldIds, [], 5);
const positives = Object.entries(originals).map(([kind, report]) => ({ kind, result: validate(kind, report) }));
assert.equal(positives[1].result.independentShaderReview, 'pending-separate-receipt', 'Numeric pass cannot grant the separate independent review');
const failures = [
  ['budget', 'frame P95 exceeds original threshold', r => { r.cases[0].frames.p95 = 21; r.cases[0].frames.p99 = 22; r.cases[0].frames.max = 23; }],
  ['budget', 'frame P99 exceeds original threshold', r => { r.cases[0].frames.p99 = 34; r.cases[0].frames.max = 35; }],
  ['budget', 'long-frame fraction exceeds original threshold', r => r.cases[0].frames.over50 = .006],
  ['budget', 'CPU P95 exceeds original threshold', r => { r.cases[0].cpu.p95 = 13; r.cases[0].cpu.p99 = 14; r.cases[0].cpu.max = 15; }],
  ['budget', 'material P95 exceeds original threshold', r => { r.cases[0].materialSubmit.p95 = 3.01; r.cases[0].materialSubmit.p99 = 4; r.cases[0].materialSubmit.max = 5; }],
  ['budget', 'wrong frozen seed', r => r.cases[0].seed = 1],
  ['budget', 'empty frame sample', r => r.cases[0].frames.count = 0],
  ['budget', 'nonfinite measured value', r => r.cases[0].cpu.p95 = NaN],
  ['budget', 'reversed quantiles', r => r.cases[0].frames.p50 = r.cases[0].frames.max + 1],
  ['budget', 'forged duration boolean', r => r.cases[0].duration = 60000],
  ['budget', 'short alive clock with coherent duration', r => { r.cases[0].end.elapsedMs = r.cases[0].start.elapsedMs + 59000; r.cases[0].duration = 59000; r.cases[0].positions = r.cases[0].positions.map(p => ({ ...p, elapsedMs: r.cases[0].start.elapsedMs })); }],
  ['budget', 'terminal death despite passed flag', r => r.cases[0].end.ended = true],
  ['budget', 'wrong actual runtime grade', r => r.cases[0].start.pollutionGrade = 'low'],
  ['budget', 'missing held-key observation', r => r.cases[0].positions.pop()],
  ['budget', 'missing exclusive declaration', r => r.exclusiveWindow = false],
  ['lifecycle', 'empty GC samples', r => r.samples = []],
  ['lifecycle', 'missing GC sample', r => r.samples.splice(2, 1)],
  ['lifecycle', 'duplicate GC label', r => r.samples[2].label = r.samples[1].label],
  ['lifecycle', 'wrong mixed requested seed', r => r.mixedCoverage[0].seed++],
  ['lifecycle', 'coherently reordered catalog changes fixed seed ownership', r => {
    [r.catalogWorldIds[0], r.catalogWorldIds[1]] = [r.catalogWorldIds[1], r.catalogWorldIds[0]];
    r.mixedCoverage = ['low', 'medium', 'severe'].flatMap((grade, g) => r.catalogWorldIds.map((world, w) =>
      ({ world, grade, seed: 20261004 + g * r.catalogWorldIds.length + w })));
  }],
  ['lifecycle', 'duplicate mixed identity', r => r.mixedCoverage[1] = r.mixedCoverage[0]],
  ['lifecycle', 'nonfinite memory', r => r.samples[1].usage.usedSize = NaN],
  ['lifecycle', 'forged reported heap delta', r => r.samples.at(-1).usedHeapGrowth = 0],
  ['lifecycle', 'retained heap grows to original limit', r => { const s = r.samples.at(-1); s.usage.usedSize = r.samples[0].usage.usedSize + 10 * 1024 * 1024; s.usage.totalSize = s.usage.usedSize + 100; s.usedHeapGrowth = 10 * 1024 * 1024; }],
  ['lifecycle', 'retained backing grows to original limit', r => { const s = r.samples.at(-1); s.usage.backingStorageSize = r.samples[0].usage.backingStorageSize + 10 * 1024 * 1024; s.backingGrowth = 10 * 1024 * 1024; }],
  ['lifecycle', 'Shader active and live growth', r => { const s = r.samples.at(-1).objects.Shader; s.active++; s.live++; }],
  ['lifecycle', 'deleted Shader wrapper retention', r => r.samples.at(-1).objects.Shader.live++],
  ['lifecycle', 'cumulative counter decreases', r => r.samples.at(-1).objects.Shader.created = r.samples[0].objects.Shader.created],
  ['lifecycle', 'impossible count domain', r => r.samples.at(-1).objects.Buffer.active = -1],
  ...['WebGL2', 'Texture', 'Buffer', 'Program', 'Framebuffer', 'Renderbuffer'].map(kind =>
    ['lifecycle', `${kind} active growth`, r => { const s = r.samples.at(-1).objects[kind]; s.active++; s.live = Math.max(s.live, s.active); }]),
];
const negatives = [];
for (const [kind, name, mutate] of failures) {
  const report = structuredClone(originals[kind]); mutate(report);
  let failure;
  try { validate(kind, report); } catch (error) { failure = String(error); }
  assert(failure, `Invalid cloned real report was accepted: ${kind}/${name}`);
  negatives.push({ kind, name, rejected: true, failure });
}
for (const ref of inputs) assert.equal(sha(ref.path), ref.sha256, 'Original evidence bytes must remain unchanged');
const report = { status: 'pass', method: 'Pure validation of original real52 baselines and in-memory corrupted clones; no runtime or final108 claim.',
  sources: ['tools/qa/r100-i09-final-probe.mjs', 'tools/qa/check-r100-runtime-report-contract.mjs'].map(file => ({ path: file, sha256: sha(file) })),
  inputs, positives, negatives, originalReportsUnchanged: true,
  limitation: 'The independent Shader receipt remains required by final technical/closure. Numeric data validation does not grant that review or prove resource exclusivity.' };
const index = process.argv.indexOf('--output');
if (index !== -1) {
  assert(process.argv[index + 1]); const output = path.resolve(ROOT, process.argv[index + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ status: report.status, originalRealBaselines: positives.length, rejectedMutations: negatives.length, originalReportsUnchanged: true }));
