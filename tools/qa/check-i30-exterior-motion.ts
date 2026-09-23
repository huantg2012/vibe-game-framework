/** The player must expose depth while the room camera stays completely still.
 * This checks physical behavior, pinned render cells and activity duty cycle. */
import assert from 'node:assert/strict';
import { ChamberExteriorMotion, CHAMBER_EXTERIOR_REFERENCE, CHAMBER_EXTERIOR_LAYERS,
  CHAMBER_EXTERIOR_MAX_OBSERVER_OFFSET, chamberNearParallaxWeight,
  sampleChamberDistantPresence, CHAMBER_PRESENCE_PERIOD_MS,
  CHAMBER_PRESENCE_START_MS, CHAMBER_PRESENCE_DURATION_MS,
  type ChamberDistantPresence } from '../../src/scenes/chamber-exterior-motion';
import { CHAMBER_CONTACTS, CHAMBER_EXTERIOR_CONTACTS } from '../../src/systems/purification-chamber-layout';

let checks = 0;
function check(condition: unknown, label: string): void { assert(condition, label); checks++; }
function close(actual: number, expected: number, label: string, tolerance = 1e-8): void {
  check(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}
const reference = CHAMBER_EXTERIOR_REFERENCE;
function settle(model: ChamberExteriorMotion, x: number, y: number, fps = 60): void {
  for (let frame = 0; frame < fps * 3; frame++) model.update(1000 / fps, reference.x + x, reference.y + y, false);
}

// Independent input directions, including diagonals, must move all three
// depths in the same direction with a visibly non-zero difference.
for (const [x, y] of [[100, 0], [-100, 0], [0, 100], [0, -100],
  [70, 70], [-70, 70], [70, -70], [-70, -70]]) {
  const model = new ChamberExteriorMotion();
  settle(model, x!, y!);
  const { far, middle, near } = model.offsets;
  for (const offset of [far, middle, near]) {
    check(Math.sign(offset.x) === Math.sign(x!) && Math.sign(offset.y) === Math.sign(y!), 'All depths share observer direction');
  }
  check(Math.hypot(far.x - middle.x, far.y - middle.y) > 4, 'Distant/middle difference is visible under a stationary camera');
  check(Math.hypot(middle.x - near.x, middle.y - near.y) > 4, 'Middle/near difference is visible under a stationary camera');
  const saved = JSON.stringify(model.offsets);
  model.update(0, reference.x - x!, reference.y - y!, false);
  check(JSON.stringify(model.offsets) === saved, 'Paused zero-delta does not change the pose');
  for (let frame = 0; frame < 60; frame++) model.update(1000 / 60, reference.x - x!, reference.y - y!, true);
  check(JSON.stringify(model.offsets) === saved, 'Reduced motion keeps the exact current composition');
  settle(model, 0, 0);
  close(model.offsets.far.x, 0, 'Return to same X returns to same pose');
  close(model.offsets.far.y, 0, 'Return to same Y returns to same pose');
}

for (const fps of [30, 60, 120]) {
  const model = new ChamberExteriorMotion();
  for (let frame = 0; frame < fps; frame++) model.update(1000 / fps, reference.x + 100, reference.y - 80, false);
  close(model.observer.x, 100 * (1 - Math.exp(-1000 / 130)), 'Frame-rate independent observer X');
  close(model.observer.y, -80 * (1 - Math.exp(-1000 / 130)), 'Frame-rate independent observer Y');
  model.update(16, -1000, -1000, false);
  check(model.observer.x > 50, 'A teleport or focus change cannot snap the observer in one frame');
}
const limited = new ChamberExteriorMotion();
settle(limited, 100000, -100000);
check(Math.abs(limited.offsets.far.x) <= 24 && Math.abs(limited.offsets.far.y) <= 24, 'Extreme input stays inside plate overscan');
close(limited.observer.x, CHAMBER_EXTERIOR_MAX_OBSERVER_OFFSET, 'Observer clamp', 1e-7);
check(CHAMBER_EXTERIOR_LAYERS.map(layer => layer.id).join(',') === 'far,middle,near', 'Stable painter depth order');

// The actual runtime mesh is 16px cells. All vertices around every attachment
// and source/path point must be pinned, not merely a theoretical point center.
for (const source of CHAMBER_EXTERIOR_CONTACTS) {
  const root = CHAMBER_CONTACTS[source.id];
  const points = [[root.x, root.y], [source.x, source.y], ...source.path];
  for (const [x, y] of points) {
    const left = Math.floor(x! / 16) * 16, top = Math.floor(y! / 16) * 16;
    for (const vx of [left, left + 16]) for (const vy of [top, top + 16]) {
      close(chamberNearParallaxWeight(vx, vy), 0, 'All enclosing render-cell vertices are pinned');
    }
  }
}
check(chamberNearParallaxWeight(620, 360) > .99, 'Outer near mass genuinely receives parallax');
// This finite-difference bound prevents cracks/folds or steep stretch in the
// pinned projection. There is one shared mesh, with no separately rounded strips.
for (let y = 0; y <= 384; y += 16) for (let x = 0; x <= 624; x += 16) {
  const w = chamberNearParallaxWeight(x, y);
  check(w >= 0 && w <= 1, 'Projection weight is bounded');
  for (const next of [chamberNearParallaxWeight(x + 16, y), chamberNearParallaxWeight(x, y + 16)]) {
    check(Math.abs(next - w) * 6.8 < 2.3, 'Adjacent vertices do not tear or invert under extreme parallax');
  }
}

const presence: ChamberDistantPresence = { active: false, cycle: 0, phase: 0, alpha: 0, x: 0, y: 0 };
let activeSamples = 0;
for (let time = 0; time < CHAMBER_PRESENCE_PERIOD_MS * 3; time += 100) {
  sampleChamberDistantPresence(time, presence);
  if (presence.active) activeSamples++;
  check(presence.alpha >= 0 && presence.alpha <= .52, 'Distant presence is dim and bounded');
  check(presence.x >= 486 && presence.x <= 510 && presence.y >= 200 && presence.y <= 206,
    'Presence stays inside the authored remote aperture');
}
check(activeSamples / (CHAMBER_PRESENCE_PERIOD_MS * 3 / 100) < .18, 'Far presence is absent more than 82% of the time');
sampleChamberDistantPresence(CHAMBER_PRESENCE_START_MS, presence);
close(presence.alpha, 0, 'Appearance starts without a flash');
sampleChamberDistantPresence(CHAMBER_PRESENCE_START_MS + CHAMBER_PRESENCE_DURATION_MS, presence);
close(presence.alpha, 0, 'Appearance ends without a flash');
sampleChamberDistantPresence(CHAMBER_PRESENCE_START_MS + CHAMBER_PRESENCE_DURATION_MS / 2, presence);
close(presence.alpha, .52, 'Fixed production midpoint is available to offline rendering');

console.log(`PASS: ${checks} exterior contracts (8-way player motion, 30/60/120fps, pinned mesh, reduced motion and rare distant activity)`);
