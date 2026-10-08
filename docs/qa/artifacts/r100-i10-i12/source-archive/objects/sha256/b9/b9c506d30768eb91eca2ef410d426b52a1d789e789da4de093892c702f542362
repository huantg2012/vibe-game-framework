/** A single dry mineral remnant used to read the sea's height.
 * Coordinates are projected from a small three-dimensional drawing. The renderer owns
 * placement, depth, fog and the water that hides the upper part of this shape.
 */
export interface DatumReefImage {
  canvas: HTMLCanvasElement;
  /** Pixel offsets of the ground anchor inside canvas; use an image origin of (0, 0). */
  originX: number;
  originY: number;
  footX: number;
  footY: number;
}

export interface DatumReefPlacement { x: number; y: number; height: number }

type Point3 = readonly [x: number, y: number, z: number];
type Point2 = readonly [x: number, y: number];
type Colour = readonly [r: number, g: number, b: number];
interface Face { points: readonly Point3[]; colour: Colour; wear: number }

const CHARCOAL: Colour = [30, 39, 42];
const SHADE: Colour = [46, 57, 58];
const ROCK: Colour = [73, 84, 81];
const PALE: Colour = [103, 111, 99];
const SHELL: Colour = [135, 137, 119];

// A leaning, eroded blade, with a shorter fractured spur. There is no capital,
// regular stack of horizontal courses, or flat top that could appear to support water.
const FACES: readonly Face[] = [
  { colour: SHADE, wear: 2, points: [
    [-22, -10, 0], [20, -10, 0], [26, -8, 30], [17, -9, 57],
    [26, -10, 83], [49, -9, 131], [43, -10, 129], [27, -10, 111],
    [9, -11, 102], [-5, -12, 129], [-5, -10, 160], [-19, -10, 197],
    [-34, -7, 230], [-38, -7, 217], [-30, -8, 194], [-33, -9, 176],
    [-18, -9, 143], [-27, -10, 121], [-24, -9, 91], [-34, -10, 64],
  ] },
  { colour: ROCK, wear: 3, points: [
    [-24, 6, 0], [20, 8, 0], [28, 5, 17], [15, 5, 45],
    [20, 3, 78], [9, 2, 99], [10, 0, 122], [-4, -1, 149],
    [-9, -1, 172], [-15, -2, 194], [-34, -7, 230], [-30, 1, 205],
    [-32, 0, 184], [-22, 2, 165], [-19, 2, 149], [-14, 3, 137],
    [-25, 3, 116], [-20, 4, 96], [-31, 4, 74], [-27, 5, 58],
    [-34, 5, 37], [-30, 6, 17],
  ] },
  // The long dark side is continuous; small chips cannot replace this large value plane.
  { colour: SHADE, wear: 2, points: [
    [-34, -7, 230], [-15, -2, 194], [-9, -1, 172], [-4, -1, 149],
    [10, 0, 122], [9, 2, 99], [20, 3, 78], [15, 5, 45],
    [28, 5, 17], [20, 8, 0], [11, 8, 3], [11, 6, 42],
    [5, 4, 77], [-1, 3, 100], [0, 2, 121], [-13, 1, 150],
    [-17, 0, 178], [-23, -1, 198],
  ] },
  // Eroded shell layer along one turning ridge, never a complete bright outline.
  { colour: PALE, wear: 5, points: [
    [-34, -7, 230], [-29, -3, 207], [-24, 0, 199], [-18, 1, 176],
    [-15, 2, 153], [-7, 3, 138], [-4, 4, 120], [-13, 4, 95],
    [-11, 5, 77], [-16, 6, 55], [-16, 7, 18], [-22, 7, 9],
    [-23, 5, 55], [-17, 4, 78], [-19, 4, 99], [-10, 3, 120],
    [-14, 2, 136], [-22, 1, 156], [-25, 0, 185], [-31, -1, 201],
  ] },
  { colour: ROCK, wear: 4, points: [
    [7, 3, 73], [16, 2, 75], [49, -9, 131], [42, -4, 129],
    [33, -1, 107], [23, 1, 101], [20, 2, 90],
  ] },
  { colour: PALE, wear: 4, points: [
    [42, -4, 129], [37, -2, 113], [29, 0, 107], [22, 2, 91],
    [17, 3, 85], [24, 2, 103], [33, -1, 111],
  ] },
  // Two fractures are oblique cuts in the volume, not evenly spaced masonry seams.
  { colour: CHARCOAL, wear: 0, points: [
    [-29, 3, 70], [-21, 4, 77], [-6, 4, 91], [10, 3, 99],
    [3, 4, 92], [-10, 5, 83], [-18, 5, 73],
  ] },
  { colour: SHADE, wear: 0, points: [
    [-30, 1, 184], [-21, 2, 180], [-11, 1, 166], [-19, 2, 171],
    [-24, 2, 176],
  ] },
  { colour: SHELL, wear: 5, points: [
    [-25, 4, 74], [-17, 5, 80], [-12, 5, 85], [-18, 5, 79],
    [-27, 4, 71],
  ] },
];

function inside(x: number, y: number, points: readonly Point2[]): boolean {
  let found = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) found = !found;
  }
  return found;
}

function hash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 14879;
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return ((n ^ n >>> 16) >>> 0) / 4294967295;
}

export function makeDatumReef(heightProjection: number, compression: number, placement: DatumReefPlacement): DatumReefImage {
  if (!Number.isFinite(heightProjection) || heightProjection < 0 || !Number.isFinite(compression) || compression <= 0 ||
      !Number.isFinite(placement.x) || !Number.isFinite(placement.y) || !Number.isFinite(placement.height) || placement.height <= 0) {
    throw new Error('Datum reef requires finite placement, nonnegative projection, and positive compression and height.');
  }
  const projectedHeight = placement.height * heightProjection;
  const modelProjection = projectedHeight / 230;
  const originX = 56, originY = Math.ceil(projectedHeight + 18);
  const canvas = document.createElement('canvas');
  canvas.width = 118; canvas.height = originY + 22;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to allocate datum reef canvas.');
  ctx.imageSmoothingEnabled = false;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const faces = FACES.map(face => ({ ...face, points: face.points.map(([x, y, z]) =>
    [originX + x, originY + y - z * modelProjection] as Point2) }));
  // Samples are two display-world pixels high after camera compression. Direct opaque
  // raster writes keep the silhouette stepped; no antialias halo or gradient material.
  const stepY = Math.max(1, Math.round(2 / compression));
  for (let y = 0; y < canvas.height; y += stepY) for (let x = 0; x < canvas.width; x += 2) {
    let selected: typeof faces[number] | undefined;
    for (const face of faces) if (inside(x + 1, y + stepY / 2, face.points)) selected = face;
    if (!selected) continue;
    const seed = hash(x >> 1, Math.floor(y / stepY));
    // Sparse, connected mineral scars follow a tilted grain instead of a salt-noise coat.
    const textureScale = Math.max(.25, modelProjection);
    const grain = Math.sin(x * .20 + y * .024 / textureScale + Math.sin(y * .018 / textureScale) * 2.3);
    let offset = 0;
    if (selected.wear && grain > .89 && seed > .48) offset = selected.wear * 3;
    else if (selected.wear && grain < -.90 && seed > .30) offset = -selected.wear * 3;
    else if (seed > .96) offset = selected.wear;
    for (let py = y; py < Math.min(y + stepY, canvas.height); py++) for (let px = x; px < Math.min(x + 2, canvas.width); px++) {
      const at = (py * canvas.width + px) * 4;
      image.data[at] = selected.colour[0] + offset;
      image.data[at + 1] = selected.colour[1] + offset;
      image.data[at + 2] = selected.colour[2] + offset;
      image.data[at + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, originX, originY, footX: placement.x, footY: placement.y };
}
