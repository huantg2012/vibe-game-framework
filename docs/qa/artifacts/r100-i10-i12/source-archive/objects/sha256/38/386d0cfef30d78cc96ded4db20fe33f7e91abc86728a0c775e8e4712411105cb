/**
 * 夹具骨架：不是七个基体语法里的任何一条。
 * I5-B 用来验收构件 / weld / 画布；I5-D 用夹具验收算子。
 */
import { genomeCanvasOf } from '@/entities/form-renderers/d/genome/canvas';
import type { GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { CoverageId } from '@/generated/contamination-lexicon-data';

export const GENOME_FIXTURE_ID = 'fixture_shell' as const;

function layoutFixtureNodes(w: number, h: number, seed: number, splitNub: boolean): GenomeNode[] {
  const groundY = h - 2;
  const lean = ((seed >>> 0) % 3) - 1;
  const cx = Math.floor(w / 2) + lean;
  const postW = 3;
  const top = Math.max(4, Math.round(h * 0.22));
  const plateH = 3;
  const plateW = postW + 6;
  const postX = cx - Math.floor(postW / 2);
  const postY = top;
  const postH = Math.max(4, groundY - plateH - postY + 1);
  const plateX = cx - Math.floor(plateW / 2);
  const plateY = groundY - plateH;
  const massW = 6;
  const massH = 5;
  const massX = cx - Math.floor(massW / 2);
  const massY = Math.max(1, postY - 3);
  const beamY = postY + Math.max(2, Math.floor(postH * 0.28));
  const nub: GenomeNode = splitNub
    ? { kind: 'nub', x: 1, y: 1, w: 2, h: 2, mat: 'bone', role: 'accent' }
    : { kind: 'nub', x: postX + postW, y: beamY - 1, w: 2, h: 2, mat: 'bone', role: 'accent' };
  return [
    {
      kind: 'plate',
      x: plateX,
      y: plateY,
      w: plateW,
      h: plateH,
      mat: 'concrete',
      role: 'base',
    },
    {
      kind: 'post',
      x: postX,
      y: postY,
      w: postW,
      h: postH,
      mat: 'metal',
      role: 'spine',
    },
    {
      kind: 'beam',
      x: postX - 2,
      y: beamY,
      w: postW + 6,
      h: 2,
      mat: 'metalMid',
      role: 'rib',
    },
    {
      kind: 'mass',
      x: massX,
      y: massY,
      w: massW,
      h: massH,
      mat: 'brick',
      role: 'head',
    },
    {
      kind: 'filament',
      x: postX + postW,
      y: beamY + 1,
      w: 1,
      h: Math.max(3, Math.floor(postH * 0.45)),
      bend: 2,
      mat: 'bone',
      role: 'limb',
    },
    nub,
    {
      kind: 'core',
      x: cx,
      y: massY + 1,
      w: 2,
      h: 2,
      mat: 'glow',
      role: 'accent',
    },
  ];
}

export function buildFixtureSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  splitNub = false,
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  return {
    canvas,
    parts: layoutFixtureNodes(canvas.w, canvas.h, seed, splitNub),
  };
}
