/** Geometry shared by the chamber's world gauge and its focused DOM readout.
 * All inputs use one coordinate space. No camera assumptions or scene mutation. */
export interface IntegrityRect { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type IntegritySide = 'left' | 'right';
export interface IntegrityPlacement { readonly side: IntegritySide; readonly rect: IntegrityRect; readonly visible: boolean }

/** Full authored silhouettes relative to the ground contact, including clamps. */
export const CHAMBER_MODULE_BOUNDS = {
  CORE: [-30, -92, 32, 3], STORAGE: [-22, -42, 23, 3], PURIFIER: [-29, -41, 31, 3],
} as const;
export const INTEGRITY_COLORS = {
  normal: '#9eaaa8', damaged: '#bf965b', danger: '#bd685e', track: '#2a2d32', outline: '#101716',
} as const;
export type IntegrityCondition = 'stable' | 'damaged' | 'danger' | 'failed';
/** Performance is capped at 100 HP. Extra capacity is a buffer, not lost efficacy. */
export const integrityCondition = (hp: number): IntegrityCondition =>
  hp <= 0 ? 'failed' : hp < 25 ? 'danger' : hp < 100 ? 'damaged' : 'stable';
export const integrityConditionLabel = (hp: number): string =>
  ({ stable: '稳定', damaged: '受损', danger: '危险', failed: '失效' })[integrityCondition(hp)];
export const integrityFillColor = (hp: number, _maxHp?: number): string =>
  hp < 25 ? INTEGRITY_COLORS.danger : hp < 100 ? INTEGRITY_COLORS.damaged : INTEGRITY_COLORS.normal;
export const integrityCapacityRatio = (hp: number, maxHp: number): number =>
  maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;

/** Distance from the player's feet to the actual authored footprint, not its E anchor. */
export function distanceToIntegrityFootprint(point: Readonly<{ x: number; y: number }>,
  polygon: readonly Readonly<{ x: number; y: number }>[]): number {
  if (polygon.length < 3) return Infinity;
  let inside = false, distanceSq = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x, dy = b.y - a.y, lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
    distanceSq = Math.min(distanceSq, (point.x - a.x - dx * t) ** 2 + (point.y - a.y - dy * t) ** 2);
  }
  return inside ? 0 : Math.sqrt(distanceSq);
}

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
  /** Used only while fading the retained side; never crosses the actor. */
  readonly lockSide?: IntegritySide;
}

export function integrityPlacementIsSafe(rect: IntegrityRect, input: IntegrityPlacementInput): boolean {
  const { viewport, clearance, device } = input;
  return (!viewport || rect.left >= viewport.left && rect.right <= viewport.right
    && rect.top >= viewport.top && rect.bottom <= viewport.bottom)
    && !integrityRectsOverlap(rect, device)
    && !integrityRectsOverlap(rect, input.player, clearance)
    && (input.reserved ?? []).every(blocker => !integrityRectsOverlap(rect, blocker, clearance));
}

/** Keep the gauge opposite the actor; resolve collisions immediately, with no
 * interpolation through the actor. Vertical alternatives retain device identity. */
export function placeIntegrityReadout(input: IntegrityPlacementInput): IntegrityPlacement {
  const { device, player, width, height, gap, clearance, viewport } = input;
  const delta = (input.playerX ?? (player.left + player.right) / 2) - (device.left + device.right) / 2;
  const preferred: IntegritySide = input.lockSide ?? (input.previousSide && Math.abs(delta) <= input.hysteresis
    ? input.previousSide : delta >= 0 ? 'left' : 'right');
  const blockers = [player, ...(input.reserved ?? [])];
  const targetY = (device.top + device.bottom - height) / 2;
  const sides: IntegritySide[] = input.lockSide ? [input.lockSide] : [preferred, preferred === 'left' ? 'right' : 'left'];
  const initial = (side: IntegritySide, top = targetY): IntegrityRect => {
    const left = side === 'left' ? device.left - gap - width : device.right + gap;
    return { left, top, right: left + width, bottom: top + height };
  };
  const legal = (rect: IntegrityRect): boolean => integrityPlacementIsSafe(rect, input);
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
