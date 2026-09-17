/** Low material relief growing exclusively on the land side of spatial tears. */
import { Raster } from './raster';
import { worldLandAt, worldWallAt } from './shape';
import type { WorldSample } from './types';
import { materialFieldAt } from './material-field';

type Point = readonly [number, number];
interface RimSeat { readonly x: number; readonly y: number; readonly nx: number; readonly ny: number }

function hash(value: number): number {
  let output = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  output = Math.imul(output ^ output >>> 15, 0x735a2d97);
  return (output ^ output >>> 15) >>> 0;
}

const DIRECTIONS = Array.from({ length: 8 }, (_, index) => ({ x: Math.cos(index * Math.PI / 4), y: Math.sin(index * Math.PI / 4) }));

function floorAt(sample: WorldSample, x: number, y: number): boolean {
  return worldLandAt(sample, x, y) && !worldWallAt(sample, x, y);
}

function seatsFor(sample: WorldSample, cells: readonly number[]): RimSeat[] {
  const { cols, tileSize } = sample;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const cell of cells) {
    const x = cell % cols * tileSize, y = Math.floor(cell / cols) * tileSize;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + tileSize); maxY = Math.max(maxY, y + tileSize);
  }
  const seats: RimSeat[] = [];
  for (let y = minY - 16; y <= maxY + 16; y += 8) for (let x = minX - 16; x <= maxX + 16; x += 8) {
    if (!floorAt(sample, x, y)) continue;
    let inwardX = 0, inwardY = 0, hits = 0;
    for (const direction of DIRECTIONS) {
      if (!worldWallAt(sample, x + direction.x * 11, y + direction.y * 11)) continue;
      inwardX += direction.x; inwardY += direction.y; hits++;
    }
    const length = Math.hypot(inwardX, inwardY);
    if (hits === 0 || length < .5) continue;
    const nx = -inwardX / length, ny = -inwardY / length;
    if (floorAt(sample, x + nx * 18, y + ny * 18)) seats.push({ x, y, nx, ny });
  }
  return seats;
}

function point(seat: RimSeat, along: number, across: number): Point {
  return [seat.x + seat.nx * along - seat.ny * across, seat.y + seat.ny * along + seat.nx * across];
}

function shifted(points: readonly Point[], x: number, y: number): Point[] {
  return points.map(p => [p[0] + x, p[1] + y]);
}

function paintStrata(raster: Raster, sample: WorldSample, seat: RimSeat, seed: number): void {
  const p = sample.profile.palette, width = 28 + seed % 43, layers = 1 + seed % 3;
  const direction = materialFieldAt(sample, seat.x, seat.y).direction;
  const bedSeat = { x: seat.x + seat.nx * 24, y: seat.y + seat.ny * 24,
    nx: Math.cos(direction), ny: Math.sin(direction) };
  // Fractured beds are inlaid in the ground plane. Broken partial edges replace
  // the bright parallel slab stack, which could read as a standing barricade.
  for (let layer = layers - 1; layer >= 0; layer--) {
    const random = hash(seed + layer), along = layer * 8 - 10, offset = random % 23 - 11;
    const extent = width * (.65 + (random >>> 8) % 35 / 100);
    const a = point(bedSeat, along, -extent * .5 + offset), b = point(bedSeat, along + 3, extent * .28 + offset);
    const c = point(bedSeat, along + 12, extent * .42 + offset), notch = point(bedSeat, along + 9, offset);
    const d = point(bedSeat, along + 17, -extent * .38 + offset);
    raster.polygon([a, b, c, notch, d], layer % 2 ? p.materialDark : p.floorLight);
    raster.line(b[0], b[1], c[0], c[1], p.materialDark);
    const edge = point(bedSeat, along + 1, -extent * .15 + offset);
    raster.line(a[0], a[1], edge[0], edge[1], p.materialMid);
    const split = point(bedSeat, along + 7, -extent * .07 + offset);
    raster.line(notch[0], notch[1], split[0], split[1], p.floorDeep);
  }
  for (let chip = 0; chip < 5; chip++) {
    const value = hash(seed + chip * 53), at = point(seat, 34 + value % 25, (value >>> 8) % 58 - 29);
    const shard: Point[] = [[at[0] - 4, at[1]], [at[0] + 8 + value % 8, at[1] - 3], [at[0] + 7, at[1] + 3], [at[0] - 5, at[1] + 3]];
    raster.polygon(shard, chip % 2 ? p.floorLight : p.materialDark);
  }
}

function paintCrystal(raster: Raster, sample: WorldSample, seat: RimSeat, seed: number): void {
  const p = sample.profile.palette, count = 3 + seed % 4, baseAngle = Math.atan2(seat.ny, seat.nx);
  // Lengths lie in the map plane. Crystal fans are shallow and walkable, not
  // tall blockers. Every polygon grows away from a supported land-side root.
  for (let shard = 0; shard < count; shard++) {
    const random = hash(seed ^ shard * 7919);
    const angle = baseAngle + (shard - (count - 1) / 2) * .27 + ((random >>> 12) % 15 - 7) / 100;
    const ux = Math.cos(angle), uy = Math.sin(angle), vx = -uy, vy = ux;
    const root = point(seat, 12 + shard % 2 * 5, (shard - (count - 1) / 2) * 3);
    let length = 18 + random % 25;
    const halfWidth = 5 + random % 6;
    const position = (distance: number, side: number): Point => [root[0] + ux * distance + vx * side, root[1] + uy * distance + vy * side];
    while (length > 12 && ![position(length, 0), position(length * .68, halfWidth), position(length * .68, -halfWidth)]
      .every(vertex => floorAt(sample, vertex[0], vertex[1]))) length -= 6;
    if (length <= 12 || !floorAt(sample, root[0], root[1])) continue;
    const a = position(0, -halfWidth * .55), b = position(length * .67, -halfWidth);
    const tip = position(length, 0), c = position(length * .72, halfWidth);
    const d = position(0, halfWidth * .62), ridge = position(length * .18, 0);
    const solid: Point[] = [a, b, tip, c, d];
    raster.polygon(shifted(solid, 1, 1), p.shadow);
    raster.polygon(solid, p.materialDark);
    raster.polygon([a, b, tip, ridge], shard % 2 ? p.materialLight : p.accentLight);
    raster.polygon([ridge, tip, c, d], shard % 2 ? p.materialMid : p.accent);
    raster.polygon([a, ridge, d], p.materialDark);
    const glint = position(length * .6, 0);
    raster.line(glint[0], glint[1], tip[0], tip[1], shard === 1 ? p.peak : p.faceLight);
    if (length > 26) {
      const crossA = position(length * .48, -halfWidth * .68), crossB = position(length * .54, halfWidth * .6);
      raster.line(crossA[0], crossA[1], crossB[0], crossB[1], p.materialMid);
    }
  }
  const root = point(seat, 13, 0);
  raster.polygon([[root[0] - 8, root[1] - 2], [root[0] + 8, root[1] - 4], [root[0] + 11, root[1] + 2],
    [root[0], root[1] + 6], [root[0] - 10, root[1] + 3]], p.materialDark);
  for (let chip = 0; chip < 7; chip++) {
    const value = hash(seed + chip * 683), at = point(seat, 28 + value % 65, (value >>> 8) % 62 - 31), w = 2 + value % 4;
    raster.polygon([[at[0] - w, at[1]], [at[0], at[1] - 2 - w], [at[0] + w * 2, at[1] + 2], [at[0], at[1] + w]], p.materialMid);
    raster.line(at[0], at[1] - w, at[0] + w, at[1], p.materialLight);
  }
}

function paintGlaze(raster: Raster, sample: WorldSample, seat: RimSeat, seed: number): void {
  const p = sample.profile.palette, width = 27 + seed % 31;
  const a = point(seat, 11, -width * .5), b = point(seat, 7, width * .18), c = point(seat, 18, width * .5);
  const d = point(seat, 31, width * .21), e = point(seat, 27, -width * .44);
  const notch = point(seat, 21, -width * .04);
  // One broad fractured skin with no shaded side face or enclosing drop shadow.
  raster.polygon([a, b, c, d, notch, e], p.floorLight);
  raster.line(c[0], c[1], d[0], d[1], p.materialMid);
  raster.line(d[0], d[1], notch[0], notch[1], p.floorDeep);
  const glint = point(seat, 9, -width * .20);
  raster.line(a[0], a[1], glint[0], glint[1], p.faceLight);
  const split = point(seat, 15, width * .07);
  raster.line(notch[0], notch[1], split[0], split[1], p.materialMid);
  const fracture = point(seat, 25, -width * .06), end = point(seat, 52, width * .22);
  raster.line(fracture[0], fracture[1], end[0], end[1], p.floorDeep);
  for (let chip = 0; chip < 4; chip++) {
    const value = hash(seed + chip * 71), at = point(seat, 35 + value % 30, (value >>> 9) % 50 - 25), w = 5 + value % 8;
    raster.polygon([[at[0] - w, at[1]], [at[0] + w, at[1] - 4], [at[0] + 3, at[1] + 6]], p.materialMid);
    raster.line(at[0] - w, at[1], at[0] + w, at[1] - 4, p.floorLight);
  }
}

export function paintMaterialForms(raster: Raster, sample: WorldSample, floorMask: Uint8Array): void {
  const { width, height } = raster, p = sample.profile.palette, material = sample.profile.material;
  const onFloor = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && floorMask[y * width + x] === 1;
  raster.setClip(onFloor);
  // Rim pixels are intact land. The absent side has neither faces nor light.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!floorMask[y * width + x]) continue;
    const hole = (dx: number, dy: number): boolean => !onFloor(x + dx, y + dy);
    if (hole(0, 3) || hole(3, 0) || hole(-3, 0) || hole(0, -3)) {
      raster.pixel(x, y, material === 'crystal' ? p.shadow : p.materialDark);
    } else if (material === 'glaze' && (hole(0, 8) || hole(7, 0) || hole(-7, 0))) raster.pixel(x, y, p.floorDeep);
  }
  for (const formation of sample.formations) {
    const seed = hash(sample.seed ^ formation.id * 0x45d9f3b), candidates = seatsFor(sample, formation.cells);
    if (candidates.length === 0) continue;
    const selected: RimSeat[] = [];
    const organization = materialFieldAt(sample, formation.center.x, formation.center.y);
    const desired = Math.round(1 + organization.front * 2 + organization.amount * (material === 'crystal' ? 2 : 1));
    candidates.sort((a, b) => {
      const left = materialFieldAt(sample, a.x, a.y), right = materialFieldAt(sample, b.x, b.y);
      return (right.front + right.amount * .35) - (left.front + left.amount * .35);
    });
    for (let attempt = 0; attempt < candidates.length && selected.length < desired; attempt++) {
      const candidate = candidates[attempt]!;
      if (selected.some(other => Math.hypot(other.x - candidate.x, other.y - candidate.y) < 60)) continue;
      selected.push(candidate);
      const variant = hash(seed + attempt);
      if (material === 'strata') paintStrata(raster, sample, candidate, variant);
      else if (material === 'crystal') paintCrystal(raster, sample, candidate, variant);
      else paintGlaze(raster, sample, candidate, variant);
    }
  }
  raster.setClip(null);
}
