/** Shared walk geometry and art anchors for the closed, shallow-perspective hub. */
export interface ChamberPoint { readonly x: number; readonly y: number }
export type ChamberFloor = 'main' | 'upper';
export type ChamberStair = 'left-stair' | 'right-stair';
export type ChamberRoute = ChamberFloor | ChamberStair;
export type ChamberDevice = 'storage' | 'core' | 'purifier' | 'rift' | 'growth' | 'offering';

export const CHAMBER_SIZE = { width: 640, height: 400 } as const;
export const CHAMBER_CAMERA = { x: 320, y: 200, zoom: 1.5 } as const;
export const CHAMBER_GROUND_OFFSET_Y = 10;
export const CHAMBER_SPAWN_POINT = { x: 224, y: 286 } as const;

/** Coordinates are actor image centers; drawn walking surfaces lie ten pixels lower. */
export const CHAMBER_FLOORS = {
  main: { start: { x: 88, y: 286 }, end: { x: 552, y: 286 } },
  upper: { start: { x: 184, y: 180 }, end: { x: 456, y: 180 } },
} as const;

/** Stairs always run from main (progress 0) to upper (progress 1). */
export const CHAMBER_STAIRS = {
  'left-stair': { start: CHAMBER_FLOORS.main.start, end: CHAMBER_FLOORS.upper.start },
  'right-stair': { start: CHAMBER_FLOORS.main.end, end: CHAMBER_FLOORS.upper.end },
} as const;

export const CHAMBER_DEVICE_ANCHORS = {
  storage: { x: 166, y: 286 }, core: { x: 276, y: 286 },
  purifier: { x: 386, y: 286 }, rift: { x: 496, y: 286 },
  growth: { x: 262, y: 180 }, offering: { x: 378, y: 180 },
} as const satisfies Record<ChamberDevice, ChamberPoint>;

export const CHAMBER_DEVICE_FLOORS: Readonly<Record<ChamberDevice, ChamberFloor>> = {
  storage: 'main', core: 'main', purifier: 'main', rift: 'main',
  growth: 'upper', offering: 'upper',
};

export const CHAMBER_ROUTES = { ...CHAMBER_FLOORS, ...CHAMBER_STAIRS } as const;
export const CHAMBER_ROUTE_LENGTHS: Readonly<Record<ChamberRoute, number>> = {
  main: CHAMBER_FLOORS.main.end.x - CHAMBER_FLOORS.main.start.x,
  upper: CHAMBER_FLOORS.upper.end.x - CHAMBER_FLOORS.upper.start.x,
  'left-stair': Math.hypot(96, 106),
  'right-stair': Math.hypot(96, 106),
};

/** Small landing tolerance makes entering stairs intentional without pixel hunting. */
export const CHAMBER_STAIR_ENTRY_DISTANCE = 10;
/** A suspended tab cannot spend its entire hidden time walking across the chamber. */
export const CHAMBER_MAX_STEP_MS = 100;
