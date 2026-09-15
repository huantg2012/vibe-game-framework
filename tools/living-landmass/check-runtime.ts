/** Real world and Combat owners, with engine I/O replaced only at the boundary.
 * Run with the existing Phaser test adapter, not a second gameplay simulator. */
import assert from 'node:assert/strict';
import { createLivingLandmassWorld } from '../../src/dev/living-landmass/world';
import { LivingLandmassRuntime } from '../../src/dev/living-landmass/runtime';
import { LivingLandmassTensionSystem } from '../../src/worlds/living-landmass/tension-system';
import type { TensionDefinition } from '../../src/worlds/living-landmass/types';
import { CombatSystem } from '../../src/systems/combat-system';
import type { MeleeTarget } from '../../src/systems/weapon-swing';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';

let checks = 0;
function check(name: string, run: () => void): void { run(); console.log(`PASS ${name}`); checks++; }
function fixture() {
  const world = createLivingLandmassWorld(7), targets: MeleeTarget[] = [];
  world.tension.collectMeleeTargets(targets);
  return { world, tension: world.tension, target: targets[0]! };
}

check('authored half-open phases and eligible contacts use one world clock', () => {
  const { world, tension, target } = fixture();
  assert.equal(tension.periodMs, 12000);
  for (const [time, phase, canHit, active, height] of [
    [0, 'rest', false, false, 0], [5199, 'rest', false, false, 0],
    [5200, 'strain', true, false, 0], [6400, 'strain', true, false, 16],
    [7600, 'pull', true, true, 32], [9799, 'pull', true, true, 32],
    [9800, 'release', false, false, 32], [10900, 'release', false, false, 16],
    [12000, 'rest', false, false, 0],
  ] as const) {
    world.prepare(time);
    assert.equal(tension.readView().phase, phase); assert.equal(target.canHit!(), canHit);
    assert.equal(tension.readView().active, active); assert(Math.abs(world.groundHeightAt(880, 656) - height) < 1e-5);
  }
  assert.throws(() => world.prepare(11999)); assert.throws(() => world.prepare(NaN));
  assert.equal(world.elapsedMs, 12000);
});

check('early, active and late hits propagate for 350ms then release continuously for 1200ms', () => {
  for (const hitAt of [5500, 7100, 7600, 9700, 9799]) {
    const { world, tension, target } = fixture();
    world.prepare(hitAt); const heightBefore = world.groundHeightAt(880, 656);
    target.applyHit(21);
    assert.equal(tension.readView().hitSequence, 1); assert.equal(target.canHit!(), false);
    assert.equal(world.groundHeightAt(880, 656), heightBefore);
    const unmodified = createLivingLandmassWorld(7);
    for (const age of [0, 100, 349, 350]) {
      world.prepare(hitAt + age); unmodified.prepare(hitAt + age);
      assert(Math.abs(world.groundHeightAt(880, 656) - unmodified.groundHeightAt(880, 656)) < 1e-5);
    }
    const releaseStart = world.groundHeightAt(880, 656);
    world.prepare(hitAt + 351);
    assert(Math.abs(world.groundHeightAt(880, 656) - releaseStart) < .04, 'The propagation endpoint must not snap');
    world.prepare(hitAt + 950); unmodified.prepare(hitAt + 950);
    assert(Math.abs(world.groundHeightAt(880, 656) - Math.min(unmodified.groundHeightAt(880, 656), releaseStart * .5)) < 1e-4);
    world.prepare(hitAt + 1550); assert.equal(world.groundHeightAt(880, 656), 0);
    world.prepare(11999); assert.equal(world.groundHeightAt(880, 656), 0);
    world.prepare(12000); assert.equal(target.canHit!(), false);
    world.prepare(17200); assert.equal(target.canHit!(), true); assert.equal(tension.readView().tension, 0);
  }
});

check('one cycle cannot be relieved twice and empty/invalid contacts do not change state', () => {
  const { world, tension, target } = fixture();
  for (const damage of [0, -1, NaN, Infinity]) target.applyHit(damage);
  target.applyHit(30); assert.equal(tension.readView().hitSequence, 0);
  world.prepare(5600);
  for (const damage of [0, -1, NaN, Infinity]) target.applyHit(damage);
  assert.equal(tension.readView().hitSequence, 0);
  target.applyHit(30); target.applyHit(30); assert.equal(tension.readView().hitSequence, 1);
  assert.equal(target.isAlive(), true, 'An environmental anchor never creates enemy death or loot');
  world.prepare(17600); target.applyHit(30); assert.equal(tension.readView().hitSequence, 2);
});

check('only a strained local footprint hurts, including the irregular edge and the relief threshold', () => {
  const { world, tension, target } = fixture();
  const inside = { x: 880, y: 656 }, hit = { x: 880, y: 788 }, corner = { x: 943, y: 703 };
  const attempts: number[] = [];
  const apply = () => { attempts.push(world.elapsedMs); return true; };
  world.prepare(7599); tension.resolveContact(inside, apply); assert.equal(attempts.length, 0);
  world.prepare(7600); assert(tension.isInsideDanger(inside));
  assert(!tension.isInsideDanger(hit)); assert(!tension.isInsideDanger(corner));
  tension.resolveContact(hit, apply); tension.resolveContact(corner, apply); assert.equal(attempts.length, 0);
  tension.resolveContact(inside, apply); assert.deepEqual(attempts, [7600]);
  target.applyHit(30);
  world.prepare(8150); assert(tension.readView().active);
  world.prepare(8550); assert.equal(tension.readView().tension, .5); assert.equal(tension.readView().active, false);
  tension.resolveContact(inside, apply); assert.equal(attempts.length, 1);
  const clipped = new LivingLandmassTensionSystem(tension.definition, () => false);
  clipped.prepare(7600); clipped.resolveContact(inside, () => { throw new Error('Unsupported void cannot contact'); });
  assert.equal(clipped.readView().contactAttempts, 0);
});

check('invulnerable contact and repeated same-frame reads cannot reset the shared 1000ms attempt interval', () => {
  const { world, tension } = fixture(), position = { x: 880, y: 656 };
  world.prepare(7600); tension.resolveContact(position, () => false);
  const before = JSON.stringify(tension.readView());
  for (let index = 0; index < 100; index++) {
    world.prepare(7600); tension.readView();
    tension.resolveContact(position, () => { throw new Error('Duplicate source contact'); });
  }
  assert.equal(JSON.stringify(tension.readView()), before);
  world.prepare(8599); tension.resolveContact(position, () => { throw new Error('Early repeat'); });
  world.prepare(8600); tension.resolveContact(position, () => true);
  assert.equal(tension.readView().contactAttempts, 2); assert.equal(tension.readView().committedHits, 1);
});

function combatFixture(bodies: { id: string; x: number; y: number }[] = [], consume: () => boolean = () => true) {
  const combat = new CombatSystem(), noise: number[] = [];
  const player = { getPosition: () => ({ x: 880, y: 816 }), getFacingAngle: () => -Math.PI / 2,
    setSpeedModifier() {}, clearSpeedModifier() {}, setWeaponVisual() {}, setWeaponAttackPose() {} };
  const views = bodies.map(row => ({ getId: () => row.id, getPosition: () => row, getFacingAngle: () => 0, isEngaged: () => false }));
  Object.assign(combat, { player,
    occluders: { cols: 80, rows: 80, tileSize: 32, version: 0, isOpaque: () => false },
    hooks: { consumeWeaponUse: consume, onNoise: (_p: unknown, radius: number) => noise.push(radius) },
    ai: { getEnemies: () => views, getEnemyById: (id: string) => views.find(view => view.getId() === id) },
    spawnFx() {}, drawVisuals() {}, stepFx() {} });
  combat.noteRosterChanged(); combat.configureWeapon('crowbar_plain', 7);
  return { combat, noise };
}

check('real crowbar contacts share two targets and one durability at multiple update rates', () => {
  for (const step of [8, 16, 33, 100]) {
    let uses = 0;
    const { combat, noise } = combatFixture([{ id: 'first-body', x: 870, y: 790 }, { id: 'third-body', x: 894, y: 795 }], () => { uses++; return true; });
    const { world, tension } = fixture(); combat.registerMeleeTargets(tension);
    const hits: string[] = [], deaths: string[] = [];
    const onHit = ({ enemyId }: { enemyId: string }) => hits.push(enemyId);
    const onDeath = ({ enemyId }: { enemyId: string }) => deaths.push(enemyId);
    eventBus.on(GameEvent.ENEMY_DAMAGED, onHit); eventBus.on(GameEvent.ENEMY_KILLED, onDeath);
    try {
      world.prepare(5600); combat.requestPlayerAttack();
      for (let time = 0; time < 450;) {
        const delta = Math.min(step, 450 - time); time += delta;
        world.prepare(5600 + time); combat.update(delta);
      }
      assert.equal(uses, 1); assert.equal(tension.readView().hitSequence, 1);
      assert(combat.getEnemyHealth('first-body')! < 75); assert.equal(combat.getEnemyHealth('third-body'), 75);
      assert.deepEqual(hits, ['first-body']); assert.deepEqual(deaths, []);
      assert.equal(noise.filter(radius => radius === 160).length, 1);
    } finally {
      eventBus.off(GameEvent.ENEMY_DAMAGED, onHit); eventBus.off(GameEvent.ENEMY_KILLED, onDeath);
      combat.unregisterMeleeTargets(tension); tension.destroy();
    }
  }
});

check('inactive, obstructed and refused-consumption swings spend nothing; last durability completes the contact', () => {
  for (const mode of ['inactive', 'obstructed', 'refused', 'last'] as const) {
    let consumptionAttempts = 0, durability = 1;
    let combat: CombatSystem;
    ({ combat } = combatFixture([], () => {
      consumptionAttempts++;
      if (mode === 'refused') return false;
      durability--; if (durability === 0) combat.configureWeapon(null); return true;
    }));
    const { world, tension } = fixture(); combat.registerMeleeTargets(tension);
    if (mode === 'obstructed') Object.assign(combat, { occluders: { cols: 200, rows: 200, tileSize: 8, version: 0, isOpaque: (_col: number, row: number) => row === 100 } });
    const start = mode === 'inactive' ? 0 : 5600;
    world.prepare(start); combat.requestPlayerAttack();
    for (let time = 16; time <= 432; time += 16) { world.prepare(start + time); combat.update(16); }
    assert.equal(durability, mode === 'last' ? 0 : 1);
    assert.equal(consumptionAttempts, mode === 'last' || mode === 'refused' ? 1 : 0);
    assert.equal(tension.readView().hitSequence, mode === 'last' ? 1 : 0);
    combat.unregisterMeleeTargets(tension); tension.destroy();
  }
});

check('world state restores the same support, relief and contact budget; corrupt or foreign state is rejected', () => {
  const { world, tension, target } = fixture();
  world.prepare(7600); tension.resolveContact({ x: 880, y: 656 }, () => true); target.applyHit(30);
  world.prepare(8100);
  const saved = structuredClone(world.exportRuntimeState()), expected = [...world.readSupportHeights()];
  const restored = createLivingLandmassWorld(7); restored.restoreRuntimeState(saved);
  assert.deepEqual(restored.exportRuntimeState(), saved); assert.deepEqual([...restored.readSupportHeights()], expected);
  restored.tension.resolveContact({ x: 880, y: 656 }, () => { throw new Error('Restoring must retain contact cooldown'); });
  assert.equal(createLivingLandmassWorld(8).validateRuntimeState(saved), false);
  for (const invalid of [null, {}, { ...saved, elapsedMs: 0 }, { ...saved, signature: 'wrong' },
    { ...saved, tension: { ...saved.tension, hitAtMs: 100 } },
    { ...saved, tension: { ...saved.tension, committedHits: saved.tension.contactAttempts + 1 } },
    { ...saved, tension: { ...saved.tension, nextContactAtMs: Infinity } }]) {
    assert.equal(restored.validateRuntimeState(invalid), false); assert.throws(() => restored.restoreRuntimeState(invalid));
    assert.deepEqual(restored.exportRuntimeState(), saved, 'Rejection must leave accepted runtime untouched');
  }
  for (const time of [8150, 8600, 9000, 11000, 12000, 17600]) {
    world.prepare(time); restored.prepare(time);
    assert.deepEqual(restored.readTensionView(), world.readTensionView());
    assert.deepEqual([...restored.readSupportHeights()], [...world.readSupportHeights()]);
  }
});

function runtimeFixture(failCreation = false) {
  const world = createLivingLandmassWorld(7);
  let ended = false, unregistered = 0, presentedAt = 0, preparedAt = 0, destroyed = 0;
  const contacts: number[] = [], events: { type: string; payload: unknown }[] = [], providers: unknown[] = [];
  const position = { x: 880, y: 656 };
  const context = { player: { getPosition: () => position }, enemies: [],
    applyHazardHit: (_source: string, damage: number) => { contacts.push(damage); return true; },
    isRunEnded: () => ended,
    registerMeleeTargets: (provider: unknown) => { providers.push(provider); return () => { unregistered++; }; },
    readEntryView: () => ({ active: false, elapsedMs: 1200, durationMs: 1200, progress: 1 }),
    getFootprint: () => ({ x: position.x - 10, y: position.y - 10, width: 20, height: 20 }),
    visibilityAt: () => 1 } as unknown as RiftDevRuntimeContext;
  const create = () => new LivingLandmassRuntime(context, world, (type, payload) => events.push({ type, payload }), () => {
    if (failCreation) throw new Error('planned presentation failure');
    return { update: elapsedMs => { presentedAt = elapsedMs; }, prepareFrame: elapsedMs => { preparedAt = elapsedMs; },
      snapshot: () => ({ presentedAt, preparedAt }),
      exportRuntimeState: () => ({ version: 1, elapsedMs: preparedAt }),
      validateRuntimeState: (value: unknown) => Boolean(value && typeof value === 'object' && Reflect.get(value, 'version') === 1
        && Number.isFinite(Reflect.get(value, 'elapsedMs'))),
      restoreRuntimeState: value => { preparedAt = Reflect.get(value as object, 'elapsedMs') as number; },
      destroy: () => { destroyed++; } };
  });
  return { world, create, contacts, events, providers, end: () => { ended = true; },
    read: () => ({ ended, unregistered, presentedAt, preparedAt, destroyed }) };
}

check('runtime wires one real target, same-frame contact and prepared presentation without borrowing event arrays', () => {
  const f = runtimeFixture(), runtime = f.create();
  assert.equal(f.providers.length, 1); assert.equal(f.providers[0], f.world.tension);
  assert.throws(() => runtime.update(7600, false)); assert.equal(f.contacts.length, 0);
  runtime.beforeCombat(7600, false); runtime.update(7600, false); runtime.prepareCheckpoint(7600); runtime.afterUpdate(7600);
  assert.deepEqual(f.contacts, [10]); assert.equal(f.read().presentedAt, 7600); assert.equal(f.read().preparedAt, 7600);
  const events = JSON.stringify(f.events);
  runtime.beforeCombat(8100, false); runtime.update(8100, false);
  assert.equal(JSON.stringify(f.events), events, 'Recorded event copies cannot mutate with the world');
  assert.throws(() => runtime.afterUpdate(8101)); assert.throws(() => runtime.prepareCheckpoint(8101));
  runtime.prepareCheckpoint(8100); const saved = runtime.exportRuntimeState();
  assert(runtime.validateRuntimeState(saved));
  const next = runtimeFixture(), restored = next.create(); restored.restoreRuntimeState(saved);
  assert.deepEqual(restored.exportRuntimeState(), saved);
  restored.afterUpdate(8100); assert.equal(next.events.length, 0, 'Restoring cannot replay an old hit/phase cue');
  runtime.destroy(); runtime.destroy(); restored.destroy();
  assert.equal(f.read().unregistered, 1); assert.equal(f.read().destroyed, 1);
});

check('pause by not advancing preserves support; terminal update and destruction never restart it', () => {
  const f = runtimeFixture(), runtime = f.create();
  runtime.beforeCombat(7600, false); runtime.update(7600, false); runtime.afterUpdate(7600);
  const pause = JSON.stringify(runtime.snapshot());
  for (let index = 0; index < 50; index++) assert.equal(JSON.stringify(runtime.snapshot()), pause);
  f.end(); runtime.update(7600, true);
  const ended = JSON.stringify(f.world.exportRuntimeState()), height = f.world.groundHeightAt(880, 656);
  runtime.beforeCombat(12000, false); runtime.update(12000, true); runtime.afterUpdate(7600);
  assert.equal(JSON.stringify(f.world.exportRuntimeState()), ended); assert.equal(f.world.groundHeightAt(880, 656), height);
  assert.equal(f.world.readTensionView().active, false); assert.equal(f.world.readTensionView().canHit, false);
  assert.equal(f.contacts.length, 1);
  runtime.destroy(); runtime.beforeCombat(24000, false); runtime.update(24000, false); runtime.afterUpdate(24000);
  assert.equal(f.read().unregistered, 1); assert.equal(f.read().destroyed, 1);
});

check('partial creation releases its environment registration and malformed definitions fail before admission', () => {
  const failed = runtimeFixture(true); assert.throws(failed.create, /planned presentation failure/);
  assert.equal(failed.read().unregistered, 1);
  const targets: MeleeTarget[] = []; failed.world.tension.collectMeleeTargets(targets); assert.equal(targets.length, 0);
  const { tension } = fixture();
  for (const patch of [{ warningMs: 0 }, { dangerThreshold: 2 }, { releaseMs: 10 }, { outline: [] }, { position: { x: NaN, y: 0 } }]) {
    assert.throws(() => new LivingLandmassTensionSystem({ ...tension.definition, ...patch } as TensionDefinition, () => true));
  }
});

console.log(`${checks} living-landmass runtime checks passed. These are mechanism/contract checks, not human aesthetic or sustained-supply acceptance.`);
