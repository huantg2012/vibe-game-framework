import * as THREE from 'three';
import { STUDY_WIDTH, STUDY_HEIGHT } from './camera';

const ANGLES = [28, 32, 36] as const;
export type VistaAngle = typeof ANGLES[number];

/** A restrained long lens adds real depth/parallax without changing heading.
 * Camera studies are explicit DEV URL parameters, never gameplay settings. */
export class LandmassVistaCamera {
  readonly camera: THREE.PerspectiveCamera;
  readonly angle: VistaAngle;
  private readonly projected = new THREE.Vector3();
  private readonly center: { x: number; height: number; y: number };
  private readonly distance = 2600;

  constructor(readonly focus: Readonly<{ x: number; height: number; y: number }>, readonly span: number) {
    const requested = typeof location === 'undefined' ? 32 : Number(new URLSearchParams(location.search).get('camera') ?? 32);
    this.angle = ANGLES.includes(requested as VistaAngle) ? requested as VistaAngle : 32;
    this.center = { ...focus };
    const verticalSpan = span * STUDY_HEIGHT / STUDY_WIDTH;
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(verticalSpan / (2 * this.distance)));
    this.camera = new THREE.PerspectiveCamera(fov, STUDY_WIDTH / STUDY_HEIGHT, 1, 15000);
    this.moveTo(focus.x, focus.y);
  }

  follow(point: { x: number; y: number }): void {
    const x = point.x + 60;
    const y = point.y - 350;
    this.moveTo(x, y);
  }

  /** Pixel pose uses the ray from the actual actor to the camera. */
  actorElevation(point: { x: number; y: number }, height: number): number {
    return THREE.MathUtils.radToDeg(Math.atan2(this.camera.position.y - height, this.camera.position.z - point.y));
  }

  project(point: { x: number; y: number }, height: number, out: { x: number; y: number }): void {
    this.projected.set(point.x, height, point.y).project(this.camera);
    out.x = (this.projected.x + 1) * STUDY_WIDTH / 2;
    out.y = (1 - this.projected.y) * STUDY_HEIGHT / 2;
  }

  snapshot(): Record<string, unknown> {
    return { projection: 'long-lens perspective', elevation: this.angle, fov: this.camera.fov,
      spanAtFocus: this.span, focus: { ...this.center }, distance: this.distance,
      resolution: { width: STUDY_WIDTH, height: STUDY_HEIGHT },
      background: 'distant painted panorama; near and middle geometry share real perspective and depth',
      position: this.camera.position.toArray() };
  }

  private moveTo(x: number, y: number): void {
    this.center.x = x; this.center.y = y;
    const angle = this.angle * Math.PI / 180;
    this.camera.position.set(x, this.focus.height + Math.sin(angle) * this.distance, y + Math.cos(angle) * this.distance);
    this.camera.lookAt(x, this.focus.height, y);
    this.camera.updateMatrixWorld(true);
  }
}
