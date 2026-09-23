import assert from 'node:assert/strict';
import { ChamberIntegrityLifecycle, ChamberIntegritySelection } from '../../src/ui/chamber-integrity-lifecycle.ts';
import { distanceToIntegrityFootprint, integrityRectsOverlap, type IntegrityPlacementInput } from '../../src/ui/chamber-integrity-placement.ts';
import { CHAMBER_DEVICE_FOOTPRINTS } from '../../src/systems/purification-chamber-layout.ts';

let checks = 0;
const check = (condition: unknown, message: string): void => { checks++; assert(condition, message); };
const near = (value: number, expected: number, message: string): void => check(Math.abs(value - expected) < .001, message);
type Id = 'CORE' | 'STORAGE';
const selection = new ChamberIntegritySelection<Id>();
const candidates = (core: number, storage = 100, visible = true) => [
  { id: 'CORE' as const, distance: core, visible }, { id: 'STORAGE' as const, distance: storage, visible: true },
];
check(selection.update(60, candidates(44)).selectedId === null, 'A passing glance does not show a gauge');
check(selection.update(59, candidates(44)).selectedId === null, '119 ms does not complete the dwell');
check(selection.update(1, candidates(44)).selectedId === 'CORE', '44 px and 120 ms admit observation');
check(selection.update(16, candidates(58, 1)).selectedId === 'CORE', 'Current owner is sticky despite a nearer candidate');
let result = selection.update(100, candidates(59, 1));
check(result.active && result.selectedId === 'CORE', 'Exiting 58 px preserves the outgoing reading');
selection.update(100, candidates(59, 1));
result = selection.update(50, candidates(59, 1));
check(result.active, '250 ms departure grace remains visible');
result = selection.update(1, candidates(59, 1));
check(!result.active && result.selectedId === 'CORE', 'The old object owns its outgoing 180 ms fade');
selection.update(100, candidates(59, 1));
result = selection.update(79, candidates(59, 1));
check(!result.active && result.selectedId === 'CORE', '179 ms after actual fade start still retains the old owner');
result = selection.update(1, candidates(59, 1));
check(result.active && result.selectedId === 'STORAGE', 'Only after outgoing fade can the stable next target take over');
check(selection.update(16, candidates(1, 1), 'CORE').selectedId === 'CORE', 'Operating object has highest priority');
result = selection.update(16, candidates(1, 100, false));
check(!result.active, 'Opaque occlusion receives no grace');
selection.reset();
check(selection.update(100, candidates(45)).selectedId === null, '45 px is outside entry range');
check(distanceToIntegrityFootprint({ x: 253, y: 318 }, CHAMBER_DEVICE_FOOTPRINTS.core) <= 44, 'Old failing front approach observes the actual core footprint');
near(distanceToIntegrityFootprint({ x: 253, y: 299 }, CHAMBER_DEVICE_FOOTPRINTS.core), 0, 'Point inside footprint is distance zero');
near(distanceToIntegrityFootprint({ x: 5, y: 5 }, [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]), 4.6, 'Footprint distance follows a sloped edge, not its bounding box');

const base: IntegrityPlacementInput = {
  device: { left: 100, right: 150, top: 100, bottom: 200 },
  player: { left: 190, right: 210, top: 270, bottom: 290 }, playerX: 200,
  width: 4, height: 26, gap: 7, clearance: 5, hysteresis: 8,
  viewport: { left: 0, top: 0, right: 960, bottom: 640 },
};
// Compose production selection and presentation classes: dropped frames must
// never expose two world readings, regardless of when grace is first crossed.
for (const steps of [[100, 100, 50, 100, 84, 16, 80, 100], [100, 100, 100, 100, 100], [16, 16, 100, 100, 17, 100, 90, 16]]) {
  const owner = new ChamberIntegritySelection<Id>();
  const gauges = { CORE: new ChamberIntegrityLifecycle(), STORAGE: new ChamberIntegrityLifecycle() };
  owner.update(100, candidates(1)); owner.update(20, candidates(1));
  gauges.CORE.setObserved(true, 0);
  gauges.CORE.sample('world', base, 1000);
  let now = 1000;
  for (const dt of steps) {
    now += dt;
    const chosen = owner.update(dt, candidates(60, 18));
    for (const id of ['CORE', 'STORAGE'] as const)
      gauges[id].setObserved(chosen.selectedId === id && chosen.active, now);
    const alphas = Object.values(gauges).map(gauge => gauge.sample('world', base, now).opacity);
    check(alphas.filter(alpha => alpha > 0).length <= 1, `Only one module owns visible ink at irregular frame ${now}`);
  }
}

const lifecycle = new ChamberIntegrityLifecycle();
lifecycle.setObserved(true, 0);
near(lifecycle.sample('world', base, 0).opacity, 0, 'Entry begins transparent');
near(lifecycle.sample('world', base, 80).opacity, .5, 'Entry is a continuous 160 ms fade');
near(lifecycle.sample('world', base, 160).opacity, 1, 'Entry completes at 160 ms');
lifecycle.setObserved(false, 200);
near(lifecycle.sample('world', base, 290).opacity, .5, 'Leaving uses 180 ms fade');
lifecycle.setObserved(true, 290);
near(lifecycle.sample('world', base, 290).opacity, .5, 'Returning cancels exit without hard flashing');
near(lifecycle.sample('world', base, 370).opacity, 1, 'Cancelled exit restores the same gauge');

lifecycle.setFocused(true, 400);
for (let time = 400; time <= 660; time += 10) {
  const world = lifecycle.sample('world', base, time), focused = lifecycle.sample('focused', { ...base, width: 104, height: 74 }, time);
  check(world.opacity === 0 || focused.opacity === 0, 'E-open never shows both world and focused readings');
}
near(lifecycle.sample('focused', { ...base, width: 104, height: 74 }, 660).opacity, 1, 'Focused handoff completes');
lifecycle.setFocused(false, 700);
for (let time = 700; time <= 900; time += 10) {
  const world = lifecycle.sample('world', base, time), focused = lifecycle.sample('focused', { ...base, width: 104, height: 74 }, time);
  check(world.opacity === 0 || focused.opacity === 0, 'E-close never shows both reading scales');
}
near(lifecycle.sample('world', base, 900).opacity, 1, 'Closing returns to the observed world gauge');

const otherSide = { ...base, playerX: 70, player: { left: 60, right: 80, top: 270, bottom: 290 } };
check(lifecycle.sample('world', otherSide, 1000).placement.side === 'left', 'Safe old side remains in place for fade-out');
near(lifecycle.sample('world', otherSide, 1030).opacity, .5, 'Side fade-out takes 60 ms');
const switched = lifecycle.sample('world', otherSide, 1060);
check(switched.placement.side === 'right' && switched.opacity === 0, 'Side moves only while fully hidden');
near(lifecycle.sample('world', otherSide, 1130).opacity, .5, 'New side uses 140 ms fade-in');
near(lifecycle.sample('world', otherSide, 1200).opacity, 1, 'New side becomes stable');

const rigSweep = { ...otherSide, player: { left: 154, right: 170, top: 132, bottom: 168 } };
const emergency = lifecycle.sample('world', rigSweep, 1220);
check(emergency.opacity === 0, 'A suddenly crossing held tool/lamp masks the old gauge immediately');
check(!integrityRectsOverlap(emergency.placement.rect, rigSweep.player, 5), 'Emergency candidate clears the full rig');
near(lifecycle.sample('world', rigSweep, 1279).opacity, 0, 'Emergency side must remain safe for 60 ms');
near(lifecycle.sample('world', rigSweep, 1420).opacity, 1, 'Safe emergency placement fades back in');

const trapped = { ...rigSweep, viewport: { left: 110, right: 140, top: 100, bottom: 200 } };
check(lifecycle.sample('world', trapped, 1500).opacity === 0, 'No safe viewport space never draws over actor or device');
lifecycle.setObserved(false, 1520, true);
check(lifecycle.sample('world', base, 1520).opacity === 0, 'Opaque wall masks immediately without a visible grace/fade');

const camera = new ChamberIntegrityLifecycle();
camera.setFocused(true, 0);
camera.sample('focused', base, 200);
for (const zoom of [1, 1.5, 2, 2.6, 3]) {
  const input = { ...base, device: { left: 200, right: 200 + 50 * zoom, top: 100, bottom: 100 + 100 * zoom },
    player: { left: 500, right: 540, top: 500, bottom: 540 }, playerX: 520, reserved: [{ left: 550, top: 180, right: 820, bottom: 580 }] };
  const sample = camera.sample('focused', input, 300 + zoom * 100);
  check(sample.placement.rect.right === input.device.left - input.gap, 'Camera zoom uses current-frame device edge');
  check(sample.opacity > 0 && !integrityRectsOverlap(sample.placement.rect, input.reserved[0]!), 'Current projection respects controls');
}
console.log(`I30 R8 integrity lifecycle: ${checks} checks passed.`);
