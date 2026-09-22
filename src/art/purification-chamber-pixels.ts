import {
  CHAMBER_DEVICE_BASES,
  CHAMBER_WALK_POLYGONS,
  type ChamberDevice,
} from '../systems/purification-chamber-layout';

/** World-space hard pixels. Material faces, rather than outlines, carry the silhouettes. */
export type ChamberPoint = readonly [number, number];
export const CHAMBER_PALETTE = {
  void: '#080a0c', black: '#0d1114', shadow: '#151a1e', recess: '#1e2228',
  concrete: '#2c2e33', plane: '#3a3d42', plaster: '#3a3838', ash: '#2e2d30',
  earth: '#50463c', oldPlaster: '#2a2420', steel: '#4a4e55', edge: '#5a5f66',
  glint: '#8a8f96', pale: '#c8cdd4', rust: '#5d483e', olive: '#4f4835',
  warm: '#8a5c2a', lamp: '#c4873a', deep: '#0e4a3f', teal: '#1a6b5c',
  live: '#1aad96', light: '#2ae6c8',
} as const;
const c = CHAMBER_PALETTE;

export class ChamberPixels {
  constructor(readonly ctx: CanvasRenderingContext2D) { ctx.imageSmoothingEnabled = false; }
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
        const a = points[i]!; const b = points[(i + 1) % points.length]!;
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
    front: string = c.plane, top: string = c.steel, side: string = c.concrete): void {
    const rise = Math.round(depth * .5);
    this.rect(x, y, w, h, front);
    this.poly([[x, y], [x + depth, y - rise], [x + w + depth, y - rise], [x + w, y]], top);
    this.poly([[x + w, y], [x + w + depth, y - rise], [x + w + depth, y + h - rise], [x + w, y + h]], side);
  }
  bolt(x: number, y: number): void {
    this.rect(x, y, 2, 2, c.edge);
    this.rect(x + 1, y + 1, 1, 1, c.concrete);
  }
}

function walkPoly(route: keyof typeof CHAMBER_WALK_POLYGONS): ChamberPoint[] {
  return CHAMBER_WALK_POLYGONS[route].map(p => [p.x, p.y] as const);
}

/** Three immense rewritten remnants; the black between them is as important as their mass. */
export function paintChamberExterior(p: ChamberPixels): void {
  p.rect(0, 0, 640, 400, c.void);
  // A former cast shell now repeats its own inner face at incompatible offsets.
  p.poly([[0, 46], [69, 19], [179, 12], [239, 32], [205, 63], [131, 55], [74, 92], [51, 176], [0, 209]], c.black);
  p.poly([[0, 64], [81, 38], [160, 37], [197, 48], [132, 50], [73, 107], [52, 201], [21, 226], [0, 215]], c.shadow);
  p.poly([[0, 94], [44, 83], [39, 129], [63, 139], [39, 154], [28, 221], [0, 243]], c.recess);
  p.poly([[6, 88], [36, 76], [26, 119], [9, 137]], c.black);
  p.poly([[47, 114], [59, 104], [56, 131], [70, 149], [62, 169], [53, 158]], c.deep);
  p.poly([[51, 119], [57, 118], [53, 134], [61, 145], [58, 151], [50, 138]], c.teal);
  // Right remnant is a folded load-bearing slab, with one severed repeating joint.
  p.poly([[461, 13], [495, 14], [521, 62], [594, 53], [640, 73], [640, 310], [597, 295], [581, 236], [562, 181], [553, 99], [496, 91]], c.black);
  p.poly([[505, 39], [533, 78], [597, 66], [640, 85], [640, 113], [592, 95], [551, 113], [567, 166], [547, 183], [524, 112]], c.shadow);
  p.poly([[604, 146], [640, 134], [640, 277], [608, 261], [588, 215], [593, 186]], c.recess);
  p.poly([[620, 154], [640, 148], [640, 162], [625, 168], [614, 210], [630, 232], [621, 240], [601, 213]], c.shadow);
  p.poly([[573, 184], [601, 168], [607, 177], [584, 195], [595, 208], [580, 224], [567, 211]], c.deep);
  p.poly([[582, 191], [597, 181], [599, 185], [585, 198], [589, 203], [584, 208], [577, 198]], c.teal);
  // Below: displaced chunks repeat an old floor, without turning into a fence of beams.
  p.poly([[0, 350], [84, 329], [166, 370], [290, 378], [349, 364], [411, 383], [545, 359], [640, 319], [640, 361], [551, 392], [412, 400], [318, 388], [182, 400], [71, 364], [0, 385]], c.black);
  p.poly([[2, 361], [77, 345], [152, 379], [113, 382], [68, 367], [0, 379]], c.shadow);
  p.poly([[463, 383], [536, 372], [593, 347], [640, 345], [595, 365], [541, 386]], c.shadow);
  // A small remnant of straight human construction disappears into a repeated surface.
  p.poly([[291, 32], [308, 28], [371, 57], [389, 54], [426, 75], [417, 84], [370, 68], [345, 72]], c.black);
  paintExteriorMass(p);
}

function paintExteriorMass(p: ChamberPixels): void {
  // Thick cast remnant on the left: an exposed section and a deep broken service cavity.
  p.poly([[0,170],[24,139],[53,146],[74,190],[68,232],[46,266],[15,276],[0,264]], c.recess);
  p.poly([[0,170],[14,171],[36,150],[53,146],[24,139]], c.concrete);
  p.poly([[14,171],[36,150],[42,169],[61,203],[51,228],[34,220],[29,187]], c.shadow);
  p.poly([[0,209],[14,171],[29,187],[34,220],[20,251],[0,264]], c.shadow);
  p.poly([[30,173],[41,166],[55,194],[51,215],[43,211],[44,195]], c.black);
  p.poly([[45,266],[67,232],[62,213],[51,228],[35,252],[15,259],[15,276]], c.concrete);
  p.poly([[43,250],[56,231],[58,238],[47,257],[36,263],[33,259]], c.plane);
  // One member is duplicated, missing a section, then resumes inside the foreign face.
  p.poly([[0,198],[11,184],[16,188],[5,209],[0,211]], c.concrete);
  p.poly([[0,213],[15,192],[18,198],[7,219],[0,222]], c.concrete);
  p.poly([[3,228],[17,208],[20,216],[12,231]], c.deep);
  p.rect(13,218,2,4,c.teal);
  p.poly([[36,249],[41,242],[44,245],[41,251]], c.shadow);
  p.poly([[51,207],[55,202],[59,207],[55,216]], c.recess);
  // Right mass: heavy folded concrete, torn reinforcing web, and mismatched joined surfaces.
  p.poly([[596,134],[620,127],[640,138],[640,287],[615,275],[597,242],[586,215]], c.recess);
  p.poly([[596,134],[620,127],[640,138],[640,151],[619,141],[603,147]], c.concrete);
  p.poly([[601,149],[615,145],[631,153],[627,184],[610,195],[600,181]], c.shadow);
  p.poly([[610,157],[621,154],[621,179],[611,183]], c.black);
  p.poly([[605,210],[625,192],[640,197],[640,221],[623,220],[616,229]], c.concrete);
  p.poly([[607,215],[622,204],[640,207],[640,216],[624,213],[613,224]], c.shadow);
  p.poly([[618,229],[631,229],[640,236],[640,262],[628,256]], c.shadow);
  p.poly([[587,215],[599,219],[611,247],[617,254],[615,275],[599,247]], c.concrete);
  p.poly([[601,229],[606,232],[612,249],[608,249]], c.plane);
  p.poly([[618,269],[625,257],[640,265],[640,287]], c.shadow);
  p.poly([[596,189],[605,183],[608,188],[601,197],[603,201],[599,205],[593,201]], c.deep);
  p.line(599,191,598,196,c.teal,2);
  p.poly([[627,226],[633,226],[633,229],[629,234],[627,232]], c.ash);
  p.line(634,223,635,235,c.plane);
  // A massive offset joint actually bears on the top containment seam.
  p.poly([[275,20],[287,17],[311,43],[308,66],[320,86],[321,103],[315,107],[309,87],[293,73],[296,49],[281,38]], c.shadow);
  p.poly([[287,17],[299,22],[323,46],[320,66],[327,83],[325,100],[321,103],[320,86],[308,66],[311,43]], c.recess);
  p.poly([[299,51],[305,48],[304,67],[315,83],[314,93],[308,83],[298,73]], c.black);
  p.poly([[313,85],[318,87],[319,98],[316,99]], c.deep);
  // The lower remnant is a slab with a coarse broken face, not a single angled ribbon.
  p.poly([[435,379],[481,359],[509,363],[516,377],[552,377],[570,367],[603,371],[570,388],[504,397],[473,386]], c.shadow);
  p.poly([[447,376],[479,365],[506,367],[502,375],[474,374],[460,381]], c.recess);
  p.poly([[520,384],[543,382],[549,386],[530,390]], c.recess);
  p.poly([[576,372],[591,375],[580,380],[570,378]], c.concrete);
}

/** The continuous enclosing shell is cast/repaired material, with metal only at working joints. */
export function paintChamberArchitecture(p: ChamberPixels): void {
  // Solid cutaway building, then the three joined rear/return walls.
  p.poly([[93, 125], [127, 83], [230, 70], [283, 88], [359, 86], [411, 116], [421, 153], [489, 165], [559, 187], [581, 230], [581, 313], [559, 348], [382, 364], [114, 366], [69, 328], [68, 198]], c.shadow);
  p.poly([[106, 124], [139, 96], [229, 85], [277, 103], [359, 100], [397, 125], [401, 169], [139, 159], [112, 196]], c.plaster);
  p.poly([[139, 107], [229, 97], [274, 115], [357, 112], [384, 129], [383, 173], [145, 166], [128, 183], [129, 129]], c.ash);
  // The overhang casts a short shadow onto the vertical inside face, never across the floor.
  p.poly([[137,106],[229,96],[274,113],[355,110],[383,126],[381,131],[353,115],[273,119],[228,103],[139,112]],c.recess);
  p.poly([[129,129],[138,113],[139,150],[134,164],[128,176]],c.concrete);
  // Old plaster: a few broad eroded patches, not random surface noise.
  p.poly([[142, 110], [209, 103], [209, 113], [192, 120], [186, 142], [143, 145]], c.earth);
  p.poly([[153, 113], [196, 109], [185, 117], [183, 134], [163, 137], [161, 124], [148, 124]], c.plaster);
  p.poly([[291, 120], [334, 117], [349, 126], [337, 139], [310, 137], [308, 149], [287, 151]], c.plaster);
  p.poly([[349, 115], [364, 119], [375, 133], [374, 167], [357, 160]], c.concrete);
  // Thick upper roof cut, chipped only where a previous repair meets the old shell.
  p.poly([[108, 124], [136, 93], [230, 80], [278, 99], [360, 96], [403, 121], [411, 112], [363, 83], [282, 85], [232, 66], [126, 80], [94, 117]], c.earth);
  p.poly([[127, 80], [232, 66], [282, 85], [278, 92], [229, 75], [133, 87]], c.plaster);
  p.poly([[302, 88], [326, 88], [324, 101], [307, 102]], c.concrete);
  p.rect(313, 90, 6, 12, c.steel);
  // Left return wall: its broad face and imperfect foot are visibly masonry/cast material.
  p.poly([[94, 117], [111, 124], [109, 222], [100, 259], [104, 316], [118, 346], [90, 340], [72, 316], [73, 208]], c.plaster);
  p.poly([[93, 140], [103, 134], [98, 222], [89, 248], [92, 301], [87, 314], [80, 304], [81, 209]], c.earth);
  p.poly([[100, 169], [109, 157], [106, 215], [116, 235], [100, 260], [92, 247]], c.concrete);
  p.poly([[106, 222], [127, 225], [132, 242], [113, 255], [101, 252]], c.plaster);
  // Rear lower wall turns back around the purifier/rift working recess.
  p.poly([[401, 151], [478, 165], [553, 188], [564, 232], [547, 259], [431, 260], [411, 234], [400, 210]], c.plaster);
  p.poly([[416, 166], [476, 180], [540, 199], [545, 231], [530, 243], [444, 245], [419, 221]], c.ash);
  p.poly([[419,188],[435,190],[441,194],[461,198],[463,204],[448,205],[441,201],[427,202],[420,198]], c.earth);
  p.poly([[478, 188], [525, 201], [532, 215], [505, 215], [497, 209], [480, 207]], c.concrete);
  // A narrow maintenance slot has physical depth, not a decorative teal wall monitor.
  p.poly([[468, 207], [501, 218], [500, 226], [467, 216]], c.shadow);
  p.line(468, 208, 499, 218, c.steel);
  p.poly([[557, 188], [575, 211], [576, 295], [562, 326], [548, 322], [556, 274], [549, 237]], c.earth);
  p.poly([[560, 203], [568, 217], [568, 281], [558, 308], [556, 284]], c.plaster);
  // The elevated floor is carried by a thick continuous cast face, not a steel table.
  p.poly([[132, 205], [206, 215], [262, 224], [302, 224], [328, 218], [350, 206], [396, 206], [396, 250], [386, 266], [241, 267], [211, 246], [124, 252]], c.ash);
  p.poly([[132, 214], [190, 214], [208, 224], [262, 224], [271, 242], [212, 239], [199, 231], [130, 233]], c.plaster);
  p.poly([[132, 233], [199, 231], [212, 239], [269, 242], [281, 263], [239, 260], [210, 245], [130, 249]], c.concrete);
  p.poly([[324, 224], [350, 211], [350, 231], [337, 239], [329, 260], [320, 251]], c.plaster);
  p.poly([[343, 237], [382, 222], [385, 254], [374, 263], [342, 262]], c.concrete);
  p.poly([[145, 229], [180, 228], [184, 232], [164, 234], [162, 242], [147, 241]], c.earth);
  // Deep foundation; the visible front is a cut wall with aggregate, not another rail.
  p.poly([[94, 306], [126, 334], [368, 334], [392, 324], [548, 318], [556, 338], [391, 346], [371, 356], [121, 356], [87, 326]], c.plaster);
  p.poly([[126, 341], [366, 341], [390, 331], [548, 325], [547, 343], [393, 350], [369, 360], [122, 360], [93, 334]], c.ash);
  p.poly([[150, 344], [202, 344], [196, 353], [176, 351], [174, 358], [150, 353]], c.earth);
  p.poly([[436, 336], [480, 334], [482, 344], [462, 345], [453, 340], [437, 343]], c.concrete);
  // Walk surfaces exactly share the controller's polygons.
  p.poly(walkPoly('main'), c.ash);
  p.poly([[99, 258], [151, 251], [197, 247], [224, 266], [220, 287], [169, 300], [101, 297]], c.plaster);
  p.poly([[394, 275], [428, 250], [443, 252], [461, 235], [540, 237], [549, 263], [540, 296], [485, 307], [435, 300]], c.concrete);
  p.poly([[219, 282], [276, 272], [303, 283], [305, 313], [280, 327], [214, 319]], c.concrete);
  p.poly([[296, 280], [350, 277], [365, 294], [385, 306], [369, 329], [312, 328], [299, 311]], c.ash);
  p.poly(walkPoly('upper'), c.plaster);
  p.poly([[141, 150], [188, 144], [212, 150], [209, 178], [185, 194], [137, 195], [131, 183]], c.concrete);
  p.poly([[269, 160], [317, 158], [328, 172], [321, 194], [281, 208], [256, 198]], c.plaster);
  p.poly([[333, 162], [368, 160], [395, 178], [389, 199], [351, 201], [329, 190]], c.concrete);
  // Long material seams follow the floor rather than a tile checkerboard.
  p.line(110, 314, 155, 314, c.concrete);
  p.line(155, 314, 181, 302, c.concrete);
  p.line(198, 271, 215, 289, c.concrete);
  p.line(209, 287, 198, 294, c.recess);
  p.line(311, 320, 348, 320, c.concrete);
  p.line(358, 279, 381, 286, c.concrete);
  p.line(474, 304, 516, 295, c.plane);
  p.line(233, 152, 225, 169, c.concrete);
  p.line(225, 169, 235, 181, c.concrete);
  p.line(219, 213, 249, 213, c.concrete);
  // Shared ramp surfaces. Wide tread faces communicate real two-dimensional routes.
  paintRamp(p, 'left-stair');
  paintRamp(p, 'right-stair');
  // Local repair castings and mechanical anchors are asymmetrical and structurally motivated.
  p.poly([[218, 297], [232, 282], [267, 279], [279, 292], [272, 309], [232, 313]], c.plaster);
  p.poly([[223, 300], [233, 306], [267, 302], [272, 295], [269, 307], [233, 311]], c.plane);
  p.poly([[423, 270], [435, 253], [469, 256], [479, 273], [464, 283], [432, 282]], c.plaster);
  // Two honest conduits: short protected trenches, with a few salvaged covers.
  p.poly([[274, 291], [306, 294], [327, 281], [352, 281], [356, 286], [330, 286], [308, 300], [273, 297]], c.shadow);
  p.poly([[287, 293], [304, 295], [304, 298], [286, 296]], c.earth);
  p.poly([[315, 291], [326, 284], [329, 286], [318, 293]], c.steel);
  p.poly([[349, 281], [373, 276], [399, 278], [423, 269], [425, 273], [400, 283], [374, 281], [350, 285]], c.concrete);
  p.poly([[382, 279], [395, 280], [394, 283], [382, 282]], c.earth);
  // Small warm working lamp: one inhabited corner, no regular series of light cones.
  p.block(211, 134, 5, 6, 2, c.earth, c.steel, c.concrete);
  p.rect(212, 139, 3, 2, c.warm);
  p.rect(213, 140, 1, 1, c.lamp);
  p.line(214, 130, 214, 117, c.concrete, 2);
  // Three containment joints have matching outer pressure and inner repair stops.
  paintJointHousing(p, 99, 240, 'left');
  paintJointHousing(p, 319, 121, 'top');
  paintJointHousing(p, 549, 228, 'right');
  paintMaterialFinish(p);
}

/** Selected weathering clusters follow casting joints, support loads and repeated repairs. */
function paintMaterialFinish(p: ChamberPixels): void {
  // Interrupted mineral cut face. Cool aggregate breaks the long brown cap into cast sections.
  p.poly([[141,79],[189,74],[204,77],[201,81],[175,82],[170,86],[145,89],[140,85]],c.plane);
  p.poly([[212,71],[231,69],[255,78],[252,83],[232,77],[212,78]],c.plaster);
  p.poly([[331,87],[357,86],[380,100],[377,105],[355,96],[340,97],[332,94]],c.plane);
  p.poly([[384,104],[397,111],[401,117],[394,116],[387,112]],c.concrete);
  p.line(148,81,168,79,c.steel);
  p.line(230,72,242,77,c.plane);
  p.line(340,91,354,91,c.steel);
  // Rear wall was poured in sections; seams stop at repairs, not at arbitrary screen grids.
  p.line(221,103,221,128,c.concrete);
  p.line(222,103,222,122,c.plane);
  p.poly([[219,127],[224,127],[228,135],[227,146],[223,148],[220,139]],c.concrete);
  p.line(264,112,269,133,c.concrete);
  p.line(266,114,270,129,c.plaster);
  p.poly([[270,132],[274,135],[273,151],[269,151]],c.concrete);
  p.poly([[289,143],[306,139],[312,142],[307,150],[294,154],[282,153],[282,149]],c.concrete);
  p.poly([[291,144],[303,141],[307,143],[300,147],[290,149]],c.plane);
  // A broken plaster edge reveals coarse mineral fragments, with a sparse second scale.
  p.poly([[143,127],[150,126],[156,132],[164,132],[164,142],[151,146],[141,142]],c.concrete);
  p.poly([[146,129],[151,129],[154,134],[151,136],[147,134]],c.plane);
  p.poly([[154,139],[159,136],[163,139],[160,142]],c.plaster);
  aggregate(p,146,137); aggregate(p,184,118); aggregate(p,295,147);
  p.poly([[335,126],[341,123],[347,127],[344,135],[337,137],[332,134]],c.ash);
  p.poly([[335,127],[340,126],[342,129],[338,132],[334,131]],c.concrete);
  p.rect(344,131,2,3,c.plane);
  // The back right recess has one shelf seat, a repair seam and a scar from clamped pressure.
  p.poly([[422,190],[432,192],[436,195],[445,196],[448,199],[439,199],[433,197],[423,196]],c.plaster);
  p.poly([[431,198],[440,199],[443,202],[438,205],[432,203]],c.concrete);
  aggregate(p,434,200);
  p.line(465,185,467,199,c.concrete);
  p.line(466,186,468,198,c.plane);
  p.poly([[483,193],[512,201],[510,204],[490,198],[481,198]],c.plaster);
  p.poly([[521,210],[529,213],[533,225],[529,230],[522,225]],c.concrete);
  aggregate(p,523,218);
  p.poly([[452,234],[466,236],[470,239],[464,242],[453,240]],c.concrete);
  // Side reveals have actual depth and repairs at their feet.
  p.poly([[91,158],[97,149],[96,184],[92,192],[87,190]],c.plane);
  p.poly([[83,278],[87,274],[91,291],[89,308],[84,306]],c.plane);
  p.line(83,272,89,269,c.concrete,2);
  p.line(85,275,90,274,c.plaster);
  aggregate(p,85,299);
  p.poly([[555,273],[561,264],[563,273],[560,293],[555,304],[553,295]],c.plane);
  p.poly([[557,283],[562,279],[561,290],[557,296]],c.concrete);
  aggregate(p,556,290);
  // Upper floor edges: top slab, coarse underface, dark bearing. No rail across a portal.
  p.line(135,214,186,214,c.plane,2);
  p.line(136,216,188,216,c.concrete,2);
  p.line(190,215,207,224,c.plane,2);
  p.line(208,225,258,225,c.plane);
  p.line(213,228,251,228,c.concrete,2);
  p.poly([[141,220],[155,219],[160,222],[158,226],[146,226]],c.concrete);
  p.poly([[166,225],[179,223],[186,227],[185,231],[174,233],[169,230]],c.ash);
  aggregate(p,176,227);
  p.poly([[220,232],[234,232],[242,237],[241,241],[228,239]],c.ash);
  aggregate(p,226,235);
  p.line(306,222,325,217,c.plane,2);
  p.line(309,225,326,220,c.concrete,2);
  p.poly([[333,232],[343,225],[341,234],[335,241],[329,249],[327,246]],c.concrete);
  aggregate(p,335,233);
  // Broad ramp tread sections connect into real bearing faces; roughness stays on the riser.
  p.poly([[284,266],[324,266],[324,270],[286,270]],c.plaster);
  p.line(286,269,321,269,c.concrete);
  p.poly([[396,250],[442,250],[442,254],[398,254]],c.plaster);
  p.line(398,253,439,253,c.concrete);
  p.poly([[263,228],[268,228],[286,261],[285,265],[279,255]],c.plane);
  p.poly([[350,210],[354,210],[396,249],[396,252],[389,247]],c.plane);
  // Worn paths: large quiet fields with short material transitions around the work sites.
  p.poly([[197,180],[209,181],[215,190],[211,197],[198,199],[191,194]],c.plane);
  p.poly([[198,182],[207,183],[211,190],[207,194],[196,194]],c.plaster);
  p.line(207,205,216,201,c.plane);
  p.line(221,203,225,203,c.concrete);
  p.poly([[302,197],[316,192],[322,198],[317,208],[307,210],[299,206]],c.plaster);
  p.poly([[303,199],[313,195],[318,199],[313,204],[303,205]],c.plane);
  p.line(233,313,266,313,c.plane);
  p.poly([[228,290],[230,286],[236,285],[237,288],[232,292]],c.steel);
  p.poly([[271,299],[275,294],[278,295],[277,301],[273,304]],c.plane);
  aggregate(p,227,304);
  p.poly([[115,288],[124,291],[132,290],[135,293],[129,297],[119,295]],c.plane);
  p.line(127,300,143,302,c.concrete);
  p.poly([[429,276],[437,280],[444,278],[447,281],[440,285],[432,283]],c.plane);
  aggregate(p,462,280);
  // Front section contains coarse stones and two interrupted reinforcement pieces.
  p.poly([[233,342],[245,342],[250,347],[244,351],[235,349]],c.concrete);
  p.poly([[276,343],[287,342],[291,345],[286,349],[276,348]],c.plaster);
  aggregate(p,288,346); aggregate(p,454,338);
  p.line(312,344,327,344,c.recess,2);
  p.line(314,345,323,345,c.steel);
  p.line(500,333,516,332,c.recess,2);
  p.line(503,334,514,333,c.steel);
}

function aggregate(p: ChamberPixels, x: number, y: number): void {
  p.poly([[x,y],[x+4,y-2],[x+7,y],[x+5,y+3],[x+1,y+3]],c.concrete);
  p.rect(x+1,y,3,1,c.plane);
  p.rect(x+8,y+3,2,2,c.plane);
  p.rect(x+4,y+5,2,1,c.recess);
  p.rect(x-2,y+4,1,2,c.plane);
}

function paintRamp(p: ChamberPixels, route: 'left-stair' | 'right-stair'): void {
  const points = walkPoly(route);
  const a = points[0]!; const b = points[1]!; const d = points[3]!; const e = points[2]!;
  // A full load-bearing side cheek joins the raised slab to the lower landing.
  p.poly([[a[0]-7,a[1]-1],[a[0]-1,a[1]-1],[d[0]-1,d[1]+3],[d[0]-7,d[1]+5],[a[0]-7,a[1]+29]],c.concrete);
  p.poly([[a[0]-7,a[1]+4],[a[0]-4,a[1]+6],[d[0]-4,d[1]+3],[d[0]-7,d[1]+5]],c.plane);
  p.poly([[a[0]-7,a[1]+24],[a[0]-4,a[1]+27],[d[0]-7,d[1]+5],[d[0]-10,d[1]+2]],c.ash);
  p.poly(points, c.plaster);
  for (let step = 1; step < 7; step++) {
    const t = step / 7;
    const x1 = a[0] + (d[0] - a[0]) * t;
    const y1 = a[1] + (d[1] - a[1]) * t;
    const x2 = b[0] + (e[0] - b[0]) * t;
    const y2 = b[1] + (e[1] - b[1]) * t;
    p.poly([[x1,y1],[x2,y2],[x2+1,y2+3],[x1+1,y1+3]],c.concrete);
    p.line(x1+1, y1+2, x2-1, y2+2, c.recess);
    p.line(x1+1, y1-1, x2-1, y2-1, c.plane);
    if (step === 2 || step === 5) p.line(x1+7,y1-2,x1+12,y1-2,c.steel);
  }
  // Low cast curb lives just outside the traversable side, never across the opening.
  p.poly([[a[0] - 5, a[1] - 3], [a[0] - 1, a[1] - 3], [d[0] - 1, d[1] - 2], [d[0] - 5, d[1] - 2]], c.earth);
}

function paintJointHousing(p: ChamberPixels, x: number, y: number, side: 'left' | 'top' | 'right'): void {
  if (side === 'top') {
    // This is a repaired split in the existing wall, not a separate monitor or machine.
    p.poly([[x-8,y-26],[x+4,y-23],[x+6,y-12],[x+1,y-7],[x+4,y+4],[x-1,y+13],[x-8,y+9],[x-5,y-4],[x-9,y-12]],c.concrete);
    p.poly([[x-3,y-24],[x+1,y-20],[x+2,y-12],[x-1,y-6],[x+1,y+4],[x-2,y+9],[x-4,y+5],[x-3,y-6],[x-5,y-12]],c.shadow);
    p.poly([[x-12,y-14],[x+7,y-10],[x+7,y-7],[x-12,y-11]],c.earth);
    p.line(x-10,y-14,x+5,y-11,c.plane);
    p.poly([[x-8,y+3],[x+9,y],[x+9,y+3],[x-8,y+6]],c.plane);
    p.bolt(x-7,y+3); p.bolt(x+5,y+1);
  } else {
    const s = side === 'left' ? 1 : -1;
    p.poly([[x-8,y-26],[x+4,y-23],[x+7,y-12],[x+4,y-6],[x+9,y+6],[x+6,y+13],[x-3,y+16],[x-5,y+6],[x-2,y-3],[x-6,y-11]],c.concrete);
    p.poly([[x-3,y-23],[x+1,y-20],[x+2,y-13],[x,y-7],[x+4,y+1],[x+2,y+9],[x-2,y+7],[x,y+1],[x-3,y-8]],c.shadow);
    p.poly([[x-10,y-13],[x+9,y-8],[x+8,y-5],[x-10,y-10]],c.earth);
    p.line(x-8,y-13,x+7,y-9,c.plane);
    p.poly([[x+s*7-7,y+3],[x+s*7+7,y+1],[x+s*7+7,y+4],[x+s*7-7,y+6]],c.plane);
    p.bolt(x+s*7-4,y+3); p.bolt(x+s*7+4,y+2);
  }
}

/** Front cut wall is low; its silhouette never rises into a legal walking torso. */
export function paintChamberForeground(p: ChamberPixels): void {
  p.poly([[126, 334], [368, 334], [392, 324], [548, 318], [548, 323], [393, 329], [369, 339], [126, 339], [95, 312], [94, 306]], c.plaster);
  p.poly([[128, 337], [214, 337], [213, 341], [129, 341]], c.earth);
  p.poly([[449, 324], [501, 322], [501, 326], [449, 328]], c.earth);
}

export interface ChamberDeviceState {
  core: number; storage: number; purifier: number;
  thickenLevel: number; growthLevels: number;
}

/** These are public damage states of three local stops, never a prediction of the next impact. */
export function paintChamberResistance(p: ChamberPixels, state: ChamberDeviceState): void {
  for (const [x, y, health, direction] of [
    [99, 240, state.storage, 1], [319, 121, state.core, 0], [549, 228, state.purifier, -1],
  ] as const) {
    const bad = health < .3; const worn = health <= .6;
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
    p.ellipse(x - 3, y + 1, width, 5, c.concrete);
    p.ellipse(x - 3, y, width - 5, 3, c.shadow);
  }
}

/** One device per transparent layer permits the same character to walk behind and in front. */
export function paintChamberDevice(p: ChamberPixels, id: ChamberDevice, state: ChamberDeviceState): void {
  const { x, y } = CHAMBER_DEVICE_BASES[id];
  p.ctx.save(); p.ctx.translate(x, y);
  if (id === 'storage') storage(p);
  else if (id === 'core') core(p);
  else if (id === 'purifier') purifier(p);
  else if (id === 'growth') growth(p, state.growthLevels);
  else if (id === 'offering') offering(p);
  else rift(p);
  finishDevice(p, id);
  if (id === 'core' || id === 'storage' || id === 'purifier') {
    fittings(p, id, state[id], state.thickenLevel);
  }
  p.ctx.restore();
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
    p.line(-9,-51,-11,-40,c.edge); p.rect(-11,-39,2,2,c.steel);
    p.poly([[-12,-31],[-8,-30],[-9,-25],[-12,-24]],c.concrete);
    p.rect(-10,-30,2,2,c.steel); p.rect(-11,-23,1,3,c.plaster);
    p.poly([[11,-44],[14,-40],[14,-34],[12,-35]],c.steel);
    p.rect(14,-22,2,3,c.steel); p.rect(12,-19,2,2,c.plane);
    p.line(-7,-54,1,-55,c.glint); p.rect(6,-53,3,1,c.plane);
    p.poly([[-10,-14],[-5,-12],[4,-12],[8,-15],[8,-10],[-2,-8],[-10,-10]],c.concrete);
    p.line(-9,-12,-4,-11,c.steel); p.rect(1,-10,3,1,c.plane);
    p.bolt(-16,-12); p.bolt(14,-8);
    p.rect(-18,-3,5,1,c.steel); p.rect(-5,0,7,1,c.concrete);
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
  p.poly([[-20, -8], [-12, -15], [15, -12], [21, -4], [12, 1], [-15, 1]], c.earth);
  p.poly([[-16, -31], [-9, -40], [13, -38], [19, -30], [16, -8], [8, -4], [-15, -8]], c.plaster);
  p.poly([[8, -34], [18, -30], [16, -8], [8, -4]], c.concrete);
  p.poly([[-15, -31], [-8, -34], [8, -33], [8, -7], [-15, -10]], c.plane);
  p.poly([[-15, -32], [-8, -39], [13, -37], [17, -31], [8, -28], [-8, -28]], c.steel);
  p.poly([[-10, -32], [-5, -36], [9, -35], [12, -32], [6, -30], [-6, -30]], c.recess);
  p.poly([[-6, -33], [0, -34], [7, -33], [4, -31], [-4, -31]], c.deep);
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
  // Upright open feed: the contained foreign matter is the centre, with unequal cast cheeks.
  p.poly([[-23, -5], [-14, -12], [17, -9], [24, -3], [14, 2], [-18, 1]], c.plaster);
  p.poly([[-17, -12], [-14, -46], [-9, -57], [-3, -57], [-5, -13]], c.plane);
  p.poly([[-14, -46], [-9, -55], [-7, -53], [-10, -14], [-14, -14]], c.steel);
  p.poly([[10, -53], [15, -48], [18, -11], [11, -10], [7, -44]], c.concrete);
  p.poly([[12, -46], [16, -42], [18, -15], [15, -14]], c.plane);
  p.poly([[-7, -50], [7, -50], [11, -17], [5, -9], [-7, -13]], c.shadow);
  p.poly([[-4, -47], [4, -45], [2, -37], [7, -34], [3, -25], [6, -20], [1, -13], [-5, -18], [-2, -29], [-5, -36]], c.deep);
  p.poly([[-2, -43], [2, -40], [0, -34], [4, -33], [1, -28], [-2, -29]], c.teal);
  p.poly([[1, -24], [4, -22], [1, -18], [-2, -20]], c.live);
  p.poly([[-11, -57], [-4, -61], [9, -57], [13, -52], [4, -53], [-3, -54]], c.steel);
  p.poly([[-11, -39], [-5, -38], [-5, -34], [-12, -35]], c.earth);
  p.poly([[7, -31], [17, -29], [18, -25], [8, -27]], c.earth);
  p.block(-18, -17, 9, 8, 2, c.concrete, c.plane, c.shadow);
  p.block(10, -12, 10, 7, 3, c.plane, c.steel, c.concrete);
  p.rect(-16, -16, 2, 2, c.warm);
  p.line(-12, -6, 13, -5, c.steel, 2);
  p.bolt(-10, -37); p.bolt(12, -28);
}

function purifier(p: ChamberPixels): void {
  // Low open separation chamber. The bright upper plate and visible liquid divide its mass.
  p.poly([[-27, -5], [-19, -12], [19, -10], [27, -3], [18, 1], [-22, 0]], c.plaster);
  p.block(-22, -8, 41, 6, 5, c.concrete, c.steel, c.shadow);
  p.poly([[-19, -34], [-11, -39], [17, -36], [23, -31], [16, -27], [-20, -29]], c.steel);
  p.poly([[-17, -34], [-10, -37], [12, -34], [9, -31], [-17, -31]], c.edge);
  p.rect(-20, -29, 5, 21, c.plane);
  p.poly([[15, -29], [22, -31], [21, -9], [15, -7]], c.concrete);
  p.rect(14, -27, 3, 18, c.steel);
  p.poly([[-14, -28], [12, -27], [12, -10], [-14, -12]], c.recess);
  p.poly([[-12, -26], [-4, -24], [-2, -18], [5, -19], [10, -15], [10, -11], [-12, -13]], c.deep);
  p.poly([[-10, -24], [-6, -23], [-5, -17], [-8, -17]], c.teal);
  p.poly([[3, -16], [9, -14], [8, -12], [1, -13]], c.teal);
  p.rect(-2, -27, 3, 13, c.plane);
  p.poly([[-11, -10], [12, -8], [16, -5], [-16, -7]], c.steel);
  p.block(-25, -25, 6, 9, 2, c.earth, c.plane, c.concrete);
  p.rect(-24, -22, 2, 2, c.warm);
  p.poly([[23, -25], [28, -22], [29, -10], [24, -6], [23, -10], [25, -13], [24, -21]], c.plane);
  p.bolt(-19, -28); p.bolt(15, -26);
}

function growth(p: ChamberPixels, levels: number): void {
  // A person-sized liquid cylinder, not a chair, console, arch or empty ring.
  p.ellipse(0, -3, 18, 5, c.concrete);
  p.rect(-15, -47, 30, 42, c.concrete);
  p.ellipse(0, -47, 15, 6, c.steel);
  p.rect(-12, -45, 24, 34, c.deep);
  p.ellipse(0, -44, 12, 4, c.teal);
  p.rect(-10, -43, 7, 31, c.teal);
  p.poly([[-3, -40], [7, -41], [10, -35], [8, -26], [10, -18], [6, -12], [-4, -13], [-6, -22], [-3, -28]], c.teal);
  p.poly([[-8, -38], [-3, -40], [-1, -37], [-6, -32], [-9, -32]], c.teal);
  p.poly([[-9, -22], [-6, -26], [-2, -26], [-3, -21], [-7, -18]], c.teal);
  p.rect(-8,-34,2,2,c.live);
  p.rect(-5,-22,1,2,c.live);
  // Dark, uneven inner mass gives volume without inventing another character.
  p.poly([[2, -35], [6, -33], [5, -26], [8, -23], [5, -17], [0, -17], [-1, -22], [2, -27]], c.deep);
  p.rect(-15, -45, 3, 34, c.plane);
  p.rect(12, -43, 3, 33, c.ash);
  p.ellipse(0, -10, 15, 5, c.plane);
  p.poly([[-14, -49], [-9, -53], [5, -54], [13, -50], [9, -48], [-10, -47]], c.edge);
  p.poly([[-15, -14], [-7, -11], [10, -12], [15, -15], [15, -10], [9, -7], [-7, -7], [-15, -10]], c.earth);
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
    p.poly([outside[i]!, outside[next]!, inside[next]!, inside[i]!], colors[i]!);
  }
  p.poly([[12,-36],[19,-34],[25,-25],[24,-12],[15,-3],[10,-6],[19,-15],[21,-27]], c.ash);
  p.poly([[-10,-8],[-2,-5],[10,-7],[15,-2],[8,1],[-13,0],[-17,-3]], c.plaster);
  p.poly([[-11,-29],[-5,-27],[-5,-24],[-12,-25]], c.earth);
  p.poly([[8,-18],[16,-21],[17,-17],[10,-14]], c.earth);
  p.bolt(-12, -26); p.bolt(13, -18);
  // The empty ring stays empty until the public offering state supplies anonymous matter.
}

function rift(p: ChamberPixels): void {
  // Uneven radiating ground fracture, with three depths and disconnected exposed lips.
  p.poly([[-25,-3],[-16,-8],[-10,-6],[-5,-15],[1,-11],[6,-16],[11,-7],[23,-9],[16,-2],[25,3],[11,5],[7,12],[0,7],[-9,12],[-11,4],[-24,6],[-17,0]], c.plane);
  p.poly([[-22,-3],[-12,-4],[-7,-11],[-3,-6],[5,-13],[7,-5],[18,-7],[10,-1],[22,2],[9,2],[4,9],[-1,4],[-8,9],[-8,1],[-19,4],[-12,-1]], c.recess);
  p.poly([[-13,-2],[-6,-5],[-2,-3],[3,-8],[5,-3],[12,-3],[7,1],[10,3],[2,3],[0,7],[-3,2],[-10,4],[-7,0]], c.black);
  p.poly([[-5,-3],[0,-2],[3,-5],[4,-1],[1,3],[-4,1]], c.void);
  p.poly([[-4,-3],[-1,-2],[3,-5],[4,-2],[1,1],[-3,0]], c.deep);
  p.line(-17,-7,-11,-5,c.steel);
  p.line(-7,-13,-5,-10,c.edge);
  p.line(8,8,11,4,c.steel);
  p.line(18,-7,22,-8,c.steel);
  p.line(-22,6,-15,3,c.concrete);
  p.line(13,5,20,7,c.concrete);
}

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
  if (health <= .6) {
    if (id === 'core') { p.line(-12,-30,-11,-25,c.shadow); p.line(-11,-25,-13,-20,c.shadow); }
    else if (id === 'storage') { p.line(3,-25,1,-22,c.shadow); p.line(1,-22,4,-18,c.shadow); }
    else { p.line(17,-25,16,-21,c.shadow); p.line(16,-21,18,-18,c.shadow); }
  }
  if (health < .3) {
    if (id === 'core') { p.rect(-13,-22,2,4,c.deep); p.rect(13,-20,2,5,c.shadow); }
    else if (id === 'storage') { p.rect(2,-21,2,4,c.deep); p.rect(-11,-15,3,3,c.shadow); }
    else { p.rect(16,-20,2,4,c.deep); p.rect(-19,-16,2,4,c.shadow); }
  }
}
