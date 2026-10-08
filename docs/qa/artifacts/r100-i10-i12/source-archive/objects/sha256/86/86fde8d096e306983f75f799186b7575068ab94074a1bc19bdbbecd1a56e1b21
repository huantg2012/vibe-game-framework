/** Non-damaging control feedback. This clock never changes HP, movement or attacks. */
export interface RestraintPose { pressure: boolean; snared: boolean }

export class RestraintReaction {
  private pressure = 0;
  private snare = 0;
  private wasPressure = false;
  private wasSnared = false;
  private impulseMs = 360;
  private impulseStrength = 0;

  advance(deltaMs: number, pose?: RestraintPose): { scaleX: number; scaleY: number } {
    const dt = Math.max(0, deltaMs);
    const pressure = pose?.pressure ?? false, snared = pose?.snared ?? false;
    // Several overlapping sources are one felt condition, not repeated impacts each frame.
    if ((pressure && !this.wasPressure) || (snared && !this.wasSnared)) {
      this.impulseMs = 0;
      this.impulseStrength = snared && !this.wasSnared ? .13 : .10;
    }
    this.wasPressure = pressure; this.wasSnared = snared;
    this.pressure += ((pressure ? 1 : 0) - this.pressure) * (1 - Math.exp(-dt / (pressure ? 65 : 140)));
    this.snare += ((snared ? 1 : 0) - this.snare) * (1 - Math.exp(-dt / (snared ? 35 : 110)));
    this.impulseMs = Math.min(360, this.impulseMs + dt);
    const t = this.impulseMs / 360;
    const impulse = Math.sin(t * Math.PI * 2) * Math.pow(1 - t, 2) * this.impulseStrength;
    const weight = .11 * this.pressure + .055 * this.snare + impulse;
    if (!pressure && !snared && this.pressure + this.snare < .001 && t === 1) {
      this.pressure = 0; this.snare = 0;
      return { scaleX: 1, scaleY: 1 };
    }
    return { scaleX: 1 + weight * .32, scaleY: 1 - weight };
  }
}
