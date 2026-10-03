import type { RiftGenerationInput, RiftGenerationRequest, RiftGenerationResponse, RiftGenerationWire } from './rift-generation-protocol';

export const RIFT_GENERATION_TIMEOUT_MS = 60000;
/** Minimal worker boundary permits deterministic cancellation tests without a DOM. */
export interface RiftGenerationWorkerPort {
  onmessage: ((event: MessageEvent<RiftGenerationResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: RiftGenerationRequest): void;
  terminate(): void;
}
export type RiftGenerationWorkerFactory = () => RiftGenerationWorkerPort;
const browserWorker: RiftGenerationWorkerFactory = () =>
  new Worker(new URL('./rift-generation-worker.ts', import.meta.url), { type: 'module', name: 'rift-generation' });
let requestSequence = 0;

export class RiftGenerationClient {
  constructor(private readonly createWorker: RiftGenerationWorkerFactory = browserWorker,
    private readonly timeoutMs = RIFT_GENERATION_TIMEOUT_MS) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > RIFT_GENERATION_TIMEOUT_MS)
      throw new Error('Generation timeout must be positive and at most 60000 ms');
  }

  generate(input: RiftGenerationInput, signal?: AbortSignal): Promise<RiftGenerationWire> {
    if (signal?.aborted) return Promise.reject(new DOMException('Generation cancelled', 'AbortError'));
    return new Promise((resolve, reject) => {
      let worker: RiftGenerationWorkerPort;
      try { worker = this.createWorker(); } catch (error) { reject(error); return; }
      const id = ++requestSequence;
      let finished = false;
      const cleanup = (): void => {
        clearTimeout(timeout); signal?.removeEventListener('abort', cancel);
        worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null; worker.terminate();
      };
      const fail = (error: Error): void => {
        if (finished) return; finished = true; cleanup(); reject(error);
      };
      const cancel = (): void => fail(new DOMException('Generation cancelled', 'AbortError'));
      const timeout = setTimeout(() => fail(new DOMException(`Generation exceeded ${this.timeoutMs} ms budget`, 'TimeoutError')), this.timeoutMs);
      worker.onmessage = ({ data }) => {
        if (finished || data?.id !== id) return;
        if ('error' in data) { fail(new Error(data.error)); return; }
        if (!('result' in data)) { fail(new Error('Malformed generation response')); return; }
        finished = true; cleanup(); resolve(data.result);
      };
      worker.onerror = event => fail(new Error(event.message || 'Generation worker failed'));
      worker.onmessageerror = () => fail(new Error('Generation worker transfer failed'));
      signal?.addEventListener('abort', cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      try { worker.postMessage({ id, input }); }
      catch (error) { fail(error instanceof Error ? error : new Error(String(error))); }
    });
  }
}
