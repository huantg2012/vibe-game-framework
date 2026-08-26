/**
 * 按覆盖档选画布。碰撞边长仍 20；画布变了只改偏移。
 * 听噪无论覆盖深度都至少 32×48。
 */
import { GAME_CONSTANTS } from '@/config/constants';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { GenomeCanvas } from '@/entities/form-renderers/d/genome/types';

export const GENOME_COLLISION_PX = GAME_CONSTANTS.AI.BODY_SIZE;

export function genomeCanvasOf(coverage: CoverageId, sense?: string): GenomeCanvas {
  const hear = sense === 'sense_hear';
  let w: 32 | 48 = 32;
  let h: 32 | 48 | 64 = 32;
  if (coverage === 'overwrite') {
    w = 48;
    h = 64;
  } else if (coverage === 'rewrite' || hear) {
    w = 32;
    h = 48;
  }
  const collision = 20 as const;
  if (GENOME_COLLISION_PX !== collision) {
    throw new Error(`genome collision must stay ${collision}, got ${GENOME_COLLISION_PX}`);
  }
  const offsetX = (w - collision) / 2;
  const offsetY = (h - collision) / 2;
  return {
    w,
    h,
    offsetX,
    originX: offsetX + collision / 2,
    offsetY,
    originY: offsetY + collision / 2,
    collision,
    coverage,
  };
}
