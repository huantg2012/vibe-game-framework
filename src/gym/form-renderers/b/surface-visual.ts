import Phaser from 'phaser';
import type {
  FormAttachContext,
  FormVisual,
  FormVisualPose,
} from '@/gym/form-renderers/form-renderer';
import { layoutOrganisms, type LiveOrganism } from '@/gym/form-renderers/b/cluster-shape';
import { dialectFromForm, type DialectRecipe } from '@/gym/form-renderers/b/dialect';
import { deformOrganisms, makePulseField, paintLivingFrame } from '@/gym/form-renderers/b/paint-living';

interface SurfaceState {
  scene: Phaser.Scene;
  image: Phaser.GameObjects.Image;
  texture: Phaser.Textures.CanvasTexture;
  pixels: ImageData;
  key: string;
  recipe: DialectRecipe;
  organisms: LiveOrganism[];
  elapsedMs: number;
  pinX: number;
  pinY: number;
}

function textureKey(seed: number, portfolio: string): string {
  return `gym-b-${portfolio}-${(seed >>> 0).toString(16)}`;
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`[scheme-b] could not create canvas '${key}'`);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

export function createSurfaceVisual(ctx: FormAttachContext): FormVisual {
  const recipe = dialectFromForm(ctx.form, ctx.pin);
  const key = textureKey(ctx.seed, ctx.form.portfolio);
  const texture = makeTexture(ctx.scene, key, recipe.canvasW, recipe.canvasH);
  const canvasCtx = texture.getContext();
  const pixels = canvasCtx.createImageData(recipe.canvasW, recipe.canvasH);
  const organisms = layoutOrganisms(recipe, ctx.seed);
  const field = makePulseField(recipe.canvasW, recipe.canvasH, organisms, recipe);
  const image = ctx.scene.add.image(0, 0, key);
  image.setDepth(ctx.depth);
  image.setRotation(0);
  image.setVisible(false);
  image.setOrigin(recipe.origin === 'center' ? 0.5 : 0, recipe.origin === 'center' ? 0.5 : 0);
  const pinX = ctx.pin?.x ?? 0;
  const pinY = ctx.pin?.y ?? 0;
  const state: SurfaceState = {
    scene: ctx.scene,
    image,
    texture,
    pixels,
    key,
    recipe,
    organisms,
    elapsedMs: 0,
    pinX,
    pinY,
  };

  const visual: FormVisual = {
    update(pose: FormVisualPose): void {
      state.elapsedMs += pose.deltaMs;
      const cx = recipe.canvasW * 0.5;
      const cy = recipe.canvasH * 0.5;
      const anchorX = recipe.origin === 'center' ? cx : pose.x - state.pinX;
      const anchorY = recipe.origin === 'center' ? cy : pose.y - state.pinY;
      deformOrganisms(state.organisms, recipe, pose, state.elapsedMs, anchorX, anchorY);
      paintLivingFrame(
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
      if (recipe.origin === 'center') image.setPosition(pose.x, pose.y);
      else image.setPosition(state.pinX, state.pinY);
      image.setRotation(0);
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
