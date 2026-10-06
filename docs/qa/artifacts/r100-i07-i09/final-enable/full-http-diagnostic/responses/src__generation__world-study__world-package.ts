/** A versioned DEV inventory, not a runtime recipe or an art/experience approval.
 * Legacy v2 worlds remain ungraded until three separate implementations qualify.
 */
import { POLLUTION_GRADES, type PollutionGrade } from './pollution-grade';

export const WORLD_PACKAGE_CAPABILITIES = [
  'surface:strata', 'surface:crystal', 'surface:glaze', 'field:direction',
  'support:single-plane', 'support:grid8', 'body:aabb20', 'void:opaque',
  'organization:patches', 'organization:bands', 'organization:clusters',
] as const;
export type WorldPackageCapability = typeof WORLD_PACKAGE_CAPABILITIES[number];
export interface WorldPackage {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly worldId: string;
  readonly profileId: string;
  readonly origin: 'legacy-demo';
  readonly scope: 'dev-contract';
  readonly algorithm: { readonly id: 'world-production'; readonly version: 2 };
  readonly spaceIds: readonly string[];
  readonly conditionProgramIds: readonly string[];
  readonly contentFragmentTypeId: string;
  readonly capabilities: readonly { readonly id: WorldPackageCapability; readonly version: 1 }[];
  readonly grades: Readonly<Record<PollutionGrade, { readonly definitionVersion: 1; readonly implementation: 'unimplemented' }>>;
  readonly sourceHash: string;
  readonly gradeSourceHash: string;
  readonly dependencyHash: string;
}
export interface WorldPackageDependencyManifest {
  readonly schemaVersion: 1;
  /** Does not claim to fingerprint every rendered asset, sound or old executor. */
  readonly scope: 'legacy-v2-generation-and-contract';
  readonly dependencies: readonly { readonly path: string; readonly sha256: string }[];
  readonly hash: string;
}

const idValid = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);
const hashValid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}
function idsValid(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 32
    && value.every(idValid) && new Set(value).size === value.length;
}

export function validateWorldPackage(value: unknown): asserts value is WorldPackage {
  if (!record(value, ['schemaVersion', 'id', 'worldId', 'profileId', 'origin', 'scope', 'algorithm',
    'spaceIds', 'conditionProgramIds', 'contentFragmentTypeId', 'capabilities', 'grades', 'sourceHash', 'gradeSourceHash', 'dependencyHash'])
    || value.schemaVersion !== 1 || !idValid(value.id) || !idValid(value.worldId) || !idValid(value.profileId)
    || value.worldId !== value.profileId || value.origin !== 'legacy-demo' || value.scope !== 'dev-contract'
    || !record(value.algorithm, ['id', 'version']) || value.algorithm.id !== 'world-production' || value.algorithm.version !== 2
    || !idsValid(value.spaceIds) || !idsValid(value.conditionProgramIds) || !idValid(value.contentFragmentTypeId)
    || !hashValid(value.sourceHash) || !hashValid(value.gradeSourceHash) || !hashValid(value.dependencyHash))
    throw new Error('Unsupported world package identity, scope, schema, algorithm or source hash');
  if (!Array.isArray(value.capabilities) || !value.capabilities.length || value.capabilities.length > WORLD_PACKAGE_CAPABILITIES.length)
    throw new Error('World package capabilities are required');
  const seen = new Set<string>();
  for (const capability of value.capabilities) {
    if (!record(capability, ['id', 'version']) || capability.version !== 1
      || typeof capability.id !== 'string' || !WORLD_PACKAGE_CAPABILITIES.some(id => id === capability.id)
      || seen.has(capability.id)) throw new Error('Unknown or duplicate world package capability/version');
    seen.add(capability.id);
  }
  if (!record(value.grades, POLLUTION_GRADES)) throw new Error('World package requires three separate grade contracts');
  for (const grade of POLLUTION_GRADES) {
    const contract = value.grades[grade];
    if (!record(contract, ['definitionVersion', 'implementation']) || contract.definitionVersion !== 1 || contract.implementation !== 'unimplemented')
      throw new Error('Legacy package cannot claim implemented or qualified pollution grades');
  }
}

export function validateWorldPackageManifest(value: unknown): asserts value is WorldPackageDependencyManifest {
  if (!record(value, ['schemaVersion', 'scope', 'dependencies', 'hash']) || value.schemaVersion !== 1
    || value.scope !== 'legacy-v2-generation-and-contract' || !hashValid(value.hash)
    || !Array.isArray(value.dependencies) || !value.dependencies.length || value.dependencies.length > 2048)
    throw new Error('Unsupported world package manifest');
  let previous = '';
  for (const dependency of value.dependencies) {
    if (!record(dependency, ['path', 'sha256']) || typeof dependency.path !== 'string'
      || !/^(?:src|tools|data)\/[a-zA-Z0-9_./-]+$|^package-lock\.json$/.test(dependency.path)
      || dependency.path.split('/').some(part => part === '..' || part === '.' || !part)
      || dependency.path <= previous || !hashValid(dependency.sha256))
      throw new Error('Invalid, duplicate or unsorted world package dependency');
    previous = dependency.path;
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Comparison is deliberately exact. An unavailable package must not resolve to
 * another ID/version or silently inherit today's data. It is not a save loader.
 */
export function worldPackageMatchesInstalled(value: unknown, installed: WorldPackage): boolean {
  try {
    validateWorldPackage(value);
    validateWorldPackage(installed);
    return canonical(value) === canonical(installed);
  } catch { return false; }
}
