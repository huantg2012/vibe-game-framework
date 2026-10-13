/** Synthetic interrupted-receipt witness. Does not mutate production or original evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectEvidence} from '../../../../../tools/world-upgrades-rollout/build-gallery.mjs';

const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const source = path.join(repo, 'docs/qa/artifacts/world-upgrades-rollout-2026-10-12/b02-cleft-r10-final');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-review-unfinished-'));
try {
  const receipt = JSON.parse(fs.readFileSync(path.join(source, 'report.json'), 'utf8'));
  receipt.worlds = ['monolith-sill'];
  receipt.cases = receipt.cases.filter(row => row.worldId === 'monolith-sill');
  receipt.failures = [];
  // check-batch writes this state after each case, before its final cross-grade gate.
  receipt.status = 'running';
  receipt.cases.find(row => row.grade === 'medium').shapeHash = 'synthetic-cross-grade-difference';
  for (const row of receipt.cases) {
    fs.symlinkSync(path.join(source, row.images), path.join(temporary, row.images), 'dir');
  }
  fs.writeFileSync(path.join(temporary, 'report.json'), JSON.stringify(receipt));
  const result = collectEvidence(temporary, [{id:'monolith-sill', label:'Synthetic interruption witness'}]);
  const witness = {
    synthetic: true,
    scope: 'One world, three saved per-case receipts; no production map generation.',
    receiptStatus: receipt.status,
    distinctShapeHashes: new Set(receipt.cases.map(row => row.shapeHash)).size,
    verifiedGradeCells: result.verifiedGradeCells,
    complete: result.complete,
    issues: result.issues,
    failures: result.currentFailures,
  };
  console.log(JSON.stringify(witness, null, 2));
  assert.equal(witness.distinctShapeHashes, 2);
  assert.equal(witness.complete, true, 'Bug no longer reproduces: interrupted receipt is rejected');
  assert.equal(witness.verifiedGradeCells, 3);
  assert.deepEqual(witness.issues, []);
} finally {
  fs.rmSync(temporary, {recursive:true, force:true});
}
