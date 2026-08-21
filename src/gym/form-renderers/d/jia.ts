/**
 * 方案 D 甲：程序像素词法（gym 句法课，出击不接）。
 *
 * 路子抄方案 A（Canvas 逐像素烘焙 → Image；四向直立；GameObject.rotation 恒 0）。
 * 覆盖深度抄改写体：基底剪影上叠 DEEP/CORE/GLOW 簇 + teal melt，禁止 fail-percent 挖透明。
 *
 * 字段 → 画面：
 * - substrate → 五种占地剪影（有机残影 / 灯柱 / 门框 / 残茎 / 栏柱）；概念基体禁止
 * - 族内变体 → mix32(seed, substrate) % 3，与覆盖正交
 * - coverage → 渗透=完整剪影+家族散点；改写=崩坏侧 DEEP + 15–20 CORE 分团 + 2 GLOW；覆盖=残边+28–36 簇+外沿喷点
 * - continuity → 裂片=躯干 1px 缝；菌落/场=脚边卫星点；仍一个碰撞
 * - occupancy → 只画占地走者
 * - motion → 有机/残茎走步态；灯柱/栏柱/门框固着呼吸；不转 GameObject
 * - sense → 视锥前倾；听噪 32×48；窄视 1px 缝亮
 * - rhythm → 自有步态钟，禁止 3100ms 簇钟
 * - contact / strike → 前倾+伸出；领先簇改亮核
 * - utteranceId → 门还想关：门框多一笔核；配方名不上屏
 *
 * 配色：deriveFragmentContamRamp(fragmentTypeId)；亮核钳回 #1aad96 / #2ae6c8 / #3cffd4。
 */
import Phaser from 'phaser';
import {
  ContamFlakes,
  REWRITER_FLAKE_TUNE,
  type FlakeLocal,
} from '@/entities/contam-flakes';
import { FacingLagGhost, facingUnit, pingPongFrame } from '@/entities/actor-motion';
import { AIState, type Facing4 } from '@/types/game-types';
import type { FormAttachContext, FormVisual, FormVisualPose } from '@/gym/form-renderers/form-renderer';
import { LEXICON_DEFAULT_FRAGMENT } from '@/gym/form-renderers/d/fragment-ramp';
import { bakeJiaSheet, resolveJiaKey } from '@/gym/form-renderers/d/jia-paint';
import { clusterModeOf, jiaGaitFps, jiaRecipeFromForm, jiaRecipeTag, type ClusterMode } from '@/gym/form-renderers/d/jia-recipe';
import { removeKeys } from '@/gym/form-renderers/d/jia-pixels';

class JiaVisualD implements FormVisual {
  private readonly scene: Phaser.Scene;
  private readonly image: Phaser.GameObjects.Image;
  private readonly lag: FacingLagGhost;
  private readonly flakes: ContamFlakes | null;
  private readonly keys: readonly string[];
  private readonly keyFor: (facing: Facing4, gait: 'idle' | 'walk', frame: number, mode: ClusterMode) => string;
  private readonly recipeTag: ReturnType<typeof jiaRecipeFromForm>;
  private clock = 0;
  private chaseFrames = 0;
  private shownFacing: Facing4 = 'down';

  constructor(ctx: FormAttachContext) {
    const recipe = jiaRecipeFromForm(ctx.form, ctx.seed, ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
    this.recipeTag = recipe;
    this.scene = ctx.scene;
    const tag = jiaRecipeTag(recipe);
    this.keyFor = (facing, gait, frame, mode) => `${tag}_${facing}_${gait}_${frame}_${mode}`;
    const baked = bakeJiaSheet(ctx.scene, recipe, this.keyFor);
    this.keys = baked.keys;
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
            (facing) => baked.flakes[facing] ?? ([] as readonly FlakeLocal[]),
            { ...REWRITER_FLAKE_TUNE, depth: ctx.depth + 2 },
          )
        : null;
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    const recipe = this.recipeTag;
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
    this.image.setAlpha(Math.max(0.2, pose.visibility));
    this.lag.sync(x, y, pose.visibility > 0, pose.deltaMs);
    this.flakes?.sync(x, y, pose.facing4, flakeState(mode), pose.visibility, pose.deltaMs);
  }

  destroy(): void {
    this.lag.destroy();
    this.flakes?.destroy();
    this.image.destroy();
    removeKeys(this.scene, this.keys);
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
