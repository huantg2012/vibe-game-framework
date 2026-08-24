/**
 * Shared palette grouping / in-group quantize (I6-B).
 *
 * Hex list is copied from `docs/art/palette.json` and must stay byte-identical.
 * L1 pools and teal family follow `docs/art/rift-fragment-surfaces.md` (I6-A).
 * Unconstrained `nearestPalette` is not a production success path for L1/L2.
 */

export type Rgb = readonly [number, number, number];

export type TemperatureGroup = 'WARM' | 'COOL' | 'OLIVE' | 'NEUTRAL';

/** Byte-identical to `docs/art/palette.json` `colors`. */
export const PALETTE_HEX = [
  '#080a0c',
  '#0a0b0d',
  '#0d1114',
  '#151a1e',
  '#2a2420',
  '#1e2228',
  '#2a2018',
  '#24221e',
  '#1a1e18',
  '#2c2e33',
  '#3a3d42',
  '#4a4e55',
  '#5a5f66',
  '#8a5c2a',
  '#c4873a',
  '#1a7a9a',
  '#0e4a3f',
  '#1a6b5c',
  '#1aad96',
  '#2ae6c8',
  '#3cffd4',
  '#7fffee',
  '#4adf8a',
  '#b0fff5',
  '#e0a848',
  '#2e2d30',
  '#2a2a2e',
  '#3a3838',
  '#1a1c1f',
  '#2a1f1c',
  '#8a8f96',
  '#c8cdd4',
  '#cc3333',
  '#b89040',
  '#2a2d32',
  '#0f1114',
] as const;

export const PALETTE: readonly Rgb[] = PALETTE_HEX.map(hexToRgb);

/** Same set as `measure:ground-teal` / `tools/contam-preview/measure-ground-teal.ts`. */
export const TEAL_FAMILY_HEX = [
  '#0e4a3f',
  '#1a6b5c',
  '#1aad96',
  '#2ae6c8',
  '#3cffd4',
  '#7fffee',
  '#b0fff5',
  '#4adf8a',
  '#1a7a9a',
] as const;

export const TEAL_FAMILY: readonly Rgb[] = TEAL_FAMILY_HEX.map(hexToRgb);

export const TEAL_FAMILY_SET: ReadonlySet<string> = new Set(TEAL_FAMILY_HEX);

/** L2 deep / mid subset (I6-A). Core and glow are single cells. */
export const TEAL_SUBSET_DEEP_MID_HEX = ['#0e4a3f', '#1a6b5c', '#1a7a9a'] as const;
export const TEAL_SUBSET_CORE_HEX = ['#1aad96'] as const;
export const TEAL_SUBSET_GLOW_HEX = ['#2ae6c8'] as const;

export const TEAL_SUBSET_DEEP_MID: readonly Rgb[] = TEAL_SUBSET_DEEP_MID_HEX.map(hexToRgb);
export const TEAL_SUBSET_CORE: readonly Rgb[] = TEAL_SUBSET_CORE_HEX.map(hexToRgb);
export const TEAL_SUBSET_GLOW: readonly Rgb[] = TEAL_SUBSET_GLOW_HEX.map(hexToRgb);

const L3_WARM_HEX = ['#8a5c2a', '#c4873a'] as const;
const L4_GLOW_HEX = ['#e0a848'] as const;
const UI_HEX = ['#8a8f96', '#c8cdd4', '#2a2d32', '#0f1114'] as const;
const DANGER_HEX = ['#cc3333'] as const;
const WARNING_HEX = ['#b89040'] as const;

const L1_EXCLUDED_HEX: ReadonlySet<string> = new Set<string>([
  ...TEAL_FAMILY_HEX,
  ...L3_WARM_HEX,
  ...L4_GLOW_HEX,
  ...UI_HEX,
  ...DANGER_HEX,
  ...WARNING_HEX,
]);

const L1_MEAN_MAX = 55;
const CHROMA_TIE_EPS = 1e-9;

function hexToRgb(hex: string): Rgb {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export { hexToRgb };

export function rgbToHexString(rgb: Rgb): string {
  return (
    '#' +
    [rgb[0], rgb[1], rgb[2]]
      .map((v) => clamp255(v).toString(16).padStart(2, '0'))
      .join('')
  );
}

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function meanRgb(rgb: Rgb): number {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}

function sameRgb(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function rgbDist2(a: Rgb, b: Rgb): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function chromaDir(rgb: Rgb): readonly [number, number, number] {
  const m = Math.max(1e-6, meanRgb(rgb));
  return [rgb[0] / m, rgb[1] / m, rgb[2] / m];
}

function chromaDist2(a: Rgb, b: Rgb): number {
  const da = chromaDir(a);
  const db = chromaDir(b);
  return (da[0] - db[0]) ** 2 + (da[1] - db[1]) ** 2 + (da[2] - db[2]) ** 2;
}

export function temperatureGroup(r: number, g: number, b: number): TemperatureGroup {
  if (r - b >= 6) return 'WARM';
  if (b - r >= 6) return 'COOL';
  if (g >= r + 2 && g >= b + 2) return 'OLIVE';
  return 'NEUTRAL';
}

function buildL1Pools(): Record<TemperatureGroup, Rgb[]> {
  const pools: Record<TemperatureGroup, Rgb[]> = {
    WARM: [],
    COOL: [],
    OLIVE: [],
    NEUTRAL: [],
  };
  for (let i = 0; i < PALETTE_HEX.length; i++) {
    const hex = PALETTE_HEX[i]!;
    if (L1_EXCLUDED_HEX.has(hex)) continue;
    const rgb = PALETTE[i]!;
    if (meanRgb(rgb) > L1_MEAN_MAX) continue;
    pools[temperatureGroup(rgb[0], rgb[1], rgb[2])].push(rgb);
  }
  return pools;
}

const L1_POOL_MUTABLE = buildL1Pools();

export const L1_POOL: Readonly<Record<TemperatureGroup, readonly Rgb[]>> = {
  WARM: L1_POOL_MUTABLE.WARM,
  COOL: L1_POOL_MUTABLE.COOL,
  OLIVE: L1_POOL_MUTABLE.OLIVE,
  NEUTRAL: L1_POOL_MUTABLE.NEUTRAL,
};

export function l1Pool(group: TemperatureGroup): readonly Rgb[] {
  return L1_POOL[group];
}

export function nearestPalette(r: number, g: number, b: number): Rgb {
  const target: Rgb = [r, g, b];
  let best = PALETTE[0]!;
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = rgbDist2(p, target);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function pickByChroma(target: Rgb, candidates: readonly Rgb[]): Rgb {
  let best = candidates[0]!;
  let bestChroma = Infinity;
  let bestRgb = Infinity;
  for (const c of candidates) {
    const chroma = chromaDist2(c, target);
    const rgbD = rgbDist2(c, target);
    if (chroma < bestChroma - CHROMA_TIE_EPS) {
      best = c;
      bestChroma = chroma;
      bestRgb = rgbD;
    } else if (Math.abs(chroma - bestChroma) <= CHROMA_TIE_EPS && rgbD < bestRgb) {
      best = c;
      bestRgb = rgbD;
    }
  }
  return best;
}

function unused(candidates: readonly Rgb[], used: readonly Rgb[]): Rgb[] {
  return candidates.filter((c) => !used.some((u) => sameRgb(u, c)));
}

/**
 * In-group pick: chroma direction after mean-normalizing, RGB Euclidean only to break ties.
 * Empty remaining subset → NEUTRAL L1 pool + failure log. Never unconstrained nearest as success.
 */
export function quantizeInGroup(targetRgb: Rgb, subset: readonly Rgb[], used: readonly Rgb[] = []): Rgb {
  const remaining = unused(subset, used);
  if (remaining.length > 0) {
    return pickByChroma(targetRgb, remaining);
  }

  console.warn(
    '[palette-quantize] candidate pool empty after used-filter; falling back to NEUTRAL L1 pool',
  );
  const neutralFree = unused(L1_POOL.NEUTRAL, used);
  if (neutralFree.length > 0) {
    return pickByChroma(targetRgb, neutralFree);
  }

  console.warn(
    '[palette-quantize] NEUTRAL L1 pool also exhausted; returning a NEUTRAL cell, not full-palette nearest',
  );
  const neutral = L1_POOL.NEUTRAL;
  if (neutral.length > 0) {
    return pickByChroma(targetRgb, neutral);
  }
  return PALETTE[0]!;
}

/** L1 path: temperature group of the target, then in-group quantize (NEUTRAL fallback if that pool is empty). */
export function quantizeL1(targetRgb: Rgb, used: readonly Rgb[] = []): Rgb {
  const group = temperatureGroup(targetRgb[0], targetRgb[1], targetRgb[2]);
  const pool = L1_POOL[group];
  if (pool.length === 0) {
    console.warn(
      `[palette-quantize] L1 pool empty for group ${group}; falling back to NEUTRAL`,
    );
    return quantizeInGroup(targetRgb, L1_POOL.NEUTRAL, used);
  }
  return quantizeInGroup(targetRgb, pool, used);
}

/** Contrast-contract floor cell: simulated RGB = floorBv * bias, no painter `+16`. */
export function contrastFloorCell(r: number, g: number, b: number): Rgb {
  return quantizeL1([r, g, b], []);
}
