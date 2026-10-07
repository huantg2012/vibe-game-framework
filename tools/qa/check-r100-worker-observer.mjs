import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { installWorkerObserver, createWorkerObservationRecorder } from './r100-worker-observer.mjs';

const events = [], calls = [], samples = [], createdContexts = [];
const target = new EventEmitter(); target.send = async (...args) => calls.push(['cdp', ...args]);
const browser = new EventEmitter(); browser.newBrowserCDPSession = async () => target;
browser.newContext = async function (...args) {
  assert.equal(this, browser); calls.push(['context', ...args]);
  const context = new EventEmitter(); createdContexts.push(context); return context;
};
const browserType = { launch: async function (...args) {
  assert.equal(this, browserType); calls.push(['launch', ...args]); return browser;
} };
const originalLaunch = browserType.launch;
const observer = installWorkerObserver(browserType, event => events.push(event), reason => samples.push(reason));
const launchOptions = { executablePath: '/unchanged', headless: true }, contextOptions = { storageState: '/unchanged-save' };
assert.equal(await browserType.launch(launchOptions), browser);
const context = await browser.newContext(contextOptions);
assert.equal(context, createdContexts[0]); assert.equal(calls[0][1], launchOptions); assert.equal(calls[2][1], contextOptions);
assert.deepEqual(calls[1], ['cdp', 'Target.setDiscoverTargets', { discover: true }]);
const request = (url, failure = null) => ({ url: () => url, method: () => 'GET', resourceType: () => 'script', failure: () => failure });
const response = (url, status) => ({ url: () => url, status: () => status, fromServiceWorker: () => false });
for (let i = 0; i < 20; i++) {
  const req = request('/src/dependency.ts?exact=1');
  context.emit('request', req); context.emit('response', response(req.url(), 200)); context.emit('requestfinished', req);
}
const failed = request('/src/missing.ts', { errorText: 'net::ERR_ABORTED' });
context.emit('request', failed); context.emit('response', response(failed.url(), 504)); context.emit('requestfailed', failed);
const pending = request('/src/pending.ts'); context.emit('request', pending);
const page = new EventEmitter(), frame = { url: () => '/original-page' };
page.mainFrame = () => frame; page.url = frame.url; context.emit('page', page); page.emit('framenavigated', frame);
const worker = new EventEmitter(); worker.url = () => '/original-worker'; page.emit('worker', worker); worker.emit('close');
page.emit('console', { type: () => 'error', text: () => 'Generation worker failed', location: () => ({ url: '/scene' }) });
page.emit('pageerror', new Error('original error')); page.emit('crash');
target.emit('Target.targetCrashed', { targetId: 'worker1', status: 'crashed', errorCode: 5 });
context.emit('close');
const first = events.find(row => row.event === 'network-summary' && row.reason === 'context-closed');
assert.equal(first.requests, 22); assert.equal(first.responses, 21); assert.equal(first.failed, 1);
assert.deepEqual(first.statuses, { 200: 20, 504: 1 });
assert.equal(first.pending.length, 1); assert.equal(first.pending[0].urlId, events.find(row => row.url === '/src/pending.ts').urlId);
assert.equal(events.filter(row => row.event === 'network-url' && row.url === '/src/dependency.ts?exact=1').length, 1);
assert.equal(events.filter(row => row.event === 'response').length, 0, 'Do not duplicate successful per-request traffic');
assert(events.some(row => row.event === 'http-error' && row.status === 504 && row.url === failed.url()));
assert(events.some(row => row.event === 'requestfailed' && row.failure.errorText === 'net::ERR_ABORTED'));
assert(events.some(row => row.event === 'console' && row.text === 'Generation worker failed'));
assert(events.some(row => row.event === 'pageerror' && row.message === 'Error: original error'));
assert(events.some(row => row.event === 'page-crash'));
assert(events.some(row => row.event === 'Target.targetCrashed' && row.data.errorCode === 5));
assert(events.some(row => row.event === 'worker-created' && row.workerId === 1));
assert(events.some(row => row.event === 'worker-closed' && row.workerId === 1));
const second = await browser.newContext(contextOptions);
const req2 = request('/src/dependency.ts?exact=1'); second.emit('request', req2);
second.emit('response', response(req2.url(), 200)); second.emit('requestfinished', req2);
observer.flush('manual-check');
const last = events.at(-1); assert.equal(last.contextId, 2); assert.equal(last.requests, 1); assert.equal(last.pending.length, 0);
assert.equal(events.filter(row => row.event === 'network-url' && row.url === req2.url()).length, 1, 'Exact URL catalogue shared across contexts');
assert.equal(last.urls[0], first.urls[0]);
second.emit('close'); const before = events.length; observer.flush('after-close'); assert.equal(events.length, before);
observer.restoreLaunch(); assert.equal(browserType.launch, originalLaunch);
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'r100-observer-marker-'));
const failureFile = path.join(fixture, 'first-error.json'), rawFile = path.join(fixture, 'events.jsonl');
const fd = fs.openSync(rawFile, 'wx');
try {
  const record = createWorkerObservationRecorder(fd, failureFile);
  record({ event: 'network-summary', responses: 42 }); record({ event: 'console', type: 'warning', text: 'original warning' });
  assert(!fs.existsSync(failureFile), 'Normal results/warnings do not stop the next case');
  record({ event: 'console', type: 'error', text: 'original first error' });
  const firstError = fs.readFileSync(failureFile, 'utf8');
  record({ event: 'Target.targetCrashed', data: { errorCode: 5 } });
  assert.equal(fs.readFileSync(failureFile, 'utf8'), firstError, 'First error preserved without overwriting later events');
  assert.equal(JSON.parse(firstError).text, 'original first error');
  assert.equal(fs.readFileSync(rawFile, 'utf8').trim().split('\n').length, 4, 'All original events remain available');
  assert.throws(() => createWorkerObservationRecorder(fd, failureFile), /Stale Worker observation marker/);
  assert.equal(fs.readFileSync(failureFile, 'utf8'), firstError, 'Stale markers are rejected and retained, never cleaned to hide failure');
} finally { fs.closeSync(fd); fs.rmSync(fixture, { recursive: true }); }
const assertions = ['Original launch/context this, arguments and returned object identity retained',
  'Only CDP Target.setDiscoverTargets requested', 'Repeated successful traffic counted without repeated raw rows',
  'Exact unnormalized URL catalogue reused across independent context counters', 'Failed requests and HTTP errors retained individually',
  'Pending imports retained at crash/close', 'Page, console and CDP target failure details retained',
  'Worker creation and close retain matching instance IDs', 'Context close releases accounting and flush preserves only active contexts',
  'Restore affects original launch and does not change browser input or game code',
  'Only error events create the first-error boundary marker; later errors remain raw without replacing the first',
  'A stale marker is rejected at recorder startup and its original bytes are retained'];
const outputAt = process.argv.indexOf('--output');
if (outputAt >= 0) {
  const output = process.argv[outputAt + 1]; assert(output, '--output requires a path');
  const source = 'tools/qa/r100-worker-observer.mjs';
  fs.writeFileSync(output, JSON.stringify({ status: 'pass', createdAt: new Date().toISOString(),
    observer: { path: source, sha256: createHash('sha256').update(fs.readFileSync(source)).digest('hex') }, assertions,
    scope: 'Fake event forwarding and bounded logging contract; no browser launch, actual Worker reproduction, runtime correctness or performance claim.' }, null, 2) + '\n', { flag: 'wx' });
}
console.log(`PASS worker observer: ${assertions.length} forwarding/accounting contracts; no browser launched`);
