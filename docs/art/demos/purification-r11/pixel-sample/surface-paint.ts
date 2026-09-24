import { MATERIALS, type Material, type PixelLayer, type Point } from './raster';

type Surface = 'upright' | 'ground';
type Brush = 'plaster' | 'crust' | 'exposed' | 'dust' | 'polish';

interface Deposit {
  readonly at: Point;
  readonly radius: Point;
  readonly turn?: number;
  readonly tone: number;
  readonly brush: Brush;
  readonly phase?: number;
  readonly reveal?: Material;
}

interface WaterPath {
  readonly points: readonly Point[];
  readonly width: number;
  readonly tone: number;
}

interface SurfacePaint {
  readonly bounds: readonly [number, number, number, number];
  readonly surface: Surface;
  readonly deposits: readonly Deposit[];
  readonly water?: readonly WaterPath[];
  readonly materials?: readonly Material[];
}

const WORLD_SCALE = .625;
const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, value));
const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Connected clusters at three scales. This is a local brush shape, not a hash
 * of image coordinates. It is evaluated only inside authored material incidents.
 * Coarse forms dominate; small aggregates are confined to exposed/crusted areas.
 */
function depositTone(x: number, y: number, deposit: Deposit, surface: Surface): number {
  const angle = deposit.turn ?? 0, cs = Math.cos(angle), sn = Math.sin(angle);
  const dx = x - deposit.at[0], dy = y - deposit.at[1];
  const u = dx * cs + dy * sn, v = dy * cs - dx * sn;
  const radial = (u / deposit.radius[0]) ** 2 + (v / deposit.radius[1]) ** 2;
  if (radial > 1.65) return 0;
  const phase = deposit.phase ?? 0;
  // The low field joins several lobes; the middle field breaks their boundaries
  // into coherent flakes. No per-pixel random term is added to intact surfaces.
  const low = Math.sin(u / 17 + phase + Math.sin(v / 23) * .7) * .55
    + Math.cos(v / 19 - phase * .7 + u / 51) * .45;
  const middle = Math.sin(u / 5.7 + Math.sin(v / 8.1) * .8 + phase) * .58
    + Math.cos(v / 6.4 - u / 16.3 + phase * 1.3) * .42;
  const contour = radial + low * .19 + middle * .065;
  const softEnvelope = smooth((1.18 - contour) / .48);
  const envelope = deposit.brush === 'dust' || deposit.brush === 'polish'
    ? softEnvelope : Math.round(softEnvelope * 5) / 5;
  if (!envelope) return 0;

  if (deposit.brush === 'polish') {
    const swept = .82 + .12 * Math.sin(u / 12 + v / 3.6 + phase);
    return deposit.tone * envelope * swept;
  }
  if (deposit.brush === 'dust') {
    const bank = .68 + .23 * low + .10 * middle;
    return deposit.tone * envelope * bank;
  }
  if (deposit.brush === 'plaster') {
    const sheets = Math.round((low * .62 + middle * .22) * 5) / 5;
    return deposit.tone * envelope + envelope * sheets * (surface === 'ground' ? .35 : .56);
  }

  // Dry-brush fragments follow the material's shear direction. Unequal broken
  // runs replace rounded nodules: the floor must read as a worn plane.
  const cellU = Math.floor(u / 3.2) * 3.2;
  const cellV = Math.floor(v / 1.6) * 1.6;
  const run = Math.sin(cellU / 11.7 + Math.floor(cellV / 5.4) * 1.7 + phase);
  const seam = cellV + Math.floor(cellU / 9.3 + phase) * .8 - cellU * .08;
  const shard = Math.sin(seam / 2.7 + phase) > .1 && run > -.25 ? 1 : 0;
  const dry = Math.sin(seam / 2.7 + phase) > .72 && run > .38 ? 1 : 0;
  const relief = deposit.brush === 'crust'
    ? shard * .28 - dry * .30
    : -shard * .36 + dry * .22;
  return envelope * (deposit.tone * (.75 + low * .16) + relief);
}

/** The coat has a physical edge and exposed mineral islands. This discrete
 * material boundary is independent of the continuous light calculated later.
 */
function revealedMaterial(x: number, y: number, deposit: Deposit, surface: Surface): readonly [number, number] {
  if (!deposit.reveal) return [0, 0];
  const angle = deposit.turn ?? 0, cs = Math.cos(angle), sn = Math.sin(angle);
  const dx = x - deposit.at[0], dy = y - deposit.at[1];
  const u = dx * cs + dy * sn, v = dy * cs - dx * sn;
  const radial = (u / deposit.radius[0]) ** 2 + (v / deposit.radius[1]) ** 2;
  if (radial > 1.12) return [0, 0];
  const p = deposit.phase ?? 0;
  const ground = surface === 'ground';
  const pitch = ground ? 8.7 : 12.3;
  const qU = Math.floor(u / 2.4) * 2.4;
  const qV = Math.floor(v / 1.6) * 1.6;
  const shifted = qV + Math.floor(qU / (ground ? 11.3 : 7.7) + p) * 1.2 - qU * .07;
  const lane = Math.floor(shifted / pitch + p);
  const inLane = ((shifted / pitch + p) % 1 + 1) % 1;
  const run = Math.sin(qU / (ground ? 16.7 : 12.8) + lane * 1.9 + p)
    + Math.cos(qU / 7.9 - lane * .7 + p) * .28;
  const broken = run > -.22 + radial * .50;
  const plate = broken && inLane > .15 && inLane < (ground ? .49 : .64);
  // Only short edges catch light. The opposite edge is usually lost; there is
  // deliberately no enclosing rim around either an incident or a flake.
  const dryLip = broken && run > .50 && inLane > .15 && inLane < .28;
  const undercut = run > .12 && run < .46 && inLane > .61 && inLane < .74;
  const edgeTone = (dryLip ? (ground ? .38 : .57) : 0) - (undercut ? (ground ? .16 : .31) : 0);
  return [plate ? MATERIALS.indexOf(deposit.reveal) + 1 : 0, edgeTone];
}

function pathTone(x: number, y: number, path: WaterPath): number {
  let nearest = Infinity, along = 0;
  for (let j = 1; j < path.points.length; j++) {
    const a = path.points[j - 1]!, b = path.points[j]!;
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const t = clamp(((x - a[0]) * vx + (y - a[1]) * vy) / (vx * vx + vy * vy));
    const distance = Math.hypot(x - a[0] - vx * t, y - a[1] - vy * t);
    if (distance < nearest) { nearest = distance; along = (j - 1 + t) / (path.points.length - 1); }
  }
  const width = path.width * (1 - along * .6);
  if (nearest >= width * 1.55) return 0;
  const wet = smooth(1 - nearest / width) * (1 - along * .5);
  const dryRim = Math.max(0, 1 - Math.abs(nearest - width * .94) / (width * .4)) * .17;
  return path.tone * wet + dryRim;
}

/** Repaints tone and locally revealed substrate on occupied, allowed surfaces.
 * Alpha/normal/light/emission and all non-target materials are preserved.
 */
function paint(layer: PixelLayer, field: SurfacePaint): void {
  const allowed = new Set((field.materials ?? ['concrete', 'chalk', 'paint']).map(material => MATERIALS.indexOf(material) + 1));
  const [left, top, right, bottom] = field.bounds;
  for (let py = Math.max(0, Math.floor(top * WORLD_SCALE)); py < Math.min(layer.height, Math.ceil(bottom * WORLD_SCALE)); py++) {
    for (let px = Math.max(0, Math.floor(left * WORLD_SCALE)); px < Math.min(layer.width, Math.ceil(right * WORLD_SCALE)); px++) {
      const i = py * layer.width + px;
      if (!allowed.has(layer.mat[i]!)) continue;
      const isGround = layer.normalZ[i]! > 88;
      if ((field.surface === 'ground') !== isGround) continue;
      const x = (px + .5) / WORLD_SCALE, y = (py + .5) / WORLD_SCALE;
      let delta = 0, revealed = 0;
      for (const deposit of field.deposits) {
        delta += depositTone(x, y, deposit, field.surface);
        const mineral = revealedMaterial(x, y, deposit, field.surface);
        revealed = mineral[0] || revealed;
        delta += mineral[1];
      }
      for (const water of field.water ?? []) delta += pathTone(x, y, water);
      // Tone stepping belongs to the paint, not to alpha. A quiet field receives
      // no change at all; painted fields retain bounded sub-tone relief.
      if (delta !== 0) layer.tone[i] = clamp(layer.tone[i]! + Math.round(clamp(delta, -1.3, 1.3) * 12) / 12, 0, 7);
      if (revealed) layer.mat[i] = revealed;
    }
  }
}

/** Break the existing flat patch boundaries into actual lifted coat fragments.
 * Neighbor transfers are allowed only across coplanar occupied masonry; a wall
 * turn, structural silhouette, empty opening or metal detail is never crossed.
 */
function chipCoatEdges(layer: PixelLayer, bounds: readonly [number, number, number, number], surface: Surface): void {
  const source = layer.mat.slice(), tones = layer.tone.slice();
  const coat = new Set([MATERIALS.indexOf('chalk') + 1, MATERIALS.indexOf('paint') + 1]);
  const substrate = MATERIALS.indexOf('concrete') + 1;
  const [left, top, right, bottom] = bounds;
  const offsets = [[0, 1], [0, -1], [-1, 0], [1, 0], [-2, 1], [2, -1], [0, 3], [-3, 0], [3, 1]] as const;
  for (let y = Math.max(3, Math.floor(top * WORLD_SCALE)); y < Math.min(layer.height - 3, Math.ceil(bottom * WORLD_SCALE)); y++) {
    for (let x = Math.max(3, Math.floor(left * WORLD_SCALE)); x < Math.min(layer.width - 3, Math.ceil(right * WORLD_SCALE)); x++) {
      const i = y * layer.width + x, material = source[i]!;
      if (material !== substrate && !coat.has(material)) continue;
      if ((surface === 'ground') !== (layer.normalZ[i]! > 88)) continue;
      const grouping = Math.sin(x / 6.8 + Math.sin(y / 9.3)) * .58 + Math.cos(y / 5.4 - x / 12.7) * .42;
      for (const [dx, dy] of offsets) {
        const next = i + dy * layer.width + dx, neighbor = source[next]!;
        if (neighbor === material || (neighbor !== substrate && !coat.has(neighbor))) continue;
        if (Math.abs(layer.normalX[i]! - layer.normalX[next]!) > 8
          || Math.abs(layer.normalY[i]! - layer.normalY[next]!) > 8
          || Math.abs(layer.normalZ[i]! - layer.normalZ[next]!) > 8) continue;
        const depth = Math.hypot(dx, dy);
        if (coat.has(material) && neighbor === substrate && grouping > -.1 + depth * .12) {
          layer.mat[i] = substrate;
          layer.tone[i] = clamp(tones[next]! - .25, 0, 7);
        } else if (material === substrate && coat.has(neighbor) && grouping < -.38 - depth * .1) {
          layer.mat[i] = neighbor;
          layer.tone[i] = clamp(tones[next]! - .15, 0, 7);
        } else if (depth < 1.5 && coat.has(material) && grouping > .25) {
          layer.tone[i] = clamp(tones[i]! + (dy >= 0 ? .40 : -.23), 0, 7);
        }
        break;
      }
    }
  }
}

export function paintMasonry(layer: PixelLayer): void {
  chipCoatEdges(layer, [253, 323, 753, 536], 'upright');
  paint(layer, {
    surface: 'upright', bounds: [253, 323, 753, 536],
    deposits: [
      { at: [292, 374], radius: [30, 51], brush: 'plaster', tone: .46, phase: .4, reveal: 'chalk' },
      { at: [301, 436], radius: [27, 28], brush: 'exposed', tone: -.45, phase: 1.8, reveal: 'concrete' },
      { at: [289, 497], radius: [30, 35], brush: 'crust', tone: .68, phase: 2.4, reveal: 'chalk' },
      { at: [310, 468], radius: [11, 17], brush: 'crust', tone: .28, phase: -.7 },
      { at: [375, 383], radius: [23, 48], brush: 'plaster', tone: .49, phase: 2.1, reveal: 'concrete' },
      { at: [380, 448], radius: [19, 34], brush: 'exposed', tone: -.35, phase: .2, reveal: 'concrete' },
      { at: [375, 503], radius: [21, 29], brush: 'crust', tone: .62, phase: -.9, reveal: 'chalk' },
      { at: [438, 381], radius: [33, 50], brush: 'plaster', tone: .20, phase: 3.4, reveal: 'chalk' },
      { at: [431, 456], radius: [30, 42], brush: 'crust', tone: .61, phase: 1.2, reveal: 'chalk' },
      { at: [451, 491], radius: [26, 23], brush: 'exposed', tone: -.30, phase: -1.4 },
      { at: [492, 383], radius: [24, 49], brush: 'plaster', tone: .43, phase: 4.1, reveal: 'chalk' },
      { at: [499, 452], radius: [25, 38], brush: 'exposed', tone: -.37, phase: .6, reveal: 'concrete' },
      { at: [493, 496], radius: [31, 26], brush: 'crust', tone: .65, phase: 1.7, reveal: 'chalk' },
      { at: [553, 373], radius: [34, 29], brush: 'crust', tone: .49, phase: -2.1, reveal: 'chalk' },
      { at: [581, 416], radius: [42, 49], brush: 'exposed', tone: -.26, phase: 2.9, reveal: 'concrete' },
      { at: [560, 464], radius: [27, 26], brush: 'plaster', tone: .27, phase: .4 },
      { at: [612, 488], radius: [51, 24], brush: 'crust', tone: .75, phase: 1.4, reveal: 'chalk' },
      { at: [645, 422], radius: [29, 49], brush: 'plaster', tone: .53, phase: -1.2, reveal: 'chalk' },
      { at: [647, 463], radius: [30, 23], brush: 'exposed', tone: -.34, phase: 3.2 },
      { at: [691, 399], radius: [18, 43], brush: 'plaster', tone: .41, phase: .3, reveal: 'concrete' },
      { at: [691, 480], radius: [22, 21], brush: 'crust', tone: .64, phase: 2.3, reveal: 'chalk' },
      { at: [731, 448], radius: [16, 28], brush: 'exposed', tone: -.21, phase: -1.8 },
    ],
    water: [
      { points: [[743, 345], [739, 377], [741, 404], [736, 442]], width: 9, tone: -.52 },
      { points: [[695, 436], [694, 449], [697, 468], [694, 484]], width: 6, tone: -.36 },
      { points: [[278, 525], [351, 516], [413, 518], [481, 512], [559, 516], [640, 502]], width: 8, tone: -.29 },
    ],
  });
}

export function paintFloorAndLedge(layer: PixelLayer): void {
  chipCoatEdges(layer, [253, 580, 890, 743], 'ground');
  chipCoatEdges(layer, [253, 519, 676, 605], 'upright');
  paint(layer, {
    surface: 'ground', bounds: [253, 580, 890, 743],
    deposits: [
      { at: [315, 631], radius: [69, 24], turn: -.25, brush: 'exposed', tone: -.16, phase: .8, reveal: 'concrete' },
      { at: [400, 672], radius: [63, 22], turn: .24, brush: 'plaster', tone: .24, phase: 2.3, reveal: 'chalk' },
      { at: [482, 626], radius: [55, 24], turn: .24, brush: 'exposed', tone: -.33, phase: 1.4, reveal: 'concrete' },
      { at: [554, 668], radius: [68, 24], turn: .22, brush: 'exposed', tone: -.23, phase: -1.6, reveal: 'concrete' },
      { at: [649, 620], radius: [60, 22], turn: .22, brush: 'dust', tone: .28, phase: -.4 },
      { at: [746, 648], radius: [56, 20], turn: -.32, brush: 'plaster', tone: .29, phase: 3.7, reveal: 'chalk' },
      { at: [474, 677], radius: [44, 14], turn: -.46, brush: 'polish', tone: .46, phase: .9 },
      { at: [515, 651], radius: [37, 14], turn: -.38, brush: 'polish', tone: .37, phase: 3.1 },
      { at: [559, 635], radius: [43, 11], turn: .12, brush: 'polish', tone: .29, phase: 2.5 },
      { at: [689, 646], radius: [33, 12], turn: .14, brush: 'polish', tone: .22, phase: -1.1 },
      { at: [461, 609], radius: [33, 11], turn: .15, brush: 'dust', tone: .44, phase: 4.4 },
      { at: [515, 590], radius: [35, 12], turn: .12, brush: 'dust', tone: .45, phase: .6 },
      { at: [579, 609], radius: [32, 10], turn: .19, brush: 'crust', tone: .40, phase: 1.8, reveal: 'chalk' },
      { at: [809, 656], radius: [46, 13], turn: -.34, brush: 'dust', tone: .47, phase: -2.2 },
      { at: [742, 684], radius: [46, 12], turn: -.32, brush: 'dust', tone: .33, phase: 1.4 },
      { at: [675, 710], radius: [41, 11], turn: -.31, brush: 'exposed', tone: -.47, phase: 3.5, reveal: 'concrete' },
      { at: [559, 705], radius: [31, 9], turn: .23, brush: 'dust', tone: .38, phase: -.7 },
      { at: [348, 701], radius: [40, 11], turn: -.25, brush: 'dust', tone: .28, phase: 2.9 },
      { at: [618, 667], radius: [22, 10], turn: -.2, brush: 'exposed', tone: -.36, phase: -.3 },
      { at: [676, 675], radius: [29, 10], turn: .25, brush: 'crust', tone: .44, phase: 1.1, reveal: 'chalk' },
      { at: [553, 681], radius: [57, 12], turn: .22, brush: 'crust', tone: .31, phase: 2.8, reveal: 'chalk' },
      { at: [789, 632], radius: [41, 10], turn: -.32, brush: 'exposed', tone: -.23, phase: -.6, reveal: 'concrete' },
      { at: [643, 607], radius: [19, 8], turn: .14, brush: 'dust', tone: .12, phase: 2.6, reveal: 'rust' },
    ],
  });
  paint(layer, {
    surface: 'upright', bounds: [253, 519, 676, 605],
    deposits: [
      { at: [293, 556], radius: [31, 24], brush: 'crust', tone: .68, phase: 1.2, reveal: 'chalk' },
      { at: [360, 552], radius: [31, 21], brush: 'plaster', tone: -.21, phase: 3.4 },
      { at: [505, 552], radius: [24, 26], brush: 'exposed', tone: -.36, phase: -.7, reveal: 'concrete' },
      { at: [557, 563], radius: [26, 29], brush: 'crust', tone: .62, phase: 2.4, reveal: 'chalk' },
      { at: [591, 581], radius: [23, 15], brush: 'exposed', tone: -.36, phase: .3 },
      { at: [633, 567], radius: [21, 20], brush: 'plaster', tone: .32, phase: 4.2 },
    ],
    water: [{ points: [[535, 538], [533, 556], [535, 581]], width: 4, tone: -.31 }],
  });
  paint(layer, {
    surface: 'ground', bounds: [630, 451, 823, 544],
    deposits: [
      { at: [668, 515], radius: [28, 9], turn: -.63, brush: 'polish', tone: .32, phase: 1.3 },
      { at: [713, 490], radius: [34, 10], turn: -.62, brush: 'exposed', tone: -.25, phase: 2.1, reveal: 'concrete' },
      { at: [697, 529], radius: [29, 6], turn: -.63, brush: 'dust', tone: .25, phase: .7 },
      { at: [733, 491], radius: [25, 7], turn: -.63, brush: 'crust', tone: .34, phase: 1.3, reveal: 'chalk' },
      { at: [768, 475], radius: [24, 9], turn: -.6, brush: 'plaster', tone: .29, phase: -.2, reveal: 'chalk' },
      { at: [663, 528], radius: [25, 7], turn: -.6, brush: 'exposed', tone: -.16, phase: -1.8, reveal: 'concrete' },
    ],
  });
}

export function paintNearMasonry(layer: PixelLayer): void {
  chipCoatEdges(layer, [813, 340, 933, 784], 'upright');
  paint(layer, {
    surface: 'upright', bounds: [813, 340, 933, 784],
    deposits: [
      { at: [834, 361], radius: [21, 24], brush: 'exposed', tone: -.32, phase: 2.2 },
      { at: [864, 403], radius: [29, 38], brush: 'plaster', tone: .37, phase: -.8 },
      { at: [853, 444], radius: [18, 37], brush: 'crust', tone: .78, phase: 1.3, reveal: 'chalk' },
      { at: [891, 463], radius: [13, 29], brush: 'exposed', tone: -.29, phase: 3.4 },
      { at: [855, 510], radius: [16, 30], brush: 'plaster', tone: -.27, phase: .6 },
      { at: [875, 530], radius: [20, 27], brush: 'crust', tone: .62, phase: -1.5, reveal: 'chalk' },
      { at: [872, 579], radius: [23, 29], brush: 'exposed', tone: -.38, phase: 2.8, reveal: 'concrete' },
      { at: [852, 618], radius: [20, 17], brush: 'crust', tone: .85, phase: -.4, reveal: 'chalk' },
      { at: [876, 670], radius: [17, 27], brush: 'crust', tone: .60, phase: 3.1, reveal: 'chalk' },
      { at: [901, 739], radius: [21, 23], brush: 'exposed', tone: -.27, phase: 1.6 },
    ],
    water: [{ points: [[865, 451], [869, 476], [864, 507], [866, 531]], width: 5, tone: -.29 }],
  });
}

export function paintApproach(layer: PixelLayer): void {
  chipCoatEdges(layer, [290, 697, 551, 788], 'ground');
  paint(layer, {
    surface: 'ground', bounds: [290, 697, 551, 788],
    deposits: [
      { at: [406, 763], radius: [40, 16], turn: -.60, brush: 'polish', tone: .36, phase: 1.8 },
      { at: [449, 728], radius: [28, 13], turn: -.6, brush: 'polish', tone: .31, phase: -.2 },
      { at: [482, 752], radius: [35, 11], turn: -.63, brush: 'dust', tone: .43, phase: 3.1 },
      { at: [436, 765], radius: [23, 17], turn: .24, brush: 'exposed', tone: -.20, phase: -.7 },
    ],
  });
}
