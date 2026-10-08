import type { Facing4 } from '@/types/game-types';
import {
  BONE,
  BRICK,
  CLOTH,
  CONCRETE,
  CORE,
  DEEP,
  EARTH,
  FLESH,
  GLOW,
  METAL,
  METAL_MID,
  MID,
  type Rgba,
  SHADOW,
} from '@/gym/form-renderers/a/colors';
import {
  applyCoverageFail,
  makeBuf,
  px,
  rect,
  shardSplit,
  shiftOpaque,
  type PaintBuf,
  unit,
} from '@/gym/form-renderers/a/pixels';
import { flakeCount, type FamilyId, type PixelRecipe } from '@/gym/form-renderers/a/recipe';

export interface Deform {
  readonly dx: number;
  readonly headDy: number;
  readonly bodyDy: number;
  readonly footDy: number;
  readonly armExtra: number;
  readonly lean: number;
  readonly speck: number;
}

const ZERO: Deform = {
  dx: 0,
  headDy: 0,
  bodyDy: 0,
  footDy: 0,
  armExtra: 0,
  lean: 0,
  speck: 0,
};

export function jiaDeform(
  motion: string,
  facing: Facing4,
  gait: 'idle' | 'walk',
  frame: number,
): Deform {
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  if (motion === 'motion_anchor') {
    if (frame === 1) return { ...ZERO, bodyDy: -1, headDy: -1 };
    if (frame === 3) return { ...ZERO, bodyDy: 1, speck: 1 };
    return ZERO;
  }
  if (gait === 'idle') {
    if (frame === 1) return { ...ZERO, bodyDy: -1, headDy: -1, lean: 1 };
    if (frame === 3) return { ...ZERO, bodyDy: 1, footDy: 1, speck: 1 };
    return ZERO;
  }
  const lunge = frame === 1;
  const plant = frame === 3;
  let dx = side * (lunge ? 2 : 1);
  let arm = lunge ? 3 : 1;
  let lean = lunge ? 2 : 1;
  let speck = lunge ? 1 : plant ? -1 : 0;
  if (motion === 'motion_coalesce') {
    return {
      ...ZERO,
      dx: 0,
      bodyDy: lunge ? 2 : plant ? -1 : 0,
      headDy: lunge ? 1 : 0,
      armExtra: -Math.abs(arm),
      speck: 1,
    };
  }
  if (motion === 'motion_turn') lean += 1;
  if (motion === 'motion_wall') dx += side * 2;
  if (motion === 'motion_wind') speck += 1;
  if (motion === 'motion_trail') dx += side;
  return {
    dx,
    headDy: lunge ? -1 : plant ? 1 : 0,
    bodyDy: lunge ? -2 : plant ? 2 : 0,
    footDy: lunge ? -2 : plant ? 2 : 0,
    armExtra: arm,
    lean,
    speck,
  };
}

type Band = 'head' | 'body' | 'foot' | 'arm';

function put(
  buf: PaintBuf,
  facing: Facing4,
  d: Deform,
  x: number,
  y: number,
  band: Band,
  c: Rgba,
): void {
  const yOff = buf.h === 48 ? 8 : 0;
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  let lx = x - 16;
  if (facing === 'left') lx = -lx;
  const ox =
    16 +
    lx +
    d.dx +
    (band === 'arm' ? d.armExtra * (side === 0 ? 1 : side) : 0) +
    (band === 'head' ? d.lean * side : 0);
  let oy = y + yOff;
  if (band === 'head') oy += d.headDy + (facing === 'down' ? d.lean : facing === 'up' ? -d.lean : 0);
  else if (band === 'foot') oy += d.bodyDy + d.footDy;
  else oy += d.bodyDy;
  px(buf, ox, oy, c);
}

function bar(
  buf: PaintBuf,
  facing: Facing4,
  d: Deform,
  x: number,
  y: number,
  w: number,
  band: Band,
  c: Rgba,
): void {
  for (let i = 0; i < w; i++) put(buf, facing, d, x + i, y, band, c);
}

function box(
  buf: PaintBuf,
  facing: Facing4,
  d: Deform,
  x: number,
  y: number,
  w: number,
  h: number,
  band: Band,
  c: Rgba,
): void {
  for (let j = 0; j < h; j++) bar(buf, facing, d, x, y + j, w, band, c);
}

function paintOrganic(buf: PaintBuf, facing: Facing4, d: Deform): void {
  if (facing === 'up') {
    bar(buf, facing, d, 12, 3, 6, 'head', CLOTH);
    bar(buf, facing, d, 11, 4, 8, 'head', FLESH);
    bar(buf, facing, d, 10, 5, 10, 'head', FLESH);
    bar(buf, facing, d, 10, 6, 10, 'head', BONE);
    bar(buf, facing, d, 11, 7, 8, 'head', FLESH);
    box(buf, facing, d, 8, 8, 14, 9, 'body', CLOTH);
    bar(buf, facing, d, 7, 10, 16, 'body', FLESH);
    bar(buf, facing, d, 9, 16, 12, 'body', CLOTH);
    put(buf, facing, d, 21, 11, 'body', BONE);
    box(buf, facing, d, 5, 2, 4, 9, 'arm', CLOTH);
    put(buf, facing, d, 5, 1, 'arm', CLOTH);
    box(buf, facing, d, 10, 17, 4, 8, 'foot', FLESH);
    box(buf, facing, d, 16, 17, 4, 8, 'foot', CLOTH);
    bar(buf, facing, d, 10, 25, 4, 'foot', CLOTH);
    bar(buf, facing, d, 16, 25, 4, 'foot', CLOTH);
    return;
  }
  bar(buf, facing, d, 12, 3, 6, 'head', FLESH);
  bar(buf, facing, d, 11, 4, 8, 'head', FLESH);
  bar(buf, facing, d, 10, 5, 10, 'head', CLOTH);
  put(buf, facing, d, 13, 4, 'head', BONE);
  bar(buf, facing, d, 12, 6, 7, 'head', EARTH);
  bar(buf, facing, d, 10, 7, 10, 'head', FLESH);
  bar(buf, facing, d, 11, 8, 8, 'head', CLOTH);
  bar(buf, facing, d, 12, 9, 6, 'head', FLESH);
  bar(buf, facing, d, 8, 10, 14, 'body', FLESH);
  bar(buf, facing, d, 7, 11, 16, 'body', CLOTH);
  bar(buf, facing, d, 7, 12, 16, 'body', FLESH);
  bar(buf, facing, d, 8, 13, 14, 'body', FLESH);
  bar(buf, facing, d, 8, 14, 14, 'body', CLOTH);
  bar(buf, facing, d, 9, 15, 12, 'body', FLESH);
  bar(buf, facing, d, 9, 16, 12, 'body', CLOTH);
  bar(buf, facing, d, 10, 17, 10, 'body', FLESH);
  put(buf, facing, d, 7, 14, 'body', BONE);
  box(buf, facing, d, 5, 12, 3, 6, 'arm', CLOTH);
  put(buf, facing, d, 5, 18, 'arm', FLESH);
  box(buf, facing, d, 21, 11, 4, 10, 'arm', CLOTH);
  box(buf, facing, d, 24, 18, 3, 6, 'arm', CLOTH);
  put(buf, facing, d, 27, 23, 'arm', CLOTH);
  put(buf, facing, d, 27, 24, 'arm', FLESH);
  box(buf, facing, d, 10, 18, 4, 8, 'foot', FLESH);
  box(buf, facing, d, 16, 19, 4, 8, 'foot', CLOTH);
  bar(buf, facing, d, 10, 26, 4, 'foot', CLOTH);
  bar(buf, facing, d, 16, 27, 4, 'foot', CLOTH);
}

function paintLamp(buf: PaintBuf, facing: Facing4, d: Deform): void {
  box(buf, facing, d, 13, 2, 6, 5, 'head', METAL);
  bar(buf, facing, d, 14, 3, 4, 'head', METAL_MID);
  put(buf, facing, d, 15, 3, 'head', CORE);
  put(buf, facing, d, 16, 3, 'head', GLOW);
  bar(buf, facing, d, 13, 7, 6, 'body', CONCRETE);
  box(buf, facing, d, 14, 8, 4, 14, 'body', METAL);
  bar(buf, facing, d, 13, 12, 6, 'body', METAL_MID);
  bar(buf, facing, d, 14, 18, 4, 'body', CONCRETE);
  box(buf, facing, d, 12, 22, 3, 6, 'foot', METAL);
  box(buf, facing, d, 17, 22, 3, 6, 'foot', CONCRETE);
  bar(buf, facing, d, 12, 28, 3, 'foot', SHADOW);
  bar(buf, facing, d, 17, 28, 3, 'foot', SHADOW);
}

function paintDoor(buf: PaintBuf, facing: Facing4, d: Deform): void {
  const hitchL = d.footDy;
  const hitchR = -d.footDy;
  box(buf, facing, { ...d, footDy: hitchL }, 9, 6, 3, 22, 'foot', METAL);
  box(buf, facing, { ...d, footDy: hitchR }, 20, 6, 3, 22, 'foot', METAL_MID);
  bar(buf, facing, d, 9, 6, 14, 'head', BONE);
  bar(buf, facing, d, 9, 7, 14, 'head', METAL);
  bar(buf, facing, d, 10, 8, 12, 'head', CONCRETE);
  bar(buf, facing, d, 10, 27, 12, 'foot', SHADOW);
  put(buf, facing, d, 16, 7, 'head', CORE);
}

function paintRust(buf: PaintBuf, facing: Facing4, d: Deform, seed: number): void {
  box(buf, facing, d, 7, 10, 18, 12, 'body', BRICK);
  bar(buf, facing, d, 8, 11, 16, 'body', EARTH);
  bar(buf, facing, d, 9, 14, 14, 'body', METAL);
  bar(buf, facing, d, 8, 18, 16, 'body', BRICK);
  for (let i = 0; i < 18; i++) {
    const x = 8 + (i % 9) * 2;
    const y = 12 + ((i * 3) % 8);
    if (unit(seed, i + 3) > 0.4) put(buf, facing, d, x, y, 'body', EARTH);
    else put(buf, facing, d, x, y, 'body', SHADOW);
  }
  box(buf, facing, d, 10, 22, 4, 6, 'foot', BRICK);
  box(buf, facing, d, 17, 23, 4, 5, 'foot', EARTH);
}

function paintFungal(buf: PaintBuf, facing: Facing4, d: Deform, seed: number): void {
  for (let y = 12; y <= 24; y++) {
    for (let x = 6; x <= 25; x++) {
      const cx = x - 16;
      const cy = y - 18;
      if (cx * cx + cy * cy * 1.4 > 90) continue;
      if (unit(seed, x * 31 + y) < 0.35) continue;
      const ink: Rgba = unit(seed, x + y * 13) > 0.7 ? MID : unit(seed, y) > 0.5 ? EARTH : DEEP;
      put(buf, facing, d, x, y, 'body', ink);
    }
  }
  box(buf, facing, d, 11, 24, 3, 5, 'foot', EARTH);
  box(buf, facing, d, 17, 24, 3, 5, 'foot', DEEP);
}

function paintOil(buf: PaintBuf, facing: Facing4, d: Deform, seed: number): void {
  const rows = [10, 12, 15, 17, 20, 23];
  for (const y of rows) {
    for (let x = 7; x <= 24; x++) {
      if (unit(seed, x * 7 + y) < 0.22) continue;
      const ink: Rgba = unit(seed, x + y) > 0.65 ? CORE : unit(seed, y) > 0.5 ? DEEP : CONCRETE;
      put(buf, facing, d, x, y, 'body', ink);
      if (unit(seed, x * 3 + y) > 0.8) put(buf, facing, d, x, y + 1, 'body', MID);
    }
  }
  box(buf, facing, d, 11, 24, 3, 4, 'foot', CONCRETE);
  box(buf, facing, d, 17, 25, 3, 3, 'foot', DEEP);
}

function paintFamily(buf: PaintBuf, family: FamilyId, facing: Facing4, d: Deform, seed: number): void {
  switch (family) {
    case 'organic_remnant':
      paintOrganic(buf, facing, d);
      return;
    case 'lamp_pillar':
      paintLamp(buf, facing, d);
      return;
    case 'doorframe':
      paintDoor(buf, facing, d);
      return;
    case 'wall_rust':
      paintRust(buf, facing, d, seed);
      return;
    case 'fungal_mat':
      paintFungal(buf, facing, d, seed);
      return;
    case 'oil_film':
      paintOil(buf, facing, d, seed);
      return;
  }
}

function organSpot(sense: string, facing: Facing4): { x: number; y: number; band: Band; slit: boolean } {
  const front = facing === 'left' ? 10 : facing === 'right' ? 22 : 16;
  const back = facing === 'left' ? 22 : facing === 'right' ? 10 : facing === 'up' ? 16 : 16;
  switch (sense) {
    case 'sense_hear':
      return { x: facing === 'left' ? 8 : facing === 'right' ? 24 : 10, y: 6, band: 'head', slit: false };
    case 'sense_narrow':
      return { x: front, y: 6, band: 'head', slit: true };
    case 'sense_touch':
      return { x: 13, y: 27, band: 'foot', slit: false };
    case 'sense_scent':
      return { x: front, y: 4, band: 'head', slit: false };
    case 'sense_domain':
      return { x: 16, y: 14, band: 'body', slit: false };
    case 'sense_reverse':
      return { x: facing === 'down' ? 16 : back, y: facing === 'down' ? 8 : 6, band: 'head', slit: true };
    default:
      return { x: front, y: 6, band: 'head', slit: true };
  }
}

function paintOrgan(buf: PaintBuf, recipe: PixelRecipe, facing: Facing4, d: Deform, frame: number): void {
  const spot = organSpot(recipe.sense, facing);
  const open =
    recipe.utterance === 'door_still_closing' ? 1 + (frame % 4) : recipe.utterance === 'eye_in_the_seam' ? 1 : coreSize(recipe, frame);
  const glow = recipe.utterance === 'cluster_lung' && (frame === 1 || frame === 2);
  const ink = glow ? GLOW : recipe.fail >= 2 ? BRIGHT_SAFE() : CORE;
  if (spot.slit) {
    if (facing === 'left' || facing === 'right') {
      for (let i = 0; i < Math.max(2, open); i++) put(buf, facing, d, spot.x, spot.y + i, spot.band, ink);
    } else {
      bar(buf, facing, d, spot.x - 1, spot.y, Math.max(2, open + 1), spot.band, ink);
    }
    return;
  }
  if (recipe.sense === 'sense_hear') {
    put(buf, facing, d, spot.x, spot.y, spot.band, EARTH);
    put(buf, facing, d, spot.x + 1, spot.y, spot.band, EARTH);
    put(buf, facing, d, spot.x, spot.y + 1, spot.band, ink);
    return;
  }
  const n = Math.max(1, open);
  box(buf, facing, d, spot.x, spot.y, n, n, spot.band, ink);
  if (recipe.contact === 'contact_disperse_core') {
    put(buf, facing, d, spot.x + 2, spot.y - 1, spot.band, CORE);
    put(buf, facing, d, spot.x - 1, spot.y + 2, spot.band, DEEP);
  }
}

function BRIGHT_SAFE(): Rgba {
  return [0x3c, 0xff, 0xd4, 255];
}

function coreSize(recipe: PixelRecipe, frame: number): number {
  const base = recipe.fail === 2 ? 3 : 2;
  if (recipe.utterance === 'corridor_watching') return frame === 0 ? 1 : base;
  return base;
}

function paintContact(buf: PaintBuf, recipe: PixelRecipe, facing: Facing4, d: Deform): void {
  const n = flakeCount(recipe.contact);
  const atFeet = recipe.contact === 'contact_step_chaos' || recipe.sense === 'sense_touch';
  for (let i = 0; i < n; i++) {
    const x = 8 + ((hashWrap(recipe.seed, i) % 16) as number);
    const y = atFeet ? 24 + (i % 4) : 8 + ((hashWrap(recipe.seed, i + 9) % 16) as number);
    const ink: Rgba = i % 2 === 0 ? CORE : DEEP;
    put(buf, facing, d, x + d.speck, y, atFeet ? 'foot' : 'body', ink);
  }
}

function hashWrap(seed: number, n: number): number {
  return (Math.imul(seed ^ (n * 374761393), 1274126177) >>> 0) % 1024;
}

function occupancyNudge(recipe: PixelRecipe): { dx: number; dy: number } {
  if (recipe.occupancy === 'wall') return { dx: -3, dy: 0 };
  if (recipe.occupancy === 'paint') return { dx: 0, dy: 3 };
  return { dx: 0, dy: 0 };
}

function paintHaze(buf: PaintBuf, seed: number): void {
  for (let y = 4; y < buf.h - 2; y++) {
    for (let x = 4; x < buf.w - 2; x++) {
      if (unit(seed, x * 19 + y * 7) > 0.07) continue;
      const i = (y * buf.w + x) * 4;
      if ((buf.data[i + 3] ?? 0) !== 0) continue;
      px(buf, x, y, DEEP);
    }
  }
}

function paintSatellites(buf: PaintBuf, recipe: PixelRecipe, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = 4 + (hashWrap(recipe.seed, 40 + i) % (buf.w - 8));
    const y = 4 + (hashWrap(recipe.seed, 80 + i) % (buf.h - 8));
    rect(buf, x, y, 2, 2, i % 2 === 0 ? CORE : DEEP);
  }
}

export function bakeJiaFrame(
  recipe: PixelRecipe,
  facing: Facing4,
  gait: 'idle' | 'walk',
  frame: number,
): PaintBuf {
  const buf = makeBuf(recipe.canvasW, recipe.canvasH);
  const d = jiaDeform(recipe.motion, facing, gait, frame);
  paintFamily(buf, recipe.family, facing, d, recipe.seed);
  const nudge = occupancyNudge(recipe);
  if (nudge.dx !== 0 || nudge.dy !== 0) shiftOpaque(buf, nudge.dx, nudge.dy);
  if (recipe.occupancy === 'volume') paintHaze(buf, recipe.seed);
  if (recipe.continuity === 'shards') shardSplit(buf, recipe.seed);
  applyCoverageFail(buf, recipe.fail, recipe.seed);
  if (recipe.continuity === 'colony') paintSatellites(buf, recipe, 2);
  if (recipe.continuity === 'field') paintSatellites(buf, recipe, 4);
  paintOrgan(buf, recipe, facing, d, frame);
  paintContact(buf, recipe, facing, d);
  if (recipe.family === 'lamp_pillar') {
    const yOff = buf.h === 48 ? 8 : 0;
    px(buf, 15 + d.dx, 3 + yOff + d.headDy, GLOW);
  }
  return buf;
}

const FACINGS: readonly Facing4[] = ['down', 'up', 'left', 'right'];
const GAITS = ['idle', 'walk'] as const;

export function bakeJiaSheet(
  scene: import('phaser').Scene,
  recipe: PixelRecipe,
  upload: (scene: import('phaser').Scene, key: string, buf: PaintBuf) => void,
  keyFor: (facing: Facing4, gait: 'idle' | 'walk', frame: number) => string,
): string[] {
  const keys: string[] = [];
  for (const facing of FACINGS) {
    for (const gait of GAITS) {
      for (let frame = 0; frame < 4; frame++) {
        const key = keyFor(facing, gait, frame);
        upload(scene, key, bakeJiaFrame(recipe, facing, gait, frame));
        keys.push(key);
      }
    }
  }
  return keys;
}
