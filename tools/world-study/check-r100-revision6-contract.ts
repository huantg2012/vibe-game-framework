/** Re-seal deliberately invalid recipes so rejection proves schema validation,
 * rather than merely noticing the old integrity receipt. No maps are generated. */
import assert from 'node:assert/strict';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import type { WorldProductionRecipeV3 } from '../../src/generation/world-study/production-recipe';
import { R100_MATERIAL_DEPENDENCIES } from '../../src/generated/r100-package-manifest';
import { createR100ProductionRecipe as createRevision5Recipe,
  validR100ProductionRecipe as validRevision5Recipe } from '../../src/generation/legacy-r100-v5/executor-revision5.js';

function seal(recipe: WorldProductionRecipeV3, revision: 5 | 6 = 6): WorldProductionRecipeV3 {
  const source = JSON.stringify({ algorithm: `r100-native@3.${revision}`, native: recipe.nativeDefinition,
    profile: recipe.profile, space: recipe.space, contentFragmentTypeId: recipe.contentFragmentTypeId,
    grade: recipe.gradeDefinition, contents: recipe.contentDefinition, appearance: recipe.appearance,
    materials: recipe.package.materials });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return { ...recipe, package: { ...recipe.package, dependencyHash: (hash >>> 0).toString(16).padStart(8, '0') } };
}
type MutableNative = { erosion: unknown; authoredErosion?: unknown; instances: Record<string, unknown>[] };
const original = createR100ProductionRecipe('ash-strata', 20261004, 'medium');
assert(validR100ProductionRecipe(original));
assert.deepEqual(seal(original), original, 'Test receipt matches a legitimate unmodified recipe');
const cases: [string, (native: MutableNative) => void][] = [
  ['missing polygons', native => { native.erosion = undefined; }],
  ['empty polygons', native => { native.erosion = []; }],
  ['out-of-bounds polygon', native => { native.erosion = [[{ x: -1, y: 0 }, { x: 64, y: 0 }, { x: 64, y: 64 }]]; }],
  ['self crossing polygon', native => { native.erosion = [[{ x: 20, y: 20 }, { x: 90, y: 90 }, { x: 20, y: 90 }, { x: 80, y: 20 }]]; }],
  ['overlapping polygons', native => { const triangle = [{ x: 20, y: 20 }, { x: 90, y: 20 }, { x: 20, y: 90 }]; native.erosion = [triangle, triangle]; }],
  ['hidden point property', native => { native.erosion = [[{ x: 20, y: 20, z: 0 }, { x: 90, y: 20 }, { x: 20, y: 90 }]]; }],
  ['unknown construction', native => { native.instances[0]!.constructionVersion = 5; }],
  ['v4 profile under legacy construction', native => { native.instances[0]!.constructionVersion = 2; native.instances[0]!.shapeProfile = 'fracture-fan'; }],
  ['v3 profile under construction4', native => { native.instances[0]!.constructionVersion = 4; native.instances[0]!.shapeProfile = 'rib-vault'; }],
  ['unknown role', native => { native.instances[0]!.role = 'portal'; }],
  ['duplicate instance ID', native => { native.instances.push({ ...native.instances[0]! }); }],
  ['unknown geometry field', native => { native.instances[0]!.unvalidatedHole = true; }],
];
for (const [name, mutate] of cases) {
  const recipe = structuredClone(original);
  mutate(recipe.nativeDefinition as unknown as MutableNative);
  assert(!validR100ProductionRecipe(seal(recipe)), name);
}
const explicit = structuredClone(original);
(explicit.nativeDefinition as unknown as MutableNative).erosion = [[{ x: 100, y: 100 }, { x: 180, y: 100 }, { x: 180, y: 180 }]];
assert(validR100ProductionRecipe(seal(explicit)), 'A valid existing erosion DTO is authorable without a new runtime field');
const cut = createR100ProductionRecipe('cleft-tableland', 20261004, 'medium');
assert(validR100ProductionRecipe(cut), 'Actual authored cut and shallow edge recipe is admitted');
const edgeCases: [string, (native: MutableNative) => void][] = [
  ['edge without author marker', native => { delete native.authoredErosion; }],
  ['false author marker', native => { native.authoredErosion = false; }],
  ['author marker on legacy construction', native => { native.instances[0]!.constructionVersion = 3; native.instances[0]!.shapeProfile = 'rib-vault'; }],
  ['edge on solid', native => { native.instances.find(row => row.groundEdgeWidth !== undefined)!.role = 'solid'; }],
  ['tall edge', native => { native.instances.find(row => row.groundEdgeWidth !== undefined)!.height = 7; }],
  ['narrow edge', native => { native.instances.find(row => row.groundEdgeWidth !== undefined)!.groundEdgeWidth = 7; }],
  ['wide edge', native => { native.instances.find(row => row.groundEdgeWidth !== undefined)!.groundEdgeWidth = 25; }],
  ['secondary material edge', native => { native.instances.find(row => row.groundEdgeWidth !== undefined)!.family = 'gel-solid'; }],
  ['duplicate edge owner', native => { const owner = native.instances.find(row => row.groundEdgeWidth !== undefined)!; native.instances.push({ ...owner, id: 9876 }); }],
  ['later primary relief edge', native => { const owner = native.instances.find(row => row.groundEdgeWidth !== undefined)!; native.instances.unshift({ ...owner, id: 9876, groundEdgeWidth: undefined }); }],
];
for (const [name, mutate] of edgeCases) {
  const recipe = structuredClone(cut);
  mutate(recipe.nativeDefinition as unknown as MutableNative);
  assert(!validR100ProductionRecipe(seal(recipe)), name);
}
let organizationNegatives = 0;
if (process.argv.includes('--organizations')) {
  assert(Object.keys(original.package.materials).every(key => !key.startsWith('organization:')),
    'Unselected original world retains family-only material dependencies');
  for (const organization of ['short-fibre', 'porous-marrow', 'short-fibre-loose'] as const) {
    const key = `organization:${organization}`, dependency = R100_MATERIAL_DEPENDENCIES[key];
    assert(dependency, `Compile the dedicated ${organization} atoms before this contract check`);
    const keys = [...Object.keys(original.package.materials), key].sort();
    const selected = seal({ ...structuredClone(original),
      appearance: { ...original.appearance, materialOrganization: organization },
      package: { ...original.package, materials: Object.fromEntries(keys.map(name => [name,
        name === key ? dependency : original.package.materials[name]!])) } });
    assert(validR100ProductionRecipe(selected), `Synthetic ${organization} dependency contract admitted`);
    for (const [name, atom] of Object.entries(original.package.materials))
      assert.deepEqual(selected.package.materials[name], atom, 'Family and mixed secondary atoms remain byte-bound');
    const negative = (label: string, mutate: (recipe: WorldProductionRecipeV3) => WorldProductionRecipeV3): void => {
      assert(!validR100ProductionRecipe(seal(mutate(structuredClone(selected)))), `${organization}: ${label}`);
      organizationNegatives++;
    };
    negative('missing selected dependency', recipe => {
      const materials = { ...recipe.package.materials }; delete materials[key];
      return { ...recipe, package: { ...recipe.package, materials } };
    });
    for (const field of ['definition', 'surface', 'solid'] as const) negative(`changed ${field} SHA`, recipe => ({
      ...recipe, package: { ...recipe.package, materials: { ...recipe.package.materials,
        [key]: { ...dependency, [field]: '0'.repeat(64) } } },
    }));
    negative('unused organization dependency', recipe => ({ ...recipe, package: { ...recipe.package,
      materials: { ...recipe.package.materials, [`organization:${organization === 'short-fibre' ? 'porous-marrow' : 'short-fibre'}`]: dependency } } }));
    negative('unselected appearance with organization atom', recipe => {
      const { materialOrganization: _selection, ...appearance } = recipe.appearance;
      return { ...recipe, appearance };
    });
    negative('unknown organization', recipe => ({ ...recipe,
      appearance: { ...recipe.appearance, materialOrganization: 'unknown-organization' } as unknown as WorldProductionRecipeV3['appearance'] }));
    if (organization === 'short-fibre-loose') {
      const prior = createRevision5Recipe('ash-strata', 20261004, 'medium');
      assert(validRevision5Recipe(prior) && validR100ProductionRecipe(prior));
      const wrongRevision = seal({...structuredClone(prior),
        appearance: {...prior.appearance, materialOrganization: organization},
        package: {...prior.package, materials: {...prior.package.materials, [key]: dependency}}}, 5);
      assert(!validRevision5Recipe(wrongRevision), 'Frozen revision5 cannot accept a newly authored atom');
      assert(!validR100ProductionRecipe(wrongRevision), 'Outer legacy routing cannot silently upgrade old material identity');
      organizationNegatives += 2;
    }
  }
}
let extendedProfileNegatives = 0;
if (process.argv.includes('--extended-profiles')) {
  const oldRecipe = createRevision5Recipe('ash-strata', 20261004, 'medium');
  assert.equal(oldRecipe.package.algorithmRevision, 5);
  assert.deepEqual(seal(oldRecipe, 5), oldRecipe, 'Revision5 test receipt matches its immutable original algorithm');
  assert(validRevision5Recipe(oldRecipe) && validR100ProductionRecipe(oldRecipe), 'Unmodified revision5 still recovers');
  for (const [profile, version] of [['pleated-tear', 3], ['settled-sheet', 4], ['settled-fan', 4]] as const) {
    const configure = (recipe: WorldProductionRecipeV3): Record<string, unknown> => {
      const native = recipe.nativeDefinition as unknown as MutableNative;
      const instance = native.instances[0]!;
      instance.constructionVersion = version;
      instance.shapeProfile = profile;
      // The settled layer is explicitly shallow and walkable; this does not
      // turn a solid into a traversable shape in any authored world.
      if (version === 4) { instance.role = 'relief'; instance.height = 6; }
      return instance;
    };
    const selected = structuredClone(original); configure(selected);
    assert(validR100ProductionRecipe(seal(selected)), `${profile}: valid explicit revision6 fixture admitted`);
    for (const wrongVersion of [1, 2, version === 3 ? 4 : 3]) {
      const invalid = structuredClone(selected);
      (invalid.nativeDefinition as unknown as MutableNative).instances[0]!.constructionVersion = wrongVersion;
      assert(!validR100ProductionRecipe(seal(invalid)), `${profile}: wrong construction ${wrongVersion} rejected`);
      extendedProfileNegatives++;
    }
    if (version === 4) for (const [field, value] of [['role', 'solid'], ['height', 7]] as const) {
      const invalid = structuredClone(selected);
      (invalid.nativeDefinition as unknown as MutableNative).instances[0]![field] = value;
      assert(!validR100ProductionRecipe(seal(invalid)), `${profile}: ${field} ${value} rejected`);
      extendedProfileNegatives++;
    }
    const injected = structuredClone(oldRecipe); configure(injected);
    const resealedOld = seal(injected, 5);
    assert(!validRevision5Recipe(resealedOld), `${profile}: frozen revision5 rejects a correctly re-sealed new shape`);
    assert(!validR100ProductionRecipe(resealedOld), `${profile}: outer recovery router preserves frozen rejection`);
    extendedProfileNegatives++;
  }
}
console.log(`PASS revision6 package contract: ${cases.length + edgeCases.length} re-sealed invalid native schemas, ${organizationNegatives} organization negatives, ${extendedProfileNegatives} extended-profile negatives; valid authored erosion/edge${organizationNegatives ? ' and three dedicated organization dependency fixtures' : ''} accepted. Synthetic package contracts only; no map/art/gameplay claim.`);
