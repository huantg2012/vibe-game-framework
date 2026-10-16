import type Phaser from 'phaser';
import type { CrowbarQuality, CrowbarVariant } from '@/art/crowbar-pixels';
import type { WeaponAttackPose } from '@/systems/weapon-swing';
/** Presentation-only delegation. Player retains physics; Combat retains every clock. */
export interface PlayerExternalVisuals {
  setWeaponVisual(quality:CrowbarQuality|null,variant?:CrowbarVariant):void;
  setWeaponAttackPose(pose:Readonly<WeaponAttackPose>):void;
  getHitFlashImages():readonly Phaser.GameObjects.Image[];
  getVisualBounds(out:Phaser.Geom.Rectangle):Phaser.Geom.Rectangle;
}
