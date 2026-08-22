import type Phaser from 'phaser';
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

export interface FormVisualPose {
  x: number;
  y: number;
  facing4: 'up' | 'down' | 'left' | 'right';
  moving: boolean;
  visibility: number;
  signal: FormVisualSignal;
  deltaMs: number;
}

export interface FormVisual {
  update(pose: FormVisualPose): void;
  destroy(): void;
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
  /** 观察院子当前碎片。方案 D 用来推配色。 */
  fragmentTypeId?: string;
  /**
   * Optional texture-key prefix (gallery). Sortie must omit.
   * When set, 甲 / 丙 / 丁 keys become `${textureNamespace}_` + the production stem.
   * `destroy()` must remove the prefixed keys.
   */
  textureNamespace?: string;
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
