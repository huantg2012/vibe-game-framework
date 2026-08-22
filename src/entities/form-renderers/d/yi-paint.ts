/**
 * 方案 D 乙漆：钉在墙-地缝上的 1–3px 墙皮，核跟宿主走。
 * 不写 seamSlidePx，不把核画进墙格中央，不加碰撞。
 */
import type Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import { hash32, unit } from '@/entities/form-renderers/d/jia-pixels';
import { faceNormal, yiPeriodMs, type YiRecipe } from '@/entities/form-renderers/d/yi-recipe';

const TILE = GAME_CONSTANTS.TILE_SIZE;

export interface StrikeFloor {
  readonly col: number;
  readonly row: number;
}

function local(nx: number, ny: number, alongNormal: number, alongTangent: number): { x: number; y: number } {
  return {
    x: nx * alongNormal - ny * alongTangent,
    y: ny * alongNormal + nx * alongTangent,
  };
}

function dot(g: Phaser.GameObjects.Graphics, x: number, y: number, hex: number): void {
  g.fillStyle(hex, 1);
  g.fillRect(x, y, 1, 1);
}

function stainInk(recipe: YiRecipe, t: number, n: number, strike: boolean): number {
  const u = unit(recipe.seed, t * 13 + n * 7 + 3);
  if (n < 0) return u > 0.55 ? recipe.colors.wall : recipe.colors.remnant;
  if (n === 0) return strike || recipe.sense === 'sense_narrow' ? recipe.colors.glow : recipe.colors.mid;
  if (u > 0.62) return recipe.colors.deep;
  return recipe.colors.mid;
}

function extentOf(recipe: YiRecipe): number {
  if (recipe.continuity === 'field') return 10;
  if (recipe.utterance === 'eye_in_the_seam') return 7;
  return 6;
}

function gapHalf(recipe: YiRecipe, pulse: number): number {
  if (recipe.family !== 'doorframe') return -1;
  const open = recipe.rhythm === 'rhythm_sleep' ? 0.25 + pulse * 0.35 : 0.45 + pulse * 0.55;
  return 1 + Math.round(open * 2);
}

function coreSize(recipe: YiRecipe, pose: FormVisualPose): number {
  if (pose.signal === 'strike') return Math.min(4, Math.max(recipe.corePx, 3));
  return recipe.corePx;
}

/** 墙皮 + 核。原点 = 当前缝；(+nx,+ny) 走进走廊，不要画到墙格心。 */
export function paintYiSkin(
  g: Phaser.GameObjects.Graphics,
  recipe: YiRecipe,
  pose: FormVisualPose,
  elapsedMs: number,
  nx: number,
  ny: number,
): void {
  g.clear();
  const period = yiPeriodMs(recipe.rhythm);
  const phase = (((elapsedMs % period) + period) % period) / period;
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  const strike = pose.signal === 'strike';
  const thick = recipe.filmPx;
  const extent = extentOf(recipe);
  const gap = gapHalf(recipe, pulse);
  const shards = recipe.continuity === 'shards';

  for (let t = -extent; t <= extent; t++) {
    if (shards && t === 0) continue;
    const inOpening = gap >= 0 && Math.abs(t) <= gap;
    for (let n = -2; n <= thick; n++) {
      if (inOpening && n >= 0) {
        if (recipe.utterance === 'door_still_closing' && t === 0 && n === 0 && pulse > 0.35) {
          const p = local(nx, ny, 0, 0);
          dot(g, p.x, p.y, recipe.colors.metal);
        }
        continue;
      }
      if (recipe.family === 'doorframe') {
        const onJamb = gap >= 0 && (Math.abs(t) === gap + 1 || Math.abs(t) === gap + 2);
        if (!onJamb && n < 0 && Math.abs(t) > gap + 2) {
          if (unit(recipe.seed, t * 5 + 11) > 0.35) continue;
        }
        if (onJamb) {
          const p = local(nx, ny, n, t);
          dot(g, p.x, p.y, n < 0 ? recipe.colors.metal : recipe.colors.concrete);
          continue;
        }
        if (inOpening) continue;
      }
      if (recipe.family === 'wall_rust') {
        const hole = unit(recipe.seed, t * 17 + n * 9 + 2);
        if (n < 0 && hole < 0.38) continue;
        if (n > 0 && hole < 0.22) continue;
      }
      const p = local(nx, ny, n, t);
      dot(g, p.x, p.y, stainInk(recipe, t, n, strike));
    }
  }

  if (recipe.sense === 'sense_narrow' || recipe.utterance === 'eye_in_the_seam') {
    const extra = recipe.utterance === 'eye_in_the_seam' ? 1 : 0;
    const ink = strike ? recipe.colors.glow : recipe.colors.core;
    for (let t = -(extent + extra); t <= extent + extra; t++) {
      if (gap >= 0 && Math.abs(t) <= gap) continue;
      const p = local(nx, ny, 0, t);
      dot(g, p.x, p.y, ink);
    }
  }

  const size = coreSize(recipe, pose);
  const coreInk = strike ? recipe.colors.glow : recipe.colors.core;
  const mid = size >> 1;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const p = local(nx, ny, i, j - mid);
      dot(g, p.x, p.y, coreInk);
    }
  }

  if (recipe.continuity === 'colony' || recipe.continuity === 'field') {
    const satT = 8 + (hash32(recipe.seed, 91) % 3);
    const satSize = 2;
    for (let i = 0; i < satSize; i++) {
      for (let j = 0; j < satSize; j++) {
        const p = local(nx, ny, i, satT + j - 1);
        dot(g, p.x, p.y, recipe.colors.mid);
      }
    }
  }
}

/** 抽打格地心 1px 量化青点。钉地板，不钉墙格心，不加全息圈。 */
export function paintYiStrikeFloors(
  g: Phaser.GameObjects.Graphics,
  floors: readonly StrikeFloor[],
  hex: number,
): void {
  g.clear();
  g.fillStyle(hex, 1);
  for (const cell of floors) {
    g.fillRect(cell.col * TILE + (TILE >> 1), cell.row * TILE + (TILE >> 1), 1, 1);
  }
}

export function strikeFloorsFromPose(pose: FormVisualPose): StrikeFloor[] {
  const { nx, ny } = faceNormal(pose.facing4);
  const fx = pose.x + nx * (TILE / 2);
  const fy = pose.y + ny * (TILE / 2);
  return [{ col: Math.floor(fx / TILE), row: Math.floor(fy / TILE) }];
}
