/** Seeded world-space signals shared by material operators. */
export function materialHash(x: number, y: number, seed: number): number {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 4294967295;
}
export function materialNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = materialHash(ix, iy, seed), b = materialHash(ix + 1, iy, seed);
  const c = materialHash(ix, iy + 1, seed), d = materialHash(ix + 1, iy + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
export function materialMix(a: number, b: number, ratio: number): number {
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round((a >>> 16 & 255) * (1 - t) + (b >>> 16 & 255) * t);
  const g = Math.round((a >>> 8 & 255) * (1 - t) + (b >>> 8 & 255) * t);
  const blue = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return r << 16 | g << 8 | blue;
}
export function materialCell(x: number, y: number, scale: number, seed: number): { edge: number; identity: number; plane: number } {
  const gx = x / scale, gy = y / scale, cx = Math.floor(gx), cy = Math.floor(gy);
  let first = Infinity, second = Infinity, identity = 0, plane = 0;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const col = cx + ox, row = cy + oy;
    const r = materialHash(col, row, seed), q = materialHash(col, row, seed ^ 19271);
    const dx = gx - col - .12 - r * .76, dy = gy - row - .12 - q * .76;
    const distance = dx * dx + dy * dy;
    if (distance < first) { second = first; first = distance; identity = r; plane = dx * .6 - dy * .8; }
    else if (distance < second) second = distance;
  }
  return { edge: (Math.sqrt(second) - Math.sqrt(first)) * scale, identity, plane };
}
