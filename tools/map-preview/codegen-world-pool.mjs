import { readFileSync, writeFileSync } from 'node:fs';
const read = name => readFileSync(new URL(`../../data/${name}.csv`, import.meta.url), 'utf8').trim().split(/\r?\n/).map(line => line.split(','));
const ids = name => new Set(read(name).slice(1).map(row => row[0]));
const profiles = ids('rift-world-profiles'), spaces = ids('rift-world-spaces'), dialects = ids('contamination-dialects');
const [header, ...rows] = read('rift-world-pool');
if (header.join(',') !== 'profile_id,space_id,content_fragment_id,weight,enabled') throw new Error('Invalid world pool header');
const entries = rows.map(([profileId, spaceId, contentFragmentTypeId, weight, enabled, ...extra]) => {
  if (extra.length || !profiles.has(profileId) || !spaces.has(spaceId) || !dialects.has(contentFragmentTypeId)
    || !Number.isSafeInteger(Number(weight)) || Number(weight) <= 0 || !['0','1'].includes(enabled)) throw new Error(`Invalid world pool entry ${profileId}/${spaceId}`);
  return { profileId, spaceId, contentFragmentTypeId, weight: Number(weight), enabled: enabled === '1' };
});
if (!entries.some(row => row.enabled) || new Set(entries.map(row => `${row.profileId}/${row.spaceId}`)).size !== entries.length) throw new Error('Empty or duplicate world pool');
const content = `// Generated from data/rift-world-pool.csv. Run npm run worlds:codegen.\nexport const WORLD_PRODUCTION_POOL = ${JSON.stringify(entries, null, 2)} as const;\n`;
const output = new URL('../../src/generated/rift-world-pool-data.ts', import.meta.url);
if (process.argv.includes('--check')) {
  if (readFileSync(output, 'utf8') !== content) throw new Error('World pool generated data is stale');
} else writeFileSync(output, content);
