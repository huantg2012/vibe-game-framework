import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { FormAttachContext, FormVisual, FormVisualPose } from '@/gym/form-renderers/form-renderer';
import { BRIGHT_HEX, CORE_HEX, DEEP_HEX, EARTH_HEX, GLOW_HEX, MID_HEX, SHADOW_HEX } from '@/gym/form-renderers/a/colors';
import { recipeFromForm, rhythmPeriodMs, type FamilyId, type PixelRecipe } from '@/gym/form-renderers/a/recipe';

const TILE = GAME_CONSTANTS.TILE_SIZE;

function tileFill(family: FamilyId): number {
  switch (family) {
    case 'oil_film':
      return DEEP_HEX;
    case 'fungal_mat':
      return MID_HEX;
    case 'lamp_pillar':
      return EARTH_HEX;
    case 'doorframe':
      return SHADOW_HEX;
    case 'organic_remnant':
      return EARTH_HEX;
    default:
      return SHADOW_HEX;
  }
}

function skipTile(
  recipe: PixelRecipe,
  col: number,
  row: number,
  col0: number,
  row0: number,
  cols: number,
  rows: number,
): boolean {
  const lc = col - col0;
  const lr = row - row0;
  if (recipe.occupancy === 'wall') return lc !== 0 && lc !== cols - 1 && lr !== 0 && lr !== rows - 1;
  if (recipe.occupancy === 'floor') return lr < rows - 2;
  if (recipe.continuity === 'monolith') return lr < Math.floor(rows / 3) || lr > Math.ceil((rows * 2) / 3);
  if (recipe.continuity === 'shards') return lr === Math.floor(rows / 2);
  if (recipe.continuity === 'colony') return (lc + lr) % 2 === 0;
  if (recipe.family === 'oil_film') return lr % 2 === 1;
  if (recipe.family === 'doorframe') return lc !== 0 && lc !== cols - 1;
  if (recipe.fail === 0 && (lc + lr * 3) % 5 === 0) return true;
  return false;
}

class DingVisual implements FormVisual {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly recipe: PixelRecipe;
  private readonly col0: number;
  private readonly row0: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly period: number;
  private readonly depth: number;
  private clock = 0;

  constructor(ctx: FormAttachContext) {
    this.recipe = recipeFromForm(ctx.form, ctx.seed);
    this.period = rhythmPeriodMs(this.recipe.rhythm);
    this.depth = ctx.depth;
    const pin = ctx.pin;
    const rawC = Math.round((pin?.x ?? 0) / TILE);
    const rawR = Math.round((pin?.y ?? 0) / TILE);
    let cols = Math.max(1, Math.round((pin?.width ?? TILE * 2) / TILE));
    let rows = Math.max(1, Math.round((pin?.height ?? TILE * 2) / TILE));
    let col0 = rawC;
    let row0 = rawR;
    if (this.recipe.fail >= 1) {
      cols = Math.max(1, cols - 1);
      col0 += 1;
    }
    if (this.recipe.fail === 2 && rows > 1) {
      rows -= 1;
    }
    this.col0 = col0;
    this.row0 = row0;
    this.cols = cols;
    this.rows = rows;
    this.gfx = ctx.scene.add.graphics();
    this.gfx.setDepth(ctx.depth);
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    const t = (((this.clock % this.period) + this.period) % this.period) / this.period;
    const wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
    const awake = pose.signal === 'awake' || this.recipe.utterance === 'corridor_watching';
    const turbid = this.recipe.contact === 'contact_volume_chaos' ? 0.16 : 0;
    const base = (this.recipe.fail === 0 ? 0.22 : this.recipe.fail === 1 ? 0.32 : 0.42) + turbid;
    const alpha = Math.min(0.62, (awake ? base + 0.12 : base) + wave * 0.1);
    let ox = 0;
    let oy = 0;
    if (this.recipe.motion === 'motion_trail') ox = Math.round(Math.sin(t * Math.PI * 2) * 3);
    if (this.recipe.motion === 'motion_wind') {
      ox = Math.round(Math.sin(t * Math.PI * 2) * 2);
      oy = Math.round(Math.cos(t * Math.PI * 2));
    }
    this.gfx.clear();
    this.gfx.setDepth(this.depth);
    const fill = tileFill(this.recipe.family);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const col = this.col0 + c;
        const row = this.row0 + r;
        if (skipTile(this.recipe, col, row, this.col0, this.row0, this.cols, this.rows)) continue;
        const inset = this.recipe.family === 'oil_film' ? 4 : 2;
        const stagger = this.recipe.motion === 'motion_wind' ? (r % 2 === 0 ? ox : -ox) : ox;
        this.gfx.fillStyle(fill, alpha);
        this.gfx.fillRect(
          col * TILE + inset + stagger,
          row * TILE + inset + oy,
          TILE - inset * 2,
          TILE - inset * 2,
        );
      }
    }
    const coreSize =
      this.recipe.contact === 'contact_disperse_core' ? 1 : awake ? Math.max(2, coreSizeAwake(this.recipe, t)) : 2;
    const coreColor = awake ? (t > 0.5 ? BRIGHT_HEX : GLOW_HEX) : CORE_HEX;
    const scatter = this.recipe.contact === 'contact_disperse_core' ? 2 : 0;
    this.gfx.fillStyle(coreColor, 1);
    this.gfx.fillRect(Math.round(pose.x) - (coreSize >> 1) + scatter, Math.round(pose.y) - (coreSize >> 1), coreSize, coreSize);
    if (this.recipe.sense === 'sense_reverse' && !awake) {
      this.gfx.fillStyle(DEEP_HEX, 1);
      this.gfx.fillRect(Math.round(pose.x) - 3, Math.round(pose.y), 1, 1);
    }
    if (this.recipe.sense === 'sense_scent') {
      this.gfx.fillStyle(GLOW_HEX, 1);
      this.gfx.fillRect(Math.round(pose.x), Math.round(pose.y) - 6, 1, 1);
    }
    if (this.recipe.sense === 'sense_domain') {
      this.gfx.fillStyle(MID_HEX, 0.8);
      this.gfx.fillRect(Math.round(pose.x) - 4, Math.round(pose.y) - 4, 8, 8);
    }
    this.gfx.setAlpha(Math.max(0.25, pose.visibility));
    this.gfx.setRotation(0);
  }

  destroy(): void {
    this.gfx.destroy();
  }
}

function coreSizeAwake(recipe: PixelRecipe, t: number): number {
  if (recipe.utterance === 'corridor_watching') return t > 0.35 ? 3 : 2;
  return recipe.fail >= 2 ? 3 : 2;
}

export function attachDing(ctx: FormAttachContext): FormVisual {
  return new DingVisual(ctx);
}
