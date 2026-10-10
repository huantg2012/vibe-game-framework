import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rows = fs.readFileSync(path.join(root, 'data/preparation-threat-copy.csv'), 'utf8').trim().split(/\r?\n/);
assert.equal(rows.shift(), 'grade,name,risk,facts,response,resources');
const fields = ['grade', 'name', 'risk', 'facts', 'response', 'resources'];
const records = rows.map(row => {
  const values = row.split(','); assert.equal(values.length, fields.length);
  assert(values.every(value => value.trim() === value && value.length > 0));
  return Object.fromEntries(fields.map((key, i) => [key, values[i]]));
});
assert.deepEqual(records.map(record => record.grade), ['low', 'medium', 'severe']);
const source = '// AUTO-GENERATED from data/preparation-threat-copy.csv — DO NOT EDIT\n'
  + 'export const PREPARATION_THREAT_COPY = ' + JSON.stringify(Object.fromEntries(records.map(({ grade, ...copy }) => [grade, copy])), null, 2) + ' as const;\n';
const target = path.join(root, 'src/generated/preparation-threat-copy.ts');
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), source);
else fs.writeFileSync(target, source);
console.log('Preparation threat copy: 3 grades verified');
