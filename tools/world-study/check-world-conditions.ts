import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORLD_CONDITION_PROGRAMS } from '../../src/generated/rift-world-conditions-data';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { SPACE_PROFILES, validateSpaceProfile } from '../../src/generation/world-study/space-profile';
import { validateSurfaceRecipe } from '../../src/generation/world-study/surface-field';
import { applyWorldConditions, compileWorldConditions, validWorldConditions, worldConditionCompatibility,
  worldConditionStreams, worldCapabilities, WORLD_CONDITION_LIMITS,
  worldOrganizationOf,
  type ResolvedWorldConditions, type WorldConditionProgram, type WorldConditionRangeKey } from '../../src/generation/world-study/world-conditions';
// @ts-ignore Node-only CSV compiler, deliberately separate from shipped runtime.
import { CONDITION_RANGE_LIMITS, generateWorldConditions, parseWorldConditionCsv } from './codegen-world-conditions.mjs';
import { generateWorldSample } from '../../src/generation/world-study/layout';
import { erodeOpenLand } from '../../src/generation/world-study/open-space';
import { SeededRandom } from '../../src/utils/random';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const profile = WORLD_PROFILES[0]!, space = SPACE_PROFILES[0]!, program = WORLD_CONDITION_PROGRAMS[0]!;
const base = compileWorldConditions(1002007, profile, space);
const checks: string[] = [];
function check(name: string, body: () => void): void { body(); checks.push(name); }

check('CSV parity, bounded compiler schema and unsupported input rejection', () => {
  generateWorldConditions({ check: true });
  assert.deepEqual(WORLD_CONDITION_LIMITS, CONDITION_RANGE_LIMITS);
  const csv = readFileSync('data/rift-world-conditions.csv', 'utf8');
  assert.equal(parseWorldConditionCsv(csv).length, 3);
  assert.throws(() => parseWorldConditionCsv(csv.replace('strength_min', 'strength_lo')));
  assert.throws(() => parseWorldConditionCsv(csv.replace('surface:strata;', 'water:refraction;')));
  assert.throws(() => parseWorldConditionCsv(csv.replace('0.30,0.65', '0.90,0.20')));
  assert.throws(() => parseWorldConditionCsv(csv.replace('320,384', '0,0')));
  assert.throws(() => parseWorldConditionCsv(csv.replace('0.08,0.08', '0.18,0.18')));
  assert.throws(() => parseWorldConditionCsv(csv + csv.split('\n')[1] + '\n'));
});
check('Frozen repeatable snapshot and no mutation of base recipes', () => {
  const before = JSON.stringify({ profile, space });
  assert.deepEqual(base, compileWorldConditions(1002007, profile, space));
  assert.ok(Object.isFrozen(base) && Object.isFrozen(base.parameters) && Object.isFrozen(base.scenery.motion));
  const restored = clone(base);
  assert.ok(validWorldConditions(restored));
  assert.deepEqual(applyWorldConditions(profile, space, base), applyWorldConditions(profile, space, restored));
  assert.equal(JSON.stringify({ profile, space }), before);
});
check('Named random streams and cosmetic changes do not affect gameplay selections', () => {
  assert.equal(new Set(Object.values(base.streams)).size, 6);
  assert.deepEqual(base.streams, worldConditionStreams(1002007));
  const changed = clone(program) as { -readonly [K in keyof WorldConditionProgram]: WorldConditionProgram[K] };
  changed.ranges = { ...changed.ranges, motionAmplitude: [0, 0], motionPeriodSeconds: [25, 25] };
  const original = compileWorldConditions(123, profile, space, { programs: [program] });
  const cosmetic = compileWorldConditions(123, profile, space, { programs: [changed] });
  assert.deepEqual(original.parameters, cosmetic.parameters);
  assert.deepEqual(original.semantic, cosmetic.semantic);
  assert.deepEqual(original.streams, cosmetic.streams);
  assert.deepEqual(applyWorldConditions(profile, space, original), applyWorldConditions(profile, space, cosmetic));
  assert.notDeepEqual(original.scenery.motion, cosmetic.scenery.motion);
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('Global gameplay random stream consumed'); };
    assert.deepEqual(original, compileWorldConditions(123, profile, space, { programs: [program] }));
  } finally { Math.random = random; }
});
check('Selection and operators are independent of world/space IDs', () => {
  const anonymous = { ...profile, id: 'anonymous-world', label: '匿名' };
  const anonymousSpace = { ...space, id: 'anonymous-space', label: '匿名空间' };
  assert.deepEqual(base, compileWorldConditions(1002007, anonymous, anonymousSpace));
  const first = applyWorldConditions(profile, space, base), second = applyWorldConditions(anonymous, anonymousSpace, base);
  assert.deepEqual(first.profile.surface, second.profile.surface);
  const { id: _a, label: _b, ...geometry } = first.space;
  const { id: _c, label: _d, ...otherGeometry } = second.space;
  assert.deepEqual(geometry, otherGeometry);
});
check('Required any-of capabilities, conflicts and missing modules reject explicitly', () => {
  const capabilities = worldCapabilities(profile, space);
  assert.ok(worldConditionCompatibility({ requiredCapabilities: ['surface:crystal|surface:strata'], excludedCapabilities: [] }, capabilities).compatible);
  assert.deepEqual(worldConditionCompatibility({ requiredCapabilities: ['surface:crystal'], excludedCapabilities: ['support:single-plane'] }, capabilities),
    { compatible: false, missing: ['surface:crystal'], conflicts: ['support:single-plane'] });
  assert.throws(() => compileWorldConditions(1, profile, space, { programs: [{ ...program, requiredCapabilities: ['space:multilevel'] }] }), /No compatible/);
  assert.throws(() => compileWorldConditions(1, profile, space, { programs: [{ ...program, requiredCapabilities: ['water:refraction'] }] }), /Unsupported/);
  assert.throws(() => compileWorldConditions(1, profile, space, { programId: 'not-installed' }));
  assert.throws(() => compileWorldConditions(1, profile, space, { programs: [{ ...program, ranges: { ...program.ranges, strength: [-1, 1] } }] }));
});
check('Snapshot corruption and unavailable geometry/semantic versions reject', () => {
  const mutations: ((value: any) => void)[] = [
    value => { value.version = 2; }, value => { value.programVersion = 2; }, value => { value.seed = -1; },
    value => { value.streams.layout ^= 1; }, value => { value.parameters.scale = NaN; },
    value => { value.semantic.sceneryBlocksMovement = true; }, value => { value.semantic.safeMaxThreat = 2; },
    value => { value.semantic.safeMaxThreat = .18; }, value => { value.semantic.minimumDeepDetourPx = 0; },
    value => { value.semantic.routeThreatPenalty = 0; },
    value => { value.scenery.scale += .1; }, value => { value.scenery.motion.amplitude = 4; },
    value => { value.requiredCapabilities = ['water:refraction']; }, value => { value.fallbackSeeds = [1, 1]; },
  ];
  for (const mutate of mutations) { const value = clone(base); mutate(value); assert.equal(validWorldConditions(value), false); }
  const wrongMaterial = clone(base) as any;
  wrongMaterial.scenery.kind = 'crystal-fan';
  assert.throws(() => applyWorldConditions(profile, space, wrongMaterial), /Scenery/);
  const frozenOldName = { ...clone(base), programId: 'retired-id-retained-in-snapshot', sourceHash: 'a'.repeat(64) };
  assert.ok(validWorldConditions(frozenOldName));
  assert.deepEqual(applyWorldConditions(profile, space, frozenOldName), applyWorldConditions(profile, space, base));
});
let cases = 0;
check('Every base recipe × rule × lower/upper interval endpoint stays within supported operators', () => {
  for (const world of WORLD_PROFILES) for (const room of SPACE_PROFILES) for (const row of WORLD_CONDITION_PROGRAMS) {
    for (const endpoint of [0, 1] as const) {
      const ranges = Object.fromEntries(Object.entries(row.ranges).map(([key, range]) => [key, [range[endpoint], range[endpoint]]])) as WorldConditionProgram['ranges'];
      const conditions = compileWorldConditions(77, world, room, { programs: [{ ...row, ranges }] });
      const result = applyWorldConditions(world, room, conditions);
      validateSurfaceRecipe(result.profile.surface); validateSpaceProfile(result.space);
      assert.notDeepEqual(result.profile.surface, world.surface);
      assert.notDeepEqual(result.space, room);
      assert.equal(conditions.scenery.kind, world.surface.coating === 'crystal' ? 'crystal-fan' : world.surface.coating === 'glaze' ? 'glaze-basin' : 'strata-fold');
      cases++;
    }
  }
});
check('Continuous legal intervals generate more than static configuration choices', () => {
  const sampled = new Set<string>(), rules = new Set<string>();
  for (let seed = 0; seed < 256; seed++) {
    const conditions = compileWorldConditions(seed, profile, space);
    assert.ok(validWorldConditions(conditions));
    sampled.add(JSON.stringify(conditions.parameters)); rules.add(conditions.rule);
  }
  assert.equal(rules.size, 3);
  assert.ok(sampled.size > 240);
  for (const key of ['strength', 'coherence', 'scale'] satisfies WorldConditionRangeKey[]) {
    const changed = clone(base) as ResolvedWorldConditions & { parameters: Record<string, number>; scenery: { scale: number } };
    changed.parameters[key] = key === 'scale' ? 1.99 : base.parameters[key as keyof typeof base.parameters] > .5 ? .1 : .9;
    if (key === 'scale') changed.scenery.scale = changed.parameters[key]!;
    assert.notDeepEqual(applyWorldConditions(profile, space, changed), applyWorldConditions(profile, space, base));
  }
  const low = compileWorldConditions(99, profile, space, { programs: [{ ...program,
    ranges: { ...program.ranges, strength: [.1, .1], scale: [.5, .5] } }] });
  const high = compileWorldConditions(99, profile, space, { programs: [{ ...program,
    ranges: { ...program.ranges, strength: [.9, .9], scale: [2, 2] } }] });
  assert.ok(high.scenery.radiusPx > low.scenery.radiusPx && high.scenery.density > low.scenery.density,
    'Shared process strength/scale must change actual landmark dimensions/distribution, not only unused descriptors');
});
check('V2 terrain fractures and material/scenery fields share an actual axis', () => {
  const organization = worldOrganizationOf(base);
  assert.deepEqual(organization, worldOrganizationOf(clone(base)));
  const sample = generateWorldSample(profile, 'loops', 70421, space, { ...organization, coherence: 1 });
  assert.ok(sample.flowAngle.every(angle => Math.abs(angle - organization.axis) < 1e-6));
  const lessCoherent = generateWorldSample(profile, 'loops', 70421, space, { ...organization, coherence: 0 });
  assert.notDeepEqual(lessCoherent.flowAngle, sample.flowAngle);
  const directedSpace = { ...space, directionality: 1, crackFraction: 1 };
  const horizontal = erodeOpenLand(sample.land, sample.cols, sample.rows, new SeededRandom(1000), directedSpace, { axis: 0, coherence: 1 });
  const vertical = erodeOpenLand(sample.land, sample.cols, sample.rows, new SeededRandom(1000), directedSpace, { axis: Math.PI / 2, coherence: 1 });
  assert.notDeepEqual(horizontal.walls, vertical.walls);
  assert.throws(() => generateWorldSample(profile, 'loops', 70421, space, { axis: NaN, coherence: .5 }));
});
console.log(JSON.stringify({ passed: checks.length, checks, boundaryCases: cases, intervalSeeds: 256, source: 'CSV-backed conditional compiler; no production play claim' }, null, 2));
