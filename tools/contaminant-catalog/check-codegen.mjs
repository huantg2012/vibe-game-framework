/** Codegen rejects content contract regressions; temporary data never touches production CSVs. */
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateContaminantCatalog } from '../csv-codegen/contaminant-catalog.mjs';
const root = mkdtempSync(join(tmpdir(), 'coh-catalog-codegen-'));
try {
  cpSync('data', join(root, 'data'), { recursive: true });
  const out = join(root, 'out'); mkdirSync(out);
  const file = join(root, 'data', 'contaminant-items.csv');
  const original = readFileSync(file, 'utf8');
  const lines = original.trim().split(/\r?\n/), headers = lines[0].split(',');
  const altered = (id, changes) => lines.map(line => {
    const fields = line.split(',');
    if (fields[0] !== id) return line;
    for (const [key, value] of Object.entries(changes)) fields[headers.indexOf(key)] = String(value);
    return fields.join(',');
  }).join('\n') + '\n';
  writeFileSync(file, altered('stopped_pocket_watch', { range_px: 160 }));
  assert.throws(() => generateContaminantCatalog(root, out), /Multiple strength axes/);
  writeFileSync(file, altered('stopped_pocket_watch', { duration_ms: 4500 }));
  assert.throws(() => generateContaminantCatalog(root, out), /Multiple strength axes/);
  writeFileSync(file, altered('wax_sealed_button', { param_value: 2600 }));
  assert.throws(() => generateContaminantCatalog(root, out), /Weak item is not weaker/);
  writeFileSync(file, altered('amber_beetle', { enabled: false }));
  assert.throws(() => generateContaminantCatalog(root, out), /Missing enabled core grades/);
  const extra = lines.find(line => line.startsWith('amber_beetle,' )).split(',');
  extra[0] = 'extra_beetle'; extra[headers.indexOf('display_name')] = '扩池测试样本'; extra[headers.indexOf('icon_id')] = 'extra_beetle';
  writeFileSync(file, original.trim() + '\n' + extra.join(',') + '\n');
  generateContaminantCatalog(root, out);
  const generated = readFileSync(join(out, 'contaminant-catalog-data.ts'), 'utf8');
  assert(generated.includes('"extra_beetle"')); assert(generated.includes('"familyId": "solidify"'));
  console.log('PASS codegen: secondary axes / weak strength / missing enabled grade rejected; same-grade expansion accepted');
} finally { rmSync(root, { recursive: true, force: true }); }
