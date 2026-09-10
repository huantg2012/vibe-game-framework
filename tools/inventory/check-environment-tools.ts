/** Actual Host controls; only graphics and chaos sinks are adapted for Node. */
import assert from 'node:assert/strict';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system';
import type { ContaminationForm } from '../../src/generation/contamination-draw';
import type { MeleeTarget } from '../../src/systems/weapon-swing';
import { getVolumeProfile, sampleVolumeDensity } from '../../src/systems/volume-presence';

class Graphics {
  setDepth() { return this; } setVisible() { return this; } clear() { return this; }
  fillStyle() { return this; } fillRect() { return this; } lineStyle() { return this; }
  strokeRect() { return this; } destroy() {}
}
function form(substrate: string, portfolio: 'bing' | 'ding'): ContaminationForm {
  return { substrate, portfolio, occupancy: portfolio === 'bing' ? 'paint' : 'volume',
    continuity: substrate === 'fungal_mat' ? 'colony' : 'monolith', coverage: 'rewrite', lexemes: { motion: 'motion_anchor', sense: 'sense_domain',
      rhythm: 'rhythm_open', contact: portfolio === 'bing' ? 'contact_step_chaos' : 'contact_volume_chaos' } };
}
function fixture(substrate: string, portfolio: 'bing' | 'ding' = 'ding') {
  const host = new ContaminationHostSystem(); let chaos = 0;
  host.bindPractice({ add: { graphics: () => new Graphics() } } as never,
    { wallEdges: [], paintFloors: [{floorCol: 6, floorRow: 6}],
      corridorAabbs: [{minCol:4,minRow:4,maxCol:8,maxRow:8,coreCol:6,coreRow:6}] } as never,
    null, {addChaos(_source: string, amount: number) { chaos += amount; }} as never, () => 1, {liveMotion: true});
  const id = host.spawnForm(form(substrate, portfolio)); assert(id);
  const outside = {x:16,y:16};
  const step = (ms: number, core = false) => {
    while (ms > 0) {
      const dt = Math.min(10, ms);
      const p = host.getSubjects()[0]?.position ?? outside;
      host.update(dt, core ? {x:p.x,y:p.y} : outside);
      ms -= dt;
    }
  };
  const row = () => host.getToolTargets().find(target => target.id === id)!;
  return {host, id, step, row, chaos: () => chaos};
}

for (const substrate of ['gas_mass', 'mist_bank', 'dust_swarm']) {
  const f = fixture(substrate), profile = getVolumeProfile(substrate);
  assert.equal(f.row().category, 'volume');
  assert.equal(f.row().hazardReleased, false);
  assert.equal(f.host.suppressReleasedHazard(f.id, 'not-released', 100), false);
  for (const ms of [0, -1, NaN, Infinity]) assert.equal(f.host.delayNextHazard(f.id, 'invalid', ms), false);
  assert.equal(f.host.delayNextHazard(f.id, ' ', 100), false);
  f.step(profile.restMs + profile.gatherMs - 100);
  const frame = f.host.getVolumePresenceFrame(f.id)!;
  assert.equal(frame.phase, 'gather');
  const progress = frame.progress, elapsed = frame.elapsedMs;
  const beforeParts = frame.parts.map(part => ({x:part.cx,y:part.cy}));
  assert(f.host.delayNextHazard(f.id, 'one', 500));
  assert(f.host.delayNextHazard(f.id, 'two', 800));
  f.step(500);
  assert.equal(frame.phase, 'gather'); assert.equal(frame.progress, progress);
  assert.equal(frame.elapsedMs - elapsed, 500, 'ambient time continues while release waits');
  assert.equal(f.row().delayRemainingMs, 300, 'short source expiry cannot remove the long source');
  if (substrate !== 'gas_mass') assert(frame.parts.some((part, i) => part.cx !== beforeParts[i]!.x || part.cy !== beforeParts[i]!.y),
    'drifting material cannot turn into a frozen image');
  f.step(300); assert.equal(frame.progress, progress);
  f.step(100); assert.equal(frame.phase, 'release'); assert(frame.hazardActive);
  assert.equal(f.host.delayNextHazard(f.id, 'too-late', 1000), false, 'released danger cannot be retroactively delayed');
  const before = f.chaos(); f.step(20, true); assert(f.chaos() > before, 'normal released material charges real chaos');
  assert(f.host.suppressReleasedHazard(f.id, 'short', 100));
  assert(f.host.suppressReleasedHazard(f.id, 'long', 250));
  assert.equal(frame.hazardActive, false, 'suppression is immediately authoritative');
  const billed = f.chaos(); f.step(100, true);
  assert.equal(f.chaos(), billed); assert.equal(f.host.getVolumeSightMult(), 1);
  assert.equal(f.row().suppressionRemainingMs, 150);
  assert(frame.hasPresence && sampleVolumeDensity(frame, frame.coreX, frame.coreY) > 0,
    'suppression does not delete the physical material');
  const targets: MeleeTarget[] = []; f.host.collectMeleeTargets(targets);
  assert.equal(targets.length, 1); targets[0]!.applyHit(1);
  assert.equal(f.host.getSubjects().length, 1, 'suppressed core remains hittable and alive');
  f.step(150, true);
  assert.equal(f.row().suppressionRemainingMs, 0); assert(f.row().recoveryPending);
  assert.equal(f.chaos(), billed, 'expiration in release cannot suddenly charge the player');
  let sawGather = false, resumed = false;
  for (let ms = 0; ms < 12000; ms += 10) {
    f.step(10, true);
    if (frame.phase === 'gather') sawGather = true;
    if (frame.hazardActive) { assert(sawGather, 'restored danger gets its real gather prelude'); resumed = true; break; }
  }
  assert(resumed, 'temporary suppression must recover naturally');
  targets[0]!.applyHit(10000);
  assert.equal(f.host.getToolTargets().length, 0);
  assert.equal(f.host.suppressReleasedHazard(f.id, 'dead', 100), false);
  f.host.purgeDead(); f.host.clearHosts();
  const replacement = f.host.spawnForm(form(substrate, 'ding')); assert(replacement);
  assert.equal(f.host.getToolTargets()[0]!.suppressionRemainingMs, 0, 'new host cannot inherit retired controls');
  f.host.destroy();
}

for (const substrate of ['fungal_mat', 'oil_film', 'ash_veil']) {
  const f = fixture(substrate, 'bing');
  assert.equal(f.row().category, 'paint'); assert(f.row().hazardReleased);
  assert.equal(f.host.delayNextHazard(f.id, 'no-unreleased-stage', 1000), false);
  const hit = () => { f.step(10, false); f.step(10, true); };
  hit(); assert(f.chaos() > 0);
  assert(f.host.suppressReleasedHazard(f.id, 'paint', 500));
  const before = f.chaos();
  for (let i = 0; i < 20; i++) hit();
  assert.equal(f.chaos(), before, 'suppressed live paint contact does not charge');
  f.step(100); assert(f.row().recoveryPending);
  let warning = false, resumed = false;
  for (let ms = 0; ms < 7000; ms += 10) {
    f.step(10);
    warning ||= f.row().recoveryWarning;
    if (!f.row().recoveryPending) { resumed = true; break; }
  }
  assert(warning && resumed, 'paint waits for a full low-breath warning before returning');
  hit(); assert(f.chaos() > before);
  f.host.destroy();
}
{
  const f = fixture('sound_echo');
  assert.equal(f.row().canSuppressReleasedHazard, false);
  assert.equal(f.row().canDelayNextHazard, false);
  assert.equal(f.host.suppressReleasedHazard(f.id, 'not-material', 1000), false);
  assert.equal(f.host.delayNextHazard(f.id, 'not-material', 1000), false);
  assert.equal(f.host.delayNextHazard('missing', 'missing', 1000), false);
  f.host.destroy();
}
console.log('check-environment-tools OK: live paint / material volume controls, sources, release clocks, recovery and core survival');
