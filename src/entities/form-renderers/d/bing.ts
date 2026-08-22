import Phaser from 'phaser';
import type {
  FormAttachContext,
  FormVisual,
  FormVisualPose,
} from '@/entities/form-renderers/form-renderer';
import { bingRecipeFromForm, type BingRecipe } from '@/entities/form-renderers/d/bing-dialect';
import {
  deformBingOrganisms,
  makeBingPulseField,
  paintBingFrame,
} from '@/entities/form-renderers/d/bing-paint';
import { layoutBingOrganisms, type LiveOrganism } from '@/entities/form-renderers/d/bing-shape';
import { LEXICON_DEFAULT_FRAGMENT } from '@/entities/form-renderers/d/fragment-ramp';

interface BingState {
  scene: Phaser.Scene;
  image: Phaser.GameObjects.Image;
  texture: Phaser.Textures.CanvasTexture;
  pixels: ImageData;
  key: string;
  recipe: BingRecipe;
  organisms: LiveOrganism[];
  elapsedMs: number;
}

/** Reuse key: occupancy × substrate × coverage × seed (+ fragment / continuity). Facing does not flip 丙. */
function textureKey(ctx: FormAttachContext): string {
  const fragment = ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT;
  const stem = `d_paint_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${(ctx.seed >>> 0).toString(16)}`;
  return ctx.textureNamespace ? `${ctx.textureNamespace}_${stem}` : stem;
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`[scheme-d bing] could not create canvas '${key}'`);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

/** Scheme D 丙: baked cluster silhouette + DEC-070 whole-blob breath. No walker sprite. */
export function attachBingD(ctx: FormAttachContext): FormVisual {
  const recipe = bingRecipeFromForm(ctx.form, ctx);
  const key = textureKey(ctx);
  const texture = makeTexture(ctx.scene, key, recipe.canvasW, recipe.canvasH);
  const canvasCtx = texture.getContext();
  const pixels = canvasCtx.createImageData(recipe.canvasW, recipe.canvasH);
  const organisms = layoutBingOrganisms(recipe, ctx.seed);
  const field = makeBingPulseField(recipe.canvasW, recipe.canvasH, organisms, recipe);
  const image = ctx.scene.add.image(0, 0, key);
  image.setDepth(ctx.depth);
  image.setRotation(0);
  image.setVisible(false);
  image.setOrigin(0.5, 0.5);
  const state: BingState = {
    scene: ctx.scene,
    image,
    texture,
    pixels,
    key,
    recipe,
    organisms,
    elapsedMs: 0,
  };

  const visual: FormVisual = {
    update(pose: FormVisualPose): void {
      state.elapsedMs += pose.deltaMs;
      image.setPosition(pose.x, pose.y);
      image.setRotation(0);
      if (pose.visibility <= 0) {
        image.setVisible(false);
        image.setAlpha(0);
        return;
      }
      const cx = recipe.canvasW * 0.5;
      const cy = recipe.canvasH * 0.5;
      deformBingOrganisms(state.organisms, recipe, pose, state.elapsedMs, cx, cy);
      paintBingFrame(
        state.pixels.data,
        recipe.canvasW,
        recipe.canvasH,
        field,
        state.organisms,
        recipe,
        pose,
        state.elapsedMs,
        ctx.seed,
      );
      canvasCtx.putImageData(state.pixels, 0, 0);
      texture.refresh();
      image.setVisible(true);
      image.setAlpha(pose.visibility);
    },
    destroy(): void {
      image.destroy();
      if (state.scene.textures.exists(key)) state.scene.textures.remove(key);
    },
  };
  return visual;
}
