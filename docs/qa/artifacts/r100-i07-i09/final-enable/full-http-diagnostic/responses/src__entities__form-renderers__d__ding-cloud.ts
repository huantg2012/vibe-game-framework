/**
 * Soft cloud silhouette for scheme D 丁.
 * Outline is a warped ellipse (harmonics + slow phase), not per-pixel hash fill.
 */
import type { CloudHarmonics } from '@/entities/form-renderers/d/ding-recipe';

export interface CloudPose {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly breath: number;
  readonly morphMs: number;
}

function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function radiusMul(theta: number, h: CloudHarmonics, breath: number, morphMs: number): number {
  const p2 = h.p2 + morphMs * 0.00035;
  const p3 = h.p3 + morphMs * 0.00028;
  const p5 = h.p5 + morphMs * 0.00019;
  const n =
    1 +
    h.a2 * Math.sin(2 * theta + p2) +
    h.a3 * Math.sin(3 * theta + p3) +
    h.a5 * Math.sin(5 * theta + p5);
  const d = wrapPi(theta - h.notchA);
  const notch = Math.abs(d) < h.notchW ? 0.82 : 1;
  return Math.max(0.58, n * notch) * breath;
}

export function breathScale(elapsedMs: number, periodMs: number, amp: number, phaseMs = 0): number {
  const period = Math.max(1, periodMs);
  const t = (((elapsedMs + phaseMs) % period) + period) % period;
  return 1 + amp * Math.sin((t / period) * Math.PI * 2);
}

/** 0 at centre, 1 at warped rim, >1 outside. */
export function rimDistance(x: number, y: number, cloud: CloudPose, h: CloudHarmonics): number {
  const dx = x + 0.5 - cloud.cx;
  const dy = y + 0.5 - cloud.cy;
  if (dx === 0 && dy === 0) return 0;
  const theta = Math.atan2(dy / Math.max(1e-4, cloud.ry), dx / Math.max(1e-4, cloud.rx));
  const mul = radiusMul(theta, h, cloud.breath, cloud.morphMs);
  const nx = dx / (cloud.rx * mul);
  const ny = dy / (cloud.ry * mul);
  return Math.hypot(nx, ny);
}

export function contourPoint(
  theta: number,
  cloud: CloudPose,
  h: CloudHarmonics,
  extraPx: number,
): { x: number; y: number } {
  const mul = radiusMul(theta, h, cloud.breath, cloud.morphMs);
  const rx = cloud.rx * mul + extraPx;
  const ry = cloud.ry * mul + extraPx;
  return {
    x: cloud.cx + Math.cos(theta) * rx,
    y: cloud.cy + Math.sin(theta) * ry,
  };
}

export function contourSteps(rx: number, ry: number): number {
  return Math.max(48, Math.ceil(Math.PI * 2 * Math.max(rx, ry)));
}
