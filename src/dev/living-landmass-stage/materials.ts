import * as THREE from 'three';

export type StudyMaterialKind = 'skin' | 'belly' | 'bearer' | 'distant';
const SWATCHES = {
  skin: [0x3d4244, 0x474d4e, 0x505553, 0x5a5c56, 0x67655c, 0x7a7365],
  belly: [0x383236, 0x433b3e, 0x4e4547, 0x5b4f4f, 0x695b57, 0x746762],
  bearer: [0x434347, 0x4c4b4e, 0x585458, 0x625c5d, 0x736764, 0x7f736e],
  distant: [0x4a565d, 0x515d63, 0x57636a, 0x5e6970, 0x67737a, 0x6e7a80],
} as const satisfies Record<StudyMaterialKind, readonly number[]>;

const TEXTURE_SIZE = 256;
type PixelPoint = readonly [number, number];

interface Lamina {
  readonly tone: number;
  readonly points: readonly PixelPoint[];
}

// Angular overlapping growth planes, with long axes following the loft. These
// are not circular patches or a regularly spaced set of painted ribs.
const LAMINAE: readonly Lamina[] = [
  { tone: 1, points: [[0, 0], [28, 0], [35, 25], [31, 31], [39, 58], [35, 77],
    [42, 89], [38, 115], [27, 126], [25, 154], [12, 161], [0, 149]] },
  { tone: 3, points: [[97, 0], [151, 0], [149, 19], [138, 25], [140, 49], [129, 58],
    [126, 88], [117, 102], [115, 76], [104, 59], [107, 39], [99, 29]] },
  { tone: 1, points: [[221, 29], [256, 19], [256, 149], [242, 157], [238, 129],
    [229, 118], [234, 97], [221, 78], [225, 55]] },
  { tone: 3, points: [[24, 182], [40, 173], [48, 195], [44, 208], [53, 225],
    [50, 243], [42, 256], [17, 256], [25, 238], [19, 216], [28, 206]] },
  { tone: 3, points: [[195, 187], [217, 174], [211, 200], [216, 215], [203, 225],
    [208, 239], [196, 256], [180, 256], [188, 236], [184, 219], [195, 208]] },
];

interface BrokenFold {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly lean: number;
}

// Deliberate groups at shoulders, fold turns and outer margins. The middle
// lower back, where the player starts, stays substantially quieter.
const BROKEN_FOLDS: readonly BrokenFold[] = [
  { x: 29, y: 21, length: 13, lean: 3 }, { x: 42, y: 47, length: 20, lean: -2 },
  { x: 63, y: 26, length: 11, lean: 2 }, { x: 79, y: 57, length: 16, lean: 4 },
  { x: 103, y: 21, length: 20, lean: -2 }, { x: 123, y: 68, length: 15, lean: 2 },
  { x: 151, y: 32, length: 17, lean: -3 }, { x: 168, y: 77, length: 12, lean: 2 },
  { x: 196, y: 44, length: 21, lean: -4 }, { x: 219, y: 84, length: 14, lean: -2 },
  { x: 17, y: 96, length: 18, lean: 3 }, { x: 34, y: 126, length: 12, lean: 2 },
  { x: 12, y: 171, length: 15, lean: 3 }, { x: 32, y: 211, length: 19, lean: -2 },
  { x: 58, y: 236, length: 13, lean: 2 }, { x: 85, y: 225, length: 11, lean: 2 },
  { x: 133, y: 242, length: 10, lean: -3 }, { x: 175, y: 226, length: 15, lean: 3 },
  { x: 198, y: 206, length: 18, lean: -4 }, { x: 223, y: 182, length: 13, lean: -2 },
  { x: 240, y: 142, length: 18, lean: -3 }, { x: 247, y: 215, length: 20, lean: -4 },
];

function paintPolygon(field: Uint8Array, points: readonly PixelPoint[], tone: number): void {
  const intersections: number[] = [];
  const firstRow = Math.max(0, Math.floor(Math.min(...points.map(point => point[1]))));
  const lastRow = Math.min(TEXTURE_SIZE - 1, Math.ceil(Math.max(...points.map(point => point[1]))));
  for (let row = firstRow; row <= lastRow; row++) {
    intersections.length = 0;
    const y = row + .5;
    for (let index = 0; index < points.length; index++) {
      const a = points[index]!, b = points[(index + 1) % points.length]!;
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        intersections.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const firstCol = Math.max(0, Math.ceil(intersections[index]! - .5));
      const lastCol = Math.min(TEXTURE_SIZE, Math.ceil(intersections[index + 1]! - .5));
      field.fill(tone, row * TEXTURE_SIZE + firstCol, row * TEXTURE_SIZE + lastCol);
    }
  }
}

function paintBrokenFold(field: Uint8Array, fold: BrokenFold, raised: number): void {
  const { x, y, length: length, lean } = fold;
  const knee = Math.round(length * .42), turn = Math.round(lean * .55);
  // A short crease, its exposed edge and one torn end are separate pixel
  // clusters. Never stroke continuously from one end of the body to the other.
  paintPolygon(field, [[x, y], [x + 2, y + 2], [x + turn + 2, y + knee],
    [x + turn, y + knee + 2], [x + lean + 1, y + length],
    [x + lean - 1, y + length - 2], [x + turn - 1, y + knee], [x - 1, y + 3]], 0);
  paintPolygon(field, [[x + 3, y + 3], [x + 5, y + 5], [x + turn + 4, y + knee - 1],
    [x + turn + 2, y + knee + 1]], raised);
  paintPolygon(field, [[x + turn + 4, y + knee + 4], [x + turn + 6, y + knee + 3],
    [x + lean + 4, y + length - 1], [x + lean + 2, y + length + 2]], 3);
  paintPolygon(field, [[x - 3, y + 1], [x - 1, y], [x, y + 2], [x - 2, y + 4]], raised);
}

function drawMaterialField(kind: StudyMaterialKind): Uint8Array {
  const field = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE).fill(2);
  for (let index = 0; index < LAMINAE.length; index++) {
    if (kind === 'distant' && index !== 0 && index !== 2) continue;
    const layer = LAMINAE[index]!;
    paintPolygon(field, layer.points, layer.tone);
  }
  if (kind === 'distant') return field;
  for (let index = 0; index < BROKEN_FOLDS.length; index++) {
    const fold = BROKEN_FOLDS[index]!;
    paintBrokenFold(field, fold, index % 5 === 0 ? 5 : 4);
    if (kind !== 'skin' && index % 3 === 0) {
      paintBrokenFold(field, { x: fold.x + 7, y: fold.y + 9, length: Math.round(fold.length * .6),
        lean: -fold.lean }, 3);
    }
  }
  return field;
}

const LIGHT_FLOOR: Record<StudyMaterialKind, number> = {
  skin: .42, belly: .64, bearer: .58, distant: .48,
};

const BANDED_LIGHTING = `
  const vec3 studyLuminanceWeights = vec3(0.2126, 0.7152, 0.0722);
  float studyBaseLuminance = max(dot(diffuseColor.rgb, studyLuminanceWeights), 0.00001);
  float studyLitLuminance = dot(max(outgoingLight, vec3(0.0)), studyLuminanceWeights);
  float studyIllumination = studyLitLuminance / studyBaseLuminance;
  float studyBand = max(studyLightFloor, floor(studyIllumination * 5.0 + 0.5) / 5.0);
  if (studyLitLuminance > 0.00001) {
    outgoingLight *= (studyBaseLuminance * studyBand) / studyLitLuminance;
  } else {
    outgoingLight = diffuseColor.rgb * studyBand;
  }
  #include <opaque_fragment>
`;

/** Build a local material map. Geometric folds and contact areas remain the
 * model's responsibility; this map adds restrained dry laminae and worn edges. */
export function createStudyMaterial(kind: StudyMaterialKind): THREE.MeshStandardMaterial {
  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4), palette = SWATCHES[kind];
  const field = drawMaterialField(kind);
  for (let index = 0; index < field.length; index++) {
    const colour = palette[field[index]!]!;
    const at = index * 4;
    // These are authored sRGB bytes. The texture is decoded once by Three; do
    // not round-trip through linear colour or bake illumination into the map.
    pixels[at] = (colour >>> 16) & 255;
    pixels[at + 1] = (colour >>> 8) & 255;
    pixels[at + 2] = colour & 255;
    pixels[at + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, TEXTURE_SIZE, TEXTURE_SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  // Body lofts may continue past v=1. Mirror the finite drawing instead of
  // stretching its last row along the entire end of a body.
  if (kind === 'bearer' || kind === 'distant') texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.name = `study-${kind}-lamina-map`;
  const material = new THREE.MeshStandardMaterial({
    map: texture, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  });
  material.name = `study-${kind}-pixel-material`;
  // Quantize one illumination scalar, preserving the outgoing RGB ratio.
  // The material-relative floor keeps the belly/contact readable without
  // independently rounding channels or adding a second emissive render layer.
  material.onBeforeCompile = shader => {
    shader.uniforms.studyLightFloor = { value: LIGHT_FLOOR[kind] };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float studyLightFloor;')
      .replace('#include <opaque_fragment>', BANDED_LIGHTING);
  };
  material.customProgramCacheKey = () => 'living-stage-scalar-light-bands-v2';
  return material;
}
