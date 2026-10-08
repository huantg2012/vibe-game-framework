import type { Vector2 } from '@/types/game-types';

/** Borrowed for this input read only; readers never own the player's position. */
export interface PlayerMovementInputFrame {
  readonly position: Readonly<Vector2>;
  readonly keyboard: Readonly<Vector2>;
  /** Includes opposing held keys even when their net vector is zero. */
  readonly keyboardActive: boolean;
  readonly deltaMs: number;
}
export type PlayerMovementInputReader = (frame: PlayerMovementInputFrame) => Readonly<Vector2> | null;

/** Intents only: velocity, facing, animation and collision remain Player-owned. */
export function resolvePlayerMovementInput(frame: PlayerMovementInputFrame, reader: PlayerMovementInputReader | undefined,
  enabled: boolean, output: Vector2): void {
  output.x = 0; output.y = 0;
  if (!enabled) return;
  const external = reader?.(frame);
  const source = frame.keyboardActive || !external ? frame.keyboard : external;
  let x = source.x, y = source.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (frame.keyboardActive) {
    // Preserve the native keyboard diagonal numerics exactly.
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  } else {
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
  }
  output.x = x; output.y = y;
}
