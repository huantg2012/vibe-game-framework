import type { RiftGenerationInput, RiftGenerationRequest, RiftGenerationResponse, RiftGenerationWire } from './rift-generation-protocol';
import { requestWorker } from '@/utils/worker-request';

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
    return requestWorker(this.createWorker, { id: ++requestSequence, input }, data => {
      if ('error' in data) throw new Error(data.error);
      if (!('result' in data)) throw new Error('Malformed generation response');
      return data.result;
    }, { signal, timeoutMs: this.timeoutMs, label: 'Generation' });
  }
}
