/** Dedicated, single-request worker; termination is the cancellation boundary. */
import { executeRiftGeneration } from './rift-generation-execute';
import { riftGenerationTransferables } from './rift-generation-protocol';
import type { RiftGenerationRequest, RiftGenerationResponse } from './rift-generation-protocol';

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<RiftGenerationRequest>) => void) | null;
  postMessage(message: RiftGenerationResponse, transfer?: ArrayBuffer[]): void;
};
worker.onmessage = ({ data }) => {
  try { const result = executeRiftGeneration(data.input);
    worker.postMessage({ id: data.id, result }, riftGenerationTransferables(result)); }
  catch (error) { worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }); }
};
