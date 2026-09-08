import { colonyNucleusSeatsInFloors, chebyshevTiles } from '../../src/systems/contamination-host-live';
/** I18: run production locomotion, contact solver and hazard clocks against world fixtures. */
import assert from 'node:assert/strict';
import { Enemy, createEnemyTypeConfig } from '../../src/entities/enemy-factory.ts';
import { AISystem } from '../../src/systems/ai/ai-system.ts';
import { AIState } from '../../src/types/game-types.ts';
import type { WalkGrid } from '../../src/types/map-types.ts';
import { separateContacts, type ContactBody } from '../../src/systems/ai/contact-separation.ts';
import { ContaminationHostSystem } from '../../src/systems/contamination-host-system.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { updateBehavior } from '../../src/systems/ai/behaviors.ts';
import { stepFsm } from '../../src/systems/ai/state-machine.ts';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw.ts';
import type { AIContext } from '../../src/systems/ai/context.ts';
import type { Perception } from '../../src/types/ai-types.ts';
import { ActivityClock, ReverseActivityClock } from '../../src/systems/ai/activity-state.ts';
import { CombatSystem } from '../../src/systems/combat-system.ts';
import { BEHAVIOR_PROFILE_DATA } from '../../src/generated/contamination-capability-data.ts';

function body(id: string, x: number, y: number, immovable = false): ContactBody {
  const position = { x, y };
  return { id, position, size: 20, immovable, remaining: 0,
    moveTo(nx, ny) { position.x = nx; position.y = ny; } };
}
function grid(rows: readonly string[]): WalkGrid {
  return { cols: rows[0]!.length, rows: rows.length, tileSize: 32, version: 0,
    isWalkable(col, row) { return rows[row]?.[col] === '.'; } };
}
function clearFootprint(a: ContactBody, map: WalkGrid): void {
  // Independently check all square-body corners, including off-map bounds.
  for (const dx of [-9.999, 9.999]) for (const dy of [-9.999, 9.999]) {
    assert(map.isWalkable(Math.floor((a.position.x + dx) / 32), Math.floor((a.position.y + dy) / 32)),
      `${a.id} left legal floor at ${a.position.x},${a.position.y}`);
  }
}
function simulate(actors: ContactBody[], map: WalkGrid, frames = 120): void {
  for (let i = 0; i < frames; i++) {
    const before = actors.map(a => ({ ...a.position }));
    separateContacts(actors, map, 1000 / 60);
    actors.forEach((a, index) => {
      clearFootprint(a, map);
      assert(Math.hypot(a.position.x - before[index]!.x, a.position.y - before[index]!.y) <= 1.00001,
        'correction obeys per-body speed budget across every neighbour/pass');
      if (a.immovable) assert.deepEqual(a.position, before[index]);
    });
  }
}
const arena = grid(['#####', '#...#', '#...#', '#...#', '#####']);
const stopped = [body('a', 80, 80), body('b', 80, 80)];
simulate(stopped, arena);
assert(Math.hypot(stopped[0]!.position.x - stopped[1]!.position.x, stopped[0]!.position.y - stopped[1]!.position.y) >= 19.99,
  'coincident stationary chasers separate without movement intent');
const crowd = [body('anchor', 80, 80, true), body('human', 80, 80), body('insect', 80, 80)];
simulate(crowd, arena, 240);
for (let i = 0; i < crowd.length; i++) for (let j = i + 1; j < crowd.length; j++) {
  assert(Math.hypot(crowd[i]!.position.x - crowd[j]!.position.x, crowd[i]!.position.y - crowd[j]!.position.y) >= 19.9);
}
assert.deepEqual(crowd[0]!.position, { x: 80, y: 80 });
// A one-tile corridor forces the pair to escape longitudinally instead of into walls.
const corridor = grid(['###', '#.#', '#.#', '#.#', '###']);
const narrow = [body('fixed', 48, 80, true), body('mobile', 48, 80)];
simulate(narrow, corridor, 180);
assert(Math.hypot(narrow[0]!.position.x - narrow[1]!.position.x, narrow[0]!.position.y - narrow[1]!.position.y) >= 19.9);
// No legal escape: remain overlapping rather than teleport through a corner or void.
const pocket = grid(['###', '#.#', '###']);
const trapped = [body('fixed', 48, 48, true), body('mobile', 48, 48)];
simulate(trapped, pocket);
const snapshot = trapped.map(a => ({ ...a.position }));
separateContacts(trapped, pocket, 0);
assert.deepEqual(trapped.map(a => a.position), snapshot, 'pause has no separation drift');

// Use the actual Enemy methods with a physics adapter: both new and legacy carriers.
const velocity = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
const carrier = Object.create(Enemy.prototype) as Enemy;
Object.assign(carrier, {
  ai: { state: AIState.PATROL, position: { x: 80, y: 80 }, velocity: { x: 0, y: 0 } },
  body: { x: 80, y: 80, body: { velocity } }, config: { role: 'infiltrator' },
  actualVelocity: { x: 0, y: 0 }, hitchMs: 0, hitchDeltaMs: 16, hitchWasLunge: false,
});
carrier.setLocomotionMode('continuous');
for (let frame = 0; frame < 120; frame++) {
  carrier.tickGait(16);
  carrier.setVelocity(30, 0);
  assert.equal(velocity.x, 30, 'continuous model cannot inherit a hidden 0.2/1.8 multiplier');
}
carrier.measureActualVelocity(16);
assert.deepEqual(carrier.getActualVelocity(), { x: 0, y: 0 }, 'blocked physics is not walking');
carrier.getSprite().x += .48;
carrier.measureActualVelocity(16);
assert(Math.abs(carrier.getActualVelocity().x - 30) < .0001);
carrier.setLocomotionMode('legacy-hitch');
carrier.setVelocity(30, 0);
assert.equal(velocity.x, 6, 'old renderers retain their coupled hitch carrier');

const ai = { state: AIState.CHASE, position: { x: 80, y: 80 }, velocity: { x: 0, y: 0 },
  detection: 1, facingAngle: 0, facing4: 'right', losGraceMs: 0, targetingDecoy: true,
  lastSeenPlayerPos: { x: 100, y: 80 }, lastSeenPlayerVel: { x: 0, y: 0 },
  preferPathMs: 0, externalSpeedMult: 1, movementDirLocked: false, engaged: true,
  pathTargetAtRequest: { x: 0, y: 0 }, pathRequestTarget: { x: 0, y: 0 }, pathPoints: null,
};
const seeker = { id: 'seeker', ai, config: createEnemyTypeConfig('infiltrator'), getForm: () => INFILTRATOR_FORM,
  setVelocity(x: number, y: number) { ai.velocity.x = x; ai.velocity.y = y; } } as unknown as Enemy;
const context = { dtMs: 16, enemies: [seeker], playerPos: { x: 60, y: 80 }, playerVel: { x: 0, y: 0 },
  decoyPos: { x: 112, y: 80 }, occluders: { ...arena, isOpaque: (col: number, row: number) => !arena.isWalkable(col, row) },
} as unknown as AIContext;
updateBehavior(seeker, context);
assert(ai.velocity.x > 0, 'pursuer heads toward selected mirror, not nearby player behind it');
assert.equal(ai.engaged, false, 'mirror chase cannot grant an attack against real player');
context.decoyPos = { x: 100, y: 80 };
updateBehavior(seeker, context);
assert.deepEqual(ai.velocity, { x: 0, y: 0 }, 'pursuer stops at mirror instead of backing away from real player');
const perceived = { visible: true, hearingRate: 0, hearingHit: false, zone: 'core', distance: 20 } as Perception;
context.decoyPos = { x: 60, y: 80 };
stepFsm(seeker, perceived, 100, context);
assert.equal(ai.targetingDecoy, false, 'a mirror behind the actual sight cone is not visible');
context.decoyPos = { x: 140, y: 80 };
const blocked = grid(['######', '#..#.#', '#..#.#', '#..#.#', '######']);
(context as { occluders: unknown }).occluders = { ...blocked, isOpaque: (col: number, row: number) => !blocked.isWalkable(col, row) };
stepFsm(seeker, perceived, 100, context);
assert.equal(ai.targetingDecoy, false, 'mirror across an opaque wall is not a sensed target');

// Engine-free host fixture only replaces drawing and damage sinks; update is production.
let hits = 0;
let chaos = 0;
const graphics = { clear() {}, setVisible() {}, fillStyle() {}, fillRect() {} };
const host = {
  id: 'wall', kind: 'yi', alive: true, hp: 75, core: { x: 64, y: 48 },
  activity: new ActivityClock('rhythm_open', 'wall'), noiseRemainingMs: 0, hearingAccumMs: 0,
  tile: { col: 1, row: 1 }, strikeFloors: [{ col: 2, row: 1 }, { col: 2, row: 2 }],
  windupMs: -1, windupCol: -1, windupRow: -1, strikeThisFrame: false,
  walk: null, floorUniverse: [], moving: false, gfx: graphics, telegraph: graphics, marks: null,
  form: { substrate: 'wall_rust', coverage: 'infiltrate', continuity: 'monolith', occupancy: 'wall', portfolio: 'yi',
    lexemes: { motion: 'motion_anchor', sense: 'sense_touch', rhythm: 'rhythm_open', contact: 'contact_adjacent_strike' } },
};
const system = new ContaminationHostSystem();
Object.assign(system, { hosts: [host], liveMotion: true, skipPaint: true,
  combat: { getAttackState: () => ({ phase: 'idle' }), applyHazardHit() { hits++; } },
  chaos: { addChaos(_source: string, amount: number) { chaos += amount; } },
});
const player = { x: 80, y: 48 };
system.update(10000, player);
assert.equal(hits, 0, 'first visible warning survives a background-sized delta');
assert.deepEqual(system.getAttackVisualState('wall'), { phase: 'windup', progress: 0 });
for (let frame = 0; frame < 3; frame++) system.update(10000, player);
assert.equal(hits, 0, 'large deltas cannot consume a whole 350ms warning in one frame');
assert.equal(system.getAttackVisualState('wall')?.phase, 'windup');
system.update(50, player);
assert.equal(hits, 1);
assert.equal(system.getAttackVisualState('wall')?.phase, 'strike', 'visual strike matches damage frame');
system.update(100, player);
system.update(100, player);
system.update(100, { x: 80, y: 80 });
assert.equal(system.getAttackVisualState('wall')?.progress, 0, 'new threatened cell gets a complete warning');
system.update(100, { x: 200, y: 200 });
assert.equal(system.getAttackVisualState('wall')?.phase, 'idle', 'escape disarms the hazard');
assert.equal(hits, 1);
const volume = { ...host, id: 'volume', kind: 'ding', box: { minCol: 1, minRow: 1, maxCol: 2, maxRow: 2 },
  reverseActivity: new ReverseActivityClock(),
  live: { x: 32, y: 32, w: 64, h: 64 }, elapsedMs: 0, awake: false,
  form: { ...host.form, substrate: 'space_interval', occupancy: 'volume', portfolio: 'ding', continuity: 'field',
    lexemes: { motion: 'motion_anchor', sense: 'sense_domain', rhythm: 'rhythm_open', contact: 'contact_volume_chaos' } },
};
Object.assign(system, { hosts: [volume] });
system.update(10000, { x: 64, y: 64 });
assert(chaos <= GAME_CONSTANTS.CONTAMINATION.VOLUME_CHAOS_PER_SEC * .100001,
  'volume uses the same bounded clock as AI and melee');
assert.equal(volume.elapsedMs, 100);
// An unkillable field in front must not steal the one host hit from a hittable core.
const killable = { ...host, kind: 'bing', id: 'core', hp: 75, nuclei: [], phase: 0,
  pin: { floorCol: 2, floorRow: 2 }, core: { x: 100, y: 80 },
  form: { ...host.form, portfolio: 'bing', occupancy: 'paint', substrate: 'fungal_mat', continuity: 'field', coverage: 'infiltrate',
    lexemes: { motion: 'motion_cluster', sense: 'sense_touch', rhythm: 'rhythm_cluster', contact: 'contact_step_chaos' } },
};
// Only a monolith can be a single hittable core, so use an actual wall host for that target.
const wallCore = { ...host, id: 'wall-core', hp: 75, core: { x: 100, y: 80 }, tile: { col: 3, row: 2 },
  strikeFloors: [{ col: 2, row: 2 }], windupMs: -1 };
const field = { ...killable, id: 'field', core: { x: 95, y: 80 }, form: { ...killable.form, coverage: 'overwrite' } };
const swingCombat = { getAttackState: () => ({ phase: 'active' }), getLockedAttackAngle: () => 0, applyHazardHit() {} };
Object.assign(system, { hosts: [field, wallCore], combat: swingCombat, swingHit: false, occluders: null });
system.update(16, { x: 80, y: 80 });
assert.equal(field.hp, 75);
assert.equal(wallCore.hp, 75 - GAME_CONSTANTS.COMBAT.PLAYER_DAMAGE, 'unkillable field does not consume the swing');
const behind = { ...wallCore, hp: 75, core: { x: 130, y: 48 }, tile: { col: 4, row: 1 }, strikeFloors: [{ col: 5, row: 1 }] };
Object.assign(system, { hosts: [behind], swingHit: false,
  occluders: { ...blocked, isOpaque: (col: number, row: number) => !blocked.isWalkable(col, row) } });
system.update(16, { x: 90, y: 48 });
assert.equal(behind.hp, 75, 'core cannot be hit through the intervening wall');
// West-facing seam lies exactly on the wall boundary. Its exposed half remains hittable.
const seam = { ...wallCore, hp: 75, core: { x: 96, y: 48 }, tile: { col: 3, row: 1 }, strikeFloors: [{ col: 2, row: 1 }] };
Object.assign(system, { hosts: [seam], swingHit: false });
system.update(16, { x: 80, y: 48 });
assert.equal(seam.hp, 75 - GAME_CONSTANTS.COMBAT.PLAYER_DAMAGE, 'exposed wall seam is not occluded by its own tile');

// R3: a painted colony cannot harm an unpainted tile, nor revive a removed surface.
const colony = { ...killable, id: 'paint-contract', nuclei: [
  { core: { x: 80, y: 80 }, floorCol: 2, floorRow: 2, alive: true, hp: 50, flashMs: 0 },
], form: { ...killable.form, continuity: 'colony' } };
Object.assign(system, { hosts: [colony], liveMotion: false });
system.setStepFloors(colony.id, [{ col: 2, row: 2 }]);
assert.equal(system.isPaintFloorActive(colony.id, 2, 2), true);
assert.equal(system.isPaintFloorActive(colony.id, 3, 2), false, 'nucleus radius cannot extend beyond visible field');
colony.nuclei[0]!.alive = false;
assert.equal(system.isPaintFloorActive(colony.id, 2, 2), false, 'dead nucleus releases only its region');
colony.nuclei[0]!.alive = true;
system.setStepFloors(colony.id, []);
assert.equal(system.isPaintFloorActive(colony.id, 2, 2), false, 'empty surface does not restore invisible fallback');
Object.assign(system, { liveMotion: true });

// Terrain clipping is mandatory for both scene TileGrid and occluder-only callers.
const terrainColony = { ...colony, alive: true, hp: 50, id: 'terrain-paint',
  pin: { floorCol: 2, floorRow: 2, cx: 80, cy: 80 }, nuclei: [] as typeof colony.nuclei };
const allowed = new Set(['2,2', '5,2']);
const terrain = { cols: 9, rows: 6, tileSize: 32, version: 0,
  isOpaque: (col: number, row: number) => !allowed.has(`${col},${row}`) };
Object.assign(system, { hosts: [terrainColony], occluders: terrain, walkableFloors: null, liveMotion: true });
const fixedSurfacePin = system.getVisualPin(terrainColony.id);
const priorCore = { ...terrainColony.core };
system.setStepFloors(terrainColony.id, [{col: 2,row: 2}, {col: 5,row: 2}, {col: 3,row: 2}, {col: -1,row: 2}]);
assert.equal(terrainColony.nuclei.length, 2, 'both legal paint islands receive reachable cores');
assert.notDeepEqual(terrainColony.core, priorCore, 'fixture actually relocates the primary nucleus');
assert.deepEqual(system.getVisualPin(terrainColony.id), fixedSurfacePin, 'nucleus relocation cannot translate painted surface or registered stepFloors');
assert.deepEqual(fixedSurfacePin, { kind: 'cluster', x: 80, y: 80 });
assert(terrainColony.nuclei.every(n => allowed.has(`${n.floorCol},${n.floorRow}`)), 'no core seats on clipped wall or VOID');
assert.equal(system.isPaintFloorActive(terrainColony.id, 3, 2), false);
assert.equal(system.isPaintFloorActive(terrainColony.id, 2, 2), true);
// Prefer walkability when available, even if a transparent tile does not occlude.
Object.assign(system, { occluders: {...terrain, isOpaque: () => false, isWalkable: terrain.isOpaque} });
assert.equal(system.isPaintFloorActive(terrainColony.id, 2, 2), false);
Object.assign(system, { occluders: terrain });
system.setStepFloors(terrainColony.id, [{col: 3,row: 2}, {col: -1,row: 2}]);
assert.equal(terrainColony.alive, false, 'all-invalid footprint disables deployment without retaining an unreachable active core');
assert(terrainColony.nuclei.every(n => !n.alive));
assert.equal(system.isPaintFloorActive(terrainColony.id, 2, 2), false);
Object.assign(system, { occluders: null });

// Exact seating: greedy origin (1,0) hides the viable pair (0,1)/(2,1).
const fork = [{col:1,row:0},{col:0,row:1},{col:2,row:1}];
const forkSeats = colonyNucleusSeatsInFloors(fork, 2, 3, 3, 2);
assert.equal(forkSeats.length, 2);
assert.equal(chebyshevTiles(forkSeats[0]!, forkSeats[1]!), 2);
assert.deepEqual(colonyNucleusSeatsInFloors([...fork].reverse(), 2, 3, 3, 2), forkSeats, 'input iteration order cannot alter optimal seats');
const compact = colonyNucleusSeatsInFloors([{col:2,row:2},{col:3,row:2}],2,3,3,2);
assert.equal(compact.length, 2);
assert.equal(chebyshevTiles(compact[0]!, compact[1]!), 1, 'compact exception keeps distinct legal adjacent cores');
assert.deepEqual(colonyNucleusSeatsInFloors([{col:2,row:2},{col:2,row:2}],2,3,3,2), [], 'duplicate cell cannot fake two nuclei');
const singleCell = { ...terrainColony, id: 'one-tile', alive: true, hp: 50, nuclei: [] as typeof colony.nuclei };
Object.assign(system, { hosts: [singleCell], occluders: terrain, liveMotion: true });
system.setStepFloors(singleCell.id, [{col:2,row:2}]);
assert.equal(singleCell.alive, false, 'a single legal tile cannot silently downgrade colony to monolith');
Object.assign(system, { occluders: null });

// Full activity/attack contract, not just the CSV capability whitelist.
const sleep = new ActivityClock('rhythm_sleep', 'sleeper');
Object.assign(carrier, { id: 'sleeper', activity: sleep, attackCommitted: false });
carrier.ai.state = AIState.PATROL;
for (let i = 0; i < 100; i++) carrier.tickActivity(100, false);
assert.equal(carrier.canAct(), false, 'time alone cannot wake a sleeper');
carrier.tickActivity(100, true);
assert.deepEqual(carrier.getActivityVisualState(), { phase: 'waking', progress: 0 });
for (let i = 0; i < 5; i++) carrier.tickActivity(100, false);
assert.equal(carrier.isAttackAvailable(), false, '500ms of a 600ms wake is not attack permission');
carrier.tickActivity(100, false);
assert.equal(carrier.isAttackAvailable(), true);
carrier.ai.state = AIState.ALERT; carrier.tickActivity(16, false);
carrier.ai.state = AIState.CHASE; carrier.tickActivity(16, false);
assert.equal(carrier.isAttackAvailable(), true, 'awake encounter does not oscillate back to sleep');
carrier.ai.state = AIState.RETURN; carrier.tickActivity(16, false);
assert.equal(carrier.isAttackAvailable(), true);
carrier.ai.state = AIState.PATROL; carrier.tickActivity(16, false);
assert.equal(carrier.canAct(), false, 'sleep returns only after complete disengagement');
const pulse = new ActivityClock('rhythm_pulse', 'pulse-a');
const samePulse = new ActivityClock('rhythm_pulse', 'pulse-a');
const offsetPulse = new ActivityClock('rhythm_pulse', 'pulse-b');
const phaseTimes = { rest: 0, waking: 0, active: 0 };
let differs = false;
for (let i = 0; i < 660; i++) {
  pulse.tick(10, false, true); samePulse.tick(10, false, true); offsetPulse.tick(10, false, true);
  phaseTimes[pulse.visual.phase] += 10;
  assert.deepEqual(pulse.visual, samePulse.visual, 'same identity has deterministic activity phase');
  differs ||= pulse.visual.phase !== offsetPulse.visual.phase || pulse.visual.progress !== offsetPulse.visual.progress;
}
assert.deepEqual(phaseTimes, { rest: 2400, waking: 600, active: 3600 });
assert(differs, 'neighbours are not forced into a synchronized pulse');
const narrowConfig = createEnemyTypeConfig('infiltrator', {
  ...INFILTRATOR_FORM, lexemes: { ...INFILTRATOR_FORM.lexemes, sense: 'sense_narrow' },
});
assert(Math.abs(narrowConfig.sight.rangeCore - 207) < .0001);
assert(narrowConfig.sight.rangeCore < GAME_CONSTANTS.VISIBILITY.RADIUS_FORWARD,
  'narrow acquisition still lets the player see farther than the enemy');
assert(Math.abs(narrowConfig.sight.halfAngleCore * 2 * 180 / Math.PI - 70) < .0001);
assert.equal(narrowConfig.sight.rangePeripheral, 0, 'narrow sense has no hidden broad detection skirt');

// Production combat must gate only new commitments. A committed hit completes even
// when its pulse closes during windup; it still pays the normal cooldown afterward.
const melee = new CombatSystem();
const target = { x: 100, y: 80 };
Object.assign(carrier.ai, { position: { x: 80, y: 80 }, facingAngle: 0, engaged: true, state: AIState.CHASE });
Object.assign(carrier, { activity: pulse });
const swingState = { id: 'sleeper', view: carrier, alive: true, health: 75,
  attackPhase: 'idle', attackTimerMs: 0, attackAngle: 0, cooldownRemainingMs: 0,
  engagedSinceMs: 500, strikeFxFrames: 0 };
Object.assign(melee, { enemies: new Map([['sleeper', swingState]]), health: 100, enabled: true,
  player: { getPosition: () => target }, hooks: {},
  occluders: { ...arena, isOpaque: (col: number, row: number) => !arena.isWalkable(col, row) },
});
const combatTick = melee as unknown as { updateEnemies(dt: number): void; health: number };
while (pulse.visual.phase === 'active') pulse.tick(10, false, false);
combatTick.updateEnemies(16);
assert.equal(swingState.attackPhase, 'idle', 'rest or waking cannot start a melee attack');
while (pulse.visual.phase !== 'active') pulse.tick(10, false, false);
combatTick.updateEnemies(16);
assert.equal(swingState.attackPhase, 'windup');
while (pulse.visual.phase === 'active') pulse.tick(10, false, false);
assert.equal(carrier.canAct(), true, 'committed attack stays enabled into rest');
for (let i = 0; i < 7; i++) combatTick.updateEnemies(50);
assert.equal(combatTick.health, 100 - GAME_CONSTANTS.COMBAT.ENEMY_DAMAGE_BASE);
assert.equal(swingState.attackPhase, 'cooldown');
assert.equal(carrier.canAct(), false, 'finishing commitment hands control back to the closed rhythm');

// Wall hearing: a silent adjacent player is safe, actual noise establishes a warning.
const listener = { ...host, id: 'listener', hp: 75, activity: new ActivityClock('rhythm_sleep', 'listener'),
  noiseRemainingMs: 0, windupMs: -1, strikeThisFrame: false, windupCol: -1, windupRow: -1,
  form: { ...host.form, lexemes: { ...host.form.lexemes, sense: 'sense_hear', rhythm: 'rhythm_sleep' } },
};
let listenerHits = 0;
Object.assign(system, { hosts: [listener], occluders: null, swingHit: false,
  combat: { getAttackState: () => ({ phase: 'idle' }), applyHazardHit() { listenerHits++; } } });
for (let i = 0; i < 20; i++) system.update(100, player, false, 0);
assert.equal(listenerHits, 0);
assert.equal(system.getActivityVisualState('listener')?.phase, 'rest');
system.reportNoise(player, 100);
system.update(16, player, false, 0);
for (let i = 0; i < 5; i++) system.update(100, player, false, 0);
assert.equal(system.getAttackVisualState('listener')?.phase, 'idle');
system.update(100, player, false, 0);
assert.equal(system.getAttackVisualState('listener')?.phase, 'windup');
assert.equal(listenerHits, 0);
for (let i = 0; i < 7; i++) system.update(50, player, false, 0);
assert.equal(listenerHits, 1, '600ms wake plus complete 350ms warning precede first damage');

// Reverse: the real player's facing and LOS control the dangerous interval.
const reverse = { ...volume, id: 'reverse', reverseActivity: new ReverseActivityClock(),
  activity: new ActivityClock('rhythm_open', 'reverse'), elapsedMs: 0,
  form: { ...volume.form, lexemes: { ...volume.form.lexemes, sense: 'sense_reverse' } },
};
Object.assign(system, { hosts: [reverse], getVisibility: () => 1, occluders: null });
const interior = { x: 48, y: 64 };
chaos = 0;
for (let i = 0; i < 5; i++) system.update(100, interior, false, Math.PI);
assert.equal(chaos, 0, 'inside the volume, looking away from its core is a viable counter');
system.update(100, interior, false, 0);
system.update(100, interior, false, 0);
assert.equal(chaos, 0, 'first 200ms of observation is still warning');
system.update(100, interior, false, 0);
assert(chaos > 0, 'looking at the core arms the volume after 300ms');
for (let i = 0; i < 5; i++) system.update(100, interior, false, Math.PI);
assert(reverse.reverseActivity.active, 'release is visibly gradual for 600ms');
system.update(100, interior, false, Math.PI);
const safeChaos = chaos;
for (let i = 0; i < 10; i++) system.update(100, interior, false, Math.PI);
assert.equal(chaos, safeChaos);
assert.equal(system.getVolumeSightMult(), 1);
const opaque = { ...arena, isOpaque: (col: number, row: number) => col === 1 || !arena.isWalkable(col, row) };
Object.assign(system, { occluders: opaque });
for (let i = 0; i < 10; i++) system.update(100, { x: 16, y: 64 }, false, 0);
assert.equal(reverse.reverseActivity.active, false, 'facing the box through a wall cannot wake it');
const dyingWall = { ...seam, hp: GAME_CONSTANTS.COMBAT.PLAYER_DAMAGE,
  windupMs: 300, windupCol: 2, windupRow: 1, activity: new ActivityClock('rhythm_open', 'dying') };
let postMortemHits = 0;
Object.assign(system, { hosts: [dyingWall], occluders: null, swingHit: false,
  combat: { ...swingCombat, applyHazardHit() { postMortemHits++; } } });
system.update(50, player);
assert.equal(dyingWall.alive, false);
assert.equal(postMortemHits, 0, 'a core destroyed this frame cannot finish its pending hazard afterward');
let angularHits = 0;
const narrowWall = { ...host, id: 'narrow-wall', hp: 75, alive: true, windupMs: -1, strikeThisFrame: false,
  activity: new ActivityClock('rhythm_open', 'narrow-wall'), noiseRemainingMs: 0,
  form: { ...host.form, lexemes: { ...host.form.lexemes, sense: 'sense_narrow' } },
};
Object.assign(system, { hosts: [narrowWall], occluders: null,
  combat: { getAttackState: () => ({ phase: 'idle' }), applyHazardHit() { angularHits++; } } });
for (let i = 0; i < 10; i++) system.update(100, { x: 80, y: 80 });
assert.equal(angularHits, 0, 'narrow wall does not react to an adjacent cell outside its 70-degree normal cone');
system.update(16, player);
for (let i = 0; i < 7; i++) system.update(50, player);
assert.equal(angularHits, 1, 'entering the wall-normal cone establishes a complete real attack');
const touchWall = { ...narrowWall, windupMs: -1,
  form: { ...host.form, lexemes: { ...host.form.lexemes, sense: 'sense_touch' } },
};
Object.assign(system, { hosts: [touchWall] });
system.update(16, { x: 80, y: 80 });
for (let i = 0; i < 7; i++) system.update(50, { x: 80, y: 80 });
assert.equal(angularHits, 2, 'touch wall attacks the same adjacent off-axis position');
const pulseWall = { ...host, id: 'pulse-wall', alive: true, windupMs: -1, strikeThisFrame: false,
  activity: new ActivityClock('rhythm_pulse', 'pulse-wall'), noiseRemainingMs: 0,
  walk: { segment: [{ col: 1, row: 1 }, { col: 1, row: 2 }], along: 0, dir: 1, turnAccumMs: 0 },
  floorUniverse: [{ col: 2, row: 1 }, { col: 2, row: 2 }],
  form: { ...host.form, lexemes: { ...host.form.lexemes, motion: 'motion_wall', rhythm: 'rhythm_pulse' } },
};
Object.assign(system, { hosts: [pulseWall] });
for (let i = 0; i < 66 && pulseWall.activity.visual.phase !== 'rest'; i++) system.update(100, { x: 1000, y: 1000 });
assert.equal(pulseWall.activity.visual.phase, 'rest');
const stoppedCore = { ...pulseWall.core };
for (let i = 0; i < 5; i++) {
  system.update(100, player);
  assert.equal(pulseWall.moving, false);
  assert.deepEqual(pulseWall.core, stoppedCore, 'resting/waking wall cannot continue hidden seam movement');
  assert.equal(system.getAttackVisualState('pulse-wall')?.phase, 'idle');
}
for (let i = 0; i < 66 && pulseWall.activity.visual.phase !== 'active'; i++) system.update(100, { x: 1000, y: 1000 });
const activeCore = { ...pulseWall.core };
for (let i = 0; i < 5; i++) system.update(100, { x: 1000, y: 1000 });
assert(Math.hypot(pulseWall.core.x - activeCore.x, pulseWall.core.y - activeCore.y) > .1,
  'active pulse resumes the actual along-wall locomotion');
const combinedClock = new ActivityClock('rhythm_pulse', 'combined');
while (combinedClock.visual.phase !== 'active') combinedClock.tick(10, false, true);
while (combinedClock.visual.phase === 'active') combinedClock.tick(10, false, true);
const combinedVolume = { ...reverse, id: 'combined', activity: combinedClock,
  reverseActivity: new ReverseActivityClock(),
  form: { ...reverse.form, lexemes: { ...reverse.form.lexemes, rhythm: 'rhythm_pulse' } } };
Object.assign(system, { hosts: [combinedVolume], occluders: null });
const beforeCombined = chaos;
for (let i = 0; i < 3; i++) system.update(100, interior, false, 0);
assert(combinedVolume.reverseActivity.active);
assert.equal(system.getActivityVisualState('combined')?.phase, 'rest',
  'seeing a reverse core cannot visually open its independent closed pulse');
assert.equal(chaos, beforeCombined, 'composed sense/rhythm gate controls actual hazard too');
// Proximity suppression is shared across sleeping bodies/hosts. Reported combat noise is not.
let avoided = 0;
const hearingContext = { hearingSuppressed: true, hearingRangeMult: 1 };
const proximityAI = Object.create(AISystem.prototype) as AISystem;
Object.assign(proximityAI, { context: hearingContext, hearingAvoidedListener: () => { avoided++; },
  playerIsMoving: true, playerPos: { x: 80, y: 48 }, raysThisFrame: 0,
  occluders: { cols: 100, rows: 100, tileSize: 32, version: 0, isOpaque: () => false } });
const sleepingBody = Object.create(Enemy.prototype) as Enemy;
Object.assign(sleepingBody, { id: 'quiet-body', activity: new ActivityClock('rhythm_sleep', 'quiet-body'),
  activityHearingAccumMs: 0, form: { ...INFILTRATOR_FORM, lexemes: { ...INFILTRATOR_FORM.lexemes, rhythm: 'rhythm_sleep' } },
  config: createEnemyTypeConfig('infiltrator', INFILTRATOR_FORM), ai: { state: AIState.PATROL,
    position: { x: 64, y: 48 }, perceptionRangeMult: 1, pendingDamage: false,
    pendingNoiseLevel: null, pendingNoisePos: { x: 0, y: 0 } } });
const activityAI = proximityAI as unknown as { updateActivity(enemy: Enemy, delta: number): void };
for (let i = 0; i < 6; i++) activityAI.updateActivity(sleepingBody, 16);
assert.equal(avoided, 0, 'sleeping hearing uses perception cadence, not render-frame charges');
activityAI.updateActivity(sleepingBody, 4);
assert.equal(avoided, 1);
assert.equal(sleepingBody.getActivityVisualState().phase, 'rest', 'muffle prevents actual footstep wake and spends a discovery');
sleepingBody.ai.pendingNoiseLevel = 'alert';
activityAI.updateActivity(sleepingBody, 100);
assert.equal(avoided, 1, 'explicit combat report does not consume muffle');
assert.equal(sleepingBody.getActivityVisualState().phase, 'waking', 'combat noise still wakes muffle-protected sleeper');
const quietHost = { ...host, id: 'quiet-host', windupMs: -1, noiseRemainingMs: 0, hearingAccumMs: 0,
  activity: new ActivityClock('rhythm_sleep', 'quiet-host'),
  form: { ...host.form, lexemes: { ...host.form.lexemes, sense: 'sense_hear', rhythm: 'rhythm_sleep' } } };
Object.assign(system, { hosts: [quietHost], occluders: null,
  combat: { getAttackState: () => ({ phase: 'idle' }), applyHazardHit() { hits++; } },
  hearingPolicy: { getRangeMultiplier: () => proximityAI.getHearingRangeMultiplier(),
    suppressDiscovery: (id: string) => proximityAI.trySuppressHearingDiscovery(id) } });
system.update(100, player, true);
assert.equal(avoided, 2);
assert.equal(quietHost.activity.visual.phase, 'rest');
assert.equal(quietHost.windupMs, -1, 'muffled nearby movement cannot initiate a real wall strike');
system.reportNoise(player, 100);
system.update(100, player, true);
assert.equal(avoided, 2, 'reported host noise is not re-consumed as proximity');
assert.equal(quietHost.activity.visual.phase, 'waking');
for (let i = 0; i < 6; i++) system.update(100, player, true);
assert.equal(quietHost.activity.visual.phase, 'active');
assert.equal(quietHost.windupMs, 0);
assert.equal(avoided, 2, 'same committed encounter does not consume twice');
// Defense-side hearing boost extends host discovery, independently of equipped muffle.
const boostedHost = { ...quietHost, noiseRemainingMs: 0, hearingAccumMs: 0, windupMs: -1,
  activity: new ActivityClock('rhythm_sleep', 'boosted') };
Object.assign(system, { hosts: [boostedHost] });
hearingContext.hearingSuppressed = false;
system.update(100, { x: boostedHost.core.x + 160, y: boostedHost.core.y }, true);
assert.equal(boostedHost.activity.visual.phase, 'rest');
proximityAI.setHearingRangeMultiplier(1.15);
system.update(100, { x: boostedHost.core.x + 160, y: boostedHost.core.y }, true);
assert.equal(boostedHost.activity.visual.phase, 'waking', 'real host detection consumes the shared range modifier');
assert.equal(BEHAVIOR_PROFILE_DATA.rhythm_sleep!.wakeMs, 600);
console.log('check:contact-runtime ok (crowd/terrain/speed/pause, locomotion, mirror/LOS, host hits, sleep/pulse/narrow, committed attacks, wall hearing, reverse charge/release/LOS)');
