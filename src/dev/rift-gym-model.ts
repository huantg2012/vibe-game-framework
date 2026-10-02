/** DEV admission and map selection; generation remains the production pipeline. */
import { WORLD_PRODUCTION_POOL } from '@/generated/rift-world-pool-data';
import { WORLD_CONDITION_PROGRAMS } from '@/generated/rift-world-conditions-data';
import { createWorldProductionMap, type WorldProductionMap } from '@/generation/world-study/production-map';
import { worldProfileById } from '@/generation/world-study/profiles';
import { SPACE_PROFILES } from '@/generation/world-study/space-profile';
import { compileWorldConditions, worldCapabilities, worldConditionCompatibility } from '@/generation/world-study/world-conditions';
import { TileGrid } from '@/systems/tile-grid';

/** Methods on WalkableMask are runtime objects, not structured-clone data. */
export type RiftGymMapWire = Omit<WorldProductionMap, 'layout'> & {
  readonly layout: Omit<WorldProductionMap['layout'], 'walkableMask'>;
};

export function serializeRiftGymMap(map: WorldProductionMap): RiftGymMapWire {
  const { walkableMask: _mask, ...layout } = map.layout;
  return { ...map, layout };
}

/** Rebuild only the grid adapter; never roll or generate this accepted map again. */
export function hydrateRiftGymMap(map: RiftGymMapWire): WorldProductionMap {
  return { ...map, layout: { ...map.layout, walkableMask: new TileGrid(map.layout.tileMap) } };
}

export interface RiftGymSelection {
  readonly world: string;
  readonly space: string;
  readonly program: string;
  readonly seed: number;
}

export interface RiftGymCombination {
  readonly key: string;
  readonly world: string;
  readonly space: string;
  readonly program: string;
  readonly worldLabel: string;
  readonly spaceLabel: string;
  readonly programLabel: string;
  readonly contentFragmentTypeId: string;
}

/** CSV ordering is the browsing order; weights affect production draws, not coverage. */
export const RIFT_GYM_COMBINATIONS: readonly RiftGymCombination[] = Object.freeze(
  WORLD_PRODUCTION_POOL.filter(row => row.enabled).flatMap(row => {
    const world = worldProfileById(row.profileId);
    const space = SPACE_PROFILES.find(candidate => candidate.id === row.spaceId);
    if (!space) throw new Error(`Rift gym: missing production space ${row.spaceId}`);
    const capabilities = worldCapabilities(world, space);
    return WORLD_CONDITION_PROGRAMS.filter(program => program.enabled
      && worldConditionCompatibility(program, capabilities).compatible).map(program => Object.freeze({
      key: `${world.id}:${space.id}:${program.id}`,
      world: world.id, space: space.id, program: program.id,
      worldLabel: world.label, spaceLabel: space.label, programLabel: program.label,
      contentFragmentTypeId: row.contentFragmentTypeId,
    }));
  }),
);

if (!RIFT_GYM_COMBINATIONS.length) throw new Error('Rift gym: no compatible production combinations');
if (new Set(RIFT_GYM_COMBINATIONS.map(combination => combination.key)).size !== RIFT_GYM_COMBINATIONS.length)
  throw new Error('Rift gym: ambiguous duplicate production combinations');

const SELECTION_KEYS = ['world', 'space', 'program'] as const;
const DEFAULT_SEED = 20261002;

function validateSeed(seed: number): void {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('种子必须是 0–4294967295 之间的整数。');
}

export function riftGymCombination(selection: RiftGymSelection): RiftGymCombination {
  validateSeed(selection.seed);
  const combination = RIFT_GYM_COMBINATIONS.find(candidate =>
    SELECTION_KEYS.every(key => candidate[key] === selection[key]));
  if (!combination) throw new Error(`未启用或不兼容的组合：${selection.world} / ${selection.space} / ${selection.program}`);
  return combination;
}

/** Explicit invalid/ambiguous parameters fail rather than silently showing another map. */
export function readRiftGymSelection(params: URLSearchParams): RiftGymSelection {
  for (const key of [...SELECTION_KEYS, 'seed']) {
    if (params.getAll(key).length > 1) throw new Error(`参数 ${key} 不能重复。`);
  }
  const combination = RIFT_GYM_COMBINATIONS.find(candidate =>
    SELECTION_KEYS.every(key => !params.has(key) || params.get(key) === candidate[key]));
  if (!combination) throw new Error('指定的世界、空间或生成过程未启用，或不兼容。');
  const seedText = params.get('seed');
  if (seedText !== null && !/^\d+$/.test(seedText)) throw new Error('种子必须填写十进制非负整数。');
  const seed = seedText === null ? DEFAULT_SEED : Number(seedText);
  validateSeed(seed);
  return { world: combination.world, space: combination.space, program: combination.program, seed };
}

/** No leading question mark, so callers may combine with their own route. */
export function riftGymQuery(selection: RiftGymSelection): string {
  riftGymCombination(selection);
  return new URLSearchParams({ world: selection.world, space: selection.space,
    program: selection.program, seed: String(selection.seed) }).toString();
}

export function createRiftGymMap(selection: RiftGymSelection): WorldProductionMap {
  const combination = riftGymCombination(selection);
  const profile = worldProfileById(combination.world);
  const space = SPACE_PROFILES.find(candidate => candidate.id === combination.space)!;
  const conditions = compileWorldConditions(selection.seed, profile, space, { programId: combination.program });
  return createWorldProductionMap(profile, space, selection.seed, {
    contentFragmentTypeId: combination.contentFragmentTypeId,
    paintGeometryVersion: 2, generationVersion: 2, conditions, fallbackSeeds: conditions.fallbackSeeds,
  });
}
