/**
 * 甲基因谱节点与构件种类（I5-B 空壳）。
 * 七种共享构件跨基体；禁止在此文件发明第八种。
 * 七个基体的完整骨架语法不在本批。
 */
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Rgba } from '@/entities/form-renderers/d/genome/buffer';

/** 杆 / 梁 / 团 / 座 / 丝 / 碎 / 核 */
export const GENOME_PART_KINDS = [
  'post',
  'beam',
  'mass',
  'plate',
  'filament',
  'nub',
  'core',
] as const;
export type GenomePartKind = (typeof GENOME_PART_KINDS)[number];

export const GENOME_PART_ROLES = [
  'spine',
  'rib',
  'limb',
  'head',
  'base',
  'lintel',
  'accent',
] as const;
export type GenomePartRole = (typeof GENOME_PART_ROLES)[number];

export const GENOME_MATS = [
  'flesh',
  'cloth',
  'bone',
  'earth',
  'brick',
  'metal',
  'metalMid',
  'concrete',
  'shadow',
  'core',
  'glow',
] as const;
export type GenomeMat = (typeof GENOME_MATS)[number];

export type GenomeInk = Record<GenomeMat, Rgba>;

export interface GenomeNode {
  kind: GenomePartKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 丝：从上到下的水平漂移（px）。 */
  bend?: number;
  mat: GenomeMat;
  role?: GenomePartRole;
}

export interface GenomeCanvas {
  readonly w: 32 | 48 | 64;
  readonly h: 32 | 48 | 64;
  readonly originX: number;
  readonly originY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly collision: 20;
  readonly coverage: CoverageId;
}

export interface GenomeSkeleton {
  parts: GenomeNode[];
  readonly canvas: GenomeCanvas;
}
