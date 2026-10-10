import type { ActorRegion, Grade, Phase } from './background';

/** Screen-space atmosphere on the preparation veil, never world geometry.
 * Signalis: quiet type; Darkwood: human presence; HLD: direct selection marks.
 * Organic stain density/overlap carries pressure, not an opaque green wash.
 * The actor and typography do not move, tint, or participate in distortion.
 */
export function mountVeil(canvas: HTMLCanvasElement) {
  const width = 480, height = 320;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('无法创建遮罩样例');
  const pixels = ctx.createImageData(width, height);
  const values = new Float32Array(128 * 128);
  let seed = 861207;
  for (let i = 0; i < values.length; i++) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519);
    values[i] = (seed >>> 0) / 4294967295;
  }
  const smooth = (a: number, b: number, n: number) => {
    const v = Math.max(0, Math.min(1, (n - a) / (b - a)));
    return v * v * (3 - 2 * v);
  };
  function noise(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = smooth(0, 1, x - ix), fy = smooth(0, 1, y - iy);
    const at = (a: number, b: number) => values[(b & 127) * 128 + (a & 127)]!;
    const top = at(ix, iy) * (1 - fx) + at(ix + 1, iy) * fx;
    return top * (1 - fy) + (at(ix, iy + 1) * (1 - fx) + at(ix + 1, iy + 1) * fx) * fy;
  }
  let actor: ActorRegion | undefined;
  let grade: Grade = 'low', phase: Phase = 'pollution';
  let running = false, visible = true, disposed = false, frame = 0;
  let seconds = 0, previous = 0, lastPaint = 0;
  const protection = new Float32Array(width * height).fill(1);
  function setActor(region: ActorRegion): void {
    actor = region;
    const cx = actor.x + actor.width / 2, cy = actor.y + actor.height / 2;
    const rx = actor.width / 2 + 22, ry = actor.height / 2 + 20;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const distance = Math.hypot((x * 2 - cx) / rx, (y * 2 - cy) / ry);
      protection[y * width + x] = smooth(1, 1.8, distance);
    }
    paint();
  }
  function paint(): void {
    if (disposed) return;
    const level = grade === 'low' ? 0 : grade === 'medium' ? 1 : 2;
    const t = seconds;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const px = x * 2, py = y * 2;
      const slow = noise(px * .006 + t * .011, py * .006 - t * .006);
      const warp = (slow - .5) * 64;
      const detail = noise((px + warp) * .018 - t * .005, (py - warp) * .014 + t * .009);
      const fine = noise(px * .075 + warp * .008, py * .055 - t * .006);
      const erosion = (detail - .5) * 65 + (fine - .5) * 12;
      // Unequal fronts flow over the veil; no horizon or world-space silhouette.
      const topWeight = .25 + .75 * Math.exp(-(((px - 620) / 310) ** 2));
      const top = -5 + level * 92 * topWeight + 24 * Math.sin(px * .007 + slow * 3) - py;
      const rightWeight = .28 + .72 * Math.exp(-(((py - 280) / 180) ** 2));
      const right = -3 + level * 115 * rightWeight + 32 * Math.sin(py * .009 + slow * 4) - (960 - px);
      const bottomWeight = .12 + .88 * Math.exp(-(((px - 270) / 240) ** 2));
      const bottom = -12 + level * 95 * bottomWeight + 24 * Math.sin(px * .009 - slow * 2) - (640 - py);
      const left = -24 + level * 30 + 22 * Math.sin(py * .008 + slow) - px;
      const front = Math.max(top, right, bottom, left) + erosion;
      const body = smooth(-30, 36, front);
      const edge = (1 - smooth(3, 24, Math.abs(front + 4))) * (.36 + detail * .64);
      // Broad uneven deposits, not closed contour lines or bubble outlines.
      const internal = smooth(.28, .76, detail) * body;
      const overlap = smooth(.40, .74, slow) * body;
      let alpha = body * (.13 + level * .095) + edge * (.035 + level * .055) + internal * .20;
      // Typography remains unfiltered; a broad calm reading area limits contrast
      // of material behind facts while retaining effects between groups/edges.
      const quietX = smooth(505, 538, px) * (1 - smooth(889, 930, px));
      const quietY = smooth(178, 210, py) * (1 - smooth(508, 533, py));
      alpha *= (1 - quietX * quietY * .35) * protection[y * width + x]!;
      const tone = 31 + edge * 23 + internal * 29 - overlap * 12 + (fine - .5) * 5;
      const i = (y * width + x) * 4;
      pixels.data[i] = tone * .88;
      pixels.data[i + 1] = tone;
      pixels.data[i + 2] = tone * .88;
      pixels.data[i + 3] = Math.round(Math.min(.72, alpha) * 255);
    }
    ctx!.putImageData(pixels, 0, 0);
    canvas.dataset.grade = grade;
    canvas.dataset.frame = String(Number(canvas.dataset.frame ?? 0) + 1);
  }
  function tick(now: number): void {
    if (disposed || !running || !visible || document.hidden) { frame = 0; previous = 0; return; }
    if (previous) seconds += Math.min(.1, (now - previous) / 1000) * (phase === 'equipment' ? .35 : 1);
    previous = now;
    if (now - lastPaint >= 66) { paint(); lastPaint = now; }
    frame = requestAnimationFrame(tick);
  }
  function sync(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
    if (running && visible && !document.hidden && !disposed) frame = requestAnimationFrame(tick);
  }
  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);
  paint();
  return {
    setActor,
    setGrade(next: Grade) { if (grade !== next) { grade = next; paint(); } },
    setPhase(next: Phase) { phase = next; },
    setVisible(next: boolean) { visible = next; sync(); },
    setMotion(next: boolean) { running = next; if (!next) { seconds = 0; paint(); } sync(); },
    dispose() { disposed = true; if (frame) cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
