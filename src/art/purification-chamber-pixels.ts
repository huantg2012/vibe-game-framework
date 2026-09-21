import { CHAMBER_FLOORS, CHAMBER_STAIRS } from '../systems/purification-chamber-layout';

/** Pixel-native chamber painting. Every primitive is scan converted to whole pixels. */
export type ChamberPoint = readonly [number, number];

export const CHAMBER_PALETTE = {
  void: '#080a0c', black: '#0d1114', shadow: '#151a1e', recess: '#1e2228',
  concrete: '#2c2e33', plane: '#3a3d42', steel: '#4a4e55', edge: '#5a5f66',
  glint: '#8a8f96', pale: '#c8cdd4', rust: '#50463c', oxide: '#5d483e',
  olive: '#4f4835', warm: '#8a5c2a', lamp: '#c4873a',
  deep: '#0e4a3f', teal: '#1a6b5c', live: '#1aad96', light: '#2ae6c8',
} as const;

export class ChamberPixels {
  constructor(readonly ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  poly(points: readonly ChamberPoint[], color: string): void {
    const minY = Math.ceil(Math.min(...points.map(p => p[1])));
    const maxY = Math.ceil(Math.max(...points.map(p => p[1])));
    this.ctx.fillStyle = color;
    for (let y = minY; y < maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i]!;
        const b = points[(i + 1) % points.length]!;
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const left = Math.ceil(xs[i]!);
        this.ctx.fillRect(left, y, Math.max(0, Math.ceil(xs[i + 1]!) - left), 1);
      }
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
    let x = Math.round(x1);
    let y = Math.round(y1);
    const tx = Math.round(x2);
    const ty = Math.round(y2);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let error = dx + dy;
    for (;;) {
      this.rect(x, y, width, width, color);
      if (x === tx && y === ty) break;
      const double = error * 2;
      if (double >= dy) { error += dy; x += sx; }
      if (double <= dx) { error += dx; y += sy; }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let y = -Math.floor(ry); y <= ry; y++) {
      const x = Math.floor(rx * Math.sqrt(Math.max(0, 1 - y * y / (ry * ry))));
      this.rect(cx - x, cy + y, 2 * x + 1, 1, color);
    }
  }

  /** An oblique box: front face plus a top and right return, always (+depth,-depth*.7). */
  block(x: number, y: number, w: number, h: number, depth = 7,
    front: string = CHAMBER_PALETTE.plane, top: string = CHAMBER_PALETTE.steel,
    side: string = CHAMBER_PALETTE.concrete): void {
    const rise = Math.round(depth * .7);
    this.rect(x, y, w, h, front);
    this.poly([[x, y], [x + depth, y - rise], [x + w + depth, y - rise], [x + w, y]], top);
    this.poly([[x + w, y], [x + w + depth, y - rise], [x + w + depth, y + h - rise], [x + w, y + h]], side);
  }

  bolt(x: number, y: number): void {
    this.rect(x, y, 2, 2, CHAMBER_PALETTE.edge);
    this.rect(x + 1, y + 1, 1, 1, CHAMBER_PALETTE.concrete);
  }

  /** Clustered wear lies inside material, never scattered silhouette pixels. */
  wear(x: number, y: number, w: number, h: number, seed: number, color: string, count = 12): void {
    let value = seed >>> 0;
    for (let i = 0; i < count; i++) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      const px = x + 2 + value % Math.max(1, w - 7);
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      const py = y + 2 + value % Math.max(1, h - 5);
      this.rect(px, py, 2 + i % 4, 1 + Number(i % 5 === 0), color);
      if (i % 3 === 0) this.rect(px + 1, py + 1, 2, 1, color);
    }
  }
}

/** Distance planes retain objects with mass, not glowing lines or meteorological clouds. */
export function paintChamberExterior(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  p.rect(0, 0, 640, 400, c.void);
  // Far rewritten colonnade. The repeated upper/lower bands no longer share one gravity.
  for (let i = 0; i < 9; i++) {
    const x = i * 86 - 22;
    p.poly([[x, 0], [x + 30, 0], [x + 30, 42], [x + 43, 50], [x + 43, 151], [x + 20, 143], [x + 20, 88], [x, 75]], c.black);
    p.rect(x + 10, 16, 5, 57, c.shadow);
    p.poly([[x - 13, 357], [x + 57, 331], [x + 70, 333], [x + 13, 370], [x + 13, 400], [x - 13, 400]], c.black);
  }
  // Far remnants are connected volumes, cut through by voids rather than a fence of poles.
  p.poly([[14, 10], [90, 2], [132, 12], [132, 20], [91, 13], [29, 24], [29, 66], [14, 72]], c.black);
  p.poly([[216, 0], [292, 0], [305, 14], [274, 30], [246, 31], [246, 49], [226, 57], [226, 27], [254, 23], [273, 11], [216, 11]], c.black);
  p.poly([[372, 0], [399, 0], [399, 15], [433, 29], [475, 18], [475, 28], [433, 43], [380, 25]], c.black);
  p.line(252, 32, 265, 31, c.shadow);
  p.line(387, 26, 416, 39, c.shadow);
  // Middle mass: old structural shelves interleaved at impossible offsets.
  p.poly([[0, 41], [79, 21], [202, 24], [212, 34], [138, 51], [94, 55], [49, 76], [0, 81]], c.shadow);
  p.poly([[0, 50], [75, 30], [156, 32], [140, 38], [57, 43], [0, 60]], c.recess);
  p.poly([[435, 0], [446, 0], [486, 31], [561, 15], [640, 28], [640, 48], [561, 35], [502, 55], [472, 44]], c.shadow);
  p.poly([[545, 90], [590, 70], [640, 77], [640, 98], [606, 91], [557, 116]], c.recess);
  p.poly([[0, 308], [62, 312], [134, 353], [164, 362], [285, 351], [335, 368], [335, 386], [261, 369], [136, 380], [65, 338], [0, 334]], c.shadow);
  p.poly([[421, 355], [506, 342], [577, 349], [640, 319], [640, 354], [591, 373], [528, 366], [448, 377]], c.recess);
  p.poly([[451, 360], [532, 350], [576, 357], [640, 329], [640, 337], [576, 366], [525, 358]], c.concrete);
  // Middle shelves expose slab thickness, snapped webs and offset copies of one joint.
  for (const [x, y] of [[25, 50], [112, 33], [576, 30], [539, 361], [89, 340]] as const) {
    p.poly([[x, y], [x + 15, y - 4], [x + 31, y - 3], [x + 25, y + 2], [x + 13, y + 1]], c.recess);
    p.line(x + 2, y + 5, x + 16, y + 2, c.black, 2);
    p.poly([[x + 8, y + 7], [x + 15, y + 5], [x + 12, y + 17], [x + 5, y + 20]], c.shadow);
  }
  // Near covered remnants lean against the chamber without making the wall a forcefield.
  p.poly([[0, 116], [29, 96], [48, 97], [62, 143], [57, 206], [34, 240], [24, 299], [0, 318]], c.recess);
  p.poly([[5, 131], [19, 116], [32, 119], [40, 148], [32, 192], [14, 228], [7, 269], [0, 276]], c.concrete);
  p.poly([[584, 142], [601, 113], [624, 108], [640, 119], [640, 276], [616, 281], [599, 258], [596, 211]], c.recess);
  p.poly([[610, 142], [618, 131], [637, 129], [640, 134], [640, 240], [627, 249], [615, 226]], c.concrete);
  // Concrete still has layered breaks beneath the foreign repetition: three coarse planes.
  p.poly([[8, 134], [18, 121], [27, 123], [34, 145], [27, 151], [22, 131]], c.plane);
  p.poly([[7, 165], [25, 156], [23, 164], [12, 174], [8, 190], [4, 193]], c.shadow);
  p.poly([[14, 202], [25, 184], [30, 185], [26, 204], [17, 211], [13, 233], [7, 237]], c.recess);
  p.line(19, 134, 23, 148, c.recess, 2);
  p.line(15, 143, 18, 157, c.recess, 2);
  p.line(622, 141, 635, 139, c.plane, 2);
  p.poly([[619, 153], [636, 149], [640, 156], [630, 163], [622, 161]], c.shadow);
  p.poly([[623, 179], [633, 174], [640, 179], [640, 186], [628, 191]], c.plane);
  p.line(625, 204, 638, 202, c.shadow, 3);
  p.line(624, 221, 632, 232, c.recess, 2);
  p.wear(13, 130, 13, 26, 8201, c.concrete, 4);
  p.wear(620, 188, 19, 39, 3701, c.recess, 7);
  // Foreign repetition has a material body, faceted and heavier at the bottom.
  for (const [x, y, mirror] of [[34, 95, 1], [590, 148, -1], [58, 302, 1], [561, 320, -1]] as const) {
    for (let i = 0; i < 4; i++) {
      const xx = x + mirror * i * 5;
      const yy = y + i * 12;
      p.poly([[xx, yy], [xx + mirror * 20, yy + 4], [xx + mirror * 14, yy + 17], [xx - mirror * 3, yy + 12]], c.deep);
      p.line(xx, yy + 2, xx + mirror * 16, yy + 5, c.teal);
      p.line(xx + mirror * 13, yy + 6, xx + mirror * 10, yy + 12, c.shadow, 2);
    }
  }
  p.line(9, 161, 17, 164, c.deep, 3);
  p.line(624, 247, 637, 241, c.deep, 3);
  // A near broken carrier crosses the frame edge; the chamber sits inside a larger world.
  p.poly([[0, 350], [21, 339], [37, 344], [39, 357], [72, 374], [83, 400], [61, 400], [49, 384], [13, 368], [0, 371]], c.shadow);
  p.poly([[0, 350], [21, 339], [37, 344], [25, 350], [10, 354], [0, 358]], c.concrete);
  p.poly([[613, 0], [640, 0], [640, 54], [630, 65], [616, 56], [609, 26]], c.shadow);
  p.poly([[615, 5], [622, 0], [630, 0], [626, 28], [635, 43], [629, 51], [618, 32]], c.recess);
}

function paintWallPocket(p: ChamberPixels, x: number, y: number, w: number, h: number): void {
  const c = CHAMBER_PALETTE;
  p.rect(x, y, w, h, c.shadow);
  p.poly([[x, y], [x + 8, y + 5], [x + 8, y + h], [x, y + h]], c.concrete);
  p.rect(x + 8, y + 5, w - 10, h - 5, c.recess);
  p.rect(x + 8, y + 5, w - 10, 3, c.black);
  p.rect(x + w - 3, y + 5, 3, h - 5, c.plane);
  p.poly([[x, y + h], [x + 10, y + h - 7], [x + w + 2, y + h - 7], [x + w - 8, y + h]], c.plane);
}

function paintFloor(p: ChamberPixels, x: number, right: number, footY: number, upper: boolean): void {
  const c = CHAMBER_PALETTE;
  const back = footY - 29;
  p.poly([[x, footY], [x + 19, back], [right + 14, back], [right, footY]], c.plane);
  p.poly([[x, footY], [right, footY], [right, footY + (upper ? 15 : 25)], [x, footY + (upper ? 15 : 25)]], c.concrete);
  p.poly([[right, footY], [right + 14, back], [right + 14, back + (upper ? 15 : 25)], [right, footY + (upper ? 15 : 25)]], c.shadow);
  p.rect(x, footY, right - x, 3, c.steel);
  p.rect(x + 3, footY + 4, right - x - 6, 2, c.recess);
  for (let xx = x + 27; xx < right - 15; xx += 41) {
    p.line(xx, footY - 2, xx + 17, back + 2, c.concrete);
    p.line(xx + 3, footY + 6, xx + 3, footY + (upper ? 12 : 20), c.shadow);
    p.wear(xx - 19, footY - 22, 29, 17, xx, c.steel, 3);
    p.wear(xx - 22, footY + 7, 28, upper ? 6 : 13, xx * 8, c.plane, 2);
  }
  // Uneven replacements describe use, while the continuous floor remains readable.
  p.poly([[x + 56, footY - 3], [x + 69, footY - 22], [x + 102, footY - 22], [x + 89, footY - 3]], c.steel);
  p.line(x + 62, footY - 5, x + 88, footY - 5, c.edge);
  for (let i = 0; i < 4; i++) p.line(x + 71 + i * 6, footY - 19, x + 63 + i * 6, footY - 6, c.plane);
}

function paintStair(p: ChamberPixels, left: boolean): void {
  const c = CHAMBER_PALETTE;
  const stair = CHAMBER_STAIRS[left ? 'left-stair' : 'right-stair'];
  const bottomX = stair.start.x;
  const topX = stair.end.x;
  const sign = left ? 1 : -1;
  // Solid stringer and its return are load-bearing, not a ladder pasted over the room.
  p.poly([[bottomX - sign * 14, 296], [topX - sign * 14, 190], [topX + sign * 10, 190], [bottomX + sign * 10, 308]], c.shadow);
  p.poly([[bottomX + 12, 285], [topX + 12, 179], [topX + 21, 188], [bottomX + 21, 294]], c.concrete);
  for (let i = 9; i >= 0; i--) {
    const y = 296 - i * 10.6;
    const x = bottomX + sign * i * 9.6;
    p.poly([[x - 13, y], [x + 2, y - 10], [x + 22, y - 10], [x + 7, y]], c.steel);
    p.rect(x - 13, y, 21, 5, c.concrete);
    p.line(x - 12, y, x + 6, y, c.edge);
    p.rect(x - 9, y + 2, 7, 1, c.plane);
  }
  // Rear handrail never crosses the walking actor.
  p.line(bottomX + 16, 250, topX + 16, 144, c.shadow, 4);
  p.line(bottomX + 16, 248, topX + 16, 142, c.steel, 2);
  for (let i = 0; i < 4; i++) {
    const x = bottomX + sign * i * 32 + 17;
    const y = 286 - i * 35.3;
    p.rect(x, y - 31, 3, 27, c.plane);
    p.rect(x, y - 32, 1, 25, c.edge);
  }
}

export function paintChamberArchitecture(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  // Structural silhouette: offset roof, deep side jambs and foundation continue offstage.
  p.poly([[74, 80], [97, 52], [536, 52], [572, 82], [572, 302], [553, 331], [73, 331], [56, 309], [56, 106]], c.shadow);
  p.poly([[75, 87], [98, 62], [533, 62], [560, 87], [560, 294], [542, 312], [85, 312], [72, 296]], c.concrete);
  p.rect(89, 87, 458, 206, c.recess);
  p.poly([[77, 87], [91, 76], [91, 289], [77, 302]], c.plane);
  p.poly([[548, 87], [565, 74], [565, 300], [548, 312]], c.black);
  p.rect(81, 73, 470, 10, c.steel);
  p.rect(95, 84, 440, 6, c.black);
  p.poly([[81, 73], [95, 63], [562, 63], [550, 73]], c.edge);
  p.line(105, 64, 142, 64, c.glint);
  p.line(204, 64, 239, 64, c.steel);
  p.line(385, 64, 418, 64, c.glint);
  p.line(460, 64, 510, 64, c.steel);
  // Roof repairs break a uniform bar: scarfed plates are bolted over a continuous beam.
  p.block(153, 66, 31, 14, 5, c.plane, c.edge, c.concrete);
  p.block(354, 65, 24, 16, 7, c.plane, c.edge, c.concrete);
  p.rect(260, 74, 67, 7, c.plane);
  p.rect(268, 74, 47, 1, c.edge);
  p.poly([[450, 76], [475, 76], [479, 79], [472, 82], [451, 81]], c.concrete);
  for (const x of [157, 176, 357, 369]) { p.bolt(x, 70); p.bolt(x, 77); }
  // Joined concrete bays retain large, restful planes; clusters define damp and repairs.
  for (let i = 0; i < 7; i++) {
    const x = 96 + i * 63;
    p.rect(x, 95, 59, 73, i % 3 === 1 ? c.concrete : c.recess);
    p.rect(x, 209, 59, 67, i % 2 === 0 ? c.concrete : c.recess);
    p.rect(x + 57, 96, 2, 66, c.shadow);
    p.wear(x + 3, 99, 45, 50, i * 893 + 3, c.shadow, 6);
    p.wear(x + 3, 215, 43, 40, i * 543 + 7, c.recess, 5);
  }
  // Concentrated masonry seams and ceiling knees replace a flat wallpaper treatment.
  for (const x of [103, 188, 421, 515]) {
    p.poly([[x, 87], [x + 20, 87], [x + 20, 93], [x + 9, 103], [x, 103]], c.plane);
    p.poly([[x + 20, 87], [x + 25, 84], [x + 25, 92], [x + 9, 107], [x + 9, 103], [x + 20, 93]], c.concrete);
    p.rect(x + 3, 90, 4, 9, c.steel);
    p.bolt(x + 4, 93);
  }
  p.line(318, 91, 318, 94, c.shadow, 2);
  p.line(318, 94, 327, 97, c.shadow);
  p.line(327, 97, 329, 103, c.shadow);
  p.line(92, 144, 119, 144, c.shadow);
  p.line(120, 144, 130, 148, c.shadow);
  p.line(130, 148, 142, 148, c.shadow);
  p.poly([[431, 146], [438, 146], [441, 151], [452, 152], [452, 157], [437, 154]], c.concrete);
  p.rect(483, 143, 17, 4, c.concrete);
  p.rect(484, 147, 9, 9, c.shadow);
  p.rect(505, 231, 18, 3, c.plane);
  p.rect(500, 236, 25, 2, c.shadow);
  p.poly([[331, 244], [337, 245], [341, 259], [334, 257]], c.shadow);
  // Rear observation slits have thick sills and reveals. They are closed glazed recesses.
  for (const [x, y, w] of [[115, 107, 61], [442, 109, 62], [301, 101, 43]] as const) {
    p.rect(x - 4, y - 4, w + 8, 23, c.plane);
    p.rect(x, y, w, 13, c.black);
    p.poly([[x + 2, y + 10], [x + 19, y + 4], [x + 34, y + 7], [x + w - 2, y + 2], [x + w - 2, y + 11]], c.deep);
    p.line(x + 8, y + 6, x + 20, y + 3, c.teal);
    p.rect(x + Math.floor(w * .58), y, 3, 13, c.shadow);
    p.poly([[x - 4, y + 19], [x + 3, y + 14], [x + w + 8, y + 14], [x + w + 1, y + 19]], c.steel);
    p.rect(x - 4, y + 19, w + 5, 3, c.concrete);
  }
  // Upper stations fasten into the building; not every function gets an identical niche.
  p.poly([[242, 119], [250, 112], [275, 112], [284, 120], [281, 165], [246, 165]], c.concrete);
  p.rect(248, 117, 4, 42, c.plane);
  p.rect(275, 122, 4, 38, c.shadow);
  p.bolt(249, 119); p.bolt(276, 154);
  p.rect(350, 150, 62, 17, c.concrete);
  p.poly([[350, 150], [358, 144], [416, 144], [412, 150]], c.plane);
  p.line(361, 144, 383, 144, c.steel);
  p.rect(401, 126, 6, 22, c.shadow);
  p.rect(402, 126, 2, 22, c.plane);
  paintWallPocket(p, 141, 222, 56, 59);
  // Core and purifier occupy one service trench, with one shared header and return.
  p.poly([[244, 230], [253, 218], [405, 218], [419, 228], [419, 278], [247, 278]], c.shadow);
  p.poly([[253, 226], [401, 226], [411, 232], [411, 272], [255, 272]], c.recess);
  p.rect(257, 222, 144, 3, c.plane);
  p.poly([[411, 231], [419, 228], [419, 278], [411, 272]], c.concrete);
  p.rect(303, 226, 9, 47, c.concrete);
  p.rect(344, 226, 10, 47, c.concrete);
  p.line(302, 230, 302, 261, c.steel, 2);
  p.line(302, 261, 343, 261, c.steel, 2);
  p.rect(311, 261, 33, 5, c.shadow);
  p.rect(326, 259, 7, 6, c.plane);
  p.poly([[246, 279], [255, 272], [419, 272], [410, 279]], c.plane);
  // Backbone ducts terminate at actual devices; the rails and conduits carry no new rules.
  p.rect(107, 197, 428, 4, c.black);
  p.rect(107, 196, 428, 2, c.plane);
  for (const x of [166, 276, 386]) {
    p.rect(x - 2, 198, 5, 19, c.shadow);
    p.rect(x - 1, 198, 2, 18, c.steel);
    p.rect(x - 4, 203, 8, 4, c.concrete);
  }
  // Stair load path lies outside lower device bays and connects into the landing.
  paintStair(p, true);
  paintStair(p, false);
  paintFloor(p, CHAMBER_FLOORS.main.start.x - 10, CHAMBER_FLOORS.main.end.x + 10, CHAMBER_FLOORS.main.start.y + 10, false);
  paintFloor(p, CHAMBER_FLOORS.upper.start.x - 10, CHAMBER_FLOORS.upper.end.x + 10, CHAMBER_FLOORS.upper.start.y + 10, true);
  // Open vertical space at both ends is an internal stairwell, never an exit.
  p.block(63, 85, 15, 218, 9, c.concrete, c.steel, c.shadow);
  p.block(563, 81, 13, 222, 8, c.concrete, c.steel, c.shadow);
  p.rect(69, 96, 3, 44, c.steel);
  p.rect(69, 163, 3, 99, c.plane);
  p.rect(568, 97, 3, 48, c.plane);
  p.rect(568, 179, 3, 95, c.steel);
  for (const [x, y] of [[65, 142], [67, 263], [565, 151], [565, 269]] as const) {
    p.block(x, y, 15, 13, 4, c.steel, c.edge, c.concrete);
    p.bolt(x + 3, y + 3);
    p.bolt(x + 10, y + 8);
  }
  // Underfloor structure has a real volume and inaccessible service cavities.
  p.rect(84, 323, 460, 7, c.recess);
  for (const x of [108, 207, 330, 457, 531]) {
    p.poly([[x, 319], [x + 13, 319], [x + 20, 346], [x + 5, 352]], c.concrete);
    p.poly([[x + 13, 319], [x + 21, 312], [x + 29, 340], [x + 20, 346]], c.shadow);
    p.rect(x + 6, 328, 3, 10, c.plane);
  }
  // Local working lights: salvaged, small, not decorative sci-fi strips.
  for (const [x, y] of [[211, 95], [318, 221], [435, 234]] as const) {
    p.rect(x - 3, y - 2, 9, 5, c.steel);
    p.rect(x, y + 3, 3, 3, c.lamp);
    p.poly([[x - 6, y + 8], [x + 9, y + 8], [x + 16, y + 25], [x - 12, y + 25]], c.concrete);
    p.rect(x, y + 7, 3, 1, c.warm);
  }
  p.wear(80, 75, 465, 8, 121, c.concrete, 20);
  p.wear(86, 304, 462, 14, 239, c.recess, 28);
  // Slab fracture and exposed reinforcement remain below the navigable surface.
  for (const x of [143, 294, 411]) {
    p.poly([[x, 318], [x + 7, 312], [x + 13, 313], [x + 17, 321], [x + 9, 324]], c.shadow);
    p.line(x + 4, 317, x + 11, 319, c.steel, 2);
    p.line(x + 10, 321, x + 18, 324, c.concrete);
  }
}

function feet(p: ChamberPixels, x: number, y: number, width: number): void {
  p.ellipse(x + 4, y + 2, width / 2 + 8, 4, CHAMBER_PALETTE.concrete);
  p.ellipse(x + 2, y + 1, width / 2 + 2, 2, CHAMBER_PALETTE.shadow);
}

function storage(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  feet(p, 166, 277, 41);
  p.block(143, 244, 43, 30, 8, c.steel, c.edge, c.concrete);
  p.rect(147, 249, 31, 19, c.plane);
  p.rect(147, 249, 31, 2, c.recess);
  p.rect(164, 251, 2, 17, c.concrete);
  p.rect(155, 255, 8, 3, c.edge);
  p.rect(155, 257, 8, 2, c.recess);
  p.block(139, 270, 48, 6, 7, c.concrete, c.steel, c.shadow);
  p.block(145, 235, 15, 7, 6, c.rust, c.steel, c.plane);
  p.rect(151, 237, 8, 2, c.olive);
  p.rect(185, 249, 4, 12, c.rust);
  p.wear(148, 252, 26, 16, 599, c.steel, 5);
  p.line(170, 240, 181, 240, c.glint);
  for (const [x, y] of [[145, 247], [179, 247], [146, 269], [179, 269]] as const) p.bolt(x, y);
}

function core(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  feet(p, 276, 278, 43);
  p.block(252, 267, 46, 9, 9, c.concrete, c.steel, c.shadow);
  // Offset feed casing rises through two asymmetrical clamps, not an altar/brazier.
  p.block(261, 230, 24, 37, 8, c.plane, c.edge, c.concrete);
  p.rect(267, 234, 12, 28, c.recess);
  p.poly([[270, 239], [278, 235], [280, 246], [275, 248], [277, 257], [269, 259], [272, 249]], c.deep);
  p.line(274, 241, 273, 252, c.teal, 2);
  p.block(249, 239, 10, 23, 4, c.steel, c.glint, c.concrete);
  p.block(287, 249, 12, 21, 5, c.steel, c.edge, c.concrete);
  p.rect(259, 245, 27, 5, c.steel);
  p.rect(259, 245, 27, 1, c.glint);
  p.rect(258, 259, 26, 4, c.concrete);
  p.rect(251, 255, 5, 4, c.rust);
  p.line(254, 240, 254, 251, c.edge);
  p.poly([[288, 233], [296, 235], [299, 246], [294, 246], [291, 239]], c.concrete);
  p.line(261, 231, 274, 231, c.glint);
  p.bolt(261, 246); p.bolt(281, 246); p.bolt(290, 251);
  p.wear(264, 253, 18, 12, 2801, c.steel, 3);
}

function purifier(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  feet(p, 386, 278, 44);
  p.block(362, 271, 45, 5, 8, c.concrete, c.edge, c.shadow);
  // Stacked replaceable filter leaves and a low intake distinguish it from the core.
  p.block(367, 238, 28, 32, 9, c.concrete, c.steel, c.shadow);
  for (let i = 0; i < 5; i++) {
    p.block(365, 240 + i * 6, 30, 3, 7, c.steel, c.edge, c.concrete);
    p.rect(369, 243 + i * 6, 23, 2, c.shadow);
  }
  p.block(395, 250, 11, 21, 7, c.plane, c.steel, c.concrete);
  p.rect(398, 252, 5, 10, c.recess);
  p.line(400, 254, 400, 259, c.deep, 2);
  p.poly([[362, 247], [357, 247], [355, 258], [358, 270], [364, 270], [362, 264], [360, 257]], c.plane);
  p.line(358, 251, 357, 258, c.edge, 2);
  p.block(368, 232, 13, 5, 6, c.rust, c.steel, c.concrete);
  p.bolt(397, 265); p.bolt(370, 274);
}

function growth(p: ChamberPixels, levels: number): void {
  const c = CHAMBER_PALETTE;
  feet(p, 262, 171, 42);
  // Reclined body cradle, head brace and separate adjustment column: an object to enter.
  p.block(241, 164, 42, 6, 7, c.concrete, c.steel, c.shadow);
  p.poly([[247, 164], [249, 149], [257, 122], [269, 122], [262, 151], [267, 163]], c.steel);
  p.poly([[253, 160], [254, 148], [260, 127], [267, 127], [260, 150], [262, 159]], c.recess);
  p.poly([[267, 122], [275, 116], [270, 146], [264, 151]], c.concrete);
  p.block(255, 121, 17, 6, 5, c.plane, c.edge, c.concrete);
  p.rect(261, 123, 6, 3, c.shadow);
  p.line(243, 135, 243, 158, c.steel, 3);
  p.line(277, 130, 277, 158, c.plane, 3);
  p.line(243, 145, 254, 145, c.edge, 3);
  p.line(266, 142, 277, 141, c.steel, 3);
  p.block(281, 145, 8, 23, 5, c.plane, c.edge, c.concrete);
  p.rect(283, 148, 4, 8, c.shadow);
  p.rect(283, 158, 4, 2, c.rust);
  p.poly([[242, 161], [237, 156], [237, 131], [245, 131], [245, 135], [240, 135], [240, 153], [247, 159]], c.concrete);
  if (levels > 0) {
    p.rect(250, 152, 13, 3, c.edge);
    p.bolt(250, 152); p.bolt(259, 152);
  }
  if (levels >= 5) p.block(269, 152, 5, 10, 3, c.steel, c.glint, c.concrete);
  if (levels >= 12) {
    p.block(232, 153, 7, 13, 4, c.plane, c.edge, c.concrete);
    p.line(235, 150, 244, 142, c.steel, 2);
  }
}

function offering(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  feet(p, 378, 171, 45);
  // Concrete tray with a long, exposed clamp. An accessible dangerous object, not shrine.
  p.block(351, 158, 47, 12, 9, c.concrete, c.steel, c.shadow);
  p.poly([[356, 157], [365, 151], [397, 151], [388, 157]], c.black);
  p.poly([[361, 157], [368, 153], [391, 153], [385, 157]], c.deep);
  p.block(389, 123, 6, 32, 5, c.steel, c.edge, c.concrete);
  p.block(356, 133, 5, 23, 5, c.plane, c.edge, c.concrete);
  p.block(361, 134, 31, 6, 4, c.steel, c.edge, c.concrete);
  p.rect(372, 139, 3, 11, c.plane);
  p.rect(383, 140, 3, 9, c.concrete);
  p.line(364, 134, 385, 134, c.glint);
  p.block(390, 122, 10, 6, 3, c.plane, c.steel, c.concrete);
  p.rect(354, 160, 11, 2, c.rust);
  p.bolt(354, 162); p.bolt(392, 161); p.bolt(389, 137);
  p.wear(369, 160, 20, 7, 1987, c.plane, 3);
  p.block(351, 168, 8, 4, 4, c.plane, c.steel, c.concrete);
  p.block(390, 168, 8, 4, 4, c.plane, c.steel, c.concrete);
  p.bolt(353, 169); p.bolt(392, 169);
}

function rift(p: ChamberPixels): void {
  const c = CHAMBER_PALETTE;
  // Ground plane wound: fractured lip and exposed depth, with no doorway or halo.
  p.poly([[468, 273], [480, 266], [489, 269], [499, 260], [511, 264], [527, 264], [516, 272], [515, 279], [499, 282], [486, 278], [474, 282]], c.concrete);
  p.poly([[475, 274], [486, 270], [493, 274], [505, 266], [520, 267], [508, 275], [501, 279], [489, 276], [479, 280]], c.black);
  p.line(481, 273, 490, 273, c.deep, 2);
  p.line(490, 274, 496, 276, c.teal, 2);
  p.line(499, 273, 510, 267, c.deep, 2);
  p.line(468, 274, 479, 267, c.edge);
  p.line(500, 262, 510, 264, c.steel);
  p.line(484, 280, 494, 281, c.steel);
  p.line(490, 266, 487, 257, c.recess);
  p.line(519, 272, 532, 271, c.recess);
  p.line(479, 279, 469, 284, c.recess);
}

export interface ChamberDeviceState {
  core: number;
  storage: number;
  purifier: number;
  thickenLevel: number;
  growthLevels: number;
}

export function paintChamberDevices(p: ChamberPixels, state: ChamberDeviceState): void {
  const c = CHAMBER_PALETTE;
  storage(p); core(p); purifier(p); growth(p, state.growthLevels); offering(p); rift(p);
  for (const [x, health] of [[166, state.storage], [276, state.core], [386, state.purifier]] as const) {
    if (state.thickenLevel > 0) {
      p.block(x - 24, 271, 6, 7, 4, c.steel, c.edge, c.concrete);
      p.block(x + 19, 271, 6, 7, 4, c.steel, c.edge, c.concrete);
      p.bolt(x - 23, 273); p.bolt(x + 21, 273);
    }
    if (state.thickenLevel >= 2) {
      p.block(x - 22, 274, 45, 3, 3, c.plane, c.steel, c.concrete);
      p.bolt(x - 19, 274); p.bolt(x + 17, 274);
    }
    if (state.thickenLevel >= 3) {
      p.block(x - 19, 277, 43, 3, 5, c.plane, c.edge, c.concrete);
      p.line(x - 15, 278, x - 3, 278, c.glint);
    }
    if (health <= .6) {
      p.line(x + 9, 244, x + 5, 249, c.shadow, 2);
      p.line(x + 5, 249, x + 10, 254, c.shadow);
      p.rect(x - 12, 266, 6, 3, c.rust);
    }
    if (health < .3) {
      p.poly([[x - 19, 265], [x - 13, 263], [x - 8, 268], [x - 12, 274], [x - 19, 270]], c.deep);
      p.line(x - 18, 267, x - 13, 267, c.teal);
      p.rect(x + 8, 260, 7, 5, c.shadow);
      p.poly([[x + 19, 277], [x + 25, 274], [x + 31, 278], [x + 22, 280]], c.steel);
    }
  }
}
