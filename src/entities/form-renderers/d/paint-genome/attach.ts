/**
 * 占漆拓扑挂载。烤拓扑静帧；检视 / 句法课 / 出击沿生长方向连续扩散收缩（DEC-070 5–20%）。
 * 油膜省略 `paintVeinVariant` 时按个体种子采样 3/4/5。陈列馆浏览 `deltaMs === 0` 只留静帧。
 * 禁止 import `d/genome`。禁止切预烤帧。
 */
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import {
  bakePaintGenome,
  collectPaintGenomeFloorTiles,
  type PaintGrowthGuide,
} from '@/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { paintPaintGenomeLive } from '@/entities/form-renderers/d/paint-genome/live';
import { LEXICON_DEFAULT_FRAGMENT, type FragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
import { removeKeys } from '@/entities/form-renderers/d/jia-pixels';
import {
  applyFormVisibility,
  type FormAttachContext,
  type FormVisual,
  type FormVisualPose,
} from '@/entities/form-renderers/form-renderer';

function textureKey(ctx: FormAttachContext, vein: string): string {
  const fragment = ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT;
  const prefix = ctx.textureNamespace ? `${ctx.textureNamespace}_` : '';
  const sense = ctx.form.lexemes.sense;
  const rhythm = ctx.form.lexemes.rhythm;
  return `${prefix}d_paint_genome_${fragment}_${ctx.form.substrate}_${ctx.form.coverage}_${ctx.form.continuity}_${sense}_${rhythm}_v${vein}_${(ctx.seed >>> 0).toString(16)}`;
}

function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number): Phaser.Textures.CanvasTexture {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`[paint-genome] could not create canvas '${key}'`);
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return tex;
}

class BingPaintGenomeVisual implements FormVisual {
  readonly stepFloors: readonly { readonly col: number; readonly row: number }[];
  private readonly scene: Phaser.Scene;
  private readonly image: Phaser.GameObjects.Image;
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly canvasCtx: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly rest: Float32Array;
  private readonly scratch: Float32Array;
  private readonly growth: PaintGrowthGuide;
  private readonly key: string;
  private readonly w: number;
  private readonly h: number;
  private readonly ramp: FragmentContamRamp;
  private clock = 0;
  private live = false;

  constructor(ctx: FormAttachContext) {
    this.scene = ctx.scene;
    const veinVariant = resolvePaintVeinVariant(ctx.form.substrate, ctx.seed, ctx.paintVeinVariant);
    const baked = bakePaintGenome({
      substrate: ctx.form.substrate,
      coverage: ctx.form.coverage,
      seed: ctx.seed,
      continuity: ctx.form.continuity,
      sense: ctx.form.lexemes.sense,
      rhythm: ctx.form.lexemes.rhythm,
      fragmentTypeId: ctx.fragmentTypeId,
      veinVariant,
    });
    this.w = baked.canvasW;
    this.h = baked.canvasH;
    this.rest = baked.field;
    this.scratch = new Float32Array(baked.field.length);
    this.growth = baked.growth;
    this.ramp = baked.ramp;
    this.stepFloors = ctx.pin
      ? collectPaintGenomeFloorTiles(
          baked.field,
          this.w,
          this.h,
          ctx.pin.x,
          ctx.pin.y,
          GAME_CONSTANTS.TILE_SIZE,
        )
      : [];
    this.key = textureKey(ctx, veinVariant === undefined ? 'x' : String(veinVariant));
    this.texture = makeTexture(ctx.scene, this.key, this.w, this.h);
    this.canvasCtx = this.texture.getContext();
    this.pixels = this.canvasCtx.createImageData(this.w, this.h);
    this.pixels.data.set(baked.buf.data);
    this.canvasCtx.putImageData(this.pixels, 0, 0);
    this.texture.refresh();
    this.image = ctx.scene.add.image(0, 0, this.key);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(0.5, 0.5);
    this.image.setRotation(0);
    if (ctx.displayScale !== undefined) this.image.setScale(ctx.displayScale);
    this.image.setVisible(false);
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    if (pose.deltaMs > 0) this.live = true;
    this.image.setPosition(pose.x, pose.y);
    this.image.setRotation(0);
    applyFormVisibility(this.image, pose.visibility);
    if (pose.visibility <= 0) return;
    if (!this.live) return;
    paintPaintGenomeLive({
      rest: this.rest,
      scratch: this.scratch,
      out: this.pixels.data,
      w: this.w,
      h: this.h,
      elapsedMs: this.clock,
      inflated: pose.signal === 'inflated',
      ramp: this.ramp,
      growth: this.growth,
    });
    this.canvasCtx.putImageData(this.pixels, 0, 0);
    this.texture.refresh();
  }

  destroy(): void {
    this.image.destroy();
    removeKeys(this.scene, [this.key]);
  }
}

export function attachBingPaintGenome(ctx: FormAttachContext): FormVisual {
  return new BingPaintGenomeVisual(ctx);
}
