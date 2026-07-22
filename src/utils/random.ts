/**
 * Seeded random number generator.
 * Uses mulberry32 algorithm for reproducible procedural generation.
 */

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /**
   * Get next random float in [0, 1).
   */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Get random integer in [min, max] (inclusive).
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Get random float in [min, max).
   */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Pick a random element from an array.
   */
  pick<T>(array: readonly T[]): T {
    return array[Math.floor(this.next() * array.length)]!;
  }

  /**
   * Shuffle an array in place (Fisher-Yates).
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j]!, array[i]!];
    }
    return array;
  }
}

/**
 * Generate a random seed from current time + Math.random.
 */
export function generateSeed(): number {
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}
