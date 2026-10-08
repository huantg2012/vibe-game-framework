/** Preserve exact historical QA source bytes. Does not execute or amend old evidence. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const base = 'docs/qa/artifacts/r100-i10-i12/closeout-independent-review';
const output = `${base}/historical-generation-harness-supplement.json`;
assert(!fs.existsSync(output), 'Never overwrite a receipt');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = file => ({path:file,sha256:hash(fs.readFileSync(file))});
function read(reference) {
  const bytes = fs.readFileSync(reference.path);
  assert.equal(hash(bytes),reference.sha256,`Changed evidence: ${reference.path}`);
  return JSON.parse(bytes);
}
const historicalBinding = receipt('docs/qa/artifacts/r100-i07-i09/final-binding/plan.json');
const oldPlan = read(historicalBinding), summary = read(oldPlan.generation);
const candidateCommand = ['--files','-uuu','-g','check-r100-library.ts','docs/qa','tools'];
const candidateResult = spawnSync('rg',candidateCommand,{encoding:'utf8'});
assert.equal(candidateResult.status,0,candidateResult.error?.message ?? candidateResult.stderr);
const candidateFiles = candidateResult.stdout.split('\n').filter(file=>file.endsWith('/check-r100-library.ts')).sort();
const candidateReceipts = candidateFiles.map(receipt);
const captured = new Map(), mappings = [];
for (const originalSource of oldPlan.generationSources) {
  const source = read(originalSource);
  const group = summary.groups.find(row=>row.id===originalSource.groupId); assert(group);
  const harnessSources = [];
  for (const dependency of group.dependencies.filter(row=>row.path.startsWith('tools/'))) {
    const originalPath = path.join(source.temporaryRoot,dependency.path);
    const bytes = fs.readFileSync(originalPath);
    assert.equal(hash(bytes),dependency.sha256,`Historical tool differs: ${originalPath}`);
    const existing = candidateReceipts.find(row=>row.sha256===dependency.sha256);
    let destination = existing?.path;
    if (!destination) {
      destination = `${base}/generation-harness-sources/${dependency.sha256}/${path.basename(dependency.path)}`;
      if (!captured.has(dependency.sha256)) {
        fs.mkdirSync(path.dirname(destination),{recursive:true});
        fs.writeFileSync(destination,bytes,{flag:'wx'});
      }
    }
    const stored = receipt(destination); assert.equal(stored.sha256,dependency.sha256);
    assert.equal(hash(fs.readFileSync(originalPath)),dependency.sha256,'Original changed during copy');
    captured.set(dependency.sha256,{...stored,method:existing?'reuse-exact-existing-repository-file':'copy-exact-original-temporary-file'});
    harnessSources.push({dependencyPath:dependency.path,...stored});
    mappings.push({groupId:originalSource.groupId,originalSource:{path:originalSource.path,sha256:originalSource.sha256},
      dependencyPath:dependency.path,originalTemporaryFile:originalPath,expectedSha256:dependency.sha256,
      stored,method:existing?'reuse-exact-existing-repository-file':'copy-exact-original-temporary-file',
      originalSourceManifestContainsHarness:Object.hasOwn(source.sources,dependency.path)});
  }
  assert.equal(harnessSources.length,1);
  originalSource.harnessSources = harnessSources;
}
assert.equal(oldPlan.generationSources.length,11); assert.equal(captured.size,2);
const report={schemaVersion:1,status:'preserved-exact-historical-qa-source-not-runtime-execution',createdAt:new Date().toISOString(),
  reviewer:'i12_qa',featureIds:['COH-F052'],historicalBinding,historicalGeneration:oldPlan.generation,
  proposedFinalPlanField:'historicalGenerationSources',historicalGenerationSources:oldPlan.generationSources,
  preservedFiles:[...captured.values()],mappings,candidateScan:{command:['rg',...candidateCommand],
    selection:'Files ending /check-r100-library.ts',files:candidateReceipts},
  binderIntegration:{status:'code-change-required',source:receipt('tools/qa/r100-bind-i10-i12.mjs'),
    requirement:'Accept this explicitly bound historicalGenerationSources list only when each groupId/path/sha256 matches the immutable historicalBinding.generationSources; require exact dependencyPath coverage and source bytes against historical raw generation dependency hashes. Do not silently fall back to temporary roots for final plans that supply it.'},
  scope:'Exact archival copying and current SHA verification only. Original manifests, raw attempts, summaries, compiled executors and source trees remain unchanged. These QA tools are explicit supplementary artifacts, never represented as members of the original 35 source-manifest closures.',
  limitations:['No qualification re-executed','No game or browser launched','Historical source approval/continuity unchanged','Final binder consumption remains pending Code/root integration'],
  priorFailedPreparation:receipt(`${base}/harness-preservation-attempt1.json`),
  self:receipt(`${base}/preserve-historical-harnesses.mjs`)};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,groups:oldPlan.generationSources.length,files:[...captured.values()],report:receipt(output)},null,2));
