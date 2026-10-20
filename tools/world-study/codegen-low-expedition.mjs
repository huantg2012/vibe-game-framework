/** Low-risk recovery trips: CSV-owned, limited to the three admitted worlds. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const file = 'data/rift-low-expedition.csv';
const [header, ...lines] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/);
assert.equal(header, 'world_id,kindling_safe_count,kindling_contested_count,kindling_deep_count,kindling_safe_allow_weapon');
const [bankHeader, ...bank] = fs.readFileSync('data/rift-low-expedition-content-seeds.csv', 'utf8').trim().split(/\r?\n/);
assert.equal(bankHeader, 'world_id,grade,content_seed,exit_x,exit_y,content_identity');
const rows = lines.map(line => {
  const [worldId, safe, contested, deep, allowWeapon] = line.split(',');
  assert(['cinder-ridge', 'crystal-fibre', 'ruptured-film'].includes(worldId));
  assert.equal(allowWeapon, 'false', 'Low-risk safe fuel must not be replaced by a weapon');
  const row = {
    worldId,
    kindling_safe_count: Number(safe),
    kindling_contested_count: Number(contested),
    kindling_deep_count: Number(deep),
    kindling_safe_allow_weapon: false,
    contentSeeds: bank.filter(line => line.startsWith(`${worldId},low,`)).map(line => Number(line.split(',')[2])),
    contentIdentity: bank.find(line => line.startsWith(`${worldId},low,`))?.split(',')[5],
  };
  for (const count of [row.kindling_safe_count, row.kindling_contested_count, row.kindling_deep_count])
    assert(Number.isSafeInteger(count) && count >= 1 && count <= 16);
  assert(row.contentSeeds.length >= 2 && row.contentSeeds.length <= 8);
  assert.equal(new Set(row.contentSeeds).size, row.contentSeeds.length);
  assert(row.contentSeeds.every(seed => Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff));
  assert(/^[0-9a-f]{8}$/.test(row.contentIdentity ?? ''));
  assert(bank.filter(line => line.startsWith(`${worldId},low,`)).every(line => line.split(',')[5] === row.contentIdentity));
  row.sourceHash = createHash('sha256').update(JSON.stringify(row)).digest('hex');
  return row;
});
assert.equal(rows.length, 3);
assert.equal(new Set(rows.map(row => row.worldId)).size, 3);
const target = 'src/generated/rift-low-expedition-data.ts';
const text = `// GENERATED from ${file}; edit the CSV.\nexport const RIFT_LOW_EXPEDITION_OVERRIDES = ${JSON.stringify(rows, null, 2)} as const;\n`;
if (process.argv.includes('--check')) assert.equal(fs.readFileSync(target, 'utf8'), text);
else fs.writeFileSync(target, text);
console.log(`PASS ${target}`);
