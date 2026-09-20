/** Complete paint geometry: compare with an independently larger topology
 * canvas, then exercise the real breathing sampler before material edge guards.
 * This guards storage/deployment geometry; it does not certify aesthetics. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bakePaintGenome, paintGenomeCanvasOf } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { fillPaintTopology, makePaintField, resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { PAINT_BREATH, paintPaintGenomeLive } from '../../src/entities/form-renderers/d/paint-genome/live';

const substrates = ['fungal_mat', 'oil_film', 'ash_veil'] as const;
const continuities = ['monolith', 'colony', 'field'] as const;
const coverages = ['infiltrate', 'rewrite', 'overwrite'] as const;
const seeds = [1, 1000, 6859, 0];
const legacyHash = createHash('sha256');
let cases = 0, frames = 0, recoveredBeyondOldCanvas = 0;
for (const substrate of substrates) for (const continuity of continuities)
  for (const coverage of coverages) for (const seed of seeds) {
    if (seed === 0 && substrate !== 'oil_film') continue; // Explicit production beads coverage.
    const req = { substrate, continuity, coverage, seed, sense: 'sense_touch', rhythm: 'rhythm_cluster',
      veinVariant: resolvePaintVeinVariant(substrate, seed) };
    const old = bakePaintGenome({ ...req, geometryVersion: 1 });
    // Captured before the fix. Covers old field, colours, material pixels,
    // animation guides and seed-dependent production oil variants.
    if (seed !== 0) {
      legacyHash.update(JSON.stringify({ canvasW: old.canvasW, canvasH: old.canvasH, topology: old.topology, ramp: old.ramp }));
      legacyHash.update(old.buf.data); legacyHash.update(Buffer.from(old.field.buffer));
      legacyHash.update(JSON.stringify(old.growth));
    }
    assert.equal(old.terrainFootprintField, old.field, 'legacy danger/terrain cells remain unchanged');

    const current = bakePaintGenome(req);
    assert.equal(current.geometryVersion, 2);
    const authored = paintGenomeCanvasOf(continuity), span = Math.min(authored.w, authored.h);
    const raw = makePaintField(current.canvasW, current.canvasH, span);
    fillPaintTopology(raw, req);
    const offset = span;
    const reference = makePaintField(raw.w + offset * 2, raw.h + offset * 2, span);
    fillPaintTopology(reference, req);
    const original = makePaintField(authored.w, authored.h);
    fillPaintTopology(original, req);
    const shiftX = (raw.w - original.w) / 2, shiftY = (raw.h - original.h) / 2;
    assert(Number.isInteger(shiftX) && Number.isInteger(shiftY), 'integer padding preserves hard pixel coordinates');

    for (let y = 0; y < reference.h; y++) for (let x = 0; x < reference.w; x++) {
      const localX = x - offset, localY = y - offset;
      const expected = localX >= 0 && localY >= 0 && localX < raw.w && localY < raw.h
        ? raw.v[localY * raw.w + localX]! : 0;
      assert.equal(reference.v[y * reference.w + x], expected,
        `${substrate}/${continuity}/${coverage}/${seed}: no topology hidden outside the production canvas`);
    }
    for (let y = 1; y < original.h - 1; y++) for (let x = 1; x < original.w - 1; x++)
      assert.equal(raw.v[(y + shiftY) * raw.w + x + shiftX], original.v[y * original.w + x],
        'larger storage must preserve authored radii, satellite spacing and material scale');
    let recovered = 0;
    for (let y = 0; y < raw.h; y++) for (let x = 0; x < raw.w; x++) {
      if (raw.v[y * raw.w + x]! < 0.1) continue;
      if (x < shiftX || x >= shiftX + original.w || y < shiftY || y >= shiftY + original.h) recovered++;
    }
    if (recovered) recoveredBeyondOldCanvas++;

    if (seed === 1000 || seed === 0) {
      const scratch = new Float32Array(current.field.length), out = new Uint8ClampedArray(current.buf.data.length);
      // Include extrema and intermediate phases. Check the uncoloured field,
      // so a material painter clearing border alpha cannot conceal a crop.
      for (let step = 0; step <= 8; step++) {
        const elapsedMs = step * Math.PI / (4 * PAINT_BREATH);
        paintPaintGenomeLive({ rest: current.field, scratch, out, w: current.canvasW, h: current.canvasH,
          elapsedMs, inflated: true, ramp: current.ramp, growth: current.growth });
        for (let y = 0; y < current.canvasH; y++) for (let x = 0; x < current.canvasW; x++) {
          const i = y * current.canvasW + x;
          if (scratch[i]! < 0.1 && out[i * 4 + 3] === 0) continue;
          assert(x > 1 && y > 1 && x < current.canvasW - 2 && y < current.canvasH - 2,
            'rest and breathing bodies, including flakes, must not touch storage edges');
          assert(current.terrainFootprintField[i]! >= 0.1,
            'every visible breathing pixel is inside the placement terrain reservation');
        }
        frames++;
      }
    }
    cases++;
  }
assert.equal(legacyHash.digest('hex'), '1cf6fa25bf5e9283e12c3936a8a1c9524c13f8af03d9a27a8ee08c104c0bda8d',
  'geometry v1 must remain byte-identical for in-flight saves');
assert(recoveredBeyondOldCanvas > 40, 'regression covers the actual formerly cut satellite bodies');
console.log(JSON.stringify({ cases, frames, recoveredBeyondOldCanvas, legacyByteIdentical: true }));
console.log('check:paint-full-footprint OK');
