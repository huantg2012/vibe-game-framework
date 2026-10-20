/// <reference lib="webworker" />
import { renderMaterialBuffers } from '../../../docs/art/demos/purification-last-light/render';
import { ASSIMILATION_MODEL_CAMERA, buildAssimilationModel } from './geometry';
import type { AssimilationModelFrame, AssimilationModelRequest, AssimilationModelResponse } from './protocol';

/** Also callable by finite offline checks; runtime calls this only in a Worker. */
export function bakeAssimilationModel(request: AssimilationModelRequest): AssimilationModelFrame {
  const start = performance.now(), { model, meta } = buildAssimilationModel(request), built = performance.now();
  const frame = renderMaterialBuffers(model, ASSIMILATION_MODEL_CAMERA);
  const depth = new Uint8Array(64 * 80 * 4);
  for (let i = 0; i < 64 * 80; i++) {
    if (!frame.normal[i * 4 + 3]) continue;
    const encoded = Math.max(1, Math.min(65535, Math.round((frame.opaqueDepth[i]! + 80) * 256)));
    depth.set([encoded >> 8, encoded & 255, 4, 255], i * 4);
  }
  return { id: request.id, width: 64, height: 80, albedo: new Uint8Array(frame.albedo.buffer),
    normal: new Uint8Array(frame.normal.buffer), material: new Uint8Array(frame.roughSpec.buffer), depth,
    meta, buildMs: built - start, bakeMs: performance.now() - built, triangles: model.triangles.length };
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  const scope = globalThis as unknown as DedicatedWorkerGlobalScope;
  scope.addEventListener('message', (event: MessageEvent<AssimilationModelRequest>) => {
    try {
      const result = bakeAssimilationModel(event.data);
      scope.postMessage(result satisfies AssimilationModelResponse,
        [result.albedo.buffer, result.normal.buffer, result.material.buffer, result.depth.buffer]);
    } catch (reason) {
      scope.postMessage({ id: event.data?.id ?? -1, error: reason instanceof Error ? reason.message : String(reason) } satisfies AssimilationModelResponse);
    }
  });
}
