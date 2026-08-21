import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import type { ContaminationForm } from '@/generation/contamination-draw';
import type {
  FormAttachContext,
  FormVisual,
  FormVisualPose,
} from '@/gym/form-renderers/form-renderer';
import {
  occupancyStamp,
  rhythmPeriodMs,
  salt32,
  senseStamp,
  signedSalt,
  substrateStamp,
  usesDust,
  usesStain,
  usesStrike,
  utteranceStamp,
  veilStamp,
} from '@/gym/form-renderers/c/layers';
import { STAMP_KEY } from '@/gym/form-renderers/c/stamps';

const TILE = GAME_CONSTANTS.TILE_SIZE;
const MAX_SHARDS = 2;
const MAX_SATS = 8;
const MAX_VOLUME = 42;
const MAX_DUST = 4;
const MAX_VEIL_EXTRA = 6;

function addStamp(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  key: string,
  originX = 0.5,
  originY = 0.5,
): Phaser.GameObjects.Image {
  const image = scene.add.image(0, 0, key);
  image.setOrigin(originX, originY);
  image.setRotation(0);
  image.setVisible(false);
  root.add(image);
  return image;
}

export function createStampVisual(ctx: FormAttachContext): FormVisual {
  return new StampStackVisual(ctx);
}

class StampStackVisual implements FormVisual {
  private root: Phaser.GameObjects.Container | null;
  private readonly form: ContaminationForm;
  private readonly seed: number;
  private readonly pinX: number;
  private readonly pinY: number;
  private readonly pinW: number;
  private readonly pinH: number;
  private readonly occMain: Phaser.GameObjects.Image;
  private readonly occStep: Phaser.GameObjects.Image;
  private readonly shards: Phaser.GameObjects.Image[];
  private readonly sats: Phaser.GameObjects.Image[];
  private readonly volumeTiles: Phaser.GameObjects.Image[];
  private readonly veilExtra: Phaser.GameObjects.Image[];
  private readonly substrate: Phaser.GameObjects.Image;
  private readonly veil: Phaser.GameObjects.Image;
  private readonly sense: Phaser.GameObjects.Image;
  private readonly dust: Phaser.GameObjects.Image[];
  private readonly stain: Phaser.GameObjects.Image;
  private readonly strike: Phaser.GameObjects.Image;
  private readonly utterance: Phaser.GameObjects.Image;
  private clockMs = 0;
  private gaitMs = 0;
  private volumeUsed = 0;

  constructor(ctx: FormAttachContext) {
    const scene = ctx.scene;
    this.form = ctx.form;
    this.seed = ctx.seed;
    this.pinX = ctx.pin?.x ?? 0;
    this.pinY = ctx.pin?.y ?? 0;
    this.pinW = ctx.pin?.width ?? TILE * 2;
    this.pinH = ctx.pin?.height ?? TILE * 2;

    const startX = ctx.form.occupancy === 'volume' ? this.pinX : ctx.pin?.x ?? 0;
    const startY = ctx.form.occupancy === 'volume' ? this.pinY : ctx.pin?.y ?? 0;
    const root = scene.add.container(startX, startY);
    root.setDepth(ctx.depth);
    root.setRotation(0);
    root.setVisible(false);
    this.root = root;

    this.volumeTiles = [];
    if (ctx.form.occupancy === 'volume') {
      for (let i = 0; i < MAX_VOLUME; i++) {
        this.volumeTiles.push(addStamp(scene, root, STAMP_KEY.occVolume, 0, 0));
      }
    }
    this.occMain = addStamp(scene, root, occupancyStamp(ctx.form.occupancy));
    this.occStep = addStamp(scene, root, STAMP_KEY.occFloor);
    this.shards = [];
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.shards.push(addStamp(scene, root, occupancyStamp(ctx.form.occupancy)));
    }
    this.sats = [];
    for (let i = 0; i < MAX_SATS; i++) {
      this.sats.push(addStamp(scene, root, STAMP_KEY.contSat));
    }
    this.substrate = addStamp(scene, root, substrateStamp(ctx.form.substrate));
    this.veilExtra = [];
    for (let i = 0; i < MAX_VEIL_EXTRA; i++) {
      this.veilExtra.push(addStamp(scene, root, STAMP_KEY.veilThick));
    }
    this.veil = addStamp(scene, root, veilStamp(ctx.form.coverage));
    this.sense = addStamp(scene, root, senseStamp(ctx.form.lexemes.sense));
    this.dust = [];
    for (let i = 0; i < MAX_DUST; i++) {
      this.dust.push(addStamp(scene, root, STAMP_KEY.contactDust));
    }
    this.stain = addStamp(scene, root, STAMP_KEY.contactStain);
    this.strike = addStamp(scene, root, STAMP_KEY.contactStrike);
    const utt = utteranceStamp(ctx.form.utteranceId);
    this.utterance = addStamp(scene, root, utt ?? STAMP_KEY.uttOpen);
  }

  update(pose: FormVisualPose): void {
    const root = this.root;
    if (!root) return;
    this.clockMs += pose.deltaMs;
    root.setRotation(0);
    if (pose.visibility <= 0) {
      root.setVisible(false);
      return;
    }
    root.setVisible(true);

    const form = this.form;
    const occ = form.occupancy;
    if (occ === 'volume') {
      root.setPosition(this.pinX, this.pinY);
    } else if (occ === 'wall' || occ === 'paint') {
      root.setPosition(pose.x, pose.y);
    } else {
      root.setPosition(pose.x, pose.y);
    }

    this.hideAll();
    this.layoutOccupancy(pose);
    this.layoutContinuity(pose);
    this.layoutSubstrateVeil(pose);
    this.layoutSense(pose);
    this.layoutContact(pose);
    this.layoutUtterance(pose);
    this.applyPlayback(pose);
  }

  destroy(): void {
    this.root?.destroy(true);
    this.root = null;
  }

  private hideAll(): void {
    this.occMain.setVisible(false).setScale(1).setAlpha(1).setFlipX(false);
    this.occStep.setVisible(false).setScale(1).setAlpha(0.7).setFlipX(false);
    for (const img of this.shards) img.setVisible(false).setAlpha(0.7).setFlipX(false);
    for (const img of this.sats) img.setVisible(false).setScale(1).setAlpha(1);
    for (const img of this.volumeTiles) img.setVisible(false).setAlpha(0.8);
    for (const img of this.veilExtra) img.setVisible(false);
    this.substrate.setVisible(false).setAlpha(1).setFlipX(false);
    this.veil.setVisible(false).setFlipX(false);
    this.sense.setVisible(false).setAlpha(1).setCrop();
    for (const img of this.dust) img.setVisible(false);
    this.stain.setVisible(false);
    this.strike.setVisible(false).setAlpha(1);
    this.utterance.setVisible(false);
  }

  private layoutOccupancy(pose: FormVisualPose): void {
    this.volumeUsed = 0;
    const occ = this.form.occupancy;
    const flip = pose.facing4 === 'left';
    if (occ === 'floor') {
      this.occMain.setTexture(STAMP_KEY.occFloor).setVisible(true).setPosition(0, -1).setFlipX(flip);
      this.occStep.setTexture(STAMP_KEY.occFloor);
      return;
    }
    if (occ === 'wall') {
      this.occMain.setTexture(STAMP_KEY.occWall).setVisible(true).setPosition(0, 0);
      return;
    }
    if (occ === 'paint') {
      this.occMain.setTexture(STAMP_KEY.occPaint).setVisible(true).setPosition(0, 0);
      return;
    }
    this.volumeUsed = this.placeVolumeTiles(0);
  }

  private placeVolumeTiles(startIndex: number, shiftX = 0): number {
    const cols = Math.max(1, Math.ceil(this.pinW / TILE));
    const rows = Math.max(1, Math.ceil(this.pinH / 16));
    const field = this.form.continuity === 'field';
    const overwrite = this.form.coverage === 'overwrite';
    const infiltrate = this.form.coverage === 'infiltrate';
    const inset = this.form.continuity === 'monolith' ? TILE : 0;
    const row0 = field ? 0 : Math.max(0, Math.floor(rows / 2) - 1);
    const row1 = field ? rows : row0 + 1;
    let n = startIndex;
    for (let r = row0; r < row1; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * TILE + inset + shiftX;
        if (inset > 0 && (x < inset || x + TILE > this.pinW - inset)) continue;
        if (infiltrate && ((c + r) & 1) === 1) continue;
        const tile = this.volumeTiles[n];
        if (!tile) return n;
        tile.setVisible(true).setPosition(x, r * 16);
        tile.setAlpha(overwrite ? 0.92 : 0.72);
        n += 1;
        if (n >= this.volumeTiles.length) return n;
      }
    }
    return n;
  }

  private layoutContinuity(pose: FormVisualPose): void {
    const c = this.form.continuity;
    if (c === 'shards') {
      for (let i = 0; i < MAX_SHARDS; i++) {
        const img = this.shards[i];
        if (!img) continue;
        img.setTexture(occupancyStamp(this.form.occupancy));
        img.setVisible(true);
        img.setPosition(signedSalt(this.seed, 10 + i, 8), signedSalt(this.seed, 20 + i, 8));
        img.setFlipX(pose.facing4 === 'left');
      }
      return;
    }
    if (c === 'colony') {
      this.placeSats(4, 11);
      return;
    }
    if (c === 'field') {
      if (this.form.occupancy === 'paint') this.placeSats(8, 18);
    }
  }

  private placeSats(count: number, radius: number): void {
    const n = Math.min(count, MAX_SATS);
    const rot = (salt32(this.seed, 3) % 40) * (Math.PI / 180);
    for (let i = 0; i < n; i++) {
      const img = this.sats[i];
      if (!img) continue;
      const a = rot + (i * Math.PI * 2) / n;
      img.setVisible(true).setPosition(Math.cos(a) * radius, Math.sin(a) * radius);
    }
  }

  private layoutSubstrateVeil(pose: FormVisualPose): void {
    const showSub = this.form.coverage !== 'overwrite';
    const cx = this.form.occupancy === 'volume' ? pose.x - this.pinX : 0;
    const cy = this.form.occupancy === 'volume' ? pose.y - this.pinY : 0;
    this.substrate.setTexture(substrateStamp(this.form.substrate));
    this.substrate.setVisible(showSub).setPosition(cx, cy + (this.form.occupancy === 'floor' ? -1 : 0));
    this.veil.setTexture(veilStamp(this.form.coverage)).setVisible(true).setPosition(cx, cy);
    if (this.form.occupancy === 'volume' && this.form.coverage === 'overwrite') {
      for (let i = 0; i < MAX_VEIL_EXTRA; i++) {
        const img = this.veilExtra[i];
        if (!img) continue;
        const col = i % 3;
        const row = Math.floor(i / 3);
        img.setVisible(true).setPosition(col * TILE * 2 + TILE, row * 32 + 16);
      }
    }
  }

  private layoutSense(pose: FormVisualPose): void {
    const sense = this.form.lexemes.sense;
    this.sense.setTexture(senseStamp(sense)).setVisible(true);
    const dist = this.form.occupancy === 'floor' ? 9 : 6;
    if (this.form.occupancy === 'floor') {
      if (pose.facing4 === 'up') this.sense.setPosition(0, -dist);
      else if (pose.facing4 === 'down') this.sense.setPosition(0, dist);
      else if (pose.facing4 === 'left') this.sense.setPosition(-dist, 0);
      else this.sense.setPosition(dist, 0);
    } else if (this.form.occupancy === 'wall') {
      if (sense === 'sense_touch') this.sense.setPosition(4, 8);
      else if (sense === 'sense_hear') this.sense.setPosition(1, 0);
      else this.sense.setPosition(4, 0);
    } else if (this.form.occupancy === 'paint') {
      if (sense === 'sense_touch') this.sense.setPosition(0, 8);
      else this.sense.setPosition(0, 0);
    } else {
      this.sense.setPosition(pose.x - this.pinX, pose.y - this.pinY);
    }
    if (sense === 'sense_narrow') this.sense.setCrop(1, 2, 1, 8);
    else this.sense.setCrop();
  }

  private layoutContact(pose: FormVisualPose): void {
    if (usesDust(this.form)) {
      const feet = this.form.occupancy === 'floor';
      for (let i = 0; i < MAX_DUST; i++) {
        const img = this.dust[i];
        if (!img) continue;
        const ox = signedSalt(this.seed, 40 + i, 6);
        const oy = feet ? 8 + (i % 3) : signedSalt(this.seed, 50 + i, 5);
        img.setVisible(true).setPosition(ox, oy);
      }
    }
    if (usesStain(this.form)) {
      const x = this.form.occupancy === 'volume' ? pose.x - this.pinX : 0;
      const y = this.form.occupancy === 'volume' ? pose.y - this.pinY + 6 : 8;
      this.stain.setVisible(true).setPosition(x, y);
    }
    if (usesStrike(this.form) || pose.signal === 'strike') {
      const x = this.form.occupancy === 'wall' ? 8 : 0;
      this.strike.setVisible(true).setPosition(x, 0);
    }
  }

  private layoutUtterance(pose: FormVisualPose): void {
    const key = utteranceStamp(this.form.utteranceId);
    if (!key) return;
    const cx = this.form.occupancy === 'volume' ? pose.x - this.pinX : 0;
    const cy = this.form.occupancy === 'volume' ? pose.y - this.pinY - 8 : this.form.occupancy === 'floor' ? -10 : 0;
    this.utterance.setTexture(key).setVisible(true).setPosition(cx, cy);
  }

  private applyPlayback(pose: FormVisualPose): void {
    const motion = this.form.lexemes.motion;
    const rhythm = this.form.lexemes.rhythm;
    const period = rhythmPeriodMs(rhythm);
    const phase = (this.clockMs / period) % 1;
    const wave = Math.sin(phase * Math.PI * 2);
    const square = phase < 0.5;

    if (this.form.occupancy === 'floor') {
      const flip = pose.facing4 === 'left';
      this.occMain.setFlipX(flip);
      this.occStep.setFlipX(flip);
      this.substrate.setFlipX(flip);
      this.veil.setFlipX(flip);
      if (pose.moving && motion === 'motion_patrol') {
        this.gaitMs += pose.deltaMs;
        const t = this.gaitMs % 320;
        this.occMain.y = t < 200 ? 0 : -1;
        this.occStep.setVisible(true).setPosition(t < 160 ? -4 : 4, 4);
      } else {
        this.gaitMs = pose.moving ? this.gaitMs : 0;
        this.occMain.y = 0;
      }
      if (motion === 'motion_turn' && pose.moving) {
        this.occMain.x = square ? 0 : 1;
      } else {
        this.occMain.x = 0;
      }
      if (motion === 'motion_coalesce') {
        const k = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(phase * Math.PI * 2));
        this.substrate.setPosition(6 * k, -1);
        this.veil.setPosition(4 * k, 0);
        for (const img of this.shards) {
          img.x *= k;
          img.y *= k;
        }
      }
    }

    if (this.form.occupancy === 'wall') {
      if (motion === 'motion_wall') this.occMain.y = wave * 7;
      else this.occMain.y = 0;
      if (pose.signal === 'strike') {
        this.occMain.x = 1;
        this.strike.setAlpha(1);
      } else {
        this.occMain.x = 0;
        if (usesStrike(this.form)) this.strike.setAlpha(0.45);
      }
    }

    if (this.form.occupancy === 'paint') {
      const infl =
        pose.signal === 'inflated' || rhythm === 'rhythm_cluster' || motion === 'motion_cluster';
      const amp = infl ? 1 + 0.14 * (0.5 + 0.5 * wave) : 1;
      this.occMain.setScale(amp);
      for (const img of this.sats) {
        if (!img.visible) continue;
        img.setScale(amp);
        img.x *= infl && wave > 0.2 ? 1.08 : 1;
      }
      if (infl && wave > 0.35) {
        const extra = this.sats[6];
        const extra2 = this.sats[7];
        extra?.setVisible(true).setPosition(0, -16 * amp);
        extra2?.setVisible(true).setPosition(0, 16 * amp);
      }
      if (motion === 'motion_wind') {
        this.occMain.x = wave * 2;
      }
    }

    if (this.form.occupancy === 'volume') {
      if (motion === 'motion_trail') {
        this.volumeUsed = this.placeVolumeTiles(this.volumeUsed, -8);
      }
      if (motion === 'motion_wind' || motion === 'motion_trail') {
        const dx = wave * 3;
        for (const img of this.volumeTiles) {
          if (img.visible) img.x += dx;
        }
      }
      const coreX = pose.x - this.pinX;
      const coreY = pose.y - this.pinY;
      this.sense.x = coreX;
      this.sense.y = coreY;
      this.utterance.x = coreX;
      this.utterance.y = coreY - 8;
      if (pose.signal === 'awake') this.sense.setAlpha(1);
      else if (this.form.lexemes.sense === 'sense_reverse') this.sense.setAlpha(0.35);
      if (rhythm === 'rhythm_sky') {
        const a = 0.45 + 0.35 * (0.5 + 0.5 * wave);
        for (const img of this.volumeTiles) {
          if (img.visible) img.setAlpha(a);
        }
      }
    }

    if (rhythm === 'rhythm_sleep') {
      this.sense.setAlpha(0.18);
      this.occMain.setAlpha(0.7);
    } else if (rhythm === 'rhythm_pulse') {
      this.sense.setAlpha(square ? 1 : 0.15);
    } else if (rhythm === 'rhythm_open' && this.form.occupancy !== 'volume') {
      this.sense.setAlpha(1);
    }

    this.occMain.setRotation(0);
    this.occStep.setRotation(0);
    this.substrate.setRotation(0);
    this.veil.setRotation(0);
    this.sense.setRotation(0);
  }
}
