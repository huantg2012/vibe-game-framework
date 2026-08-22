/**
 * Shared gym camera: drag to pan, wheel to zoom.
 * Extracted from the map lesson so the gallery can reuse it without
 * changing map behaviour.
 */

import Phaser from 'phaser';

export const GYM_CAMERA_ZOOM_MIN = 0.12;
export const GYM_CAMERA_ZOOM_MAX = 3;

const CLICK_PX = 6;

export interface GymCameraHandle {
  destroy(): void;
  isDragging(): boolean;
}

export interface GymCameraOpts {
  zoomMin?: number;
  zoomMax?: number;
  onClick?: (pointer: Phaser.Input.Pointer) => void;
}

export function bindGymCamera(scene: Phaser.Scene, opts: GymCameraOpts = {}): GymCameraHandle {
  const zoomMin = opts.zoomMin ?? GYM_CAMERA_ZOOM_MIN;
  const zoomMax = opts.zoomMax ?? GYM_CAMERA_ZOOM_MAX;
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

  const onWheel = (
    pointer: Phaser.Input.Pointer,
    _currentlyOver: Phaser.GameObjects.GameObject[],
    _dx: number,
    dy: number,
    _dz: number,
    event: WheelEvent,
  ): void => {
    event.preventDefault();
    const camera = scene.cameras.main;
    const before = camera.getWorldPoint(pointer.x, pointer.y);
    const next = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), zoomMin, zoomMax);
    camera.setZoom(next);
    const after = camera.getWorldPoint(pointer.x, pointer.y);
    camera.scrollX += before.x - after.x;
    camera.scrollY += before.y - after.y;
  };

  scene.input.on('pointerdown', onPointerDown);
  scene.input.on('pointerup', onPointerUp);
  scene.input.on('pointerupoutside', onPointerUp);
  scene.input.on('pointermove', onPointerMove);
  scene.input.on('wheel', onWheel);

  return {
    isDragging: () => dragging,
    destroy(): void {
      scene.input.off('pointerdown', onPointerDown);
      scene.input.off('pointerup', onPointerUp);
      scene.input.off('pointerupoutside', onPointerUp);
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('wheel', onWheel);
    },
  };
}
