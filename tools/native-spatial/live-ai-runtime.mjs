/** Test host only: gameplay is production code; images and scene scheduling are adapters. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {AISystem} from '../../src/systems/ai/ai-system.ts';
import {TileGrid} from '../../src/systems/tile-grid.ts';
import {GridPathfinder} from '../../src/systems/pathfinding.ts';
import {createMovementOccluders} from '../../src/systems/ai/physical-grid.ts';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {INFILTRATOR_FORM} from '../../src/generation/contamination-draw.ts';
import {floorMotionFor} from '../../src/generation/contamination-draw.ts';
import {GAME_CONSTANTS} from '../../src/config/constants.ts';
import {AIState, TileType} from '../../src/types/game-types.ts';
import {getChaosModulators} from '../../src/systems/chaos-system.ts';
import {nativeSpatialShortestPaths} from '../../src/generation/world-study/native-spatial-visibility.ts';
import {buildNativeSpatialGeometry, nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure.ts';
import {hasLineOfSight} from '../../src/utils/grid-raycast.ts';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const Emitter = require('eventemitter3');
const ArcadeBody = require('phaser/src/physics/arcade/Body');
const ArcadeWorld = require('phaser/src/physics/arcade/World');
const SeparateTile = require('phaser/src/physics/arcade/tilemap/SeparateTile');
const DT = 1000 / 60;
const PHASES = [0, 2000, 4000, 6000];
const CONDITIONS = [{id: 'normal', chaos: 0}, {id: 'chaos-100', chaos: 100}];
const copy = p => ({x: p.x, y: p.y});
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sourceFiles = ['tools/native-spatial/check-live-ai.mjs', 'tools/native-spatial/live-ai-runtime.mjs',
  'src/entities/enemy-factory.ts', 'src/entities/activity-clock.ts', 'src/systems/pathfinding.ts',
  'src/systems/tile-grid.ts', 'src/systems/chaos-system.ts', 'src/config/constants.ts',
  'src/utils/grid-raycast.ts', 'src/generation/world-study/native-body-collision.ts',
  'src/generation/world-study/native-spatial-geometry.ts', 'src/generation/world-study/native-spatial-visibility.ts',
  'src/generated/enemy-data.ts', ...fs.readdirSync('src/systems/ai').filter(x => x.endsWith('.ts')).map(x => `src/systems/ai/${x}`)]
  .filter(file => fs.existsSync(file));
const hashes = () => Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));

function exactHash(value) {
  const hash = createHash('sha256');
  function visit(item) {
    if (ArrayBuffer.isView(item)) {hash.update(`typed:${item.constructor.name}:${item.byteLength}:`).update(new Uint8Array(item.buffer, item.byteOffset, item.byteLength));return;}
    if (Array.isArray(item)) {hash.update(`array:${item.length}[`);item.forEach(visit);hash.update(']');return;}
    if (item && typeof item === 'object') {hash.update('{');for (const key of Object.keys(item)) {visit(key);visit(item[key]);}hash.update('}');return;}
    assert.notEqual(typeof item, 'function');const text = item === undefined ? 'undefined' : JSON.stringify(item);hash.update(`${typeof item}:${text.length}:${text}`);
  }
  visit(value);return hash.digest('hex');
}

class Image {
  constructor(x, y, key, world = null) {
    Object.assign(this, {x, y, angle: 0, rotation: 0, scaleX: 1, scaleY: 1, active: true,
      width: 32, height: key.includes('rewriter') ? 48 : 32, texture: {key}});
    this.displayWidth = this.width; this.displayHeight = this.height;
    this.displayOriginX = this.width / 2; this.displayOriginY = this.height / 2;
    if (world) this.body = new ArcadeBody(world, this);
  }
  setPosition(x, y) {this.x = x;this.y = y;return this;}
  getTopLeft(out) {return out.set(this.x - this.displayOriginX + (this.body?.offset.x ?? 0), this.y - this.displayOriginY + (this.body?.offset.y ?? 0));}
  setOrigin(x, y = x) {this.displayOriginX = this.width * x;this.displayOriginY = this.height * y;return this;}
  setName(name) {this.name = name;return this;}
  setDepth(depth) {this.depth = depth;return this;}
  setTexture(key) {this.texture = {key};return this;}
  setRotation() {return this;} setAlpha() {return this;} setVisible() {return this;}
  setScale() {return this;} setTintFill() {return this;} setTint() {return this;}
  destroy() {this.active = false;}
}

function liveScene(layout, sight, seed, collision) {
  const walk = new TileGrid(layout.tileMap), size = walk.tileSize;
  const world = Object.assign(new Emitter(), {defaults: {}, gravity: {x: 0, y: 0},
    bounds: {x: 0, y: 0, right: walk.widthPx, bottom: walk.heightPx}, checkCollision: {up: true, down: true, left: true, right: true},
    updateMotion: ArcadeWorld.prototype.updateMotion, computeVelocity: ArcadeWorld.prototype.computeVelocity,
    computeAngularVelocity: ArcadeWorld.prototype.computeAngularVelocity});
  const images = [];
  const scene = {time: {now: 0}, physics: {world, add: {image(x, y, key) {const image = new Image(x, y, key, world);images.push(image);return image;}}},
    add: {image: (x, y, key) => new Image(x, y, key)}};
  const ai = new AISystem();
  ai.create(scene, layout.enemySpawns, sight, walk, {requireExactlyOneRewriter: false,
    recovery: {runSeed: seed >>> 0, signature: `g5-local-assay:${seed}`}});
  const enemies = ai.getEnemies();
  for (const enemy of enemies) {
    enemy.syncVisuals = () => {}; // Rendering has no authority over behavior, position or state.
    enemy.getSprite().body.updateFromGameObject();
    enemy.getSprite().body.prevFrame.copy(enemy.getSprite().body.position);
    assert.equal(enemy.ai.patrolMode, floorMotionFor(enemy.getForm()) === 'motion_patrol' ? enemy.spawnData.patrol.mode : 'static',
      `${enemy.id}: original patrol may not degrade to a static replacement`);
  }
  const originalPerceive = ai.perceive.bind(ai), tickPerceptions = [];
  ai.perceive = (enemy, range) => {originalPerceive(enemy, range);tickPerceptions.push({enemyId: enemy.id, ...ai.perception});};
  const tile = {collideLeft: true, collideRight: true, collideUp: true, collideDown: true};
  function step(player, moving) {
    tickPerceptions.length = 0;scene.time.now += DT;ai.update(DT, player, moving);
    for (const image of images) {
      const body = image.body;body.resetFlags();body.prevFrame.copy(body.position);body.update(DT / 1000);
      const firstCol = Math.max(0, Math.floor(body.x / size)), lastCol = Math.min(walk.cols - 1, Math.floor(body.right / size));
      const firstRow = Math.max(0, Math.floor(body.y / size)), lastRow = Math.min(walk.rows - 1, Math.floor(body.bottom / size));
      for (let row = firstRow; row <= lastRow; row++) for (let col = firstCol; col <= lastCol; col++) {
        if (walk.isWalkable(col, row)) continue;
        Object.assign(tile, {faceLeft: walk.isWalkable(col - 1, row), faceRight: walk.isWalkable(col + 1, row),
          faceTop: walk.isWalkable(col, row - 1), faceBottom: walk.isWalkable(col, row + 1)});
        SeparateTile(row * walk.cols + col, body, tile, {left: col * size, top: row * size, right: (col + 1) * size, bottom: (row + 1) * size}, null, 16, true);
      }
      body.updateCenter();body.postUpdate();
    }
    world.emit('worldstep', DT / 1000);ai.postUpdate(DT);
    return tickPerceptions;
  }
  return {ai, enemies, walk, step, collision, destroy: () => ai.destroy()};
}

function pointsFor(geometry, paths, target) {
  if (!Number.isFinite(paths.distance[target])) return null;
  const cells = [];for (let at = target; at !== -1; at = paths.parent[at]) cells.push(at);
  const points = cells.reverse().map(cell => nativeCellPoint(cell, geometry.terrain.cols));
  // Same real body sweeps, deterministic furthest reachable endpoint; never cross VOID.
  const smooth = [points[0]];
  for (let at = 0; at < points.length - 1;) {
    let next = points.length - 1;
    while (next > at + 1 && geometry.collision.displacementFraction(points[at], 10, 10, points[next].x - points[at].x, points[next].y - points[at].y) < 1 - 1e-9) next--;
    smooth.push(points[next]);at = next;
  }
  return smooth;
}
const lengthOf = points => points.slice(1).reduce((n, p, i) => n + distance(points[i], p), 0);
function enclosed(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function firstVoidBetween(geometry, a, b) {
  const steps = Math.ceil(distance(a, b) / 2), {cols} = geometry.terrain;
  for (let i = 1; i < steps; i++) {
    const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
    const col = Math.floor(x / 8), row = Math.floor(y / 8);
    if (geometry.sight.isOpaque(col, row)) return nativeCellPoint(row * cols + col, cols);
  }
  return null;
}

function encounters(map, geometry, policy) {
  const diagnostics = map.native.diagnostics.nativeSpatial;
  const holes = diagnostics.gates.visibility.metrics.holes;
  const structures = identifyNativeSpatialStructures(geometry, diagnostics.assemblies, policy).structures;
  const cols = geometry.terrain.cols, candidates = [], rejected = [];
  const enemies = [...map.layout.enemySpawns].sort((a, b) => a.id.localeCompare(b.id));
  for (const spawn of enemies) {
    const pos = {x: (spawn.spawn.col + .5) * 8, y: (spawn.spawn.row + .5) * 8};
    for (const hole of [...holes].sort((a, b) => a.id.localeCompare(b.id))) {
      const actualHole = structures.find(item => item.kind === 'hole' && item.id === hole.id);
      assert(actualHole, 'Recorded hole identity must still match the admitted body geometry');
      const removed = new Set(actualHole.cells);
      const ablated = {...geometry.sight, isOpaque: (x, y) => x < 0 || y < 0 || x >= geometry.terrain.cols || y >= geometry.terrain.rows
        || (!removed.has(y * cols + x) && geometry.sight.isOpaque(x, y))};
      const witnesses = [...hole.witnesses].sort((a, b) => distance(nativeCellPoint(a.t, cols), pos) - distance(nativeCellPoint(b.t, cols), pos) || a.q - b.q || a.v - b.v);
      const witness = witnesses.find(w => {
        const q = nativeCellPoint(w.q, cols), v = nativeCellPoint(w.v, cols);
        return distance(nativeCellPoint(w.t, cols), pos) <= 224 && distance(q, pos) <= 224 && distance(v, pos) <= 224
          && !hasLineOfSight(geometry.sight, q, pos) && hasLineOfSight(ablated, q, pos) && hasLineOfSight(geometry.sight, v, pos);
      });
      if (!witness) {rejected.push({enemyId: spawn.id, holeId: hole.id, reason: 'no-witness-with-real-enemy-hidden-at-q-and-visible-at-v-within-224px'});continue;}
      const q = nativeCellPoint(witness.q, cols), end = nativeCellPoint(witness.v, cols);
      const startPaths = nativeSpatialShortestPaths(geometry, [witness.q], 960);
      const direct = pointsFor(geometry, startPaths, witness.v);
      if (!direct) {rejected.push({enemyId: spawn.id, holeId: hole.id, reason: 'direct-body-route-unavailable'});continue;}
      const blockedVoid = firstVoidBetween(geometry, q, nativeCellPoint(witness.t, cols));
      assert(blockedVoid, 'Recorded G2 witness must cross real VOID');
      let detour = null;
      // Geometry-only choice before running AI: an alternate side of this same hole.
      for (const other of [...hole.witnesses].sort((a, b) => a.q - b.q || a.v - b.v)) {
        if (other.q === witness.q || distance(q, nativeCellPoint(other.q, cols)) < 80) continue;
        const first = pointsFor(geometry, startPaths, other.q);if (!first) continue;
        const second = pointsFor(geometry, nativeSpatialShortestPaths(geometry, [other.q], 960), witness.v);if (!second) continue;
        const joined = [...first, ...second.slice(1)], extra = lengthOf(joined) - lengthOf(direct);
        if (extra >= 80 && lengthOf(joined) <= 720 && enclosed(blockedVoid, [...direct, ...joined.slice().reverse()])) {detour = joined;break;}
      }
      if (!detour) {rejected.push({enemyId: spawn.id, holeId: hole.id, reason: 'no-fixed-order-distinct-same-hole-detour'});continue;}
      candidates.push({enemyId: spawn.id, holeId: hole.id, witness, q, end, blockedVoid, direct, detour,
        initialRealEnemy: pos, initialEnemyToReferencePx: distance(nativeCellPoint(witness.t, cols), pos)});
      break; // First geometrically eligible hole per enemy, never ranked by AI outcome.
    }
  }
  return {selected: candidates.slice(0, 3), eligibleCount: candidates.length, rejected,
    selection: 'Enemy ID order; hole ID order; witness nearest t to real spawn, actual guard hidden from q and visible from v within 224 px; first distinct route whose loop with the direct path encloses witnessed VOID; maximum first three enemies. No behavioral outcome used.'};
}

function enemyTravel(scene, target) {
  const finder = new GridPathfinder(scene.walk, createMovementOccluders(scene.walk), GAME_CONSTANTS.AI.BODY_SIZE);
  return scene.enemies.map(enemy => {
    const points = Array.from({length: GAME_CONSTANTS.AI.MAX_PATH_POINTS}, () => ({x: 0, y: 0}));
    const count = finder.findPath(enemy.getPosition(), target, points, GAME_CONSTANTS.AI.ASTAR_MAX_NODES);
    const pathPx = count ? lengthOf([copy(enemy.getPosition()), ...points.slice(0, count)]) : null;
    const speed = enemy.config.speeds[AIState.CHASE];
    return {enemyId: enemy.id, bodyRoutePx: pathPx, chaseSpeedPxPerSecond: speed,
      idealTravelMs: pathPx !== null && speed > 0 ? pathPx / speed * 1000 : null,
      meaning: 'Actual production body path / chase speed; optimistic lower bound, excludes turn, perception, rhythm and congestion.'};
  });
}

function simulate(map, native, encounter, action, phaseMs, condition) {
  const collision = new NativeBodyCollision(native, map.layout.tileMap);
  const scene = liveScene(map.layout, native.sight, map.metadata.effectiveSeed, collision);
  try {
    // All real guards advance; local assay begins after this fixed spawn-side warmup.
    for (let t = 0; t < phaseMs; t += DT) scene.step(map.layout.spawnPoint, false);
    const phaseRoster = scene.enemies.map(enemy => ({id: enemy.id, position: copy(enemy.getPosition()), facing: enemy.getFacingAngle(), state: enemy.getState(), patrolIndex: enemy.ai.patrolIndex}));
    const player = copy(encounter.q), speed = GAME_CONSTANTS.PLAYER.SPEED * getChaosModulators(condition.chaos).speedMult;
    const outward = action === 'void-detour' ? encounter.detour : encounter.direct;
    const route = action === 'retreat' ? [...encounter.direct, ...encounter.direct.slice(0, -1).reverse()] : outward;
    const waitMs = action === 'wait-then-cross' ? 3000 : 0;
    const returnTravel = enemyTravel(scene, encounter.q), observationTravel = enemyTravel(scene, encounter.end);
    const budgetMs = waitMs + lengthOf(route) / speed * 1000 + 2000;
    let cursor = 1, elapsed = 0, arrivedAtMs = null;
    const metrics = Object.fromEntries(scene.enemies.map(enemy => [enemy.id, {visualExposureMs: 0, longestVisualRunMs: 0,
      currentVisualRunMs: 0, hearingHitTicks: 0, hearingRateIntegral: 0, maxDetection: 0, firstChaseMs: null,
      engagedMs: 0, minDistancePx: Infinity, states: [], lastState: null}]));
    const trace = [], motion = {x: 0, y: 0, velocityX: 0, velocityY: 0, collided: false};
    const lastTick = new Map();
    while (elapsed < budgetMs) {
      const old = copy(player);
      if (elapsed >= waitMs && cursor < route.length) {
        let allowance = speed * DT / 1000;
        while (allowance > 1e-6 && cursor < route.length) {
          const goal = route[cursor], remaining = distance(player, goal), move = Math.min(allowance, remaining);
          if (remaining < 1e-6) {cursor++;continue;}
          const vx = (goal.x - player.x) / remaining * speed, vy = (goal.y - player.y) / remaining * speed;
          collision.resolveMotion(player, 10, 10, vx / speed * move, vy / speed * move, {x: vx, y: vy}, motion);
          player.x = motion.x;player.y = motion.y;
          assert(!motion.collided, 'Selected assay path must remain legal in exact player body physics');
          allowance -= move;if (move >= remaining - 1e-6) cursor++;
        }
      }
      if (cursor === route.length && arrivedAtMs === null) arrivedAtMs = elapsed;
      const perceptions = scene.step(player, distance(old, player) > .0001);
      for (const enemy of scene.enemies) if (enemy.isStaticObstacle()) {
        const p = enemy.getPosition();
        assert(Math.abs(p.x - player.x) >= 20 || Math.abs(p.y - player.y) >= 20,
          'Assay path contacted a real static enemy body; reject instead of passing through it');
      }
      for (const p of perceptions) {
        const m = metrics[p.enemyId], duration = lastTick.has(p.enemyId) ? elapsed - lastTick.get(p.enemyId) : 0;
        lastTick.set(p.enemyId, elapsed);
        if (p.visible) {m.visualExposureMs += duration;m.currentVisualRunMs += duration;m.longestVisualRunMs = Math.max(m.longestVisualRunMs, m.currentVisualRunMs);}
        else m.currentVisualRunMs = 0;
        m.hearingHitTicks += Number(p.hearingHit);m.hearingRateIntegral += p.hearingRate * duration / 1000;
      }
      for (const enemy of scene.enemies) {
        const m = metrics[enemy.id], state = enemy.getState();
        m.maxDetection = Math.max(m.maxDetection, enemy.getDetection());m.minDistancePx = Math.min(m.minDistancePx, distance(enemy.getPosition(), player));
        if (state === AIState.CHASE && m.firstChaseMs === null) m.firstChaseMs = elapsed;
        if (enemy.isEngaged()) m.engagedMs += DT;
        if (state !== m.lastState) {m.states.push({ms: elapsed, state});m.lastState = state;}
      }
      if (Math.round(elapsed / DT) % 15 === 0) trace.push({ms: elapsed, player: copy(player), enemies: scene.enemies.map(e => ({id: e.id, ...copy(e.getPosition()), facing: e.getFacingAngle(), state: e.getState(), detection: e.getDetection()}))});
      elapsed += DT;
    }
    return {action, phaseMs, condition, speed, waitMs, route, routePx: lengthOf(route), arrivedAtMs,
      reached: arrivedAtMs !== null, phaseRoster, metrics, observationTravel, returnTravel,
      actualEndToRetreat: enemyTravel(scene, encounter.q), aiStats: scene.ai.getStats(), trace};
  } finally {scene.destroy();}
}

function selfTest() {
  const tileMap = {cols: 80, rows: 64, tileSize: 8, tiles: Array.from({length: 64}, (_, y) => Array.from({length: 80}, (_, x) => x === 0 || y === 0 || x === 79 || y === 63 ? TileType.VOID : TileType.FLOOR))};
  const grid = new TileGrid(tileMap), layout = {tileMap, spawnPoint: {x: 44, y: 44}, enemySpawns: [{id: 'real-ai-smoke', type: 'infiltrator', form: INFILTRATOR_FORM,
    spawn: {col: 25, row: 25}, facing: 0, patrol: {mode: 'pingpong', pauseMs: 300, waypoints: [{col: 25, row: 25}, {col: 43, row: 25}]}}]};
  const scene = liveScene(layout, grid, 20261012, null), first = copy(scene.enemies[0].getPosition());
  try {
    for (let frame = 0; frame < 240; frame++) scene.step(layout.spawnPoint, false);
    const patrolEnd = copy(scene.enemies[0].getPosition());assert(distance(first, patrolEnd) > 32, 'Real guard patrol must actually move');
    let seen = 0;
    for (let frame = 0; frame < 180; frame++) {
      const enemy = scene.enemies[0], at = enemy.getPosition(), angle = enemy.getFacingAngle();
      const p = {x: at.x + Math.cos(angle) * 50, y: at.y + Math.sin(angle) * 50};
      seen += scene.step(p, true).filter(p => p.visible).length;
    }
    assert(seen > 0);assert.equal(scene.enemies[0].getState(), AIState.CHASE);
    return {status: 'passed', patrolMovementPx: distance(first, patrolEnd), actualPerceptionTicksVisible: seen,
      finalState: scene.enemies[0].getState(), physics: 'installed Arcade Body.update/postUpdate and World.updateMotion',
      scope: 'Harness only: one moving production Enemy with unchanged AI/FSM/pathfinding; no r12-map or G5 acceptance.'};
  } finally {scene.destroy();}
}

const [input, output] = process.argv.slice(2);
assert(input && output && !fs.existsSync(output));fs.mkdirSync(path.dirname(output), {recursive: true});
const report = {status: 'running', startedAt: new Date().toISOString(), sources: hashes(), cases: [], failures: [],
  contract: {phasesMs: PHASES, conditions: CONDITIONS, actions: ['direct-cross', 'wait-then-cross', 'void-detour', 'retreat'],
    waitMs: 3000, stepMs: DT, maximumFirstEligibleEnemies: 3, runtime: 'real AISystem/Enemy/GridPathfinder/Arcade Body/SeparateTile; exact NativeBodyCollision for player'},
  limitations: ['Local encounter assay relocates the player from the spawn-side warmup into the selected q at trial start; no claim of an unbroken whole-run playthrough.',
    'Enemy floor AI only. Host-mounted wall/volume contamination, attacks/damage/death, player abilities, chaos accumulation, camera/readability and player judgment are outside this harness.',
    'Chaos 100 uses the production player speed modifier; no invented enemy boost. Fixed chaos snapshots do not simulate whole-run deterioration.',
    'Exposure is sampled at actual production perception ticks. First interval has no inferred exposure. Motion is fixed 60 Hz and physics display scheduling is adapted, not a browser SceneManager.',
    'At least one alternative affecting risk is evidence, not proof of safety. Path/speed travel time is explicitly an optimistic bound. Normal viewport validation remains required.']};
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');save();
try {
  if (input === '--self-test') report.cases.push(selfTest());
  else {
    const receipt = JSON.parse(fs.readFileSync(input, 'utf8'));
    assert.equal(receipt.status, 'passed');assert.equal(receipt.sourcesStable, true);
    assert(receipt.cases.length > 0 && receipt.cases.length <= 15);
    for (const row of receipt.cases) {
      const map = deserialize(gunzipSync(fs.readFileSync(`${row.cacheBase}.map.v8.gz`)));
      const recipe = JSON.parse(fs.readFileSync(`${row.cacheBase}.recipe.json`, 'utf8'));
      assert.equal(exactHash(map), row.mapHash);assert.equal(map.native.algorithmRevision, 12);
      const native = hydrateR100MasterWorld(map.native, map.layout);
      const geometry = buildNativeSpatialGeometry(native.definition, map.metadata.effectiveSeed);
      assert.deepEqual(geometry.terrain.tileMap, map.layout.tileMap, 'Assay geometry must match admitted physical terrain');
      const chosen = encounters(map, geometry, recipe.nativeSpatial.policy), trials = [];
      for (const encounter of chosen.selected) for (const condition of CONDITIONS) for (const phase of PHASES) {
        const paired = report.contract.actions.map(action => simulate(map, native, encounter, action, phase, condition));
        const direct = paired[0].metrics[encounter.enemyId];
        const alternativesChangedRisk = paired.slice(1, 3).some(trial => {
          const value = trial.metrics[encounter.enemyId];
          return Math.abs(value.visualExposureMs - direct.visualExposureMs) >= 100 || Math.abs(value.maxDetection - direct.maxDetection) >= .05
            || (value.firstChaseMs === null) !== (direct.firstChaseMs === null);
        });
        trials.push({enemyId: encounter.enemyId, holeId: encounter.holeId, phase, condition, alternativesChangedRisk, paired});
      }
      const sufficient = chosen.selected.length > 0 && trials.every(trial => trial.paired.every(action => action.reached && action.aiStats.unstickEvents === 0)) && trials.some(trial => trial.alternativesChangedRisk);
      report.cases.push({worldId: row.worldId, grade: row.grade, requestedSeed: row.requestedSeed, mapHash: row.mapHash,
        status: sufficient ? 'bounded-ai-evidence' : 'insufficient-evidence', selection: chosen, trials});save();
    }
  }
} catch (error) {report.failures.push({error: String(error.stack ?? error)});}
report.sourcesAfter = hashes();report.sourcesStable = JSON.stringify(report.sources) === JSON.stringify(report.sourcesAfter);
report.status = report.failures.length || !report.sourcesStable ? 'failed'
  : input === '--self-test' ? 'harness-self-test-passed'
  : report.cases.every(row => row.status === 'bounded-ai-evidence') ? 'bounded-ai-evidence' : 'insufficient-evidence';
report.finishedAt = new Date().toISOString();save();console.log(JSON.stringify({status: report.status, cases: report.cases.length, failures: report.failures, output}));
if (report.status === 'failed' || report.status === 'insufficient-evidence') process.exitCode = 1;
