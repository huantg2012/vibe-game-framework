/** One presentation clock for distant load transfer and its delayed sound.
 * No walkable surface is moved by this purely scenic cycle. */
export const VISTA_CYCLE_SECONDS = 26;
export const VISTA_SOUND_SOURCE = Object.freeze({ x: 520, y: 760 });
const smooth = (x: number): number => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
export function vistaMotion(seconds: number) {
  const t = ((seconds % VISTA_CYCLE_SECONDS) + VISTA_CYCLE_SECONDS) % VISTA_CYCLE_SECONDS;
  const pulse = (delay: number): number => smooth((t - 5 - delay) / 5) * (1 - smooth((t - 13 - delay) / 7));
  return { time: t, load: pulse(0), response: pulse(1.4),
    friction: smooth((t - 8.2) / 2.2) * (1 - smooth((t - 13.5) / 4)),
    stage: t < 5 ? 'rest' : t < 10 ? 'loading' : t < 15 ? 'bearing' : t < 22 ? 'release' : 'rest' };
}

/** Deterministic PCM used by both runtime and the listening fixture. */
export function createVistaSoundSamples(rate: number, staticBed = false): Float32Array {
  const result = new Float32Array(Math.round(rate * VISTA_CYCLE_SECONDS));
  let seed = 0x51ad, low = 0, mid = 0, previous = 0;
  for (let i = 0; i < result.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const white = seed / 2147483648 - 1;
    low += (white - low) * .009; mid += (white - mid) * .09;
    const t = i / rate, state = vistaMotion(staticBed ? 0 : t);
    const grain = .65 + .35 * Math.sin(t * 19 + Math.sin(t * 3.7));
    const resonance = Math.sin(2 * Math.PI * 53 * t + .5 * Math.sin(t * .7)) * .014
      + Math.sin(2 * Math.PI * 79 * t) * .008;
    const signal = low * (.16 + state.load * .5) + (mid - low) * state.friction * .24 * grain
      + resonance * state.response;
    // Tiny DC blocker; periodic endpoints are quiet and crossfaded by envelope.
    result[i] = signal - previous * .995; previous = signal;
    result[i] = result[i]! + signal * .92;
  }
  const fade = Math.floor(rate * .4);
  for (let i = 0; i < fade; i++) { result[i]! *= i / fade; result[result.length - 1 - i]! *= i / fade; }
  return result;
}
