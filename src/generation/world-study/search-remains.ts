/** Source-world fracture products. This module knows nothing about hidden loot. */
import { SEARCH_REMAINS, type SearchRemainsGrammar } from '../../generated/rift-search-remains';
import { mapWorldPigment, paintedToneRange } from './world-material-pigment';
import type { R100WorldAppearance } from './r100-world-appearance';
import type { WorldProfile } from './types';

type PatchName = 'skin' | 'cleaved' | 'loose';
export interface SearchRemainsMaterial {
  readonly appearance?: R100WorldAppearance;
  readonly width: number;
  readonly height: number;
  /** Shared material pixels are read-only to this generator. */
  readonly pixels: Uint8ClampedArray;
  readonly source: string;
  readonly regions?: Readonly<Record<PatchName, Readonly<{ x: number; y: number; width: number; height: number }>>>;
}

export interface SearchRemainsPixels {
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8ClampedArray;
  readonly grammar: SearchRemainsGrammar;
  readonly sourceId: string;
}

type Point = readonly [number, number];
type Face = 'top' | 'cut' | 'side' | 'inside' | 'contact';
const WIDTH = 34, HEIGHT = 26;

function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

function rgb(value: number): readonly [number, number, number] {
  return [(value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function validateMaterial(material: SearchRemainsMaterial): void {
  const { width, height, pixels } = material;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || pixels.length !== width * height * 4) throw new Error('Search remains: invalid source material pixels');
  if (material.regions) for (const name of ['skin', 'cleaved', 'loose'] as const) {
    const p = material.regions[name];
    if (!p || [p.x, p.y, p.width, p.height].some(v => !Number.isFinite(v)) || p.x < 0 || p.y < 0 || p.width <= 0 || p.height <= 0 || p.x + p.width > 1 || p.y + p.height > 1) throw new Error(`Search remains: invalid ${name} source patch`);
  }
}

/** Allocated only when preparing world textures, never in update/render. */
export function createSearchRemainsPixels(profile: WorldProfile, seed: number, painting?: SearchRemainsMaterial): SearchRemainsPixels {
  const definition = SEARCH_REMAINS.find(row => row.worldId === profile.id);
  if (!definition) throw new Error(`Search remains: no source grammar for world ${profile.id}`);
  return createSearchRemainsGrammarPixels(profile, seed, definition.grammar, painting);
}

/** Pure source-grammar renderer, also used to review new fracture products before
 * a world is authored. Production world selection always uses the CSV above. */
export function createSearchRemainsGrammarPixels(profile: WorldProfile, seed: number, grammar: SearchRemainsGrammar, painting?: SearchRemainsMaterial): SearchRemainsPixels {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Search remains: expected an unsigned integer seed');
  if (painting) validateMaterial(painting);
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const appearance=painting?.appearance,range=appearance&&painting?paintedToneRange(painting):undefined;
  const mapped=new Float32Array(3),identityField={secondary:0,tone:0,detail:1};
  const palette = profile.palette;
  const dark = rgb(palette.materialDark), mid = rgb(palette.materialMid), light = rgb(palette.materialLight), fresh = rgb(palette.faceLight);
  const flip = (hash(1, 1, seed) & 1) === 1;
  const shift = (hash(2, 1, seed) % 3) - 1;
  const mirror = (v: number, length: number): number => {
    const q = ((Math.floor(v) % (length * 2)) + length * 2) % (length * 2);
    return q < length ? q : length * 2 - q - 1;
  };

  const color = (x: number, y: number, face: Face, piece: number, direction: number): readonly number[] => {
    // The granularity follows the fracture, not a uniform salt-and-pepper mask.
    const u = direction ? y : x, v = direction ? x : y;
    const band = hash(Math.floor(u / 5), Math.floor(v / 2), seed + piece * 103) % 5;
    const tone = [.95, .98, 1, 1.02, 1.04][band]!;
    if (painting) {
      const patch = painting.regions?.[face === 'top' ? 'loose' : 'cleaved'];
      const left = patch ? Math.floor(patch.x * painting.width) : 0;
      const top = patch ? Math.floor(patch.y * painting.height) : 0;
      const w = patch ? Math.min(painting.width - left, Math.max(1, Math.round(patch.width * painting.width))) : painting.width;
      const h = patch ? Math.min(painting.height - top, Math.max(1, Math.round(patch.height * painting.height))) : painting.height;
      const sx = left + mirror(u * 1.6 + (seed % 97) + piece * 17, w);
      const sy = top + mirror(v * 1.6 + ((seed >>> 8) % 71) + piece * 13, h);
      const offset = (sy * painting.width + sx) * 4;
      // A broken face is a readable plane, not another patch of loose floor.
      // Keep the source pigment, but let its finer grain recede behind the face.
      // Filtering stays strictly inside the selected source-material patch.
      const offsets: number[] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = Math.max(left, Math.min(left + w - 1, sx + dx));
        const py = Math.max(top, Math.min(top + h - 1, sy + dy));
        offsets.push((py * painting.width + px) * 4);
      }
      const grain = face === 'cut' ? .22 : face === 'top' ? .38 : .45;
      const gain = face === 'top' ? 1.39 : face === 'cut' ? 1.43 : face === 'side' ? .40 : face === 'contact' ? .23 : .56;
      if(appearance&&range){
        const filtered=[0,1,2].map(c=>{
          const plane=offsets.reduce((sum,i)=>sum+painting.pixels[i+c]!,0)/offsets.length;
          return painting.pixels[offset+c]!*grain+plane*(1-grain);
        });
        mapWorldPigment(appearance,face==='cut'?'cleaved':'solid',filtered[0]!,filtered[1]!,filtered[2]!,range,identityField,0,mapped);
        return [0,1,2].map(c=>Math.min(255,mapped[c]!*gain*tone));
      }
      return [0, 1, 2].map(c => {
        const plane = offsets.reduce((sum, i) => sum + painting.pixels[i + c]!, 0) / offsets.length;
        const pigment = painting.pixels[offset + c]! * grain + plane * (1 - grain);
        return Math.min(255, pigment * gain * tone);
      });
    }
    const a = face === 'top' ? light : dark;
    const b = face === 'top' || face === 'cut' ? fresh : mid;
    const t = face === 'top' ? .52 : face === 'cut' ? .92 : face === 'side' ? .1 : .13;
    return [0, 1, 2].map(c => (a[c]! * (1 - t) + b[c]! * t) * tone * (face === 'contact' ? .46 : 1));
  };

  const fill = (points: readonly Point[], face: Face, piece: number, direction = 0): void => {
    const p = points.map(([x, y]) => [flip ? WIDTH - 1 - x : x, y + shift] as const);
    const minX = Math.max(1, Math.floor(Math.min(...p.map(v => v[0]))));
    const maxX = Math.min(WIDTH - 2, Math.ceil(Math.max(...p.map(v => v[0]))));
    const minY = Math.max(1, Math.floor(Math.min(...p.map(v => v[1]))));
    const maxY = Math.min(HEIGHT - 2, Math.ceil(Math.max(...p.map(v => v[1]))));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      let inside = false;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const a = p[i]!, b = p[j]!;
        if ((a[1] > y + .5) !== (b[1] > y + .5) && x + .5 < (b[0] - a[0]) * (y + .5 - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (!inside) continue;
      const c = color(x, y, face, piece, direction), i = (y * WIDTH + x) * 4;
      pixels[i] = c[0]!; pixels[i + 1] = c[1]!; pixels[i + 2] = c[2]!; pixels[i + 3] = 255;
    }
  };

  const plate = (points: readonly Point[], thickness: number, piece: number): void => {
    // Front and broken side faces have real area; no contour stroke is applied.
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      if (b[0] < a[0]) {
        fill([a, b, [b[0], b[1] + thickness], [a[0], a[1] + thickness]], 'side', piece);
        if (thickness > 2) fill([[a[0], a[1] + 1], [b[0], b[1] + 1], [b[0], b[1] + 2], [a[0], a[1] + 2]], 'cut', piece);
      }
    }
    fill(points, 'top', piece);
  };

  // Small contact patches underneath the supported fragments, not a surrounding
  // black ellipse or a stroke up the silhouette. Lighting still belongs to Rift.
  fill([[7, 20], [17, 19], [22, 21], [20, 23], [10, 23], [6, 22]], 'contact', 0);
  switch (grammar) {
    case 'laminated-flakes': {
      plate([[4, 17], [12, 13], [27, 14], [25, 18], [14, 22], [6, 21]], 1, 0);
      plate([[6, 11], [18, 6], [25, 9], [23, 12], [16, 14], [10, 18], [4, 15]], 2, 1);
      plate([[7, 8], [14, 7], [16, 9], [11, 13], [6, 12]], 2, 2);
      // Cleavage runs stop at the fracture, without circling a regular tier.
      fill([[11, 12], [19, 9], [22, 10], [15, 13]], 'cut', 1);
      plate([[19, 15], [25, 11], [28, 12], [27, 17], [22, 19]], 2, 3);
      plate([[25, 20], [29, 18], [31, 20], [27, 22]], 1, 4);
      break;
    }
    case 'fractured-fibres': {
      const fibre = (a: Point, b: Point, width: number, piece: number): void => {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
        const px = -dy / length * width / 2, py = dx / length * width / 2;
        const q: Point[] = [[a[0] + px, a[1] + py], [b[0] + px, b[1] + py], [b[0] - px, b[1] - py], [a[0] - px, a[1] - py]];
        fill(q.map(([x, y]) => [x, y + 2]), 'side', piece, 1);
        fill(q, 'top', piece, 1);
        fill([q[0]!, q[3]!, [q[3]![0] + dx / length * 2, q[3]![1] + dy / length * 2], [q[0]![0] + dx / length * 2, q[0]![1] + dy / length * 2]], 'cut', piece, 1);
      };
      fibre([5, 19], [23, 13], 4, 0);
      fibre([8, 15], [20, 5], 4, 1);
      fibre([14, 18], [27, 8], 4, 2);
      fibre([7, 12], [23, 8], 3, 3);
      fibre([17, 21], [26, 15], 3, 4);
      fibre([5, 10], [10, 8], 2, 5);
      break;
    }
    case 'glaze-shell': {
      plate([[4, 17], [8, 12], [12, 13], [14, 18], [9, 21], [5, 20]], 2, 0);
      // Only a torn part of the curved wall survives. Its opening continues into
      // the ground on the left: no intact bowl, ring, manufactured rim or base.
      fill([[9, 9], [15, 6], [22, 7], [26, 11], [27, 16], [24, 21], [18, 21], [19, 18], [22, 14], [21, 11], [17, 10], [12, 11]], 'side', 1);
      fill([[8, 7], [14, 4], [21, 5], [25, 9], [26, 14], [23, 19], [18, 19], [19, 16], [22, 12], [21, 9], [17, 8], [12, 9]], 'top', 1);
      fill([[12, 7], [17, 6], [21, 8], [24, 11], [23, 15], [20, 17], [19, 15], [21, 11], [19, 9], [15, 8]], 'inside', 1);
      fill([[20, 16], [23, 15], [24, 16], [22, 19], [18, 19], [19, 17]], 'cut', 2);
      plate([[12, 18], [15, 16], [18, 20], [16, 22], [12, 21]], 2, 3);
      plate([[26, 20], [29, 17], [31, 20], [28, 22]], 1, 4);
      break;
    }
    case 'mineral-splinters': {
      const crystal = (a: Point, b: Point, halfWidth: number, piece: number): void => {
        const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy), px = -dy / length * halfWidth, py = dx / length * halfWidth;
        const left: Point = [a[0] + px, a[1] + py], right: Point = [a[0] - px, a[1] - py];
        const tipLeft: Point = [b[0] + px * .44, b[1] + py * .44], tipRight: Point = [b[0] - px * .3, b[1] - py * .3];
        fill([left, tipLeft, tipRight, right, [right[0], right[1] + 3], [left[0], left[1] + 3]], 'side', piece);
        fill([left, tipLeft, b, a], 'top', piece);
        fill([a, b, tipRight, right], 'cut', piece);
      };
      crystal([8, 18], [15, 14], 3, 0);
      crystal([12, 16], [6, 10], 3, 1);
      crystal([12, 16], [23, 7], 4, 2);
      crystal([19, 18], [28, 13], 3, 3);
      crystal([11, 21], [17, 19], 2, 4);
      break;
    }
    case 'packed-granules': {
      // Compacted aggregate breaks into irregular masses. The lighter fractured
      // core spans a real plane; the small grains remain embedded in that mass.
      plate([[5, 16], [8, 10], [13, 8], [19, 9], [22, 15], [18, 19], [9, 20]], 3, 0);
      fill([[8, 12], [13, 9], [18, 10], [19, 14], [14, 16], [9, 15]], 'cut', 0);
      fill([[12, 11], [15, 10], [17, 12], [14, 13]], 'top', 1);
      plate([[20, 13], [24, 10], [28, 12], [30, 17], [25, 20], [20, 18]], 3, 2);
      fill([[23, 13], [26, 12], [28, 15], [26, 17], [22, 16]], 'cut', 2);
      plate([[12, 19], [16, 17], [21, 19], [20, 22], [14, 23], [11, 22]], 1, 3);
      plate([[3, 20], [5, 18], [8, 20], [7, 22], [4, 22]], 1, 4);
      break;
    }
    case 'torn-membrane': {
      // A collapsed sheet with unequal folds and a thick severed margin. The
      // opening is a tear, never an intact bowl or a tied bundle of human cloth.
      plate([[5, 19], [4, 11], [7, 4], [13, 3], [18, 5], [22, 4], [25, 7], [23, 10], [17, 9], [13, 11], [12, 15], [18, 18], [27, 15], [30, 17], [28, 22], [22, 24], [15, 22], [9, 23]], 1, 0);
      fill([[7, 18], [6, 11], [9, 6], [12, 5], [15, 7], [12, 11], [11, 16], [19, 19], [26, 17], [27, 20], [21, 22], [13, 19]], 'side', 1);
      fill([[8, 18], [8, 10], [11, 5], [13, 5], [12, 9], [10, 13], [12, 18], [18, 20], [17, 21], [11, 19]], 'cut', 1);
      fill([[14, 6], [21, 6], [24, 7], [22, 9], [17, 8], [13, 10]], 'inside', 2);
      fill([[20, 20], [26, 18], [28, 18], [26, 21], [22, 23]], 'cut', 3);
      break;
    }
    case 'gel-fragments': {
      // Thick peeled flow fragments: a flattened tail joins a heavy lobed lip.
      // Independent cut planes make the material visible without an emissive edge.
      plate([[3, 18], [6, 15], [12, 14], [15, 9], [20, 7], [25, 9], [27, 13], [25, 19], [20, 22], [13, 20], [8, 21]], 2, 0);
      fill([[12, 15], [16, 10], [20, 8], [24, 10], [24, 14], [20, 17], [16, 17]], 'cut', 1);
      fill([[15, 14], [18, 11], [22, 10], [23, 12], [20, 13], [17, 16]], 'inside', 1);
      fill([[14, 18], [20, 19], [24, 17], [25, 19], [20, 22], [15, 21]], 'side', 2);
      fill([[7, 17], [11, 16], [15, 18], [12, 19], [8, 19]], 'top', 3);
      plate([[27, 20], [30, 17], [31, 20], [29, 23], [26, 22]], 1, 4);
      break;
    }
    case 'compressed-fibre-fragments': {
      // Unequal compressed tufts, with torn short ends. The continuous quiet
      // planes and their exposed thickness carry the form, not a rope bundle.
      plate([[3, 14], [7, 11], [13, 10], [18, 11], [23, 10], [28, 13], [26, 15], [28, 16], [23, 17], [20, 19], [14, 18], [9, 19], [5, 17], [2, 17]], 2, 0);
      fill([[5, 16], [9, 16], [13, 15], [17, 16], [16, 18], [13, 17], [11, 19], [8, 18]], 'cut', 0);
      fill([[19, 16], [23, 15], [25, 16], [23, 17], [21, 19], [19, 18]], 'top', 1);
      plate([[24, 20], [27, 18], [30, 20], [29, 22], [25, 23], [22, 21]], 1, 2);
      plate([[3, 21], [6, 20], [9, 21], [7, 23], [3, 22]], 1, 3);
      break;
    }
    case 'porous-core-chips': {
      // A broken pith chip has a dense outer skin and a thick porous cut. Each
      // small cavity has an opaque inner floor; no alpha hole implies a passage.
      plate([[7, 8], [12, 5], [20, 6], [25, 11], [23, 16], [17, 19], [10, 17], [6, 13]], 4, 0);
      fill([[6, 13], [10, 15], [17, 16], [23, 13], [23, 18], [18, 22], [11, 20], [7, 18]], 'cut', 0);
      fill([[9, 15], [12, 15], [15, 17], [14, 19], [11, 19], [9, 17]], 'inside', 0);
      fill([[11, 18], [14, 18], [13, 19], [11, 19]], 'side', 0);
      fill([[17, 16], [19, 16], [19, 18], [17, 18]], 'inside', 1);
      fill([[17, 20], [19, 19], [20, 20], [18, 21]], 'inside', 1);
      fill([[21, 15], [23, 14], [23, 16], [21, 17]], 'inside', 2);
      plate([[24, 18], [27, 16], [31, 19], [29, 22], [25, 22], [23, 20]], 2, 3);
      fill([[25, 19], [27, 18], [28, 20], [26, 21]], 'inside', 3);
      plate([[3, 19], [5, 18], [8, 21], [6, 23], [3, 22]], 1, 4);
      break;
    }
    default: throw new Error(`Search remains: unsupported source grammar ${String(grammar)}`);
  }
  return { width: WIDTH, height: HEIGHT, pixels, grammar, sourceId: painting?.source ?? profile.id };
}
