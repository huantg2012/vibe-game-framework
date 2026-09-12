import * as THREE from 'three';
import { STAGE_HEIGHT, STAGE_WIDTH } from './materials';
import type { PresentationPoint } from './bridge';

export function createStageCamera(width:number,height:number):THREE.OrthographicCamera{
  const span=Math.max(width*1.05,1060),viewHeight=span*STAGE_HEIGHT/STAGE_WIDTH;
  const camera=new THREE.OrthographicCamera(-span/2,span/2,viewHeight/2,-viewHeight/2,1,3000);
  const elevation=THREE.MathUtils.degToRad(35),focus=new THREE.Vector3(width*.5,50,height*.49);
  camera.position.set(focus.x,focus.y+Math.sin(elevation)*1300,focus.z+Math.cos(elevation)*1300);
  camera.lookAt(focus);camera.updateMatrixWorld(true);return camera;
}

export type StageCameraMode = 'fixed' | 'follow';
export interface StageCameraTarget {
  readonly position: Readonly<PresentationPoint>;
  readonly velocity: Readonly<PresentationPoint>;
  readonly moving: boolean;
}
export interface StageFollowCameraSnapshot {
  readonly mode: 'follow'; readonly span: number; readonly elevation: 35; readonly yaw: 0;
  readonly center: Readonly<PresentationPoint>; readonly target: Readonly<PresentationPoint>;
  readonly focus: { readonly x: number; readonly y: number; readonly z: number };
  readonly playerScreen: Readonly<PresentationPoint>;
  readonly anchor: Readonly<PresentationPoint>; readonly deadZone: Readonly<PresentationPoint>;
  readonly elapsedMs: number;
}

const FOLLOW_SPAN = 1060;
const ELEVATION = 35 * Math.PI / 180;
const FOLLOW_HEIGHT = FOLLOW_SPAN * STAGE_HEIGHT / STAGE_WIDTH;
const PIXELS_PER_UNIT = STAGE_WIDTH / FOLLOW_SPAN;
const ANCHOR_Y = 385;
const GROUND_ANCHOR_OFFSET = (ANCHOR_Y - STAGE_HEIGHT / 2) / (PIXELS_PER_UNIT * Math.sin(ELEVATION));
const DEAD_ZONE_X = 80 / PIXELS_PER_UNIT;
const DEAD_ZONE_Y = 60 / (PIXELS_PER_UNIT * Math.sin(ELEVATION));
// The authored sea extends 96 units past each side of this stage. Keep its
// straight construction edge outside the frustum, with a small pixel margin.
const HORIZONTAL_INSET = FOLLOW_SPAN / 2 - 96 + 8;

/** Fixed direction and pixel scale, with translation only. This controller has
 * no perception/terrain API and therefore cannot reveal a cell by moving.
 * Footprint bounds deliberately allow exterior overscan: fitting a short map
 * into this low-elevation frustum must not shrink actors or lock vertical travel. */
export class StageFollowCamera {
  readonly camera = new THREE.OrthographicCamera(-FOLLOW_SPAN / 2, FOLLOW_SPAN / 2,
    FOLLOW_HEIGHT / 2, -FOLLOW_HEIGHT / 2, 1, 3000);
  private readonly currentCenter: PresentationPoint;
  private readonly targetCenter: PresentationPoint;
  private readonly lookAt = { x: 0, y: 50, z: 0 };
  private readonly playerScreen: PresentationPoint = { x: 0, y: 0 };
  private readonly previousPlayer: PresentationPoint;
  private readonly minimumX: number;
  private readonly maximumX: number;
  private readonly minimumY: number;
  private readonly maximumY: number;
  private elapsedMs = 0;

  constructor(width: number, height: number, spawn: Readonly<PresentationPoint>) {
    if (![width, height, spawn.x, spawn.y].every(Number.isFinite) || width <= 0 || height <= 0) {
      throw new Error('Invalid stage follow-camera footprint');
    }
    this.minimumX = Math.min(HORIZONTAL_INSET, width / 2); this.maximumX = width - this.minimumX;
    this.minimumY = Math.min(96, height / 2); this.maximumY = height - this.minimumY;
    this.currentCenter = { x: this.clampX(spawn.x), y: this.clampY(spawn.y - GROUND_ANCHOR_OFFSET) };
    this.targetCenter = { ...this.currentCenter };
    this.previousPlayer = { ...spawn };
    this.applyCenter();
    projectStagePoint(this.camera, spawn, this.playerScreen);
  }

  /** Borrowed read-only references for the light rig; no per-frame allocation. */
  get center(): Readonly<PresentationPoint> { return this.currentCenter; }
  get focus(): Readonly<{ x: number; y: number; z: number }> { return this.lookAt; }

  update(elapsedMs: number, player: StageCameraTarget, ended: boolean, groundHeight = 0): void {
    if (ended || elapsedMs < this.elapsedMs) return;
    const deltaMs = Math.min(100, elapsedMs - this.elapsedMs);
    this.elapsedMs = elapsedMs;
    const travelled = Math.hypot(player.position.x - this.previousPlayer.x, player.position.y - this.previousPlayer.y);
    if (player.moving || travelled > .001) {
      const speed = Math.hypot(player.velocity.x, player.velocity.y);
      // Forward room comes from actual movement. Turning or attacking in place
      // leaves the target unchanged; the dead zone absorbs direction changes.
      const leadX = player.moving && speed > .01 ? player.velocity.x / speed * 36 : 0;
      const leadY = player.moving && speed > .01 ? player.velocity.y / speed * 54 : 0;
      const dx = player.position.x + leadX - this.targetCenter.x;
      const dy = player.position.y + leadY - GROUND_ANCHOR_OFFSET - this.targetCenter.y;
      if (Math.abs(dx) > DEAD_ZONE_X) this.targetCenter.x = this.clampX(this.targetCenter.x + dx - Math.sign(dx) * DEAD_ZONE_X);
      if (Math.abs(dy) > DEAD_ZONE_Y) this.targetCenter.y = this.clampY(this.targetCenter.y + dy - Math.sign(dy) * DEAD_ZONE_Y);
    }
    this.previousPlayer.x = player.position.x; this.previousPlayer.y = player.position.y;
    const blend = 1 - Math.exp(-deltaMs / 105);
    this.currentCenter.x += (this.targetCenter.x - this.currentCenter.x) * blend;
    this.currentCenter.y += (this.targetCenter.y - this.currentCenter.y) * blend;
    if (Math.abs(this.targetCenter.x - this.currentCenter.x) < .001) this.currentCenter.x = this.targetCenter.x;
    if (Math.abs(this.targetCenter.y - this.currentCenter.y) < .001) this.currentCenter.y = this.targetCenter.y;
    this.applyCenter();
    projectStagePoint(this.camera, player.position, this.playerScreen, groundHeight);
  }

  snapshot(): StageFollowCameraSnapshot {
    return { mode: 'follow', span: FOLLOW_SPAN, elevation: 35, yaw: 0,
      center: { ...this.currentCenter }, target: { ...this.targetCenter }, focus: { ...this.lookAt },
      playerScreen: { ...this.playerScreen }, anchor: { x: STAGE_WIDTH / 2, y: ANCHOR_Y },
      deadZone: { x: 80, y: 60 }, elapsedMs: this.elapsedMs };
  }

  private clampX(value: number): number { return Math.max(this.minimumX, Math.min(this.maximumX, value)); }
  private clampY(value: number): number { return Math.max(this.minimumY, Math.min(this.maximumY, value)); }
  private applyCenter(): void {
    this.lookAt.x = this.currentCenter.x;
    this.lookAt.z = this.currentCenter.y + this.lookAt.y / Math.tan(ELEVATION);
    this.camera.position.set(this.lookAt.x, this.lookAt.y + Math.sin(ELEVATION) * 1300,
      this.lookAt.z + Math.cos(ELEVATION) * 1300);
    this.camera.lookAt(this.lookAt.x, this.lookAt.y, this.lookAt.z);
    this.camera.updateMatrixWorld(true);
  }
}

const projected=new THREE.Vector3();
export function projectStagePoint(camera:THREE.Camera,point:Readonly<PresentationPoint>,out:PresentationPoint,height=0):void{
  projected.set(point.x,height,point.y).project(camera);
  out.x=(projected.x+1)*STAGE_WIDTH/2;out.y=(1-projected.y)*STAGE_HEIGHT/2;
}
