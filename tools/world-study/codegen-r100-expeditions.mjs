import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = 'data/rift-expedition-grades.csv', text = readFileSync(source, 'utf8');
const [header, ...lines] = text.trim().split(/\r?\n/).map(line => line.split(','));
const rows = lines.map(values => {
  if (values.length !== header.length) throw new Error('Invalid expedition row width');
  const row = Object.fromEntries(header.map((key, index) => [key, ['grade_id', 'status', 'label', 'public_risk', 'public_preparation', 'public_reward'].includes(key) ? values[index] : Number(values[index])]));
  if (!['low', 'medium', 'severe'].includes(row.grade_id) || row.version !== 1
    || header.filter(key => !['grade_id', 'status', 'label', 'public_risk', 'public_preparation', 'public_reward'].includes(key)).some(key => !Number.isSafeInteger(row[key]) || row[key] < 0 || row[key] > 32))
    throw new Error('Invalid expedition grade values');
  return row;
});
if (rows.length !== 3 || new Set(rows.map(row => row.grade_id)).size !== 3) throw new Error('Three expedition grades required');
const hash = createHash('sha256').update(text).digest('hex');
const output = `// GENERATED from ${source}; edit the CSV.\nexport const R100_EXPEDITION_SOURCE_HASH = '${hash}';\nexport const R100_EXPEDITION_GRADES = ${JSON.stringify(rows, null, 2)} as const;\n`;
const target = 'src/generated/rift-expedition-grade-data.ts';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Stale expedition data');
  console.log('PASS R100 expedition grade CSV');
} else writeFileSync(target, output);
