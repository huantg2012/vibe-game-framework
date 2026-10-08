import type { ContaminantType } from '@/types/game-types';

/** Borrowed presentation values. Rendering cannot advance or consume an ability. */
export type ToolPresentationView = {
  readonly elapsedMs: number;
  readonly loadoutTypes: readonly (ContaminantType | null)[];
  readonly seams: readonly Readonly<ToolSeamPresentation>[];
  readonly pressures: readonly Readonly<ToolPressurePresentation>[];
  readonly soundLures: readonly Readonly<ToolSoundPresentation>[];
  readonly siphonRemainingMs: number;
  readonly siphonDurationMs: number;
  readonly muffleEpisodeActive: boolean;
};

export interface ToolSeamPresentation {
  id: number; ax: number; ay: number; bx: number; by: number;
  remainingMs: number; durationMs: number; tension: number; opacity: number;
}
export interface ToolPressurePresentation {
  id: number; x: number; y: number; radius: number;
  remainingMs: number; durationMs: number; opacity: number;
}
export interface ToolSoundPresentation {
  id: number; x: number; y: number; fromX: number; fromY: number; radius: number;
  elapsedMs: number; remainingMs: number; durationMs: number; pulseElapsedMs: number; pulseIntervalMs: number;
}
export interface ToolPresentationFrame {
  elapsedMs: number;
  loadoutTypes: (ContaminantType | null)[];
  seams: ToolSeamPresentation[];
  pressures: ToolPressurePresentation[];
  soundLures: ToolSoundPresentation[];
  siphonRemainingMs: number;
  siphonDurationMs: number;
  muffleEpisodeActive: boolean;
}

export function createToolPresentationFrame(): ToolPresentationFrame {
  return { elapsedMs: 0, loadoutTypes: [], seams: [], pressures: [], soundLures: [],
    siphonRemainingMs: 0, siphonDurationMs: 0, muffleEpisodeActive: false };
}
