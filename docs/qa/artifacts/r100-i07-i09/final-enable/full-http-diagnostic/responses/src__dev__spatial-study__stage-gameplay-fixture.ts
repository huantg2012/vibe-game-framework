import { STAGE_GAMEPLAY_GROUND, STAGE_GAMEPLAY_OPENINGS, STAGE_GAMEPLAY_PLACEMENTS,
  STAGE_GAMEPLAY_SCENES, STAGE_GAMEPLAY_WATER } from '@/generated/stage-gameplay-data';
import { supportsRuntimeForm } from '@/generation/contamination-draw';
import type { GeneratedRiftLayout } from '@/generation/types';
import { SpatialSliceWorld, type SpatialSliceData, type SpatialSliceMode } from './slice-world';

export type StageGameplayRoute = 'long' | 'local';
export type StageGameplayLoadout = 'bare' | 'melee' | 'light';
export interface SpatialSliceRunOptions {
  readonly view: SpatialSliceMode;
  readonly route: StageGameplayRoute;
  readonly loadout: StageGameplayLoadout;
  readonly seed: number;
}

export const STAGE_GAMEPLAY_DATA: SpatialSliceData = {
  scene: STAGE_GAMEPLAY_SCENES[0], water: STAGE_GAMEPLAY_WATER[0],
  placements: STAGE_GAMEPLAY_PLACEMENTS, openings: STAGE_GAMEPLAY_OPENINGS, ground: STAGE_GAMEPLAY_GROUND,
};

/** URL and form controls share one admission boundary. A typo cannot silently
 * start a different route or present an unsupported loadout as working. */
export function resolveSpatialSliceOptions(values: {
  view?: string | null; route?: string | null; loadout?: string | null; seed?: string | null;
}): SpatialSliceRunOptions {
  const view = values.view ?? 'stage';
  if (view !== 'stage' && view !== 'vista') throw new Error(`未知空间呈现：${view}`);
  const route = values.route ?? (view === 'stage' ? 'long' : 'local');
  if (route !== 'long' && route !== 'local') throw new Error(`未知路线：${route}`);
  const loadout = values.loadout ?? 'bare';
  if (loadout !== 'bare' && loadout !== 'melee' && loadout !== 'light') throw new Error(`本批未支持此装备配置：${loadout}`);
  const seedText = values.seed ?? '7';
  const seed = seedText.trim() === '' ? NaN : Number(seedText);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子须为 0–4294967295 之间的整数');
  if (view === 'vista' && (route !== 'local' || loadout !== 'bare')) throw new Error('冻结的正俯视仅保留原局部路线和白板配置');
  return { view, route, loadout, seed };
}

/** The supported presentation range is deliberately smaller than the formal
 * enemy catalog. Never draw an unimplemented form as the nearest insect. */
export function assertStageVisualSupport(layout: GeneratedRiftLayout): void {
  for (const enemy of layout.enemySpawns) {
    const form = enemy.form;
    if (!form || !supportsRuntimeForm(form) || form.substrate !== 'insect_remnant'
      || form.coverage !== 'infiltrate' || form.portfolio !== 'jia' || form.occupancy !== 'floor') {
      throw new Error(`三维首包尚未支持敌人 ${enemy.id} 的形态；须完成呈现后才可部署`);
    }
  }
}

export function createStageGameplayWorld(seed: number): SpatialSliceWorld {
  const world = new SpatialSliceWorld(seed, STAGE_GAMEPLAY_DATA);
  assertStageVisualSupport(world.layout);
  const enemies = world.layout.enemySpawns;
  if (enemies.length !== 2 || enemies.filter(enemy => enemy.form?.lexemes.sense === 'sense_hear').length !== 1
    || enemies.filter(enemy => enemy.form?.lexemes.sense === 'sense_cone').length !== 1) {
    throw new Error('三维长路线要求一只听觉虫和一只视线虫');
  }
  if (world.layout.kindlingNodes.length + world.layout.contaminantNodes.length !== 3) {
    throw new Error('三维长路线要求三处可搜寻残堆');
  }
  return world;
}
