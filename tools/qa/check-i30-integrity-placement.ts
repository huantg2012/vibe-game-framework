import assert from 'node:assert/strict';
import { CHAMBER_MODULE_BOUNDS, INTEGRITY_COLORS, integrityCapacityRatio, integrityCondition, integrityConditionLabel, integrityFillColor, integrityRectsOverlap,
  moduleIntegrityBounds, placeIntegrityReadout, type IntegrityRect } from '../../src/ui/chamber-integrity-placement.ts';

let checks = 0;
const check = (condition: unknown, message: string) => { checks++; assert(condition, message); };
const device = moduleIntegrityBounds('CORE', 253, 299);
const actor = (x: number, y: number): IntegrityRect => ({ left: x - 22, right: x + 22, top: y - 17, bottom: y + 18 });
const base = { device, player: actor(284, 303), width: 4, height: 26, gap: 7, clearance: 5, hysteresis: 8 };
check(placeIntegrityReadout(base).side === 'left', 'Actor to right puts world gauge on left');
check(placeIntegrityReadout({ ...base, player: actor(217, 279) }).side === 'right', 'Actor to left puts world gauge on right');
check(placeIntegrityReadout({ ...base, player: actor(251, 319), previousSide: 'left' }).side === 'left', 'Center dead band retains last side');
const crossing = placeIntegrityReadout({ ...base, player: { left: 211, right: 296, top: 232, bottom: 285 }, previousSide: 'left' });
check(!integrityRectsOverlap(crossing.rect, { left: 211, right: 296, top: 232, bottom: 285 }, 5), 'A wide held tool overrides hysteresis and forces immediate clearance');
check(crossing.rect.bottom <= 227 || crossing.rect.top >= 290, 'Both sides occupied moves outside actor vertical band');
for (const maxHp of [100, 115, 130, 145, 200]) {
  for (const hp of [0, 24, 25, 70, 100, 115]) {
    const expected = hp <= 0 ? 'failed' : hp < 25 ? 'danger' : hp < 100 ? 'damaged' : 'stable';
    check(integrityCondition(hp) === expected, `${hp}/${maxHp} fixed-100 performance condition`);
    check(integrityFillColor(hp, maxHp) === (hp < 25 ? INTEGRITY_COLORS.danger : hp < 100 ? INTEGRITY_COLORS.damaged : INTEGRITY_COLORS.normal), 'Capacity does not change performance color');
    check(integrityCapacityRatio(hp, maxHp) === Math.min(1, hp / maxHp), 'Gauge length alone uses actual capacity');
  }
}
check(integrityConditionLabel(0) === '失效', 'Zero HP retains a failure word as well as the danger cap');
check(integrityFillColor(100, 100) === integrityFillColor(100, 115), 'Real 100/100 → 100/115 thickening cannot imply lost efficacy');
check(integrityCapacityRatio(100, 115) < integrityCapacityRatio(100, 100), 'Thickening still displays extra buffer capacity');
const luminance = (hex: string): number => {
  const values = hex.slice(1).match(/../g)!.map(channel => {
    const c = parseInt(channel, 16) / 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  });
  return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722;
};
for (const color of [INTEGRITY_COLORS.normal, INTEGRITY_COLORS.damaged, INTEGRITY_COLORS.danger]) {
  check((luminance(color) + .05) / (luminance(INTEGRITY_COLORS.track) + .05) >= 3, 'Every condition has at least 3:1 internal track contrast');
  check((luminance(color) + .05) / (luminance(INTEGRITY_COLORS.outline) + .05) >= 4.5, 'Condition remains legible against its thin dark edge');
}

// Sweep the entire authored approach area for all three silhouettes. This checks
// the user's invariant, not a snapshot of the candidate-selection algorithm.
for (const type of Object.keys(CHAMBER_MODULE_BOUNDS) as (keyof typeof CHAMBER_MODULE_BOUNDS)[]) {
  const host = moduleIntegrityBounds(type, 320, 290);
  for (let x = 250; x <= 390; x += 5) for (let y = 205; y <= 335; y += 5) {
    const player = actor(x, y);
    const result = placeIntegrityReadout({ ...base, device: host, player });
    check(result.visible && !integrityRectsOverlap(result.rect, player, 5), `${type} world never covers actor ${x},${y}`);
    check(result.rect.right <= host.left - 7 || result.rect.left >= host.right + 7, 'World gauge remains outside device silhouette');
  }
}
const viewport = { left: 16, top: 16, right: 944, bottom: 624 };
const work = { left: 520, top: 212, right: 780, bottom: 566 };
for (const zoom of [1.5, 1.7, 2, 2.6, 3]) for (const type of Object.keys(CHAMBER_MODULE_BOUNDS) as (keyof typeof CHAMBER_MODULE_BOUNDS)[]) {
  const shape = CHAMBER_MODULE_BOUNDS[type];
  const host = { left: 320 + shape[0] * zoom, right: 320 + shape[2] * zoom,
    top: 330 + (shape[1] + 24) * zoom, bottom: 330 + (shape[3] + 24) * zoom };
  for (let x = 160; x <= 480; x += 16) for (let y = 260; y <= 470; y += 21) {
    const player = { left: x - 22 * zoom, right: x + 22 * zoom, top: y - 17 * zoom, bottom: y + 18 * zoom };
    const result = placeIntegrityReadout({ device: host, player, width: 104, height: 74, gap: 14,
      clearance: 8, hysteresis: 8 * zoom, viewport, reserved: [work] });
    check(result.visible, `${type} focused view has a legal place at ${zoom}/${x}/${y}`);
    check(!integrityRectsOverlap(result.rect, player, 8) && !integrityRectsOverlap(result.rect, work, 8), 'DOM never overlays actor or decision controls');
    check(result.rect.left >= 16 && result.rect.right <= 944 && result.rect.top >= 16 && result.rect.bottom <= 624, 'DOM stays on fixed viewport');
  }
}
const trapped = placeIntegrityReadout({ ...base, width: 104, height: 74, viewport: { left: 245, top: 225, right: 280, bottom: 302 } });
check(!trapped.visible, 'Impossible camera crop hides readout instead of covering actor');
console.log(`I30 integrity placement: ${checks} checks passed.`);
