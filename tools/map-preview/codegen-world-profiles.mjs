import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../data/rift-world-profiles.csv', import.meta.url));
const output = fileURLToPath(new URL('../../src/generated/rift-world-profile-data.ts', import.meta.url));
const [header, ...lines] = readFileSync(source, 'utf8').trim().split(/\r?\n/);
const columns = header.split(',');
const colors = ['void','shadow','floorDeep','floor','floorLight','materialDark','materialMid','materialLight','faceLight','accentDim','accent','accentLight','peak','actorDark','actorMid','actorLight'];
const records = lines.map((line, index) => {
  const values = line.split(',');
  if (values.length !== columns.length) throw new Error(`Invalid world profile row ${index + 2}`);
  const row = Object.fromEntries(columns.map((key, i) => [key, values[i]]));
  const palette = Object.fromEntries(colors.map(key => {
    if (!/^[0-9a-fA-F]{6}$/.test(row[key])) throw new Error(`Invalid ${row.id}.${key}`);
    return [key, Number.parseInt(row[key], 16)];
  }));
  if (!['patches', 'bands', 'clusters'].includes(row.organization)) throw new Error(`Invalid ${row.id}.organization`);
  const surface = { substrate: row.substrate, coating: row.coating, organization: row.organization };
  const kinds = ['strata', 'crystal', 'glaze'];
  if (![row.material, row.substrate, row.coating].every(kind => kinds.includes(kind))) throw new Error(`Unknown material in ${row.id}`);
  for (const key of ['coverage', 'wear', 'deposits', 'scale', 'relief', 'contrast', 'regionScale', 'quietness', 'formScale', 'fragmentation', 'accentCoverage']) {
    const value = Number(row[key]);
    const isScale = ['scale', 'regionScale', 'formScale'].includes(key);
    const min = isScale ? .5 : 0, max = isScale ? 2 : 1;
    if (!row[key] || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${row.id}.${key}`);
    surface[key] = value;
  }
  return { id: row.id, label: row.label, description: row.description, material: row.material, surface,
    palette: { ...palette, ground: palette.floor, groundLight: palette.floorLight,
      groundDark: palette.floorDeep, wall: palette.materialMid,
      wallLight: palette.faceLight, wallDark: palette.materialDark } };
});
if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('Duplicate world profile id');
const content = `// Generated from data/rift-world-profiles.csv. Edit CSV, then run codegen-world-profiles.mjs.\nimport type { WorldProfile } from '../generation/world-study/types';\n\nexport const WORLD_PROFILE_DATA: readonly WorldProfile[] = ${JSON.stringify(records, null, 2)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== content) throw new Error('World profile generated data is stale');
} else writeFileSync(output, content);
