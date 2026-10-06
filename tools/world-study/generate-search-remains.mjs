import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const source = 'data/rift-search-remains.csv';
const target = 'src/generated/rift-search-remains.ts';
const grammars = ['laminated-flakes', 'fractured-fibres', 'glaze-shell', 'mineral-splinters', 'packed-granules', 'torn-membrane', 'gel-fragments', 'compressed-fibre-fragments', 'porous-core-chips'];

export function compileSearchRemainsCSV(raw, worldIds) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.shift() !== 'world_id,grammar') throw new Error('Unexpected search remains CSV header');
  const rows = lines.map((line, index) => {
    const fields = line.split(',');
    if (fields.length !== 2 || fields.some(value => !value || value !== value.trim())) throw new Error(`Invalid search remains row ${index + 2}`);
    const [worldId, grammar] = fields;
    if (!worldIds.includes(worldId)) throw new Error(`Unknown search remains world ${worldId}`);
    if (!grammars.includes(grammar)) throw new Error(`Unknown search remains grammar ${grammar}`);
    return { worldId, grammar };
  });
  if (rows.length !== worldIds.length || new Set(rows.map(row => row.worldId)).size !== worldIds.length) throw new Error('Every source world requires exactly one search remains grammar');
  return `// GENERATED from ${source}; edit the CSV, not this file.\nexport const SEARCH_REMAINS_SOURCE_HASH = '${createHash('sha256').update(raw).digest('hex')}';\nexport const SEARCH_REMAINS = ${JSON.stringify(rows, null, 2)} as const;\nexport type SearchRemainsGrammar = ${grammars.map(value => `'${value}'`).join(' | ')};\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const worldIds = [...new Set(['data/rift-world-profiles.csv', 'data/rift-native-worlds.csv'].flatMap(path => readFileSync(path, 'utf8').trim().split(/\r?\n/).slice(1).map(line => line.split(',')[0])))];
  const output = compileSearchRemainsCSV(readFileSync(source, 'utf8'), worldIds);
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Search remains manifest is stale');
    console.log(`${worldIds.length} source worlds: search remains manifest matches CSV`);
  } else {
    writeFileSync(target, output);
    console.log(`Generated ${target}`);
  }
}
