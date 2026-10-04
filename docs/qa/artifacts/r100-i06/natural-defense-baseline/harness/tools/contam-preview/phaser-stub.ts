/**
 * Offline stub so contamination form bakers can run under `tsx` (no DOM).
 * Covers bake constants and the geometry used when recovery checks construct
 * real actors. Test/preview tooling only. Never imported by `src/**`.
 */

class Scene {}
// Allows scene modules to declare loader subclasses in CPU-only tests. Asset
// loading itself is outside this host and must not silently pretend to work.
class File {
  constructor() { throw new Error('Asset loading is unavailable in the CPU Phaser test host'); }
}

class Rectangle {
  constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
  get left(): number { return this.x; }
  get right(): number { return this.x + this.width; }
  get top(): number { return this.y; }
  get bottom(): number { return this.y + this.height; }
  setTo(x: number, y: number, width: number, height: number): this {
    this.x = x; this.y = y; this.width = width; this.height = height;
    return this;
  }
  static Union(a: Rectangle, b: Rectangle, out = new Rectangle()): Rectangle {
    const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
    // Read both edges before mutating out: production aliases it with a.
    const right = Math.max(a.right, b.right), bottom = Math.max(a.bottom, b.bottom);
    return out.setTo(left, top, right - left, bottom - top);
  }
  static Contains(rectangle: Rectangle, x: number, y: number): boolean {
    return rectangle.width > 0 && rectangle.height > 0
      && x >= rectangle.left && x <= rectangle.right && y >= rectangle.top && y <= rectangle.bottom;
  }
}

const Phaser = {
  Scene,
  Loader: { File },
  Geom: { Rectangle },
  Textures: { FilterMode: { NEAREST: 0, LINEAR: 1 } },
  Math: { Between: (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1)) },
};

export default Phaser;
export { Scene };
