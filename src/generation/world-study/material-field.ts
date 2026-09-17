/** One continuous material history for the ground, deposits and torn banks. */
import type { WorldSample } from './types';

function interpolate(sample: WorldSample, values: Float32Array, x: number, y: number): number {
  const gx = Math.max(0, Math.min(sample.cols - 1.001, x / sample.tileSize));
  const gy = Math.max(0, Math.min(sample.rows - 1.001, y / sample.tileSize));
  const col = Math.floor(gx), row = Math.floor(gy), u = gx - col, v = gy - row;
  const i = row * sample.cols + col;
  return (values[i]! * (1 - u) + values[i + 1]! * u) * (1 - v)
    + (values[i + sample.cols]! * (1 - u) + values[i + sample.cols + 1]! * u) * v;
}

export interface MaterialField { amount: number; front: number; direction: number; phase: number }

export function materialFieldAt(sample: WorldSample, x: number, y: number): MaterialField {
  const amount = interpolate(sample, sample.deposition, x, y);
  const direction = interpolate(sample, sample.flowAngle, x, y);
  const phase = amount * 9 + Math.sin(x / 117 + y / 149 + sample.seed % 71) * .18;
  const front = Math.max(0, 1 - Math.abs(amount - .53) / .16);
  return { amount, front, direction, phase };
}
