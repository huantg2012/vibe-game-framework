import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { FormAttachContext, FormVisual, FormVisualPose } from '@/gym/form-renderers/form-renderer';
import {
  BRICK,
  CONCRETE,
  CORE,
  DEEP,
  EARTH,
  GLOW,
  METAL,
  MID,
  SHADOW,
  type Rgba,
} from '@/gym/form-renderers/a/colors';
import { applyCoverageFail, makeBuf, px, rect, removeKeys, span, uploadPixels, unit } from '@/gym/form-renderers/a/pixels';
import { corePx, recipeFromForm, recipeTag, rhythmPeriodMs, type FamilyId, type PixelRecipe } from '@/gym/form-renderers/a/recipe';

const TILE = GAME_CONSTANTS.TILE_SIZE;
const SIZE = 32;
const FRAMES = 8;

function stainInk(family: FamilyId, seed: number, i: number): Rgba {
  const u = unit(seed, i);
  switch (family) {
    case 'lamp_pillar':
      return u > 0.7 ? CORE : u > 0.4 ? METAL : CONCRETE;
    case 'doorframe':
      return u > 0.6 ? METAL : CONCRETE;
    case 'fungal_mat':
      return u > 0.55 ? MID : EARTH;
    case 'oil_film':
      return u > 0.65 ? DEEP : CONCRETE;
    case 'organic_remnant':
      return u > 0.5 ? EARTH : BRICK;
    default:
      return u > 0.5 ? BRICK : SHADOW;
  }
}

function coreOffset(recipe: PixelRecipe, frame: number): { x: number; y: number; size: number } {
  const size = corePx(recipe.fail);
  const pulse = 0.5 + 0.5 * Math.sin((frame / FRAMES) * Math.PI * 2);
  if (recipe.utterance === 'door_still_closing' || recipe.motion === 'motion_anchor') {
    return { x: 2, y: 0, size: 1 + Math.round(pulse * (size - 1)) };
  }
  if (recipe.motion === 'motion_turn') {
    return frame < 4 ? { x: -2, y: -3, size } : { x: 3, y: 3, size };
  }
  const path = [
    { x: 0, y: -5 },
    { x: 1, y: -3 },
    { x: 2, y: 0 },
    { x: 1, y: 3 },
    { x: 0, y: 5 },
    { x: -1, y: 2 },
    { x: -2, y: 0 },
    { x: -1, y: -2 },
  ];
  const p = path[frame] ?? path[0]!;
  return { x: p.x, y: p.y, size };
}

function bakeYiFrame(recipe: PixelRecipe, frame: number): ReturnType<typeof makeBuf> {
  const buf = makeBuf(SIZE, SIZE);
  const wallish = recipe.occupancy !== 'floor';
  const x0 = wallish ? 6 : 8;
  const y0 = recipe.occupancy === 'floor' ? 12 : 8;
  const w = recipe.occupancy === 'paint' || recipe.occupancy === 'volume' ? 20 : 16;
  const h = recipe.family === 'oil_film' ? 8 : recipe.family === 'doorframe' ? 18 : 14;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (recipe.family === 'doorframe' && x > 3 && x < w - 4 && y > 2 && y < h - 2) continue;
      if (recipe.family === 'oil_film' && y % 2 === 1) continue;
      if (unit(recipe.seed, x * 13 + y * 7 + frame) < 0.18) continue;
      px(buf, x0 + x, y0 + y, stainInk(recipe.family, recipe.seed, x + y * 32));
    }
  }
  if (recipe.continuity === 'colony' || recipe.continuity === 'field') {
    const n = recipe.continuity === 'field' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      rect(buf, 4 + i * 9, 4 + (i % 2) * 6, 3, 3, DEEP);
    }
  }
  applyCoverageFail(buf, recipe.fail, recipe.seed + frame);
  const off = coreOffset(recipe, frame);
  const cx = 18 + off.x;
  const cy = 16 + off.y;
  const ink = recipe.utterance === 'eye_in_the_seam' ? GLOW : CORE;
  for (let j = 0; j < off.size; j++) span(buf, cx, cy + j, off.size, ink);
  if (recipe.sense === 'sense_narrow' || recipe.utterance === 'eye_in_the_seam') {
    span(buf, cx - 1, cy, off.size + 2, GLOW);
  }
  if (recipe.sense === 'sense_touch') px(buf, cx, 28, CORE);
  if (recipe.sense === 'sense_hear') {
    px(buf, cx - 2, cy, EARTH);
    px(buf, cx - 2, cy + 1, CORE);
  }
  return buf;
}

class YiVisual implements FormVisual {
  private readonly scene: FormAttachContext['scene'];
  private readonly image: Phaser.GameObjects.Image;
  private readonly tick: Phaser.GameObjects.Graphics;
  private readonly keys: string[];
  private readonly pinX: number;
  private readonly pinY: number;
  private readonly period: number;
  private readonly depth: number;
  private clock = 0;

  constructor(ctx: FormAttachContext) {
    const recipe = recipeFromForm(ctx.form, ctx.seed);
    this.scene = ctx.scene;
    this.depth = ctx.depth;
    this.period = rhythmPeriodMs(recipe.rhythm);
    this.pinX = ctx.pin?.x ?? 0;
    this.pinY = ctx.pin?.y ?? 0;
    const tag = recipeTag(recipe);
    this.keys = [];
    for (let frame = 0; frame < FRAMES; frame++) {
      const key = `${tag}_yi_${frame}`;
      uploadPixels(ctx.scene, key, bakeYiFrame(recipe, frame));
      this.keys.push(key);
    }
    this.image = ctx.scene.add.image(this.pinX, this.pinY, this.keys[0]!);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(0.5, 0.5);
    this.image.setRotation(0);
    this.tick = ctx.scene.add.graphics();
    this.tick.setDepth(ctx.depth);
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    const frame = Math.floor((((this.clock % this.period) + this.period) % this.period) / this.period * FRAMES) % FRAMES;
    const key = this.keys[frame] ?? this.keys[0]!;
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setPosition(this.pinX, this.pinY);
    this.image.setRotation(0);
    this.image.setAlpha(Math.max(0.2, pose.visibility));
    this.tick.clear();
    if (pose.signal === 'strike') {
      this.tick.fillStyle(0x1aad96, 1);
      this.tick.fillRect(Math.round(this.pinX + TILE) - 0, Math.round(this.pinY), 1, 1);
    }
    this.tick.setDepth(this.depth);
  }

  destroy(): void {
    this.tick.destroy();
    this.image.destroy();
    removeKeys(this.scene, this.keys);
  }
}

export function attachYi(ctx: FormAttachContext): FormVisual {
  return new YiVisual(ctx);
}
