/**
 * Offline stub so contamination form bakers can run under `tsx` (no DOM).
 * Only covers what the bake path touches: `Textures.FilterMode` + a `Scene` shape.
 * Preview tooling only. Never imported by `src/**`.
 */

class Scene {}

const Phaser = {
  Scene,
  Textures: { FilterMode: { NEAREST: 0, LINEAR: 1 } },
  Math: { Between: (a: number, b: number): number => a + Math.floor(Math.random() * (b - a + 1)) },
};

export default Phaser;
export { Scene };
