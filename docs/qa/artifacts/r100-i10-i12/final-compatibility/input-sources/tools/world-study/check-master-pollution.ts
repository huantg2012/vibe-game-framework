/** Actual grade curves, native Host instances and physical placement admission. */
import assert from 'node:assert/strict';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { pollutionExposureBetween, pollutionRateAt } from '../../src/generation/world-study/pollution-grade';
import { ChaosSystem, validateChaosRuntimeState } from '../../src/systems/chaos-system';
import { ContaminationHostSystem, validateHostRuntimeSnapshot } from '../../src/systems/contamination-host-system';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { createMasterWorld } from '../../src/dev/rift-r100-masters/world';
import { TileGrid } from '../../src/systems/tile-grid';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { mix32 } from '../../src/generation/seed-fork';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { isVolumeDangerousAt, volumeTimeAtPhase } from '../../src/systems/volume-presence';
const close = (a: number, b: number): void => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const step = (chaos: ChaosSystem, seconds: number, dt = 20): void => { for (let i = 0; i < seconds * 1000; i += dt) chaos.update(Math.min(dt, seconds * 1000 - i)); };
const exposure = [];
for (const grade of POLLUTION_GRADE_DEFINITIONS) {
  const chaos = new ChaosSystem({ pollutionGrade: grade.id });
  step(chaos, 90);
  close(chaos.getValue(), pollutionExposureBetween(grade, 0, 90));
  close(chaos.getRate(), pollutionRateAt(grade, 90));
  const paused = chaos.exportRuntimeState(); chaos.setPaused(true); step(chaos, 20); close(chaos.getValue(), paused.value);
  chaos.setPaused(false);
  const state = chaos.exportRuntimeState(); assert(validateChaosRuntimeState(state));
  const resumed = new ChaosSystem({ pollutionGrade: grade.id }); resumed.restoreRuntimeState(state);
  step(chaos, 20, 100); step(resumed, 20, 10); close(chaos.getValue(), resumed.getValue());
  const other = new ChaosSystem(); assert(!other.validateRuntimeState(state)); other.destroy();
  const protectedPlayer = new ChaosSystem({ pollutionGrade: grade.id, getPollutionResistance: () => 50 });
  step(protectedPlayer, 90); close(protectedPlayer.getValue(), state.value * .5);
  protectedPlayer.addChaos('paint_step', 4); close(protectedPlayer.getValue(), state.value * .5 + 2);
  protectedPlayer.setTemporaryRateReduction(.5, 1000); const before = protectedPlayer.getValue();
  step(protectedPlayer, .5); close(protectedPlayer.getValue() - before, pollutionExposureBetween(grade, 90, 90.5) * .25);
  exposure.push({ grade: grade.id, at30: pollutionExposureBetween(grade, 0, 30), at60: pollutionExposureBetween(grade, 0, 60),
    at90: state.value, at120: pollutionExposureBetween(grade, 0, 120), at180: pollutionExposureBetween(grade, 0, 180) });
  chaos.destroy(); resumed.destroy(); protectedPlayer.destroy();
}
const legacy = new ChaosSystem(); step(legacy, 90); close(legacy.getValue(), 45); assert(!('pollutionGrade' in legacy.exportRuntimeState()));
const legacyResume = new ChaosSystem(); legacyResume.restoreRuntimeState(legacy.exportRuntimeState()); step(legacyResume, 10); close(legacyResume.getValue(), 50);
legacy.destroy(); legacyResume.destroy();
const chase = new ChaosSystem({ pollutionGrade: 'severe' });
eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: 'qa-chaser', alertLevel: 'chase' });
close(chase.getValue(), 3); step(chase, 10); close(chase.getValue(), 15.8); chase.destroy();
const placement = [];
const graphic: unknown = new Proxy({}, { get: () => () => graphic });
const scene = { add: { graphics: () => graphic } };
for (const definition of MASTER_SCENES) for (const seed of [definition.seed, definition.seed + 1]) {
  const world = createMasterWorld(definition, seed), grade = POLLUTION_GRADE_DEFINITIONS.find(row => row.id === definition.grade)!;
  const hostGrid = new TileGrid(world.hostTileMap), chaos = new ChaosSystem({ pollutionGrade: grade.id }), hosts = new ContaminationHostSystem();
  const forms = world.layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing');
  const occupied = new Set<string>();
  const paintFootprints: { id: string; cells: readonly { col: number; row: number }[] }[] = [];
  for (let slot = 0; slot < forms.length; slot++) {
    const form = forms[slot]!, pin = world.layout.contaminationPins.paintFloors[slot]!, id = `ENM_BING_${String(slot + 1).padStart(2, '0')}`;
    const hostSeed = mix32(seed, id), baked = bakePaintGenome({ ...form, seed: hostSeed, sense: form.lexemes.sense,
      rhythm: form.lexemes.rhythm, fragmentTypeId: 'frag-outdoor', geometryVersion: 2, veinVariant: resolvePaintVeinVariant(form.substrate, hostSeed) });
    const cells = (field: Float32Array) => collectPaintGenomeFloorTiles(field, baked.canvasW, baked.canvasH, (pin.floorCol + .5) * 32, (pin.floorRow + .5) * 32, 32);
    for (const p of cells(baked.terrainFootprintField)) assert(hostGrid.isWalkable(p.col, p.row), 'whole breathing footprint must have terrain');
    paintFootprints.push({ id, cells: cells(baked.field) });
    for (const p of cells(baked.field)) { const key = `${p.col},${p.row}`; assert(!occupied.has(key), 'paint Hosts must not stack step charges'); occupied.add(key); }
  }
  for (const p of world.pollution.safeRoute) {
    const col = Math.floor(p.x / 32), row = Math.floor(p.y / 32);
    assert(!occupied.has(`${col},${row}`), 'loot/extraction route cannot force paint contact');
    assert(!world.pollution.volumes.some(box => col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow), 'safe route cannot force volume contact');
  }
  hosts.create(scene as never, { ...world.layout, tileMap: world.hostTileMap }, null, chaos, () => 1,
    { liveMotion: true, occluders: hostGrid, sightGrid: world.sight });
  hosts.setSkipPaint(true);
  for (const footprint of paintFootprints) hosts.setStepFloors(footprint.id, footprint.cells);
  hosts.update(0, world.layout.spawnPoint, false, 0);
  const paintCell = paintFootprints[0]!.cells[0]!, beforePaint = chaos.getValue();
  hosts.update(0, { x: (paintCell.col + .5) * 32, y: (paintCell.row + .5) * 32 }, true, 0);
  assert([2, 4].includes(chaos.getValue() - beforePaint), 'real registered paint contact must add the existing 2/4 points');
  hosts.update(0, world.layout.spawnPoint, false, 0);
  hosts.setVolumePreviewTime('ENM_DING_01', volumeTimeAtPhase('gas_mass', 'release', .5), true);
  const frame = hosts.getVolumePresenceFrame('ENM_DING_01')!;
  let contact: { x: number; y: number } | null = null;
  for (let y = frame.rect.y; y < frame.rect.y + frame.rect.h && !contact; y += 2)
    for (let x = frame.rect.x; x < frame.rect.x + frame.rect.w; x += 2)
      if (isVolumeDangerousAt(frame, x, y)) { contact = { x, y }; break; }
  assert(contact, 'native gas release must have a real dangerous area');
  hosts.update(0, contact, false, 0);
  const beforeVolume = chaos.getValue(); hosts.update(100, contact, false, 0);
  close(chaos.getValue() - beforeVolume, .1);
  close(hosts.getVolumeSightMult(), .7);
  hosts.update(0, world.layout.spawnPoint, false, 0); close(hosts.getVolumeSightMult(), 1);
  hosts.setVolumePreviewTime('ENM_DING_01', null);
  assert.equal(hosts.getSubjects().filter(host => host.form.portfolio === 'bing').length, grade.paintCount);
  assert.equal(hosts.getSubjects().filter(host => host.form.portfolio === 'ding').length, grade.volumeCount);
  assert.equal(new Set(hosts.getSubjects().map(host => host.id)).size, grade.paintCount + grade.volumeCount);
  const snapshot = hosts.exportRuntimeState(); assert(validateHostRuntimeSnapshot(snapshot, world.layout.contaminationDraw));
  assert(hosts.validateRuntimeState(snapshot)); hosts.restoreRuntimeState(snapshot);
  const volumePositions = hosts.getSubjects().filter(host => host.form.portfolio === 'ding').map(host => `${host.position.x},${host.position.y}`);
  assert.equal(new Set(volumePositions).size, grade.volumeCount, 'volume hosts must use different authored seats');
  placement.push({ id: definition.id, seed, paintCount: forms.length, volumeCount: volumePositions.length,
    paintContactAreaPx: world.pollution.paintAreaPx, volumeBoundsAreaPx: world.pollution.volumeAreaPx });
  hosts.destroy(); chaos.destroy();
}
for (const family of ['folded-slab', 'fibre-knot', 'broken-shell']) for (const seed of [20261002, 20261003]) {
  const grades = ['low', 'medium', 'severe'].map(grade => placement.find(row => row.id === `${family}-${grade}` && row.seed === seed)!);
  assert(grades[0]!.paintContactAreaPx < grades[1]!.paintContactAreaPx && grades[1]!.paintContactAreaPx < grades[2]!.paintContactAreaPx);
  assert(grades[0]!.volumeBoundsAreaPx < grades[1]!.volumeBoundsAreaPx && grades[1]!.volumeBoundsAreaPx < grades[2]!.volumeBoundsAreaPx);
}
console.log(JSON.stringify({ status: 'pass', scope: 'native DEV grades only; 18 actual Host admissions, full paint support, safe routes, chaos frames/pause/resistance/chase/resume; not visual or player approval', exposure, placement }, null, 2));
