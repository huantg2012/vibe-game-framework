/** Actual world, Combat and scene-gate methods; only engine I/O is replaced.
 * Run: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/suspended-sea/check-runtime.ts
 */
import assert from 'node:assert/strict';
import Phaser from 'phaser';
import { SuspendedSeaShellSystem } from '../../src/worlds/suspended-sea/shell-system';
import type { ShellDefinition } from '../../src/worlds/suspended-sea/types';
import { WaterFlowCycle } from '../../src/dev/spatial-study/water-flow';
import { LOCAL_SLICE_DATA, SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { SuspendedSeaRuntime } from '../../src/dev/suspended-sea/runtime';
import { CombatSystem } from '../../src/systems/combat-system';
import type { MeleeTarget } from '../../src/systems/weapon-swing';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';

// Scene imports initialize locale selection. This is an in-memory test seam,
// never access to the browser's real persistent inventory or settings.
Object.defineProperty(globalThis, 'localStorage', { configurable: true,
  value: { getItem: () => 'zh-CN', setItem() {}, removeItem() {} } });
const { RiftScene } = await import('../../src/scenes/rift-scene');
const { RunController } = await import('../../src/systems/run-controller');

let checks = 0;
function check(name: string, run: () => void): void { run(); checks++; console.log(`PASS ${name}`); }
const flow = new WaterFlowCycle(LOCAL_SLICE_DATA.water);
const timing = { periodMs: flow.period, warningStartMs: LOCAL_SLICE_DATA.water.quietMs,
  contactStartMs: flow.contactStart, contactEndMs: flow.contactEnd };
const definition: ShellDefinition = {
  id: 'test-shell', position: { x: 100, y: 68 },
  spillOutline: [{ x: 60, y: 60 }, { x: 105, y: 60 }, { x: 90, y: 100 }, { x: 60, y: 90 }],
  drainPath: [{ x: 100, y: 68 }, { x: 110, y: 70 }, { x: 120, y: 74 }],
  diversionDelayMs: 600, returnMs: 650, damage: LOCAL_SLICE_DATA.water.damage,
  hitIntervalMs: LOCAL_SLICE_DATA.water.hitIntervalMs,
};
function shellFixture() {
  const shell = new SuspendedSeaShellSystem(definition, timing, (x, y) => x >= 0 && y >= 0);
  const targets: MeleeTarget[] = []; shell.collectMeleeTargets(targets);
  return { shell, target: targets[0]! };
}

check('eligibility is half-open, one real contact per cycle, and the shell never becomes an enemy death', () => {
  const { shell, target } = shellFixture();
  for (const [time, eligible] of [[0, false], [timing.warningStartMs - 1, false],
    [timing.warningStartMs, true], [timing.contactEndMs - 1, true], [timing.contactEndMs, false],
    [timing.contactEndMs + 1, false]] as const) {
    shell.prepare(time, false); assert.equal(target.canHit!(), eligible);
  }
  shell.prepare(timing.periodMs + timing.warningStartMs, false); target.applyHit(22);
  assert.equal(shell.readView().hitSequence, 1); assert.equal(target.isAlive(), true);
  assert.equal(target.canHit!(), false); target.applyHit(28); assert.equal(shell.readView().hitSequence, 1);
  shell.prepare(timing.periodMs * 2 + timing.warningStartMs, false); assert.equal(target.canHit!(), true);
  target.applyHit(1); assert.equal(shell.readView().hitSequence, 2);
});

check('600ms spill remains dangerous, core remains active, and natural drainage wins over a late diversion', () => {
  const { shell, target } = shellFixture(), hitAt = timing.contactStartMs + 20;
  shell.prepare(hitAt, false); target.applyHit(22);
  shell.prepare(hitAt + 599, false); assert.equal(shell.readView().spillActive, true);
  shell.prepare(hitAt + 600, false); assert.equal(shell.readView().spillActive, false);
  assert.equal(shell.readView().coreActive, true); assert.equal(shell.readView().mode, 'diverted');
  shell.prepare(timing.contactEndMs, false); assert.equal(shell.readView().mode, 'returning');
  assert.equal(shell.readView().coreActive, false); assert.equal(shell.readView().returnProgress, 0);
  shell.prepare(timing.contactEndMs + 650, false); assert.equal(shell.readView().mode, 'closed');
  assert.equal(shell.readView().returnProgress, 1);
  const late = shellFixture(); late.shell.prepare(timing.contactEndMs - 100, false); late.target.applyHit(25);
  late.shell.prepare(timing.contactEndMs, false);
  assert.equal(late.shell.readView().spillActive, false); assert.equal(late.shell.readView().mode, 'returning');
  const early = shellFixture(); early.shell.prepare(timing.warningStartMs, false); early.target.applyHit(25);
  early.shell.prepare(timing.warningStartMs + 600, false);
  assert.equal(early.shell.readView().mode, 'diverted'); assert.equal(early.shell.readView().coreActive, false);
});

check('core/spill union has one interval including invulnerable attempts and region changes', () => {
  const { shell, target } = shellFixture(), player = { x: 80, y: 80 }, at = timing.contactStartMs + 1;
  const calls: string[] = [];
  shell.prepare(at, false);
  shell.resolveContact(player, true, id => { calls.push(id); return false; });
  shell.resolveContact(player, true, () => { throw new Error('Duplicate contact'); });
  assert.equal(shell.readView().lastContactRegion, 'both'); assert.equal(shell.readView().contactAttempts, 1);
  assert.equal(shell.readView().committedHits, 0);
  target.applyHit(25); shell.prepare(at + 600, false);
  shell.resolveContact(player, true, () => { throw new Error('Diversion reset shared interval'); });
  shell.prepare(at + definition.hitIntervalMs, false);
  shell.resolveContact(player, true, id => { calls.push(id); return true; });
  assert.equal(shell.readView().lastContactRegion, 'core'); assert.equal(calls.length, 2);
  assert.equal(shell.readView().contactAttempts, 2); assert.equal(shell.readView().committedHits, 1);
});

check('irregular spill uses its real polygon and floor, not its bounding box or a second body footprint', () => {
  const { shell } = shellFixture(); shell.prepare(timing.contactStartMs + 1, false);
  assert(shell.isInsideSpill({ x: 80, y: 80 })); assert(!shell.isInsideSpill({ x: 104, y: 99 }));
  const clipped = new SuspendedSeaShellSystem(definition, timing, () => false);
  clipped.prepare(timing.contactStartMs + 1, false);
  clipped.resolveContact({ x: 80, y: 80 }, true, () => { throw new Error('Void contact'); });
  assert.equal(clipped.readView().contactAttempts, 0);
});

check('borrowed views never advance, repeated same-frame calls do not bill twice, and stopped/destroyed sources stay stopped', () => {
  const { shell, target } = shellFixture(), at = timing.contactStartMs + 1;
  shell.prepare(at, false); target.applyHit(25); shell.resolveContact({ x: 80, y: 80 }, false, () => true);
  const borrowed = shell.readView(), frozen = JSON.stringify(borrowed);
  for (let i = 0; i < 100; i++) {
    assert.equal(shell.readView(), borrowed); shell.prepare(at, false);
    shell.resolveContact({ x: 80, y: 80 }, false, () => { throw new Error('Duplicate frame'); });
  }
  assert.equal(JSON.stringify(borrowed), frozen);
  shell.prepare(at, true); const ended = JSON.stringify(borrowed);
  shell.prepare(at + 5000, false); target.applyHit(25); shell.resolveContact({ x: 80, y: 80 }, true, () => true);
  assert.equal(JSON.stringify(borrowed), ended);
  shell.destroy(); shell.destroy(); assert.equal(target.canHit!(), false);
  const targets: MeleeTarget[] = []; shell.collectMeleeTargets(targets); assert.equal(targets.length, 0);
});

function combatFixture(bodies: { id: string; x: number; y: number }[] = [], consume: () => boolean = () => true) {
  const combat = new CombatSystem(), noise: number[] = [];
  const player = { getPosition: () => ({ x: 80, y: 80 }), getFacingAngle: () => 0,
    setSpeedModifier() {}, clearSpeedModifier() {}, setWeaponVisual() {}, setWeaponAttackPose() {} };
  const views = bodies.map(row => ({ getId: () => row.id, getPosition: () => row, getFacingAngle: () => 0, isEngaged: () => false }));
  Object.assign(combat, { player, occluders: { cols: 20, rows: 20, tileSize: 8, version: 0, isOpaque: () => false },
    hooks: { consumeWeaponUse: consume, onNoise: (_p: unknown, radius: number) => noise.push(radius) },
    ai: { getEnemies: () => views, getEnemyById: (id: string) => views.find(row => row.getId() === id) },
    spawnFx() {}, drawVisuals() {}, stepFx() {} });
  combat.noteRosterChanged(); combat.configureWeapon('crowbar_plain', 7);
  return { combat, noise };
}

check('real Combat shares two contacts and one durability between shell and bodies at 8/16/33/100ms', () => {
  for (const step of [8, 16, 33, 100]) {
    let uses = 0;
    const { combat, noise } = combatFixture([{ id: 'first-body', x: 109, y: 81 }, { id: 'third-body', x: 98, y: 101 }], () => { uses++; return true; });
    const { shell } = shellFixture(); combat.registerMeleeTargets(shell);
    const damageIds: string[] = [], deaths: string[] = [];
    const damaged = ({ enemyId }: { enemyId: string }) => damageIds.push(enemyId);
    const killed = ({ enemyId }: { enemyId: string }) => deaths.push(enemyId);
    eventBus.on(GameEvent.ENEMY_DAMAGED, damaged); eventBus.on(GameEvent.ENEMY_KILLED, killed);
    try {
      shell.prepare(timing.warningStartMs, false); combat.requestPlayerAttack();
      for (let time = 0; time < 450;) { const dt = Math.min(step, 450 - time); time += dt;
        shell.prepare(timing.warningStartMs + time, false); combat.update(dt); }
      assert.equal(uses, 1); assert.equal(shell.readView().hitSequence, 1);
      assert(combat.getEnemyHealth('first-body')! < 75); assert.equal(combat.getEnemyHealth('third-body'), 75);
      assert.deepEqual(damageIds, ['first-body']); assert.deepEqual(deaths, []);
      assert.equal(noise.filter(radius => radius === 160).length, 1);
    } finally {
      eventBus.off(GameEvent.ENEMY_DAMAGED, damaged); eventBus.off(GameEvent.ENEMY_KILLED, killed);
      combat.unregisterMeleeTargets(shell); shell.destroy();
    }
  }
});

check('inactive/blocked/failed-save contacts spend nothing or fail atomically; last durability completes the actual strike', () => {
  for (const mode of ['inactive', 'blocked', 'failed', 'last'] as const) {
    let attempts = 0, durability = 1;
    let combat: CombatSystem;
    ({ combat } = combatFixture([], () => {
      attempts++;
      if (mode === 'failed') return false;
      durability--; if (durability === 0) combat.configureWeapon(null); return true;
    }));
    const { shell } = shellFixture(); combat.registerMeleeTargets(shell);
    if (mode === 'blocked') Object.assign(combat, { occluders: { cols: 20, rows: 20, tileSize: 8, version: 0, isOpaque: (x: number) => x === 12 } });
    const start = mode === 'inactive' ? 0 : timing.warningStartMs;
    shell.prepare(start, false); combat.requestPlayerAttack();
    for (let time = 16; time <= 432; time += 16) { shell.prepare(start + time, false); combat.update(16); }
    assert.equal(shell.readView().hitSequence, mode === 'last' ? 1 : 0);
    assert.equal(attempts, mode === 'inactive' || mode === 'blocked' ? 0 : 1);
    assert.equal(durability, mode === 'last' ? 0 : 1);
    assert.equal(combat.getAttackState().phase, 'idle');
    combat.unregisterMeleeTargets(shell); shell.destroy();
  }
});

check('an environment contact after two earlier body contacts cannot become a free third target', () => {
  let uses = 0;
  const { combat } = combatFixture([{ id: 'early-a', x: 108, y: 56 }, { id: 'early-b', x: 105, y: 63 }], () => { uses++; return true; });
  const { shell } = shellFixture(); combat.registerMeleeTargets(shell);
  shell.prepare(timing.warningStartMs, false); combat.requestPlayerAttack();
  for (let time = 16; time <= 432; time += 16) { shell.prepare(timing.warningStartMs + time, false); combat.update(16); }
  assert(combat.getEnemyHealth('early-a')! < 75); assert(combat.getEnemyHealth('early-b')! < 75);
  assert.equal(shell.readView().hitSequence, 0); assert.equal(uses, 1);
  combat.unregisterMeleeTargets(shell); shell.destroy();
});

check('native wrapper registers once, suppresses only the exact material cue, snapshots by value and cleans failed insertion', () => {
  const world = new SpatialSliceWorld(7), position = { ...world.layout.spawnPoint }, providers = new Set<unknown>();
  let stopped = false, removed = 0, destroyed = 0, paints = 0;
  const records: { event: string; payload: unknown }[] = [];
  const nativeDefinition = { ...definition, position, spillOutline: [
    { x: position.x - 30, y: position.y - 30 }, { x: position.x + 30, y: position.y - 30 },
    { x: position.x + 30, y: position.y + 30 }, { x: position.x - 30, y: position.y + 30 }] };
  const context = {
    scene: {}, layout: world.layout, player: { id: 'player', objects: [], getPosition: () => position, getGroundY: () => position.y }, enemies: [],
    applyHazardHit: () => { stopped = true; return true; }, isRunEnded: () => stopped,
    registerMeleeTargets(provider: unknown) { providers.add(provider); return () => { if (providers.delete(provider)) removed++; }; },
    readEntryView: () => ({ active: false, elapsedMs: 1200, durationMs: 1200, progress: 1 }),
    getFootprint: () => ({ x: position.x - 10, y: position.y - 10, width: 20, height: 20 }), visibilityAt: () => 1,
  } as unknown as RiftDevRuntimeContext;
  const runtime = new SuspendedSeaRuntime(context, world, nativeDefinition, (event, payload) => records.push({ event, payload }),
    () => ({ update() { paints++; }, snapshot: () => ({}), destroy() { destroyed++; } }));
  assert.equal(providers.size, 1); runtime.beforeCombat(timing.warningStartMs, false);
  const targets: MeleeTarget[] = []; runtime.shell.collectMeleeTargets(targets); targets[0]!.applyHit(25);
  assert(!runtime.handleCombatCue('combat.cue.hit', { x: position.x + 1, y: position.y }));
  assert(!runtime.handleCombatCue('combat.cue.playerHurt', position));
  assert(runtime.handleCombatCue('combat.cue.hit', position)); assert(!runtime.handleCombatCue('combat.cue.hit', position));
  runtime.afterUpdate(world.elapsedMs);
  const recordBefore = JSON.stringify(records), snapshot = runtime.snapshot();
  runtime.beforeCombat(timing.periodMs + timing.contactStartMs + 1, false); runtime.update(world.elapsedMs, false); runtime.afterUpdate(world.elapsedMs);
  assert.equal(runtime.shell.readView().committedHits, 1); assert.equal(runtime.shell.readView().canHit, false);
  assert.equal(JSON.stringify(records.slice(0, 2)), recordBefore);
  assert.equal((snapshot.shell as { mode: string }).mode, 'diverting');
  const frozen = JSON.stringify(runtime.shell.readView()); runtime.beforeCombat(world.elapsedMs + 1000, true);
  runtime.update(world.elapsedMs, true); runtime.afterUpdate(world.elapsedMs);
  assert.equal(JSON.stringify(runtime.shell.readView()), frozen); assert(paints >= 3);
  runtime.destroy(); runtime.destroy(); assert.equal(removed, 1); assert.equal(destroyed, 1); assert.equal(providers.size, 0);
  assert.throws(() => new SuspendedSeaRuntime(context, world, nativeDefinition, () => {}, () => { throw new Error('insertion'); }));
  assert.equal(providers.size, 0); assert.equal(removed, 2);
});

check('old default advance and signature are unchanged by phase/contact separation', () => {
  const old = new SpatialSliceWorld(7), split = new SpatialSliceWorld(7);
  assert.equal(old.signature(), 'aa970f9f');
  for (let time = 0; time <= timing.periodMs * 2; time += 33) {
    const position = { x: old.waterDefinition.x, y: old.waterDefinition.y };
    old.advance(time, position, false, () => true); split.prepare(time); split.resolveContact(position, false, () => true);
    assert.deepEqual(split.water, old.water); assert.deepEqual(split.waterOutline, old.waterOutline);
    assert.equal(split.attempts, old.attempts); assert.equal(split.hits, old.hits);
  }
});

check('actual RiftScene entry gate freezes simulation/physics, clears held edges, supports Enter, and restores only its own pause', () => {
  const codes = { ESC: 27, TAB: 9, ENTER: 13, SPACE: 32, W: 87, Q: 81, E: 69 };
  Object.assign(Phaser, { Input: { Keyboard: { KeyCodes: codes } } });
  type TestKey = { keyCode: number; isDown: boolean; reset(): void };
  const keys: TestKey[] = [];
  for (const code of Object.values(codes)) keys[code] = { keyCode: code, isDown: false, reset() { this.isDown = false; } };
  let enabled = true, clears = 0, simulated = 0, paused = false;
  const listeners = new Set<unknown>();
  const scene = new RiftScene();
  const gate = scene as unknown as {
    entryView: { active: boolean; elapsedMs: number; durationMs: number; progress: number };
    entryHeldKeys: Set<number>; devElapsedMs: number;
    beginEntryGate(): void; endEntryGate(): void; resetEntryHeldKeys(): void;
    onEntryKeyDown(event: KeyboardEvent): void; onEntryKeyUp(event: KeyboardEvent): void;
  };
  Object.assign(scene, { input: { keyboard: { keys, on: (_event: string, handler: unknown) => listeners.add(handler),
    off: (_event: string, handler: unknown) => listeners.delete(handler), resetKeys: () => keys.forEach(key => key?.reset()) } },
  physics: { world: { get isPaused() { return paused; }, pause() { paused = true; }, resume() { paused = false; } } },
  player: { setInputEnabled(value: boolean) { enabled = value; }, update() { simulated++; } },
  combat: { clearAttackBuffer() { clears++; } }, runController: { isRunEnded: () => false },
  devFixture: {}, devRuntime: { beforeCombat() { simulated++; }, update() { simulated++; } } });
  Object.assign(gate.entryView, { active: true, elapsedMs: 0, durationMs: 1200, progress: 0 });
  gate.beginEntryGate(); assert(paused); assert(!enabled);
  for (const code of [codes.SPACE, codes.W, codes.Q, codes.E]) {
    keys[code]!.isDown = true; gate.onEntryKeyDown({ keyCode: code } as KeyboardEvent);
  }
  scene.update(0, 600); assert.equal(gate.devElapsedMs, 0); assert.equal(simulated, 0);
  assert.equal(gate.entryView.elapsedMs, 600);
  // No Scene update while paused: reading does not advance preparation.
  const pausedView = JSON.stringify(gate.entryView); for (let i = 0; i < 10; i++) JSON.stringify(gate.entryView);
  assert.equal(JSON.stringify(gate.entryView), pausedView);
  scene.update(0, 600); assert(!paused); assert(enabled); assert.equal(simulated, 0); assert.equal(gate.devElapsedMs, 0);
  for (const code of [codes.SPACE, codes.W, codes.Q, codes.E]) {
    keys[code]!.isDown = true; gate.onEntryKeyDown({ keyCode: code } as KeyboardEvent);
    gate.resetEntryHeldKeys(); assert.equal(keys[code]!.isDown, false);
    gate.onEntryKeyUp({ keyCode: code } as KeyboardEvent); keys[code]!.isDown = true;
    gate.resetEntryHeldKeys(); assert.equal(keys[code]!.isDown, true); keys[code]!.reset();
  }
  assert(clears >= 2); gate.endEntryGate(); assert.equal(listeners.size, 0);
  Object.assign(gate.entryView, { active: true, elapsedMs: 0, durationMs: 1200, progress: 0 });
  paused = true; gate.beginEntryGate(); gate.onEntryKeyDown({ keyCode: codes.ENTER } as KeyboardEvent);
  assert.equal(gate.entryView.active, false); assert.equal(gate.entryView.progress, 1); assert(paused, 'Do not resume a pause owned by somebody else');
  gate.endEntryGate();
});

check('RunController opt-in uses play time while legacy scene clocks retain their original semantics', () => {
  const scene = { time: { now: 1000 } }, deps = { pauseChaos() {}, setPlayerInput() {}, getCarriedKindling: () => 0 };
  const legacy = new RunController(), native = new RunController(); let playTime = 0;
  legacy.create(scene as never, deps); native.create(scene as never, { ...deps, getElapsedMs: () => playTime });
  scene.time.now = 2200; assert.equal(legacy.getElapsedMs(), 1200); assert.equal(native.getElapsedMs(), 0);
  playTime = 600; assert.equal(native.getElapsedMs(), 600); legacy.destroy(); native.destroy();
});

console.log(`${checks} suspended-sea runtime checks passed.`);
