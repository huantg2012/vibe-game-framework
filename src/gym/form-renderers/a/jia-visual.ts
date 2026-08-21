import Phaser from 'phaser';
import type { FormAttachContext, FormVisual, FormVisualPose } from '@/gym/form-renderers/form-renderer';
import { FacingLagGhost, pingPongFrame } from '@/entities/actor-motion';
import type { Facing4 } from '@/types/game-types';
import { bakeJiaSheet } from '@/gym/form-renderers/a/jia-paint';
import { removeKeys, uploadPixels } from '@/gym/form-renderers/a/pixels';
import { gaitFps, recipeFromForm, recipeTag } from '@/gym/form-renderers/a/recipe';

class JiaVisual implements FormVisual {
  private readonly scene: FormAttachContext['scene'];
  private readonly image: Phaser.GameObjects.Image;
  private readonly lag: FacingLagGhost;
  private readonly keys: readonly string[];
  private readonly keyFor: (facing: Facing4, gait: 'idle' | 'walk', frame: number) => string;
  private readonly motion: string;
  private readonly rhythm: string;
  private readonly originX: number;
  private readonly originY: number;
  private clock = 0;
  private shownFacing: Facing4 = 'down';

  constructor(ctx: FormAttachContext) {
    const recipe = recipeFromForm(ctx.form, ctx.seed);
    this.scene = ctx.scene;
    this.motion = recipe.motion;
    this.rhythm = recipe.rhythm;
    this.originX = recipe.originX / recipe.canvasW;
    this.originY = recipe.originY / recipe.canvasH;
    const tag = recipeTag(recipe);
    this.keyFor = (facing, gait, frame) => `${tag}_j_${facing}_${gait}_${frame}`;
    this.keys = bakeJiaSheet(ctx.scene, recipe, uploadPixels, this.keyFor);
    const start = this.keyFor('down', 'idle', 0);
    this.image = ctx.scene.add.image(0, 0, start);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(this.originX, this.originY);
    this.image.setRotation(0);
    this.lag = new FacingLagGhost(ctx.scene, start, ctx.depth - 1, this.originX, this.originY, {
      turnMs: recipe.motion === 'motion_turn' ? 280 : 180,
    });
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    if (pose.facing4 !== this.shownFacing) {
      this.lag.trigger(this.shownFacing, this.keyFor(this.shownFacing, 'idle', 0));
      this.shownFacing = pose.facing4;
    }
    const anchored = this.motion === 'motion_anchor';
    const gait: 'idle' | 'walk' = pose.moving && !anchored ? 'walk' : 'idle';
    const frame = pingPongFrame(this.clock, gaitFps(this.rhythm, gait === 'walk'));
    const key = this.keyFor(pose.facing4, gait, frame);
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setPosition(pose.x, pose.y);
    this.image.setRotation(0);
    this.image.setAlpha(Math.max(0.2, pose.visibility));
    this.lag.sync(pose.x, pose.y, pose.visibility > 0, pose.deltaMs);
  }

  destroy(): void {
    this.lag.destroy();
    this.image.destroy();
    removeKeys(this.scene, this.keys);
  }
}

export function attachJia(ctx: FormAttachContext): FormVisual {
  return new JiaVisual(ctx);
}
