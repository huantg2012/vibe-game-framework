/** A failed module load may occur before a Worker can acknowledge the request.
 * Retry that boundary once, keeping the same input and the original deadline.
 * Computation errors and structured-clone errors are never retried. */
export interface RequestWorker<Request, Response> {
  onmessage: ((event: MessageEvent<Response>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(request: Request): void;
  terminate(): void;
}

export const WORKER_STARTUP_RETRY_DELAY_MS = 120;
export interface WorkerRequestOptions {
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly label: string;
}

export function requestWorker<Request extends { readonly id: number }, Response extends { readonly id: number }, Result>(
  createWorker: () => RequestWorker<Request, Response>, request: Request,
  decode: (response: Response) => Result, options: WorkerRequestOptions,
): Promise<Result> {
  const { signal, timeoutMs, label } = options;
  if (signal?.aborted) return Promise.reject(new DOMException(`${label} cancelled`, 'AbortError'));
  return new Promise((resolve, reject) => {
    let current: RequestWorker<Request, Response> | null = null;
    let finished = false, attempts = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let firstStartupError: Error | undefined;
    const dispose = (): void => {
      const worker = current; current = null;
      if (!worker) return;
      worker.onmessage = null; worker.onerror = null; worker.onmessageerror = null;
      worker.terminate();
    };
    const cleanup = (): void => {
      clearTimeout(deadline); clearTimeout(retry);
      signal?.removeEventListener('abort', cancel); dispose();
    };
    const fail = (reason: unknown): void => {
      if (finished) return;
      finished = true; cleanup();
      // Preserve both failures for diagnostics without changing Abort/Timeout names.
      if (firstStartupError && reason instanceof Error && Object.isExtensible(reason))
        Object.defineProperty(reason, 'workerStartupFailure', { value: firstStartupError, enumerable: true });
      reject(reason);
    };
    const cancel = (): void => fail(new DOMException(`${label} cancelled`, 'AbortError'));
    const deadline = setTimeout(() => fail(new DOMException(`${label} exceeded ${timeoutMs} ms budget`, 'TimeoutError')), timeoutMs);
    const start = (): void => {
      retry = undefined;
      if (finished) return;
      if (signal?.aborted) { cancel(); return; }
      let worker: RequestWorker<Request, Response>;
      try { worker = createWorker(); } catch (error) { fail(error); return; }
      if (finished || signal?.aborted) { worker.terminate(); if (!finished) cancel(); return; }
      current = worker;
      const attempt = ++attempts;
      let acknowledged = false;
      const active = (): boolean => !finished && current === worker && attempt === attempts;
      worker.onmessage = ({ data }) => {
        if (!active() || !data || data.id !== request.id) return;
        acknowledged = true;
        if ('started' in data && data.started === true && !('result' in data) && !('error' in data)) return;
        let result: Result;
        try { result = decode(data); } catch (error) { fail(error); return; }
        finished = true; cleanup(); resolve(result);
      };
      worker.onerror = event => {
        if (!active()) return;
        const error = new Error(event.message || `${label} Worker failed before responding`);
        if (acknowledged || attempts >= 2) { fail(error); return; }
        firstStartupError = error; dispose();
        // Do not preventDefault: the original browser failure remains observable.
        retry = setTimeout(start, WORKER_STARTUP_RETRY_DELAY_MS);
      };
      worker.onmessageerror = () => { if (active()) fail(new Error(`${label} transfer failed`)); };
      // No transfer list: retry must retain the exact original input buffers.
      try { worker.postMessage(request); } catch (error) { fail(error); }
    };
    signal?.addEventListener('abort', cancel, { once: true });
    start();
  });
}
