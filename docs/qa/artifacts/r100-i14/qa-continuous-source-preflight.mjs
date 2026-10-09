import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root = 'docs/qa/artifacts/r100-i13-continuation/a-target-recovery/a-same-run-recovery';
const output = 'docs/qa/artifacts/r100-i14/qa-continuous-source-preflight.json';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bind = path => ({ path, sha256: sha(fs.readFileSync(path)) });
const reportPath = `${root}/report.json`;
const storagePath = `${root}/i13/browser-storage.json`;
const terminalPath = `${root}/i13/2-after-preparation.save.json`;
const report = JSON.parse(fs.readFileSync(reportPath));
const storage = JSON.parse(fs.readFileSync(storagePath));
const terminal = JSON.parse(fs.readFileSync(terminalPath));
const origin = storage.origins.find(value => value.origin === 'http://127.0.0.1:3033');
assert.ok(origin, 'Original storage origin must remain explicit');
const raw = origin.localStorage.find(value => value.name === 'coh-save-v1')?.value;
assert.equal(typeof raw, 'string');
const current = JSON.parse(raw);
const last = report.realJourneyAttempts.at(-1);
assert.equal(report.realJourneyAttempts.length, 2);
assert.equal(last.status, 'completed-real-input');
assert.equal(last.outcome, 'extract');
assert.deepEqual(current, terminal, 'Browser storage must equal the original terminal save');
assert.deepEqual(current, last.afterPreparation.state, 'Report terminal must equal raw storage');
assert.equal(current.cycle, 65);
assert.equal(current.kindlingReserve, 35);
assert.deepEqual(current.modules.map(({ id, hp, maxHp }) => ({ id, hp, maxHp })), [
  { id: 'CORE', hp: 51, maxHp: 145 },
  { id: 'STORAGE', hp: 103, maxHp: 145 },
  { id: 'PURIFIER', hp: 51, maxHp: 145 },
]);
assert.equal(current.riftCheckpoint, undefined, 'The source must be the settled base, not the previous active backup');
const result = {
  date: '2026-10-09', status: 'source-continuity-pass-not-runtime', reviewer: 'qa',
  tool: bind('docs/qa/artifacts/r100-i14/qa-continuous-source-preflight.mjs'),
  sourceReport: bind(reportPath), sourceStorage: bind(storagePath), sourceTerminal: bind(terminalPath),
  sourceLineage: 'I13 A23 actual settled terminal; I14 must continue this state without undoing costs or maturity',
  storageOrigin: origin.origin, currentSaveKey: 'coh-save-v1', currentSaveRawSha256: sha(raw),
  reportAfterPreparationSha256: last.afterPreparation.sha256,
  rawEqualsTerminalAndReport: true, cycle: current.cycle, kindlingReserve: current.kindlingReserve,
  modules: current.modules, moduleMaxHpTier: current.moduleMaxHpTier, growth: current.growth,
  inventorySha256: sha(JSON.stringify(current.inventory)), equipment: current.inventory.equipment,
  inventoryRun: current.inventory.run,
  fixedService: { CORE: 51, STORAGE: 100, PURIFIER: 51 }, serviceDebt: 0,
  originalCapital: { CORE: 51, STORAGE: 102, PURIFIER: 51 }, originalCapitalDebt: 0,
  storageKeys: origin.localStorage.map(value => value.name),
  limits: [
    'No new I14 runtime has occurred; this validates only the exact starting state.',
    'The previous backup is an older active save and must not replace coh-save-v1.',
    'Storage includes presentation history and original origin; any necessary origin remap must be separately disclosed without editing save values.',
    'Equipment and earned inventory are preserved; this is not a new heavy-preparation or profitability acceptance gate.',
  ],
};
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, sha256: sha(fs.readFileSync(output)), status: result.status, cycle: result.cycle, reserve: result.kindlingReserve }));
