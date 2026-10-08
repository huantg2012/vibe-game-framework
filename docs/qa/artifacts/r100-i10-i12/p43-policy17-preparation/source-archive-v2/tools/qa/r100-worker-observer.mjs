/** Read-only external observations for final entry/recovery probes.
 * Never evaluates page code, intercepts requests, or changes browser options.
 * Successful traffic is counted by exact URL rather than repeated per request;
 * all failures and Worker lifecycle events remain individual records.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';

export function isWorkerObservationFailure(event) {
  return ['requestfailed', 'http-error', 'pageerror', 'page-crash', 'Target.targetCrashed'].includes(event.event)
    || event.event === 'console' && event.type === 'error';
}

export function createWorkerObservationRecorder(fd, failureFile) {
  if (failureFile && fs.existsSync(failureFile)) throw new Error('Stale Worker observation marker; preserve it and use a fresh batch directory');
  return event => {
    const row = { at: new Date().toISOString(), pid: process.pid, ...event };
    fs.writeSync(fd, JSON.stringify(row) + '\n');
    // The probe reads this only after closing the current case's context.
    // Preserve the first error verbatim; subsequent errors remain in JSONL.
    if (failureFile && isWorkerObservationFailure(row) && !fs.existsSync(failureFile))
      fs.writeFileSync(failureFile, JSON.stringify(row, null, 2) + '\n', { flag: 'wx' });
  };
}

export function installWorkerObserver(browserType, record, sampleProcesses = () => {}) {
  const originalLaunch = browserType.launch;
  let nextBrowser = 0, nextContext = 0, nextPage = 0, nextWorker = 0, nextUrl = 0;
  const allUrls = new Map(), contexts = new Map();
  const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
  const entries = map => Object.fromEntries([...map].sort(([a], [b]) => String(a).localeCompare(String(b))));
  const urlId = url => {
    if (!allUrls.has(url)) {
      const id = ++nextUrl; allUrls.set(url, id);
      record({ event: 'network-url', urlId: id, url });
    }
    return allUrls.get(url);
  };
  const snapshot = (state, reason) => record({ event: 'network-summary', reason, browserId: state.browserId,
    contextId: state.contextId, requests: state.requests, responses: state.responses, failed: state.failed,
    requestMethods: entries(state.methods), resourceTypes: entries(state.types), statuses: entries(state.statuses),
    urls: [...state.urls].sort((a, b) => a - b), responseUrls: entries(state.responseUrls),
    pending: [...state.pending.values()] });
  browserType.launch = async function (...args) {
    const browserId = ++nextBrowser;
    record({ event: 'launch', browserId, args });
    const browser = await originalLaunch.apply(this, args);
    browser.on('disconnected', () => {
      for (const state of contexts.values()) if (state.browserId === browserId) snapshot(state, 'browser-disconnected');
      record({ event: 'browser-disconnected', browserId });
    });
    const targetSession = await browser.newBrowserCDPSession();
    for (const event of ['Target.targetCreated', 'Target.targetDestroyed', 'Target.targetCrashed', 'Target.targetInfoChanged'])
      targetSession.on(event, data => record({ event, browserId, data }));
    await targetSession.send('Target.setDiscoverTargets', { discover: true });
    const originalNewContext = browser.newContext;
    browser.newContext = async function (...contextArgs) {
      const context = await originalNewContext.apply(this, contextArgs), contextId = ++nextContext;
      const state = { browserId, contextId, requests: 0, responses: 0, failed: 0, methods: new Map(),
        types: new Map(), statuses: new Map(), urls: new Set(), responseUrls: new Map(), pending: new Map() };
      contexts.set(contextId, state);
      record({ event: 'context-created', browserId, contextId, args: contextArgs });
      context.on('request', request => {
        const id = urlId(request.url()), method = request.method(), resourceType = request.resourceType();
        state.requests++; state.urls.add(id); count(state.methods, method); count(state.types, resourceType);
        state.pending.set(request, { urlId: id, method, resourceType });
      });
      context.on('requestfinished', request => state.pending.delete(request));
      context.on('requestfailed', request => {
        state.failed++; state.pending.delete(request);
        record({ event: 'requestfailed', browserId, contextId, urlId: urlId(request.url()), url: request.url(),
          failure: request.failure(), resourceType: request.resourceType() });
      });
      context.on('response', response => {
        const id = urlId(response.url()), status = response.status();
        state.responses++; state.urls.add(id); count(state.statuses, status); count(state.responseUrls, id);
        if (status >= 400) record({ event: 'http-error', browserId, contextId, urlId: id, url: response.url(),
          status, fromServiceWorker: response.fromServiceWorker() });
      });
      context.on('page', page => {
        const pageId = ++nextPage;
        record({ event: 'page-created', browserId, contextId, pageId });
        page.on('framenavigated', frame => {
          if (frame === page.mainFrame()) record({ event: 'page-navigation', browserId, contextId, pageId, url: frame.url() });
        });
        page.on('crash', () => {
          record({ event: 'page-crash', browserId, contextId, pageId, url: page.url() });
          snapshot(state, 'page-crash'); sampleProcesses('page-crash');
        });
        page.on('pageerror', error => record({ event: 'pageerror', browserId, contextId, pageId,
          message: String(error), stack: error.stack }));
        page.on('console', message => {
          if (['error', 'warning'].includes(message.type())) record({ event: 'console', browserId, contextId, pageId,
            type: message.type(), text: message.text(), location: message.location() });
        });
        page.on('worker', worker => {
          const workerId = ++nextWorker;
          record({ event: 'worker-created', browserId, contextId, pageId, workerId, url: worker.url() });
          sampleProcesses('worker-created');
          worker.on('close', () => record({ event: 'worker-closed', browserId, contextId, pageId, workerId, url: worker.url() }));
        });
        page.on('close', () => record({ event: 'page-closed', browserId, contextId, pageId }));
      });
      context.on('close', () => {
        snapshot(state, 'context-closed'); contexts.delete(contextId);
        record({ event: 'context-closed', browserId, contextId });
      });
      return context;
    };
    record({ event: 'browser-ready', browserId }); sampleProcesses('browser-ready');
    return browser;
  };
  return { restoreLaunch: () => { browserType.launch = originalLaunch; },
    flush: reason => { for (const state of contexts.values()) snapshot(state, reason); } };
}

if (process.env.QA_WORKER_OBSERVER_DIR) {
  const folder = path.resolve(process.env.QA_WORKER_OBSERVER_DIR); fs.mkdirSync(folder, { recursive: true });
  const fd = fs.openSync(path.join(folder, `observer-${process.pid}.jsonl`), 'wx');
  const record = createWorkerObservationRecorder(fd, process.env.QA_WORKER_OBSERVER_FAILURE_FILE);
  const sampleProcesses = reason => execFile('/bin/ps', ['-axo', 'pid,ppid,rss,%cpu,command'], { maxBuffer: 4 * 1024 * 1024 },
    (error, stdout) => record({ event: 'process-snapshot', reason, error: error ? String(error) : null,
      processes: stdout.split('\n').filter(line => /Google Chrome|r100-frozen-server|check-r100-production-browser/.test(line)) }));
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
    ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  const observer = installWorkerObserver(chromium, record, sampleProcesses);
  process.once('exit', () => observer.flush('node-exit'));
  record({ event: 'preload-ready', argv: process.argv,
    scope: 'CDP Target discovery, Playwright network/page/Worker events and read-only process samples only. Exact successful URLs are catalogued once and counted per context; all failures are individual records. No page evaluation, request interception, Worker/input/clock changes or modified launch options.' });
}
