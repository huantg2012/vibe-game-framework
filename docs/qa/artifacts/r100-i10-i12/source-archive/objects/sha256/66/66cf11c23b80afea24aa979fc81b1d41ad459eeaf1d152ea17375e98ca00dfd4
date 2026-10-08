/** Authored inputs and borrowed views for one living landscape. The gameplay
 * clock owns both the support deformation and the tension hazard. */
export interface LandmassPoint { readonly x: number; readonly y: number }

export interface SupportSample {
  height: number;
  normal: { x: number; y: number; z: number };
  supportId: string | null;
}

export interface LandmassSupportDefinition {
  readonly id: string;
  readonly kind: 'stable' | 'fin';
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly angle: number;
  readonly height: number;
  /** Added at maximum authored tension; its influence is zero off this support. */
  readonly flexHeight: number;
}

export interface TensionDefinition {
  readonly id: string;
  readonly center: LandmassPoint;
  /** Actual melee point; it is separate from the hazardous patch centre. */
  readonly position: LandmassPoint;
  readonly quietMs: number;
  readonly warningMs: number;
  readonly activeMs: number;
  readonly releaseMs: number;
  readonly transmissionMs: number;
  readonly reliefMs: number;
  readonly dangerThreshold: number;
  readonly damage: number;
  readonly hitIntervalMs: number;
  readonly outline: readonly LandmassPoint[];
}

export type TensionPhase = 'rest' | 'strain' | 'pull' | 'release';

export interface TensionView {
  readonly id: string;
  readonly position: LandmassPoint;
  readonly elapsedMs: number;
  readonly cycle: number;
  readonly cycleTimeMs: number;
  readonly phase: TensionPhase;
  readonly phaseProgress: number;
  /** A single continuous pose, sampled by ground, understructure and connections. */
  readonly tension: number;
  readonly naturalTension: number;
  readonly reliefProgress: number;
  readonly canHit: boolean;
  readonly active: boolean;
  readonly stopped: boolean;
  readonly outline: readonly LandmassPoint[];
  readonly hitSequence: number;
  readonly hitAtMs: number | null;
  readonly contactAttempts: number;
  readonly committedHits: number;
  readonly lastContactAtMs: number | null;
}

export interface TensionRuntimeStateV1 {
  readonly version: 1;
  readonly signature: string;
  readonly elapsedMs: number;
  readonly relievedCycle: number;
  readonly nextContactAtMs: number;
  readonly stopped: boolean;
  readonly hitSequence: number;
  readonly hitAtMs: number | null;
  readonly contactAttempts: number;
  readonly committedHits: number;
  readonly lastContactAtMs: number | null;
}
