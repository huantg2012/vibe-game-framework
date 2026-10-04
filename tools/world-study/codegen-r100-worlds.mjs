/** Authored complete-world arrangements, separate from the nine immutable art masters. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = 'data/rift-native-worlds.csv', text = readFileSync(source, 'utf8');
const [headers, ...lines] = text.trim().split(/\r?\n/).map(line => line.split(','));
const families = ['folded-slab', 'fibre-knot', 'broken-shell', 'granular-ridge', 'membrane-rim', 'gel-flow'];
const materials = ['strata', 'crystal', 'glaze', 'granular', 'membrane', 'gel'];
const rawMasters = readFileSync('src/generation/world-study/r100-generated-scenes.ts', 'utf8');
const masters = JSON.parse(rawMasters.slice(rawMasters.indexOf('export const MASTER_SCENES = ') + 'export const MASTER_SCENES = '.length).replace(/ as const;\s*$/, ''));
const rawProfiles = readFileSync('src/generated/rift-world-profile-data.ts', 'utf8');
const profiles = JSON.parse(rawProfiles.slice(rawProfiles.indexOf('WorldProfile[] = ') + 'WorldProfile[] = '.length).replace(/;\s*$/, ''));
const records = lines.map((values, index) => {
  if (values.length !== headers.length) throw new Error(`Invalid native world row ${index + 2}`);
  const row = Object.fromEntries(headers.map((key, at) => [key, values[at]]));
  const familyIndex = families.indexOf(row.family);
  if (!/^[a-z][a-z0-9-]+$/.test(row.world_id) || !row.label || familyIndex < 0 || !['3', '4', '5', '6'].includes(row.iteration)
    || !['true', 'false'].includes(row.enabled) || !['bands', 'clusters', 'patches'].includes(row.organization)) throw new Error('Invalid world identity/organization');
  const base = profiles.find(profile => profile.id === row.base_profile);
  if (!base) throw new Error(`Missing base palette ${row.base_profile}`);
  const material = materials[familyIndex];
  const profile = { ...base, id: row.world_id, label: row.label, description: `${row.label}的原生材料与完整搜撤地段`,
    material, surface: { ...base.surface, substrate: material, coating: material, organization: row.organization } };
  // Existing three profiles keep their exact accepted palette/material contract.
  const resolvedProfile = row.iteration === '3' ? base : profile;
  const instances = row.instances ? row.instances.split('|').map((value, at) => {
    const [family, role, ...numbers] = value.split(':'), keys = ['x','y','rotation','length','width','height','thickness','fold','branches','opening','distortion'];
    if (!families.includes(family) || !['solid', 'relief'].includes(role) || numbers.length !== keys.length
      || numbers.some(number => !Number.isFinite(Number(number)))) throw new Error(`Invalid instance ${row.world_id}/${at}`);
    return { id: at + 1, family, role, ...Object.fromEntries(keys.map((key, i) => [key, Number(numbers[i])])) };
  }) : null;
  const definitions = ['low','medium','severe'].map(grade => {
    const master = masters.find(definition => definition.family === (familyIndex < 3 ? row.family : ['folded-slab', 'broken-shell', 'fibre-knot'][familyIndex - 3]) && definition.grade === grade);
    if (!master) throw new Error('Missing approved geometry grammar');
    if (!instances) return { ...master };
    const amplitude = grade === 'low' ? .88 : grade === 'medium' ? 1 : 1.1;
    return { ...master, id: `${row.world_id}-${grade}`, family: row.family, profile: row.world_id, label: row.label,
      cols: 32, rows: 24, spawn_x: 196, spawn_y: 588, exit_x: 148, exit_y: 664, search_x: 516, search_y: 580, enemy_x: 840, enemy_y: 172,
      axis: row.organization === 'bands' ? -.28 : row.organization === 'clusters' ? .42 : .1,
      instances: instances.map(instance => ({ ...instance, distortion: Math.min(.5, instance.distortion * amplitude),
        fold: Math.min(.88, instance.fold * amplitude) })),
      erosion: master.erosion.map(polygon => polygon.map(point => ({ x: point.x + 48, y: point.y + 72 }))) };
  });
  return { id: row.world_id, label: row.label, iteration: Number(row.iteration), enabled: row.enabled === 'true', profile: resolvedProfile, definitions };
});
if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('Duplicate native world');
const content = `// GENERATED from ${source}; each world owns an explicit authored arrangement.\nimport type { MasterDefinition } from '../generation/world-study/r100-master-world';\nimport type { WorldProfile } from '../generation/world-study/types';\nexport interface R100NativeWorldEntry { readonly id: string; readonly label: string; readonly iteration: number; readonly enabled: boolean; readonly profile: WorldProfile; readonly definitions: readonly MasterDefinition[] }\nexport const R100_NATIVE_CATALOG_SOURCE_HASH = '${createHash('sha256').update(text).digest('hex')}';\nexport const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ${JSON.stringify(records, null, 2)};\n`;
const target = 'src/generated/r100-native-worlds.ts';
if (process.argv.includes('--check')) { if (readFileSync(target, 'utf8') !== content) throw new Error('Native world catalog is stale'); console.log(`PASS ${records.length} authored native worlds / ${records.length * 3} definitions`); }
else writeFileSync(target, content);
