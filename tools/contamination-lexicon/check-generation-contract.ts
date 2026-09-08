import { doorwayWallSeats } from '../../src/generation/wall-host-placement';
import { TileGrid } from '../../src/systems/tile-grid';
import { wallAttachForTile } from '../../src/generation/wall-edge-path';
import { hasLineOfSight } from '../../src/utils/grid-raycast';
/** I18: execute map responsibilities and CSV legality; compare unchanged placement to the captured I17 baseline. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { CONTAMINATION_DIALECT_DATA, FAMILY_CAPABILITY_DATA } from '../../src/generated/contamination-family-data.ts';
import { SUBSTRATE_DATA, PORTFOLIO_DATA } from '../../src/generated/contamination-lexicon-data.ts';
import { COVERAGES, drawOne, drawSortie, motionChoicesFor, rollPaintHostCount, supportsRuntimeForm } from '../../src/generation/contamination-draw.ts';
import { generateRiftLayout } from '../../src/generation/rift-layout.ts';
import { SeededRandom } from '../../src/utils/random.ts';
import type { EnemySpawnData } from '../../src/types/map-types.ts';
import type { ContaminationForm } from '../../src/generation/contamination-draw.ts';

const evidence = 'docs/qa/iteration-18-evidence/';
const baseline = JSON.parse(readFileSync(`${evidence}generation-before.json`, 'utf8')) as {
  layouts: { inputSeed: number; layoutSeed: number; fragmentTypeId: string; forms: ContaminationForm[]; spawns: EnemySpawnData[] }[];
};
const pickPlacement = (spawn: EnemySpawnData) => ({ id: spawn.id, spawn: spawn.spawn, facing: spawn.facing, patrol: spawn.patrol });
const count = (forms: readonly ContaminationForm[], motion: string) => forms.filter((f) => f.occupancy === 'floor' && f.lexemes.motion === motion).length;
const morphologyBehaviorKey = (f: ContaminationForm) => JSON.stringify([
  f.substrate, f.portfolio, f.occupancy, f.coverage, f.continuity,
  f.lexemes.motion, f.lexemes.sense, f.lexemes.rhythm, f.lexemes.contact,
]);
const formKey = (f: ContaminationForm) => JSON.stringify([morphologyBehaviorKey(f), f.utteranceId ?? null]);
const behaviorKey = (f: ContaminationForm) => JSON.stringify([f.portfolio, f.lexemes.motion, f.lexemes.sense, f.lexemes.rhythm, f.lexemes.contact]);
function sampleStatistics(rows: readonly { forms: readonly ContaminationForm[] }[]) {
  const forms = rows.flatMap((row) => row.forms);
  return {
    uniqueMorphologyBehaviorForms: new Set(forms.map(morphologyBehaviorKey)).size,
    uniqueIdentityForms: new Set(forms.map(formKey)).size,
    behaviorKeys: new Set(forms.map(behaviorKey)).size,
  };
}
function theoreticalStatistics() {
  let theoreticalCandidateForms = 0, theoreticalProductionRoleForms = 0;
  for (const family of FAMILY_CAPABILITY_DATA) {
    const sub = SUBSTRATE_DATA[family.substrate]!;
    const port = PORTFOLIO_DATA[family.portfolio];
    if (sub.enabledScope !== 'sortie' || !Object.values(CONTAMINATION_DIALECT_DATA).some((d) => d.substrates.some(([id, w]) => id === sub.id && w > 0))) continue;
    for (const coverage of COVERAGES) for (const continuity of sub.legalContinuities.filter((c) => port.legalContinuities.includes(c)))
      for (const motion of motionChoicesFor(sub.id, family.portfolio, coverage)) for (const sense of family.sense)
        for (const rhythm of family.rhythm) for (const contact of family.contact) {
          const form: ContaminationForm = { substrate: sub.id, portfolio: family.portfolio, occupancy: port.occupancy, coverage, continuity, lexemes: { motion, sense, rhythm, contact } };
          assert(supportsRuntimeForm(form));
          theoreticalCandidateForms++;
          // The only hearing floor slot is patrol-only; other floor duties forbid hearing.
          if (family.portfolio !== 'jia' || sense !== 'sense_hear' || motion === 'motion_patrol') theoreticalProductionRoleForms++;
        }
  }
  return { theoreticalCandidateForms, theoreticalProductionRoleForms };
}
const countDefinitions = {
  uniqueMorphologyBehaviorForms: 'substrate + portfolio + occupancy + coverage + continuity + motion/sense/rhythm/contact; excludes seed, model variants and utteranceId',
  uniqueIdentityForms: 'same full key plus utteranceId; named aliases count separately',
  behaviorKeys: 'portfolio + motion/sense/rhythm/contact; excludes substrate, coverage, continuity, seed and aliases',
  theoreticalCandidateForms: 'current positive-weight sortie alphabet after capability and low-coverage locks; excludes seed, variants and aliases',
  theoreticalProductionRoleForms: 'individual forms assignable to current encounter duties; floor hearing requires patrol; does not count whole-map arrangements',
};
const baselineStatistics = sampleStatistics(baseline.layouts);
Object.assign(baseline, baselineStatistics, { countDefinitions });
writeFileSync(`${evidence}generation-before.json`, JSON.stringify(baseline, null, 2) + '\n');
if (process.argv.includes('--stats-only')) {
  const previous = JSON.parse(readFileSync(`${evidence}generation-after.json`, 'utf8'));
  Object.assign(previous, sampleStatistics(previous.layouts), theoreticalStatistics(), { beforeStatistics: baselineStatistics, countDefinitions });
  writeFileSync(`${evidence}generation-after.json`, JSON.stringify(previous, null, 2) + '\n');
  console.log(JSON.stringify({ before: baselineStatistics, after: sampleStatistics(previous.layouts), ...theoreticalStatistics() }, null, 2));
  process.exit(0);
}
// R3 architectural legality is checked independently from the generated sample.
const broadWall = { tiles: Array.from({ length: 5 }, (_, i) => ({ col: i + 1, row: 1 })),
  strikeFloors: Array.from({ length: 5 }, (_, i) => ({ col: i + 1, row: 2 })) };
const broadRoom = { cols: 9, rows: 9, tileSize: 32, version: 0,
  isOpaque: (_col: number, row: number) => row <= 1 || row >= 8 };
assert.equal(doorwayWallSeats([broadWall], broadRoom).length, 0, 'flat uninterrupted wall is not an architectural opening');
const endWall = { ...broadWall, strikeFloors: [...broadWall.strikeFloors, { col: 6, row: 1 }, { col: 6, row: 2 }] };
assert(doorwayWallSeats([endWall], { ...broadRoom, isOpaque: (col, row) => row >= 8 || row <= 1 && col <= 5 }).some(seat => seat.tiles[0]!.col === 5), 'wall end has a real floor approach around its jamb');
for (let seed = 1; seed <= 128; seed++) {
  const draw = drawSortie(new SeededRandom(seed), { fragmentTypeId: 'frag-library', paintCount: 3,
    hasWallEdges: true, hasWallOpenings: false, hasCorridors: false });
  assert(!draw.forms.some(form => form.portfolio === 'yi' || form.portfolio === 'ding'), 'missing corridor cannot revive retired wall hosts');
  assert(!draw.forms.some(form => form.substrate === 'doorframe'), 'no arbitrary-wall frame fallback');
  assert.equal(draw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
}
for (const fragmentTypeId of Object.keys(CONTAMINATION_DIALECT_DATA)) {
  for (const substrate of ['doorframe', 'wall_rust', 'light_scatter', 'space_interval']) {
    const portfolio = substrate === 'doorframe' || substrate === 'wall_rust' ? 'yi' : 'ding';
    assert.equal(drawOne(new SeededRandom(7), { fragmentTypeId, portfolio, substrate, preferUtterance: true }), null,
      `${fragmentTypeId}/${substrate}: named recipe must not revive retired production content`);
  }
}
const counts: Record<string, { maps: number; floor: number; moving: number; beforeMoving: number; sub: Record<string, number>; coverage: Record<string, number> }> = {};
const unique = new Set<string>();
const hearing = { wall: 0, floor: 0 };
const senses: Record<string, number> = {}, rhythms: Record<string, number> = {};
const layouts = [];
let rejectedConflicts = 0;
assert.equal(drawOne(new SeededRandom(1), { portfolio: 'jia', substrate: 'lamp_pillar', fragmentTypeId: 'frag-clinic', coverage: 'infiltrate', scope: 'gym' })?.substrate, 'lamp_pillar', 'explicit gym inspection retains full substrate scope');
for (const [fragmentTypeId, dialect] of Object.entries(CONTAMINATION_DIALECT_DATA)) {
  for (const [substrate, weight] of dialect.substrates) {
    for (const family of FAMILY_CAPABILITY_DATA.filter((f) => f.substrate === substrate)) {
      for (const coverage of COVERAGES) {
        const options = { portfolio: family.portfolio, fragmentTypeId, substrate, coverage };
        if (weight === 0) {
          assert.equal(drawOne(new SeededRandom(1), options), null, `forbidden map/substrate ${fragmentTypeId}/${substrate}`);
          continue;
        }
        for (const motion of family.motion) {
          const result = drawOne(new SeededRandom(7), { ...options, motion });
          const allowed = motionChoicesFor(substrate, family.portfolio, coverage).includes(motion);
          assert.equal(!!result, allowed, `motion capability ${JSON.stringify(options)}/${motion}`);
          if (result) { assert.equal(result.lexemes.motion, motion); assert(supportsRuntimeForm(result)); }
          else rejectedConflicts++;
        }
        for (const rhythm of family.rhythm) {
          const form = drawOne(new SeededRandom(8), { ...options, rhythm });
          assert(form && form.lexemes.rhythm === rhythm, 'explicit rhythm must be selected before drawing');
          assert.equal(drawOne(new SeededRandom(8), { ...options, rhythm, forbidRhythm: [rhythm], preferUtterance: true }), null);
        }
        const impossible = drawOne(new SeededRandom(3), { ...options, motion: family.infiltrateMotion, forbidMotion: [family.infiltrateMotion], preferUtterance: true });
        assert.equal(impossible, null, 'named recipe cannot bypass conflicting motion filters');
      }
    }
  }
}
for (const before of baseline.layouts) {
  const layout = generateRiftLayout(before.inputSeed);
  const forms = layout.contaminationDraw.forms;
  assert.equal(layout.seed, before.layoutSeed);
  assert.equal(layout.fragmentTypeId, before.fragmentTypeId);
  assert.deepEqual(layout.enemySpawns.map(pickPlacement), before.spawns.map(pickPlacement), 'original IDs/spawn positions/facing/patrol paths preserved; hearing role type may move to wall');
  assert.equal(layout.contaminationDraw.warnings.length, 0);
  assert.equal(forms.filter((f) => f.lexemes.sense === 'sense_hear').length, 1);
  assert.equal(layout.enemySpawns.length >= 3 && layout.enemySpawns.length <= 4, true);
  assert(count(forms, 'motion_turn') + count(forms, 'motion_anchor') <= 1);
  assert.equal(layout.enemySpawns[0]!.form!.coverage, 'infiltrate');
  assert.equal(layout.enemySpawns[0]!.form!.lexemes.sense, 'sense_cone');
  assert.equal(layout.enemySpawns[0]!.form!.lexemes.motion, 'motion_patrol');
  assert.equal(layout.enemySpawns[0]!.form!.lexemes.rhythm, 'rhythm_open');
  for (const enemy of layout.enemySpawns.filter((e) => e.form!.lexemes.sense === 'sense_hear')) assert.equal(enemy.form!.lexemes.motion, 'motion_patrol');
  assert.equal(layout.enemySpawns.filter((e) => e.type === 'rewriter').length, forms.some((f) => f.occupancy === 'wall' && f.lexemes.sense === 'sense_hear') ? 0 : 1);
  const paint = forms.filter((f) => f.occupancy === 'paint');
  assert.equal(paint.length, rollPaintHostCount(layout.seed, layout.contaminationAge));
  assert.equal(new Set(paint.map(formKey)).size, 1);
  assert.equal(forms.filter((f) => f.occupancy === 'wall').length, 0);
  assert.equal(forms.filter((f) => f.occupancy === 'volume').length, 1);
  assert(forms.filter(f => f.occupancy === 'volume').every(f => ['sound_echo', 'gas_mass', 'mist_bank', 'dust_swarm'].includes(f.substrate)));
  assert.equal(layout.enemySpawns.filter(e => e.form!.lexemes.sense === 'sense_hear').length, 1);
  for (const form of forms) {
    assert(supportsRuntimeForm(form), formKey(form));
    assert(CONTAMINATION_DIALECT_DATA[layout.fragmentTypeId]!.substrates.some(([id, w]) => id === form.substrate && w > 0));
    unique.add(formKey(form));
    senses[form.lexemes.sense] = (senses[form.lexemes.sense] ?? 0) + 1;
    rhythms[form.lexemes.rhythm] = (rhythms[form.lexemes.rhythm] ?? 0) + 1;
    if (form.lexemes.sense === 'sense_hear') hearing[form.occupancy === 'wall' ? 'wall' : 'floor']++;
  }
  const { cols, rows } = layout.walkableMask;
  const reached = new Set<number>();
  const spawn = { col: Math.floor(layout.spawnPoint.x / layout.tileMap.tileSize), row: Math.floor(layout.spawnPoint.y / layout.tileMap.tileSize) };
  const stack = [spawn.row * cols + spawn.col];
  reached.add(stack[0]!);
  while (stack.length) {
    const current = stack.pop()!;
    const col = current % cols, row = Math.floor(current / cols);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = col + dx!, y = row + dy!;
      const key = y * cols + x;
      if (x >= 0 && x < cols && y >= 0 && y < rows && !reached.has(key) && layout.walkableMask.isWalkable(x, y)) { reached.add(key); stack.push(key); }
    }
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (layout.walkableMask.isWalkable(col, row)) assert(reached.has(row * cols + col), `seed ${before.inputSeed}: disconnected tile`);
  }
  for (const form of forms) {
    assert(!['street_wreckage', 'doorframe', 'wall_rust', 'light_scatter', 'space_interval'].includes(form.substrate), 'retired substrate cannot return');
    if (form.substrate === 'doorframe') {
      assert.equal(form.occupancy, 'wall');
      assert.equal(form.lexemes.motion, 'motion_anchor');
      const seats = doorwayWallSeats(layout.contaminationPins.wallEdges, new TileGrid(layout.tileMap));
      assert(seats.length > 0, `seed ${before.inputSeed}: frame requires real architectural seat`);
      for (const seat of seats) {
        const floor = seat.strikeFloors[0]!;
        assert(reached.has(floor.row * cols + floor.col), 'exposed core approach is reachable');
        const pin = wallAttachForTile(seat.tiles[0]!, seat.strikeFloors, 32);
        assert(hasLineOfSight(new TileGrid(layout.tileMap), { x: floor.col * 32 + 16, y: floor.row * 32 + 16 },
          { x: pin.seamX + pin.nx * 0.5, y: pin.seamY + pin.ny * 0.5 }), 'approach can hit exposed core');
      }
    }
  }
  for (const enemy of layout.enemySpawns) for (const waypoint of enemy.patrol.waypoints) assert(reached.has(waypoint.row * cols + waypoint.col));
  const stats = counts[layout.fragmentTypeId] ??= { maps: 0, floor: 0, moving: 0, beforeMoving: 0, sub: {}, coverage: {} };
  stats.maps++; stats.floor += layout.enemySpawns.length; stats.moving += count(forms, 'motion_patrol'); stats.beforeMoving += count(before.forms, 'motion_patrol');
  for (const enemy of layout.enemySpawns) { const f = enemy.form!; stats.sub[f.substrate] = (stats.sub[f.substrate] ?? 0) + 1; stats.coverage[f.coverage] = (stats.coverage[f.coverage] ?? 0) + 1; }
  layouts.push({ inputSeed: before.inputSeed, layoutSeed: layout.seed, fragmentTypeId: layout.fragmentTypeId, forms, spawns: layout.enemySpawns });
}
const moving = Object.values(counts).reduce((n, s) => n + s.moving, 0), beforeMoving = Object.values(counts).reduce((n, s) => n + s.beforeMoving, 0);
const report = { maps: layouts.length, movingBefore: beforeMoving, movingAfter: moving, movingMeanBefore: beforeMoving / layouts.length, movingMeanAfter: moving / layouts.length, uniqueForms: unique.size, ...sampleStatistics(layouts), ...theoreticalStatistics(), beforeStatistics: baselineStatistics, countDefinitions, hearing, senses, rhythms, rejectedConflicts, placementUnchanged: true, connected: true, quotasPreserved: true, counts, alwaysOpenPatrols: layouts.reduce((n, row) => n + row.forms.filter((f) => f.occupancy === 'floor' && f.lexemes.motion === 'motion_patrol' && f.lexemes.rhythm === 'rhythm_open').length, 0), note: 'moving counts mean patrol-capable bodies, not instantaneous movement during sleep/pulse. Every map has at least one open patrol. Counts are combinations, not independent species; difficulty and movement duty cycle require actual play review.', layouts };
writeFileSync(`${evidence}generation-after.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report, layouts: undefined }, null, 2));
