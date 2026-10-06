/** Closed three-dimensional surfaces. No Phaser, gameplay, image, or camera mutations. */
export interface SeaVolumeGeometryConfig {
  seed: number; width: number; height: number;
  compression: number; heightProjection: number;
  frontY: number; bottomHeight: number; topHeight: number;
  source: { x: number; y: number; width: number; depth: number };
}
export interface SeaVolumeFrame {
  elapsedMs: number;
  curtain: { extension: number; active: boolean; phase: string };
}
export interface SeaColumn { inside: boolean; top: number; bottom: number; thickness: number }
export const SEA_SURFACE = { none: 0, top: 1, roll: 2, bottom: 3, fall: 4 } as const;
export type SeaSurface = typeof SEA_SURFACE[keyof typeof SEA_SURFACE];

const TAU = Math.PI * 2;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const fract = (n: number) => n - Math.floor(n);

/** Downward initial velocity plus gravity, in world pixels/seconds. These describe
 * decorative detached water, never damage or the authoritative curtain timing. */
export function waterShardHeight(startHeight: number, ageSeconds: number): number {
  return Math.max(0, startHeight - 28 * ageSeconds - 150 * ageSeconds * ageSeconds);
}
export function waterShardImpactTime(startHeight: number): number {
  return (-28 + Math.sqrt(28 * 28 + 600 * startHeight)) / 300;
}

/** A near left lobe gives way to a receding, open right coast. The falling source
 * never moves this boundary; there is deliberately no matching right doorpost. */
export function seaFrontYAt(x: number, seed: number, baseline: number, elapsedMs: number, width = 1184): number {
  const u = x / width, t = elapsedMs / 1000, phase = (seed % 127) * .137;
  const bend = 62 * Math.exp(-Math.pow((u - .19) / .16, 2))
    - 14 * Math.exp(-Math.pow((u - .40) / .105, 2))
    - 145 * smooth((u - .53) / .36);
  return baseline + bend + 16 * Math.sin(u * 7.8 + phase)
    + 12 * Math.sin(u * 5.1 - t * .49 + phase) + 5 * Math.sin(u * 17 + t * .72);
}

/** Reused indexed mesh storage; all frames write into the same buffers. */
export class SeaMesh {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uv: Float32Array;
  readonly indices: Uint32Array;
  readonly surfaces: Uint8Array;
  vertexCount = 0;
  triangleCount = 0;
  constructor(readonly vertexCapacity = 9000, readonly triangleCapacity = 18000) {
    this.positions = new Float32Array(vertexCapacity * 3);
    this.normals = new Float32Array(vertexCapacity * 3);
    this.uv = new Float32Array(vertexCapacity * 2);
    this.indices = new Uint32Array(triangleCapacity * 3);
    this.surfaces = new Uint8Array(triangleCapacity);
  }
  reset(): void { this.vertexCount = 0; this.triangleCount = 0; }
  vertex(x: number, y: number, z: number, u: number, v: number): number {
    const i = this.vertexCount++;
    if (i >= this.vertexCapacity) throw new Error('Sea geometry exceeded its vertex allocation');
    this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
    this.normals[i * 3] = 0; this.normals[i * 3 + 1] = 0; this.normals[i * 3 + 2] = 0;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    return i;
  }
  triangle(a: number, b: number, c: number, surface: SeaSurface): void {
    const face = this.triangleCount++;
    if (face >= this.triangleCapacity) throw new Error('Sea geometry exceeded its face allocation');
    this.indices[face * 3] = a; this.indices[face * 3 + 1] = b; this.indices[face * 3 + 2] = c;
    this.surfaces[face] = surface;
  }
  quad(a: number, b: number, c: number, d: number, surface: SeaSurface, reverse = false): void {
    if (reverse) { this.triangle(a, c, b, surface); this.triangle(b, c, d, surface); }
    else { this.triangle(a, b, c, surface); this.triangle(b, d, c, surface); }
  }
  finishNormals(): void {
    const p = this.positions, n = this.normals;
    for (let i = 0; i < this.triangleCount; i++) {
      const a = this.indices[i * 3]! * 3, b = this.indices[i * 3 + 1]! * 3, c = this.indices[i * 3 + 2]! * 3;
      const ux = p[b]! - p[a]!, uy = p[b + 1]! - p[a + 1]!, uz = p[b + 2]! - p[a + 2]!;
      const vx = p[c]! - p[a]!, vy = p[c + 1]! - p[a + 1]!, vz = p[c + 2]! - p[a + 2]!;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      n[a]! += nx; n[a + 1]! += ny; n[a + 2]! += nz;
      n[b]! += nx; n[b + 1]! += ny; n[b + 2]! += nz;
      n[c]! += nx; n[c + 1]! += ny; n[c + 2]! += nz;
    }
    for (let i = 0; i < this.vertexCount; i++) {
      const p = i * 3, length = Math.hypot(n[p]!, n[p + 1]!, n[p + 2]!) || 1;
      n[p]! /= length; n[p + 1]! /= length; n[p + 2]! /= length;
    }
  }
}

export class SeaVolumeGeometry {
  readonly body = new SeaMesh();
  readonly fall = new SeaMesh(4000, 8000);
  private elapsedMs = 0;
  private readonly column: SeaColumn = { inside: false, top: 0, bottom: 0, thickness: 0 };
  private readonly cols: number;
  private readonly rows: number;
  private readonly fallCellMask = new Uint8Array(20 * 32);
  revision = 0;
  frontMin = 0; frontMax = 0;
  topMin = 0; topMax = 0; bottomMin = 0; bottomMax = 0;
  thicknessMin = 0; thicknessMax = 0;
  sourceBottom = 0; sourceTop = 0; fallLowestZ = 0;
  fallTornCellCount = 0; fallShardCount = 0; contactBurstCount = 0;
  fallFragmentVertexStart = 0; fallContactVertexStart = 0;

  constructor(readonly config: Readonly<SeaVolumeGeometryConfig>) {
    const scalars = [config.seed, config.width, config.height, config.compression, config.heightProjection,
      config.frontY, config.bottomHeight, config.topHeight, config.source.x, config.source.y, config.source.width, config.source.depth];
    if (!scalars.every(Number.isFinite) || config.width <= 0 || config.height <= 0
      || config.width > 2048 || config.height > 2048 || config.bottomHeight <= 0 || config.topHeight <= config.bottomHeight
      || config.compression <= 0 || config.compression > 1 || config.heightProjection < 0
      || config.frontY <= 0 || config.frontY >= config.height
      || config.source.x - config.source.width * .6 <= 0 || config.source.x + config.source.width * .6 >= config.width
      || config.source.y - config.source.depth * .6 <= 0 || config.source.y + config.source.depth * .6 >= config.frontY
      || config.source.width <= 0 || config.source.depth <= 0) throw new Error('Invalid sea volume geometry');
    this.cols = Math.max(24, Math.ceil(config.width / 28));
    this.rows = Math.max(16, Math.ceil((config.frontY + 90) / 32));
    const requiredVertices = 2 * (this.rows + 1) * (this.cols + 1) + 13 * (this.cols + 1) + 4 * (this.rows + 1) + 24;
    if (requiredVertices > this.body.vertexCapacity) throw new Error('Sea dimensions exceed the bounded CPU renderer allocation');
  }

  frontAt(x: number): number { return seaFrontYAt(x, this.config.seed, this.config.frontY, this.elapsedMs, this.config.width); }
  private rimWidth(x: number): number { return 25 + 10 * (1 + Math.sin(x / this.config.width * 9.3 + .7)) * .5; }
  private topAt(x: number, y: number): number {
    const t = this.elapsedMs / 1000, seed = this.config.seed * .173;
    return this.config.topHeight + 24 * Math.sin(x / 243 + y / 319 + seed)
      + 13 * Math.sin(y / 127 - t * .52 + x / 392) + 5 * Math.sin(y / 43 + x / 187 - t * .91)
      + this.foregroundRoll(x, y) * .90;
  }
  private bottomAt(x: number, y: number): number {
    const t = this.elapsedMs / 1000, { source, seed } = this.config;
    const r2 = Math.pow((x - source.x) / (source.width * .78), 2) + Math.pow((y - source.y) / (source.depth * .84), 2);
    return this.config.bottomHeight + 24 * Math.sin(x / 209 - y / 277 + seed * .29)
      + 15 * Math.cos(x / 383 + y / 149 + t * .47) - 10 * Math.exp(-r2 * .7)
      + 7 * Math.sin(x / 133 - y / 238 - t * .63) + this.foregroundRoll(x, y);
  }

  /** A broad oblique fold lifts both surfaces. It creates actual air below the near
   * belly, while leaving the rear source and near left lobe low and thick.
   * This geometry is independent of camera/player/cutout state. */
  private foregroundRoll(x: number, y: number): number {
    const { source } = this.config, t = this.elapsedMs / 1000;
    const ahead = Math.max(0, y - source.y + Math.max(0, x - source.x) * .30);
    const axis = source.x + ahead * .20 + 7 * Math.sin(t * .37);
    const across = (x - axis) / (source.width * 1.14);
    // The high fold stays open to the right map boundary. A symmetrical lateral
    // bell here would form a cave doorway even if the source were truly inside.
    const spread = across >= 0 ? 1 : Math.exp(-Math.pow(across, 4) * 1.8);
    const slope = .98 + .07 * Math.tanh((x - source.x) / 120);
    const firstTurn = 16 * (1 - Math.exp(-ahead / 21));
    const secondTurn = 15 * smooth((ahead - 25) / 52) - 9 * smooth((ahead - 88) / 58);
    return spread * (ahead * slope + firstTurn + secondTurn);
  }

  /** Main-body column only; the distinct falling body is described by its own mesh/frame. */
  sampleColumn(x: number, y: number, out: SeaColumn = { inside: false, top: 0, bottom: 0, thickness: 0 }): SeaColumn {
    const front = this.frontAt(x), radius = this.rimWidth(x), rimY = front - radius;
    out.inside = x >= 0 && x <= this.config.width && y >= 0 && y <= front;
    if (!out.inside) { out.top = 0; out.bottom = 0; out.thickness = 0; return out; }
    const sampleY = Math.min(y, rimY), top = this.topAt(x, sampleY), bottom = this.bottomAt(x, sampleY);
    const half = (top - bottom) * .5;
    const round = y <= rimY ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((y - rimY) / radius, 2)));
    out.top = (top + bottom) * .5 + half * round;
    out.bottom = (top + bottom) * .5 - half * round;
    out.thickness = out.top - out.bottom;
    return out;
  }

  build(frame: Readonly<SeaVolumeFrame>): void {
    if (!Number.isFinite(frame.elapsedMs) || frame.elapsedMs < 0 || !Number.isFinite(frame.curtain.extension)) throw new Error('Invalid sea frame');
    this.elapsedMs = frame.elapsedMs; this.revision++;
    this.body.reset(); this.fall.reset();
    this.fallTornCellCount = 0; this.fallShardCount = 0; this.contactBurstCount = 0;
    this.fallFragmentVertexStart = 0; this.fallContactVertexStart = 0;
    this.frontMin = this.topMin = this.bottomMin = this.thicknessMin = Infinity;
    this.frontMax = this.topMax = this.bottomMax = this.thicknessMax = -Infinity;
    this.buildBody(); this.body.finishNormals();
    const { source } = this.config;
    this.sampleColumn(source.x, source.y, this.column);
    if (!this.column.inside || source.y + source.depth * .6 >= this.frontAt(source.x) - this.rimWidth(source.x)) throw new Error('The falling source must be inside the water volume, not on its front edge');
    this.sourceBottom = this.column.bottom; this.sourceTop = this.column.top;
    this.fallLowestZ = this.sourceBottom;
    if (frame.curtain.extension > .006) { this.buildFall(frame); this.fall.finishNormals(); }
  }

  private buildBody(): void {
    const mesh = this.body, { width } = this.config, stride = this.cols + 1;
    // Upper and lower surfaces share world positions at their seams with the rounded lip.
    for (let surface = 0; surface < 2; surface++) {
      const offset = mesh.vertexCount;
      for (let row = 0; row <= this.rows; row++) for (let col = 0; col <= this.cols; col++) {
        const x = col / this.cols * width, front = this.frontAt(x), rim = front - this.rimWidth(x), y = row / this.rows * rim;
        const top = this.topAt(x, y), bottom = this.bottomAt(x, y);
        this.frontMin = Math.min(this.frontMin, front); this.frontMax = Math.max(this.frontMax, front);
        this.topMin = Math.min(this.topMin, top); this.topMax = Math.max(this.topMax, top);
        this.bottomMin = Math.min(this.bottomMin, bottom); this.bottomMax = Math.max(this.bottomMax, bottom);
        this.thicknessMin = Math.min(this.thicknessMin, top - bottom); this.thicknessMax = Math.max(this.thicknessMax, top - bottom);
        const seamArc = Math.PI * (this.topAt(x, rim) - this.bottomAt(x, rim)) * .5;
        mesh.vertex(x, y, surface === 0 ? top : bottom, x, surface === 0 ? y : 2 * rim - y + seamArc);
      }
      for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) {
        const a = offset + row * stride + col;
        mesh.quad(a, a + 1, a + stride, a + stride + 1, surface === 0 ? SEA_SURFACE.top : SEA_SURFACE.bottom, surface === 1);
      }
    }
    const offset = mesh.vertexCount, bands = 10;
    for (let ring = 0; ring <= bands; ring++) for (let col = 0; col <= this.cols; col++) {
      const x = col / this.cols * width, front = this.frontAt(x), radius = this.rimWidth(x), rim = front - radius;
      const top = this.topAt(x, rim), bottom = this.bottomAt(x, rim), angle = Math.PI * ring / bands;
      mesh.vertex(x, rim + Math.sin(angle) * radius, (top + bottom) * .5 + (top - bottom) * .5 * Math.cos(angle),
        x, rim + angle * (top - bottom) * .5);
    }
    for (let ring = 0; ring < bands; ring++) for (let col = 0; col < this.cols; col++) {
      const a = offset + ring * stride + col;
      mesh.quad(a, a + 1, a + stride, a + stride + 1, SEA_SURFACE.roll);
    }
    // Cap map-side cuts and the far boundary. These are actual faces rather than color bands.
    for (const edge of [0, this.cols]) {
      const start = mesh.vertexCount, x = edge / this.cols * width, rim = this.frontAt(x) - this.rimWidth(x);
      for (let row = 0; row <= this.rows; row++) {
        const y = row / this.rows * rim;
        mesh.vertex(x, y, this.topAt(x, y), x, y);
        mesh.vertex(x, y, this.bottomAt(x, y), x, y + this.topAt(x, y) - this.bottomAt(x, y));
      }
      for (let row = 0; row < this.rows; row++) { const a = start + row * 2; mesh.quad(a, a + 2, a + 1, a + 3, SEA_SURFACE.roll, edge === 0); }
      const center = mesh.vertex(x, rim, (this.topAt(x, rim) + this.bottomAt(x, rim)) * .5, x, rim);
      const lipStart = mesh.vertexCount;
      for (let ring = 0; ring <= bands; ring++) {
        const angle = ring / bands * Math.PI;
        mesh.vertex(x, rim + Math.sin(angle) * this.rimWidth(x), (this.topAt(x, rim) + this.bottomAt(x, rim)) * .5
          + Math.cos(angle) * (this.topAt(x, rim) - this.bottomAt(x, rim)) * .5, x, rim + ring * 10);
      }
      for (let ring = 0; ring < bands; ring++) {
        if (edge === 0) mesh.triangle(center, lipStart + ring, lipStart + ring + 1, SEA_SURFACE.roll);
        else mesh.triangle(center, lipStart + ring + 1, lipStart + ring, SEA_SURFACE.roll);
      }
    }
    const far = mesh.vertexCount;
    for (let col = 0; col <= this.cols; col++) {
      const x = col / this.cols * width;
      mesh.vertex(x, 0, this.topAt(x, 0), x, 0); mesh.vertex(x, 0, this.bottomAt(x, 0), x, this.topAt(x, 0) - this.bottomAt(x, 0));
    }
    for (let col = 0; col < this.cols; col++) { const a = far + col * 2; mesh.quad(a, a + 1, a + 2, a + 3, SEA_SURFACE.roll); }
  }

  private buildFall(frame: Readonly<SeaVolumeFrame>): void {
    const { source } = this.config, extension = clamp01(frame.curtain.extension), t = frame.elapsedMs / 1000;
    const drop = this.sourceBottom * extension, lowest = Math.max(0, this.sourceBottom - drop);
    const mesh = this.fall, rows = 20, cols = 32, stride = cols + 1, sheetSize = (rows + 1) * stride;
    // One continuous, oblique water sheet. Its center is thick and its wings thin;
    // only the lower 43% divides into a broad main sheet and one short narrow tail.
    // It is a closed volume, but it never has circular tube cross-sections.
    for (let side = 0; side < 2; side++) for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const p = row / rows, u = col / cols * 2 - 1;
      const spread = 1 - .16 * smooth(p) + .055 * Math.sin(p * 2.8 + t * .68) * Math.sin(p * Math.PI);
      const x = source.x + u * source.width * .5 * spread
        + (Math.sin(p * 2.2 + t * .59) * 6 - 6) * p * extension;
      const spineY = source.y + u * source.depth * .12 * (1 - p)
        + Math.sin(u * 2.9 + p * 2.4 + t * .47) * p * 5 * extension + p * 7 * extension;
      const centerThickness = source.depth * (.14 * (1 - p) + .045);
      const thickness = 1.35 + centerThickness * Math.pow(Math.max(0, 1 - u * u), 1.5)
        * (1 + .19 * Math.sin(u * 4.1 - p * 7.2 + t * 1.28));
      const y = spineY + (side === 0 ? thickness : -thickness);
      const anchorX = source.x + u * source.width * .5;
      const anchorY = source.y + u * source.depth * .12 + (side === 0 ? thickness : -thickness);
      const anchorZ = this.sampleColumn(anchorX, anchorY, this.column).bottom + 13;
      const notch = .43 * Math.exp(-Math.pow((u - .59) / .15, 4));
      const thinTail = .17 * smooth((u - .74) / .17);
      const brokenLeftWing = .13 * smooth((-u - .65) / .35);
      const endZ = lowest + drop * Math.max(notch, thinTail, brokenLeftWing);
      const z = anchorZ * (1 - p) + endZ * p
        + Math.sin(u * 5.3 - p * 4.1 + t * .76) * Math.sin(p * Math.PI) * 3.2 * extension;
      mesh.vertex(x, y, z, anchorX + Math.sin(p * 2.1 + u) * 5,
        source.y + (anchorZ - z) * 1.7 + u * 13);
    }
    // Two unequal tears advect down the thin wings. The broad center and the
    // complete upper half stay connected; this does not turn the fall into lines.
    const tearStrength = smooth((extension - .45) / .45), mask = this.fallCellMask;
    const leftGap = .54 + .44 * fract(t * .83 + .07), rightGap = .57 + .38 * fract(t * .67 + .48);
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const p = (row + .5) / rows, u = (col + .5) / cols * 2 - 1;
      const dl = Math.abs(p - leftGap) / (.095 * tearStrength + .0001);
      const dr = Math.abs(p - rightGap) / (.070 * tearStrength + .0001);
      const torn = tearStrength > 0 && ((p > .49 && dl < 1 && u < -.73 - dl * .11)
        || (p > .53 && dr < 1 && u > .70 + dr * .12));
      mask[row * cols + col] = torn ? 0 : 1;
      if (torn) this.fallTornCellCount++;
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const cell = row * cols + col; if (!mask[cell]) continue;
      const a = row * stride + col, b = a + 1, c = a + stride, d = c + 1;
      mesh.quad(a, b, c, d, SEA_SURFACE.fall);
      mesh.quad(a + sheetSize, b + sheetSize, c + sheetSize, d + sheetSize, SEA_SURFACE.fall, true);
      // Only retained boundary cells get thickness caps. Capping the old outside
      // contour unconditionally would leave long floating edges across the tears.
      if (row === 0 || !mask[cell - cols]) mesh.quad(a, b, a + sheetSize, b + sheetSize, SEA_SURFACE.fall, true);
      if (row === rows - 1 || !mask[cell + cols]) mesh.quad(c, d, c + sheetSize, d + sheetSize, SEA_SURFACE.fall);
      if (col === 0 || !mask[cell - 1]) mesh.quad(a, c, a + sheetSize, c + sheetSize, SEA_SURFACE.fall);
      if (col === cols - 1 || !mask[cell + 1]) mesh.quad(b, d, b + sheetSize, d + sheetSize, SEA_SURFACE.fall, true);
    }
    this.fallLowestZ = lowest;
    if (frame.curtain.active) {
      // The connected low splash sheet reaches the exact authored danger ellipse.
      // The broad fall and its short torn tail need not fill the area uniformly.
      const base = mesh.vertexCount, rings = 5, segments = 48;
      for (let ring = 0; ring <= rings; ring++) for (let a = 0; a <= segments; a++) {
        const radius = ring / rings, angle = a / segments * TAU;
        const x = source.x + Math.cos(angle) * source.width * .5 * radius;
        const y = source.y + Math.sin(angle) * source.depth * .5 * radius;
        const z = (1 - radius) * (lowest + 1.4 + .45 * Math.sin(angle * 3 + t * 3));
        mesh.vertex(x, y, Math.max(0, z), x, drop + y);
      }
      for (let ring = 0; ring < rings; ring++) for (let a = 0; a < segments; a++) {
        const i = base + ring * (segments + 1) + a;
        mesh.quad(i, i + 1, i + segments + 1, i + segments + 2, SEA_SURFACE.fall, true);
      }
      this.fallLowestZ = 0;
      this.fallFragmentVertexStart = mesh.vertexCount;
      this.buildDetachedWater(t);
      this.fallContactVertexStart = mesh.vertexCount;
      this.buildContactBursts(t);
    }
  }

  private buildDetachedWater(time: number): void {
    const { source } = this.config;
    // Three irregularly staggered, wide short fragments. Each has a real flight,
    // then a much shorter horizontal impact; none forms a repeating curtain line.
    for (let i = 0; i < 3; i++) {
      const period = 1.13 + i * .257, age = fract((time + i * .371) / period) * period;
      const startHeight = this.sourceBottom * (i === 0 ? .39 : i === 1 ? .54 : .28);
      const impact = waterShardImpactTime(startHeight), vx = i === 1 ? 9 : -7 + i * 4;
      const sx = source.x + source.width * (i === 0 ? -.28 : i === 1 ? .24 : -.11);
      const sy = source.y + source.depth * (i === 0 ? -.03 : i === 1 ? .05 : .15);
      if (age < impact) {
        this.waterShard(sx + vx * age, sy + age * 4, waterShardHeight(startHeight, age),
          i === 0 ? 12 : i === 1 ? 8 : 14, i === 2 ? 4.2 : 2.7, 4 + age * 9, -.28 + i * .43, time + i);
        this.fallShardCount++;
      } else if (age < impact + .23) {
        const p = (age - impact) / .23;
        this.contactShard(sx + vx * impact, sy + impact * 4, i * 1.9 - .4, p, 10 + i * 2, i);
      }
    }
  }

  private buildContactBursts(time: number): void {
    const { source } = this.config;
    for (let i = 0; i < 3; i++) {
      const period = .61 + i * .127, duration = .24 + i * .025;
      const age = fract((time + i * .197) / period) * period;
      if (age >= duration) continue;
      const p = age / duration, angle = i === 0 ? -.36 : i === 1 ? 2.43 : 1.12;
      this.contactShard(source.x - source.width * .06, source.y + source.depth * .10,
        angle, p, 13 + i * 2, i + 4);
    }
  }

  private contactShard(x: number, y: number, angle: number, progress: number, length: number, seed: number): void {
    const { source } = this.config, travel = progress * (1.4 - .4 * progress);
    const cx = x + Math.cos(angle) * source.width * .29 * travel;
    const cy = y + Math.sin(angle) * source.depth * .27 * travel;
    const envelope = Math.sin(Math.PI * (.10 + progress * .90));
    this.waterShard(cx, cy, 0, length * envelope, (2.3 + seed % 2) * envelope,
      .45 + Math.sin(progress * Math.PI) * 4.5, angle, seed + progress * 2.3);
    this.contactBurstCount++;
  }

  /** An uneven, flattened closed fragment, not a little spherical particle.
   * Ground fragments are clipped geometrically to the existing contact ellipse. */
  private waterShard(cx: number, cy: number, baseZ: number, length: number, halfDepth: number,
    height: number, rotation: number, phase: number): void {
    const mesh = this.fall, { source } = this.config, segments = 9, start = mesh.vertexCount;
    const cosine = Math.cos(rotation), sine = Math.sin(rotation);
    for (let i = 0; i < segments; i++) {
      const angle = i / segments * TAU, roughness = 1 + .17 * Math.sin(i * 2.17 + phase);
      const dx = Math.cos(angle) * length * roughness, dy = Math.sin(angle) * halfDepth * roughness;
      let x = cx + dx * cosine - dy * sine, y = cy + dx * sine + dy * cosine;
      const nx = (x - source.x) / (source.width * .5), ny = (y - source.y) / (source.depth * .5);
      const radius = Math.hypot(nx, ny);
      if (radius > .98) { x = source.x + (x - source.x) * .98 / radius; y = source.y + (y - source.y) * .98 / radius; }
      const z = baseZ + height * (.25 + .12 * Math.sin(i * 1.61 + phase));
      mesh.vertex(x, y, z, x, source.y + (this.sourceBottom - z) * 1.7);
    }
    const cnx = (cx - source.x) / (source.width * .5), cny = (cy - source.y) / (source.depth * .5);
    const cr = Math.hypot(cnx, cny);
    if (cr > .98) { cx = source.x + (cx - source.x) * .98 / cr; cy = source.y + (cy - source.y) * .98 / cr; }
    const top = mesh.vertex(cx - length * .11 * cosine, cy - length * .11 * sine, baseZ + height, cx, source.y);
    const bottom = mesh.vertex(cx, cy, baseZ, cx, source.y + height);
    for (let i = 0; i < segments; i++) {
      mesh.triangle(top, start + i, start + (i + 1) % segments, SEA_SURFACE.fall);
      mesh.triangle(bottom, start + (i + 1) % segments, start + i, SEA_SURFACE.fall);
    }
  }
}
