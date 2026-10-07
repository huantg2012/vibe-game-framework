/** Frozen material identity. Artist-authored CSV is the only source of values. */
import type { WorldProfile } from './types';
export interface WorldMaterialRamp {
  readonly dark: number;
  readonly mid: number;
  readonly light: number;
}
export const WORLD_GROUND_PATTERNS = ['strata', 'veins', 'plates', 'grains', 'tension', 'flow'] as const;
export type WorldGroundPattern = typeof WORLD_GROUND_PATTERNS[number];
export const WORLD_MATERIAL_ORGANIZATIONS = ['short-fibre', 'porous-marrow', 'short-fibre-loose'] as const;
export type WorldMaterialOrganization = typeof WORLD_MATERIAL_ORGANIZATIONS[number];
export interface R100WorldAppearance {
  readonly version: 1;
  readonly worldId: string;
  readonly ground: WorldMaterialRamp;
  readonly solid: WorldMaterialRamp;
  readonly cleaved: WorldMaterialRamp;
  readonly secondary: WorldMaterialRamp;
  readonly groundPattern: WorldGroundPattern;
  readonly patternScale: number;
  readonly patternStrength: number;
  readonly secondaryCoverage: number;
  readonly textureContrast: number;
  readonly quietCoverage: number;
  /** Absent preserves the accepted material sampling byte for byte. */
  readonly materialOrganization?: WorldMaterialOrganization;
}
const inRange = (value: unknown, low: number, high: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const luminance = (color: number): number => (color >>> 16 & 255) * .2126 + (color >>> 8 & 255) * .7152 + (color & 255) * .0722;
export function validR100WorldAppearance(value: unknown): value is R100WorldAppearance {
  if (!value || typeof value !== 'object') return false;
  const row = value as R100WorldAppearance;
  if (row.version !== 1 || !/^[a-z][a-z0-9-]+$/.test(row.worldId) || !WORLD_GROUND_PATTERNS.includes(row.groundPattern)
    || !inRange(row.patternScale, 48, 256) || !inRange(row.patternStrength, 0, 1)
    || !inRange(row.secondaryCoverage, 0, .6) || !inRange(row.textureContrast, .6, 1.6) || !inRange(row.quietCoverage, .1, .65)
    || (row.materialOrganization !== undefined && !WORLD_MATERIAL_ORGANIZATIONS.includes(row.materialOrganization))) return false;
  return [row.ground, row.solid, row.cleaved, row.secondary].every(ramp => !!ramp
    && [ramp.dark, ramp.mid, ramp.light].every(color => Number.isSafeInteger(color) && inRange(color, 0, 0xffffff))
    && luminance(ramp.dark) < luminance(ramp.mid) && luminance(ramp.mid) < luminance(ramp.light));
}
/** Existing local-material consumers (including search remains) inherit the same
 * role colors. Actor and semantic pollution slots retain their own contract. */
export function profileWithWorldAppearance(profile: WorldProfile, appearance: R100WorldAppearance): WorldProfile {
  const { ground, solid, cleaved } = appearance;
  return { ...profile, palette: { ...profile.palette,
    floorDeep: ground.dark, floor: ground.mid, floorLight: ground.light,
    groundDark: ground.dark, ground: ground.mid, groundLight: ground.light,
    materialDark: solid.dark, materialMid: solid.mid, materialLight: solid.light, faceLight: cleaved.light,
    wallDark: solid.dark, wall: solid.mid, wallLight: solid.light,
  } };
}
