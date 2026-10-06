/**
 * 方案 D 甲：程序像素词法（生产；句法课对照同一份）。
 *
 * 路子抄方案 A（Canvas 逐像素烘焙 → Image；四向直立；GameObject.rotation 恒 0）。
 * 覆盖深度抄改写体：基底剪影上叠 DEEP/CORE/GLOW 簇 + teal melt，禁止 fail-percent 挖透明。
 *
 * 纹理：attach / 朝向变化时 bake。复用键 = occupancy(floor) × substrate × coverage × seed × facing
 * （另含 fragment / variant / gait / frame / mode）。禁止每帧重烤整只。
 */
import Phaser from 'phaser';
import {
  ContamFlakes,
  REWRITER_FLAKE_TUNE,
  type FlakeLocal,
} from '@/entities/contam-flakes';
import { FacingLagGhost, facingUnit, pingPongFrame } from '@/entities/actor-motion';
import { AIState, type Facing4 } from '@/types/game-types';
import {
  applyFormVisibility,
  type FormAttachContext,
  type FormVisual,
  type FormVisualPose,
} from '@/entities/form-renderers/form-renderer';
import { LEXICON_DEFAULT_FRAGMENT } from '@/entities/form-renderers/d/fragment-ramp';
import { bakeJiaSheet, resolveJiaKey } from '@/entities/form-renderers/d/jia-paint';
import { clusterModeOf, jiaGaitFps, jiaRecipeFromForm, jiaRecipeTag, type ClusterMode } from '@/entities/form-renderers/d/jia-recipe';
import { removeKeys } from '@/entities/form-renderers/d/jia-pixels';

class JiaVisualD implements FormVisual {
  private readonly scene: Phaser.Scene;
  private readonly image: Phaser.GameObjects.Image;
  private readonly lag: FacingLagGhost;
  private readonly flakes: ContamFlakes | null;
  private readonly keys: string[] = [];
  private readonly flakeLocals: Partial<Record<Facing4, readonly FlakeLocal[]>> = {};
  private readonly bakedFacings = new Set<Facing4>();
  private readonly keyFor: (facing: Facing4, gait: 'idle' | 'walk', frame: number, mode: ClusterMode) => string;
  private readonly recipe: ReturnType<typeof jiaRecipeFromForm>;
  private clock = 0;
  private chaseFrames = 0;
  private shownFacing: Facing4 = 'down';

  constructor(ctx: FormAttachContext) {
    const recipe = jiaRecipeFromForm(ctx.form, ctx.seed, ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
    this.recipe = recipe;
    this.scene = ctx.scene;
    const tag = jiaRecipeTag(recipe);
    const prefix = ctx.textureNamespace ? `${ctx.textureNamespace}_` : '';
    this.keyFor = (facing, gait, frame, mode) => `${prefix}${tag}_${facing}_${gait}_${frame}_${mode}`;
    this.ensureFacing('down');
    const start = this.keyFor('down', 'idle', 0, 'patrol');
    this.image = ctx.scene.add.image(0, 0, start);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(recipe.originX / recipe.canvasW, recipe.originY / recipe.canvasH);
    this.image.setRotation(0);
    this.lag = new FacingLagGhost(
      ctx.scene,
      start,
      ctx.depth - 1,
      recipe.originX / recipe.canvasW,
      recipe.originY / recipe.canvasH,
      { turnMs: recipe.motion === 'motion_turn' ? 280 : 180 },
    );
    this.flakes =
      recipe.coverage === 'overwrite'
        ? new ContamFlakes(
            ctx.scene,
            (facing) => this.flakeLocals[facing] ?? ([] as readonly FlakeLocal[]),
            { ...REWRITER_FLAKE_TUNE, depth: ctx.depth + 2 },
          )
        : null;
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    const recipe = this.recipe;
    this.ensureFacing(pose.facing4);
    if (pose.facing4 !== this.shownFacing) {
      this.lag.trigger(this.shownFacing, this.keyFor(this.shownFacing, 'idle', 0, 'patrol'));
      this.shownFacing = pose.facing4;
    }
    const gait: 'idle' | 'walk' = pose.moving && !recipe.anchored ? 'walk' : 'idle';
    const frame = pingPongFrame(this.clock, jiaGaitFps(recipe.rhythm, gait === 'walk'));
    const mode = clusterModeOf(pose.signal);
    const key = resolveJiaKey(this.keyFor, pose.facing4, gait, frame, mode, recipe.coverage);
    if (this.image.texture.key !== key) this.image.setTexture(key);
    let x = pose.x;
    let y = pose.y;
    if (mode === 'chase') {
      this.chaseFrames += 1;
      if (Math.floor(this.chaseFrames / 8) % 2 === 1) {
        const dir = facingUnit(pose.facing4);
        x += dir.x;
        y += dir.y;
      }
    } else {
      this.chaseFrames = 0;
    }
    this.image.setPosition(x, y);
    this.image.setRotation(0);
    applyFormVisibility(this.image, pose.visibility);
    this.lag.sync(x, y, pose.visibility > 0, pose.deltaMs);
    this.flakes?.sync(x, y, pose.facing4, flakeState(mode), pose.visibility, pose.deltaMs);
  }

  destroy(): void {
    this.lag.destroy();
    this.flakes?.destroy();
    this.image.destroy();
    removeKeys(this.scene, this.keys);
  }

  private ensureFacing(facing: Facing4): void {
    if (this.bakedFacings.has(facing)) return;
    const baked = bakeJiaSheet(this.scene, this.recipe, this.keyFor, [facing]);
    this.keys.push(...baked.keys);
    this.flakeLocals[facing] = baked.flakes[facing] ?? [];
    this.bakedFacings.add(facing);
  }
}

function flakeState(mode: ClusterMode): AIState {
  if (mode === 'chase' || mode === 'strike') return AIState.CHASE;
  if (mode === 'search') return AIState.ALERT;
  return AIState.PATROL;
}

export function attachJiaD(ctx: FormAttachContext): FormVisual {
  return new JiaVisualD(ctx);
}
