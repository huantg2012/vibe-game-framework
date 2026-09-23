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
export const CHAMBER_SPAWN_POINT = { x: 243, y: 315 } as const;
export const CHAMBER_INTERACTION_RADIUS = 24;

/** All layout coordinates are stable foot positions. Convert only at the Player boundary. */
export function chamberFeetToPlayerPosition(point: ChamberPoint): { x: number; y: number } {
  return { x: point.x, y: point.y - CHAMBER_GROUND_OFFSET_Y };
}

/** Floors and ramps meet at full-width seams; their interiors never overlap. */
export const CHAMBER_WALK_POLYGONS = {
  main: [
    { x: 57, y: 277 }, { x: 143, y: 270 }, { x: 179, y: 278 }, { x: 221, y: 278 },
    { x: 282, y: 279 }, { x: 310, y: 274 }, { x: 352, y: 274 }, { x: 360, y: 257 },
    { x: 385, y: 265 }, { x: 395, y: 302 }, { x: 378, y: 326 }, { x: 256, y: 334 },
    { x: 223, y: 341 }, { x: 76, y: 340 }, { x: 51, y: 316 },
  ],
  upper: [
    { x: 162, y: 183 }, { x: 229, y: 176 }, { x: 271, y: 185 }, { x: 310, y: 182 },
    { x: 335, y: 200 }, { x: 332, y: 229 }, { x: 290, y: 229 }, { x: 279, y: 239 },
    { x: 208, y: 239 }, { x: 166, y: 239 }, { x: 150, y: 220 }, { x: 150, y: 202 },
  ],
  'left-stair': [{ x: 166, y: 239 }, { x: 208, y: 239 }, { x: 221, y: 278 }, { x: 179, y: 278 }],
  'right-stair': [{ x: 290, y: 229 }, { x: 332, y: 229 }, { x: 352, y: 274 }, { x: 310, y: 274 }],
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
  storage: { x: 79, y: 296 }, core: { x: 141, y: 305 },
  purifier: { x: 293, y: 294 }, rift: { x: 366, y: 285 },
  growth: { x: 185, y: 198 }, offering: { x: 293, y: 203 },
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
  storage: { x: 79, y: 322 }, core: { x: 175, y: 320 },
  purifier: { x: 288, y: 320 }, rift: { x: 364, y: 309 },
  growth: { x: 185, y: 226 }, offering: { x: 283, y: 224 },
} as const satisfies Record<ChamberDevice, ChamberPoint>;

export const CHAMBER_DEVICE_FLOORS: Readonly<Record<ChamberDevice, ChamberFloor>> = {
  storage: 'main', core: 'main', purifier: 'main', rift: 'main',
  growth: 'upper', offering: 'upper',
};

/** A suspended tab cannot spend its entire hidden time walking across the chamber. */
export const CHAMBER_MAX_STEP_MS = 100;

/** Physical junctions shared by authored structure, public damage and local atmosphere. */
export const CHAMBER_CONTACTS = {
  west: { x: 51, y: 260 }, rear: { x: 227, y: 151 }, east: { x: 394, y: 273 },
} as const;
export const CHAMBER_WALL_LAMP = { x: 252, y: 172, elevation: 48 } as const;

/** Visible exterior continuations of two contacts. West is wholly inside the shell;
 * it has an interior damage response, but no invented near-layer emitter. */
export const CHAMBER_EXTERIOR_CONTACTS = [
  { id: 'rear', x: 244, y: 104, elevation: 63, radiusX: 18, radiusY: 24, phase: .83,
    path: [[251, 88], [245, 100], [238, 114]] },
  { id: 'east', x: 423, y: 293, elevation: 21, radiusX: 28, radiusY: 23, phase: .56,
    path: [[413, 283], [424, 289], [438, 300]] },
] as const;
