/** Engine-independent geometry and damage stream shared by bodies and host cores. */
export interface MeleeTarget {
  readonly id: string;
  readonly hostId?: string;
  getPosition(): Readonly<{ x: number; y: number }>;
  isAlive(): boolean;
  /** Additional substrate restrictions; ordinary terrain LOS is always tested by combat. */
  canHit?(): boolean;
  applyHit(damage: number): void;
}

/** A separate, counter-based stream: loot rolls and rendering never consume it. */
export function swingDamage(seed: number, sequence: number, minimum: number, maximum: number): number {
  const span = maximum - minimum + 1;
  const ceiling = Math.floor(0x100000000 / span) * span;
  let attempt = 0;
  for (;;) {
    let value = (seed ^ Math.imul(sequence, 0x9e3779b9) ^ Math.imul(attempt++, 0x85ebca6b) ^ 0x43524f57) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value = (value ^ (value >>> 16)) >>> 0;
    if (value < ceiling) return minimum + value % span;
  }
}

/** Fraction of the clockwise short arc where the rod first meets the target centre. */
export function swingContactProgress(
  dx: number, dy: number, facing: number, reach: number, arcRadians: number,
): number | null {
  if (dx * dx + dy * dy > reach * reach) return null;
  let relative = Math.atan2(dy, dx) - facing;
  relative = Math.atan2(Math.sin(relative), Math.cos(relative));
  const half = arcRadians * .5;
  if (Math.abs(relative) > half + 1e-9) return null;
  return Math.max(0, Math.min(1, (relative + half) / arcRadians));
}

export interface WeaponAttackPose {
  phase: 'idle' | 'windup' | 'active' | 'recovery';
  elapsedMs: number;
  facing: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  contactHoldMs: number;
  contactRemainingMs: number;
  contactElapsedMs?: number;
}
