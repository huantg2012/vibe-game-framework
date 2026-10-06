/** Copies of an actual telemetry mismatch; mutations are accounting tests only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {reconcileTerminalPickups} from './r100-observed-searches.mjs';

const source = 'docs/qa/artifacts/r100-i07-i09/legacy20-play-recheck-077-078-v13/001-pressed-dunes-severe-20261005/report.json';
const bytes = fs.readFileSync(source), original = JSON.parse(bytes).realJourneyAttempts[0];
assert.equal(original.searches.filter(search => search.collected).length, 0);
const actual = reconcileTerminalPickups(original);
assert.deepEqual(actual.map(row => row.id).sort(), ['r100-contaminant-deep-2', 'r100-kindling-deep-1']);
assert.equal(original.fieldResult.carried, 12);
const results = [{name: 'actual-late-and-adjacent-pickups', status: 'pass'}];
const run = row => row.afterReturn.state.inventory.run;
function check(name, mutate, absent = actual.map(row => row.id)) {
  const copy = structuredClone(original); mutate(copy);
  const found = reconcileTerminalPickups(copy).map(row => row.id);
  assert(absent.every(id => !found.includes(id)), `${name}: invalid pickup was credited`);
  results.push({name, status: 'pass'});
}
check('no-actual-E-attempt', row => row.searches = []);
check('different-run', row => run(row).id = 'another-run');
check('already-settled-at-entry', row => row.entrySave.state.inventory.run.status = 'settled');
check('unsettled-return', row => run(row).baseSettled = false);
check('death-is-not-a-return', row => row.outcome = 'death');
check('missing-terminal-transition', row => row.entryState.nodes.forEach(node => node.collected = true));
check('relocated-node-does-not-match-entry', row => row.fieldResult.nodes.forEach(node => node.pos.x++));
check('entry-pickup-does-not-qualify', row => {
  row.entryState.pos = {x: 916, y: 196};
});
const nearby = structuredClone(original); nearby.entryState.pos = {x: 916, y: 196};
assert.equal(reconcileTerminalPickups(nearby, {includeNearEntry: true}).length, 2,
  'I09 must count incidental near-entry pickups toward its total three-pickup cap');
assert.equal(reconcileTerminalPickups(nearby).length, 0, 'Fixed qualification remains non-entry only');
results.push({name: 'explicit-I09-near-entry-count-does-not-change-default-qualification', status: 'pass'});
check('duplicate-node-id', row => row.fieldResult.nodes.push(row.fieldResult.nodes[0]));
check('no-kindling-credit', row => run(row).kindlingGained = 0, ['r100-kindling-deep-1']);
check('existing-kindling-cannot-be-recredited', row => row.entryState.carried = 12, ['r100-kindling-deep-1']);
check('no-reveal', row => run(row).revealedNodes = {}, ['r100-contaminant-deep-2']);
check('revealed-but-not-returned', row => run(row).returnedIds = [], ['r100-contaminant-deep-2']);
check('returned-id-without-stash-item', row => {
  row.afterReturn.state.inventory.items = row.afterReturn.state.inventory.items.filter(item => !run(row).returnedIds.includes(item.id));
}, ['r100-contaminant-deep-2']);
check('stash-item-from-other-run', row => {
  row.afterReturn.state.inventory.items.find(item => run(row).returnedIds.includes(item.id)).source.runId = 'other-run';
}, ['r100-contaminant-deep-2']);
check('existing-item-not-new-loot', row => {
  row.entrySave.state.inventory.items.push(row.afterReturn.state.inventory.items.find(item => run(row).returnedIds.includes(item.id)));
}, ['r100-contaminant-deep-2']);
check('already-recorded-pickup-not-counted-twice', row => {
  row.searches.push(...actual.map(found => ({id: found.id, collected: true})));
});
assert.deepEqual(JSON.parse(bytes).realJourneyAttempts[0], original, 'Read-only reconciliation mutated the raw report');
console.log(JSON.stringify({status: 'pass', checks: results.length,
  scope: 'Read-only QA accounting contract, not additional gameplay. Original raw source remains unchanged.',
  source: {path: source, sha256: createHash('sha256').update(bytes).digest('hex')}, actual, results}, null, 2));
