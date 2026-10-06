import {
  CHAMBER_DEVICE_FOOTPRINTS,
  CHAMBER_SIZE,
  CHAMBER_WALK_POLYGONS,
  type ChamberPolygon,
} from '../systems/purification-chamber-layout';

interface LightPainter {
  fillStyle(color: number, alpha: number): unknown;
  fillRect(x: number, y: number, width: number, height: number): unknown;
}
interface LightSpan { readonly x: number; readonly y: number; readonly width: number; readonly band: number }
const { width, height } = CHAMBER_SIZE;
const bands = 5;

/** A receiver belongs to a real floor face. Walls, void and solid bases receive no floor light. */
export class ChamberFloorLight {
  private readonly receiver = new Uint8Array(width * height);

  constructor() {
    const floors = Object.values(CHAMBER_WALK_POLYGONS);
    const bases = Object.values(CHAMBER_DEVICE_FOOTPRINTS);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (floors.some(p => contains(p, x + .5, y + .5))
          && !bases.some(p => contains(p, x + .5, y + .5))) this.receiver[y * width + x] = 1;
      }
    }
  }

  /** Static emitters are compiled once, then replayed without texture uploads or new arrays. */
  compile(x: number, y: number, radiusX: number, radiusY: number): readonly LightSpan[] {
    const spans: LightSpan[] = [];
    this.scan(x, y, radiusX, radiusY, (sx, sy, spanWidth, band) => spans.push({ x: sx, y: sy, width: spanWidth, band }));
    return spans;
  }

  paint(painter: LightPainter, spans: readonly LightSpan[], color: number, intensity: number): void {
    for (const span of spans) {
      painter.fillStyle(color, intensity * span.band / bands);
      painter.fillRect(span.x, span.y, span.width, 1);
    }
  }

  /** Moving lamp samples the same receiver, so it cannot spill onto a riser or through a void. */
  paintLamp(painter: LightPainter, x: number, y: number): void {
    // Keep this hot path allocation-free; the static compiler's callback is not used here.
    const cx = Math.round(x); const cy = Math.round(y);
    for (let py = Math.max(0, cy - 6); py <= Math.min(height - 1, cy + 6); py++) {
      let start = 0; let current = 0;
      const end = Math.min(width, cx + 19);
      for (let px = Math.max(0, cx - 18); px <= end; px++) {
        const band = px === end ? 0 : this.sample(px, py, cx, cy, 18, 6);
        if (band === current) continue;
        if (current > 0) {
          painter.fillStyle(0xc4873a, .11 * current / bands);
          painter.fillRect(start, py, px - start, 1);
        }
        current = band; start = px;
      }
    }
  }

  private scan(cx: number, cy: number, rx: number, ry: number,
    emit: (x: number, y: number, width: number, band: number) => void): void {
    const left = Math.max(0, Math.floor(cx - rx)); const right = Math.min(width, Math.ceil(cx + rx) + 1);
    for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(height - 1, Math.ceil(cy + ry)); y++) {
      let start = left; let current = 0;
      for (let x = left; x <= right; x++) {
        const band = x === right ? 0 : this.sample(x, y, cx, cy, rx, ry);
        if (band === current) continue;
        if (current > 0) emit(start, y, x - start, current);
        current = band; start = x;
      }
    }
  }

  private sample(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
    if (!this.receiver[y * width + x]) return 0;
    const dx = (x - cx) / rx; const dy = (y - cy) / ry;
    const falloff = Math.max(0, 1 - dx * dx - dy * dy);
    return Math.floor(falloff * falloff * bands);
  }
}

function contains(polygon: ChamberPolygon, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!; const b = polygon[j]!;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
