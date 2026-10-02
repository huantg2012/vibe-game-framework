import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const source = 'data/rift-master-materials.csv';
const target = 'src/dev/rift-r100-masters/generated-materials.ts';
const families = ['folded-slab', 'fibre-knot', 'broken-shell'];

export function compilePaintedMaterialCSV(raw) {
  const lines = raw.trim().split(/\r?\n/);
  if (lines.shift() !== 'family,source,logical_pixels,world_size,skin_region,cleaved_region,loose_region') throw new Error('Unexpected painted material CSV header');
  const rows = lines.map((line, index) => {
    const values = line.split(',');
    if (values.length !== 7 || values.some(value => value !== value.trim() || value === '')) throw new Error(`Invalid painted material columns at row ${index + 2}`);
    const [family, source, logicalText, worldText, skin, cleaved, loose] = values;
    const logical_pixels = Number(logicalText), world_size = Number(worldText);
    if (!families.includes(family)) throw new Error(`Unknown painted material family: ${family}`);
    if (!/^\/assets\/r100-materials\/[a-z0-9-]+-source\.png$/.test(source)) throw new Error(`Invalid painted material source: ${source}`);
    if (!Number.isInteger(logical_pixels) || logical_pixels < 1 || logical_pixels > 2048) throw new Error(`Invalid logical_pixels for ${family}: expected 1–2048`);
    if (!Number.isFinite(world_size) || world_size <= 0) throw new Error(`Invalid world_size for ${family}: expected a positive finite size`);
    const region=(text,name)=>{
      const fields=text.split(':');
      if(fields.some(value=>value===''||value!==value.trim()))throw new Error(`Invalid ${name} region for ${family}`);
      const values=fields.map(Number);
      if(values.length!==4||values.some(value=>!Number.isFinite(value)))throw new Error(`Invalid ${name} region for ${family}`);
      const [x,y,width,height]=values;
      if(x<0||y<0||width<=0||height<=0||x+width>1||y+height>1||width*logical_pixels<8||height*logical_pixels<8)throw new Error(`Out of bounds ${name} region for ${family}`);
      return {x,y,width,height};
    };
    return { family, source, logical_pixels, world_size, regions:{skin:region(skin,'skin'),cleaved:region(cleaved,'cleaved'),loose:region(loose,'loose')} };
  });
  if (rows.length !== families.length || new Set(rows.map(row => row.family)).size !== families.length) throw new Error('Expected one painted material per family');
  if (new Set(rows.map(row => row.source)).size !== rows.length) throw new Error('Each painted material family requires its own source');
  return `// GENERATED from ${source}; edit the CSV, not this file.\nexport const PAINTED_MATERIALS_SOURCE_HASH = '${createHash('sha256').update(raw).digest('hex')}';\nexport const PAINTED_MATERIALS = ${JSON.stringify(rows, null, 2)} as const;\nexport type PaintedMaterialFamily = typeof PAINTED_MATERIALS[number]['family'];\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = compilePaintedMaterialCSV(readFileSync(source, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== output) throw new Error('Painted material manifest is stale');
    console.log('3 painted material families: CSV and generated manifest match');
  } else {
    writeFileSync(target, output);
    console.log(`Generated ${target}`);
  }
}
