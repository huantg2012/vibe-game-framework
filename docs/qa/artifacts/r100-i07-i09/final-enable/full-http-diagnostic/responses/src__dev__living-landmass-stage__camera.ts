import * as THREE from 'three';

export const STUDY_WIDTH = 960;
export const STUDY_HEIGHT = 640;
export const STUDY_ANGLES = [42, 50, 58] as const;
export type StudyAngle = typeof STUDY_ANGLES[number];
export interface StudyPoint { readonly x: number; readonly y: number }

/** One geometry, one scale and one azimuth. Only elevation is compared. */
export class LandmassStudyCamera {
  readonly camera: THREE.OrthographicCamera;
  private elevation: StudyAngle = 50;
  private readonly projected = new THREE.Vector3();

  constructor(readonly focus: Readonly<{ x: number; height: number; y: number }>, readonly span: number) {
    const verticalSpan = span * STUDY_HEIGHT / STUDY_WIDTH;
    this.camera = new THREE.OrthographicCamera(-span / 2, span / 2, verticalSpan / 2, -verticalSpan / 2, 1, 5000);
    this.setElevation(50);
  }

  get angle(): StudyAngle { return this.elevation; }

  setElevation(angle: StudyAngle): void {
    if (!STUDY_ANGLES.some(value => value === angle)) throw new Error('Unsupported study camera elevation');
    this.elevation = angle;
    const radians = angle * Math.PI / 180;
    this.camera.position.set(this.focus.x, this.focus.height + Math.sin(radians) * 1800,
      this.focus.y + Math.cos(radians) * 1800);
    this.camera.lookAt(this.focus.x, this.focus.height, this.focus.y);
    this.camera.updateMatrixWorld(true);
  }

  project(point: StudyPoint, height: number, out: { x: number; y: number }): void {
    this.projected.set(point.x, height, point.y).project(this.camera);
    out.x = (this.projected.x + 1) * STUDY_WIDTH / 2;
    out.y = (1 - this.projected.y) * STUDY_HEIGHT / 2;
  }

  snapshot(): Record<string, unknown> {
    return { projection: 'orthographic', elevation: this.angle, azimuth: 0, span: this.span,
      position: this.camera.position.toArray(), focus: { ...this.focus },
      resolution: { width: STUDY_WIDTH, height: STUDY_HEIGHT }, pixelsPerWorldUnit: STUDY_WIDTH / this.span,
      quaternion: this.camera.quaternion.toArray(), projectionMatrix: this.camera.projectionMatrix.toArray(),
      viewMatrix: this.camera.matrixWorldInverse.toArray() };
  }
}
