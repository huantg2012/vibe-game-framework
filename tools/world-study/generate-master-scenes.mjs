import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const source = 'data/rift-master-scenes.csv';
const raw = readFileSync(source, 'utf8');
const lines = raw.trim().split(/\r?\n/), header = lines.shift().split(',');
const numeric = ['cols','rows','seed','spawn_x','spawn_y','exit_x','exit_y','search_x','search_y','enemy_x','enemy_y','axis','light_radius','emission','motion_period','ground_quietness','ground_contrast','ground_coverage','ground_material_blend'];
const rows = lines.map(line => {
  const values = line.split(',');
  if (values.length !== header.length) throw new Error(`Column count ${line}`);
  const row = Object.fromEntries(header.map((key,i) => [key, values[i]]));
  for (const key of numeric) { row[key] = Number(row[key]); if (!Number.isFinite(row[key])) throw new Error(`Invalid ${key}`); }
  if (!['folded-slab','fibre-knot','broken-shell'].includes(row.family) || !['low','medium','severe'].includes(row.grade)) throw new Error(`Unknown family/grade ${row.id}`);
  if (row.cols < 24 || row.cols > 40 || row.rows < 18 || row.rows > 32 || row.emission < 0 || row.emission > 1) throw new Error(`Outside art-lab bounds ${row.id}`);
  const keys = ['x','y','rotation','length','width','height','thickness','fold','branches','opening','distortion'];
  row.instances = row.instances.split('|').map((definition,i) => {
    const values = definition.split(':').map(Number);
    if (values.length !== keys.length || values.some(v => !Number.isFinite(v))) throw new Error(`Invalid instance ${row.id}/${i}`);
    return { id:i+1, ...Object.fromEntries(keys.map((key,j) => [key,values[j]])) };
  });
  return row;
});
if (new Set(rows.map(r => r.id)).size !== rows.length || rows.length !== 9) throw new Error('Expected nine unique master cells');
for (const family of new Set(rows.map(r => r.family))) if (new Set(rows.filter(r=>r.family===family).map(r=>r.grade)).size !== 3) throw new Error(`Missing grade ${family}`);
const output = `// GENERATED from ${source}; edit the CSV, not this file.\nexport const MASTER_SCENES_SOURCE_HASH = '${createHash('sha256').update(raw).digest('hex')}';\nexport const MASTER_SCENES = ${JSON.stringify(rows,null,2)} as const;\n`;
const target = 'src/dev/rift-r100-masters/generated-scenes.ts';
if (process.argv.includes('--check')) { if (readFileSync(target,'utf8') !== output) throw new Error('Master scene data is stale'); console.log('9 art-lab scenes / 3 families × 3 grades: CSV and generated data match'); }
else { writeFileSync(target,output); console.log(`Generated ${target}`); }
