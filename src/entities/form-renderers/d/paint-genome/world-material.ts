/** World material anatomy inside the Host's unchanged, authoritative paint field.
 * Colour and internal folds may move; this function never edits field or alpha
 * outside it, creates nuclei, or changes the registered contact cells.
 */
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { FormVisualPose } from '@/entities/form-renderers/form-renderer';
import type { EnemyWorldAdaptation } from '../world-adaptation';
import { ENV_INK, activityOf, putPixel, stageOf, type Ink } from '../environment-pixels';
import type { PaintGrowthGuide } from './bake';
import { PAINT_BREATH } from './live';

function positiveRemainder(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** Pure pixel baker, also used by the runtime attachment and DEV evidence. */
export function paintWorldSurfaceMaterial(
  out: Uint8ClampedArray, field: Float32Array, w: number, h: number,
  coverage: CoverageId, seed: number, elapsedMs: number, pose: FormVisualPose | undefined,
  world: EnemyWorldAdaptation, growth?: PaintGrowthGuide,
): void {
  out.fill(0);
  const activity = activityOf(pose);
  const phase = elapsedMs * PAINT_BREATH;
  const stage = stageOf(coverage);
  const seedPhase = ((seed >>> 0) % 997) * Math.PI * 2 / 997;
  const angle = (growth?.senseAngle ?? 0) + Math.sin(seedPhase) * .6;
  const cs = Math.cos(angle), sn = Math.sin(angle);
  const inflated = pose?.signal === 'inflated';

  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const index = y * w + x;
    const density = field[index]!;
    if (density < .1) continue;
    const unit = growth?.unitIndex[index] ?? 0;
    const ox = growth?.ox[unit] ?? w * .5;
    const oy = growth?.oy[unit] ?? h * .5;
    const span = Math.max(8, growth?.span[unit] ?? Math.min(w, h) * .3);
    const dx = x - ox, dy = y - oy;
    const u = dx * cs + dy * sn;
    const v = -dx * sn + dy * cs;
    const north = field[index - w]! < .1;
    const south = field[index + w]! < .1;
    const edge = north || south || field[index - 1]! < .1 || field[index + 1]! < .1;
    // Internal layer tension follows the same Host breath, with local lag.
    // No independently timed danger cue is introduced by the world profile.
    const tension = Math.sin(phase - unit * .71 - u / span * world.motionLag) * activity;
    let ink: Ink;

    if (world.kind === 'fibre') {
      // Two off-centre branch roots create successive gather/split regions.
      // The transverse coordinate expands after each root; bands are bundles
      // with a material side, not an evenly spaced screen-space stripe texture.
      const branch = v > span * .06 ? 1 : -1;
      const root = -span * (.2 + branch * .1);
      const reach = Math.max(0, u - root);
      const spread = 1 + reach / span * world.paintBranching;
      const bend = branch * reach * reach / span * .18;
      const pull = tension * Math.sin(Math.min(1, reach / span) * Math.PI) * 2.4;
      const bundle = (v - bend - pull + Math.sin(u * .105 + seedPhase + unit) * 1.8) / spread;
      const spacing = Math.max(4, 17 - world.fibreCount);
      const ridge = positiveRemainder(bundle + seedPhase * 2, spacing);
      const strand = positiveRemainder(bundle * 2.1 + u * .04, 3.4);
      ink = ridge < 1.2 ? world.light : ridge < 3.1 ? world.mid : world.dark;
      if (ridge > 3.1 && strand < .65) ink = world.mid;
      // Mineral threads are solid matter, not additional glowing emissions.
      const vein = positiveRemainder(bundle + seedPhase * 2, spacing * 3.4);
      if (vein < .8 && u > -span * .2 && u < span * .7) ink = world.secondary;
      if (north) ink = world.mid;
      if (south) ink = world.dark;
    } else if (world.kind === 'membrane') {
      // Unequal overlapping panels are stretched between displaced anchors.
      // Broad surfaces stay quiet; thickness is concentrated in folded lips.
      const side = Math.tanh((u / span - .12) * 3);
      const stretch = 1 + world.membraneSpread * .22;
      const reach = u - side * span * .18;
      const bow = reach * reach / span * (.24 + side * .1);
      const pull = tension * Math.sin(v / span * 2.3 + side) * 3.4;
      const panel = v * stretch + bow + pull + Math.sin(u * .055 + seedPhase) * 2.3;
      const width = 16 + world.membraneSpread * 6 + side * 3;
      const fold = positiveRemainder(panel + seedPhase * 4 + unit * 5, width);
      // Each crease narrows into its own displaced anchor. Smooth anchor
      // blending avoids a ruler-cut termination where adjacent panels meet.
      const end = (u + Math.sin(unit * 1.7 + seedPhase) * span * .16) / (span * .95);
      const taper = Math.max(0, 1 - end * end);
      ink = fold < 1.6 * taper ? world.light : fold < 4.8 * taper ? world.mid
        : fold > width - 5.5 * taper ? world.dark : world.mid;
      // A secondary material is visible in occasional stretched inner panels,
      // never around a whole perimeter or as a fake hittable centre.
      if (fold > width * .42 && fold < width * (.42 + .11 * taper) && side < -.35)
        ink = world.secondary;
      const rim = y > 2 && field[index - w * 2]! < .1;
      if (rim && !north) ink = world.light;
      if (north) ink = world.mid;
      if (south) ink = world.dark;
    } else {
      // Material cells use local Host coordinates and stable seed; no frame noise.
      // Their folds follow the existing breath and cannot add contact territory.
      const wave = tension * world.motionLag * 5;
      if (world.kind === 'slab') {
        const row = Math.floor((v + wave) / (10 + world.fibreCount));
        const seam = positiveRemainder(v + wave + row * .8, 10 + world.fibreCount);
        const end = positiveRemainder(u + row * 9 + seedPhase * 3, 25);
        ink = seam < 1.4 || end < 1 ? world.dark : seam < 3.5 ? world.light : world.mid;
        if (end > 18 && seam > 5 && row % 3 === 0) ink = world.secondary;
      } else if (world.kind === 'shell') {
        const row = Math.floor(v / 19), col = Math.floor((u + row * 9) / 26);
        const a = positiveRemainder(u + row * 9, 26) - 13;
        const b = positiveRemainder(v, 19) - 9.5;
        const bowl = a*a / 169 + b*b / 90;
        const fracture = Math.abs(a - b * .7 - Math.sin(col + seedPhase) * 3);
        ink = bowl > .92 || fracture < 1 ? world.dark : bowl > .68 ? world.light : world.mid;
        if (bowl < .35 && col % 3 === 0) ink = world.secondary;
      } else if (world.kind === 'granular') {
        const row = Math.floor(v / 7), col = Math.floor((u + row * 3) / 9);
        const a = positiveRemainder(u + row * 3, 9), b = positiveRemainder(v, 7);
        const lump = positiveRemainder(col * 13 + row * 7 + seed, 11);
        ink = a < 1.4 || b > 5.5 ? world.dark : b < 2 && a < 6 ? world.light : world.mid;
        if (lump < 2 && b > 2) ink = world.secondary;
      } else {
        const flow = v + Math.sin(u * .06 + seedPhase) * 7 + wave;
        const pool = positiveRemainder(flow, 25 + world.membraneSpread * 4);
        ink = pool < 1.3 ? world.light : pool < 6 ? world.mid : world.dark;
        if (pool > 19 && pool < 22 && u > -span*.4) ink = world.secondary;
      }
      if (north) ink = world.mid;
      if (south) ink = world.dark;
    }

    // Preserve the existing small contamination loci. Host still paints the
    // only hittable nuclei at their actual positions; these are material marks.
    if (density >= .78) ink = activity > .35 && stage > 0
      ? (inflated ? ENV_INK.lit : ENV_INK.teal) : world.mid;
    if (edge && ink === ENV_INK.teal) ink = world.mid;
    putPixel(out, w, h, x, y, ink);
  }
}
