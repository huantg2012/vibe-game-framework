/** A transported organic load. Thick folds shift weight; no head, paired hands,
 * insect stilts or human replacement. Versioned separately from remnant18. */
import { createModelRaster, modelProgress, smoothModel, type CreatureModelRequest, type ModelPoint as V } from './model-raster';
import { remnantVariantOf } from './remnant-model';
import { tissueMass, tissueTendon, tissueAt } from './native-tissue';
import { BODY_INKS } from './body-pixel-material';

export function bakeNativeRemnant(req: CreatureModelRequest) {
  const world = req.worldAdaptation;
  if (!world) throw new Error('Native remnant requires a frozen material profile');
  const v = remnantVariantOf(req.seed), level = req.coverage === 'infiltrate' ? 0 : req.coverage === 'rewrite' ? 1 : 2;
  const r = createModelRaster({ ...req, nativeCoverage: [.22, .58, .96][level] }, 'native-remnant');
  const p = modelProgress(req.phase01), phase = p === 1 ? 0 : p;
  const clock = phase * Math.PI * 2;
  const walking = req.phase === 'walk';
  const gather = req.phase === 'windup' ? smoothModel(p) : 0;
  const strike = req.phase === 'strike' ? 1 - .2 * smoothModel(p) : req.phase === 'recover' ? .8 * (1 - smoothModel(p)) : 0;
  const sway = walking ? Math.sin(clock) : Math.sin(clock) * .12;
  const lag = walking ? Math.sin(clock - world.motionLag * Math.PI * 2) : sway;
  const forward = strike * 6 - gather * 2.4;
  const height = (v === 1 ? 13 + level : v === 0 ? 8 + level * .8 : 6.5 + level * .7) - gather * 1.3 - strike * .6 + (walking ? Math.abs(sway) * .4 : Math.sin(clock) * .25);
  const center: V = [sway * (.45 + level * .2), forward, height];
  // Unequal, broad fold contacts; these carry the entire body, not thin legs.
  const contacts: V[] = [[-9.7, 4.5 + (walking ? sway * 2.2 : 0), 1], [7.5, -2.5 - (walking ? sway * 1.8 : 0), 1], [-1.5, -9 + (walking ? lag : 0), 1.2]];
  for (let i = 0; i < contacts.length; i++) {
    const foot = contacts[i]!;
    r.mass(foot, [i === 2 ? 4.1 : 3.8, i === 2 ? 3 : 4, 1.1], BODY_INKS.hide[1]);
    tissueTendon(r, world, foot, tissueAt(center, (i === 0 ? -1 : i === 1 ? 1 : 0) * (v === 0 ? 5.3 : 3.8), i === 2 ? -3 : 1, -height * .33), 3.6, level);
  }
  if (v === 0) {
    // Wide mantle folds forward around a recessed, unlit inner surface.
    tissueMass(r, world, tissueAt(center, -4.1, -1.1, -.4), [6, 6.5, 6.7], level, req.seed);
    tissueMass(r, world, tissueAt(center, 4.3, -.7, 1 + level * .6), [5.3, 6, 6.2], level, req.seed + 1);
    r.mass(tissueAt(center, -.3, 4.6, -3.7), [5.5, 3.4, 2.2], BODY_INKS.soot[0]);
    tissueTendon(r, world, tissueAt(center, -5, 4, -3), tissueAt(center, 5, 4, -4.3), 1.6, level);
    if (level > 0) tissueMass(r, world, tissueAt(center, -7, 1, 2 + level * 1.4), [3.2, 3.8, 3 + level], level, req.seed + 8);
  } else if (v === 1) {
    // Tapered upper load hanging between sloping, thick supports.
    tissueMass(r, world, tissueAt(center, -1.2 - level * .4, -1.4, 0), [6.3, 5.3, 7.8], level, req.seed);
    tissueMass(r, world, tissueAt(center, 3.3, 1.5 + lag * .6, -7), [4.7, 4.5, 5.2], level, req.seed + 1);
    tissueTendon(r, world, tissueAt(center, -4, 0, 2.5), contacts[0]!, 2.1, level);
  } else {
    // Two unequal burdens share a low belly and drag their rear folds.
    tissueMass(r, world, tissueAt(center, -4.8, 1.6, 1.5), [6, 6.5, 5.8], level, req.seed);
    tissueMass(r, world, tissueAt(center, 4.8, -2 + lag, -1.5), [6, 7, 4.8], level, req.seed + 1);
    tissueTendon(r, world, tissueAt(center, -4, 3, -3), tissueAt(center, 5, 3, -3.6), 2.6, level);
  }
  r.finish();
  return { buf: r.buf, canvas: r.canvas, lightingSurface: r.lightingSurface };
}
