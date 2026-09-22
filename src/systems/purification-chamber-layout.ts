/** Shared physical sole-space geometry and art anchors for the enclosed chamber. */
export interface ChamberPoint { readonly x: number; readonly y: number }
export type ChamberPolygon = readonly ChamberPoint[];
export type ChamberFloor = 'main' | 'upper';
export type ChamberStair = 'left-stair' | 'right-stair';
export type ChamberRoute = ChamberFloor | ChamberStair;
export type ChamberDevice = 'storage' | 'core' | 'purifier' | 'rift' | 'growth' | 'offering';

export const CHAMBER_SIZE = { width: 640, height: 400 } as const;
export const CHAMBER_CAMERA = { x: 320, y: 200, zoom: 1.5 } as const;
export const CHAMBER_GROUND_OFFSET_Y = 10;
/** Matches the prior hub body's 12px width; round feet add 2px vertical clearance. */
export const CHAMBER_FEET_RADIUS = 6;
export const CHAMBER_SPAWN_POINT = { x: 366, y: 299 } as const;
export const CHAMBER_INTERACTION_RADIUS = 24;

/** All layout coordinates are stable foot positions. Convert only at the Player boundary. */
export function chamberFeetToPlayerPosition(point: ChamberPoint): { x: number; y: number } {
  return { x: point.x, y: point.y - CHAMBER_GROUND_OFFSET_Y };
}

/** Floors and ramps meet at full-width seams; their interiors never overlap. */
export const CHAMBER_WALK_POLYGONS = {
  main: [
    { x: 96, y: 252 }, { x: 210, y: 244 }, { x: 238, y: 266 }, { x: 284, y: 266 },
    { x: 324, y: 266 }, { x: 386, y: 266 }, { x: 396, y: 250 }, { x: 442, y: 250 },
    { x: 460, y: 232 }, { x: 542, y: 232 }, { x: 556, y: 260 }, { x: 548, y: 318 },
    { x: 392, y: 324 }, { x: 368, y: 334 }, { x: 126, y: 334 }, { x: 94, y: 306 },
  ],
  upper: [
    { x: 142, y: 146 }, { x: 234, y: 138 }, { x: 274, y: 154 }, { x: 370, y: 154 },
    { x: 405, y: 176 }, { x: 396, y: 206 }, { x: 350, y: 206 }, { x: 328, y: 218 },
    { x: 302, y: 224 }, { x: 262, y: 224 }, { x: 208, y: 224 }, { x: 190, y: 214 },
    { x: 132, y: 214 }, { x: 126, y: 186 },
  ],
  'left-stair': [{ x: 262, y: 224 }, { x: 302, y: 224 }, { x: 324, y: 266 }, { x: 284, y: 266 }],
  'right-stair': [{ x: 350, y: 206 }, { x: 396, y: 206 }, { x: 442, y: 250 }, { x: 396, y: 250 }],
} as const satisfies Record<ChamberRoute, ChamberPolygon>;

export const CHAMBER_FLOORS = {
  main: CHAMBER_WALK_POLYGONS.main, upper: CHAMBER_WALK_POLYGONS.upper,
} as const;

export const CHAMBER_STAIRS = {
  'left-stair': CHAMBER_WALK_POLYGONS['left-stair'],
  'right-stair': CHAMBER_WALK_POLYGONS['right-stair'],
} as const;

/** Solid device model bases; operation positions are separate and always walkable. */
export const CHAMBER_DEVICE_BASES = {
  storage: { x: 145, y: 278 }, core: { x: 253, y: 299 },
  purifier: { x: 451, y: 270 }, rift: { x: 512, y: 252 },
  growth: { x: 169, y: 168 }, offering: { x: 355, y: 176 },
} as const satisfies Record<ChamberDevice, ChamberPoint>;

function rectangle(base: ChamberPoint, width: number, height: number): ChamberPolygon {
  return [
    { x: base.x - width / 2, y: base.y - height / 2 },
    { x: base.x + width / 2, y: base.y - height / 2 },
    { x: base.x + width / 2, y: base.y + height / 2 },
    { x: base.x - width / 2, y: base.y + height / 2 },
  ];
}

export const CHAMBER_DEVICE_FOOTPRINTS: Readonly<Record<ChamberDevice, ChamberPolygon>> = {
  storage: rectangle(CHAMBER_DEVICE_BASES.storage, 34, 18),
  core: rectangle(CHAMBER_DEVICE_BASES.core, 34, 20),
  purifier: rectangle(CHAMBER_DEVICE_BASES.purifier, 42, 18),
  rift: rectangle(CHAMBER_DEVICE_BASES.rift, 34, 12),
  growth: rectangle(CHAMBER_DEVICE_BASES.growth, 28, 20),
  offering: rectangle(CHAMBER_DEVICE_BASES.offering, 32, 16),
};

export const CHAMBER_DEVICE_ANCHORS = {
  storage: { x: 162, y: 304 }, core: { x: 284, y: 313 },
  purifier: { x: 458, y: 301 }, rift: { x: 507, y: 287 },
  growth: { x: 183, y: 202 }, offering: { x: 348, y: 198 },
} as const satisfies Record<ChamberDevice, ChamberPoint>;

export const CHAMBER_DEVICE_FLOORS: Readonly<Record<ChamberDevice, ChamberFloor>> = {
  storage: 'main', core: 'main', purifier: 'main', rift: 'main',
  growth: 'upper', offering: 'upper',
};

/** A suspended tab cannot spend its entire hidden time walking across the chamber. */
export const CHAMBER_MAX_STEP_MS = 100;
