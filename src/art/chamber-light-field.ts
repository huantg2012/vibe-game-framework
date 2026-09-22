import {
  CHAMBER_DEVICE_FOOTPRINTS,
  CHAMBER_SIZE,
  CHAMBER_WALK_POLYGONS,
  type ChamberDevice,
  type ChamberFloor,
  type ChamberPolygon,
} from '../systems/purification-chamber-layout';

export interface LightSpan {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly band: number;
}

/** Floor calls use the emitter's ground projection; face calls use its visible aperture. */
export interface FieldSource {
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
}

interface LightPainter {
  fillStyle(color: number, alpha: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}

const { width, height } = CHAMBER_SIZE;
const BANDS = 24;
const MAIN = 1;
const UPPER = 2;
const LEFT_STAIR = 4;
const RIGHT_STAIR = 8;
const STAIRS = LEFT_STAIR | RIGHT_STAIR;
const deviceIds = Object.keys(CHAMBER_DEVICE_FOOTPRINTS) as ChamberDevice[];

/** Fixed 640×400 receiver geometry, shared by static light and moving actor shadows.
 * Floor visibility is a projected 2D ray test, not a claim of 3D light transport.
 * Only compilation allocates spans; paint methods never create arrays or textures. */
export class ChamberLightField {
  private readonly routes = new Uint8Array(width * height);
  private readonly solids = new Uint8Array(width * height);

  constructor() {
    const routes = [
      CHAMBER_WALK_POLYGONS.main, CHAMBER_WALK_POLYGONS.upper,
      CHAMBER_WALK_POLYGONS['left-stair'], CHAMBER_WALK_POLYGONS['right-stair'],
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        for (let route = 0; route < routes.length; route++) {
          if (contains(routes[route]!, x + .5, y + .5)) this.routes[index]! |= 1 << route;
        }
        for (let device = 0; device < deviceIds.length; device++) {
          if (contains(CHAMBER_DEVICE_FOOTPRINTS[deviceIds[device]!], x + .5, y + .5)) {
            this.solids[index]! |= 1 << device;
          }
        }
      }
    }
  }

  /** Never receives on a base, even when that emitter's own base is ignored by rays.
   * A floor can illuminate its adjacent ramps but cannot continue onto the other floor. */
  compileFloor(source: FieldSource, floor: ChamberFloor, ignoreDevice?: ChamberDevice): readonly LightSpan[] {
    const allowed = (floor === 'main' ? MAIN : UPPER) | STAIRS;
    const ignored = ignoreDevice === undefined ? 0 : 1 << deviceIds.indexOf(ignoreDevice);
    if (!validSource(source) || !this.passable(Math.floor(source.x), Math.floor(source.y), allowed, ignored)) return [];
    return this.compile(source, (x, y) => {
      const index = y * width + x;
      if (!(this.routes[index]! & allowed) || this.solids[index]) return 0;
      const band = radialBand(source, x + .5, y + .5);
      return band > 0 && this.visible(source.x, source.y, x + .5, y + .5, allowed, ignored) ? band : 0;
    });
  }

  /** The named faces narrow the receiver; real texture alpha and material colors then
   * preserve holes, seams and emissive apertures. Pixels are full-room RGBA coordinates. */
  compileFace(source: FieldSource, pixels: Uint8ClampedArray, regions: readonly ChamberPolygon[],
    options?: { excludeEmission?: boolean }): readonly LightSpan[] {
    if (pixels.length !== width * height * 4) throw new RangeError('Chamber face pixels must be 640×400 RGBA');
    if (!validSource(source)) return [];
    return this.compile(source, (x, y) => {
      const index = (y * width + x) * 4;
      if (!pixels[index + 3] || !regions.some(region => contains(region, x + .5, y + .5))) return 0;
      const red = pixels[index]!; const green = pixels[index + 1]!; const blue = pixels[index + 2]!;
      const luminance = .2126 * red + .7152 * green + .0722 * blue;
      if (luminance <= 20 || (options?.excludeEmission !== false && emissive(red, green, blue))) return 0;
      const radial = radialStrength(source, x + .5, y + .5);
      // Dark concrete remains darker than exposed edges when the same light crosses both.
      const response = Math.min(1, Math.max(.15, (luminance - 20) / 80));
      return Math.ceil(radial * response * pixels[index + 3]! / 255 * BANDS);
    });
  }

  paint(painter: LightPainter, spans: readonly LightSpan[], color: number, intensity: number): void {
    const alpha = clampedIntensity(intensity);
    if (alpha === 0) return;
    let lastBand = 0;
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i]!;
      if (span.band !== lastBand) painter.fillStyle(color, alpha * span.band / BANDS);
      painter.fillRect(span.x, span.y, span.width, 1);
      lastBand = span.band;
    }
  }

  /** Short sole-space projection away from the source. It changes sides with the light,
   * fades outside that source's field, and cannot cross a void, floor edge or solid base. */
  paintActorShadow(painter: LightPainter, x: number, y: number, source: FieldSource, intensity: number): void {
    if (!validSource(source) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const alpha = clampedIntensity(intensity) * radialStrength(source, x, y);
    if (alpha === 0) return;
    const sx = Math.floor(source.x); const sy = Math.floor(source.y);
    if (sx < 0 || sy < 0 || sx >= width || sy >= height) return;
    const sourceRoute = this.routes[sy * width + sx]!;
    const allowed = sourceRoute & MAIN ? MAIN | STAIRS : sourceRoute & UPPER ? UPPER | STAIRS : sourceRoute & STAIRS;
    const ignored = this.solids[sy * width + sx]!;
    const dx = x - source.x; const dy = y - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1 || !this.visible(sx + .5, sy + .5, Math.floor(x) + .5, Math.floor(y) + .5, allowed, ignored)) return;
    const ux = dx / distance; const uy = dy / distance;
    const length = Math.min(24, 7 + distance * .12);
    const endX = x + ux * length; const endY = y + uy * length;
    const left = Math.max(0, Math.floor(Math.min(x, endX) - 5));
    const right = Math.min(width, Math.ceil(Math.max(x, endX) + 5));
    const top = Math.max(0, Math.floor(Math.min(y, endY) - 5));
    const bottom = Math.min(height, Math.ceil(Math.max(y, endY) + 5));
    for (let py = top; py < bottom; py++) {
      let start = left; let current = 0;
      for (let px = left; px <= right; px++) {
        let band = 0;
        if (px < right && (this.routes[py * width + px]! & allowed) && !this.solids[py * width + px]) {
          const vx = px + .5 - x; const vy = py + .5 - y;
          const along = vx * ux + vy * uy;
          const across = Math.abs(vx * uy - vy * ux);
          if (along >= 0 && along < length && across < 4 * (1 - .7 * along / length)
            && this.visible(Math.floor(x) + .5, Math.floor(y) + .5, px + .5, py + .5, allowed, 0)) {
            band = Math.ceil((1 - .7 * along / length) * BANDS);
          }
        }
        if (band === current) continue;
        if (current > 0) {
          painter.fillStyle(0x080a0c, alpha * current / BANDS);
          painter.fillRect(start, py, px - start, 1);
        }
        start = px; current = band;
      }
    }
  }

  private compile(source: FieldSource, sample: (x: number, y: number) => number): readonly LightSpan[] {
    const spans: LightSpan[] = [];
    const left = Math.max(0, Math.floor(source.x - source.radiusX));
    const right = Math.min(width, Math.ceil(source.x + source.radiusX));
    const top = Math.max(0, Math.floor(source.y - source.radiusY));
    const bottom = Math.min(height, Math.ceil(source.y + source.radiusY));
    for (let y = top; y < bottom; y++) {
      let start = left; let current = 0;
      for (let x = left; x <= right; x++) {
        const band = x === right ? 0 : sample(x, y);
        if (band === current) continue;
        if (current > 0) spans.push({ x: start, y, width: x - start, band: current });
        start = x; current = band;
      }
    }
    return spans;
  }

  private passable(x: number, y: number, allowed: number, ignored: number): boolean {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const index = y * width + x;
    return (this.routes[index]! & allowed) !== 0 && (this.solids[index]! & ~ignored) === 0;
  }

  /** Grid traversal visits every intersected pixel, including both sides of exact corners. */
  private visible(sx: number, sy: number, tx: number, ty: number, allowed: number, ignored: number): boolean {
    let x = Math.floor(sx); let y = Math.floor(sy);
    const endX = Math.floor(tx); const endY = Math.floor(ty);
    const dx = tx - sx; const dy = ty - sy;
    const stepX = Math.sign(dx); const stepY = Math.sign(dy);
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    let nextX = dx === 0 ? Infinity : (stepX > 0 ? x + 1 - sx : sx - x) * deltaX;
    let nextY = dy === 0 ? Infinity : (stepY > 0 ? y + 1 - sy : sy - y) * deltaY;
    if (!this.passable(x, y, allowed, ignored)) return false;
    while (x !== endX || y !== endY) {
      if (nextX < nextY) { x += stepX; nextX += deltaX; }
      else if (nextY < nextX) { y += stepY; nextY += deltaY; }
      else {
        if (!this.passable(x + stepX, y, allowed, ignored) || !this.passable(x, y + stepY, allowed, ignored)) return false;
        x += stepX; y += stepY; nextX += deltaX; nextY += deltaY;
      }
      if (!this.passable(x, y, allowed, ignored)) return false;
    }
    return true;
  }
}

function validSource(source: FieldSource): boolean {
  return Number.isFinite(source.x) && Number.isFinite(source.y)
    && Number.isFinite(source.radiusX) && Number.isFinite(source.radiusY)
    && source.radiusX > 0 && source.radiusY > 0;
}

function clampedIntensity(intensity: number): number {
  return Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0;
}

function radialStrength(source: FieldSource, x: number, y: number): number {
  const dx = (x - source.x) / source.radiusX; const dy = (y - source.y) / source.radiusY;
  const r2 = dx * dx + dy * dy;
  return r2 >= 1 ? 0 : Math.pow(1 - r2, 1.3);
}

function radialBand(source: FieldSource, x: number, y: number): number {
  return Math.ceil(radialStrength(source, x, y) * BANDS);
}

function emissive(red: number, green: number, blue: number): boolean {
  const teal = green >= 50 && green > red * 1.35 && blue > red * 1.2;
  const amber = red >= 100 && green >= 65 && red > green * 1.15 && green > blue * 1.5;
  return teal || amber;
}

function contains(polygon: ChamberPolygon, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!; const b = polygon[j]!;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
