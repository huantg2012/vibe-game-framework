/** Expensive production generation and native material bake stay off the UI thread. */
import { renderWorldSurface, type WorldSurface } from '@/generation/world-study/surface';
import { createRiftGymMap, serializeRiftGymMap, type RiftGymMapWire, type RiftGymSelection } from './rift-gym-model';

export interface RiftGymWorkerRequest {
  readonly id: number;
  readonly selection: RiftGymSelection;
}
export type RiftGymWorkerResult =
  | { readonly id: number; readonly selection: RiftGymSelection; readonly map: RiftGymMapWire; readonly pixels: WorldSurface }
  | { readonly id: number; readonly selection: RiftGymSelection; readonly error: string };

// The main TS project also includes DOM globals; constrain this module to its worker API.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<RiftGymWorkerRequest>) => void) | null;
  postMessage(message: RiftGymWorkerResult, transfer?: Transferable[]): void;
};

worker.onmessage = ({ data }) => {
  const { id, selection } = data;
  try {
    const map = createRiftGymMap(selection);
    const pixels = renderWorldSurface(map.sample);
    worker.postMessage({ id, selection, map: serializeRiftGymMap(map), pixels }, [pixels.rgba.buffer]);
  } catch (error) {
    worker.postMessage({ id, selection, error: error instanceof Error ? error.message : String(error) });
  }
};
