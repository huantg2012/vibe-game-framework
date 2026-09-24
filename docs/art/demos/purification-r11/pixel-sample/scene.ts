import { buildArchitectureLayers, buildIntrusionLayer } from './architecture';
import { buildDeviceLayers } from './devices';
import { MATERIALS, PixelLayer } from './raster';
import { LIGHT_RGB, LIGHT_STEPS } from './palette';
import { blend, buildAirFields, buildLightFields, clamp, gauss, type LightFields } from './lighting';
import { paintSamplePlayer } from './player';

export type SampleState = 'ambient' | 'core' | 'intrusion';
export interface RenderOptions { atmosphere?: boolean; player?: boolean; }
export const SAMPLE_CROP = { x: 158, y: 202, width: 442, height: 290 } as const;
export const WIDTH = 960;
export const HEIGHT = 640;
const SIZE = WIDTH * HEIGHT;

let cached: { layers: PixelLayer[]; fields: LightFields } | undefined;
export function buildSample(): { layers: PixelLayer[]; fields: LightFields } {
  if (!cached) {
    const architecture = buildArchitectureLayers();
    const contact = architecture.find(layer => layer.name === 'contact-shadows')!;
    const foreground = architecture.splice(5);
    cached = {
      layers: [...architecture, ...buildDeviceLayers(), ...foreground, buildIntrusionLayer()],
      fields: buildLightFields(contact),
    };
  }
  return cached;
}

function surfaceColor(layer: PixelLayer, i: number, x: number, y: number, state: SampleState): readonly number[] {
  const material = MATERIALS[layer.mat[i]! - 1]!;
  const name = layer.name;
  let tone = layer.tone[i]!;
  const { fields } = buildSample();
  const floor = layer.normalZ[i]! / 127 > 0.7;
  const response = layer.light[i]! / 255;
  if (layer.emission[i]) {
    tone = state === 'ambient' ? Math.min(2.8, tone) : Math.max(5.8, tone);
  } else if (material !== 'void' && name !== 'intrusion') {
    // Broad value design: dark enclosing structure, a readable working plane, sparse bright metal.
    const ambient = name === 'rear-masonry' ? -0.90 - 0.55 * clamp((292 - y) / 100)
      : name === 'right-wall-and-front-edge' ? -1.25
      : name === 'opening-midground' ? -0.8
      : name === 'approach-mouth' ? -1.05
      : name === 'offering' ? -0.85
      : floor ? -1.05 : -0.55;
    tone += ambient;
    // Cool indirect opening light reaches the upper ramp and wall return, with distance falloff.
    const opening = gauss(x, y, 490, 276, 74, 110);
    tone += opening * (floor ? 0.36 : 0.22) * response;
    if (name === 'rear-masonry') tone -= fields.wall[i]! * (state === 'ambient' ? 0.35 : 0.72);
    if (name === 'floor-and-upper-platform' || name === 'approach-mouth') {
      tone -= fields.contact[i]! * 1.20;
      if (floor && y > 355) tone -= fields.cast[i]! * (state === 'ambient' ? 0.22 : 0.85);
      // Architectural contact strips sit at actual floor/wall joints, not around every polygon.
      if (floor && x > 295 && x < 400) {
        const wallFoot = 364 + (x - 297) * 0.15;
        tone -= gauss(x, y, x, wallFoot, 1, 4) * 0.48;
      }
    }
    if (state !== 'ambient' && response) {
      const dx = (243 - x) / 120;
      const dy = ((floor ? 384 : 325) - y) / (floor ? 71 : 130);
      const distance = dx * dx + dy * dy;
      const falloff = 1 / Math.pow(1 + distance * 1.7, 1.5);
      const nx = layer.normalX[i]! / 127;
      const ny = layer.normalY[i]! / 127;
      const nz = layer.normalZ[i]! / 127;
      const incidence = floor ? 1 : 0.28 + 0.72 * Math.max(0, (nx * dx + ny * 0.65 + nz * 0.85) / Math.sqrt(dx * dx + 1.15));
      let visible = 1;
      if (floor && y > 355) visible *= 1 - fields.cast[i]! * 0.65;
      if (name === 'rear-masonry') visible *= 1 - fields.wall[i]! * 0.48;
      tone += falloff * incidence * response * visible * (floor ? 3.65 : 2.5);
      // The glass chamber illuminates the inner metal, not the outside of both tall shoulders.
      if (name === 'core') tone += gauss(x, y, 243, 325, 22, 48) * response * 0.9;
    }
  }
  return LIGHT_RGB[material][Math.round(clamp(tone, 0, 7) * LIGHT_STEPS)]!;
}

/** The paint remains sharp. Only its illumination traverses the material's bounded color ramp. */
export function renderLayer(layer: PixelLayer, state: SampleState): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * 4);
  if (layer.name === 'intrusion' && state !== 'intrusion') return pixels;
  const { x: left, y: top, width, height } = SAMPLE_CROP;
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
    const i = y * WIDTH + x;
    if (!layer.mat[i]) continue;
    const rgb = surfaceColor(layer, i, x, y, state);
    pixels.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], i * 4);
  }
  return pixels;
}

// A few suspended motes chosen for the light volume, never a full-screen particle/noise overlay.
const MOTES = [[352,440,.40],[402,422,.16],[378,594,.30],[451,562,.25],[340,513,.30],
  [309,489,.20],[437,465,.28],[479,527,.16],[731,372,.15],[780,395,.20],[794,414,.12]] as const;
const WARM_AIR = [231, 205, 151] as const;
const COOL_AIR = [64, 91, 98] as const;

export function renderSample(state: SampleState, options: RenderOptions = {}): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * 4);
  const owners = new Uint8Array(SIZE);
  const emission = new Float32Array(SIZE);
  const { layers } = buildSample();
  const { x: left, y: top, width, height } = SAMPLE_CROP;
  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index]!;
    // Contact paint is a receiver mask for the light pass, never an opaque black floor decal.
    if (layer.name === 'contact-shadows' || (layer.name === 'intrusion' && state !== 'intrusion')) continue;
    for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
      const i = y * WIDTH + x;
      if (!layer.mat[i]) continue;
      const rgb = surfaceColor(layer, i, x, y, state);
      pixels.set([rgb[0]!, rgb[1]!, rgb[2]!, 255], i * 4);
      owners[i] = index + 1;
      emission[i] = state !== 'ambient' && layer.emission[i] ? 1 : 0;
    }
  }
  if (options.player) paintSamplePlayer(pixels, owners, state);
  if (options.atmosphere === false) return pixels;
  const air = buildAirFields(emission);
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
    const i = y * WIDTH + x, p = i * 4;
    if (!pixels[p + 3]) continue;
    const name = owners[i] === 255 ? 'player' : layers[owners[i]! - 1]?.name;
    const distance = name === 'opening-midground' ? 1 : name === 'rear-masonry' ? 0.26 : name === 'offering' ? .12 : 0;
    // The opening has air between separate masses; the near wall remains opaque and crisp.
    const cool = distance * gauss(x, y, 478, 260, 66, 99) * 0.48;
    blend(pixels, p, COOL_AIR, cool);
    if (state !== 'ambient') {
      const plume = gauss(x, y, 242 + Math.sin(y / 39) * 9, 291, 43, 76);
      const chamber = Math.max(gauss(x, y, 243, 327, 42, 45), plume * 0.75);
      const airDepth = name === 'rear-masonry' ? 1 : name === 'core' ? 0.16
        : name === 'floor-and-upper-platform' ? 0.32 : name === 'player' ? 0.12 : 0;
      blend(pixels, p, WARM_AIR, chamber * airDepth * 0.26);
      // Bloom comes from visible emission only. It does not blur geometry or turn all edges bright.
      const foreground = name === 'right-wall-and-front-edge' || name === 'approach-mouth';
      if (!foreground) {
        const bloom = clamp(air.nearBloom[i]! * 3.0 + air.farBloom[i]! * 5.0, 0, .73);
        blend(pixels, p, [254, 239, 193], bloom);
      }
      if (state === 'intrusion') {
        const cold = gauss(x, y, 547, 325, 17, 69);
        if (name === 'intrusion' || name === 'right-wall-and-front-edge') blend(pixels, p, [71, 129, 131], cold * 0.07);
      }
    }
  }
  if (state !== 'ambient') for (const [cx, cy, alpha] of MOTES) {
    const x = Math.round(cx * .625), y = Math.round(cy * .625), i = y * WIDTH + x;
    const name = layers[owners[i]! - 1]?.name;
    if (name === 'rear-masonry' || name === 'opening-midground') blend(pixels, i * 4, WARM_AIR, alpha);
  }
  return pixels;
}
