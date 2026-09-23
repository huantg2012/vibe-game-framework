import assert from 'node:assert/strict';
import { CHAMBER_MODULE_BOUNDS, INTEGRITY_COLORS, integrityFillColor, integrityRectsOverlap,
  moduleIntegrityBounds, placeIntegrityReadout, type IntegrityRect } from '../../src/ui/chamber-integrity-placement.ts';

let checks = 0;
const check = (condition: unknown, message: string) => { checks++; assert(condition, message); };
const device = moduleIntegrityBounds('CORE', 253, 299);
const actor = (x: number, y: number): IntegrityRect => ({ left: x - 22, right: x + 22, top: y - 17, bottom: y + 18 });
const base = { device, player: actor(284, 303), width: 2, height: 24, gap: 7, clearance: 5, hysteresis: 8 };
check(placeIntegrityReadout(base).side === 'left', 'Actor to right puts world gauge on left');
check(placeIntegrityReadout({ ...base, player: actor(217, 279) }).side === 'right', 'Actor to left puts world gauge on right');
check(placeIntegrityReadout({ ...base, player: actor(251, 319), previousSide: 'left' }).side === 'left', 'Center dead band retains last side');
const crossing = placeIntegrityReadout({ ...base, player: { left: 211, right: 296, top: 232, bottom: 285 }, previousSide: 'left' });
check(!integrityRectsOverlap(crossing.rect, { left: 211, right: 296, top: 232, bottom: 285 }, 5), 'A wide held tool overrides hysteresis and forces immediate clearance');
check(crossing.rect.bottom <= 227 || crossing.rect.top >= 290, 'Both sides occupied moves outside actor vertical band');
check(integrityFillColor(25, 100) === INTEGRITY_COLORS.normal, '25% is not below danger threshold');
check(integrityFillColor(24, 100) === INTEGRITY_COLORS.danger, 'Below25% is danger');
check(integrityFillColor(40, 200) === INTEGRITY_COLORS.danger, 'Danger follows actual upgraded capacity');
check(integrityFillColor(0, 100) === INTEGRITY_COLORS.danger, 'Broken module retains danger cue');

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
