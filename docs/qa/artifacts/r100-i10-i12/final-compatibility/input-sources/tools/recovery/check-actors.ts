/** DEC-158: real Player / Enemy / AI / Combat, with only the engine and visual effects stubbed. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type Phaser from 'phaser';
import { Player, validatePlayerRuntimeState } from '../../src/entities/player';
import { Enemy } from '../../src/entities/enemy-factory';
import { AISystem, validateAIRuntimeState } from '../../src/systems/ai/ai-system';
import { CombatSystem, validateCombatRuntimeState } from '../../src/systems/combat-system';
import { buildSearchPoints } from '../../src/systems/ai/state-machine';
import type { AIContext } from '../../src/systems/ai/context';
import { assignDynamicPath } from '../../src/systems/ai/behaviors';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { AIState, type Vector2 } from '../../src/types/game-types';
import { TileGrid } from '../../src/systems/tile-grid';
import { createSuspendedSeaWorld, type SuspendedSeaSceneId } from '../../src/dev/suspended-sea/world';
import { GAME_CONSTANTS } from '../../src/config/constants';
import type { MeleeTarget } from '../../src/systems/weapon-swing';

const require = createRequire(import.meta.url);
const Emitter = require('eventemitter3');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
class Point {
  constructor(public x = 0, public y = 0) {}
  set(x: number, y: number) { this.x = x; this.y = y; return this; }
  copy(value: Vector2) { return this.set(value.x, value.y); }
}
class Image {
  texture: { key: string };
  depth = 0; name = ''; active = true;
  body: Body;
  constructor(public x: number, public y: number, key: string) { this.texture = { key }; this.body = new Body(this); }
  setDepth(value: number) { this.depth = value; return this; }
  setName(value: string) { this.name = value; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; }
  setTexture(key: string) { this.texture.key = key; return this; }
  setVisible() { return this; } setOrigin() { return this; } setRotation() { return this; }
  setAlpha() { return this; } setScale() { return this; } setTintFill() { return this; }
  destroy() { this.active = false; }
}
class Body {
  position = new Point(); prev = new Point(); prevFrame = new Point(); velocity = new Point(); center = new Point();
  halfWidth = 10; halfHeight = 10;
  constructor(readonly image: Image) { this.reset(image.x, image.y); }
  reset(x: number, y: number) {
    this.image.setPosition(x, y); this.position.set(x - this.halfWidth, y - this.halfHeight);
    this.prev.copy(this.position); this.prevFrame.copy(this.position); this.velocity.set(0, 0); this.updateCenter(); return this;
  }
  updateCenter() { this.center.set(this.position.x + this.halfWidth, this.position.y + this.halfHeight); }
  setSize(w: number, h: number) { this.halfWidth = w / 2; this.halfHeight = h / 2; return this.reset(this.image.x, this.image.y); }
  setOffset() { return this; } setCollideWorldBounds() { return this; } setImmovable() { return this; }
  step(dt: number) {
    this.image.x += this.velocity.x * dt / 1000; this.image.y += this.velocity.y * dt / 1000;
    this.position.set(this.image.x - this.halfWidth, this.image.y - this.halfHeight); this.updateCenter();
  }
}
function sceneFixture() {
  const world = new Emitter();
  const images: Image[] = [];
  const image = (x: number, y: number, key: string) => { const value = new Image(x, y, key); images.push(value); return value; };
  const scene = { physics: { world, add: { image } }, add: { image }, input: { keyboard: null } };
  return { scene: scene as unknown as Phaser.Scene, world, images };
}
function playerFixture(x: number, y: number) {
  const player = new Player(), image = new Image(x, y, 'player');
  const right = { isDown: false }, up = { isDown: false };
  Object.assign(player, { image, keyRight: [right], keyUp: [up],
    lag: { isTurning: false, trigger() {}, sync() {} }, aura: { sync() {} },
    weaponRig: { equip() {}, sync() {}, getTorsoOffset: () => ({ x: 0, y: 0, rotation: 0 }) } });
  player.postUpdate();
  return { player, image, right, up };
}

function fixture(sceneId: SuspendedSeaSceneId = 'sea-open-channel') {
  const native = createSuspendedSeaWorld(19, sceneId), engine = sceneFixture();
  const grid = new TileGrid(native.base.layout.tileMap), ai = new AISystem();
  ai.create(engine.scene, native.base.layout.enemySpawns, grid, grid,
    { recovery: { runSeed: 19, signature: native.metadata.signature } });
  for (const enemy of ai.getEnemies()) Object.assign(enemy, { syncVisuals() {} });
  const pawn = playerFixture(native.base.layout.spawnPoint.x, native.base.layout.spawnPoint.y);
  const combat = new CombatSystem();
  const noise: unknown[] = [], cues: unknown[] = [];
  const shellPosition = { ...native.shellDefinition.position };
  let shellHits = 0, uses = 20, consumeCalls = 0;
  const shell: MeleeTarget = { id: native.shellDefinition.id, getPosition: () => shellPosition, isAlive: () => true,
    applyHit: () => { shellHits++; } };
  Object.assign(combat, { scene: engine.scene, player: pawn.player, ai, occluders: grid,
    hooks: { onNoise: (position: Vector2, radius: number, level: string) => noise.push({ position: { ...position }, radius, level }),
      onCue: (cue: string) => cues.push(cue), consumeWeaponUse: () => {
        consumeCalls++; if (uses <= 0) return false;
        if (--uses === 0) combat.configureWeapon(null); return true;
      } }, spawnFx() {}, drawVisuals() {}, stepFx() {} });
  combat.noteRosterChanged(); combat.configureWeapon('crowbar_plain', 19);
  combat.registerMeleeTargets({ collectMeleeTargets: out => out.push(shell) });
  combat.enableRuntimeRecovery({ signature: native.metadata.signature, runSeed: 19, externalTargetIds: [shell.id] });
  return { ...engine, ...pawn, native, grid, ai, combat, noise, cues, shellPosition,
    get uses() { return uses; }, set uses(value: number) { uses = value; },
    get consumeCalls() { return consumeCalls; }, get shellHits() { return shellHits; } };
}
type Fixture = ReturnType<typeof fixture>;
function capture(f: Fixture) { return json({ player: f.player.exportRuntimeState(), ai: f.ai.exportRuntimeState(), combat: f.combat.exportRuntimeState(), uses: f.uses }); }
function restore(f: Fixture, value: ReturnType<typeof capture>, controls?: () => void) {
  assert(f.ai.validateRuntimeState(value.ai)); assert(f.combat.validateRuntimeState(value.combat));
  f.player.restoreRuntimeState(value.player); f.ai.restoreRuntimeState(value.ai);
  assert.throws(() => f.ai.update(16, f.player.getPosition(), false), /finishRuntimeRestore/);
  controls?.(); f.ai.finishRuntimeRestore(); f.combat.restoreRuntimeState(value.combat); f.uses = value.uses;
}
function combatAdvance(f: Fixture, milliseconds: number, step = 8) {
  while (milliseconds > 0) { const dt = Math.min(milliseconds, step); f.combat.update(dt); milliseconds -= dt; }
}
function worldStep(f: Fixture, dt: number) {
  f.player.update(dt); f.ai.update(dt, f.player.getPosition(), f.player.isMoving()); f.combat.update(dt);
  f.image.body.step(dt);
  for (const view of f.ai.getEnemies()) ((view as Enemy).getSprite().body as unknown as Body).step(dt);
  f.world.emit('worldstep', dt / 1000); f.player.postUpdate(); f.ai.postUpdate(dt);
}
function enemy(f: Fixture, role: 'infiltrator' | 'rewriter'): Enemy {
  return f.ai.getEnemies().find(view => view.getRole() === role) as Enemy;
}
function observe<T>(f: Fixture, run: () => T): { result: T; events: unknown[] } {
  const events: unknown[] = [];
  const damaged = (e: { enemyId: string; amount: number }) => { events.push(['enemyHit', { ...e }]); f.ai.reportDamage(e.enemyId, f.player.getPosition()); };
  const killed = (e: { enemyId: string }) => { events.push(['enemyKilled', { ...e }]); f.ai.despawn(e.enemyId); };
  const hurt = (e: unknown) => events.push(['playerHit', e]);
  const alert = (e: unknown) => events.push(['alert', e]);
  const lost = (e: unknown) => events.push(['lost', e]);
  const health = (e: unknown) => events.push(['health', e]);
  eventBus.on(GameEvent.ENEMY_DAMAGED, damaged); eventBus.on(GameEvent.ENEMY_KILLED, killed);
  eventBus.on(GameEvent.PLAYER_DAMAGED, hurt); eventBus.on(GameEvent.ENEMY_ALERT, alert);
  eventBus.on(GameEvent.ENEMY_LOST_PLAYER, lost); eventBus.on(GameEvent.PLAYER_HEALTH_CHANGED, health);
  try { return { result: run(), events: json(events) }; }
  finally {
    eventBus.off(GameEvent.ENEMY_DAMAGED, damaged); eventBus.off(GameEvent.ENEMY_KILLED, killed);
    eventBus.off(GameEvent.PLAYER_DAMAGED, hurt); eventBus.off(GameEvent.ENEMY_ALERT, alert);
    eventBus.off(GameEvent.ENEMY_LOST_PLAYER, lost); eventBus.off(GameEvent.PLAYER_HEALTH_CHANGED, health);
  }
}
function arrangeCombat(f: Fixture) {
  f.image.body.reset(1500, 870); f.player.postUpdate();
  const watcher = enemy(f, 'infiltrator'), listener = enemy(f, 'rewriter');
  (watcher.getSprite().body as unknown as Body).reset(1529, 871); watcher.syncPositionFromBody();
  (listener.getSprite().body as unknown as Body).reset(1518, 891); listener.syncPositionFromBody();
  f.shellPosition.x = 1520; f.shellPosition.y = 855;
  return { watcher, listener };
}

// Player captures the actual physics/image facts, retains momentum, speed sources, and facing hysteresis.
{
  const a = playerFixture(140, 100), b = playerFixture(0, 0);
  a.player.setSpeedModifier('chaos', .8); a.player.setSpeedModifier('attack', .35); a.player.setBurdenSpeedFactor(.9);
  a.right.isDown = true; a.up.isDown = true; a.player.update(16); a.image.body.step(16); a.player.postUpdate();
  const saved = json(a.player.exportRuntimeState());
  b.player.restoreRuntimeState(saved); assert.deepEqual(b.player.exportRuntimeState(), saved);
  b.right.isDown = true; b.up.isDown = true;
  for (let index = 0; index < 10; index++) {
    a.player.update(16); b.player.update(16); a.image.body.step(16); b.image.body.step(16);
    a.player.postUpdate(); b.player.postUpdate();
  }
  assert.deepEqual(a.player.exportRuntimeState(), b.player.exportRuntimeState());
  a.image.body.reset(211, 233); // Cached read view still has the preceding frame's point.
  assert.deepEqual(a.player.exportRuntimeState().position, { x: 211, y: 233 });
  const bad = { ...saved, velocity: { x: null, y: 0 } };
  assert(!validatePlayerRuntimeState(bad)); const before = b.player.exportRuntimeState();
  assert.throws(() => b.player.restoreRuntimeState(bad)); assert.deepEqual(b.player.exportRuntimeState(), before);
}

// Both real layouts: JSON round trips continue through input and clock changes identically.
for (const sceneId of ['sea-open-channel', 'sea-folded-ridge'] as const) {
  const a = fixture(sceneId); a.right.isDown = true;
  for (let index = 0; index < 35; index++) worldStep(a, 16);
  const watcher = enemy(a, 'infiltrator');
  watcher.ai.dynamicPath[0]!.x = watcher.ai.position.x + 20; watcher.ai.dynamicPath[0]!.y = watcher.ai.position.y;
  watcher.ai.dynamicPath[1]!.x = watcher.ai.position.x + 30; watcher.ai.dynamicPath[1]!.y = watcher.ai.position.y;
  assignDynamicPath(watcher, 2); watcher.ai.pathCursor = 1;
  a.ai.reportSoundLure(enemy(a, 'rewriter').getPosition(), 120);
  const saved = capture(a), b = fixture(sceneId);
  const hydration = observe(b, () => restore(b, saved)); assert.deepEqual(hydration.events, []);
  assert.equal(b.noise.length, 0); assert.equal(b.cues.length, 0); assert.deepEqual(capture(b), saved);
  const restoredWatcher = enemy(b, 'infiltrator'); assert.equal(restoredWatcher.ai.pathPoints, restoredWatcher.ai.dynamicPath);
  if (saved.ai.enemies[0]!.state.currentPatrolLegIndex !== null) {
    const e = b.ai.getEnemies()[0] as Enemy;
    assert.equal(e.ai.currentPatrolLeg, e.ai.patrolPaths[saved.ai.enemies[0]!.state.currentPatrolLegIndex!]);
  }
  function continueRun(f: Fixture) {
    f.right.isDown = true;
    for (let index = 0; index < 160; index++) { if (index === 50) f.right.isDown = false; worldStep(f, index % 2 ? 16 : 32); }
    return capture(f);
  }
  const resultA = observe(a, () => continueRun(a)), resultB = observe(b, () => continueRun(b));
  assert.deepEqual(resultA, resultB, `${sceneId}: continuation must preserve AI, controls, attacks, and motion`);
  a.ai.destroy(); b.ai.destroy();
}

// RNG state survives after generated search points and before the next investigation/search draw.
{
  const a = fixture(), watcher = enemy(a, 'infiltrator');
  const context = (a.ai as unknown as { context: AIContext }).context;
  watcher.ai.lastSeenPlayerVel = { x: 45, y: 4 };
  buildSearchPoints(watcher, context, watcher.ai.position.x, watcher.ai.position.y);
  const saved = capture(a), b = fixture(); restore(b, saved);
  const next = (f: Fixture) => {
    const e = enemy(f, 'infiltrator'), ctx = (f.ai as unknown as { context: AIContext }).context;
    buildSearchPoints(e, ctx, e.ai.position.x, e.ai.position.y);
    f.ai.reportNoise(e.ai.position, 90, 'suspicious');
    f.ai.update(100, f.player.getPosition(), false);
    return f.ai.exportRuntimeState();
  };
  const resultA = observe(a, () => next(a)), resultB = observe(b, () => next(b));
  assert.deepEqual(resultA, resultB); assert.notEqual(resultA.result.randomState, saved.ai.randomState);
}

// Interrupt after first shell contact: the last durability unit cleared equipment, but the swing continues.
{
  const a = fixture(); arrangeCombat(a); a.uses = 1;
  a.combat.requestPlayerAttack(); combatAdvance(a, 138, 2);
  assert.equal(a.shellHits, 1); assert.equal(a.uses, 0);
  assert.equal(a.combat.exportRuntimeState().weaponId, null);
  assert(a.combat.exportRuntimeState().contactRemainingMs > 0);
  const saved = capture(a), b = fixture(); arrangeCombat(b); restore(b, saved);
  assert.equal(b.combat.getWeaponVisualDefinitionId(), 'crowbar_plain');
  const beforeCalls = a.consumeCalls, beforeShell = a.shellHits;
  a.noise.length = 0; a.cues.length = 0;
  const resultA = observe(a, () => { combatAdvance(a, 370, 2); return capture(a); });
  const resultB = observe(b, () => { combatAdvance(b, 370, 2); return capture(b); });
  assert.deepEqual(resultA, resultB); assert.deepEqual(a.noise, b.noise); assert.deepEqual(a.cues, b.cues);
  assert.equal(a.consumeCalls - beforeCalls, 0); assert.equal(b.consumeCalls, 0);
  assert.equal(a.shellHits - beforeShell, 0); assert.equal(b.shellHits, 0);
  assert.equal(b.combat.getEnemyHealth(enemy(b, 'rewriter').id), GAME_CONSTANTS.COMBAT.ENEMY_MAX_HEALTH, 'shared two-target budget excludes late third target');
  assert.equal(b.combat.getWeaponVisualDefinitionId(), null);
}

// Pending attack buffer and future random damage sample must continue at the same legal instant.
{
  const a = fixture(); a.combat.requestPlayerAttack(); combatAdvance(a, 450); a.combat.requestPlayerAttack();
  const saved = capture(a), b = fixture(); restore(b, saved);
  const continued = (f: Fixture) => { f.combat.update(100); return capture(f); };
  assert.deepEqual(observe(a, () => continued(a)), observe(b, () => continued(b)));
  assert.equal(b.combat.getSwingSnapshot().sequence, 2);
  assert.equal(b.combat.exportRuntimeState().swingElapsedMs, 50);
}

// Enemy windup, control interruption latch, invulnerability and later cooldown retain their exact timing.
{
  const a = fixture(), { watcher } = arrangeCombat(a);
  (watcher.getSprite().body as unknown as Body).reset(1520, 870); watcher.syncPositionFromBody();
  watcher.ai.facingAngle = Math.PI; watcher.ai.state = AIState.CHASE; watcher.ai.engaged = true;
  combatAdvance(a, GAME_CONSTANTS.COMBAT.ENEMY_FIRST_ATTACK_DELAY_MS + 100);
  assert.equal(a.combat.getEnemyAttackVisualState(watcher.id).phase, 'windup');
  a.ai.setEnemyControl(watcher.id, 'tool:5', { movementMultiplier: 0, suppressAttack: true, breakOnDamage: true });
  a.ai.breakEnemyControlsOnDamage(watcher.id); // Already gone source, historical revision still owes one interruption.
  const saved = capture(a), b = fixture(); restore(b, saved);
  assert.deepEqual(observe(a, () => { combatAdvance(a, 1800); return capture(a); }),
    observe(b, () => { combatAdvance(b, 1800); return capture(b); }));
  assert(a.combat.getHealth() < GAME_CONSTANTS.PLAYER.MAX_HEALTH, 'real enemy attack damages the player');
  const cool = capture(a), c = fixture(); restore(c, cool);
  assert.deepEqual(observe(a, () => { combatAdvance(a, 800); return capture(a); }),
    observe(c, () => { combatAdvance(c, 800); return capture(c); }));
}

// Restore active sources after the raw state; source hydration must not manufacture another interruption.
{
  const a = fixture(), e = enemy(a, 'rewriter');
  a.ai.setEnemyControl(e.id, 'tool:9', { movementMultiplier: 0, suppressAttack: true });
  a.combat.update(16);
  const saved = capture(a), b = fixture(); restore(b, saved,
    () => b.ai.setEnemyControl(e.id, 'tool:9', { movementMultiplier: 0, suppressAttack: true }));
  assert.equal(b.ai.getEnemyControlState(e.id)!.attackInterruptRevision, a.ai.getEnemyControlState(e.id)!.attackInterruptRevision);
  assert.equal(enemy(b, 'rewriter').ai.externalSpeedMult, 0);
  assert.deepEqual(capture(a), capture(b));
}

// A committed death removes the roster silently, and later AI/Combat sync cannot resurrect it.
{
  const a = fixture(), e = enemy(a, 'infiltrator');
  observe(a, () => a.combat.applyToolDamage(e.id, GAME_CONSTANTS.COMBAT.ENEMY_MAX_HEALTH));
  const saved = capture(a), b = fixture();
  assert.equal(saved.ai.enemies.length, 1);
  assert.deepEqual(observe(b, () => restore(b, saved)).events, []);
  assert.equal(b.ai.getEnemyById(e.id), undefined); b.combat.noteRosterChanged(); b.combat.update(16);
  assert.equal(b.combat.isEnemyAlive(e.id), false); assert.equal(b.combat.getEnemyHealth(e.id), undefined);
  const invalid = json(saved); invalid.ai.enemies.push({ ...invalid.ai.enemies[0]!, id: 'unknown' });
  assert(!validateAIRuntimeState(invalid.ai));
}

// Corrupt snapshots and mismatched content fail before mutating live actors or accepting unknown targets.
{
  const a = fixture();
  observe(a, () => a.combat.applyHazardHit('native-water', GAME_CONSTANTS.PLAYER.MAX_HEALTH));
  const saved = capture(a), b = fixture();
  assert(saved.combat.dead); assert.equal(saved.combat.enabled, false);
  assert.deepEqual(observe(b, () => restore(b, saved)).events, []);
  assert.equal(b.combat.getHealth(), 0); assert(b.combat.isDead());
  b.combat.requestPlayerAttack();
  assert.equal(b.combat.getSwingSnapshot().sequence, saved.combat.attackSequence);
  assert.equal(b.combat.applyHazardHit('native-water', 10), false);
  assert.deepEqual(observe(a, () => { combatAdvance(a, 120); return capture(a); }),
    observe(b, () => { combatAdvance(b, 120); return capture(b); }));
}

// Corrupt snapshots and mismatched content fail before mutating live actors or accepting unknown targets.
{
  const a = fixture(), saved = capture(a);
  const invalidAI = { ...saved.ai, randomState: null };
  assert(!validateAIRuntimeState(invalidAI)); assert.throws(() => a.ai.restoreRuntimeState(invalidAI));
  const badBinding = json(saved.ai); badBinding.enemies[0]!.state.pathBinding = { kind: 'patrol', index: 999 };
  assert(!a.ai.validateRuntimeState(badBinding)); assert.throws(() => a.ai.restoreRuntimeState(badBinding));
  const badToken = { ...saved.combat, attackTokensInUse: 1 };
  assert(!validateCombatRuntimeState(badToken)); assert.throws(() => a.combat.restoreRuntimeState(badToken));
  assert(!a.ai.validateRuntimeState({ ...saved.ai, signature: 'different' }));
  const badTarget = { ...saved.combat, hitSet: ['unknown'], weaponUseAttempted: true, weaponUseCommitted: true };
  assert(!validateCombatRuntimeState(badTarget)); assert.deepEqual(capture(a), saved);
  const unsupported = json(a.native.base.layout.enemySpawns); unsupported[0]!.form!.portfolio = 'bing';
  const engine = sceneFixture(), ai = new AISystem();
  assert.throws(() => ai.create(engine.scene, unsupported, a.grid, a.grid, { recovery: { runSeed: 19, signature: 'unknown' } }), /Unsupported/);
  assert.equal(engine.world.listenerCount('worldstep'), 0, 'reject content before engine mutation');
  assert.equal(engine.images.length, 0);
}

console.log('check:recovery-actors PASS: both layouts; JSON continuation; momentum/facing; stable RNG/search/path aliases; final-use/contact/shared budget/noise; buffer; enemy windup/latch/cooldown; control rebind; dead roster; reject-before-mutation. APIs are actor components, not complete run recovery.');
