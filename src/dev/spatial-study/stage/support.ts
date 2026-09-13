import { WEAPON_DATA } from '@/generated/weapon-data';
import type { ContaminationForm } from '@/generation/contamination-draw';
import type { ContaminantType } from '@/types/game-types';
import type { RiftPresentationView } from './bridge';

/** Explicit renderer capabilities, not a replacement gameplay catalogue. */
export const STAGE_TOOL_TYPES: ReadonlySet<ContaminantType> = new Set(['stitch', 'compress', 'siphon', 'kindle', 'muffle']);

export function supportsStageForm(form: Pick<ContaminationForm, 'substrate' | 'coverage' | 'occupancy'>): boolean {
  return form.occupancy === 'floor' && form.substrate === 'insect_remnant' && form.coverage === 'infiltrate';
}

/** Native models exist for the currently authored crowbar family only. */
export function supportsStageWeapon(definitionId: string): boolean {
  const weapon = WEAPON_DATA[definitionId];
  return !!weapon && weapon.type === 'crowbar' && weapon.profileId === 'crowbar';
}

export function assertStagePresentationSupported(frame: RiftPresentationView): void {
  if (frame.player.weaponDefinitionId !== null && !supportsStageWeapon(frame.player.weaponDefinitionId))
    throw new Error(`Stage has no held model for ${frame.player.weaponDefinitionId}`);
  for (const enemy of frame.enemies) if (enemy.substrate !== 'insect_remnant' || enemy.coverage !== 'infiltrate')
    throw new Error(`Stage has no actor model for ${enemy.substrate}/${enemy.coverage}`);
  for (const type of frame.tools.loadoutTypes) if (type !== null && !STAGE_TOOL_TYPES.has(type))
    throw new Error(`Stage has no ability presentation for ${type}`);
}

/** Combat's elapsedMs and contactElapsedMs are whole-swing times. */
export function stageWeaponPhaseProgress(pose: RiftPresentationView['player']['attack']): number {
  let elapsed = pose.contactRemainingMs > 0 ? pose.contactElapsedMs ?? pose.elapsedMs : pose.elapsedMs;
  const phase = pose.contactRemainingMs > 0 && pose.phase !== 'idle' ? 'active' : pose.phase;
  if (phase === 'windup') elapsed /= Math.max(1, pose.windupMs);
  else if (phase === 'active') elapsed = (elapsed - pose.windupMs) / Math.max(1, pose.activeMs);
  else if (phase === 'recovery') elapsed = (elapsed - pose.windupMs - pose.activeMs) / Math.max(1, pose.recoveryMs);
  else return 0;
  return Math.max(0, Math.min(1, elapsed));
}
