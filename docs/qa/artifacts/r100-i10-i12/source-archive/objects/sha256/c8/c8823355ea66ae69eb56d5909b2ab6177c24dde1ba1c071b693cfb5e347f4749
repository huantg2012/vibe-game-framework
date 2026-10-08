/**
 * Generic object pool for reusable objects.
 * Prevents GC pressure in the game loop.
 */

export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 0) {
    this.factory = factory;
    this.reset = reset;

    // Pre-allocate
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * Get an object from the pool (or create a new one if pool is empty).
   */
  acquire(): T {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return this.factory();
  }

  /**
   * Return an object to the pool after use.
   */
  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  /**
   * Current number of available objects in pool.
   */
  get available(): number {
    return this.pool.length;
  }

  /**
   * Clear all pooled objects.
   */
  clear(): void {
    this.pool.length = 0;
  }
}
