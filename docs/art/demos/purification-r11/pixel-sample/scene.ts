import { buildArchitectureLayers, buildIntrusionLayer } from './architecture';
import { buildDeviceLayers } from './devices';
import { MATERIALS, PixelLayer } from './raster';
import { LIGHT_RGB, LIGHT_STEPS, POLLUTION_RGB, POLLUTION_STEPS } from './palette';
import { blend, buildAirFields, buildLightFields, clamp, gauss, type LightFields } from './lighting';
import { paintSamplePlayer } from './player';

export type SampleState = 'ambient' | 'core' | 'intrusion';
export interface RenderOptions { atmosphere?: boolean; player?: boolean; }
export const SAMPLE_CROP = { x: 158, y: 202, width: 442, height: 290 } as const;
export const WIDTH = 960;
export const HEIGHT = 640;
const SIZE = WIDTH * HEIGHT;

let cached: { layers: PixelLayer[]; fields: LightFields } | undefined;

/** One overhead opening, interrupted by its lintel. Its footprint continues
 * from the back wall onto the working floor rather than spotlighting each prop. */
function openingLight(x: number, y: number, floor: boolean): number {
  const cross = x - (y - (floor ? 340 : 230)) * (floor ? .74 : .14);
  const enter = clamp((cross - 159) / 12);
  const leave = clamp((280 - cross) / 20);
  const lintel = 1 - .58 * Math.exp(-.5 * ((cross - 211) / 6) ** 2);
  return enter * leave * lintel;
}
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

/** Surface construction precedes this lighting pass. Every material can carry a
 * continuous authored normal, finish and cavity value; decorative paint is not relief.
 */
function surfaceColor(layer: PixelLayer, i: number, x: number, y: number, state: SampleState): readonly number[] {
  const material = MATERIALS[layer.mat[i]! - 1]!;
  const name = layer.name;
  let tone = layer.tone[i]!;
  let pollution = 0;
  if (material === 'void') return LIGHT_RGB.void[Math.round(clamp(tone, 0, 7) * LIGHT_STEPS)]!;
  if (material === 'alien') {
    if (layer.emission[i]) tone = state === 'ambient' ? Math.min(tone, 4.5) : tone;
    else if (state !== 'ambient' && tone >= 2) tone += .22;
    return LIGHT_RGB.alien[Math.round(clamp(tone, 0, 7) * LIGHT_STEPS)]!;
  }
  if (layer.emission[i]) return LIGHT_RGB[material][Math.round(clamp(tone, 0, 7) * LIGHT_STEPS)]!;

  const { fields } = buildSample();
  const nx0 = layer.normalX[i]! / 127, ny0 = layer.normalY[i]! / 127, nz0 = layer.normalZ[i]! / 127;
  const length = Math.hypot(nx0, ny0, nz0) || 1;
  const nx = nx0 / length, ny = ny0 / length, nz = nz0 / length;
  const floor = nz > .72;
  const response = layer.light[i]! / 255;
  const ao = layer.occlusion[i]! / 255;
  const roughness = layer.roughness[i]! / 255;
  const specular = layer.specular[i]! / 255;

  // Broken overhead light has a finite reach. The standing area receives the
  // main pool; deep wall bays and the camera-side wall retain their own values.
  // This is illumination of authored material, never a whole-frame vignette.
  const roomPool = gauss(x, y, 224, 294, 117, 96);
  const groundPool = gauss(x, y, 254, 383, 119, 51);
  const upperPool = gauss(x, y, 361, 331, 62, 26);
  const aperture = openingLight(x, y, floor);
  let ordinary = .18 + roomPool * .25 + aperture * .57;
  if (name === 'floor-and-upper-platform') ordinary = floor ? .16 + groundPool * .25 + aperture * .59 + upperPool * .19 : .22 + groundPool * .2;
  if (name === 'right-wall-and-front-edge') ordinary = .16 + roomPool * .3;
  if (name === 'approach-mouth') ordinary = .12 + groundPool * .18 + aperture * .25;
  if (name === 'opening-midground') ordinary = .14;

  // Broad ordinary light from the broken overhead opening; no beige room wash.
  // Local normals carry curved casting, beveled slab lips and exposed broken aggregate.
  const diffuse = Math.max(0, nx * -.46 + ny * .29 + nz * .838);
  const sideFill = Math.max(0, nx * .72 + ny * .56 + nz * .4);
  tone += ((diffuse - .46) * 1.85 + sideFill * .12) * response;
  tone -= (1 - ordinary) * 2.1;
  tone -= (1 - ao) * 2.8;
  if (name === 'rear-masonry') tone -= .32 + clamp((260 - y) / 80) * .3;
  if (name === 'opening-midground') tone -= .68;
  if (name === 'right-wall-and-front-edge') tone -= .38;
  if (name === 'approach-mouth') tone -= .28;

  // A shaped environment is reflected by the metal. A broad overhead strip,
  // dark chamber band and side aperture bend around each authored normal.
  // Roughness widens reflections; specular controls their contribution independently
  // from the broad diffuse paint. This is a 2D directed material renderer, not a scene PBR solver.
  if (specular > .08) {
    const ndv = Math.max(0, ny * .8 + nz * .6);
    const rx = 2 * ndv * nx;
    const rz = 2 * ndv * nz - .6;
    const width = .08 + roughness * .37;
    const window = Math.exp(-.5 * ((rx + .40) / width) ** 2) * (.42 + .58 * clamp((rz + 1) / 2));
    const sky = Math.pow(clamp((rz + .08) / 1.08), 1.3);
    const darkBand = Math.exp(-.5 * ((rz + .29) / (.15 + roughness * .24)) ** 2);
    const reflection = window * 2.75 + sky * 1.12 - darkBand * 1.6;
    tone += reflection * specular * (.65 + .35 * (1 - roughness)) * Math.sqrt(ao) * (.58 + ordinary * .42);
  }

  if (name === 'rear-masonry') tone -= fields.wall[i]! * .48;
  if (name === 'floor-and-upper-platform' || name === 'approach-mouth') {
    tone -= fields.contact[i]! * .88;
    if (floor && y > 355) tone -= fields.cast[i]! * (state === 'ambient' ? .24 : .55);
  }

  if (state !== 'ambient' && response) {
    const dx = (244 - x) / (floor ? 59 : 58);
    const dy = ((floor ? 378 : 316) - y) / (floor ? 36 : 74);
    const falloff = 1 / Math.pow(1 + (dx * dx + dy * dy) * 1.8, 1.5);
    const inward = floor ? 1 : .2 + .8 * Math.max(0, (nx * dx + ny * .64 + nz * .62) / Math.sqrt(dx * dx + .8));
    let visible = ao;
    if (floor && y > 355) visible *= 1 - fields.cast[i]! * .72;
    if (name === 'rear-masonry') visible *= 1 - fields.wall[i]! * .6;
    const received = falloff * inward * response * visible;
    tone += received * (floor ? 1.36 : 1.12);
    pollution = received * (name === 'core' ? .67 : floor ? .28 : .24);
  }

  const toneIndex = Math.round(clamp(tone, 0, 7) * LIGHT_STEPS);
  return pollution > 0
    ? POLLUTION_RGB[material][Math.round(clamp(pollution) * POLLUTION_STEPS)]![toneIndex]!
    : LIGHT_RGB[material][toneIndex]!;
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
const POLLUTED_AIR = [101, 137, 120] as const;
const COOL_AIR = [73, 80, 101] as const;

export function renderSample(state: SampleState, options: RenderOptions = {}): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(SIZE * 4);
  const owners = new Uint8Array(SIZE);
  const emission = new Float32Array(SIZE);
  const ordinaryEmission = new Float32Array(SIZE);
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
      const emitting = state !== 'ambient' && layer.emission[i] ? 1 : 0;
      emission[i] = emitting && layer.mat[i] === 9 ? 1 : 0;
      ordinaryEmission[i] = emitting && layer.mat[i] !== 9 ? 1 : 0;
    }
  }
  if (options.player) paintSamplePlayer(pixels, owners, state);
  if (options.atmosphere === false) return pixels;
  const air = buildAirFields(emission);
  const ordinaryAir = buildAirFields(ordinaryEmission);
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
    const i = y * WIDTH + x, p = i * 4;
    if (!pixels[p + 3]) continue;
    const name = owners[i] === 255 ? 'player' : layers[owners[i]! - 1]?.name;
    const distance = name === 'opening-midground' ? 1 : name === 'rear-masonry' ? 0.26 : name === 'offering' ? .12 : 0;
    // The opening has air between separate masses; the near wall remains opaque and crisp.
    const cool = distance * gauss(x, y, 478, 260, 66, 99) * 0.48;
    blend(pixels, p, COOL_AIR, cool);
    if (name === 'rear-masonry') {
      const shaft = openingLight(x, y, false) * gauss(x, y, 249, 282, 87, 83);
      blend(pixels, p, [121, 132, 148], shaft * .055);
    }
    if (state !== 'ambient') {
      const plume = gauss(x, y, 243 + Math.sin(y / 39) * 5, 303, 23, 49);
      const chamber = Math.max(gauss(x, y, 244, 320, 24, 36), plume * 0.65);
      const airDepth = name === 'rear-masonry' ? 1 : name === 'core' ? 0.12
        : name === 'floor-and-upper-platform' ? 0.16 : name === 'player' ? 0.05 : 0;
      blend(pixels, p, POLLUTED_AIR, chamber * airDepth * 0.13);
      // Bloom comes from visible emission only. It does not blur geometry or turn all edges bright.
      const foreground = name === 'right-wall-and-front-edge' || name === 'approach-mouth';
      if (!foreground) {
        const bloom = clamp(air.nearBloom[i]! * 1.5 + air.farBloom[i]! * 2.1, 0, .34);
        blend(pixels, p, [150, 180, 152], bloom);
        const neutralBloom = clamp(ordinaryAir.nearBloom[i]! * 1.4 + ordinaryAir.farBloom[i]! * 1.8, 0, .36);
        blend(pixels, p, [249, 231, 189], neutralBloom);
      }
      if (state === 'intrusion') {
        const cold = gauss(x, y, 547, 325, 17, 69);
        if (name === 'intrusion' || name === 'right-wall-and-front-edge') blend(pixels, p, [83, 136, 112], cold * 0.07);
      }
    }
  }
  if (state !== 'ambient') for (const [cx, cy, alpha] of MOTES) {
    const x = Math.round(cx * .625), y = Math.round(cy * .625), i = y * WIDTH + x;
    const name = layers[owners[i]! - 1]?.name;
    if (name === 'rear-masonry' || name === 'opening-midground') blend(pixels, i * 4, [160, 178, 174], alpha * .45);
  }
  return pixels;
}
