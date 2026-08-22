/**
 * 方案 D 乙：墙-地缝上的门框 / 墙锈（生产；句法课对照同一份）。
 *
 * 位置：Image/Graphics 钉 `pose.x/y`（宿主核 = 当前缝）。厚度沿 `facing4` 法线走进走廊 1–3px。
 * 运动：整只跟 host.core 走，不在画布里 seamSlidePx。
 * 抽打：`signal==='strike'` 时在 getStrikeFloors 各地格中心画 1px #1aad96。
 *
 * 字段 → 画面：
 * - substrate → 门框开合槽 / 墙锈渗斑
 * - coverage → 缝厚 1/2/3px + 核 2/3/4px
 * - continuity → 菌落邻缝第二核；碎裂=缝中缺口
 * - occupancy → 只画墙皮，不改碰撞
 * - motion → 跟 pose 走或停
 * - sense → 窄视 1px 缝亮，不成对瞳孔
 * - rhythm → 门框开合 / 核脉冲
 * - contact / strike → 地格 1px
 * - utteranceId → 缝视加长 1px；门还想关=槽内一笔
 *
 * 配色：deriveFragmentContamRamp(fragmentTypeId)；亮核钳回 #1aad96 / #2ae6c8 / #3cffd4。
 */
import Phaser from 'phaser';
import {
  applyFormVisibility,
  type FormAttachContext,
  type FormVisual,
  type FormVisualPose,
} from '@/entities/form-renderers/form-renderer';
import { LEXICON_DEFAULT_FRAGMENT } from '@/entities/form-renderers/d/fragment-ramp';
import {
  paintYiSkin,
  paintYiStrikeFloors,
  strikeFloorsFromPose,
  type StrikeFloor,
} from '@/entities/form-renderers/d/yi-paint';
import { faceNormal, yiRecipeFromForm } from '@/entities/form-renderers/d/yi-recipe';

const TICK_DEPTH = 0.2;

interface HostQuery {
  getStrikeFloors(id: string): readonly StrikeFloor[];
  getSubjects(): readonly { id: string; position: { x: number; y: number } }[];
}

function hostsOn(scene: Phaser.Scene): HostQuery | null {
  const hosts = (scene as unknown as { hosts?: HostQuery }).hosts;
  if (!hosts || typeof hosts.getStrikeFloors !== 'function') return null;
  return hosts;
}

function hostIdAtPin(ctx: FormAttachContext): string | null {
  const hosts = hostsOn(ctx.scene);
  const pin = ctx.pin;
  if (!hosts || !pin) return null;
  let best: string | null = null;
  let bestD = 40;
  for (const row of hosts.getSubjects()) {
    const d = Math.hypot(row.position.x - pin.x, row.position.y - pin.y);
    if (d < bestD) {
      bestD = d;
      best = row.id;
    }
  }
  return best;
}

function readStrikeFloors(scene: Phaser.Scene, hostId: string | null, pose: FormVisualPose): readonly StrikeFloor[] {
  if (hostId) {
    const cells = hostsOn(scene)?.getStrikeFloors(hostId);
    if (cells && cells.length > 0) return cells;
  }
  return strikeFloorsFromPose(pose);
}

class YiVisualD implements FormVisual {
  private readonly scene: Phaser.Scene;
  private readonly skin: Phaser.GameObjects.Graphics;
  private readonly ticks: Phaser.GameObjects.Graphics;
  private readonly recipe: ReturnType<typeof yiRecipeFromForm>;
  private readonly hostId: string | null;
  private clock = 0;

  constructor(ctx: FormAttachContext) {
    this.scene = ctx.scene;
    this.recipe = yiRecipeFromForm(ctx.form, ctx.seed, ctx.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
    this.hostId = hostIdAtPin(ctx);
    this.skin = ctx.scene.add.graphics();
    this.skin.setDepth(ctx.depth);
    this.skin.setRotation(0);
    this.ticks = ctx.scene.add.graphics();
    this.ticks.setDepth(TICK_DEPTH);
    this.ticks.setRotation(0);
    const pin = ctx.pin;
    const attach = pin?.attach;
    if (attach) {
      this.skin.setPosition(Math.round(attach.seamX), Math.round(attach.seamY));
      paintYiSkin(
        this.skin,
        this.recipe,
        {
          x: attach.seamX,
          y: attach.seamY,
          facing4:
            attach.face === 'n' ? 'up' : attach.face === 's' ? 'down' : attach.face === 'e' ? 'right' : 'left',
          moving: false,
          visibility: 1,
          signal: 'idle',
          deltaMs: 0,
        },
        0,
        attach.nx,
        attach.ny,
      );
    } else if (pin) {
      this.skin.setPosition(Math.round(pin.x), Math.round(pin.y));
    }
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    const x = Math.round(pose.x);
    const y = Math.round(pose.y);
    this.skin.setPosition(x, y);
    this.skin.setRotation(0);
    applyFormVisibility(this.skin, pose.visibility);
    const { nx, ny } = faceNormal(pose.facing4);
    paintYiSkin(this.skin, this.recipe, pose, this.clock, nx, ny);
    if (pose.signal === 'strike' && pose.visibility > 0) {
      paintYiStrikeFloors(this.ticks, readStrikeFloors(this.scene, this.hostId, pose), this.recipe.colors.strikeDot);
      applyFormVisibility(this.ticks, pose.visibility);
    } else {
      this.ticks.clear();
      this.ticks.setVisible(false);
    }
  }

  destroy(): void {
    this.ticks.destroy();
    this.skin.destroy();
  }
}

export function attachYiD(ctx: FormAttachContext): FormVisual {
  return new YiVisualD(ctx);
}
