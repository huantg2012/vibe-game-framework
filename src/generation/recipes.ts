import type { AtmosphereSpec } from '@/generation/atmosphere';
import type { CoverSpec } from '@/generation/cover';
import type { StructureBuildSpec } from '@/generation/structure-grammars';

export type ScatterKind = 'none' | 'thicket' | 'rimMoss' | 'aisleLitter' | 'grassPads';

export interface ScatterLayerSpec {
  readonly kind: ScatterKind;
  readonly vegetation: number;
  readonly wreck: number;
  readonly glitch: number;
}

export interface MapRecipe {
  readonly id: string;
  readonly label: string;
  readonly fragmentTypeId: string;
  readonly structure: StructureBuildSpec;
  readonly cover: CoverSpec;
  readonly scatter: ScatterLayerSpec;
  readonly atmosphere: AtmosphereSpec;
}

export const PREVIEW_RECIPES: readonly MapRecipe[] = [
  {
    id: 'ridge-soil',
    label: '吞没褶脊',
    fragmentTypeId: 'frag-outdoor',
    structure: { grammar: 'ridge', density: 0.55, gapiness: 0.45, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 2, remains: 2, hollows: 1, cuts: 2, cycle: ['clump', 'plate'] },
    scatter: { kind: 'thicket', vegetation: 0.12, wreck: 0.04, glitch: 2 },
    atmosphere: { skyShadow: 0.68, fog: 0.82, motes: 36, seep: 0.28, poolRim: 0.35, poolHollow: 0.25, poolOpen: 0.4 },
  },
  {
    id: 'shear-soil',
    label: '土壤撕缝',
    fragmentTypeId: 'frag-outdoor',
    structure: { grammar: 'shear', density: 0.5, gapiness: 0.4, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 1, remains: 2, hollows: 2, cuts: 2, cycle: ['clump', 'plate'] },
    scatter: { kind: 'thicket', vegetation: 0.1, wreck: 0.03, glitch: 3 },
    atmosphere: { skyShadow: 0.72, fog: 0.76, motes: 28, seep: 0.38, poolRim: 0.28, poolHollow: 0.5, poolOpen: 0.22 },
  },
  {
    id: 'hunks-soil',
    label: '园缘残体',
    fragmentTypeId: 'frag-outdoor',
    structure: { grammar: 'hunks', density: 0.7, gapiness: 0.5, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ['clump'] },
    scatter: { kind: 'thicket', vegetation: 0.08, wreck: 0.07, glitch: 1 },
    atmosphere: { skyShadow: 0.58, fog: 0.7, motes: 24, seep: 0.22, poolRim: 0.42, poolHollow: 0.28, poolOpen: 0.3 },
  },
  {
    id: 'rim-soil',
    label: '沿缘残体',
    fragmentTypeId: 'frag-outdoor',
    structure: { grammar: 'rim', density: 0.8, gapiness: 0.4, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ['clump'] },
    scatter: { kind: 'rimMoss', vegetation: 0.14, wreck: 0.05, glitch: 2 },
    atmosphere: { skyShadow: 0.64, fog: 0.92, motes: 32, seep: 0.32, poolRim: 0.7, poolHollow: 0.2, poolOpen: 0.1 },
  },
  {
    id: 'ridge-clinic',
    label: '无菌折脊',
    fragmentTypeId: 'frag-clinic',
    structure: { grammar: 'orthoRidge', density: 0.75, gapiness: 0.28, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ['clump', 'plate'] },
    scatter: { kind: 'none', vegetation: 0, wreck: 0.03, glitch: 2 },
    atmosphere: { skyShadow: 0.82, fog: 0.16, motes: 6, seep: 0.22, poolRim: 0.2, poolHollow: 0.15, poolOpen: 0.65 },
  },
  {
    id: 'shear-clinic',
    label: '瓷面错位',
    fragmentTypeId: 'frag-clinic',
    structure: { grammar: 'shear', density: 0.55, gapiness: 0.28, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 0, remains: 2, hollows: 2, cuts: 2, cycle: ['clump'] },
    scatter: { kind: 'none', vegetation: 0, wreck: 0.05, glitch: 3 },
    atmosphere: { skyShadow: 0.78, fog: 0.2, motes: 8, seep: 0.36, poolRim: 0.18, poolHollow: 0.22, poolOpen: 0.6 },
  },
  {
    id: 'shear-metro',
    label: '锈板撕缝',
    fragmentTypeId: 'frag-metro',
    structure: { grammar: 'shear', density: 0.55, gapiness: 0.4, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ['plate', 'clump'] },
    scatter: { kind: 'none', vegetation: 0, wreck: 0.06, glitch: 3 },
    atmosphere: { skyShadow: 0.52, fog: 0.24, motes: 18, seep: 0.88, poolRim: 0.25, poolHollow: 0.2, poolOpen: 0.55 },
  },
  {
    id: 'hunks-metro',
    label: '嵌板残体',
    fragmentTypeId: 'frag-metro',
    structure: { grammar: 'plates', density: 0.7, gapiness: 0.35, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 0, remains: 2, hollows: 1, cuts: 2, cycle: ['plate', 'clump'] },
    scatter: { kind: 'none', vegetation: 0, wreck: 0.08, glitch: 1 },
    atmosphere: { skyShadow: 0.42, fog: 0.2, motes: 12, seep: 0.48, poolRim: 0.22, poolHollow: 0.18, poolOpen: 0.6 },
  },
  {
    id: 'ridge-library',
    label: '断梁残脊',
    fragmentTypeId: 'frag-library',
    structure: { grammar: 'twinRidge', density: 0.7, gapiness: 0.35, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 1, remains: 2, hollows: 1, cuts: 2, cycle: ['clump'] },
    scatter: { kind: 'aisleLitter', vegetation: 0.04, wreck: 0.06, glitch: 2 },
    atmosphere: { skyShadow: 0.6, fog: 0.56, motes: 22, seep: 0.26, poolRim: 0.3, poolHollow: 0.25, poolOpen: 0.45 },
  },
  {
    id: 'hunks-residential',
    label: '宅基残体',
    fragmentTypeId: 'frag-residential',
    structure: { grammar: 'pads', density: 0.8, gapiness: 0.35, thickness: 2, align: 'free' },
    cover: { align: 'free', trees: 1, remains: 2, hollows: 1, cuts: 1, cycle: ['clump'] },
    scatter: { kind: 'grassPads', vegetation: 0.09, wreck: 0.08, glitch: 2 },
    atmosphere: { skyShadow: 0.55, fog: 0.66, motes: 18, seep: 0.22, poolRim: 0.38, poolHollow: 0.22, poolOpen: 0.4 },
  },
];

export const RECIPE_GALLERY_ORDER: ReadonlyArray<readonly string[]> = [
  ['ridge-soil', 'shear-clinic', 'hunks-metro', 'ridge-library', 'hunks-soil'],
  ['shear-soil', 'hunks-residential', 'ridge-clinic', 'shear-metro', 'rim-soil'],
];

export function recipeById(id: string): MapRecipe {
  const hit = PREVIEW_RECIPES.find((r) => r.id === id);
  if (!hit) throw new Error(`unknown recipe ${id}`);
  return hit;
}
