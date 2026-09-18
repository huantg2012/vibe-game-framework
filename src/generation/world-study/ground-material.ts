/** Composes material operators and surface histories; never branches on world ID. */
import { Raster } from './raster';
import { worldSupportAt } from './support';
import { materialHash as hash, materialNoise as noise, materialMix as mix, materialCell as cellField } from './material-noise';
import { sampleSurfaceField, buildSurfaceFields, type SurfaceField } from './surface-field';
import { beginMaterialResponse, trackMaterialOverpaint } from './material-response';
import type { WorldMaterial, WorldSample } from './types';

interface MaterialStroke { value: number; edge: number; reflection: number; normal: number }

/** Material is an operator: the same brush can be substrate or a second skin. */
function materialStroke(kind: WorldMaterial, x: number, y: number, seed: number, scale: number, field: SurfaceField): MaterialStroke {
  const warp = noise(x / (140 * scale), y / (128 * scale), seed ^ 0x9251) - .5;
  const macro = noise(x / (233 * scale), y / (197 * scale), seed ^ 0x1851);
  const meso = noise(x / (35 * scale), y / (29 * scale), seed ^ 0x7691);
  const grain = hash(x >> 1, y >> 1, seed ^ 0x2219) - .5;
  const u = x * Math.cos(field.direction) + y * Math.sin(field.direction);
  const v = -x * Math.sin(field.direction) + y * Math.cos(field.direction);
  let value = .53 + (macro - .5) * .42 + (meso - .5) * .24;
  let edge = 0, reflection = 0, normal = field.direction;
  if (kind === 'strata') {
    const bed = v + warp * 34;
    const bands = noise(u / (36 * scale), bed / (6 * scale), seed ^ 0x8271);
    const layers = cellField(u + warp * 19, v * 2.6, 46 * scale, seed ^ 0x83);
    value += (bands - .5) * .12 + grain * (.04 + field.wear * .07);
    value += (layers.identity - .5) * .14;
    if (layers.edge < 1.3 && bands < .66) edge = -.25;
    else if (layers.edge < 2.9 && layers.plane < -.05 && bands < .65) edge = .17;
    // Discontinuous worn laminations retain legibility in a small light pool.
    const lamina = (bed / (19 * scale) + noise(u / 111, v / 73, seed ^ 0x33) * .8) % 1;
    if (lamina > .02 && lamina < .11 && bands < .53) edge -= .14 * field.wear;
  } else if (kind === 'crystal') {
    const face = cellField(x + warp * 23, y - warp * 17, 39 * scale, seed ^ 0x631);
    value += (face.identity - .5) * .42 + Math.sign(face.plane) * .075 + grain * .035;
    if (face.edge < 1.45) edge = -.24;
    else if (face.edge < 3 && face.plane < .08) { edge = .27; reflection = .46; }
    normal = face.identity * Math.PI * 2;
  } else {
    const shell = cellField(x + warp * 24, y + warp * 19, 60 * scale, seed ^ 0x911);
    const thickness = noise(x / (61 * scale), y / (49 * scale), seed ^ 0x8123);
    value = .65 + (macro - .5) * .22 + (thickness - .5) * .24 + (meso - .5) * .10 + grain * .025;
    if (shell.edge < 1.0 && (field.wear > .22 || thickness < .39)) edge = -.30;
    else if (shell.edge < 2.5 && shell.plane < 0 && field.wear > .2) edge = .15;
    reflection = .08;
  }
  return { value, edge, reflection, normal };
}

export function paintGroundMaterial(raster: Raster, sample: WorldSample, floorMask?: Uint8Array): void {
  const { cols, rows, tileSize: tile, seed, profile } = sample;
  const p = profile.palette, spec = profile.surface, width = cols * tile, height = rows * tile;
  const floor = (x: number, y: number): boolean => {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
    return floorMask ? floorMask[iy * width + ix] === 1 : worldSupportAt(sample, ix, iy);
  };
  buildSurfaceFields(sample);
  const highlights = beginMaterialResponse(sample);
  const rampThrough = (dark: number, body: number, light: number) => Array.from({ length: 32 }, (_, i) =>
    i < 17 ? mix(dark, body, i / 16) : mix(body, light, (i - 16) / 15));
  const substrateRamp = rampThrough(p.floorDeep, p.floor, p.floorLight);
  const coatingRamp = rampThrough(p.materialDark, p.materialMid, mix(p.materialLight, p.faceLight, .15));
  raster.setClip(floor);
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    if (!floor(x, y) && !floor(x + 1, y + 1)) continue;
    const field = sampleSurfaceField(sample, x, y);
    const brokenEdge = (noise(x / 11, y / 13, seed ^ 0x439) - .5) * .052;
    const skin = field.coverage + brokenEdge;
    const coated = skin > .5;
    const kind = coated ? spec.coating : spec.substrate;
    const stroke = materialStroke(kind, x, y, seed ^ (coated ? 0x2789 : 0), spec.scale, field);
    const contrast = (.45 + spec.contrast * .85) * (1 - field.quiet * .62);
    let value = .52 + (stroke.value - .52) * contrast + stroke.edge * contrast;
    // Exposed lower bed and settled powder use different processes, not tint noise.
    if (!coated) value -= field.exposure * .12;
    const powder = field.deposit * noise(x / 29, y / 23, seed ^ 0x1553);
    if (powder > .23) value += (powder - .23) * .28;
    const ramp = coated ? coatingRamp : substrateRamp;
    let color = ramp[Math.max(0, Math.min(31, Math.round(value * 31)))]!;
    // Palette roles stay chromatic. Accent area is a spatial field, never a global wash.
    if (field.accent > .05) {
      const accent = mix(p.accentDim, p.accent, Math.max(0, value));
      color = mix(color, accent, field.accent * (.3 + field.deposit * .65));
    }
    // Directional, interrupted contact edges express a thin layer seated on land.
    if (skin > .47 && skin < .53 && field.quiet < .65) {
      const upper = sampleSurfaceField(sample, x - 3, y - 4).coverage;
      const lower = sampleSurfaceField(sample, x + 3, y + 4).coverage;
      if (coated && upper < .5) color = mix(color, p.faceLight, spec.relief * .62);
      if (!coated && lower > .5) color = mix(color, p.floorDeep, spec.relief * .74);
    }
    // Local abrasive marks remain sparse; smooth areas keep larger material shapes.
    const abrasion = hash(x >> 2, y >> 1, seed ^ 0x7761);
    if (!coated && field.quiet < .55 && field.wear > .40 && abrasion < (field.wear - .4) * .20) color = mix(color, p.floorDeep, .52 * contrast);
    raster.rect(x, y, 2, 2, color);
    if (stroke.reflection > 0 && hash(x >> 1, y >> 1, seed ^ 17331) > .77
      && floor(x, y) && floor(x + 1, y) && floor(x, y + 1) && floor(x + 1, y + 1)) {
      highlights.push({ x, y, normal: stroke.normal, color: p.peak, strength: stroke.reflection,
        width: 2, height: 2, sharpness: kind === 'crystal' ? 5 : 2 });
    }
  }

  trackMaterialOverpaint(sample, raster);
  // Surface debris may settle anywhere, including broad interior areas.
  for (let gy = 0; gy < height / 21; gy++) for (let gx = 0; gx < width / 21; gx++) {
    const x = (gx + hash(gx, gy, seed ^ 927)) * 21, y = (gy + hash(gx, gy, seed ^ 619)) * 21;
    if (!floor(x, y)) continue;
    const field = sampleSurfaceField(sample, x, y), pick = hash(gx, gy, seed ^ 7719);
    if (pick > Math.max(0, field.deposit - .10) * .85) continue;
    const size = hash(gx, gy, seed ^ 6113), kind = field.coverage > .47 ? spec.coating : spec.substrate;
    const angle = field.direction + (hash(gx, gy, seed ^ 8145) - .5) * .5;
    const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
    const length = 3 + size * 12, breadth = kind === 'strata' ? 1 + size * 2 : 2 + size * 4;
    const pt = (along: number, across: number): readonly [number, number] => [x + ux * along + vx * across, y + uy * along + vy * across];
    const a = pt(-length * .5, -breadth * .5), b = pt(length * .4, -breadth), c = pt(length, 0), d = pt(-length * .25, breadth);
    const color = mix(p.materialMid, p.floorLight, .18 + size * .35);
    raster.polygon([a, b, c, d], color);
    raster.line(a[0], a[1], b[0], b[1], mix(color, p.faceLight, .35 + spec.relief * .20));
    if (kind === 'crystal') raster.polygon([pt(0, 0), c, d], mix(color, p.accentDim, .45));
    if (kind === 'glaze' && size > .55) raster.line(x, y, d[0], d[1], p.materialDark);
    for (let chip = 0; chip < 2 + Math.floor(size * 4); chip++) {
      const r = hash(gx + chip, gy, seed ^ 4271), point = pt(-length - r * 16, (chip - 2) * 3);
      raster.rect(point[0], point[1], 1 + Math.floor(r * 3), 1 + Math.floor(r * 2), mix(p.floorLight, p.materialDark, .4 + r * .3));
    }
  }
  raster.setClip(null);
}
