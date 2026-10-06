/** Controlled input contract; no browser, game grants or gameplay outcomes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createVisibleEncounterPolicy, newlyCollectedNodeIds } from './r100-i09-costed-encounters.mjs';
import { collectI09SearchReceipts } from './r100-i09-search-receipts.mjs';

const state = (collected = []) => ({ nodes: ['target', 'neighbor', 'third', 'already'].map(id => ({ id, collected: id === 'already' || collected.includes(id) })) });
assert.deepEqual(newlyCollectedNodeIds(state(), state(['neighbor'])), ['neighbor']);
assert.deepEqual(newlyCollectedNodeIds(state(), state()), []);
assert.equal(newlyCollectedNodeIds(state(), state(['target', 'neighbor', 'third'])).length, 3,
  'three actual pickups exhaust the allowance even when all three intended-target receipts say false');
const hidden = { id: 'neighbor', collected: true, get kind() { throw Error('Do not read hidden kind'); }, get value() { throw Error('Do not read hidden value'); } };
assert.deepEqual(newlyCollectedNodeIds(state(), { nodes: [hidden] }), ['neighbor']);
assert.throws(() => newlyCollectedNodeIds({ nodes: [hidden, hidden] }, state()), /Unique initial/);
assert.throws(() => newlyCollectedNodeIds(state(), { nodes: [hidden, hidden] }), /Unique current/);

const actual = JSON.parse(fs.readFileSync('docs/qa/artifacts/r100-i07-i09/legacy20-play-recheck-077-078-v13/001-pressed-dunes-severe-20261005/report.json')).realJourneyAttempts[0];
assert.equal(collectI09SearchReceipts(actual).length, 2, 'actual false-target telemetry must not become an empty return');
const death = structuredClone(actual); death.outcome = 'death'; death.afterReturn.state.inventory.run.outcome = 'death';
death.searches[0].actualCollectedNodeIds = ['r100-kindling-deep-1', 'r100-contaminant-deep-2'];
assert.equal(collectI09SearchReceipts(death).length, 2, 'observed searches before death are not extraction income');
delete death.searches[0].actualCollectedNodeIds;
assert.throws(() => collectI09SearchReceipts(death), /Unreconciled actual terminal pickup/, 'missing evidence cannot silently become empty');
const four = structuredClone(actual); four.searches = [];
four.entryState.nodes = []; four.fieldResult.nodes = [];
for (let i = 0; i < 4; i++) {
  const node = { id: `four-${i}`, kind: 'kindling', pos: { x: 900 + i, y: 200 }, collected: false };
  four.entryState.nodes.push(node); four.fieldResult.nodes.push({ ...node, collected: true });
  four.searches.push({ id: node.id, collected: true, elapsedMs: 40000 });
}
assert.throws(() => collectI09SearchReceipts(four), /At most three actual remains/);

async function exercise(mode) {
  let elapsedMs = 1000, polls = 0, held = false;
  const keys = [], current = mode === 'three-before-press' ? state(['target', 'neighbor', 'third']) : state(), position = { x: 100, y: 100 };
  const scene = {
    ai: { getEnemies: () => [] }, combat: { getHealth: () => 100 }, visibilityAt: () => 1,
    hosts: { getSubjects: () => [] }, search: { nodes: current.nodes.map(node => ({ ...node, position })) },
    player: { getPosition: () => position, getFacingAngle: () => 0 }, chaos: { getValue: () => 0 },
    runController: { getElapsedMs: () => elapsedMs, isRunEnded: () => false },
    toolSystem: { exportRuntimeState: () => ({ catalog: { effects: [] } }) },
  };
  const prior = globalThis.window;
  globalThis.window = { __game: { scene: { getScene: () => scene } } };
  const page = {
    evaluate: async (callback, argument) => callback(argument),
    keyboard: { down: async key => { held = true; keys.push(['down', key]); }, up: async key => { held = false; keys.push(['up', key]); } },
    waitForTimeout: async ms => {
      elapsedMs += ms;
      if (!held) return;
      polls++;
      if (mode === 'state-error') throw Error('controlled state failure');
      if (polls === 2 && mode !== 'no-new-pickup') current.nodes.find(node => node.id === mode).collected = true;
    },
  };
  const driver = { state: async () => ({ ...structuredClone(current), pos: position, hp: 100, elapsedMs, ended: false }),
    hold: async (_keys, ms) => { elapsedMs += ms; }, log: () => {}, press: async () => { throw Error('No ability or attack required'); } };
  try {
    const policy = createVisibleEncounterPolicy(page, driver, async () => ({ items: [] }));
    if (mode === 'state-error') await assert.rejects(() => policy.search({ id: 'target', pos: { x: 140, y: 100 } }), /controlled state failure/);
    else {
      const result = await policy.search({ id: 'target', pos: { x: 140, y: 100 } }, { entryState: state(), limit: 3 });
      if (mode === 'three-before-press') { assert.equal(result.reason, 'actual-search-limit'); assert.equal(polls, 0); }
      else if (mode === 'no-new-pickup') { assert.equal(result.reason, 'channel-not-completed'); assert.equal(polls, 11); }
      else { assert.deepEqual(result.completedNodeIds, [mode]); assert.equal(result.reason, 'collected'); assert.equal(polls, 2); }
    }
    assert.equal(held, false); assert.deepEqual(keys, mode === 'three-before-press' ? [] : [['down', 'e'], ['up', 'e']], 'no fourth hold; an actual hold is always released');
    return { mode, polls, keys };
  } finally { if (prior === undefined) delete globalThis.window; else globalThis.window = prior; }
}

const cases = [];
for (const mode of ['target', 'neighbor', 'no-new-pickup', 'state-error', 'three-before-press']) cases.push(await exercise(mode));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha('tools/qa/r100-i07-i09-journey.mjs'), '6e2b8d76a7e03a08e7b774d2465954e51636f8ceb2467dfdc880702541e3587f');
assert.equal(sha('tools/world-study/r100-p13-costed-encounters.mjs'), '8850a30414e72f0465304fc3c90e38a0e08406b9e442b9b8ea7bfaea80ae3715');
console.log(JSON.stringify({ status: 'pass-offline-search-input-contract', cases,
  checks: ['actual completion, including different nearby target', 'already collected does not finish a new channel', 'three actual transitions exhaust allowance', 'no hidden kind/value access', 'E released after exception', 'original v13 and P13 bytes intact'],
  limitation: 'Mock public state and keyboard driver; real I09 outcomes remain untested.' }, null, 2));
