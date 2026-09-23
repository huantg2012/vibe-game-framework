import { integrityPlacementIsSafe, placeIntegrityReadout, type IntegrityPlacement,
  type IntegrityPlacementInput, type IntegrityRect, type IntegritySide } from './chamber-integrity-placement';

export const INTEGRITY_TIMING = {
  enterDistance: 44, exitDistance: 58, dwellMs: 120, enterMs: 160,
  leaveGraceMs: 250, leaveMs: 180, sideOutMs: 60, sideInMs: 140,
} as const;

export interface IntegrityObservationCandidate<T extends string> {
  readonly id: T;
  readonly distance: number;
  /** Real visible area, independent of the foot collider and operation route. */
  readonly visible: boolean;
}
export interface IntegritySelection<T extends string> { readonly selectedId: T | null; readonly active: boolean }

/** One sticky observation owner. Keep ownership through the outgoing fade so
 * two nearby objects cannot both display a primary reading. */
export class ChamberIntegritySelection<T extends string> {
  private selected: T | null = null;
  private pending: T | null = null;
  private pendingMs = 0;
  private outsideMs = 0;
  private retiringMs: number | null = null;

  update(deltaMs: number, candidates: readonly IntegrityObservationCandidate<T>[], focusedId: T | null = null): IntegritySelection<T> {
    const dt = Math.max(0, Math.min(deltaMs, 100));
    if (focusedId !== null) {
      this.selected = focusedId;
      this.pending = null;
      this.pendingMs = this.outsideMs = 0;
      this.retiringMs = null;
      return { selectedId: focusedId, active: true };
    }
    const current = candidates.find(candidate => candidate.id === this.selected);
    if (current?.visible && current.distance <= INTEGRITY_TIMING.exitDistance) {
      this.outsideMs = 0;
      this.retiringMs = null;
      this.pending = null;
      this.pendingMs = 0;
      return { selectedId: this.selected, active: true };
    }
    const nearest = candidates.filter(candidate => candidate.visible && candidate.distance <= INTEGRITY_TIMING.enterDistance)
      .reduce<IntegrityObservationCandidate<T> | null>((best, candidate) => !best || candidate.distance < best.distance ? candidate : best, null);
    if (nearest?.id !== this.pending) {
      this.pending = nearest?.id ?? null;
      this.pendingMs = 0;
    }
    if (this.pending !== null) this.pendingMs += dt;
    if (this.selected !== null) {
      this.outsideMs += dt;
      // Occlusion has no visual grace: the scene immediately masks this module.
      if (current?.visible && this.outsideMs <= INTEGRITY_TIMING.leaveGraceMs)
        return { selectedId: this.selected, active: true };
      // Fade starts on this actual update, not at the theoretical grace boundary.
      // A dropped frame must not hand ownership over while the old gauge is lit.
      this.retiringMs = this.retiringMs === null ? 0 : this.retiringMs + dt;
      if (this.retiringMs < INTEGRITY_TIMING.leaveMs)
        return { selectedId: this.selected, active: false };
      this.selected = null;
      this.retiringMs = null;
    }
    if (this.pending !== null && this.pendingMs >= INTEGRITY_TIMING.dwellMs) {
      this.selected = this.pending;
      this.pending = null;
      this.pendingMs = this.outsideMs = 0;
      this.retiringMs = null;
    }
    return { selectedId: this.selected, active: this.selected !== null };
  }

  reset(): void { this.selected = this.pending = null; this.pendingMs = this.outsideMs = 0; this.retiringMs = null; }
}

export type IntegritySurface = 'world' | 'focused';
export interface IntegrityPresentation { readonly placement: IntegrityPlacement; readonly opacity: number }
interface Fade { from: number; to: number; start: number; duration: number }
interface SideState {
  placement: IntegrityPlacement;
  device: IntegrityRect;
  opacity: number;
  phase: 'steady' | 'out' | 'settle' | 'in';
  startedAt: number;
  from: number;
  pendingSide: IntegritySide;
}
const interpolate = (fade: Fade, now: number): number =>
  fade.from + (fade.to - fade.from) * Math.max(0, Math.min(1, (now - fade.start) / fade.duration));

/** Shared by the world graphic and the DOM view. At most one surface has alpha;
 * side changes fade in place and never interpolate a rectangle through an actor. */
export class ChamberIntegrityLifecycle {
  private observed = false;
  private focused = false;
  private surface: IntegritySurface | null = null;
  private desired: IntegritySurface | null = null;
  private alpha = 0;
  private fade: Fade | null = null;
  private readonly sides: Partial<Record<IntegritySurface, SideState>> = {};

  setObserved(active: boolean, now: number, immediate = false): void {
    this.observed = active;
    if (immediate && !this.focused) {
      this.surface = this.desired = null;
      this.alpha = 0;
      this.fade = null;
    }
    this.requestSurface(now);
  }

  setFocused(active: boolean, now: number): void {
    if (active === this.focused) return;
    this.focused = active;
    this.requestSurface(now);
  }

  private requestSurface(now: number): void {
    this.advance(now);
    const desired = this.focused ? 'focused' : this.observed ? 'world' : null;
    if (desired === this.desired) return;
    const wasFocused = this.desired === 'focused';
    this.desired = desired;
    if (this.surface === null) {
      this.surface = desired;
      this.alpha = 0;
      this.fade = desired ? { from: 0, to: 1, start: now, duration: INTEGRITY_TIMING.enterMs } : null;
    } else if (this.surface === desired) {
      // A return inside 58px cancels the stale exit without restarting from zero.
      this.fade = { from: this.alpha, to: 1, start: now, duration: INTEGRITY_TIMING.enterMs * (1 - this.alpha) || 1 };
    } else {
      this.fade = { from: this.alpha, to: 0, start: now,
        duration: desired || wasFocused ? INTEGRITY_TIMING.sideOutMs : INTEGRITY_TIMING.leaveMs };
    }
  }

  private advance(now: number): void {
    if (!this.fade) return;
    this.alpha = interpolate(this.fade, now);
    if (now < this.fade.start + this.fade.duration) return;
    const completedAt = this.fade.start + this.fade.duration;
    const outgoing = this.fade.to === 0;
    this.fade = null;
    if (outgoing) {
      this.surface = this.desired;
      if (this.surface) {
        this.fade = { from: 0, to: 1, start: completedAt, duration: INTEGRITY_TIMING.sideInMs };
        this.alpha = interpolate(this.fade, now);
      }
    }
  }

  sample(surface: IntegritySurface, input: IntegrityPlacementInput, now: number): IntegrityPresentation {
    this.advance(now);
    const previous = this.sides[surface];
    const candidate = placeIntegrityReadout({ ...input, previousSide: previous?.placement.side });
    if (this.surface !== surface || this.alpha <= 0) return { placement: candidate, opacity: 0 };
    if (!candidate.visible) {
      if (previous) { previous.opacity = 0; previous.phase = 'settle'; previous.startedAt = now; }
      return { placement: candidate, opacity: 0 };
    }
    if (!previous) {
      this.sides[surface] = { placement: candidate, device: input.device, opacity: 1, phase: 'steady',
        startedAt: now, from: 1, pendingSide: candidate.side };
      return { placement: candidate, opacity: this.alpha };
    }
    // Preserve the old side's anchor under this frame's camera. Width/gap are in
    // the caller's coordinate space, so DOM width stays fixed during zoom.
    const left = previous.placement.side === 'left'
      ? input.device.left - input.gap - input.width : input.device.right + input.gap;
    const scaleY = (input.device.bottom - input.device.top) / (previous.device.bottom - previous.device.top || 1);
    const relativeY = previous.placement.rect.top - (previous.device.top + previous.device.bottom) / 2;
    const top = (input.device.top + input.device.bottom) / 2 + relativeY * scaleY;
    const retained: IntegrityPlacement = { side: previous.placement.side, visible: true,
      rect: { left, top, right: left + input.width, bottom: top + input.height } };
    const safe = integrityPlacementIsSafe(retained.rect, input);

    if (!safe && previous.phase !== 'settle') {
      // The weapon/lamp may enter a previously clear gauge in one frame. Hide
      // immediately; a visible fade-out here would preserve the actual overlap.
      previous.opacity = 0;
      previous.phase = 'settle';
      previous.startedAt = now;
      previous.pendingSide = candidate.side;
    }
    if (previous.phase === 'settle') {
      if (candidate.side !== previous.pendingSide) {
        previous.pendingSide = candidate.side;
        previous.startedAt = now;
      }
      previous.placement = candidate;
      if (now - previous.startedAt >= INTEGRITY_TIMING.sideOutMs) {
        previous.phase = 'in'; previous.from = 0; previous.startedAt += INTEGRITY_TIMING.sideOutMs;
      }
    } else if (candidate.side !== previous.placement.side && previous.phase !== 'out') {
      previous.phase = 'out'; previous.from = previous.opacity; previous.startedAt = now;
    }
    if (previous.phase === 'out') {
      previous.placement = retained;
      previous.opacity = interpolate({ from: previous.from, to: 0, start: previous.startedAt, duration: INTEGRITY_TIMING.sideOutMs }, now);
      if (candidate.side === previous.placement.side) {
        previous.phase = 'in'; previous.from = previous.opacity; previous.startedAt = now;
      } else if (now - previous.startedAt >= INTEGRITY_TIMING.sideOutMs) {
        previous.placement = candidate;
        previous.phase = 'in'; previous.from = 0; previous.startedAt += INTEGRITY_TIMING.sideOutMs;
      }
    }
    if (previous.phase === 'in') {
      previous.placement = candidate;
      previous.opacity = interpolate({ from: previous.from, to: 1, start: previous.startedAt, duration: INTEGRITY_TIMING.sideInMs }, now);
      if (previous.opacity >= 1) previous.phase = 'steady';
    } else if (previous.phase === 'steady') previous.placement = candidate;
    previous.device = input.device;
    const finalSafe = integrityPlacementIsSafe(previous.placement.rect, input);
    return { placement: previous.placement, opacity: finalSafe ? this.alpha * previous.opacity : 0 };
  }
}
