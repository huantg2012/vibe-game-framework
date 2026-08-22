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

export interface FormAttachContext {
  scene: Phaser.Scene;
  form: ContaminationForm;
  seed: number;
  depth: number;
  /** 观察院子当前碎片。方案 D 用来推配色。 */
  fragmentTypeId?: string;
  /** 甲可省略。乙=核世界坐标（gymLiveMotion 时为缝）；丙=簇核世界坐标；丁=走廊盒世界像素。 */
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
