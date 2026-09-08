import { BEHAVIOR_PROFILE_DATA } from '@/generated/contamination-capability-data';
import { GAME_CONSTANTS } from '@/config/constants';

export interface ActivityVisualState {
  phase: 'rest' | 'waking' | 'active';
  /** Openness during waking (also decreases through a reverse-sense release). */
  progress: number;
}

/** One authoritative clock shared by behavior and presentation; values originate in CSV. */
export class ActivityClock {
  readonly visual: ActivityVisualState = { phase: 'active', progress: 1 };
  private elapsed = 0;
  private encountered = false;

  constructor(readonly rhythm: string, identity: string) {
    if (rhythm === 'rhythm_sleep') this.visual.phase = 'rest';
    if (rhythm === 'rhythm_pulse') {
      let seed = 2166136261;
      for (let i = 0; i < identity.length; i++) seed = Math.imul(seed ^ identity.charCodeAt(i), 16777619);
      const profile = BEHAVIOR_PROFILE_DATA.rhythm_pulse!;
      this.elapsed = (seed >>> 0) % (profile.restMs + profile.wakeMs + profile.activeMs);
      this.tick(0, false, true);
    }
    if (this.visual.phase === 'rest') this.visual.progress = 0;
  }

  tick(deltaMs: number, stimulus: boolean, calm: boolean): void {
    const dt = Math.max(0, Math.min(deltaMs, GAME_CONSTANTS.AI.DT_CLAMP_MS));
    const state = this.visual;
    if (this.rhythm === 'rhythm_sleep') {
      if (state.phase === 'rest') {
        if (stimulus) { state.phase = 'waking'; state.progress = 0; this.elapsed = 0; }
      } else if (state.phase === 'waking') {
        this.elapsed += dt;
        state.progress = Math.min(1, this.elapsed / BEHAVIOR_PROFILE_DATA.rhythm_sleep!.wakeMs);
        if (state.progress === 1) state.phase = 'active';
      } else {
        if (!calm) this.encountered = true;
        if (calm && this.encountered) {
          this.encountered = false;
          state.phase = 'rest'; state.progress = 0;
        }
      }
    } else if (this.rhythm === 'rhythm_pulse') {
      const profile = BEHAVIOR_PROFILE_DATA.rhythm_pulse!;
      const period = profile.restMs + profile.wakeMs + profile.activeMs;
      this.elapsed = (this.elapsed + dt) % period;
      if (this.elapsed < profile.restMs) { state.phase = 'rest'; state.progress = 0; }
      else if (this.elapsed < profile.restMs + profile.wakeMs) {
        state.phase = 'waking'; state.progress = (this.elapsed - profile.restMs) / profile.wakeMs;
      } else { state.phase = 'active'; state.progress = 1; }
    }
  }
}

/** Looking away starts a visible release, never an instant damage-off switch. */
export class ReverseActivityClock {
  readonly visual: ActivityVisualState = { phase: 'rest', progress: 0 };
  active = false;
  private chargeMs = 0;
  private releaseMs = 0;

  tick(deltaMs: number, watched: boolean): void {
    const dt = Math.max(0, Math.min(deltaMs, GAME_CONSTANTS.AI.DT_CLAMP_MS));
    const profile = BEHAVIOR_PROFILE_DATA.sense_reverse!;
    if (watched) {
      this.releaseMs = 0;
      this.chargeMs = Math.min(profile.wakeMs, this.chargeMs + dt);
      if (this.chargeMs >= profile.wakeMs) this.active = true;
      this.visual.progress = this.chargeMs / profile.wakeMs;
      this.visual.phase = this.active ? 'active' : 'waking';
    } else if (this.active) {
      this.releaseMs += dt;
      this.visual.progress = Math.max(0, 1 - this.releaseMs / profile.releaseMs);
      this.visual.phase = 'waking';
      if (this.releaseMs >= profile.releaseMs) {
        this.active = false; this.chargeMs = 0; this.visual.phase = 'rest';
      }
    } else {
      this.chargeMs = 0; this.visual.phase = 'rest'; this.visual.progress = 0;
    }
  }
}
