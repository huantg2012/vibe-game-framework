/** Hand-authored native-resolution weapon pixels. No DOM, Phaser or concept-image sampling.
 * Render at asset creation/loading time, never in the gameplay update loop.
 */
export type CrowbarQuality = 'ordinary' | 'good' | 'fine' | 'excellent';
export type CrowbarVariant = 'standard' | 'light' | 'resistant';
export type CrowbarPixelPurpose = 'world' | 'icon';
export interface CrowbarPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
  readonly pivot: { readonly x: number; readonly y: number };
}
type Point = readonly [number, number];
type Color = readonly [number, number, number];
const IRON: readonly Color[] = [[42,39,35],[70,64,54],[101,92,77],[139,127,106]];
const RUST: Color = [117,77,48];
const SEAM: Color = [30,76,68];
const POLLUTION: Color = [48,132,111];
const GLINT: Color = [107,184,151];
const CLOTH: readonly Color[] = [[103,95,75],[136,121,92],[78,76,63]];

class PixelBrush {
  readonly data: Uint8ClampedArray;
  constructor(readonly size: number) { this.data = new Uint8ClampedArray(size * size * 4); }
  dot(x: number, y: number, color: Color): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) throw new Error('Crowbar pixel exceeds canvas');
    const i = (y * this.size + x) * 4;
    this.data[i] = color[0]; this.data[i + 1] = color[1]; this.data[i + 2] = color[2]; this.data[i + 3] = 255;
  }
  polygon(points: readonly Point[], color?: Color): void {
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i]!, b = points[j]!;
        if ((a[1] > y + .5) !== (b[1] > y + .5) && x + .5 < (b[0] - a[0]) * (y + .5 - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside) this.dot(x, y, color ?? IRON[(x * 7 + y * 3) % 17 === 0 ? 2 : 1]!);
    }
  }
  line(points: readonly Point[], color: Color): void {
    for (let n = 1; n < points.length; n++) {
      const a = points[n - 1]!, b = points[n]!;
      let x = a[0], y = a[1];
      const dx = Math.abs(b[0] - x), sx = x < b[0] ? 1 : -1;
      const dy = -Math.abs(b[1] - y), sy = y < b[1] ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        this.dot(x, y, color);
        if (x === b[0] && y === b[1]) break;
        const twice = 2 * error;
        if (twice >= dy) { error += dy; x += sx; }
        if (twice <= dx) { error += dx; y += sy; }
      }
    }
  }
}

function worldPixels(b: PixelBrush, quality: CrowbarQuality, variant: CrowbarVariant): void {
  // All grips and tails share the player's fixed attachment at (16,24).
  b.polygon([[15,15],[17,15],[17,27],[18,29],[16,29],[15,27]]);
  b.line([[15,16],[15,26],[16,28]], IRON[2]!);
  if (quality === 'ordinary') {
    b.polygon([[8,10],[8,7],[10,4],[13,4],[15,6],[17,16],[15,17],[13,8],[12,6],[10,6],[9,10]]);
    b.line([[8,9],[9,6],[11,4],[13,4],[14,6],[16,17]], IRON[2]!);
    b.line([[11,5],[13,6],[14,10]], RUST);
  } else if (quality === 'good') {
    b.polygon([[8,10],[8,7],[10,4],[13,4],[15,7],[18,8],[18,10],[15,9],[14,11],[16,14],[17,17],[15,18],[14,14],[12,11],[13,8],[12,6],[10,6],[9,10]]);
    b.line([[8,9],[9,6],[11,4],[13,4],[15,7],[17,8]], IRON[2]!);
    b.line([[13,8],[13,11],[15,14]], SEAM);
    b.dot(14,12,POLLUTION); b.dot(13,8,POLLUTION);
    b.line([[15,9],[16,9]], RUST);
  } else if (quality === 'fine') {
    b.polygon([[7,10],[8,6],[10,4],[14,4],[16,6],[16,10],[19,12],[19,15],[17,19],[15,18],[16,15],[16,12],[13,11],[12,7],[10,6],[9,8],[8,10]]);
    b.polygon([[13,10],[14,13],[13,15],[16,18],[16,20],[14,18],[11,15],[11,12]]);
    b.line([[7,9],[8,6],[11,4],[14,4],[15,6]], IRON[3]!);
    b.line([[16,11],[18,12],[18,15],[16,18]], IRON[2]!);
    b.line([[13,8],[14,10],[16,12],[17,14]], SEAM);
    b.line([[12,12],[12,14],[14,16]], POLLUTION);
    b.dot(16,11,POLLUTION); b.dot(13,15,GLINT);
  } else {
    b.polygon([[7,11],[6,8],[7,5],[10,3],[14,3],[16,5],[16,8],[18,10],[18,13],[20,15],[18,19],[15,19],[14,16],[11,14],[11,11],[9,9],[8,12]]);
    // Subtract a deliberately non-circular void by clearing its authored polygon.
    b.polygon([[10,5],[13,5],[14,7],[14,9],[16,11],[15,13],[13,12],[13,9],[10,8]], [0,0,0]);
    for (let i = 0; i < b.data.length; i += 4) if (b.data[i + 3] && !b.data[i] && !b.data[i + 1] && !b.data[i + 2]) b.data[i + 3] = 0;
    b.line([[7,9],[7,6],[10,3],[14,3],[15,4]], IRON[3]!);
    b.line([[9,8],[11,9],[12,12],[15,14],[16,17]], IRON[2]!);
    b.line([[17,13],[19,15],[17,18]], IRON[2]!);
    b.line([[9,5],[8,7],[9,8]], SEAM);
    b.line([[14,6],[15,8],[16,10]], POLLUTION);
    b.line([[12,12],[13,14],[15,15]], SEAM);
    b.dot(15,9,GLINT); b.dot(17,16,POLLUTION); b.dot(16,17,GLINT);
  }
  const cloth = CLOTH[variant === 'light' ? 2 : variant === 'resistant' ? 1 : 0]!;
  for (let y = 22; y <= 25; y++) { b.dot(15,y,cloth); b.dot(16,y,y % 2 ? IRON[1]! : CLOTH[1]!); }
  if (variant === 'light') b.dot(15,23,IRON[1]!);
  if (variant === 'resistant') b.line([[15,24],[16,24]], CLOTH[2]!);
}

function iconPixels(b: PixelBrush, quality: CrowbarQuality, variant: CrowbarVariant): void {
  // Independently composed 48px drawing, not an enlarged world sprite.
  b.polygon([[24,22],[27,22],[32,36],[35,41],[34,44],[32,40],[32,44],[30,41]]);
  b.line([[25,24],[29,35],[31,40],[32,43]], IRON[2]!);
  b.line([[27,25],[29,31],[30,33]], RUST);
  if (quality === 'ordinary') {
    b.polygon([[9,15],[10,9],[12,6],[16,4],[20,5],[22,8],[27,24],[24,25],[19,10],[17,7],[14,7],[12,10],[11,14]]);
    b.line([[9,14],[10,10],[12,7],[16,4],[19,5],[21,8],[26,24]], IRON[2]!);
    b.line([[13,7],[16,6],[18,7],[20,11]], RUST);
    b.line([[10,13],[11,10]], IRON[3]!);
  } else if (quality === 'good') {
    b.polygon([[9,15],[10,9],[12,6],[16,4],[20,5],[22,9],[26,11],[26,14],[23,13],[22,16],[23,18],[27,20],[28,25],[25,26],[24,22],[21,21],[19,17],[20,12],[18,8],[15,7],[13,9],[11,14]]);
    b.line([[9,14],[10,10],[13,6],[16,4],[20,5],[22,9],[25,11]], IRON[2]!);
    b.line([[21,12],[20,16],[22,20],[25,22]], SEAM);
    b.line([[20,14],[20,16],[21,17]], POLLUTION);
    b.dot(22,19,GLINT); b.line([[23,10],[24,12]], RUST);
    b.line([[25,20],[26,22],[27,25]], IRON[3]!);
  } else if (quality === 'fine') {
    b.polygon([[8,15],[9,9],[12,5],[17,3],[21,5],[23,8],[23,13],[27,15],[29,19],[29,24],[27,27],[25,26],[26,23],[25,19],[22,17],[19,13],[19,9],[17,7],[14,7],[11,10],[10,14]]);
    b.polygon([[21,13],[20,18],[21,22],[26,26],[27,29],[24,27],[19,24],[17,20],[18,15]]);
    b.line([[8,14],[9,10],[12,6],[17,3],[20,4],[22,7]], IRON[3]!);
    b.line([[23,14],[26,16],[28,19],[28,23],[26,26]], IRON[2]!);
    b.line([[18,16],[18,19],[20,23],[25,26]], IRON[2]!);
    b.line([[20,8],[21,11],[21,14],[24,17],[26,20]], SEAM);
    b.line([[19,16],[19,19],[21,22]], POLLUTION);
    b.dot(20,21,GLINT); b.dot(24,17,POLLUTION); b.dot(26,22,SEAM);
    b.line([[13,6],[16,5],[18,6]], RUST);
  } else {
    b.polygon([[8,17],[7,13],[8,8],[11,4],[17,3],[21,4],[23,7],[23,11],[26,14],[26,18],[29,20],[31,24],[29,28],[25,28],[23,23],[19,21],[17,17],[16,13],[13,12],[11,14],[10,18]]);
    b.polygon([[12,7],[16,5],[19,6],[20,9],[20,12],[23,15],[23,18],[21,18],[20,16],[19,12],[16,10],[12,10]], [0,0,0]);
    for (let i = 0; i < b.data.length; i += 4) if (b.data[i + 3] && !b.data[i] && !b.data[i + 1] && !b.data[i + 2]) b.data[i + 3] = 0;
    b.line([[8,15],[8,10],[10,6],[13,4],[17,3],[21,4],[22,6]], IRON[3]!);
    b.line([[11,12],[13,11],[16,12],[18,17],[20,19],[23,20],[25,23]], IRON[2]!);
    b.line([[26,19],[29,21],[30,24],[28,27]], IRON[2]!);
    b.line([[10,8],[10,10],[12,11]], SEAM);
    b.line([[20,7],[21,9],[21,12],[23,14]], POLLUTION);
    b.line([[18,18],[19,21],[23,22]], SEAM);
    b.line([[26,23],[27,25],[27,27]], POLLUTION);
    b.dot(21,10,GLINT); b.dot(22,13,GLINT); b.dot(27,26,GLINT);
    b.dot(11,6,RUST); b.dot(24,20,RUST); b.dot(15,12,RUST);
  }
  const cloth = CLOTH[variant === 'light' ? 2 : variant === 'resistant' ? 1 : 0]!;
  b.polygon([[27,31],[30,30],[33,37],[30,38]], cloth);
  for (let y = 32; y <= 36; y += 2) {
    const x = 28 + Math.floor((y-32)/3);
    b.line([[x,y],[x+2,y-1]], CLOTH[1]!);
  }
  if (variant === 'light') b.line([[29,33],[30,34]], IRON[1]!);
  if (variant === 'resistant') b.line([[29,35],[31,34]], CLOTH[2]!);
}

export function renderCrowbarPixels(quality: CrowbarQuality, variant: CrowbarVariant, purpose: CrowbarPixelPurpose): CrowbarPixels {
  const size = purpose === 'world' ? 32 : 48;
  const brush = new PixelBrush(size);
  if (purpose === 'world') worldPixels(brush, quality, variant);
  else iconPixels(brush, quality, variant);
  return { width: size, height: size, data: brush.data, pivot: purpose === 'world' ? { x:16,y:24 } : { x:31,y:36 } };
}
