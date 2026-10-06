/** I11 controlled contracts. Graphics are recorded, not rendered; these are not play/art approvals. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { CATALOG_ITEMS } from '../../src/generated/contaminant-catalog-data';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { createCatalogContaminant, getCatalogAbilityByDefinition } from '../../src/systems/contaminant-catalog';
import { CatalogAbilityRuntime, validateCatalogAbilityRuntimeState } from '../../src/systems/catalog-ability-runtime';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { EnvironmentHazardControl } from '../../src/systems/environment-hazard-control';
import { InventoryStore } from '../../src/systems/inventory-store';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision';
import { TileGrid } from '../../src/systems/tile-grid';
import { collectToolRevealSnapshot, findSoundLureLanding, findStitchPlacement, sweepGroundDash } from '../../src/systems/tool-targeting';
import { hasLineOfSight } from '../../src/utils/grid-raycast';
import { AIState, TileType, type Vector2 } from '../../src/types/game-types';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import type { TileMapData } from '../../src/types/map-types';

const planFile = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const plan = JSON.parse(readFileSync(planFile, 'utf8'));
const matrix = plan.i11ContractMatrix;
assert(matrix, 'frozen plan must contain the cross-world matrix');
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
assert.equal(hash(matrix.abilitySource.path), matrix.abilitySource.sha256);
const definitions = Object.values(CATALOG_ITEMS).filter(row => row.class === 'core' && row.grade === 1);
assert.deepEqual(definitions.map(row => row.familyId).sort(), [...matrix.abilityFamilies].sort());
type Topology = 'open' | 'occluded' | 'void' | 'solid';
const topologies: Topology[] = ['open', 'occluded', 'void', 'solid'];
const rows: Record<string, unknown>[] = [];
let graphicCalls = 0, observedSweeps = 0, refusedTargets = 0, negativeChecks = 0;
const graphic: any = new Proxy({}, { get: (_target, name) => (...args: unknown[]) => {
  for (const value of args) if (typeof value === 'number') assert(Number.isFinite(value), `nonfinite graphic ${String(name)}`);
  graphicCalls++; return graphic;
} });
const scene: any = { add: { graphics: () => graphic } };
const versions = { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 } as const;
function geometry(angle: number, topology: Topology) {
  const origin = { x: 320, y: 320 }, direction = { x: Math.cos(angle), y: Math.sin(angle) };
  const point = (forward: number, side = 0): Vector2 => ({
    x: origin.x + direction.x * forward - direction.y * side,
    y: origin.y + direction.y * forward + direction.x * side,
  });
  const barrier = [point(32, -120), point(40, -120), point(40, 120), point(32, 120)];
  const inBand = (x: number, y: number) => {
    const forward = (x - 320) * direction.x + (y - 320) * direction.y;
    const side = -(x - 320) * direction.y + (y - 320) * direction.x;
    return forward >= 32 && forward <= 40 && Math.abs(side) <= 120;
  };
  const map: TileMapData = { tileSize: 8, rows: 80, cols: 80, tiles: Array.from({ length: 80 }, (_, r) =>
    Array.from({ length: 80 }, (_, c) => inBand(c * 8 + 4, r * 8 + 4)
      ? topology === 'void' ? TileType.VOID : topology === 'solid' || topology === 'occluded' ? TileType.WALL : TileType.FLOOR
      : TileType.FLOOR)) };
  // Occluded is an optical fixture: conservative cells occlude; only solid has a physical mesh.
  const native = { definition: { instances: topology === 'solid' ? [{ id: 1, role: 'solid' }] : [] }, meshes:
    topology === 'solid' ? [{ spec: { id: 1 }, positions: barrier.flatMap(p => [p.x, p.y, 12]), indices: [0, 1, 2, 0, 2, 3] }] : []
  } as unknown as R100NativeWorldData;
  const grid = new TileGrid(map), body = new NativeBodyCollision(native, map);
  assert(body.supports(origin, 10, 10));
  const visible = (p: Readonly<Vector2>) => hasLineOfSight(grid, origin, p);
  return { origin, direction, point, grid, body, visible };
}

for (const degrees of matrix.orientationsDegrees as number[]) for (const phase of matrix.normalizedAnimationPhases as number[]) {
  const angle = degrees * Math.PI / 180;
  for (const topology of topologies) for (const definition of definitions) {
    const ability = getCatalogAbilityByDefinition(definition.id, 'contaminant-v1')!;
    const label = `${ability.familyId}/${degrees}/${phase}/${topology}`;
    const { origin, direction, point, grid, body, visible } = geometry(angle, topology);
    const initial = { ...origin }, enemy = point(64), controls = new EnemyControlState();
    controls.setControlProtectionEnabled(true);
    const environment = new EnvironmentHazardControl();
    let commits = 0, sounds = 0, applications = 0, input = true;
    const decoys = new Map<string, Vector2>();
    const counts = () => ({ commits, sounds, applications });
    const connected = (from: Readonly<Vector2>, to: Readonly<Vector2>, range: number) =>
      collectToolRevealSnapshot(from, range, grid, [to], [], undefined, body).enemyPositions.length > 0;
    const runtime = new CatalogAbilityRuntime(scene, () => origin, () => [
      { getId: () => 'target', getPosition: () => enemy, getState: () => AIState.PATROL },
    ] as never, {
      runId: label, combatRulesVersion: 2, getFacingAngle: () => angle,
      isTargetAlive: () => true, isTargetVisible: visible,
      hasTargetLineOfSight: (a, b) => hasLineOfSight(grid, a, b),
      canApplyHardControl: () => controls.canApplyHardControl(),
      setEnemyControl: (_id, source, effect) => controls.set(source, effect),
      hasEnemyControl: (_id, source) => controls.has(source),
      clearEnemyControl: (_id, source) => { controls.clear(source); },
      getBasePollutionResistance: () => 0,
      getDashDestination: distance => sweepGroundDash({ origin, destination: point(distance), grid, bodyQueries: body, isVisible: visible }),
      advanceGroundDash: target => {
        const destination = sweepGroundDash({ origin, destination: target, grid, bodyQueries: body });
        assert(Math.hypot(destination.x - target.x, destination.y - target.y) < .001, `${label}: every active dash substep supported`);
        Object.assign(origin, destination); assert(body.supports(origin, 10, 10)); observedSweeps++; return true;
      },
      isGroundConnected: connected,
      getSoundLureDestination: distance => findSoundLureLanding(origin, direction, distance, grid, 16, body),
      reportSoundLure: () => { sounds++; },
      getStitchPlacement: (length, distance) => findStitchPlacement(origin, direction, distance, length, grid, (a,b) => hasLineOfSight(grid,a,b)),
      setPlayerInput: enabled => { input = enabled; },
      getEnvironmentTargets: () => [{ id: 'host', position: enemy, canSuppressHazard: !environment.suppressed }] as never,
      suppressEnvironmentHazard: (_id, source, duration) => { environment.suppress(source, duration); applications++; return true; },
      clearEnvironmentControl: (_id, source) => environment.clear(source),
      getRevealSnapshot: range => collectToolRevealSnapshot(origin, range, grid, [enemy], [point(20), point(96)], undefined, body),
      showAbyssReveal: () => {},
      setVisualDecoy: (source, p) => { if (p) decoys.set(source, { ...p }); else decoys.delete(source); },
    });
    const row: Record<string, unknown> = { label, family: ability.familyId, definitionId: definition.id, degrees, phase, topology };
    if (ability.slot === 'passive') {
      const inventory = new InventoryStore();
      inventory.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain' });
      assert(inventory.ensureStarter().ok);
      const item = createCatalogContaminant({ id: label, definitionId: definition.id, appearanceId: 'wax_parcel', offeringProfileId: 'resist_35', quality: 'ordinary', acquiredOrdinal: 0 });
      for (const result of [inventory.addContaminant(item), inventory.slotOffering(item.id, 0),
        inventory.finishOfferingImpact([item.id], 3, {}, `reveal:${label}`), inventory.prepareTool(item.id, 2), inventory.beginRun(label, versions)]) assert(result.ok, label);
      const saved = inventory.getState(), receipt = saved.run!.passiveReceipts![0]!;
      assert.equal(receipt.familyId, ability.familyId); assert.equal(receipt.definitionId, definition.id);
      assert(receipt.benefit > 0);
      // Passives do not acquire enemies or spend another charge for facing, pressure, pause, or restoration.
      assert(!runtime.use(ability, item.id, () => { commits++; return true; })); assert.equal(commits, 0);
      const restored = new InventoryStore(); restored.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain' });
      assert(restored.loadState(JSON.parse(JSON.stringify(saved)))); assert.deepEqual(restored.getState(), saved);
      assert.equal(restored.getCapacity(), inventory.getCapacity());
      row.receipt = receipt; row.accepted = 'passive-at-departure'; row.continuationExact = true;
    } else {
      if (topology === 'open' && ['solidify','suppress'].includes(ability.familyId)) {
        Object.assign(enemy, point(-64));
        assert.equal(runtime.getTargetPreview(ability), null, `${label}: a target behind cannot be selected`);
        assert(!runtime.use(ability, 'owned-item', () => { commits++; return true; }, 'behind'));
        assert.equal(commits, 0); Object.assign(enemy, point(64)); negativeChecks++;
      }
      const preview = runtime.getTargetPreview(ability);
      const accepted = runtime.use(ability, 'owned-item', () => { commits++; return true; }, 'use:1');
      if (topology === 'open') assert(accepted, label);
      if (['solidify', 'suppress'].includes(ability.familyId) && topology !== 'open') {
        assert(!visible(enemy), `${label}: fixture must actually occlude`); assert(!accepted, label); refusedTargets++;
      }
      if (['solidify','suppress','dash','sound_lure','tripwire','slow_zone'].includes(ability.familyId)) assert.equal(accepted, preview !== null, `${label}: preview/commit disagree`);
      assert.equal(commits, Number(accepted));
      if (accepted) {
        assert(!runtime.use(ability, 'owned-item', () => { commits++; return true; }, 'use:1'));
        const dt = ability.durationMs * phase;
        if (dt > 0) { controls.tick(dt); environment.tick(dt); runtime.update(dt); }
        const saved = JSON.parse(JSON.stringify(runtime.exportRuntimeState()));
        assert(validateCatalogAbilityRuntimeState(saved), label);
        assert.equal(saved.elapsedMs, dt);
        assert.equal(saved.effects[0].remainingTime, ability.durationMs - dt);
        // The engine pause gate supplies no update: inspection, serialization and restore must not advance time.
        const before = counts(), beforePosition = { ...origin }, host = environment.exportRuntimeState();
        for (let i = 0; i < 3; i++) assert.deepEqual(runtime.exportRuntimeState(), saved);
        controls.beginRuntimeRestore(); runtime.restoreRuntimeState(saved);
        assert.deepEqual(runtime.exportRuntimeState(), saved, label); assert.deepEqual(counts(), before);
        assert.deepEqual(origin, beforePosition); assert.deepEqual(environment.exportRuntimeState(), host);
        const forged = structuredClone(saved); forged.effects[0].resolvedParams.paramValue += 1;
        assert(!validateCatalogAbilityRuntimeState(forged)); negativeChecks++;
        row.activeEffect = saved.effects[0]; row.continuationExact = true;
        controls.tick(17); environment.tick(17); runtime.update(17);
        const advanced = runtime.exportRuntimeState();
        assert.equal(advanced.elapsedMs, dt + 17);
        assert.equal(advanced.effects[0]!.remainingTime, ability.durationMs - dt - 17);
        assert.deepEqual(counts(), before, `${label}: continued effect must not replay payment or one-shot sound`);
        if (ability.familyId === 'dash') {
          assert(body.supports(origin, 10, 10));
          row.actualTravel = Math.hypot(origin.x-initial.x, origin.y-initial.y);
          if (topology === 'solid' || topology === 'void') assert((row.actualTravel as number) < 32, label);
        }
      } else assert.equal(runtime.exportRuntimeState().effects.length, 0);
      row.accepted = accepted; row.commits = commits;
    }
    runtime.destroy(); assert(input, `${label}: dash teardown restores input`); assert.equal(decoys.size, 0);
    rows.push(row);
  }
}
assert.equal(rows.length, 12 * 8 * 4 * 4);
assert(observedSweeps > 0 && refusedTargets > 0 && negativeChecks > 0);
const output = process.argv[2];
const result = { status: 'pass', kind: 'controlled real runtime contracts, not normal game play or rendered art',
  scope: 'All 12 authored ordinary core families; eight directions; four active-effect lifecycle phases; open/optically occluded/real VOID/solid triangle fixtures. Pause is a no-tick contract, not a browser pause-key test. Ground remains invariant under effect clocks. Environment lighting animation is separately reviewed in normal three-grade footage.',
  plan: { path: planFile, sha256: hash(planFile) }, source: { path: 'tools/qa/check-r100-cross-world-capabilities.ts', sha256: hash('tools/qa/check-r100-cross-world-capabilities.ts') },
  abilitySource: matrix.abilitySource, counts: { cases: rows.length, graphicCalls, observedSweeps, refusedTargets, negativeChecks }, rows };
if (output) writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, ...result.counts }));
