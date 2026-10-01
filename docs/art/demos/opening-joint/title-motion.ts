/** Quiet radiance variation sampled from the current, review-pending title. This is
 * not another light rig: only already-green core surfaces and already-warm
 * firelit surfaces can change. The illustration and every silhouette stay put. */
export class JointTitleMotion {
  readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly core = document.createElement('canvas');
  private readonly fire = document.createElement('canvas');
  private readonly reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private elapsed = 0;
  private interval = 0;
  private disposed = false;

  constructor(image: HTMLImageElement) {
    for (const canvas of [this.canvas, this.core, this.fire]) { canvas.width = 960; canvas.height = 640; }
    this.canvas.className = 'joint-title-motion';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.context = this.canvas.getContext('2d')!;
    this.context.imageSmoothingEnabled = false;
    this.context.drawImage(image, 0, 0, 960, 640);
    const source = this.context.getImageData(0, 0, 960, 640);
    const core = this.context.createImageData(960, 640);
    const fire = this.context.createImageData(960, 640);
    const clamp = (value: number): number => Math.min(1, Math.max(0, value));
    const floor: readonly (readonly [number, number])[] = [[720, 338], [832, 300], [927, 329], [957, 374], [925, 433], [765, 439]];
    const onFloor = (x: number, y: number): boolean => {
      let inside = false;
      for (let i = 0, j = floor.length - 1; i < floor.length; j = i++) {
        const a = floor[i]!, b = floor[j]!;
        if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      return inside;
    };
    for (let y = 200; y < 470; y++) for (let x = 570; x < 958; x++) {
      const index = (y * 960 + x) * 4;
      const r = source.data[index]!, g = source.data[index + 1]!, b = source.data[index + 2]!;
      // Soft spatial support × existing colour, not a painted radial glow.
      // The core's apparatus, energy and lit stone share one slow cycle.
      const coreArea = clamp(1 - ((x - 822) / 155) ** 2 - ((y - 304) / 163) ** 2);
      const coreSurface = (x > 758 && x < 883 && y > 194 && y < 381) || onFloor(x, y);
      const green = coreSurface && g > 30 && g > r * 1.09 && g > b * 1.025
        ? clamp((g - r) / 27) * coreArea : 0;
      const fireArea = clamp(1 - ((x - 684) / 113) ** 2 - ((y - 394) / 78) ** 2);
      const warm = r > 40 && r > g * 1.27 && g > b * 1.20
        ? clamp((r - g) / 40) * fireArea : 0;
      for (let channel = 0; channel < 3; channel++) {
        core.data[index + channel] = source.data[index + channel]!;
        fire.data[index + channel] = source.data[index + channel]!;
      }
      core.data[index + 3] = Math.round(255 * green);
      fire.data[index + 3] = Math.round(255 * warm);
    }
    this.core.getContext('2d')!.putImageData(core, 0, 0);
    this.fire.getContext('2d')!.putImageData(fire, 0, 0);
    this.context.clearRect(0, 0, 960, 640);
    this.reduced.addEventListener('change', this.onMotionPreference);
    this.draw();
  }

  /** Scene delta owns time, so comparison, focus loss and scene pause freeze
   * these exact phases; there is no independently running RAF or CSS loop. */
  update(delta: number): void {
    if (this.disposed || this.reduced.matches) return;
    const step = Math.max(0, Math.min(delta, 100));
    this.elapsed += step / 1000;
    this.interval += step;
    if (this.interval < 1000 / 30) return;
    this.interval %= 1000 / 30;
    this.draw();
  }

  private readonly onMotionPreference = (): void => { this.draw(); };

  private draw(): void {
    this.context.clearRect(0, 0, 960, 640);
    if (this.reduced.matches || this.disposed) return;
    const t = this.elapsed;
    // SCREEN against the unchanged source raises any channel by at most
    // alpha × (1 - source). Even at full mask this stays below 5.3%, with no
    // overlap between the warm and green pixel sets and no global exposure.
    this.context.globalAlpha = .012 + .040 * (.5 + .5 * Math.sin(t * Math.PI * 2 / 4.8));
    this.context.drawImage(this.core, 0, 0);
    this.context.globalAlpha = Math.max(0, .018 + .014 * Math.sin(t * 5.17)
      + .007 * Math.sin(t * 11.39 + .8) + .006 * Math.sin(t * 17.71 + 1.2));
    this.context.drawImage(this.fire, 0, 0);
    this.context.globalAlpha = 1;
    this.canvas.dataset.motionTime = t.toFixed(3);
  }

  destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reduced.removeEventListener('change', this.onMotionPreference);
    this.canvas.remove();
    for (const canvas of [this.canvas, this.core, this.fire]) { canvas.width = 0; canvas.height = 0; }
  }
}
