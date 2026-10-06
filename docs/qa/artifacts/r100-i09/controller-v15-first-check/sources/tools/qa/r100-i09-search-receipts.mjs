/** Read-only I09 accounting. Raw target observations are retained separately. */
import assert from 'node:assert/strict';
import { reconcileTerminalPickups } from './r100-observed-searches.mjs';

export function collectI09SearchReceipts(journey) {
  const entry = journey.entryState, terminal = journey.fieldResult;
  const starts = new Map(entry.nodes.map(node => [node.id, node]));
  const ends = new Map(terminal.nodes.map(node => [node.id, node]));
  assert.equal(starts.size, entry.nodes.length); assert.equal(ends.size, terminal.nodes.length);
  const results = new Map();
  const add = (id, detail) => {
    const start = starts.get(id), node = ends.get(id);
    assert(start?.collected === false && node?.collected === true, `No actual pickup transition: ${id}`);
    assert.equal(start.kind, node.kind); assert.equal(start.tier, node.tier); assert.deepEqual(start.pos, node.pos);
    const distanceFromEntry = Math.hypot(node.pos.x - entry.pos.x, node.pos.y - entry.pos.y);
    assert(distanceFromEntry > 320, 'Entry pickup cannot qualify');
    if (!results.has(id)) results.set(id, { id, kind: node.kind, distanceFromEntry, ...detail });
  };
  for (const search of journey.searches) {
    if (search.collected) add(search.id, { elapsedMs: search.elapsedMs, evidence: 'target-observed / terminal-collected', timing: 'observation upper bound' });
    if (search.actualCollectedNodeIds?.length) {
      assert(journey.searches.some(row => row.searchDecision?.attempted === true), 'Actual E attempt required');
      assert.equal(new Set(search.actualCollectedNodeIds).size, search.actualCollectedNodeIds.length);
      for (const id of search.actualCollectedNodeIds) add(id, { elapsedMs: search.elapsedMs, evidence: 'input-segment-observed / terminal-collected', timing: 'observation upper bound' });
    }
  }
  for (const pickup of reconcileTerminalPickups(journey)) add(pickup.id, pickup);
  for (const node of terminal.nodes) if (node.collected && starts.get(node.id)?.collected === false)
    assert(results.has(node.id), `Unreconciled actual terminal pickup: ${node.id}`);
  assert(results.size <= 3, 'At most three actual remains per I09 trip');
  return [...results.values()];
}
