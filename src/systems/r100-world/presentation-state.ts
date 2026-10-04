/** Serializable clocks only. Host state, rewards and tactical visibility remain
 * owned by their existing gameplay systems. Safe to import during admission. */
import { PAINTED_MATERIALS_SOURCE_HASH } from '@/generated/r100-materials';
import { validMasterMaterialAudioState, type MasterMaterialAudioState } from './audio';

export interface R100PresentationState {
  readonly version: 1;
  readonly kind: 'r100-material-presentation';
  readonly identity: string;
  readonly elapsedMs: number;
  readonly lastElapsedMs: number;
  readonly audio: MasterMaterialAudioState;
}

export function r100PresentationIdentity(definitionId: string, seed: number, packageHash?: string): string {
  return `${definitionId}:${seed}:${packageHash??PAINTED_MATERIALS_SOURCE_HASH}`;
}

export function validR100PresentationState(value: unknown, identity?: string): value is R100PresentationState {
  if (!value || typeof value !== 'object') return false;
  const state = value as R100PresentationState;
  return state.version === 1 && state.kind === 'r100-material-presentation'
    && typeof state.identity === 'string' && state.identity.length > 0 && state.identity.length < 256
    && (identity === undefined || state.identity === identity)
    && Number.isFinite(state.elapsedMs) && state.elapsedMs >= 0
    && Number.isFinite(state.lastElapsedMs) && state.lastElapsedMs >= state.elapsedMs
    && validMasterMaterialAudioState(state.audio)
    && (state.audio.clock === null || state.audio.clock <= state.elapsedMs);
}

export function r100MaterialPressure(elapsedMs: number, periodSeconds: number): number {
  const cycle = (elapsedMs / 1000 % periodSeconds) / periodSeconds;
  return cycle < .56 ? 0 : cycle < .76 ? (cycle - .56) / .20 : cycle < .83 ? 1 : Math.max(0, 1 - (cycle - .83) / .17);
}
