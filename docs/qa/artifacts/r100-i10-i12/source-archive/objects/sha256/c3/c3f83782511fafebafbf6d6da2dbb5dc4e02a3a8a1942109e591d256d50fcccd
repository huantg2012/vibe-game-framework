/** Bounded, capability-resolved world programs. Frozen data is sufficient for replay. */
import { WORLD_CONDITION_PROGRAMS, WORLD_CONDITIONS_SOURCE_HASH } from '@/generated/rift-world-conditions-data';
import { mix32 } from '@/generation/seed-fork';
import { compositionOf } from './region-field';
import { validateSurfaceRecipe } from './surface-field';
import { validateSpaceProfile, type SpaceProfile } from './space-profile';
import type { SurfaceRecipe, WorldProfile } from './types';
import type { WorldOrganization } from './open-space';

export type WorldRewriteRule = 'deposition' | 'fracture' | 'aggregation';
export type WorldSceneryKind = 'strata-fold' | 'crystal-fan' | 'glaze-basin';
export type WorldMotionKind = 'settle' | 'shear' | 'pulse';
export type WorldRandomStream = 'world' | 'layout' | 'material' | 'placement' | 'encounters' | 'motion';
export const WORLD_CONTESTED_MIN_THREAT = .18;
export interface WorldSemanticContract {
  /** Extra round-trip distance through a deep node versus the direct exit route. */
  readonly minimumDeepDetourPx: number;
  readonly safeMaxThreat: number;
  readonly routeThreatPenalty: number;
  readonly bodySizePx: 20;
  readonly supportStepPx: 8;
  readonly voidBlocksSight: true;
  readonly sceneryBlocksMovement: false;
}
export interface ResolvedWorldConditions {
  readonly version: 1;
  readonly programId: string;
  readonly programVersion: 1;
  readonly sourceHash: string;
  readonly seed: number;
  readonly rule: WorldRewriteRule;
  readonly requiredCapabilities: readonly string[];
  readonly excludedCapabilities: readonly string[];
  readonly parameters: { readonly strength: number; readonly coherence: number; readonly scale: number };
  readonly streams: Readonly<Record<WorldRandomStream, number>>;
  readonly semantic: WorldSemanticContract;
  readonly scenery: {
    readonly kind: WorldSceneryKind;
    readonly scale: number;
    readonly radiusPx: number;
    readonly density: number;
    readonly motion: { readonly kind: WorldMotionKind; readonly amplitude: number; readonly periodSeconds: number };
  };
  /** Candidate seeds, not a bypass of runtime admission or a claim of human approval. */
  readonly fallbackSeeds: readonly number[];
}
export type WorldConditionRangeKey = 'strength' | 'coherence' | 'scale' | 'minimumDeepDetourPx' | 'safeMaxThreat'
  | 'routeThreatPenalty' | 'sceneryRadiusPx' | 'sceneryDensity' | 'motionAmplitude' | 'motionPeriodSeconds';
export interface WorldConditionProgram {
  readonly id: string;
  readonly version: 1;
  readonly label: string;
  readonly rule: WorldRewriteRule;
  readonly weight: number;
  readonly enabled: boolean;
  /** Every semicolon clause must match; pipe alternatives are an any-of group. */
  readonly requiredCapabilities: readonly string[];
  readonly excludedCapabilities: readonly string[];
  readonly ranges: Readonly<Record<WorldConditionRangeKey, readonly [number, number]>>;
  readonly fallbackSeeds: readonly number[];
}

const STREAMS: readonly WorldRandomStream[] = ['world', 'layout', 'material', 'placement', 'encounters', 'motion'];
const RULES: readonly WorldRewriteRule[] = ['deposition', 'fracture', 'aggregation'];
export const WORLD_CONDITION_LIMITS: Readonly<Record<WorldConditionRangeKey, readonly [number, number]>> = {
  strength: [0, 1], coherence: [0, 1], scale: [.5, 2], minimumDeepDetourPx: [0, 2048],
  safeMaxThreat: [0, 1], routeThreatPenalty: [0, 64], sceneryRadiusPx: [32, 128],
  sceneryDensity: [0, 1], motionAmplitude: [0, 1.5], motionPeriodSeconds: [7, 30],
};
const CAPABILITIES = new Set(['surface:strata', 'surface:crystal', 'surface:glaze', 'field:direction',
  'support:single-plane', 'support:grid8', 'body:aabb20', 'void:opaque', 'organization:patches',
  'organization:bands', 'organization:clusters', 'collision:dynamic', 'space:multilevel']);
const UINT_MAX = 0xffffffff;
const uint = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= UINT_MAX;
const inRange = (value: unknown, min: number, max: number): value is number => typeof value === 'number'
  && Number.isFinite(value) && value >= min && value <= max;
const blend = (from: number, to: number, amount: number): number => from + (to - from) * amount;
const clauseValid = (value: unknown): value is string => typeof value === 'string' && value.length <= 200
  && value.split('|').every(capability => CAPABILITIES.has(capability));
function validClauses(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= 16 && new Set(value).size === value.length && value.every(clauseValid);
}
function validateProgram(program: WorldConditionProgram): void {
  if (program.version !== 1 || !RULES.includes(program.rule) || !/^[a-z][a-z0-9-]{0,79}$/.test(program.id)
    || typeof program.enabled !== 'boolean' || !inRange(program.weight, Number.MIN_VALUE, 1000)
    || !validClauses(program.requiredCapabilities) || !program.requiredCapabilities.length
    || !validClauses(program.excludedCapabilities) || !Array.isArray(program.fallbackSeeds)
    || !program.fallbackSeeds.length || program.fallbackSeeds.length > 32
    || !program.fallbackSeeds.every(uint) || new Set(program.fallbackSeeds).size !== program.fallbackSeeds.length)
    throw new Error('Unsupported world condition program/version/capability contract');
  for (const key of Object.keys(WORLD_CONDITION_LIMITS) as WorldConditionRangeKey[]) {
    const range = program.ranges[key], [min, max] = WORLD_CONDITION_LIMITS[key];
    if (!Array.isArray(range) || range.length !== 2 || !inRange(range[0], min, max)
      || !inRange(range[1], min, max) || range[0] > range[1]) throw new Error(`Unsupported world condition range ${key}`);
  }
  if (program.ranges.minimumDeepDetourPx[0] <= 0 || program.ranges.routeThreatPenalty[0] <= 0
    || program.ranges.safeMaxThreat[1] >= WORLD_CONTESTED_MIN_THREAT)
    throw new Error('World semantic ranges must retain positive detour/penalty and a safe/contested distinction');
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Individual streams/parameters never consume one another's random sequence. */
export function worldConditionStreams(seed: number): Readonly<Record<WorldRandomStream, number>> {
  if (!uint(seed)) throw new Error('Invalid world conditions seed');
  return Object.freeze(Object.fromEntries(STREAMS.map(name => [name, mix32(seed, `world-conditions-v1:${name}`)])) as Record<WorldRandomStream, number>);
}

/** V2 terrain tears, ground history and scenery all read this one frozen-process axis. */
export function worldOrganizationOf(conditions: ResolvedWorldConditions): WorldOrganization {
  if (!validWorldConditions(conditions)) throw new Error('Invalid world organization conditions');
  return Object.freeze({ axis: mix32(conditions.streams.world, 'organization-axis') / 0x100000000 * Math.PI,
    coherence: conditions.parameters.coherence });
}

export function worldCapabilities(profile: WorldProfile, space: SpaceProfile): ReadonlySet<string> {
  validateSurfaceRecipe(profile.surface); validateSpaceProfile(space);
  return new Set(['support:single-plane', 'support:grid8', 'body:aabb20', 'void:opaque', 'field:direction',
    'organization:patches', 'organization:bands', 'organization:clusters',
    `surface:${profile.surface.substrate}`, `surface:${profile.surface.coating}`]);
}

export function worldConditionCompatibility(program: Pick<WorldConditionProgram, 'requiredCapabilities' | 'excludedCapabilities'>,
  capabilities: ReadonlySet<string>): { compatible: boolean; missing: readonly string[]; conflicts: readonly string[] } {
  if (!validClauses(program.requiredCapabilities) || !validClauses(program.excludedCapabilities))
    throw new Error('Unsupported world capability clause');
  const matches = (clause: string): boolean => clause.split('|').some(capability => capabilities.has(capability));
  const missing = program.requiredCapabilities.filter(clause => !matches(clause));
  const conflicts = program.excludedCapabilities.filter(matches);
  return { compatible: !missing.length && !conflicts.length, missing, conflicts };
}

/** Optional forced program belongs to offline compilation, never a silent runtime fallback. */
export function compileWorldConditions(seed: number, profile: WorldProfile, space: SpaceProfile,
  options: { readonly programId?: string; readonly programs?: readonly WorldConditionProgram[]; readonly sourceHash?: string } = {}): ResolvedWorldConditions {
  const streams = worldConditionStreams(seed), capabilities = worldCapabilities(profile, space);
  const programs = options.programs ?? WORLD_CONDITION_PROGRAMS;
  programs.forEach(validateProgram);
  if (new Set(programs.map(program => program.id)).size !== programs.length) throw new Error('Duplicate world condition program');
  const compatible = programs.filter(row => row.enabled && worldConditionCompatibility(row, capabilities).compatible);
  let program: WorldConditionProgram | undefined;
  if (options.programId !== undefined) {
    program = compatible.find(row => row.id === options.programId);
    if (!program) throw new Error(`World condition program unavailable/incompatible: ${options.programId}`);
  } else {
    const total = compatible.reduce((sum, row) => sum + row.weight, 0);
    let ticket = streams.world / 0x100000000 * total;
    program = compatible.find(row => { ticket -= row.weight; return ticket < 0; });
  }
  if (!program) throw new Error('No compatible world condition program');
  const sample = (key: WorldConditionRangeKey, stream: WorldRandomStream): number => {
    const range = program.ranges[key];
    if (!range || !Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[0] > range[1])
      throw new Error(`Invalid world condition range ${key}`);
    return blend(range[0], range[1], mix32(streams[stream], `${program.id}:${key}`) / 0x100000000);
  };
  const coating = profile.surface.coating;
  const parameters = { strength: sample('strength', 'world'), coherence: sample('coherence', 'world'), scale: sample('scale', 'world') };
  // The process controls the landmarks as well as the material/erosion rewrite.
  // Independent local variation stays inside the CSV interval instead of replacing that causal relation.
  const radiusRange = program.ranges.sceneryRadiusPx, densityRange = program.ranges.sceneryDensity;
  const radiusPx = blend(sample('sceneryRadiusPx', 'material'),
    blend(radiusRange[0], radiusRange[1], (parameters.scale - .5) / 1.5), .65);
  const density = blend(sample('sceneryDensity', 'material'),
    blend(densityRange[0], densityRange[1], parameters.strength), .65);
  const conditions: ResolvedWorldConditions = {
    version: 1, programId: program.id, programVersion: 1,
    sourceHash: options.sourceHash ?? WORLD_CONDITIONS_SOURCE_HASH, seed, rule: program.rule,
    requiredCapabilities: [...program.requiredCapabilities], excludedCapabilities: [...program.excludedCapabilities],
    parameters,
    streams,
    semantic: { minimumDeepDetourPx: sample('minimumDeepDetourPx', 'placement'), safeMaxThreat: sample('safeMaxThreat', 'placement'),
      routeThreatPenalty: sample('routeThreatPenalty', 'placement'), bodySizePx: 20, supportStepPx: 8,
      voidBlocksSight: true, sceneryBlocksMovement: false },
    scenery: { kind: coating === 'crystal' ? 'crystal-fan' : coating === 'glaze' ? 'glaze-basin' : 'strata-fold',
      scale: parameters.scale, radiusPx, density,
      motion: { kind: program.rule === 'fracture' ? 'shear' : program.rule === 'aggregation' ? 'pulse' : 'settle',
        amplitude: sample('motionAmplitude', 'motion'), periodSeconds: sample('motionPeriodSeconds', 'motion') } },
    fallbackSeeds: [...program.fallbackSeeds],
  };
  if (!validWorldConditions(conditions)) throw new Error('Compiled world conditions violate supported capability bounds');
  // Exercise the same operator and strict postcondition that runtime and replay use.
  applyWorldConditions(profile, space, conditions);
  return freeze(conditions);
}

/** Structural/version contract deliberately does not re-read mutable CSV ranges or IDs. */
export function validWorldConditions(value: unknown): value is ResolvedWorldConditions {
  try {
    if (!value || typeof value !== 'object') return false;
    const c = value as ResolvedWorldConditions, p = c.parameters, s = c.semantic, v = c.scenery;
    const streams = worldConditionStreams(c.seed);
    if (c.version !== 1 || c.programVersion !== 1 || !uint(c.seed) || !RULES.includes(c.rule)
      || typeof c.programId !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(c.programId)
      || typeof c.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(c.sourceHash)
      || !validClauses(c.requiredCapabilities) || !c.requiredCapabilities.length || !validClauses(c.excludedCapabilities)
      || !p || !inRange(p.strength, 0, 1) || !inRange(p.coherence, 0, 1) || !inRange(p.scale, .5, 2)
      || !c.streams || !STREAMS.every(name => uint(c.streams[name]) && c.streams[name] === streams[name])
      || !s || s.bodySizePx !== 20 || s.supportStepPx !== 8 || s.voidBlocksSight !== true || s.sceneryBlocksMovement !== false
      || !inRange(s.minimumDeepDetourPx, 0, 2048) || !inRange(s.safeMaxThreat, 0, 1) || !inRange(s.routeThreatPenalty, 0, 64)
      || s.minimumDeepDetourPx <= 0 || s.routeThreatPenalty <= 0 || s.safeMaxThreat >= WORLD_CONTESTED_MIN_THREAT
      || !v || !['strata-fold', 'crystal-fan', 'glaze-basin'].includes(v.kind)
      || v.scale !== p.scale || !inRange(v.radiusPx, 32, 128) || !inRange(v.density, 0, 1)
      || !v.motion || v.motion.kind !== (c.rule === 'fracture' ? 'shear' : c.rule === 'aggregation' ? 'pulse' : 'settle')
      || !inRange(v.motion.amplitude, 0, 1.5) || !inRange(v.motion.periodSeconds, 7, 30)
      || !Array.isArray(c.fallbackSeeds) || !c.fallbackSeeds.length || c.fallbackSeeds.length > 32
      || new Set(c.fallbackSeeds).size !== c.fallbackSeeds.length || !c.fallbackSeeds.every(uint)) return false;
    return true;
  } catch { return false; }
}

/** Shared process algebra alters the same material/space capabilities for anonymous profiles. */
export function applyWorldConditions(profile: WorldProfile, space: SpaceProfile, conditions: ResolvedWorldConditions): {
  profile: WorldProfile; space: SpaceProfile;
} {
  if (!validWorldConditions(conditions)) throw new Error('Invalid frozen world conditions');
  const compatibility = worldConditionCompatibility(conditions, worldCapabilities(profile, space));
  if (!compatibility.compatible) throw new Error(`Incompatible world conditions: missing=${compatibility.missing.join(';')} conflicts=${compatibility.conflicts.join(';')}`);
  const expectedScenery = profile.surface.coating === 'crystal' ? 'crystal-fan'
    : profile.surface.coating === 'glaze' ? 'glaze-basin' : 'strata-fold';
  if (conditions.scenery.kind !== expectedScenery) throw new Error('Scenery does not match frozen surface capability');
  const base = profile.surface, composition = compositionOf(base), { strength: s, coherence: c, scale } = conditions.parameters;
  const common = { regionScale: blend(composition.regionScale, scale, .65), formScale: blend(composition.formScale, scale, .5) };
  const holeScale = blend(space.holeScale, .65 + (scale - .5) / 1.5 * .75, .35);
  let surface: SurfaceRecipe, nextSpace: SpaceProfile;
  if (conditions.rule === 'deposition') {
    surface = { ...base, ...common, organization: 'bands', deposits: blend(base.deposits, 1, s * .5),
      wear: blend(base.wear, 0, s * .25), quietness: blend(composition.quietness, .7, s * .4),
      fragmentation: blend(composition.fragmentation, 0, c * .5) };
    nextSpace = { ...space, holeScale, crackFraction: blend(space.crackFraction, 0, s * .55),
      directionality: blend(space.directionality, c, .6), clustering: blend(space.clustering, c, .3) };
  } else if (conditions.rule === 'fracture') {
    surface = { ...base, ...common, organization: 'bands', wear: blend(base.wear, 1, s * .45),
      coverage: blend(base.coverage, 0, s * .18), fragmentation: blend(composition.fragmentation, 1, s * .65),
      quietness: blend(composition.quietness, .4, s * .3) };
    nextSpace = { ...space, holeScale, crackFraction: blend(space.crackFraction, 1, s * .7),
      directionality: blend(space.directionality, c, .8), clustering: blend(space.clustering, 0, s * .3) };
  } else {
    surface = { ...base, ...common, organization: 'clusters', coverage: blend(base.coverage, 1, s * .25),
      deposits: blend(base.deposits, 1, s * .4), fragmentation: blend(composition.fragmentation, 0, c * .35),
      quietness: blend(composition.quietness, .75, s * .35) };
    nextSpace = { ...space, holeScale, crackFraction: blend(space.crackFraction, 0, s * .4),
      directionality: blend(space.directionality, c, .35), clustering: blend(space.clustering, 1, s * .65) };
  }
  validateSurfaceRecipe(surface); validateSpaceProfile(nextSpace);
  return { profile: { ...profile, palette: { ...profile.palette }, surface }, space: nextSpace };
}
