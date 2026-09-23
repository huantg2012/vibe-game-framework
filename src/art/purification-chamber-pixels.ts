import {
  CHAMBER_DEVICE_BASES,
  CHAMBER_CONTACTS,
  CHAMBER_DEVICE_FLOORS,
  type ChamberDevice,
} from '../systems/purification-chamber-layout';
import { paintRiftShell } from './chamber-device-motion';
import type { ChamberSurfaceMap, SurfacePlane } from './chamber-surface-map';
import { paintAuthoredChamberArchitecture, paintAuthoredChamberFloor, paintAuthoredChamberForeground } from './chamber-authored-architecture';

import { CHAMBER_PALETTE, horizontal, upright } from './chamber-pixel-helpers';
export { CHAMBER_PALETTE } from './chamber-pixel-helpers';
export { paintChamberExterior } from './chamber-exterior-pixels';

/** World-space hard pixels. Material faces, rather than outlines, carry the silhouettes. */
export type ChamberPoint = readonly [number, number];
const c = CHAMBER_PALETTE;

export class ChamberPixels {
  private offsetX = 0;
  private offsetY = 0;
  private offsetZ = 0;
  constructor(readonly ctx: CanvasRenderingContext2D, readonly surfaces?: ChamberSurfaceMap) {
    ctx.imageSmoothingEnabled = false;
  }
  /** Planes are authored in the same local pixel coordinates as the colour shapes. */
  setPlane(plane: SurfacePlane | null): void {
    this.surfaces?.setPlane(plane && {
      ...plane,
      elevation: plane.elevation + this.offsetZ,
      originX: (plane.originX ?? 0) + this.offsetX,
      originY: (plane.originY ?? 0) + this.offsetY,
    });
  }
  /** The device painter balances this translation; there is no per-pixel getTransform. */
  translate(x: number, y: number, elevation = 0): void {
    this.ctx.translate(x, y);
    this.offsetX += x; this.offsetY += y; this.offsetZ += elevation;
  }
  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    const left = Math.round(x); const top = Math.round(y);
    const width = Math.round(w); const height = Math.round(h);
    this.ctx.fillRect(left, top, width, height);
    this.surfaces?.stamp(left + this.offsetX, top + this.offsetY, width, height);
  }
  poly(points: readonly ChamberPoint[], color: string): void {
    const minY = Math.ceil(Math.min(...points.map(p => p[1])));
    const maxY = Math.ceil(Math.max(...points.map(p => p[1])));
    this.ctx.fillStyle = color;
    for (let y = minY; y < maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!; const b = points[(i + 1) % points.length]!;
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const left = Math.ceil(xs[i]!);
        const width = Math.max(0, Math.ceil(xs[i + 1]!) - left);
        this.ctx.fillRect(left, y, width, 1);
        this.surfaces?.stamp(left + this.offsetX, y + this.offsetY, width, 1);
      }
    }
  }
  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
    let x = Math.round(x1); let y = Math.round(y1);
    const tx = Math.round(x2); const ty = Math.round(y2);
    const dx = Math.abs(tx - x); const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1; const sy = y < ty ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.rect(x, y, width, width, color);
      if (x === tx && y === ty) break;
      const twice = error * 2;
      if (twice >= dy) { error += dy; x += sx; }
      if (twice <= dx) { error += dx; y += sy; }
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let y = -Math.floor(ry); y <= ry; y++) {
      const x = Math.floor(rx * Math.sqrt(Math.max(0, 1 - y * y / (ry * ry))));
      this.rect(cx - x, cy + y, 2 * x + 1, 1, color);
    }
  }
  block(x: number, y: number, w: number, h: number, depth = 5,
    front: string = c.plane, top: string = c.steel, side: string = c.concrete,
    elevation = -y): void {
    const rise = Math.round(depth * .5);
    const previous = this.surfaces?.getPlane() ?? null;
    // A block is real solid construction, including the few purchased feet extending a base.
    this.setPlane({ normal: [0, 1, 0], elevation, originY: y, riseY: -1, roughness: .65 });
    this.rect(x, y, w, h, front);
    this.setPlane({ normal: [0, 0, 1], elevation, roughness: .65 });
    this.poly([[x, y], [x + depth, y - rise], [x + w + depth, y - rise], [x + w, y]], top);
    this.setPlane({ normal: [1, 0, 0], elevation, originX: x + w, originY: y,
      riseX: depth ? -rise / depth : 0, riseY: -1, roughness: .65 });
    this.poly([[x + w, y], [x + w + depth, y - rise], [x + w + depth, y + h - rise], [x + w, y + h]], side);
    // previous already contains the world transform; do not transform it a second time.
    this.surfaces?.setPlane(previous);
  }
  bolt(x: number, y: number): void {
    this.rect(x, y, 2, 2, c.edge);
    this.rect(x + 1, y + 1, 1, 1, c.concrete);
  }
}

/** Authored whole-room plates share their colour, surface and collision coordinates. */
export function paintChamberArchitecture(p: ChamberPixels): void {
  paintAuthoredChamberArchitecture(p);
  paintAuthoredChamberFloor(p);
}

export const paintChamberForeground = paintAuthoredChamberForeground;

export interface ChamberDeviceState {
  core: number; storage: number; purifier: number;
  thickenLevel: number; growthLevels: number;
}

/** These are public damage states of three local stops, never a prediction of the next impact. */
export function paintChamberResistance(p: ChamberPixels, state: ChamberDeviceState): void {
  for (const [x, y, health, direction] of [
    [CHAMBER_CONTACTS.west.x, CHAMBER_CONTACTS.west.y, state.storage, 1],
    [CHAMBER_CONTACTS.rear.x, CHAMBER_CONTACTS.rear.y, state.core, 0],
    [CHAMBER_CONTACTS.east.x, CHAMBER_CONTACTS.east.y, state.purifier, -1],
  ] as const) {
    const bad = health < .25; const worn = health < 1;
    if (direction === 0) {
      p.poly([[x - 2, y - 19], [x + 2, y - 16], [x + 1, y - 7], [x - 1, y - 4]], c.deep);
      if (worn) p.poly([[x - 1, y - 7], [x + 3, y - 3], [x + 2, y + 4], [x - 2, y + 1]], c.teal);
      if (bad) p.poly([[x - 2, y + 6], [x + 3, y + 7], [x + 5, y + 17], [x, y + 14]], c.deep);
      else p.rect(x - 7, y + 10, 14, 3, c.plane);
    } else {
      p.poly([[x - 3, y - 17], [x + 2, y - 14], [x + 3, y - 6], [x - 1, y - 7]], c.deep);
      const stop = direction * (bad ? 13 : worn ? 8 : 3);
      p.poly([[x, y - 6], [x + stop, y - 4], [x + stop + direction * 3, y + 3], [x + direction * 3, y]], c.deep);
      if (worn) p.line(x, y - 3, x + stop, y, c.teal, 2);
      if (bad) p.poly([[x + stop, y + 1], [x + stop + direction * 5, y + 3], [x + stop + direction * 7, y + 10], [x + stop, y + 6]], c.deep);
      else p.rect(x + direction * 9 - 2, y - 3, 4, 11, c.plane);
    }
  }
}

export function paintChamberGrounding(p: ChamberPixels): void {
  for (const id of ['storage', 'core', 'purifier', 'growth', 'offering'] as const) {
    const { x, y } = CHAMBER_DEVICE_BASES[id];
    const width = id === 'purifier' ? 26 : id === 'growth' ? 18 : 20;
    // Contact is trapped under the true sole. The previous 5/3px ovals escaped
    // below the brightened floor and read as a second, crescent-shaped pedestal.
    p.ellipse(x - 1, y, width - 3, 2, c.concrete);
    p.ellipse(x, y, width - 7, 1, c.shadow);
  }
}

/** One device per transparent layer permits the same character to walk behind and in front. */
export function paintChamberDevice(p: ChamberPixels, id: ChamberDevice, state: ChamberDeviceState): void {
  const { x, y } = CHAMBER_DEVICE_BASES[id];
  const elevation = CHAMBER_DEVICE_FLOORS[id] === 'upper' ? 32 : 0;
  p.ctx.save(); p.translate(x, y, elevation);
  if (id === 'storage') storage(p);
  else if (id === 'core') core(p);
  else if (id === 'purifier') purifier(p);
  else if (id === 'growth') growth(p, state.growthLevels);
  else if (id === 'offering') offering(p);
  else rift(p);
  p.setPlane(null);
  finishDevice(p, id);
  if (id === 'core' || id === 'storage' || id === 'purifier') {
    fittings(p, id, state[id], state.thickenLevel);
  }
  p.setPlane(null);
  p.translate(-x, -y, -elevation); p.ctx.restore();
}

function finishDevice(p: ChamberPixels, id: ChamberDevice): void {
  if (id === 'storage') {
    p.line(-12,-28,-10,-31,c.edge);
    p.rect(-12,-26,2,2,c.plaster); p.rect(-8,-12,3,1,c.steel);
    p.rect(10,-27,2,6,c.shadow); p.rect(10,-25,1,3,c.steel);
    p.line(-13,-17,-8,-16,c.earth); p.rect(-6,-16,2,2,c.concrete);
    p.poly([[-12,-37],[-5,-39],[4,-38],[3,-36],[-5,-36]],c.edge);
    p.rect(10,-34,3,2,c.plane); p.rect(-13,-8,3,2,c.plane);
    p.poly([[-15,-5],[-11,-6],[-8,-4],[-10,-2],[-15,-3]],c.plane);
    p.rect(6,-4,4,1,c.plaster);
  } else if (id === 'core') {
    // Only tool marks and repaired joints are static. Captive matter is a live plate.
    p.line(-22,-67,-24,-54,c.edge);
    p.line(-24,-54,-24,-39,c.plane);
    p.poly([[-23,-32],[-19,-35],[-18,-29],[-21,-25]],c.plaster);
    p.line(20,-58,23,-46,c.steel);
    p.rect(23,-44,2,4,c.edge);
    p.line(-17,-83,-10,-88,c.glint);
    p.line(16,-72,20,-69,c.edge);
    p.bolt(-19,-54); p.bolt(18,-33);
    p.rect(-22,-9,3,2,c.earth);
    p.line(-13,-4,8,-3,c.steel);
  } else if (id === 'purifier') {
    p.rect(-19,-27,2,5,c.edge); p.rect(-19,-16,2,2,c.steel);
    p.line(-13,-34,-5,-35,c.glint); p.rect(5,-34,4,1,c.plane);
    p.poly([[18,-29],[20,-30],[20,-22],[18,-24]],c.plane);
    p.rect(-1,-26,1,3,c.edge); p.rect(-1,-18,1,2,c.earth);
    p.line(-11,-8,-4,-7,c.edge); p.line(3,-7,9,-6,c.plane);
    p.rect(-17,-5,5,1,c.plane); p.bolt(14,-5);
    p.poly([[23,-20],[26,-17],[27,-12],[25,-13]],c.steel);
  } else if (id === 'growth') {
    // Curved liquid has a narrow lit side, thicker dark edge, internal occlusion and bubbles.
    p.poly([[-10,-42],[-8,-43],[-8,-30],[-10,-27]],c.teal);
    p.poly([[8,-40],[11,-41],[11,-17],[8,-14],[8,-25],[9,-32]],c.deep);
    p.rect(-11,-24,1,7,c.teal); p.rect(-9,-15,4,1,c.teal);
    p.line(-8,-50,1,-51,c.glint); p.line(4,-50,9,-48,c.plane);
    p.rect(-14,-45,2,3,c.edge); p.rect(-15,-25,2,4,c.steel);
    p.rect(13,-39,1,4,c.steel); p.rect(13,-21,2,3,c.ash);
    p.poly([[-12,-12],[-8,-10],[-3,-10],[-3,-8],[-9,-8],[-12,-10]],c.rust);
    p.rect(4,-9,5,1,c.plane); p.bolt(-12,-40); p.bolt(13,-28);
    p.rect(15,-12,2,4,c.plane); p.rect(15,-10,1,2,c.warm);
  } else if (id === 'offering') {
    // Thickness is visible inside the far arc as well as along the exterior right return.
    p.poly([[-4,-33],[3,-34],[9,-30],[12,-24],[11,-18],[8,-16],[9,-24],[5,-29],[-2,-31]],c.concrete);
    p.line(-4,-39,3,-40,c.glint);
    p.line(-15,-29,-16,-24,c.edge);
    p.poly([[-14,-14],[-9,-11],[-8,-8],[-12,-10]],c.plaster);
    p.rect(12,-33,2,3,c.steel); p.rect(17,-27,2,3,c.plane);
    p.poly([[19,-16],[22,-18],[21,-13],[18,-10]],c.plane);
    p.rect(-7,-6,4,1,c.steel); p.rect(6,-4,3,1,c.plane);
    p.rect(-7,-37,2,1,c.plane); p.rect(6,-38,1,2,c.plane);
  }
}

/** Compatibility entry for still-image tooling; production uses individual device layers. */
export function paintChamberDevices(p: ChamberPixels, state: ChamberDeviceState): void {
  for (const id of ['rift', 'growth', 'offering', 'purifier', 'storage', 'core'] as const) {
    paintChamberDevice(p, id, state);
  }
}

function storage(p: ChamberPixels): void {
  // A deep sealed receiver, earth-filled cast foot and copper retaining bands, not a drawer.
  horizontal(p, 4, .87);
  p.poly([[-20, -8], [-12, -15], [15, -12], [21, -4], [12, 1], [-15, 1]], c.earth);
  upright(p, 0, 0, [0, 1, 0], .94);
  p.poly([[-16, -31], [-9, -40], [13, -38], [19, -30], [16, -8], [8, -4], [-15, -8]], c.plaster);
  upright(p, 0, 0, [1, 0, 0], .90, -.4, 8);
  p.poly([[8, -34], [18, -30], [16, -8], [8, -4]], c.concrete);
  upright(p, 0, 0, [0, 1, 0], .96, .13, 8);
  p.poly([[-15, -31], [-8, -34], [8, -33], [8, -7], [-15, -10]], c.plane);
  horizontal(p, 33, .97, .72);
  p.poly([[-15, -32], [-8, -39], [13, -37], [17, -31], [8, -28], [-8, -28]], c.steel);
  horizontal(p, 30, .57, .8);
  p.poly([[-10, -32], [-5, -36], [9, -35], [12, -32], [6, -30], [-6, -30]], c.recess);
  p.poly([[-6, -33], [0, -34], [7, -33], [4, -31], [-4, -31]], c.deep);
  p.setPlane(null);
  p.poly([[-17, -24], [8, -20], [18, -24], [18, -20], [8, -16], [-17, -20]], c.rust);
  p.poly([[-17, -12], [8, -8], [16, -12], [16, -8], [8, -4], [-17, -8]], c.earth);
  p.rect(-12, -28, 3, 16, c.concrete);
  p.rect(2, -26, 3, 12, c.concrete);
  p.block(13, -31, 5, 6, 2, c.earth, c.edge, c.concrete);
  p.rect(15, -29, 2, 2, c.warm);
  p.rect(16, -28, 1, 1, c.lamp);
  p.bolt(-14, -22); p.bolt(7, -19);
}

function core(p: ChamberPixels): void {
  // A deep, open containment spine: unequal stone shoulders, recessed living
  // matter and opposed restraints. This is a built volume, not a glowing plaque.
  horizontal(p, 4, .9);
  p.poly([[-29,-6],[-17,-16],[18,-13],[30,-4],[19,2],[-22,1]],'#414344');
  horizontal(p, 8, .95);
  p.poly([[-20,-10],[-13,-17],[13,-15],[22,-8],[12,-3],[-15,-4]],c.edge);
  upright(p, 0, 0, [0,1,0], .58);
  p.poly([[-15,-76],[-6,-81],[5,-77],[14,-65],[16,-27],[10,-16],[-10,-16],[-17,-30]],'#111d20');
  p.poly([[-12,-72],[-5,-77],[5,-74],[11,-63],[13,-29],[6,-19],[-7,-19],[-13,-32]],'#0c1719');
  upright(p, 0, 0, [0,1,0], .95);
  p.poly([[-28,-18],[-26,-58],[-21,-79],[-12,-89],[-5,-86],[-10,-69],[-15,-46],[-14,-19],[-19,-10]],'#454748');
  upright(p, 0, 0, [-.7,.71,0], .97);
  p.poly([[-21,-77],[-13,-86],[-9,-83],[-15,-64],[-18,-42],[-18,-17],[-23,-15],[-23,-44]],'#606469');
  upright(p, 0, 0, [1,0,0], .73);
  p.poly([[-9,-83],[-5,-86],[-7,-69],[-11,-48],[-10,-23],[-14,-19],[-15,-46]],'#282e30');
  horizontal(p, 88, .98, .72);
  p.poly([[-22,-80],[-13,-91],[-6,-90],[-2,-86],[-7,-84],[-12,-86],[-18,-80]],'#7a8183');
  upright(p, 0, 0, [1,0,0], .83);
  p.poly([[10,-70],[17,-74],[23,-63],[25,-46],[29,-15],[19,-9],[13,-27],[12,-49]],'#282d30');
  upright(p, 0, 0, [0,1,0], .94);
  p.poly([[15,-67],[19,-65],[22,-48],[23,-30],[26,-17],[21,-14],[18,-30],[17,-48]],'#484d4e');
  horizontal(p, 73, .96, .73);
  p.poly([[9,-71],[14,-78],[19,-75],[24,-67],[19,-65],[16,-71]],'#696f72');
  // Wide jaws bite into solid cheeks at different heights, leaving the centre open.
  p.setPlane(null);
  p.poly([[-27,-57],[-16,-55],[-11,-49],[-13,-44],[-27,-49]],'#665a49');
  p.poly([[-27,-57],[-23,-60],[-12,-55],[-11,-49],[-16,-52]],'#82785f');
  p.line(-26,-51,-16,-48,'#292b27',2);
  p.poly([[10,-38],[24,-35],[28,-29],[25,-24],[13,-29]],'#5c5345');
  p.poly([[11,-38],[14,-41],[25,-37],[28,-29],[23,-32]],'#81775e');
  p.line(15,-32,25,-29,'#272b2a',2);
  p.block(-27,-18,11,10,3,c.concrete,c.steel,c.shadow);
  p.block(15,-13,11,8,3,c.plane,c.edge,c.concrete);
  p.poly([[-14,-17],[-7,-13],[8,-14],[13,-19],[13,-10],[5,-7],[-9,-9],[-15,-12]],'#3c4543');
  p.line(-11,-12,-4,-10,'#616e68');
  p.bolt(-23,-15); p.bolt(20,-10);
}

function purifier(p: ChamberPixels): void {
  // Low open separation chamber. The bright upper plate and visible liquid divide its mass.
  horizontal(p, 3, .91);
  p.poly([[-27, -5], [-19, -12], [19, -10], [27, -3], [18, 1], [-22, 0]], c.plaster);
  p.block(-22, -8, 41, 6, 5, c.concrete, c.steel, c.shadow);
  horizontal(p, 31, .98, .62);
  p.poly([[-19, -34], [-11, -39], [17, -36], [23, -31], [16, -27], [-20, -29]], c.steel);
  p.setPlane(null);
  p.poly([[-17, -34], [-10, -37], [12, -34], [9, -31], [-17, -31]], c.edge);
  upright(p, 0, 0, [0, 1, 0], .95);
  p.rect(-20, -29, 5, 21, c.plane);
  upright(p, 0, 0, [1, 0, 0], .88, -.3, 15);
  p.poly([[15, -29], [22, -31], [21, -9], [15, -7]], c.concrete);
  upright(p, 0, 0, [0, 1, 0], .95);
  p.rect(14, -27, 3, 18, c.steel);
  upright(p, 0, 0, [0, 1, 0], .66);
  p.poly([[-14, -28], [12, -27], [12, -10], [-14, -12]], c.recess);
  p.poly([[-12, -26], [-4, -24], [-2, -18], [5, -19], [10, -15], [10, -11], [-12, -13]], c.deep);
  p.poly([[-10, -24], [-6, -23], [-5, -17], [-8, -17]], c.teal);
  p.poly([[3, -16], [9, -14], [8, -12], [1, -13]], c.teal);
  upright(p, 0, 0, [0, 1, 0], .92);
  p.rect(-2, -27, 3, 13, c.plane);
  horizontal(p, 6, .94, .65);
  p.poly([[-11, -10], [12, -8], [16, -5], [-16, -7]], c.steel);
  p.setPlane(null);
  p.block(-25, -25, 6, 9, 2, c.earth, c.plane, c.concrete);
  p.rect(-24, -22, 2, 2, c.warm);
  upright(p, 0, 0, [1, 0, 0], .84);
  p.poly([[23, -25], [28, -22], [29, -10], [24, -6], [23, -10], [25, -13], [24, -21]], c.plane);
  p.setPlane(null);
  p.bolt(-19, -28); p.bolt(15, -26);
}

function growth(p: ChamberPixels, levels: number): void {
  // A person-sized liquid cylinder, not a chair, console, arch or empty ring.
  horizontal(p, 3, .87);
  p.ellipse(0, -3, 18, 5, c.concrete);
  upright(p, 0, 0, [0, 1, 0], .95);
  p.rect(-15, -47, 30, 42, c.concrete);
  horizontal(p, 47, .98, .65);
  p.ellipse(0, -47, 15, 6, c.steel);
  upright(p, 0, 0, [0, 1, 0], .90);
  p.rect(-12, -45, 24, 34, c.deep);
  horizontal(p, 43, .90, .4);
  p.ellipse(0, -44, 12, 4, c.teal);
  upright(p, 0, 0, [-.55, .835, 0], .90);
  p.rect(-10, -43, 7, 31, c.teal);
  upright(p, 0, 0, [0, 1, 0], .90);
  p.poly([[-3, -40], [7, -41], [10, -35], [8, -26], [10, -18], [6, -12], [-4, -13], [-6, -22], [-3, -28]], c.teal);
  p.poly([[-8, -38], [-3, -40], [-1, -37], [-6, -32], [-9, -32]], c.teal);
  p.poly([[-9, -22], [-6, -26], [-2, -26], [-3, -21], [-7, -18]], c.teal);
  p.rect(-8,-34,2,2,c.live);
  p.rect(-5,-22,1,2,c.live);
  // Dark, uneven inner mass gives volume without inventing another character.
  p.poly([[2, -35], [6, -33], [5, -26], [8, -23], [5, -17], [0, -17], [-1, -22], [2, -27]], c.deep);
  upright(p, 0, 0, [-.87, .5, 0], .94);
  p.rect(-15, -45, 3, 34, c.plane);
  upright(p, 0, 0, [.87, .5, 0], .89);
  p.rect(12, -43, 3, 33, c.ash);
  horizontal(p, 10, .90, .70);
  p.ellipse(0, -10, 15, 5, c.plane);
  horizontal(p, 49, .98, .65);
  p.poly([[-14, -49], [-9, -53], [5, -54], [13, -50], [9, -48], [-10, -47]], c.edge);
  upright(p, 0, 0, [0, 1, 0], .90);
  p.poly([[-15, -14], [-7, -11], [10, -12], [15, -15], [15, -10], [9, -7], [-7, -7], [-15, -10]], c.earth);
  p.setPlane(null);
  p.rect(-15, -43, 3, 7, c.earth);
  p.rect(12, -32, 3, 9, c.earth);
  p.line(-11, -34, -8, -37, c.plane);
  p.line(9, -23, 12, -26, c.plane);
  p.block(13, -16, 6, 12, 2, c.concrete, c.plane, c.shadow);
  if (levels > 0) { p.rect(-11, -9, 5, 2, c.steel); p.bolt(-10, -9); }
  if (levels >= 5) { p.rect(8, -11, 4, 3, c.steel); p.bolt(9, -10); }
  if (levels >= 12) p.poly([[-17, -17], [-14, -16], [-14, -6], [-18, -5]], c.plane);
}

function offering(p: ChamberPixels): void {
  // An actual see-through ring. Every angular segment is a material face, not an outline.
  const outside: ChamberPoint[] = [[-19,-22],[-16,-33],[-8,-41],[4,-43],[15,-37],[21,-27],[19,-14],[11,-6],[-1,-3],[-12,-8]];
  const inside: ChamberPoint[] = [[-10,-22],[-8,-28],[-4,-33],[3,-34],[9,-30],[12,-24],[11,-18],[6,-13],[0,-12],[-6,-15]];
  const colors = [c.plane,c.steel,c.edge,c.steel,c.plane,c.concrete,c.concrete,c.plane,c.plane,c.steel];
  for (let i = 0; i < outside.length; i++) {
    const next = (i + 1) % outside.length;
    const normal: SurfacePlane['normal'] = i < 2 ? [-.5, .866, 0]
      : i < 5 ? [0, .866, .5] : i < 7 ? [.5, .866, 0] : [0, 1, 0];
    upright(p, 0, 0, normal, .94);
    p.poly([outside[i]!, outside[next]!, inside[next]!, inside[i]!], colors[i]!);
  }
  upright(p, 0, 0, [1, 0, 0], .85);
  p.poly([[12,-36],[19,-34],[25,-25],[24,-12],[15,-3],[10,-6],[19,-15],[21,-27]], c.ash);
  horizontal(p, 3, .87);
  p.poly([[-10,-8],[-2,-5],[10,-7],[15,-2],[8,1],[-13,0],[-17,-3]], c.plaster);
  p.setPlane(null);
  p.poly([[-11,-29],[-5,-27],[-5,-24],[-12,-25]], c.earth);
  p.poly([[8,-18],[16,-21],[17,-17],[10,-14]], c.earth);
  p.bolt(-12, -26); p.bolt(13, -18);
  // The empty ring stays empty until the public offering state supplies anonymous matter.
}

const rift = paintRiftShell;

function fittings(p: ChamberPixels, id: 'core' | 'storage' | 'purifier', health: number, level: number): void {
  const width = id === 'purifier' ? 21 : 16;
  if (level > 0) {
    p.block(-width - 3, -8, 5, 8, 2, c.earth, c.plane, c.concrete);
    p.block(width - 3, -7, 5, 7, 2, c.earth, c.steel, c.concrete);
    p.bolt(-width - 2, -6); p.bolt(width - 2, -5);
  }
  if (level >= 2) p.poly([[-width,-4],[width,-3],[width+2,0],[-width,0]], c.plane);
  if (level >= 3) p.line(-width + 4, -2, width - 3, -1, c.steel, 2);
  // Each wound is within a real material face; no universal diagonal drawn over empty space.
  if (health < 1) {
    if (id === 'core') { p.line(-12,-30,-11,-25,c.shadow); p.line(-11,-25,-13,-20,c.shadow); }
    else if (id === 'storage') { p.line(3,-25,1,-22,c.shadow); p.line(1,-22,4,-18,c.shadow); }
    else { p.line(17,-25,16,-21,c.shadow); p.line(16,-21,18,-18,c.shadow); }
  }
  if (health < .25) {
    if (id === 'core') { p.rect(-13,-22,2,4,c.deep); p.rect(13,-20,2,5,c.shadow); }
    else if (id === 'storage') { p.rect(2,-21,2,4,c.deep); p.rect(-11,-15,3,3,c.shadow); }
    else { p.rect(16,-20,2,4,c.deep); p.rect(-19,-16,2,4,c.shadow); }
  }
}
