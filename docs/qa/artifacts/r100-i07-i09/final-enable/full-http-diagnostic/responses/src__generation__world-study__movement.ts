/** Base-state locomotion math, independent from DOM, Phaser and world content. */
import { GAME_CONSTANTS } from '@/config/constants';

export interface WorldStudyVector { x: number; y: number }

/** Writes normalized movement only. Modifier keys do not grant a sprint. */
export function readWorldStudyInput(keys: ReadonlySet<string>, output: WorldStudyVector): void {
  const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
  const y = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
  const length = Math.hypot(x, y);
  output.x = length > 0 ? x / length : 0;
  output.y = length > 0 ? y / length : 0;
}

/**
 * Allocation-free counterpart of Player.stepVelocity, using its shared base
 * speed and ramp constants. The study has no inventory/chaos speed modifiers.
 * `input` comes from readWorldStudyInput; all state is explicit in arguments.
 */
export function stepWorldStudyVelocity(velocity: WorldStudyVector, input: Readonly<WorldStudyVector>, deltaSeconds: number): void {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  const speed = GAME_CONSTANTS.PLAYER.SPEED;
  const targetX = input.x * speed, targetY = input.y * speed;
  const moving = input.x !== 0 || input.y !== 0;
  const rampTime = moving ? GAME_CONSTANTS.PLAYER.MOVE_ACCEL_TIME : GAME_CONSTANTS.PLAYER.MOVE_DECEL_TIME;
  if (rampTime <= 0) { velocity.x = targetX; velocity.y = targetY; return; }
  const maxDelta = speed / rampTime * deltaSeconds;
  const deltaX = targetX - velocity.x, deltaY = targetY - velocity.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance <= maxDelta || distance === 0) {
    velocity.x = targetX; velocity.y = targetY;
  } else {
    const scale = maxDelta / distance;
    velocity.x += deltaX * scale; velocity.y += deltaY * scale;
  }
}
