import {
  CHAMBER_DEVICE_BASES,
  CHAMBER_DEVICE_FLOORS,
  CHAMBER_WALK_POLYGONS,
  type ChamberDevice,
} from '../systems/purification-chamber-layout';
import type { ChamberSurfaceMap, SurfacePlane } from './chamber-surface-map';

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

/** Building-only allocation follows the old hub's cool concrete and repaired cast surfaces.
 * Device palettes stay independent: correcting the room must not recolor its six identities. */
const building = {
  ground: c.concrete,
  coating: c.plane,
  undercoat: c.concrete,
  section: c.plane,
  patch: c.concrete,
  mineralWash: c.olive,
  oldBinder: c.oldPlaster,
  cleanLime: c.plaster,
} as const;

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

function walkPoly(route: keyof typeof CHAMBER_WALK_POLYGONS): ChamberPoint[] {
  return CHAMBER_WALK_POLYGONS[route].map(p => [p.x, p.y] as const);
}

/** Fixed authored faces, not geometry inferred from brightness or material patches. */
function horizontal(p: ChamberPixels, elevation: number, occlusion = .96, roughness = .95): void {
  p.setPlane({ normal: [0, 0, 1], elevation, occlusion, roughness });
}

/** A vertical face descends one world-height unit for each screen row. The optional foot
 * slope follows a visible oblique base edge. Broad ruined wall bases remain art approximations. */
function upright(p: ChamberPixels, footY: number, elevation = 0,
  normal: SurfacePlane['normal'] = [0, 1, 0], occlusion = .92,
  footSlope = 0, originX = 0): void {
  p.setPlane({ normal, elevation, originY: footY, originX,
    riseX: footSlope, riseY: -1, occlusion, roughness: .95 });
}

/** Cached, palette-only material fields. Large coverage, medium wear and fine aggregate
 * are separate scales; this never scatters unbounded noise over a silhouette. */
function materialFace(p: ChamberPixels, points: readonly ChamberPoint[],
  colors: readonly [string, string, string], seed: number, scaleX = 24, scaleY = 13): void {
  const y0 = Math.ceil(Math.min(...points.map(v => v[1])));
  const y1 = Math.ceil(Math.max(...points.map(v => v[1])));
  for (let y = y0; y < y1; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!; const b = points[(i + 1) % points.length]!;
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const start = Math.ceil(xs[i]!); const end = Math.ceil(xs[i + 1]!);
      let runStart = start; let previous = '';
      for (let x = start; x < end; x++) {
        const broad = materialField(x / scaleX, y / scaleY, seed);
        const wear = materialField(x / 6, y / 3, seed + 19);
        const value = broad * .78 + wear * .22;
        // A mineral face remains one material. Extremes are rare exposed inclusions;
        // broad 40/58% thresholds produced camouflage rather than material in R3's first frame.
        const color = colors[value < .24 ? 0 : value > .76 ? 2 : 1];
        if (color !== previous) {
          if (x > runStart) p.rect(runStart, y, x - runStart, 1, previous);
          runStart = x; previous = color;
        }
      }
      if (end > runStart) p.rect(runStart, y, end - runStart, 1, previous);
    }
  }
}

function materialHash(x: number, y: number, seed: number): number {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function materialField(x: number, y: number, seed: number): number {
  const ix = Math.floor(x); const iy = Math.floor(y);
  const fx = x - ix; const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx); const sy = fy * fy * (3 - 2 * fy);
  const a = materialHash(ix, iy, seed); const b = materialHash(ix + 1, iy, seed);
  const d = materialHash(ix, iy + 1, seed); const e = materialHash(ix + 1, iy + 1, seed);
  return (a + (b - a) * sx) * (1 - sy) + (d + (e - d) * sx) * sy;
}

/** Exterior is a displaced cast structure, with coarse volume kept behind the working room. */
export function paintChamberExterior(p: ChamberPixels): void {
  p.setPlane(null);
  p.rect(0, 0, 640, 400, c.void);
  // Far displaced floor: a single broad underface, its broken edge, then missing space.
  horizontal(p, 48, .70);
  materialFace(p, [[0,47],[80,20],[172,12],[235,29],[216,47],[161,43],[122,56],[62,96],[0,112]],
    [c.black,c.shadow,c.black], 31, 55, 25);
  upright(p, 112, 28, [0, 1, 0], .68, -.35);
  p.poly([[0,94],[61,78],[117,48],[161,38],[210,43],[206,51],[161,48],[122,60],[67,96],[0,121]],c.black);
  p.poly([[0,118],[54,100],[45,122],[17,144],[0,147]],c.shadow);
  horizontal(p, 76, .68);
  p.poly([[299,19],[353,36],[386,35],[429,62],[420,76],[385,60],[350,59],[305,36]],c.black);
  upright(p, 65, 51, [0, 1, 0], .64, .28, 350);
  p.poly([[304,35],[349,59],[385,60],[417,75],[409,82],[379,69],[348,67],[308,45]],c.shadow);
  upright(p, 103, 18, [-.8, .6, 0], .66);
  materialFace(p, [[474,14],[501,18],[530,59],[592,48],[640,62],[640,121],[592,98],[557,103],[528,121],[502,89]],
    [c.black,c.shadow,c.black], 43, 43, 18);
  horizontal(p, 80, .75);
  p.poly([[532,64],[591,54],[640,70],[640,80],[591,65],[536,75]],c.recess);
  horizontal(p, -30, .65);
  p.poly([[0,355],[79,333],[166,364],[272,376],[329,361],[410,379],[478,354],[541,359],[640,324],[640,376],[560,399],[398,400],[307,390],[176,399],[74,365],[0,388]],c.black);
  p.setPlane(null);
  p.poly([[4,363],[73,346],[118,362],[101,367],[70,359],[0,379]],c.shadow);
  p.poly([[210,384],[271,383],[291,392],[244,398]],c.shadow);

  // Left foreground mass has a thick core, a torn duct and exposed planes with distinct values.
  upright(p, 281, -4, [1, 0, 0], .80);
  materialFace(p, [[0,145],[31,119],[61,126],[77,170],[78,215],[64,247],[42,280],[13,290],[0,281]],
    [c.shadow,c.recess,c.concrete], 72, 23, 20);
  horizontal(p, 130, .88);
  materialFace(p, [[0,145],[31,119],[61,126],[69,144],[40,136],[17,154],[0,170]],
    [c.recess,c.concrete,c.plane], 76, 13, 7);
  upright(p, 264, -10, [0, 1, 0], .38);
  p.poly([[17,156],[40,136],[46,148],[34,161],[33,178],[45,198],[42,221],[27,239],[14,257],[0,264],[0,219]],c.black);
  upright(p, 257, -7, [1, 0, 0], .48);
  p.poly([[18,158],[34,147],[30,172],[38,196],[34,219],[24,225],[28,200],[18,180]],c.shadow);
  upright(p, 257, -7, [-1, 0, 0], .48);
  p.poly([[46,148],[57,151],[65,174],[64,194],[55,205],[49,188],[50,173]],c.shadow);
  // Broken transverse member: top and vertical fracture show aggregate rather than a line.
  horizontal(p, 62, .82);
  materialFace(p, [[0,188],[13,179],[30,195],[46,197],[48,208],[31,211],[11,196],[0,204]],
    [c.recess,c.concrete,c.plane], 81, 8, 5);
  upright(p, 221, 39, [0, 1, 0], .70);
  p.poly([[0,204],[11,196],[31,211],[48,208],[46,218],[28,221],[9,207],[0,214]],c.shadow);
  p.setPlane(null);
  p.poly([[1,191],[9,186],[12,190],[7,195]],c.plane);
  p.poly([[20,197],[25,200],[23,205],[19,202]],c.recess);
  upright(p, 281, -4, [1, 0, 0], .72);
  p.poly([[5,250],[23,235],[42,222],[54,226],[66,218],[64,247],[42,280],[13,290],[0,281]],c.recess);
  p.setPlane({ normal: [.7, .35, .62], elevation: 0, originY: 287, riseY: -.5, occlusion: .86, roughness: .98 });
  materialFace(p, [[13,267],[34,253],[50,233],[66,218],[68,232],[55,258],[41,279],[15,287]],
    [c.recess,c.concrete,c.plane], 91, 12, 9);
  p.setPlane(null);
  p.poly([[16,272],[33,262],[46,245],[44,255],[34,271],[21,278]],c.shadow);
  p.poly([[48,240],[54,232],[61,230],[57,239],[50,249]],c.plane);
  // The rewritten face repeats a fragment, then presses into the west boundary at (99,240).
  p.poly([[48,135],[61,139],[57,160],[71,179],[65,193],[68,207],[85,218],[94,236],[88,242],[77,223],[59,214],[57,191],[60,178],[47,159]],c.deep);
  p.poly([[53,148],[57,148],[53,162],[66,181],[62,188],[61,177],[50,162]],c.teal);
  p.poly([[63,201],[66,207],[84,217],[89,229],[84,226],[80,221],[61,214]],c.teal);
  p.poly([[38,227],[42,227],[50,219],[49,226],[42,234],[35,235]],c.shadow);

  // Right mass is a severed enclosure: inward folding creates a black cavity, not a ribbon.
  upright(p, 291, -3, [-1, 0, 0], .78);
  materialFace(p, [[593,121],[621,114],[640,124],[640,301],[616,286],[597,254],[578,211],[583,156]],
    [c.shadow,c.recess,c.concrete], 114, 22, 17);
  horizontal(p, 141, .84);
  materialFace(p, [[583,156],[593,121],[621,114],[640,124],[640,140],[620,131],[604,137],[595,164]],
    [c.recess,c.concrete,c.plane], 121, 18, 7);
  upright(p, 206, 32, [0, 1, 0], .38);
  p.poly([[605,141],[620,138],[631,144],[629,177],[611,192],[598,180],[598,161]],c.black);
  upright(p, 206, 32, [1, 0, 0], .5);
  p.poly([[605,145],[613,143],[612,171],[603,178],[601,163]],c.shadow);
  upright(p, 206, 32, [-1, 0, 0], .5);
  p.poly([[618,143],[630,147],[627,176],[618,183],[621,170]],c.shadow);
  horizontal(p, 66, .78);
  materialFace(p, [[600,191],[622,179],[640,184],[640,210],[625,207],[614,218],[598,206]],
    [c.recess,c.concrete,c.plane], 128, 14, 8);
  upright(p, 218, 39, [0, 1, 0], .65);
  p.poly([[603,199],[620,190],[640,196],[640,202],[622,198],[610,208]],c.shadow);
  upright(p, 268, -2, [-1, 0, 0], .42);
  p.poly([[614,221],[623,216],[640,225],[640,263],[624,256]],c.black);
  p.poly([[622,224],[627,224],[630,249],[626,252]],c.shadow);
  upright(p, 286, -3, [-.8, .6, 0], .80);
  materialFace(p, [[578,211],[591,218],[606,250],[617,261],[616,286],[603,268],[591,247]],
    [c.recess,c.concrete,c.plane], 132, 11, 21);
  p.setPlane(null);
  p.poly([[590,225],[595,228],[604,249],[602,251]],c.plane);
  p.poly([[628,269],[640,272],[640,293],[624,282]],c.shadow);
  // Mismatched repeated joint is caught by the east shell. Its endpoint matches the repair.
  p.poly([[599,179],[605,185],[590,202],[579,206],[573,224],[556,231],[550,228],[561,221],[568,219],[573,201],[586,195]],c.deep);
  p.poly([[596,187],[599,186],[590,198],[580,203],[576,217],[573,218],[577,201],[587,195]],c.teal);
  p.poly([[583,235],[588,238],[597,260],[594,259]],c.deep);
  // Secondary top intrusion has a heavy, fractured stem aligned to the repaired seam.
  upright(p, 109, 44, [0, 1, 0], .74);
  materialFace(p, [[274,19],[287,15],[315,40],[313,64],[323,83],[325,105],[314,109],[308,87],[293,71],[296,46],[280,35]],
    [c.black,c.shadow,c.recess], 139, 9, 18);
  upright(p, 109, 44, [1, 0, 0], .70);
  p.poly([[287,15],[297,20],[321,43],[320,65],[329,82],[326,105],[320,101],[320,84],[309,66],[311,42]],c.recess);
  upright(p, 109, 37, [-1, 0, 0], .42);
  p.poly([[300,47],[305,46],[303,64],[315,82],[313,86],[298,69]],c.black);
  p.setPlane(null);
  p.poly([[315,87],[319,89],[320,105],[315,103]],c.deep);
  p.rect(317,96,1,5,c.teal);

  // Near cut fragments below the foundation: mineral faces end into depth and black gaps.
  upright(p, 400, -42, [0, 1, 0], .67);
  materialFace(p, [[430,375],[479,350],[507,356],[515,373],[551,373],[573,356],[607,367],[578,389],[512,400],[472,388]],
    [c.black,c.shadow,c.recess], 155, 26, 9);
  horizontal(p, -19, .80);
  p.poly([[439,374],[479,355],[504,360],[499,369],[473,365],[450,381]],c.recess);
  p.setPlane(null);
  p.poly([[454,373],[478,362],[489,363],[488,366],[477,366],[459,375]],c.concrete);
  p.poly([[514,381],[543,378],[551,382],[531,391],[518,390]],c.black);
  horizontal(p, -21, .76);
  p.poly([[558,375],[575,362],[589,369],[576,378]],c.recess);
  p.setPlane(null);
  p.line(577,366,583,369,c.concrete);
}

/** A cast enclosure: cap, vertical faces and bearing feet are separate physical surfaces. */
export function paintChamberArchitecture(p: ChamberPixels): void {
  upright(p, 342, -8, [0, 1, 0], .60);
  p.poly([[93,125],[127,83],[230,70],[283,88],[359,86],[411,116],[421,153],[489,165],[559,187],[581,230],[581,313],[559,348],[382,364],[114,366],[69,328],[68,198]],c.shadow);
  // Upper wall under the broken cap. The broad wall is matte; reflected edges are interrupted.
  upright(p, 154, 32, [0, 1, 0], .88);
  materialFace(p, [[106,124],[139,96],[229,85],[277,103],[359,100],[397,125],[401,169],[370,174],[139,159],[112,196]],
    [c.recess,c.concrete,building.coating], 204, 34, 18);
  upright(p, 154, 32, [0, 1, 0], .86);
  materialFace(p, [[139,111],[230,102],[274,118],[358,117],[382,133],[383,173],[370,154],[274,154],[234,138],[142,146],[128,183],[129,129]],
    [c.recess,c.concrete,building.coating], 207, 38, 10);
  // Deep ceiling return and rear corner: shadow is caused by thickness, not an outline.
  p.setPlane({ normal: [0, .25, -.97], elevation: 83, occlusion: .60, roughness: .95 });
  p.poly([[108,124],[136,93],[230,80],[278,99],[360,96],[403,121],
    [401,125],[359,101],[278,104],[230,86],[139,99],[110,129]],c.recess);
  upright(p, 182, 32, [1, 0, 0], .65);
  p.poly([[132,133],[139,120],[139,145],[135,163],[128,177]],c.shadow);
  upright(p, 154, 32, [-1, 0, 0], .79, .6, 369);
  p.poly([[369,126],[380,131],[381,166],[373,161],[372,145]],c.concrete);
  p.setPlane(null);
  // Surviving cool-grey skim coat sits over colder structural cast material.
  materialFace(p, [[143,115],[181,110],[205,111],[202,119],[193,121],[187,132],[174,134],[170,142],[150,144],[142,139]],
    [building.coating,building.patch,building.coating], 221, 14, 8);
  p.poly([[155,120],[178,116],[191,117],[184,121],[182,130],[170,132],[165,139],[151,138]],building.coating);
  p.poly([[187,125],[192,122],[196,124],[192,129],[190,136],[182,140],[175,140],[177,136],[186,133]],c.concrete);
  p.line(190,124,187,131,c.plane);
  materialFace(p, [[278,123],[298,120],[308,124],[313,121],[336,123],[346,132],[340,140],[322,141],[314,147],[291,149],[278,143]],
    [c.concrete,building.coating,c.plane], 229, 19, 10);
  p.poly([[300,142],[311,139],[319,141],[316,145],[305,148],[292,148]],building.ground);
  // Roof cut carries aggregate and several differently aged repairs, with a dark underside.
  // The existing two broken bends divide substantial cast sections. Keep one primary
  // receiving face and a sheltered return, rather than three matching luminous ribbons.
  horizontal(p, 91, .95);
  materialFace(p, [[108,124],[136,93],[230,80],[232,66],[126,80],[94,117]],
    [building.undercoat,building.section,c.steel], 237, 27, 7);
  p.setPlane({ normal: [.16, 0, 1], elevation: 91, originX: 232, riseX: -.16,
    occlusion: .87, roughness: .96 });
  materialFace(p, [[230,80],[278,99],[282,85],[232,66]],
    [building.undercoat,building.undercoat,building.section], 237, 27, 7);
  horizontal(p, 83, .82);
  materialFace(p, [[278,99],[360,96],[403,121],[411,112],[363,83],[282,85]],
    [building.undercoat,building.section,building.section], 237, 27, 7);
  p.setPlane(null);
  p.poly([[129,85],[229,73],[279,91],[279,95],[229,79],[135,92],[110,120],[102,120]],building.coating);
  p.poly([[237,75],[254,80],[252,85],[242,82],[239,84],[229,80],[215,82],[215,77]],c.concrete);
  p.poly([[294,90],[316,87],[328,92],[324,101],[307,102],[304,96]],c.concrete);
  p.poly([[337,87],[358,87],[380,101],[374,104],[354,95],[341,96]],c.plane);
  p.poly([[364,93],[371,98],[369,101],[362,99]],c.concrete);
  p.line(149,83,168,80,c.steel); p.line(341,91,354,91,c.steel);
  p.rect(313,90,6,12,c.steel);
  // Left wall: exterior fracture, wall thickness, interior face and foot each have their own value.
  upright(p, 312, 0, [1, 0, 0], .86);
  materialFace(p, [[94,117],[111,124],[109,222],[100,259],[104,316],[118,346],[90,340],[72,316],[73,208]],
    [building.undercoat,building.section,c.concrete], 249, 14, 35);
  p.setPlane(null);
  p.poly([[100,131],[108,127],[106,215],[99,241],[96,263],[100,313],[93,310],[89,265],[94,237]],c.concrete);
  upright(p, 260, 0, [1, 0, 0], .68);
  p.poly([[105,162],[111,155],[109,214],[116,232],[110,251],[103,253],[103,239],[107,217]],c.recess);
  upright(p, 316, 0, [1, 0, 0], .61);
  p.poly([[102,251],[111,250],[111,270],[106,296],[110,318],[121,330],[116,336],[99,319],[97,293]],c.shadow);
  p.setPlane(null);
  p.poly([[82,278],[86,271],[92,293],[89,309],[84,305]],c.plane);
  p.poly([[83,217],[89,198],[91,196],[90,218],[85,235],[84,252],[80,255]],building.coating);
  // Rear wall of the lower work recess. It turns physically into the right shell.
  upright(p, 241, 0, [-.3, .954, 0], .93, .24, 430);
  materialFace(p, [[401,151],[478,165],[553,188],[564,232],[547,259],[431,260],[411,234],[400,210]],
    [c.concrete,building.coating,c.plane], 256, 31, 16);
  horizontal(p, 83, .88);
  p.poly([[409,156],[477,171],[550,194],[550,201],[476,179],[415,166],[410,177]],building.coating);
  upright(p, 241, 0, [-.3, .954, 0], .87, .03, 444);
  materialFace(p, [[416,166],[476,180],[540,199],[545,231],[530,243],[444,245],[419,221]],
    [c.recess,c.concrete,building.coating], 259, 34, 14);
  upright(p, 240, 0, [1, 0, 0], .61);
  p.poly([[418,173],[430,176],[430,215],[423,222],[418,217]],c.recess);
  upright(p, 245, 0, [0, 1, 0], .65);
  p.poly([[427,225],[445,240],[480,242],[531,238],[540,230],[542,233],[533,241],[480,245],[443,243]],c.recess);
  p.setPlane(null);
  // A horizontal spalled area cannot be mistaken for a door.
  p.poly([[433,192],[448,194],[452,196],[471,198],[482,204],[478,209],[462,207],[455,204],[440,205],[430,201]],building.patch);
  p.poly([[436,195],[448,197],[453,199],[467,200],[474,204],[463,203],[454,202],[443,202]],building.coating);
  p.poly([[470,205],[478,206],[481,211],[475,211],[467,208]],c.concrete);
  // An open-ended service channel is bedded in the wall, without a screen or control panel.
  p.poly([[475,213],[506,221],[505,226],[473,218]],c.recess);
  p.line(477,212,506,220,c.plane);
  p.line(479,215,502,221,c.shadow);
  upright(p, 318, 0, [-1, 0, 0], .89);
  materialFace(p, [[557,188],[575,211],[576,295],[562,326],[548,322],[556,274],[549,237]],
    [building.undercoat,building.section,c.concrete], 263, 10, 29);
  p.setPlane(null);
  p.poly([[554,202],[563,211],[567,225],[566,277],[559,304],[553,312],[555,288],[560,267],[559,232]],building.coating);
  upright(p, 318, 0, [-1, 0, 0], .66);
  p.poly([[552,243],[558,250],[557,276],[550,300],[547,316],[541,320],[542,302],[550,271]],c.recess);
  // Upper terrace has a continuous load-bearing front, interrupted only by the two real ramps.
  upright(p, 256, 0, [0, 1, 0], .85);
  materialFace(p, [[132,205],[206,215],[262,224],[302,224],[328,218],[350,206],[396,206],[396,250],[386,266],[241,267],[211,246],[124,252]],
    [c.recess,c.concrete,building.ground], 273, 35, 18);
  upright(p, 246, 0, [0, 1, 0], .95);
  materialFace(p, [[132,214],[190,214],[208,224],[262,224],[270,242],[213,240],[199,232],[130,233]],
    [building.ground,c.concrete,building.coating], 279, 26, 8);
  p.setPlane(null);
  p.poly([[132,232],[198,230],[214,240],[268,240],[277,256],[240,257],[210,241],[131,248]],c.concrete);
  upright(p, 253, 0, [0, 1, 0], .68);
  p.poly([[130,247],[208,244],[239,262],[279,262],[282,266],[239,267],[209,248],[124,253]],c.recess);
  p.setPlane(null);
  p.poly([[144,222],[162,220],[172,223],[171,227],[165,228],[164,234],[147,234]],building.patch);
  p.poly([[146,224],[160,223],[163,225],[158,229],[148,230]],building.coating);
  p.poly([[185,220],[192,221],[195,229],[188,228]],c.concrete);
  p.poly([[217,231],[241,231],[245,235],[253,235],[258,239],[236,240],[222,236]],building.ground);
  // The exposed support between ramps needs a front/return pair distinct from the lower floor.
  // Floors/ramp tops paint later and preserve their legal silhouettes; only this solid face changes.
  upright(p, 256, 0, [-1, 0, 0], .77);
  p.poly([[304,224],[328,218],[350,206],[350,231],[339,239],[333,258],[324,263],[315,256]],c.recess);
  upright(p, 266, 0, [0, 1, 0], .95);
  p.poly([[344,235],[382,220],[388,252],[379,266],[337,266]],building.coating);
  upright(p, 266, 0, [0, 1, 0], .69);
  p.poly([[338,262],[379,262],[388,255],[386,266],[336,269],[333,266]],c.recess);
  p.setPlane(null);
  p.poly([[332,240],[340,233],[339,240],[334,247],[332,255],[328,256]],building.ground);
  // Deep foundation projects below the legal foot contour. It is not a walkable third floor.
  upright(p, 334, 0, [0, 1, 0], .88);
  materialFace(p, [[94,306],[126,334],[368,334],[392,324],[548,318],[556,338],[391,346],[371,356],[121,356],[87,326]],
    [c.concrete,building.coating,c.plane], 295, 31, 9);
  upright(p, 334, 0, [0, 1, 0], .75);
  materialFace(p, [[126,342],[366,342],[390,332],[548,326],[547,343],[393,350],[369,360],[122,360],[93,334]],
    [c.recess,c.concrete,building.ground], 296, 24, 6);
  upright(p, 334, 0, [0, 1, 0], .58);
  p.poly([[121,358],[368,358],[393,348],[548,342],[547,345],[394,351],[370,361],[121,361],[93,338],[93,335]],c.recess);
  p.setPlane(null);
  p.poly([[147,343],[192,343],[199,347],[190,351],[176,350],[173,357],[150,352]],building.patch);
  p.poly([[154,345],[175,345],[182,347],[171,349],[171,353],[157,350]],building.coating);
  p.poly([[434,334],[474,332],[482,337],[472,341],[459,339],[450,343],[436,339]],building.ground);
  paintWalkSurfaces(p);
  paintRamp(p, 'left-stair');
  paintRamp(p, 'right-stair');
  paintMaintenanceFootings(p);
  // The small lamp and all three repair contacts keep their existing dynamic anchors.
  p.setPlane(null);
  // Aperture at y140 has Z48: world Y188 sits in front of the wall at Y186.
  p.block(211,134,5,6,2,c.earth,c.steel,c.concrete,54);
  p.rect(212,139,3,2,c.warm); p.rect(213,140,1,1,c.lamp);
  p.line(214,130,214,117,c.concrete,2);
  paintJointHousing(p,99,240,'left');
  paintJointHousing(p,319,121,'top');
  paintJointHousing(p,549,228,'right');
  p.setPlane(null);
  paintMaterialFinish(p);
  paintMaintenanceMaterials(p);
}

function paintWalkSurfaces(p: ChamberPixels): void {
  // Floors are quiet, maintained material planes. Grain belongs to the narrow layer losses,
  // not a screen-wide three-tone noise field. Upper plaster catches more light than the lower hall.
  horizontal(p, 0);
  p.poly(walkPoly('main'),building.ground);
  p.setPlane(null);
  // One older skim coat in the receiving bay, stopped at the original construction joint.
  p.poly([[99,258],[151,251],[191,248],[206,265],[215,288],[199,302],[157,317],[111,311],[99,297]],building.coating);
  p.poly([[104,263],[151,257],[187,254],[199,267],[208,286],[194,297],[155,311],[116,308],[106,296]],building.ground);
  p.poly([[116,308],[155,311],[179,303],[176,308],[157,316],[119,314]],c.concrete);
  p.poly([[191,250],[197,254],[205,266],[209,284],[207,288],[203,279],[201,268]],c.concrete);
  // Broad poured repair at the active foundation, with a swept finish along its use direction.
  p.poly([[219,285],[251,276],[276,279],[302,294],[305,315],[281,327],[220,320]],c.concrete);
  p.poly([[230,314],[277,321],[291,314],[292,308],[275,314],[238,310]],building.ground);
  // The purifier/entrance recess has the same original floor as the hall, not a separate pedestal.
  p.poly([[437,259],[461,236],[540,237],[549,263],[540,296],[494,305],[447,290]],c.concrete);
  p.poly([[442,266],[464,246],[535,246],[541,263],[532,290],[493,298],[454,285]],building.ground);
  p.poly([[489,299],[531,290],[539,283],[537,293],[514,301],[495,304]],building.coating);
  p.poly([[496,300],[516,296],[521,298],[511,301]],c.concrete);
  // Upper floor is a different illuminated plane, not a second pattern sample.
  horizontal(p, 32);
  p.poly(walkPoly('upper'),building.coating);
  p.setPlane(null);
  p.poly([[143,153],[186,147],[204,153],[204,178],[187,192],[155,193],[136,183]],building.ground);
  p.poly([[145,157],[183,151],[199,156],[198,176],[184,186],[156,188],[143,179]],c.concrete);
  p.poly([[334,165],[367,162],[393,179],[386,199],[353,202],[328,190]],c.concrete);
  // A repaired contraction joint connects different age coats; worn edges are narrow and broken.
  p.poly([[229,147],[235,145],[264,158],[273,161],[273,164],[261,163],[244,155]],c.concrete);
  // Narrow wall-contact shade keeps volume without resembling a traversable black channel.
  p.poly([[142,146],[234,138],[274,154],[370,154],[399,171],[397,174],[369,157],[273,157],[234,141],[144,149],[136,170],[132,184],[129,183]],c.concrete);
  p.poly([[143,147],[234,139],[272,154],[271,156],[234,142],[143,150]],building.ground);
  p.poly([[98,260],[101,260],[101,296],[110,316],[124,330],[123,333],[108,318],[98,297]],c.recess);
  p.poly([[448,253],[463,235],[540,237],[548,256],[546,260],[541,250],[538,241],[464,239],[452,254]],c.concrete);
  p.poly([[464,237],[538,239],[541,243],[537,242],[464,240]],c.recess);
  // Long non-grid contraction seams. Missing chunks and the lit lip explain actual relief.
  p.line(122,314,157,314,c.concrete);
  p.line(157,314,185,302,c.concrete);
  p.line(182,303,199,305,c.recess);
  p.line(193,255,206,268,c.concrete);
  p.line(206,268,215,288,c.recess);
  p.line(214,287,205,295,c.recess);
  p.line(209,277,214,286,building.coating);
  p.line(222,160,220,173,c.concrete);
  p.line(220,173,232,184,c.recess);
  p.line(227,181,237,181,c.concrete);
  p.line(225,178,230,182,c.plane);
  p.line(247,208,272,201,c.concrete);
  p.line(272,201,276,189,c.concrete);
  p.line(318,316,354,316,c.concrete);
  p.line(354,316,368,304,c.recess);
  p.line(363,308,373,309,c.concrete);
  p.line(429,299,457,310,c.recess);
  p.line(429,301,451,309,building.coating);
  p.line(476,288,505,281,c.concrete);
  // Surface abrasion is directional and clustered at landings, with intact quiet ground between.
  for (const [x,y,w] of [[198,282,11],[202,286,7],[176,307,10],[219,207,14],
    [229,203,9],[315,204,12],[303,267,14],[311,273,10],[416,252,14],
    [419,257,9],[399,297,14],[409,292,8],[474,299,12],[486,295,8]] as const) {
    p.line(x,y,x+w,y-2,building.coating);
    p.line(x+3,y+3,x+w-2,y+2,c.concrete);
  }
}

function paintMaintenanceFootings(p: ChamberPixels): void {
  // Cast-on-site bases have a broken skin and a clean working edge, not glowing target discs.
  horizontal(p, 3, .93);
  materialFace(p, [[218,297],[232,282],[267,279],[279,292],[272,309],[232,313]],
    [c.concrete,building.coating,c.plane], 358, 11, 5);
  // The repair is only 3px above the hall. Its front follows the actual oblique
  // edge; a wide vertical crescent would turn the thin pour into a tall pedestal.
  upright(p, 313, 0, [.1, 1, 0], .91, -.1, 232);
  p.poly([[232,310],[272,306],[272,309],[232,313]],c.concrete);
  p.setPlane(null);
  p.line(237,310,257,308,c.plane);
  horizontal(p, 3, .93);
  materialFace(p, [[423,270],[435,253],[469,256],[479,273],[464,283],[432,282]],
    [c.concrete,building.coating,c.plane], 364, 12, 5);
  upright(p, 282, 0, [-1 / 32, 1, 0], .91, 1 / 32, 432);
  p.poly([[432,279],[464,280],[464,283],[432,282]],c.concrete);
  upright(p, 273, 0, [2 / 3, 1, 0], .88, -2 / 3, 479);
  p.poly([[477,272],[479,273],[464,283],[464,280]],c.concrete);
  p.setPlane(null);
  p.line(434,282,449,283,c.plane);
  // Short protected service trenches have exposed depth and several irregular salvaged covers.
  p.poly([[274,291],[306,294],[327,281],[352,281],[356,286],[330,286],[308,300],[273,297]],c.shadow);
  p.poly([[277,290],[306,293],[327,280],[351,280],[351,282],[327,283],[307,296],[277,293]],c.concrete);
  p.poly([[287,293],[304,295],[304,298],[286,296]],c.earth);
  p.line(289,293,301,295,building.coating);
  p.poly([[315,291],[326,284],[329,286],[318,293]],c.plane);
  p.line(318,290,325,286,c.steel);
  p.poly([[349,281],[373,276],[399,278],[423,269],[425,273],[400,283],[374,281],[350,285]],c.recess);
  p.poly([[353,281],[374,279],[399,280],[416,274],[415,277],[400,283],[374,281]],c.concrete);
  p.poly([[382,279],[395,280],[394,283],[382,282]],c.earth);
  p.line(384,280,391,281,building.coating);
}

/** Secondary detail follows only existing material losses, pours and support contacts. */
function paintMaterialFinish(p: ChamberPixels): void {
  // Rear pour joints are staggered, with edge damage and short repairs rather than bricks.
  p.line(221,111,221,128,c.recess);
  p.line(223,113,223,125,c.plane);
  p.poly([[219,127],[224,127],[228,135],[227,143],[223,141],[220,136]],c.concrete);
  p.line(264,125,269,140,c.concrete);
  p.line(266,126,270,138,building.coating);
  p.poly([[264,141],[270,140],[274,144],[273,151],[269,151]],c.concrete);
  p.line(467,185,469,199,c.recess);
  p.line(469,186,471,197,c.plane);
  p.poly([[491,201],[512,207],[519,212],[513,212],[501,208],[490,205]],building.coating);
  p.poly([[523,216],[530,217],[534,225],[529,230],[525,223],[520,222]],c.concrete);
  // Exposed aggregate exists inside four chipped regions, not distributed as confetti.
  for (const [x,y] of [[187,132],[192,124],[302,144],[335,134],[468,205],[523,219],
    [148,228],[158,230],[234,237],[335,232],[172,351],[278,349],[464,341]] as const) aggregate(p,x,y);
  p.poly([[332,130],[338,126],[344,128],[344,134],[338,137],[333,135]],building.ground);
  p.poly([[336,129],[340,128],[341,131],[337,133]],c.plane);
  // Top slab thickness is more than a dark line; small broken segments expose mineral matter.
  p.line(138,214,158,214,c.plane);
  p.line(171,214,181,214,c.plane);
  p.line(135,217,181,217,c.concrete,2);
  p.line(190,215,207,224,c.plane,2);
  p.line(213,224,228,224,c.plane);
  p.line(242,224,258,224,c.plane);
  p.poly([[234,224],[239,224],[243,227],[242,230],[235,229]],c.concrete);
  p.line(311,221,321,218,c.plane);
  p.line(309,226,324,222,c.concrete,2);
  // Ramp landing transitions continue the exact legal walk polygons, never an added obstacle.
  p.poly([[284,266],[324,266],[324,269],[286,269]],building.coating);
  p.line(288,269,308,269,c.concrete);
  p.poly([[396,250],[442,250],[442,253],[398,253]],building.coating);
  p.line(400,253,434,253,c.concrete);
  // Footing faces include broken coarse material and short, partially buried reinforcement.
  p.poly([[244,343],[253,342],[259,345],[257,350],[248,349]],building.ground);
  p.poly([[281,345],[287,344],[290,347],[286,351],[280,350]],building.coating);
  p.line(312,346,327,346,c.recess,2);
  p.line(314,346,324,346,c.steel);
  p.line(500,334,516,333,c.recess,2);
  p.line(503,334,513,333,c.steel);
  p.line(194,348,205,348,c.recess);
  p.line(199,350,205,349,c.concrete);
}

/** Material history sits on existing load-bearing/working surfaces. None of these marks
 * introduces a prop, a new collision or a luminous signal: the room has been repaired and used. */
function paintMaintenanceMaterials(p: ChamberPixels): void {
  // Old mineral wash behind the body chamber. The surviving skin overlaps a dark binder,
  // a rough cold cast layer and the later narrow skim, rather than changing the entire wall hue.
  p.poly([[143,119],[154,115],[173,114],[185,116],[201,113],[207,117],[201,123],[194,124],
    [190,134],[180,139],[170,141],[161,145],[153,146],[146,149],[140,149],[142,142],[142,135]],building.oldBinder);
  p.poly([[145,120],[157,118],[170,117],[178,120],[190,118],[197,118],[195,122],[186,123],
    [184,130],[176,133],[171,132],[166,139],[155,137],[152,133],[144,133]],building.cleanLime);
  p.poly([[146,121],[153,120],[155,125],[161,125],[162,131],[156,132],[150,130],[144,131]],building.mineralWash);
  p.poly([[178,121],[186,120],[190,122],[184,124],[183,129],[177,131],[175,128]],building.mineralWash);
  p.poly([[161,135],[166,132],[171,134],[169,138],[160,141],[155,139]],c.earth);
  p.poly([[146,133],[153,134],[157,140],[153,142],[145,139]],c.concrete);
  p.poly([[188,127],[193,125],[195,128],[191,133],[192,136],[184,139],[179,138],[183,134]],c.concrete);
  p.poly([[190,128],[192,128],[190,132],[186,135],[185,134]],c.plane);
  // Water/medium handling leaves short downward residue only on this vertical wall.
  p.line(149,139,149,146,c.concrete,2);
  p.line(151,142,152,149,c.recess);
  p.line(184,139,184,148,building.oldBinder);
  p.line(187,138,187,144,c.concrete);
  // One material junction continues through the existing wall foot: old binder
  // under the surviving lime skin, bare cast edge, and a short mineral runout.
  // It inherits the wall/floor surfaces beneath; none of these colours raises a lip.
  p.poly([[141,137],[144,136],[146,140],[145,145],[139,153],[136,156],[137,150]],building.cleanLime);
  p.poly([[145,142],[149,143],[148,147],[143,152],[141,153],[142,149]],building.mineralWash);
  p.poly([[143,146],[146,143],[147,143],[146,147],[142,152]],c.concrete);
  p.poly([[141,149],[149,147],[153,148],[149,151],[148,155],[143,158],[140,158]],building.oldBinder);
  p.poly([[142,151],[146,150],[147,151],[145,154],[141,157]],building.cleanLime);
  p.line(139,155,144,151,c.concrete);
  // A poured repair straddles the original cold joint. Small exposed wire ends remain embedded.
  p.poly([[213,112],[226,110],[229,118],[226,121],[230,134],[225,144],[219,142],[217,130],
    [213,127]],building.cleanLime);
  p.poly([[218,114],[224,113],[225,120],[221,122],[225,135],[222,139],[220,129],[216,124]],c.concrete);
  p.line(218,121,222,119,c.steel);
  p.line(221,131,225,130,c.recess,2);
  p.line(222,131,225,131,c.plane);

  // Lower rear repair is layered plaster loss, a salvaged cover and two differently-aged clamps.
  p.poly([[433,194],[444,193],[457,198],[466,198],[479,204],[479,209],[467,207],
    [458,204],[448,206],[438,203],[431,199]],building.oldBinder);
  p.poly([[436,196],[444,195],[452,198],[464,200],[471,204],[462,203],[457,202],
    [447,204],[439,201]],building.cleanLime);
  p.poly([[443,196],[449,197],[449,199],[455,199],[457,202],[451,202],[445,200]],c.rust);
  p.poly([[445,197],[448,198],[448,200],[445,199]],c.earth);
  p.poly([[461,202],[468,204],[469,207],[465,206]],c.concrete);
  // Thin horizontal cover follows the existing maintenance slot; it cannot read as a doorway.
  p.poly([[480,210],[504,217],[509,217],[508,221],[478,214]],c.recess);
  p.poly([[480,209],[504,216],[509,216],[508,219],[479,212]],c.steel);
  p.poly([[482,210],[491,213],[491,215],[482,212]],c.plane);
  p.line(496,214,503,216,c.edge);
  p.rect(483,212,2,2,c.concrete); p.rect(504,217,2,2,c.concrete);
  p.poly([[521,218],[529,220],[531,228],[527,229],[523,224],[519,223]],building.cleanLime);
  p.poly([[524,223],[527,222],[529,226],[527,228]],building.oldBinder);

  // Vertical terrace face records three construction layers, tied across one real seam.
  // The loss opens into the slab edge; a closed ring with a coloured centre read as an eye.
  p.poly([[151,214],[159,214],[160,219],[168,219],[172,224],[180,227],[177,231],
    [171,228],[165,231],[157,228],[152,224],[147,224],[149,219]],building.oldBinder);
  p.poly([[152,215],[157,215],[157,220],[163,223],[169,223],[175,226],[169,226],
    [165,224],[159,225],[154,221]],building.cleanLime);
  p.poly([[156,219],[159,220],[160,223],[157,222]],c.concrete);
  p.poly([[166,225],[171,225],[173,228],[169,227]],c.concrete);
  p.poly([[199,228],[207,231],[216,233],[216,237],[208,236],[201,233]],c.steel);
  p.line(201,229,214,234,c.plane);
  p.rect(202,231,2,2,c.recess); p.rect(211,234,2,2,c.recess);
  p.poly([[351,245],[367,243],[373,246],[371,249],[363,248],[359,252],[349,251]],building.cleanLime);
  p.poly([[353,247],[359,245],[364,246],[361,248],[358,249]],c.concrete);
  p.poly([[370,251],[375,249],[377,252],[374,256],[369,255]],c.concrete);
  p.line(374,251,374,254,c.plane);

  paintWorkingFloorMaterials(p);
}

function paintWorkingFloorMaterials(p: ChamberPixels): void {
  // Receiving bay: dry residue collects at the old casting joint; the middle is swept clear.
  // Residue starts at the wall foot and tails along the old joint; it is not a loose pickup.
  p.poly([[101,286],[104,287],[105,293],[110,298],[123,302],[136,304],[145,303],
    [145,305],[136,307],[122,304],[108,300],[102,293]],building.oldBinder);
  p.poly([[103,290],[105,294],[111,298],[119,300],[118,301],[109,300],[104,296]],c.earth);
  p.poly([[124,303],[132,304],[134,305],[127,305]],building.cleanLime);
  p.poly([[147,298],[161,299],[171,294],[177,294],[170,300],[159,305],[151,304]],building.ground);
  // Broad abrasion has thickness and direction, not a repeated footprint decal or loose debris.
  p.poly([[168,303],[177,300],[185,300],[185,302],[177,304],[171,307],[167,306]],building.coating);
  p.poly([[171,304],[177,302],[182,302],[179,304],[173,306]],building.ground);
  p.line(175,297,183,295,building.cleanLime);
  p.line(179,309,187,306,c.plane);

  // Body chamber: two unequal deposits terminate into the apron, with the wiped middle empty.
  p.poly([[146,185],[153,188],[160,189],[160,192],[153,191],[144,188]],building.oldBinder);
  p.poly([[148,187],[155,190],[159,190],[158,191],[152,190]],building.cleanLime);
  p.poly([[150,188],[153,189],[152,190],[149,189]],building.mineralWash);
  p.poly([[179,188],[185,185],[190,186],[187,190],[182,191],[179,190]],building.oldBinder);
  p.line(183,189,187,187,building.cleanLime);
  p.poly([[194,191],[202,190],[204,192],[200,195],[194,195]],c.concrete);
  p.line(197,191,201,191,c.plane);

  // A repaired cold joint connects the existing rear seam (232,184) to the
  // existing slab seam (247,208), replacing the two unrelated decorative arcs.
  p.poly([[232,184],[235,185],[241,197],[250,204],[250,207],[247,208],[238,201],[235,191]],c.concrete);
  p.line(232,184,239,199,c.recess);
  p.line(239,199,247,208,c.recess);
  p.poly([[234,188],[237,189],[241,197],[239,198],[237,193]],building.cleanLime);
  p.poly([[240,200],[244,202],[247,206],[246,207],[242,204]],building.coating);

  // Core work footing: composite repair lip with a few sunk fastenings. The conduit stays flush.
  p.poly([[224,309],[232,313],[241,313],[243,315],[240,317],[232,316],[224,312]],building.oldBinder);
  p.poly([[226,310],[233,314],[240,314],[239,315],[232,315]],building.cleanLime);
  p.rect(236,315,3,1,c.earth);
  p.poly([[261,312],[267,308],[270,309],[267,313],[262,315]],building.oldBinder);
  p.line(263,312,267,310,c.plane);
  p.poly([[278,292],[291,293],[292,298],[278,297]],c.steel);
  p.poly([[278,295],[289,296],[289,298],[278,297]],c.concrete);
  p.line(280,292,289,293,c.edge);
  p.rect(280,294,2,1,c.recess); p.rect(287,295,2,1,c.recess);
  p.poly([[310,292],[319,286],[322,289],[313,295]],c.rust);
  p.line(312,291,318,287,c.earth);
  p.poly([[335,281],[350,281],[351,285],[335,285]],c.concrete);
  p.line(337,281,348,281,c.steel);
  p.rect(338,283,3,1,c.recess); p.rect(345,283,3,1,c.recess);
  // A small number of broad trowel sweeps, cropped at the working patch.
  p.poly([[284,312],[291,310],[303,311],[306,313],[300,314],[291,313],[285,315]],c.plane);
  p.poly([[288,312],[299,313],[302,312],[304,313],[300,315],[290,314]],building.ground);
  p.line(295,307,305,308,building.cleanLime);

  // Exit-side equipment: dark sediment ends at the old shallow channel and a laid-in drain cover.
  p.poly([[432,280],[438,282],[444,282],[445,284],[441,286],[436,284],[432,282]],building.oldBinder);
  p.line(434,282,441,284,building.cleanLime);
  p.poly([[462,284],[470,281],[475,277],[479,278],[475,282],[469,285],[462,286]],building.oldBinder);
  p.line(464,284,470,282,building.cleanLime);
  p.poly([[474,276],[490,274],[496,276],[495,280],[478,282],[473,280]],c.recess);
  p.poly([[476,276],[490,275],[494,277],[493,279],[478,281],[475,279]],c.plane);
  for (let x = 478; x <= 490; x += 4) {
    p.line(x,277,x+1,279,c.concrete);
  }
  p.line(480,280,490,278,c.steel);
  p.poly([[493,294],[503,292],[509,293],[516,290],[521,290],[518,293],[509,295],[503,294],[496,297]],building.cleanLime);
  p.poly([[497,294],[502,294],[503,295],[497,296]],c.concrete);
  // Tread noses show wear concentrated toward the middle, away from unused side returns.
  p.poly([[288,260],[300,260],[304,262],[301,264],[290,264]],building.cleanLime);
  p.line(291,261,299,261,c.plane);
  p.poly([[404,244],[417,244],[420,246],[417,248],[407,248]],building.cleanLime);
  p.line(408,245,416,245,c.plane);
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
  const downX = d[0] - a[0]; const downY = d[1] - a[1];
  const worldDownY = downY - 32;
  // A full load-bearing side cheek joins the raised slab to the lower landing.
  // Its oblique foot line moves in world Y. Using a fixed row would sink the
  // far end below the lower landing even though the painted edge meets it.
  upright(p, a[1] + 32, 0, [-worldDownY, downX, 0], .78, worldDownY / downX, a[0]);
  p.poly([[a[0]-7,a[1]-1],[a[0]-1,a[1]-1],[d[0]-1,d[1]+3],[d[0]-7,d[1]+5],[a[0]-7,a[1]+29]],c.concrete);
  p.setPlane(null);
  p.poly([[a[0]-7,a[1]+4],[a[0]-4,a[1]+6],[d[0]-4,d[1]+3],[d[0]-7,d[1]+5]],c.plane);
  p.poly([[a[0]-7,a[1]+24],[a[0]-4,a[1]+27],[d[0]-7,d[1]+5],[d[0]-10,d[1]+2]],building.ground);
  const acrossX = b[0] - a[0]; const acrossY = b[1] - a[1];
  const determinant = acrossX * downY - acrossY * downX;
  const riseX = 32 * acrossY / determinant;
  const riseY = -32 * acrossX / determinant;
  // Z = ax*screenX + ay*screenY; worldY = screenY + Z. Transform the
  // derivative to world space before forming the normal; the slope is not a wall.
  const rampPlane: SurfacePlane = { normal: [-riseX, -riseY, 1 + riseY],
    elevation: 32, originX: a[0], originY: a[1], riseX, riseY, occlusion: .97, roughness: .93 };
  p.setPlane(rampPlane);
  materialFace(p, points, [c.concrete,building.coating,c.plane], route === 'left-stair' ? 381 : 389, 17, 6);
  p.setPlane(null);
  for (let step = 1; step < 7; step++) {
    const t = step / 7;
    const x1 = a[0] + (d[0] - a[0]) * t;
    const y1 = a[1] + (d[1] - a[1]) * t;
    const x2 = b[0] + (e[0] - b[0]) * t;
    const y2 = b[1] + (e[1] - b[1]) * t;
    p.poly([[x1,y1],[x2,y2],[x2+1,y2+3],[x1+1,y1+3]],c.concrete);
    p.line(x1+1, y1+2, x2-1, y2+2, building.ground);
    // Short worn noses leave the broad slope readable; no six full-width bright rails.
    if (step === 2 || step === 5) p.line(x1+8, y1-1, x1+18, y1-1, c.plane);
    if (step === 2 || step === 5) {
      p.poly([[x1+6,y1-2],[x1+10,y1-2],[x1+12,y1],[x1+8,y1]],building.coating);
      p.line(x1+16,y1+1,x1+21,y1+1,c.recess);
    }
  }
  // Low cast curb lives just outside the traversable side, never across the opening.
  p.setPlane({ ...rampPlane, elevation: 34, occlusion: .94 });
  p.poly([[a[0] - 5, a[1] - 3], [a[0] - 1, a[1] - 3], [d[0] - 1, d[1] - 2], [d[0] - 5, d[1] - 2]], building.patch);
  p.setPlane(null);
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
  horizontal(p, 3, .94);
  materialFace(p, [[126,334],[368,334],[392,324],[548,318],[548,323],[393,329],[369,339],[126,339],[95,312],[94,306]],
    [c.concrete,building.coating,c.plane], 402, 24, 3);
  p.setPlane(null);
  p.poly([[130,337],[168,337],[176,339],[177,341],[151,340],[143,341],[130,340]],building.patch);
  p.poly([[187,337],[209,337],[213,339],[208,341],[196,340]],building.coating);
  p.poly([[451,325],[471,324],[480,326],[474,328],[459,327]],building.patch);
  p.line(245,336,270,336,c.plane);
  p.line(285,337,298,337,c.concrete);
  p.poly([[342,334],[347,334],[350,337],[347,339],[342,338]],c.concrete);
  p.line(403,325,421,324,c.plane);
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
  // Upright open feed: the contained foreign matter is the centre, with unequal cast cheeks.
  horizontal(p, 4, .91);
  p.poly([[-23, -5], [-14, -12], [17, -9], [24, -3], [14, 2], [-18, 1]], c.plaster);
  upright(p, 0, 0, [0, 1, 0], .92);
  p.poly([[-17, -12], [-14, -46], [-9, -57], [-3, -57], [-5, -13]], c.plane);
  upright(p, 0, 0, [-.65, .76, 0], .95);
  p.poly([[-14, -46], [-9, -55], [-7, -53], [-10, -14], [-14, -14]], c.steel);
  upright(p, 0, 0, [1, 0, 0], .90);
  p.poly([[10, -53], [15, -48], [18, -11], [11, -10], [7, -44]], c.concrete);
  upright(p, 0, 0, [0, 1, 0], .93);
  p.poly([[12, -46], [16, -42], [18, -15], [15, -14]], c.plane);
  upright(p, 0, 0, [0, 1, 0], .58);
  p.poly([[-7, -50], [7, -50], [11, -17], [5, -9], [-7, -13]], c.shadow);
  p.poly([[-4, -47], [4, -45], [2, -37], [7, -34], [3, -25], [6, -20], [1, -13], [-5, -18], [-2, -29], [-5, -36]], c.deep);
  p.poly([[-2, -43], [2, -40], [0, -34], [4, -33], [1, -28], [-2, -29]], c.teal);
  p.poly([[1, -24], [4, -22], [1, -18], [-2, -20]], c.live);
  horizontal(p, 54, .98, .68);
  p.poly([[-11, -57], [-4, -61], [9, -57], [13, -52], [4, -53], [-3, -54]], c.steel);
  p.setPlane(null);
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

function rift(p: ChamberPixels): void {
  // Uneven radiating ground fracture, with three depths and disconnected exposed lips.
  horizontal(p, 0, .95);
  p.poly([[-25,-3],[-16,-8],[-10,-6],[-5,-15],[1,-11],[6,-16],[11,-7],[23,-9],[16,-2],[25,3],[11,5],[7,12],[0,7],[-9,12],[-11,4],[-24,6],[-17,0]], c.plane);
  horizontal(p, -2, .70);
  p.poly([[-22,-3],[-12,-4],[-7,-11],[-3,-6],[5,-13],[7,-5],[18,-7],[10,-1],[22,2],[9,2],[4,9],[-1,4],[-8,9],[-8,1],[-19,4],[-12,-1]], c.recess);
  horizontal(p, -6, .40);
  p.poly([[-13,-2],[-6,-5],[-2,-3],[3,-8],[5,-3],[12,-3],[7,1],[10,3],[2,3],[0,7],[-3,2],[-10,4],[-7,0]], c.black);
  horizontal(p, -10, .30);
  p.poly([[-5,-3],[0,-2],[3,-5],[4,-1],[1,3],[-4,1]], c.void);
  p.poly([[-4,-3],[-1,-2],[3,-5],[4,-2],[1,1],[-3,0]], c.deep);
  p.setPlane(null);
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
