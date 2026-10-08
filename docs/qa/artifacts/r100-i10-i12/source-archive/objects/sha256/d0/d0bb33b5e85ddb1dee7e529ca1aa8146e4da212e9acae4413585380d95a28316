import type { Facing4 } from '@/types/game-types';
import type { JiaBodyColors, JiaFamily, JiaVariant } from '@/entities/form-renderers/d/jia-recipe';
import { px, type PaintBuf, type Rgba } from '@/entities/form-renderers/d/jia-pixels';

export interface JiaDeform {
  readonly dx: number;
  readonly headDy: number;
  readonly bodyDy: number;
  readonly footDy: number;
  readonly armExtra: number;
  readonly lean: number;
  readonly speck: number;
  readonly gap: number;
}

export const ZERO_DEFORM: JiaDeform = {
  dx: 0,
  headDy: 0,
  bodyDy: 0,
  footDy: 0,
  armExtra: 0,
  lean: 0,
  speck: 0,
  gap: 0,
};

type Band = 'head' | 'body' | 'foot' | 'arm';

function put(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
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
  d: JiaDeform,
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
  d: JiaDeform,
  x: number,
  y: number,
  w: number,
  h: number,
  band: Band,
  c: Rgba,
): void {
  for (let j = 0; j < h; j++) bar(buf, facing, d, x, y + j, w, band, c);
}

function paintOrganic(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  v: JiaVariant,
  ink: JiaBodyColors,
): void {
  const wide = v === 1 ? 2 : 0;
  const reach = v === 1 ? -2 : 0;
  if (facing === 'up') {
    bar(buf, facing, d, 12 - wide, 3, 6 + wide, 'head', ink.cloth);
    bar(buf, facing, d, 11 - wide, 4, 8 + wide * 2, 'head', ink.flesh);
    bar(buf, facing, d, 10 - wide, 5, 10 + wide * 2, 'head', ink.flesh);
    bar(buf, facing, d, 10 - wide, 6, 10 + wide * 2, 'head', ink.bone);
    bar(buf, facing, d, 11 - wide, 7, 8 + wide * 2, 'head', ink.flesh);
    box(buf, facing, d, 8 - wide, 8, 14 + wide * 2, 9, 'body', ink.cloth);
    bar(buf, facing, d, 7 - wide, 10, 16 + wide * 2, 'body', ink.flesh);
    bar(buf, facing, d, 9 - wide, 16, 12 + wide * 2, 'body', ink.cloth);
    put(buf, facing, d, 21 + wide, 11, 'body', ink.bone);
    box(buf, facing, d, 5, 2, 4, 9, 'arm', ink.cloth);
    put(buf, facing, d, 5, 1, 'arm', ink.cloth);
    box(buf, facing, d, 10, 17, 4, 8, 'foot', ink.flesh);
    box(buf, facing, d, 16, 17, 4, 8, 'foot', ink.cloth);
    bar(buf, facing, d, 10, 25, 4, 'foot', ink.cloth);
    bar(buf, facing, d, 16, 25, 4, 'foot', ink.cloth);
    if (v === 2) punchSeam(buf, facing, d, 16, 9, 8, 'body');
    return;
  }
  bar(buf, facing, d, 12 - wide, 3, 6 + wide, 'head', ink.flesh);
  bar(buf, facing, d, 11 - wide, 4, 8 + wide * 2, 'head', ink.flesh);
  bar(buf, facing, d, 10 - wide, 5, 10 + wide * 2, 'head', ink.cloth);
  put(buf, facing, d, 13, 4, 'head', ink.bone);
  bar(buf, facing, d, 12 - wide, 6, 7 + wide, 'head', ink.earth);
  bar(buf, facing, d, 10 - wide, 7, 10 + wide * 2, 'head', ink.flesh);
  bar(buf, facing, d, 11 - wide, 8, 8 + wide * 2, 'head', ink.cloth);
  bar(buf, facing, d, 12 - wide, 9, 6 + wide, 'head', ink.flesh);
  bar(buf, facing, d, 8 - wide, 10, 14 + wide * 2, 'body', ink.flesh);
  bar(buf, facing, d, 7 - wide, 11, 16 + wide * 2, 'body', ink.cloth);
  bar(buf, facing, d, 7 - wide, 12, 16 + wide * 2, 'body', ink.flesh);
  bar(buf, facing, d, 8 - wide, 13, 14 + wide * 2, 'body', ink.flesh);
  bar(buf, facing, d, 8 - wide, 14, 14 + wide * 2, 'body', ink.cloth);
  bar(buf, facing, d, 9 - wide, 15, 12 + wide * 2, 'body', ink.flesh);
  bar(buf, facing, d, 9 - wide, 16, 12 + wide * 2, 'body', ink.cloth);
  bar(buf, facing, d, 10 - wide, 17, 10 + wide * 2, 'body', ink.flesh);
  put(buf, facing, d, 7 - wide, 14, 'body', ink.bone);
  box(buf, facing, d, 5, 12, 3, 6, 'arm', ink.cloth);
  put(buf, facing, d, 5, 18, 'arm', ink.flesh);
  box(buf, facing, d, 21 + reach, 11, 4, 10, 'arm', ink.cloth);
  box(buf, facing, d, 24 + reach, 18, 3, 6, 'arm', ink.cloth);
  put(buf, facing, d, 27 + reach, 23, 'arm', ink.cloth);
  put(buf, facing, d, 27 + reach, 24, 'arm', ink.flesh);
  box(buf, facing, d, 10, 18, 4, 8, 'foot', ink.flesh);
  box(buf, facing, d, 16, 19, 4, 8, 'foot', ink.cloth);
  bar(buf, facing, d, 10, 26, 4, 'foot', ink.cloth);
  bar(buf, facing, d, 16, 27, 4, 'foot', ink.cloth);
  if (v === 2) punchSeam(buf, facing, d, 16, 11, 7, 'body');
}

function punchSeam(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  x: number,
  y: number,
  h: number,
  band: Band,
): void {
  const clear: Rgba = [0, 0, 0, 0];
  for (let j = 0; j < h; j++) put(buf, facing, d, x, y + j, band, clear);
}

function stem(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  x: number,
  top: number,
  bot: number,
  ink: JiaBodyColors,
  shatter: boolean,
): void {
  for (let y = top; y <= bot; y++) {
    const band: Band = y < 10 ? 'head' : y > 22 ? 'foot' : 'body';
    const c = y > 22 ? ink.earth : y < top + 2 ? ink.bone : ink.cloth;
    put(buf, facing, d, x, y, band, c);
    if (y > top + 3 && y < bot - 2) put(buf, facing, d, x + 1, y, band, ink.flesh);
  }
  if (shatter) {
    put(buf, facing, d, x - 1, top, 'head', ink.bone);
    put(buf, facing, d, x + 1, top + 1, 'head', ink.earth);
    punchSeam(buf, facing, d, x, top, 1, 'head');
  }
}

function paintStalk(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  v: JiaVariant,
  ink: JiaBodyColors,
): void {
  const lean = v === 1 ? -2 : 0;
  if (v === 2) {
    stem(buf, facing, d, 13 + lean, 7, 26, ink, true);
    stem(buf, facing, d, 19 + lean + d.gap, 8, 26, ink, true);
    bar(buf, facing, d, 12 + lean, 26, 10 + d.gap, 'foot', ink.earth);
    bar(buf, facing, d, 13 + lean, 27, 8 + d.gap, 'foot', ink.shadow);
    return;
  }
  const xs = v === 1 ? [12, 14, 16, 18, 20] : [14, 16, 17, 19];
  for (const x of xs) stem(buf, facing, d, x + lean, x % 2 === 0 ? 6 : 8, 26, ink, true);
  bar(buf, facing, d, 12 + lean, 26, 10, 'foot', ink.earth);
  bar(buf, facing, d, 13 + lean, 27, 8, 'foot', ink.shadow);
}

function paintLamp(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  v: JiaVariant,
  ink: JiaBodyColors,
): void {
  const faceNudge = facing === 'right' ? 1 : facing === 'left' ? -1 : 0;
  if (v === 1) {
    box(buf, facing, d, 13, 8, 5, 18, 'body', ink.metal);
    bar(buf, facing, d, 13, 14, 5, 'body', ink.metalMid);
    box(buf, facing, d, 12, 24, 7, 4, 'foot', ink.concrete);
    bar(buf, facing, d, 12, 28, 7, 'foot', ink.shadow);
    put(buf, facing, d, 15 + faceNudge, 10, 'body', ink.glow);
    return;
  }
  if (v === 2) {
    box(buf, facing, d, 14, 16, 3, 10, 'body', ink.metal);
    box(buf, facing, d, 15, 6, 3, 10, 'head', ink.metalMid);
    bar(buf, facing, d, 14, 15, 4, 'body', ink.concrete);
    box(buf, facing, d, 13, 24, 5, 4, 'foot', ink.concrete);
    bar(buf, facing, d, 13, 28, 5, 'foot', ink.shadow);
    put(buf, facing, d, 16 + faceNudge, 15, 'body', ink.glow);
    return;
  }
  box(buf, facing, d, 14, 7, 3, 19, 'body', ink.metal);
  bar(buf, facing, d, 14, 12, 3, 'body', ink.metalMid);
  box(buf, facing, d, 13, 24, 5, 4, 'foot', ink.concrete);
  bar(buf, facing, d, 13, 28, 5, 'foot', ink.shadow);
  put(buf, facing, d, 15 + faceNudge, 5, 'head', ink.glow);
}

function paintRail(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  v: JiaVariant,
  ink: JiaBodyColors,
): void {
  if (v === 2) {
    box(buf, facing, d, 13, 8, 2, 18, 'body', ink.metal);
    box(buf, facing, d, 17, 8, 2, 18, 'body', ink.metalMid);
    bar(buf, facing, d, 12, 25, 8, 'foot', ink.concrete);
    bar(buf, facing, d, 12, 27, 8, 'foot', ink.shadow);
    return;
  }
  box(buf, facing, d, 15, 8, 2, 18, 'body', ink.metal);
  bar(buf, facing, d, 13, 25, 6, 'foot', ink.concrete);
  bar(buf, facing, d, 12, 26, 8, 'foot', ink.metalMid);
  bar(buf, facing, d, 12, 28, 8, 'foot', ink.shadow);
  if (v === 1) bar(buf, facing, d, 12, 8, 8, 'head', ink.metal);
}

function paintDoor(
  buf: PaintBuf,
  facing: Facing4,
  d: JiaDeform,
  v: JiaVariant,
  ink: JiaBodyColors,
): void {
  const hitchL = d.footDy;
  const hitchR = -d.footDy;
  const lintelY = v === 2 ? 8 : 6;
  if (v !== 1) {
    box(buf, facing, { ...d, footDy: hitchR }, 20, 6, 3, 22, 'foot', ink.metalMid);
  }
  box(buf, facing, { ...d, footDy: hitchL }, 9, 6, 3, 22, 'foot', ink.metal);
  bar(buf, facing, d, 9, lintelY, 14, 'head', ink.bone);
  bar(buf, facing, d, 9, lintelY + 1, 14, 'head', ink.metal);
  bar(buf, facing, d, 10, lintelY + 2, 12, 'head', ink.concrete);
  bar(buf, facing, d, 10, 27, 12, 'foot', ink.shadow);
  if (v === 1) {
    box(buf, facing, { ...d, footDy: hitchR }, 20, 20, 2, 8, 'foot', ink.metalMid);
  }
}

export function paintJiaSilhouette(
  buf: PaintBuf,
  family: JiaFamily,
  variant: JiaVariant,
  facing: Facing4,
  d: JiaDeform,
  ink: JiaBodyColors,
): void {
  switch (family) {
    case 'organic_remnant':
      paintOrganic(buf, facing, d, variant, ink);
      return;
    case 'stalk_clump':
      paintStalk(buf, facing, d, variant, ink);
      return;
    case 'lamp_pillar':
      paintLamp(buf, facing, d, variant, ink);
      return;
    case 'railing_post':
      paintRail(buf, facing, d, variant, ink);
      return;
    case 'doorframe':
      paintDoor(buf, facing, d, variant, ink);
      return;
  }
}

export function jiaDeform(
  recipe: { motion: string; anchored: boolean; family: JiaFamily; variant: JiaVariant },
  facing: Facing4,
  gait: 'idle' | 'walk',
  frame: number,
  strike: boolean,
): JiaDeform {
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const strikeLean = strike ? 2 : 0;
  const strikeReach = strike ? 2 : 0;
  if (recipe.anchored) {
    if (frame === 1) {
      return { ...ZERO_DEFORM, bodyDy: -1, headDy: -1, lean: strikeLean, armExtra: strikeReach };
    }
    if (frame === 3) return { ...ZERO_DEFORM, bodyDy: 1, speck: 1, lean: strikeLean };
    return { ...ZERO_DEFORM, lean: strikeLean, armExtra: strikeReach };
  }
  if (gait === 'idle') {
    if (frame === 1) {
      return { ...ZERO_DEFORM, bodyDy: -1, headDy: -1, lean: 1 + strikeLean, armExtra: strikeReach };
    }
    if (frame === 3) {
      return { ...ZERO_DEFORM, bodyDy: 1, footDy: 1, speck: 1, lean: strikeLean };
    }
    return { ...ZERO_DEFORM, lean: strikeLean, armExtra: strikeReach };
  }
  const lunge = frame === 1;
  const plant = frame === 3;
  let dx = side * (lunge ? 2 : 1);
  let arm = (lunge ? 3 : 1) + strikeReach;
  let lean = (lunge ? 2 : 1) + strikeLean;
  let speck = lunge ? 1 : plant ? -1 : 0;
  let gap = 0;
  if (recipe.family === 'stalk_clump' && recipe.variant === 2 && (lunge || plant)) gap = 1;
  if (recipe.motion === 'motion_coalesce') {
    return {
      ...ZERO_DEFORM,
      bodyDy: lunge ? 2 : plant ? -1 : 0,
      headDy: lunge ? 1 : 0,
      armExtra: -Math.abs(arm),
      speck: 1,
      lean: strikeLean,
      gap,
    };
  }
  if (recipe.motion === 'motion_turn') lean += 1;
  if (recipe.motion === 'motion_wall') dx += side * 2;
  if (recipe.motion === 'motion_wind') speck += 1;
  if (recipe.motion === 'motion_trail') dx += side;
  return {
    dx,
    headDy: lunge ? -1 : plant ? 1 : 0,
    bodyDy: lunge ? -2 : plant ? 2 : 0,
    footDy: lunge ? -2 : plant ? 2 : 0,
    armExtra: arm,
    lean,
    speck,
    gap,
  };
}
