import * as THREE from 'three';
import { WEAPON_ATTACK_PROFILES } from '@/generated/weapon-data';
import type { DeepReadonly, RiftPresentationEnemy, RiftPresentationEvent, RiftPresentationFrame } from './bridge';
import { ACTOR_HEIGHT } from './materials';
import { ActorPixelDrawing, createActorContactShadow } from './actor-pixels';

type PlayerView = DeepReadonly<RiftPresentationFrame['player']>;
type GroundSampler = (x: number, y: number) => number;
const mix = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const face = new Float32Array(24);

// Four purposeful material families. Hue comes from the object, not a PBR sun.
const person = {
  recess: 0x202a2b, boot: 0x2c302e, bootEdge: 0x575850, trouser: 0x434740, trouserLight: 0x64695c,
  coatDark: 0x403f35, coat: 0x716754, coatLight: 0x92856a, coatEdge: 0xb4a389,
  leather: 0x3c352c, leatherLight: 0x625442, stitch: 0x9a896b,
  hood: 0x7e7560, hoodShadow: 0x4e5045, mask: 0x313b3b, glass: 0x9ba79b,
  iron: 0x838b80, ironLight: 0xbdc1ac, lampDark: 0x9a6c35, lamp: 0xe4b66b, lampCore: 0xffe6ae,
} as const;
const insect = {
  recess: 0x172526, leg: 0x303f3e, legLight: 0x5c6c62, shellDeep: 0x344644,
  shell: 0x67746a, shellLight: 0x8c9788, worn: 0xb1b6a1, edge: 0x48594f,
  split: 0x173e3b, stain: 0x285d54, stainLight: 0x477f6c, seam: 0x75a18c,
  membrane: 0x3b5650, membraneEdge: 0x628475, hit: 0xcbd0b5,
} as const;

const bootShape = [-3, -2, 2, -2, 4, 0, 3, 2, -3, 2, -4, 1];
const gloveShape = [-2, -2, 1, -2, 2, 0, 1, 2, -2, 1];
const headShape = [-4, -3, -2, -5, 3, -5, 5, -2, 4, 2, 1, 4, -3, 3, -5, 0];
const headTop = [-3, -3, -1, -5, 2, -5, 4, -3, 1, -2, -3, -2];
const faceMask = [-2, -1, 2, -1, 3, 1, 1, 3, -2, 2];
const handLamp = [-2, -3, 1, -3, 2, -1, 2, 2, -2, 2];

function quad(d: ActorPixelDrawing, colour: number,
  ax: number, ay: number, az: number, bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, bias = 0): void {
  face[0] = ax; face[1] = ay; face[2] = az; face[3] = bx; face[4] = by; face[5] = bz;
  face[6] = cx; face[7] = cy; face[8] = cz; face[9] = dx; face[10] = dy; face[11] = dz;
  d.polygon(face, colour, 4, bias);
}

function bodyPanel(d: ActorPixelDrawing, z: number, colour: number): void {
  face[0] = -7.5; face[1] = 15.7; face[2] = z;
  face[3] = -6.1; face[4] = 29; face[5] = z * .84;
  face[6] = -4.3; face[7] = 33.5; face[8] = z * .6;
  face[9] = 4.1; face[10] = 33.5; face[11] = z * .6;
  face[12] = 6.2; face[13] = 28.5; face[14] = z * .84;
  face[15] = 7.8; face[16] = 16.5; face[17] = z;
  d.polygon(face, colour, 6);
}

/** Pixel silhouette/colour regions for a weathered coat, not a faceted cylinder. */
function coat(d: ActorPixelDrawing): void {
  bodyPanel(d, 4.6, person.coat);
  bodyPanel(d, -4.5, person.coatDark);
  quad(d, person.coatLight, -7.5, 15.7, 4.6, -6.1, 29, 3.9, -6.1, 29, -3.8, -7.5, 15.7, -4.5);
  quad(d, person.coatDark, 7.8, 16.5, 4.6, 6.2, 28.5, 3.9, 6.2, 28.5, -3.8, 7.8, 16.5, -4.5);
  quad(d, person.coatLight, -6.1, 29, 3.9, -4.3, 33.5, 2.8, -4.3, 33.5, -2.7, -6.1, 29, -3.8);
  quad(d, person.coat, 6.2, 28.5, 3.9, 4.1, 33.5, 2.8, 4.1, 33.5, -2.7, 6.2, 28.5, -3.8);
  quad(d, person.coatLight, -4.2, 31.5, 3.35, -2.8, 32.1, 3.35, -1.4, 26.4, 4.35, -4, 26, 4.35, .2);
  quad(d, person.coatDark, 1, 17, 4.8, 2.2, 28, 4.1, 3.2, 29.8, 3.8, 4.3, 17.2, 4.8, .3);
  d.line(-2, 27, 4.6, -2.6, 17.4, 4.9, 1, person.coatLight);
  d.line(.2, 31.2, 3.6, .2, 18, 4.8, 1, person.coatDark);
  d.line(-5.3, 23, 4.8, -2.8, 23, 4.8, 1, person.leather);
  d.line(-5, 21.7, 4.9, -3, 21.7, 4.9, 1, person.coatEdge);
  d.line(-4, 30.4, -4.2, 1.2, 19.5, -5, 2, person.leatherLight);
  d.line(-3.8, 29.4, -4.8, -1.8, 20.5, -5, 1, person.coat);
  d.line(-6, 17, -4.8, -2, 17, -4.8, 1, person.coatLight);
  // A worn pack is a few broad folds, not a second glowing mechanical unit.
  quad(d, person.leather, -5.8, 23, -5, -5.8, 31, -4.3, 2.3, 31, -4.3, 2.8, 23, -5);
  quad(d, person.leatherLight, -5.8, 30.5, -5.8, -4, 33, -4.5, 2.3, 32, -4.5, 2.3, 29, -6, .2);
  quad(d, person.coat, -5.8, 23, -6, -5.8, 28.8, -6.2, 2.2, 28.3, -6.2, 2.8, 23, -6, .2);
  d.line(-3.2, 28, -6.5, -2.7, 23.6, -6.5, 1, person.leather);
  d.point(.1, 27.2, -6.5, 1, person.stitch);
  d.line(-4.3, 33.5, 2.8, -1.3, 32.8, 3.2, 2, person.coatEdge);
}

export class StagePlayer {
  readonly root = new THREE.Group();
  readonly torso = new THREE.Group();
  readonly light = new THREE.PointLight(0xffc47a, 95, 132, 1.6);
  private readonly drawing = new ActorPixelDrawing(112, 88, 56, 61);
  private readonly feet = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly tip = new THREE.Vector3();
  private readonly shadow = createActorContactShadow(19, 16);
  private groundHeight = 0;
  private groundSampler: GroundSampler | null = null;
  private travel = 0;
  private lastX = NaN;
  private lastY = NaN;
  private lastTime = NaN;
  private gaitAmount = 0;
  private hitAt = -10000;
  private hitX = 0;
  private hitY = 0;
  private attackArc = .4;
  private weaponVisible = false;

  constructor() {
    this.root.add(this.torso, this.shadow, this.light);
    this.torso.add(this.drawing.mesh);
    this.root.userData.height = ACTOR_HEIGHT;
    this.root.userData.rendering = 'authored-pixel-card';
  }

  setGroundHeight(height: number): void { this.groundHeight = Number.isFinite(height) ? height : 0; }
  setGroundSampler(sampler: GroundSampler): void { this.groundSampler = sampler; }

  hit(event: DeepReadonly<RiftPresentationEvent>): void {
    this.hitAt = event.elapsedMs; this.hitX = event.direction.x; this.hitY = event.direction.y;
  }

  update(p: PlayerView, elapsedMs: number): void {
    const d = this.drawing;
    const travelled = Number.isFinite(this.lastX) ? Math.hypot(p.position.x - this.lastX, p.position.y - this.lastY) : 0;
    this.travel += Math.min(8, travelled); this.lastX = p.position.x; this.lastY = p.position.y;
    const walking = p.moving && Math.hypot(p.velocity.x, p.velocity.y) > 3;
    const delta = Number.isFinite(this.lastTime) ? clamp(elapsedMs - this.lastTime, 0, 34) : 16;
    this.lastTime = elapsedMs;
    this.gaitAmount = mix(this.gaitAmount, walking ? 1 : 0, Math.min(1, delta / 85));
    const phase = this.travel / 17 * Math.PI, t = elapsedMs / 1000;
    const attack = p.attack, attacking = attack.phase !== 'idle';
    const facing = attacking ? attack.facing : p.facing;
    const halfArc = THREE.MathUtils.degToRad(WEAPON_ATTACK_PROFILES.crowbar!.arcDeg / 2);
    const progress = attack.phase === 'windup' ? attack.elapsedMs / Math.max(1, attack.windupMs)
      : attack.phase === 'active' ? (attack.contactRemainingMs > 0 ? attack.contactElapsedMs ?? attack.elapsedMs : attack.elapsedMs) / Math.max(1, attack.activeMs)
        : attack.elapsedMs / Math.max(1, attack.recoveryMs);
    this.attackArc = attack.phase === 'windup' ? mix(.4, -halfArc, Math.min(1, progress))
      : attack.phase === 'active' ? mix(-halfArc, halfArc, Math.min(1, progress))
        : attack.phase === 'recovery' ? mix(halfArc, .4, Math.min(1, progress)) : .4;
    this.root.position.set(p.position.x, this.groundHeight, p.position.y);
    this.root.rotation.y = Math.PI / 2 - facing;
    const yaw = this.root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
    const hit = Math.max(0, 1 - (elapsedMs - this.hitAt) / 310);
    const death = p.hp <= 0 ? Math.max(0, elapsedMs - this.hitAt) : 0;
    const collapse = p.hp <= 0 ? clamp(death / 490, 0, 1) : 0;
    const localHitX = (this.hitX * c - this.hitY * s) * hit * 3.2;
    const localHitZ = (this.hitX * s + this.hitY * c) * hit * 3.2;
    this.root.visible = p.hp > 0 || death < 800;
    if (!this.root.visible) { this.light.intensity = 0; return; }
    d.begin(yaw);
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1, wave = phase + i * Math.PI;
      const forward = Math.cos(wave) * 6.4 * this.gaitAmount;
      const lift = Math.max(0, Math.sin(wave)) * 3 * this.gaitAmount;
      const foot = this.feet[i]!, footX = sign * 3.2, footZ = forward + 1.2;
      const worldX = p.position.x + footX * c + footZ * s;
      const worldY = p.position.y - footX * s + footZ * c;
      const floor = this.groundSampler?.(worldX, worldY) ?? this.groundHeight;
      const footY = floor - this.groundHeight + 1.5 + lift;
      foot.set(worldX, floor + 1.5 + lift, worldY);
      const kneeX = sign * 3.9 + collapse * 3.6, kneeY = 9.6 + lift * .44 - collapse * 6, kneeZ = forward * .5;
      d.line(sign * 3.1 + collapse * 6, 18 - collapse * 9, 0, kneeX, kneeY, kneeZ, 4, person.trouser);
      d.line(kneeX, kneeY, kneeZ, footX, footY + 1, footZ, 3, person.boot);
      d.line(kneeX - .8, kneeY, kneeZ + .2, footX - .8, footY + 2, footZ + .2, 1, person.bootEdge, .4);
      d.stamp(footX, footY, footZ + 1.6, bootShape, person.boot, .83, .78, .25);
      d.line(footX - 1.6, footY + .7, footZ + 3, footX + 1.3, footY + .7, footZ + 3, 1, person.bootEdge, .4);
    }
    const bob = Math.abs(Math.sin(phase)) * .75 * this.gaitAmount + Math.sin(t * 1.8) * .18 * (1 - this.gaitAmount);
    const bodyTwist = attacking ? -this.attackArc * .35 : Math.sin(phase) * .045 * this.gaitAmount;
    d.setBodyTransform(localHitX, bob - collapse * 4, localHitZ, collapse * 1.28, 1 - collapse * .12, bodyTwist);
    coat(d);
    d.setBodyTransform(localHitX, bob - collapse * 4, localHitZ, collapse * 1.28, 1 - collapse * .12);
    const handX = attacking ? Math.sin(-this.attackArc) * 12 : 7.1;
    const handZ = attacking ? Math.cos(this.attackArc) * 12 : 1.5;
    const handY = attacking ? 25.5 : 22;
    for (let i = 0; i < 2; i++) {
      const sign = i ? 1 : -1;
      const x = i ? handX : -7.1, y = i ? handY : 21.5;
      const z = i ? handZ : 1.5 - Math.cos(phase) * 3.1 * this.gaitAmount;
      const elbowX = i && attacking ? handX * .68 + 2.4 : sign * 8;
      const elbowZ = z * .45;
      d.line(sign * 5.7, 31, 0, elbowX, 26, elbowZ, 4, person.coatDark);
      d.line(elbowX, 26, elbowZ, x, y, z, 3, person.coat);
      d.line(sign * 5.7 - .6, 31.3, .4, elbowX - .6, 26.3, elbowZ + .5, 1, person.coatLight, .4);
      d.stamp(x, y, z, gloveShape, person.leather, .85, .85, .6);
    }
    // Hood and respirator are deliberately drawn clusters; no spherical light band.
    d.setBodyTransform(localHitX, bob - collapse * 4, localHitZ, collapse * 1.28, 1 - collapse * .12, bodyTwist * .45);
    d.stamp(0, 37.1, .4, headShape, person.hoodShadow, 1.04, .89);
    d.stamp(-.7, 38.8, -.5, headTop, person.hood, 1.05, .9, .3);
    d.line(-3.7, 38.1, 2.2, 3.9, 38.1, 2.2, 1, person.coatLight, .3);
    d.stamp(0, 35.9, 3.8, faceMask, person.mask, .8, .85, .4);
    d.line(-1.7, 38, 3.2, -.4, 38, 3.2, 1, person.glass, .5);
    d.point(1.5, 38, 3.2, 1, person.glass, .5);
    d.line(-3.2, 40.3, -1.1, .5, 40.3, -1.1, 1, person.coatEdge, .4);
    d.setBodyTransform(localHitX, bob - collapse * 4, localHitZ, collapse * 1.28, 1 - collapse * .12);
    this.weaponVisible = p.weaponDefinitionId !== null;
    const weaponPitch = attacking ? 0 : .83;
    const weaponLength = 20;
    const tipX = handX - Math.sin(this.attackArc) * Math.cos(weaponPitch) * weaponLength;
    const tipZ = handZ + Math.cos(this.attackArc) * Math.cos(weaponPitch) * weaponLength;
    const tipY = handY - Math.sin(weaponPitch) * weaponLength;
    const hookX = tipX + Math.cos(this.attackArc) * 2.6;
    const hookZ = tipZ + Math.sin(this.attackArc) * 2.6;
    if (this.weaponVisible) {
      d.line(handX, handY, handZ, tipX, tipY, tipZ, 2, person.iron);
      d.line(tipX, tipY, tipZ, hookX, tipY - .5, hookZ, 2, person.iron);
      d.line(hookX, tipY - .5, hookZ, hookX, tipY - 2.4, hookZ - 1, 1, person.ironLight, .4);
      d.line(handX, handY + .3, handZ, mix(handX, tipX, .18), mix(handY, tipY, .18), mix(handZ, tipZ, .18), 2, person.leather, .6);
      d.line(mix(handX, tipX, .35), mix(handY, tipY, .35) + .4, mix(handZ, tipZ, .35), tipX, tipY + .4, tipZ, 1, person.ironLight, .35);
      d.stamp(handX, handY, handZ, gloveShape, person.leather, .7, .8, .8);
    }
    this.tip.set(hookX * c + hookZ * s + p.position.x, tipY + this.groundHeight, -hookX * s + hookZ * c + p.position.y);
    d.stamp(-6.9, 31.6, 2.3, handLamp, person.leather, .8, .8, .5);
    d.point(-6.9, 32, 4, 3, person.lampDark, .6);
    d.point(-7.1, 32.3, 4.1, 2, person.lamp, .65);
    d.point(-7.6, 32.8, 4.3, 1, person.lampCore, .7);
    this.light.position.set(-6.9, 33 + bob - collapse * 18, 6);
    this.light.intensity = (95 + Math.sin(t * 17) * 3) * (1 - collapse * .78);
    d.finish(1 - collapse * .33);
  }

  /** Diagnostics are copies; the game never reads pixels as collision or damage. */
  copyPixels(): Uint8Array { return this.drawing.rgba.slice(); }
  snapshot(): Record<string, unknown> {
    return { origin: this.root.position.toArray(), bodyHeight: ACTOR_HEIGHT, attackArc: this.attackArc,
      weaponTip: this.tip.toArray(), weaponVisible: this.weaponVisible,
      feet: this.feet.map(foot => foot.toArray()), hitAt: this.hitAt,
      rendering: 'authored-pixel-card', texture: { width: this.drawing.width, height: this.drawing.height }, groundHeight: this.groundHeight };
  }
}

// Shell plates have different outlines and broken ridges, never identical beads.
const plateOutlines: readonly (readonly number[])[] = [
  [-7, -4, -5, -8, 1, -9, 7, -5, 9, 1, 5, 6, -2, 7, -8, 2],
  [-9, -4, -6, -9, 2, -7, 7, -3, 8, 4, 2, 7, -5, 5, -9, 1],
  [-7, -4, -5, -7, 2, -8, 7, -3, 7, 3, 1, 6, -4, 5, -8, 0],
  [-5, -3, -3, -7, 1, -6, 5, -2, 6, 2, 1, 5, -4, 3],
];
const plateCrown = [-4, -4, -1, -7, 2, -6, 4, -3, 3, 1, 0, 3, -3, 1];
const plateScar = [-5, 0, -2, -2, 0, -1, 0, 2, 3, 4, 1, 5, -3, 2];
const membraneOutline = [-4, -5, 2, -7, 6, -2, 5, 3, 1, 7, -5, 4, -7, 0];

/** Draw an authored top-view contour onto the fixed camera's projected body. */
function shellPlate(d: ActorPixelDrawing, x: number, y: number, z: number, outline: readonly number[], colour: number,
  sizeX = 1, sizeZ = 1, height = 1): void {
  const count = outline.length / 2;
  for (let i = 0; i < count; i++) {
    face[i * 3] = x + outline[i * 2]! * sizeX;
    face[i * 3 + 1] = y + (i % 3 === 0 ? -.4 : .2) * height;
    face[i * 3 + 2] = z + outline[i * 2 + 1]! * sizeZ;
  }
  d.polygon(face, colour, count, .1);
}

export class StageInsect {
  readonly root = new THREE.Group();
  private readonly drawing = new ActorPixelDrawing(112, 88, 56, 49);
  private readonly shadow = createActorContactShadow(34, 50);
  private readonly footPoints = Array.from({ length: 6 }, () => new THREE.Vector3());
  private groundHeight = 0;
  private groundSampler: GroundSampler | null = null;
  private travel = 0;
  private lastX = NaN;
  private lastY = NaN;
  private hitAt = -10000;
  private hitX = 0;
  private hitY = 0;
  private deathAt = Infinity;
  private visibility = 0;
  private facing = 0;
  private activity = false;

  constructor(readonly id: string) {
    this.root.add(this.shadow, this.drawing.mesh);
    this.root.userData.rendering = 'authored-pixel-card';
  }

  setGroundHeight(height: number): void { this.groundHeight = Number.isFinite(height) ? height : 0; }
  setGroundSampler(sampler: GroundSampler): void { this.groundSampler = sampler; }

  hit(event: DeepReadonly<RiftPresentationEvent>): void {
    this.hitAt = event.elapsedMs; this.hitX = event.direction.x; this.hitY = event.direction.y;
    if (event.kind === 'enemy-death') this.deathAt = event.elapsedMs;
  }

  update(state: DeepReadonly<RiftPresentationEnemy> | undefined, elapsedMs: number): void {
    if (state) {
      const moved = Number.isFinite(this.lastX) ? Math.hypot(state.position.x - this.lastX, state.position.y - this.lastY) : 0;
      this.travel += Math.min(8, moved); this.lastX = state.position.x; this.lastY = state.position.y;
      this.facing = state.attack.phase === 'idle' ? state.facing : state.attack.facingAngle ?? state.facing;
      this.visibility = state.visibility; this.activity = state.activity.phase === 'active';
    }
    this.root.position.set(Number.isFinite(this.lastX) ? this.lastX : 0, this.groundHeight, Number.isFinite(this.lastY) ? this.lastY : 0);
    this.root.rotation.y = Math.PI / 2 - this.facing;
    const dying = Number.isFinite(this.deathAt), death = Math.max(0, elapsedMs - this.deathAt);
    this.root.visible = this.visibility > 0 && (state !== undefined || dying && death < 950);
    if (!this.root.visible) return;
    const d = this.drawing, hit = Math.max(0, 1 - (elapsedMs - this.hitAt) / 310);
    const collapse = dying ? clamp(death / 680, 0, 1) : 0;
    const yaw = this.root.rotation.y, c = Math.cos(yaw), s = Math.sin(yaw);
    const localHitX = (this.hitX * c - this.hitY * s) * hit * 4.8;
    const localHitZ = (this.hitX * s + this.hitY * c) * hit * 4.8;
    const attack = state?.attack;
    const pull = attack?.phase === 'windup' ? -attack.progress * 4
      : attack?.phase === 'strike' ? (1 - attack.progress) * 8 : 0;
    const phase = this.travel / 12 * Math.PI;
    const moving = !!state && Math.hypot(state.velocity.x, state.velocity.y) > 2;
    d.begin(yaw);
    for (let i = 0; i < 6; i++) {
      const sign = i < 3 ? -1 : 1, index = i % 3, localZ = 12 - index * 12;
      const wave = phase + index * 1.8 + (sign > 0 ? Math.PI : 0);
      const forward = moving ? Math.cos(wave) * 3.8 : 0;
      const lift = moving ? Math.max(0, Math.sin(wave)) * 3.2 : 0;
      const footX = sign * (17.5 - collapse * 5), footZ = localZ - 5 + forward;
      const wx = this.root.position.x + footX * c + footZ * s;
      const wz = this.root.position.z - footX * s + footZ * c;
      const floor = this.groundSampler?.(wx, wz) ?? this.groundHeight;
      const footY = floor - this.groundHeight + 1.1 + lift;
      this.footPoints[i]!.set(wx, floor + 1.1 + lift, wz);
      const kneeX = sign * (13.1 + Math.sin(wave) * .6), kneeZ = localZ - 2 + forward * .4;
      d.line(sign * 6.9, 7 - collapse * 5, localZ, kneeX, 6 + lift * .3, kneeZ, 2, insect.leg);
      d.line(kneeX, 6 + lift * .3, kneeZ, footX, footY, footZ, 2, insect.leg);
      d.line(sign * 7.5, 7.5 - collapse * 4, localZ, kneeX, 6.7 + lift * .3, kneeZ, 1, insect.legLight, .3);
      d.line(kneeX, 6.5 + lift * .3, kneeZ, footX, footY + .4, footZ, 1, insect.edge, .35);
      d.line(footX, footY, footZ, footX - sign * 1.7, footY - .3, footZ + 2.2, 1, insect.recess);
    }
    d.setBodyTransform(localHitX, -collapse * 5.5, localHitZ + pull, collapse * .38, 1 - hit * .18 - collapse * .26);
    quad(d, insect.recess, -6.5, 5, -23, -8, 5.5, 14, 7, 5.5, 21, 6, 5, -23);
    // Unequal charcoal membranes break the insect symmetry before bright details.
    shellPlate(d, -7, 7.1, -7, membraneOutline, insect.membrane, 1.2, 1.4);
    shellPlate(d, -9, 7.8, -6, plateScar, insect.stain, .95, 1.5);
    d.line(-12.2, 8.4, -13, -11, 8.4, -5, 1, insect.membraneEdge, .5);
    const flash = elapsedMs - this.hitAt < 74 && !dying;
    for (let i = 0; i < 4; i++) {
      const x = i === 1 ? -2.5 : i === 3 ? 1.9 : .6;
      const z = 15 - i * 10.5;
      const y = 8.7 + Math.sin(i * 2) * 1.1 + (this.activity ? Math.sin(elapsedMs * .003 - i * .8) * .28 : -.6);
      const outline = plateOutlines[i]!;
      shellPlate(d, x, y - 2, z, outline, insect.shellDeep, 1.04, 1.1);
      shellPlate(d, x - .3, y + .4, z - .4, outline, flash ? insect.hit : insect.shell, .95, 1.02);
      shellPlate(d, x - .3, y + 2.2, z - 1.1, plateCrown, flash ? insect.hit : insect.shellLight, 1.04, 1.08);
      // Interrupted chalk edge / broad embedded split. No small random speckles.
      d.line(x - 4.2, y + 1.2, z - 4.2, x - 2, y + 2.3, z - 6.4, 1, insect.worn, .4);
      d.line(x - 2, y + 2.3, z - 6.4, x + 1.3, y + 2.5, z - 6.4, 1, insect.shellLight, .5);
      if (i !== 3) {
        d.line(x - 4, y + .8, z + 5.2, x + .4, y + 1.1, z + 5.9, 2, insect.split, .6);
        d.line(x + .4, y + 1.1, z + 5.9, x + 3.5, y + 1.2, z + 4.5, 1, insect.stainLight, .7);
      }
      if (i === 1 || i === 2) {
        shellPlate(d, x - 3.2, y + 2.4, z, plateScar, insect.stain, .9, 1.05);
        d.line(x - 3, y + 2.8, z - 1, x - 1, y + 2.8, z + 2, 1, insect.stainLight, .6);
      }
    }
    // A blunt, partly rewritten head, with two unequal probing claws.
    shellPlate(d, .4, 7.4, 23, plateOutlines[3]!, insect.leg, .66, .65);
    d.line(-2.5, 7.4, 24, -7, 4.5, 30.5 + pull * .14, 2, insect.edge);
    d.line(-7, 4.5, 30.5 + pull * .14, -3.8, 3.5, 33, 1, insect.shellLight);
    d.line(2.2, 7.4, 24, 7, 3.3, 29, 2, insect.membrane);
    d.line(7, 3.3, 29, 5.5, 2, 32, 1, insect.membraneEdge);
    d.line(-1.7, 8, 25, .8, 8.4, 26, 1, insect.seam, .8);
    d.finish(Math.max(.13, Math.pow(this.visibility, .75)) * (1 - collapse * .55));
  }

  copyPixels(): Uint8Array { return this.drawing.rgba.slice(); }
  snapshot(): Record<string, unknown> {
    return { rendering: 'authored-pixel-card', texture: { width: this.drawing.width, height: this.drawing.height },
      feet: this.footPoints.map(foot => foot.toArray()), hitAt: this.hitAt, deathAt: this.deathAt, groundHeight: this.groundHeight };
  }
}
