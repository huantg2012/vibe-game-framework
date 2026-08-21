import Phaser from 'phaser';
import type { FormAttachContext, FormVisual, FormVisualPose } from '@/gym/form-renderers/form-renderer';
import { CORE, DEEP, EARTH, GLOW, MID, CONCRETE, type Rgba } from '@/gym/form-renderers/a/colors';
import { applyCoverageFail, makeBuf, px, rect, removeKeys, uploadPixels, unit } from '@/gym/form-renderers/a/pixels';
import { corePx, recipeFromForm, recipeTag, rhythmPeriodMs, type FamilyId, type PixelRecipe } from '@/gym/form-renderers/a/recipe';

const SIZE = 48;
const FRAMES = 4;

function blotchInk(family: FamilyId, seed: number, i: number): Rgba {
  const u = unit(seed, i);
  switch (family) {
    case 'oil_film':
      return u > 0.6 ? DEEP : CONCRETE;
    case 'lamp_pillar':
      return u > 0.75 ? CORE : CONCRETE;
    case 'doorframe':
      return u > 0.5 ? CONCRETE : EARTH;
    case 'wall_rust':
      return u > 0.5 ? EARTH : DEEP;
    case 'organic_remnant':
      return u > 0.45 ? EARTH : MID;
    default:
      return u > 0.55 ? MID : DEEP;
  }
}

function radiusFor(recipe: PixelRecipe, inflated: boolean): number {
  let r = recipe.continuity === 'field' ? 18 : recipe.continuity === 'colony' ? 14 : 10;
  if (recipe.occupancy === 'volume') r += 3;
  if (recipe.occupancy === 'wall') r -= 1;
  if (inflated) r += 2;
  return r;
}

function bakeBingFrame(recipe: PixelRecipe, frame: number, inflated: boolean): ReturnType<typeof makeBuf> {
  const buf = makeBuf(SIZE, SIZE);
  const cx = 24;
  const cy = 24;
  const r = radiusFor(recipe, inflated);
  const squashX = recipe.occupancy === 'wall' ? 1.6 : 1;
  const squashY = recipe.occupancy === 'floor' ? 1.3 : recipe.motion === 'motion_cluster' ? 0.85 : 1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = (x - cx) * squashX;
      const dy = (y - cy) * squashY;
      if (dx * dx + dy * dy > r * r) continue;
      if (recipe.family === 'oil_film' && y % 3 === 1) continue;
      if (unit(recipe.seed, x * 17 + y * 11 + frame) < (recipe.fail === 0 ? 0.42 : 0.18)) continue;
      px(buf, x, y, blotchInk(recipe.family, recipe.seed, x + y * SIZE));
    }
  }
  if (recipe.continuity === 'shards') {
    for (let y = 22; y <= 25; y++) {
      for (let x = 0; x < SIZE; x++) {
        const i = (y * SIZE + x) * 4;
        buf.data[i + 3] = 0;
      }
    }
  }
  if (recipe.continuity === 'colony' || recipe.continuity === 'field') {
    const n = recipe.continuity === 'field' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + frame * 0.2;
      const sx = Math.round(cx + Math.cos(ang) * (r + 4));
      const sy = Math.round(cy + Math.sin(ang) * (r + 3));
      rect(buf, sx, sy, 3, 3, i % 2 === 0 ? CORE : DEEP);
    }
  }
  applyCoverageFail(buf, recipe.fail, recipe.seed);
  const pulse = recipe.utterance === 'cluster_lung' || recipe.rhythm === 'rhythm_cluster';
  const size = corePx(recipe.fail) + (inflated ? 1 : 0) + (pulse && frame >= 2 ? 1 : 0);
  const ink = inflated || frame === 2 ? GLOW : CORE;
  const ox = recipe.motion === 'motion_wind' ? (frame % 2 === 0 ? -1 : 1) : 0;
  rect(buf, cx - (size >> 1) + ox, cy - (size >> 1), size, size, ink);
  if (recipe.sense === 'sense_touch') px(buf, cx, cy + r - 1, CORE);
  if (recipe.sense === 'sense_scent') px(buf, cx, cy - r + 2, GLOW);
  if (recipe.sense === 'sense_domain') {
    px(buf, cx - 2, cy, MID);
    px(buf, cx + 2, cy, MID);
  }
  if (recipe.contact === 'contact_step_chaos') {
    px(buf, cx - 3, cy + r - 2, DEEP);
    px(buf, cx + 4, cy + r - 1, CORE);
  }
  if (recipe.contact === 'contact_disperse_core') {
    px(buf, cx + 3, cy - 2, CORE);
    px(buf, cx - 4, cy + 1, DEEP);
  }
  return buf;
}

class BingVisual implements FormVisual {
  private readonly scene: FormAttachContext['scene'];
  private readonly image: Phaser.GameObjects.Image;
  private readonly rest: string[];
  private readonly inflated: string[];
  private readonly pinX: number;
  private readonly pinY: number;
  private readonly period: number;
  private clock = 0;

  constructor(ctx: FormAttachContext) {
    const recipe = recipeFromForm(ctx.form, ctx.seed);
    this.scene = ctx.scene;
    this.period = rhythmPeriodMs(recipe.rhythm);
    this.pinX = ctx.pin?.x ?? 0;
    this.pinY = ctx.pin?.y ?? 0;
    const tag = recipeTag(recipe);
    this.rest = [];
    this.inflated = [];
    for (let frame = 0; frame < FRAMES; frame++) {
      const a = `${tag}_b_${frame}`;
      const b = `${tag}_b_i_${frame}`;
      uploadPixels(ctx.scene, a, bakeBingFrame(recipe, frame, false));
      uploadPixels(ctx.scene, b, bakeBingFrame(recipe, frame, true));
      this.rest.push(a);
      this.inflated.push(b);
    }
    this.image = ctx.scene.add.image(this.pinX, this.pinY, this.rest[0]!);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(0.5, 0.5);
    this.image.setRotation(0);
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    const frame = Math.floor((((this.clock % this.period) + this.period) % this.period) / this.period * FRAMES) % FRAMES;
    const table = pose.signal === 'inflated' ? this.inflated : this.rest;
    const key = table[frame] ?? table[0]!;
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setPosition(this.pinX, this.pinY);
    this.image.setRotation(0);
    this.image.setAlpha(Math.max(0.25, pose.visibility));
  }

  destroy(): void {
    this.image.destroy();
    removeKeys(this.scene, [...this.rest, ...this.inflated]);
  }
}

export function attachBing(ctx: FormAttachContext): FormVisual {
  return new BingVisual(ctx);
}
