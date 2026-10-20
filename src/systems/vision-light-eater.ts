/** Isolated optical art study: one shoulder lamp, swallowed light and a separate
 * cold assimilation signal. This module does not alter production balance data. */
export const LIGHT_EATER_CLEAR_RADIUS = 232;
export const LIGHT_EATER_PIXEL = 2;
export const LIGHT_EATER_FRAME_MS = 50;

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function smooth(n: number): number { const t = clamp01(n); return t * t * (3 - 2 * t); }
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

export interface LightEaterState {
  pollution: number;
  assimilation: number;
  lampX: number;
  lampY: number;
  bodyX: number;
  bodyY: number;
  elapsedMs: number;
}
export interface LightEaterSample {
  warm: number;
  cold: number;
  transmission: number;
  reaction: number;
  residue: number;
}
export function createLightEaterSample(): LightEaterSample {
  return { warm: 0, cold: 0, transmission: 0, reaction: 0, residue: 0 };
}

/** P consumes the real lamp. A never enlarges or recolours that light. */
export function lightEaterLampRadius(pollution: number): number {
  return LIGHT_EATER_CLEAR_RADIUS - 100 * smooth(pollution / 100);
}
export function lightEaterExtent(pollution: number, assimilation: number): number {
  const warm = lightEaterLampRadius(pollution);
  return warm + (LIGHT_EATER_CLEAR_RADIUS - warm) * smooth(assimilation / 100);
}

/** One continuous field for DEV queries and the 2px mask. LOS remains external. */
export function sampleLightEater(out: LightEaterSample, x: number, y: number, state: Readonly<LightEaterState>): LightEaterSample {
  const p = clamp01(state.pollution / 100), a = smooth(state.assimilation / 100);
  const seconds = Math.floor(state.elapsedMs / LIGHT_EATER_FRAME_MS) * LIGHT_EATER_FRAME_MS / 1000;
  const distance = Math.hypot(x - state.lampX, y - state.lampY);
  const bodyDistance = Math.hypot(x - state.bodyX, y - state.bodyY);
  const protectedBody = smooth((bodyDistance - 22) / 36);
  // Two independent world-anchored layers drift through one another. The large
  // lobes consume light; the broken fronts make the consumption readable.
  const broad = noise((x + seconds * 7.4) / 89, (y - seconds * 4.3) / 73);
  const detail = noise((x - seconds * 4.2) / 29, (y + seconds * 5.1) / 37);
  const density = smooth((broad * 0.76 + detail * 0.24 - 0.27) / 0.47);
  const front = 1 - smooth(Math.abs(detail - 0.52) / 0.21);
  const pressure = 0.08 + p * 0.92;
  const lampRadius = lightEaterLampRadius(state.pollution);
  // Native material lighting already attenuates the lamp. Preserve its readable
  // middle field; the visibility mask mainly owns the consuming front.
  const clean = 1 - smooth((distance - lampRadius * 0.66) / (lampRadius * 0.34));
  const eatenRadius = lampRadius - (8 + p * 38) * density;
  const bitten = 1 - smooth((distance - eatenRadius * 0.64) / (eatenRadius * 0.36));
  const inward = smooth((distance - 32) / Math.max(30, lampRadius * 0.55));
  const consumption = pressure * density * inward * protectedBody;
  out.warm = bitten * (1 - consumption * 0.64);
  if (bodyDistance < 22) out.warm = Math.max(out.warm, 1 - smooth(bodyDistance / 32) * 0.09);
  const coldRadius = lightEaterExtent(state.pollution, state.assimilation);
  const coldFalloff = 1 - smooth((distance - 44) / Math.max(1, coldRadius - 44));
  const beyondLamp = smooth((distance - lampRadius * 0.56) / 42);
  out.cold = a * 0.38 * coldFalloff * beyondLamp * (0.48 + density * 0.52);
  // The cold signal can recover detail only within its own finite envelope.
  if (distance >= coldRadius) out.cold = 0;
  if (distance >= lampRadius) out.warm = 0;
  out.transmission = Math.max(out.warm, out.cold);
  if (out.transmission < 1 / 255) out.transmission = 0;
  // Reaction belongs to missing light, not the circular support boundary.
  out.reaction = Math.max(0, clean - out.warm) * (0.4 + front * 0.6) * pressure * protectedBody;
  // A very dark full-frame afterimage contains no terrain or object information.
  out.residue = pressure * density * front * protectedBody;
  return out;
}

export interface LightEaterPaint extends LightEaterState {
  width: number;
  worldX: number;
  worldY: number;
}

/** LOS admission is cached independently of P/A and animation. Texture contents
 * contain only an alpha/tint mask; terrain is never copied into unknown cells. */
export function paintLightEater(
  pixels: Uint8ClampedArray, admission: Float32Array, transmission: Float32Array,
  paint: Readonly<LightEaterPaint>, scratch: LightEaterSample,
): void {
  const extent = lightEaterExtent(paint.pollution, paint.assimilation);
  for (let i = 0; i < admission.length; i++) {
    const x = paint.worldX + (i % paint.width + 0.5) * LIGHT_EATER_PIXEL;
    const y = paint.worldY + (Math.floor(i / paint.width) + 0.5) * LIGHT_EATER_PIXEL;
    sampleLightEater(scratch, x, y, paint);
    const offset = i * 4;
    const inEnvelope = Math.hypot(x - paint.lampX, y - paint.lampY) + Math.SQRT2 < extent;
    const visible = admission[i]! > 0 && inEnvelope ? scratch.transmission : 0;
    transmission[i] = visible;
    const opaque = 1 - visible;
    const coldMix = visible > 0 ? scratch.cold / Math.max(0.001, scratch.cold + scratch.warm) * Math.sqrt(scratch.cold / 0.38) : 0;
    const reaction = visible > 0 ? scratch.reaction : 0;
    // Pixel-colour response remains below the real material. No broad green wash:
    // green is strongest in interrupted light, cold only where A admits detail.
    pixels[offset] = 1 + scratch.residue * 2 + coldMix * 10 + reaction * 35;
    pixels[offset + 1] = 2 + scratch.residue * 4 + coldMix * 25 + reaction * 110;
    pixels[offset + 2] = 2 + scratch.residue * 3 + coldMix * 25 + reaction * 77;
    pixels[offset + 3] = Math.round(opaque * 255);
  }
}
