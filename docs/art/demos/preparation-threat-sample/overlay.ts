import { mountVeil as mountSharedVeil, type VeilController } from '../../../../src/ui/dom/preparation-veil';
export type { VeilController, VeilTelemetry } from '../../../../src/ui/dom/preparation-veil';

/** The recording study retains pixels between RAF draws for its capture path. */
export function mountVeil(canvas: HTMLCanvasElement): VeilController {
  return mountSharedVeil(canvas, { preserveDrawingBuffer: true });
}
