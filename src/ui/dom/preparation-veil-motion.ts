import type { Grade, Phase } from './preparation-veil-types';

const LEVEL: Readonly<Record<Grade, number>> = { low: 0, medium: 1, severe: 2 };
const ease = (value: number): number => value * value * (3 - 2 * value);

/** Continuous presentation state; independent of wall-clock, timers and DOM. */
export class VeilMotion {
  targetGrade: Grade = 'low';
  phase: Phase = 'pollution';
  currentLevel = 0;
  trailLevel = 0;
  timeSeconds = 0;
  travelPixels = 0;
  phaseSpeed = 1;
  transitionElapsedSeconds = 0;
  transitionActive = false;

  private fromLevel = 0;
  private fromTrail = 0;
  private targetLevel = 0;
  private mainDuration = 0.82;
  private trailDuration = 1.10;
  private trailDelay = 0.14;

  setGrade(grade: Grade, animated: boolean): boolean {
    if (grade === this.targetGrade) return false;
    this.targetGrade = grade;
    this.targetLevel = LEVEL[grade];
    this.fromLevel = this.currentLevel;
    this.fromTrail = this.trailLevel;
    this.transitionElapsedSeconds = 0;
    const entering = this.targetLevel > this.currentLevel;
    this.mainDuration = entering ? 0.82 : 1.02;
    this.trailDelay = entering ? 0.14 : 0.12;
    this.trailDuration = entering ? 1.10 : 1.22;
    this.transitionActive = true;
    if (!animated) this.settle();
    return true;
  }

  setPhase(phase: Phase): boolean {
    if (this.phase === phase) return false;
    this.phase = phase;
    return true;
  }

  /** Freeze only the flow phase; static viewing always shows the target grade. */
  settle(): void {
    this.currentLevel = this.targetLevel;
    this.trailLevel = this.targetLevel;
    this.transitionActive = false;
    this.transitionElapsedSeconds = this.trailDuration + this.trailDelay;
    this.phaseSpeed = this.phase === 'equipment' ? 0.34 : 1;
  }

  advance(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return;
    if (this.transitionActive) {
      this.transitionElapsedSeconds += deltaSeconds;
      const main = Math.min(1, this.transitionElapsedSeconds / this.mainDuration);
      const trail = Math.min(1, Math.max(0, this.transitionElapsedSeconds - this.trailDelay) / this.trailDuration);
      this.currentLevel = this.fromLevel + (this.targetLevel - this.fromLevel) * ease(main);
      this.trailLevel = this.fromTrail + (this.targetLevel - this.fromTrail) * ease(trail);
      if (trail >= 1 && main >= 1) this.transitionActive = false;
    }
    const targetSpeed = this.phase === 'equipment' ? 0.34 : 1;
    this.phaseSpeed += (targetSpeed - this.phaseSpeed) * (1 - Math.exp(-deltaSeconds / 0.30));
    const flowDelta = deltaSeconds * this.phaseSpeed;
    this.timeSeconds += flowDelta;
    // These are logical pixels transported per second, not noise-time nudges.
    this.travelPixels += flowDelta * (12 + this.currentLevel * 8);
  }
}
