/** Transport lifecycle only. A fake clock makes deadline/cancellation races exact. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { requestWorker, WORKER_STARTUP_RETRY_DELAY_MS as delay, type RequestWorker } from '../../src/utils/worker-request';

type Request = { id: number; input: { seed: number; bytes: Uint8Array } };
type Response = { id: number; started: true } | { id: number; result: string } | { id: number; error: string };
class Port implements RequestWorker<Request, Response> {
  onmessage: RequestWorker<Request, Response>['onmessage'] = null;
  onerror: RequestWorker<Request, Response>['onerror'] = null;
  onmessageerror: RequestWorker<Request, Response>['onmessageerror'] = null;
  request?: Request;
  disposed = 0;
  postMessage(request: Request): void { this.request = request; }
  terminate(): void { this.disposed++; }
  reply(data: Response): void { this.onmessage?.({ data } as MessageEvent<Response>); }
  crash(): void { this.onerror?.({ message: 'module unavailable' } as ErrorEvent); }
}
const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
let clock = 0, next = 0;
const timers = new Map<number, { at: number; callback: () => void }>();
const tick = (ms: number): void => {
  const end = clock + ms;
  for (;;) {
    const entry = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!entry) break;
    timers.delete(entry[0]); clock = entry[1].at; entry[1].callback();
  }
  clock = end;
};
Object.assign(globalThis, {
  setTimeout: (callback: () => void, ms: number) => { const id = ++next; timers.set(id, { at: clock + ms, callback }); return id; },
  clearTimeout: (id: number) => { timers.delete(id); },
});
const cases: string[] = [];
const check = async (label: string, work: () => Promise<void>): Promise<void> => {
  await work(); assert.equal(timers.size, 0, `${label}: all timers released`); cases.push(label);
};
const input: Request = { id: 7, input: { seed: 3075192741, bytes: new Uint8Array([3, 1, 4]) } };
const decode = (response: Response): string => {
  if ('error' in response) throw new Error(response.error);
  if (!('result' in response)) throw new Error('malformed');
  return response.result;
};
const begin = (ports: Port[], signal?: AbortSignal, budget = 1000) => requestWorker(() => {
  const port = new Port(); ports.push(port); return port;
}, input, decode, { signal, timeoutMs: budget, label: 'Test' });
const disposed = (ports: Port[]): void => ports.forEach(port => {
  assert.equal(port.disposed, 1); assert.equal(port.onmessage, null); assert.equal(port.onerror, null); assert.equal(port.onmessageerror, null);
});
try {
  await check('module failure retries once with exact request, no detached inputs, and rejects stale first-attempt handlers', async () => {
    const ports: Port[] = [], pending = begin(ports), first = ports[0]!;
    const staleReply = first.onmessage!, staleError = first.onerror!;
    first.crash(); assert.equal(ports.length, 1); tick(delay); assert.equal(ports.length, 2);
    assert.strictEqual(ports[1]!.request, first.request); assert.deepEqual(input.input.bytes, new Uint8Array([3, 1, 4]));
    staleReply({ data: { id: 7, result: 'stale' } } as MessageEvent<Response>); staleError({ message: 'late' } as ErrorEvent);
    ports[1]!.reply({ id: 7, started: true }); ports[1]!.reply({ id: 7, result: 'correct' });
    assert.equal(await pending, 'correct'); disposed(ports);
  });
  await check('second startup failure stops without a third Worker and retains original failure', async () => {
    const ports: Port[] = [], pending = begin(ports);
    const rejected = assert.rejects(pending, error => error instanceof Error && 'workerStartupFailure' in error);
    ports[0]!.crash(); tick(delay); ports[1]!.crash(); await rejected; tick(1000); assert.equal(ports.length, 2); disposed(ports);
  });
  await check('attempt guard rejects stale closures even if an injected factory reuses its port object', async () => {
    const port = new Port();
    const pending = requestWorker(() => port, input, decode, { timeoutMs: 1000, label: 'Test' });
    const stale = port.onmessage!; port.crash(); tick(delay);
    stale({ data: { id: 7, result: 'first attempt' } } as MessageEvent<Response>);
    port.reply({ id: 7, result: 'second attempt' }); assert.equal(await pending, 'second attempt');
    assert.equal(port.disposed, 2); assert.equal(port.onmessage, null);
  });
  for (const failure of ['started-error', 'result-error', 'transfer-error', 'malformed'] as const) {
    await check(`${failure} does not retry computation or transfer`, async () => {
      const ports: Port[] = [], pending = begin(ports), rejected = assert.rejects(pending), port = ports[0]!;
      if (failure === 'started-error') { port.reply({ id: 7, started: true }); port.crash(); }
      if (failure === 'result-error') port.reply({ id: 7, error: 'invalid signature' });
      if (failure === 'transfer-error') port.onmessageerror!({} as MessageEvent);
      if (failure === 'malformed') port.reply({ id: 7 } as Response);
      await rejected; tick(1000); assert.equal(ports.length, 1); disposed(ports);
    });
  }
  await check('cancel during retry delay never starts a replacement', async () => {
    const ports: Port[] = [], controller = new AbortController(), pending = begin(ports, controller.signal);
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    ports[0]!.crash(); controller.abort(); await rejected; tick(delay); assert.equal(ports.length, 1); disposed(ports);
  });
  await check('second Worker uses remaining original deadline, not a fresh timeout', async () => {
    const ports: Port[] = [], pending = begin(ports, undefined, 500), rejected = assert.rejects(pending, { name: 'TimeoutError' });
    tick(100); ports[0]!.crash(); tick(delay); assert.equal(ports.length, 2); tick(500 - 100 - delay);
    await rejected; disposed(ports);
  });
  await check('deadline before retry delay ends creates no replacement', async () => {
    const ports: Port[] = [], pending = begin(ports, undefined, delay / 2), rejected = assert.rejects(pending, { name: 'TimeoutError' });
    ports[0]!.crash(); tick(delay); await rejected; assert.equal(ports.length, 1); disposed(ports);
  });
  await check('aborting synchronously in factory still terminates new Worker without posting', async () => {
    const controller = new AbortController(), port = new Port();
    await assert.rejects(requestWorker(() => { controller.abort(); return port; }, input, decode,
      { signal: controller.signal, timeoutMs: 1000, label: 'Test' }), { name: 'AbortError' });
    assert.equal(port.request, undefined); disposed([port]);
  });
  await check('postMessage clone failure is not treated as a module startup failure', async () => {
    const port = new Port(); port.postMessage = () => { throw new DOMException('not cloneable', 'DataCloneError'); };
    await assert.rejects(requestWorker(() => port, input, decode, { timeoutMs: 1000, label: 'Test' }), { name: 'DataCloneError' }); disposed([port]);
  });
  await check('factory failure remains terminal', async () => {
    let calls = 0;
    await assert.rejects(requestWorker((): Port => { calls++; throw new Error('constructor denied'); }, input, decode,
      { timeoutMs: 1000, label: 'Test' }), /constructor denied/); assert.equal(calls, 1);
  });
  await check('wrong request ack ignored; legacy result without ack remains compatible', async () => {
    const ports: Port[] = [], pending = begin(ports); ports[0]!.reply({ id: 8, started: true }); ports[0]!.crash(); tick(delay);
    ports[1]!.reply({ id: 7, result: 'legacy' }); assert.equal(await pending, 'legacy'); disposed(ports);
  });
} finally { Object.assign(globalThis, { setTimeout: originalSet, clearTimeout: originalClear }); }
const out = 'docs/qa/artifacts/r100-i10-i12/worker-startup-retry'; mkdirSync(out, { recursive: true });
writeFileSync(`${out}/contract.json`, JSON.stringify({ status: 'pass', cases, scope: 'Deterministic transport lifecycle, not browser network reproduction or gameplay qualification.' }, null, 2) + '\n');
console.log(`PASS ${cases.length} startup retry lifecycle cases`);
