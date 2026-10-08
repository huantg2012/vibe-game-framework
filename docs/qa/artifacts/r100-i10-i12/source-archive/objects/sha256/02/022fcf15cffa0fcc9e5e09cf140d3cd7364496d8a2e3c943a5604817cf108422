import type { PlayerRuntimeState } from '@/entities/player';
import type { NativeBodyCollision } from '@/generation/world-study/native-body-collision';
import type { ActiveRiftRecoveryState } from '@/systems/rift-recovery-state';
import { GAME_CONSTANTS } from '@/config/constants';
import { runtimeRecord } from '@/systems/ai/runtime-validation';

export const NATIVE_BODY_GEOMETRY_VERSION = 1;
const EPSILON = 1e-6;
const near = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON;

/** Called only after the complete checkpoint/tool/inventory validators succeed.
 * Old native dash frames used Phaser.reset's texture top-left, omitting its 6px
 * collider offset. Recover only that proven active-dash state. This is a pure
 * copy: original durable bytes and every non-body fact remain authoritative. */
export function nativeRiftPlayerForRestore(state: ActiveRiftRecoveryState,
  collision: Pick<NativeBodyCollision, 'supports'>): PlayerRuntimeState | null {
  if (!runtimeRecord(state.world) || (state.world.bodyGeometryVersion !== undefined
    && state.world.bodyGeometryVersion !== NATIVE_BODY_GEOMETRY_VERSION)) return null;
  const player = state.player, half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
  const offsetX = player.bodyPosition.x + half - player.position.x;
  const offsetY = player.bodyPosition.y + half - player.position.y;
  if (!collision.supports(player.position, half, half)) return null;
  if (near(offsetX, 0) && near(offsetY, 0)) return player;
  if (state.world.bodyGeometryVersion !== undefined || !near(offsetX, -6) || !near(offsetY, -6)
    || player.moving || player.inputEnabled || player.velocity.x !== 0 || player.velocity.y !== 0
    || player.inputVector.x !== 0 || player.inputVector.y !== 0) return null;
  const catalog = state.tools.catalog;
  const dash = catalog?.effects.find(effect => effect.resolvedParams.familyId === 'dash');
  if (!catalog || !dash || catalog.dashCooldownMs !== 0 || dash.remainingTime <= 0
    || dash.remainingTime >= dash.resolvedParams.durationMs
    || !catalog.completedActions.includes(dash.actionId)) return null;
  const dx = dash.position.x - dash.origin.x, dy = dash.position.y - dash.origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0 || distance > dash.resolvedParams.rangePx + EPSILON) return null;
  const progress = 1 - dash.remainingTime / dash.resolvedParams.durationMs;
  if (!near(player.position.x, dash.origin.x + dx * progress)
    || !near(player.position.y, dash.origin.y + dy * progress)) return null;
  return { ...player, bodyPosition: { x: player.position.x - half, y: player.position.y - half } };
}
