import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import type { BingRecipe, ShapeKnobs } from '@/gym/form-renderers/d/bing-dialect';
import { BING_PULSE_SAMPLES, hash2 } from '@/gym/form-renderers/d/bing-hash';

const CORE_T = 0.5;

export interface LiveOrganism {
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  phase: number;
  breathAmp: number;
  coreRest: Float32Array;
  shapeRest: Float32Array;
  shapeBase: Float32Array;
  coreBase: Float32Array;
}

function vnoise(x: number, y: number, freq: number, seed: number): number {
  const gx = x * freq;
  const gy = y * freq;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function fillMissingRadii(radii: Float32Array): void {
  const n = radii.length;
  for (let i = 0; i < n; i++) {
    if (radii[i]! >= 1) continue;
    let prev = -1;
    let next = -1;
    for (let k = 1; k < n; k++) {
      if (radii[(i - k + n) % n]! >= 1) {
        prev = (i - k + n) % n;
        break;
      }
    }
    for (let k = 1; k < n; k++) {
      if (radii[(i + k) % n]! >= 1) {
        next = (i + k) % n;
        break;
      }
    }
    if (prev >= 0 && next >= 0) radii[i] = 0.5 * (radii[prev]! + radii[next]!);
    else if (prev >= 0) radii[i] = radii[prev]!;
    else if (next >= 0) radii[i] = radii[next]!;
    else radii[i] = 2;
  }
}

function sampleBlob(
  rng: SeededRandom,
  radius: number,
  knobs: ShapeKnobs,
  phase: number,
  breathAmp: number,
  dx: number,
  dy: number,
): LiveOrganism {
  const r = Math.max(3.2, radius);
  let rx = r * knobs.rxMul;
  let ry = r * knobs.ryMul;
  if (knobs.thin) ry = Math.max(1.2, rx * (0.16 + rng.next() * 0.12));
  const anisotropic = Math.abs(knobs.rxMul - knobs.ryMul) > 0.3 || knobs.thin;
  if (!anisotropic && rng.next() < 0.45) {
    const swap = rx;
    rx = ry;
    ry = swap;
  }
  const rot = anisotropic ? 0 : rng.next() * Math.PI;
  const warp = knobs.warp;
  const lobes = knobs.lobeBias > 0.5 ? rng.nextInt(2, 4) : knobs.lobeBias > 0 ? rng.nextInt(0, 2) : 0;
  const lobeAmp = lobes === 0 ? 0 : 0.12 + rng.next() * 0.32 * knobs.lobeBias;
  const lobePhi = rng.next() * Math.PI * 2;
  const notch = knobs.notch;
  const notch0 = rng.next() * Math.PI * 2;
  const notchW = 0.35 + rng.next() * 0.9;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const reach = Math.ceil(Math.max(rx, ry) * (1 + warp + lobeAmp) + 3);
  const noiseSeed = (rng.next() * 0x7fffffff) | 0;

  const radialT = (px: number, py: number): number | null => {
    const lx = px * cosR + py * sinR;
    const ly = -px * sinR + py * cosR;
    const nx = lx / Math.max(0.8, rx);
    const ny = ly / Math.max(0.8, ry);
    const d = Math.hypot(nx, ny);
    if (d < 1e-4) return 0;
    const ang = Math.atan2(ny, nx);
    if (notch) {
      let delta = ang - notch0;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      if (Math.abs(delta) < notchW * 0.5) return null;
    }
    const n = vnoise(px, py, 0.22, noiseSeed) * 2 - 1;
    const bound = 1 + warp * n + (lobes === 0 ? 0 : lobeAmp * Math.cos(lobes * ang + lobePhi));
    if (d > bound) return null;
    return d / Math.max(0.2, bound);
  };

  const shapeBase = new Float32Array(BING_PULSE_SAMPLES);
  const coreBase = new Float32Array(BING_PULSE_SAMPLES);
  for (let i = 0; i < BING_PULSE_SAMPLES; i++) {
    const ang = (i / BING_PULSE_SAMPLES) * Math.PI * 2;
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    let lastShape = 0;
    let lastCore = 0;
    let seen = false;
    for (let s = 0; s <= reach; s += 0.5) {
      const t = radialT(ux * s, uy * s);
      if (t === null) {
        if (seen) break;
        continue;
      }
      seen = true;
      lastShape = s;
      if (t < CORE_T) lastCore = s;
    }
    shapeBase[i] = lastShape;
    coreBase[i] = lastCore;
  }
  fillMissingRadii(shapeBase);
  fillMissingRadii(coreBase);
  for (let i = 0; i < BING_PULSE_SAMPLES; i++) {
    if (coreBase[i]! > shapeBase[i]!) coreBase[i] = shapeBase[i]!;
    if (coreBase[i]! < 1) coreBase[i] = Math.min(2, shapeBase[i]! * CORE_T);
  }

  return {
    cx: 0,
    cy: 0,
    dx,
    dy,
    phase,
    breathAmp,
    coreRest: new Float32Array(coreBase),
    shapeRest: new Float32Array(shapeBase),
    shapeBase,
    coreBase,
  };
}

export function layoutBingOrganisms(recipe: BingRecipe, seed: number): LiveOrganism[] {
  const rng = new SeededRandom(mix32(seed, 'd-bing-cluster'));
  const sharedPhase = recipe.continuity === 'colony' || recipe.utteranceId === 'cluster_lung';
  const mainPhase = rng.next() * Math.PI * 2;
  const out: LiveOrganism[] = [
    sampleBlob(rng, recipe.mainRadius, recipe.shape, mainPhase, recipe.breathAmp, 0, 0),
  ];
  const n = recipe.satelliteCount;
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2 + rng.next() * 0.4;
    const dist =
      recipe.continuity === 'shards'
        ? recipe.mainRadius * (0.55 + rng.next() * 0.25)
        : recipe.mainRadius * (0.7 + rng.next() * 0.35);
    const phase = sharedPhase ? mainPhase : rng.next() * Math.PI * 2;
    const sat = sampleBlob(
      rng,
      recipe.satRadius,
      recipe.shape,
      phase,
      recipe.breathAmp * 0.85,
      Math.cos(ang) * dist,
      Math.sin(ang) * dist,
    );
    out.push(sat);
  }
  return out;
}
