import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function generateAssimilation(check = false) {
  const source = new URL('../../data/assimilation.csv', import.meta.url);
  const target = new URL('../../src/generated/assimilation-data.ts', import.meta.url);
  const [header, ...rows] = readFileSync(source, 'utf8').trim().split(/\r?\n/);
  if (header !== 'key,value') throw new Error('Invalid assimilation CSV header');
  const values = {};
  for (const row of rows) {
    const [key, raw, extra] = row.split(',');
    if (!key || !/^[a-z_]+$/.test(key) || key in values || raw?.trim() === '' || extra !== undefined
      || !Number.isFinite(Number(raw)) || Number(raw) < 0) throw new Error(`Invalid assimilation row: ${row}`);
    values[key] = Number(raw);
  }
  const output = `// Generated from data/assimilation.csv. Do not edit.\nexport const ASSIMILATION_RULES = ${JSON.stringify(values, null, 2)} as const;\n`;
  if (check) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Assimilation generated data is stale');
  } else writeFileSync(target, output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generateAssimilation(process.argv.includes('--check'));
