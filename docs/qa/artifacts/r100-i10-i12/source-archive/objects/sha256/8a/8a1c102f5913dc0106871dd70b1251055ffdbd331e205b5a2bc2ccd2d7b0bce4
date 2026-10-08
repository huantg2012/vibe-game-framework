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
  /**
   * Phaser canvas is FIT-letterboxed inside `#game-container`.
   * Wheel / drag on the empty host (right/left of the canvas) must pan the
   * camera too, otherwise the host steals the wheel and flex-centering cannot
   * scroll the canvas back into view. Map lesson omits this.
   */
  panHost?: HTMLElement | null;
}

const PHASER_STAGE_CLASS = 'gym-phaser-stage';

/** Pin the gym canvas host so a tall sidebar cannot scroll the FIT canvas away. */
export function lockGymPhaserHost(className: string = PHASER_STAGE_CLASS): HTMLElement | null {
  const stage = document.getElementById('game-container');
  if (!stage) return null;
  stage.classList.add(className);
  stage.scrollLeft = 0;
  stage.scrollTop = 0;
  return stage;
}

export function unlockGymPhaserHost(className: string = PHASER_STAGE_CLASS): void {
  document.getElementById('game-container')?.classList.remove(className);
}

export function bindGymCamera(scene: Phaser.Scene, opts: GymCameraOpts = {}): GymCameraHandle {
  let zoomMin = opts.zoomMin ?? GYM_CAMERA_ZOOM_MIN;
  const zoomMax = opts.zoomMax ?? GYM_CAMERA_ZOOM_MAX;
  const wheelMode: GymCameraWheelMode = opts.wheelMode ?? 'zoom';
  const panHost = opts.panHost ?? null;
  let dragging = false;
  let dragFromHost = false;
  let listeningWindow = false;
  let downX = 0;
  let downY = 0;
  let lastGameX = 0;
  let lastGameY = 0;

  const beginDrag = (gameX: number, gameY: number, fromHost: boolean): void => {
    dragging = true;
    dragFromHost = fromHost;
    downX = gameX;
    downY = gameY;
    lastGameX = gameX;
    lastGameY = gameY;
    bindWindowDrag();
  };

  const bindWindowDrag = (): void => {
    if (listeningWindow) return;
    listeningWindow = true;
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
  };

  const unbindWindowDrag = (): void => {
    if (!listeningWindow) return;
    listeningWindow = false;
    window.removeEventListener('mousemove', onWindowMove);
    window.removeEventListener('mouseup', onWindowUp);
  };

  const onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    const event = pointer.event as MouseEvent | undefined;
    const fromEvent =
      event && typeof event.clientX === 'number'
        ? clientToGame(scene, event.clientX, event.clientY)
        : null;
    beginDrag(fromEvent?.x ?? pointer.x, fromEvent?.y ?? pointer.y, false);
  };

  const onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    const wasDragging = dragging;
    const fromHost = dragFromHost;
    dragging = false;
    dragFromHost = false;
    unbindWindowDrag();
    if (!wasDragging || fromHost || !opts.onClick) return;
    if (Math.hypot(pointer.x - downX, pointer.y - downY) > CLICK_PX) return;
    opts.onClick(pointer);
  };

  const onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!dragging || !pointer.isDown || dragFromHost) return;
    const camera = scene.cameras.main;
    camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
    camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
  };

  const onWindowMove = (event: MouseEvent): void => {
    if (!dragging) return;
    const game = clientToGame(scene, event.clientX, event.clientY);
    if (!game) return;
    const overCanvas = event.target === scene.game.canvas;
    if (overCanvas && !dragFromHost) {
      lastGameX = game.x;
      lastGameY = game.y;
      return;
    }
    const camera = scene.cameras.main;
    camera.scrollX -= (game.x - lastGameX) / camera.zoom;
    camera.scrollY -= (game.y - lastGameY) / camera.zoom;
    lastGameX = game.x;
    lastGameY = game.y;
  };

  const onWindowUp = (): void => {
    if (!dragFromHost) return;
    dragging = false;
    dragFromHost = false;
    unbindWindowDrag();
  };

  const onHostMouseDown = (domMouse: MouseEvent): void => {
    if (domMouse.button !== 0) return;
    if (domMouse.target === scene.game.canvas) return;
    const game = clientToGame(scene, domMouse.clientX, domMouse.clientY);
    if (!game) return;
    domMouse.preventDefault();
    beginDrag(game.x, game.y, true);
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
    applyWheelPan(scene.cameras.main, pointer.event as WheelEvent | undefined, dx, dy, {
      wheelMode,
      zoomMin,
      zoomMax,
      gameX: pointer.x,
      gameY: pointer.y,
    });
  };

  const onHostWheel = (domWheel: WheelEvent): void => {
    if (domWheel.target === scene.game.canvas) return;
    // Host path is a real DOM WheelEvent (letterbox). Phaser's emitted wheel
    // still must not call preventDefault — see check:gallery-catalog.
    domWheel.preventDefault();
    const game = clientToGame(scene, domWheel.clientX, domWheel.clientY);
    applyWheelPan(scene.cameras.main, domWheel, domWheel.deltaX, domWheel.deltaY, {
      wheelMode,
      zoomMin,
      zoomMax,
      gameX: game?.x ?? 0,
      gameY: game?.y ?? 0,
    });
  };

  scene.input.on('pointerdown', onPointerDown);
  scene.input.on('pointerup', onPointerUp);
  scene.input.on('pointerupoutside', onPointerUp);
  scene.input.on('pointermove', onPointerMove);
  scene.input.on('wheel', onWheel);
  panHost?.addEventListener('wheel', onHostWheel, { passive: false });
  panHost?.addEventListener('mousedown', onHostMouseDown);

  return {
    isDragging: () => dragging,
    setZoomMin(min: number): void {
      zoomMin = min;
      const camera = scene.cameras.main;
      if (camera.zoom < zoomMin) camera.setZoom(zoomMin);
    },
    destroy(): void {
      unbindWindowDrag();
      scene.input.off('pointerdown', onPointerDown);
      scene.input.off('pointerup', onPointerUp);
      scene.input.off('pointerupoutside', onPointerUp);
      scene.input.off('pointermove', onPointerMove);
      scene.input.off('wheel', onWheel);
      panHost?.removeEventListener('wheel', onHostWheel);
      panHost?.removeEventListener('mousedown', onHostMouseDown);
    },
  };
}

function applyWheelPan(
  camera: Phaser.Cameras.Scene2D.Camera,
  event: WheelEvent | undefined,
  dx: number,
  dy: number,
  args: {
    readonly wheelMode: GymCameraWheelMode;
    readonly zoomMin: number;
    readonly zoomMax: number;
    readonly gameX: number;
    readonly gameY: number;
  },
): void {
  const wantZoom = args.wheelMode === 'zoom' || event?.ctrlKey === true || event?.metaKey === true;
  if (wantZoom) {
    const before = camera.getWorldPoint(args.gameX, args.gameY);
    const next = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), args.zoomMin, args.zoomMax);
    camera.setZoom(next);
    const after = camera.getWorldPoint(args.gameX, args.gameY);
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
}

function clientToGame(
  scene: Phaser.Scene,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const canvas = scene.game.canvas;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: ((clientX - rect.left) / rect.width) * scene.scale.width,
    y: ((clientY - rect.top) / rect.height) * scene.scale.height,
  };
}
