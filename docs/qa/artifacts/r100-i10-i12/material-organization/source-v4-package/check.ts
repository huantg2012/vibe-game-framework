import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {createR100ProductionRecipe, validR100ProductionRecipe} from '../../../../../../src/generation/world-study/r100-package';
import {R100_MATERIAL_DEPENDENCIES} from '../../../../../../src/generated/r100-package-manifest';
import {R100_WORLD_APPEARANCES} from '../../../../../../src/generated/r100-world-appearance';
const folder = 'docs/qa/artifacts/r100-i10-i12/material-organization/source-v4-package';
const output = folder + '/report.json'; assert(!fs.existsSync(output));
const sourcePath = 'docs/qa/artifacts/r100-i10-i12/b14-source/source-snapshot.json';
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const sha = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const receipt = (file: string) => ({path: file, sha256: sha(fs.readFileSync(file))});
const frozen = (file: string): string => {
  const bytes = fs.readFileSync(path.join(source.temporaryRoot, file)); assert.equal(sha(bytes), source.sources[file]); return bytes.toString();
};
function literal(file: string, name: string): unknown {
  const ast = ts.createSourceFile(file, frozen(file), ts.ScriptTarget.Latest, true);
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) {
    if (declaration.name.getText(ast) !== name) continue;
    let node = declaration.initializer!; while (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
    return JSON.parse(node.getText(ast));
  }
  throw new Error('Missing frozen literal ' + name);
}
const oldAtoms = literal('src/generated/r100-package-manifest.ts', 'R100_MATERIAL_DEPENDENCIES') as typeof R100_MATERIAL_DEPENDENCIES;
for (const [key, atom] of Object.entries(oldAtoms)) assert.deepEqual(R100_MATERIAL_DEPENDENCIES[key], atom, key);
assert.deepEqual(Object.keys(R100_MATERIAL_DEPENDENCIES).filter(key => !(key in oldAtoms)), ['organization:short-fibre-loose']);
const oldAppearances = literal('src/generated/r100-world-appearance.ts', 'R100_WORLD_APPEARANCES') as typeof R100_WORLD_APPEARANCES;
const changed = new Set(['short-fibre-mat', 'felt-wedges']);
for (const prior of oldAppearances) {
  const current = R100_WORLD_APPEARANCES.find(row => row.worldId === prior.worldId)!; assert(current);
  assert.deepEqual(changed.has(prior.worldId) ? {...current, materialOrganization: prior.materialOrganization} : current, prior);
  if (changed.has(prior.worldId)) assert.equal(current.materialOrganization, 'short-fibre-loose');
}
assert.equal(oldAppearances.length, 108);
assert.equal(sha(fs.readFileSync('src/generation/world-study/r100-package.ts')), source.sources['src/generation/world-study/r100-package.ts'], 'Same recipe constructor/integrity rules');
const cases = [];
for (const world of changed) for (const grade of ['low', 'medium', 'severe'] as const) {
  const recipe = createR100ProductionRecipe(world, 20261004, grade); assert(validR100ProductionRecipe(recipe));
  assert(recipe.package.materials['organization:short-fibre-loose']); assert(!recipe.package.materials['organization:short-fibre']);
  // Reconstruct the prior frozen appearance/material fields under the unchanged
  // recipe constructor. This checks compatibility, not an old game execution.
  const old = structuredClone(recipe), key = 'organization:short-fibre';
  const materials = {...old.package.materials}; delete materials['organization:short-fibre-loose']; materials[key] = oldAtoms[key]!;
  const appearance = oldAppearances.find(row => row.worldId === world)!;
  const value = {...old, appearance, package: {...old.package, materials: Object.fromEntries(Object.entries(materials).sort(([a], [b]) => a.localeCompare(b)))}};
  const serialized = JSON.stringify({algorithm: 'r100-native@3.6', native: value.nativeDefinition, profile: value.profile,
    space: value.space, contentFragmentTypeId: value.contentFragmentTypeId, grade: value.gradeDefinition,
    contents: value.contentDefinition, appearance: value.appearance, materials: value.package.materials});
  let digest = 2166136261; for (let index = 0; index < serialized.length; index++) digest = Math.imul(digest ^ serialized.charCodeAt(index), 16777619);
  value.package.dependencyHash = (digest >>> 0).toString(16).padStart(8, '0');
  assert(validR100ProductionRecipe(value), 'Previously selected immutable material remains recoverable');
  cases.push({world, grade, currentSelectedKey: 'organization:short-fibre-loose', reconstructedPriorKey: key,
    currentValid: true, priorValid: true, currentHash: recipe.package.dependencyHash, priorHash: value.package.dependencyHash});
}
const sources = ['tools/world-study/codegen-r100-packages.mjs', 'src/generated/r100-package-manifest.ts',
  'src/generation/world-study/r100-world-appearance.ts', 'src/generated/r100-world-appearance.ts',
  'data/rift-material-organizations.csv', 'data/rift-world-appearance.csv'];
fs.writeFileSync(output, JSON.stringify({status: 'pass', before: receipt(sourcePath), harness: receipt(folder + '/check.ts'),
  sources: sources.map(receipt), oldAtomEntriesExact: Object.keys(oldAtoms).length, unmodifiedAppearances: 106,
  changedWorlds: [...changed], cases,
  scope: 'Material dependency append and current/previous selection integrity only. Prior recipes are reconstructed from frozen fields under the unchanged constructor; this is not a prior-source game run, RGBA comparison, current entry/recovery or art approval.'}, null, 2) + '\n');
console.log('PASS material append: old8 atom entries /106 appearances exact, new6 and reconstructed prior6 recipe contracts');
