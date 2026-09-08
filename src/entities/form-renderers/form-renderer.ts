import type Phaser from 'phaser';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { ContaminationForm } from '@/generation/contamination-draw';
import type { FormWallAttach } from '@/generation/wall-edge-path';

export type { FormWallAttach, WallFace } from '@/generation/wall-edge-path';

export const FORM_RENDERER_IDS = [
  'placeholder',
  'a-pixel-grammar',
  'b-surface-organism',
  'c-stamp-compositor',
  'd-mixed',
] as const;
export type FormRendererId = (typeof FORM_RENDERER_IDS)[number];

export type FormVisualSignal = 'idle' | 'strike' | 'inflated' | 'awake';

export interface FormFlashSource {
  readonly textureKey: string;
  readonly originX: number;
  readonly originY: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
}

/** Presentation reads the authoritative combat clock; it never resolves damage. */
export interface FormAttackPose {
  readonly phase: 'idle' | 'windup' | 'strike' | 'recover';
  readonly progress: number;
  readonly facingAngle?: number;
}

export interface FormVisualPose {
  x: number;
  y: number;
  facing4: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
  /** Resolved world displacement speed, not the AI's requested velocity. */
  movementSpeed?: number;
  visibility: number;
  signal: FormVisualSignal;
  deltaMs: number;
  /** Absolute cycle time for isolated volume inspection. Live hosts remain authoritative. */
  volumeTimeMs?: number;
  attack?: FormAttackPose;
  activity?: { readonly phase: 'rest' | 'waking' | 'active'; readonly progress: number };
}

export interface FormVisual {
  update(pose: FormVisualPose): void;
  destroy(): void;
  /** Floor bodies opt in to scene-owned ground sorting; environmental layers stay fixed. */
  setGroundDepth?(depth: number): void;
  /** Snapshot source must be copied before this visual is destroyed. */
  getFlashSource?(): FormFlashSource;
  /** DEV-only material/shape comparison; never changes the generated form or behavior. */
  setReviewCoverage?(coverage: CoverageId | null): void;
  /**
   * World floor tiles that currently show this visual's paint.
   * 丙油膜踩踏读这个；缺省则宿主仍走核旁 Chebyshev。漆不挡路。
   */
  readonly stepFloors?: readonly { readonly col: number; readonly row: number }[];
}

/** Sortie fog: `visibility === 0` hides. Visible bands (1 / 0.6 / 0.2) pass through. Never floor at 0.2. */
export function applyFormVisibility(
  obj: { setAlpha(value: number): unknown; setVisible(value: boolean): unknown },
  visibility: number,
): void {
  if (visibility <= 0) {
    obj.setAlpha(0);
    obj.setVisible(false);
    return;
  }
  obj.setVisible(true);
  obj.setAlpha(visibility);
}

export interface FormAttachContext {
  scene: Phaser.Scene;
  form: ContaminationForm;
  seed: number;
  depth: number;
  /** Stable runtime owner for environmental visuals; avoids nearest-core ambiguity. */
  subjectId?: string;
  /** Explicit world-floor constraint for surface-bound models. Omit in isolated
   * model inspection. False covers walls, void and out-of-map coordinates. */
  isWalkableFloor?: (col: number, row: number) => boolean;
  /** 观察院子当前碎片。方案 D 用来推配色。 */
  fragmentTypeId?: string;
  /**
   * Optional texture-key prefix (gallery). Sortie must omit.
   * When set, 甲 / 丙 / 丁 keys become `${textureNamespace}_` + the production stem.
   * `destroy()` must remove the prefixed keys.
   */
  textureNamespace?: string;
  /**
   * 油膜脉络。0/1/2 = 抽卡课树 tweak；3/4/5 = 生产三变体（聚珠 / 沾抹 / 薄滩）。
   * 出击与地图课省略 = 按该个体种子 `mix32(seed, 'oil_film_variant') % 3` 采样 3/4/5。
   * 练习场可钉变体做对照。
   */
  paintVeinVariant?: 0 | 1 | 2 | 3 | 4 | 5;
  /** 练习场抽卡课放大显示倍数（NEAREST 不失真）。缺省 1。出击不传。 */
  displayScale?: number;
  /**
   * 丁脚底浊点锚点。有则用它；无则读相机中心（出击不变）。
   * 陈列馆浏览态传场地外沉点。
   */
  stainWorldPoint?: { x: number; y: number };
  /** 甲可省略。乙=核世界坐标（liveMotion 时为缝）；丙=簇核世界坐标；丁=走廊盒世界像素。 */
  pin?: {
    kind: 'wall' | 'cluster' | 'volume';
    x: number;
    y: number;
    width?: number;
    height?: number;
    attach?: FormWallAttach; // 仅 kind==='wall'
  };
}

export interface ContaminationFormRenderer {
  readonly id: Exclude<FormRendererId, 'placeholder'>;
  readonly label: string;
  /** 脚手架用：false 时 gym 当现行占位，不藏默认身体。方案落地后改 true。 */
  ready: boolean;
  attach(ctx: FormAttachContext): FormVisual;
}
