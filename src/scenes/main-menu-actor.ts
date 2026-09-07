import Phaser from 'phaser';

// Original illustration pixels. Only this silhouette moves; the generated
// clean plate is clipped to its immediate surroundings, never shown full-frame.
const X = 1108;
const Y = 376;
const WIDTH = 68;
const HEIGHT = 146;
const SCALE = 960 / 1536;
const OUTLINE: readonly (readonly [number, number])[] = [
  [1137, 382], [1147, 383], [1154, 390], [1156, 399], [1152, 406],
  [1159, 409], [1165, 419], [1169, 429], [1169, 447], [1165, 455],
  [1159, 464], [1157, 478], [1155, 491], [1157, 502], [1156, 506],
  [1150, 510], [1143, 505], [1142, 499], [1143, 488], [1140, 472],
  [1138, 472], [1136, 491], [1137, 501], [1139, 512], [1134, 516],
  [1125, 514], [1122, 509], [1126, 498], [1126, 482], [1128, 464],
  [1125, 459], [1122, 467], [1117, 465], [1114, 457], [1116, 447],
  [1119, 442], [1119, 425], [1124, 415], [1131, 409], [1133, 405],
  [1128, 400], [1128, 393], [1131, 387],
];
let serial = 0;

/** Foot-pinned breathing deformation of the original title-art character. */
export class MainMenuActor {
  private readonly textureKeys: string[] = [];
  private mesh: Phaser.GameObjects.Mesh | null = null;
  private readonly container: Phaser.GameObjects.Container;
  private readonly preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  private hidden = document.hidden;
  private skipNextFrame = true;
  private elapsed = 0;
  private destroyed = false;
  readonly lampOffset = { x: 0, y: 0 };

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0);
    if (!scene.textures.exists('menu-last-light-clean-plate')) return;
    const original = scene.textures.get('menu-last-light').getSourceImage() as HTMLImageElement;
    const clean = scene.textures.get('menu-last-light-clean-plate').getSourceImage() as HTMLImageElement;
    const id = serial++;
    const patchKey = `menu-actor-patch-${id}`;
    const actorKey = `menu-actor-body-${id}`;
    const patch = scene.textures.createCanvas(patchKey, WIDTH, HEIGHT);
    const actor = scene.textures.createCanvas(actorKey, WIDTH, HEIGHT);
    if (!patch || !actor) throw new Error('Unable to create title actor layers');
    this.textureKeys.push(patchKey, actorKey);

    // Expand only the patch mask by four source pixels for the exposed edges.
    for (const [texture, source, padding] of [[patch, clean, 8], [actor, original, 0]] as const) {
      const ctx = texture.getContext();
      ctx.beginPath();
      OUTLINE.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x - X, y - Y);
        else ctx.lineTo(x - X, y - Y);
      });
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      if (padding) { ctx.strokeStyle = '#ffffff'; ctx.lineJoin = 'round'; ctx.lineWidth = padding; ctx.stroke(); }
      ctx.globalCompositeOperation = 'source-in';
      ctx.drawImage(source, X, Y, WIDTH, HEIGHT, 0, 0, WIDTH, HEIGHT);
      ctx.globalCompositeOperation = 'source-over';
      texture.refresh();
    }
    this.container.add(scene.add.image(X * SCALE, Y * SCALE, patchKey).setOrigin(0).setScale(SCALE));
    // A shared mesh avoids independently rounded image strips (which leave
    // horizontal seams when the pixel-art camera rounds each image position).
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const steps = 20;
    for (let row = 0; row <= steps; row++) {
      const v = row / steps;
      vertices.push(-WIDTH * SCALE / 2, (0.5 - v) * HEIGHT * SCALE,
        WIDTH * SCALE / 2, (0.5 - v) * HEIGHT * SCALE);
      uvs.push(0, v, 1, v);
      if (row < steps) {
        const i = row * 2;
        indices.push(i, i + 2, i + 1, i + 2, i + 3, i + 1);
      }
    }
    const mesh = scene.add.mesh((X + WIDTH / 2) * SCALE, (Y + HEIGHT / 2) * SCALE, actorKey);
    mesh.addVertices(vertices, uvs, indices);
    mesh.hideCCW = false;
    mesh.setOrtho(mesh.width, mesh.height);
    mesh.ignoreDirtyCache = true;
    this.mesh = mesh;
    this.container.add(mesh);
    this.preference.addEventListener('change', this.onPreference);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.onPreference();
    this.render();
  }

  private readonly onPreference = (): void => {
    this.container.setVisible(!this.preference.matches);
    if (this.preference.matches) { this.lampOffset.x = 0; this.lampOffset.y = 0; }
    this.skipNextFrame = true;
  };
  private readonly onVisibility = (): void => { this.hidden = document.hidden; this.skipNextFrame = true; };

  private weight(sourceY: number): number {
    // Upper torso carries the motion; below the knees the weight reaches zero.
    const t = Phaser.Math.Clamp((506 - sourceY) / 78, 0, 1);
    return t * t * (3 - 2 * t);
  }

  update(delta: number): void {
    if (this.destroyed || this.hidden || this.preference.matches || !this.mesh) return;
    if (this.skipNextFrame) { this.skipNextFrame = false; return; }
    this.elapsed += Phaser.Math.Clamp(delta, 0, 100);
    this.render();
  }

  private render(): void {
    const breath = 0.5 - 0.5 * Math.cos(this.elapsed * Math.PI * 2 / 4200);
    const sway = 1.15 * Math.sin(this.elapsed * Math.PI * 2 / 8600);
    for (const vertex of this.mesh?.vertices ?? []) {
      const sourceY = Y + vertex.v * HEIGHT;
      const weight = this.weight(sourceY);
      vertex.x = (vertex.u - 0.5) * WIDTH * SCALE + sway * weight;
      vertex.y = (0.5 - vertex.v) * HEIGHT * SCALE + breath * 2.1 * weight;
    }
    this.lampOffset.x = sway * this.weight(249 / SCALE);
    this.lampOffset.y = -breath * 2.1 * this.weight(249 / SCALE);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.preference.removeEventListener('change', this.onPreference);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.container.destroy();
    this.mesh = null;
    for (const key of this.textureKeys) this.scene.textures.remove(key);
  }
}
