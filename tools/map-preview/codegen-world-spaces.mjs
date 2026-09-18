import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../data/rift-world-spaces.csv', import.meta.url));
const output = fileURLToPath(new URL('../../src/generated/rift-world-space-data.ts', import.meta.url));
const [header, ...lines] = readFileSync(source, 'utf8').trim().split(/\r?\n/);
const fields = header.split(',');
const records = lines.map((line, index) => {
  const values = line.split(',');
  if (values.length !== fields.length) throw new Error(`Invalid space CSV row ${index + 2}`);
  const row = Object.fromEntries(fields.map((key, i) => [key, i < 2 ? values[i] : Number(values[i])]));
  if (!row.id || !row.label || Object.values(row).some(value => typeof value === 'number' && !Number.isFinite(value)))
    throw new Error(`Invalid space CSV row ${index + 2}`);
  return row;
});
if (new Set(records.map(row => row.id)).size !== records.length) throw new Error('Duplicate space profile');
const content = `// Generated from data/rift-world-spaces.csv.\nimport type { SpaceProfile } from '../generation/world-study/space-profile';\nexport const WORLD_SPACE_DATA: readonly SpaceProfile[] = ${JSON.stringify(records, null, 2)};\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== content) throw new Error('World space generated data is stale');
} else writeFileSync(output, content);
