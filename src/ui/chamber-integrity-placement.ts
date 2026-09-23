/** Geometry shared by the chamber's world gauge and its focused DOM readout.
 * All inputs use one coordinate space. No camera assumptions or scene mutation. */
export interface IntegrityRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type IntegritySide = 'left' | 'right';
export interface IntegrityPlacement { readonly side: IntegritySide; readonly rect: IntegrityRect; readonly visible: boolean }

/** Full authored silhouettes relative to the ground contact, including clamps. */
export const CHAMBER_MODULE_BOUNDS = {
  CORE: [-25, -74, 26, 3], STORAGE: [-22, -42, 23, 3], PURIFIER: [-29, -41, 31, 3],
} as const;
export const INTEGRITY_COLORS = { normal: '#c8cdd4', track: '#2a2d32', danger: '#cc3333' } as const;
export const integrityFillColor = (hp: number, maxHp: number): string =>
  maxHp > 0 && hp / maxHp < .25 ? INTEGRITY_COLORS.danger : INTEGRITY_COLORS.normal;

export function moduleIntegrityBounds(type: keyof typeof CHAMBER_MODULE_BOUNDS, x: number, y: number): IntegrityRect {
  const b = CHAMBER_MODULE_BOUNDS[type];
  return { left: x + b[0], top: y + b[1], right: x + b[2], bottom: y + b[3] };
}
export function integrityRectsOverlap(a: IntegrityRect, b: IntegrityRect, gap = 0): boolean {
  return a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
}
export interface IntegrityPlacementInput {
  readonly device: IntegrityRect;
  /** Full actor silhouette: body, held tool and shoulder lamp, not its feet collider. */
  readonly player: IntegrityRect;
  /** Actor center controls side preference; asymmetric equipment only affects clearance. */
  readonly playerX?: number;
  readonly previousSide?: IntegritySide;
  readonly width: number;
  readonly height: number;
  readonly gap: number;
  readonly hysteresis: number;
  readonly clearance: number;
  readonly viewport?: IntegrityRect;
  readonly reserved?: readonly IntegrityRect[];
}

/** Keep the gauge opposite the actor; resolve collisions immediately, with no
 * interpolation through the actor. Vertical alternatives retain device identity. */
export function placeIntegrityReadout(input: IntegrityPlacementInput): IntegrityPlacement {
  const { device, player, width, height, gap, clearance, viewport } = input;
  const delta = (input.playerX ?? (player.left + player.right) / 2) - (device.left + device.right) / 2;
  const preferred: IntegritySide = input.previousSide && Math.abs(delta) <= input.hysteresis
    ? input.previousSide : delta >= 0 ? 'left' : 'right';
  const blockers = [player, ...(input.reserved ?? [])];
  const targetY = (device.top + device.bottom - height) / 2;
  const sides: IntegritySide[] = [preferred, preferred === 'left' ? 'right' : 'left'];
  const initial = (side: IntegritySide, top = targetY): IntegrityRect => {
    const left = side === 'left' ? device.left - gap - width : device.right + gap;
    return { left, top, right: left + width, bottom: top + height };
  };
  const legal = (rect: IntegrityRect): boolean =>
    (!viewport || rect.left >= viewport.left && rect.right <= viewport.right && rect.top >= viewport.top && rect.bottom <= viewport.bottom)
    && blockers.every(blocker => !integrityRectsOverlap(rect, blocker, clearance));
  // Prefer an unshifted opposite-side reading. If it would cross the player,
  // try the other side before moving a label above/below the occupied band.
  for (const side of sides) {
    const rect = initial(side);
    if (legal(rect)) return { side, rect, visible: true };
  }
  for (const side of sides) {
    const candidate = initial(side);
    const ys = [targetY];
    for (const blocker of blockers) {
      if (candidate.left < blocker.right + clearance && candidate.right > blocker.left - clearance) {
        ys.push(blocker.top - clearance - height, blocker.bottom + clearance);
      }
    }
    if (viewport) ys.push(viewport.top, viewport.bottom - height);
    ys.sort((a, b) => Math.abs(a - targetY) - Math.abs(b - targetY));
    for (const y of ys) {
      const rect = initial(side, y);
      if (legal(rect)) return { side, rect, visible: true };
    }
  }
  // A transient camera crop may leave no honest space. Never cover the actor.
  return { side: preferred, rect: initial(preferred), visible: false };
}
