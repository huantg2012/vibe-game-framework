/**
 * 甲基因谱挂载（I5-B / I5-D / I5-E / I5-F / I5-N / I5-G / I5-J）。
 * 出击 `d-mixed` 占地与练习场句法课 / 陈列馆走同一份 `attachJiaGenomeD`。
 * 街具残骸 / 门框走语法骨架并固着呼吸；残茎 / 有机残影 / 虫 / 哺乳动物 / 大号蠕虫可走，不进固着名单。未填语法的占地仍走夹具。
 * 烘焙走 `bakeJiaGenome`（骨架 → 算子 → weld → 朝向/信号相 → 可走步态）。
 * 可走甲消费 `pose.moving`：检视 walk 帧钉在 `pose.x/y`，禁止巡路滑步冒充步态。
 */
import Phaser from 'phaser';
import { pingPongFrame } from '@/entities/actor-motion';
import {
  applyFormVisibility,
  type FormAttachContext,
  type FormVisual,
  type FormVisualPose,
  type FormVisualSignal,
} from '@/entities/form-renderers/form-renderer';
import { removeKeys, uploadPixels } from '@/entities/form-renderers/d/jia-pixels';
import { bakeJiaGenome } from '@/entities/form-renderers/d/genome/bake';
import {
  DOORFRAME_ID,
} from '@/entities/form-renderers/d/genome/doorframe';
import {
  JIA_GENOME_WALK_FRAMES,
  type JiaGenomeGait,
} from '@/entities/form-renderers/d/genome/gait';
import {
  STREET_WRECKAGE_ID,
} from '@/entities/form-renderers/d/genome/street-wreckage';
import type { PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import type { Facing4 } from '@/types/game-types';

/** 固着呼吸：与生产甲 idle 伸缩同量级，不用巡路滑步。 */
const IDLE_SX = [1, 1.03, 1, 0.97];
const IDLE_SY = [1, 0.96, 1, 1.04];

function isAnchoredFloorJia(substrate: string): boolean {
  return substrate === STREET_WRECKAGE_ID || substrate === DOORFRAME_ID;
}

function poseKey(facing: Facing4, signal: FormVisualSignal): string {
  return `${facing}_${signal}`;
}

function breathFrame(src: PaintBuf, frame: number, originX: number, originY: number): PaintBuf {
  const sx = IDLE_SX[frame] ?? 1;
  const sy = IDLE_SY[frame] ?? 1;
  const dst: PaintBuf = {
    data: new Uint8ClampedArray(src.w * src.h * 4),
    w: src.w,
    h: src.h,
  };
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      const nx = Math.round(originX + (x - originX) * sx);
      const ny = Math.round(originY + (y - originY) * sy);
      if (nx < 0 || ny < 0 || nx >= src.w || ny >= src.h) continue;
      const j = (ny * src.w + nx) * 4;
      dst.data[j] = src.data[i]!;
      dst.data[j + 1] = src.data[i + 1]!;
      dst.data[j + 2] = src.data[i + 2]!;
      dst.data[j + 3] = src.data[i + 3]!;
    }
  }
  return dst;
}

class JiaGenomeVisual implements FormVisual {
  private readonly scene: Phaser.Scene;
  private readonly ctx: FormAttachContext;
  private readonly image: Phaser.GameObjects.Image;
  private readonly keys: string[] = [];
  private readonly baked = new Set<string>();
  private readonly breathByPose = new Map<string, string[]>();
  private readonly staticByPose = new Map<string, string>();
  private readonly walkByPose = new Map<string, string[]>();
  private readonly anchored: boolean;
  private readonly stemBase: string;
  private originX = 0;
  private originY = 0;
  private canvasW = 32;
  private canvasH = 32;
  private clock = 0;

  constructor(ctx: FormAttachContext) {
    this.scene = ctx.scene;
    this.ctx = ctx;
    this.anchored = isAnchoredFloorJia(ctx.form.substrate);
    const prefix = ctx.textureNamespace ? `${ctx.textureNamespace}_` : '';
    this.stemBase = `${prefix}d_genome_${ctx.form.substrate}_${ctx.form.coverage}_${(ctx.seed >>> 0).toString(16)}`;
    this.ensurePose('down', 'idle');
    const start = this.textureFor('down', 'idle', 'idle', 0);
    this.image = ctx.scene.add.image(0, 0, start);
    this.image.setDepth(ctx.depth);
    this.image.setOrigin(this.originX / this.canvasW, this.originY / this.canvasH);
    this.image.setRotation(0);
  }

  update(pose: FormVisualPose): void {
    this.clock += pose.deltaMs;
    this.ensurePose(pose.facing4, pose.signal);
    let gait: JiaGenomeGait = 'idle';
    let frame = 0;
    if (this.anchored) {
      frame = pingPongFrame(this.clock, 3);
    } else if (pose.moving) {
      gait = 'walk';
      this.ensureWalk(pose.facing4, pose.signal);
      frame = pingPongFrame(this.clock, 6);
    }
    const key = this.textureFor(pose.facing4, pose.signal, gait, frame);
    if (this.image.texture.key !== key) this.image.setTexture(key);
    this.image.setPosition(pose.x, pose.y);
    this.image.setRotation(0);
    applyFormVisibility(this.image, pose.visibility);
  }

  destroy(): void {
    this.image.destroy();
    removeKeys(this.scene, this.keys);
  }

  private textureFor(
    facing: Facing4,
    signal: FormVisualSignal,
    gait: JiaGenomeGait,
    frame: number,
  ): string {
    const id = poseKey(facing, signal);
    if (this.anchored) {
      const breaths = this.breathByPose.get(id);
      return breaths?.[frame] ?? breaths?.[0] ?? this.staticByPose.get(id)!;
    }
    if (gait === 'walk') {
      const walks = this.walkByPose.get(id);
      return walks?.[frame] ?? walks?.[0] ?? this.staticByPose.get(id)!;
    }
    return this.staticByPose.get(id)!;
  }

  private ensurePose(facing: Facing4, signal: FormVisualSignal): void {
    const id = poseKey(facing, signal);
    if (this.baked.has(id)) return;
    const baked = bakeJiaGenome({
      substrate: this.ctx.form.substrate,
      coverage: this.ctx.form.coverage,
      seed: this.ctx.seed,
      facing4: facing,
      signal,
      sense: this.ctx.form.lexemes.sense,
    });
    this.originX = baked.canvas.originX;
    this.originY = baked.canvas.originY;
    this.canvasW = baked.canvas.w;
    this.canvasH = baked.canvas.h;
    const stem = `${this.stemBase}_${baked.canvas.w}x${baked.canvas.h}_${facing}_${signal}`;
    if (this.anchored) {
      const breathKeys: string[] = [];
      for (let frame = 0; frame < 4; frame++) {
        const key = `${stem}_breath_${frame}`;
        breathKeys.push(key);
        this.keys.push(key);
        uploadPixels(this.scene, key, breathFrame(baked.buf, frame, baked.canvas.originX, baked.canvas.originY));
      }
      this.breathByPose.set(id, breathKeys);
    } else {
      this.keys.push(stem);
      uploadPixels(this.scene, stem, baked.buf);
      this.staticByPose.set(id, stem);
    }
    this.baked.add(id);
  }

  private ensureWalk(facing: Facing4, signal: FormVisualSignal): void {
    const id = poseKey(facing, signal);
    if (this.walkByPose.has(id)) return;
    this.ensurePose(facing, signal);
    const walkKeys: string[] = [];
    for (let frame = 0; frame < JIA_GENOME_WALK_FRAMES; frame++) {
      const baked = bakeJiaGenome({
        substrate: this.ctx.form.substrate,
        coverage: this.ctx.form.coverage,
        seed: this.ctx.seed,
        facing4: facing,
        signal,
        sense: this.ctx.form.lexemes.sense,
        gait: 'walk',
        frame,
      });
      const key = `${this.stemBase}_${baked.canvas.w}x${baked.canvas.h}_${facing}_${signal}_walk_${frame}`;
      walkKeys.push(key);
      this.keys.push(key);
      uploadPixels(this.scene, key, baked.buf);
    }
    this.walkByPose.set(id, walkKeys);
  }
}

export function attachJiaGenomeD(ctx: FormAttachContext): FormVisual {
  return new JiaGenomeVisual(ctx);
}
