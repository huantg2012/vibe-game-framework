/** Dedicated, single-request worker; termination is the cancellation boundary. */
import { executeRiftGeneration } from './rift-generation-execute';
import type { RiftGenerationRequest, RiftGenerationResponse } from './rift-generation-protocol';

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<RiftGenerationRequest>) => void) | null;
  postMessage(message: RiftGenerationResponse): void;
};
worker.onmessage = ({ data }) => {
  try { worker.postMessage({ id: data.id, result: executeRiftGeneration(data.input) }); }
  catch (error) { worker.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) }); }
};
