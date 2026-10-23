import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const source = 'data/rift-auto-supply-policy.csv';
const target = 'src/generated/rift-auto-supply-policy.ts';
const fields = ['grade', 'bodyAreaPerNodePx2', 'routePerNodePx', 'maxCoveragePx', 'p95CoveragePx', 'maxNodes', 'earlyFuelNodes', 'maxBodyCells', 'maxWorkEdges', 'contestedApproachMinPx', 'deepApproachMinPx'];
export function compileAutomaticSupplyCSV(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.shift() !== fields.join(',')) throw new Error('Invalid automatic supply header');
  const rows = lines.map(line => {
    const values = line.split(',');
    if (values.length !== fields.length) throw new Error('Invalid automatic supply row');
    const row = Object.fromEntries(fields.map((field, i) => [field, i ? Number(values[i]) : values[i]]));
    if (fields.slice(1).some(field => !Number.isSafeInteger(row[field]) || row[field] < (field === 'earlyFuelNodes' ? 0 : 1))
      || row.grade === 'low' && row.earlyFuelNodes < 2
      || row.deepApproachMinPx <= row.contestedApproachMinPx
      || row.p95CoveragePx > row.maxCoveragePx || row.maxNodes > 32 || row.earlyFuelNodes > row.maxNodes
      || row.maxBodyCells > 131072 || row.maxWorkEdges > 64000000) throw new Error('Invalid automatic supply bounds');
    return row;
  });
  if (rows.length !== 3 || rows.map(row => row.grade).sort().join(',') !== 'low,medium,severe') throw new Error('Require one policy per grade');
  const sourceHash = createHash('sha256').update(raw).digest('hex');
  return `// GENERATED from ${source}; edit CSV, not this file.\nexport const AUTOMATIC_SUPPLY_POLICIES = ${JSON.stringify(rows.map(row => ({version:1,algorithm:'body-geodesic-cover-v1',sourceHash,...row})), null, 2)} as const;\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = compileAutomaticSupplyCSV(readFileSync(source, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Automatic supply policy is stale');
    console.log('Automatic supply CSV matches generated policy');
  } else writeFileSync(target, output);
}
