/** Compile artist-authored identities, with exact catalog coverage and no fallbacks. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validR100WorldAppearance, type R100WorldAppearance, type WorldMaterialRamp, type WorldGroundPattern, type WorldMaterialOrganization } from '../../src/generation/world-study/r100-world-appearance';
const source = 'data/rift-world-appearance.csv', sourceText = readFileSync(source, 'utf8');
const lines = sourceText.trim().split(/\r?\n/).map(line => line.split(','));
const columns = lines.shift()!;
const ramps = ['ground', 'solid', 'cleaved', 'secondary'] as const;
const expected = ['world_id', ...ramps.flatMap(role => ['dark', 'mid', 'light'].map(tone => `${role}_${tone}`)),
  'ground_pattern', 'pattern_scale', 'pattern_strength', 'secondary_coverage', 'texture_contrast', 'quiet_coverage'];
if (JSON.stringify(columns) !== JSON.stringify(expected)
  && JSON.stringify(columns) !== JSON.stringify([...expected, 'material_organization'])) throw new Error('Appearance CSV columns differ from the material identity contract');
const records = lines.map((values, index): R100WorldAppearance => {
  if (values.length !== columns.length) throw new Error(`Appearance row ${index + 2}: invalid column count`);
  const row = Object.fromEntries(columns.map((column, at) => [column, values[at]!]));
  const palette = Object.fromEntries(ramps.map(role => [role, Object.fromEntries(['dark', 'mid', 'light'].map(tone => {
    const value = row[`${role}_${tone}`]!;
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Invalid appearance color ${row.world_id}/${role}/${tone}`);
    const color = Number.parseInt(value.slice(1), 16), r = color >>> 16 & 255, g = color >>> 8 & 255, b = color & 255;
    if (g > r + 12 && g > b + 8) throw new Error(`Semantic pollution green cannot be used as ordinary material: ${row.world_id}/${role}/${tone}`);
    return [tone, color];
  }))])) as Record<typeof ramps[number], WorldMaterialRamp>;
  const result: R100WorldAppearance = { version: 1, worldId: row.world_id!, ...palette,
    groundPattern: row.ground_pattern as WorldGroundPattern, patternScale: Number(row.pattern_scale), patternStrength: Number(row.pattern_strength),
    secondaryCoverage: Number(row.secondary_coverage), textureContrast: Number(row.texture_contrast), quietCoverage: Number(row.quiet_coverage),
    ...(row.material_organization ? { materialOrganization: row.material_organization as WorldMaterialOrganization } : {}) };
  if (!validR100WorldAppearance(result)) throw new Error(`Invalid appearance contract ${row.world_id}`);
  return result;
});
const native = readFileSync('data/rift-native-worlds.csv', 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(',')[0]!);
if (new Set(records.map(row => row.worldId)).size !== records.length || records.length !== native.length
  || native.some(id => !records.some(row => row.worldId === id))) throw new Error('Appearance identities must cover the exact native world catalog');
const content = `// GENERATED from ${source}; do not hand edit.\nimport type { R100WorldAppearance } from '../generation/world-study/r100-world-appearance';\nexport const R100_APPEARANCE_SOURCE_HASH = '${createHash('sha256').update(sourceText).digest('hex')}';\nexport const R100_WORLD_APPEARANCES: readonly R100WorldAppearance[] = ${JSON.stringify(records, null, 2)};\n`;
const target = 'src/generated/r100-world-appearance.ts';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== content) throw new Error('Stale world appearance data');
  console.log(`PASS ${records.length} authored world material identities, complete catalog coverage`);
} else writeFileSync(target, content);
