import assert from 'node:assert/strict';
import { supportsRuntimeForm } from '../../src/generation/contamination-draw';
import { INSPECTOR_ENTRIES, actionsFor, actionDuration, inspectorForm } from '../../src/gym/enemy-inspector-catalog';
import { productionModelFor } from '../../src/entities/form-renderers/d/production-models';
import { FAMILY_CAPABILITY_DATA } from '../../src/generated/contamination-family-data';
import { SUBSTRATE_DATA } from '../../src/generated/contamination-lexicon-data';
import { generateRiftLayout } from '../../src/generation/rift-layout';
import { PREVIEW_RECIPES } from '../../src/generation/recipes';
const expected = FAMILY_CAPABILITY_DATA.filter(f => SUBSTRATE_DATA[f.substrate]?.enabledScope === 'sortie');
assert.deepEqual(new Set(INSPECTOR_ENTRIES.map(e => e.id)), new Set(expected.map(f => f.id)));
assert.equal(INSPECTOR_ENTRIES.filter(e => e.family.portfolio === 'jia').reduce((n, e) => n + e.variants.length, 0), 14);
assert.equal(INSPECTOR_ENTRIES.length, 13);
assert(!INSPECTOR_ENTRIES.some(e => e.family.portfolio === 'yi' || ['street_wreckage', 'light_scatter', 'space_interval'].includes(e.family.substrate)));
assert.deepEqual(new Set(INSPECTOR_ENTRIES.filter(e => e.family.portfolio === 'ding').map(e => e.family.substrate)),
    new Set(['sound_echo', 'gas_mass', 'mist_bank', 'dust_swarm']));
for (const recipe of PREVIEW_RECIPES) {
    const layout = generateRiftLayout(18, { recipeId: recipe.id });
    assert(layout.contaminationPins.corridorAabbs.length > 0, `${recipe.id}: volume bodies need a real context seat`);
    assert(layout.contaminationPins.paintFloors.length > 0, `${recipe.id}: paint context seat`);
}
let frames = 0;
for (const entry of INSPECTOR_ENTRIES) {
    const actions = actionsFor(entry);
    for (const action of actions)
        assert(actionDuration(entry, action) > 0);
    for (const coverage of ['infiltrate', 'rewrite', 'overwrite'] as const) {
        const form = inspectorForm(entry, coverage);
        assert(supportsRuntimeForm(form), `${entry.id}/${coverage}: not production legal`);
        assert(SUBSTRATE_DATA[form.substrate]!.legalOccupancies.includes(form.occupancy));
        assert(SUBSTRATE_DATA[form.substrate]!.legalContinuities.includes(form.continuity));
        for (const slot of ['motion', 'sense', 'rhythm', 'contact'] as const)
            assert(entry.family[slot].includes(form.lexemes[slot]));
        const model = form.portfolio === 'jia' ? productionModelFor(form.substrate) : undefined;
        if (!model)
            continue;
        const identities = new Set<string>();
        for (const variant of entry.variants) {
            identities.add(Buffer.from(model.bake({ seed: variant.seed, coverage, facing4: 'right', phase: 'idle', phase01: 0 }).buf.data).toString('base64'));
            for (const facing4 of ['up', 'right', 'down', 'left'] as const)
                for (const action of actions)
                    for (const progress of [0, .5, 1]) {
                        const phase = action === 'rest' || action === 'wake' ? 'idle' : action;
                        const baked = model.bake({ seed: variant.seed, coverage, facing4, phase, phase01: progress, restAmount: action === 'rest' ? 1 : action === 'wake' ? 1 - progress : 0 });
                        assert.equal(baked.buf.data.length, baked.canvas.w * baked.canvas.h * 4);
                        assert(baked.buf.data.some((value, index) => index % 4 === 3 && value > 0));
                        frames++;
                    }
        }
        assert.equal(identities.size, entry.variants.length, `${entry.id}/${coverage}: repeated main shape`);
    }
}
console.log(`Inspector: ${INSPECTOR_ENTRIES.length} production entries, 14 floor main shapes, ${frames} directional/action endpoints; PASS`);
