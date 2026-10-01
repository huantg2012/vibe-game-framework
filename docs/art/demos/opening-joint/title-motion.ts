/** Living illustration for selected F. All coordinates use the 960×640 title.
 * Architecture, actor and camera stay fixed. Scene delta owns every effect. */
const W = 960, H = 640, TAU = Math.PI * 2;
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const wave = (t: number): number => .5 + .5 * Math.sin(t);
const fract = (n: number): number => n - Math.floor(n);
const random = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
type Point = readonly [number, number];
function polygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function surface(): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  return canvas;
}
interface LightMask { bright: HTMLCanvasElement; dark: HTMLCanvasElement; }

export class JointTitleMotion {
  readonly canvas = surface();
  private readonly context: CanvasRenderingContext2D;
  private readonly source = surface();
  private readonly core: LightMask;
  private readonly fire: LightMask;
  private readonly grille = surface();
  private readonly flames = surface();
  private readonly mist = surface();
  private readonly mistMask = surface();
  private readonly energy = document.createElement('canvas');
  private readonly energyPixels: ImageData;
  private readonly pixels: Uint8ClampedArray;
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private elapsed = 0;
  private interval = 0;
  private disposed = false;
  private motionReduced = false;
  private readonly energyRect = { x: 794, y: 237, w: 47, h: 67 };

  constructor(image: HTMLImageElement) {
    this.canvas.className = 'joint-title-motion';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.motionProfile = 'selected-f';
    this.canvas.dataset.motionTime = '0.000';
    this.canvas.style.pointerEvents = 'none';
    this.context = this.canvas.getContext('2d')!;
    this.context.imageSmoothingEnabled = false;
    const source = this.source.getContext('2d')!;
    source.imageSmoothingEnabled = false;
    source.drawImage(image, 0, 0, W, H);
    this.pixels = source.getImageData(0, 0, W, H).data;
    this.core = this.buildLight('core'); this.fire = this.buildLight('fire');
    this.buildGrilleAndAir();
    this.energy.width = this.energyRect.w; this.energy.height = this.energyRect.h;
    this.energyPixels = this.energy.getContext('2d')!.createImageData(this.energy.width, this.energy.height);
    this.reduced.addEventListener('change', this.onMotionPreference);
    this.motionReduced = this.reduced.matches;
    this.draw();
  }

  private buildLight(kind: 'core' | 'fire'): LightMask {
    const bright = surface(), dark = surface();
    const ctx = bright.getContext('2d')!, data = ctx.createImageData(W, H);
    const shadow = ctx.createImageData(W, H);
    const floor: readonly Point[] = [[738, 326], [825, 299], [900, 307], [960, 365], [928, 435], [756, 448], [716, 396]];
    for (let y = 200; y < 460; y++) for (let x = 570; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = this.pixels[i]!, g = this.pixels[i + 1]!, b = this.pixels[i + 2]!;
      let weight = 0;
      if (kind === 'core') {
        const support = clamp(1 - ((x - 817) / 151) ** 2 - ((y - 307) / 154) ** 2);
        const receiver = (x > 766 && x < 892 && y < 375) || polygon(x, y, floor);
        if (receiver && g > 26 && g > r * 1.10 && g > b * 1.025) weight = clamp((g - r) / 27) * support;
      } else {
        const support = clamp(1 - ((x - 675) / 111) ** 2 - ((y - 393) / 70) ** 2);
        if (r > 38 && r > g * 1.22 && g > b * 1.18) weight = clamp((r - g) / 40) * support;
      }
      if (!weight) continue;
      // Actual lit pixels define receivers: retain grille, stone relief,
      // contact shadows and folds instead of painting coloured ellipses.
      for (let c = 0; c < 3; c++) data.data[i + c] = Math.min(255, this.pixels[i + c]! * 1.85 + 6);
      data.data[i + 3] = Math.round(weight * 255);
      shadow.data[i + 3] = Math.round(weight * 255);
    }
    ctx.putImageData(data, 0, 0); dark.getContext('2d')!.putImageData(shadow, 0, 0);
    return { bright, dark };
  }

  private buildGrilleAndAir(): void {
    const ctx = this.grille.getContext('2d')!, data = ctx.createImageData(W, H);
    const air = ctx.createImageData(W, H);
    const gaps: readonly (readonly Point[])[] = [
      [[522, 70], [596, 83], [604, 223], [637, 295], [587, 357], [522, 404]],
      [[444, 431], [507, 409], [550, 532], [565, 640], [426, 640], [410, 555]],
    ];
    for (let y = 50; y < H; y++) for (let x = 400; x < 730; x++) {
      const i = (y * W + x) * 4;
      const r = this.pixels[i]!, g = this.pixels[i + 1]!, b = this.pixels[i + 2]!;
      if (x > 661 && x < 704 && y > 354 && y < 405 && r > 110 && r > g * 1.3 && g > b * 1.4) {
        data.data[i] = 255; data.data[i + 1] = 255; data.data[i + 2] = 255;
        data.data[i + 3] = Math.round(clamp((r - 90) / 90) * 255);
      }
      if (gaps.some(shape => polygon(x, y, shape))) {
        const luminosity = Math.max(r, g, b);
        const edge = clamp((x - 405) / 25) * clamp((640 - y) / 25);
        air.data[i] = 255; air.data[i + 1] = 255; air.data[i + 2] = 255;
        air.data[i + 3] = Math.round(255 * clamp((35 - luminosity) / 22) * edge);
      }
    }
    ctx.putImageData(data, 0, 0); this.mistMask.getContext('2d')!.putImageData(air, 0, 0);
  }

  update(delta: number): void {
    if (this.disposed || !Number.isFinite(delta)) return;
    // Also observe at the scene boundary: embedded/headless browsers can expose
    // an updated matches value before delivering the MediaQueryList event.
    if (this.motionReduced !== this.reduced.matches) {
      this.motionReduced = this.reduced.matches; this.draw();
    }
    if (this.motionReduced) return;
    const step = Math.max(0, Math.min(delta, 100));
    this.elapsed += step / 1000; this.interval += step;
    if (this.interval < 1000 / 30) return;
    this.interval %= 1000 / 30; this.draw();
  }
  private readonly onMotionPreference = (): void => {
    this.motionReduced = this.reduced.matches; this.draw();
  };
  private light(mask: LightMask, amount: number): void {
    this.context.globalAlpha = Math.abs(amount);
    this.context.drawImage(amount < 0 ? mask.dark : mask.bright, 0, 0);
    this.context.globalAlpha = 1;
  }

  private drawEnergy(t: number, breath: number): void {
    const { x: left, y: top, w, h } = this.energyRect;
    const out = this.energyPixels.data;
    const scale = 1 + .038 * breath;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dst = (y * w + x) * 4;
      const wx = left + x, wy = top + y;
      const oval = ((wx - 819) / 21) ** 2 + ((wy - 270) / 32) ** 2;
      const original = (wy * W + wx) * 4;
      const sr = this.pixels[original]!, sg = this.pixels[original + 1]!, sb = this.pixels[original + 2]!;
      const edge = clamp((1 - oval) * 4);
      if (!edge || sg < 49 || sg < sr * 1.13 || sg < sb * 1.025) { out[dst + 3] = 0; continue; }
      // Advect density through a bounded volume, never orbit the frame.
      const flow = Math.sin(x * .18 + y * .075 - t * .72) + .50 * Math.sin(y * .20 + t * .97 - x * .09);
      const sx = Math.round(819 + (wx - 819) / scale + Math.sin(y * .12 + t * .8) * 1.3);
      const sy = Math.round(270 + (wy - 270) / scale + Math.sin(x * .15 - t * .58) * 1.5);
      const src = (sy * W + sx) * 4;
      const gain = 1.03 + .19 * flow + .07 * breath;
      for (let c = 0; c < 3; c++) out[dst + c] = Math.min(230, this.pixels[src + c]! * gain);
      out[dst + 3] = Math.round(edge * 215);
    }
    this.energy.getContext('2d')!.putImageData(this.energyPixels, 0, 0);
    this.context.drawImage(this.energy, left, top);
  }

  private drawFlames(t: number, flicker: number): void {
    const ctx = this.flames.getContext('2d')!;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    for (let y = 354; y < 405; y += 2) for (let x = 662; x < 704; x += 2) {
      const tongue = wave(y * .25 + t * 5 + Math.sin(x * .55 - t * 1.8) * 2);
      ctx.fillStyle = `rgba(255,192,91,${(.08 + tongue * .33) * (.85 + flicker)})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(this.grille, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; this.context.drawImage(this.flames, 0, 0);
  }

  private drawAir(t: number): void {
    const ctx = this.mist.getContext('2d')!;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    for (let y = 55; y < H; y += 6) for (let x = 405; x < 640; x += 6) {
      const field = wave(x * .023 + y * .018 - t * .085 + Math.sin(y * .031 + t * .11));
      const layer = wave(x * .012 - y * .027 + t * .063);
      ctx.fillStyle = `rgba(57,66,62,${field * layer * .065})`; ctx.fillRect(x, y, 6, 6);
    }
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(this.mistMask, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; this.context.drawImage(this.mist, 0, 0);
    for (let i = 0; i < 25; i++) {
      const near = i < 13;
      const lifetime = near ? 6 + random(i) * 6 : 15 + random(i) * 10;
      const p = fract(t / lifetime + random(i + 71));
      const x = near ? 607 + random(i + 12) * 126 + Math.sin(t * .22 + i) * 6
        : 442 + random(i + 12) * 180 + Math.sin(t * .08 + i) * 3;
      const y = near ? 433 - p * 104 : 135 + p * 360;
      const fade = Math.sin(p * Math.PI) ** 2;
      const light = near ? clamp(1 - Math.hypot((x - 675) / 97, (y - 386) / 73)) : .18;
      this.context.fillStyle = near ? `rgba(204,177,127,${fade * light * .48})` : `rgba(102,116,107,${fade * light})`;
      this.context.fillRect(Math.round(x), Math.round(y), 1, near && i % 6 === 0 ? 2 : 1);
    }
    this.drawSmoke(t);
  }

  private drawSmoke(t: number): void {
    // F chimney aperture (688,326): smoke disperses upward, away from the face.
    for (let i = 0; i < 10; i++) {
      const p = fract(t / 6.8 + i / 10);
      const x = 688 - p * 9 + Math.sin(p * 6.2 + t * .42) * (1 + p * 4);
      const y = 325 - p * 49, size = 1 + p * 4;
      const fade = Math.sin(p * Math.PI) * (1 - p);
      this.context.fillStyle = `rgba(121,123,108,${fade * .13})`;
      for (let row = -2; row <= 2; row++) {
        const width = Math.max(1, Math.round(size * (1 - Math.abs(row) * .19)));
        this.context.fillRect(Math.round(x - width / 2), Math.round(y + row), width, 1);
      }
    }
    for (let i = 0; i < 2; i++) {
      const p = fract(t / (5.3 + i * 1.7) + i * .41);
      if (p > .34) continue;
      const age = p / .34;
      this.context.fillStyle = `rgba(210,142,68,${Math.sin(age * Math.PI) * .55})`;
      this.context.fillRect(Math.round(688 + Math.sin(age * 3 + i) * 3 - age * 5), Math.round(324 - age * 22), 1, 1);
    }
  }

  private draw(): void {
    this.context.clearRect(0, 0, W, H);
    if (this.reduced.matches || this.disposed) return;
    const t = this.elapsed;
    const breath = Math.sin(t * TAU / 7.1) * .75 + Math.sin(t * TAU / 11.3 + .7) * .25;
    const flicker = .055 + .057 * Math.sin(t * 4.19) + .035 * Math.sin(t * 9.73 + .8) + .020 * Math.sin(t * 16.41 + 1.2);
    this.drawAir(t); this.light(this.core, .035 + breath * .10); this.light(this.fire, flicker);
    this.drawEnergy(t, breath); this.drawFlames(t, flicker);
    this.canvas.dataset.motionTime = t.toFixed(3);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true; this.reduced.removeEventListener('change', this.onMotionPreference);
    this.canvas.remove();
    for (const canvas of [this.canvas, this.source, this.core.bright, this.core.dark,
      this.fire.bright, this.fire.dark, this.grille, this.flames, this.mist, this.mistMask, this.energy]) {
      canvas.width = 0; canvas.height = 0;
    }
  }
}
