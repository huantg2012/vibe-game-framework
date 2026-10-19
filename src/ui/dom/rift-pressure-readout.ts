/** Accepted right-corner HUD artwork; native pixels, DOM-readable equivalent text. */
const REST = [179, 186, 174] as const;
const COST = { burden: [189, 104, 94], assimilation: [140, 153, 115] } as const;

/** ratio is weight/capacity or persistent assimilation/100. No gameplay thresholds. */
export function pressureReadoutColor(kind: keyof typeof COST, ratio: number): string {
  const finite = Number.isFinite(ratio) ? ratio : 0;
  const t = Math.max(0, Math.min(1, kind === 'burden' ? (finite - .5) * 2 : finite));
  const blend = t * t * (3 - 2 * t);
  return '#' + REST.map((value, i) => Math.round(value + (COST[kind][i]! - value) * blend).toString(16).padStart(2, '0')).join('');
}

const digits: Record<string, readonly string[]> = {
  '0':['01110','10001','10001','10001','10001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','00100','00100','00100'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],
  '/':['00001','00001','00010','00100','01000','10000','10000'],
  '%':['11001','11010','00010','00100','01000','01011','10011'],
  ' ':['00000','00000','00000','00000','00000','00000','00000'],
};

type NumberRun = { text: string; color: string; gap?: number };

/** Keep the original text node for accessibility and queries; only its ink is replaced. */
export class PixelHudReadout {
  private readonly text: Text;
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  constructor(host: HTMLSpanElement) {
    host.classList.add('rift-pixel-value');
    this.text = document.createTextNode('');
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.height = 11;
    this.canvas.width = 1;
    this.context = this.canvas.getContext('2d')!;
    host.append(this.text, this.canvas);
  }
  set(text: string, runs: readonly NumberRun[]): void {
    this.text.data = text;
    const width = runs.reduce((sum, run) => sum + (run.gap ?? 0) + Math.max(0, run.text.length * 6 - 1), 0);
    this.canvas.width = Math.max(1, width);
    const ctx = this.context;
    ctx.imageSmoothingEnabled = false;
    let x = 0;
    for (const run of runs) {
      x += run.gap ?? 0;
      ctx.fillStyle = run.color;
      for (const char of run.text) {
        const rows = digits[char] ?? [];
        rows.forEach((row, y) => {
          for (let px = 0; px < row.length; px++) if (row[px] === '1') ctx.fillRect(x + px, y + 2, 1, 1);
        });
        x += 6;
      }
      if (run.text.length) x--;
    }
  }
}
