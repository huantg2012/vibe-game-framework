import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = 'data/rift-player-presentations.csv';
const target = 'src/generated/rift-player-presentations.ts';
const [header, ...lines] = fs.readFileSync(source, 'utf8').trim().split(/\r?\n/);
assert.equal(header, 'package_id,player_model');
const entries = lines.map(line => {
  const cells = line.split(',');
  assert.equal(cells.length, 2);
  const [id, model] = cells;
  assert.match(id, /^r100-[a-z]+(?:-[a-z]+)*$/);
  assert.equal(model, 'last-light-a');
  return [id, model];
});
assert.equal(new Set(entries.map(([id]) => id)).size, entries.length);
const text = `// Generated from ${source}; edit the CSV, then run tools/rift-player-models/codegen-worlds.mjs.\nexport const RIFT_PLAYER_PRESENTATIONS: Readonly<Record<string, 'last-light-a'>> = Object.freeze(${JSON.stringify(Object.fromEntries(entries), null, 2)});\n`;
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), text, 'Player world mapping is stale');
else fs.writeFileSync(target, text);
console.log(`Player presentation mapping: ${entries.length} world packages`);
