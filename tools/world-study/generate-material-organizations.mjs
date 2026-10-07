/** Independent opt-in material atoms; old family manifests are never rewritten. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const source = 'data/rift-material-organizations.csv';
const target = 'src/generated/r100-material-organizations.ts';
const organizations = ['short-fibre', 'porous-marrow', 'short-fibre-loose'];
const header = 'organization,source,logical_pixels,world_size,skin_region,cleaved_region,loose_region,solid_source,solid_world_size,solid_skin_region,solid_cut_region,solid_skin_roughness,solid_cut_roughness,solid_gain,solid_cut_gain';

export function compileMaterialOrganizationsCSV(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.shift() !== header) throw new Error('Unexpected material organization CSV header');
  const rows = lines.map((line, index) => {
    const values = line.split(',');
    if (values.length !== 15 || values.some(value => !value || value !== value.trim())) throw new Error(`Invalid material organization row ${index + 2}`);
    const [organization, imageSource, logicalText, worldText, skin, cleaved, loose, solidSource, solidWorldText, solidSkin, solidCut, skinRoughness, cutRoughness, gainText, cutGainText] = values;
    if (!organizations.includes(organization)) throw new Error(`Unknown material organization: ${organization}`);
    const logical_pixels = Number(logicalText), world_size = Number(worldText), solidWorldSize = Number(solidWorldText);
    if (!Number.isInteger(logical_pixels) || logical_pixels < 32 || logical_pixels > 2048) throw new Error('Invalid logical_pixels');
    if (![world_size, solidWorldSize].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid world_size');
    for (const file of [imageSource, solidSource]) if (!/^\/assets\/r100-materials\/[a-z0-9-]+-source\.png$/.test(file)) throw new Error(`Invalid material atom path: ${file}`);
    const region = (text, name) => {
      const parts = text.split(':');
      if (parts.length !== 4 || parts.some(value => !value || value !== value.trim())) throw new Error(`Invalid ${name} region`);
      const [x, y, width, height] = parts.map(Number);
      if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1 || width * logical_pixels < 8 || height * logical_pixels < 8) throw new Error(`Out of bounds ${name} region`);
      return { x, y, width, height };
    };
    const skinFinish = Number(skinRoughness), cutFinish = Number(cutRoughness), gain = Number(gainText), cutGain = Number(cutGainText);
    if (![skinFinish, cutFinish].every(n => Number.isFinite(n) && n > 0 && n <= 1) || skinFinish >= cutFinish) throw new Error('Fracture must be rougher than intact skin');
    if (![gain, cutGain].every(n => Number.isFinite(n) && n > 0 && n <= 1.5)) throw new Error('Invalid source gain');
    return { organization, source: imageSource, logical_pixels, world_size,
      regions: { skin: region(skin, 'skin'), cleaved: region(cleaved, 'cleaved'), loose: region(loose, 'loose') },
      solid: { source: solidSource, logical_pixels, world_size: solidWorldSize,
        regions: { skin: region(solidSkin, 'solid skin'), cleaved: region(solidCut, 'solid cut'), loose: region(solidCut, 'solid cut') },
        skinRoughness: skinFinish, cutRoughness: cutFinish, gain, cutGain } };
  });
  if (rows.length !== organizations.length || new Set(rows.map(row => row.organization)).size !== organizations.length) throw new Error('Expected one source pair for each material organization');
  if (new Set(rows.flatMap(row => [row.source, row.solid.source])).size !== rows.length * 2) throw new Error('Every organization needs independent ground and solid atoms');
  return `// GENERATED from ${source}; edit the CSV, not this file.\nexport const ORGANIZATION_MATERIALS_SOURCE_HASH = '${createHash('sha256').update(raw).digest('hex')}';\nexport const ORGANIZATION_MATERIALS = ${JSON.stringify(rows, null, 2)} as const;\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = compileMaterialOrganizationsCSV(readFileSync(source, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Material organization manifest is stale');
    console.log(`${organizations.length} opt-in material organizations: CSV and generated manifest match`);
  } else { writeFileSync(target, output); console.log(`Generated ${target}`); }
}
