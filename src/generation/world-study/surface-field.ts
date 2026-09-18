/** Independent deposition, coating and wear histories, connected by local response. */
import { materialFieldAt } from './material-field';
import { materialNoise as noise } from './material-noise';
import { compositionOf, regionFieldAt } from './region-field';
import type { SurfaceRecipe, WorldSample } from './types';

const STEP = 8;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
export interface SurfaceField { coverage: number; wear: number; deposit: number; exposure: number; direction: number; activity: number; quiet: number; accent: number }
export interface SurfaceFields {
  readonly cols: number;
  readonly rows: number;
  readonly step: number;
  readonly coverage: Float32Array;
  readonly wear: Float32Array;
  readonly deposit: Float32Array;
  readonly exposure: Float32Array;
  readonly direction: Float32Array;
  readonly activity: Float32Array;
  readonly quiet: Float32Array;
  readonly accent: Float32Array;
}
const cache = new WeakMap<WorldSample, SurfaceFields>();

export function validateSurfaceRecipe(recipe: SurfaceRecipe): void {
  if (!recipe || !['strata', 'crystal', 'glaze'].includes(recipe.substrate)
    || !['strata', 'crystal', 'glaze'].includes(recipe.coating)) throw new Error('Unsupported material operator');
  const composition = compositionOf(recipe);
  if (!['patches', 'bands', 'clusters'].includes(composition.organization)) throw new Error('Invalid region organization');
  for (const key of ['regionScale', 'quietness', 'formScale', 'fragmentation', 'accentCoverage'] as const) {
    const value = composition[key], isScale = key === 'regionScale' || key === 'formScale';
    if (!Number.isFinite(value) || value < (isScale ? .5 : 0) || value > (isScale ? 2 : 1)) throw new Error(`Invalid composition ${key}`);
  }
  for (const key of ['coverage', 'wear', 'deposits', 'scale', 'relief', 'contrast'] as const) {
    const value = recipe[key], min = key === 'scale' ? .5 : 0, max = key === 'scale' ? 2 : 1;
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid surface ${key}: ${value}`);
  }
}

export function buildSurfaceFields(sample: WorldSample): SurfaceFields {
  const existing = cache.get(sample);
  if (existing) return existing;
  const spec = sample.profile.surface;
  validateSurfaceRecipe(spec);
  const cols = Math.ceil(sample.cols * sample.tileSize / STEP) + 1, rows = Math.ceil(sample.rows * sample.tileSize / STEP) + 1;
  const fields: SurfaceFields = { cols, rows, step: STEP, coverage: new Float32Array(cols * rows),
    wear: new Float32Array(cols * rows), deposit: new Float32Array(cols * rows),
    exposure: new Float32Array(cols * rows), direction: new Float32Array(cols * rows), activity: new Float32Array(cols * rows),
    quiet: new Float32Array(cols * rows), accent: new Float32Array(cols * rows) };
  const seed = sample.seed, scale = spec.scale;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = col * STEP, y = row * STEP, i = row * cols + col;
    const history = materialFieldAt(sample, x, y);
    const region = regionFieldAt(spec, seed, x, y, history.direction);
    const broad = noise(x / (174 * scale), y / (143 * scale), seed ^ 0x5731);
    const patch = noise(x / (58 * scale), y / (67 * scale), seed ^ 0x9811);
    const u = x * Math.cos(history.direction) + y * Math.sin(history.direction);
    const v = -x * Math.sin(history.direction) + y * Math.cos(history.direction);
    const wearSignal = noise(u / (92 * scale), v / (43 * scale), seed ^ 0x6129);
    const abrasion = noise(x / (27 * scale), y / (33 * scale), seed ^ 0x1893);
    const coating = spec.coverage === 0 ? 0 : spec.coverage === 1 ? 1 :
      clamp(.5 + (region.density - .5) * 1.4 + (broad - .5) * .65 + (patch - .5) * .30 + (history.amount - .5) * .24 + (spec.coverage - .5) * 1.4);
    const wear = clamp((wearSignal * .75 + abrasion * .15 + (1 - region.density) * .1) * spec.wear * 1.65);
    const exposure = clamp((wear - .43) * 2.6);
    const coverage = coating * (1 - exposure);
    const front = clamp(1 - Math.abs(coverage - .50) * 4);
    const settling = noise(x / (71 * scale), y / (87 * scale), seed ^ 0x3917);
    fields.coverage[i] = coverage;
    fields.wear[i] = wear;
    fields.exposure[i] = exposure;
    fields.deposit[i] = clamp(spec.deposits * (settling * .3 + region.activity * .65 + front * .35 + exposure * .20)) * (1 - region.quiet * .82);
    fields.activity[i] = region.activity;
    fields.quiet[i] = region.quiet;
    fields.accent[i] = region.accent;
    fields.direction[i] = history.direction;
  }
  cache.set(sample, fields);
  return fields;
}

export function sampleSurfaceField(sample: WorldSample, x: number, y: number): SurfaceField {
  const fields = buildSurfaceFields(sample);
  const gx = Math.max(0, Math.min(fields.cols - 1.001, x / fields.step));
  const gy = Math.max(0, Math.min(fields.rows - 1.001, y / fields.step));
  const col = Math.floor(gx), row = Math.floor(gy), u = gx - col, v = gy - row, i = row * fields.cols + col;
  const sampleValue = (array: Float32Array): number =>
    (array[i]! * (1 - u) + array[i + 1]! * u) * (1 - v)
    + (array[i + fields.cols]! * (1 - u) + array[i + fields.cols + 1]! * u) * v;
  return { coverage: sampleValue(fields.coverage), wear: sampleValue(fields.wear),
    deposit: sampleValue(fields.deposit), exposure: sampleValue(fields.exposure), direction: sampleValue(fields.direction), activity: sampleValue(fields.activity),
    quiet: sampleValue(fields.quiet), accent: sampleValue(fields.accent) };
}
