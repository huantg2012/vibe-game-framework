/** R8 A gate: shortest 1px/eight-direction graph routes, using production circle sweeps.
 * Run: node --import tsx tools/qa/measure-i30-r8-routes.ts
 * No game source or player save is changed. Hypothetical layouts exist only in child processes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GAME_CONSTANTS } from '../../src/config/constants';
import * as layout from '../../src/systems/purification-chamber-layout';
import type { ChamberDevice, ChamberPoint, ChamberRoute } from '../../src/systems/purification-chamber-layout';

const scenario = process.argv[2];
const variants = ['baseline-main', 'candidate-upper-back', 'candidate-upper-forward-workband'];
const SPEED = GAME_CONSTANTS.PLAYER.SPEED;
const artifactPath = 'docs/qa/artifacts/iteration-30-r8/routes.json';
if (!scenario) {
  const scenarios = variants.map(name => JSON.parse(execFileSync(process.execPath,
    ['--import', 'tsx', fileURLToPath(import.meta.url), name], { encoding: 'utf8' })));
  const baseline = scenarios[0];
  const comparison = scenarios.slice(1).map(candidate => ({
    scenario: candidate.name,
    routes: candidate.routes.map((route: { id: string; graphDistancePx: number }, i: number) => ({
      id: route.id,
      baselinePx: baseline.routes[i].graphDistancePx,
      candidatePx: route.graphDistancePx,
      increasePercent: round(100 * (route.graphDistancePx / baseline.routes[i].graphDistancePx - 1)),
      withinTenPercent: route.graphDistancePx <= baseline.routes[i].graphDistancePx * 1.1,
    })),
  }));
  const sourceFiles = ['src/systems/purification-chamber-layout.ts', 'src/systems/purification-chamber-locomotion.ts',
    'src/entities/player.ts', 'src/scenes/purification-scene.ts', 'src/config/constants.ts'];
  const report = {
    generatedAt: new Date().toISOString(), features: ['COH-F026', 'COH-F006', 'COH-F042'],
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    sourceSha256: Object.fromEntries(sourceFiles.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
    command: 'node --import tsx tools/qa/measure-i30-r8-routes.ts',
    method: 'Dijkstra shortest paths on a 1-world-pixel grid with eight normalized movement directions. Every graph edge is accepted only if production stepChamberMovement reaches its endpoint at original speed and the full 6px circular sole is supported. Device-operation sets also require production same-floor/swept-clearance permission and the unchanged 24px proximity radius.',
    limitations: [
      'Distances are exact for this discrete graph, an approximation of continuous keyboard paths. Seconds are distance / unchanged 80px/s, not measured human or browser traversal time.',
      'Operation-zone routes are independently minimized between any legal operation points; successive routes need not share the same endpoint. Anchor routes retain fixed reference endpoints for comparison.',
      'Hypothetical upper layouts retain current walk polygons, ramps, other five devices and original core collision footprint size. This favors the upper candidate; larger collision geometry or additional architecture cannot shorten its paths.',
      'The forward-workband sensitivity case moves the hypothetical upper core base to (286,181) and operation anchor to (286,216), retaining their 35px separation, 24px reach and upper-floor authority.',
      'No rendered scene, runtime keyboard traversal, aesthetics, or redesigned full-floor topology is validated here.',
    ],
    decision: 'KEEP_CORE_ON_MAIN_FLOOR. Both upper placements exceed the 10% budget on spawn-to-core and core-to-storage. Retain the existing main-floor base, anchor, collision footprint and ramps; establish hierarchy with a dark rear support/niche and architectural shoulders outside walk clearance. Changing the entire upper-floor outline is beyond this bounded gate.',
    speedPxPerSecond: SPEED, interactionRadiusPx: layout.CHAMBER_INTERACTION_RADIUS,
    feetRadiusPx: layout.CHAMBER_FEET_RADIUS, budgetMaximumIncreasePercent: 10,
    spawnEvidence: 'PurificationScene player creation consumes chamberFeetToPlayerPosition(CHAMBER_SPAWN_POINT); sole point (366,299), actor position (366,289).',
    existingUpperFloorLowerBound: {
      explanation: 'Every same-floor upper interaction requires feet y <= 224. Spawn y = 299 therefore requires at least 75px of continuous movement, even with all walls and devices removed. The measured legal baseline route is only 62.071px, so 75px already exceeds its 68.278px budget. No anchor-only adjustment anywhere on the existing upper polygon can pass the spawn-to-core budget.',
      minimumContinuousDistancePx: 75, baselineLegalGraphPathPx: baseline.routes[0].graphDistancePx,
      allowedDistancePx: round(baseline.routes[0].graphDistancePx * 1.1),
    },
    scenarios, comparison,
    mainFloorFallback: { geometry: 'identical to baseline-main', increasePercentForEveryRoute: 0,
      condition: 'Visual shell/support work must keep this floor union, all operation anchors and all six collision footprints unchanged, or rerun the route gate.' },
  };
  mkdirSync('docs/qa/artifacts/iteration-30-r8', { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ artifactPath, comparison, decision: report.decision }, null, 2));
} else {
  assert(variants.includes(scenario), `Unknown scenario ${scenario}`);
  if (scenario !== 'baseline-main') {
    // Mutate this isolated process before locomotion compiles its boundary cache.
    const bases = layout.CHAMBER_DEVICE_BASES as unknown as Record<ChamberDevice, ChamberPoint>;
    const anchors = layout.CHAMBER_DEVICE_ANCHORS as unknown as Record<ChamberDevice, ChamberPoint>;
    const floors = layout.CHAMBER_DEVICE_FLOORS as Record<ChamberDevice, 'main' | 'upper'>;
    const footprints = layout.CHAMBER_DEVICE_FOOTPRINTS as Record<ChamberDevice, ChamberPoint[]>;
    const base = scenario === 'candidate-upper-back' ? { x: 270, y: 160 } : { x: 286, y: 181 };
    const dx = base.x - bases.core.x, dy = base.y - bases.core.y;
    footprints.core = footprints.core.map(p => ({ x: p.x + dx, y: p.y + dy }));
    bases.core = base;
    anchors.core = scenario === 'candidate-upper-back' ? { x: 270, y: 195 } : { x: 286, y: 216 };
    floors.core = 'upper';
  }
  const locomotion = await import('../../src/systems/purification-chamber-locomotion');
  const { canStandInChamber, getChamberRouteAtPosition, createChamberMovementState,
    stepChamberMovement, canInteractWithChamberDevice } = locomotion;
  const width = layout.CHAMBER_SIZE.width, size = width * layout.CHAMBER_SIZE.height;
  const points: (ChamberPoint | undefined)[] = new Array(size);
  const routeAt: (ChamberRoute | undefined)[] = new Array(size);
  const operationSets = Object.fromEntries(['core', 'storage', 'offering', 'rift'].map(id => [id, []])) as Record<ChamberDevice, number[]>;
  for (let y = 0; y < layout.CHAMBER_SIZE.height; y++) for (let x = 0; x < width; x++) {
    const point = { x, y };
    if (!canStandInChamber(point)) continue;
    const id = y * width + x;
    points[id] = point;
    const route = getChamberRouteAtPosition(point)!;
    routeAt[id] = route;
    for (const device of Object.keys(operationSets) as ChamberDevice[]) {
      const anchor = layout.CHAMBER_DEVICE_ANCHORS[device];
      if (Math.hypot(anchor.x - x, anchor.y - y) <= layout.CHAMBER_INTERACTION_RADIUS
        && canInteractWithChamberDevice({ ...point, route }, device)) operationSets[device].push(id);
    }
  }
  const steps = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }];
  const edgeValidity = new Uint8Array(size * steps.length);
  function legalEdge(id: number, direction: number): boolean {
    const cacheId = id * steps.length + direction;
    if (edgeValidity[cacheId]) return edgeValidity[cacheId] === 1;
    const point = points[id]!, step = steps[direction]!;
    const target = { x: point.x + step.x, y: point.y + step.y };
    const state = { ...point, route: routeAt[id]! };
    stepChamberMovement(state, step, Math.hypot(step.x, step.y) / SPEED * 1000, SPEED);
    const legal = Math.hypot(state.x - target.x, state.y - target.y) < 1e-6;
    edgeValidity[cacheId] = legal ? 1 : 2;
    return legal;
  }
  function key(point: ChamberPoint): number {
    assert(Number.isInteger(point.x) && Number.isInteger(point.y));
    const id = point.y * width + point.x;
    assert(points[id], `Invalid endpoint ${JSON.stringify(point)}`);
    return id;
  }
  function shortest(id: string, sources: number[], goals: number[]) {
    assert(sources.length && goals.length, `${id}: nonempty operation regions`);
    const targets = new Set(goals), costs = new Float64Array(size).fill(Infinity), previous = new Int32Array(size).fill(-1);
    const heap: { id: number; cost: number }[] = [];
    function push(node: { id: number; cost: number }): void {
      let i = heap.length; heap.push(node);
      while (i > 0) { const p = (i - 1) >> 1; if (heap[p]!.cost <= node.cost) break; heap[i] = heap[p]!; i = p; }
      heap[i] = node;
    }
    function pop() {
      const first = heap[0]!, last = heap.pop()!;
      if (heap.length) {
        let i = 0;
        while (i * 2 + 1 < heap.length) {
          let child = i * 2 + 1;
          if (child + 1 < heap.length && heap[child + 1]!.cost < heap[child]!.cost) child++;
          if (heap[child]!.cost >= last.cost) break;
          heap[i] = heap[child]!; i = child;
        }
        heap[i] = last;
      }
      return first;
    }
    for (const source of sources) { costs[source] = 0; push({ id: source, cost: 0 }); }
    let final = -1;
    while (heap.length) {
      const current = pop();
      if (current.cost > costs[current.id]!) continue;
      if (targets.has(current.id)) { final = current.id; break; }
      for (let d = 0; d < steps.length; d++) {
        const step = steps[d]!, next = current.id + step.y * width + step.x;
        const cost = current.cost + Math.hypot(step.x, step.y);
        if (!points[next] || cost >= costs[next]! - 1e-10 || !legalEdge(current.id, d)) continue;
        costs[next] = cost; previous[next] = current.id; push({ id: next, cost });
      }
    }
    assert(final !== -1, `No route: ${id}`);
    const path: ChamberPoint[] = [];
    for (let cursor = final; cursor !== -1; cursor = previous[cursor]!) path.push(points[cursor]!);
    path.reverse();
    // Replay every graph edge through the actual solver at the original speed.
    const replay = createChamberMovementState(path[0]);
    for (let i = 1; i < path.length; i++) {
      const target = path[i]!, dx = target.x - replay.x, dy = target.y - replay.y;
      stepChamberMovement(replay, { x: dx, y: dy }, Math.hypot(dx, dy) / SPEED * 1000, SPEED);
      assert(Math.hypot(replay.x - target.x, replay.y - target.y) < 1e-6 && canStandInChamber(replay), `${id}: replay edge ${i}`);
    }
    const turns = path.filter((p, i) => i === 0 || i === path.length - 1
      || (p.x - path[i - 1]!.x) !== (path[i + 1]!.x - p.x)
      || (p.y - path[i - 1]!.y) !== (path[i + 1]!.y - p.y));
    return { id, graphDistancePx: round(costs[final]!), estimatedSecondsAtOriginalSpeed: round(costs[final]! / SPEED),
      start: path[0], end: path[path.length - 1], startRoute: routeAt[key(path[0]!)], endRoute: routeAt[final],
      productionSweepReplayPassed: true, graphEdgeCount: path.length - 1, turnPoints: turns };
  }
  const anchor = (device: ChamberDevice) => [key(layout.CHAMBER_DEVICE_ANCHORS[device])];
  const routes = [
    shortest('spawn-to-core-operation-zone', [key(layout.CHAMBER_SPAWN_POINT)], operationSets.core),
    shortest('core-operation-zone-to-storage-operation-zone', operationSets.core, operationSets.storage),
    shortest('offering-operation-zone-to-rift-operation-zone', operationSets.offering, operationSets.rift),
    shortest('spawn-to-core-anchor', [key(layout.CHAMBER_SPAWN_POINT)], anchor('core')),
    shortest('core-anchor-to-storage-anchor', anchor('core'), anchor('storage')),
    shortest('offering-anchor-to-rift-anchor', anchor('offering'), anchor('rift')),
  ];
  console.log(JSON.stringify({ name: scenario, coreBase: layout.CHAMBER_DEVICE_BASES.core,
    coreAnchor: layout.CHAMBER_DEVICE_ANCHORS.core, coreFloor: layout.CHAMBER_DEVICE_FLOORS.core,
    validGridPointCount: points.filter(Boolean).length, routes }));
}

function round(value: number): number { return Math.round(value * 1000) / 1000; }
