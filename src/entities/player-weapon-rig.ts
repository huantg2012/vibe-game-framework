import Phaser from 'phaser';
import { renderCrowbarPixels, type CrowbarQuality, type CrowbarVariant } from '@/art/crowbar-pixels';
import type { WeaponAttackPose } from '@/systems/weapon-swing';
import type { Facing4 } from '@/types/game-types';

export interface CrowbarRigPose {
  handX: number; handY: number; elbowX: number; elbowY: number;
  shoulderX: number; shoulderY: number; rotation: number;
  torsoRotation: number; torsoX: number; torsoY: number; behind: boolean;
}

const limit = (value: number): number => Math.max(0, Math.min(1, value));
const ease = (value: number): number => { const t = limit(value); return t * t * (3 - 2 * t); };

/** Shared pose curve; feet stay in the physics sprite while shoulder, elbow and wrist move. */
export function sampleCrowbarRig(
  out: CrowbarRigPose, facing: Facing4, facingAngle: number, pose: Readonly<WeaponAttackPose> | null,
  elapsed: number, walking: boolean,
): void {
  const active = !!pose && pose.phase !== 'idle';
  const angle = active ? pose.facing : facingAngle;
  const gait = Math.sin(elapsed / (walking ? 105 : 680));
  let sweep = .55, extension = 7, twist = 0;
  if (active) {
    const wind = pose.windupMs, end = wind + pose.activeMs;
    const t = pose.elapsedMs;
    if (t < wind) {
      const k = ease(t / wind);
      sweep = .55 + (-Math.PI / 3 - .55) * k;
      extension = 7 + k * 11;
      twist = -k;
    } else if (t <= end) {
      const k = limit((t - wind) / pose.activeMs);
      sweep = -Math.PI / 3 + k * Math.PI * 2 / 3;
      extension = 18;
      twist = -1 + 2 * k;
    } else {
      const k = ease((t - end) / pose.recoveryMs);
      sweep = Math.PI / 3 + (.55 - Math.PI / 3) * k;
      extension = 18 + (7 - 18) * k;
      twist = 1 - k;
    }
  } else {
    sweep += gait * (walking ? .12 : .035);
    extension += gait * (walking ? .8 : .15);
  }
  const reachAngle = angle + sweep;
  const fx = Math.cos(angle), fy = Math.sin(angle);
  const sideX = -fy, sideY = fx;
  out.shoulderX = fx * 3 + sideX * 4;
  out.shoulderY = fy * 3 + sideY * 4 - 3;
  out.handX = Math.cos(reachAngle) * extension;
  out.handY = Math.sin(reachAngle) * extension - 1;
  out.elbowX = out.shoulderX * .45 + out.handX * .55 + sideX * 3;
  out.elbowY = out.shoulderY * .45 + out.handY * .55 + sideY * 3;
  // World sprite points upward; rotate around its actual (16,24) grip, never its bounds.
  out.rotation = reachAngle + Math.PI / 2;
  out.torsoRotation = twist * .09 * (facing === 'left' ? -1 : 1);
  out.torsoX = fx * twist * 1.3;
  out.torsoY = fy * twist * .8 - (active ? Math.abs(twist) * .5 : 0);
  out.behind = Math.sin(reachAngle) < -.25;
}

export class PlayerWeaponRig {
  private readonly weapon: Phaser.GameObjects.Image;
  private readonly upper: Phaser.GameObjects.Image;
  private readonly arm: Phaser.GameObjects.Graphics;
  private equipped = false;
  private heldContactMs = 0;
  private lastContactRemainingMs = 0;
  private readonly pose: CrowbarRigPose = {
    handX: 0, handY: 0, elbowX: 0, elbowY: 0, shoulderX: 0, shoulderY: 0,
    rotation: 0, torsoRotation: 0, torsoX: 0, torsoY: 0, behind: false,
  };
  private readonly heldPose: CrowbarRigPose = { ...this.pose };

  constructor(private readonly scene: Phaser.Scene, private readonly body: Phaser.GameObjects.Image) {
    this.upper = scene.add.image(body.x, body.y, body.texture.key).setOrigin(.5, 22 / 32).setCrop(0, 0, 32, 22).setVisible(false);
    // A 32px asset is an authoring canvas, not the held object's physical length.
    // Keep the shared grip fixed; the iron itself occupies about 18 world pixels.
    this.weapon = scene.add.image(0, 0, body.texture.key)
      .setOrigin(16 / 32, 24 / 32).setScale(.68).setVisible(false);
    this.arm = scene.add.graphics().setVisible(false);
  }

  equip(quality: CrowbarQuality | null, variant: CrowbarVariant = 'standard'): void {
    // Phaser may destroy the display list before Combat receives scene shutdown.
    // Its final swing cancellation must not rebind an already destroyed image.
    if (!this.body.scene || !this.weapon.scene) return;
    this.equipped = quality !== null;
    if (!quality) {
      this.torsoOffset.x = 0; this.torsoOffset.y = 0; this.torsoOffset.rotation = 0;
      this.body.setCrop();
      this.upper.setVisible(false); this.weapon.setVisible(false); this.arm.setVisible(false);
      return;
    }
    const key = `crowbar-held-${quality}-${variant}`;
    if (!this.scene.textures.exists(key)) {
      const pixels = renderCrowbarPixels(quality, variant, 'world');
      const texture = this.scene.textures.createCanvas(key, 32, 32);
      if (!texture) throw new Error(`Could not create ${key}`);
      const data = texture.context.createImageData(32, 32);
      data.data.set(pixels.data);
      texture.context.putImageData(data, 0, 0);
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.weapon.setTexture(key);
    this.body.setCrop(0, 22, 32, 10);
    this.upper.setVisible(true); this.weapon.setVisible(true); this.arm.setVisible(true);
  }

  sync(facing: Facing4, angle: number, attack: Readonly<WeaponAttackPose> | null, elapsed: number, walking: boolean, dt: number): void {
    if (!this.equipped || !this.body.scene || !this.weapon.scene) return;
    sampleCrowbarRig(this.pose, facing, angle, attack, elapsed, walking);
    const contact = attack?.contactRemainingMs ?? 0;
    if (contact > this.lastContactRemainingMs) {
      if (attack?.contactElapsedMs !== undefined) {
        Object.assign(this.contactPose, attack);
        this.contactPose.elapsedMs = attack.contactElapsedMs;
        this.contactPose.phase = 'active';
        sampleCrowbarRig(this.heldPose, facing, angle, this.contactPose, elapsed, walking);
      } else Object.assign(this.heldPose, this.pose);
      this.heldContactMs = contact + dt;
    }
    this.lastContactRemainingMs = contact;
    this.heldContactMs = Math.max(0, this.heldContactMs - dt);
    const pose = this.heldContactMs > 0 ? this.heldPose : this.pose;
    this.torsoOffset.x = pose.torsoX; this.torsoOffset.y = pose.torsoY; this.torsoOffset.rotation = pose.torsoRotation;
    const x = this.body.x, y = this.body.y, depth = this.body.depth;
    // The segmented torso and held object belong to the same actor silhouette.
    // Device-focus fading must not leave an opaque torso over the readout.
    this.upper.setAlpha(this.body.alpha); this.weapon.setAlpha(this.body.alpha); this.arm.setAlpha(this.body.alpha);
    this.upper.setTexture(this.body.texture.key).setCrop(0, 0, 32, 22);
    this.upper.setPosition(x + pose.torsoX, y + 6 + pose.torsoY).setRotation(pose.torsoRotation).setDepth(depth + .02);
    this.weapon.setPosition(x + pose.handX, y + pose.handY).setRotation(pose.rotation).setDepth(depth + (pose.behind ? -.02 : .04));
    this.arm.setDepth(depth + (pose.behind ? -.01 : .05));
    this.arm.clear();
    // Blocky sleeves plus a gloved hand cover the grip. No detached indicator or fan.
    this.arm.lineStyle(4, 0x342c26, 1);
    this.arm.beginPath();
    this.arm.moveTo(Math.round(x + pose.shoulderX), Math.round(y + pose.shoulderY));
    this.arm.lineTo(Math.round(x + pose.elbowX), Math.round(y + pose.elbowY));
    this.arm.lineTo(Math.round(x + pose.handX), Math.round(y + pose.handY));
    this.arm.strokePath();
    this.arm.fillStyle(0x625446, 1);
    this.arm.fillRect(Math.round(x + pose.elbowX) - 1, Math.round(y + pose.elbowY) - 1, 2, 2);
    this.arm.fillStyle(0x28251e, 1);
    this.arm.fillRect(Math.round(x + pose.handX) - 1, Math.round(y + pose.handY) - 1, 3, 3);
  }

  /** The shoulder lamp follows the chest transform while the sole light stays grounded. */
  getTorsoOffset(): Readonly<{ x: number; y: number; rotation: number }> {
    return this.torsoOffset;
  }
  private readonly torsoOffset = { x: 0, y: 0, rotation: 0 };
  private readonly contactPose: WeaponAttackPose = {
    phase: 'idle', elapsedMs: 0, facing: 0, windupMs: 120, activeMs: 60, recoveryMs: 220,
    contactHoldMs: 24, contactRemainingMs: 0,
  };

  destroy(): void { this.upper.destroy(); this.weapon.destroy(); this.arm.destroy(); }
}
