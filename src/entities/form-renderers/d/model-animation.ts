import type { FormVisualPose } from '../form-renderer';

export type ModelPhase = 'idle' | 'walk' | 'alert' | 'windup' | 'strike' | 'recover';
export interface ModelFrame {
  facing: FormVisualPose['facing4'];
  phase: ModelPhase;
  progress: number;
}

/** Shared timing only: each family owns its anatomy, gait and attack poses. */
export class ModelAnimationClock {
  private clock = 0;
  private travelled = 0;
  private previewWindup = 0;
  private wasAttacking = false;

  constructor(private readonly walkCycleMs: number, private readonly stridePixels: number) {}

  advance(pose: FormVisualPose): ModelFrame {
    const dt = Number.isFinite(pose.deltaMs) ? Math.max(0, Math.min(pose.deltaMs, 100)) : 0;
    this.clock += dt;
    let facing = pose.facing4;
    if (pose.attack && pose.attack.phase !== 'idle') {
      this.wasAttacking = true;
      const angle = pose.attack.facingAngle;
      if (angle !== undefined && Number.isFinite(angle)) {
        facing = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))
          ? Math.cos(angle) > 0 ? 'right' : 'left'
          : Math.sin(angle) > 0 ? 'down' : 'up';
      }
      return { facing, phase: pose.attack.phase, progress: Math.max(0, Math.min(1, pose.attack.progress)) };
    }
    if (this.wasAttacking) {
      this.clock = 0;
      this.wasAttacking = false;
    }
    if (!pose.attack && pose.signal === 'strike') return { facing, phase: 'strike', progress: 0 };
    if (!pose.attack && pose.signal === 'inflated') {
      this.previewWindup += dt;
      return { facing, phase: 'windup', progress: Math.min(1, this.previewWindup / 350) };
    }
    this.previewWindup = 0;
    if (pose.moving) {
      // DEV previews have no physics. Production supplies resolved speed, so
      // blocked bodies stop walking and slowdowns slow the gait with the feet.
      const speed = pose.movementSpeed === undefined ? this.stridePixels * 1000 / this.walkCycleMs
        : Number.isFinite(pose.movementSpeed) ? Math.max(0, pose.movementSpeed) : 0;
      if (speed > 0) {
        this.travelled = (this.travelled + speed * dt / 1000) % this.stridePixels;
        return { facing, phase: 'walk', progress: this.travelled / this.stridePixels };
      }
    }
    return { facing, phase: pose.signal === 'awake' || pose.signal === 'inflated' ? 'alert' : 'idle', progress: this.clock / 2400 % 1 };
  }
}
