/** Engine-independent authored inputs and borrowed, read-only environment views.
 * CSV adapters parse coordinates once; neither the renderer nor audio advances
 * these clocks, chooses targets, or applies damage.
 */
export interface SeaPoint {
  readonly x: number;
  readonly y: number;
}

export interface ShellCycleTiming {
  readonly periodMs: number;
  readonly warningStartMs: number;
  readonly contactStartMs: number;
  readonly contactEndMs: number;
}

export interface ShellDefinition {
  readonly id: string;
  /** The actual melee contact point, not the centre of the decorative shell. */
  readonly position: SeaPoint;
  /** Absolute world-space contact outline; damage continues to use the player centre. */
  readonly spillOutline: readonly SeaPoint[];
  /** A visible, harmless drain into the authored chasm; it adds no walking surface. */
  readonly drainPath: readonly SeaPoint[];
  readonly diversionDelayMs: number;
  readonly returnMs: number;
  readonly damage: number;
  readonly hitIntervalMs: number;
}

export type ShellMode = 'closed' | 'diverting' | 'diverted' | 'returning';

export interface ShellView {
  readonly id: string;
  readonly position: SeaPoint;
  readonly elapsedMs: number;
  readonly cycle: number;
  readonly cycleTimeMs: number;
  readonly mode: ShellMode;
  readonly canHit: boolean;
  readonly coreActive: boolean;
  readonly spillActive: boolean;
  readonly diversionProgress: number;
  readonly returnProgress: number;
  readonly spillOutline: readonly SeaPoint[];
  readonly drainPath: readonly SeaPoint[];
  /** Monotonic for this instance, incremented only by a real Combat contact. */
  readonly hitSequence: number;
  readonly hitAtMs: number | null;
  readonly contactAttempts: number;
  readonly committedHits: number;
  readonly lastContactRegion: 'core' | 'spill' | 'both' | null;
  readonly lastContactAtMs: number | null;
}

export interface SeaEntryView {
  readonly active: boolean;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly progress: number;
}
