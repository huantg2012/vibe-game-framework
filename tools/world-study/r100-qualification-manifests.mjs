/** Review evidence receipts, not a third content catalog or recovery executor.
 * Called by the existing v3 package compiler after a reviewed build is stable. */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const sha256 = value => createHash('sha256').update(value).digest('hex');
function initializer(path, name) {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  let result;
  file.forEachChild(node => {
    if (!ts.isVariableStatement(node)) return;
    for (const item of node.declarationList.declarations) if (ts.isIdentifier(item.name) && item.name.text === name) {
      let value = item.initializer;
      while (value && ts.isAsExpression(value)) value = value.expression;
      result = JSON.parse(value.getText(file));
    }
  });
  if (result === undefined) throw new Error(`Missing generated initializer ${path}:${name}`);
  return result;
}

function currentAlgorithm() {
  const path = 'src/generation/world-study/r100-package.ts';
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const values = {};
  const visit = node => {
    if (ts.isPropertyAssignment(node) && node.name.getText(file) === 'package' && ts.isObjectLiteralExpression(node.initializer)) {
      for (const item of node.initializer.properties) if (ts.isPropertyAssignment(item)) {
        const key = item.name.getText(file);
        if (key === 'algorithm' && ts.isStringLiteral(item.initializer)) values.id = item.initializer.text;
        if (key === 'version' && ts.isNumericLiteral(item.initializer)) values.version = Number(item.initializer.text);
        if (key === 'algorithmRevision' && ts.isNumericLiteral(item.initializer)) values.revision = Number(item.initializer.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  const factory = file.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createR100ProductionRecipe');
  if (factory) visit(factory);
  if (values.id !== 'r100-native' || !Number.isInteger(values.version) || !Number.isInteger(values.revision))
    throw new Error('Cannot read the actual departure algorithm identity; refuse a stale qualification receipt');
  return values;
}

export function writeR100QualificationManifests({ check = false, outputDirectory = 'docs/qa/artifacts/r100-i03-i06/packages', immutable = false, worldIds } = {}) {
  const root = process.cwd(), folder = outputDirectory;
  // Exact per-world data is embedded below. Including whole catalogs would make
  // an unrelated new row revoke every previously reviewed world.
  const projected = new Set([
    'src/generated/r100-native-worlds.ts', 'src/generated/r100-package-manifest.ts', 'src/generated/r100-world-appearance.ts',
    'src/generated/r100-materials.ts', 'src/generated/rift-expedition-grade-data.ts',
    'src/generated/r100-material-organizations.ts',
    'src/generated/rift-pollution-grade-data.ts', 'src/generated/rift-search-remains.ts',
    'src/generated/rift-world-profile-data.ts', 'src/generation/world-study/r100-generated-scenes.ts',
  ]);
  const files = new Set();
  function visit(path) {
    if (files.has(path) || projected.has(path)) return;
    if (!existsSync(path)) throw new Error(`Missing native qualification dependency ${path}`);
    files.add(path);
    if (!/\.(?:ts|js|mjs)$/.test(path)) return;
    for (const reference of ts.preProcessFile(readFileSync(path, 'utf8'), true, true).importedFiles) {
      const name = reference.fileName;
      const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2))
        : name.startsWith('.') ? resolve(dirname(path), name) : null;
      if (!base) continue;
      const target = [base, `${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}/index.ts`]
        .find(file => existsSync(file) && statSync(file).isFile());
      if (!target) throw new Error(`Unresolved qualification dependency ${path}:${name}`);
      visit(relative(root, target));
    }
  }
  for (const path of ['src/generation/world-study/r100-production-map.ts', 'src/systems/r100-world-presentation.ts',
    'src/systems/r100-world/surface-preparation-worker.ts', 'src/generation/rift-generation-worker.ts',
    'src/systems/contamination-host-system.ts', 'src/systems/ai/ai-system.ts', 'src/systems/loot-search-system.ts',
    'src/systems/chaos-system.ts', 'src/scenes/rift-scene.ts', 'package-lock.json']) visit(path);
  const runtime = [...files].sort().map(path => ({ path, sha256: sha256(readFileSync(path)) }));
  const worlds = initializer('src/generated/r100-native-worlds.ts', 'R100_NATIVE_WORLDS');
  if (worldIds !== undefined && (!Array.isArray(worldIds) || !worldIds.length
    || new Set(worldIds).size !== worldIds.length || worldIds.some(id => !worlds.some(world => world.id === id))))
    throw new Error('Qualification receipt scope must contain unique existing world IDs');
  const appearances = initializer('src/generated/r100-world-appearance.ts', 'R100_WORLD_APPEARANCES');
  const grades = initializer('src/generated/rift-pollution-grade-data.ts', 'POLLUTION_GRADE_DEFINITIONS');
  const contents = initializer('src/generated/rift-expedition-grade-data.ts', 'R100_EXPEDITION_GRADES');
  const materials = initializer('src/generated/r100-materials.ts', 'PAINTED_MATERIALS');
  const organizations = existsSync('src/generated/r100-material-organizations.ts')
    ? initializer('src/generated/r100-material-organizations.ts', 'ORGANIZATION_MATERIALS') : [];
  const remains = initializer('src/generated/rift-search-remains.ts', 'SEARCH_REMAINS');
  const algorithm = currentAlgorithm();
  const index = [];
  const publish = (path, content) => {
    if (check) { if (readFileSync(path, 'utf8') !== content) throw new Error(`Stale qualification receipt ${path}`); }
    else {
      if (immutable && existsSync(path) && readFileSync(path, 'utf8') !== content)
        throw new Error(`Refuse to overwrite a frozen qualification receipt ${path}`);
      mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content);
    }
  };
  for (const world of worlds.filter(world => worldIds === undefined || worldIds.includes(world.id))) {
    const appearance = appearances.find(row => row.worldId === world.id);
    const families = [...new Set(world.definitions.flatMap(definition => [definition.family,
      ...definition.instances.map(instance => instance.family ?? definition.family)]))].sort();
    const selectedMaterials = families.map(family => {
      const definition = materials.find(row => row.family === family);
      if (!definition) throw new Error(`Missing native material ${family}`);
      return { definition, assets: [definition.source, definition.solid.source].map(source => {
        const path = `public${source}`; return { path, sha256: sha256(readFileSync(path)) };
      }) };
    });
    if (appearance?.materialOrganization) {
      const definition = organizations.find(row => row.organization === appearance.materialOrganization);
      if (!definition) throw new Error(`Missing organization atoms: ${appearance.materialOrganization}`);
      selectedMaterials.push({ definition, assets: [definition.source, definition.solid.source].map(source => {
        const path = `public${source}`; return { path, sha256: sha256(readFileSync(path)) };
      }) });
    }
    const payload = { schemaVersion: 1, purpose: 'r100-world-review-dependencies', worldId: world.id,
      algorithm, profile: world.profile, appearance,
      grades: world.definitions.map(definition => ({ grade: definition.grade, nativeDefinition: definition,
        pollution: grades.find(row => row.id === definition.grade), content: contents.find(row => row.grade_id === definition.grade) })),
      materials: selectedMaterials, remains: remains.find(row => row.worldId === world.id), dependencies: runtime };
    const path = `${folder}/${world.id}.json`, bytes = JSON.stringify(payload, null, 2) + '\n';
    publish(path, bytes);
    index.push({ worldId: world.id, family: world.definitions[0].family, families,
      dependencyManifest: { path, hash: sha256(bytes) }, grades: payload.grades.map(row => row.grade) });
  }
  publish(`${folder}/index.json`, JSON.stringify({ schemaVersion: 1,
    scope: 'Dependency receipts only; implementation, production integration and review results are owned by the existing R100 ledger.', worlds: index }, null, 2) + '\n');
  console.log(`PASS qualification receipts: ${index.length} worlds, SHA-256 of each complete manifest file; ${runtime.length} runtime dependencies`);
  return index;
}
