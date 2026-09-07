/** Small scene-owned painter order. World y is never used as a render depth:
 * preserve the fixed floor, readout and visibility-mask bands. */
export const GROUND_LIGHT_DEPTH = 5;
export const WORLD_READOUT_DEPTH = 40;
const ENTITY_START = 20;
const ENTITY_END = 38;

export interface GroundDepthTarget {
  readonly id: string;
  readonly groundY: () => number;
  /** Local body/glow layers must remain within [base, base + 1). */
  readonly applyDepth: (base: number) => void;
}

export class GroundDepthSorter {
  private readonly ordered: GroundDepthTarget[];
  private readonly depths = new Map<string, number>();

  constructor(targets: readonly GroundDepthTarget[]) {
    this.ordered = [...targets];
    if (new Set(targets.map(target => target.id)).size !== targets.length) {
      throw new Error('Ground depth targets require unique identities');
    }
    if (targets.length > ENTITY_END - ENTITY_START) {
      throw new Error('Too many ground depth targets for the reserved entity band');
    }
  }

  update(): void {
    this.ordered.sort((a, b) => a.groundY() - b.groundY() ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const stride = (ENTITY_END - ENTITY_START) / Math.max(1, this.ordered.length);
    this.ordered.forEach((target, rank) => {
      const depth = ENTITY_START + rank * stride;
      if (this.depths.get(target.id) === depth) return;
      target.applyDepth(depth);
      this.depths.set(target.id, depth);
    });
  }
}
