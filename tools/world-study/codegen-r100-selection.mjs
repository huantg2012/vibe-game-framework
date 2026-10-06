/** The authored departure policy is independent of frozen map generation. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const source = 'data/rift-world-selection.csv';
const input = readFileSync(source, 'utf8');
const rows = input.trim().split(/\r?\n/).map(line => line.split(','));
const fields = ['version', 'history_limit', 'repeat_weight', 'neighbor_weight', 'neighbor_distance'];
if (rows.length !== 2 || JSON.stringify(rows[0]) !== JSON.stringify(fields) || rows[1].length !== fields.length) {
  throw new Error('World selection policy requires the exact header and one authored row');
}
const [version, historyLimit, repeatWeight, neighborWeight, neighborDistance] = rows[1].map(Number);
if (version !== 1 || !Number.isInteger(historyLimit) || historyLimit < 2 || historyLimit > 32
  || !(repeatWeight > 0 && repeatWeight < neighborWeight && neighborWeight < 1)
  || !(neighborDistance > 0 && neighborDistance < 1)) throw new Error('Invalid world selection policy');
const policy = { version, historyLimit, repeatWeight, neighborWeight, neighborDistance };
const output = `// GENERATED from ${source}; do not hand edit.\nexport const R100_SELECTION_SOURCE_HASH = '${createHash('sha256').update(input).digest('hex')}';\nexport const R100_WORLD_SELECTION_POLICY = ${JSON.stringify(policy, null, 2)} as const;\n`;
const target = 'src/generated/r100-world-selection.ts';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Stale world selection policy');
  console.log('PASS authored world selection policy');
} else writeFileSync(target, output);
