/**
 * Shared gym camera: drag to pan, wheel to zoom (map lesson default).
 * Gallery may opt into wheel pan; map lesson must keep the zoom path.
 */

import Phaser from 'phaser';

export const GYM_CAMERA_ZOOM_MIN = 0.12;
export const GYM_CAMERA_ZOOM_MAX = 3;

const CLICK_PX = 6;

export interface GymCameraHandle {
  destroy(): void;
  isDragging(): boolean;
  /** Gallery halls switch this per portfolio. Map lesson never calls it. */
  setZoomMin(min: number): void;
}

export type GymCameraWheelMode = 'zoom' | 'pan';

export interface GymCameraOpts {
  zoomMin?: number;
  zoomMax?: number;
  /** Default `'zoom'` matches the map lesson. Gallery passes `'pan'`. */
  wheelMode?: GymCameraWheelMode;
  onClick?: (pointer: Phaser.Input.Pointer) => void;
}

export function bindGymCamera(scene: Phaser.Scene, opts: GymCameraOpts = {}): GymCameraHandle {
  let zoomMin = opts.zoomMin ?? GYM_CAMERA_ZOOM_MIN;
  const zoomMax = opts.zoomMax ?? GYM_CAMERA_ZOOM_MAX;
  const wheelMode: GymCameraWheelMode = opts.wheelMode ?? 'zoom';
  let dragging = false;
  let downX = 0;
  let downY = 0;

  const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    dragging = true;
    downX = pointer.x;
    downY = pointer.y;
  };

  const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    const wasDragging = dragging;
    dragging = false;
    if (!wasDragging || !opts.onClick) return;
    if (Math.hypot(pointer.x - downX, pointer.y - downY) > CLICK_PX) return;
    opts.onClick(pointer);
  };

  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!dragging || !pointer.isDown) return;
    const camera = scene.cameras.main;
    camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
    camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
  };

  // Phaser 3.80 emits POINTER_WHEEL with (pointer, currentlyOver, dx, dy, dz) — there is
  // no sixth DOM-event argument. Reading modifiers off `pointer.event` instead; Phaser's
  // MouseManager already handles preventDefault via `inputMousePreventDefaultWheel`.
  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    dx: number,
    dy: number,
    _dz: number,
  ): void => {
    const event = pointer.event as WheelEvent | undefined;
    const camera = scene.cameras.main;
    const wantZoom = wheelMode === 'zoom' || event?.ctrlKey === true || event?.metaKey === true;
    if (wantZoom) {
      const before = camera.getWorldPoint(pointer.x, pointer.y);
      const next = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), zoomMin, zoomMax);
      camera.setZoom(next);
      const after = camera.getWorldPoint(pointer.x, pointer.y);
      camera.scrollX += before.x - after.x;
      camera.scrollY += before.y - after.y;
      return;
    }
    if (event?.shiftKey === true) {
      camera.scrollX += (dx !== 0 ? dx : dy) / camera.zoom;
      return;
    }
    camera.scrollX += dx / camera.zoom;
    camera.scrollY += dy / camera.zoom;
  };

  scene.input.on('pointerdown', onPointerDown);
  scene.input.on('pointerup', onPointerUp);
  scene.input.on('pointerupoutside', onPointerUp);
  scene.input.on('pointermove', onPointerMove);
  scene.input.on('wheel', onWheel);

  return {
    isDragging: () => dragging,
    setZoomMin(min: number): void {
      zoomMin = min;
      const camera = scene.cameras.main;
      if (camera.zoom < zoomMin) camera.setZoom(zoomMin);
    },
    destroy(): void {
      scene.input.off('pointerdown', onPointerDown);
      scene.input.off('pointerup', onPointerUp);
      scene.input.off('pointerupoutside', onPointerUp);
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('wheel', onWheel);
    },
  };
}
