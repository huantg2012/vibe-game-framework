/** R100 I01: CSV -> an explicitly unqualified DEV package inventory.
 * No production selector, balance value or save migration is changed here.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { POLLUTION_GRADES, validatePollutionGradeDefinitions, type PollutionGradeDefinition } from '../../src/generation/world-study/pollution-grade';
import { validateWorldPackage, validateWorldPackageManifest, type WorldPackage, type WorldPackageDependencyManifest } from '../../src/generation/world-study/world-package';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GRADES_INPUT = 'data/rift-pollution-grades.csv';
const PACKAGES_INPUT = 'data/rift-world-packages.csv';
const GRADES_OUTPUT = 'src/generated/rift-pollution-grade-data.ts';
const PACKAGES_OUTPUT = 'src/generated/rift-world-package-data.ts';
export const WORLD_PACKAGE_MANIFEST_PATH = 'src/generated/rift-world-package-manifest.json';
const OUTPUTS = new Set([GRADES_OUTPUT, PACKAGES_OUTPUT, WORLD_PACKAGE_MANIFEST_PATH]);
const EXISTING_COMPILERS = ['tools/map-preview/codegen-world-profiles.mjs', 'tools/map-preview/codegen-world-spaces.mjs',
  'tools/map-preview/codegen-world-pool.mjs', 'tools/world-study/codegen-world-conditions.mjs'];
const GRADE_HEADER = 'id,version,label,status,intent';
const PACKAGE_HEADER = 'id,world_id,profile_id,origin,scope,algorithm_id,algorithm_version,space_ids,condition_program_ids,content_fragment_id,capabilities,grade_ids';
export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

function readCsv(raw: string, expectedHeader?: string): Record<string, string>[] {
  const lines = raw.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = lines.shift()!;
  if (expectedHeader && header !== expectedHeader) throw new Error('World package CSV schema/header mismatch');
  const columns = header.split(',');
  if (new Set(columns).size !== columns.length || columns.some(column => !column)) throw new Error('Duplicate/empty CSV column');
  return lines.map((line, index) => {
    const cells = line.split(',').map(cell => cell.trim());
    if (cells.length !== columns.length || cells.some(cell => cell.includes('"')))
      throw new Error(`Unsupported CSV row/quoting at line ${index + 2}`);
    return Object.fromEntries(columns.map((column, i) => [column, cells[i]!]));
  });
}
function list(value: string, context: string): string[] {
  const values = value.split(';');
  if (values.some(item => !item) || new Set(values).size !== values.length) throw new Error(`Invalid/duplicate ${context}`);
  return values;
}
export function parsePollutionGradeCsv(raw: string): readonly PollutionGradeDefinition[] {
  const definitions = readCsv(raw, GRADE_HEADER).map(row => ({ id: row.id, version: Number(row.version),
    label: row.label, status: row.status, intent: row.intent }));
  validatePollutionGradeDefinitions(definitions);
  return definitions;
}

export interface WorldPackageCompilerContext {
  readonly profiles: readonly { readonly id: string; readonly substrate: string; readonly coating: string }[];
  readonly spaceIds: readonly string[];
  readonly programs: readonly { readonly id: string; readonly requires: readonly string[]; readonly excludes: readonly string[] }[];
  readonly fragmentIds: readonly string[];
  readonly gradeDefinitions: readonly PollutionGradeDefinition[];
  readonly gradeSourceHash: string;
  readonly dependencyHash: string;
}

/** Parse the generated JSON initializer without executing arbitrary source. The
 * general CSV generator has no check mode; verify this referenced registry here.
 */
function installedDialectIds(root: string, rows: readonly Record<string, string>[]): string[] {
  type Dialect = { substrates: [string, number][]; wallHostWeight: number; volumeHostWeight: number };
  const authored: Record<string, Dialect> = Object.create(null) as Record<string, Dialect>;
  for (const row of rows) {
    const [weight, wallHostWeight, volumeHostWeight] = [row.weight, row.wall_host_weight, row.volume_host_weight]
      .map(value => value && value.trim() ? Number(value) : NaN);
    if (![weight, wallHostWeight, volumeHostWeight].every(value => Number.isFinite(value) && value! >= 0))
      throw new Error('Invalid authored dialect weights');
    const dialect = authored[row.fragment_type_id!] ??= { substrates: [], wallHostWeight: wallHostWeight!, volumeHostWeight: volumeHostWeight! };
    if (dialect.wallHostWeight !== wallHostWeight || dialect.volumeHostWeight !== volumeHostWeight
      || dialect.substrates.some(([id]) => id === row.substrate)) throw new Error('Inconsistent/duplicate authored dialect');
    dialect.substrates.push([row.substrate!, weight!]);
  }
  const path = resolve(root, 'src/generated/contamination-family-data.ts');
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.ES2020, true);
  const initializers: string[] = [];
  source.forEachChild(node => {
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'CONTAMINATION_DIALECT_DATA' && declaration.initializer)
        initializers.push(declaration.initializer.getText(source));
    }
  });
  if (initializers.length !== 1 || JSON.stringify(JSON.parse(initializers[0]!)) !== JSON.stringify(authored))
    throw new Error('Dialect CSV and installed CONTAMINATION_DIALECT_DATA differ; run the existing CSV generator');
  return Object.keys(authored);
}
export function readWorldPackageCompilerContext(root = ROOT): Omit<WorldPackageCompilerContext, 'dependencyHash'> {
  const rows = (path: string): Record<string, string>[] => readCsv(readFileSync(resolve(root, path), 'utf8'));
  const gradeRaw = readFileSync(resolve(root, GRADES_INPUT), 'utf8');
  return {
    profiles: rows('data/rift-world-profiles.csv').map(row => ({ id: row.id!, substrate: row.substrate!, coating: row.coating! })),
    spaceIds: rows('data/rift-world-spaces.csv').map(row => row.id!),
    programs: rows('data/rift-world-conditions.csv').map(row => ({ id: row.id!, requires: list(row.requires!, 'program requires'),
      excludes: row.excludes ? list(row.excludes, 'program excludes') : [] })),
    fragmentIds: installedDialectIds(root, rows('data/contamination-dialects.csv')),
    gradeDefinitions: parsePollutionGradeCsv(gradeRaw), gradeSourceHash: sha256(gradeRaw),
  };
}

export function parseWorldPackageCsv(raw: string, context: WorldPackageCompilerContext): readonly WorldPackage[] {
  validatePollutionGradeDefinitions(context.gradeDefinitions);
  const ids = new Set<string>(), worlds = new Set<string>();
  return readCsv(raw, PACKAGE_HEADER).map(row => {
    const gradeIds = list(row.grade_ids!, 'grade_ids');
    if (gradeIds.length !== POLLUTION_GRADES.length || POLLUTION_GRADES.some(grade => !gradeIds.includes(grade)))
      throw new Error('Package grade_ids must contain low, medium and severe exactly once');
    const entry = {
      schemaVersion: 1, id: row.id, worldId: row.world_id, profileId: row.profile_id, origin: row.origin, scope: row.scope,
      algorithm: { id: row.algorithm_id, version: Number(row.algorithm_version) },
      spaceIds: list(row.space_ids!, 'space_ids'), conditionProgramIds: list(row.condition_program_ids!, 'condition_program_ids'),
      contentFragmentTypeId: row.content_fragment_id,
      capabilities: list(row.capabilities!, 'capabilities').map(token => {
        const [id, version, ...extra] = token.split('@');
        if (extra.length || version !== '1') throw new Error('Unsupported capability version');
        return { id, version: Number(version) };
      }),
      grades: Object.fromEntries(POLLUTION_GRADES.map(grade => [grade, { definitionVersion: 1, implementation: 'unimplemented' }])),
      sourceHash: sha256(raw), gradeSourceHash: context.gradeSourceHash, dependencyHash: context.dependencyHash,
    };
    validateWorldPackage(entry);
    if (ids.has(entry.id) || worlds.has(entry.worldId)) throw new Error('Duplicate package/world identity');
    ids.add(entry.id); worlds.add(entry.worldId);
    const profile = context.profiles.find(profile => profile.id === entry.profileId);
    if (!profile || entry.spaceIds.some(id => !context.spaceIds.includes(id)) || !context.fragmentIds.includes(entry.contentFragmentTypeId))
      throw new Error('Unknown package profile, space or content dialect');
    const actualCapabilities = new Set(['support:single-plane', 'support:grid8', 'body:aabb20', 'void:opaque', 'field:direction',
      'organization:patches', 'organization:bands', 'organization:clusters', `surface:${profile.substrate}`, `surface:${profile.coating}`]);
    const declared = new Set<string>(entry.capabilities.map(capability => capability.id));
    if (actualCapabilities.size !== declared.size || [...actualCapabilities].some(id => !declared.has(id)))
      throw new Error(`Package ${entry.id} capabilities do not match its installed legacy profile`);
    for (const id of entry.conditionProgramIds) {
      const program = context.programs.find(program => program.id === id);
      const matches = (clause: string): boolean => clause.split('|').some(capability => actualCapabilities.has(capability));
      if (!program || program.requires.some(clause => !matches(clause)) || program.excludes.some(matches))
        throw new Error(`Package ${entry.id} has unavailable/incompatible condition program ${id}`);
    }
    return entry;
  });
}

/** Conservative source closure: all authoring CSVs plus local imports, including
 * type imports. Over-invalidation is intentional at I01. Generated outputs of
 * this compiler are excluded to avoid a circular fingerprint.
 */
export function collectWorldPackageManifest(root = ROOT): WorldPackageDependencyManifest {
  const files = new Set<string>();
  const rootReal = realpathSync(root);
  function add(path: string): void {
    const absolute = resolve(root, path);
    if (OUTPUTS.has(path)) return;
    if (!existsSync(absolute) || !statSync(absolute).isFile()) throw new Error(`Missing package dependency ${path}`);
    if (!realpathSync(absolute).startsWith(`${rootReal}/`)) throw new Error(`Dependency escapes repository: ${path}`);
    if (files.has(path)) return;
    files.add(path);
    if (!/\.(?:ts|mjs|js)$/.test(path)) return;
    const imports = ts.preProcessFile(readFileSync(absolute, 'utf8'), true, true).importedFiles;
    for (const reference of imports) {
      const specifier = reference.fileName;
      const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2))
        : specifier.startsWith('.') ? resolve(dirname(absolute), specifier) : null;
      if (!base) continue; // External package resolutions are pinned by package-lock.json.
      const target = [base, `${base}.ts`, `${base}.mjs`, `${base}.js`, `${base}/index.ts`]
        .find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      if (!target) throw new Error(`Unresolved local dependency ${specifier} in ${path}`);
      add(relative(root, target));
    }
  }
  for (const path of ['src/generation/world-study/production-map.ts', 'src/generation/world-study/production-recipe.ts',
    'src/generation/world-study/world-package.ts', 'src/generation/world-study/pollution-grade.ts',
    'src/generation/legacy-rift-generation.ts', 'src/generation/legacy-rift-v2/manifest.json',
    'src/generation/legacy-rift-v2/executor.d.ts',
    'tools/world-study/codegen-world-packages.ts', 'tools/csv-codegen/generate.mjs', ...EXISTING_COMPILERS, 'package-lock.json']) add(path);
  for (const file of readdirSync(resolve(root, 'data')).filter(file => file.endsWith('.csv')).sort()) add(`data/${file}`);
  const dependencies = [...files].sort().map(path => ({ path, sha256: sha256(readFileSync(resolve(root, path))) }));
  const manifest = { schemaVersion: 1, scope: 'legacy-v2-generation-and-contract', dependencies, hash: sha256(JSON.stringify(dependencies)) };
  validateWorldPackageManifest(manifest);
  return manifest;
}

export function verifyWorldPackageManifest(value: unknown, root = ROOT): void {
  validateWorldPackageManifest(value);
  if (sha256(JSON.stringify(value.dependencies)) !== value.hash) throw new Error('Package manifest hash mismatch');
  const current = collectWorldPackageManifest(root);
  if (JSON.stringify(current) !== JSON.stringify(value)) throw new Error('Package dependency content or closure changed');
}

export function generateWorldPackages({ root = ROOT, check = false } = {}): { packages: number; grades: number; dependencyHash: string; dependencies: number; check: boolean } {
  // Do not bind a package against authored data whose existing runtime data is stale.
  for (const script of EXISTING_COMPILERS)
    execFileSync(process.execPath, [script, '--check'], { cwd: root, stdio: 'pipe' });
  const manifest = collectWorldPackageManifest(root);
  const context = { ...readWorldPackageCompilerContext(root), dependencyHash: manifest.hash };
  const packages = parseWorldPackageCsv(readFileSync(resolve(root, PACKAGES_INPUT), 'utf8'), context);
  if (!packages.length) throw new Error('Empty world package inventory');
  const generated = new Map([
    [GRADES_OUTPUT, `// Generated from ${GRADES_INPUT}; contract-only, no graded departures enabled.\nimport type { PollutionGradeDefinition } from '../generation/world-study/pollution-grade';\nexport const POLLUTION_GRADE_SOURCE_HASH = '${context.gradeSourceHash}';\nexport const POLLUTION_GRADE_DEFINITIONS: readonly PollutionGradeDefinition[] = ${JSON.stringify(context.gradeDefinitions, null, 2)};\n`],
    [PACKAGES_OUTPUT, `// Generated from ${PACKAGES_INPUT}; legacy DEV inventory, not a qualified production pool.\nimport type { WorldPackage } from '../generation/world-study/world-package';\nexport const WORLD_PACKAGES: readonly WorldPackage[] = ${JSON.stringify(packages, null, 2)};\n`],
    [WORLD_PACKAGE_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`],
  ]);
  for (const [path, content] of generated) {
    if (check) {
      if (!existsSync(resolve(root, path)) || readFileSync(resolve(root, path), 'utf8') !== content)
        throw new Error(`Stale world package output: ${path}`);
    } else writeFileSync(resolve(root, path), content);
  }
  return { packages: packages.length, grades: context.gradeDefinitions.length, dependencyHash: manifest.hash,
    dependencies: manifest.dependencies.length, check };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(generateWorldPackages({ check: process.argv.includes('--check') })));
