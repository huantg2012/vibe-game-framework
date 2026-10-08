/** R3 wall-attached shutter / mineral lamellae. Strike marks use actual floor cells. */
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
/** Presentation tail triggered only by a real strike; never extends danger. */
export const WALL_RECOIL_MS = 140;

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
  if (ctx.subjectId) return ctx.subjectId;
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
  private recoilMs = 0;

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
    const actualStrike=pose.attack?pose.attack.phase==='strike':pose.signal==='strike';
    this.recoilMs=actualStrike?WALL_RECOIL_MS:Math.max(0,this.recoilMs-Math.max(0,pose.deltaMs));
    const x = Math.round(pose.x);
    const y = Math.round(pose.y);
    this.skin.setPosition(x, y);
    this.skin.setRotation(0);
    applyFormVisibility(this.skin, pose.visibility);
    const { nx, ny } = faceNormal(pose.facing4);
    paintYiSkin(this.skin, this.recipe, pose, this.clock, nx, ny,this.recoilMs/WALL_RECOIL_MS);
    const threatening = pose.attack ? pose.attack.phase === 'windup' || pose.attack.phase === 'strike' : pose.signal === 'strike';
    if (threatening && pose.visibility > 0) {
      paintYiStrikeFloors(this.ticks, readStrikeFloors(this.scene, this.hostId, pose), this.recipe.colors.strikeDot, pose);
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
