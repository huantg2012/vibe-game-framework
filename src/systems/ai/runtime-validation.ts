/** JSON boundary checks shared by the finite actor recovery contract. */
import type { Facing4, Vector2 } from '@/types/game-types';
import type { ContaminationForm } from '@/generation/contamination-draw';

export function runtimeRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function runtimeNumber(value: unknown, minimum = -Infinity, maximum = Infinity): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function runtimeInteger(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return runtimeNumber(value, minimum, maximum) && Number.isSafeInteger(value);
}

export function runtimeVector(value: unknown): value is Vector2 {
  return runtimeRecord(value) && runtimeNumber(value.x) && runtimeNumber(value.y);
}

export function runtimeFacing(value: unknown): value is Facing4 {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

export function runtimeStrings(value: unknown, maximum: number): value is string[] {
  return Array.isArray(value) && value.length <= maximum && value.every(id => typeof id === 'string' && id.length > 0)
    && new Set(value).size === value.length;
}

export function copyRuntimeVector(value: Readonly<Vector2>): Vector2 { return { x: value.x, y: value.y }; }

/** The first recovery package accepts only the two authored native insect profiles. */
export function runtimeEnemyForm(value: unknown, role: unknown): value is ContaminationForm {
  return runtimeRecord(value) && value.substrate === 'insect_remnant' && value.coverage === 'infiltrate'
    && value.continuity === 'monolith' && value.occupancy === 'floor' && value.portfolio === 'jia'
    && value.utteranceId === undefined && runtimeRecord(value.lexemes)
    && value.lexemes.motion === 'motion_patrol' && value.lexemes.rhythm === 'rhythm_open'
    && value.lexemes.contact === 'contact_melee_three'
    && ((role === 'infiltrator' && value.lexemes.sense === 'sense_cone')
      || (role === 'rewriter' && value.lexemes.sense === 'sense_hear'));
}

/** Opt-in mulberry32 stream. Legacy scenes continue to use their original random source. */
export class AIRuntimeRandom {
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  exportState(): number { return this.state; }
  restoreState(state: number): void {
    if (!runtimeInteger(state, 0, 0xffffffff)) throw new Error('Invalid AI random state');
    this.state = state;
  }
}
